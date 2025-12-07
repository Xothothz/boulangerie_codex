import express from 'express';
import prisma from '../config/db.js';
import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { getWeekDateRange } from '../utils/week.js';
import { ensureMagasin, getMagasinScope } from '../utils/magasin.js';

const router = express.Router();

function normalizeHeaderKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function pickColumnValue(row, candidates) {
  const keys = Object.keys(row || {});
  for (const candidate of candidates) {
    const target = normalizeHeaderKey(candidate);
    const key = keys.find((k) => normalizeHeaderKey(k).startsWith(target));
    if (key !== undefined && row[key] !== undefined && row[key] !== null) {
      const val = String(row[key]).trim();
      if (val) return val;
    }
  }
  return null;
}

function normalizeCode(val) {
  return String(val || '').replace(/\s+/g, '').trim().toLowerCase();
}

function normalizeName(val) {
  return normalizeHeaderKey(val);
}

function buildProduitIndex(produits) {
  const byRef = new Map();
  const byIfls = new Map();
  const byEan = new Map();
  const byNom = new Map();

  produits.forEach((p) => {
    if (p.reference) byRef.set(normalizeCode(p.reference), p);
    if (p.ifls) byIfls.set(normalizeCode(p.ifls), p);
    if (p.ean13) byEan.set(normalizeCode(p.ean13), p);
    if (p.nom) byNom.set(normalizeName(p.nom), p);
  });

  return {
    findForRow: (row) => {
      const ref = pickColumnValue(row, ['reference', 'référence', 'ref']);
      if (ref) {
        const hit = byRef.get(normalizeCode(ref));
        if (hit) return hit;
      }
      const ifls = pickColumnValue(row, ['ifls', 'code ifls']);
      if (ifls) {
        const hit = byIfls.get(normalizeCode(ifls));
        if (hit) return hit;
      }
      const ean = pickColumnValue(row, ['ean', 'ean13', 'code barre', 'codebarre', 'ean 13']);
      if (ean) {
        const hit = byEan.get(normalizeCode(ean));
        if (hit) return hit;
      }
      const nom = pickColumnValue(row, ['produit', 'nom']);
      if (nom) {
        const hit = byNom.get(normalizeName(nom));
        if (hit) return hit;
      }
      return null;
    },
  };
}

function lightenHex(hex, ratio = 0.82) {
  if (!hex) return null;
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return null;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  const blend = (channel) => Math.round(channel + (255 - channel) * ratio);
  const toHex = (v) => v.toString(16).padStart(2, '0');
  return `#${toHex(blend(r))}${toHex(blend(g))}${toHex(blend(b))}`;
}

function excelColor(hex) {
  const light = lightenHex(hex);
  if (!light) return null;
  return light.replace('#', '').toUpperCase();
}

/**
 * POST /semaine/import-excel
 * Reçoit un fichier Excel contenant 1 ligne par produit et 7 colonnes représentant les jours de la semaine.
 * Les valeurs sont les quantités vendues ou perdues = mouvements de stock SORTIE.
 *
 * Body attendu : fichier Excel multipart/form-data sous le champ "file".
 */
function buildCommentaire(typeLabel, jour) {
  return `Import Excel ${typeLabel} – ${jour}`;
}

function formatDate(d) {
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

async function importExcel(req, res, typeLabel) {
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const { sem } = req.query;
    if (!sem) {
      return res
        .status(400)
        .json({ error: 'Paramètre "sem" requis (format YYYY-Wxx)' });
    }

    const { monday, days } = getWeekDateRange(sem);
    if (Number.isNaN(monday.getTime())) {
      return res.status(400).json({ error: 'Paramètre "sem" invalide' });
    }

    if (!req.files || !req.files.file) {
      return res
        .status(400)
        .json({ error: 'Aucun fichier reçu (champ attendu: file)' });
    }

    const file = req.files.file;
    const tempPath = path.join('/tmp', file.name);
    await file.mv(tempPath);

    const workbook = xlsx.readFile(tempPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // Nos templates placent les en-têtes en première ligne
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    const produitsActifs = await prisma.produit.findMany({
      where: {
        actif: true,
        ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}),
      },
      select: { id: true, nom: true, reference: true, ifls: true, ean13: true },
    });

    const produitIndex = buildProduitIndex(produitsActifs);

    const mouvements = [];
    const produitsNonTrouves = [];
    let mouvementsEnregistres = 0;

    const dayLabels = jours.map((jour, idx) => {
      const date = days[idx];
      return `${jour} (${formatDate(date)})`;
    });

    const getValueForDay = (row, jour) => {
      const key = Object.keys(row).find((k) =>
        k.toLowerCase().startsWith(jour.toLowerCase()),
      );
      if (!key) return null;
      return row[key];
    };

    for (const row of rows) {
      const nomProduitRaw =
        row.Produit || row.produit || row.Nom || row.nom || '';
      const nomProduit = nomProduitRaw.toString().trim();
      if (!nomProduit) continue;

      const produit =
        produitIndex.findForRow(row) ||
        produitIndex.findForRow({ produit: nomProduitRaw }); // fallback sur nom uniquement

      if (!produit) {
        produitsNonTrouves.push(nomProduit);
        continue;
      }

      for (let i = 0; i < jours.length; i++) {
        const jour = jours[i];
        const quantite = Number(getValueForDay(row, jour));

        if (!quantite || quantite <= 0) continue;

        const startDay = new Date(days[i]);
        startDay.setHours(0, 0, 0, 0);
        const endDay = new Date(days[i]);
        endDay.setHours(23, 59, 59, 999);

        // Supprime les mouvements existants pour cette journée / produit / nature
        await prisma.mouvementStock.deleteMany({
          where: {
            produitId: produit.id,
            nature: typeLabel === 'ventes' ? 'VENTE' : 'PERTE',
            date: { gte: startDay, lte: endDay },
            produit: resolvedMagasinId ? { magasinId: resolvedMagasinId } : undefined,
          },
        });

        const mouvement = await prisma.mouvementStock.create({
          data: {
            produitId: produit.id,
            type: 'SORTIE',
            quantite: -quantite,
            commentaire: buildCommentaire(typeLabel, dayLabels[i]),
            date: days[i],
            nature: typeLabel === 'ventes' ? 'VENTE' : 'PERTE',
          },
        });

        mouvementsEnregistres++;
        mouvements.push(mouvement);
      }
    }

    fs.unlinkSync(tempPath);

    const produitsTrouves = mouvements.reduce((set, mv) => {
      set.add(mv.produitId);
      return set;
    }, new Set());

    return res.json({
      produits_trouves: produitsTrouves.size,
      produits_non_trouves: produitsNonTrouves,
      mouvements_enregistres: mouvementsEnregistres,
      mouvements: mouvements.slice(0, 5),
    });
  } catch (err) {
    console.error(`Erreur import-excel (${typeLabel}) :`, err);
    return res.status(500).json({
      error: "Erreur serveur pendant l'import Excel",
      details: err.message,
    });
  }
}

router.post('/import-excel', async (req, res) => importExcel(req, res, 'ventes'));
router.post('/import-excel-ventes', async (req, res) => importExcel(req, res, 'ventes'));
router.post('/import-excel-pertes', async (req, res) => importExcel(req, res, 'pertes'));

// Helpers
const jours = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
];

async function generateExcel(produits, titre, days) {
  const dayLabels = jours.map((jour, idx) => `${jour} (${formatDate(days[idx])})`);
  const header = ['Produit', ...dayLabels];
  const rows = produits.map((p) => [p.nom, '', '', '', '', '', '', '']);
  const worksheet = xlsx.utils.aoa_to_sheet([header, ...rows]);

  // Coloration par catégorie (pastel) pour plus de lisibilité.
  produits.forEach((p, idx) => {
    const hex = excelColor(p.categorieCouleur);
    if (!hex) return;
    for (let c = 0; c < header.length; c++) {
      const cellAddress = xlsx.utils.encode_cell({ r: idx + 1, c });
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { t: 's', v: '' };
      }
      worksheet[cellAddress].s = {
        ...(worksheet[cellAddress].s || {}),
        fill: {
          patternType: 'solid',
          fgColor: { rgb: hex },
        },
      };
    }
  });

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Semaine');
  return xlsx.write(workbook, {
    bookType: 'xlsx',
    type: 'buffer',
  });
}

function generatePDF(doc, titre, produits, dayLabels) {
  doc
    .fontSize(18)
    .font('Helvetica-Bold')
    .fillColor('#0f172a')
    .text(titre, { align: 'center' });
  doc
    .moveDown(0.4)
    .fontSize(12)
    .font('Helvetica')
    .fillColor('#475569')
    .text('Lambert Gestion : Boulangerie', { align: 'center' });
  doc.moveDown(1);
  doc.fillColor('#0f172a');

  const pageWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const productColWidth = pageWidth * 0.3;
  const dayColWidth = (pageWidth - productColWidth) / jours.length;
  const headers = ['Produit', ...dayLabels];
  const startX = doc.page.margins.left;
  const headerHeight = 32;
  const rowHeight = 22;
  let y = doc.y;

  const drawHeader = () => {
    let x = startX;
    doc
      .save()
      .fillColor('#f8fafc')
      .rect(startX, y, pageWidth, headerHeight)
      .fill()
      .restore();
    doc.strokeColor('#cbd5e1').lineWidth(1);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a');
    headers.forEach((h, index) => {
      const colWidth = index === 0 ? productColWidth : dayColWidth;
      doc.rect(x, y, colWidth, headerHeight).stroke();
      doc.text(h, x + 6, y + 9, { width: colWidth - 12 });
      x += colWidth;
    });
    y += headerHeight;
    doc.font('Helvetica').fontSize(10).fillColor('#0f172a');
  };

  drawHeader();

  produits.forEach((p) => {
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeader();
    }

    const rowFill = lightenHex(p.categorieCouleur || '');
    if (rowFill) {
      doc.save().rect(startX, y, pageWidth, rowHeight).fill(rowFill).restore();
    }

    let x = startX;
    doc
      .rect(x, y, productColWidth, rowHeight)
      .strokeColor('#e2e8f0')
      .stroke();
    doc.text(p.nom, x + 6, y + 6, {
      width: productColWidth - 12,
      height: rowHeight - 10,
      ellipsis: true,
    });
    x += productColWidth;

    for (let i = 0; i < jours.length; i++) {
      doc
        .rect(x, y, dayColWidth, rowHeight)
        .strokeColor('#e2e8f0')
        .stroke();
      x += dayColWidth;
    }

    y += rowHeight;
  });

  doc
    .moveTo(startX, y)
    .lineTo(startX + pageWidth, y)
    .strokeColor('#cbd5e1')
    .stroke();
}

/**
 * GET /semaine/feuille-excel
 * Génère une feuille hebdomadaire vierge au format Excel.
 */
router.get('/feuille-excel', async (req, res) => {
  const { sem } = req.query;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!sem) {
    return res
      .status(400)
      .json({ error: 'Paramètre "sem" requis (format YYYY-Wxx)' });
  }

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const { monday, sunday, days } = getWeekDateRange(sem);
    if (Number.isNaN(monday.getTime()) || Number.isNaN(sunday.getTime())) {
      return res.status(400).json({ error: 'Paramètre "sem" invalide' });
    }

    const produits = await prisma.produit.findMany({
      where: {
        actif: true,
        ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}),
      },
      orderBy: [
        { categorieRef: { nom: 'asc' } },
        { nom: 'asc' },
      ],
      select: {
        nom: true,
        categorieRef: { select: { nom: true, couleur: true } },
      },
    });

    const titre = `Feuille hebdomadaire – Semaine ${sem}`;
    const buffer = await generateExcel(
      produits.map((p) => ({
        nom: p.nom,
        categorieNom: p.categorieRef?.nom || '',
        categorieCouleur: p.categorieRef?.couleur || null,
      })),
      titre,
      days,
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Feuille_Semaine_${sem}.xlsx"`,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    return res.send(buffer);
  } catch (err) {
    console.error('Erreur feuille-excel :', err);
    return res
      .status(500)
      .json({ error: 'Erreur serveur lors de la génération Excel' });
  }
});

/**
 * GET /semaine/feuille-pdf
 * Génère une feuille hebdomadaire vierge au format PDF.
 */
router.get('/feuille-pdf', async (req, res) => {
  const { sem } = req.query;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!sem) {
    return res
      .status(400)
      .json({ error: 'Paramètre "sem" requis (format YYYY-Wxx)' });
  }

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const { monday, sunday, days } = getWeekDateRange(sem);
    if (Number.isNaN(monday.getTime()) || Number.isNaN(sunday.getTime())) {
      return res.status(400).json({ error: 'Paramètre "sem" invalide' });
    }

    const produits = await prisma.produit.findMany({
      where: {
        actif: true,
        ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}),
      },
      orderBy: [
        { categorieRef: { nom: 'asc' } },
        { nom: 'asc' },
      ],
      select: {
        nom: true,
        categorieRef: { select: { nom: true, couleur: true } },
      },
    });

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 40,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Feuille_Semaine_${sem}.pdf"`,
    );

    doc.pipe(res);

    const formatDate = (d) =>
      d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

    const titre = `Feuille hebdomadaire – Semaine du ${formatDate(
      monday,
    )} au ${formatDate(sunday)}`;

    const dayLabels = jours.map((jour, idx) => `${jour} (${formatDate(days[idx])})`);

    generatePDF(
      doc,
      titre,
      produits.map((p) => ({
        nom: p.nom,
        categorieNom: p.categorieRef?.nom || '',
        categorieCouleur: p.categorieRef?.couleur || null,
      })),
      dayLabels,
    );

    doc.end();
  } catch (err) {
    console.error('Erreur feuille-pdf :', err);
    return res
      .status(500)
      .json({ error: 'Erreur serveur lors de la génération PDF' });
  }
});

const feuilleTypes = [
  { key: 'ventes', label: 'VENTES' },
  { key: 'pertes', label: 'PERTES' },
];

feuilleTypes.forEach(({ key, label }) => {
  router.get(`/feuille-excel-${key}`, async (req, res) => {
    const { sem } = req.query;
    const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

    if (!sem) {
      return res
        .status(400)
        .json({ error: 'Paramètre "sem" requis (format YYYY-Wxx)' });
    }

    if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

    try {
      const { monday, sunday, days } = getWeekDateRange(sem);
      if (Number.isNaN(monday.getTime()) || Number.isNaN(sunday.getTime())) {
        return res.status(400).json({ error: 'Paramètre "sem" invalide' });
      }

      const produits = await prisma.produit.findMany({
        where: {
          actif: true,
          ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}),
        },
        orderBy: [
          { categorieRef: { nom: 'asc' } },
          { nom: 'asc' },
        ],
        select: {
          nom: true,
          categorieRef: { select: { nom: true, couleur: true } },
        },
      });

      const titre = `Feuille hebdomadaire ${label} – Semaine ${sem}`;
      const buffer = await generateExcel(
        produits.map((p) => ({
          nom: p.nom,
          categorieNom: p.categorieRef?.nom || '',
          categorieCouleur: p.categorieRef?.couleur || null,
        })),
        titre,
        days,
      );

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Feuille_Semaine_${sem}_${label}.xlsx"`,
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );

      return res.send(buffer);
    } catch (err) {
      console.error(`Erreur feuille-excel-${key} :`, err);
      return res
        .status(500)
        .json({ error: 'Erreur serveur lors de la génération Excel' });
    }
  });

  router.get(`/feuille-pdf-${key}`, async (req, res) => {
    const { sem } = req.query;
    const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

    if (!sem) {
      return res
        .status(400)
        .json({ error: 'Paramètre "sem" requis (format YYYY-Wxx)' });
    }

    if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

    try {
      const { monday, sunday, days } = getWeekDateRange(sem);
      if (Number.isNaN(monday.getTime()) || Number.isNaN(sunday.getTime())) {
        return res.status(400).json({ error: 'Paramètre "sem" invalide' });
      }

      const produits = await prisma.produit.findMany({
        where: {
          actif: true,
          ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}),
        },
        orderBy: [
          { categorieRef: { nom: 'asc' } },
          { nom: 'asc' },
        ],
        select: {
          nom: true,
          categorieRef: { select: { nom: true, couleur: true } },
        },
      });

      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 40,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Feuille_Semaine_${sem}_${label}.pdf"`,
      );

      doc.pipe(res);

      const formatDate = (d) =>
        d.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });

      const titre = `Feuille hebdomadaire ${label} – Semaine du ${formatDate(
        monday,
      )} au ${formatDate(sunday)}`;
      const dayLabels = jours.map((jour, idx) => `${jour} (${formatDate(days[idx])})`);

      generatePDF(
        doc,
        titre,
        produits.map((p) => ({
          nom: p.nom,
          categorieNom: p.categorieRef?.nom || '',
          categorieCouleur: p.categorieRef?.couleur || null,
        })),
        dayLabels,
      );

      doc.end();
    } catch (err) {
      console.error(`Erreur feuille-pdf-${key} :`, err);
      return res
        .status(500)
        .json({ error: 'Erreur serveur lors de la génération PDF' });
    }
  });
});

export default router;

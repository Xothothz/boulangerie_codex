import express from 'express';
import prisma from '../config/db.js';
import xlsx from 'xlsx';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { getWeekDateRange } from '../utils/week.js';
import { ensureMagasin, getMagasinScope } from '../utils/magasin.js';
import { hasPermission, requirePermission } from '../utils/permissions.js';
import { logAudit } from '../utils/audit.js';

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
  const label = typeLabel === 'ventes' ? 'mises en vente' : 'pertes';
  return `Import Excel ${label} – ${jour}`;
}

function formatDate(d) {
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateShort(d) {
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
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
    const headerRow =
      xlsx.utils.sheet_to_json(sheet, { header: 1, range: 0, blankrows: false, defval: '' })[0] ||
      [];
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

    // Vérifie que les en-têtes de jour correspondent à la semaine ciblée (évite import croisé)
    const headerStrings = headerRow.map((h) => String(h || ''));
    const expectedDates = days.map((d) => formatDate(d));
    for (let i = 0; i < jours.length; i++) {
      const jour = jours[i];
      const expectedDate = expectedDates[i];
      const found = headerStrings.find((h) => normalizeHeaderKey(h).startsWith(normalizeHeaderKey(jour)));
      if (!found) {
        return res.status(400).json({
          error: `Colonne "${jour}" absente ou invalide dans le fichier (semaine attendue: ${sem}).`,
        });
      }
      const matchDate = (String(found).match(/\(([^)]+)\)/) || [])[1] || '';
      if (matchDate && matchDate.trim() !== expectedDate && !String(found).includes(expectedDate)) {
        return res.status(400).json({
          error: `Le fichier semble être pour une autre semaine (colonne ${jour}: "${found}", attendu: ${expectedDate}).`,
        });
      }
    }

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
        const rawValue = getValueForDay(row, jour);
        const cleaned =
          typeof rawValue === 'string' ? rawValue.trim() : rawValue;

        // Cellule vide ou non renseignée : on ne touche pas aux données existantes
        if (cleaned === '' || cleaned === null || cleaned === undefined) continue;

        const quantite = Number(rawValue);
        if (Number.isNaN(quantite) || quantite < 0) continue;

        const startDay = new Date(days[i]);
        startDay.setUTCHours(0, 0, 0, 0);
        const endDay = new Date(days[i]);
        endDay.setUTCHours(23, 59, 59, 999);

        // Supprime les mouvements existants pour cette journée / produit / nature
        await prisma.mouvementStock.deleteMany({
          where: {
            produitId: produit.id,
            nature: typeLabel === 'ventes' ? 'VENTE' : 'PERTE',
            date: { gte: startDay, lte: endDay },
            produit: resolvedMagasinId ? { magasinId: resolvedMagasinId } : undefined,
          },
        });

        if (quantite === 0) {
          // 0 = effacement des valeurs précédentes pour ce jour/produit/nature
          continue;
        }

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

    await logAudit({
      req,
      action: `semaine:import:${typeLabel}`,
      resourceType: 'mouvement_stock',
      magasinId: resolvedMagasinId ?? null,
      details: {
        sem,
        produits_trouves: produitsTrouves.size,
        produits_non_trouves: produitsNonTrouves.length,
        mouvements_enregistres: mouvementsEnregistres,
      },
    });

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

router.post('/import-excel', requirePermission('ventes:import'), async (req, res) =>
  importExcel(req, res, 'ventes'),
);
router.post('/import-excel-ventes', requirePermission('ventes:import'), async (req, res) =>
  importExcel(req, res, 'ventes'),
);
router.post('/import-excel-pertes', requirePermission('pertes:import'), async (req, res) =>
  importExcel(req, res, 'pertes'),
);

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
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Semaine', {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { tabColor: { argb: 'FF0F172A' } },
  });

  const dayLabels = jours.map((jour, idx) => `${jour} (${formatDate(days[idx])})`);
  const dayKeys = days.map((d) => d.toISOString().slice(0, 10));

  sheet.columns = [
    { header: 'Produit', key: 'produit', width: 36 },
    ...dayLabels.map((label, idx) => ({
      header: label,
      key: dayKeys[idx],
      width: 18,
      style: { alignment: { horizontal: 'center', vertical: 'middle' } },
    })),
  ];

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };

  const headerRow = sheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'center' };
    cell.border = thinBorder;
  });

  produits.forEach((p) => {
    const data = { produit: p.nom };
    dayKeys.forEach((key) => {
      const val = p.jours?.[key];
      data[key] = val === undefined || val === null ? '' : val;
    });
    const row = sheet.addRow(data);
    row.height = 20;
    const hex = excelColor(p.categorieCouleur);
    const fill = hex ? { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex}` } } : null;
    row.eachCell((cell, colNumber) => {
      if (fill) cell.fill = fill;
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'center' };
      cell.border = thinBorder;
    });
  });

  return workbook.xlsx.writeBuffer();
}

async function fetchStockMap(produitIds) {
  if (!Array.isArray(produitIds) || produitIds.length === 0) return {};
  const grouped = await prisma.mouvementStock.groupBy({
    by: ['produitId'],
    _sum: { quantite: true },
    where: {
      produitId: { in: produitIds },
      NOT: { nature: 'PERTE' }, // pertes non déstockantes dans le modèle actuel
    },
  });
  return Object.fromEntries(grouped.map((g) => [g.produitId, g._sum.quantite || 0]));
}

function buildDayLabels(days) {
  return jours.map((jour, idx) => `${jour.slice(0, 3)} ${formatDateShort(days[idx])}`);
}

function generatePDF(doc, titre, produits, dayLabels, dayKeys = []) {
  doc
    .fontSize(17)
    .font('Helvetica-Bold')
    .fillColor('#0f172a')
    .text(titre, { align: 'center' });
  doc
    .moveDown(0.35)
    .fontSize(11)
    .font('Helvetica')
    .fillColor('#475569')
    .text('Lambert Gestion : Boulangerie', { align: 'center' });
  doc.moveDown(1);
  doc.fillColor('#0f172a');

  const pageWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const productColWidth = pageWidth * 0.36;
  const stockColWidth = pageWidth * 0.12;
  const dayColWidth = (pageWidth - productColWidth - stockColWidth) / jours.length;
  const headers = ['Produit', 'Stock', ...dayLabels];
  const startX = doc.page.margins.left;
  const headerHeight = 30;
  const rowHeight = 20;
  let y = doc.y;

  const effectiveDayKeys =
    Array.isArray(dayKeys) && dayKeys.length === jours.length
      ? dayKeys
      : new Array(jours.length).fill('');

  const drawHeader = () => {
    let x = startX;
    doc
      .save()
      .fillColor('#f8fafc')
      .rect(startX, y, pageWidth, headerHeight)
      .fill()
      .restore();
    doc.strokeColor('#cbd5e1').lineWidth(1);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a');
    headers.forEach((h, index) => {
      const colWidth =
        index === 0 ? productColWidth : index === 1 ? stockColWidth : dayColWidth;
      doc.rect(x, y, colWidth, headerHeight).stroke();
      doc.text(h, x + 4, y + 8, {
        width: colWidth - 8,
        align: index === 0 ? 'left' : 'center',
      });
      x += colWidth;
    });
    y += headerHeight;
    doc.font('Helvetica').fontSize(9).fillColor('#0f172a');
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
    doc.text(p.nom, x + 5, y + 5, {
      width: productColWidth - 10,
      height: rowHeight - 8,
      ellipsis: true,
    });
    x += productColWidth;

    doc
      .rect(x, y, stockColWidth, rowHeight)
      .strokeColor('#e2e8f0')
      .stroke();
    doc.text(String(p.stockActuel ?? ''), x + 4, y + 5, {
      width: stockColWidth - 8,
      align: 'center',
    });
    x += stockColWidth;

    for (let i = 0; i < jours.length; i++) {
      doc
        .rect(x, y, dayColWidth, rowHeight)
        .strokeColor('#e2e8f0')
        .stroke();
      const qty =
        p.jours && effectiveDayKeys[i]
          ? p.jours[effectiveDayKeys[i]]
          : Array.isArray(p.jours)
          ? p.jours[i]
          : undefined;
      if (qty || qty === 0) {
        doc.text(String(qty), x, y + 5, {
          width: dayColWidth,
          align: 'center',
        });
      }
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

  if (!hasPermission(req.user, ['ventes:export', 'pertes:export'])) {
    return res.status(403).json({ error: 'Permission manquante pour exporter une feuille.' });
  }

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

    await logAudit({
      req,
      action: 'semaine:export:excel',
      resourceType: 'feuille_semaine',
      magasinId: resolvedMagasinId ?? null,
      details: { sem, produits: produits.length, format: 'xlsx', type: 'vierge' },
    });

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

  if (!hasPermission(req.user, ['ventes:export', 'pertes:export'])) {
    return res.status(403).json({ error: 'Permission manquante pour exporter une feuille.' });
  }

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
        id: true,
        nom: true,
        categorieRef: { select: { nom: true, couleur: true } },
      },
    });

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'portrait',
      margins: { top: 28, left: 24, right: 24, bottom: 28 },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Feuille_Semaine_${sem}.pdf"`,
    );

    doc.pipe(res);

    await logAudit({
      req,
      action: 'semaine:export:pdf',
      resourceType: 'feuille_semaine',
      magasinId: resolvedMagasinId ?? null,
      details: { sem, produits: produits.length, format: 'pdf', type: 'vierge' },
    });

    const formatDate = (d) =>
      d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

    const titre = `Feuille hebdomadaire – Semaine du ${formatDate(
      monday,
    )} au ${formatDate(sunday)}`;

    const dayLabels = buildDayLabels(days);
    const stockMap = await fetchStockMap(produits.map((p) => p.id));

    generatePDF(
      doc,
      titre,
      produits.map((p) => ({
        nom: p.nom,
        stockActuel: stockMap[p.id] ?? 0,
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
  { key: 'ventes', label: 'Mises en vente', fileSuffix: 'MISES_EN_VENTE' },
  { key: 'pertes', label: 'Pertes', fileSuffix: 'PERTES' },
];

feuilleTypes.forEach(({ key, label, fileSuffix }) => {
  const exportCode = key === 'ventes' ? 'ventes:export' : 'pertes:export';

  router.get(`/feuille-excel-${key}`, requirePermission(exportCode), async (req, res) => {
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
          id: true,
          nom: true,
          categorieRef: { select: { nom: true, couleur: true } },
        },
      });

      const rangeStart = new Date(days[0]);
      rangeStart.setUTCHours(0, 0, 0, 0);
      const rangeEnd = new Date(days[6]);
      rangeEnd.setUTCHours(23, 59, 59, 999);
      const nature = key === 'ventes' ? 'VENTE' : 'PERTE';

      const mouvements = await prisma.mouvementStock.findMany({
        where: {
          date: { gte: rangeStart, lte: rangeEnd },
          nature,
          produit: resolvedMagasinId ? { magasinId: resolvedMagasinId } : undefined,
        },
        select: { produitId: true, date: true, quantite: true },
      });

      const quantites = {};
      mouvements.forEach((m) => {
        const dKey = new Date(m.date).toISOString().slice(0, 10);
        const qty = Math.abs(m.quantite || 0);
        if (!quantites[m.produitId]) quantites[m.produitId] = {};
        quantites[m.produitId][dKey] = (quantites[m.produitId][dKey] || 0) + qty;
      });

      const titre = `Feuille hebdomadaire ${label} – Semaine ${sem}`;
      const buffer = await generateExcel(
        produits.map((p) => ({
          nom: p.nom,
          categorieNom: p.categorieRef?.nom || '',
          categorieCouleur: p.categorieRef?.couleur || null,
          jours: quantites[p.id] || {},
        })),
        titre,
        days,
      );

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Feuille_Semaine_${sem}_${fileSuffix}.xlsx"`,
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );

      await logAudit({
        req,
        action: `semaine:export:${key}:excel`,
        resourceType: 'feuille_semaine',
        magasinId: resolvedMagasinId ?? null,
        details: { sem, produits: produits.length, format: 'xlsx', type: key },
      });

      return res.send(buffer);
    } catch (err) {
      console.error(`Erreur feuille-excel-${key} :`, err);
      return res
        .status(500)
        .json({ error: 'Erreur serveur lors de la génération Excel' });
    }
  });

  router.get(`/feuille-pdf-${key}`, requirePermission(exportCode), async (req, res) => {
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
          id: true,
          nom: true,
          categorieRef: { select: { nom: true, couleur: true } },
        },
      });

      const rangeStart = new Date(days[0]);
      rangeStart.setUTCHours(0, 0, 0, 0);
      const rangeEnd = new Date(days[6]);
      rangeEnd.setUTCHours(23, 59, 59, 999);
      const nature = key === 'ventes' ? 'VENTE' : 'PERTE';
      const dayKeys = days.map((d) => d.toISOString().slice(0, 10));

      const mouvements = await prisma.mouvementStock.findMany({
        where: {
          date: { gte: rangeStart, lte: rangeEnd },
          nature,
          produit: resolvedMagasinId ? { magasinId: resolvedMagasinId } : undefined,
        },
        select: { produitId: true, date: true, quantite: true },
      });

      const quantites = {};
      mouvements.forEach((m) => {
        const dKey = new Date(m.date).toISOString().slice(0, 10);
        const qty = Math.abs(m.quantite || 0);
        if (!quantites[m.produitId]) quantites[m.produitId] = {};
        quantites[m.produitId][dKey] = (quantites[m.produitId][dKey] || 0) + qty;
      });

      const doc = new PDFDocument({
        size: 'A4',
        layout: 'portrait',
        margins: { top: 28, left: 24, right: 24, bottom: 28 },
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Feuille_Semaine_${sem}_${fileSuffix}.pdf"`,
      );

      doc.pipe(res);

      await logAudit({
        req,
        action: `semaine:export:${key}:pdf`,
        resourceType: 'feuille_semaine',
        magasinId: resolvedMagasinId ?? null,
        details: { sem, produits: produits.length, format: 'pdf', type: key },
      });

      const formatDate = (d) =>
        d.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });

      const titre = `Feuille hebdomadaire ${label} – Semaine du ${formatDate(
        monday,
      )} au ${formatDate(sunday)}`;
      const dayLabels = buildDayLabels(days);
      const stockMap = await fetchStockMap(produits.map((p) => p.id));

      generatePDF(
        doc,
        titre,
        produits.map((p) => ({
          nom: p.nom,
          stockActuel: stockMap[p.id] ?? 0,
          categorieNom: p.categorieRef?.nom || '',
          categorieCouleur: p.categorieRef?.couleur || null,
          jours: quantites[p.id] || {},
        })),
        dayLabels,
        dayKeys,
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

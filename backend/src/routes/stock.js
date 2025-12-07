import express from 'express';
import prisma from '../config/db.js';
import { ensureMagasin, getMagasinScope } from '../utils/magasin.js';
import xlsx from 'xlsx';
import PDFDocument from 'pdfkit';
import { getWeekDateRange } from '../utils/week.js';

async function applyInventaire(lignes, date, resolvedMagasinId, utilisateurId) {
  if (!Array.isArray(lignes) || lignes.length === 0) {
    throw new Error('Le corps doit contenir un tableau "lignes" non vide.');
  }

  return prisma.$transaction(async (tx) => {
    const produitIds = [
      ...new Set(
        lignes
          .map((l) => Number(l.produitId))
          .filter((id) => !Number.isNaN(id) && id > 0),
      ),
    ];

    const produits = await tx.produit.findMany({
      where: {
        id: { in: produitIds },
        actif: true,
        ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}),
      },
      select: { id: true },
    });
    const produitsValides = new Set(produits.map((p) => p.id));

    const stocksGrouped = await tx.mouvementStock.groupBy({
      by: ['produitId'],
      _sum: { quantite: true },
      where: { produitId: { in: produitIds } },
    });
    const stockMap = Object.fromEntries(
      stocksGrouped.map((g) => [g.produitId, g._sum.quantite || 0]),
    );

    const inventaire = await tx.inventaire.create({
      data: {
        statut: 'VALIDE',
        date: date ? new Date(date) : new Date(),
        magasinId: resolvedMagasinId || null,
        utilisateurId: utilisateurId || null,
      },
    });

    const mouvements = [];
    for (const ligne of lignes) {
      const produitId = Number(ligne.produitId);
      const quantiteReelle = Number(ligne.quantiteReelle);

      if (
        Number.isNaN(produitId) ||
        Number.isNaN(quantiteReelle) ||
        !produitsValides.has(produitId)
      ) {
        continue;
      }

      const stockActuel = stockMap[produitId] ?? 0;
      const ecart = quantiteReelle - stockActuel;
      if (ecart === 0) continue;

      await tx.inventaireLigne.create({
        data: {
          inventaireId: inventaire.id,
          produitId,
          quantiteReelle,
          stockAvant: stockActuel,
          ecart,
        },
      });

      const mouvement = await tx.mouvementStock.create({
        data: {
          produitId,
          type: 'AJUSTEMENT',
          quantite: ecart,
          commentaire: `Inventaire (réel: ${quantiteReelle})`,
          nature: 'INVENTAIRE',
          inventaireId: inventaire.id,
          date: date ? new Date(date) : undefined,
        },
      });

      mouvements.push(mouvement);
    }

    return {
      inventaireId: inventaire.id,
      mouvements_crees: mouvements.length,
      mouvements: mouvements.slice(0, 10),
      info: 'Ajustements créés pour aligner le stock sur la quantité réelle.',
    };
  });
}

const router = express.Router();

/**
 * Helper interne pour calculer le signe de la quantité
 * en fonction du type de mouvement.
 */
function computeSignedQuantity(type, quantite) {
  const q = Number(quantite);

  if (Number.isNaN(q)) {
    throw new Error('Quantité invalide');
  }

  if (type === 'ENTREE') return q;
  if (type === 'SORTIE') return -q;
  if (type === 'AJUSTEMENT') return q; // ajustement déjà signé par l’utilisateur

  throw new Error('Type de mouvement invalide');
}

const ALLOWED_NATURES = new Set([
  'VENTE',
  'PERTE',
  'RECEPTION',
  'INVENTAIRE',
  'AUTRE',
]);

function resolveNature(nature, type) {
  const upper = nature ? String(nature).toUpperCase() : null;
  if (upper && ALLOWED_NATURES.has(upper)) return upper;
  if (type === 'ENTREE') return 'RECEPTION';
  if (type === 'AJUSTEMENT') return 'INVENTAIRE';
  return 'AUTRE';
}

/**
 * POST /stock/mouvements
 * Body JSON attendu :
 * {
 *   "produitId": 1,
 *   "type": "ENTREE" | "SORTIE" | "AJUSTEMENT",
 *   "quantite": 10,
 *   "commentaire": "Réception commande du jour"
 *   "date": "2025-12-06T10:00:00.000Z" (optionnel)
 *   "nature": "VENTE" | "PERTE" | "RECEPTION" | "INVENTAIRE" | "AUTRE" (optionnel)
 * }
 */
router.post('/mouvements', async (req, res) => {
  const { produitId, type, quantite, commentaire, date, nature } = req.body;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!produitId || !type || quantite === undefined || quantite === null) {
    return res.status(400).json({
      error: 'Les champs "produitId", "type" et "quantite" sont obligatoires',
    });
  }

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const signedQuantity = computeSignedQuantity(type, quantite);

    const produit = await prisma.produit.findFirst({
      where: {
        id: Number(produitId),
        ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}),
      },
      select: { id: true },
    });

    if (!produit) {
      return res
        .status(404)
        .json({ error: 'Produit introuvable pour ce magasin' });
    }

    const mouvement = await prisma.mouvementStock.create({
      data: {
        produitId: Number(produitId),
        type,
        quantite: signedQuantity,
        commentaire: commentaire || null,
        nature: resolveNature(nature, type),
        date: date ? new Date(date) : undefined,
      },
    });

    res.status(201).json(mouvement);
  } catch (err) {
    console.error('Erreur POST /stock/mouvements :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Import Excel inventaire
router.post('/inventaire-import', async (req, res) => {
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);
  const utilisateurId = req.user?.id;
  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'Aucun fichier reçu (champ attendu: file)' });
    }

    const file = req.files.file;
    const workbook = xlsx.read(file.data, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    const lignes = [];
    const produitsNonTrouves = [];

    for (const row of rows) {
      const ref = row['Référence'] || row['Reference'] || row['reference'] || row['ref'] || '';
      const nom =
        row['Produit'] || row['Nom'] || row['nom'] || row['Produit '] || row['produit'] || '';
      const quantiteReelleRaw =
        row['Quantité réelle'] ||
        row['Quantite réelle'] ||
        row['Quantite reelle'] ||
        row['Quantité reelle'] ||
        row['Quantite'] ||
        row['quantite'] ||
        row['qte'] ||
        '';
      const quantiteReelle = Number(quantiteReelleRaw);
      if (Number.isNaN(quantiteReelle)) continue;

      let produit = null;
      if (ref) {
        produit = await prisma.produit.findFirst({
          where: {
            reference: ref.toString().trim(),
            actif: true,
            ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}),
          },
          select: { id: true },
        });
      }
      if (!produit && nom) {
        produit = await prisma.produit.findFirst({
          where: {
            nom: { equals: nom.toString().trim(), mode: 'insensitive' },
            actif: true,
            ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}),
          },
          select: { id: true },
        });
      }
      if (!produit) {
        produitsNonTrouves.push(ref || nom || 'Inconnu');
        continue;
      }

      lignes.push({ produitId: produit.id, quantiteReelle });
    }

    if (lignes.length === 0) {
      return res.status(400).json({ error: 'Aucune ligne valide trouvée dans le fichier.' });
    }

    const result = await applyInventaire(lignes, new Date(), resolvedMagasinId, utilisateurId);
    return res.json({ ...result, produits_non_trouves: produitsNonTrouves });
  } catch (err) {
    console.error('Erreur POST /stock/inventaire-import :', err);
    res.status(500).json({ error: 'Erreur lors de l’import Excel inventaire.' });
  }
});

// Liste des inventaires
router.get('/inventaires', async (req, res) => {
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);
  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const inventaires = await prisma.inventaire.findMany({
      where: resolvedMagasinId ? { magasinId: resolvedMagasinId } : {},
      orderBy: { date: 'desc' },
      take: 50,
      include: {
        _count: { select: { lignes: true } },
        utilisateur: { select: { id: true, nom: true, email: true } },
        lignes: {
          include: {
            produit: { select: { id: true, nom: true, reference: true } },
          },
        },
      },
    });
    res.json(inventaires);
  } catch (err) {
    console.error('Erreur GET /stock/inventaires :', err);
    res.status(500).json({ error: 'Erreur lors du chargement des inventaires.' });
  }
});

// Annulation d'un inventaire : crée des mouvements inverses et marque l'inventaire annulé
router.post('/inventaire/:id/annuler', async (req, res) => {
  const { id } = req.params;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);
  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const inv = await prisma.inventaire.findUnique({
      where: { id: Number(id) },
      include: {
        lignes: true,
        mouvements: true,
      },
    });
    if (!inv) return res.status(404).json({ error: 'Inventaire introuvable' });
    if (inv.statut === 'ANNULE') {
      return res.status(400).json({ error: 'Inventaire déjà annulé' });
    }
    if (resolvedMagasinId && inv.magasinId !== resolvedMagasinId) {
      return res.status(403).json({ error: 'Inventaire hors de votre magasin' });
    }

    await prisma.$transaction(async (tx) => {
      // Mouvement inverse pour chaque mouvement lié
      for (const mv of inv.mouvements) {
        await tx.mouvementStock.create({
          data: {
            produitId: mv.produitId,
            type: 'AJUSTEMENT',
            quantite: -mv.quantite,
            nature: 'INVENTAIRE',
            commentaire: `Annulation inventaire #${inv.id}`,
            inventaireId: inv.id,
            date: new Date(),
          },
        });
      }
      await tx.inventaire.update({
        where: { id: inv.id },
        data: { statut: 'ANNULE' },
      });
    });

    res.json({ message: 'Inventaire annulé et stocks restaurés.' });
  } catch (err) {
    console.error('Erreur POST /stock/inventaire/:id/annuler :', err);
    res.status(500).json({ error: 'Erreur lors de l’annulation de l’inventaire.' });
  }
});

// PDF récap inventaire
router.get('/inventaire/:id/pdf', async (req, res) => {
  const { id } = req.params;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);
  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const inv = await prisma.inventaire.findUnique({
      where: { id: Number(id) },
      include: {
        lignes: {
          include: { produit: { select: { nom: true, reference: true, categorie: true } } },
        },
        utilisateur: { select: { nom: true, email: true } },
      },
    });
    if (!inv) return res.status(404).json({ error: 'Inventaire introuvable' });
    if (resolvedMagasinId && inv.magasinId !== resolvedMagasinId) {
      return res.status(403).json({ error: 'Inventaire hors de votre magasin' });
    }

    const doc = new PDFDocument({ size: 'A4', margins: { top: 30, left: 30, right: 30, bottom: 30 } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Inventaire_${inv.id}.pdf"`);
    doc.pipe(res);

    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor('#0f172a')
      .text('Lambert Gestion : Boulangerie', { align: 'center' })
      .moveDown(0.3)
      .fontSize(14)
      .text(`Inventaire #${inv.id}`, { align: 'center' });

    doc
      .moveDown()
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#0f172a')
      .text(`Date : ${new Date(inv.date).toLocaleString('fr-FR')}`)
      .text(`Statut : ${inv.statut}`)
      .text(`Utilisateur : ${inv.utilisateur?.nom || inv.utilisateur?.email || '-'}`);

    doc.moveDown(1);
    const headers = ['Catégorie', 'Produit', 'Référence', 'Stock avant', 'Quantité réelle', 'Écart'];
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidths = [pageWidth * 0.2, pageWidth * 0.3, pageWidth * 0.12, pageWidth * 0.12, pageWidth * 0.12, pageWidth * 0.14];
    const startX = doc.page.margins.left;
    let y = doc.y;
    const headerHeight = 28;
    const rowHeight = 20;

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
      headers.forEach((h, idx) => {
        const w = colWidths[idx];
        doc.rect(x, y, w, headerHeight).stroke();
        doc.text(h, x + 6, y + 6, { width: w - 12 });
        x += w;
      });
      y += headerHeight;
      doc.font('Helvetica').fontSize(10).fillColor('#0f172a');
    };

    drawHeader();

    inv.lignes
      .slice()
      .sort((a, b) => (a.produit?.categorie || '').localeCompare(b.produit?.categorie || '') || (a.produit?.nom || '').localeCompare(b.produit?.nom || ''))
      .forEach((l) => {
        if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          y = doc.page.margins.top;
          drawHeader();
        }
        const vals = [
          l.produit?.categorie || '',
          l.produit?.nom || '',
          l.produit?.reference || '',
          l.stockAvant,
          l.quantiteReelle,
          l.ecart,
        ];
        let x = startX;
        vals.forEach((val, idx) => {
          const w = colWidths[idx];
          doc.rect(x, y, w, rowHeight).strokeColor('#e2e8f0').stroke();
          doc.text(String(val), x + 6, y + 6, { width: w - 12, ellipsis: true });
          x += w;
        });
        y += rowHeight;
      });

    doc.end();
  } catch (err) {
    console.error('Erreur GET /stock/inventaire/:id/pdf :', err);
    res.status(500).json({ error: 'Erreur lors de la génération du PDF inventaire.' });
  }
});

// Modification d'une ligne d'inventaire (rejoue un ajustement pour une ligne)
router.post('/inventaire/:id/modifier-ligne', async (req, res) => {
  const { id } = req.params;
  const { produitId, quantiteReelle } = req.body;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);
  const utilisateurId = req.user?.id;

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;
  if (!produitId || quantiteReelle === undefined || quantiteReelle === null) {
    return res.status(400).json({ error: 'produitId et quantiteReelle requis' });
  }

  try {
    const inv = await prisma.inventaire.findUnique({
      where: { id: Number(id) },
      include: {
        lignes: true,
        mouvements: true,
      },
    });
    if (!inv) return res.status(404).json({ error: 'Inventaire introuvable' });
    if (inv.statut === 'ANNULE') {
      return res.status(400).json({ error: 'Inventaire annulé, modification impossible' });
    }
    if (resolvedMagasinId && inv.magasinId !== resolvedMagasinId) {
      return res.status(403).json({ error: 'Inventaire hors de votre magasin' });
    }

    const ligne = inv.lignes.find((l) => l.produitId === Number(produitId));
    if (!ligne) return res.status(404).json({ error: 'Ligne non trouvée dans cet inventaire' });

    const nouvelleQuantite = Number(quantiteReelle);
    if (Number.isNaN(nouvelleQuantite)) {
      return res.status(400).json({ error: 'quantiteReelle invalide' });
    }

    const ancienEcart = ligne.ecart;
    const nouvelEcart = nouvelleQuantite - ligne.stockAvant;
    const delta = nouvelEcart - ancienEcart;

    await prisma.$transaction(async (tx) => {
      await tx.inventaireLigne.update({
        where: { id: ligne.id },
        data: { quantiteReelle: nouvelleQuantite, ecart: nouvelEcart },
      });

      if (delta !== 0) {
        await tx.mouvementStock.create({
          data: {
            produitId: ligne.produitId,
            type: 'AJUSTEMENT',
            quantite: delta,
            commentaire: `Correction inventaire #${inv.id}`,
            nature: 'INVENTAIRE',
            inventaireId: inv.id,
            date: new Date(),
          },
        });
      }

      // Optionnel : maj utilisateur si modification
      await tx.inventaire.update({
        where: { id: inv.id },
        data: { utilisateurId: utilisateurId || inv.utilisateurId },
      });
    });

    res.json({ message: 'Ligne inventaire mise à jour.' });
  } catch (err) {
    console.error('Erreur POST /stock/inventaire/:id/modifier-ligne :', err);
    res.status(500).json({ error: 'Erreur lors de la modification de la ligne.' });
  }
});

/**
 * GET /stock/mouvements
 * Query params optionnels :
 *   - produitId : filtre par produit
 *   - type : ENTREE | SORTIE | AJUSTEMENT
 *   - nature : VENTE | PERTE | RECEPTION | INVENTAIRE | AUTRE
 */
router.get('/mouvements', async (req, res) => {
  const { produitId, type, nature } = req.query;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const whereClause = {
      produit: resolvedMagasinId ? { magasinId: resolvedMagasinId } : undefined,
    };

    if (produitId) {
      whereClause.produitId = Number(produitId);
    }
    if (type) {
      whereClause.type = type;
    }
    if (nature) {
      whereClause.nature = String(nature).toUpperCase();
    }

    const mouvements = await prisma.mouvementStock.findMany({
      where: whereClause,
      orderBy: { date: 'desc' },
      include: {
        produit: {
          select: { id: true, nom: true, reference: true },
        },
      },
    });

    res.json(mouvements);
  } catch (err) {
    console.error('Erreur GET /stock/mouvements :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /stock/produits
 * Retourne le stock courant pour chaque produit.
 * Calcul : stock = somme(quantite) des mouvements, groupés par produitId.
 */
router.get('/produits', async (req, res) => {
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const produits = await prisma.produit.findMany({
      where: resolvedMagasinId ? { magasinId: resolvedMagasinId } : {},
      select: {
        id: true,
        nom: true,
        reference: true,
        categorie: true,
        categorieId: true,
        quantiteJour: true,
      },
    });

    const produitIds = produits.map((p) => p.id);

    if (produitIds.length === 0) {
      return res.json([]);
    }

    const grouped = await prisma.mouvementStock.groupBy({
      by: ['produitId'],
      _sum: { quantite: true },
      where: { produitId: { in: produitIds } },
    });

    const stockMap = Object.fromEntries(
      grouped.map((g) => [g.produitId, g._sum.quantite || 0]),
    );

    const stocks = produits.map((produit) => ({
      produitId: produit.id,
      nom: produit.nom,
      reference: produit.reference,
      categorie: produit.categorie,
      categorieId: produit.categorieId || null,
      quantiteJour: produit.quantiteJour || null,
      stock: stockMap[produit.id] ?? 0,
    }));

    res.json(stocks);
  } catch (err) {
    console.error('Erreur GET /stock/produits :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /stock/inventaire
 * Body:
 * {
 *   "lignes": [{ "produitId": 1, "quantiteReelle": 10 }, ...],
 *   "date": "2025-12-06T10:00:00.000Z" (optionnel)
 * }
 * Crée des mouvements AJUSTEMENT pour aligner le stock sur la quantité réelle.
 */
router.post('/inventaire', async (req, res) => {
  const { lignes, date } = req.body;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);
  const utilisateurId = req.user?.id;

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  if (!Array.isArray(lignes) || lignes.length === 0) {
    return res
      .status(400)
      .json({ error: 'Le corps doit contenir un tableau "lignes" non vide.' });
  }

  try {
    const result = await applyInventaire(lignes, date, resolvedMagasinId, utilisateurId);
    return res.json(result);
  } catch (err) {
    console.error('Erreur POST /stock/inventaire :', err);
    res.status(500).json({ error: 'Erreur serveur lors de l’inventaire' });
  }
});

// GET mouvements semaine (ventes/pertes) agrégés par produit/jour
router.get('/mouvements-semaine', async (req, res) => {
  const { sem, type } = req.query;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);
  if (!sem) {
    return res.status(400).json({ error: 'Paramètre sem requis (YYYY-Wxx)' });
  }
  if (!type || !['ventes', 'pertes'].includes(type)) {
    return res.status(400).json({ error: 'Paramètre type requis (ventes|pertes)' });
  }
  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const { days } = getWeekDateRange(sem);
    const start = new Date(days[0]);
    const end = new Date(days[6]);
    end.setHours(23, 59, 59, 999);
    const nature = type === 'ventes' ? 'VENTE' : 'PERTE';

    const mouvements = await prisma.mouvementStock.findMany({
      where: {
        date: { gte: start, lte: end },
        nature,
        produit: resolvedMagasinId ? { magasinId: resolvedMagasinId } : undefined,
      },
      select: { produitId: true, date: true, quantite: true },
    });

    const produits = await prisma.produit.findMany({
      where: resolvedMagasinId ? { magasinId: resolvedMagasinId, actif: true } : { actif: true },
      orderBy: [
        { categorieRef: { nom: 'asc' } },
        { nom: 'asc' },
      ],
      select: {
        id: true,
        nom: true,
        reference: true,
        categorie: true,
        categorieRef: { select: { nom: true, couleur: true } },
      },
    });

    const dayKeys = days.map((d) => d.toISOString().slice(0, 10));
    const map = {};
    mouvements.forEach((m) => {
      const key = new Date(m.date).toISOString().slice(0, 10);
      const qty = Math.abs(m.quantite || 0);
      if (!map[m.produitId]) {
        map[m.produitId] = Object.fromEntries(dayKeys.map((k) => [k, 0]));
      }
      map[m.produitId][key] += qty;
    });

    const lignes = produits.map((p) => ({
      produitId: p.id,
      nom: p.nom,
      reference: p.reference,
      categorie: p.categorieRef?.nom || p.categorie || '',
      categorieCouleur: p.categorieRef?.couleur || null,
      jours: map[p.id] || Object.fromEntries(dayKeys.map((k) => [k, 0])),
    }));

    res.json({ days: dayKeys, lignes });
  } catch (err) {
    console.error('Erreur GET /stock/mouvements-semaine :', err);
    res.status(500).json({ error: 'Erreur lors du chargement des mouvements semaine.' });
  }
});

// POST mouvements semaine (remplace les valeurs pour la semaine/type)
router.post('/mouvements-semaine', async (req, res) => {
  const { sem, type, lignes } = req.body;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);
  if (!sem) return res.status(400).json({ error: 'Paramètre sem requis (YYYY-Wxx)' });
  if (!type || !['ventes', 'pertes'].includes(type)) {
    return res.status(400).json({ error: 'Paramètre type requis (ventes|pertes)' });
  }
  if (!Array.isArray(lignes)) {
    return res.status(400).json({ error: 'Champ lignes requis (tableau).' });
  }
  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const { days } = getWeekDateRange(sem);
    const nature = type === 'ventes' ? 'VENTE' : 'PERTE';
    const typeMvt = 'SORTIE';

    const dayRanges = days.map((d) => {
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      return { start, end, key: d.toISOString().slice(0, 10) };
    });

    await prisma.$transaction(async (tx) => {
      for (const line of lignes) {
        const produitId = Number(line.produitId);
        if (!produitId) continue;

        // Supprimer les mouvements existants de cette semaine pour ce produit/nature
        await tx.mouvementStock.deleteMany({
          where: {
            produitId,
            nature,
            date: { gte: dayRanges[0].start, lte: dayRanges[6].end },
            produit: resolvedMagasinId ? { magasinId: resolvedMagasinId } : undefined,
          },
        });

        // Créer les nouveaux mouvements
        for (const { key, start } of dayRanges) {
          const qty = Number(line.jours?.[key]) || 0;
          if (qty > 0) {
            await tx.mouvementStock.create({
              data: {
                produitId,
                type: typeMvt,
                quantite: -qty,
                nature,
                commentaire: `Saisie semaine ${sem} (${key})`,
                date: start,
              },
            });
          }
        }
      }
    });

    res.json({ message: 'Mouvements semaine enregistrés.' });
  } catch (err) {
    console.error('Erreur POST /stock/mouvements-semaine :', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement des mouvements semaine.' });
  }
});
// Export Excel pour inventaire (liste produits avec stock actuel)
router.get('/inventaire-feuille-excel', async (req, res) => {
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);
  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const produits = await prisma.produit.findMany({
      where: resolvedMagasinId ? { magasinId: resolvedMagasinId, actif: true } : { actif: true },
      orderBy: [
        { categorie: 'asc' },
        { nom: 'asc' },
      ],
      select: { id: true, nom: true, reference: true, categorie: true },
    });

    const produitIds = produits.map((p) => p.id);
    const grouped = await prisma.mouvementStock.groupBy({
      by: ['produitId'],
      _sum: { quantite: true },
      where: { produitId: { in: produitIds } },
    });
    const stockMap = Object.fromEntries(
      grouped.map((g) => [g.produitId, g._sum.quantite || 0]),
    );

    const rows = produits.map((p) => [
      p.categorie || '',
      p.nom,
      p.reference || '',
      stockMap[p.id] ?? 0,
      '', // colonne saisie magasin
    ]);

    const header = ['Catégorie', 'Produit', 'Référence', 'Stock actuel', 'Quantité réelle'];
    const worksheet = xlsx.utils.aoa_to_sheet([header, ...rows]);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Inventaire');
    const buffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Inventaire.xlsx"',
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.send(buffer);
  } catch (err) {
    console.error('Erreur GET /stock/inventaire-feuille-excel :', err);
    res.status(500).json({ error: 'Erreur lors de la génération Excel inventaire.' });
  }
});

// Export PDF pour inventaire (liste produits avec stock actuel + champ vide)
router.get('/inventaire-feuille-pdf', async (req, res) => {
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);
  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const produits = await prisma.produit.findMany({
      where: resolvedMagasinId ? { magasinId: resolvedMagasinId, actif: true } : { actif: true },
      orderBy: [
        { categorie: 'asc' },
        { nom: 'asc' },
      ],
      select: { id: true, nom: true, reference: true, categorie: true },
    });

    const produitIds = produits.map((p) => p.id);
    const grouped = await prisma.mouvementStock.groupBy({
      by: ['produitId'],
      _sum: { quantite: true },
      where: { produitId: { in: produitIds } },
    });
    const stockMap = Object.fromEntries(
      grouped.map((g) => [g.produitId, g._sum.quantite || 0]),
    );

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'portrait',
      margins: { top: 30, left: 30, right: 30, bottom: 30 },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Inventaire.pdf"',
    );
    doc.pipe(res);

    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor('#0f172a')
      .text('Lambert Gestion : Boulangerie', { align: 'center' })
      .moveDown(0.3)
      .fontSize(14)
      .text('Feuille d’inventaire', { align: 'center' });

    doc.moveDown(1);
    const headers = ['Catégorie', 'Produit', 'Référence', 'Stock actuel', 'Quantité réelle'];
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidths = [pageWidth * 0.2, pageWidth * 0.3, pageWidth * 0.15, pageWidth * 0.15, pageWidth * 0.2];
    const startX = doc.page.margins.left;
    let y = doc.y;
    const headerHeight = 22;
    const rowHeight = 20;

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
      headers.forEach((h, idx) => {
        const w = colWidths[idx];
        doc.rect(x, y, w, headerHeight).stroke();
        doc.text(h, x + 6, y + 6, { width: w - 12 });
        x += w;
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
      const values = [
        p.categorie || '',
        p.nom,
        p.reference || '',
        stockMap[p.id] ?? 0,
        '', // champ vide
      ];
      let x = startX;
      values.forEach((val, idx) => {
        const w = colWidths[idx];
        doc.rect(x, y, w, rowHeight).strokeColor('#e2e8f0').stroke();
        doc.text(String(val), x + 6, y + 6, { width: w - 12, ellipsis: true });
        x += w;
      });
      y += rowHeight;
    });

    doc.end();
  } catch (err) {
    console.error('Erreur GET /stock/inventaire-feuille-pdf :', err);
    res.status(500).json({ error: 'Erreur lors de la génération PDF inventaire.' });
  }
});

export default router;

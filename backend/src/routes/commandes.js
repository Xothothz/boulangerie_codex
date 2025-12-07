import express from 'express';
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';
import prisma from '../config/db.js';
import { ensureMagasin, getMagasinScope } from '../utils/magasin.js';

const router = express.Router();

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function computeOrderAndDelivery(dateCommande) {
  const base = startOfDay(dateCommande || new Date());
  const dow = base.getDay(); // 0=Sun ... 6=Sat

  // Règle métier : si on est mardi, on prépare la commande pour samedi (livraison mardi suivant).
  // Si on est samedi, on prépare la commande pour mardi (livraison jeudi).
  // Sinon on se cale sur la prochaine échéance (samedi -> mardi / mardi -> samedi).
  const isTuesday = dow === 2;
  const isSaturday = dow === 6;

  let orderDate;
  let deliveryDate;

  if (isTuesday) {
    orderDate = addDays(base, 4); // samedi
    deliveryDate = addDays(orderDate, 3); // mardi suivant
  } else if (isSaturday) {
    orderDate = addDays(base, 3); // mardi
    deliveryDate = addDays(orderDate, 2); // jeudi
  } else {
    // Autres jours : prochaine échéance (mardi ou samedi) la plus proche
    const daysToTuesday = (2 - dow + 7) % 7;
    const daysToSaturday = (6 - dow + 7) % 7;
    if (daysToSaturday < daysToTuesday) {
      orderDate = addDays(base, daysToSaturday); // samedi
      deliveryDate = addDays(orderDate, 3); // mardi
    } else {
      orderDate = addDays(base, daysToTuesday); // mardi
      deliveryDate = addDays(orderDate, 2); // jeudi
    }
  }

  // Calcul de la prochaine livraison après celle qu'on prépare, pour couvrir la période
  const nextOrderDate = (() => {
    for (let i = 1; i <= 10; i++) {
      const candidate = addDays(orderDate, i);
      const cdow = candidate.getDay();
      if (cdow === 2 || cdow === 6) return candidate;
    }
    return addDays(orderDate, 4); // fallback samedi
  })();
  const nextDeliveryDate =
    nextOrderDate.getDay() === 2
      ? addDays(nextOrderDate, 2) // mardi -> jeudi
      : addDays(nextOrderDate, 3); // samedi -> mardi

  // Calcul encore après (livraison suivante) pour couvrir jusqu'à la prochaine après
  const thirdOrderDate = (() => {
    for (let i = 1; i <= 10; i++) {
      const candidate = addDays(nextOrderDate, i);
      const cdow = candidate.getDay();
      if (cdow === 2 || cdow === 6) return candidate;
    }
    return addDays(nextOrderDate, 4); // fallback samedi
  })();
  const thirdDeliveryDate =
    thirdOrderDate.getDay() === 2
      ? addDays(thirdOrderDate, 2)
      : addDays(thirdOrderDate, 3);

  const joursACouvrir = Math.max(
    1,
    Math.ceil(
      (startOfDay(thirdDeliveryDate).getTime() - startOfDay(deliveryDate).getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );

  return { orderDate, deliveryDate, nextDeliveryDate, thirdDeliveryDate, joursACouvrir };
}

async function fetchStocksByProduit(magasinId) {
  const produits = await prisma.produit.findMany({
    where: magasinId ? { magasinId } : {},
    select: { id: true },
  });
  if (produits.length === 0) return {};

  const grouped = await prisma.mouvementStock.groupBy({
    by: ['produitId'],
    _sum: { quantite: true },
    where: { produitId: { in: produits.map((p) => p.id) } },
  });
  return Object.fromEntries(grouped.map((g) => [g.produitId, g._sum.quantite || 0]));
}

async function fetchPendingQuantities(magasinId) {
  const lignes = await prisma.commandeLigne.groupBy({
    by: ['produitId'],
    _sum: { unites: true, unitesRecues: true },
    where: {
      commande: {
        statut: { in: ['EN_ATTENTE'] },
        ...(magasinId ? { magasinId } : {}),
      },
    },
  });

  return Object.fromEntries(
    lignes.map((l) => [l.produitId, (l._sum.unites || 0) - (l._sum.unitesRecues || 0)]),
  );
}

function buildPropositionLine(produit, data) {
  const {
    stockActuel = 0,
    stockTheorique = 0,
    joursACouvrir = 2,
    enAttente = 0,
  } = data;

  const consommationEstimee = (produit.quantiteJour || 0) * joursACouvrir;
  const besoin = consommationEstimee - stockActuel - enAttente;

  const cartons =
    produit.unitesCarton && produit.unitesCarton > 0 && besoin > 0
      ? Math.ceil(besoin / produit.unitesCarton)
      : 0;

  const totalUnites = cartons * (produit.unitesCarton || 0);

  return {
    produitId: produit.id,
    nom: produit.nom,
    ifls: produit.ifls || '',
    ean13: produit.ean13 || '',
    cartonsProposes: cartons,
    unitesParCarton: produit.unitesCarton || 0,
    totalUnites,
    stockActuel,
    stockTheorique,
    enAttente,
    consommationEstimee,
    besoinUnites: Math.max(0, Math.ceil(besoin)),
    quantiteJour: produit.quantiteJour || 0,
    categorie: produit.categorie || produit.categorieRef?.nom || '',
  };
}

router.get('/proposition', async (req, res) => {
  const { dateCommande } = req.query;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const {
      orderDate,
      deliveryDate,
      nextDeliveryDate,
      thirdDeliveryDate,
      joursACouvrir,
    } = computeOrderAndDelivery(
      dateCommande ? new Date(dateCommande) : new Date(),
    );

    const [stockMap, pendingMap, produits] = await Promise.all([
      fetchStocksByProduit(resolvedMagasinId),
      fetchPendingQuantities(resolvedMagasinId),
      prisma.produit.findMany({
        where: {
          actif: true,
          ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}),
          unitesCarton: { not: null },
        },
        select: {
          id: true,
          nom: true,
          ifls: true,
          ean13: true,
          quantiteJour: true,
          unitesCarton: true,
          categorie: true,
          categorieRef: { select: { nom: true } },
        },
      }),
    ]);

    const lignes = produits
      .map((p) =>
        buildPropositionLine(p, {
          stockActuel: stockMap[p.id] ?? 0,
          stockTheorique: stockMap[p.id] ?? 0,
          joursACouvrir,
          enAttente: pendingMap[p.id] ?? 0,
        }),
      )
      .filter((l) => l.cartonsProposes > 0);

    return res.json({
      dateCommande: orderDate.toISOString(),
      dateLivraisonPrevue: deliveryDate.toISOString(),
      prochaineLivraison: nextDeliveryDate.toISOString(),
      livraisonSuivante: thirdDeliveryDate.toISOString(),
      joursACouvrir,
      lignes,
    });
  } catch (err) {
    console.error('Erreur GET /commandes/proposition :', err);
    return res.status(500).json({ error: 'Erreur lors du calcul de la proposition.' });
  }
});

function applyModificationToProposition(proposition, fn) {
  const copy = {
    ...proposition,
    lignes: Array.isArray(proposition.lignes) ? [...proposition.lignes] : [],
  };
  fn(copy);
  return copy;
}

router.post('/proposition/modifier', async (req, res) => {
  const { proposition, produitId, cartons } = req.body;
  if (!proposition || !produitId) {
    return res.status(400).json({ error: 'Proposition et produitId requis.' });
  }
  const updated = applyModificationToProposition(proposition, (p) => {
    p.lignes = p.lignes.map((l) =>
      l.produitId === Number(produitId)
        ? { ...l, cartonsProposes: Math.max(0, Number(cartons) || 0), totalUnites: (Math.max(0, Number(cartons) || 0)) * (l.unitesParCarton || 0) }
        : l,
    );
  });
  return res.json(updated);
});

router.post('/proposition/supprimer-produit', (req, res) => {
  const { proposition, produitId } = req.body;
  if (!proposition || !produitId) {
    return res.status(400).json({ error: 'Proposition et produitId requis.' });
  }
  const updated = applyModificationToProposition(proposition, (p) => {
    p.lignes = p.lignes.filter((l) => l.produitId !== Number(produitId));
  });
  return res.json(updated);
});

router.post('/proposition/ajouter-produit', async (req, res) => {
  const { proposition, produitId, cartons = 1 } = req.body;
  if (!proposition || !produitId) {
    return res.status(400).json({ error: 'Proposition et produitId requis.' });
  }

  try {
    const produit = await prisma.produit.findUnique({
      where: { id: Number(produitId) },
      select: {
        id: true,
        nom: true,
        ifls: true,
        ean13: true,
        quantiteJour: true,
        unitesCarton: true,
        categorie: true,
        categorieRef: { select: { nom: true } },
      },
    });
    if (!produit) return res.status(404).json({ error: 'Produit introuvable' });

    const line = {
      produitId: produit.id,
      nom: produit.nom,
      ifls: produit.ifls || '',
      ean13: produit.ean13 || '',
      cartonsProposes: Math.max(0, Number(cartons) || 0),
      unitesParCarton: produit.unitesCarton || 0,
      totalUnites: (Math.max(0, Number(cartons) || 0)) * (produit.unitesCarton || 0),
      stockActuel: 0,
      stockTheorique: 0,
      enAttente: 0,
      quantiteJour: produit.quantiteJour || 0,
      categorie: produit.categorie || produit.categorieRef?.nom || '',
    };

    const updated = applyModificationToProposition(proposition, (p) => {
      const exists = p.lignes.some((l) => l.produitId === produit.id);
      if (!exists) p.lignes.push(line);
    });
    return res.json(updated);
  } catch (err) {
    console.error('Erreur ajout produit proposition :', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/valider', async (req, res) => {
  const { dateCommande, dateLivraisonPrevue, lignes, commentaire } = req.body;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  if (!Array.isArray(lignes) || lignes.length === 0) {
    return res.status(400).json({ error: 'Aucune ligne de commande fournie.' });
  }

  try {
    const dateCmd = dateCommande ? new Date(dateCommande) : new Date();
    const dateLiv = dateLivraisonPrevue ? new Date(dateLivraisonPrevue) : addDays(dateCmd, 2);

    const produitIds = lignes.map((l) => Number(l.produitId)).filter(Boolean);
    const produits = await prisma.produit.findMany({
      where: { id: { in: produitIds }, ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}) },
      select: { id: true, unitesCarton: true, prixAchat: true },
    });
    const produitMap = Object.fromEntries(produits.map((p) => [p.id, p]));

    const validLines = [];
    for (const l of lignes) {
      const pid = Number(l.produitId);
      if (!pid || !produitMap[pid]) continue;
      const cartons = Math.max(0, Number(l.cartons) || Number(l.cartonsProposes) || 0);
      if (cartons === 0) continue;
      const upc = Number(produitMap[pid].unitesCarton) || 0;
      if (upc <= 0) continue;
      validLines.push({
        produitId: pid,
        cartons,
        unites: cartons * upc,
        unitesParCarton: upc,
        prixAchat: produitMap[pid].prixAchat || null,
      });
    }

    if (validLines.length === 0) {
      return res.status(400).json({ error: 'Aucune ligne valide après contrôle (cartons > 0, unités/carton renseignées).' });
    }

    const commande = await prisma.commande.create({
      data: {
        statut: 'EN_ATTENTE',
        dateCommande: dateCmd,
        dateLivraisonPrevue: dateLiv,
        commentaire: commentaire || null,
        magasinId: resolvedMagasinId || null,
        lignes: { create: validLines },
      },
      include: {
        lignes: true,
      },
    });

    return res.status(201).json(commande);
  } catch (err) {
    console.error('Erreur POST /commandes/valider :', err);
    return res.status(500).json({ error: 'Erreur lors de la validation de la commande.' });
  }
});

router.get('/en-attente', async (req, res) => {
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);
  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const commandes = await prisma.commande.findMany({
      where: {
        statut: 'EN_ATTENTE',
        ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}),
      },
      orderBy: { dateCommande: 'desc' },
      include: {
        lignes: {
          include: {
            produit: { select: { nom: true, reference: true, ifls: true, ean13: true } },
          },
        },
      },
    });
    res.json(commandes);
  } catch (err) {
    console.error('Erreur GET /commandes/en-attente :', err);
    res.status(500).json({ error: 'Erreur lors du chargement des commandes en attente.' });
  }
});

router.post('/:id/recevoir', async (req, res) => {
  const { id } = req.params;
  const { lignes, dateReception } = req.body;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;
  if (!Array.isArray(lignes) || lignes.length === 0) {
    return res.status(400).json({ error: 'Aucune ligne à réceptionner.' });
  }

  try {
    const commande = await prisma.commande.findUnique({
      where: { id: Number(id) },
      include: {
        lignes: true,
        magasin: true,
      },
    });
    if (!commande) return res.status(404).json({ error: 'Commande introuvable' });
    if (resolvedMagasinId && commande.magasinId !== resolvedMagasinId) {
      return res.status(403).json({ error: 'Commande hors de votre magasin' });
    }
    if (commande.statut === 'ANNULEE' || commande.statut === 'RECEPTIONNEE') {
      return res.status(400).json({ error: 'Commande déjà clôturée.' });
    }

    const receptionDate = dateReception ? new Date(dateReception) : new Date();
    const updates = [];

    for (const l of lignes) {
      const pid = Number(l.produitId);
      const recuCartons = l.cartonsRecus !== undefined ? Number(l.cartonsRecus) : null;
      const recuUnites =
        recuCartons !== null && !Number.isNaN(recuCartons)
          ? recuCartons * (commande.lignes.find((li) => li.produitId === pid)?.unitesParCarton || 0)
          : Number(l.unitesRecues);
      const recu = Math.max(0, recuUnites || 0);
      if (!pid || recu === 0) continue;
      const ligne = commande.lignes.find((li) => li.produitId === pid);
      if (!ligne) continue;
      const nouveauRecu = Math.min(ligne.unites, ligne.unitesRecues + recu);
      updates.push({ id: ligne.id, recu: nouveauRecu, delta: nouveauRecu - ligne.unitesRecues, produitId: pid });
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune ligne valide à réceptionner.' });
    }

    for (const u of updates) {
      await prisma.commandeLigne.update({
        where: { id: u.id },
        data: { unitesRecues: u.recu },
      });

      if (u.delta > 0) {
        await prisma.mouvementStock.create({
          data: {
            produitId: u.produitId,
            type: 'ENTREE',
            quantite: u.delta,
            nature: 'RECEPTION',
            commentaire: `Réception commande #${commande.id}`,
            date: receptionDate,
          },
        });
      }
    }

    const lignesAfter = await prisma.commandeLigne.findMany({
      where: { commandeId: commande.id },
    });
    // On clôture la commande, même si partielle : pas de reste à livrer
    await prisma.commande.update({
      where: { id: commande.id },
      data: { statut: 'RECEPTIONNEE' },
    });

    const commandeFinale = await prisma.commande.findUnique({
      where: { id: commande.id },
      include: {
        lignes: {
          include: {
            produit: { select: { nom: true, reference: true, ifls: true, ean13: true } },
          },
        },
      },
    });

    return res.json(commandeFinale);
  } catch (err) {
    console.error('Erreur POST /commandes/:id/recevoir :', err);
    res.status(500).json({ error: 'Erreur lors de la réception.' });
  }
});

router.post('/:id/annuler', async (req, res) => {
  const { id } = req.params;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const commande = await prisma.commande.findUnique({
      where: { id: Number(id) },
    });
    if (!commande) return res.status(404).json({ error: 'Commande introuvable' });
    if (resolvedMagasinId && commande.magasinId !== resolvedMagasinId) {
      return res.status(403).json({ error: 'Commande hors de votre magasin' });
    }
    if (commande.statut === 'RECEPTIONNEE') {
      return res.status(400).json({ error: 'Commande déjà réceptionnée' });
    }

    await prisma.commande.update({
      where: { id: commande.id },
      data: { statut: 'ANNULEE' },
    });

    return res.json({ message: 'Commande annulée.' });
  } catch (err) {
    console.error('Erreur POST /commandes/:id/annuler :', err);
    res.status(500).json({ error: 'Erreur lors de l’annulation.' });
  }
});

router.get('/historique', async (req, res) => {
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);
  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const commandes = await prisma.commande.findMany({
      where: resolvedMagasinId ? { magasinId: resolvedMagasinId } : {},
      orderBy: { dateCommande: 'desc' },
      take: 50,
      include: {
        lignes: {
          include: {
            produit: { select: { nom: true, ifls: true, ean13: true } },
          },
        },
      },
    });
    res.json(commandes);
  } catch (err) {
    console.error('Erreur GET /commandes/historique :', err);
    res.status(500).json({ error: 'Erreur lors du chargement de l’historique commandes.' });
  }
});

function formatDateFR(d) {
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

async function buildCommandePDF(res, commande) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 30, left: 30, right: 30, bottom: 30 },
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Commande_${commande.id}.pdf"`,
  );
  doc.pipe(res);

  doc
    .fontSize(18)
    .font('Helvetica-Bold')
    .fillColor('#065f46')
    .text('Lambert Gestion : Boulangerie', { align: 'center' });
  doc
    .moveDown(0.5)
    .fontSize(14)
    .font('Helvetica-Bold')
    .fillColor('#0f172a')
    .text(`Commande #${commande.id}`, { align: 'center' });

  doc
    .moveDown()
    .fontSize(11)
    .font('Helvetica')
    .fillColor('#0f172a')
    .text(`Date commande : ${formatDateFR(commande.dateCommande)}`)
    .text(`Livraison prévue : ${formatDateFR(commande.dateLivraisonPrevue)}`);

  doc.moveDown(1);

  const headers = [
    'IFLS (code-barres)',
    'Nom produit',
    'Cartons',
    'Unités/Carton',
    'Total unités',
    'Stock en attente',
  ];
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  // Répartition plus large en paysage
  const colWidths = [
    pageWidth * 0.18, // IFLS code-barres
    pageWidth * 0.32, // Nom
    pageWidth * 0.10, // Cartons
    pageWidth * 0.12, // Unités/Carton
    pageWidth * 0.14, // Total unités
    pageWidth * 0.14, // Stock en attente
  ];
  const startX = doc.x;
  let y = doc.y;
  const headerHeight = 24;
  const rowHeight = 44;

  const drawRow = (cells, isHeader = false) => {
    let x = startX;
    cells.forEach((cell, idx) => {
      const w = colWidths[idx] || 80;
      if (isHeader) {
        doc
          .save()
          .rect(x, y, w, headerHeight)
          .fill('#e2e8f0')
          .restore();
        doc
          .font('Helvetica-Bold')
          .fillColor('#0f172a')
          .text(cell, x + 4, y + 6, { width: w - 8 });
      } else {
        doc.rect(x, y, w, rowHeight).strokeColor('#e2e8f0').stroke();
        doc.font('Helvetica').fillColor('#0f172a').text(cell, x + 4, y + 4, {
          width: w - 8,
          ellipsis: true,
        });
      }
      x += w;
    });
    y += isHeader ? headerHeight : rowHeight;
  };

  drawRow(headers, true);

  // Préparer les code-barres pour éviter l'asynchrone pendant le dessin
  const barcodeMap = {};
  for (const l of commande.lignes) {
    if (l.produit.ifls) {
      try {
        const png = await bwipjs.toBuffer({
          bcid: 'code128',
          text: String(l.produit.ifls),
          scale: 0.9,
          height: 6,
          includetext: true,
          textxalign: 'center',
        });
        barcodeMap[l.id] = png;
      } catch (e) {
        // ignore
      }
    }
  }

  commande.lignes.forEach((l) => {
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      drawRow(headers, true);
    }

    // IFLS cell with barcode
    doc.rect(startX, y, colWidths[0], rowHeight).strokeColor('#e2e8f0').stroke();
    const barcode = barcodeMap[l.id];
    if (barcode) {
      const imgWidth = Math.min(colWidths[0] - 12, 90);
      doc.image(barcode, startX + 6, y + 6, { width: imgWidth });
    } else {
      doc
        .font('Helvetica')
        .fillColor('#0f172a')
        .text(l.produit.ifls || '', startX + 4, y + 12, { width: colWidths[0] - 8 });
    }

    // Other cells
    const cells = [
      l.produit.nom,
      String(l.cartons),
      String(l.unitesParCarton),
      String(l.unites),
      String(Math.max(0, l.unites - l.unitesRecues)),
    ];
    let x = startX + colWidths[0];
    cells.forEach((cell, idx) => {
      const w = colWidths[idx + 1];
      doc.rect(x, y, w, rowHeight).strokeColor('#e2e8f0').stroke();
      doc.font('Helvetica').fillColor('#0f172a').text(cell, x + 4, y + 12, {
        width: w - 8,
        ellipsis: true,
      });
      x += w;
    });

    y += rowHeight;
  });

  doc.end();
}

async function buildReceptionPDF(res, commande) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 30, left: 30, right: 30, bottom: 30 },
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Reception_Commande_${commande.id}.pdf"`,
  );
  doc.pipe(res);

  doc
    .fontSize(18)
    .font('Helvetica-Bold')
    .fillColor('#065f46')
    .text('Lambert Gestion : Boulangerie', { align: 'center' });
  doc
    .moveDown(0.4)
    .fontSize(14)
    .font('Helvetica-Bold')
    .fillColor('#0f172a')
    .text(`Réception commande #${commande.id}`, { align: 'center' });
  doc
    .moveDown()
    .fontSize(11)
    .font('Helvetica')
    .fillColor('#0f172a')
    .text(`Date commande : ${formatDateFR(commande.dateCommande)}`)
    .text(`Livraison prévue : ${formatDateFR(commande.dateLivraisonPrevue)}`)
    .text(`Statut : ${commande.statut.replace('_', ' ')}`);

  doc.moveDown(1);

  const headers = [
    'IFLS',
    'Nom produit',
    'Cartons',
    'Unités/Carton',
    'Unités commandées',
    'Unités reçues',
    'Reste',
  ];
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidths = [
    pageWidth * 0.16,
    pageWidth * 0.3,
    pageWidth * 0.1,
    pageWidth * 0.12,
    pageWidth * 0.12,
    pageWidth * 0.1,
    pageWidth * 0.1,
  ];
  const startX = doc.x;
  let y = doc.y;
  const headerHeight = 24;
  const rowHeight = 22;

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
      const w = colWidths[index];
      doc.rect(x, y, w, headerHeight).stroke();
      doc.text(h, x + 6, y + 6, { width: w - 12 });
      x += w;
    });
    y += headerHeight;
    doc.font('Helvetica').fontSize(10).fillColor('#0f172a');
  };

  drawHeader();

  commande.lignes.forEach((l) => {
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeader();
    }
    const rest = Math.max(0, l.unites - l.unitesRecues);
    let x = startX;
    const cells = [
      l.produit.ifls || '',
      l.produit.nom,
      String(l.cartons),
      String(l.unitesParCarton),
      String(l.unites),
      String(l.unitesRecues),
      String(rest),
    ];
    cells.forEach((cell, idx) => {
      const w = colWidths[idx];
      doc.rect(x, y, w, rowHeight).strokeColor('#e2e8f0').stroke();
      doc.text(cell, x + 6, y + 6, { width: w - 12, ellipsis: true });
      x += w;
    });
    y += rowHeight;
  });

  doc.end();
}

router.get('/:id/pdf', async (req, res) => {
  const { id } = req.params;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const commande = await prisma.commande.findUnique({
      where: { id: Number(id) },
      include: {
        lignes: {
          include: {
            produit: { select: { nom: true, ifls: true, ean13: true } },
          },
        },
      },
    });
    if (!commande) return res.status(404).json({ error: 'Commande introuvable' });
    if (resolvedMagasinId && commande.magasinId !== resolvedMagasinId) {
      return res.status(403).json({ error: 'Commande hors de votre magasin' });
    }

    await buildCommandePDF(res, commande);
  } catch (err) {
    console.error('Erreur GET /commandes/:id/pdf :', err);
    res.status(500).json({ error: 'Erreur lors de la génération du PDF.' });
  }
});

router.get('/:id/reception-pdf', async (req, res) => {
  const { id } = req.params;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const commande = await prisma.commande.findUnique({
      where: { id: Number(id) },
      include: {
        lignes: {
          include: {
            produit: { select: { nom: true, ifls: true, ean13: true } },
          },
        },
      },
    });
    if (!commande) return res.status(404).json({ error: 'Commande introuvable' });
    if (resolvedMagasinId && commande.magasinId !== resolvedMagasinId) {
      return res.status(403).json({ error: 'Commande hors de votre magasin' });
    }

    await buildReceptionPDF(res, commande);
  } catch (err) {
    console.error('Erreur GET /commandes/:id/reception-pdf :', err);
    res.status(500).json({ error: 'Erreur lors de la génération du PDF réception.' });
  }
});

export default router;

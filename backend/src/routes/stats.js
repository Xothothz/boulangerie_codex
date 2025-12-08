import express from 'express';
import prisma from '../config/db.js';
import { ensureMagasin, getMagasinScope } from '../utils/magasin.js';
import { requirePermission } from '../utils/permissions.js';

const router = express.Router();

function parseDays(value) {
  const n = Number(value);
  if (Number.isNaN(n) || n <= 0) return 7;
  return Math.min(n, 90); // évite des fenêtres trop larges
}

function startOfDay(d) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(d) {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function dateKey(d) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

router.get('/overview', requirePermission('stats:read'), async (req, res) => {
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const { start, end, produitId, categorieId } = req.query;

    let endDate = end ? new Date(end) : new Date();
    let startDate = start
      ? new Date(start)
      : startOfDay(addDays(endDate, -parseDays(req.query.jours) + 1));

    // normalisation dates
    startDate = startOfDay(startDate);
    endDate = endOfDay(endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Dates invalides' });
    }
    if (startDate > endDate) {
      [startDate, endDate] = [endDate, startDate];
    }

    // Liste de jours pour la série
    const dayList = [];
    const dayCursor = new Date(startDate);
    while (dayCursor <= endDate) {
      dayList.push(new Date(dayCursor));
      dayCursor.setDate(dayCursor.getDate() + 1);
    }

    const whereProduit = {};
    if (produitId) whereProduit.id = Number(produitId);
    if (categorieId) whereProduit.categorieId = Number(categorieId);
    if (resolvedMagasinId) whereProduit.magasinId = resolvedMagasinId;

    const mouvements = await prisma.mouvementStock.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        nature: { in: ['VENTE', 'PERTE'] },
        produit: Object.keys(whereProduit).length ? whereProduit : undefined,
      },
      select: {
        quantite: true,
        nature: true,
        date: true,
        produitId: true,
        produit: {
          select: {
            nom: true,
            reference: true,
            prixVente: true,
            prixAchat: true,
            categorieId: true,
          },
        },
      },
    });

    const totals = { ventes: 0, pertes: 0, margeEstimee: 0 };
    const dailyMap = Object.fromEntries(
      dayList.map((d) => [dateKey(d), { date: dateKey(d), ventes: 0, pertes: 0 }]),
    );

    const topVMap = new Map(); // ventes
    const topPMap = new Map(); // pertes

    for (const m of mouvements) {
      const qty = Math.abs(Number(m.quantite) || 0);
      const key = dateKey(new Date(m.date));

      if (m.nature === 'VENTE') {
        totals.ventes += qty;
        const prixVente = Number(m.produit?.prixVente || 0);
        const prixAchat = Number(m.produit?.prixAchat || 0);
        totals.margeEstimee += qty * (prixVente - prixAchat);

        const currentTop = topVMap.get(m.produitId) || {
          produitId: m.produitId,
          nom: m.produit?.nom || 'Produit',
          reference: m.produit?.reference || null,
          quantite: 0,
        };
        currentTop.quantite += qty;
        topVMap.set(m.produitId, currentTop);
      } else if (m.nature === 'PERTE') {
        totals.pertes += qty;
        const currentTop = topPMap.get(m.produitId) || {
          produitId: m.produitId,
          nom: m.produit?.nom || 'Produit',
          reference: m.produit?.reference || null,
          quantite: 0,
        };
        currentTop.quantite += qty;
        topPMap.set(m.produitId, currentTop);
      }

      if (dailyMap[key]) {
        if (m.nature === 'VENTE') dailyMap[key].ventes += qty;
        if (m.nature === 'PERTE') dailyMap[key].pertes += qty;
      }
    }

    const topVentes = Array.from(topVMap.values())
      .sort((a, b) => b.quantite - a.quantite)
      .slice(0, 5);
    const topPertes = Array.from(topPMap.values())
      .sort((a, b) => b.quantite - a.quantite)
      .slice(0, 5);

    // Stock actuel (ruptures)
    const produits = await prisma.produit.findMany({
      where: resolvedMagasinId ? { magasinId: resolvedMagasinId } : {},
      select: { id: true, nom: true, reference: true, categorie: true },
    });
    const produitIds = produits.map((p) => p.id);
    let stock = { ruptures: 0, bas: 0 };
    if (produitIds.length > 0) {
      const grouped = await prisma.mouvementStock.groupBy({
        by: ['produitId'],
        _sum: { quantite: true },
        where: { produitId: { in: produitIds } },
      });
      const stockMap = Object.fromEntries(
        grouped.map((g) => [g.produitId, g._sum.quantite || 0]),
      );
      produits.forEach((p) => {
        const s = stockMap[p.id] ?? 0;
        if (s <= 0) stock.ruptures += 1;
        else if (s > 0 && s < 5) stock.bas += 1;
      });
    }

    return res.json({
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        jours: dayList.length,
      },
      totals,
      daily: Object.values(dailyMap),
      topVentes,
      topPertes,
      stock,
    });
  } catch (err) {
    console.error('Erreur GET /stats/overview :', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;

import express from 'express';
import prisma from '../config/db.js';
import { ensureMagasin, getMagasinScope } from '../utils/magasin.js';
import { requirePermission } from '../utils/permissions.js';
import { logAudit } from '../utils/audit.js';

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

    const dailyMap = Object.fromEntries(
      dayList.map((d) => [dateKey(d), { date: dateKey(d), ventes: 0, pertes: 0 }]),
    );

    const produitStats = new Map(); // { ventes, pertes, prixVente, prixAchat, nom, reference }

    for (const m of mouvements) {
      const qty = Math.abs(Number(m.quantite) || 0);
      const key = dateKey(new Date(m.date));
      const entry =
        produitStats.get(m.produitId) ||
        {
          produitId: m.produitId,
          nom: m.produit?.nom || 'Produit',
          reference: m.produit?.reference || null,
          prixVente: Number(m.produit?.prixVente || 0),
          prixAchat: Number(m.produit?.prixAchat || 0),
          ventes: 0,
          pertes: 0,
        };

      if (m.nature === 'VENTE') entry.ventes += qty;
      if (m.nature === 'PERTE') entry.pertes += qty;
      produitStats.set(m.produitId, entry);

      if (dailyMap[key]) {
        if (m.nature === 'VENTE') dailyMap[key].ventes += qty;
        if (m.nature === 'PERTE') dailyMap[key].pertes += qty;
      }
    }

    const totals = { ventes: 0, pertes: 0, vendus: 0, margeEstimee: 0 };
    const topVentesRaw = [];
    const topPertes = [];

    for (const ps of produitStats.values()) {
      const vendu = Math.max(ps.ventes - ps.pertes, 0);
      totals.ventes += ps.ventes;
      totals.pertes += ps.pertes;
      totals.vendus += vendu;
      const pv = Number(ps.prixVente || 0);
      const pa = Number(ps.prixAchat || 0);
      totals.margeEstimee += vendu * pv - ps.ventes * pa;

      topVentesRaw.push({
        produitId: ps.produitId,
        nom: ps.nom,
        reference: ps.reference,
        quantite: vendu,
        chiffreAffaires: vendu * pv,
      });
      if (ps.pertes > 0) {
        topPertes.push({
          produitId: ps.produitId,
          nom: ps.nom,
          reference: ps.reference,
          quantite: ps.pertes,
        });
      }
    }

    const topVentes = topVentesRaw
      .filter((t) => t.quantite > 0)
      .sort((a, b) => b.quantite - a.quantite)
      .slice(0, 5);
    topPertes.sort((a, b) => b.quantite - a.quantite);
    const topPertesSlice = topPertes.slice(0, 5);

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
        where: {
          produitId: { in: produitIds },
          NOT: { nature: 'PERTE' }, // les pertes ne doivent pas baisser le stock
        },
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

    const payload = {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        jours: dayList.length,
      },
      totals,
      daily: Object.values(dailyMap),
      topVentes,
      topPertes: topPertesSlice,
      stock,
    };

    await logAudit({
      req,
      action: 'stats:overview',
      resourceType: 'stats',
      magasinId: resolvedMagasinId ?? null,
      details: {
        start: payload.period.start,
        end: payload.period.end,
        produitId: produitId ? Number(produitId) : null,
        categorieId: categorieId ? Number(categorieId) : null,
      },
    });

    return res.json(payload);
  } catch (err) {
    console.error('Erreur GET /stats/overview :', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;

import express from 'express';
import prisma from '../config/db.js';
import { ensureMagasin, getMagasinScope } from '../utils/magasin.js';
import { requirePermission } from '../utils/permissions.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();

/**
 * POST /ventes
 * Enregistre une mise en vente (mouvement SORTIE négatif).
 * Body JSON :
 * {
 *   "produitId": 1,
 *   "quantite": 5,
 *   "commentaire": "Mise en vente du jour",
 *   "date": "2025-12-06T10:00:00.000Z" (optionnel)
 * }
 */
router.post('/', requirePermission('ventes:record'), async (req, res) => {
  const { produitId, quantite, commentaire, date } = req.body;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  if (!produitId || quantite === undefined || quantite === null) {
    return res.status(400).json({
      error: 'Les champs "produitId" et "quantite" sont obligatoires',
    });
  }

  const q = Number(quantite);
  if (Number.isNaN(q) || q <= 0) {
    return res.status(400).json({ error: 'Quantité invalide (doit être > 0)' });
  }

  try {
    const produit = await prisma.produit.findFirst({
      where: {
        id: Number(produitId),
        actif: true,
        ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}),
      },
      select: { id: true },
    });

    if (!produit) {
      return res.status(404).json({ error: 'Produit introuvable pour ce magasin' });
    }

    const mouvement = await prisma.mouvementStock.create({
      data: {
        produitId: Number(produitId),
        type: 'SORTIE',
        quantite: -q,
        commentaire: commentaire || 'Mise en vente',
        nature: 'VENTE',
        date: date ? new Date(date) : undefined,
      },
    });

    await logAudit({
      req,
      action: 'ventes:record',
      resourceType: 'produit',
      resourceId: Number(produitId),
      magasinId: resolvedMagasinId ?? null,
      details: { quantite: q, nature: 'VENTE' },
    });

    return res.status(201).json(mouvement);
  } catch (err) {
    console.error('Erreur POST /ventes :', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /pertes
 * Enregistre une perte (mouvement SORTIE négatif).
 * Body JSON :
 * {
 *   "produitId": 1,
 *   "quantite": 2,
 *   "commentaire": "Perte invendue",
 *   "date": "2025-12-06T10:00:00.000Z" (optionnel)
 * }
 */
router.post('/pertes', requirePermission('pertes:record'), async (req, res) => {
  const { produitId, quantite, commentaire, date } = req.body;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  if (!produitId || quantite === undefined || quantite === null) {
    return res.status(400).json({
      error: 'Les champs "produitId" et "quantite" sont obligatoires',
    });
  }

  const q = Number(quantite);
  if (Number.isNaN(q) || q <= 0) {
    return res.status(400).json({ error: 'Quantité invalide (doit être > 0)' });
  }

  try {
    const produit = await prisma.produit.findFirst({
      where: {
        id: Number(produitId),
        actif: true,
        ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}),
      },
      select: { id: true },
    });

    if (!produit) {
      return res.status(404).json({ error: 'Produit introuvable pour ce magasin' });
    }

    const mouvement = await prisma.mouvementStock.create({
      data: {
        produitId: Number(produitId),
        type: 'SORTIE',
        quantite: -q,
        commentaire: commentaire || 'Perte',
        nature: 'PERTE',
        date: date ? new Date(date) : undefined,
      },
    });

    await logAudit({
      req,
      action: 'pertes:record',
      resourceType: 'produit',
      resourceId: Number(produitId),
      magasinId: resolvedMagasinId ?? null,
      details: { quantite: q, nature: 'PERTE' },
    });

    return res.status(201).json(mouvement);
  } catch (err) {
    console.error('Erreur POST /pertes :', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;

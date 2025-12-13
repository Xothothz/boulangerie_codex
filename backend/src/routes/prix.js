import express from 'express';
import prisma from '../config/db.js';
import { ensureMagasin, getMagasinScope } from '../utils/magasin.js';
import { requirePermission } from '../utils/permissions.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();

/**
 * POST /prix/historique
 * Ajoute une entrée d'historique de prix pour un produit.
 * Body JSON attendu :
 * {
 *   "produitId": 1,
 *   "type": "ACHAT" | "VENTE",
 *   "prix": 1.25,
 *   "dateDebut": "2025-12-06T10:00:00.000Z" (optionnel, maintenant par défaut)
 * }
 */
router.post('/historique', requirePermission('prix:write'), async (req, res) => {
  const { produitId, type, prix, dateDebut } = req.body;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!produitId || !type || prix === undefined || prix === null) {
    return res.status(400).json({
      error: 'Les champs "produitId", "type" et "prix" sont obligatoires',
    });
  }

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const produit = await prisma.produit.findFirst({
      where: {
        id: Number(produitId),
        ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}),
      },
    });

    if (!produit) {
      return res.status(404).json({ error: 'Produit introuvable pour ce magasin' });
    }

    const historique = await prisma.historiquePrix.create({
      data: {
        produitId: Number(produitId),
        type,
        prix: Number(prix),
        dateDebut: dateDebut ? new Date(dateDebut) : undefined,
      },
    });

    await logAudit({
      req,
      action: 'prix:write',
      resourceType: 'produit',
      resourceId: Number(produitId),
      magasinId: resolvedMagasinId ?? null,
      details: { type, prix: Number(prix), dateDebut: dateDebut || null },
    });

    res.status(201).json(historique);
  } catch (err) {
    console.error('Erreur POST /prix/historique :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /prix/historique
 * Liste l'historique des prix.
 * Query params optionnels :
 *  - produitId
 *  - type (ACHAT ou VENTE)
 */
router.get('/historique', async (req, res) => {
  const { produitId, type } = req.query;
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

    const historiques = await prisma.historiquePrix.findMany({
      where: whereClause,
      orderBy: { dateDebut: 'desc' },
      include: {
        produit: {
          select: { id: true, nom: true, reference: true },
        },
      },
    });

    res.json(historiques);
  } catch (err) {
    console.error('Erreur GET /prix/historique :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /prix/produits/:id
 * Récupère le prix applicable pour un produit à une date donnée.
 * Query param optionnel :
 *  - date=YYYY-MM-DD (si absent, on prend la date actuelle)
 *
 * Pour type="VENTE" uniquement ici.
 */
router.get('/produits/:id', async (req, res) => {
  const produitId = Number(req.params.id);
  const { date } = req.query;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (Number.isNaN(produitId)) {
    return res.status(400).json({ error: 'ID de produit invalide' });
  }

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const targetDate = date ? new Date(date) : new Date();

    const produit = await prisma.produit.findFirst({
      where: {
        id: produitId,
        ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}),
      },
      select: { id: true },
    });

    if (!produit) {
      return res.status(404).json({ error: 'Produit introuvable pour ce magasin' });
    }

    const historique = await prisma.historiquePrix.findFirst({
      where: {
        produitId,
        type: 'VENTE',
        dateDebut: {
          lte: targetDate,
        },
      },
      orderBy: {
        dateDebut: 'desc',
      },
    });

    if (!historique) {
      return res.status(404).json({
        error:
          "Aucun prix de vente trouvé pour ce produit à la date demandée (ou avant).",
      });
    }

    res.json({
      produitId,
      date: targetDate,
      prix: historique.prix,
      historiqueId: historique.id,
      dateDebut: historique.dateDebut,
    });
  } catch (err) {
    console.error('Erreur GET /prix/produits/:id :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;

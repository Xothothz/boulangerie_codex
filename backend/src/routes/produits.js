import express from 'express';
import prisma from '../config/db.js';
import { ensureMagasin, getMagasinScope } from '../utils/magasin.js';

const router = express.Router();

/**
 * GET /produits
 * Retourne les produits actifs.
 * Option : /produits?magasinId=1 pour filtrer par magasin.
 */
router.get('/', async (req, res) => {
  const { actif } = req.query;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const whereClause = {
      ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}),
      ...(actif !== undefined
        ? { actif: actif === 'true' || actif === '1' }
        : {}),
    };

    const produits = await prisma.produit.findMany({
      where: whereClause,
      include: {
        categorieRef: { select: { id: true, nom: true, couleur: true } },
      },
      orderBy: [
        { categorieRef: { nom: 'asc' } },
        { nom: 'asc' },
      ],
    });

    res.json(produits);
  } catch (err) {
    console.error('Erreur GET /produits :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /produits
 * Crée un produit.
 * Body JSON :
 * {
 *   "nom": "Donut sucre",
 *   "reference": "DONUT_SUC",
 *   "categorie": "Pâtisserie",
 *   "prixVente": 1.10,
 *   "magasinId": 1
 * }
 */
router.post('/', async (req, res) => {
  const {
    nom,
    reference,
    categorie,
    prixVente,
    prixAchat,
    unitesCarton,
    categorieId,
    magasinId,
    ean13,
    ifls,
    quantiteJour,
  } = req.body;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);
  const bodyMagasinId =
    magasinId !== undefined && magasinId !== null && magasinId !== ''
      ? Number(magasinId)
      : null;
  const targetMagasinId = isAdmin
    ? bodyMagasinId ?? resolvedMagasinId
    : resolvedMagasinId ?? bodyMagasinId;

  if (!nom) {
    return res.status(400).json({ error: 'Le champ "nom" est obligatoire' });
  }

  if (prixVente === undefined || prixVente === null) {
    return res
      .status(400)
      .json({ error: 'Le champ "prixVente" est obligatoire' });
  }

  if (!targetMagasinId && !isAdmin) {
    return res
      .status(400)
      .json({ error: 'Aucun magasin associé pour créer le produit' });
  }

  try {
    let categorieConnectId = null;
    if (categorieId) {
      const cat = await prisma.categorie.findFirst({
        where: {
          id: Number(categorieId),
          actif: true,
          ...(targetMagasinId ? { magasinId: targetMagasinId } : {}),
        },
        select: { id: true, nom: true },
      });
      if (!cat) {
        return res
          .status(400)
          .json({ error: 'Catégorie introuvable pour ce magasin' });
      }
      categorieConnectId = cat.id;
    }

    const produit = await prisma.produit.create({
      data: {
        nom,
        reference: reference || null,
        categorie: categorie || null,
        ean13: ean13 || null,
        ifls: ifls || null,
        quantiteJour:
          quantiteJour !== undefined && quantiteJour !== null && quantiteJour !== ''
            ? parseInt(quantiteJour, 10)
            : null,
        prixVente: Number(prixVente),
        prixAchat:
          prixAchat === undefined || prixAchat === null || prixAchat === ''
            ? null
            : Number(prixAchat),
        unitesCarton:
          unitesCarton === undefined || unitesCarton === null || unitesCarton === ''
            ? null
            : parseInt(unitesCarton, 10),
        categorieId: categorieConnectId,
        magasinId: targetMagasinId || null,
      },
    });

    res.status(201).json(produit);
  } catch (err) {
    if (err.code === 'P2002' && err.meta?.target?.includes('reference')) {
      return res
        .status(409)
        .json({ error: 'Cette référence existe déjà, merci d’en choisir une autre.' });
    }
    console.error('Erreur POST /produits :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PUT /produits/:id
 * Met à jour un produit.
 */
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const {
    nom,
    reference,
    categorie,
    prixVente,
    prixAchat,
    unitesCarton,
    categorieId,
    actif,
    ean13,
    ifls,
    quantiteJour,
  } = req.body;
  const { resolvedMagasinId } = getMagasinScope(req);
  const parsedQuantiteJour =
    quantiteJour === undefined
      ? undefined
      : quantiteJour === null || quantiteJour === ''
        ? null
        : parseInt(quantiteJour, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'ID invalide' });
  }

  try {
    let categorieConnectId = undefined;
    if (categorieId !== undefined) {
      if (categorieId === null || categorieId === '') {
        categorieConnectId = null;
      } else {
        const cat = await prisma.categorie.findFirst({
          where: {
            id: Number(categorieId),
            actif: true,
            ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}),
          },
          select: { id: true },
        });
        if (!cat) {
          return res
            .status(400)
            .json({ error: 'Catégorie introuvable pour ce magasin' });
        }
        categorieConnectId = cat.id;
      }
    }

    const produit = await prisma.produit.update({
      where: { id, ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}) },
      data: {
        nom,
        reference,
        categorie,
        prixVente: prixVente !== undefined ? Number(prixVente) : undefined,
        prixAchat:
          prixAchat === undefined || prixAchat === null || prixAchat === ''
            ? prixAchat === ''
              ? null
              : undefined
            : Number(prixAchat),
        unitesCarton:
          unitesCarton === undefined || unitesCarton === null || unitesCarton === ''
            ? unitesCarton === ''
              ? null
              : undefined
            : parseInt(unitesCarton, 10),
        categorieId: categorieConnectId,
        ean13: ean13 === '' ? null : ean13,
        ifls: ifls === '' ? null : ifls,
        quantiteJour:
          parsedQuantiteJour === undefined
            ? undefined
            : Number.isNaN(parsedQuantiteJour)
              ? null
              : parsedQuantiteJour,
        actif,
      },
    });

    res.json(produit);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Produit introuvable' });
    }
    if (err.code === 'P2002' && err.meta?.target?.includes('reference')) {
      return res
        .status(409)
        .json({ error: 'Cette référence existe déjà, merci d’en choisir une autre.' });
    }
    console.error('Erreur PUT /produits/:id :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /produits/:id
 * Désactive le produit (soft delete).
 */
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { resolvedMagasinId } = getMagasinScope(req);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'ID invalide' });
  }

  try {
    const produit = await prisma.produit.update({
      where: { id, ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}) },
      data: { actif: false },
    });

    res.json({ message: 'Produit désactivé', produit });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Produit introuvable' });
    }
    console.error('Erreur DELETE /produits/:id :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;

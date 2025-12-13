import express from 'express';
import prisma from '../config/db.js';
import { ensureMagasin, getMagasinScope } from '../utils/magasin.js';
import { requirePermission } from '../utils/permissions.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();

function normalizeHexColor(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  const match = str.match(/^#?[0-9a-fA-F]{6}$/);
  if (!match) return null;
  return str.startsWith('#') ? str : `#${str}`;
}

router.get('/', async (req, res) => {
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  try {
    const categories = await prisma.categorie.findMany({
      where: resolvedMagasinId ? { magasinId: resolvedMagasinId } : {},
      orderBy: { nom: 'asc' },
    });
    res.json(categories);
  } catch (err) {
    console.error('Erreur GET /categories :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', requirePermission('categories:create'), async (req, res) => {
  const { nom, couleur } = req.body;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;

  if (!nom || !nom.trim()) {
    return res.status(400).json({ error: 'Le nom est obligatoire' });
  }

  try {
    const categorie = await prisma.categorie.create({
      data: {
        nom: nom.trim(),
        couleur: normalizeHexColor(couleur),
        magasinId: resolvedMagasinId,
      },
    });
    await logAudit({
      req,
      action: 'categorie:create',
      resourceType: 'categorie',
      resourceId: categorie.id,
      magasinId: resolvedMagasinId,
      details: { nom: categorie.nom, couleur: categorie.couleur },
    });
    res.status(201).json(categorie);
  } catch (err) {
    if (err.code === 'P2002') {
      return res
        .status(409)
        .json({ error: 'Cette catégorie existe déjà pour ce magasin.' });
    }
    console.error('Erreur POST /categories :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', requirePermission('categories:update'), async (req, res) => {
  const id = Number(req.params.id);
  const { nom, actif, couleur } = req.body;
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'ID invalide' });
  }
  if (!nom || !nom.trim()) {
    return res.status(400).json({ error: 'Le nom est obligatoire' });
  }

  try {
    const categorie = await prisma.categorie.update({
      where: { id, ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}) },
      data: {
        nom: nom.trim(),
        actif: actif === undefined ? undefined : !!actif,
        couleur: couleur === undefined ? undefined : normalizeHexColor(couleur),
      },
    });
    await logAudit({
      req,
      action: 'categorie:update',
      resourceType: 'categorie',
      resourceId: id,
      magasinId: resolvedMagasinId,
      details: { nom, actif, couleur },
    });
    res.json(categorie);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Catégorie introuvable' });
    }
    if (err.code === 'P2002') {
      return res
        .status(409)
        .json({ error: 'Cette catégorie existe déjà pour ce magasin.' });
    }
    console.error('Erreur PUT /categories/:id :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id', requirePermission('categories:delete'), async (req, res) => {
  const id = Number(req.params.id);
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!ensureMagasin(res, resolvedMagasinId, isAdmin)) return;
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'ID invalide' });
  }

  try {
    const categorie = await prisma.categorie.update({
      where: { id, ...(resolvedMagasinId ? { magasinId: resolvedMagasinId } : {}) },
      data: { actif: false },
    });
    await logAudit({
      req,
      action: 'categorie:disable',
      resourceType: 'categorie',
      resourceId: id,
      magasinId: resolvedMagasinId,
    });
    res.json({ message: 'Catégorie désactivée', categorie });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Catégorie introuvable' });
    }
    console.error('Erreur DELETE /categories/:id :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;

import express from 'express';
import prisma from '../config/db.js';
import { getMagasinScope } from '../utils/magasin.js';
import { requirePermission } from '../utils/permissions.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();

/**
 * GET /magasins
 * Retourne tous les magasins actifs.
 */
router.get('/', async (req, res) => {
  const { isAdmin, resolvedMagasinId } = getMagasinScope(req);

  if (!isAdmin && !resolvedMagasinId) {
    return res.status(403).json({
      error:
        'Aucun magasin associé. Contactez un administrateur pour être affecté.',
    });
  }

  try {
    const magasins = await prisma.magasin.findMany({
      where: {
        actif: true,
        ...(isAdmin || !resolvedMagasinId
          ? {}
          : { id: resolvedMagasinId }),
      },
      orderBy: { nom: 'asc' },
    });
    res.json(magasins);
  } catch (err) {
    console.error('Erreur GET /magasins :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /magasins
 * Crée un magasin.
 * Body JSON : { "nom": "Texte", "code": "CODE01" }
 */
router.post('/', requirePermission('magasins:create'), async (req, res) => {
  const { isAdmin } = getMagasinScope(req);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const { nom, code } = req.body;
  const joursCommande = Array.isArray(req.body?.joursCommande)
    ? req.body.joursCommande.map((d) => Number(d)).filter((d) => !Number.isNaN(d))
    : undefined;
  const delaisLivraison = req.body?.delaisLivraison || undefined;

  if (!nom) {
    return res.status(400).json({ error: 'Le champ "nom" est obligatoire' });
  }

  try {
    const magasin = await prisma.magasin.create({
      data: {
        nom,
        code: code || null,
        joursCommande: joursCommande && joursCommande.length ? joursCommande : undefined,
        delaisLivraison: delaisLivraison || undefined,
      },
    });
    await logAudit({
      req,
      action: 'magasin:create',
      resourceType: 'magasin',
      resourceId: magasin.id,
      magasinId: magasin.id,
      details: { nom: magasin.nom, code: magasin.code },
    });
    res.status(201).json(magasin);
  } catch (err) {
    console.error('Erreur POST /magasins :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PUT /magasins/:id
 * Met à jour un magasin.
 */
router.put('/:id', requirePermission('magasins:update'), async (req, res) => {
  const { isAdmin } = getMagasinScope(req);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const id = Number(req.params.id);
  const { nom, code, actif } = req.body;
  const joursCommande = Array.isArray(req.body?.joursCommande)
    ? req.body.joursCommande.map((d) => Number(d)).filter((d) => !Number.isNaN(d))
    : undefined;
  const delaisLivraison = req.body?.delaisLivraison || undefined;

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'ID invalide' });
  }

  try {
    const magasin = await prisma.magasin.update({
      where: { id },
      data: {
        nom,
        code,
        actif,
        joursCommande:
          joursCommande === undefined
            ? undefined
            : joursCommande.length
              ? joursCommande
              : null,
        delaisLivraison: delaisLivraison === undefined ? undefined : delaisLivraison || null,
      },
    });
    await logAudit({
      req,
      action: 'magasin:update',
      resourceType: 'magasin',
      resourceId: id,
      magasinId: id,
      details: { nom, code, actif },
    });
    res.json(magasin);
  } catch (err) {
    console.error('Erreur PUT /magasins/:id :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /magasins/:id
 * Désactive le magasin (soft delete).
 */
router.delete('/:id', requirePermission('magasins:delete'), async (req, res) => {
  const { isAdmin } = getMagasinScope(req);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'ID invalide' });
  }

  try {
    const magasin = await prisma.magasin.update({
      where: { id },
      data: { actif: false },
    });
    await logAudit({
      req,
      action: 'magasin:disable',
      resourceType: 'magasin',
      resourceId: id,
      magasinId: id,
      details: { actif: false },
    });
    res.json({ message: 'Magasin désactivé', magasin });
  } catch (err) {
    console.error('Erreur DELETE /magasins/:id :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;

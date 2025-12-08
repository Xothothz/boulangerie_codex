import express from 'express';
import prisma from '../config/db.js';
import { PERMISSIONS, PERMISSION_GROUPS, requirePermission } from '../utils/permissions.js';

const router = express.Router();

// Liste des permissions disponibles (définies en code)
router.get(
  '/definitions',
  requirePermission('permissions:manage'),
  async (req, res) => {
    res.json({ permissions: PERMISSIONS, groups: PERMISSION_GROUPS });
  },
);

// Permissions d'un utilisateur
router.get(
  '/utilisateurs/:id',
  requirePermission('permissions:manage'),
  async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID utilisateur invalide' });
    }
    try {
      const user = await prisma.utilisateur.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
      const perms = await prisma.utilisateurPermission.findMany({
        where: { utilisateurId: id },
        select: { code: true },
        orderBy: { code: 'asc' },
      });
      return res.json({ utilisateurId: id, permissions: perms.map((p) => p.code) });
    } catch (err) {
      console.error('Erreur GET /permissions/utilisateurs/:id :', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  },
);

// Mise à jour des permissions d'un utilisateur (remplace le set)
router.put(
  '/utilisateurs/:id',
  requirePermission('permissions:manage'),
  async (req, res) => {
    const id = Number(req.params.id);
    const codes = Array.isArray(req.body?.permissions || req.body?.codes)
      ? req.body.permissions || req.body.codes
      : [];

    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID utilisateur invalide' });
    }

    const validCodes = new Set(PERMISSIONS.map((p) => p.code));
    const filteredCodes = [...new Set(codes.filter((c) => validCodes.has(String(c))))];

    try {
      const user = await prisma.utilisateur.findUnique({ where: { id }, select: { id: true } });
      if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

      await prisma.$transaction(async (tx) => {
        await tx.utilisateurPermission.deleteMany({ where: { utilisateurId: id } });
        if (filteredCodes.length > 0) {
          await tx.utilisateurPermission.createMany({
            data: filteredCodes.map((code) => ({ utilisateurId: id, code })),
          });
        }
      });

      return res.json({ utilisateurId: id, permissions: filteredCodes });
    } catch (err) {
      console.error('Erreur PUT /permissions/utilisateurs/:id :', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  },
);

export default router;

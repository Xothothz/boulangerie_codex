import express from 'express';
import prisma from '../config/db.js';
import { requirePermission } from '../utils/permissions.js';

const router = express.Router();

function ensureAdmin(req, res) {
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
    res.status(403).json({ error: 'Accès refusé : rôle ADMIN requis.' });
    return false;
  }
  return true;
}

// Liste des utilisateurs (ADMIN)
router.get('/', requirePermission('utilisateurs:list'), async (req, res) => {
  if (!ensureAdmin(req, res)) return;

  try {
    const users = await prisma.utilisateur.findMany({
      orderBy: { email: 'asc' },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        role: true,
        magasinId: true,
        magasin: { select: { id: true, nom: true } },
      },
    });
    res.json(users);
  } catch (err) {
    console.error('Erreur GET /utilisateurs :', err);
    res.status(500).json({ error: 'Erreur serveur lors du chargement des utilisateurs.' });
  }
});

// Affecter un utilisateur à un magasin (ou null)
router.put('/:id/magasin', requirePermission('utilisateurs:affecter'), async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  const { id } = req.params;
  const { magasinId } = req.body;

  try {
    const user = await prisma.utilisateur.update({
      where: { id: Number(id) },
      data: { magasinId: magasinId ? Number(magasinId) : null },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        role: true,
        magasinId: true,
        magasin: { select: { id: true, nom: true } },
      },
    });
    res.json(user);
  } catch (err) {
    console.error('Erreur PUT /utilisateurs/:id/magasin :', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du magasin utilisateur.' });
  }
});

// Changer le rôle d'un utilisateur (ADMIN)
router.put('/:id/role', requirePermission('utilisateurs:role'), async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  const { id } = req.params;
  const { role } = req.body;

  const allowed = new Set(['UTILISATEUR', 'ADMIN', 'SUPER_ADMIN']);
  if (!allowed.has(role)) {
    return res.status(400).json({ error: 'Rôle invalide.' });
  }

  try {
    const user = await prisma.utilisateur.update({
      where: { id: Number(id) },
      data: { role },
      select: {
        id: true,
        nom: true,
        email: true,
        role: true,
        magasinId: true,
        magasin: { select: { id: true, nom: true } },
      },
    });
    res.json(user);
  } catch (err) {
    console.error('Erreur PUT /utilisateurs/:id/role :', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du rôle utilisateur.' });
  }
});

export default router;

import express from 'express';
import prisma from '../config/db.js';
import { requirePermission } from '../utils/permissions.js';

const router = express.Router();

// Mise à jour du profil de l'utilisateur courant
router.put('/me', async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { nom, prenom } = req.body;
  if (!nom && !prenom) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour (nom/prenom).' });
  }

  try {
    const user = await prisma.utilisateur.update({
      where: { id: userId },
      data: {
        nom: nom === undefined ? undefined : nom?.trim() || null,
        prenom: prenom === undefined ? undefined : prenom?.trim() || null,
      },
      select: { id: true, email: true, nom: true, prenom: true, role: true, magasinId: true },
    });
    res.json({ user });
  } catch (err) {
    console.error('Erreur PUT /profil/me :', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du profil.' });
  }
});

// Admin : mise à jour profil d'un autre utilisateur (nom/prenom)
router.put(
  '/utilisateurs/:id',
  requirePermission('utilisateurs:list'),
  async (req, res) => {
    const { id } = req.params;
    const { nom, prenom } = req.body;

    if (!nom && !prenom) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour (nom/prenom).' });
    }

    try {
      const user = await prisma.utilisateur.update({
        where: { id: Number(id) },
        data: {
          nom: nom === undefined ? undefined : nom?.trim() || null,
          prenom: prenom === undefined ? undefined : prenom?.trim() || null,
        },
        select: { id: true, email: true, nom: true, prenom: true, role: true, magasinId: true },
      });
      res.json({ user });
    } catch (err) {
      console.error('Erreur PUT /profil/utilisateurs/:id :', err);
      res.status(500).json({ error: 'Erreur lors de la mise à jour du profil.' });
    }
  },
);

export default router;

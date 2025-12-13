import express from 'express';
import prisma from '../config/db.js';
import { requirePermission } from '../utils/permissions.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();

// Mise à jour du profil de l'utilisateur courant
router.put('/me', async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  const { nom, prenom } = req.body;

  if (!nom && !prenom) {
    return res
      .status(400)
      .json({ error: 'Aucun champ à mettre à jour (nom/prenom).' });
  }

  try {
    // 1) Mise à jour du nom via Prisma "classique"
    if (nom !== undefined) {
      await prisma.utilisateur.update({
        where: { id: userId },
        data: {
          nom: nom?.trim() || null,
        },
      });
    }

    // 2) Mise à jour du prénom via SQL brut (contourne le bug Prisma)
    if (prenom !== undefined) {
      const prenomValue = prenom?.trim() || null;
      await prisma.$executeRaw`
        UPDATE "Utilisateur"
        SET "prenom" = ${prenomValue}
        WHERE "id" = ${userId}
      `;
    }

    // 3) On relit l'utilisateur complet après mise à jour
    const user = await prisma.utilisateur.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        magasinId: true,
      },
    });

    await logAudit({
      req,
      action: 'profil:update',
      resourceType: 'utilisateur',
      resourceId: userId,
      magasinId: user.magasinId ?? null,
      details: { self: true, nom, prenom },
    });

    res.json({ user });
  } catch (err) {
    console.error('Erreur PUT /profil/me :', err);
    res
      .status(500)
      .json({ error: 'Erreur lors de la mise à jour du profil.' });
  }
});

// Admin : mise à jour profil d'un autre utilisateur (nom/prenom)
router.put(
  '/utilisateurs/:id',
  requirePermission('utilisateurs:list'),
  async (req, res) => {
    const { id } = req.params;
    const userId = Number(id);
    const { nom, prenom } = req.body;

    if (!nom && !prenom) {
      return res
        .status(400)
        .json({ error: 'Aucun champ à mettre à jour (nom/prenom).' });
    }

    try {
      // 1) Update du nom via Prisma
      if (nom !== undefined) {
        await prisma.utilisateur.update({
          where: { id: userId },
          data: {
            nom: nom?.trim() || null,
          },
        });
      }

      // 2) Update du prénom via SQL brut
      if (prenom !== undefined) {
        const prenomValue = prenom?.trim() || null;
        await prisma.$executeRaw`
          UPDATE "Utilisateur"
          SET "prenom" = ${prenomValue}
          WHERE "id" = ${userId}
        `;
      }

      // 3) Lecture de l'utilisateur mis à jour
      const user = await prisma.utilisateur.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          nom: true,
          prenom: true,
          role: true,
          magasinId: true,
        },
      });

      await logAudit({
        req,
        action: 'profil:update',
        resourceType: 'utilisateur',
        resourceId: userId,
        magasinId: user?.magasinId ?? null,
        details: { self: false, nom, prenom },
      });

      res.json({ user });
    } catch (err) {
      console.error('Erreur PUT /profil/utilisateurs/:id :', err);
      res
        .status(500)
        .json({ error: 'Erreur lors de la mise à jour du profil.' });
    }
  },
);

export default router;

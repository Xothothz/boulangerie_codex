import express from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../config/db.js';
import authMiddleware from '../middlewares/auth.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const TOKEN_EXPIRATION = process.env.JWT_EXPIRATION || '12h';

const googleClient = GOOGLE_CLIENT_ID
  ? new OAuth2Client(GOOGLE_CLIENT_ID)
  : null;

function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,        // lu depuis la BDD
      role: user.role,
      magasinId: user.magasinId || null,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRATION },
  );
}

router.post('/google', async (req, res) => {
  const { idToken } = req.body;

  if (!GOOGLE_CLIENT_ID) {
    return res
      .status(500)
      .json({ error: 'GOOGLE_CLIENT_ID manquant côté serveur' });
  }

  if (!idToken) {
    return res.status(400).json({ error: 'Token Google manquant' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.email) {
      return res.status(400).json({ error: 'Email Google introuvable' });
    }

    const email = payload.email.toLowerCase();
    const nomComplet = payload.name || email;
    const prenom = payload.given_name || null;
    const nom = payload.family_name || nomComplet || email;

    // Utilisateur déjà existant ?
    let user = await prisma.utilisateur.findUnique({
      where: { email },
    });

    const nomAffiche = nom || nomComplet || email;

    if (!user) {
      // Création sans champ "prenom" côté Prisma (évite l’erreur)
      user = await prisma.utilisateur.create({
        data: {
          email,
          nom: nomAffiche,
          role: 'UTILISATEUR',
        },
      });
    } else if (user.nom !== nomAffiche) {
      // Synchroniser le nom si Google a changé
      user = await prisma.utilisateur.update({
        where: { id: user.id },
        data: { nom: nomAffiche }, // pas de "prenom" ici
      });
    }

    // 🔹 Mise à jour du prénom en SQL brut pour éviter le bug Prisma
    if (prenom !== null && prenom !== undefined) {
      await prisma.$executeRaw`
        UPDATE "Utilisateur"
        SET "prenom" = ${prenom}
        WHERE "id" = ${user.id}
      `;
    }

    // On recharge l'utilisateur pour récupérer le prénom à jour
    user = await prisma.utilisateur.findUnique({
      where: { id: user.id },
    });

    const token = generateToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        magasinId: user.magasinId,
        picture: payload.picture || null,
      },
    });
  } catch (err) {
    console.error('Erreur POST /auth/google :', err);
    return res.status(401).json({ error: 'Authentification Google invalide' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.utilisateur.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,     // lecture OK
        role: true,
        magasinId: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    return res.json({ user });
  } catch (err) {
    console.error('Erreur GET /auth/me :', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;

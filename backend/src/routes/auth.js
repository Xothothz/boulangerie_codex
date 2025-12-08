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
      prenom: user.prenom,
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

    let user = await prisma.utilisateur.findUnique({
      where: { email },
    });

    if (!user) {
      user = await prisma.utilisateur.create({
        data: {
          email,
          nom: nom || nomComplet || email,
          prenom,
          role: 'UTILISATEUR',
        },
      });
    } else {
      // synchroniser si prénom/nom vides côté DB
      const updates = {};
      if (!user.nom && nom) updates.nom = nom;
      if (!user.prenom && prenom) updates.prenom = prenom;
      if (Object.keys(updates).length) {
        user = await prisma.utilisateur.update({
          where: { id: user.id },
          data: updates,
        });
      }
    }

    const token = generateToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
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
        prenom: true,
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

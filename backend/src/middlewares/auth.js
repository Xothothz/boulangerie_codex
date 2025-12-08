import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;

    // SUPER_ADMIN / ADMIN : pas de filtrage de permissions
    if (payload.role === 'ADMIN' || payload.role === 'SUPER_ADMIN') {
      req.user.permissions = ['*'];
      return next();
    }

    // Charge les permissions fines pour l'utilisateur
    try {
      const permissions = await prisma.utilisateurPermission.findMany({
        where: { utilisateurId: payload.userId },
        select: { code: true },
      });
      req.user.permissions = permissions.map((p) => p.code);
    } catch (err) {
      console.error('Erreur chargement permissions utilisateur :', err.message);
      req.user.permissions = [];
    }

    return next();
  } catch (err) {
    console.error('Erreur auth middleware :', err.message);
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

export default authMiddleware;

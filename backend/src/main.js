import 'dotenv/config';
import express from 'express';
import fileUpload from 'express-fileupload';
import cors from 'cors';

import magasinsRouter from './routes/magasins.js';
import produitsRouter from './routes/produits.js';
import stockRouter from './routes/stock.js';
import prixRouter from './routes/prix.js';
import semaineRouter from './routes/semaine.js';
import authRouter from './routes/auth.js';
import ventesRouter from './routes/ventes.js';
import categoriesRouter from './routes/categories.js';
import statsRouter from './routes/stats.js';
import commandesRouter from './routes/commandes.js';
import utilisateursRouter from './routes/utilisateurs.js';
import adminRouter from './routes/admin.js';
import permissionsRouter from './routes/permissions.js';
import profilRouter from './routes/profil.js';
import authMiddleware from './middlewares/auth.js';

const app = express();
const PORT = process.env.PORT || 8000;

// ✅ Autoriser les origines locales (liste dans CORS_ORIGIN, séparées par des virgules)
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // autorise curl/postman
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      console.warn('CORS: origine refusée', origin);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());
app.use(fileUpload());

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Auth
app.use('/auth', authRouter);

// Routes métier
app.use('/magasins', authMiddleware, magasinsRouter);
app.use('/produits', authMiddleware, produitsRouter);
app.use('/stock', authMiddleware, stockRouter);
app.use('/prix', authMiddleware, prixRouter);
app.use('/semaine', authMiddleware, semaineRouter);
app.use('/ventes', authMiddleware, ventesRouter);
app.use('/mises-en-vente', authMiddleware, ventesRouter); // alias plus explicite
app.use('/categories', authMiddleware, categoriesRouter);
app.use('/stats', authMiddleware, statsRouter);
app.use('/commandes', authMiddleware, commandesRouter);
app.use('/utilisateurs', authMiddleware, utilisateursRouter);
app.use('/admin', authMiddleware, adminRouter);
app.use('/permissions', authMiddleware, permissionsRouter);
app.use('/profil', authMiddleware, profilRouter);

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});

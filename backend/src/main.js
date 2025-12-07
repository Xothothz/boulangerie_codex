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
import authMiddleware from './middlewares/auth.js';

const app = express();
const PORT = process.env.PORT || 8000;

// ✅ Autoriser le frontend Vite (http://localhost:5173) à appeler l’API
app.use(
  cors({
    origin: 'http://localhost:5173',
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
app.use('/categories', authMiddleware, categoriesRouter);
app.use('/stats', authMiddleware, statsRouter);
app.use('/commandes', authMiddleware, commandesRouter);
app.use('/utilisateurs', authMiddleware, utilisateursRouter);
app.use('/admin', authMiddleware, adminRouter);

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});

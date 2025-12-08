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

router.post('/purge-commandes', requirePermission('admin:purge:commandes'), async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  try {
    await prisma.$transaction([
      prisma.commandeLigne.deleteMany({}),
      prisma.commande.deleteMany({}),
    ]);
    res.json({ message: 'Toutes les commandes ont été supprimées.' });
  } catch (err) {
    console.error('Erreur purge commandes', err);
    res.status(500).json({ error: 'Erreur lors de la purge des commandes.' });
  }
});

router.post('/purge-inventaires', requirePermission('admin:purge:inventaires'), async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  try {
    await prisma.$transaction([
      prisma.mouvementStock.deleteMany({ where: { inventaireId: { not: null } } }),
      prisma.inventaireLigne.deleteMany({}),
      prisma.inventaire.deleteMany({}),
    ]);
    res.json({ message: 'Tous les inventaires (et mouvements associés) ont été supprimés.' });
  } catch (err) {
    console.error('Erreur purge inventaires', err);
    res.status(500).json({ error: 'Erreur lors de la purge des inventaires.' });
  }
});

router.post('/purge-mouvements', requirePermission('admin:purge:mouvements'), async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  try {
    await prisma.mouvementStock.deleteMany({});
    res.json({ message: 'Tous les mouvements de stock ont été supprimés.' });
  } catch (err) {
    console.error('Erreur purge mouvements', err);
    res.status(500).json({ error: 'Erreur lors de la purge des mouvements.' });
  }
});

export default router;

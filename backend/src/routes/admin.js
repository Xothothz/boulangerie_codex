import express from 'express';
import prisma from '../config/db.js';
import { requirePermission } from '../utils/permissions.js';
import { logAudit } from '../utils/audit.js';
import { getActionLabel, humanizeAuditLog } from '../utils/auditHuman.js';

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
    await logAudit({
      req,
      action: 'admin:purge:commandes',
      resourceType: 'commande',
      details: { scope: 'all' },
    });
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
    await logAudit({
      req,
      action: 'admin:purge:inventaires',
      resourceType: 'inventaire',
      details: { scope: 'all' },
    });
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
    await logAudit({
      req,
      action: 'admin:purge:mouvements',
      resourceType: 'mouvement_stock',
      details: { scope: 'all' },
    });
    res.json({ message: 'Tous les mouvements de stock ont été supprimés.' });
  } catch (err) {
    console.error('Erreur purge mouvements', err);
    res.status(500).json({ error: 'Erreur lors de la purge des mouvements.' });
  }
});

// Lecture des logs d'audit (ADMIN/SUPER_ADMIN)
router.get('/audit-logs', requirePermission('audit:read'), async (req, res) => {
  const {
    limit = 50,
    action,
    success,
    userId,
    magasinId,
    resourceType,
    q,
    start,
    end,
  } = req.query;

  const take = Math.max(1, Math.min(Number(limit) || 50, 200));

  const where = {};
  if (action) where.action = { contains: String(action), mode: 'insensitive' };
  if (resourceType) {
    where.resourceType = { contains: String(resourceType), mode: 'insensitive' };
  }
  if (q) {
    where.OR = [
      { userEmail: { contains: String(q), mode: 'insensitive' } },
      { action: { contains: String(q), mode: 'insensitive' } },
      { path: { contains: String(q), mode: 'insensitive' } },
    ];
  }
  if (userId) where.userId = Number(userId);
  if (magasinId) where.magasinId = Number(magasinId);
  if (success === 'true') where.success = true;
  if (success === 'false') where.success = false;

  if (start || end) {
    where.createdAt = {};
    if (start) {
      const d = new Date(start);
      if (!Number.isNaN(d.getTime())) where.createdAt.gte = d;
    }
    if (end) {
      const d = new Date(end);
      if (!Number.isNaN(d.getTime())) where.createdAt.lte = d;
    }
  }

  try {
    const items = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    });
    const enriched = items.map((item) => ({
      ...item,
      actionLabel: getActionLabel(item.action),
      humanMessage: humanizeAuditLog(item),
    }));
    res.json({ items: enriched });
  } catch (err) {
    console.error('Erreur GET /admin/audit-logs :', err);
    res.status(500).json({ error: 'Erreur lors du chargement des logs.' });
  }
});

export default router;

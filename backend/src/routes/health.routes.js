import { Router } from 'express';

const router = Router();

// Endpoint GET /health : renvoie un statut simple pour vérifier que l'API tourne.
router.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

export default router;

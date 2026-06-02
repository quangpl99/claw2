import { Router } from 'express';
import { prisma } from '../db/client.js';

const router = Router();

// Health check
router.get('/', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export { router as healthRouter };
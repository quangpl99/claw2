import { Router, Request, Response } from 'express';
import { prisma } from '../db/client.js';
import { validateApiKey } from '../middleware/api-key.js';
import crypto from 'crypto';

const router = Router();

// GET /api/v1/projects — list all projects
router.get('/', validateApiKey, async (req: Request, res: Response) => {
  try {
    const projectId = (req as any).projectId;
    
    const projects = await prisma.project.findMany({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        webhookUrl: true,
        platform: true,
        notificationsEnabled: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { errors: true } }
      }
    });

    res.json({ projects });
  } catch (err) {
    console.error('Error GET /api/v1/projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// POST /api/v1/projects — create project
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Project name required' });
    }

    const apiKey = crypto.randomBytes(32).toString('hex');
    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        apiKey,
      }
    });

    res.status(201).json({
      project: {
        id: project.id,
        name: project.name,
        apiKey: project.apiKey, // Only returned on creation!
        createdAt: project.createdAt,
      }
    });
  } catch (err) {
    console.error('Error POST /api/v1/projects:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

export { router as projectsRouter };
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';

export async function validateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }

  const project = await prisma.project.findUnique({
    where: { apiKey },
    select: { id: true }
  });

  if (!project) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  (req as any).projectId = project.id;
  next();
}
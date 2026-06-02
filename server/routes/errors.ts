import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { validateApiKey } from '../middleware/api-key.js';
import { explainError } from '../services/ai-explainer.js';
import { sendNotification } from '../services/notifier.js';

const router = Router();

// POST /api/v1/errors — receive error batches
const errorSchema = z.object({
  errors: z.array(z.object({
    type: z.string(),
    message: z.string(),
    stack: z.string().optional(),
    timestamp: z.string().or(z.number()).transform(v => new Date(v)),
    metadata: z.record(z.any()).optional(),
  }))
});

router.post('/', validateApiKey, async (req: Request, res: Response) => {
  try {
    const { errors } = errorSchema.parse(req.body);
    const projectId = (req as any).projectId;
    const results: string[] = [];

    for (const err of errors) {
      // Parse file and line from stack
      const fileMatch = err.stack?.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      const file = fileMatch?.[2] || null;
      const line = fileMatch ? parseInt(fileMatch[3]) : null;

      // Find or create error group (hash by type + file + line)
      const hashKey = `${err.type}:${file}:${line}`;
      
      let group = await prisma.errorGroup.findFirst({
        where: {
          projectId,
          type: err.type,
          file: file,
          line: line,
        }
      });

      if (!group) {
        group = await prisma.errorGroup.create({
          data: {
            projectId,
            type: err.type,
            message: err.message.substring(0, 500),
            file,
            line,
          }
        });
        // Trigger AI explanation asynchronously
        if (process.env.OPENAI_API_KEY) {
          explainError(group.id, err.type, err.message, err.stack || '').catch(console.error);
        }
      }

      // Record occurrence
      await prisma.occurrence.create({
        data: {
          groupId: group.id,
          timestamp: err.timestamp,
          stack: (err.stack || '').substring(0, 10000),
          metadata: JSON.stringify(err.metadata || {}),
        }
      });

      // Send notification if webhook configured
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { webhookUrl: true, platform: true, notificationsEnabled: true }
      });

      if (project?.webhookUrl && project.notificationsEnabled) {
        sendNotification(
          project.webhookUrl,
          project.platform || 'discord',
          group,
          `https://shipfastlogs.dev/errors/${group.id}`
        ).catch(console.error);
      }

      results.push(group.id);
    }

    res.json({ received: errors.length, groups: results });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid payload', details: err.errors });
    }
    console.error('Error POST /api/v1/errors:', err);
    res.status(500).json({ error: 'Failed to process errors' });
  }
});

// GET /api/v1/errors — list errors for project
router.get('/', validateApiKey, async (req: Request, res: Response) => {
  try {
    const projectId = (req as any).projectId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const resolved = req.query.resolved === 'true' ? true : req.query.resolved === 'false' ? false : undefined;

    const where: any = { projectId };
    if (resolved !== undefined) where.resolved = resolved;

    const [groups, total] = await Promise.all([
      prisma.errorGroup.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { occurrences: true } },
          occurrences: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          }
        }
      }),
      prisma.errorGroup.count({ where })
    ]);

    res.json({
      groups,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Error GET /api/v1/errors:', err);
    res.status(500).json({ error: 'Failed to fetch errors' });
  }
});

// GET /api/v1/errors/:id — get error detail
router.get('/:id', validateApiKey, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const projectId = (req as any).projectId;

    const group = await prisma.errorGroup.findFirst({
      where: { id, projectId },
      include: {
        occurrences: {
          orderBy: { timestamp: 'desc' },
          take: 100,
        }
      }
    });

    if (!group) {
      return res.status(404).json({ error: 'Error not found' });
    }

    res.json({ group });
  } catch (err) {
    console.error('Error GET /api/v1/errors/:id:', err);
    res.status(500).json({ error: 'Failed to fetch error' });
  }
});

// PATCH /api/v1/errors/:id — update error (resolve/snooze)
router.patch('/:id', validateApiKey, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const projectId = (req as any).projectId;
    const { resolved, snoozedUntil } = req.body;

    const group = await prisma.errorGroup.findFirst({
      where: { id, projectId }
    });

    if (!group) {
      return res.status(404).json({ error: 'Error not found' });
    }

    const updated = await prisma.errorGroup.update({
      where: { id },
      data: {
        resolved: resolved ?? group.resolved,
        resolvedAt: resolved ? new Date() : null,
        snoozedUntil: snoozedUntil ? new Date(snoozedUntil) : null,
      }
    });

    res.json({ group: updated });
  } catch (err) {
    console.error('Error PATCH /api/v1/errors/:id:', err);
    res.status(500).json({ error: 'Failed to update error' });
  }
});

export { router as errorsRouter };
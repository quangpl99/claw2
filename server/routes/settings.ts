import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { validateApiKey } from '../middleware/api-key.js';
import { testWebhook } from '../services/notifier.js';

const router = Router();

// GET /api/v1/settings — get project settings
router.get('/', validateApiKey, async (req: Request, res: Response) => {
  try {
    const projectId = (req as any).projectId;
    
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        webhookUrl: true,
        platform: true,
        notificationsEnabled: true,
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ settings: project });
  } catch (err) {
    console.error('Error GET /api/v1/settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/v1/settings — update project settings
const settingsSchema = z.object({
  webhookUrl: z.string().url().optional().or(z.literal('')),
  platform: z.enum(['slack', 'discord']).optional(),
  notificationsEnabled: z.boolean().optional(),
  name: z.string().min(1).optional(),
});

router.put('/', validateApiKey, async (req: Request, res: Response) => {
  try {
    const projectId = (req as any).projectId;
    const data = settingsSchema.parse(req.body);

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        webhookUrl: data.webhookUrl || null,
        platform: data.platform,
        notificationsEnabled: data.notificationsEnabled ?? true,
        name: data.name,
      }
    });

    res.json({ settings: project });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid settings', details: err.errors });
    }
    console.error('Error PUT /api/v1/settings:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// POST /api/v1/settings/test-webhook — test webhook
router.post('/test-webhook', validateApiKey, async (req: Request, res: Response) => {
  try {
    const { webhookUrl, platform } = req.body;
    if (!webhookUrl) {
      return res.status(400).json({ error: 'webhookUrl required' });
    }

    const result = await testWebhook(webhookUrl, platform || 'discord');
    res.json(result);
  } catch (err) {
    console.error('Error POST /api/v1/settings/test-webhook:', err);
    res.status(500).json({ error: 'Webhook test failed' });
  }
});

export { router as settingsRouter };
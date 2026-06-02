import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorsRouter } from './routes/errors.js';
import { projectsRouter } from './routes/projects.js';
import { settingsRouter } from './routes/settings.js';
import { healthRouter } from './routes/health.js';
import { prisma } from './db/client.js';
import { rateLimit } from './middleware/rate-limit.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit);

// Routes
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/errors', errorsRouter);
app.use('/api/v1/projects', projectsRouter);
app.use('/api/v1/settings', settingsRouter);

// Dashboard static files
app.use(express.static('dashboard'));

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`\n🚀 ShipFast Logs running on http://localhost:${PORT}`);
  console.log(`   Dashboard: http://localhost:${PORT}/`);
  console.log(`   API: http://localhost:${PORT}/api/v1`);
});

export { app };
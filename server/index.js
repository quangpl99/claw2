require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

// Routes
const docsRouter = require('./routes/docs');
const chatRouter = require('./routes/chat');
const embedRouter = require('./routes/embed');
const webhooksRouter = require('./routes/webhooks');
const plansRouter = require('./routes/plans');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));

// Stripe webhooks need raw body — must be before express.json()
app.use('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }));

// Body parsing for all other routes
app.use(express.json({ limit: '1mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1/docs', docsRouter);
app.use('/api/v1/chat', chatRouter);
app.use('/api/v1/embed', embedRouter);
app.use('/api/v1/webhooks', webhooksRouter);
app.use('/api/v1/plans', plansRouter);

// Dashboard (serves admin UI)
app.use('/dashboard', express.static(path.join(__dirname, '..', 'public/dashboard')));

// Landing page
app.use('/', express.static(path.join(__dirname, '..', 'public/landing')));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Initialize database on startup
const { initDb } = require('./lib/db');
initDb();

app.listen(PORT, () => {
  console.log(`ShipFast Docs running on port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`API docs: http://localhost:${PORT}/api/v1/docs`);
});

module.exports = app;
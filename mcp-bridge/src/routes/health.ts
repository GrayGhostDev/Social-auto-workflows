import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

healthRouter.get('/ready', (req, res) => {
  // Add readiness checks here (e.g., database connectivity)
  res.json({
    ready: true,
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get('/live', (req, res) => {
  // Basic liveness check
  res.json({
    alive: true,
    timestamp: new Date().toISOString(),
  });
});
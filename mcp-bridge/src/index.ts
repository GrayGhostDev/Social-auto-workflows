import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import { pino } from 'pino';
import { register as prometheusRegister } from 'prom-client';
import dotenv from 'dotenv';

import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import { metricsMiddleware } from './middleware/metrics';
import { MCPServerManager } from './services/mcp-server-manager';
import { WebhookManager } from './services/webhook-manager';
import { mcpRouter } from './routes/mcp';
import { healthRouter } from './routes/health';
import { webhookRouter } from './routes/webhook';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services
const serverManager = new MCPServerManager(logger);
const webhookManager = new WebhookManager(logger);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
});
app.use('/api/', limiter);

// Body parsing
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Metrics middleware
app.use(metricsMiddleware);

// Health check (no auth required)
app.use('/health', healthRouter);

// Prometheus metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', prometheusRegister.contentType);
  res.end(prometheusRegister.metrics());
});

// API routes (auth required)
app.use('/api', authMiddleware);
app.use('/api', mcpRouter(serverManager, webhookManager));
app.use('/api/webhooks', webhookRouter(webhookManager));

// Error handling
app.use(errorHandler);

// Initialize MCP servers on startup
async function initializeServers() {
  const serverConfigs = JSON.parse(process.env.MCP_SERVERS || '[]');
  
  for (const config of serverConfigs) {
    try {
      await serverManager.connectServer(config);
      logger.info({ server: config.id }, 'Connected to MCP server');
    } catch (error) {
      logger.error({ server: config.id, error }, 'Failed to connect to MCP server');
    }
  }
}

// Start server
app.listen(PORT, async () => {
  logger.info({ port: PORT }, 'MCP Bridge service started');
  
  // Initialize MCP servers
  await initializeServers();
  
  // Setup graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await serverManager.disconnectAll();
    process.exit(0);
  });
});

export { app, logger };
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createLogger, format, transports } from 'winston';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCPServerManager } from './server-manager';
import { WebhookManager } from './webhook-manager';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error';
import { metricsMiddleware, register } from './metrics';
import { z } from 'zod';

// Logger configuration
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' })
  ]
});

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(metricsMiddleware);

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per minute
  message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// Initialize managers
const serverManager = new MCPServerManager(logger);
const webhookManager = new WebhookManager(logger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    servers: serverManager.getConnectedServers().length,
    uptime: process.uptime()
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  register.metrics().then(metrics => {
    res.end(metrics);
  });
});

// API Routes with authentication
app.use('/api', authMiddleware);

// List available MCP servers
app.get('/api/servers', async (req, res, next) => {
  try {
    const servers = await serverManager.listServers();
    res.json({ servers });
  } catch (error) {
    next(error);
  }
});

// Get tools for a specific server
app.get('/api/servers/:serverId/tools', async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const tools = await serverManager.getServerTools(serverId);
    res.json({ tools });
  } catch (error) {
    next(error);
  }
});

// Execute a tool
const ExecuteToolSchema = z.object({
  server: z.string(),
  tool: z.string(),
  parameters: z.record(z.any()),
  context: z.object({
    workflow_id: z.string(),
    execution_id: z.string(),
    node_name: z.string()
  }).optional()
});

app.post('/api/execute', async (req, res, next) => {
  try {
    const validated = ExecuteToolSchema.parse(req.body);
    
    logger.info('Executing tool', {
      server: validated.server,
      tool: validated.tool,
      context: validated.context
    });

    const result = await serverManager.executeTool(
      validated.server,
      validated.tool,
      validated.parameters
    );

    // Emit webhook event
    webhookManager.emit('tool_completed', {
      server: validated.server,
      tool: validated.tool,
      result,
      context: validated.context,
      timestamp: new Date().toISOString()
    });

    res.json({
      status: 'success',
      result,
      metadata: {
        server: validated.server,
        tool: validated.tool,
        execution_time: Date.now()
      }
    });
  } catch (error) {
    logger.error('Tool execution failed', { error, body: req.body });
    
    // Emit webhook event for failure
    webhookManager.emit('tool_failed', {
      server: req.body.server,
      tool: req.body.tool,
      error: error.message,
      context: req.body.context,
      timestamp: new Date().toISOString()
    });

    next(error);
  }
});

// Webhook management endpoints
app.get('/api/webhooks', async (req, res, next) => {
  try {
    const webhooks = await webhookManager.listWebhooks();
    res.json({ webhooks });
  } catch (error) {
    next(error);
  }
});

app.post('/api/webhooks', async (req, res, next) => {
  try {
    const webhook = await webhookManager.createWebhook(req.body);
    res.status(201).json(webhook);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/webhooks/:id', async (req, res, next) => {
  try {
    await webhookManager.deleteWebhook(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Error handling
app.use(errorHandler);

// Start server
async function start() {
  try {
    // Initialize MCP server connections
    await serverManager.initialize();
    
    // Start webhook manager
    await webhookManager.initialize();

    app.listen(PORT, () => {
      logger.info(`MCP Bridge running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start MCP Bridge', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await serverManager.shutdown();
  await webhookManager.shutdown();
  process.exit(0);
});

start();
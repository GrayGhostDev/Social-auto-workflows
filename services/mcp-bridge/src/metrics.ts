import { Request, Response, NextFunction } from 'express';
import { register, Counter, Histogram, Gauge } from 'prom-client';

// Create metrics
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const toolExecutionDuration = new Histogram({
  name: 'mcp_tool_execution_duration_seconds',
  help: 'Duration of MCP tool execution in seconds',
  labelNames: ['server', 'tool', 'status']
});

const toolExecutionTotal = new Counter({
  name: 'mcp_tool_executions_total',
  help: 'Total number of MCP tool executions',
  labelNames: ['server', 'tool', 'status']
});

const connectedServers = new Gauge({
  name: 'mcp_connected_servers',
  help: 'Number of connected MCP servers'
});

const activeWebhooks = new Gauge({
  name: 'mcp_active_webhooks',
  help: 'Number of active webhooks',
  labelNames: ['event']
});

// Register metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(toolExecutionDuration);
register.registerMetric(toolExecutionTotal);
register.registerMetric(connectedServers);
register.registerMetric(activeWebhooks);

// Middleware to track HTTP metrics
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode.toString()
    };

    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);
  });

  next();
}

export {
  register,
  toolExecutionDuration,
  toolExecutionTotal,
  connectedServers,
  activeWebhooks
};
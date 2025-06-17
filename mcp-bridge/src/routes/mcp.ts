import { Router } from 'express';
import { MCPServerManager } from '../services/mcp-server-manager';
import { WebhookManager } from '../services/webhook-manager';
import { APIError } from '../middleware/error-handler';

export function mcpRouter(
  serverManager: MCPServerManager,
  webhookManager: WebhookManager
): Router {
  const router = Router();

  // List all connected servers
  router.get('/servers', (req, res) => {
    const servers = serverManager.getServers();
    res.json({ servers });
  });

  // Get specific server details
  router.get('/servers/:serverId', (req, res) => {
    const { serverId } = req.params;
    const server = serverManager.getServer(serverId);
    
    if (!server) {
      throw new APIError(404, 'Server not found');
    }

    res.json({
      id: server.id,
      name: server.config.name,
      description: server.config.description,
      connected: server.connected,
      toolCount: server.tools.size,
      lastConnected: server.lastConnected,
      error: server.error,
    });
  });

  // List tools for a server
  router.get('/servers/:serverId/tools', (req, res) => {
    const { serverId } = req.params;
    const tools = serverManager.getServerTools(serverId);
    
    if (!tools.length && !serverManager.getServer(serverId)) {
      throw new APIError(404, 'Server not found');
    }

    res.json({ tools });
  });

  // Execute a tool
  router.post('/execute', async (req, res, next) => {
    try {
      const { server, tool, parameters, options } = req.body;

      if (!server || !tool) {
        throw new APIError(400, 'Server and tool are required');
      }

      // Set timeout based on options
      const timeout = options?.timeout || 30000;
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Tool execution timeout')), timeout)
      );

      try {
        const result = await Promise.race([
          serverManager.executeTool(server, tool, parameters || {}),
          timeoutPromise
        ]);

        // Trigger webhook for successful execution
        await webhookManager.triggerEvent('tool_completed', {
          ...result,
          request: { server, tool, parameters },
        });

        res.json(result);
      } catch (error) {
        // Trigger webhook for failed execution
        const errorData = {
          server,
          tool,
          error: error.message,
          success: false,
          timestamp: new Date().toISOString(),
          request: { server, tool, parameters },
        };

        await webhookManager.triggerEvent('tool_failed', errorData);
        
        throw error;
      }
    } catch (error) {
      next(error);
    }
  });

  // Connect a new server
  router.post('/servers', async (req, res, next) => {
    try {
      const serverConfig = req.body;

      if (!serverConfig.id || !serverConfig.name || !serverConfig.type) {
        throw new APIError(400, 'Server id, name, and type are required');
      }

      await serverManager.connectServer(serverConfig);
      
      // Trigger webhook for server connection
      await webhookManager.triggerEvent('server_connected', {
        server: serverConfig.id,
        timestamp: new Date().toISOString(),
      });

      res.status(201).json({ 
        message: 'Server connected successfully',
        serverId: serverConfig.id 
      });
    } catch (error) {
      next(error);
    }
  });

  // Disconnect a server
  router.delete('/servers/:serverId', async (req, res, next) => {
    try {
      const { serverId } = req.params;
      
      await serverManager.disconnectServer(serverId);
      
      // Trigger webhook for server disconnection
      await webhookManager.triggerEvent('server_disconnected', {
        server: serverId,
        timestamp: new Date().toISOString(),
      });

      res.json({ message: 'Server disconnected successfully' });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
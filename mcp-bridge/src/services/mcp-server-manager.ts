import { Client, Server, Tool } from '@modelcontextprotocol/sdk';
import { Logger } from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { mcpToolExecutions, mcpToolDuration } from '../middleware/metrics';

export interface MCPServerConfig {
  id: string;
  name: string;
  type: 'stdio' | 'websocket' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface MCPServer {
  id: string;
  config: MCPServerConfig;
  client: Client;
  tools: Map<string, Tool>;
  connected: boolean;
  lastConnected?: Date;
  error?: string;
}

export class MCPServerManager {
  private servers: Map<string, MCPServer> = new Map();
  
  constructor(private logger: Logger) {}

  async connectServer(config: MCPServerConfig): Promise<void> {
    try {
      const client = new Client({
        name: `mcp-bridge-${config.id}`,
        version: '1.0.0',
      });

      // Connect based on server type
      if (config.type === 'stdio' && config.command) {
        await client.connect({
          transport: 'stdio',
          command: config.command,
          args: config.args || [],
        });
      } else if (config.type === 'websocket' && config.url) {
        await client.connect({
          transport: 'websocket',
          url: config.url,
        });
      } else {
        throw new Error(`Unsupported server type: ${config.type}`);
      }

      // List available tools
      const toolsResponse = await client.listTools();
      const tools = new Map<string, Tool>();
      
      for (const tool of toolsResponse.tools) {
        tools.set(tool.name, tool);
      }

      // Store server info
      const server: MCPServer = {
        id: config.id,
        config,
        client,
        tools,
        connected: true,
        lastConnected: new Date(),
      };

      this.servers.set(config.id, server);
      
      // Setup error handling
      client.on('error', (error) => {
        this.logger.error({ server: config.id, error }, 'MCP server error');
        server.connected = false;
        server.error = error.message;
      });

      client.on('close', () => {
        this.logger.warn({ server: config.id }, 'MCP server disconnected');
        server.connected = false;
        this.reconnectServer(config.id);
      });

      this.logger.info({ 
        server: config.id, 
        toolCount: tools.size 
      }, 'Connected to MCP server');
    } catch (error) {
      this.logger.error({ server: config.id, error }, 'Failed to connect to MCP server');
      throw error;
    }
  }

  private async reconnectServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) return;

    // Exponential backoff reconnection
    let retryDelay = 1000;
    let retryCount = 0;
    const maxRetries = 5;

    const attemptReconnect = async () => {
      if (retryCount >= maxRetries) {
        this.logger.error({ server: serverId }, 'Max reconnection attempts reached');
        return;
      }

      retryCount++;
      
      try {
        await this.connectServer(server.config);
        this.logger.info({ server: serverId }, 'Reconnected to MCP server');
      } catch (error) {
        this.logger.warn({ 
          server: serverId, 
          attempt: retryCount, 
          nextRetry: retryDelay 
        }, 'Reconnection failed, retrying...');
        
        setTimeout(attemptReconnect, retryDelay);
        retryDelay *= 2; // Exponential backoff
      }
    };

    setTimeout(attemptReconnect, retryDelay);
  }

  async disconnectServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) return;

    try {
      await server.client.close();
      this.servers.delete(serverId);
      this.logger.info({ server: serverId }, 'Disconnected from MCP server');
    } catch (error) {
      this.logger.error({ server: serverId, error }, 'Error disconnecting from MCP server');
    }
  }

  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.servers.keys()).map(id => 
      this.disconnectServer(id)
    );
    await Promise.all(promises);
  }

  getServers(): MCPServerConfig[] {
    return Array.from(this.servers.values()).map(server => ({
      ...server.config,
      connected: server.connected,
      toolCount: server.tools.size,
      lastConnected: server.lastConnected,
      error: server.error,
    }));
  }

  getServer(serverId: string): MCPServer | undefined {
    return this.servers.get(serverId);
  }

  getServerTools(serverId: string): Tool[] {
    const server = this.servers.get(serverId);
    if (!server) return [];
    return Array.from(server.tools.values());
  }

  async executeTool(
    serverId: string, 
    toolName: string, 
    parameters: any
  ): Promise<any> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    if (!server.connected) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const tool = server.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found on server ${serverId}`);
    }

    const startTime = Date.now();
    const executionId = uuidv4();

    this.logger.info({ 
      executionId,
      server: serverId, 
      tool: toolName 
    }, 'Executing MCP tool');

    try {
      const result = await server.client.callTool({
        name: toolName,
        arguments: parameters,
      });

      const duration = (Date.now() - startTime) / 1000;
      
      mcpToolExecutions.inc({ 
        server: serverId, 
        tool: toolName, 
        status: 'success' 
      });
      
      mcpToolDuration.observe({ 
        server: serverId, 
        tool: toolName 
      }, duration);

      this.logger.info({ 
        executionId,
        server: serverId, 
        tool: toolName,
        duration 
      }, 'MCP tool execution completed');

      return {
        executionId,
        server: serverId,
        tool: toolName,
        result: result.content,
        success: true,
        executionTime: duration * 1000,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      
      mcpToolExecutions.inc({ 
        server: serverId, 
        tool: toolName, 
        status: 'error' 
      });

      this.logger.error({ 
        executionId,
        server: serverId, 
        tool: toolName,
        error,
        duration 
      }, 'MCP tool execution failed');

      throw {
        executionId,
        server: serverId,
        tool: toolName,
        error: error.message,
        success: false,
        executionTime: duration * 1000,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
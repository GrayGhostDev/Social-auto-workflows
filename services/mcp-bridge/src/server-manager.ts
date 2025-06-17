import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Logger } from 'winston';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

interface MCPServerConfig {
  id: string;
  name: string;
  description: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  capabilities?: string[];
}

interface ConnectedServer {
  id: string;
  config: MCPServerConfig;
  client: Client;
  connected: boolean;
  lastConnected?: Date;
  error?: string;
}

export class MCPServerManager extends EventEmitter {
  private servers: Map<string, ConnectedServer> = new Map();
  private logger: Logger;
  private configPath: string;

  constructor(logger: Logger) {
    super();
    this.logger = logger;
    this.configPath = process.env.MCP_CONFIG_PATH || '/etc/mcp/servers.json';
  }

  async initialize() {
    try {
      // Load server configurations
      const configs = await this.loadServerConfigs();
      
      // Connect to each server
      for (const config of configs) {
        await this.connectServer(config);
      }
      
      this.logger.info(`Initialized ${this.servers.size} MCP servers`);
    } catch (error) {
      this.logger.error('Failed to initialize MCP servers', error);
      throw error;
    }
  }

  private async loadServerConfigs(): Promise<MCPServerConfig[]> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(configData).servers || [];
    } catch (error) {
      this.logger.warn('No server config found, using defaults');
      return this.getDefaultConfigs();
    }
  }

  private getDefaultConfigs(): MCPServerConfig[] {
    return [
      {
        id: 'filesystem',
        name: 'Filesystem Server',
        description: 'Access to local filesystem',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']
      },
      {
        id: 'github',
        name: 'GitHub Server',
        description: 'Access to GitHub repositories',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {
          GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || ''
        }
      }
    ];
  }

  private async connectServer(config: MCPServerConfig) {
    try {
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        env: { ...process.env, ...config.env }
      });

      const client = new Client({
        name: `mcp-bridge-${config.id}`,
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      await client.connect(transport);

      this.servers.set(config.id, {
        id: config.id,
        config,
        client,
        connected: true,
        lastConnected: new Date()
      });

      this.logger.info(`Connected to MCP server: ${config.name}`);
      this.emit('server_connected', { server: config.id });

      // Handle disconnection
      client.on('error', (error) => {
        this.handleServerError(config.id, error);
      });

    } catch (error) {
      this.logger.error(`Failed to connect to server ${config.name}`, error);
      
      this.servers.set(config.id, {
        id: config.id,
        config,
        client: null as any,
        connected: false,
        error: error.message
      });
    }
  }

  private handleServerError(serverId: string, error: Error) {
    const server = this.servers.get(serverId);
    if (server) {
      server.connected = false;
      server.error = error.message;
      this.logger.error(`Server error for ${serverId}:`, error);
      this.emit('server_disconnected', { server: serverId, error: error.message });
      
      // Attempt reconnection after delay
      setTimeout(() => {
        this.reconnectServer(serverId);
      }, 5000);
    }
  }

  private async reconnectServer(serverId: string) {
    const server = this.servers.get(serverId);
    if (server && !server.connected) {
      this.logger.info(`Attempting to reconnect to ${serverId}`);
      await this.connectServer(server.config);
    }
  }

  async listServers() {
    return Array.from(this.servers.values()).map(server => ({
      id: server.id,
      name: server.config.name,
      description: server.config.description,
      connected: server.connected,
      capabilities: server.config.capabilities || [],
      lastConnected: server.lastConnected,
      error: server.error
    }));
  }

  getConnectedServers() {
    return Array.from(this.servers.values())
      .filter(s => s.connected)
      .map(s => s.id);
  }

  async getServerTools(serverId: string) {
    const server = this.servers.get(serverId);
    if (!server || !server.connected) {
      throw new Error(`Server ${serverId} not connected`);
    }

    try {
      const tools = await server.client.listTools();
      return tools.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }));
    } catch (error) {
      this.logger.error(`Failed to get tools for ${serverId}`, error);
      throw error;
    }
  }

  async executeTool(serverId: string, toolName: string, parameters: any) {
    const server = this.servers.get(serverId);
    if (!server || !server.connected) {
      throw new Error(`Server ${serverId} not connected`);
    }

    try {
      const startTime = Date.now();
      
      const result = await server.client.callTool({
        name: toolName,
        arguments: parameters
      });

      const duration = Date.now() - startTime;
      this.logger.info(`Tool execution completed`, {
        server: serverId,
        tool: toolName,
        duration
      });

      return result;
    } catch (error) {
      this.logger.error(`Tool execution failed`, {
        server: serverId,
        tool: toolName,
        error: error.message
      });
      throw error;
    }
  }

  async shutdown() {
    this.logger.info('Shutting down MCP server connections');
    
    for (const [serverId, server] of this.servers) {
      if (server.connected && server.client) {
        try {
          await server.client.close();
          this.logger.info(`Disconnected from ${serverId}`);
        } catch (error) {
          this.logger.error(`Error disconnecting from ${serverId}`, error);
        }
      }
    }
    
    this.servers.clear();
  }
}
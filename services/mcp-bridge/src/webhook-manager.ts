import { EventEmitter } from 'events';
import { Logger } from 'winston';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

interface Webhook {
  id: string;
  url: string;
  event: string;
  filters?: Record<string, any>;
  options?: Record<string, any>;
  active: boolean;
  createdAt: Date;
  lastTriggered?: Date;
  failureCount: number;
}

interface WebhookEvent {
  event: string;
  data: any;
  timestamp: string;
}

export class WebhookManager extends EventEmitter {
  private redis: Redis;
  private logger: Logger;
  private webhooks: Map<string, Webhook> = new Map();
  private batchQueues: Map<string, WebhookEvent[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(logger: Logger) {
    super();
    this.logger = logger;
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });
  }

  async initialize() {
    try {
      // Load webhooks from Redis
      await this.loadWebhooks();
      
      // Subscribe to webhook events
      this.setupEventHandlers();
      
      this.logger.info(`Webhook manager initialized with ${this.webhooks.size} webhooks`);
    } catch (error) {
      this.logger.error('Failed to initialize webhook manager', error);
      throw error;
    }
  }

  private async loadWebhooks() {
    try {
      const webhookKeys = await this.redis.keys('webhook:*');
      
      for (const key of webhookKeys) {
        const webhookData = await this.redis.get(key);
        if (webhookData) {
          const webhook = JSON.parse(webhookData);
          webhook.createdAt = new Date(webhook.createdAt);
          if (webhook.lastTriggered) {
            webhook.lastTriggered = new Date(webhook.lastTriggered);
          }
          this.webhooks.set(webhook.id, webhook);
        }
      }
    } catch (error) {
      this.logger.error('Failed to load webhooks from Redis', error);
    }
  }

  private setupEventHandlers() {
    // MCP events that can trigger webhooks
    const events = [
      'tool_completed',
      'tool_failed',
      'server_connected',
      'server_disconnected',
      'resource_changed',
      'prompt_suggested'
    ];

    for (const event of events) {
      this.on(event, (data) => this.handleEvent(event, data));
    }
  }

  private async handleEvent(event: string, data: any) {
    const webhooksToTrigger = Array.from(this.webhooks.values())
      .filter(webhook => webhook.active && webhook.event === event)
      .filter(webhook => this.matchesFilters(webhook, data));

    for (const webhook of webhooksToTrigger) {
      if (webhook.options?.realTimeEvents !== false) {
        // Real-time delivery
        await this.deliverWebhook(webhook, { event, data, timestamp: new Date().toISOString() });
      } else {
        // Batch delivery
        this.addToBatch(webhook, { event, data, timestamp: new Date().toISOString() });
      }
    }
  }

  private matchesFilters(webhook: Webhook, data: any): boolean {
    if (!webhook.filters) return true;

    for (const [key, value] of Object.entries(webhook.filters)) {
      if (value && data[key] !== value) {
        return false;
      }
    }

    return true;
  }

  private addToBatch(webhook: Webhook, event: WebhookEvent) {
    const batchKey = webhook.id;
    
    if (!this.batchQueues.has(batchKey)) {
      this.batchQueues.set(batchKey, []);
    }
    
    this.batchQueues.get(batchKey)!.push(event);

    // Reset batch timer
    if (this.batchTimers.has(batchKey)) {
      clearTimeout(this.batchTimers.get(batchKey)!);
    }

    const batchInterval = (webhook.options?.batchInterval || 60) * 1000;
    const timer = setTimeout(() => {
      this.flushBatch(webhook);
    }, batchInterval);

    this.batchTimers.set(batchKey, timer);
  }

  private async flushBatch(webhook: Webhook) {
    const batchKey = webhook.id;
    const events = this.batchQueues.get(batchKey) || [];
    
    if (events.length === 0) return;

    await this.deliverWebhook(webhook, {
      event: 'batch',
      data: events,
      timestamp: new Date().toISOString()
    });

    this.batchQueues.delete(batchKey);
    this.batchTimers.delete(batchKey);
  }

  private async deliverWebhook(webhook: Webhook, payload: any) {
    try {
      const response = await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Event': payload.event,
          'X-MCP-Webhook-ID': webhook.id
        },
        timeout: 30000,
        validateStatus: (status) => status < 500
      });

      if (response.status >= 200 && response.status < 300) {
        webhook.lastTriggered = new Date();
        webhook.failureCount = 0;
        await this.updateWebhook(webhook);
        
        this.logger.info(`Webhook delivered successfully`, {
          webhookId: webhook.id,
          event: payload.event,
          status: response.status
        });
      } else {
        throw new Error(`Webhook returned status ${response.status}`);
      }
    } catch (error) {
      webhook.failureCount++;
      await this.updateWebhook(webhook);
      
      this.logger.error(`Webhook delivery failed`, {
        webhookId: webhook.id,
        url: webhook.url,
        error: error.message,
        failureCount: webhook.failureCount
      });

      // Disable webhook after too many failures
      if (webhook.failureCount >= 10) {
        webhook.active = false;
        await this.updateWebhook(webhook);
        this.logger.warn(`Webhook ${webhook.id} disabled after ${webhook.failureCount} failures`);
      }
    }
  }

  async createWebhook(data: any): Promise<Webhook> {
    const webhook: Webhook = {
      id: uuidv4(),
      url: data.url,
      event: data.event,
      filters: data.filters || {},
      options: data.options || {},
      active: data.active !== false,
      createdAt: new Date(),
      failureCount: 0
    };

    this.webhooks.set(webhook.id, webhook);
    await this.redis.set(`webhook:${webhook.id}`, JSON.stringify(webhook));

    this.logger.info(`Created webhook ${webhook.id} for event ${webhook.event}`);
    return webhook;
  }

  async updateWebhook(webhook: Webhook) {
    await this.redis.set(`webhook:${webhook.id}`, JSON.stringify(webhook));
  }

  async deleteWebhook(id: string) {
    this.webhooks.delete(id);
    await this.redis.del(`webhook:${id}`);
    
    // Clean up any batch data
    this.batchQueues.delete(id);
    if (this.batchTimers.has(id)) {
      clearTimeout(this.batchTimers.get(id)!);
      this.batchTimers.delete(id);
    }

    this.logger.info(`Deleted webhook ${id}`);
  }

  async listWebhooks() {
    return Array.from(this.webhooks.values()).map(webhook => ({
      id: webhook.id,
      url: webhook.url,
      event: webhook.event,
      filters: webhook.filters,
      options: webhook.options,
      active: webhook.active,
      createdAt: webhook.createdAt,
      lastTriggered: webhook.lastTriggered,
      failureCount: webhook.failureCount
    }));
  }

  async shutdown() {
    // Flush all pending batches
    for (const [webhookId, webhook] of this.webhooks) {
      if (this.batchQueues.has(webhookId)) {
        await this.flushBatch(webhook);
      }
    }

    // Clear all timers
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }

    await this.redis.quit();
    this.logger.info('Webhook manager shut down');
  }
}
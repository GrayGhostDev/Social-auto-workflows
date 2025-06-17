import { Logger } from 'pino';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';

export interface Webhook {
  id: string;
  url: string;
  event: string;
  filters: Record<string, any>;
  options: Record<string, any>;
  active: boolean;
  createdAt: Date;
  lastTriggered?: Date;
  failureCount: number;
}

export class WebhookManager {
  private webhooks: Map<string, Webhook> = new Map();
  private eventQueues: Map<string, any[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(private logger: Logger) {}

  createWebhook(webhook: Omit<Webhook, 'id' | 'createdAt' | 'failureCount'>): Webhook {
    const newWebhook: Webhook = {
      id: uuidv4(),
      ...webhook,
      createdAt: new Date(),
      failureCount: 0,
    };

    this.webhooks.set(newWebhook.id, newWebhook);
    this.logger.info({ webhookId: newWebhook.id, event: webhook.event }, 'Webhook created');
    
    return newWebhook;
  }

  getWebhook(id: string): Webhook | undefined {
    return this.webhooks.get(id);
  }

  getWebhooks(): Webhook[] {
    return Array.from(this.webhooks.values());
  }

  updateWebhook(id: string, updates: Partial<Webhook>): Webhook | undefined {
    const webhook = this.webhooks.get(id);
    if (!webhook) return undefined;

    const updatedWebhook = { ...webhook, ...updates };
    this.webhooks.set(id, updatedWebhook);
    
    return updatedWebhook;
  }

  deleteWebhook(id: string): boolean {
    const deleted = this.webhooks.delete(id);
    if (deleted) {
      this.logger.info({ webhookId: id }, 'Webhook deleted');
    }
    return deleted;
  }

  async triggerEvent(event: string, data: any): Promise<void> {
    const webhooks = Array.from(this.webhooks.values()).filter(
      w => w.active && w.event === event && this.matchesFilters(w.filters, data)
    );

    for (const webhook of webhooks) {
      if (webhook.options.batchEvents) {
        this.queueEvent(webhook, data);
      } else {
        await this.sendWebhook(webhook, data);
      }
    }
  }

  private matchesFilters(filters: Record<string, any>, data: any): boolean {
    for (const [key, value] of Object.entries(filters)) {
      if (value && data[key] !== value) {
        return false;
      }
    }
    return true;
  }

  private queueEvent(webhook: Webhook, data: any): void {
    const queueKey = webhook.id;
    
    if (!this.eventQueues.has(queueKey)) {
      this.eventQueues.set(queueKey, []);
    }
    
    const queue = this.eventQueues.get(queueKey)!;
    queue.push(data);

    // Clear existing timer
    if (this.batchTimers.has(queueKey)) {
      clearTimeout(this.batchTimers.get(queueKey)!);
    }

    // Check if batch size reached
    const batchSize = webhook.options.batchSize || 10;
    if (queue.length >= batchSize) {
      this.flushQueue(webhook);
      return;
    }

    // Set timeout for batch
    const batchTimeout = webhook.options.batchTimeout || 5000;
    const timer = setTimeout(() => {
      this.flushQueue(webhook);
    }, batchTimeout);
    
    this.batchTimers.set(queueKey, timer);
  }

  private async flushQueue(webhook: Webhook): Promise<void> {
    const queueKey = webhook.id;
    const queue = this.eventQueues.get(queueKey);
    
    if (!queue || queue.length === 0) return;

    // Clear queue and timer
    this.eventQueues.set(queueKey, []);
    this.batchTimers.delete(queueKey);

    // Send batched events
    await this.sendWebhook(webhook, {
      event: webhook.event,
      batch: true,
      events: queue,
      timestamp: new Date().toISOString(),
    });
  }

  private async sendWebhook(webhook: Webhook, data: any): Promise<void> {
    const maxRetries = 3;
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount < maxRetries) {
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-MCP-Bridge-Event': webhook.event,
            'X-MCP-Bridge-Webhook-ID': webhook.id,
          },
          body: JSON.stringify(data),
          timeout: 30000,
        });

        if (!response.ok) {
          throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
        }

        // Success
        webhook.lastTriggered = new Date();
        webhook.failureCount = 0;
        
        this.logger.info({ 
          webhookId: webhook.id, 
          event: webhook.event,
          url: webhook.url 
        }, 'Webhook triggered successfully');
        
        return;
      } catch (error) {
        lastError = error as Error;
        retryCount++;
        
        this.logger.warn({ 
          webhookId: webhook.id, 
          event: webhook.event,
          url: webhook.url,
          attempt: retryCount,
          error: lastError.message 
        }, 'Webhook trigger failed');

        if (retryCount < maxRetries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        }
      }
    }

    // All retries failed
    webhook.failureCount++;
    
    if (webhook.failureCount >= 10) {
      webhook.active = false;
      this.logger.error({ 
        webhookId: webhook.id, 
        failureCount: webhook.failureCount 
      }, 'Webhook disabled due to repeated failures');
    }
  }
}
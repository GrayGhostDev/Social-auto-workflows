import { Router } from 'express';
import { WebhookManager } from '../services/webhook-manager';
import { APIError } from '../middleware/error-handler';

export function webhookRouter(webhookManager: WebhookManager): Router {
  const router = Router();

  // List all webhooks
  router.get('/', (req, res) => {
    const webhooks = webhookManager.getWebhooks();
    res.json({ webhooks });
  });

  // Get specific webhook
  router.get('/:webhookId', (req, res) => {
    const { webhookId } = req.params;
    const webhook = webhookManager.getWebhook(webhookId);
    
    if (!webhook) {
      throw new APIError(404, 'Webhook not found');
    }

    res.json(webhook);
  });

  // Create webhook
  router.post('/', (req, res) => {
    const { url, event, filters, options } = req.body;

    if (!url || !event) {
      throw new APIError(400, 'URL and event are required');
    }

    const webhook = webhookManager.createWebhook({
      url,
      event,
      filters: filters || {},
      options: options || {},
      active: true,
    });

    res.status(201).json(webhook);
  });

  // Update webhook
  router.patch('/:webhookId', (req, res) => {
    const { webhookId } = req.params;
    const updates = req.body;

    const webhook = webhookManager.updateWebhook(webhookId, updates);
    
    if (!webhook) {
      throw new APIError(404, 'Webhook not found');
    }

    res.json(webhook);
  });

  // Delete webhook
  router.delete('/:webhookId', (req, res) => {
    const { webhookId } = req.params;
    
    const deleted = webhookManager.deleteWebhook(webhookId);
    
    if (!deleted) {
      throw new APIError(404, 'Webhook not found');
    }

    res.json({ message: 'Webhook deleted successfully' });
  });

  // Test webhook
  router.post('/:webhookId/test', async (req, res, next) => {
    try {
      const { webhookId } = req.params;
      const webhook = webhookManager.getWebhook(webhookId);
      
      if (!webhook) {
        throw new APIError(404, 'Webhook not found');
      }

      // Trigger test event
      await webhookManager.triggerEvent(webhook.event, {
        test: true,
        webhookId,
        timestamp: new Date().toISOString(),
      });

      res.json({ message: 'Test event sent successfully' });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
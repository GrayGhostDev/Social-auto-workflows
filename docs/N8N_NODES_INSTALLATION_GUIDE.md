# n8n Nodes Installation Guide for GrayGhostAI Agents

This guide covers the installation and configuration of custom n8n nodes for GrayGhostAI content automation agents.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation Methods](#installation-methods)
4. [Node Configuration](#node-configuration)
5. [Usage Examples](#usage-examples)
6. [Troubleshooting](#troubleshooting)

## Overview

The GrayGhostAI n8n nodes package provides native n8n integration for:

- **Trend Scout**: Discover and analyze trending content opportunities
- **Experiment Manager**: A/B testing and content optimization
- **Trending Audio**: Audio trend analysis for social media
- **Retention Predictor**: ML-powered content retention prediction

Each node follows n8n's built-in node type patterns with:
- Proper TypeScript definitions
- Credential management
- Error handling
- Webhook triggers
- Resource/operation structure

## Prerequisites

### n8n Requirements

- n8n version: 1.19.0 or higher
- Node.js: 18.10 or higher
- pnpm: 8.6 or higher (for development)

### Agent Infrastructure

Ensure the MCP (Mission Control Plane) is deployed:

```bash
# Verify MCP gateway is accessible
kubectl get svc -n mcp mcp-gateway
# Should show the gateway service running

# Test gateway health
curl http://mcp-gateway.mcp:8080/health
# Should return {"status": "healthy"}
```

## Installation Methods

### Method 1: Install from npm (Recommended)

```bash
# In your n8n instance
cd /usr/local/lib/node_modules/n8n
npm install @grayghostai/n8n-nodes-grayghostai

# Restart n8n
pm2 restart n8n
# or
systemctl restart n8n
```

### Method 2: Install from Source

```bash
# Clone the repository
git clone https://github.com/ggdc/n8n-nodes-grayghostai.git
cd n8n-nodes-grayghostai

# Build the package
npm install
npm run build

# Link to n8n
npm link
cd /usr/local/lib/node_modules/n8n
npm link @grayghostai/n8n-nodes-grayghostai

# Restart n8n
pm2 restart n8n
```

### Method 3: Docker Installation

For n8n Docker deployments, create a custom Dockerfile:

```dockerfile
FROM n8nio/n8n:latest

# Install GrayGhostAI nodes
RUN cd /usr/local/lib/node_modules/n8n && \
    npm install @grayghostai/n8n-nodes-grayghostai

# Set environment variables
ENV N8N_CUSTOM_EXTENSIONS="/home/node/.n8n/custom"
```

Build and run:

```bash
docker build -t n8n-grayghostai .
docker run -it \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8n-grayghostai
```

### Method 4: Kubernetes Deployment

For n8n on Kubernetes, update your deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: n8n
  namespace: grayghostai
spec:
  template:
    spec:
      initContainers:
      - name: install-nodes
        image: node:18-alpine
        command:
        - sh
        - -c
        - |
          cd /n8n-custom-extensions
          npm install @grayghostai/n8n-nodes-grayghostai
        volumeMounts:
        - name: custom-extensions
          mountPath: /n8n-custom-extensions
      containers:
      - name: n8n
        image: n8nio/n8n:latest
        env:
        - name: N8N_CUSTOM_EXTENSIONS
          value: "/home/node/.n8n/custom"
        volumeMounts:
        - name: custom-extensions
          mountPath: /home/node/.n8n/custom
      volumes:
      - name: custom-extensions
        emptyDir: {}
```

## Node Configuration

### 1. Create Credentials

In n8n UI, go to **Credentials** > **New** and create credentials for each agent:

#### Trend Scout API
```json
{
  "name": "Trend Scout Production",
  "type": "trendScoutApi",
  "data": {
    "baseUrl": "http://mcp-gateway.mcp:8080/agents/trend-scout",
    "apiKey": "your-api-key-here",
    "environment": "production"
  }
}
```

#### Experiment Manager API
```json
{
  "name": "Experiment Manager Production",
  "type": "experimentManagerApi",
  "data": {
    "baseUrl": "http://mcp-gateway.mcp:8080/agents/experiment-manager",
    "apiKey": "your-api-key-here",
    "environment": "production"
  }
}
```

#### Trending Audio API
```json
{
  "name": "Trending Audio Production",
  "type": "trendingAudioApi",
  "data": {
    "baseUrl": "http://mcp-gateway.mcp:8080/agents/trending-audio",
    "apiKey": "your-api-key-here",
    "environment": "production",
    "defaultQuality": "high"
  }
}
```

#### Retention Predictor API
```json
{
  "name": "Retention Predictor Production",
  "type": "retentionPredictorApi",
  "data": {
    "baseUrl": "http://mcp-gateway.mcp:8080/agents/retention-predictor",
    "apiKey": "your-api-key-here",
    "environment": "production",
    "modelVersion": "stable",
    "enableGpu": false
  }
}
```

### 2. Generate API Keys

```bash
# Generate API keys for n8n
kubectl exec -n mcp deployment/mcp-gateway -- \
  /app/scripts/generate-api-key.sh \
  --name "n8n-production" \
  --scopes "agents:*" \
  --expires "365d"
```

### 3. Configure Network Access

If n8n is in a different namespace:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-n8n-to-mcp
  namespace: mcp
spec:
  podSelector:
    matchLabels:
      app: mcp-gateway
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: grayghostai
    ports:
    - protocol: TCP
      port: 8080
```

## Usage Examples

### Example 1: Trend Discovery Workflow

```json
{
  "name": "Daily Trend Discovery",
  "nodes": [
    {
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "position": [250, 300],
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "hours",
              "hoursInterval": 6
            }
          ]
        }
      }
    },
    {
      "name": "Trend Scout",
      "type": "@grayghostai/n8n-nodes-grayghostai.trendScout",
      "position": [450, 300],
      "parameters": {
        "resource": "trend",
        "operation": "discover",
        "categories": ["tech", "ai", "security"],
        "sources": ["rss", "google_trends", "social"],
        "limit": 20,
        "additionalFields": {
          "useCache": false,
          "includeMetadata": true
        }
      },
      "credentials": {
        "trendScoutApi": {
          "id": "1",
          "name": "Trend Scout Production"
        }
      }
    },
    {
      "name": "Filter High Priority",
      "type": "n8n-nodes-base.filter",
      "position": [650, 300],
      "parameters": {
        "conditions": {
          "number": [
            {
              "value1": "={{$json.relevance_score}}",
              "operation": "larger",
              "value2": 80
            }
          ]
        }
      }
    },
    {
      "name": "Create Content Brief",
      "type": "@grayghostai/n8n-nodes-grayghostai.trendScout",
      "position": [850, 300],
      "parameters": {
        "resource": "brief",
        "operation": "generate",
        "trends": "={{JSON.stringify($json)}}",
        "targetAudience": "IT professionals and security teams",
        "platformPriority": ["linkedin", "twitter"]
      }
    }
  ]
}
```

### Example 2: A/B Testing Workflow

```json
{
  "name": "Content A/B Testing",
  "nodes": [
    {
      "name": "New Content Trigger",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300],
      "webhookId": "content-created"
    },
    {
      "name": "Create Experiment",
      "type": "@grayghostai/n8n-nodes-grayghostai.experimentManager",
      "position": [450, 300],
      "parameters": {
        "resource": "experiment",
        "operation": "create",
        "contentId": "={{$json.content_id}}",
        "contentType": "={{$json.type}}",
        "variantCount": 3,
        "variantTypes": ["hook", "thumbnail", "timing"],
        "additionalFields": {
          "testDuration": 120,
          "successMetrics": ["engagement_rate", "completion_rate"],
          "minSampleSize": 100,
          "confidenceThreshold": 0.95
        }
      }
    },
    {
      "name": "Wait for Results",
      "type": "n8n-nodes-base.wait",
      "position": [650, 300],
      "parameters": {
        "resume": "timeInterval",
        "interval": 2,
        "unit": "hours"
      }
    },
    {
      "name": "Analyze Results",
      "type": "@grayghostai/n8n-nodes-grayghostai.experimentManager",
      "position": [850, 300],
      "parameters": {
        "resource": "result",
        "operation": "analyze",
        "experimentId": "={{$node['Create Experiment'].json.experiment_id}}"
      }
    }
  ]
}
```

### Example 3: Retention Optimization Workflow

```json
{
  "name": "Retention Optimization Pipeline",
  "nodes": [
    {
      "name": "Video Upload Trigger",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300],
      "webhookId": "video-uploaded"
    },
    {
      "name": "Predict Retention",
      "type": "@grayghostai/n8n-nodes-grayghostai.retentionPredictor",
      "position": [450, 300],
      "parameters": {
        "resource": "prediction",
        "operation": "predict",
        "contentData": "={{JSON.stringify($json)}}",
        "contentType": "short_video",
        "platform": "tiktok",
        "additionalFields": {
          "includeConfidence": true,
          "detailedAnalysis": true
        }
      }
    },
    {
      "name": "Check Score",
      "type": "n8n-nodes-base.if",
      "position": [650, 300],
      "parameters": {
        "conditions": {
          "number": [
            {
              "value1": "={{$json.retention_score}}",
              "operation": "smaller",
              "value2": 0.7
            }
          ]
        }
      }
    },
    {
      "name": "Get Optimization",
      "type": "@grayghostai/n8n-nodes-grayghostai.retentionPredictor",
      "position": [850, 200],
      "parameters": {
        "resource": "optimization",
        "operation": "optimizeContent",
        "contentId": "={{$json.content_id}}",
        "targetRetention": 0.75
      }
    }
  ]
}
```

### Example 4: Webhook Trigger Setup

```javascript
// Trend Scout Trigger Node Configuration
{
  "name": "High Priority Trend Alert",
  "type": "@grayghostai/n8n-nodes-grayghostai.trendScoutTrigger",
  "parameters": {
    "event": "high_priority_trend",
    "filters": {
      "minRelevanceScore": 85,
      "categories": ["security", "ai"],
      "platforms": ["linkedin", "twitter"],
      "urgencyLevel": "high"
    },
    "options": {
      "includeRawData": true,
      "realTimeUpdates": true
    }
  },
  "credentials": {
    "trendScoutApi": {
      "id": "1",
      "name": "Trend Scout Production"
    }
  }
}
```

## Troubleshooting

### Common Issues

#### 1. Nodes Not Appearing in n8n

```bash
# Check if nodes are properly installed
ls -la /usr/local/lib/node_modules/n8n/node_modules/@grayghostai

# Check n8n logs
docker logs n8n | grep -i "grayghostai"

# Verify package.json includes the nodes
cat /usr/local/lib/node_modules/n8n/node_modules/@grayghostai/n8n-nodes-grayghostai/package.json | grep -A 10 "n8n"
```

#### 2. Connection Errors

```bash
# Test connectivity from n8n to MCP
kubectl exec -n grayghostai deployment/n8n -- \
  curl -v http://mcp-gateway.mcp:8080/health

# Check DNS resolution
kubectl exec -n grayghostai deployment/n8n -- \
  nslookup mcp-gateway.mcp.svc.cluster.local
```

#### 3. Authentication Failures

```bash
# Verify API key is valid
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://mcp-gateway.mcp:8080/agents/trend-scout/health

# Check agent logs
kubectl logs -n mcp deployment/trend-scout-agent | grep -i "auth"
```

#### 4. Webhook Issues

```bash
# List registered webhooks
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://mcp-gateway.mcp:8080/agents/trend-scout/webhooks

# Test webhook endpoint
curl -X POST http://n8n:5678/webhook/test-webhook-id \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### Debug Mode

Enable debug logging in n8n:

```bash
# Set environment variables
export N8N_LOG_LEVEL=debug
export N8N_LOG_OUTPUT=console

# Or in docker-compose.yml
environment:
  - N8N_LOG_LEVEL=debug
  - N8N_LOG_OUTPUT=console
```

### Performance Optimization

1. **Connection Pooling**
   ```javascript
   // In n8n settings
   {
     "executions": {
       "timeout": 300,
       "maxTimeout": 3600
     }
   }
   ```

2. **Batch Processing**
   - Use batch operations when processing multiple items
   - Enable caching in agent nodes where appropriate

3. **Resource Limits**
   - Set appropriate timeout values for long-running operations
   - Monitor memory usage for large data processing

## Support

For issues and questions:
- GitHub Issues: https://github.com/ggdc/n8n-nodes-grayghostai/issues
- Documentation: https://docs.grayghostai.com/n8n-integration
- Community Forum: https://community.n8n.io

## License

MIT License - See LICENSE file for details
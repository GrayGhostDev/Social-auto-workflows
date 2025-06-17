# GrayGhostAI Platform - System Architecture

## Overview

The GrayGhostAI platform is an enterprise-grade social media automation system built with security, scalability, and strict brand control at its core. This architecture leverages cloud-native technologies and follows best practices for high availability, observability, and compliance.

## Architecture Layers

### 1. Ingress / Edge Layer

The secure entry point for all incoming traffic, providing load balancing, threat protection, and authentication.

#### Components

- **Load Balancer**: Cloud-native LB (AWS ALB / Google Cloud LB)
  - TLS 1.3 encryption for all traffic
  - Health checks on `/health` endpoint
  - Sticky sessions for n8n editor

- **Web Application Firewall (WAF)**
  - File upload limit: 20 MB maximum
  - Geo-fencing for authorized regions only
  - Rate limiting: 100 requests/minute per IP
  - WAF logs: Low-impact PII, 7-day rotation

- **Authentication Gateway**
  - Identity Provider: Azure AD or Okta (OAuth2)
  - JWT tokens with 60-minute max validity
  - Required scopes: `n8n:editor`, `audit:read`
  - 2FA enforcement for editor and audit access

#### Security Controls

```yaml
# WAF Rule Configuration
rules:
  - name: file_size_limit
    condition: request.body.size > 20MB
    action: BLOCK
    
  - name: geo_fence
    condition: geo.country NOT IN ["US", "CA", "UK", "AU"]
    action: BLOCK
    
  - name: rate_limit
    condition: rate > 100/minute
    action: THROTTLE
```

### 2. Containers & Orchestration Layer

Core application runtime using Kubernetes for orchestration and high availability.

#### Infrastructure Requirements

- **Kubernetes**: v1.30+
- **Container Runtime**: containerd 1.7+
- **Service Mesh**: Istio (optional, for advanced traffic management)

#### Core Components

```yaml
# Component Distribution
n8n:
  replicas: 3 per environment
  resources:
    limits:
      cpu: 2000m
      memory: 2Gi
    requests:
      cpu: 1000m
      memory: 1Gi
  storage:
    temp: tmpfs (auto-cleanup on restart)

postgres:
  type: HA cluster
  replicas: 3 (1 primary, 2 replicas)
  version: 15.x
  backup: Daily snapshots to S3

redis:
  type: Cluster mode
  replicas: 3
  purpose: Queue management, caching
  persistence: AOF enabled

vault:
  deployment: Sidecar pattern
  purpose: Secret injection
  auth: Kubernetes service account
```

#### Deployment Strategy

- **Helm Charts**: Migrated from Docker Compose
- **GitOps**: ArgoCD for declarative deployments
- **Blue-Green Deployments**: Zero-downtime updates

### 3. Shared Services Layer

Internal microservices providing specialized functionality with strict brand controls.

#### Microservices

##### Canv-a-tor Service
- **Purpose**: Programmatic Canva content creation
- **Technology**: Node.js with Express
- **Brand Controls**: 
  - Embedded brand palette via environment variables
  - Validates all color inputs against approved HEX codes
  - Rejects off-brand color requests

```javascript
// Brand palette enforcement
const APPROVED_COLORS = {
  primary: process.env.BRAND_COLOR_PRIMARY || '#FF5733',
  secondary: process.env.BRAND_COLOR_SECONDARY || '#33FF57',
  accent: process.env.BRAND_COLOR_ACCENT || '#3357FF',
  // Additional brand colors...
};
```

##### Trend Miner Service
- **Purpose**: Social media trend analysis
- **Technology**: Python FastAPI
- **Features**:
  - Real-time trend detection
  - Sentiment analysis
  - Hashtag recommendations

##### Brandwatch Receiver
- **Purpose**: Webhook endpoint for Brandwatch
- **Security**: Webhook signature validation
- **Processing**: Async queue-based processing

#### Communication Patterns

- **Protocol**: gRPC for internal services
- **Resilience**: Circuit breaker with 5-second fallback
- **Service Discovery**: Kubernetes DNS

```yaml
# Circuit Breaker Configuration
circuitBreaker:
  failureThreshold: 5
  resetTimeout: 5s
  halfOpenRequests: 3
```

### 4. Observability Layer

Comprehensive monitoring, logging, and error tracking for system health and debugging.

#### Monitoring Stack

##### Prometheus
- **Metrics Collection**: 15-second scrape interval
- **Retention**: 30 days
- **Key Metrics**:
  - Request rate, error rate, duration (RED)
  - Resource utilization
  - Business metrics

##### Grafana
- **Dashboards**:
  - System Overview
  - n8n Workflow Performance
  - Brand Compliance Metrics
  - Cost Analysis

##### Loki
- **Log Aggregation**: All container logs
- **Labels**: `execution_id` for flow tracing
- **Retention**: 14 days
- **Index**: By namespace, pod, container

##### Sentry
- **Error Tracking**: Node.js applications
- **Integration**: Auto-instrumentation
- **Alert Channels**: Slack, PagerDuty

#### Alerting Rules

```yaml
# Prometheus Alert Configuration
groups:
  - name: performance
    rules:
      - alert: HighResponseTime
        expr: http_request_duration_seconds{quantile="0.95"} > 2
        for: 5m
        annotations:
          summary: "P95 response time exceeds 2 seconds"
          
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "Error rate exceeds 5%"
```

#### PII Protection

```yaml
# Promtail Pipeline for PII Redaction
pipeline_stages:
  - regex:
      expression: '(?i)(ssn|social.?security):\s*(\d{3}-?\d{2}-?\d{4})'
      replace: 'ssn: [REDACTED]'
      
  - regex:
      expression: '(?i)(email):\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})'
      replace: 'email: [REDACTED]'
      
  - labels:
      pii_redacted: true
```

## Network Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Internet                                 │
└────────────────────────────┬───────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   WAF + LB      │
                    │  (TLS 1.3)      │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Auth Gateway  │
                    │  (OAuth2/JWT)   │
                    └────────┬────────┘
                             │
        ┌────────────────────┴────────────────────┐
        │          Kubernetes Cluster             │
        │                                         │
        │  ┌─────────────┐  ┌─────────────┐     │
        │  │   n8n Pods  │  │ PostgreSQL  │     │
        │  │  (3 replicas)│  │ HA Cluster  │     │
        │  └─────────────┘  └─────────────┘     │
        │                                         │
        │  ┌─────────────┐  ┌─────────────┐     │
        │  │    Redis    │  │   Vault     │     │
        │  │   Cluster   │  │  Sidecar    │     │
        │  └─────────────┘  └─────────────┘     │
        │                                         │
        │  ┌──────────────────────────────┐      │
        │  │     Shared Services          │      │
        │  │  - Canv-a-tor               │      │
        │  │  - Trend Miner              │      │
        │  │  - Brandwatch Receiver      │      │
        │  └──────────────────────────────┘      │
        │                                         │
        └─────────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Observability  │
                    │  - Prometheus   │
                    │  - Grafana      │
                    │  - Loki         │
                    │  - Sentry       │
                    └─────────────────┘
```

## Security Architecture

### Defense in Depth

1. **Edge Security**
   - WAF rules and geo-fencing
   - DDoS protection
   - TLS 1.3 encryption

2. **Authentication & Authorization**
   - OAuth2 with short-lived tokens
   - 2FA enforcement
   - RBAC with least privilege

3. **Runtime Security**
   - Container image scanning
   - Runtime threat detection
   - Network policies

4. **Data Protection**
   - Encryption at rest and in transit
   - PII redaction in logs
   - tmpfs for temporary data

### Compliance Controls

- **PII Handling**: Automated detection and redaction
- **Audit Logging**: Immutable audit trail
- **Access Reviews**: Quarterly access audits
- **Brand Compliance**: Enforced color palettes and asset usage

## Scalability Considerations

### Horizontal Scaling

- **n8n Pods**: Auto-scaling based on CPU/memory
- **Database**: Read replicas for query distribution
- **Redis**: Cluster mode for distributed caching

### Performance Targets

- **Response Time**: P95 < 2 seconds
- **Availability**: 99.9% uptime SLA
- **Throughput**: 1000 workflows/minute
- **Concurrent Users**: 500 n8n editor sessions

## Disaster Recovery

### Backup Strategy

- **Database**: Daily automated backups to S3
- **Configurations**: GitOps repository
- **Secrets**: Vault snapshots

### Recovery Targets

- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 1 hour

## Cost Optimization

1. **Resource Rightsizing**: Regular review of pod resources
2. **Spot Instances**: For non-critical workloads
3. **Scheduled Scaling**: Reduce dev/staging resources off-hours
4. **Storage Tiering**: Archive old logs to cheaper storage

## Future Enhancements

1. **Multi-Region Deployment**: For global availability
2. **AI/ML Integration**: Enhanced trend analysis
3. **Advanced Brand Controls**: AI-powered brand compliance
4. **Zero-Trust Architecture**: Enhanced security model
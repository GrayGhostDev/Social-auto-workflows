# n8n Quick Reference Guide

Quick access to critical n8n configuration and operational information for the GrayGhostAI platform.

## 🚀 Essential Environment Variables

### Production Configuration
```bash
# Database
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=postgres-primary.grayghostai
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=n8n
DB_POSTGRESDB_PASSWORD=${SECRET}

# Queue Mode (Required for scaling)
EXECUTIONS_MODE=queue
QUEUE_BULL_REDIS_HOST=redis-cluster.grayghostai
QUEUE_BULL_REDIS_PORT=6379
QUEUE_BULL_REDIS_PASSWORD=${SECRET}
QUEUE_HEALTH_CHECK_ACTIVE=true
QUEUE_HEALTH_CHECK_PORT=5679

# Security
N8N_ENCRYPTION_KEY=${SECRET}
N8N_BLOCK_ENV_ACCESS_IN_NODE=true
N8N_BLOCK_FILE_ACCESS_TO_N8N_FILES=true
N8N_PAYLOAD_SIZE_MAX=20

# Performance
N8N_CONCURRENCY_PRODUCTION_LIMIT=10
QUEUE_WORKER_TIMEOUT=300

# Data Retention
EXECUTIONS_DATA_PRUNE=true
EXECUTIONS_DATA_MAX_AGE=168  # 7 days

# Privacy
N8N_VERSION_NOTIFICATIONS_ENABLED=false
N8N_DIAGNOSTICS_ENABLED=false
```

## 🔧 Common Operations

### Check Queue Status
```bash
# Get queue length
kubectl exec -n grayghostai redis-cluster-0 -- redis-cli LLEN bull:n8n-jobs:wait

# Monitor active jobs
kubectl exec -n grayghostai redis-cluster-0 -- redis-cli ZCARD bull:n8n-jobs:active

# Check failed jobs
kubectl exec -n grayghostai redis-cluster-0 -- redis-cli ZCARD bull:n8n-jobs:failed
```

### Export/Import Workflows
```bash
# Export all workflows
kubectl exec -n grayghostai deployment/n8n -- n8n export:workflow --all --output=/tmp/workflows.json
kubectl cp grayghostai/n8n-xxx:/tmp/workflows.json ./workflows-backup.json

# Import workflows
kubectl cp ./workflows.json grayghostai/n8n-xxx:/tmp/workflows.json
kubectl exec -n grayghostai deployment/n8n -- n8n import:workflow --input=/tmp/workflows.json
```

### Manual Execution Pruning
```bash
# Prune executions older than 7 days
kubectl exec -n grayghostai deployment/n8n -- n8n executiondata:prune --delete --days=7

# Dry run first
kubectl exec -n grayghostai deployment/n8n -- n8n executiondata:prune --days=7
```

## 🚨 Troubleshooting

### Worker Not Processing Jobs
```bash
# Check worker health
curl http://n8n-worker:5679/healthz

# Restart workers
kubectl rollout restart deployment/n8n-worker -n grayghostai

# Check Redis connectivity
kubectl exec -n grayghostai deployment/n8n-worker -- redis-cli -h redis-cluster.grayghostai ping
```

### High Memory Usage
```bash
# Check execution data size
kubectl exec -n grayghostai deployment/n8n -- psql $DATABASE_URL -c "
SELECT 
  pg_size_pretty(pg_total_relation_size('execution_entity')) as execution_size,
  COUNT(*) as execution_count
FROM execution_entity;"

# Force garbage collection
kubectl exec -n grayghostai deployment/n8n -- kill -USR1 1
```

### Webhook Issues
```bash
# Test webhook endpoint
curl -X POST https://n8n.grayghostai.com/webhook/test-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Check webhook URL in workflow
kubectl exec -n grayghostai deployment/n8n -- n8n webhook:list
```

## 📊 Monitoring Queries

### Prometheus Metrics
```promql
# Execution rate
rate(n8n_executions_total[5m])

# Queue depth
n8n_queue_jobs_waiting

# Worker utilization
n8n_worker_jobs_active / n8n_worker_concurrency_limit

# Error rate
rate(n8n_executions_failed_total[5m]) / rate(n8n_executions_total[5m])
```

### Grafana Dashboard IDs
- System Overview: `n8n-system-001`
- Queue Performance: `n8n-queue-002`
- Workflow Analytics: `n8n-workflow-003`
- Error Tracking: `n8n-errors-004`

## 🔒 Security Checklist

- [ ] `N8N_BLOCK_ENV_ACCESS_IN_NODE=true` - Prevents code nodes from accessing env vars
- [ ] `N8N_BLOCK_FILE_ACCESS_TO_N8N_FILES=true` - Restricts file system access
- [ ] OAuth2 proxy configured at ingress level
- [ ] Network policies restrict egress to approved endpoints
- [ ] Webhook URLs use authentication
- [ ] Execution data pruned regularly
- [ ] Audit logs sent to Loki with PII redaction

## 🚀 Performance Tuning

### Scaling Formula
```
Workers = ceil(peak_executions_per_minute / 10)
Redis Memory = executions_per_day * 10KB
DB Connections = (workers * 5) + 10
```

### Recommended Resources
| Component | CPU | Memory | Storage |
|-----------|-----|---------|---------|
| n8n Main | 2 | 4Gi | - |
| n8n Worker | 1 | 2Gi | - |
| PostgreSQL | 4 | 8Gi | 100Gi |
| Redis | 2 | 4Gi | - |

## 🔄 Upgrade Checklist

1. **Backup**
   ```bash
   ./scripts/backup-n8n.sh
   ```

2. **Check Compatibility**
   - n8n version → Node.js version
   - n8n version → PostgreSQL version
   - Review breaking changes

3. **Test in Staging**
   ```bash
   kubectl set image deployment/n8n n8n=n8nio/n8n:NEW_VERSION -n staging
   ```

4. **Monitor After Upgrade**
   - Check error logs
   - Verify queue processing
   - Test critical workflows

## 📞 Support Contacts

- **Platform Team**: #platform-support (Slack)
- **Security Issues**: security@grayghostai.com
- **n8n Community**: https://community.n8n.io
- **Vendor Support**: License includes email support

---

*Last Updated: 2024-01-17 | n8n Version: 1.19.0*
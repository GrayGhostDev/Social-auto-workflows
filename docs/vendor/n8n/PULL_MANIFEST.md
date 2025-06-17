# n8n Documentation Pull Manifest

This manifest defines the critical n8n documentation pages required for offline access by engineering, security, and audit teams.

## 1. Hosting & Installation ("Day-0 build")

| Critical Page | Why You Need It | Source URL |
|--------------|-----------------|------------|
| Choose your n8n (cloud vs self-host) | Confirms license terms, feature gaps and support boundaries before procurement | https://docs.n8n.io/hosting/ |
| Docker Compose example | Canonical compose snippets for initial deployment | https://docs.n8n.io/hosting/installation/docker-compose/ |
| Kubernetes Helm chart | Helm values and deployment patterns | https://docs.n8n.io/hosting/installation/kubernetes/ |
| Updating self-hosted n8n | Update matrix (n8n, Node.js, PostgreSQL versions) | https://docs.n8n.io/hosting/updating/ |
| Configuration methods | Explains precedence rules between env-vars, config-files and DB flags | https://docs.n8n.io/hosting/configuration/configuration-methods/ |
| Environment variables - Overview | Single authoritative list to mirror in infra/helm/values.yaml | https://docs.n8n.io/hosting/configuration/environment-variables/ |
| Environment variables - Deployment | Deployment-specific variables | https://docs.n8n.io/hosting/configuration/environment-variables/deployment/ |

## 2. Scaling & Queue Mode ("Day-1 growth")

| Page | Why Pull It Now | Source URL |
|------|-----------------|------------|
| Scaling Overview | High-level decision tree (execution-mode vs workforce size) | https://docs.n8n.io/hosting/scaling/overview/ |
| Queue mode | Worker/primary topology, Redis requirements, failure semantics | https://docs.n8n.io/hosting/scaling/queue-mode/ |
| Queue-mode env-vars | Exact var names (N8N_REDIS_HOST, etc.) and defaults | https://docs.n8n.io/hosting/configuration/environment-variables/queue-mode/ |
| Binary data | Memory-vs-filesystem trade-offs; flag conflicts with queue mode | https://docs.n8n.io/hosting/scaling/binary-data/ |
| Task runners | How to off-load cron-style jobs (e.g., execution pruning) | https://docs.n8n.io/hosting/configuration/task-runners/ |

## 3. Security, Privacy & Compliance ("Shift-left controls")

| Page | Content to Highlight | Source URL |
|------|---------------------|------------|
| Privacy & Security overview | n8n's data-handling model; vendor sub-processors; disclosure mailbox | https://docs.n8n.io/privacy-security/ |
| Securing n8n (overview) | SSL, reverse proxy, 2FA, SSO, audit checklist | https://docs.n8n.io/hosting/securing/ |
| What you can do | Hardening tips; telemetry opt-out; vulnerability reporting process | https://docs.n8n.io/privacy-security/what-you-can-do/ |

## 4. Operations & Maintenance ("Run-book inputs")

| Section | Purpose | Parent URL |
|---------|---------|------------|
| Execution data & pruning | Retention knobs for PostgreSQL | https://docs.n8n.io/hosting/scaling/execution-data/ |
| Monitoring & Logging | Endpoints for Prometheus/Loki integration | https://docs.n8n.io/hosting/monitoring/ |
| Backup & Restore | Database dump strategy, encryption notes | https://docs.n8n.io/hosting/backup-restore/ |
| Troubleshooting & FAQ | Common 502/503 causes, worker registration issues | https://docs.n8n.io/hosting/troubleshooting/ |

## 5. Developer Reference ("Low-code meets GitOps")

| Resource | Use Case | Source URL |
|----------|----------|------------|
| Node development guide | Required for custom LMS connectors | https://docs.n8n.io/integrations/creating-nodes/ |
| Credential development | Custom auth mechanisms | https://docs.n8n.io/integrations/creating-nodes/credentials/ |
| CLI reference | n8n export:workflow, n8n import:credentials for CI | https://docs.n8n.io/cli-commands/ |
| REST API reference | Automation of Notion sync jobs | https://docs.n8n.io/api/ |

## Archiving Instructions

1. **Automated Pull**:
   ```bash
   ./scripts/pull-n8n-docs.sh
   ```

2. **Manual Pull**:
   ```bash
   npx wget -mk --no-parent \
     --directory-prefix=docs/vendor/n8n/$(date +%Y-%m) \
     --convert-links \
     --page-requisites \
     https://docs.n8n.io/hosting/ \
     https://docs.n8n.io/privacy-security/ \
     https://docs.n8n.io/integrations/creating-nodes/ \
     https://docs.n8n.io/cli-commands/ \
     https://docs.n8n.io/api/
   ```

3. **Generate Checksums**:
   ```bash
   find docs/vendor/n8n/$(date +%Y-%m) -type f -name "*.html" -exec sha256sum {} \; > docs/vendor/n8n/checksums.txt
   ```

4. **Commit to Repository**:
   ```bash
   git add docs/vendor/n8n/
   git commit -m "docs: Update n8n vendor documentation snapshot $(date +%Y-%m)"
   ```

## Version Compatibility

| n8n Version | Documentation Snapshot | PostgreSQL | Redis | Node.js |
|-------------|----------------------|------------|-------|---------|
| 1.19.0+ | 2024-01 | 11-15 | 6.2+ | 18.x |

## Notes

- Documentation is pulled quarterly or before major version upgrades
- All pages include CSS/JS assets for proper offline rendering
- Search functionality works via browser find or grep
- PDF versions can be generated using wkhtmltopdf if needed
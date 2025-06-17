# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an enterprise-grade social media content creation automation platform built on n8n with brand/PII compliance gates and content operations. The project uses a sophisticated branching strategy and CI/CD pipeline for managing deployments across development, staging, and production environments.

### GrayGhostAI Platform Architecture

The platform implements a 4-layer architecture designed for security, scalability, and strict brand control:

1. **Ingress/Edge Layer**: Load balancing (AWS ALB/GCP LB), WAF with geo-fencing, OAuth2 authentication
2. **Containers & Orchestration Layer**: Kubernetes 1.30+, n8n pods (3 per env), PostgreSQL HA, Redis cluster, Vault sidecars
3. **Shared Services Layer**: Canv-a-tor (brand controls), Trend Miner (FastAPI), Brandwatch Receiver
4. **Observability Layer**: Prometheus, Grafana, Loki (with PII redaction), Sentry

Key architectural decisions:
- TLS 1.3 encryption throughout
- JWT tokens with 60-minute max validity
- 2FA enforcement for n8n editor access
- WAF enforces 20MB upload limit and geo-restrictions
- tmpfs volumes for PII risk mitigation
- Circuit breaker pattern with 5-second fallback
- P95 response time monitoring (< 2 seconds threshold)

## Development Environment

- IDE: IntelliJ IDEA (based on .idea directory and automation.iml file)
- Working Directory: `/Users/grayghostdataconsultants/Social_Media/Content_Creation/automation`
- Node.js: >= 18.x
- Package Manager: npm >= 8.x

## Project Structure

```
social-auto-workflows/
├── .github/              # GitHub Actions workflows and configurations
│   ├── workflows/        # CI/CD pipelines
│   └── CODEOWNERS       # Code ownership definitions
├── docs/                # Documentation and runbooks
│   ├── ARCHITECTURE.md  # System architecture documentation
│   ├── DEPLOYMENT.md    # Deployment guide
│   └── architecture-diagram.md  # Architecture diagrams
├── infra/              # Infrastructure as Code
│   ├── terraform/      # Terraform modules for cloud resources
│   │   └── modules/    # Reusable modules (WAF, etc.)
│   ├── helm/          # Helm charts for Kubernetes deployments
│   └── k8s/           # Kubernetes manifests
│       ├── base/      # Base configurations
│       │   └── monitoring/  # Prometheus, Loki, Grafana configs
│       └── overlays/  # Environment-specific overlays
├── workflows/          # n8n workflow definitions (JSON format)
├── scripts/           # Utility and automation scripts
├── tests/             # Test suites
│   ├── unit/         # Unit tests
│   ├── integration/  # Integration tests
│   └── e2e/         # End-to-end tests
├── config/           # Configuration files
└── package.json     # Node.js dependencies and scripts
```

## Branching Strategy

The repository follows a structured branching model:
- `main` - Production branch (protected, requires 2 approvals)
- `staging` - Pre-production testing branch
- `dev` - Development integration branch
- `feature/*` - New features (merge to dev)
- `fix/*` - Bug fixes (merge to dev)
- `hotfix/*` - Emergency production fixes
- `release/*` - Release candidates

See `docs/BRANCHING.md` for detailed branching rules.

## Development Workflow

1. Create feature branch from `dev`
2. Make changes following coding standards
3. Ensure all tests pass: `npm test`
4. Run linting: `npm run lint`
5. Submit PR to `dev` branch
6. After review and CI checks, merge to `dev`

## Key Commands

```bash
# Install dependencies
npm install

# Run tests
npm test                    # All tests
npm run test:integration   # Integration tests only
npm run test:e2e:staging  # E2E tests against staging

# Linting and formatting
npm run lint              # Check code style
npm run lint:fix         # Auto-fix issues

# Type checking
npm run typecheck        # TypeScript validation

# Local development
npm run dev             # Start development server

# Security
npm audit              # Check for vulnerabilities
npm audit fix         # Auto-fix vulnerabilities
```

## CI/CD Pipeline

GitHub Actions workflows handle automated testing and deployment:
- **CI Pipeline**: Runs on all PRs (linting, tests, security scans)
- **Deploy Dev**: Auto-deploys to development on push to `dev`
- **Deploy Staging**: Auto-deploys to staging on push to `staging`
- **Deploy Prod**: Deploys to production on push to `main` (with approvals)

## Security Considerations

- All PRs undergo automated security scanning (Snyk)
- PII compliance checks are enforced
- Brand guideline validation for content
- Secrets are managed via GitHub Secrets and Kubernetes secrets
- Commit signing is required for protected branches

## Testing Requirements

- Maintain minimum 80% code coverage
- All new features must include tests
- Integration tests for API endpoints
- E2E tests for critical user journeys

## Important Files

### Documentation
- `docs/ARCHITECTURE.md` - Complete system architecture documentation
- `docs/DEPLOYMENT.md` - Step-by-step deployment guide
- `docs/architecture-diagram.md` - Architecture diagrams (Mermaid format)
- `docs/SECURITY.md` - Security policies and procedures
- `docs/CONTRIBUTING.md` - Contribution guidelines
- `docs/SETUP_GUIDE.md` - Repository setup instructions
- `docs/BRANCHING.md` - Detailed branching strategy

### Infrastructure
- `infra/k8s/base/` - Kubernetes base manifests
  - `namespace.yaml` - Namespace with resource quotas
  - `n8n-deployment.yaml` - n8n workflow engine deployment
  - `postgres-ha.yaml` - PostgreSQL HA cluster
  - `redis-cluster.yaml` - Redis cluster configuration
  - `shared-services.yaml` - Canv-a-tor, Trend Miner, Brandwatch
  - `ingress.yaml` - Ingress with OAuth2 proxy
- `infra/terraform/modules/waf/` - AWS WAF Terraform module
- `infra/k8s/base/monitoring/` - Observability configurations

### Configuration
- `.github/branch-protection-rules.json` - Branch protection configuration
- `.github/CODEOWNERS` - Defines code review requirements

## n8n Workflow Development

When creating n8n workflows:
- Store workflows in `workflows/` directory as JSON files
- Use descriptive filenames (e.g., `social-media-scheduler.json`)
- Parameterize environment-specific values
- Never hardcode credentials or API keys
- Add documentation for complex logic

## Architecture Key Points

### Brand Control
- Brand colors are strictly enforced via environment variables in Canv-a-tor service
- Any off-brand color requests are automatically rejected
- Brand compliance metrics are tracked in Grafana dashboards

### Security & Compliance
- WAF enforces 20MB file upload limit and geo-fencing
- PII is automatically redacted in logs using Promtail pipeline
- All logs are classified and rotated after 7 days
- OAuth2 authentication with 2FA enforcement
- tmpfs volumes prevent PII data residue

### Performance & Reliability
- Circuit breaker pattern prevents cascade failures (5s fallback)
- P95 response time monitored with 2-second threshold alerts
- Resource limits enforced (2 vCPU, 2GB RAM per pod)
- High availability with 3 replicas per environment

### Monitoring
- Execution IDs enable per-flow tracing in Loki
- Prometheus collects metrics every 15 seconds
- Custom dashboards for system, n8n, brand compliance, and security
- Sentry integration for Node.js error tracking

## Notes

- The project uses Claude Code with custom permissions configured in `.claude/settings.local.json`
- Currently allows `find` and `ls` bash commands
- Conventional commits are enforced via commitlint
- Git hooks are managed by Husky for pre-commit checks
- The repository is configured for GitHub Pages documentation
- All infrastructure is defined as code (Terraform for cloud resources, Kubernetes manifests for applications)
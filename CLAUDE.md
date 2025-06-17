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
│   │   ├── ci.yml      # Main CI pipeline
│   │   ├── deploy-*.yml # Environment deployments
│   │   └── sbom-generation.yml # SBOM & compliance
│   └── CODEOWNERS       # Code ownership definitions
├── docs/                # Documentation and runbooks
│   ├── ARCHITECTURE.md  # System architecture documentation
│   ├── DEPLOYMENT.md    # Deployment guide
│   ├── IMPLEMENTATION_SUMMARY.md # Implementation status
│   ├── GAP_ANALYSIS_CORRECTIONS.md # Gap analysis review
│   ├── SLO_SLI_TARGETS.md # Service level objectives
│   └── architecture-diagram.md  # Architecture diagrams
├── infra/              # Infrastructure as Code
│   ├── terraform/      # Terraform modules for cloud resources
│   │   ├── main.tf    # Core infrastructure
│   │   ├── environments/ # Environment configs
│   │   └── modules/    # Reusable modules (WAF, etc.)
│   ├── ansible/       # Configuration management
│   │   └── playbooks/ # CIS hardening playbooks
│   ├── vault/         # Secret management
│   │   └── secret-rotation.hcl # 90-day rotation
│   ├── helm/          # Helm charts for Kubernetes deployments
│   │   └── n8n/       # n8n configuration
│   └── k8s/           # Kubernetes manifests
│       ├── base/      # Base configurations
│       │   ├── monitoring/  # Prometheus, Loki, Grafana
│       │   └── hpa-queue-scaling.yaml # Queue autoscaling
│       └── overlays/  # Environment-specific overlays
├── workflows/          # n8n workflow definitions (JSON format)
│   └── real-time-trend-miner.json # Core workflow
├── scripts/           # Utility and automation scripts
│   ├── deploy-grayghost-ai.sh # Master deployment
│   └── pull-n8n-docs.sh # n8n documentation fetcher
├── n8n-nodes/         # Custom n8n node implementations
│   ├── nodes/         # Node type definitions
│   │   ├── TrendScout/
│   │   ├── ExperimentManager/
│   │   ├── TrendingAudio/
│   │   ├── RetentionPredictor/
│   │   └── MCPTool/   # MCP integration nodes
│   ├── credentials/   # Credential type definitions
│   └── package.json   # n8n node package configuration
├── mcp-bridge/        # MCP Bridge service for n8n
│   ├── src/           # TypeScript source code
│   │   ├── middleware/ # Auth, error handling, metrics
│   │   ├── services/  # MCP server and webhook managers
│   │   └── routes/    # API endpoints
│   ├── Dockerfile     # Production container
│   └── package.json   # Node.js dependencies
├── docker/            # Docker configurations
│   └── n8n/           # n8n Docker setup
│       ├── docker-compose.yml # Complete stack configuration
│       ├── Dockerfile # Custom n8n with GrayGhostAI nodes
│       ├── nginx/     # Reverse proxy configuration
│       ├── scripts/   # Update and maintenance scripts
│       └── Makefile   # Management commands
├── agents/            # AI agent implementations
│   ├── base/          # Base enterprise agent class
│   ├── trend-scout/   # Trend Scout v2 implementation
│   └── experiment-manager/ # A/B testing agent
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

# Docker operations (from docker/n8n/)
make up                  # Start n8n stack
make down                # Stop n8n stack
make logs                # View logs
make backup              # Create backup
make update              # Update n8n
make scale-workers REPLICAS=4  # Scale workers
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
- `docs/AI_AGENT_INSTALLATION_GUIDE.md` - AI agent deployment guide
- `docs/N8N_NODES_INSTALLATION_GUIDE.md` - n8n custom nodes installation
- `docs/MCP_N8N_INTEGRATION.md` - MCP integration guide for n8n
- `docs/vendor/n8n/` - Offline n8n documentation archive

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
- `infra/k8s/base/mcp-bridge-deployment.yaml` - MCP Bridge Kubernetes deployment
- `docker/n8n/` - Docker Compose configuration for n8n
  - `docker-compose.yml` - Full stack with PostgreSQL, Redis, n8n, workers
  - `nginx/` - Reverse proxy with TLS and rate limiting
  - `scripts/update-n8n.sh` - Zero-downtime update script
  - `Makefile` - Management commands for Docker operations

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

### Docker Deployment

The project includes a production-ready Docker configuration:

```bash
# Quick start
cd docker/n8n
make init      # Initialize environment
make build     # Build custom n8n image
make up        # Start all services
make status    # Check service health
```

Key features:
- **High Availability**: Multiple n8n workers with queue mode
- **Security**: TLS, authentication, rate limiting via Nginx
- **Custom Nodes**: Pre-installed GrayGhostAI and MCP nodes
- **Zero-Downtime Updates**: Rolling update support
- **Monitoring**: Health checks and Prometheus metrics
- **Backup/Restore**: Automated backup functionality

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

## Implementation Status

### ✅ Completed Features (Week 1)
- **Queue-based autoscaling**: HPA scaling based on Redis queue length and P95 latency
- **Vault secret rotation**: 90-day automatic rotation for all secrets
- **SLO/SLI documentation**: Complete with error budgets and alerting
- **SBOM generation**: Automated supply chain security with Cosign signing

### ✅ Completed Features (Week 2)
- **AI Agent Architecture**: Enterprise-grade agents following Anthropic best practices
- **Viral Optimization**: 19 features for content virality (A/B testing, trending audio, ML retention)
- **n8n AI Integration**: Advanced AI workflows with Claude integration
- **Comprehensive Monitoring**: Prometheus metrics, Grafana dashboards, and alerts

### ✅ Completed Features (Week 3)
- **MCP Integration**: Model Context Protocol support for n8n workflows
- **MCP Bridge Service**: Microservice bridging n8n and MCP servers
- **Dynamic Tool Discovery**: Auto-discover tools from MCP servers
- **Event-Driven Architecture**: Webhook triggers for MCP events
- **Docker Configuration**: Production-ready n8n Docker setup with:
  - PostgreSQL HA and Redis cluster for queue management
  - Zero-downtime update capability
  - Custom n8n image with pre-installed GrayGhostAI nodes
  - Nginx reverse proxy with TLS and rate limiting
  - Comprehensive backup and restore functionality

### 🚧 Pending Implementation
1. **Cross-region database failover**: Aurora Global Database setup needed for 99.9% SLA
2. **Runtime security (Falco)**: Container runtime monitoring and threat detection
3. **Field-level PII encryption**: Transit encryption keys exist but need workflow integration
4. **Advanced FinOps dashboard**: Cloud cost exporters and budget alerts required
5. **GitHub OIDC**: Replace static AWS credentials with OIDC provider

## AI Agent Architecture

The platform now includes enterprise AI agents following Anthropic best practices:

### Core Agents
1. **Trend Scout v2**: Discovers and analyzes trending content opportunities
2. **Experiment Manager**: A/B testing with statistical analysis
3. **Trending Audio**: Audio trend discovery with rights verification
4. **Retention Predictor**: ML-based video completion prediction
5. **Content Strategist**: Brand-aligned content strategy
6. **Visual Composer**: Enhanced with cover frame selection
7. **Hook Crafter**: Dynamic hashtag and CTA generation

### Key Features
- **Structured Prompting**: XML-tagged prompts for better Claude responses
- **Tool Use**: Agents can use multiple tools for complex tasks
- **Enterprise Integration**: Full n8n workflow compatibility
- **Comprehensive Monitoring**: Metrics, logs, and traces for all agents
- **Retry Logic**: Exponential backoff with circuit breakers
- **Caching**: Redis-based caching for expensive operations

### n8n Integration
All AI agents now have native n8n node types following n8n's built-in patterns:
- **Custom Nodes**: TypeScript implementations with INodeType interface
- **Credential Types**: Secure API key management for each agent
- **Webhook Triggers**: Real-time event handling for agent events
- **Resource/Operation Pattern**: Consistent UI/UX with n8n standards
- **MCP Support**: Execute tools from any MCP-compatible server

### MCP (Model Context Protocol) Integration
The platform includes comprehensive MCP support:
- **MCP Tool Node**: Execute tools from connected MCP servers
- **MCP Tool Trigger**: Event-driven workflows based on MCP events
- **MCP Bridge Service**: Kubernetes-native bridge service
- **Multiple Server Support**: Connect to filesystem, GitHub, database, browser, and custom MCP servers
- **Dynamic Tool Discovery**: Automatically discover available tools
- **Secure Architecture**: JWT authentication, rate limiting, and network policies

See `docs/N8N_NODES_INSTALLATION_GUIDE.md` for n8n node installation.
See `docs/AI_AGENT_INSTALLATION_GUIDE.md` for agent deployment.
See `docs/MCP_N8N_INTEGRATION.md` for MCP integration guide.

## Notes

- The project uses Claude Code with custom permissions configured in `.claude/settings.local.json`
- Currently allows `find` and `ls` bash commands
- Conventional commits are enforced via commitlint
- Git hooks are managed by Husky for pre-commit checks
- The repository is configured for GitHub Pages documentation
- All infrastructure is defined as code (Terraform for cloud resources, Kubernetes manifests for applications)
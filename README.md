# Social Auto Workflows

Enterprise-grade social media automation platform built on n8n with brand/PII compliance gates and content operations.

## Overview

This repository contains the infrastructure, workflows, and automation logic for managing social media content operations at scale with built-in compliance checks for brand guidelines and PII protection.

## Architecture

- **Workflow Engine**: n8n for orchestration
- **Infrastructure**: Terraform + Helm on Kubernetes
- **CI/CD**: GitHub Actions with environment-specific deployments
- **Security**: PII scanning, brand compliance gates, secret management

## Repository Structure

```
social-auto-workflows/
├── .github/              # GitHub Actions workflows
├── docs/                 # Documentation and runbooks
├── infra/               # Infrastructure as Code
│   ├── terraform/       # Terraform modules
│   └── helm/           # Helm charts
├── workflows/           # n8n workflow definitions
├── scripts/            # Utility scripts
├── tests/              # Test suites
└── config/             # Configuration files
```

## Branching Strategy

See [BRANCHING.md](./docs/BRANCHING.md) for detailed branching model.

### Quick Reference

- `main` - Production (protected)
- `staging` - Staging environment
- `dev` - Development integration
- `feature/*` - New features
- `fix/*` - Bug fixes
- `hotfix/*` - Emergency patches
- `release/*` - Release candidates

## Getting Started

### Prerequisites

- Node.js >= 18.x
- Docker & Docker Compose
- Terraform >= 1.5
- Helm >= 3.x
- kubectl configured for target cluster

### Local Development

```bash
# Clone repository
git clone https://github.com/GrayGhostDev/Social-auto-workflows.git
cd social-auto-workflows

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start local n8n instance
docker-compose up -d

# Run tests
npm test
```

## Deployment

Deployments are automated via GitHub Actions based on branch:

- Push to `dev` → Deploy to development
- Push to `staging` → Deploy to staging
- Push to `main` → Deploy to production

See [deployment guide](./docs/DEPLOYMENT.md) for manual deployment steps.

## Security & Compliance

- All workflows undergo PII scanning before deployment
- Brand compliance checks run on content generation
- Secrets managed via Kubernetes secrets and GitHub secrets
- See [SECURITY.md](./docs/SECURITY.md) for security policies

## Contributing

1. Create feature branch from `dev`
2. Make changes following coding standards
3. Submit PR with tests passing
4. Obtain review approval
5. Merge to `dev` for integration

See [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for detailed guidelines.

## License

Proprietary - See LICENSE file

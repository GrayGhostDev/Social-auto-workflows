# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an enterprise-grade social media content creation automation platform built on n8n with brand/PII compliance gates and content operations. The project uses a sophisticated branching strategy and CI/CD pipeline for managing deployments across development, staging, and production environments.

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
├── infra/              # Infrastructure as Code
│   ├── terraform/      # Terraform modules for cloud resources
│   └── helm/          # Helm charts for Kubernetes deployments
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

- `.github/branch-protection-rules.json` - Branch protection configuration
- `.github/CODEOWNERS` - Defines code review requirements
- `docs/SECURITY.md` - Security policies and procedures
- `docs/CONTRIBUTING.md` - Contribution guidelines
- `docs/SETUP_GUIDE.md` - Repository setup instructions

## n8n Workflow Development

When creating n8n workflows:
- Store workflows in `workflows/` directory as JSON files
- Use descriptive filenames (e.g., `social-media-scheduler.json`)
- Parameterize environment-specific values
- Never hardcode credentials or API keys
- Add documentation for complex logic

## Notes

- The project uses Claude Code with custom permissions configured in `.claude/settings.local.json`
- Currently allows `find` and `ls` bash commands
- Conventional commits are enforced via commitlint
- Git hooks are managed by Husky for pre-commit checks
- The repository is configured for GitHub Pages documentation
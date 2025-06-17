# Contributing to Social Auto Workflows

Thank you for your interest in contributing! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Submitting Changes](#submitting-changes)
- [Review Process](#review-process)

## Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please read and follow our Code of Conduct.

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- Docker and Docker Compose
- Git with GPG signing configured
- Access to development Kubernetes cluster

### Setup

1. Fork and clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/Social-auto-workflows.git
cd Social-auto-workflows
```

2. Install dependencies:
```bash
npm install
```

3. Set up your environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Configure Git hooks:
```bash
npm run prepare
```

5. Run tests to verify setup:
```bash
npm test
```

## Development Process

### 1. Create a Feature Branch

Always branch from `dev`:

```bash
git checkout dev
git pull origin dev
git checkout -b feature/JIRA-123-descriptive-name
```

Branch naming conventions:
- `feature/TICKET-description` - New features
- `fix/TICKET-description` - Bug fixes
- `chore/description` - Maintenance tasks
- `docs/description` - Documentation only

### 2. Make Your Changes

Follow these guidelines:
- Write clear, self-documenting code
- Add tests for new functionality
- Update documentation as needed
- Ensure no hardcoded secrets or credentials

### 3. Commit Your Changes

We use conventional commits:

```bash
git add .
git commit -m "feat(workflows): add social media trend analysis"
```

Commit format:
```
type(scope): subject

body (optional)

footer (optional)
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Maintenance tasks
- `security`: Security improvements

### 4. Keep Your Branch Updated

Regularly sync with `dev`:

```bash
git checkout dev
git pull origin dev
git checkout feature/your-branch
git rebase dev
```

## Coding Standards

### JavaScript/TypeScript

- Use TypeScript for new code
- Follow ESLint configuration
- Use async/await over promises
- Document complex functions

Example:
```typescript
/**
 * Analyzes social media trends for given keywords
 * @param keywords - Array of keywords to analyze
 * @param options - Analysis options
 * @returns Trend analysis results
 */
async function analyzeTrends(
  keywords: string[],
  options: AnalysisOptions
): Promise<TrendResults> {
  // Implementation
}
```

### n8n Workflows

- Use descriptive node names
- Add notes for complex logic
- Parameterize environment-specific values
- Never hardcode credentials

### Infrastructure Code

- Follow Terraform best practices
- Use consistent naming conventions
- Pin module versions
- Document all variables

## Testing Requirements

### Unit Tests

All new code must have tests:

```bash
npm test
```

Coverage requirements:
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

### Integration Tests

For API endpoints and workflow logic:

```bash
npm run test:integration
```

### E2E Tests

For critical user journeys:

```bash
npm run test:e2e:staging
```

### Security Testing

All PRs undergo:
- Snyk vulnerability scanning
- PII compliance checks
- Secret scanning

## Submitting Changes

### 1. Run Pre-submission Checks

```bash
npm run lint
npm run typecheck
npm test
```

### 2. Create Pull Request

- Target the `dev` branch
- Use PR template
- Link related issues
- Add appropriate labels

PR title format:
```
feat(JIRA-123): Add social media trend analysis
```

### 3. PR Description

Include:
- What changes were made
- Why changes were needed
- How to test changes
- Screenshots (if UI changes)

## Review Process

### Review Checklist

Reviewers will check:
- [ ] Code follows style guidelines
- [ ] Tests pass and coverage maintained
- [ ] Documentation updated
- [ ] No security vulnerabilities
- [ ] No hardcoded secrets
- [ ] PR targets correct branch

### Review Timeline

- Initial review: Within 2 business days
- Follow-up reviews: Within 1 business day
- Hotfixes: Within 4 hours

### Merge Requirements

- All CI checks passing
- Required approvals obtained
- Conversations resolved
- Branch up to date with target

## Additional Resources

### Documentation

- [Architecture Guide](./ARCHITECTURE.md)
- [API Documentation](./API.md)
- [Deployment Guide](./DEPLOYMENT.md)

### Getting Help

- Create an issue for bugs
- Start a discussion for features
- Contact team in Slack: #social-auto-dev

### Development Tools

Recommended VSCode extensions:
- ESLint
- Prettier
- GitLens
- Docker
- Kubernetes

### Debugging

For n8n workflow debugging:
```bash
# Run n8n in debug mode
N8N_LOG_LEVEL=debug npm run dev
```

For application debugging:
```bash
# Enable debug logging
DEBUG=social-auto:* npm run dev
```

## Recognition

Contributors are recognized in:
- Release notes
- Contributors file
- Annual contributor spotlight

Thank you for contributing to Social Auto Workflows!
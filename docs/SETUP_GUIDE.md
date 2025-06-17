# GitHub Repository Setup Guide

This guide walks you through the remaining setup steps for the Social Auto Workflows repository.

## ✅ Completed Tasks

1. **Security Vulnerability Fixed**
   - Updated Cypress from v12 to v13.6.6
   - Resolved the moderate severity vulnerability
   - All dependencies are now secure

## 📋 Remaining Setup Tasks

### 1. Configure Branch Protection Rules

You need to manually apply branch protection rules in GitHub. Here's how:

#### Via GitHub UI:
1. Go to: https://github.com/GrayGhostDev/Social-auto-workflows/settings/branches
2. Click "Add rule" for each branch

#### For `main` branch:
- **Branch name pattern**: `main`
- ✅ Require a pull request before merging
  - Required approvals: 2
  - ✅ Dismiss stale pull request approvals
  - ✅ Require review from CODEOWNERS
- ✅ Require status checks to pass
  - ✅ Require branches to be up to date
  - Status checks:
    - CI Pipeline / Lint Code
    - CI Pipeline / Run Tests
    - CI Pipeline / Security Scanning
    - CI Pipeline / Build Application
- ✅ Require conversation resolution
- ✅ Require signed commits
- ✅ Include administrators
- ✅ Restrict who can push (add `release-managers` team)

#### For `staging` branch:
- **Branch name pattern**: `staging`
- ✅ Require a pull request before merging
  - Required approvals: 1
  - ✅ Dismiss stale pull request approvals
- ✅ Require status checks to pass
- ✅ Require signed commits

#### For `dev` branch:
- **Branch name pattern**: `dev`
- ✅ Require a pull request before merging
  - Required approvals: 1
- ✅ Require status checks to pass (but not strict)
- ✅ Require signed commits

### 2. Set Up GitHub Secrets

Go to: https://github.com/GrayGhostDev/Social-auto-workflows/settings/secrets/actions

Add these repository secrets:

| Secret Name | Description | How to Get |
|------------|-------------|------------|
| `AWS_ACCESS_KEY_ID` | AWS IAM access key | AWS Console → IAM → Users → Security credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key | Same as above |
| `SNYK_TOKEN` | Snyk authentication token | https://app.snyk.io/account |
| `SLACK_WEBHOOK` | Slack incoming webhook URL | https://api.slack.com/messaging/webhooks |

#### Optional Secrets:
- `DOCKER_HUB_USERNAME` - For pushing Docker images
- `DOCKER_HUB_TOKEN` - Docker Hub access token
- `SONAR_TOKEN` - SonarQube/SonarCloud token
- `NPM_TOKEN` - For publishing to npm registry

### 3. Create GitHub Teams

If you have organization admin access:

1. Go to: https://github.com/orgs/GrayGhostDev/teams
2. Create these teams:

| Team Name | Description | Repository Permission |
|-----------|-------------|---------------------|
| `engineering-team` | All developers | Write |
| `devops-team` | Infrastructure and CI/CD | Admin |
| `security-team` | Security reviews | Write |
| `content-team` | Content and workflow reviews | Write |
| `qa-team` | Quality assurance | Write |
| `release-managers` | Production release approval | Admin |
| `sre-team` | Site reliability engineers | Admin |
| `technical-writers` | Documentation team | Write |

### 4. Enable Required GitHub Features

1. **Enable GitHub Pages** (for documentation):
   - Settings → Pages
   - Source: Deploy from a branch
   - Branch: `docs` / `root`

2. **Enable Dependabot**:
   - Settings → Security & analysis
   - Enable Dependabot alerts
   - Enable Dependabot security updates

3. **Configure Environments**:
   - Settings → Environments
   - Create: `development`, `staging`, `production`
   - Add protection rules and secrets per environment

### 5. Local Development Setup

```bash
# 1. Clone the repository (if not already done)
git clone https://github.com/GrayGhostDev/Social-auto-workflows.git
cd Social-auto-workflows

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env with your configuration

# 4. Set up Git commit signing (recommended)
git config --global user.signingkey YOUR_GPG_KEY_ID
git config --global commit.gpgsign true

# 5. Run tests to verify setup
npm test

# 6. Start local development
npm run dev
```

## 🚀 Quick Commands

### Using GitHub CLI

If you have `gh` CLI installed, you can use these commands:

```bash
# Add secrets
gh secret set AWS_ACCESS_KEY_ID --body "your-key-id"
gh secret set AWS_SECRET_ACCESS_KEY --body "your-secret"
gh secret set SNYK_TOKEN --body "your-snyk-token"
gh secret set SLACK_WEBHOOK --body "https://hooks.slack.com/..."

# Create branch protection (requires appropriate permissions)
./scripts/setup-github.sh
```

### Verify Setup

Run these checks to ensure everything is configured:

```bash
# Check branch protection
gh api repos/GrayGhostDev/Social-auto-workflows/branches/main/protection

# List secrets (names only, not values)
gh secret list

# Check workflow runs
gh run list

# Verify team access
gh api repos/GrayGhostDev/Social-auto-workflows/teams
```

## 📝 Next Steps

After completing the setup:

1. Create your first feature branch:
   ```bash
   git checkout dev
   git checkout -b feature/initial-workflow
   ```

2. Add your first n8n workflow to the `workflows/` directory

3. Create a pull request to `dev` branch

4. Once tested in dev, promote to staging, then production

## 🆘 Troubleshooting

### Common Issues:

1. **"Permission denied" errors**:
   - Ensure you have the correct repository permissions
   - Check if you're a member of the required teams

2. **CI/CD failures**:
   - Verify all secrets are set correctly
   - Check if branch protection rules match CI job names

3. **Can't create teams**:
   - You need organization owner permissions
   - Ask your GitHub org admin to create them

## 📚 Resources

- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
- [GitHub Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GitHub Teams](https://docs.github.com/en/organizations/organizing-members-into-teams)
- [n8n Documentation](https://docs.n8n.io/)

---

For questions or issues, create an issue in the repository or contact the DevOps team.
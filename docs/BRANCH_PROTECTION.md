# Branch Protection Configuration

This document explains how to configure branch protection rules for the social-auto-workflows repository.

## Overview

Branch protection rules enforce workflows and requirements before changes can be merged, ensuring code quality, security, and compliance.

## Protection Rules by Branch

### Main Branch (Production)

**Highest protection level** - All production code must meet these requirements:

- **Required Reviews**: 2 approvals from code owners
- **Required Checks**: All CI pipeline stages must pass
- **Signed Commits**: All commits must be GPG signed
- **No Force Pushes**: History is immutable
- **Admin Enforcement**: Even admins must follow rules
- **Conversation Resolution**: All PR comments must be resolved

### Staging Branch

**Pre-production validation** - Balanced protection for staging environment:

- **Required Reviews**: 1 approval required
- **Required Checks**: CI + pre-deployment validation
- **Signed Commits**: Required for audit trail
- **Stale Review Dismissal**: Old reviews dismissed on new pushes

### Dev Branch

**Integration branch** - More flexible for rapid development:

- **Required Reviews**: 1 approval
- **Required Checks**: Linting and tests only
- **Less Strict**: No strict status check requirement

### Release Branches (release/*)

**Release candidate protection** - Similar to main branch:

- **Required Reviews**: 2 approvals from release managers
- **Team Restrictions**: Only release managers can merge
- **Full CI Requirements**: All checks must pass
- **Conversation Resolution**: All discussions resolved

### Hotfix Branches (hotfix/*)

**Emergency patch workflow** - Expedited but secure:

- **Required Reviews**: 1 approval from SRE/Security
- **Minimal Checks**: Security scanning only
- **Team Restrictions**: SRE and Security teams only
- **Fast-track**: Reduced requirements for emergencies

### Infrastructure Branches (infra/*)

**IaC protection** - Specialized for infrastructure code:

- **Required Reviews**: 1 approval from DevOps team
- **Specific Checks**: Terraform/Helm validation
- **Team Restrictions**: DevOps team only
- **Code Owner Reviews**: Required for critical modules

## Setting Up Branch Protection

### Via GitHub UI

1. Navigate to Settings → Branches
2. Add rule for each branch pattern
3. Configure settings according to `.github/branch-protection-rules.json`

### Via GitHub API

```bash
# Script to apply all branch protection rules
./scripts/apply-branch-protection.sh
```

### Via Terraform

```hcl
# Example terraform configuration
resource "github_branch_protection" "main" {
  repository_id = github_repository.social_auto_workflows.node_id
  pattern       = "main"
  
  required_status_checks {
    strict   = true
    contexts = ["CI Pipeline / Lint Code", "CI Pipeline / Run Tests"]
  }
  
  required_pull_request_reviews {
    required_approving_review_count = 2
    dismiss_stale_reviews          = true
    require_code_owner_reviews     = true
  }
  
  enforce_admins         = true
  require_signed_commits = true
}
```

## Required Status Checks

### CI Pipeline Checks

- **Lint Code**: Code style and quality checks
- **Run Tests**: Unit and integration tests
- **Security Scanning**: Snyk and PII compliance
- **Build Application**: Successful build verification

### Deployment Checks

- **Pre-deployment Validation**: Staging/Prod specific checks
- **Terraform Validate**: Infrastructure code validation
- **Helm Validate**: Chart linting and validation

## Team Configuration

### Required Teams

Create these teams in your GitHub organization:

- **release-managers**: Can merge to main and create releases
- **sre-team**: Can create and merge hotfixes
- **security-team**: Security patch approvals
- **devops-team**: Infrastructure code approvals

### CODEOWNERS File

Create `.github/CODEOWNERS`:

```
# Global owners
* @org/engineering-team

# Infrastructure
/infra/ @org/devops-team
/terraform/ @org/devops-team
/.github/workflows/ @org/devops-team

# Documentation
/docs/ @org/technical-writers
*.md @org/technical-writers

# Security-sensitive files
**/secrets.* @org/security-team
**/credentials.* @org/security-team
```

## Bypass Scenarios

### Emergency Hotfix Process

1. Create hotfix branch from main
2. Make minimal required changes
3. Get approval from SRE/Security team member
4. Merge with expedited checks
5. Backport to staging and dev

### Admin Override

Only use in extreme emergencies:

```bash
# Temporarily disable admin enforcement
gh api /repos/org/repo/branches/main/protection \
  --method PATCH \
  --field enforce_admins=false

# Make emergency change

# Re-enable immediately
gh api /repos/org/repo/branches/main/protection \
  --method PATCH \
  --field enforce_admins=true
```

## Monitoring and Compliance

### Audit Requirements

- All protection rule changes are logged
- Regular reviews of bypass usage
- Monthly audit of team memberships
- Quarterly review of protection rules

### Automation

GitHub Actions monitor protection compliance:

```yaml
# .github/workflows/protection-audit.yml
- name: Audit branch protection
  run: |
    ./scripts/audit-branch-protection.sh
    ./scripts/verify-codeowners.sh
```

## Troubleshooting

### Common Issues

1. **"Required status checks not found"**
   - Ensure CI workflow names match exactly
   - Checks must run at least once before being available

2. **"Push rejected - signing required"**
   - Configure GPG signing: `git config commit.gpgsign true`
   - See [GitHub GPG guide](https://docs.github.com/en/authentication/managing-commit-signature-verification)

3. **"Reviews dismissed after push"**
   - This is intentional - reviewers must re-approve after changes

### Getting Help

- Check protection status: `gh api /repos/org/repo/branches/BRANCH/protection`
- Contact DevOps team for infrastructure branches
- Contact Security team for compliance questions
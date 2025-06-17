# Branching Strategy

This document defines the branching model for the social-auto-workflows repository, designed to support n8n deployment, brand/PII gates, and content operations.

## Overview

Our branching strategy separates long-lived "railway tracks" (permanent branches) from short-lived "work trains" (ephemeral topic branches) so that each project stream can move at its own cadence without blocking others.

## Branch Types and Purposes

### Production Line

| Branch | Protection | Environment | Purpose | Merge Source | Actors |
|--------|------------|-------------|---------|--------------|--------|
| `main` | ✓ | Production | Signed-off workflow JSON, Helm charts, Terraform modules matching production | `release/*` or `hotfix/*` via PR | Release Manager |
| `release/X.Y.Z` | ✓ | - | Stabilization for version going live; bug fixes only | Cut from `staging` | Release Mgr + Fix squad |
| `hotfix/X.Y.Z+1` | ✓ | - | Emergency prod patches (critical PII/content bugs, CVEs) | Cut from `main` | SRE/Security lead |

### Integration Line

| Branch | Protection | Environment | Purpose | Merge Source | Actors |
|--------|------------|-------------|---------|--------------|--------|
| `staging` | ✓ | Staging | Candidate code in staging n8n stack | Auto-merge from `dev` | QA team |
| `dev` | ✓ | Development | Rolling integration, feature branches land here | Feature PRs | Automation engineers |

### Environment-Specific Rails

| Branch | Protection | Purpose | Update Process |
|--------|------------|---------|----------------|
| `infra/terraform` | ✓ | IaC modules evolving separately from app code | PR-based, version pinning |
| `infra/helm` | ✓ | Helm releases and configurations | PR-based, version pinning |
| `docs` | ✓ | Markdown runbooks, API docs, compliance checklists | From `docs/*` topic branches |

### Ephemeral Topic Branches

| Pattern | Lifecycle | Purpose | Example |
|---------|-----------|---------|---------|
| `feature/<ticket>-<slug>` | Delete after merge | New functionality | `feature/PLAT-231-trend-miner` |
| `fix/<ticket>-<slug>` | Delete after merge | Non-critical bug fixes | `fix/PLAT-102-rate-limit` |
| `chore/<task>` | Delete after merge | Maintenance tasks | `chore/update-deps` |
| `security/<cve-id>` | Fast-track or delete | CVE mitigations | `security/CVE-2024-1234` |
| `spike/<topic>` | Time-boxed (48h) | Experiments/POCs | `spike/llm-integration` |
| `bot/update-deps` | Weekly auto-merge | Dependency updates | `bot/update-deps` |

## Workflow Rules

### Branch Protection Requirements

Protected branches (`main`, `staging`, `dev`, `release/*`, `hotfix/*`, `infra/*`) require:

- PR review (minimum 1 human approval)
- All CI checks passing:
  - Linting
  - Unit tests
  - Snyk security scan
  - PII compliance scan
- Signed commits (`--signoff`)
- No direct pushes

### Naming Convention

Branch names must follow the patterns above. Enforced via:
- Git hooks (husky + commitlint)
- GitHub branch protection rules
- CI validation

### Auto-Deployment Mapping

GitHub Actions automatically deploy based on branch:

```yaml
# .github/workflows/deploy.yml
- if: github.ref == 'refs/heads/dev'
  uses: ./.github/workflows/deploy-dev.yml

- if: github.ref == 'refs/heads/staging'
  uses: ./.github/workflows/deploy-staging.yml

- if: github.ref == 'refs/heads/main'
  uses: ./.github/workflows/deploy-prod.yml
```

### Tag Strategy

- **Application releases**: `vX.Y.Z` (created from `release/*` → `main` merges)
- **Infrastructure modules**: `infra-vA.B.C` (independent versioning)
- **Workflows**: `workflow-vX.Y.Z` (for n8n workflow versioning)

### Cleanup Policy

- Topic branches auto-deleted on merge
- Stale branches (>90 days inactive) flagged for review
- `spike/*` branches auto-archived after 48 hours

## Phase Mapping

| Project Phase | Primary Branches | Activities |
|---------------|------------------|------------|
| Planning & Preparation | `docs`, `infra/*` | Charter, compliance matrices, IaC setup |
| Solution Design | `dev`, `infra/*` | Prototypes, BPMN diagrams, architecture |
| Build & Integration | `feature/*`, `dev`, `staging` | Feature development, integration, QA |
| Pilot Rollout | `release/*`, `staging` | Code freeze, UAT, final testing |
| Go-Live | `main` + tag | Production deployment via ArgoCD |
| Continuous Improvement | `hotfix/*`, `security/*`, `feature/*` | Patches, security fixes, enhancements |

## Merge Strategy

### Feature Development Flow

```
feature/PLAT-123-new-workflow
    ↓ PR + Review
dev (auto-deploy to dev environment)
    ↓ Automated nightly
staging (auto-deploy to staging)
    ↓ Release cut
release/1.2.0
    ↓ Approval + Tests
main (production deployment)
    ↓ Tag v1.2.0
```

### Hotfix Flow

```
main
    ↓ Branch
hotfix/1.2.1
    ↓ Fix + Test
main (immediate deploy)
    ↓ Backport
staging + dev
```

## Best Practices

1. **Never commit directly** to protected branches
2. **Always use PRs** for code review and audit trail
3. **Sign commits** for compliance tracking
4. **Keep branches focused** - one feature/fix per branch
5. **Update frequently** - rebase feature branches daily from `dev`
6. **Clean up** - delete merged branches promptly
7. **Document changes** - meaningful commit messages and PR descriptions

## Compliance Notes

- All merges to `main` require compliance signoff
- PII scanning runs on every PR
- Brand guideline checks enforced in staging/production
- Audit logs maintained for all production changes
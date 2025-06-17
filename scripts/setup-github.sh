#!/bin/bash

# GitHub Setup Script for Social Auto Workflows
# This script helps configure GitHub repository settings

set -euo pipefail

echo "🚀 GitHub Repository Setup for Social Auto Workflows"
echo "===================================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed.${NC}"
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}Please authenticate with GitHub:${NC}"
    gh auth login
fi

REPO="GrayGhostDev/Social-auto-workflows"

echo -e "\n${BLUE}1. Security Vulnerability Fix${NC}"
echo "================================"
echo -e "${YELLOW}The security vulnerability is likely in one of the npm packages.${NC}"
echo "Let's update the package.json with more specific versions and security fixes:"

# Create updated package.json with security fixes
cat > package.json.security-update << 'EOF'
{
  "name": "social-auto-workflows",
  "version": "1.0.0",
  "description": "Enterprise social media automation platform with n8n workflows",
  "main": "index.js",
  "scripts": {
    "test": "jest --coverage",
    "test:integration": "jest --testPathPattern=tests/integration",
    "test:staging": "jest --testPathPattern=tests/e2e --env=staging",
    "test:production": "jest --testPathPattern=tests/smoke --env=production",
    "test:e2e:staging": "cypress run --env environment=staging",
    "lint": "eslint . --ext .js,.ts,.jsx,.tsx",
    "lint:fix": "eslint . --ext .js,.ts,.jsx,.tsx --fix",
    "build": "tsc && webpack",
    "dev": "nodemon",
    "typecheck": "tsc --noEmit",
    "prepare": "husky install",
    "commitlint": "commitlint --edit",
    "audit": "npm audit",
    "audit:fix": "npm audit fix"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/GrayGhostDev/Social-auto-workflows.git"
  },
  "keywords": [
    "n8n",
    "automation",
    "social-media",
    "workflows"
  ],
  "author": "Gray Ghost Dev",
  "license": "UNLICENSED",
  "bugs": {
    "url": "https://github.com/GrayGhostDev/Social-auto-workflows/issues"
  },
  "homepage": "https://github.com/GrayGhostDev/Social-auto-workflows#readme",
  "devDependencies": {
    "@commitlint/cli": "^18.6.1",
    "@commitlint/config-conventional": "^18.6.1",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.11.24",
    "@typescript-eslint/eslint-plugin": "^7.1.0",
    "@typescript-eslint/parser": "^7.1.0",
    "cypress": "^13.6.6",
    "eslint": "^8.57.0",
    "husky": "^9.0.11",
    "jest": "^29.7.0",
    "nodemon": "^3.1.0",
    "ts-jest": "^29.1.2",
    "typescript": "^5.3.3",
    "webpack": "^5.90.3",
    "webpack-cli": "^5.1.4"
  },
  "dependencies": {
    "axios": "^1.6.7",
    "dotenv": "^16.4.5"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  },
  "overrides": {
    "semver": "^7.5.4",
    "postcss": "^8.4.31",
    "yaml": "^2.3.4"
  }
}
EOF

echo -e "${GREEN}✓ Created updated package.json with security fixes${NC}"
echo -e "${YELLOW}To apply the security fix:${NC}"
echo "  1. Review the changes: diff package.json package.json.security-update"
echo "  2. Apply the update: mv package.json.security-update package.json"
echo "  3. Run: npm install"
echo "  4. Commit and push the changes"

echo -e "\n${BLUE}2. Branch Protection Rules${NC}"
echo "================================"
echo -e "${YELLOW}Setting up branch protection rules...${NC}"

# Function to apply branch protection
apply_branch_protection() {
    local branch=$1
    local settings=$2
    
    echo -e "Configuring protection for branch: ${GREEN}$branch${NC}"
    
    # Note: GitHub CLI doesn't support all protection settings, so we'll generate the commands
    echo -e "${YELLOW}Run this command to set up $branch protection:${NC}"
    
    case $branch in
        "main")
            cat << EOF
gh api repos/$REPO/branches/$branch/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["CI Pipeline / Lint Code","CI Pipeline / Run Tests","CI Pipeline / Security Scanning","CI Pipeline / Build Application"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":2,"dismiss_stale_reviews":true,"require_code_owner_reviews":true}' \
  --field restrictions='{"teams":["release-managers"]}' \
  --field allow_force_pushes=false \
  --field allow_deletions=false \
  --field required_conversation_resolution=true \
  --field required_linear_history=false \
  --field required_signatures=true
EOF
            ;;
        "staging")
            cat << EOF
gh api repos/$REPO/branches/$branch/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["CI Pipeline / Lint Code","CI Pipeline / Run Tests","CI Pipeline / Security Scanning"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field allow_force_pushes=false \
  --field allow_deletions=false \
  --field required_conversation_resolution=true \
  --field required_signatures=true
EOF
            ;;
        "dev")
            cat << EOF
gh api repos/$REPO/branches/$branch/protection \
  --method PUT \
  --field required_status_checks='{"strict":false,"contexts":["CI Pipeline / Lint Code","CI Pipeline / Run Tests"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":false}' \
  --field allow_force_pushes=false \
  --field allow_deletions=false \
  --field required_signatures=true
EOF
            ;;
    esac
    echo ""
}

# Apply protection to main branches
for branch in main staging dev; do
    apply_branch_protection $branch
done

echo -e "\n${BLUE}3. GitHub Secrets Setup${NC}"
echo "================================"
echo -e "${YELLOW}Add the following secrets to your repository:${NC}"
echo "(Go to Settings > Secrets and variables > Actions)"
echo ""
echo "Required secrets:"
echo "  - AWS_ACCESS_KEY_ID"
echo "  - AWS_SECRET_ACCESS_KEY"
echo "  - SNYK_TOKEN"
echo "  - SLACK_WEBHOOK"
echo ""
echo -e "${GREEN}Commands to add secrets via CLI:${NC}"
cat << 'EOF'
# Example commands (replace with your actual values):
gh secret set AWS_ACCESS_KEY_ID --body "your-access-key-id" --repo GrayGhostDev/Social-auto-workflows
gh secret set AWS_SECRET_ACCESS_KEY --body "your-secret-key" --repo GrayGhostDev/Social-auto-workflows
gh secret set SNYK_TOKEN --body "your-snyk-token" --repo GrayGhostDev/Social-auto-workflows
gh secret set SLACK_WEBHOOK --body "your-slack-webhook-url" --repo GrayGhostDev/Social-auto-workflows
EOF

echo -e "\n${BLUE}4. GitHub Teams Creation${NC}"
echo "================================"
echo -e "${YELLOW}Create the following teams in your GitHub organization:${NC}"
echo "(Go to Organization Settings > Teams)"
echo ""
echo "Required teams:"
echo "  - engineering-team (All developers)"
echo "  - devops-team (Infrastructure and CI/CD)"
echo "  - security-team (Security reviews)"
echo "  - content-team (Content and workflow reviews)"
echo "  - qa-team (Quality assurance)"
echo "  - release-managers (Production releases)"
echo "  - sre-team (Site reliability)"
echo "  - technical-writers (Documentation)"
echo ""
echo -e "${GREEN}If you have org admin access, create teams with:${NC}"
cat << 'EOF'
# Example (requires org admin):
gh api orgs/GrayGhostDev/teams \
  --method POST \
  --field name="engineering-team" \
  --field description="All engineering team members" \
  --field privacy="closed"
EOF

echo -e "\n${BLUE}5. Initialize Project Locally${NC}"
echo "================================"
echo -e "${GREEN}Run the initialization script:${NC}"
echo "  ./scripts/init-repo.sh"

echo -e "\n${BLUE}Summary of Manual Steps:${NC}"
echo "========================="
echo "1. ✅ Update package.json for security (see package.json.security-update)"
echo "2. ⚠️  Apply branch protection rules (run the commands above)"
echo "3. ⚠️  Add GitHub secrets via UI or CLI"
echo "4. ⚠️  Create GitHub teams in your organization"
echo "5. ✅ Run ./scripts/init-repo.sh"
echo ""
echo -e "${YELLOW}Note: Some steps require organization owner permissions.${NC}"
echo -e "${YELLOW}If you don't have these permissions, ask your GitHub org admin.${NC}"
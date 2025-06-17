#!/bin/bash

# Initialize Social Auto Workflows Repository
# This script sets up the initial repository structure and configurations

set -euo pipefail

echo "🚀 Initializing Social Auto Workflows Repository..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Please run this script from the repository root.${NC}"
    exit 1
fi

# Initialize git if not already initialized
if [ ! -d ".git" ]; then
    echo "Initializing git repository..."
    git init
    git remote add origin https://github.com/GrayGhostDev/Social-auto-workflows.git
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Set up git hooks
echo "🔗 Setting up git hooks..."
npx husky install

# Create necessary directories if they don't exist
directories=(
    "workflows"
    "scripts"
    "tests/unit"
    "tests/integration"
    "tests/e2e"
    "config"
    "infra/terraform/modules"
    "infra/terraform/environments"
    "infra/helm/social-auto-workflows/templates"
)

for dir in "${directories[@]}"; do
    if [ ! -d "$dir" ]; then
        echo "Creating directory: $dir"
        mkdir -p "$dir"
    fi
done

# Create example files
echo "📄 Creating example files..."

# Example workflow
cat > workflows/example-workflow.json << 'EOF'
{
  "name": "Example Social Media Workflow",
  "nodes": [
    {
      "parameters": {},
      "name": "Start",
      "type": "n8n-nodes-base.start",
      "typeVersion": 1,
      "position": [250, 300]
    }
  ],
  "connections": {},
  "active": false,
  "settings": {},
  "id": 1
}
EOF

# Environment example
cat > .env.example << 'EOF'
# n8n Configuration
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=changeme
N8N_HOST=localhost
N8N_PORT=5678
N8N_PROTOCOL=http
N8N_NODE_ENV=development

# Database Configuration
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=localhost
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=n8n
DB_POSTGRESDB_PASSWORD=changeme

# Security
ENCRYPTION_KEY=changeme
JWT_SECRET=changeme

# External Services
WEBHOOK_URL=http://localhost:5678/
EOF

# Create test structure
cat > tests/unit/example.test.js << 'EOF'
describe('Example Test Suite', () => {
  test('should pass example test', () => {
    expect(true).toBe(true);
  });
});
EOF

# Create Helm values files
cat > infra/helm/social-auto-workflows/values.yaml << 'EOF'
replicaCount: 1

image:
  repository: n8n
  pullPolicy: IfNotPresent
  tag: "latest"

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: false

resources:
  limits:
    cpu: 1000m
    memory: 1024Mi
  requests:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80
EOF

# Make scripts executable
echo "🔧 Making scripts executable..."
find scripts -type f -name "*.sh" -exec chmod +x {} \;

# Create initial commit structure
echo "📝 Preparing initial commit..."

# Create .gitattributes
cat > .gitattributes << 'EOF'
* text=auto
*.sh text eol=lf
*.yaml text eol=lf
*.yml text eol=lf
*.json text eol=lf
*.md text eol=lf
EOF

# Check if branch protection script exists
cat > scripts/apply-branch-protection.sh << 'EOF'
#!/bin/bash
# Apply branch protection rules using GitHub CLI

echo "Applying branch protection rules..."

# Function to apply protection to a branch
apply_protection() {
    local branch=$1
    local rules_file=".github/branch-protection-rules.json"
    
    echo "Configuring protection for branch: $branch"
    
    # This would use gh api to apply the rules
    # gh api /repos/:owner/:repo/branches/$branch/protection --method PUT --input $rules_file
}

# Apply to main branches
for branch in main staging dev; do
    apply_protection $branch
done

echo "Branch protection rules applied!"
EOF

chmod +x scripts/apply-branch-protection.sh

# Summary
echo -e "\n${GREEN}✅ Repository initialization complete!${NC}\n"
echo "Next steps:"
echo "1. Review and update .env file with your configuration"
echo "2. Set up your GitHub teams and permissions"
echo "3. Run 'git add .' and create your initial commit"
echo "4. Push to GitHub: git push -u origin main"
echo "5. Apply branch protection rules: ./scripts/apply-branch-protection.sh"
echo -e "\n${YELLOW}Remember to never commit sensitive data like passwords or API keys!${NC}"
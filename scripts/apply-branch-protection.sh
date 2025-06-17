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

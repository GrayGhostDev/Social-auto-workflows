#!/bin/bash
#
# pull-n8n-docs.sh - Pull n8n documentation for offline access
# 
# This script downloads critical n8n documentation pages as defined in PULL_MANIFEST.md
# for offline access by engineering, security review, and audit teams.
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="$(dirname "$SCRIPT_DIR")"
DATE_DIR="$(date +%Y-%m)"
TARGET_DIR="${DOCS_DIR}/${DATE_DIR}"
CHECKSUM_FILE="${DOCS_DIR}/checksums.txt"
LOG_FILE="${DOCS_DIR}/pull-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${1}" | tee -a "${LOG_FILE}"
}

# Error handling
error_exit() {
    log "${RED}ERROR: $1${NC}" >&2
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "${BLUE}Checking prerequisites...${NC}"
    
    # Check for wget
    if ! command -v wget &> /dev/null; then
        error_exit "wget is required but not installed. Please install wget."
    fi
    
    # Check for sha256sum
    if ! command -v sha256sum &> /dev/null; then
        error_exit "sha256sum is required but not installed."
    fi
    
    log "${GREEN}✓ Prerequisites satisfied${NC}"
}

# Create directory structure
create_directories() {
    log "${BLUE}Creating directory structure...${NC}"
    
    mkdir -p "${TARGET_DIR}"/{hosting,scaling,security,operations,developer}
    mkdir -p "${TARGET_DIR}"/hosting/{installation,configuration,updating}
    mkdir -p "${TARGET_DIR}"/developer/{nodes,cli,api}
    
    log "${GREEN}✓ Directory structure created${NC}"
}

# Pull documentation pages
pull_docs() {
    log "${BLUE}Starting documentation pull...${NC}"
    
    # Define URLs to pull
    declare -A urls=(
        # Hosting & Installation
        ["hosting/index"]="https://docs.n8n.io/hosting/"
        ["hosting/installation/docker-compose"]="https://docs.n8n.io/hosting/installation/docker-compose/"
        ["hosting/installation/kubernetes"]="https://docs.n8n.io/hosting/installation/kubernetes/"
        ["hosting/updating/index"]="https://docs.n8n.io/hosting/updating/"
        ["hosting/configuration/methods"]="https://docs.n8n.io/hosting/configuration/configuration-methods/"
        ["hosting/configuration/env-vars"]="https://docs.n8n.io/hosting/configuration/environment-variables/"
        ["hosting/configuration/env-vars-deployment"]="https://docs.n8n.io/hosting/configuration/environment-variables/deployment/"
        
        # Scaling & Queue Mode
        ["scaling/overview"]="https://docs.n8n.io/hosting/scaling/overview/"
        ["scaling/queue-mode"]="https://docs.n8n.io/hosting/scaling/queue-mode/"
        ["scaling/queue-env-vars"]="https://docs.n8n.io/hosting/configuration/environment-variables/queue-mode/"
        ["scaling/binary-data"]="https://docs.n8n.io/hosting/scaling/binary-data/"
        ["scaling/task-runners"]="https://docs.n8n.io/hosting/configuration/task-runners/"
        
        # Security, Privacy & Compliance
        ["security/overview"]="https://docs.n8n.io/privacy-security/"
        ["security/securing-n8n"]="https://docs.n8n.io/hosting/securing/"
        ["security/what-you-can-do"]="https://docs.n8n.io/privacy-security/what-you-can-do/"
        
        # Operations & Maintenance
        ["operations/execution-data"]="https://docs.n8n.io/hosting/scaling/execution-data/"
        ["operations/monitoring"]="https://docs.n8n.io/hosting/monitoring/"
        ["operations/backup-restore"]="https://docs.n8n.io/hosting/backup-restore/"
        ["operations/troubleshooting"]="https://docs.n8n.io/hosting/troubleshooting/"
        
        # Developer Reference
        ["developer/nodes/creating"]="https://docs.n8n.io/integrations/creating-nodes/"
        ["developer/nodes/credentials"]="https://docs.n8n.io/integrations/creating-nodes/credentials/"
        ["developer/cli/reference"]="https://docs.n8n.io/cli-commands/"
        ["developer/api/reference"]="https://docs.n8n.io/api/"
    )
    
    # Pull each URL
    for key in "${!urls[@]}"; do
        url="${urls[$key]}"
        subdir="$(dirname "$key")"
        filename="$(basename "$key").html"
        
        log "${YELLOW}Pulling: ${url}${NC}"
        
        # Create subdirectory if needed
        mkdir -p "${TARGET_DIR}/${subdir}"
        
        # Use wget to pull the page with assets
        if wget --quiet \
               --page-requisites \
               --convert-links \
               --adjust-extension \
               --no-parent \
               --directory-prefix="${TARGET_DIR}/${subdir}" \
               --user-agent="Mozilla/5.0 (compatible; GrayGhostAI-DocPull/1.0)" \
               "${url}"; then
            log "${GREEN}✓ Successfully pulled: ${key}${NC}"
        else
            log "${RED}✗ Failed to pull: ${key}${NC}"
        fi
    done
}

# Generate checksums
generate_checksums() {
    log "${BLUE}Generating checksums...${NC}"
    
    # Clear existing checksum file
    > "${CHECKSUM_FILE}"
    
    # Generate SHA256 for all HTML files
    find "${TARGET_DIR}" -type f \( -name "*.html" -o -name "*.htm" \) -exec sha256sum {} \; | \
        sed "s|${DOCS_DIR}/||" >> "${CHECKSUM_FILE}"
    
    # Count files
    file_count=$(wc -l < "${CHECKSUM_FILE}")
    
    log "${GREEN}✓ Generated checksums for ${file_count} files${NC}"
}

# Create index file
create_index() {
    log "${BLUE}Creating index file...${NC}"
    
    cat > "${TARGET_DIR}/index.html" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>n8n Documentation - ${DATE_DIR}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #ff6d5a; }
        h2 { color: #333; margin-top: 30px; }
        ul { list-style-type: none; padding-left: 20px; }
        li { margin: 5px 0; }
        a { color: #0066cc; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .metadata { color: #666; font-size: 0.9em; margin-top: 20px; }
    </style>
</head>
<body>
    <h1>n8n Documentation Snapshot - ${DATE_DIR}</h1>
    
    <h2>1. Hosting & Installation</h2>
    <ul>
        <li>📄 <a href="hosting/index.html">Choose your n8n</a></li>
        <li>📄 <a href="hosting/installation/docker-compose.html">Docker Compose</a></li>
        <li>📄 <a href="hosting/installation/kubernetes.html">Kubernetes Helm</a></li>
        <li>📄 <a href="hosting/updating/index.html">Updating n8n</a></li>
        <li>📄 <a href="hosting/configuration/methods.html">Configuration Methods</a></li>
        <li>📄 <a href="hosting/configuration/env-vars.html">Environment Variables</a></li>
    </ul>
    
    <h2>2. Scaling & Queue Mode</h2>
    <ul>
        <li>📄 <a href="scaling/overview.html">Scaling Overview</a></li>
        <li>📄 <a href="scaling/queue-mode.html">Queue Mode</a></li>
        <li>📄 <a href="scaling/queue-env-vars.html">Queue Environment Variables</a></li>
        <li>📄 <a href="scaling/binary-data.html">Binary Data</a></li>
        <li>📄 <a href="scaling/task-runners.html">Task Runners</a></li>
    </ul>
    
    <h2>3. Security, Privacy & Compliance</h2>
    <ul>
        <li>📄 <a href="security/overview.html">Privacy & Security Overview</a></li>
        <li>📄 <a href="security/securing-n8n.html">Securing n8n</a></li>
        <li>📄 <a href="security/what-you-can-do.html">Hardening Guide</a></li>
    </ul>
    
    <h2>4. Operations & Maintenance</h2>
    <ul>
        <li>📄 <a href="operations/execution-data.html">Execution Data & Pruning</a></li>
        <li>📄 <a href="operations/monitoring.html">Monitoring & Logging</a></li>
        <li>📄 <a href="operations/backup-restore.html">Backup & Restore</a></li>
        <li>📄 <a href="operations/troubleshooting.html">Troubleshooting</a></li>
    </ul>
    
    <h2>5. Developer Reference</h2>
    <ul>
        <li>📄 <a href="developer/nodes/creating.html">Creating Nodes</a></li>
        <li>📄 <a href="developer/nodes/credentials.html">Credentials Development</a></li>
        <li>📄 <a href="developer/cli/reference.html">CLI Reference</a></li>
        <li>📄 <a href="developer/api/reference.html">REST API</a></li>
    </ul>
    
    <div class="metadata">
        <p>Generated: $(date)</p>
        <p>Documentation version: n8n 1.19.0+</p>
        <p>Pull script version: 1.0.0</p>
    </div>
</body>
</html>
EOF
    
    log "${GREEN}✓ Created index file${NC}"
}

# Create metadata file
create_metadata() {
    log "${BLUE}Creating metadata file...${NC}"
    
    cat > "${TARGET_DIR}/metadata.json" << EOF
{
    "pull_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "n8n_version": "1.19.0+",
    "pull_script_version": "1.0.0",
    "total_files": $(find "${TARGET_DIR}" -type f | wc -l),
    "total_size": "$(du -sh "${TARGET_DIR}" | cut -f1)",
    "urls_pulled": ${#urls[@]}
}
EOF
    
    log "${GREEN}✓ Created metadata file${NC}"
}

# Main execution
main() {
    log "${BLUE}=== n8n Documentation Pull Script ===${NC}"
    log "${BLUE}Target directory: ${TARGET_DIR}${NC}"
    
    # Check if target directory already exists
    if [[ -d "${TARGET_DIR}" ]]; then
        log "${YELLOW}Warning: Target directory already exists. Files will be overwritten.${NC}"
        read -p "Continue? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "${YELLOW}Pull cancelled by user${NC}"
            exit 0
        fi
    fi
    
    # Execute pull process
    check_prerequisites
    create_directories
    pull_docs
    generate_checksums
    create_index
    create_metadata
    
    # Summary
    log "${GREEN}=== Pull Complete ===${NC}"
    log "${GREEN}Documentation saved to: ${TARGET_DIR}${NC}"
    log "${GREEN}Checksums saved to: ${CHECKSUM_FILE}${NC}"
    log "${GREEN}Log saved to: ${LOG_FILE}${NC}"
    
    # Final instructions
    log "${BLUE}Next steps:${NC}"
    log "1. Review the pulled documentation in ${TARGET_DIR}"
    log "2. Commit changes: git add docs/vendor/n8n/ && git commit -m 'docs: Update n8n vendor documentation ${DATE_DIR}'"
    log "3. Update SBOM-COMPONENTS.md with new checksums"
}

# Run main function
main "$@"
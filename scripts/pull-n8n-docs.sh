#!/bin/bash

# n8n Documentation Pull Script
# This script downloads n8n documentation for offline reference and AI agent training

set -euo pipefail

# Configuration
YEAR=$(date +%Y)
MONTH=$(date +%m)
BASE_DIR="${BASE_DIR:-/Users/grayghostdataconsultants/Social_Media/Content_Creation/automation/docs/vendor/n8n}"
TARGET_DIR="${BASE_DIR}/${YEAR}-${MONTH}"
N8N_DOCS_BASE="https://docs.n8n.io"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check for download command availability
check_download_command() {
    if command -v curl &> /dev/null; then
        DOWNLOAD_CMD="curl"
        print_info "Using curl for downloads"
    elif command -v wget &> /dev/null; then
        DOWNLOAD_CMD="wget"
        print_info "Using wget for downloads"
    else
        print_error "Neither curl nor wget is available. Please install one of them."
        echo "On macOS: brew install curl"
        echo "On Ubuntu/Debian: sudo apt-get install curl"
        echo "On CentOS/RHEL: sudo yum install curl"
        exit 1
    fi
}

# Download function that works with both curl and wget
download_file() {
    local url=$1
    local output=$2
    local description=${3:-"file"}
    
    print_info "Downloading $description..."
    
    if [ "$DOWNLOAD_CMD" = "curl" ]; then
        curl -sSL "$url" -o "$output" || {
            print_error "Failed to download $description"
            return 1
        }
    else
        wget -q "$url" -O "$output" || {
            print_error "Failed to download $description"
            return 1
        }
    fi
    
    print_success "Downloaded $description"
}

# Create directory structure
setup_directories() {
    print_info "Creating directory structure..."
    mkdir -p "${TARGET_DIR}"/{integrations,api,hosting,workflow,nodes,credentials}
    print_success "Directory structure created"
}

# Download main documentation pages
download_main_docs() {
    print_info "Downloading main documentation pages..."
    
    local pages=(
        "index.html:Main documentation"
        "getting-started.html:Getting Started"
        "integrations/builtin/node-types.html:Built-in Node Types"
        "integrations/creating-nodes/overview.html:Creating Nodes Overview"
        "integrations/creating-nodes/node-type-description.html:Node Type Description"
        "integrations/creating-nodes/properties.html:Node Properties"
        "integrations/creating-nodes/execute-method.html:Execute Method"
        "integrations/creating-nodes/credentials.html:Credentials"
        "integrations/creating-nodes/webhook-node.html:Webhook Nodes"
        "integrations/creating-nodes/trigger-node.html:Trigger Nodes"
        "api/overview.html:API Overview"
        "hosting/configuration.html:Configuration"
        "workflow/overview.html:Workflow Overview"
    )
    
    for page_info in "${pages[@]}"; do
        IFS=':' read -r page description <<< "$page_info"
        local output_path="${TARGET_DIR}/${page}"
        local output_dir=$(dirname "$output_path")
        
        # Create subdirectory if needed
        mkdir -p "$output_dir"
        
        download_file "${N8N_DOCS_BASE}/${page}" "$output_path" "$description"
    done
}

# Download node examples
download_node_examples() {
    print_info "Downloading node examples..."
    
    local examples=(
        "http-request:HTTP Request Node"
        "webhook:Webhook Node"
        "function:Function Node"
        "if:IF Node"
        "merge:Merge Node"
        "split-in-batches:Split In Batches Node"
    )
    
    mkdir -p "${TARGET_DIR}/examples/nodes"
    
    for example_info in "${examples[@]}"; do
        IFS=':' read -r node description <<< "$example_info"
        local url="${N8N_DOCS_BASE}/integrations/builtin/core-nodes/n8n-nodes-base.${node}/"
        local output="${TARGET_DIR}/examples/nodes/${node}.html"
        
        download_file "$url" "$output" "$description example"
    done
}

# Convert HTML to Markdown (if pandoc is available)
convert_to_markdown() {
    if command -v pandoc &> /dev/null; then
        print_info "Converting HTML files to Markdown..."
        
        local converted=0
        local failed=0
        
        find "$TARGET_DIR" -name "*.html" -type f | while read -r html_file; do
            local md_file="${html_file%.html}.md"
            if pandoc -f html -t markdown_strict "$html_file" -o "$md_file" 2>/dev/null; then
                ((converted++))
            else
                ((failed++))
            fi
        done
        
        print_success "Markdown conversion completed (converted: $converted)"
    else
        print_info "pandoc not found. Skipping Markdown conversion."
        echo "  To enable Markdown conversion: brew install pandoc"
    fi
}

# Create index file
create_index() {
    print_info "Creating documentation index..."
    
    cat > "${TARGET_DIR}/INDEX.md" << EOF
# n8n Documentation Archive
**Downloaded**: $(date)
**Version**: Latest as of ${YEAR}-${MONTH}

## Contents

### Main Documentation
- [Main documentation](index.md)
- [Getting Started](getting-started.md)

### Integrations
- [Built-in Node Types](integrations/builtin/node-types.md)
- [Creating Nodes Overview](integrations/creating-nodes/overview.md)
- [Node Type Description](integrations/creating-nodes/node-type-description.md)
- [Node Properties](integrations/creating-nodes/properties.md)
- [Execute Method](integrations/creating-nodes/execute-method.md)
- [Credentials](integrations/creating-nodes/credentials.md)
- [Webhook Nodes](integrations/creating-nodes/webhook-node.md)
- [Trigger Nodes](integrations/creating-nodes/trigger-node.md)

### API
- [API Overview](api/overview.md)

### Hosting
- [Configuration](hosting/configuration.md)

### Workflow
- [Workflow Overview](workflow/overview.md)

### Node Examples
$(find "${TARGET_DIR}/examples/nodes" -name "*.md" 2>/dev/null | sed "s|${TARGET_DIR}/||g" | sed 's/^/- [/;s/\.md$/](/' | sed 's|/| |g;s|examples nodes |Node: |;s|]|&.md)|')

## Notes
- This is an offline archive of n8n documentation
- For the latest documentation, visit: ${N8N_DOCS_BASE}
- Some interactive features may not work in offline mode
EOF
    
    print_success "Documentation index created"
}

# Download code examples from GitHub
download_code_examples() {
    print_info "Downloading code examples from n8n GitHub..."
    
    local examples_dir="${TARGET_DIR}/code-examples"
    mkdir -p "$examples_dir"
    
    # Download example node implementations
    local github_examples=(
        "HttpRequest.node.ts|https://raw.githubusercontent.com/n8n-io/n8n/master/packages/nodes-base/nodes/HttpRequest/HttpRequest.node.ts"
        "Webhook.node.ts|https://raw.githubusercontent.com/n8n-io/n8n/master/packages/nodes-base/nodes/Webhook/Webhook.node.ts"
        "Function.node.ts|https://raw.githubusercontent.com/n8n-io/n8n/master/packages/nodes-base/nodes/Function/Function.node.ts"
        "HttpBasicAuth.credentials.ts|https://raw.githubusercontent.com/n8n-io/n8n/master/packages/nodes-base/credentials/HttpBasicAuth.credentials.ts"
        "HttpHeaderAuth.credentials.ts|https://raw.githubusercontent.com/n8n-io/n8n/master/packages/nodes-base/credentials/HttpHeaderAuth.credentials.ts"
    )
    
    for example_info in "${github_examples[@]}"; do
        IFS='|' read -r filename url <<< "$example_info"
        download_file "$url" "${examples_dir}/${filename}" "code example: $filename"
    done
}

# Create AI training summary
create_ai_summary() {
    print_info "Creating AI training summary..."
    
    cat > "${TARGET_DIR}/AI_TRAINING_SUMMARY.md" << 'EOF'
# n8n Node Development Training Summary

## Key Concepts for AI Agents

### 1. Node Structure
```typescript
export class MyNode implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'My Node',
        name: 'myNode',
        group: ['transform'],
        version: 1,
        inputs: ['main'],
        outputs: ['main'],
        properties: [
            // Node parameters
        ]
    };
    
    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        // Node logic
    }
}
```

### 2. Resource/Operation Pattern
- Use `resource` parameter for main entity (e.g., 'user', 'post')
- Use `operation` parameter for actions (e.g., 'create', 'get', 'update')
- Show/hide fields based on resource/operation selection

### 3. Credential Types
```typescript
export class MyApiCredentials implements ICredentialType {
    name = 'myApi';
    displayName = 'My API';
    properties: INodeProperties[] = [
        {
            displayName: 'API Key',
            name: 'apiKey',
            type: 'string',
            typeOptions: { password: true },
            default: '',
        }
    ];
}
```

### 4. Error Handling
```typescript
throw new NodeOperationError(
    this.getNode(),
    'Error message',
    { itemIndex: i }
);
```

### 5. Webhook Nodes
- Implement `webhookMethods` for webhook lifecycle
- Use `IWebhookFunctions` for webhook handling
- Support `checkExists`, `create`, `delete` methods

### 6. Best Practices
- Always handle `continueOnFail()` option
- Use `pairedItem` for item tracking
- Implement proper TypeScript types
- Follow n8n naming conventions
- Use `displayOptions` for conditional UI
EOF
    
    print_success "AI training summary created"
}

# Main execution
main() {
    echo "=== n8n Documentation Pull Script ==="
    echo "Target directory: $TARGET_DIR"
    
    # Check prerequisites
    print_info "Checking prerequisites..."
    check_download_command
    
    # Setup
    setup_directories
    
    # Download documentation
    download_main_docs
    download_node_examples
    download_code_examples
    
    # Convert to Markdown if possible
    convert_to_markdown
    
    # Create indexes and summaries
    create_index
    create_ai_summary
    
    # Summary
    echo
    print_success "Documentation download completed!"
    echo "Location: $TARGET_DIR"
    echo
    echo "Files downloaded:"
    find "$TARGET_DIR" -type f | wc -l | xargs echo "  Total files:"
    du -sh "$TARGET_DIR" | cut -f1 | xargs echo "  Total size:"
    echo
    echo "Next steps:"
    echo "1. Review the documentation in: $TARGET_DIR"
    echo "2. Use INDEX.md for navigation"
    echo "3. Refer to AI_TRAINING_SUMMARY.md for key concepts"
}

# Run main function
main "$@"
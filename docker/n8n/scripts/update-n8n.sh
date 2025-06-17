#!/bin/bash
# n8n Update Script with Zero-Downtime Deployment

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
BACKUP_DIR="./backups"
MAX_WAIT_TIME=300  # 5 minutes
HEALTH_CHECK_INTERVAL=5

# Functions
log_info() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS: $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
       log_error "This script should not be run as root"
       exit 1
    fi
}

# Load environment variables
load_env() {
    if [[ -f .env ]]; then
        export $(cat .env | grep -v '^#' | xargs)
    else
        log_error ".env file not found"
        exit 1
    fi
}

# Check Docker and Docker Compose
check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    log_success "Dependencies check passed"
}

# Create backup
create_backup() {
    log_info "Creating backup..."
    
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    
    # Backup database
    log_info "Backing up PostgreSQL database..."
    docker-compose exec -T postgres pg_dump -U ${POSTGRES_USER} -d ${POSTGRES_DB} > "${BACKUP_DIR}/n8n_db_${TIMESTAMP}.sql"
    
    # Backup data volume
    log_info "Backing up n8n data volume..."
    docker run --rm -v n8n-app-data:/data -v "$(pwd)/${BACKUP_DIR}":/backup alpine \
        tar czf "/backup/n8n_data_${TIMESTAMP}.tar.gz" -C /data .
    
    # Backup current docker-compose.yml and .env
    cp docker-compose.yml "${BACKUP_DIR}/docker-compose_${TIMESTAMP}.yml"
    cp .env "${BACKUP_DIR}/env_${TIMESTAMP}"
    
    log_success "Backup completed: ${BACKUP_DIR}/*_${TIMESTAMP}.*"
    echo "$TIMESTAMP" > "${BACKUP_DIR}/last_backup_timestamp"
}

# Check service health
check_health() {
    local service=$1
    local max_attempts=$((MAX_WAIT_TIME / HEALTH_CHECK_INTERVAL))
    local attempt=0
    
    log_info "Checking health of $service..."
    
    while [[ $attempt -lt $max_attempts ]]; do
        if docker-compose ps | grep "$service" | grep -q "healthy"; then
            log_success "$service is healthy"
            return 0
        fi
        
        attempt=$((attempt + 1))
        log_info "Waiting for $service to be healthy... (${attempt}/${max_attempts})"
        sleep $HEALTH_CHECK_INTERVAL
    done
    
    log_error "$service failed to become healthy"
    return 1
}

# Update n8n version
update_version() {
    local new_version=${1:-latest}
    
    log_info "Updating n8n to version: $new_version"
    
    # Update .env file
    if [[ "$new_version" != "latest" ]]; then
        sed -i.bak "s/N8N_VERSION=.*/N8N_VERSION=$new_version/" .env
    fi
    
    # Pull new images
    log_info "Pulling new Docker images..."
    docker-compose pull
}

# Perform rolling update
rolling_update() {
    log_info "Starting rolling update..."
    
    # Scale up new n8n instance
    log_info "Starting new n8n instance..."
    docker-compose up -d --no-deps --scale n8n=2 n8n
    
    # Wait for new instance to be healthy
    if ! check_health "n8n"; then
        log_error "New n8n instance failed health check"
        rollback
        exit 1
    fi
    
    # Update workers
    log_info "Updating workers..."
    docker-compose up -d --no-deps n8n-worker
    
    # Update other services
    log_info "Updating other services..."
    docker-compose up -d postgres redis nginx mcp-bridge
    
    # Final health check
    sleep 10
    if ! check_all_services; then
        log_error "Services failed health check after update"
        rollback
        exit 1
    fi
    
    log_success "Rolling update completed successfully"
}

# Check all services
check_all_services() {
    local services=("n8n" "postgres" "redis")
    
    for service in "${services[@]}"; do
        if ! check_health "$service"; then
            return 1
        fi
    done
    
    return 0
}

# Rollback function
rollback() {
    log_error "Rolling back to previous version..."
    
    # Get last backup timestamp
    if [[ -f "${BACKUP_DIR}/last_backup_timestamp" ]]; then
        TIMESTAMP=$(cat "${BACKUP_DIR}/last_backup_timestamp")
        
        # Restore docker-compose.yml
        if [[ -f "${BACKUP_DIR}/docker-compose_${TIMESTAMP}.yml" ]]; then
            cp "${BACKUP_DIR}/docker-compose_${TIMESTAMP}.yml" docker-compose.yml
        fi
        
        # Restore .env
        if [[ -f "${BACKUP_DIR}/env_${TIMESTAMP}" ]]; then
            cp "${BACKUP_DIR}/env_${TIMESTAMP}" .env
        fi
        
        # Restart services with old configuration
        docker-compose down
        docker-compose up -d
        
        log_info "Rollback completed. Services restored to previous state."
    else
        log_error "No backup timestamp found. Manual intervention required."
    fi
}

# Test workflows
test_workflows() {
    log_info "Testing workflows..."
    
    # Test webhook endpoint
    local webhook_url="https://n8n.grayghostai.com/webhook-test/health"
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$webhook_url" || echo "000")
    
    if [[ "$response" == "200" ]]; then
        log_success "Webhook test passed"
    else
        log_error "Webhook test failed (HTTP $response)"
        return 1
    fi
    
    # Test API endpoint
    local api_url="https://n8n.grayghostai.com/api/v1/workflows"
    local api_response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer ${N8N_API_KEY:-}" \
        "$api_url" || echo "000")
    
    if [[ "$api_response" == "200" || "$api_response" == "401" ]]; then
        log_success "API test passed"
    else
        log_error "API test failed (HTTP $api_response)"
        return 1
    fi
    
    return 0
}

# Main update process
main() {
    local version=${1:-latest}
    
    log_info "Starting n8n update process..."
    
    # Pre-flight checks
    check_root
    load_env
    check_dependencies
    
    # Create backup
    create_backup
    
    # Update version
    update_version "$version"
    
    # Perform rolling update
    rolling_update
    
    # Test updated system
    if test_workflows; then
        log_success "Update completed successfully!"
        log_info "n8n has been updated to version: $version"
    else
        log_error "Post-update tests failed"
        log_info "System is running but may have issues. Check logs for details."
    fi
    
    # Show current status
    echo
    log_info "Current service status:"
    docker-compose ps
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
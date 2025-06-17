# n8n Docker Configuration for GrayGhostAI

This directory contains the Docker configuration for running n8n with the GrayGhostAI platform.

## Features

- **Production-Ready Setup**: PostgreSQL, Redis, and n8n in queue mode
- **High Availability**: Multiple n8n workers with auto-scaling
- **Security Hardened**: TLS, authentication, rate limiting
- **Custom Nodes**: Pre-installed GrayGhostAI nodes
- **MCP Integration**: Model Context Protocol bridge service
- **Zero-Downtime Updates**: Rolling update support
- **Monitoring**: Health checks and metrics endpoints

## Quick Start

### 1. Initialize Environment

```bash
make init
```

This will:
- Copy `.env.example` to `.env`
- Create required directories
- Generate self-signed SSL certificates (for testing)

### 2. Configure Environment

Edit `.env` file with your configuration:

```bash
# Required configurations
POSTGRES_PASSWORD=your-secure-password
REDIS_PASSWORD=your-redis-password
N8N_BASIC_AUTH_PASSWORD=your-admin-password
JWT_SECRET=$(openssl rand -hex 32)
N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)
```

### 3. Start Services

```bash
# Build custom n8n image (first time)
make build

# Start all services
make up

# Check status
make status
```

### 4. Access n8n

- **URL**: https://n8n.grayghostai.com (or https://localhost if testing locally)
- **Username**: Set in `N8N_BASIC_AUTH_USER`
- **Password**: Set in `N8N_BASIC_AUTH_PASSWORD`

## Directory Structure

```
docker/n8n/
├── docker-compose.yml      # Main Docker Compose configuration
├── Dockerfile             # Custom n8n image with GrayGhostAI nodes
├── .env.example          # Environment template
├── Makefile             # Management commands
├── nginx/               # Nginx reverse proxy configuration
│   ├── nginx.conf      # Main Nginx configuration
│   ├── conf.d/         # Site configurations
│   └── ssl/            # SSL certificates
├── custom-nodes/        # GrayGhostAI custom nodes
├── mcp-config/         # MCP server configurations
├── init-scripts/       # PostgreSQL initialization scripts
├── backups/           # Backup storage
└── scripts/           # Utility scripts
```

## Management Commands

### Basic Operations

```bash
# Start services
make up

# Stop services
make down

# Restart services
make restart

# View logs
make logs

# View logs for specific service
make logs SERVICE=n8n

# Open shell in n8n container
make shell
```

### Backup and Restore

```bash
# Create backup
make backup

# Restore from backup
make restore BACKUP_FILE=n8n_db_20240115_120000.sql

# List backups
ls -la backups/
```

### Updates

```bash
# Update to latest version
make update

# Update to specific version
make update-version VERSION=1.20.0

# Zero-downtime update
./scripts/update-n8n.sh 1.20.0
```

### Scaling

```bash
# Scale workers
make scale-workers REPLICAS=4

# Check current scale
docker-compose ps | grep worker
```

### Monitoring

```bash
# Show real-time metrics
make monitor

# Test webhook endpoint
make test-webhook

# Check service health
curl https://n8n.grayghostai.com/healthz
```

## Configuration

### Environment Variables

Key environment variables in `.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `N8N_VERSION` | n8n version to use | latest |
| `N8N_HOST` | Public hostname | n8n.grayghostai.com |
| `POSTGRES_PASSWORD` | PostgreSQL password | (required) |
| `REDIS_PASSWORD` | Redis password | (required) |
| `N8N_ENCRYPTION_KEY` | Encryption key for credentials | (required) |
| `EXECUTIONS_MODE` | Execution mode | queue |
| `N8N_WORKER_REPLICAS` | Number of worker replicas | 2 |

### Custom Nodes Installation

To install/update GrayGhostAI custom nodes:

```bash
# Copy nodes from main project
make install-nodes

# Or manually copy
cp -r ../../n8n-nodes/* ./custom-nodes/

# Rebuild and restart
make build
make restart
```

### MCP Server Configuration

Edit `mcp-config/mcp-servers.json` to configure MCP servers:

```json
{
  "id": "custom-server",
  "name": "My Custom MCP Server",
  "type": "websocket",
  "url": "ws://custom-mcp:8080",
  "description": "Custom business logic"
}
```

## Security

### SSL/TLS Configuration

For production, replace self-signed certificates:

```bash
# Copy your certificates
cp /path/to/cert.pem nginx/ssl/
cp /path/to/key.pem nginx/ssl/

# Set proper permissions
chmod 600 nginx/ssl/key.pem
```

### Authentication

n8n supports multiple authentication methods:

1. **Basic Auth** (default): Username/password
2. **JWT**: For API access
3. **OAuth2**: Can be configured via environment

### Network Security

- All services run in isolated Docker network
- Nginx acts as reverse proxy with rate limiting
- PostgreSQL and Redis not exposed externally
- Health endpoints restricted to internal IPs

## Troubleshooting

### Common Issues

#### Services Won't Start

```bash
# Check logs
make logs

# Check specific service
docker-compose logs postgres
docker-compose logs redis

# Reset and start fresh
make down
docker volume prune
make up
```

#### Database Connection Issues

```bash
# Test PostgreSQL connection
docker-compose exec postgres psql -U n8n -d n8n -c "SELECT 1"

# Check PostgreSQL logs
docker-compose logs postgres | tail -50
```

#### Worker Issues

```bash
# Check worker logs
docker-compose logs n8n-worker

# Scale workers down and up
make scale-workers REPLICAS=0
make scale-workers REPLICAS=2
```

#### Performance Issues

```bash
# Check resource usage
docker stats

# Increase resources in docker-compose.yml
# Adjust deploy.resources.limits
```

### Debug Mode

Enable debug logging:

```bash
# Edit .env
N8N_LOG_LEVEL=debug

# Restart
make restart

# Watch logs
make logs
```

## Maintenance

### Regular Tasks

1. **Daily**: Check logs for errors
2. **Weekly**: Create backups
3. **Monthly**: Update n8n and dependencies
4. **Quarterly**: Review and rotate credentials

### Health Monitoring

Set up monitoring alerts for:

```bash
# n8n health
curl https://n8n.grayghostai.com/healthz

# PostgreSQL health
docker-compose exec postgres pg_isready

# Redis health
docker-compose exec redis redis-cli ping

# MCP Bridge health
curl http://mcp.grayghostai.com/health
```

## Advanced Configuration

### Queue Configuration

For high-volume workflows, tune Redis queue settings:

```yaml
environment:
  - QUEUE_BULL_REDIS_HOST=redis
  - QUEUE_BULL_REDIS_PORT=6379
  - QUEUE_BULL_REDIS_DB=0
  - QUEUE_BULL_PREFIX=n8n
  - QUEUE_WORKER_TIMEOUT=300
```

### PostgreSQL Tuning

The `init-scripts/01-create-extensions.sql` includes performance optimizations. For large deployments, consider:

- Increasing `shared_buffers`
- Adjusting `work_mem`
- Enabling `pg_stat_statements`

### Nginx Customization

Modify `nginx/conf.d/n8n.conf` for:

- Custom domains
- Additional security headers
- Modified rate limits
- Cache settings

## Support

For issues specific to this Docker setup:

1. Check logs: `make logs`
2. Review configuration: Ensure `.env` is correct
3. Test connectivity: Use health endpoints
4. Consult n8n documentation: https://docs.n8n.io

For GrayGhostAI specific issues, check the main project documentation.
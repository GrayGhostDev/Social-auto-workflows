# Makefile for n8n Docker Management
.PHONY: help build up down start stop restart logs shell backup restore update clean status init

# Default environment
ENV ?= production
COMPOSE_FILE = docker-compose.yml
BACKUP_DIR = ./backups

# Colors
GREEN = \033[0;32m
YELLOW = \033[1;33m
RED = \033[0;31m
NC = \033[0m # No Color

help: ## Show this help message
	@echo "n8n Docker Management Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-15s$(NC) %s\n", $$1, $$2}'

init: ## Initialize the environment (copy .env.example, create directories)
	@echo "$(YELLOW)Initializing n8n environment...$(NC)"
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "$(GREEN)Created .env file from template$(NC)"; \
		echo "$(RED)Please edit .env with your configuration!$(NC)"; \
	else \
		echo "$(YELLOW).env file already exists$(NC)"; \
	fi
	@mkdir -p custom-nodes backups nginx/ssl mcp-config init-scripts
	@echo "$(GREEN)Created required directories$(NC)"

build: ## Build custom n8n image with GrayGhostAI nodes
	@echo "$(YELLOW)Building custom n8n image...$(NC)"
	docker-compose build --no-cache n8n
	@echo "$(GREEN)Build complete$(NC)"

up: ## Start all services
	@echo "$(YELLOW)Starting n8n services...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)Services started$(NC)"
	@$(MAKE) status

down: ## Stop all services
	@echo "$(YELLOW)Stopping n8n services...$(NC)"
	docker-compose down
	@echo "$(GREEN)Services stopped$(NC)"

start: ## Start stopped services
	docker-compose start

stop: ## Stop running services
	docker-compose stop

restart: ## Restart all services
	@echo "$(YELLOW)Restarting n8n services...$(NC)"
	docker-compose restart
	@echo "$(GREEN)Services restarted$(NC)"

logs: ## View logs (use SERVICE=<name> to filter)
	@if [ -z "$(SERVICE)" ]; then \
		docker-compose logs -f --tail=100; \
	else \
		docker-compose logs -f --tail=100 $(SERVICE); \
	fi

shell: ## Open shell in n8n container
	docker-compose exec n8n sh

status: ## Show status of all services
	@echo "$(YELLOW)Service Status:$(NC)"
	@docker-compose ps
	@echo ""
	@echo "$(YELLOW)Health Status:$(NC)"
	@docker-compose ps | grep -E "(healthy|unhealthy|starting)" || echo "$(GREEN)All services healthy$(NC)"

backup: ## Backup n8n data and workflows
	@echo "$(YELLOW)Creating backup...$(NC)"
	@mkdir -p $(BACKUP_DIR)
	@TIMESTAMP=$$(date +%Y%m%d_%H%M%S); \
	docker-compose exec postgres pg_dump -U $$POSTGRES_USER -d $$POSTGRES_DB > $(BACKUP_DIR)/n8n_db_$$TIMESTAMP.sql && \
	docker run --rm -v n8n-app-data:/data -v $$(pwd)/$(BACKUP_DIR):/backup alpine tar czf /backup/n8n_data_$$TIMESTAMP.tar.gz -C /data . && \
	echo "$(GREEN)Backup created: $(BACKUP_DIR)/n8n_db_$$TIMESTAMP.sql and n8n_data_$$TIMESTAMP.tar.gz$(NC)"

restore: ## Restore from backup (use BACKUP_FILE=<filename>)
	@if [ -z "$(BACKUP_FILE)" ]; then \
		echo "$(RED)Please specify BACKUP_FILE=<filename>$(NC)"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Restoring from backup: $(BACKUP_FILE)...$(NC)"
	@if [[ "$(BACKUP_FILE)" == *.sql ]]; then \
		docker-compose exec -T postgres psql -U $$POSTGRES_USER -d $$POSTGRES_DB < $(BACKUP_DIR)/$(BACKUP_FILE) && \
		echo "$(GREEN)Database restored$(NC)"; \
	elif [[ "$(BACKUP_FILE)" == *.tar.gz ]]; then \
		docker run --rm -v n8n-app-data:/data -v $$(pwd)/$(BACKUP_DIR):/backup alpine tar xzf /backup/$(BACKUP_FILE) -C /data && \
		echo "$(GREEN)Data volume restored$(NC)"; \
	else \
		echo "$(RED)Unknown backup file type$(NC)"; \
	fi

update: ## Update n8n to latest version
	@echo "$(YELLOW)Updating n8n...$(NC)"
	@echo "$(YELLOW)1. Creating backup...$(NC)"
	@$(MAKE) backup
	@echo "$(YELLOW)2. Pulling latest images...$(NC)"
	docker-compose pull
	@echo "$(YELLOW)3. Restarting services...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)Update complete$(NC)"
	@echo "$(YELLOW)Please check logs for any migration issues$(NC)"

update-version: ## Update to specific n8n version (use VERSION=x.x.x)
	@if [ -z "$(VERSION)" ]; then \
		echo "$(RED)Please specify VERSION=x.x.x$(NC)"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Updating n8n to version $(VERSION)...$(NC)"
	@sed -i.bak 's/N8N_VERSION=.*/N8N_VERSION=$(VERSION)/' .env
	@$(MAKE) update

clean: ## Clean up unused Docker resources
	@echo "$(YELLOW)Cleaning up Docker resources...$(NC)"
	docker system prune -f
	docker volume prune -f
	@echo "$(GREEN)Cleanup complete$(NC)"

test-webhook: ## Test n8n webhook endpoint
	@echo "$(YELLOW)Testing webhook endpoint...$(NC)"
	@curl -X POST https://n8n.grayghostai.com/webhook-test/test \
		-H "Content-Type: application/json" \
		-d '{"test": true, "timestamp": "'$$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' \
		-w "\n$(GREEN)Response time: %{time_total}s$(NC)\n" || echo "$(RED)Webhook test failed$(NC)"

monitor: ## Show real-time metrics
	@echo "$(YELLOW)Real-time metrics (Ctrl+C to exit):$(NC)"
	@watch -n 2 'docker stats --no-stream'

scale-workers: ## Scale n8n workers (use REPLICAS=<number>)
	@if [ -z "$(REPLICAS)" ]; then \
		echo "$(RED)Please specify REPLICAS=<number>$(NC)"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Scaling n8n workers to $(REPLICAS) replicas...$(NC)"
	docker-compose up -d --scale n8n-worker=$(REPLICAS)
	@echo "$(GREEN)Scaled to $(REPLICAS) workers$(NC)"

install-nodes: ## Install/update GrayGhostAI custom nodes
	@echo "$(YELLOW)Installing GrayGhostAI custom nodes...$(NC)"
	@if [ -d "../../n8n-nodes" ]; then \
		cp -r ../../n8n-nodes/* ./custom-nodes/; \
		echo "$(GREEN)Custom nodes copied$(NC)"; \
		$(MAKE) restart; \
	else \
		echo "$(RED)n8n-nodes directory not found$(NC)"; \
	fi

generate-certs: ## Generate self-signed SSL certificates
	@echo "$(YELLOW)Generating self-signed SSL certificates...$(NC)"
	@mkdir -p nginx/ssl
	@openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
		-keyout nginx/ssl/key.pem \
		-out nginx/ssl/cert.pem \
		-subj "/C=US/ST=State/L=City/O=GrayGhostAI/CN=n8n.grayghostai.com"
	@echo "$(GREEN)SSL certificates generated$(NC)"

.DEFAULT_GOAL := help
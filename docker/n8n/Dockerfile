# Custom n8n Dockerfile with GrayGhostAI nodes pre-installed
FROM n8nio/n8n:1.19.4

# Switch to root to install dependencies
USER root

# Install additional dependencies
RUN apk add --no-cache \
    git \
    python3 \
    py3-pip \
    build-base \
    && rm -rf /var/cache/apk/*

# Create custom extensions directory
RUN mkdir -p /home/node/.n8n/custom && \
    chown -R node:node /home/node/.n8n

# Switch back to node user
USER node

# Set working directory
WORKDIR /home/node

# Copy custom nodes package
COPY --chown=node:node ./custom-nodes /home/node/.n8n/custom/

# Install GrayGhostAI n8n nodes
RUN cd /home/node/.n8n/custom && \
    if [ -f package.json ]; then \
        npm install --production && \
        npm run build || true; \
    fi

# Install community nodes
RUN cd /usr/local/lib/node_modules/n8n && \
    npm install \
        n8n-nodes-base@latest \
        @n8n/n8n-nodes-langchain@latest \
        n8n-nodes-utility@latest \
        || true

# Environment variables
ENV N8N_CUSTOM_EXTENSIONS="/home/node/.n8n/custom" \
    NODE_FUNCTION_ALLOW_BUILTIN="*" \
    NODE_FUNCTION_ALLOW_EXTERNAL="*" \
    N8N_METRICS=true \
    N8N_METRICS_PREFIX="n8n_"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --spider -q http://localhost:5678/healthz || exit 1

# Expose port
EXPOSE 5678

# Start n8n
CMD ["n8n"]
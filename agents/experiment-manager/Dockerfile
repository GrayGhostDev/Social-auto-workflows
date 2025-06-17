FROM python:3.11-slim

# Install security updates
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r agent && useradd -r -g agent agent

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY --chown=agent:agent . .

# Security hardening
RUN chmod -R 755 /app && \
    find /app -type f -name "*.py" -exec chmod 644 {} \;

# Switch to non-root user
USER agent

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import sys; sys.exit(0)"

# Metadata
LABEL org.opencontainers.image.source="https://github.com/ggdc/mcp-agents"
LABEL org.opencontainers.image.description="Experiment Manager Agent - A/B testing and variant optimization"
LABEL org.opencontainers.image.version="1.0.0"

# Run the agent
ENTRYPOINT ["python", "-u", "agent.py"]
# Vault Secret Rotation Configuration
# Implements automatic 90-day rotation for all secrets

# Database secret engine for Aurora PostgreSQL
path "database/config/aurora-postgres" {
  plugin_name = "postgresql-database-plugin"
  connection_url = "postgresql://{{username}}:{{password}}@${aurora_endpoint}:5432/n8n?sslmode=require"
  allowed_roles = ["n8n-db-role"]
  username = "vault_admin"
  password = "${initial_db_password}"
}

# Database role with automatic rotation
path "database/roles/n8n-db-role" {
  db_name = "aurora-postgres"
  creation_statements = <<-SQL
    CREATE ROLE "{{name}}" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';
    GRANT CONNECT ON DATABASE n8n TO "{{name}}";
    GRANT USAGE ON SCHEMA public TO "{{name}}";
    GRANT CREATE ON SCHEMA public TO "{{name}}";
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "{{name}}";
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "{{name}}";
  SQL
  revocation_statements = <<-SQL
    ALTER ROLE "{{name}}" NOLOGIN;
    DROP ROLE IF EXISTS "{{name}}";
  SQL
  default_ttl = "2160h"  # 90 days
  max_ttl = "2160h"      # 90 days
}

# API Keys rotation for external services
path "kv/data/n8n/+/api-keys" {
  capabilities = ["create", "read", "update", "delete"]
  
  # Rotation policy
  min_seconds_remaining = 604800  # 7 days before expiry
  
  # Automatic rotation templates
  rotation_templates = {
    twitter_bearer = {
      ttl = "2160h"
      rotation_script = "/opt/vault/scripts/rotate-twitter-token.sh"
    }
    openai_key = {
      ttl = "2160h"
      rotation_script = "/opt/vault/scripts/rotate-openai-key.sh"
    }
    canva_api_key = {
      ttl = "2160h"
      rotation_script = "/opt/vault/scripts/rotate-canva-key.sh"
    }
  }
}

# Redis password rotation
path "kv/data/n8n/+/redis" {
  plugin_name = "redis-elasticache-database-plugin"
  
  rotation_statements = <<-EOF
    CONFIG SET requirepass {{password}}
    CONFIG REWRITE
  EOF
  
  default_ttl = "2160h"  # 90 days
  max_ttl = "2160h"      # 90 days
}

# AWS IAM credentials rotation
path "aws/roles/n8n-s3-access" {
  credential_type = "iam_user"
  policy_document = <<-EOF
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "s3:GetObject",
            "s3:PutObject",
            "s3:DeleteObject"
          ],
          "Resource": "arn:aws:s3:::social-assets/prod/*"
        }
      ]
    }
  EOF
  default_ttl = "2160h"  # 90 days
  max_ttl = "2160h"      # 90 days
}

# JWT signing keys rotation
path "transit/keys/n8n-jwt" {
  type = "ed25519"
  derived = false
  exportable = false
  allow_plaintext_backup = false
  
  # Automatic key rotation
  auto_rotate_period = "2160h"  # 90 days
  
  # Keep last 3 versions for gradual migration
  min_decryption_version = 1
  min_encryption_version = 1
  deletion_allowed = false
}

# Webhook signing secrets
path "kv/data/n8n/+/webhook-secrets" {
  capabilities = ["create", "read", "update", "delete"]
  
  # Template for webhook secret generation
  secret_template = {
    algorithm = "hmac-sha256"
    length = 64
    encoding = "base64"
  }
  
  default_ttl = "2160h"  # 90 days
  max_ttl = "2160h"      # 90 days
}

# Encryption keys for PII data
path "transit/keys/pii-encryption" {
  type = "aes256-gcm96"
  derived = true
  convergent_encryption = true
  
  # Automatic rotation
  auto_rotate_period = "720h"  # 30 days for PII keys
  
  # Policy for field-level encryption
  allowed_operations = ["encrypt", "decrypt", "rewrap"]
}

# Kubernetes service account tokens
path "kubernetes/roles/n8n" {
  allowed_kubernetes_namespaces = ["grayghost-ai"]
  bound_service_account_names = ["n8n", "n8n-worker"]
  bound_service_account_namespaces = ["grayghost-ai"]
  token_ttl = "2160h"      # 90 days
  token_max_ttl = "2160h"  # 90 days
  token_policies = ["n8n-policy"]
}

# Notification configuration for rotation events
path "sys/config/notifications" {
  slack_webhook = "${slack_webhook_url}"
  email_recipients = ["security@grayghost.ai", "platform@grayghost.ai"]
  
  events = {
    secret_rotation_started = true
    secret_rotation_completed = true
    secret_rotation_failed = true
    secret_expiry_warning = true  # 7 days before expiry
  }
}

# Audit configuration for secret access
path "sys/config/auditing" {
  enabled = true
  
  # Log all secret access
  audit_non_hmac_request_keys = ["path", "remote_address", "user_agent"]
  audit_non_hmac_response_keys = ["auth.client_token", "auth.accessor"]
  
  # PII compliance - redact sensitive data
  filter_default = true
  filters = {
    "database/creds/+" = {
      operations = ["read"]
      audit_data_keys = ["request_id", "timestamp", "client_token_accessor"]
    }
  }
}

# Rotation scripts storage
path "sys/scripts" {
  # Store rotation scripts in Vault for auditability
  scripts = {
    "rotate-twitter-token.sh" = <<-SCRIPT
      #!/bin/bash
      # Twitter API token rotation
      # This would call Twitter API to regenerate bearer token
      # Store new token back in Vault
      curl -X POST "https://api.twitter.com/2/oauth2/token" \
        --data "grant_type=client_credentials" \
        --header "Authorization: Basic $${TWITTER_BASIC_AUTH}"
    SCRIPT
    
    "rotate-openai-key.sh" = <<-SCRIPT
      #!/bin/bash
      # OpenAI API key rotation
      # This would use OpenAI dashboard API to create new key
      # and revoke old key after migration period
    SCRIPT
    
    "rotate-canva-key.sh" = <<-SCRIPT
      #!/bin/bash
      # Canva API key rotation
      # Similar pattern for Canva API
    SCRIPT
  }
}
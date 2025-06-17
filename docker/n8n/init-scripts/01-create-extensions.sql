-- PostgreSQL initialization script for n8n
-- This script creates necessary extensions and optimizations

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create indexes for better performance
-- These will be created after n8n creates its tables
CREATE OR REPLACE FUNCTION create_n8n_indexes()
RETURNS void AS $$
BEGIN
    -- Check if tables exist before creating indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_entity') THEN
        -- Workflow entity indexes
        CREATE INDEX IF NOT EXISTS idx_workflow_active ON workflow_entity(active) WHERE active = true;
        CREATE INDEX IF NOT EXISTS idx_workflow_updated ON workflow_entity("updatedAt");
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'execution_entity') THEN
        -- Execution entity indexes
        CREATE INDEX IF NOT EXISTS idx_execution_workflow ON execution_entity("workflowId");
        CREATE INDEX IF NOT EXISTS idx_execution_started ON execution_entity("startedAt");
        CREATE INDEX IF NOT EXISTS idx_execution_finished ON execution_entity("finishedAt");
        CREATE INDEX IF NOT EXISTS idx_execution_status ON execution_entity(finished, "stoppedAt");
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_entity') THEN
        -- Webhook entity indexes
        CREATE INDEX IF NOT EXISTS idx_webhook_path ON webhook_entity("webhookPath");
        CREATE INDEX IF NOT EXISTS idx_webhook_method ON webhook_entity(method);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create event trigger to run after n8n creates its schema
CREATE OR REPLACE FUNCTION check_and_create_indexes()
RETURNS event_trigger AS $$
BEGIN
    -- Wait a bit to ensure tables are created
    PERFORM pg_sleep(1);
    PERFORM create_n8n_indexes();
END;
$$ LANGUAGE plpgsql;

-- Only create the event trigger if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_event_trigger 
        WHERE evtname = 'create_n8n_indexes_trigger'
    ) THEN
        CREATE EVENT TRIGGER create_n8n_indexes_trigger
        ON ddl_command_end
        WHEN TAG IN ('CREATE TABLE')
        EXECUTE FUNCTION check_and_create_indexes();
    END IF;
END;
$$;

-- PostgreSQL performance tuning
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET min_wal_size = '1GB';
ALTER SYSTEM SET max_wal_size = '4GB';

-- Enable query performance tracking
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';

-- Reload configuration
SELECT pg_reload_conf();
-- Initialize database schema for one-time secrets

-- Enable UUID extension for better ID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Secrets table
CREATE TABLE IF NOT EXISTS secrets (
    id VARCHAR(32) PRIMARY KEY,
    ciphertext BYTEA NOT NULL,
    iv BYTEA NOT NULL,
    salt BYTEA,
    expires_at TIMESTAMPTZ NOT NULL,
    burn_after_read BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient cleanup of expired secrets
CREATE INDEX IF NOT EXISTS idx_secrets_expires_at ON secrets(expires_at);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_secrets_id ON secrets(id);

-- Comments for documentation
COMMENT ON TABLE secrets IS 'Stores encrypted one-time secrets';
COMMENT ON COLUMN secrets.ciphertext IS 'AES-256-GCM encrypted secret ciphertext';
COMMENT ON COLUMN secrets.iv IS 'Initialization vector for AES-GCM';
COMMENT ON COLUMN secrets.salt IS 'Optional salt for passphrase-based encryption';
COMMENT ON COLUMN secrets.expires_at IS 'UTC timestamp when secret expires';
COMMENT ON COLUMN secrets.burn_after_read IS 'Whether secret is deleted after first access';
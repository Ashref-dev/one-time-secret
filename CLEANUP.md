# Cleanup Files

This file tracks the cleanup worker and related configuration.

- backend/cmd/cleanup/main.go - Cleanup worker entrypoint.
- backend/internal/cleanup/worker.go - Cleanup loop and expiration deletion.
- backend/Dockerfile.cleanup - Cleanup image build.
- docker-compose.yml - Cleanup service definition.
- backend/internal/config/config.go - CLEANUP_INTERVAL configuration.
- backend/migrations/000001_init_schema.up.sql - Expiration index used during cleanup.

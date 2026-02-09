# OTS Database Schema

## Overview

PostgreSQL (latest) database for One-Time Secrets service.

All migrations run **automatically** on application startup via `database.Migrate("./migrations")` call in `cmd/server/main.go` line 28.

## Tables

### secrets

Stores encrypted secret messages and their metadata.

**Columns:**

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | UUID | PRIMARY KEY | Unique identifier for each secret |
| `secret_hash` | VARCHAR(255) | UNIQUE, INDEXED | Hash of the secret URL slug (used for lookups) |
| `encrypted_content` | BYTEA | NOT NULL | Encrypted secret message (AES-256 encrypted) |
| `password_hash` | BYTEA | nullable | Optional password protection hash (bcrypt) |
| `burn_after_read` | BOOLEAN | DEFAULT false | If true, secret deleted after first read |
| `expiration_time` | TIMESTAMP | nullable | Auto-delete if not read by this timestamp |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When the secret was created |
| `read_at` | TIMESTAMP | nullable | First read timestamp (null until accessed) |

## Indexes

- `idx_secret_hash` on `secrets(secret_hash)` — Enables O(1) lookups by URL hash (most common query pattern)

## Migration System

### Location
- `migrations/000001_init_schema.up.sql` — Initial database schema

### Execution Flow

1. App starts: `./ots-backend`
2. `cmd/server/main.go` connects to PostgreSQL
3. `cmd/server/main.go` calls `database.Migrate("./migrations")` **at line 28**
4. `internal/db/migrate.go` reads all `.sql` files from `migrations/` directory in order
5. Each `.sql` file is executed sequentially (001, 002, 003, etc.)
6. Tables created with `CREATE TABLE IF NOT EXISTS` (idempotent — safe to run multiple times)
7. Server is ready for API requests

### Key Property
- **Idempotent:** Can be run multiple times without errors
- **Automatic:** No manual SQL commands needed
- **Traceable:** All schema changes in version control

## Sample SQL Queries

### Create a secret

```sql
INSERT INTO secrets (id, secret_hash, encrypted_content, created_at)
VALUES (
  gen_random_uuid(),
  'abc123xyz_hash',
  E'\x48656c6c6f20576f726c64'::bytea,  -- "Hello World" encrypted
  CURRENT_TIMESTAMP
);
```

### Retrieve unread secret

```sql
SELECT id, secret_hash, encrypted_content, password_hash, burn_after_read, expiration_time, created_at
FROM secrets 
WHERE secret_hash = 'abc123xyz_hash' 
  AND read_at IS NULL
  AND (expiration_time IS NULL OR expiration_time > CURRENT_TIMESTAMP);
```

### Mark secret as read

```sql
UPDATE secrets 
SET read_at = CURRENT_TIMESTAMP 
WHERE id = 'your-uuid-here';
```

### Delete secret (after read or expired)

```sql
DELETE FROM secrets 
WHERE id = 'your-uuid-here'
  OR (burn_after_read = true AND read_at IS NOT NULL)
  OR (expiration_time IS NOT NULL AND expiration_time < CURRENT_TIMESTAMP);
```

### Count unread secrets

```sql
SELECT COUNT(*) as unread_count
FROM secrets 
WHERE read_at IS NULL
  AND (expiration_time IS NULL OR expiration_time > CURRENT_TIMESTAMP);
```

## Database Connection

### Connection String Format

```
postgres://username:password@host:port/database?sslmode=disable
```

### Development Connection

```
postgres://ots_user:ots_password@localhost:5432/ots?sslmode=disable
```

### In Code

- **Stored in:** `.env` file as `DATABASE_URL`
- **Loaded by:** `internal/config/config.go` — reads all environment variables
- **Used by:** `internal/db/db.go` — `New()` function establishes connection pool
- **Called from:** `cmd/server/main.go` line 27 — `database.New(cfg.DatabaseURL)`

### Connection Flow

```
1. app starts: ./ots-backend
2. main.go reads .env: config.Load()
3. main.go gets DATABASE_URL from env
4. main.go calls: database.New(cfg.DatabaseURL)
5. db.go creates connection pool to PostgreSQL
6. connection pool ready for queries
7. migrations run: database.Migrate("./migrations")
8. all tables exist
9. API handlers can query database
```

## Data Persistence

### Volume Management

**Volume Name:** `ots_data` (defined in `docker-compose.yml`)

**Details:**
- Data persists across container restarts
- Located at: `/var/lib/postgresql/data` inside container
- Managed by Docker — automatic backups recommended for production

### Cleanup Operations

```bash
# View all volumes
docker volume ls | grep ots_data

# Backup database before cleanup
docker-compose exec postgres pg_dump -U ots_user ots > backup.sql

# Delete volume (⚠️ CAUTION: Deletes all data)
docker-compose down -v

# Restore database from backup
docker-compose up -d
docker-compose exec -T postgres psql -U ots_user ots < backup.sql
```

## Environment-Specific Configurations

### Development

```
DATABASE_URL=postgres://ots_user:ots_password@localhost:5432/ots?sslmode=disable
ENVIRONMENT=development
```

### Production (Example)

```
DATABASE_URL=postgres://prod_user:secure_password@prod-db.example.com:5432/ots?sslmode=require
ENVIRONMENT=production
```

## Monitoring & Maintenance

### View current tables

```bash
docker-compose exec postgres psql -U ots_user -d ots -c "\dt"
```

### View table structure

```bash
docker-compose exec postgres psql -U ots_user -d ots -c "\d secrets"
```

### View indexes

```bash
docker-compose exec postgres psql -U ots_user -d ots -c "\di"
```

### View database size

```bash
docker-compose exec postgres psql -U ots_user -d ots -c "SELECT pg_size_pretty(pg_database_size('ots'));"
```

### View disk usage by table

```bash
docker-compose exec postgres psql -U ots_user -d ots -c "
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

## Troubleshooting

### "Table 'secrets' does not exist" Error

**Cause:** Migration did not run
**Fix:** Ensure `database.Migrate("./migrations")` is called in `cmd/server/main.go` line 28

**Verify:**
```bash
grep -n "database.Migrate" cmd/server/main.go
# Should show: 28:  if err := database.Migrate("./migrations"); err != nil {
```

### "Connection refused" Error

**Cause:** PostgreSQL not running or wrong host/port
**Fix:** Start Docker containers

**Verify:**
```bash
docker-compose up -d
docker-compose ps  # should show "ots-postgres Up (healthy)"
```

### "FATAL: password authentication failed"

**Cause:** Wrong credentials in `.env` DATABASE_URL
**Fix:** Verify `.env` matches docker-compose.yml

**Check:**
```bash
grep DATABASE_URL .env  # should be ots_user:ots_password
grep POSTGRES_USER docker-compose.yml  # should be ots_user
```

## Summary

The OTS database is fully automated:
1. ✅ Docker starts PostgreSQL
2. ✅ App connects via `.env` DATABASE_URL
3. ✅ Migrations run automatically on startup
4. ✅ Tables created with proper indexes
5. ✅ Zero manual SQL commands needed
6. ✅ Data persists across restarts

**Migration is complete when app starts without errors.**

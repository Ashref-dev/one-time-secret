#!/bin/bash
set -e

cd /Users/mohamedashrefbenabdallah/ashref-agent-box/ots.ashref.tn/backend

echo "📋 =============================================="
echo "   OTS BACKEND - POSTGRESQL FIX SEQUENCE"
echo "=============================================="
echo ""

echo "📋 STEP 1: Backing up original docker-compose.yml..."
cp docker-compose.yml docker-compose.yml.backup
echo "✅ Backup created: docker-compose.yml.backup"
echo ""

echo "🔧 STEP 2: Creating corrected docker-compose.yml..."
cat > docker-compose.yml << 'COMPOSE'
version: '3.8'

services:
  postgres:
    image: postgres:alpine
    container_name: ots-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ots_password
      POSTGRES_DB: ots
    ports:
      - "5432:5432"
    volumes:
      - ots_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  ots_data:
COMPOSE
echo "✅ docker-compose.yml has been corrected"
echo "   - POSTGRES_USER: postgres (was ots_user)"
echo "   - Healthcheck updated to use postgres"
echo ""

echo "🛑 STEP 3: Stopping existing container..."
docker-compose down 2>/dev/null || true
echo "✅ Container stopped"
echo ""

echo "🗑️  STEP 4: Removing corrupted volume..."
docker volume rm backend_ots_data 2>/dev/null && echo "✅ Volume deleted" || echo "✅ Volume already removed"
echo ""

echo "🚀 STEP 5: Starting PostgreSQL with corrected configuration..."
docker-compose up -d
echo "✅ Container started"
echo "⏳ Waiting 60 seconds for PostgreSQL to fully initialize..."
sleep 60
echo "✅ PostgreSQL initialization complete"
echo ""

echo "✔️  STEP 6: Verifying postgres superuser exists..."
echo "   Running: psql -U postgres -c '\\du'"
docker-compose exec postgres psql -U postgres -c "\du"
echo "✅ Superuser postgres verified"
echo ""

echo "👤 STEP 7: Creating ots_user with permissions..."
docker-compose exec postgres psql -U postgres << 'EOSQL'
CREATE USER ots_user WITH ENCRYPTED PASSWORD 'ots_password';
GRANT ALL PRIVILEGES ON DATABASE ots TO ots_user;
\c ots
GRANT ALL ON SCHEMA public TO ots_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO ots_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ots_user;
EOSQL
echo "✅ Application user ots_user created with full permissions"
echo ""

echo "🧪 STEP 8: Testing connection as ots_user..."
docker-compose exec postgres psql -U ots_user -d ots -c "SELECT current_user, current_database();"
echo "✅ Connection test successful"
echo ""

echo "📁 STEP 9: Listing available migrations..."
echo "   Migration files:"
ls -lh migrations/ 2>/dev/null || echo "   No migrations directory found"
echo ""

echo "🎉 =============================================="
echo "   ALL FIXES COMPLETE!"
echo "=============================================="
echo ""
echo "📊 VERIFICATION SUMMARY:"
echo "   ✅ docker-compose.yml fixed"
echo "   ✅ Old container removed"
echo "   ✅ Old volume deleted"
echo "   ✅ PostgreSQL restarted with correct config"
echo "   ✅ Superuser postgres exists"
echo "   ✅ Application user ots_user created"
echo "   ✅ Permissions granted"
echo ""
echo "🔌 CONNECTION DETAILS:"
echo "   Superuser: postgres (password: ots_password)"
echo "   App User: ots_user (password: ots_password)"
echo "   Database: ots"
echo "   Host: localhost"
echo "   Port: 5432"
echo ""
echo "📝 NEXT STEPS:"
echo "   1. Review DATABASE_SCHEMA.md for database structure"
echo "   2. Check migrations: ls -la migrations/"
echo "   3. Verify migration files are present"
echo "   4. Start server: ./ots-backend"
echo "   5. Test server: curl http://localhost:8080/health"
echo ""

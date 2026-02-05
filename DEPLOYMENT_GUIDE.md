# 🚀 GitHub Repository & Deployment Summary

## ✅ Repository Published

**GitHub URL:** https://github.com/Ashref-dev/one-time-secret

**Repository Status:** ✅ Public and Ready

---

## 📦 What's Included

### Application Components
1. **Backend (Go)**
   - Chi router with middleware
   - PostgreSQL with migrations
   - Health checks & metrics endpoints
   - Rate limiting & security headers
   - Structured logging with slog

2. **Frontend (React + TypeScript)**
   - Vite build system
   - Client-side encryption (AES-256-GCM)
   - Playwright E2E tests
   - Responsive design with dark mode

3. **Database (PostgreSQL 16)**
   - Automatic schema migrations
   - Connection pooling
   - Health checks

4. **Reverse Proxy (Caddy)**
   - Automatic HTTPS
   - HTTP/2 support
   - Simple configuration

### Testing & Quality
- ✅ Integration tests (Go + testcontainers)
- ✅ E2E tests (Playwright)
- ✅ Load tests (k6)
- ✅ Deployment verification script

### DevOps
- ✅ Docker & Docker Compose
- ✅ Health endpoints (/health, /ready, /live)
- ✅ Prometheus metrics (/metrics)
- ✅ CI/CD workflow template

---

## 🐳 Docker Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Docker Compose                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  Caddy   │───▶│ Frontend │───▶│  Backend │              │
│  │  (:80)   │    │  (Nginx) │    │  (:8080) │              │
│  └──────────┘    └──────────┘    └────┬─────┘              │
│         │                              │                     │
│         │                              ▼                     │
│         │                       ┌──────────┐                │
│         │                       │ Postgres │                │
│         │                       │  (:5432) │                │
│         │                       └──────────┘                │
│         │                              ▲                     │
│         │                              │                     │
│         └──────────────────────────────┘                     │
│                    Cleanup Worker                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Services
| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| postgres | postgres:16-alpine | 5432 | Database |
| backend | Build from Dockerfile | 8080 | API Server |
| cleanup | Build from Dockerfile.cleanup | - | Expired secret cleanup |
| frontend | Build from Dockerfile | 80 | React app |
| caddy | caddy:2-alpine | 80, 443 | Reverse proxy |

---

## 🚀 Quick Deployment

### Prerequisites
- Docker & Docker Compose installed
- ~2GB RAM available

### One-Command Deploy

```bash
# Clone the repository
git clone https://github.com/Ashref-dev/one-time-secret.git
cd one-time-secret

# Configure environment
cp .env.example .env
# Edit .env and set a secure DB_PASSWORD

# Start all services
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f

# Verify health
curl http://localhost/api/health
```

### Access the Application
- **Local:** http://localhost
- **Health Check:** http://localhost/api/health
- **Metrics:** http://localhost/api/metrics

---

## 🔧 Configuration

### Environment Variables (.env)

```bash
# Database (REQUIRED)
DB_PASSWORD=your_secure_password_here
DB_USER=ots_user
DB_NAME=ots_db

# Application
ENV=production
MAX_SECRET_SIZE=32768
DEFAULT_TTL=3600
RATE_LIMIT_REQUESTS=30
RATE_LIMIT_WINDOW=60

# Frontend
VITE_API_URL=/api
```

### Enable HTTPS (Production)

Edit `caddy/Caddyfile`:

```caddyfile
yourdomain.com {
    tls your-email@example.com
    reverse_proxy frontend:80
}
```

Restart:
```bash
docker-compose restart caddy
```

---

## 🧪 Testing

### Run Tests

```bash
# Backend integration tests
cd backend
go test -v ./...

# Frontend E2E tests
cd frontend
npm run test:e2e

# Load testing (requires k6)
cd backend/load-tests
k6 run smoke-test.js
```

### Deployment Verification

```bash
./scripts/verify-deployment.sh
```

---

## 📊 Monitoring

### Health Endpoints
- `GET /api/health` - Full health status
- `GET /api/health/ready` - Kubernetes readiness probe
- `GET /api/health/live` - Kubernetes liveness probe
- `GET /api/metrics` - Prometheus metrics

### Key Metrics
- Request count & duration
- Secret creation/retrieval/burn counts
- Active secrets count
- Memory usage & goroutines
- Database connection status

---

## 🔒 Security Features

- ✅ **Client-Side Encryption** - AES-256-GCM in browser
- ✅ **Zero-Knowledge** - Server never sees plaintext/keys
- ✅ **One-Time Access** - Secrets deleted immediately after viewing
- ✅ **Rate Limiting** - Configurable per-IP limits
- ✅ **Security Headers** - CSP, HSTS, X-Frame-Options
- ✅ **Input Validation** - Strict validation on all inputs

---

## 📝 File Structure

```
one-time-secret/
├── backend/              # Go API server
│   ├── cmd/              # Entry points
│   ├── internal/         # Internal packages
│   ├── migrations/       # Database migrations
│   ├── load-tests/       # k6 load tests
│   ├── Dockerfile
│   └── Dockerfile.cleanup
├── frontend/             # React app
│   ├── src/              # Source code
│   ├── e2e/              # Playwright tests
│   ├── Dockerfile
│   └── playwright.config.ts
├── caddy/                # Reverse proxy config
│   └── Caddyfile
├── scripts/              # Deployment scripts
│   └── verify-deployment.sh
├── docs/                 # Documentation
├── docker-compose.yml    # Main compose file
├── .env.example          # Environment template
└── README.md             # Main documentation
```

---

## 🎯 Production Checklist

- [ ] Change default database password
- [ ] Configure HTTPS with real domain
- [ ] Set up log aggregation (optional)
- [ ] Configure monitoring alerts (optional)
- [ ] Review rate limiting settings
- [ ] Test backup/restore procedures
- [ ] Run load tests
- [ ] Review security settings

---

## 🆘 Support

### Common Issues

**Database connection fails:**
```bash
# Check postgres is healthy
docker-compose ps

# View postgres logs
docker-compose logs postgres
```

**Frontend can't reach backend:**
```bash
# Check all services are running
docker-compose ps

# Verify network connectivity
docker network inspect ots_ots-network
```

**Health check fails:**
```bash
# Check backend logs
docker-compose logs backend

# Test database connection
docker-compose exec backend pg_isready -h postgres
```

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file

---

## 🙌 Credits

Built with:
- Go & Chi Router
- React & Vite
- PostgreSQL
- Caddy
- WebCrypto API

**Repository:** https://github.com/Ashref-dev/one-time-secret

**Status:** ✅ Production Ready

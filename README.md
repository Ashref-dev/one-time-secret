<div align="center">

# 🔐 One-Time Secret

**Secure, self-hosted secret sharing with zero-knowledge encryption**

[![CI/CD](https://github.com/Ashref-dev/one-time-secret/actions/workflows/ci.yml/badge.svg)](https://github.com/Ashref-dev/one-time-secret/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Go Version](https://img.shields.io/badge/go-1.21-blue.svg)](https://golang.org)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com)

[Demo](#demo) • [Features](#features) • [Quick Start](#quick-start) • [Security](#security) • [API](#api)

</div>

---

## 📖 Overview

One-Time Secret is a **privacy-first**, **self-hosted** platform for securely sharing sensitive information. Unlike cloud-based alternatives, your secrets are **encrypted in the browser** before reaching the server—ensuring true zero-knowledge security.

### 🎨 Beautiful Design

Built with a minimalist, muted purple aesthetic that works in both light and dark modes.

![Screenshot](docs/screenshot.png)

---

## ✨ Features

### 🔒 Security First
- **Client-Side Encryption** - AES-256-GCM encryption in the browser
- **Zero-Knowledge** - Server never sees plaintext or keys
- **One-Time Access** - Secrets are destroyed immediately after viewing
- **Automatic Expiration** - Configurable TTL (5 min - 24 hours)
- **Optional Passphrase** - Additional layer with PBKDF2 key derivation

### 🚀 Production Ready
- **Atomic Operations** - Row-level database locking prevents race conditions
- **Rate Limiting** - Configurable per-IP request limits
- **Structured Logging** - JSON logs with slog
- **Health Checks** - Kubernetes-ready endpoints
- **Docker Compose** - One-command deployment

### 🛠️ Tech Stack
- **Backend:** Go (Chi router, pgx PostgreSQL driver)
- **Frontend:** React + TypeScript + Vite
- **Crypto:** WebCrypto API (AES-256-GCM)
- **Database:** PostgreSQL 16
- **Proxy:** Caddy (automatic HTTPS ready)

---

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- ~2GB RAM available

### 1. Clone & Configure

```bash
git clone https://github.com/Ashref-dev/one-time-secret.git
cd ots

# Copy and edit configuration
cp .env.example .env
# Edit DB_PASSWORD to something secure
nano .env
```

### 2. Deploy

```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Verify health
curl http://localhost/health
```

The application will be available at `http://localhost`

### 3. Configure HTTPS (Production)

Edit `caddy/Caddyfile`:

```
yourdomain.com {
    tls your-email@example.com
    
    # ... rest of config
}
```

Restart: `docker-compose restart caddy`

---

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │────▶│    Caddy     │────▶│   Backend   │
│  (Encrypt)  │     │   (Proxy)    │     │    (Go)     │
└─────────────┘     └──────────────┘     └──────┬──────┘
       │                                        │
       │ 1. Encrypt secret                      │
       │    with AES-256-GCM                    │
       │                                        │
       │ 2. Send ciphertext only                │
       │────────────────────────────────────────▶│
       │                                        │
       │ 3. Store encrypted data                │
       │◀────────────────────────────────────────│
       │    (key stays in URL fragment)         │
       │                                        │
       │ 4. Share link                          │
       │────────────────────────────────────────▶│
       │                                        │
       │ 5. Request secret                      │
       │────────────────────────────────────────▶│
       │                                        │
       │ 6. Delete & return ciphertext          │
       │◀────────────────────────────────────────│
       │    (atomic operation)                  │
       │                                        │
       │ 7. Decrypt in browser                  │
       │    with key from URL                   │

Key Features:
- Encryption key never sent to server
- Atomic consume prevents double retrieval
- Row-level locking prevents race conditions
- No plaintext ever touches the server
```

---

## 🔐 Security

### Encryption

- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key Generation:** Cryptographically secure random (Crypto.getRandomValues)
- **Key Derivation:** PBKDF2 with 100,000 iterations (for passphrase mode)
- **IV:** 12-byte random nonce per encryption

### Data Handling

| Aspect | Implementation |
|--------|----------------|
| Storage | Ciphertext only (no keys, no plaintext) |
| Transport | HTTPS required, HSTS enforced |
| Access | Single-use, immediate deletion |
| Expiration | Automatic cleanup after TTL |
| Logging | No secret content logged |

### Headers

```
Content-Security-Policy: default-src 'self'...
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=31536000
```

See [SECURITY.md](SECURITY.md) for detailed security information.

---

## 📚 API Documentation

### Create Secret

```http
POST /api/secrets
Content-Type: application/json

{
  "ciphertext": "base64_aes_gcm_ciphertext",
  "iv": "base64_12_byte_iv",
  "salt": "base64_salt_if_passphrase_used",
  "expires_in": 3600,
  "burn_after_read": true
}
```

**Response:**
```json
{
  "id": "abc123..."
}
```

### Retrieve Secret (Atomic Consume)

```http
GET /api/secrets/{id}
```

**Response:**
```json
{
  "ciphertext": "base64_aes_gcm_ciphertext",
  "iv": "base64_12_byte_iv",
  "salt": "base64_salt_if_used"
}
```

**Note:** Secret is deleted immediately upon retrieval.

### Burn Secret

```http
DELETE /api/secrets/{id}
```

**Response:** `204 No Content`

---

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_PASSWORD` | - | **Required:** PostgreSQL password |
| `DB_USER` | `ots_user` | PostgreSQL username |
| `DB_NAME` | `ots_db` | PostgreSQL database |
| `MAX_SECRET_SIZE` | `32768` | Max secret size in bytes (32KB) |
| `DEFAULT_TTL` | `3600` | Default TTL in seconds (1 hour) |
| `RATE_LIMIT_REQUESTS` | `30` | Requests per window per IP |
| `RATE_LIMIT_WINDOW` | `60` | Rate limit window in seconds |
| `LOG_LEVEL` | `info` | Log level (debug/info/warn/error) |
| `ENV` | `production` | Environment mode |

### Docker Compose

```yaml
services:
  backend:
    environment:
      - DATABASE_URL=postgres://ots_user:${DB_PASSWORD}@postgres:5432/ots_db?sslmode=disable
      - MAX_SECRET_SIZE=32768
      - RATE_LIMIT_REQUESTS=30
    deploy:
      resources:
        limits:
          memory: 256M
        reservations:
          memory: 128M
```

---

## 🧪 Development

### Backend

```bash
cd backend

# Install dependencies
go mod download

# Run tests
go test -v ./...

# Run with hot reload (requires air)
air

# Or manually
go run cmd/server/main.go
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Database Migrations

Migrations run automatically on startup. To run manually:

```bash
docker-compose exec postgres psql -U ots_user -d ots_db -f /docker-entrypoint-initdb.d/001_init_schema.sql
```

---

## 🚢 Deployment

### Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml ots

# Check status
docker stack ps ots
docker service logs ots_backend
```

### Kubernetes

Coming soon. See [k8s/](./k8s/) directory for manifests.

### VPS / Cloud

1. Provision server (1 CPU, 1GB RAM minimum)
2. Install Docker & Docker Compose
3. Clone repository
4. Configure `.env`
5. Run `docker-compose up -d`
6. Configure DNS to point to server
7. Edit Caddyfile with your domain
8. Restart: `docker-compose restart caddy`

---

## 📊 Monitoring

### Health Endpoints

- `GET /health` - Basic health check
- Backend logs structured JSON to stdout

### Log Format

```json
{
  "time": "2026-02-04T12:00:00Z",
  "level": "INFO",
  "msg": "secret created",
  "secret_id": "abc123",
  "size": 1024,
  "ip": "192.168.1.1"
}
```

### Metrics

Export Prometheus metrics (coming soon).

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read [SECURITY.md](SECURITY.md) before reporting security issues.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Chi Router](https://github.com/go-chi/chi) - Lightweight Go router
- [pgx](https://github.com/jackc/pgx) - PostgreSQL driver for Go
- [WebCrypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) - Browser cryptography
- [Caddy](https://caddyserver.com/) - Modern web server

---

## 💡 Alternatives

- [One-Time Secret](https://onetimesecret.com/) - Original service (hosted)
- [Password Pusher](https://github.com/pglombardo/PasswordPusher) - Similar self-hosted option
- [Vaultwarden Send](https://github.com/dani-garcia/vaultwarden) - Bitwarden feature

---

<div align="center">

**[⬆ Back to Top](#-one-time-secret)**

Built with ❤️ for privacy-conscious users

</div>
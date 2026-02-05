# 🚀 Production Deployment Guide

## Quick Start (5 minutes)

```bash
# 1. Clone repository
git clone https://github.com/yourusername/ots.git
cd ots

# 2. Configure environment
cp .env.example .env
# Edit .env - set a secure DB_PASSWORD
nano .env

# 3. Deploy
docker-compose up -d

# 4. Verify
curl http://localhost/health
```

## Complete Setup

### 1. Server Requirements

- **OS:** Linux (Ubuntu 22.04 LTS recommended)
- **RAM:** 1GB minimum, 2GB recommended
- **Storage:** 10GB minimum
- **Ports:** 80, 443 open

### 2. Installation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone repository
git clone https://github.com/yourusername/ots.git
cd ots

# Configure
cp .env.example .env
# Edit .env with secure values
nano .env
```

### 3. Environment Configuration

Create `.env`:

```bash
# Database (REQUIRED: Change password!)
DB_PASSWORD=your-secure-password-here-at-least-32-chars
DB_USER=ots_user
DB_NAME=ots_db

# Security
ENV=production
MAX_SECRET_SIZE=32768
RATE_LIMIT_REQUESTS=30
RATE_LIMIT_WINDOW=60

# Frontend
VITE_API_URL=/api
```

### 4. Deploy

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Health check
curl http://localhost/health
```

### 5. Configure HTTPS (Production)

Edit `caddy/Caddyfile`:

```caddyfile
your-domain.com {
    tls your-email@example.com
    
    # Copy rest of config from Caddyfile
    # ...
}
```

Restart:
```bash
docker-compose restart caddy
```

### 6. Configure DNS

Point your domain to your server's IP:
```
Type: A
Name: @
Value: YOUR_SERVER_IP
TTL: 300
```

### 7. Backup Strategy

```bash
# Database backup script
#!/bin/bash
BACKUP_DIR="/backups/ots"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

docker-compose exec -T postgres pg_dump -U ots_user ots_db | gzip > $BACKUP_DIR/ots_$DATE.sql.gz

# Keep last 7 days
find $BACKUP_DIR -name "ots_*.sql.gz" -mtime +7 -delete
```

Add to crontab:
```bash
0 2 * * * /path/to/backup.sh
```

## Security Checklist

- [ ] Changed default DB_PASSWORD
- [ ] Enabled HTTPS (Caddy auto-HTTPS)
- [ ] Firewall configured (only 80, 443 open)
- [ ] Backups configured
- [ ] Monitoring set up
- [ ] Logs reviewed regularly
- [ ] Rate limiting enabled
- [ ] Security headers verified

## Troubleshooting

### Database Connection Issues
```bash
# Check postgres logs
docker-compose logs postgres

# Verify database exists
docker-compose exec postgres psql -U ots_user -l

# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d
```

### Rate Limiting
If you see "rate limit exceeded" errors:
```bash
# Check current limits in .env
grep RATE_LIMIT .env

# Restart to apply changes
docker-compose restart backend
```

### Container Won't Start
```bash
# Check logs
docker-compose logs [service-name]

# Rebuild
docker-compose down
docker-compose up -d --build
```

## Maintenance

### Updates
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Verify
docker-compose ps
```

### Log Rotation
Docker handles log rotation automatically. To customize:

```yaml
# docker-compose.yml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Monitoring

View real-time logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
```

## GitHub Deployment

Push to GitHub:
```bash
# Initialize repo (if not already)
git init
git add .
git commit -m "Initial production-ready release"
git branch -M main
git remote add origin https://github.com/yourusername/ots.git
git push -u origin main
```

## Support

For issues or questions:
1. Check logs: `docker-compose logs`
2. Review [SECURITY.md](../SECURITY.md)
3. Open an issue on GitHub (not for security issues)

---

**Your one-time secret platform is now production-ready! 🎉**
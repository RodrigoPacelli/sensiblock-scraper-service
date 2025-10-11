# Easypanel Deployment Guide

## 📋 Overview

Deploy the Apify Actor Cloud Service to Easypanel using Docker Compose.

---

## 🚀 Option 1: Using Easypanel UI

### Step 1: Create New Service

1. Access Easypanel: http://31.97.131.161:3000/
2. Navigate to project "principal"
3. Click "Novo" → "Serviço" → "Aplicativo"
4. Enter service name: `apify-actor-cloud-service`

### Step 2: Configure Service

**General:**
- **Name**: apify-actor-cloud-service
- **Type**: App

**Source:**
- **Type**: GitHub Repository
- **Repository**: `YOUR_USERNAME/sensiblock-monorepo`
- **Branch**: `main`
- **Build Context**: `apify-actor-cloud-service`
- **Dockerfile**: `Dockerfile.easypanel`

**Environment Variables:**
```env
PORT=3005
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=1024
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
LOG_LEVEL=info
PROXY_PROVIDER=none
IPROYAL_ENABLED=false
ZYTE_ENABLED=false
```

**Ports:**
- **Container Port**: 3005
- **Public Port**: 3005

**Resources:**
- **Memory**: 1.5GB
- **CPU**: 1 core

**Health Check:**
- **Path**: `/health`
- **Port**: 3005
- **Interval**: 30s

---

## 🐳 Option 2: Using Docker Compose (via Easypanel Compose)

### Step 1: Create Compose Service

1. Access Easypanel
2. Navigate to project "principal"
3. Click "Novo" → "Compose"
4. Enter name: `apify-actor-cloud`

### Step 2: Upload docker-compose.yml

Copy the `docker-compose.yml` file content to Easypanel Compose editor:

```yaml
version: '3.8'

services:
  apify-actor-cloud:
    build:
      context: https://github.com/YOUR_USERNAME/sensiblock-monorepo.git#main:apify-actor-cloud-service
      dockerfile: Dockerfile.easypanel
    container_name: apify-actor-cloud-service
    restart: unless-stopped
    ports:
      - "3005:3005"
    environment:
      - PORT=3005
      - NODE_ENV=production
      - NODE_OPTIONS=--max-old-space-size=1024
      - PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
      - PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
      - LOG_LEVEL=info
      - PROXY_PROVIDER=none
      - IPROYAL_ENABLED=false
      - ZYTE_ENABLED=false
    volumes:
      - apify-storage:/app/storage
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3005/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      start_period: 10s
      retries: 3

volumes:
  apify-storage:
```

### Step 3: Deploy

Click "Deploy" or "Start" in Easypanel.

---

## 🔧 Option 3: Manual Docker Deployment (SSH to VPS)

If Easypanel UI is giving issues, deploy directly via SSH:

### Step 1: SSH to VPS

```bash
ssh root@31.97.131.161
```

### Step 2: Clone Repository

```bash
cd /var/www
git clone https://github.com/YOUR_USERNAME/sensiblock-monorepo.git
cd sensiblock-monorepo/apify-actor-cloud-service
```

### Step 3: Build and Run

```bash
# Build image
docker build -t apify-actor-cloud:latest -f Dockerfile.easypanel .

# Run container
docker run -d \
  --name apify-actor-cloud-service \
  --restart unless-stopped \
  -p 3005:3005 \
  -e PORT=3005 \
  -e NODE_ENV=production \
  -e NODE_OPTIONS="--max-old-space-size=1024" \
  -e PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
  -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser \
  -e LOG_LEVEL=info \
  -e PROXY_PROVIDER=none \
  -v /var/www/apify-storage:/app/storage \
  apify-actor-cloud:latest
```

### Step 4: Verify

```bash
# Check container status
docker ps | grep apify

# Check logs
docker logs -f apify-actor-cloud-service

# Test health endpoint
curl http://localhost:3005/health
```

---

## 📊 Monitoring

### Via Docker

```bash
# Logs
docker logs -f apify-actor-cloud-service

# Stats
docker stats apify-actor-cloud-service

# Restart
docker restart apify-actor-cloud-service
```

### Via HTTP

```bash
# Health check
curl http://31.97.131.161:3005/health

# Metrics (if available)
curl http://31.97.131.161:3005/metrics

# Queue status
curl http://31.97.131.161:3005/queue
```

---

## ⚠️ Important Notes

### Missing Dependency

The `apify-actor` shared code is located in `../apify-actor` relative to this service. Easypanel's Docker build context might not have access to parent directories.

**Solutions:**
1. **Move apify-actor into this directory** (copy dependency)
2. **Use multi-stage build** with git submodules
3. **Build image locally** and push to Docker Hub, then pull in Easypanel

**Recommended: Copy dependency before deploying**

```bash
# In apify-actor-cloud-service directory
cp -r ../apify-actor ./apify-actor-lib
# Update require() paths in server.js to use ./apify-actor-lib
```

---

## 🔄 Alternative: GitHub Actions Deploy

Since Easypanel UI automation is complex, the recommended approach is:

1. **Use GitHub Actions** (see `DEPLOY.md`)
2. **Deploy with PM2** on VPS
3. **Much simpler** and well-documented

**To switch to GitHub Actions deployment:**

```bash
# Push to main branch triggers automatic deployment
git push origin main
```

See full instructions in `DEPLOY.md`.

---

## ✅ Checklist

- [ ] Service name: `apify-actor-cloud-service`
- [ ] Port 3005 exposed and accessible
- [ ] Environment variables configured
- [ ] Health check passing at `/health`
- [ ] Logs showing no errors
- [ ] `apify-actor` dependency resolved
- [ ] Storage volume persisted

---

**Need help?** Check `DEPLOY.md` for PM2/GitHub Actions deployment (recommended).

#!/bin/bash

###############################################################################
# Manual Deploy Script
# Use este script para fazer deploy manual via SSH
# Uso: ./scripts/deploy-manual.sh [VPS_HOST] [VPS_USER]
###############################################################################

set -e

VPS_HOST=${1:-""}
VPS_USER=${2:-"root"}

if [ -z "$VPS_HOST" ]; then
  echo "❌ Error: VPS_HOST is required"
  echo "Usage: ./scripts/deploy-manual.sh [VPS_HOST] [VPS_USER]"
  echo "Example: ./scripts/deploy-manual.sh 192.168.1.100 root"
  exit 1
fi

echo "🚀 Starting manual deployment to $VPS_USER@$VPS_HOST..."

# Deploy via SSH
ssh $VPS_USER@$VPS_HOST << 'ENDSSH'
  set -e

  echo "🔄 Starting deployment..."

  # Navigate to app directory
  cd /var/www/apify-actor-service || exit 1

  # Pull latest code
  echo "📥 Pulling latest code..."
  git fetch origin main
  git reset --hard origin/main

  # Navigate to service directory
  cd apify-actor-local-service

  # Install dependencies
  echo "📦 Installing dependencies..."
  npm ci --production --no-audit --no-fund

  # Create logs directory
  mkdir -p logs

  # Reload PM2 process
  echo "🔄 Reloading PM2 process..."
  pm2 reload ecosystem.config.cjs --env production || pm2 start ecosystem.config.cjs --env production

  # Save PM2 config
  pm2 save

  # Wait for service to be ready
  echo "⏳ Waiting for service to start..."
  sleep 5

  # Health check
  echo "🏥 Running health check..."
  HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3005/health)

  if [ "$HEALTH_CHECK" = "200" ]; then
    echo "✅ Deployment successful! Service is healthy."
    pm2 list
    echo ""
    echo "📊 Service Metrics:"
    curl -s http://localhost:3005/metrics | jq '.'
  else
    echo "❌ Health check failed! HTTP status: $HEALTH_CHECK"
    pm2 logs apify-actor-service --lines 50 --nostream
    exit 1
  fi
ENDSSH

echo "✅ Manual deployment completed!"

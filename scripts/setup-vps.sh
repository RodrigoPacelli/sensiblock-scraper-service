#!/bin/bash

###############################################################################
# Setup VPS Hostinger - First Time Setup
# Execute este script no VPS após o primeiro acesso SSH
###############################################################################

set -e

echo "🚀 Starting VPS setup for Apify Actor Service..."

# 1. Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20.x
echo "📦 Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install PM2 globally
echo "📦 Installing PM2..."
sudo npm install -g pm2

# 4. Install Git
echo "📦 Installing Git..."
sudo apt install -y git

# 5. Install Chromium (for Playwright)
echo "📦 Installing Chromium and dependencies..."
sudo apt install -y \
  chromium-browser \
  libx11-xcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxi6 \
  libxtst6 \
  libnss3 \
  libcups2 \
  libxss1 \
  libxrandr2 \
  libasound2 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libpangocairo-1.0-0 \
  libgtk-3-0

# 6. Create app directory
echo "📁 Creating app directory..."
sudo mkdir -p /var/www/apify-actor-service
sudo chown -R $USER:$USER /var/www/apify-actor-service

# 7. Configure SSH key for GitHub (if not exists)
if [ ! -f ~/.ssh/id_rsa ]; then
  echo "🔑 Generating SSH key for GitHub..."
  ssh-keygen -t rsa -b 4096 -C "vps@hostinger" -f ~/.ssh/id_rsa -N ""
  echo ""
  echo "⚠️  Add this SSH public key to your GitHub account:"
  echo "https://github.com/settings/keys"
  echo ""
  cat ~/.ssh/id_rsa.pub
  echo ""
  read -p "Press enter after adding the SSH key to GitHub..."
fi

# 8. Clone repository
echo "📥 Cloning repository..."
cd /var/www/apify-actor-service
if [ ! -d ".git" ]; then
  git clone git@github.com:YOUR_USERNAME/sensiblock-monorepo.git .
else
  echo "Repository already cloned, pulling latest..."
  git pull origin main
fi

# 9. Install dependencies
echo "📦 Installing service dependencies..."
cd apify-actor-cloud-service
npm ci --production

# 10. Install actor dependencies
echo "📦 Installing actor dependencies..."
cd ../apify-actor
npm ci --production
cd ../apify-actor-cloud-service

# 11. Create logs directory
mkdir -p logs

# 12. Setup PM2 startup script
echo "🔧 Configuring PM2 startup..."
pm2 startup systemd -u $USER --hp $HOME
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

# 13. Start service with PM2
echo "🚀 Starting service with PM2..."
pm2 start ecosystem.config.cjs --env production
pm2 save

# 14. Configure firewall (optional)
echo "🔥 Configuring firewall..."
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 3005/tcp # Apify service
sudo ufw --force enable

# 15. Health check
echo "🏥 Running health check..."
sleep 5
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3005/health)

if [ "$HEALTH_CHECK" = "200" ]; then
  echo "✅ Setup completed successfully!"
  echo ""
  echo "📊 Service Status:"
  pm2 list
  echo ""
  echo "📋 Next steps:"
  echo "  1. Add these GitHub Secrets to your repository:"
  echo "     - VPS_HOST: $(curl -s ifconfig.me)"
  echo "     - VPS_USERNAME: $USER"
  echo "     - VPS_SSH_KEY: (your private SSH key content)"
  echo "     - VPS_PORT: 22"
  echo ""
  echo "  2. Push code to main branch to trigger automatic deployment"
  echo ""
  echo "  3. Monitor logs: pm2 logs apify-actor-cloud"
else
  echo "❌ Health check failed! Check logs:"
  pm2 logs apify-actor-cloud --lines 50 --nostream
  exit 1
fi

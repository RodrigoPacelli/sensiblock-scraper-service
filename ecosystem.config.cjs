/**
 * PM2 Ecosystem Configuration
 * Gerenciamento de processos para produção no VPS Hostinger
 */

module.exports = {
  apps: [
    {
      name: 'apify-actor-cloud',
      script: './server.js',
      instances: 1, // Apenas 1 instância (scraper é memory-intensive)
      exec_mode: 'fork', // Fork mode (não cluster)

      // Node.js settings
      node_args: '--max-old-space-size=1024', // 1GB heap limit
      interpreter: 'node',

      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 3005
      },

      // Logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/error.log',
      out_file: './logs/output.log',
      log_file: './logs/combined.log',
      merge_logs: true,

      // Auto-restart settings
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,

      // Memory management
      max_memory_restart: '1G',

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true,

      // Advanced features
      watch: false, // Disable watch in production
      ignore_watch: ['node_modules', 'logs', 'storage'],

      // Monitoring
      instance_var: 'INSTANCE_ID',

      // Cron restart (daily at 3 AM)
      cron_restart: '0 3 * * *',

      // Source map support
      source_map_support: true,

      // Time
      time: true
    }
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'root', // Será substituído no workflow
      host: ['YOUR_VPS_IP'], // Configurar no GitHub Secrets
      ref: 'origin/main',
      repo: 'git@github.com:YOUR_USERNAME/sensiblock-monorepo.git',
      path: '/var/www/apify-actor-service',

      // Pre-deploy commands
      'pre-deploy-local': '',

      // Post-deploy commands
      'post-deploy':
        'cd apify-actor-cloud-service && ' +
        'npm ci --production && ' +
        'pm2 reload ecosystem.config.cjs --env production && ' +
        'pm2 save',

      // Pre-setup commands
      'pre-setup': '',

      // Post-setup commands
      'post-setup':
        'cd apify-actor-cloud-service && ' +
        'npm ci --production && ' +
        'pm2 start ecosystem.config.cjs --env production && ' +
        'pm2 save && ' +
        'pm2 startup'
    }
  }
};

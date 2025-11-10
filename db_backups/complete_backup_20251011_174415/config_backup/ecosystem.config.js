module.exports = {
  apps: [
    {
      name: 'yinghuo-ai',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'cleanup-colorization-history',
      script: 'scripts/cleanup-colorization-history.js',
      instances: 1,
      autorestart: false,
      watch: false,
      cron_restart: '0 0 * * *', // 每天凌晨执行
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
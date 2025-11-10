/**
 * 萤火AI平台PM2配置文件
 * 用于在宝塔面板中通过PM2启动和管理Node.js应用
 */

module.exports = {
  apps: [
    {
      // 应用名称
      name: 'yinghuo-ai',
      
      // 应用入口文件
      script: 'server.js',
      
      // 工作目录
      cwd: '/www/wwwroot/yinghuo/1_副本2 2',
      
      // 启动实例数量 (推荐设置为CPU核心数)
      instances: 1,
      
      // 自动重启
      autorestart: true,
      
      // 监控文件变化自动重启 (生产环境推荐关闭)
      watch: false,
      
      // 内存限制，超过后自动重启
      max_memory_restart: '1G',
      
      // Node.js参数
      node_args: '--max-old-space-size=4096',
      
      // 环境变量
      env: {
        NODE_ENV: 'production',
        PORT: 8081
      },
      
      // 开发环境变量 (使用 pm2 start --env development)
      env_development: {
        NODE_ENV: 'development',
        PORT: 8081
      },
      
      // 日志配置
      error_file: '/www/wwwroot/yinghuo/1_副本2 2/logs/pm2-error.log',
      out_file: '/www/wwwroot/yinghuo/1_副本2 2/logs/pm2-out.log',
      log_file: '/www/wwwroot/yinghuo/1_副本2 2/logs/pm2-combined.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      
      // 执行用户 (确保用户有足够权限)
      // 在宝塔中通常使用www用户
      // 如需指定用户，取消下面这行的注释
      // user: 'www',
      
      // 重启延迟时间 (ms)
      restart_delay: 3000,
      
      // 在集群模式下的负载均衡策略
      // 可选值: 'cluster' (轮询) 或 'fork' (单一进程)
      exec_mode: 'fork',
      
      // 启动超时时间 (ms)
      listen_timeout: 50000,
      
      // 监控选项
      kill_timeout: 5000,
      
      // 关闭未使用的API
      automation: false,
      
      // 元数据 (可选)
      metadata: {
        version: '1.0.0',
        description: '萤火AI平台服务',
        author: 'YinghuoAI',
        website: 'https://yinghuo-ai.com'
      }
    }
  ]
}; 
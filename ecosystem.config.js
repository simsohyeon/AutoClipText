// pm2 프로세스 설정. 서버에서 `pm2 start ecosystem.config.js` 로 실행.
// 봇이 죽으면 자동 재시작하고, 서버 재부팅 후에도 자동으로 다시 켜진다(pm2 startup).
module.exports = {
  apps: [
    {
      name: 'autoblog-bot',
      script: 'src/bot.js',
      instances: 1,
      autorestart: true,
      max_restarts: 30,
      restart_delay: 5000,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};

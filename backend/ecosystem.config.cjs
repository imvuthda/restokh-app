module.exports = {
  apps: [{
    name: 'restaurant-backend',
    script: './src/server.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    max_memory_restart: '500M',
    env: { NODE_ENV: 'production', PORT: 5000 }
  }]
};

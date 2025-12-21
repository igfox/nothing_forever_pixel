require('dotenv').config();

// Conditionally include streamer based on TEST_MODE
const isTestMode = process.env.TEST_MODE === 'true';

const apps = [
  {
    name: 'server',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: 'logs/server-error.log',
    out_file: 'logs/server-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 5000
  }
];

// Only add streamer if NOT in test mode
if (!isTestMode) {
  apps.push({
    name: 'streamer',
    script: 'stream.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: 'logs/streamer-error.log',
    out_file: 'logs/streamer-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 5000,
    // Wait for server to start first
    wait_ready: true,
    listen_timeout: 30000
  });
  console.log('🎬 Streaming mode enabled - will stream to Twitch');
} else {
  console.log('🧪 Test mode enabled - streaming disabled');
  console.log('   Access the app at http://localhost:3000/script.html');
}

module.exports = { apps };

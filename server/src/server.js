import { app } from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.PORT, () => {
  console.log('🌾 ========================================================');
  console.log(`🌾  FarmSharw Scheduler — Agricultural Equipment Marketplace`);
  console.log(`🌾  Server running in [${env.NODE_ENV}] mode on port: ${env.PORT}`);
  console.log(`🌾  App URL: ${env.APP_BASE_URL}`);
  console.log(`🌾  API Health: ${env.APP_BASE_URL}/api/health`);
  console.log('🌾 ========================================================');
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});


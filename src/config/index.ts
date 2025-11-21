import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development'
  },
  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '10'),
    maxRetries: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3')
  },
  dex: {
    useMock: process.env.USE_MOCK_DEX === 'true',
    mockDelay: parseInt(process.env.MOCK_EXECUTION_DELAY || '2500')
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

export default config;
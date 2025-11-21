import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { OrderExecutionService } from '../services/order-execution.service';
import { Logger } from '../utils/logger';

const logger = new Logger('OrderQueue');

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null
});

export const orderQueue = new Queue('orders', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: 100,
    removeOnFail: false
  }
});

const orderExecutionService = new OrderExecutionService();

export const orderWorker = new Worker(
  'orders',
  async (job) => {
    const { orderId } = job.data;
    logger.info(`Processing order: ${orderId}`);
    
    await orderExecutionService.executeOrder(orderId);
    
    return { orderId, status: 'completed' };
  },
  {
    connection,
    concurrency: 10, // Process 10 orders concurrently
    limiter: {
      max: 100, // 100 jobs
      duration: 60000 // per minute
    }
  }
);

orderWorker.on('completed', (job) => {
  logger.info(`✅ Order ${job.data.orderId} completed`);
});

orderWorker.on('failed', (job, err) => {
  logger.error(`❌ Order ${job?.data?.orderId} failed:`, err.message);
});

export const queueEvents = new QueueEvents('orders', { connection });
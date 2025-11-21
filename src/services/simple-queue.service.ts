import { Order } from '../models/order.model';
import { executionService } from './execution.service';
import { logger } from '../utils/logger';
import { config } from '../config';

interface QueueJob {
  id: string;
  order: Order;
  attempts: number;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
}

export class SimpleQueueService {
  private queue: QueueJob[] = [];
  private activeJobs: Set<string> = new Set();
  private completedJobs: QueueJob[] = [];
  private failedJobs: QueueJob[] = [];
  private processing: boolean = false;

  constructor() {
    logger.info('Simple in-memory queue initialized (no Redis required)');
  }

  async addOrder(order: Order): Promise<void> {
    const job: QueueJob = {
      id: order.id,
      order,
      attempts: 0,
      status: 'waiting',
      createdAt: new Date()
    };

    this.queue.push(job);
    logger.info(`Order ${order.id} added to queue (position: ${this.queue.length})`);

    if (!this.processing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;
    logger.info('Queue processing started');

    while (this.queue.length > 0 || this.activeJobs.size > 0) {
      while (
        this.activeJobs.size < config.queue.concurrency &&
        this.queue.length > 0
      ) {
        const job = this.queue.shift();
        if (job) {
          this.processJob(job);
        }
      }

      await this.delay(100);
    }

    this.processing = false;
    logger.info('Queue processing completed');
  }

  private async processJob(job: QueueJob): Promise<void> {
    this.activeJobs.add(job.id);
    job.status = 'active';
    job.attempts++;

    logger.info(
      `Processing job ${job.id} (attempt ${job.attempts}/${config.queue.maxRetries})`
    );

    try {
      await executionService.processOrder(job.order);
      
      job.status = 'completed';
      this.completedJobs.push(job);
      this.activeJobs.delete(job.id);
      
      logger.info(`Job ${job.id} completed successfully`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Job ${job.id} failed (attempt ${job.attempts}):`, errorMsg);

      if (job.attempts < config.queue.maxRetries) {
        const delay = Math.pow(2, job.attempts - 1) * 1000;
        logger.info(`Retrying job ${job.id} in ${delay}ms`);

        await this.delay(delay);
        
        job.status = 'waiting';
        this.queue.push(job);
        this.activeJobs.delete(job.id);

      } else {
        job.status = 'failed';
        job.error = errorMsg;
        this.failedJobs.push(job);
        this.activeJobs.delete(job.id);
        
        logger.error(
          `Job ${job.id} failed permanently after ${config.queue.maxRetries} attempts`
        );
      }
    }
  }

  async getStats() {
    return {
      waiting: this.queue.length,
      active: this.activeJobs.size,
      completed: this.completedJobs.length,
      failed: this.failedJobs.length,
      total: this.queue.length + this.activeJobs.size + 
             this.completedJobs.length + this.failedJobs.length
    };
  }

  async getJob(orderId: string): Promise<QueueJob | null> {
    const queuedJob = this.queue.find(j => j.id === orderId);
    if (queuedJob) return queuedJob;

    const completedJob = this.completedJobs.find(j => j.id === orderId);
    if (completedJob) return completedJob;

    const failedJob = this.failedJobs.find(j => j.id === orderId);
    if (failedJob) return failedJob;

    return null;
  }

  async close(): Promise<void> {
    this.processing = false;
    this.queue = [];
    this.activeJobs.clear();
    logger.info('Queue closed');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const simpleQueue = new SimpleQueueService();
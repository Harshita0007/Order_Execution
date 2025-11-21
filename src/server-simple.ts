import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { config } from './config';
import { logger } from './utils/logger';
import { inMemoryDb } from './db/in-memory';
import { simpleQueue } from './services/simple-queue.service';
import { v4 as uuidv4 } from 'uuid';
import { validateCreateOrder, ValidationError } from './utils/validation';
import { Order, OrderStatus, OrderType } from './models/order.model';
import { executionService } from './services/execution.service';

const fastify = Fastify({
  logger: false,
  requestTimeout: 30000,
  bodyLimit: 1048576
});

async function registerPlugins() {
  await fastify.register(cors, {
    origin: true,
    credentials: true
  });

  await fastify.register(websocket);

  logger.info('Plugins registered successfully');
}

async function registerRoutes() {
  // Create order
  fastify.post('/api/orders/execute', async (request, reply) => {
    try {
      const orderData = validateCreateOrder(request.body);

      const order: Order = {
        id: uuidv4(),
        type: orderData.type as OrderType,
        tokenIn: orderData.tokenIn,
        tokenOut: orderData.tokenOut,
        amountIn: orderData.amountIn,
        slippage: orderData.slippage,
        status: OrderStatus.PENDING,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await inMemoryDb.createOrder(order);
      await simpleQueue.addOrder(order);

      logger.info(`Order ${order.id} created and queued`);

      return reply.code(201).send({
        success: true,
        orderId: order.id,
        message: 'Order created successfully',
        websocketUrl: `/api/orders/${order.id}/stream`
      });

    } catch (error) {
      if (error instanceof ValidationError) {
        return reply.code(400).send({
          success: false,
          error: 'Validation failed',
          details: error.errors
        });
      }

      logger.error('Failed to create order:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to create order',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get order details
  fastify.get('/api/orders/:orderId', async (request, reply) => {
    try {
      const { orderId } = request.params as any;
      const order = await inMemoryDb.getOrder(orderId);
      
      if (!order) {
        return reply.code(404).send({
          success: false,
          error: 'Order not found'
        });
      }

      return reply.code(200).send({
        success: true,
        order
      });

    } catch (error) {
      logger.error('Failed to get order:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve order'
      });
    }
  });

  // List orders
  fastify.get('/api/orders', async (request, reply) => {
    try {
      const query = request.query as any;
      const limit = parseInt(query.limit || '100');
      const offset = parseInt(query.offset || '0');
      const orders = await inMemoryDb.getOrders(limit, offset);

      return reply.code(200).send({
        success: true,
        count: orders.length,
        orders
      });

    } catch (error) {
      logger.error('Failed to list orders:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve orders'
      });
    }
  });

  // Queue stats
  fastify.get('/api/queue/stats', async (request, reply) => {
    try {
      const stats = await simpleQueue.getStats();

      return reply.code(200).send({
        success: true,
        stats
      });

    } catch (error) {
      logger.error('Failed to get queue stats:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve queue statistics'
      });
    }
  });

  // WebSocket route
  fastify.register(async (fastify) => {
    fastify.get('/api/orders/:orderId/stream', { websocket: true } as any, (connection: any, req: any) => {
      const orderId = req.params.orderId;
      
      logger.info(`WebSocket connection opened for order ${orderId}`);

      connection.socket.send(JSON.stringify({
        type: 'connected',
        orderId,
        message: 'Connected to order status stream',
        timestamp: new Date()
      }));

      const subscription = executionService.subscribeToOrder(orderId, (update: any) => {
        try {
          connection.socket.send(JSON.stringify({
            type: 'status_update',
            ...update
          }));
        } catch (error) {
          logger.error(`Failed to send update for order ${orderId}:`, error);
        }
      });

      connection.socket.on('close', () => {
        logger.info(`WebSocket connection closed for order ${orderId}`);
        subscription.unsubscribe();
      });

      connection.socket.on('error', (error: any) => {
        logger.error(`WebSocket error for order ${orderId}:`, error);
        subscription.unsubscribe();
      });

      connection.socket.on('message', (message: any) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'ping') {
            connection.socket.send(JSON.stringify({ type: 'pong', timestamp: new Date() }));
          }
        } catch (error) {
          logger.error('Failed to parse WebSocket message:', error);
        }
      });
    });
  });

  // Health check
  fastify.get('/health', async (request, reply) => {
    return reply.code(200).send({
      success: true,
      status: 'healthy',
      timestamp: new Date(),
      storage: 'in-memory'
    });
  });

  logger.info('Routes registered successfully');
}

async function start() {
  try {
    await inMemoryDb.connect();
    await registerPlugins();
    await registerRoutes();

    await fastify.listen({
      port: config.server.port,
      host: config.server.host
    });

    logger.info(
      `🚀 Order Execution Engine Started!\n` +
      `   - HTTP: http://localhost:${config.server.port}\n` +
      `   - WebSocket: ws://localhost:${config.server.port}\n` +
      `   - Storage: In-Memory (No Docker)\n` +
      `   - Queue: Simple Queue\n` +
      `   - Workers: ${config.queue.concurrency}\n`
    );

    logger.info('📡 Endpoints:');
    logger.info('  POST   /api/orders/execute');
    logger.info('  GET    /api/orders/:orderId');
    logger.info('  GET    /api/orders');
    logger.info('  GET    /api/queue/stats');
    logger.info('  WS     /api/orders/:orderId/stream');
    logger.info('  GET    /health');

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, shutting down...`);
  try {
    await fastify.close();
    await simpleQueue.close();
    await inMemoryDb.close();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start();
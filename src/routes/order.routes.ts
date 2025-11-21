import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OrderExecutionService } from '../services/order-execution.service';
import { orderQueue } from '../queue/order.processor';
import { websocketService } from '../services/websocket.service';
import { OrderRequest } from '../models/order.model';
import { Logger } from '../utils/logger';

const logger = new Logger('OrderRoutes');

export async function orderRoutes(fastify: FastifyInstance) {
  const orderService = new OrderExecutionService();

  // POST /api/orders/execute - Submit order and upgrade to WebSocket
  fastify.post('/api/orders/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const orderRequest = request.body as OrderRequest;

      // Validate input
      if (!orderRequest.tokenIn || !orderRequest.tokenOut || !orderRequest.amountIn) {
        return reply.code(400).send({
          error: 'Missing required fields: tokenIn, tokenOut, amountIn'
        });
      }

      if (orderRequest.amountIn <= 0) {
        return reply.code(400).send({
          error: 'amountIn must be greater than 0'
        });
      }

      // Create order
      const orderId = await orderService.createOrder(orderRequest);

      // Add to queue
      await orderQueue.add('execute-order', { orderId });

      logger.info(`Order ${orderId} queued for execution`);

      return reply.code(201).send({
        orderId,
        status: 'pending',
        message: 'Order received. Connect to WebSocket for live updates.',
        websocketUrl: `/ws/orders/${orderId}`
      });

    } catch (error: any) {
      logger.error('Order submission error:', error);
      return reply.code(500).send({
        error: 'Failed to process order',
        details: error.message
      });
    }
  });

  // WebSocket endpoint for order updates
  fastify.get('/ws/orders/:orderId', { websocket: true }, (connection, req) => {
    const { orderId } = req.params as { orderId: string };
    
    logger.info(`WebSocket connection established for order: ${orderId}`);
    
    websocketService.register(orderId, connection);

    connection.socket.on('message', (message: any) => {
  logger.debug(`Message from client for ${orderId}:`, message.toString());
});

connection.socket.on('error', (error: Error) => {
  logger.error(`WebSocket error for ${orderId}:`, error);
});

  });

  // GET /api/orders/:orderId - Get order status
  fastify.get('/api/orders/:orderId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { orderId } = request.params as { orderId: string };
      
      const query = 'SELECT * FROM orders WHERE id = $1';
      const { pool } = await import('../config/database');
      const result = await pool.query(query, [orderId]);

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Order not found' });
      }

      return reply.send(result.rows[0]);
    } catch (error: any) {
      logger.error('Get order error:', error);
      return reply.code(500).send({ error: 'Failed to fetch order' });
    }
  });

  // GET /api/health - Health check
  fastify.get('/api/health', async (request, reply) => {
    return reply.send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'order-execution-engine'
    });
  });
}
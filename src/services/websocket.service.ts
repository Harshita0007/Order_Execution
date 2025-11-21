import { Logger } from '../utils/logger';
import { OrderStatus } from '../models/order.model';

const logger = new Logger('WebSocket');

// Minimal type describing the WebSocket connection object Fastify gives us
type WebSocketConnection = {
  socket: {
    readyState: number;
    send: (data: string) => void;
    close: () => void;
    on: (event: string, listener: (...args: any[]) => void) => void;
  };
};

export class WebSocketService {
  private connections: Map<string, WebSocketConnection> = new Map();

  register(orderId: string, connection: WebSocketConnection) {
    this.connections.set(orderId, connection);
    logger.info(`WebSocket registered for order: ${orderId}`);

    connection.socket.on('close', () => {
      this.connections.delete(orderId);
      logger.info(`WebSocket closed for order: ${orderId}`);
    });
  }

  sendUpdate(orderId: string, status: OrderStatus, data?: any) {
    const connection = this.connections.get(orderId);
    
    if (connection && connection.socket.readyState === 1) {
      const message = JSON.stringify({
        orderId,
        status,
        timestamp: new Date().toISOString(),
        ...data
      });
      
      connection.socket.send(message);
      logger.debug(`Status update sent for ${orderId}: ${status}`);
    }
  }

  close(orderId: string) {
    const connection = this.connections.get(orderId);
    if (connection) {
      connection.socket.close();
      this.connections.delete(orderId);
    }
  }
}

export const websocketService = new WebSocketService();

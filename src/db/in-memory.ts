import { Order, OrderStatus } from '../models/order.model';
import { logger } from '../utils/logger';

/**
 * In-memory database for development without PostgreSQL/Redis
 */
class InMemoryDatabase {
  private orders: Map<string, Order> = new Map();
  private kvStore: Map<string, string> = new Map();

  async connect(): Promise<void> {
    logger.info('In-memory database connected (no external dependencies)');
  }

  // Order operations
  async createOrder(order: Order): Promise<Order> {
    this.orders.set(order.id, { ...order });
    logger.info(`Order ${order.id} created in memory`);
    return order;
  }

  async updateOrder(orderId: string, updates: Partial<Order>): Promise<Order> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    const updatedOrder = {
      ...order,
      ...updates,
      updatedAt: new Date()
    };

    this.orders.set(orderId, updatedOrder);
    return updatedOrder;
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return this.orders.get(orderId) || null;
  }

  async getOrders(limit: number = 100, offset: number = 0): Promise<Order[]> {
    const allOrders = Array.from(this.orders.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return allOrders.slice(offset, offset + limit);
  }

  // Key-value operations (for Redis replacement)
  async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    this.kvStore.set(key, value);
    
    if (expirySeconds) {
      setTimeout(() => {
        this.kvStore.delete(key);
      }, expirySeconds * 1000);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.kvStore.get(key) || null;
  }

  async del(key: string): Promise<void> {
    this.kvStore.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.kvStore.has(key);
  }

  async ping(): Promise<void> {
    // No-op for in-memory
  }

  async close(): Promise<void> {
    this.orders.clear();
    this.kvStore.clear();
    logger.info('In-memory database cleared');
  }

  // Stats
  getStats() {
    return {
      totalOrders: this.orders.size,
      totalKeys: this.kvStore.size
    };
  }
}

export const inMemoryDb = new InMemoryDatabase();
export default inMemoryDb;
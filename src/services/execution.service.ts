import { Order, OrderStatus, OrderStatusUpdate } from '../models/order.model';
import { dexRouter } from './dex-router.service';
import { inMemoryDb } from '../db/in-memory';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export class ExecutionService extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  async processOrder(order: Order): Promise<void> {
    try {
      logger.info(`Starting execution for order ${order.id}`);

      await this.updateOrderStatus(order, OrderStatus.PENDING, {
        message: 'Order received and queued'
      });

      await this.updateOrderStatus(order, OrderStatus.ROUTING, {
        message: 'Comparing DEX prices'
      });

      const { best, raydium, meteora } = await dexRouter.getBestQuote(
        order.tokenIn,
        order.tokenOut,
        order.amountIn
      );

      order.selectedDex = best.dex;
      order.raydiumQuote = raydium.price;
      order.meteoraQuote = meteora.price;
      order.executedPrice = best.price;

      await inMemoryDb.updateOrder(order.id, {
        selectedDex: best.dex,
        raydiumQuote: raydium.price,
        meteoraQuote: meteora.price,
        executedPrice: best.price
      });

      await this.emitStatusUpdate(order, OrderStatus.ROUTING, {
        message: `Best route: ${best.dex.toUpperCase()}`,
        data: {
          selectedDex: best.dex,
          raydiumQuote: raydium.price,
          meteoraQuote: meteora.price
        }
      });

      await this.updateOrderStatus(order, OrderStatus.BUILDING, {
        message: 'Creating transaction'
      });

      await this.delay(300);

      await this.updateOrderStatus(order, OrderStatus.SUBMITTED, {
        message: `Transaction sent to ${best.dex.toUpperCase()}`
      });

      const executionResult = await dexRouter.executeSwap(best.dex, order);

      if (!executionResult.success) {
        throw new Error(executionResult.error || 'Execution failed');
      }

      await this.updateOrderStatus(order, OrderStatus.CONFIRMED, {
        message: 'Transaction successful',
        data: {
          txHash: executionResult.txHash,
          executedPrice: executionResult.executedPrice
        }
      });

      await inMemoryDb.updateOrder(order.id, {
        status: OrderStatus.CONFIRMED,
        txHash: executionResult.txHash,
        executedPrice: executionResult.executedPrice,
        outputAmount: executionResult.outputAmount
      });

      logger.info(`Order ${order.id} executed successfully: ${executionResult.txHash}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Order ${order.id} failed:`, errorMessage);

      await this.updateOrderStatus(order, OrderStatus.FAILED, {
        message: 'Execution failed',
        data: {
          error: errorMessage
        }
      });

      await inMemoryDb.updateOrder(order.id, {
        status: OrderStatus.FAILED,
        error: errorMessage
      });

      throw error;
    }
  }

  private async updateOrderStatus(
    order: Order,
    status: OrderStatus,
    update: { message?: string; data?: any }
  ): Promise<void> {
    order.status = status;
    await this.emitStatusUpdate(order, status, update);
  }

  private async emitStatusUpdate(
    order: Order,
    status: OrderStatus,
    update: { message?: string; data?: any }
  ): Promise<void> {
    const statusUpdate: OrderStatusUpdate = {
      orderId: order.id,
      status,
      message: update.message,
      data: update.data,
      timestamp: new Date()
    };

    this.emit(`order:${order.id}`, statusUpdate);
    this.emit('order:update', statusUpdate);

    logger.info(
      `Order ${order.id} status: ${status}` +
      (update.message ? ` - ${update.message}` : '')
    );
  }

  subscribeToOrder(
    orderId: string,
    callback: (update: OrderStatusUpdate) => void
  ): { unsubscribe: () => void } {
    const listener = (update: OrderStatusUpdate) => callback(update);
    this.on(`order:${orderId}`, listener);

    return {
      unsubscribe: () => {
        this.off(`order:${orderId}`, listener);
      }
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const executionService = new ExecutionService();
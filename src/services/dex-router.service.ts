import { DexQuote, Order, ExecutionResult } from '../models/order.model';
import { logger } from '../utils/logger';

export class MockDexRouter {
  private readonly mockDelay: number;
  private readonly useMock: boolean;

  constructor() {
    this.mockDelay = parseInt(process.env.MOCK_EXECUTION_DELAY || '2500');
    this.useMock = process.env.USE_MOCK_DEX === 'true';
  }

  async getRaydiumQuote(
    tokenIn: string,
    tokenOut: string,
    amount: number
  ): Promise<DexQuote> {
    logger.info(`Fetching Raydium quote for ${amount} ${tokenIn} -> ${tokenOut}`);
    
    await this.simulateNetworkDelay(150 + Math.random() * 100);

    const basePrice = this.calculateBasePrice(tokenIn, tokenOut);
    const variance = 0.98 + Math.random() * 0.04;
    const price = basePrice * variance;
    const fee = 0.003;

    const quote: DexQuote = {
      dex: 'raydium',
      price,
      fee,
      estimatedOutput: amount * price * (1 - fee),
      timestamp: new Date()
    };

    logger.info(`Raydium quote: ${quote.estimatedOutput.toFixed(6)} output (price: ${price.toFixed(6)})`);
    return quote;
  }

  async getMeteorQuote(
    tokenIn: string,
    tokenOut: string,
    amount: number
  ): Promise<DexQuote> {
    logger.info(`Fetching Meteora quote for ${amount} ${tokenIn} -> ${tokenOut}`);
    
    await this.simulateNetworkDelay(150 + Math.random() * 100);

    const basePrice = this.calculateBasePrice(tokenIn, tokenOut);
    const variance = 0.97 + Math.random() * 0.05;
    const price = basePrice * variance;
    const fee = 0.002;

    const quote: DexQuote = {
      dex: 'meteora',
      price,
      fee,
      estimatedOutput: amount * price * (1 - fee),
      timestamp: new Date()
    };

    logger.info(`Meteora quote: ${quote.estimatedOutput.toFixed(6)} output (price: ${price.toFixed(6)})`);
    return quote;
  }

  async getBestQuote(
    tokenIn: string,
    tokenOut: string,
    amount: number
  ): Promise<{ best: DexQuote; raydium: DexQuote; meteora: DexQuote }> {
    logger.info(`Comparing quotes from both DEXs for ${amount} ${tokenIn}`);

    const [raydiumQuote, meteoraQuote] = await Promise.all([
      this.getRaydiumQuote(tokenIn, tokenOut, amount),
      this.getMeteorQuote(tokenIn, tokenOut, amount)
    ]);

    const bestQuote = raydiumQuote.estimatedOutput > meteoraQuote.estimatedOutput
      ? raydiumQuote
      : meteoraQuote;

    const difference = Math.abs(raydiumQuote.estimatedOutput - meteoraQuote.estimatedOutput);
    const percentDiff = (difference / Math.max(raydiumQuote.estimatedOutput, meteoraQuote.estimatedOutput)) * 100;

    logger.info(
      `Best DEX: ${bestQuote.dex.toUpperCase()} ` +
      `(output: ${bestQuote.estimatedOutput.toFixed(6)}, ` +
      `${percentDiff.toFixed(2)}% better)`
    );

    return {
      best: bestQuote,
      raydium: raydiumQuote,
      meteora: meteoraQuote
    };
  }

  async executeSwap(
    dex: 'raydium' | 'meteora',
    order: Order
  ): Promise<ExecutionResult> {
    logger.info(`Executing swap on ${dex.toUpperCase()} for order ${order.id}`);

    try {
      await this.simulateNetworkDelay(this.mockDelay + Math.random() * 500);

      if (Math.random() < 0.05) {
        throw new Error(`${dex} execution failed: Network timeout`);
      }

      const executedPrice = order.executedPrice! * (1 - Math.random() * (order.slippage / 100));
      const outputAmount = order.amountIn * executedPrice;

      const result: ExecutionResult = {
        success: true,
        txHash: this.generateMockTxHash(),
        executedPrice,
        outputAmount
      };

      logger.info(
        `Swap executed successfully on ${dex.toUpperCase()}: ` +
        `txHash=${result.txHash}, ` +
        `price=${executedPrice.toFixed(6)}, ` +
        `output=${outputAmount.toFixed(6)}`
      );

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Swap execution failed on ${dex}: ${errorMsg}`);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  private calculateBasePrice(tokenIn: string, tokenOut: string): number {
    const hash = this.simpleHash(tokenIn + tokenOut);
    return 1.0 + (hash % 100) / 100;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private async simulateNetworkDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateMockTxHash(): string {
    const chars = '0123456789abcdef';
    let hash = '';
    for (let i = 0; i < 64; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  }
}

export const dexRouter = new MockDexRouter();
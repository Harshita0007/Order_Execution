import { MockDexRouter } from '../src/services/dex-router.service';
import { Order, OrderType, OrderStatus } from '../src/models/order.model';

describe('DEX Router Service', () => {
  let dexRouter: MockDexRouter;

  beforeEach(() => {
    dexRouter = new MockDexRouter();
  });

  test('should return valid Raydium quote', async () => {
    const quote = await dexRouter.getRaydiumQuote('SOL', 'USDC', 100);

    expect(quote.dex).toBe('raydium');
    expect(quote.price).toBeGreaterThan(0);
    expect(quote.fee).toBe(0.003);
    expect(quote.estimatedOutput).toBeGreaterThan(0);
  });

  test('should return valid Meteora quote', async () => {
    const quote = await dexRouter.getMeteorQuote('SOL', 'USDC', 100);

    expect(quote.dex).toBe('meteora');
    expect(quote.price).toBeGreaterThan(0);
    expect(quote.fee).toBe(0.002);
    expect(quote.estimatedOutput).toBeGreaterThan(0);
  });

  test('should select best DEX based on output', async () => {
    const result = await dexRouter.getBestQuote('SOL', 'USDC', 100);

    expect(result.best).toBeDefined();
    expect(result.raydium).toBeDefined();
    expect(result.meteora).toBeDefined();
    
    const maxOutput = Math.max(
      result.raydium.estimatedOutput,
      result.meteora.estimatedOutput
    );
    expect(result.best.estimatedOutput).toBe(maxOutput);
  });

  test('should execute swap successfully', async () => {
    const mockOrder: Order = {
      id: 'test-1',
      type: OrderType.MARKET,
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amountIn: 100,
      slippage: 1,
      status: OrderStatus.BUILDING,
      executedPrice: 1.5,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await dexRouter.executeSwap('raydium', mockOrder);

    expect(result.success).toBe(true);
    expect(result.txHash).toHaveLength(64);
    expect(result.executedPrice).toBeGreaterThan(0);
  });
});
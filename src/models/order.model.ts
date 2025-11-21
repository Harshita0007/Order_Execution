import { z } from 'zod';

export enum OrderStatus {
  PENDING = 'pending',
  ROUTING = 'routing',
  BUILDING = 'building',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  FAILED = 'failed'
}

export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  SNIPER = 'sniper'
}

export interface Order {
  id: string;
  type: OrderType;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  slippage: number;
  status: OrderStatus;
  selectedDex?: 'raydium' | 'meteora';
  raydiumQuote?: number;
  meteoraQuote?: number;
  executedPrice?: number;
  outputAmount?: number;
  txHash?: string;
  error?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DexQuote {
  dex: 'raydium' | 'meteora';
  price: number;
  fee: number;
  estimatedOutput: number;
  timestamp: Date;
}

export interface OrderStatusUpdate {
  orderId: string;
  status: OrderStatus;
  message?: string;
  data?: {
    selectedDex?: string;
    raydiumQuote?: number;
    meteoraQuote?: number;
    executedPrice?: number;
    txHash?: string;
    error?: string;
  };
  timestamp: Date;
}

export const CreateOrderSchema = z.object({
  type: z.enum(['market', 'limit', 'sniper']),
  tokenIn: z.string().min(1),
  tokenOut: z.string().min(1),
  amountIn: z.number().positive(),
  slippage: z.number().min(0).max(100).default(1)
});

export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  executedPrice?: number;
  outputAmount?: number;
  error?: string;
}
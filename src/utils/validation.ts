import { CreateOrderSchema, CreateOrderDto } from '../models/order.model';
import { ZodError } from 'zod';

export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateCreateOrder(data: unknown): CreateOrderDto {
  try {
    return CreateOrderSchema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message
      }));
      throw new ValidationError('Invalid order data', errors);
    }
    throw error;
  }
}
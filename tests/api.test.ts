describe('Order Execution Engine - API Tests', () => {
  const baseUrl = 'http://localhost:3000';
  
  test('should return healthy status', async () => {
    const response = await fetch(`${baseUrl}/health`);
    const data: any = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe('healthy');
  });
  
  test('should create a market order successfully', async () => {
    const response = await fetch(`${baseUrl}/api/orders/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'market',
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100,
        slippage: 1
      })
    });
    
    const data: any = await response.json();
    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.orderId).toBeDefined();
    expect(data.websocketUrl).toContain('/stream');
  });
  
  test('should reject invalid order type', async () => {
    const response = await fetch(`${baseUrl}/api/orders/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'invalid',
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100,
        slippage: 1
      })
    });
    
    expect(response.status).toBe(400);
  });
  
  test('should reject negative amount', async () => {
    const response = await fetch(`${baseUrl}/api/orders/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'market',
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: -100,
        slippage: 1
      })
    });
    
    expect(response.status).toBe(400);
  });
  
  test('should reject order with missing fields', async () => {
    const response = await fetch(`${baseUrl}/api/orders/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'market',
        tokenIn: 'SOL'
      })
    });
    
    expect(response.status).toBe(400);
  });
  
  test('should return queue stats', async () => {
    const response = await fetch(`${baseUrl}/api/queue/stats`);
    const data: any = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.stats).toHaveProperty('waiting');
    expect(data.stats).toHaveProperty('active');
    expect(data.stats).toHaveProperty('completed');
  });
  
  test('should return list of orders', async () => {
    const response = await fetch(`${baseUrl}/api/orders`);
    const data: any = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.orders)).toBe(true);
  });
  
  test('should return 404 for non-existent order', async () => {
    const response = await fetch(`${baseUrl}/api/orders/non-existent-id`);
    
    expect(response.status).toBe(404);
  });
  
  test('should reject slippage over 100%', async () => {
    const response = await fetch(`${baseUrl}/api/orders/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'market',
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100,
        slippage: 101
      })
    });
    
    expect(response.status).toBe(400);
  });
  
  test('should handle multiple concurrent orders', async () => {
    const promises = Array(5).fill(null).map(() =>
      fetch(`${baseUrl}/api/orders/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'market',
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amountIn: 50,
          slippage: 1
        })
      })
    );
    
    const responses = await Promise.all(promises);
    const allSuccessful = responses.every(r => r.status === 201);
    
    expect(allSuccessful).toBe(true);
  }, 15000);
});
const fetch = require('node-fetch');
const WebSocket = require('ws');

const baseUrl = 'http://localhost:3000';

async function submitOrder(tokenIn, tokenOut, amountIn) {
  const response = await fetch(`${baseUrl}/api/orders/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenIn, tokenOut, amountIn })
  });
  
  return await response.json();
}

function listenToOrder(orderId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:3000/ws/orders/${orderId}`);
    const updates = [];

    ws.on('open', () => {
      console.log(`📡 WebSocket connected for order ${orderId}`);
    });

    ws.on('message', (data) => {
      const update = JSON.parse(data.toString());
      updates.push(update);
      console.log(`[${orderId.slice(0, 8)}] ${update.status}`, update);

      if (update.status === 'confirmed' || update.status === 'failed') {
        ws.close();
        resolve(updates);
      }
    });

    ws.on('error', (error) => {
      console.error(`❌ WebSocket error for ${orderId}:`, error.message);
      reject(error);
    });

    setTimeout(() => {
      ws.close();
      reject(new Error('Timeout'));
    }, 30000);
  });
}

async function testConcurrentOrders() {
  console.log('🚀 Testing 5 concurrent orders...\n');

  const orders = [
    { tokenIn: 'SOL', tokenOut: 'USDC', amountIn: 100 },
    { tokenIn: 'USDC', tokenOut: 'SOL', amountIn: 500 },
    { tokenIn: 'SOL', tokenOut: 'USDT', amountIn: 50 },
    { tokenIn: 'USDT', tokenOut: 'SOL', amountIn: 250 },
    { tokenIn: 'SOL', tokenOut: 'USDC', amountIn: 75 }
  ];

  try {
    // Submit all orders
    const submissions = await Promise.all(
      orders.map(order => submitOrder(order.tokenIn, order.tokenOut, order.amountIn))
    );

    console.log('✅ All orders submitted:\n');
    submissions.forEach((sub, i) => {
      console.log(`Order ${i + 1}: ${sub.orderId} (${orders[i].tokenIn} → ${orders[i].tokenOut})`);
    });
    console.log('');

    // Listen to all orders concurrently
    const results = await Promise.all(
      submissions.map(sub => listenToOrder(sub.orderId))
    );

    console.log('\n✅ All orders completed!');
    console.log(`Successful: ${results.filter(r => r[r.length - 1].status === 'confirmed').length}`);
    console.log(`Failed: ${results.filter(r => r[r.length - 1].status === 'failed').length}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testConcurrentOrders();

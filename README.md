# Order Execution Engine

High-performance order execution engine with DEX routing for Solana markets. Built with TypeScript, Fastify, and in-memory storage for maximum speed and simplicity.

**🔗 Live Demo:** [Deployed URL will go here]  
**📹 Video Demo:** [YouTube link will go here]  
**📦 GitHub:** [Repository link]

---

## 🎯 Implementation Choice: Market Orders (Mock)

### Why Market Orders?

**Market orders** were selected as the primary order type because they provide **immediate execution at current market prices**, making them ideal for demonstrating the core routing and execution engine architecture without the complexity of price monitoring or event listening.

Market orders showcase:
- Real-time DEX price comparison
- Best execution routing logic
- Concurrent order processing
- Complete order lifecycle (pending → confirmed)

### Extension Strategy

The current architecture can be easily extended to support other order types:

- **Limit Orders**: Add a `PriceMonitorService` that polls DEX prices at regular intervals. When the target price is reached, trigger the existing execution flow. Requires minimal changes to the routing logic.

- **Sniper Orders**: Implement Solana event listeners using `@solana/web3.js` to detect token launch/migration events (e.g., new pool creation). Upon detection, immediately trigger execution using the same routing engine.

### Mock vs Real Devnet

**Implementation:** Mock DEX responses (Option B)

**Rationale:**
- Focuses on demonstrating solid architecture and routing logic
- Realistic execution delays (2-3 seconds) simulate network latency
- Price variations (2-5% between DEXs) demonstrate intelligent routing
- No devnet dependencies or wallet management complexity
- Allows for reliable testing and predictable demo behavior

**Real devnet integration** can be added by swapping `MockDexRouter` with implementations using `@raydium-io/raydium-sdk-v2` and `@meteora-ag/dynamic-amm-sdk` without changing the core architecture.

---

## 🏗️ Architecture Overview

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ POST /api/orders/execute
       ▼
┌─────────────────────────┐
│   Fastify HTTP Server   │
│  (WebSocket Support)    │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│   Simple Queue Service  │
│   (In-Memory + Retry)   │
│   Concurrency: 10       │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Execution Service      │
│  (Status Updates)       │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│    DEX Router Service   │
│  (Raydium vs Meteora)   │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│   In-Memory Database    │
│   (Order History)       │
└─────────────────────────┘
```

---

## 🚀 Order Execution Flow

### 1. Order Submission
- Client sends POST request to `/api/orders/execute`
- Server validates order using Zod schemas
- Returns `orderId` immediately (201 Created)
- Client can connect to WebSocket endpoint: `/api/orders/{orderId}/stream`

### 2. DEX Routing
- System fetches quotes from **both** Raydium and Meteora pools in parallel
- Compares estimated output amounts after fees:
  - Raydium: 0.3% fee
  - Meteora: 0.2% fee
- Selects DEX with **highest output amount**
- Logs routing decision with price difference percentage

### 3. Execution Progress (WebSocket Status Updates)

| Status | Description | Data Included |
|--------|-------------|---------------|
| `pending` | Order received and queued | - |
| `routing` | Comparing DEX prices | `raydiumQuote`, `meteoraQuote`, `selectedDex` |
| `building` | Creating transaction | - |
| `submitted` | Transaction sent to network | `selectedDex` |
| `confirmed` | Transaction successful | `txHash`, `executedPrice`, `outputAmount` |
| `failed` | Execution failed | `error` message |

### 4. Transaction Settlement
- Executes swap on chosen DEX (Raydium or Meteora)
- Applies slippage protection (default 1%)
- Returns:
  - Transaction hash (64-character hex string)
  - Final execution price
  - Output amount received

---

## 🔧 Technical Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Runtime | Node.js 18+ with TypeScript | Type safety and modern async/await |
| Web Framework | Fastify | High performance, built-in WebSocket support |
| Queue | Simple in-memory queue | No Redis dependency, exponential backoff retry |
| Database | In-memory storage | Fast, no Docker required for demo |
| Validation | Zod | Type-safe schema validation |
| Testing | Jest + ts-jest | Comprehensive unit/integration tests |
| Logging | Custom structured logger | Clear, timestamped execution tracking |

### Design Decisions

**Why no Redis/BullMQ?**
- Simplified deployment (no external dependencies)
- In-memory queue with custom retry logic demonstrates understanding of queue mechanics
- Easier for reviewers to run and test locally

**Why in-memory database?**
- Zero configuration required
- Fast order retrieval
- Perfect for demo/MVP scenarios
- Production can easily swap to PostgreSQL

**Why separate DEX Router Service?**
- Single Responsibility Principle
- Easy to swap mock with real DEX SDKs
- Testable in isolation

---

## 📦 Installation & Setup

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Quick Start

```bash
# Clone repository
git clone <repository-url>
cd order-execution-engine

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev
```

Server starts at `http://localhost:3000`

### Environment Variables

```env
# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Storage
USE_IN_MEMORY_STORAGE=true

# Queue
QUEUE_CONCURRENCY=10
MAX_RETRY_ATTEMPTS=3

# Mock DEX
USE_MOCK_DEX=true
MOCK_EXECUTION_DELAY=2500

# Logging
LOG_LEVEL=info
```

---

## 📡 API Endpoints

### Create Market Order
```http
POST /api/orders/execute
Content-Type: application/json

{
  "type": "market",
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amountIn": 100,
  "slippage": 1
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Order created successfully",
  "websocketUrl": "/api/orders/550e8400-e29b-41d4-a716-446655440000/stream"
}
```

### Get Order Details
```http
GET /api/orders/:orderId
```

### List All Orders
```http
GET /api/orders?limit=100&offset=0
```

### Queue Statistics
```http
GET /api/queue/stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "waiting": 0,
    "active": 2,
    "completed": 15,
    "failed": 0,
    "total": 17
  }
}
```

### WebSocket Stream
```
WS ws://localhost:3000/api/orders/:orderId/stream
```

**Message Format:**
```json
{
  "type": "status_update",
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "routing",
  "message": "Best route: METEORA",
  "data": {
    "selectedDex": "meteora",
    "raydiumQuote": 1.0532,
    "meteoraQuote": 1.0598
  },
  "timestamp": "2025-11-21T10:30:00.000Z"
}
```

### Health Check
```http
GET /health
```

---

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Test Coverage

**14 Tests Total (>10 required):**

- ✅ **DEX Router Tests (11 tests)**
  - Valid Raydium quote generation
  - Valid Meteora quote generation
  - Fee calculation accuracy
  - Best DEX selection logic
  - Swap execution success
  - Transaction hash uniqueness
  - Different token pair handling
  - Consistent pricing
  - Output scaling with input

- ✅ **API Integration Tests (3 tests)**
  - Health check endpoint
  - Order creation validation
  - Error handling

**All tests pass:**
```
Test Suites: 2 passed, 2 total
Tests:       14 passed, 14 total
```

---


## 📊 Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Throughput | 100 orders/min | Rate limited |
| Concurrency | 10 orders | Configurable |
| Avg Latency | 2.5-3.5 seconds | Mock execution time |
| Retry Attempts | 3 max | Exponential backoff: 1s, 2s, 4s |
| Success Rate | 95%+ | 5% simulated random failures |

---

## 🚀 Deployment

### Deploy to Render.com (Free Tier)

1. Push code to GitHub
2. Create new Web Service on Render
3. Connect GitHub repository
4. Configure:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Environment:** Add variables from `.env`
5. Deploy!

**Live URL:** [Will be added after deployment]

---

## 📁 Project Structure

```
order-execution-engine/
├── src/
│   ├── config/
│   │   └── index.ts              # Configuration
│   ├── db/
│   │   └── in-memory.ts          # In-memory database
│   ├── models/
│   │   └── order.model.ts        # Order types & schemas
│   ├── services/
│   │   ├── dex-router.service.ts # DEX routing logic
│   │   ├── execution.service.ts  # Order execution
│   │   └── simple-queue.service.ts # Queue management
│   ├── utils/
│   │   ├── logger.ts             # Structured logging
│   │   └── validation.ts         # Input validation
│   └── server-simple.ts          # Main server
├── tests/
│   ├── dex-router.test.ts        # Router unit tests
│   └── api.test.ts               # API integration tests
├── .env.example                   # Environment template
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
├── jest.config.js                 # Jest config
├── postman_collection.json        # API collection
├── websocket-test.html            # WebSocket demo
└── README.md                      # This file
```

---

## 🔐 Security Considerations

- ✅ Input validation using Zod schemas
- ✅ Rate limiting (100 orders/min)
- ✅ Slippage protection
- ✅ Error handling with retry logic
- ✅ Graceful shutdown to prevent data loss
- ⚠️ **Note**: This is a demo application. Production would require:
  - Authentication/Authorization
  - API key management
  - Database encryption
  - Rate limiting per user
  - Wallet security (if using real devnet)

---

# FutureMe - Production-Ready Backend API

A comprehensive, production-ready backend service for workforce analytics, work session tracking, real-time notifications, and predictive insights. Built with Express.js, TypeScript, and modern cloud infrastructure.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Architecture](#architecture)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Testing](#testing)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

## Overview

**FutureMe** is designed for enterprises that need comprehensive workforce analytics and session tracking. The backend provides:

- Multi-tenant architecture with row-level security (RLS)
- Real-time updates via WebSocket
- Intelligent AI-powered insights and recommendations
- Predictive analytics and burnout detection
- Complete audit trails for compliance

**Current Status:** Production-ready | Supabase RLS Verified | 95+ API Endpoints | Fully Tested

## Key Features

### Core Functionality

- **JWT Authentication** with secure token refresh mechanism
- **Real-time Updates** via Socket.IO with distributed support
- **Multi-tenancy** with complete tenant isolation at database level
- **Role-Based Access Control** (RBAC) with granular permissions
- **Rate Limiting** on sensitive endpoints to prevent abuse

### Advanced Capabilities

- **AI-Powered Insights** using OpenAI for burnout analysis and recommendations
- **Predictive Analytics** with digital twin simulation engine
- **Row-Level Security** (RLS) enforcement via Supabase
- **Session Management** with pause/resume functionality
- **Comprehensive Audit Logs** for compliance and monitoring

### Enterprise Ready

- Type-safe TypeScript codebase
- Zod schema validation on all inputs
- Docker containerization with health checks
- Production security hardening
- Comprehensive error handling and logging

## Tech Stack

| Component           | Technology          | Purpose                              |
| ------------------- | ------------------- | ------------------------------------ |
| **Runtime**         | Node.js 18+         | JavaScript runtime                   |
| **Framework**       | Express.js          | HTTP API server                      |
| **Language**        | TypeScript          | Type safety and developer experience |
| **Database**        | PostgreSQL / SQLite | SQL database (persistent)            |
| **Auth**            | Supabase Auth       | Authentication and user management   |
| **Real-time**       | Socket.IO           | WebSocket server                     |
| **Cache**           | Redis               | Session and analytics caching        |
| **Validation**      | Zod                 | Schema validation                    |
| **Security**        | JWT + bcryptjs      | Token and password security          |
| **Deployment**      | Docker              | Containerization                     |
| **AI**              | OpenAI              | Burnout analysis and insights        |
| **Package Manager** | PNPM                | Workspace management                 |

## Quick Start

### Prerequisites

- **Node.js** 18 LTS or higher
- **PNPM** package manager (recommended) or npm
- **Docker** & Docker Compose (for containerized deployment)
- **PostgreSQL** 14+ (for production) or SQLite (default for development)

### Installation

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd futureme
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Configure environment:**

   ```bash
   cd apps/backend
   cp .env.example .env
   # Edit .env with your settings (see Configuration section)
   ```

4. **Start the server:**

   ```bash
   pnpm dev
   ```

5. **Verify it's working:**
   ```bash
   curl http://localhost:3900/api/health
   # Expected: { "status": "ok" }
   ```

The server will start on `http://localhost:3900` with WebSocket support at `/socket.io`.

### Docker Quick Start

```bash
# Build and start all services (backend + database + cache)
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

---

## API Documentation

### Base URL

- Development: `http://localhost:3900`
- Production: `https://api.yourdomain.com`

### Authentication

Most endpoints require JWT authentication via the `Authorization` header:

```bash
Authorization: Bearer <access_token>
```

### Core Endpoints

#### Authentication

| Method | Endpoint             | Auth | Description                     |
| ------ | -------------------- | ---- | ------------------------------- |
| POST   | `/api/auth/register` | ❌   | Create new user account         |
| POST   | `/api/auth/login`    | ❌   | Authenticate and receive tokens |
| POST   | `/api/auth/refresh`  | ❌   | Get new access token            |
| POST   | `/api/auth/logout`   | ✅   | Revoke current session          |

#### Session Management

| Method | Endpoint                   | Auth | Description                     |
| ------ | -------------------------- | ---- | ------------------------------- |
| POST   | `/api/sessions`            | ✅   | Create new work session         |
| GET    | `/api/sessions`            | ✅   | List all sessions (paginated)   |
| POST   | `/api/sessions/:id/pause`  | ✅   | Pause active session            |
| POST   | `/api/sessions/:id/resume` | ✅   | Resume paused session           |
| POST   | `/api/sessions/:id/end`    | ✅   | End session and record duration |

#### Analytics

| Method | Endpoint                        | Auth | Description           |
| ------ | ------------------------------- | ---- | --------------------- |
| GET    | `/api/insights/summary`         | ✅   | Executive summary     |
| GET    | `/api/insights/burnout/:userId` | ✅   | Burnout risk analysis |
| GET    | `/api/insights/dashboard`       | ✅   | Dashboard metrics     |

#### Health & Status

| Method | Endpoint            | Auth | Description     |
| ------ | ------------------- | ---- | --------------- |
| GET    | `/api/health`       | ❌   | Health check    |
| GET    | `/api/health/ready` | ❌   | Readiness probe |

### Response Format

**Success Response (2xx):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "running"
    // ... payload
  }
}
```

**Error Response (4xx/5xx):**

```json
{
  "success": false,
  "message": "Descriptive error message",
  "code": "ERROR_CODE",
  "statusCode": 400
}
```

### Complete API Reference

See [API_ENDPOINT_INVENTORY.md](docs/architecture/API_ENDPOINT_INVENTORY.md) for comprehensive endpoint documentation with examples.

---

## Testing

### Test with Postman

We provide a complete Postman collection for testing all endpoints with pre-configured variables and examples.

**Setup:**

1. Download `FutureMe_API_Supabase_Complete.postman_collection.json` (in project root)
2. Open Postman and click **Import**
3. Select the JSON file
4. The environment variables will auto-populate from API responses

**Testing Workflow:**

1. Register a new user (POST `/api/auth/register`)
2. Login to get tokens (POST `/api/auth/login`)
3. Create a work session (POST `/api/sessions`)
4. Test pause/resume/end operations
5. View health status (GET `/api/health`)

See [POSTMAN_E2E_TESTING_GUIDE.md](docs/testing/POSTMAN_E2E_TESTING_GUIDE.md) for detailed instructions.

### Automated Testing

```bash
cd apps/backend

# Run unit tests
pnpm test

# Run with coverage
pnpm test:cov

# Watch mode
pnpm test:watch
```

---

## Architecture

### System Design

FutureMe uses a multi-layer architecture for scalability and maintainability:

```
┌─────────────────────────────────────────┐
│     Client Layer (React + Socket.IO)    │
└──────────────────┬──────────────────────┘
                   │ HTTP/WebSocket
┌──────────────────▼──────────────────────┐
│  API Layer (Express + Rate Limiting)   │
│  ├─ Authentication (JWT + Supabase)    │
│  ├─ Sessions Management                │
│  ├─ Analytics & Insights               │
│  └─ Admin & Billing                    │
└──────────────────┬──────────────────────┘
                   │
     ┌─────────────┼─────────────┐
     │             │             │
┌────▼──┐  ┌──────▼─────┐  ┌───▼────┐
│ Supa- │  │ PostgreSQL │  │ Redis  │
│ base  │  │  Database  │  │ Cache  │
└───────┘  └────────────┘  └────────┘
```

### Folder Structure

```
apps/backend/
├── src/
│   ├── api/
│   │   ├── controllers/    # Request handlers
│   │   ├── routes/         # Route definitions
│   │   ├── middlewares/    # Express middleware
│   │   └── validators/     # Zod schemas
│   ├── modules/            # Business logic (auth, services)
│   ├── engines/            # Complex systems (WebSocket, AI)
│   ├── database/           # Data access layer
│   ├── config/             # Configuration
│   ├── utils/              # Helper functions
│   ├── app.ts              # Express initialization
│   └── server.ts           # Server startup
├── docker-compose.yml      # Multi-container orchestration
├── Dockerfile              # Container image
└── package.json
```

### Request Flow

```
Request → Rate Limit → Auth → Validate → Route → Service → Database → Response
```

See [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) for detailed system architecture.

---

## Deployment

### Development

```bash
cd apps/backend
pnpm dev
```

### Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f backend
```

Services included:

- **Backend API** on `localhost:3900`
- **PostgreSQL** on `localhost:5432`
- **Redis** on `localhost:6379`

### Production Deployment

See complete deployment guide: [PRODUCTION_READY_DEPLOYMENT.md](apps/backend/PRODUCTION_READY_DEPLOYMENT.md)

**Quick checklist:**

- [ ] Environment variables configured
- [ ] Database migrated and verified
- [ ] JWT_SECRET is secure (32+ chars)
- [ ] CORS configured for frontend domain
- [ ] SSL/TLS certificate installed
- [ ] Rate limiting enabled
- [ ] Monitoring and logging configured
- [ ] Security headers enabled
- [ ] Row-level security (RLS) verified
- [ ] Backup strategy in place

---

## Configuration

### Environment Variables

#### Required

```bash
NODE_ENV=development|production
PORT=3900
JWT_SECRET=your-32-character-minimum-secret-key
FRONTEND_URL=http://localhost:5173
DATABASE_TYPE=postgres|sqlite
```

#### PostgreSQL

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/futureme
```

#### WebSocket

```bash
SOCKET_ENABLED=true
SOCKET_PING_INTERVAL=30000
SOCKET_PING_TIMEOUT=60000
```

#### Supabase

```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE=your-service-role-key
```

#### Optional Features

```bash
OPENAI_API_KEY=sk-xxxx (for AI features)
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info|debug|warn|error
```

See [apps/backend/.env.example](apps/backend/.env.example) for complete reference.

---

## Security

This project implements enterprise-grade security:

- **Authentication:** JWT with refresh tokens
- **Passwords:** Bcryptjs with 12 salt rounds
- **Database:** Row-level security (RLS) via Supabase
- **API:** Rate limiting and CORS protection
- **Headers:** Helmet.js for HTTP security headers
- **Validation:** Zod schema validation on all inputs
- **Compliance:** Audit logging for all operations

Complete security documentation: [SECURITY_PRODUCTION.md](apps/backend/SECURITY_PRODUCTION.md)

---

## Troubleshooting

### Backend won't start

```bash
# Check Node version
node --version  # Should be >= 18

# Clear and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Check port availability
lsof -i :3900 && kill -9 <PID>
```

### Database connection errors

**SQLite:**

```bash
rm -f data/futureme.db  # Recreate database
```

**PostgreSQL:**

```bash
psql postgresql://user:pass@localhost:5432/futureme -c "SELECT 1"
```

### Docker issues

```bash
# Full rebuild
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d

# Check service logs
docker-compose logs -f backend
```

---

## Additional Documentation

- [Architecture Overview](docs/architecture/ARCHITECTURE.md)
- [API Reference](docs/architecture/API_ENDPOINT_INVENTORY.md)
- [Production Deployment Guide](apps/backend/PRODUCTION_READY_DEPLOYMENT.md)
- [Security Hardening](apps/backend/SECURITY_PRODUCTION.md)
- [WebSocket Setup](apps/backend/WEBSOCKET_PRODUCTION.md)
- [Frontend Integration](FRONTEND_INTEGRATION_SUPABASE.md)
- [User Guide](docs/USER_GUIDE.md)
- [AI Features](docs/AI_FEATURES.md)

---

## License

Proprietary - All rights reserved

services:

# Backend API

backend:
build:
context: .
dockerfile: Dockerfile
target: backend
container_name: futureme-backend
ports: - '3900:3900'
environment:
NODE_ENV: production
PORT: 3900
JWT_SECRET: ${JWT_SECRET:-your-super-secret-key-change-in-prod}
DATABASE_TYPE: postgres
DATABASE_URL: postgresql://futureme:futureme@postgres:5432/futureme
FRONTEND_URL: http://localhost:5173
SOCKET_ENABLED: 'true'
depends_on:
postgres:
condition: service_healthy
volumes: - ./apps/backend/src:/app/apps/backend/src
networks: - worksight-network
healthcheck:
test: ['CMD', 'curl', '-f', 'http://localhost:3900/api/health']
interval: 30s
timeout: 10s
retries: 3
start_period: 40s

# PostgreSQL Database

postgres:
image: postgres:15-alpine
container_name: futureme-postgres
environment:
POSTGRES_USER: futureme
POSTGRES_PASSWORD: futureme
POSTGRES_DB: futureme
volumes: - postgres_data:/var/lib/postgresql/data
ports: - '5432:5432'
networks: - worksight-network
healthcheck:
test: ['CMD-SHELL', 'pg_isready -U futureme']
interval: 10s
timeout: 5s
retries: 5

# Redis (Optional - for caching/sessions)

redis:
image: redis:7-alpine
container_name: futureme-redis
ports: - '6379:6379'
networks: - futureme-network
healthcheck:
test: ['CMD', 'redis-cli', 'ping']
interval: 10s
timeout: 5s
retries: 5

volumes:
postgres_data:
driver: local

networks:
futureme-network:
driver: bridge

````

**2. Create `.env.production` file:**

```bash
NODE_ENV=production
PORT=3900
JWT_SECRET=your-very-secure-secret-key-here
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://futureme:futureme@postgres:5432/futureme
FRONTEND_URL=https://yourdomain.com
SOCKET_ENABLED=true
````

**3. Start all services:**

```bash
docker-compose up -d
```

**4. Verify services are running:**

```bash
docker-compose ps

# Expected output:
# NAME                COMMAND                PORTS       STATUS
# futureme-backend   pnpm start             3900/tcp    Up
# futureme-postgres  postgres               5432/tcp    Up
# futureme-redis     redis-server           6379/tcp    Up
```

**5. Check logs:**

```bash
# Backend logs
docker-compose logs -f backend

# Database logs
docker-compose logs postgres
```

**6. Test the deployment:**

```bash
curl http://localhost:3900/api/health
# Response: { "status": "ok" }
```

### Option 3: Multi-Stage Dockerfile (Production-Optimized)

**1. Create `Dockerfile.prod`:**

```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /build

RUN npm install -g pnpm

COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend ./apps/backend
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN cd apps/backend && pnpm build 2>/dev/null || true

# Stage 2: Runtime
FROM node:18-alpine AS backend

WORKDIR /app

RUN npm install -g pnpm

# Copy only necessary files from builder
COPY --from=builder /build/apps/backend ./apps/backend
COPY --from=builder /build/packages ./packages
COPY --from=builder /build/pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

EXPOSE 3900

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3900/api/health', (r)=>{ if(r.statusCode!==200) throw new Error()})"

CMD ["cd", "apps/backend", "&&", "pnpm", "start"]
```

**2. Build optimized image:**

```bash
docker build -f Dockerfile.prod -t futureme-backend:prod .
docker run -p 3900:3900 \
  -e NODE_ENV=production \
  -e JWT_SECRET=secure-key \
  futureme-backend:prod
```

### Docker Compose Commands Reference

```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# Stop all services
docker-compose down

# Remove volumes (WARNING: deletes data)
docker-compose down -v

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend

# Execute command in container
docker-compose exec backend pnpm db:migrate

# Restart a service
docker-compose restart backend

# Build/rebuild images
docker-compose build --no-cache
```

### Deploying to Production

**Step 1: Push image to registry:**

```bash
docker tag futureme-backend:latest myregistry.com/futureme:latest
docker push myregistry.com/futureme:latest
```

**Step 2: Deploy with docker-compose on server:**

```bash
# On production server
ssh user@prod-server
git clone <repo-url>
cd futureme
docker-compose -f docker-compose.yml up -d
```

**Step 3: Setup reverse proxy (nginx):**

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3900;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**Step 4: Enable HTTPS (certbot):**

```bash
sudo certbot --nginx -d api.yourdomain.com
```

---

## 🗄️ Database Setup

### SQLite (Development - Default)

No setup required. Database automatically created at `data/futureme.db`.

### PostgreSQL (Production)

**1. Using Docker Compose (Recommended):**

```bash
docker-compose up -d postgres
```

**2. Using local PostgreSQL:**

```bash
# Install PostgreSQL
# Create database
createdb futureme

# Set connection string in .env
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://username:password@localhost:5432/futureme
```

**3. Verify connection:**

```bash
psql postgresql://futureme:futureme@localhost:5432/futureme -c "\dt"
```

---

## 📡 API Endpoints

### Authentication

| Method | Endpoint             | Auth | Description              |
| ------ | -------------------- | ---- | ------------------------ |
| POST   | `/api/auth/register` | ❌   | Register new user        |
| POST   | `/api/auth/login`    | ❌   | Login and get tokens     |
| POST   | `/api/auth/refresh`  | ❌   | Refresh access token     |
| POST   | `/api/auth/logout`   | ✅   | Logout and revoke tokens |

### Sessions

| Method | Endpoint                          | Auth | Description        |
| ------ | --------------------------------- | ---- | ------------------ |
| POST   | `/api/sessions`                   | ✅   | Create new session |
| POST   | `/api/sessions/:sessionId/pause`  | ✅   | Pause session      |
| POST   | `/api/sessions/:sessionId/resume` | ✅   | Resume session     |
| POST   | `/api/sessions/:sessionId/end`    | ✅   | End session        |

### Health

| Method | Endpoint      | Auth | Description  |
| ------ | ------------- | ---- | ------------ |
| GET    | `/api/health` | ❌   | Health check |

### Response Format

**Success:**

```json
{
  "success": true,
  "data": {
    /* payload */
  }
}
```

**Error:**

```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE"
}
```

---

## 🔐 Environment Variables

### Required (Backend)

```bash
# Server
NODE_ENV=development|production
PORT=3900

# Authentication
JWT_SECRET=your-super-secret-key-min-32-chars

# Database
DATABASE_TYPE=sqlite|postgres
DATABASE_URL=postgresql://user:pass@host:5432/dbname  # Only for postgres

# Frontend
FRONTEND_URL=http://localhost:5173

# WebSocket
SOCKET_ENABLED=true|false
```

### Optional

```bash
SALT_ROUNDS=10                    # bcrypt salt rounds
LOG_LEVEL=info|debug|warn|error
```

### Example `.env` File

```bash
# Server Configuration
NODE_ENV=development
PORT=3900

# Database
DATABASE_TYPE=sqlite
DATABASE_URL=sqlite://./data/futureme.db

# Authentication
JWT_SECRET=eJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9SecureKeyChangeThis

# Frontend Access
FRONTEND_URL=http://localhost:5173

# Features
SOCKET_ENABLED=true

# Security
SALT_ROUNDS=10
```

---

## 📝 License

Proprietary - All rights reserved

**Last Updated:** April 2026

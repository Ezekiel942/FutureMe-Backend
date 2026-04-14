# FutureMe - Architecture Overview

## System Overview

FutureMe is a modern full-stack work tracking SaaS application built with:

- **Frontend**: React + TypeScript + Vite
- **Backend**: Express + TypeScript + Socket.IO
- **Database**: TypeORM with PostgreSQL/SQLite and Supabase for tenant-managed database and row-level security
- **Caching**: Redis for fast session and analytics caching
- **AI**: OpenAI-style services for executive summary, burnout prediction, risk analysis, and recommendations
- **Simulation engine**: Digital twin engine for predictive workforce scenarios
- **Real-time**: Socket.IO for live updates
- **Package Management**: PNPM workspaces

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         React Frontend (Vite SPA)                    │   │
│  │  • Login/Register                                    │   │
│  │  • Session Dashboard                                │   │
│  │  • Billing Management                               │   │
│  │  • Audit Logs                                        │   │
│  │  • Insights Analytics                               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                    HTTP/WebSocket
                            │
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (Express)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           REST API + WebSocket Server               │   │
│  │  • /api/auth         (JWT authentication)           │   │
│  │  • /api/sessions     (Session management)           │   │
│  │  • /api/billing      (Subscription & payments)      │   │
│  │  • /api/audit        (Activity logging)             │   │
│  │  • /api/insights     (Analytics & recommendations)  │   │
│  │  • /socket.io        (Real-time updates)            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
               ┌────────────┼────────────┐
               │            │            │
        ┌──────▼──────┐ ┌──▼───────┐   │
        │ Service     │ │ Engines  │   │
        │ Layer       │ │ Layer    │   │
        ├─────────────┤ ├──────────┤   │
        │ • Auth      │ │ • Session│   │
        │ • Billing   │ │ • Insight│   │
        │ • Database  │ │ • Socket │   │
        └──────┬──────┘ └──┬───────┘   │
               │           │           │
               └───────────┼───────────┘
                           │
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              TypeORM Database                        │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │ Entities:                                      │  │   │
│  │  │  • User (authentication & profile)             │  │   │
│  │  │  • Organization (team management)              │  │   │
│  │  │  • WorkSession (session tracking)              │  │   │
│  │  │  • Insight (AI-generated analytics)            │  │   │
│  │  │  • Subscription (billing data)                 │  │   │
│  │  │  • AuditLog (activity tracking)                │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │ Storage Options:                               │  │   │
│  │  │  • PostgreSQL (production)                     │  │   │
│  │  │  • SQLite (development/small deployments)      │  │   │
│  │  │  • SQL.js (testing/in-memory)                  │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend (React)

```
apps/frontend/
├── src/
│   ├── api/                    # API client layer
│   │   ├── httpClient.ts       # Axios instance with interceptors
│   │   ├── auth.api.ts         # Authentication endpoints
│   │   ├── session.api.ts      # Session management
│   │   ├── billing.api.ts      # Billing operations
│   │   ├── audit.api.ts        # Audit log endpoints
│   │   ├── insight.api.ts      # Analytics endpoints
│   │   └── socket.client.ts    # WebSocket client
│   ├── hooks/                  # Custom React hooks
│   │   ├── useAuth.ts          # Authentication state + socket init
│   │   ├── useSession.ts       # Session management
│   │   ├── useSocket.ts        # WebSocket connection
│   │   └── useSessionUpdates.ts# Real-time session updates
│   ├── pages/                  # Page components
│   │   ├── login/              # Authentication pages
│   │   ├── register/
│   │   ├── session/            # Session dashboard & history
│   │   ├── billing/            # Subscription & payment
│   │   ├── audit/              # Activity logs
│   │   └── insights/           # Analytics & recommendations
│   ├── components/             # Reusable UI components
│   ├── types/                  # TypeScript interfaces
│   └── App.tsx                 # Main app component
```

### Backend (Express + TypeScript)

```
apps/backend/
├── src/
│   ├── api/                    # Express route handlers
│   │   ├── controllers/        # Request handlers
│   │   │   ├── auth.controller.ts
│   │   │   ├── session.controller.ts
│   │   │   ├── billing.controller.ts
│   │   │   ├── audit.controller.ts
│   │   │   └── insight.controller.ts
│   │   ├── routes/             # Route definitions
│   │   │   ├── auth.routes.ts
│   │   │   ├── session.routes.ts
│   │   │   ├── billing.routes.ts
│   │   │   ├── audit.routes.ts
│   │   │   └── insight.routes.ts
│   │   └── middlewares/        # Express middlewares
│   │       ├── auth.middleware.ts      # JWT validation
│   │       ├── error.middleware.ts     # Error handling
│   │       ├── validation.middleware.ts # Input validation
│   │       └── logger.middleware.ts    # Request logging
│   ├── modules/                # Business logic
│   │   ├── auth.service.ts     # User authentication
│   │   ├── billing.service.ts  # Subscription management
│   │   └── session.service.ts  # Session operations
│   ├── engines/                # Complex logic engines
│   │   ├── socket.server.ts    # WebSocket initialization
│   │   ├── socket.events.ts    # Socket event handlers
│   │   ├── sessionEngine.ts    # Session state machine
│   │   ├── insightEngine.ts    # Insight generation
│   │   ├── utilization.rule.ts # Utilization metrics
│   │   └── deviation.rule.ts   # Anomaly detection
│   ├── database/
│   │   ├── models/             # TypeORM entities
│   │   │   ├── User.entity.ts
│   │   │   ├── Organization.entity.ts
│   │   │   ├── WorkSession.entity.ts
│   │   │   ├── Insight.entity.ts
│   │   │   ├── Subscription.entity.ts
│   │   │   └── AuditLog.entity.ts
│   │   └── migrations/         # Database migrations (if used)
│   ├── config/
│   │   └── database.ts         # TypeORM configuration
│   ├── utils/                  # Utility functions
│   │   ├── errors.ts           # Custom error classes
│   │   ├── logger.ts           # Structured logging
│   │   ├── validation.ts       # Input sanitization
│   │   └── config.ts           # Startup validation
│   ├── app.ts                  # Express app setup
│   └── server.ts               # Server startup
```

### Shared Types

```
packages/shared-types/
├── src/
│   ├── api.ts                  # API response types
│   ├── auth.ts                 # Authentication types
│   ├── session.ts              # Session types
│   ├── billing.ts              # Billing types
│   ├── audit.ts                # Audit types
│   └── insight.ts              # Insight types
```

## Data Flow

### 1. Authentication Flow

```
User Input (email, password)
         ↓
[register/login API call]
         ↓
Auth Controller
  - Validate input
  - Hash password (bcrypt)
  - Create/verify user
         ↓
Generate JWT token
         ↓
Return to frontend
         ↓
Store in localStorage/cookie
         ↓
Include in subsequent requests
```

### 2. Session Management Flow

```
User starts session
         ↓
[POST /api/sessions/start]
         ↓
Session Controller
  - Create WorkSession record
  - Set status: RUNNING
  - Emit socket event: session:created
         ↓
SessionEngine
  - Initialize state machine
  - Begin activity tracking
  - Calculate metrics
         ↓
WebSocket broadcasts to user
         ↓
Frontend receives update → UI updates in real-time
```

### 3. Insight Generation Flow

```
Session completes
         ↓
Session Controller
  - Calculate metrics
  - Trigger InsightEngine
         ↓
InsightEngine
  ├─ UtilizationRule
  │  - Analyze focus patterns
  │  - Calculate utilization
  │  - Generate utilization insights
  │
  └─ DeviationRule
     - Compare to historical baseline
     - Detect anomalies
     - Generate deviation insights
         ↓
Store Insight records
  - Type: UTILIZATION or DEVIATION
  - Severity: LOW, MEDIUM, HIGH
  - Generated data
         ↓
WebSocket broadcasts insights
         ↓
Frontend displays on dashboard
```

### 4. Real-Time Updates Flow

```
Event occurs (session update, insight generated)
         ↓
Backend event handler
         ↓
Determine affected users
  - User's own socket: user:${userId}
  - Organization managers: org:${orgId}:managers
         ↓
Socket.IO broadcasts
  - io.to(`user:${userId}`).emit(event)
  - io.to(`org:${orgId}:managers`).emit(event)
         ↓
Frontend socket client receives
         ↓
React hook (useSessionUpdates) triggered
         ↓
State update
         ↓
Component re-render
```

## Key Design Patterns

### 1. Middleware Stack

Request → Auth Middleware → Validation Middleware → Route Handler → Error Middleware → Response

### 2. Service Layer Pattern

- Controllers handle HTTP concerns (request/response)
- Services contain business logic
- Database access through TypeORM repositories

### 3. State Machine (Sessions)

```
    INITIAL
      ↓
   RUNNING ←→ PAUSED
      ↓
   COMPLETED
```

### 4. Error Handling

- Custom error classes (ValidationError, AuthenticationError, etc.)
- Global error middleware catches all exceptions
- Structured logging with context
- Sanitized responses (no sensitive info in production)

### 5. Real-Time Architecture

- Socket.IO namespaces for organization separation
- Room-based broadcasting for targeted updates
- Graceful fallback if WebSocket unavailable

## Security Considerations

### Authentication

- JWT tokens with short expiry (1 hour typical)
- Refresh tokens for extended sessions
- Bcrypt password hashing (10 rounds)

### Data Protection

- HTTPS/WSS for transport security
- SQL parameterization to prevent injection
- Input sanitization and validation

### Access Control

- Role-based access (admin, manager, member)
- Resource ownership verification
- Rate limiting on auth endpoints

### Audit Trail

- All user actions logged
- Immutable audit log records
- User-viewable activity history

## Performance Optimization

### Frontend

- Code splitting with React.lazy
- Memoization for expensive computations
- Efficient re-renders with React.memo

### Backend

- Database indexes on frequently queried columns
- Connection pooling for database
- Caching of computed insights
- Pagination for large datasets

### Database

- Normalized schema design
- Strategic indexes
- Query optimization with EXPLAIN
- Regular maintenance (ANALYZE, VACUUM)

## Deployment Architecture

### Docker Container Structure

```
┌──────────────────┐
│  Load Balancer   │
│   (Nginx/HAProxy)│
└────────┬─────────┘
         │
    ┌────┴────┬────────┐
    │          │        │
┌───▼──┐   ┌──▼──┐  ┌─▼───┐
│Backend│   │Front│  │Back2 │ (replicas)
│Container  │-end │  │......│
└────────   └─────┘  └──────┘
    ↓
┌──────────────┐
│ PostgreSQL   │
│ (RDS/Managed)│
└──────────────┘
```

## Monitoring & Observability

### Metrics to Track

- Request response times
- Error rates by endpoint
- Database query performance
- WebSocket connection count
- Session analytics

### Logging

- Structured JSON logs
- Log levels: debug, info, warn, error
- Centralized log aggregation (ELK, CloudWatch, Datadog)

### Alerting

- High error rate threshold
- Database connection failures
- WebSocket connection drops
- Payment processing failures

## Database Schema (ERD)

```
User
├─ id (PK)
├─ email (UNIQUE)
├─ password_hash
├─ created_at
└─ updated_at

WorkSession
├─ id (PK)
├─ user_id (FK → User)
├─ organization_id (FK → Organization)
├─ status (ENUM)
├─ start_time
├─ end_time
├─ focus_time
└─ created_at

Insight
├─ id (PK)
├─ session_id (FK → WorkSession)
├─ user_id (FK → User)
├─ type (ENUM: UTILIZATION, DEVIATION)
├─ severity (ENUM)
├─ message
├─ generated_data
└─ created_at

Subscription
├─ id (PK)
├─ user_id (FK → User, UNIQUE)
├─ plan_tier
├─ status
├─ current_period_start
├─ current_period_end
└─ updated_at

AuditLog
├─ id (PK)
├─ user_id (FK → User)
├─ action
├─ resource_type
├─ resource_id
├─ changes
├─ ip_address
├─ user_agent
└─ created_at
```

## Multi-Tenancy & Security Architecture

### 5-Layer Tenant Isolation

FutureMe implements comprehensive tenant isolation across five architectural layers to prevent cross-tenant data access:

#### Layer 1: Authentication Level
- JWT tokens include `organizationId` claim
- User sessions scoped to specific organization
- Cross-organization token reuse prevented

#### Layer 2: Context Level  
- Tenant middleware extracts `organizationId` from authenticated user
- Request context enriched with tenant identifier
- Non-blocking for single-tenant users

#### Layer 3: Enforcement Level
- `enforceTenantIsolation` middleware validates resource ownership
- Prevents modification of `organizationId` in request bodies
- Auto-injection of tenant ID for non-GET requests
- Resource ownership verified before access

#### Layer 4: Query Level
- All database queries explicitly filtered by `organizationId`
- Supabase Row-Level Security (RLS) policies enforce at database layer
- SQL joins limited to same-tenant resources
- Indexes on `organizationId` for fast filtering

#### Layer 5: Handler Level
- Controllers call `assertTenantOwnership()` to verify resources belong to user's tenant
- Audit logs include `organizationId` for cross-tenant event tracking
- WebSocket broadcasts scoped to organization (e.g., `org:${orgId}:managers`)

### CustomTenantRules System

Organizations can define custom rules per tenant:

```
CustomTenantRules entity:
- minSessionLength: 300-3600 seconds
- maxDailyHours: 1-24 hours
- idleTimeout: 5-60 minutes
- overtimeThreshold: configurable hours

Helper functions:
- getRulesByOrganization(orgId)
- getEffectiveRules(orgId) → custom rules or system defaults
- upsertRules(orgId, updates)
- deleteRules(orgId)
```

### Permission Matrix

FutureMe supports 6 roles with granular permissions:

| Role | Permissions | Scope |
|------|-------------|-------|
| ADMIN | All permissions | Organization |
| PROJECT_LEAD | project:*, team:manage, user:manage | Projects assigned |
| MANAGER | session:*, insights:read, audit:read | Team members |
| FINANCIAL_AUDITOR | billing:*, audit:read | Organization |
| EXTERNAL_CONSULTANT | session:read, insights:read | Assigned projects |
| USER | session:*, insights:own, profile:* | Own data only |

---

## Risk & Anomaly Detection Engine

### 7 Risk Categories

FutureMe detects and classifies work-related risks:

| Category | Detection | Threshold | Severity Levels |
|----------|-----------|-----------|------------------|
| **Burnout** | Excessive daily hours + late-night work | >10h/day warning, >12h critical | INFO / WARNING / CRITICAL |
| **Scope Creep** | Task duration increase vs. baseline | >30% increase | WARNING / CRITICAL |
| **Ghosting** | Inactivity despite running session | >5 min without activity | WARNING |
| **Excessive Overtime** | Daily/weekly hour overages | >10h/day or >50h/week | WARNING / CRITICAL |
| **Fragmentation** | Too many short sessions | >15 sessions, <15 min average | INFO / WARNING |
| **Inconsistency** | Work pattern variance | Coefficient of variation >0.4 | INFO / WARNING |
| **Underutilization** | Low session activity | <1h with sessions | INFO |

### Risk Scoring System

- Score range: 0-100
- Calculated per user, per organization
- Updated on session completion and key events
- WebSocket events: `risk:detected`, `anomaly:flagged`

### Real-Time Risk Notifications

- Socket.IO broadcasts to affected users in real-time
- Actionable recommendations generated per risk type
- Audit trail logged for compliance
- Tenant-isolated: risks visible only to organization members

### Risk Event Types

```typescript
enum RiskEventType {
  RISK_DETECTED = 'risk_detected',        // Actionable risk
  ANOMALY_FLAGGED = 'anomaly_flagged',    // Informational
  BURNOUT_WARNING = 'burnout_warning',    // Burnout detected
  PROJECT_AT_RISK = 'project_at_risk',    // Project-level risk
}

enum RiskSeverity {
  INFO = 'info',
  WARNING = 'warning', 
  CRITICAL = 'critical',
}
```

---

## Scalability Considerations

### Horizontal Scaling

- Stateless backend (scale horizontally)
- Session affinity for WebSocket
- Database replication for read capacity

### Caching Strategy

- Redis for session cache
- CDN for static frontend assets
- Database query result caching

### Database Optimization

- Connection pooling (PgBouncer)
- Read replicas for reporting
- Archive old sessions
- Partition large tables by time

## Technology Justification

| Component  | Choice          | Why                                      |
| ---------- | --------------- | ---------------------------------------- |
| Node.js    | Runtime         | Non-blocking I/O, great for real-time    |
| Express    | Web Framework   | Minimal, unopinionated, high performance |
| TypeScript | Language        | Type safety, better IDE support          |
| React      | Frontend        | Component-based, large ecosystem         |
| Socket.IO  | Real-time       | Better browser support, auto-fallback    |
| TypeORM    | ORM             | Type-safe, good PostgreSQL support       |
| PostgreSQL | Database        | ACID compliance, robust, mature          |
| PNPM       | Package Manager | Fast, efficient, monorepo support        |

---

For more details, see:

- [Deployment Guide](./DEPLOYMENT.md)
- [User Guide](./USER_GUIDE.md)
- [API Documentation](./API.md)

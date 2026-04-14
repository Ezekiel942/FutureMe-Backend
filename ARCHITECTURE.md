# FutureMe System Architecture

This document provides a high-level overview of the FutureMe architecture. For detailed component information, see [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md).

## Table of Contents

- [System Overview](#system-overview)
- [Architecture Diagram](#architecture-diagram)
- [Component Architecture](#component-architecture)
- [Data Flow](#data-flow)
- [Design Patterns](#design-patterns)
- [Security](#security)
- [Performance](#performance)
- [Deployment](#deployment)

## System Overview

FutureMe is a full-stack workforce analytics platform with:

- **Frontend**: React + TypeScript + Vite SPA
- **Backend**: Express.js + TypeScript with Socket.IO real-time
- **Database**: PostgreSQL (production) / SQLite (development)
- **Authentication**: Supabase Auth with JWT tokens
- **Caching**: Redis for sessions and analytics
- **AI**: OpenAI integration for insights and recommendations
- **Package Management**: PNPM workspaces

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer (React)                     │
│              Login • Dashboard • Billing • Audit             │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/WebSocket
┌──────────────────────────▼──────────────────────────────────┐
│               API Layer (Express + Middleware)              │
│  Auth │ Sessions │ Billing │ Insights │ WebSocket           │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
      ┌────▼────┐  ┌──────▼──────┐  ┌───▼─────┐
      │ Supabase│  │ PostgreSQL  │  │ Redis   │
      │   Auth  │  │  Database   │  │ Cache   │
      └─────────┘  └─────────────┘  └─────────┘
```

## Component Architecture

### Frontend Structure

```
apps/frontend/
├── src/
│   ├── api/              # API client with interceptors
│   ├── hooks/            # Custom React hooks (auth, session, socket)
│   ├── pages/            # Page components (login, dashboard, sessions, etc.)
│   ├── components/       # Reusable UI components
│   ├── types/            # TypeScript interfaces
│   └── App.tsx
```

**Key Hooks:**

- `useAuth` - Authentication state and token management
- `useSession` - Session management
- `useSocket` - WebSocket connection and event handling

### Backend Structure

```
apps/backend/
├── src/
│   ├── api/              # Route handlers and middlewares
│   │   ├── controllers/  # Request handlers (auth, sessions, insights)
│   │   ├── routes/       # Route definitions
│   │   └── middlewares/  # Auth, validation, error handling
│   ├── modules/          # Business logic (services)
│   ├── engines/          # Complex systems (WebSocket, insights, session state)
│   ├── database/         # Data models and migrations
│   ├── config/           # Application configuration
│   ├── utils/            # Helper functions
│   └── server.ts         # Server startup
```

**Middleware Stack:**
Auth → Validation → Route Handler → Error Handler → Response

### Shared Types Package

```
packages/shared-types/
├── api.ts               # API response types
├── auth.ts              # Authentication types
├── session.ts           # Session types
└── ...                  # Other domain types
```

## Data Flow

### Authentication Flow

```
User Input → Register/Login API → Auth Controller
  → Validate & Hash Password → Create JWT
  → Return Tokens → Store in Client
  → Include in Future Requests
```

### Session Management Flow

```
User Starts Session → POST /api/sessions
  → Session Controller Creates Record
  → SessionEngine Initializes State
  → WebSocket Broadcasts Update
  → Frontend Receives → UI Updates Real-time
```

### Insight Generation Flow

```
Session Completes → Calculate Metrics
  → InsightEngine ({UtilizationRule, DeviationRule})
  → Generate Insights → Store Records
  → Broadcast via WebSocket
  → Frontend Displays on Dashboard
```

### Real-Time Updates Flow

```
Event Occurs → Backend Processes
  → Determine Affected Users/Organizations
  → Socket.IO Broadcasts to Rooms
  → Frontend Receives → React State Update
  → Component Re-render
```

## Design Patterns

### Middleware Stack Pattern

Clean separation of concerns: authentication → validation → business logic → error handling

### Service Layer Pattern

- Controllers handle HTTP protocol
- Services contain business logic
- Database access via repositories

### State Machine (Sessions)

```
INITIAL → RUNNING ↔ PAUSED → COMPLETED
```

### Error Handling

- Custom error classes for specific errors
- Global error middleware for all exceptions
- Structured logging with context

### Real-Time Architecture

- Socket.IO namespaces for organization separation
- Room-based broadcasting for targeted updates
- Graceful fallback if WebSocket unavailable

## Security

### Authentication & Authorization

- JWT tokens with short expiry (1 hour)
- Refresh tokens for extended sessions
- Bcryptjs password hashing (12 salt rounds)
- Role-based access control (RBAC)

### Data Protection

- HTTPS/WSS for encrypted transport
- Row-level security (RLS) in database
- SQL parameterization prevents injection
- Input validation and sanitization

### Access Control

- Resource ownership verification
- Rate limiting on sensitive endpoints
- Tenant isolation via Row-Level Security

### Audit & Compliance

- Immutable audit logs for all operations
- User-viewable activity history
- Structured logging for monitoring

See [SECURITY_PRODUCTION.md](apps/backend/SECURITY_PRODUCTION.md) for details.

## Performance

### Frontend Optimization

- Code splitting with React.lazy
- Memoization for expensive computations
- Efficient re-renders with React.memo

### Backend Optimization

- Database connection pooling
- Strategic indexes on frequently queried columns
- Caching of computed insights
- Pagination for large datasets
- Query optimization with EXPLAIN ANALYZE

### Database Optimization

- Normalized schema design
- Strategic index placement
- Regular maintenance (ANALYZE, VACUUM)

## Deployment

### Container Architecture

```
Load Balancer (Nginx)
    ↓
Backend Container(s)
    ↓
PostgreSQL (RDS/Managed)
Redis (Managed)
```

### Services

**Development:**

- Local Docker Compose with backend, PostgreSQL, Redis

**Production:**

- Backend service with auto-scaling
- Managed PostgreSQL database
- Managed Redis cache
- Load balancer with SSL/TLS
- CDN for frontend assets

See [PRODUCTION_READY_DEPLOYMENT.md](apps/backend/PRODUCTION_READY_DEPLOYMENT.md) for deployment details.

## Monitoring

### Key Metrics

- Request response times per endpoint
- Error rates and error types
- Active WebSocket connections
- Session metrics and analytics
- Database query performance

### Logging

- Structured JSON logs
- Log levels: debug, info, warn, error
- Centralized aggregation recommended

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

| Role                | Permissions                           | Scope             |
| ------------------- | ------------------------------------- | ----------------- |
| ADMIN               | All permissions                       | Organization      |
| PROJECT_LEAD        | project:\*, team:manage, user:manage  | Projects assigned |
| MANAGER             | session:\*, insights:read, audit:read | Team members      |
| FINANCIAL_AUDITOR   | billing:\*, audit:read                | Organization      |
| EXTERNAL_CONSULTANT | session:read, insights:read           | Assigned projects |
| USER                | session:_, insights:own, profile:_    | Own data only     |

---

## Risk & Anomaly Detection Engine

### 7 Risk Categories

FutureMe detects and classifies work-related risks:

| Category               | Detection                               | Threshold                       | Severity Levels           |
| ---------------------- | --------------------------------------- | ------------------------------- | ------------------------- |
| **Burnout**            | Excessive daily hours + late-night work | >10h/day warning, >12h critical | INFO / WARNING / CRITICAL |
| **Scope Creep**        | Task duration increase vs. baseline     | >30% increase                   | WARNING / CRITICAL        |
| **Ghosting**           | Inactivity despite running session      | >5 min without activity         | WARNING                   |
| **Excessive Overtime** | Daily/weekly hour overages              | >10h/day or >50h/week           | WARNING / CRITICAL        |
| **Fragmentation**      | Too many short sessions                 | >15 sessions, <15 min average   | INFO / WARNING            |
| **Inconsistency**      | Work pattern variance                   | Coefficient of variation >0.4   | INFO / WARNING            |
| **Underutilization**   | Low session activity                    | <1h with sessions               | INFO                      |

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
  RISK_DETECTED = 'risk_detected', // Actionable risk
  ANOMALY_FLAGGED = 'anomaly_flagged', // Informational
  BURNOUT_WARNING = 'burnout_warning', // Burnout detected
  PROJECT_AT_RISK = 'project_at_risk', // Project-level risk
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

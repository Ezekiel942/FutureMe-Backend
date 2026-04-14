# Production Readiness Verification Checklist

**Complete verification guide to ensure backend is production-ready**

---

## Phase 1: Local Development

### Environment Setup

- [ ] Copy `.env.example` to `.env.development`
- [ ] Fill in all required variables:
  - [ ] `NODE_ENV=development`
  - [ ] `PORT=2200`
  - [ ] `JWT_SECRET` (min 32 random characters)
  - [ ] `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- [ ] Optional services configured (Redis, AI, email):
  - [ ] `REDIS_ENABLED=false` (OK for dev)
  - [ ] `AI_ENABLED=false` (OK for dev)
  - [ ] `SOCKET_ENABLED=true`

### Build & Install

- [ ] `npm install` completes successfully
- [ ] TypeScript compilation: `npm run build` (zero errors)
- [ ] No TypeORM references in build output
- [ ] Dependencies: `npm ls | grep typeorm` (should be empty)

### Local Testing

- [ ] `npm test` runs successfully
- [ ] All test suites pass:
  - [ ] `tests/unit/auth.spec.ts` (10+ tests)
  - [ ] `tests/unit/sessions.spec.ts` (10+ tests)
  - [ ] `tests/unit/ai.spec.ts` (8+ tests)
  - [ ] `tests/unit/analytics.spec.ts` (10+ tests)
- [ ] `npm run test:coverage` shows >70% coverage
- [ ] No deprecation warnings

### Type Safety

- [ ] `tsc --noEmit` passes (zero type errors)
- [ ] All imports resolve correctly
- [ ] No `any` types in critical paths (auth, db, security)

### Local Server

- [ ] `npm run dev` starts without errors
- [ ] Server logs show:
  - [ ] "Supabase adapter initialized"
  - [ ] "Environment validation passed"
  - [ ] "Backend server running on port 2200"
- [ ] Health check works: `curl http://localhost:2200/health`
- [ ] Response is `{"success": true}`

### Local Authentication

- [ ] Register endpoint works: `POST /api/auth/register`
- [ ] Login endpoint works: `POST /api/auth/login`
- [ ] JWT token is valid (3 parts: header.payload.signature)
- [ ] Token includes `org` claim: `jwt.io` decoding shows organization_id

### Local Database

- [ ] Supabase connection successful
- [ ] Can fetch data: `SELECT COUNT(*) FROM users`
- [ ] Can write data: Insert test session
- [ ] Can read back the written data
- [ ] Soft deletes work: `is_deleted` column

### Local WebSocket

- [ ] Connect to WebSocket: `ws://localhost:2200/socket.io`
- [ ] Authentication required (fails without token)
- [ ] Can emit and receive messages
- [ ] Connection logging shows in console

---

## Phase 2: Staging Environment

### Infrastructure

- [ ] Database: Supabase staging project created
- [ ] Redis: Optional staging Redis (can skip for single instance)
- [ ] Secrets: Stored in vault (not in git)
- [ ] Networking: Backend accessible from staging frontend
- [ ] SSL/TLS certificate valid

### Environment Configuration

- [ ] `.env.staging` contains:
  - [ ] `NODE_ENV=staging`
  - [ ] Staging Supabase credentials
  - [ ] Staging Redis (if using)
  - [ ] `CORS_ORIGIN=https://staging-app.example.com`
  - [ ] `SENTRY_DSN` pointing to staging project
- [ ] No secrets in logs: `LOG_LEVEL=info`
- [ ] Rate limits: Conservative values for testing

### RLS Policies

- [ ] All RLS policies applied in Supabase Console:
  ```sql
  -- For each table:
  ALTER TABLE tablename ENABLE ROW LEVEL SECURITY;
  -- 4 policies per table (SELECT, INSERT, UPDATE, DELETE)
  ```
- [ ] Verify RLS enforcement:
  ```bash
  psql -d staging_db -c "SELECT tablename, rowsecurity FROM pg_tables WHERE rowsecurity = TRUE;"
  # Should show all public tables have rowsecurity = TRUE
  ```
- [ ] Cross-tenant access test:
  - [ ] Login as User A (Org 1)
  - [ ] Try to access Org 2 data → 403/empty result
  - [ ] Admin user can access all org data → 200

### Deployment

- [ ] Build succeeds in CI/CD pipeline
- [ ] Tests pass in pipeline
- [ ] Docker image builds (if using)
- [ ] Deployment completes without errors
- [ ] Server starts and stays running >1 minute

### Staging Validation

- [ ] Health endpoint responds: `GET /health`
- [ ] WebSocket connects and authenticates
- [ ] Full auth flow works (register → login → token → refresh)
- [ ] Can start/end sessions
- [ ] AI services available (if enabled)
- [ ] Sentry capturing errors
- [ ] Rate limiting active: Exceed limits → 429 response
- [ ] CORS working: Frontend can make requests
- [ ] Logs appear in CloudWatch/logging service

### Load Testing

- [ ] 100 concurrent connections sustained
- [ ] Response times < 500ms (p95)
- [ ] Database queries complete successfully
- [ ] No connection leaks
- [ ] Memory usage stable over 10 minutes

### Security Testing

- [ ] Missing JWT returns 401
- [ ] Expired token returns 401
- [ ] Invalid token returns 401
- [ ] Wrong CORS origin returns 403 (CORS error)
- [ ] SQL injection attempt fails silently
- [ ] XSS in request params sanitized
- [ ] Rate limit works: 5 login attempts → blocked
- [ ] Password validation enforced (weak passwords rejected)
- [ ] Secrets not in logs: No passwords/tokens in CloudWatch

---

## Phase 3: Pre-Production Deployment

### Final Environment Setup

- [ ] Production Supabase project created
- [ ] Production Redis cluster setup (if multi-instance)
- [ ] Production Sentry project created
- [ ] Secrets moved to AWS Secrets Manager (or equivalent)
- [ ] Database backups configured (daily + weekly)
- [ ] Monitoring dashboards created
- [ ] Alerting rules configured

### Production Environment

- [ ] `.env.production` (or deployment config) has:
  - [ ] `NODE_ENV=production`
  - [ ] Production Supabase credentials
  - [ ] Production Redis (if needed)
  - [ ] Strong `JWT_SECRET` (32+ random characters)
  - [ ] Production `CORS_ORIGIN` (exact frontend URL, no wildcards)
  - [ ] Production `SENTRY_DSN`
  - [ ] `LOG_LEVEL=warn` (not debug)
  - [ ] `ENABLE_REQUEST_LOGGING=false` (to reduce I/O)
- [ ] All optional services enabled:
  - [ ] `AI_ENABLED=true` (if offering AI)
  - [ ] `REDIS_ENABLED=true` (for performance)
  - [ ] `SOCKET_ENABLED=true`

### Security Hardening

- [ ] HTTPS/TLS enforced (no HTTP)
- [ ] Security headers configured (Helmet):
  - [ ] Strict-Transport-Security (HSTS)
  - [ ] X-Frame-Options: DENY
  - [ ] X-Content-Type-Options: nosniff
  - [ ] Content-Security-Policy
- [ ] CORS restricted to production domain only
- [ ] Rate limiting tuned:
  - [ ] Global: 100 requests/15min
  - [ ] Auth: 5 attempts/15min
- [ ] Password policy enforced
- [ ] All secrets in vault (not in code/logs)

### Database

- [ ] Production Supabase RLS policies applied:
  - [ ] All tables have `tenant_id` column
  - [ ] All tables have RLS enabled
  - [ ] 4 policies per table (SELECT/INSERT/UPDATE/DELETE)
  - [ ] Service role bypass for admin ops
- [ ] Connection pooling configured
- [ ] Backups automated:
  - [ ] Daily backups retention: 30 days
  - [ ] Weekly backups retention: 90 days
- [ ] Database logs monitored

### Monitoring & Alerting

- [ ] Sentry configured and receiving errors
- [ ] Uptime monitoring active (<30s check interval)
- [ ] Performance monitoring (GraphQL/APM):
  - [ ] Request duration tracked (p50/p95/p99)
  - [ ] Error rate monitored
  - [ ] Database query performance tracked
- [ ] Alerts configured:
  - [ ] Error rate > 5% (10min window)
  - [ ] Response time > 1s (p95)
  - [ ] Database unavailable
  - [ ] Server down (uptime check fails)
  - [ ] Rate limit spike (unusual patterns)
- [ ] Incident response plan documented
- [ ] On-call rotation established

### Documentation

- [ ] Deployment runbook reviewed
- [ ] Rollback procedure documented
- [ ] Incident response checklist ready
- [ ] Team trained on new stack
- [ ] API documentation reviewed
- [ ] Frontend integration guide reviewed

### Load & Performance

- [ ] Staging load test showed acceptable performance
- [ ] Database can handle projected peak load
- [ ] API response times < 500ms (p95)
- [ ] WebSocket handles 1000+ concurrent connections
- [ ] Memory leaks verified absent (24h test)

---

## Phase 4: Production Deployment

### Pre-Deployment (Day -1)

- [ ] All staging tests passed
- [ ] Security audit completed
- [ ] Compliance review (GDPR/SOC2/etc) completed
- [ ] Team trained and ready
- [ ] Rollback plan documented and tested
- [ ] Communication plan (status page, user notifications) ready

### Deployment (Day 0)

- [ ] Scheduled maintenance window announced
- [ ] Database backup created
- [ ] Deployment initiated
- [ ] Canary deployment (if applicable):
  - [ ] 5% traffic to new version
  - [ ] Monitor error rates (target: <0.5%)
  - [ ] Monitor response times (target: <500ms p95)
- [ ] Rollout 100% traffic to new version
- [ ] Verify all systems operational

### Post-Deployment (Day 0)

- [ ] Health checks passing:
  - [ ] `GET /health` responds 200
  - [ ] `GET /health/websocket` shows connected clients
  - [ ] Database queries responding
- [ ] Auth flow tested end-to-end
- [ ] Real-time features tested (WebSocket)
- [ ] Monitoring dashboards showing data
- [ ] Error rate normal (<0.1%)
- [ ] Response times normal (<200ms p95)
- [ ] No database connection issues
- [ ] No RLS violations in audit logs

### Stabilization (Week 1)

- [ ] Daily error review (Sentry)
- [ ] Performance metrics reviewed
- [ ] User feedback collected
- [ ] No critical issues found
- [ ] Rate limits calibrated (if needed)
- [ ] AI services performing well (if enabled)
- [ ] Team confidence high

### Monitoring (Ongoing)

- [ ] Error rate < 0.1%
- [ ] Response time p95 < 500ms
- [ ] Database query time p95 < 100ms
- [ ] WebSocket connection success > 99%
- [ ] Rate limit false positives < 1%
- [ ] NoSQL injection attempts (blocked) logged
- [ ] Unauthed access attempts minimal
- [ ] Tenant isolation verified (spot checks)

---

## Phase 5: Production Optimization

### Day 1-7

- [ ] Monitor error patterns in Sentry
- [ ] Identify slow endpoints (> 500ms)
- [ ] Optimize hot paths
- [ ] Adjust timeouts if needed
- [ ] Warm up caches

### Week 2-4

- [ ] Performance profiling
- [ ] Database query optimization
- [ ] Caching strategy tuning
- [ ] Rate limit adjustments based on actual traffic
- [ ] Security metrics review

### Monthly

- [ ] Security audit (automated + manual)
- [ ] Dependency updates review
- [ ] Performance trending analysis
- [ ] Incident review (if any)
- [ ] Cost optimization (compute, storage, bandwidth)

---

## Rollback Checklist (If Needed)

### Issue Detected

- [ ] Alert received (error rate spike, downtime, etc)
- [ ] Severity assessed (P1/P2/P3)
- [ ] Decision made: Fix forward or rollback

### Rollback Execution

- [ ] Previous version code/config available
- [ ] Database backup exists and verified
- [ ] Rollback command prepared: `kubectl rollout undo deployment/backend`
- [ ] Executed: `npm run deploy-rollback`
- [ ] Verify:
  - [ ] Health checks passing
  - [ ] Error rate back to normal
  - [ ] Users can authenticate
  - [ ] Database queries working

### Post-Rollback

- [ ] Root cause analysis started
- [ ] Issue triaged
- [ ] Fix developed
- [ ] Regression test added
- [ ] Re-deploy when fixed

---

## Success Criteria

✅ **Deployment Successful If:**

| Metric                | Target        | Actual |
| --------------------- | ------------- | ------ |
| Availability          | > 99.5%       | **\_** |
| Error Rate            | < 0.1%        | **\_** |
| Response Time (p95)   | < 500ms       | **\_** |
| WebSocket Connections | > 99% success | **\_** |
| RLS Violations        | 0             | **\_** |
| Security Alerts       | 0             | **\_** |
| Unplanned Downtime    | 0             | **\_** |

---

## Sign-Off

**Deployment Lead**: ********\_\_\_\_********  
**Date**: ********\_\_\_\_********  
**Approved by**: ********\_\_\_\_********

**Notes**:

```
[Space for additional notes]
```

---

Use this checklist for every deployment to ensure production readiness.

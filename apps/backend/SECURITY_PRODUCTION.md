# Security Hardening Guide

Comprehensive security best practices for production deployment with enterprise-grade protection.

## Table of Contents

1. [Authentication & JWT](#1-authentication--jwt-security)
2. [Password Security](#2-password-security)
3. [Database Security](#3-database-security)
4. [API Security](#4-api-security)
5. [Deployment Checklist](#deployment-checklist)

---

## 1. Authentication & JWT Security

### ✅ JWT Configuration

```typescript
// REQUIRED: Secure JWT_SECRET
- Min 32 characters (256 bits)
- Use cryptographically secure random generation
- Rotate periodically (every 90 days)
- Store in secure vault (not in code)

// Example generation:
openssl rand -base64 32
```

### ✅ JWT Token Claims

Every JWT must include:

```json
{
  "sub": "user-id",
  "aud": "worksight-api",
  "iss": "futureme-backend",
  "org": "organization-id",
  "iat": 1234567890,
  "exp": 1234571490,
  "role": "member|manager|admin"
}
```

**KEY**: Include `org` (tenant_id) in all tokens for RLS enforcement.

### ✅ Token Expiration

```
Access Token: 1 hour (3600 seconds)
Refresh Token: 30 days (2592000 seconds)
Session Expiry: 65 minutes (SESSION_EXPIRY env var)
```

### Enforcement

```typescript
// In auth.middleware.ts
const token = req.headers.authorization?.replace('Bearer ', '');
const decoded = jwt.verify(token, process.env.JWT_SECRET!);

// CRITICAL: Verify organization matches request context
if (decoded.org !== req.user.organizationId) {
  throw new UnauthorizedError('Token org mismatch');
}
```

---

## 2. Password Security

### ✅ Hashing

- Algorithm: **bcryptjs** (not bcrypt - JS version for Node.js)
- Salt rounds: **12** (takes ~250ms per hash)
- Never store plaintext passwords

```typescript
import bcryptjs from 'bcryptjs';

const hashedPassword = await bcryptjs.hash(plainPassword, 12);
const isValid = await bcryptjs.compare(plainPassword, hashedPassword);
```

### ✅ Password Policy

Enforce at registration:

```
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character (!@#$%^&*)
```

### ✅ Password Reset

```
1. User requests reset → Send email with signed token
2. Token valid for 30 minutes only
3. Token includes user_id + timestamp signature
4. Reset URL: frontend.com/reset?token=xxx
5. Frontend submits new password + token
6. Backend verifies token before updating password
7. Invalidate all refresh tokens on password change
```

---

## 3. CORS & Origin Validation

### ✅ Production Configuration

```typescript
// NEVER use wildcard (*) in production
const corsOptions: CorsOptions = {
  origin: process.env.CORS_ORIGIN, // e.g., "https://app.mydomain.com"
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));

// Validate on every request
if (!allowedOrigins.includes(req.headers.origin)) {
  return res.status(403).json({ error: 'CORS violation' });
}
```

### ✅ Subdomain Isolation

Different subdomains = different CORS origins:

```
app.mycompany.com  → CORS allowed
api.mycompany.com  → NOT allowed (different domain)
staging.mycompany.com → Different CORS config
```

---

## 4. Rate Limiting & DDoS Protection

### ✅ Implement Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

// Global rate limit
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS!), // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX!), // 100 req/15min
  message: 'Too many requests, please retry after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ client: redisClient }), // Distributed across servers
});

app.use('/api/', limiter);

// Stricter auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  skipSuccessfulRequests: true,
  message: 'Too many login attempts',
});

app.post('/api/auth/login', authLimiter, loginHandler);
app.post('/api/auth/register', authLimiter, registerHandler);
```

### ✅ Gradual Backoff

```
Attempt 1-3: No delay
Attempt 4-5: 30s wait
Attempt 6+: 5-minute lockout
Account locked after 10 failed attempts
```

---

## 5. Data Encryption

### ✅ Passwords

```typescript
// Always hash with bcryptjs
const hash = await bcrypt.hash(password, 12);
```

### ✅ Sensitive Data in Database

Fields that should be encrypted:

- SSN (if stored)
- Phone number
- Bank account (if stored)
- API keys

```typescript
// Use field-level encryption
import crypto from 'crypto';

function encryptField(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(process.env.ENCRYPTION_KEY!), iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptField(encrypted: string): string {
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(process.env.ENCRYPTION_KEY!),
    iv
  );
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### ✅ In Transit

- HTTPS/TLS 1.3 enforced (all traffic)
- No unencrypted HTTP
- HSTS header (strict-transport-security) for 1 year

---

## 6. Secrets Management

### ✅ Never

```
❌ Commit .env files to git
❌ Log JWT_SECRET or API keys
❌ Pass secrets in URLs
❌ Store secrets in code comments
❌ Use same secret in dev/test/prod
```

### ✅ Always

```
✅ Use environment variables
✅ Store in vault (AWS Secrets Manager, HashiCorp Vault)
✅ Rotate keys periodically
✅ Audit access to secrets
✅ Use separate keys per environment
✅ Regenerate keys if compromised
```

### Production Secret Vault Example (AWS Secrets Manager)

```typescript
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

const secretsClient = new SecretsManager();

async function getSecret(secretName: string): Promise<string> {
  const result = await secretsClient.getSecretValue({ SecretId: secretName });
  return result.SecretString || '';
}

// Load on startup
const JWT_SECRET = await getSecret('prod/jwt-secret');
```

---

## 7. Logging & Monitoring

### ✅ What to Log

```
✅ Authentication attempts (success/failure)
✅ Authorization failures
✅ Data access (via audit_logs)
✅ Configuration changes
✅ Error stack traces
```

### ❌ What NOT to Log

```
❌ JWT tokens
❌ API keys or secrets
❌ Passwords (even hashed)
❌ Credit card numbers
❌ Personally identifiable information (PII)
❌ Auth headers
```

### ✅ Secure Logging

```typescript
import logger from '@utils/logger';

// Sanitize before logging
function sanitizeObject(obj: any): any {
  const sensitive = ['password', 'token', 'secret', 'key', 'authorization'];
  const sanitized = { ...obj };

  for (const key in sanitized) {
    if (sensitive.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
}

logger.info('Request received', sanitizeObject(req.body));
```

### ✅ Sentry Configuration

```typescript
import Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  beforeSend(event) {
    // Filter out sensitive data
    if (event.request?.cookies) delete event.request.cookies;
    if (event.request?.headers?.authorization) delete event.request.headers.authorization;
    return event;
  },
});
```

---

## 8. Tenant Isolation

### ✅ Every Request Must Verify

```typescript
// In enforceTenantIsolation.middleware.ts
app.use((req, res, next) => {
  if (!req.user || !req.user.organizationId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Store org ID in request context
  req.organizationId = req.user.organizationId;

  // Verify all database queries include org_id filter
  next();
});
```

### ✅ Database Query Pattern

```typescript
// ALWAYS include organization_id in WHERE clause
const sessions = await supabase
  .from('work_sessions')
  .select('*')
  .eq('organization_id', req.organizationId) // ← CRITICAL
  .eq('user_id', req.user.id);

// NEVER do queries without tenant filter
// ❌ WRONG: await supabase.from('sessions').select('*');
```

### ✅ RLS Enforcement

All tables have Row Level Security enabled:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = TRUE;
```

---

## 9. Input Validation & Injection Prevention

### ✅ Validate All Input

```typescript
import { z } from 'zod';

const createSessionSchema = z.object({
  projectId: z.string().uuid(),
  taskId: z.string().uuid(),
  description: z.string().max(500),
  startTime: z.string().datetime(),
  metadata: z.record(z.any()).optional(),
});

app.post('/sessions', (req, res) => {
  const result = createSessionSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  // Proceed with validated data
});
```

### ✅ Prevent SQL Injection

- Use parameterized queries (always via Supabase client)
- Never concatenate SQL strings
- Use prepared statements

```typescript
// ✅ CORRECT: Uses parameterization
const { data } = await supabase.from('users').select('*').eq('email', userEmail); // Parameterized

// ❌ WRONG: SQL concatenation (NEVER DO THIS)
// const query = `SELECT * FROM users WHERE email = '${userEmail}'`;
```

### ✅ Prevent XSS

```typescript
// Content-Security-Policy header
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  })
);

// Escape output in APIs (Supabase handles this)
res.json({ message: escapeHtml(userInput) });
```

---

## 10. API Security Headers

### ✅ Required Headers (via Helmet)

```typescript
import helmet from 'helmet';

app.use(helmet()); // Sets all standard security headers

// Specific configuration
app.use(
  helmet.hsts({
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  })
);

app.use(helmet.frameguard({ action: 'deny' }));
app.use(helmet.xssFilter());
app.use(helmet.noSniff());
app.use(helmet.referrerPolicy({ policy: 'no-referrer' }));
```

### Headers Set Automatically

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
Referrer-Policy: no-referrer
```

---

## 11. API Key Security (if used)

### ✅ API Key Generation

```typescript
function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Store hashed version in database
const keyHash = await bcrypt.hash(apiKey, 12);
```

### ✅ API Key Usage

```
- Use in Authorization header: Bearer sk_live_xxxxx
- Rotate yearly
- Scope to specific permissions
- Log API key usage
- Revoke compromised keys immediately
```

---

## 12. Production Deployment Checklist

### Security

- [ ] `JWT_SECRET` is 32+ random characters
- [ ] All secrets in environment (not in code)
- [ ] `CORS_ORIGIN` restricted to your domains
- [ ] HTTPS/TLS 1.3 enforced
- [ ] Helmet security headers configured
- [ ] Rate limiting enabled
- [ ] bcryptjs for password hashing
- [ ] Audit logs enabled
- [ ] Sentry monitoring enabled

### Database

- [ ] RLS enabled on all tables
- [ ] `tenant_id` on every table
- [ ] Service role key kept secret
- [ ] Database backups automated
- [ ] Connection pooling configured
- [ ] Database logs monitored

### Application

- [ ] `NODE_ENV=production`
- [ ] `LOG_LEVEL=info` (not debug)
- [ ] No secrets in logs
- [ ] Error handling comprehensive
- [ ] Graceful shutdown implemented
- [ ] Health checks available

### Monitoring

- [ ] Sentry DSN configured
- [ ] CloudWatch/DataDog alerts set up
- [ ] Performance metrics collected
- [ ] Uptime monitoring active
- [ ] Security audit log review process
- [ ] Incident response plan

---

## 13. Incident Response

### If Compromise Suspected

```
IMMEDIATE (< 1 hour):
1. Revoke JWT_SECRET (all sessions invalidated)
2. Rotate all API keys
3. Review access logs in Sentry
4. Block suspicious IP addresses
5. Notify affected users

SHORT TERM (< 24 hours):
1. Analyze breach extent
2. Apply security patches
3. Update monitoring rules
4. Review RLS policies
5. Perform security audit

LONG TERM (1-2 weeks):
1. Post-mortem analysis
2. Process improvements
3. Security training
4. Dependency updates
5. Penetration testing
```

---

For vulnerabilities, contact: security@futureme.io

See also: [OWASP Top 10](https://owasp.org/www-project-top-ten/)

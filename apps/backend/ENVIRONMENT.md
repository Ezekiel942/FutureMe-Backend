# Environment Configuration Guide

## Overview

This document describes all environment variables required for FutureMe Backend production deployment with Supabase multi-tenancy.

## Required vs Optional Variables

### ✅ Required (App will NOT start without these)

- `NODE_ENV` - Application environment
- `PORT` - Server port
- `JWT_SECRET` - JWT signing key (min 32 characters)
- `SUPABASE_URL` + `SUPABASE_ANON_KEY` - Database access (for database features)

### ⚠️ Optional (Features disabled if missing)

- Redis - Caching & presence engine
- AI services - Burnout prediction, coaching
- Email - User notifications
- S3 storage - File uploads
- Sentry - Error monitoring

---

## Detailed Configuration

### Core Servers

```
NODE_ENV=production          # development | production | staging | test
PORT=2200                    # Server port (1000-65535)
JWT_SECRET=your-long-key-here... # Min 32 characters, use strong random value
SESSION_EXPIRY=3900          # Session TTL in seconds (default: 65 minutes)
APP_URL=https://api.prod.com # Backend public URL
FRONTEND_URL=https://app.prod.com # Frontend URL (for CORS)
CORS_ORIGIN=https://app.prod.com # CORS allowed origin
```

### Supabase Database

```
SUPABASE_URL=https://project.supabase.co         # Project URL
SUPABASE_ANON_KEY=eyJhbG...                       # Anon key for client operations
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...              # Service role for admin operations
```

All tables must implement Row-Level Security (RLS) with `tenant_id` isolation.

### Redis Caching & Presence (Optional)

```
REDIS_ENABLED=true                      # Enable Redis (false = memory-only fallback)
REDIS_URL=rediss://default:pw@host:6379 # Upstash or self-hosted Redis
REDIS_RETRY_INTERVAL=5000               # Reconnection retry interval (ms)
REDIS_CACHE_TTL=3600                    # Cache expiration (seconds)
```

When disabled, Redis operations gracefully degrade to database queries.

### WebSocket Real-time (Optional)

```
SOCKET_ENABLED=true                # Enable WebSocket server
SOCKET_PING_INTERVAL=30000         # Ping interval (ms) to detect disconnects
SOCKET_PING_TIMEOUT=60000          # Timeout before force disconnect (ms)
```

Events: session changes, risk detection, presence, announcements

### AI Services (Optional)

```
AI_ENABLED=true                     # Enable AI features
OPENAI_API_KEY=sk-your-key...       # OpenAI API key
AI_MODEL=gpt-3.5-turbo              # Model selection
AI_TIMEOUT_MS=30000                 # Request timeout (5s-120s)
AI_CACHE_TTL=3600                   # Cache results (seconds)
AI_RATE_LIMIT_PER_TENANT=100        # Max AI calls per tenant per hour
```

Services: burnout prediction, coaching recommendations, attendance analysis, project risk

### Email Service (Optional)

```
RESEND_API_KEY=re_your-key...       # Resend.com API key
EMAIL_FROM=noreply@myapp.com        # Sender email address
```

Without these, email notifications are disabled (features still work).

### File Storage - AWS S3 (Optional)

```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=+abcd1234...
AWS_REGION=us-east-1
AWS_S3_BUCKET=my-bucket-name
```

All 4 are required for file storage. Without them, avatar/file uploads return error.

### Monitoring - Sentry (Optional)

```
SENTRY_DSN=https://key@org.ingest.sentry.io/project
LOG_LEVEL=info                      # debug | info | warn | error
ENABLE_REQUEST_LOGGING=true         # Log HTTP request/response
```

Error tracking: unhandled exceptions, promise rejections, request failures

### Rate Limiting

```
RATE_LIMIT_WINDOW_MS=900000         # 15-minute window
RATE_LIMIT_MAX_REQUESTS=100         # Max requests per window
AUTH_RATE_LIMIT_MAX=5               # Max login attempts per period
```

Protects against brute force, DDoS, and API abuse.

### Tenant Multi-tenancy

```
DEFAULT_TENANT_PLAN=pro             # free | pro | enterprise
MAX_USERS_PER_TENANT=1000           # Limit per organization
MAX_PROJECTS_PER_TENANT=100         # Limit per organization
```

### Presence & Idle Detection

```
IDLE_TIMEOUT_MIN=5                  # Idle threshold (minutes)
IDLE_END_MIN=15                     # Mark offline after (minutes)
PRESENCE_HEARTBEAT_INTERVAL=30000   # Client heartbeat (ms)
```

### File Upload Limits

```
MAX_AVATAR_SIZE_MB=5                # User profile picture
MAX_FILE_UPLOAD_MB=50               # General file uploads
```

---

## Production Checklist

### Security

- [ ] `JWT_SECRET` is 32+ random characters
- [ ] `CORS_ORIGIN` is restricted to your domain
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is kept secret (not in code)
- [ ] No secrets logged in `LOG_LEVEL=debug`
- [ ] All env vars use unique values per environment

### Performance

- [ ] `REDIS_ENABLED=true` for distributed caching
- [ ] `NODE_ENV=production`
- [ ] `LOG_LEVEL=warn` to reduce disk I/O
- [ ] Rate limits calibrated for your traffic

### Monitoring

- [ ] `SENTRY_DSN` configured to catch errors
- [ ] `ENABLE_REQUEST_LOGGING=true` for debugging
- [ ] Regular log review from Sentry/CloudWatch

### Database

- [ ] Supabase RLS policies enabled on all tables
- [ ] `SUPABASE_URL` + `SUPABASE_ANON_KEY` are valid
- [ ] Database backups configured in Supabase Console

### Optional Services

- [ ] Email configured if sending invitations
- [ ] S3 storage configured if avatar uploads enabled
- [ ] AI enabled if using predictive features
- [ ] Redis configured if multi-instance deployment

---

## Environment-Specific Configurations

### Development

```bash
NODE_ENV=development
PORT=2200
JWT_SECRET=dev-secret-min-32-characters-only
SUPABASE_URL=https://dev-project.supabase.co
SUPABASE_ANON_KEY=dev-anon-key
REDIS_ENABLED=false
AI_ENABLED=false
SENTRY_DSN=  # Empty
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:3000
```

### Staging

```bash
NODE_ENV=staging
PORT=2200
JWT_SECRET=staging-secret-min-32-characters-secure
SUPABASE_URL=https://staging-project.supabase.co
SUPABASE_ANON_KEY=staging-anon-key
REDIS_ENABLED=true
REDIS_URL=rediss://staging.upstash.io:6379
AI_ENABLED=true
SENTRY_DSN=https://key@org.ingest.sentry.io/staging
LOG_LEVEL=info
CORS_ORIGIN=https://staging-app.example.com
```

### Production

✅ All required variables with strong, unique values
✅ All optional critical services enabled
✅ Rate limits appropriate for expected load
✅ Monitoring (Sentry) enabled
✅ Redis for performance
✅ No debug logging
✅ HTTPS/TLS everywhere

---

## Validation at Startup

When the backend starts, it validates:

1. ✅ Required variables present
2. ✅ JWT_SECRET min 32 characters
3. ✅ URLs are valid format
4. ✅ Numbers are within valid ranges
5. ⚠️ Warns about missing optional services

If validation fails, the process exits with error details.

---

## Security Best Practices

### Never

- ❌ Commit `.env` files to git
- ❌ Log `JWT_SECRET` or API keys
- ❌ Use same JWT_SECRET in dev/prod
- ❌ Disable CORS in production
- ❌ Use `LOG_LEVEL=debug` in production

### Always

- ✅ Use strong random `JWT_SECRET` (32+ chars)
- ✅ Rotate `JWT_SECRET` periodically
- ✅ Store secrets in secure vaults (AWS Secrets Manager, GitHub Secrets)
- ✅ Use HTTPS URLs only in production
- ✅ Rate limit sensitive endpoints
- ✅ Enable Sentry error tracking
- ✅ Backup Supabase database regularly
- ✅ Review rate limit effectiveness monthly

---

## Troubleshooting

### "JWT_SECRET must be at least 32 characters"

Generate a strong secret:

```bash
openssl rand -base64 32
# Output: AbCdEfGhIjKlMnOpQrStUvWxYzAbCdEfGhIjKlMn==
```

### Redis connection fails

- Verify `REDIS_URL` is correct
- Check network/firewall access
- Redis falls back to memory; features still work

### AI services timeout

- Increase `AI_TIMEOUT_MS` (max 120000)
- Check OpenAI API status
- Fallback to rule-based analysis if unavailable

### Sentry not capturing errors

- Verify `SENTRY_DSN` is valid
- Check internet connectivity
- Errors still logged locally

---

See deployment guides for Docker, Kubernetes, PM2, etc.

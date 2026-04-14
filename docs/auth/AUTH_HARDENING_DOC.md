# Auth Hardening, Authorization & Rate Limiting Documentation

## ✅ Completed Tasks

### 1. JWT + Refresh Token Authentication

**Files Created/Modified:**

- `apps/backend/src/database/models/RefreshToken.model.ts` (new)
- `apps/backend/src/modules/auth/auth.service.ts`
- `apps/backend/src/api/controllers/auth.controller.ts`
- `apps/backend/src/api/routes/auth.routes.ts`

**Implementation Details:**

#### Token Lifecycle

- **Access Token**: Short-lived (15 minutes)
  - Contains: `sub` (user ID), `email`, `role`, `org` (organization)
  - Used for authenticating HTTP requests
- **Refresh Token**: Long-lived (7 days)
  - Contains: `sub` (user ID), `type: 'refresh'`
  - Stored in database for revocation support
  - Can be revoked independently

#### New Endpoints

**POST `/api/auth/login`**

```json
Request:
{
  "email": "user@example.com",
  "password": "SecurePass123"
}

Response (Success):
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "user-123",
      "email": "user@example.com",
      "role": "user"
    }
  }
}

Response (Error):
{
  "success": false,
  "message": "Invalid credentials",
  "code": "INVALID_CREDENTIALS"
}
```

**POST `/api/auth/refresh`**

```json
Request:
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

Response (Success):
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}

Response (Error):
{
  "success": false,
  "message": "Refresh token expired",
  "code": "INVALID_TOKEN"
}
```

**POST `/api/auth/logout`** (requires `Authorization: Bearer <accessToken>`)

```json
Response (Success):
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

#### Auth Service Functions

```typescript
// Issue short-lived access token
issueAccessToken(user: User): string

// Issue long-lived refresh token and store in DB
issueRefreshToken(user: User): Promise<string>

// Login with both tokens
loginWithTokens(loginInput: LoginProps): Promise<TokenPair>

// Exchange refresh token for new access token
refreshAccessToken(refreshToken: string): Promise<string>

// Logout and revoke all refresh tokens
logout(userId: string): Promise<void>

// Verify JWT signature and expiration
verifyToken(token: string): JwtPayload
```

#### Error Handling

All auth errors return appropriate HTTP status codes:

| Scenario       | Code            | Message                                   | Status |
| -------------- | --------------- | ----------------------------------------- | ------ |
| Missing token  | `MISSING_TOKEN` | "Missing or invalid authorization header" | 401    |
| Invalid token  | `INVALID_TOKEN` | "Invalid token"                           | 401    |
| Expired token  | `INVALID_TOKEN` | "Token expired"                           | 401    |
| Tampered token | `INVALID_TOKEN` | "Token verification failed"               | 401    |
| Revoked token  | `INVALID_TOKEN` | "Refresh token revoked or expired"        | 401    |
| User not found | `NOT_FOUND`     | "User not found"                          | 404    |

---

### 2. Authorization Middleware

**File:** `apps/backend/src/api/middlewares/auth.middleware.ts`

#### Middleware Functions

**`extractAuthToken`** - Extracts JWT from `Authorization: Bearer <token>` header

- Verifies JWT signature using `ENV.JWT_SECRET`
- Attaches decoded payload to `req.user`
- Returns 401 on missing/invalid token

**`requireAuth`** - Ensures user is authenticated

- Can be used standalone or after `extractAuthToken`
- Checks `req.user.sub` exists
- Returns 401 if not authenticated

**`requireAdmin`** - Ensures user has admin role

- Must be used after `requireAuth` or `extractAuthToken`
- Checks `req.user.role === 'admin'`
- Returns 403 if user is not admin
- Logs unauthorized attempts

**`requireOwnResource(paramName)`** - Ensures user can only access own resources

- Factory function that takes param name (default: `'userId'`)
- Allows access if user ID matches param OR user is admin
- Returns 403 for unauthorized cross-user access
- Logs unauthorized attempts

#### Usage Examples

```typescript
// Protect endpoint requiring authentication
router.post('/profile', extractAuthToken, requireAuth, updateProfile);

// Admin-only endpoint
router.delete('/users/:userId', extractAuthToken, requireAdmin, deleteUser);

// User accessing own resource
router.get('/users/:userId', extractAuthToken, requireOwnResource('userId'), getUser);

// Optional: Admin can bypass resource ownership check
router.get(
  '/users/:userId/data',
  extractAuthToken,
  requireOwnResource('userId'), // Allows self + admin
  getData
);
```

#### Error Responses

**Unauthorized (Missing/Invalid Token):**

```json
{
  "success": false,
  "message": "Authentication required",
  "code": "AUTHENTICATION_ERROR",
  "status": 401
}
```

**Forbidden (Insufficient Permissions):**

```json
{
  "success": false,
  "message": "Forbidden",
  "code": "AUTHORIZATION_ERROR",
  "status": 403
}
```

---

### 3. Rate Limiting

**File:** `apps/backend/src/api/middlewares/rateLimit.middleware.ts`

**Dependency:** `express-rate-limit@^7.1.5`

#### Rate Limiters

| Limiter          | Window | Limit   | Use Case                   |
| ---------------- | ------ | ------- | -------------------------- |
| `generalLimiter` | 15 min | 100 req | All routes (except health) |
| `authLimiter`    | 15 min | 5 req   | Login, Register            |
| `refreshLimiter` | 15 min | 10 req  | Token Refresh              |

#### Applied To Routes

**High Risk (5 attempts/15 min):**

- `POST /api/auth/login` — Brute force protection
- `POST /api/auth/register` — Account enumeration protection

**Medium Risk (10 attempts/15 min):**

- `POST /api/auth/refresh` — Rate limiting with margin for legitimate users

**No rate limit:**

- `POST /api/auth/logout` — Protected by auth middleware
- Health checks — Skipped in general limiter

#### Rate Limit Response

```json
{
  "success": false,
  "message": "Too many authentication attempts, please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "status": 429
}
```

Headers included:

- `RateLimit-Limit`: Maximum requests in window
- `RateLimit-Remaining`: Requests remaining
- `RateLimit-Reset`: Unix timestamp when limit resets

---

## 🔐 Security Improvements

### Before

- Single long-lived JWT (7 days)
- All requests return raw objects
- No authorization checks for resource ownership
- No rate limiting on auth endpoints

### After

✅ **Token Lifecycle**

- Access tokens expire in 15 minutes
- Refresh tokens expire in 7 days and can be revoked
- Logout invalidates all refresh tokens

✅ **Authorization**

- Centralized auth middleware
- Role-based access control (RBAC) with `requireAdmin`
- Resource ownership checks with `requireOwnResource`

✅ **Rate Limiting**

- Brute force protection (5 login attempts/15 min)
- Account enumeration protection on register
- Configurable limits per endpoint

✅ **Error Handling**

- Consistent error responses
- No stack traces to clients
- Appropriate HTTP status codes

---

## 📋 Migration Guide

### For Existing Code

#### Old Login Pattern

```typescript
// Before: Single token
const { token } = await loginResponse.json();
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
```

#### New Login Pattern

```typescript
// After: Separate tokens
const { accessToken, refreshToken } = await loginResponse.json();
axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
localStorage.setItem('refreshToken', refreshToken);
```

#### Token Refresh Implementation

```typescript
// When access token expires (401 response)
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  const response = await axios.post('/api/auth/refresh', { refreshToken });
  const { accessToken } = response.data.data;
  axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
  return accessToken;
}
```

#### Protected API Calls

```typescript
// Same as before - just use accessToken in Authorization header
const response = await axios.get('/api/users/123', {
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

---

##  Testing

### 1. Test Rate Limiting

```bash
# Attempt 6 logins in quick succession
for i in {1..6}; do
  curl -X POST http://localhost:3900/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"TestPass123"}'
  echo ""
done

# 6th request should return 429 (Too Many Requests)
```

### 2. Test Token Expiration

```bash
# Get access + refresh tokens
TOKENS=$(curl -X POST http://localhost:3900/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"TestPass123"}' \
  | jq '.data')

ACCESS_TOKEN=$(echo $TOKENS | jq -r '.accessToken')
REFRESH_TOKEN=$(echo $TOKENS | jq -r '.refreshToken')

# Wait 15 minutes (for production) or use a test endpoint
sleep 15

# Try to use expired token
curl -X GET http://localhost:3900/api/profile \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
# Should return 401 "Token expired"

# Refresh the token
curl -X POST http://localhost:3900/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"${REFRESH_TOKEN}\"}"
# Should return new accessToken
```

### 3. Test Admin Authorization

```bash
# Create admin user (requires existing admin or direct DB insert)
# Then test admin-only endpoint
curl -X DELETE http://localhost:3900/api/admin/users/123 \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"
# Should work

# Test with non-admin user
curl -X DELETE http://localhost:3900/api/admin/users/123 \
  -H "Authorization: Bearer ${USER_TOKEN}"
# Should return 403 Forbidden
```

### 4. Test Resource Ownership

```bash
# User A tries to access User B's data
USER_B_ID="different-user-id"
curl -X GET http://localhost:3900/api/users/${USER_B_ID} \
  -H "Authorization: Bearer ${USER_A_TOKEN}"
# Should return 403 Forbidden
```

---

## 📦 Dependencies Added

```json
{
  "dependencies": {
    "cookie-parser": "^1.4.6",
    "express-rate-limit": "^7.1.5"
  },
  "devDependencies": {
    "@types/cookie-parser": "^1.4.3"
  }
}
```

---

## Backward Compatibility

**No Breaking Changes**

- Existing `/api/auth/register` endpoint unchanged
- Old login token pattern can still be used (first 15 minutes of access)
- Existing route paths preserved
- Error response format unchanged
- Role-based validation happens transparently

**Migration Needed For**

- Frontend token storage (refresh token + access token)
- Token refresh logic on 401 responses
- Logout implementation (now makes API call)

---

## Environment Variables

No new environment variables required.
Uses existing `JWT_SECRET` for all tokens.

---

## Next Steps (Optional)

1. **Add Activity Logging** — Log all auth events (login, logout, token refresh)
2. **Implement 2FA** — Add two-factor authentication
3. **Session Management** — Track active sessions per user
4. **Token Revocation List (TRL)** — Pre-emptively revoke tokens by ID
5. **API Key Support** — Allow service-to-service auth without login
6. **OAuth2 Integration** — Support third-party authentication

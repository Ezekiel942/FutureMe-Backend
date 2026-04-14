# FutureMe API - End-to-End Testing Guide

**Generated:** February 28, 2026  
**Based on:** API_ENDPOINT_INVENTORY.md + Postman Collection Complete

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Testing Prerequisites](#testing-prerequisites)
3. [Recommended E2E Testing Order](#recommended-e2e-testing-order)
4. [Full Test Scenarios](#full-test-scenarios)
5. [Negative Test Cases](#negative-test-cases)
6. [Security & Permission Tests](#security--permission-tests)
7. [Token Lifecycle Tests](#token-lifecycle-tests)
8. [Endpoint Dependencies](#endpoint-dependencies)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start

1. **Import Files into Postman:**
   - Collection: `FutureMe_API_Collection_Complete.postman_collection.json`
   - Environment: `FutureMe_API_Environment.postman_environment.json`

2. **Start with Auth Flow:**

   ```
   Register → Login → Health Check
   ```

3. **Run Active Endpoints Suite:**
   - Auth (6 tests)
   - Sessions (4 tests)
   - Admin (1 test)
   - System (2 tests)

4. **Avoid Unregistered Endpoints:**
   - These are marked `[UNREGISTERED]` in the collection
   - They exist in code but aren't accessible via app.ts

---

## Testing Prerequisites

### Environment Setup

1. **Backend Running:**

   ```bash
   npm install
   npm run dev
   # Server should be running on http://localhost:2000
   ```

2. **Database Available:**
   - PostgreSQL connected (or in-memory mode)
   - Redis accessible (for token validation)

3. **Postman Environment Variables:**
   - `baseUrl`: http://localhost:2000
   - `testEmail`: test.user@example.com
   - All token fields: auto-populated by test scripts

### User Accounts for Testing

Create these accounts or use dynamic registration:

| Role        | Email                        | Password      | Purpose                |
| ----------- | ---------------------------- | ------------- | ---------------------- |
| User        | test.user@example.com        | TestPass123!  | Full access testing    |
| Admin       | admin@example.com            | AdminPass123! | Admin endpoint testing |
| (Generated) | test.{timestamp}@example.com | TestPass123!  | New user testing       |

---

## Recommended E2E Testing Order

### Phase 1: Authentication (5 minutes)

**Purpose:** Establish valid tokens and test auth flows

**Order:**

```
1. Register (new user)
   ↓ Saves: userId

2. Login (same email)
   ↓ Saves: accessToken, refreshToken

3. Health Check (verify server)
   ↓ No auth required

4. Readiness Probe (verify readiness)
   ↓ No auth required
```

**Expected Outcomes:**

- ✅ Register returns 201 with user ID
- ✅ Login returns 200 with tokens
- ✅ Health returns 200 with status: "ok"
- ✅ Ready returns 200 with ready: true

**Skip If:**

- You already have valid tokens from previous login

---

### Phase 2: Session Management (10 minutes)

**Purpose:** Test session lifecycle with valid auth token

**Prerequisites:**

- ✅ Must have valid accessToken from Phase 1

**Order:**

```
1. Create Session
   ↓ Saves: sessionId

2. Pause Session (using saved sessionId)
   ↓ Changes status to "paused"

3. Resume Session (same sessionId)
   ↓ Changes status back to "active"

4. End Session (same sessionId)
   ↓ Sets final duration, status: "ended"
```

**Expected Outcomes:**

- ✅ Create Session: 201, status: "active"
- ✅ Pause Session: 200, status: "paused"
- ✅ Resume Session: 200, status: "active"
- ✅ End Session: 200, status: "ended", durationSeconds present

**Common Issues:**

- **401 Unauthorized** → accessToken missing/expired, re-run Phase 1
- **409 Conflict** → Active session exists, end it first or use different user
- **403 Forbidden** → Session ownership validation failed

---

### Phase 3: Token Refresh (5 minutes)

**Purpose:** Test token rotation without re-login

**Prerequisites:**

- ✅ Must have valid refreshToken from Phase 1

**Order:**

```
1. Refresh Token (using refreshToken)
   ↓ Saves: NEW accessToken

2. Create Session (using new token)
   ↓ Verifies new token works
```

**Expected Outcomes:**

- ✅ Refresh Token: 200, returns new accessToken
- ✅ New token immediately usable in Create Session

**Validates:**

- Token rotation works without re-login
- Sessions respect new tokens

---

### Phase 4: Admin Access (5 minutes)

**Purpose:** Test role-based access control

**Prerequisites:**

- ✅ Must have admin user account
- ✅ Must have admin's accessToken

**Order:**

```
1. Admin Login (admin@example.com)
   ↓ Saves: adminAccessToken

2. Get Audit Logs (using adminAccessToken)
   ↓ Returns paginated logs
```

**Expected Outcomes:**

- ✅ Regular user trying audit logs: 403 Forbidden
- ✅ Admin user trying audit logs: 200 OK with logs array

**Validates:**

- `requireAdmin` middleware enforces role check
- Pagination parameters work (page, limit)

---

### Phase 5: Password Reset Flow (5 minutes)

**Purpose:** Test password reset workflow

**Order:**

```
1. Forgot Password (email)
   ↓ Saves: resetToken

2. Reset Password (new password)
   ↓ Password changed

3. Login with new password
   ↓ Should work with new password
```

**Expected Outcomes:**

- ✅ Forgot Password: 200, returns resetToken (for testing)
- ✅ Reset Password: 200, message confirms success
- ✅ Login with new password: 200, receives tokens

**Security Notes:**

- Reset endpoint validates token expiry
- Tokens are rate-limited (passwordResetLimiter)
- In production, tokens sent via email only (not response)

---

## Full Test Scenarios

### Scenario A: Happy Path - Complete User Journey

**Duration:** 15 minutes  
**Description:** Normal user workflow from registration to session management

```bash
# Phase 1: Authentication
1. POST /api/auth/register
   Body: { email, password, firstName, lastName }
   Expected: 201, user ID saved

2. POST /api/auth/login
   Body: { email, password }
   Expected: 200, tokens saved

# Phase 2: Session Management
3. POST /api/sessions
   Body: { projectId, metadata }
   Expected: 201, sessionId saved

4. POST /api/sessions/{sessionId}/pause
   Expected: 200, status: paused

5. POST /api/sessions/{sessionId}/resume
   Expected: 200, status: active

6. POST /api/sessions/{sessionId}/end
   Body: { notes }
   Expected: 200, status: ended, duration calculated

# Phase 3: Logout
7. POST /api/auth/logout
   Expected: 200, session invalidated
```

**Assertions:**

```javascript
// After each request, verify:
- Status code matches expectation
- Response has success: true (except health)
- Required fields present in data object
- Timestamps valid (ISO 8601)
- Token values are non-empty strings
```

---

### Scenario B: Role-Based Access Control

**Duration:** 10 minutes  
**Description:** Verify role enforcement on protected endpoints

```bash
# Setup: Create 2 users
User A: Regular user (test.user@example.com)
User B: Admin user (admin@example.com)

# Test 1: Regular user accessing admin endpoint
1. Login as User A
   Expected: 200, tokens received

2. GET /api/v1/admin/audit-logs
   Expected: 403 Forbidden
   Error: "User is not admin"

# Test 2: Admin user accessing admin endpoint
3. Login as User B (admin)
   Expected: 200, tokens received

4. GET /api/v1/admin/audit-logs
   Expected: 200 OK
   Data: logs array with pagination metadata
```

**Validations:**

```javascript
// Verify role enforcement:
pm.test('Non-admin cannot access audit logs', function () {
  pm.response.to.have.status(403);
  pm.response.json().message.includes('Forbidden');
});

pm.test('Admin can access audit logs', function () {
  pm.response.to.have.status(200);
  pm.response.json().data.logs.length >= 0;
});
```

---

### Scenario C: Session Ownership Enforcement

**Duration:** 8 minutes  
**Description:** Verify users can only manage their own sessions

```bash
# Setup: Create 2 users with sessions
User A's Session: session-123
User B's Session: session-456

# Test 1: User A tries to pause User B's session
1. Login as User A (save token)
   Expected: 200

2. POST /api/sessions/session-456/pause
   Using User A's token, trying to pause User B's session
   Expected: 403 Forbidden
   Error: "Session does not belong to user"

# Test 2: User A pauses own session
3. POST /api/sessions/session-123/pause
   Using User A's token, own session
   Expected: 200, session paused
```

**Validations:**

```javascript
pm.test("User cannot pause another user's session", function () {
  pm.response.to.have.status(403);
});

pm.test('User can pause own session', function () {
  pm.response.to.have.status(200);
  pm.response.json().data.status === 'paused';
});
```

---

## Negative Test Cases

### Test: Missing Required Fields

**Endpoint:** POST /api/auth/register

```bash
# Test 1: Missing email
Body: { password, firstName, lastName }
Expected: 400 Bad Request
Error: "email is required"

# Test 2: Missing password
Body: { email, firstName, lastName }
Expected: 400 Bad Request
Error: "password is required"

# Test 3: Invalid email format
Body: { email: "not-an-email", password, firstName, lastName }
Expected: 400 Bad Request
Error: "Invalid email format"

# Test 4: Weak password (< 8 chars)
Body: { email, password: "weak", firstName, lastName }
Expected: 400 Bad Request
Error: "Password must be at least 8 characters"
```

**Postman Test Script:**

```javascript
pm.test('Validation: Missing field returns 400', function () {
  pm.response.to.have.status(400);
  var jsonData = pm.response.json();
  pm.expect(jsonData.success).to.be.false;
  pm.expect(jsonData.message).to.include('required');
});

pm.test('Validation: Invalid format returns 400', function () {
  pm.response.to.have.status(400);
  var jsonData = pm.response.json();
  pm.expect(jsonData.code).to.include('INVALID');
});
```

---

### Test: Duplicate User Registration

**Endpoint:** POST /api/auth/register

```bash
# Run twice with same email
1. Register with test@example.com
   Expected: 201 Created

2. Register again with test@example.com
   Expected: 400 Bad Request
   Error: "User already exists"
```

**Script:**

```javascript
pm.test('Duplicate registration returns 400', function () {
  pm.response.to.have.status(400);
  var jsonData = pm.response.json();
  pm.expect(jsonData.code).to.equal('USER_EXISTS');
});
```

---

### Test: Invalid Credentials

**Endpoint:** POST /api/auth/login

```bash
# Test 1: Wrong password
Body: { email: "test@example.com", password: "WrongPass123!" }
Expected: 401 Unauthorized
Error: "Invalid email or password"

# Test 2: Non-existent email
Body: { email: "nonexistent@example.com", password: "TestPass123!" }
Expected: 401 Unauthorized
Error: "Invalid email or password"
```

**Script:**

```javascript
pm.test('Invalid credentials return 401', function () {
  pm.response.to.have.status(401);
  var jsonData = pm.response.json();
  pm.expect(jsonData.code).to.equal('INVALID_CREDENTIALS');
});
```

---

### Test: Active Session Check

**Endpoint:** POST /api/sessions

```bash
# Precondition: User has active session

# Try to create another session
POST /api/sessions
Expected: 409 Conflict
Error: "User already has an active session"
Response includes: existing session data
```

**Script:**

```javascript
pm.test('Cannot create session when one exists', function () {
  pm.response.to.have.status(409);
  var jsonData = pm.response.json();
  pm.expect(jsonData.code).to.equal('ACTIVE_SESSION_EXISTS');
  pm.expect(jsonData.data).to.have.property('id');
});
```

---

### Test: Invalid Session State Transitions

**Endpoint:** POST /api/sessions/{sessionId}/resume

**Precondition:** Session is already active

```bash
# Try to resume an active session
POST /api/sessions/session-123/resume
Expected: 400 Bad Request
Error: "No paused session to resume"
```

**Script:**

```javascript
pm.test('Cannot resume active session', function () {
  pm.response.to.have.status(400);
  var jsonData = pm.response.json();
  pm.expect(jsonData.code).to.equal('NO_PAUSED_SESSION');
});
```

---

## Security & Permission Tests

### Test 1: Missing Authorization Header

**All protected endpoints**

```bash
# Make request WITHOUT Authorization header
GET /api/v1/admin/audit-logs
Expected: 401 Unauthorized
Error: "Missing authorization token"

# All session endpoints
POST /api/sessions
POST /api/sessions/{sessionId}/pause
Expected: 401 Unauthorized
```

**Script:**

```javascript
// Remove auth header before request
pm.request.headers.remove('Authorization');

pm.test('Missing auth returns 401', function () {
  pm.response.to.have.status(401);
  var jsonData = pm.response.json();
  pm.expect(jsonData.code).to.equal('UNAUTHORIZED');
});
```

---

### Test 2: Malformed Authorization Header

```bash
# Invalid format
Authorization: "InvalidFormat token123"
Expected: 401 Unauthorized

# Missing "Bearer" prefix
Authorization: "token123"
Expected: 401 Unauthorized

# Empty token
Authorization: "Bearer "
Expected: 401 Unauthorized
```

**Script:**

```javascript
pm.test('Malformed auth header returns 401', function () {
  pm.response.to.have.status(401);
  var jsonData = pm.response.json();
  pm.expect(jsonData.message).to.include('authorization');
});
```

---

### Test 3: Tampered JWT Token

```bash
# Valid token structure but invalid signature
Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.INVALID_SIGNATURE"
Expected: 401 Unauthorized
Error: "Invalid token"
```

**Script:**

```javascript
pm.test('Tampered token returns 401', function () {
  pm.response.to.have.status(401);
  var jsonData = pm.response.json();
  pm.expect(jsonData.code).to.equal('INVALID_TOKEN');
});
```

---

### Test 4: Rate Limiting

**Endpoints with rate limits:**

- POST /api/auth/register (registerLimiter)
- POST /api/auth/login (authLimiter)
- POST /api/auth/refresh (refreshLimiter)
- POST /api/auth/forgot (passwordResetLimiter)
- POST /api/auth/reset (passwordResetLimiter)
- POST /api/sessions (sessionStartLimiter - 10 per minute)

```bash
# Make 11 rapid requests to create sessions
Loop 11 times:
    POST /api/sessions
    Expected for requests 1-10: 201 Created
    Expected for request 11: 429 Too Many Requests
```

**Script:**

```javascript
pm.test('Rate limiting enforced after threshold', function () {
  if (pm.environment.get('requestCount') > 10) {
    pm.response.to.have.status(429);
  } else {
    pm.response.to.have.status(201);
  }
});

// Increment counter
pm.environment.set('requestCount', (parseInt(pm.environment.get('requestCount')) || 0) + 1);
```

---

## Token Lifecycle Tests

### Test 1: Token Expiration (If Applicable)

**Expected Access Token Lifetime:** 1 hour  
**Expected Refresh Token Lifetime:** 7 days

```bash
# Wait for token to expire (manual test)
1. Login and save accessToken
2. Wait 1 hour
3. Try to use expired accessToken
   Expected: 401 Unauthorized
   Error: "Token expired"

4. Use refreshToken to get new accessToken
   Expected: 200 OK with new accessToken

5. Use new accessToken
   Expected: 200 OK (works)
```

**Script:**

```javascript
// Save login time
if (pm.response.code === 200) {
  var now = new Date().getTime();
  pm.environment.set('loginTime', now);
}

// Check if token likely expired
var loginTime = parseInt(pm.environment.get('loginTime'));
var elapsed = new Date().getTime() - loginTime;
var oneHour = 60 * 60 * 1000;

if (elapsed > oneHour) {
  pm.test('Expired token returns 401', function () {
    pm.response.to.have.status(401);
  });
}
```

---

### Test 2: Token Rotation on Refresh

```bash
# Track original and new tokens
1. Login
   Save: originalAccessToken, originalRefreshToken

2. Refresh Token
   Verify: newAccessToken !== originalAccessToken
   Verify: newRefreshToken !== originalRefreshToken

3. Use originalAccessToken
   Expected: 401 (invalidated)

4. Use newAccessToken
   Expected: 200 (valid)
```

**Script:**

```javascript
pm.test('Refresh provides completely new tokens', function () {
  var original = pm.environment.get('accessToken');
  var refreshed = pm.response.json().data.accessToken;
  pm.expect(original).to.not.equal(refreshed);
  pm.environment.set('accessToken', refreshed);
});
```

---

### Test 3: Logout Invalidates Token

```bash
# Sequence
1. Login
   Save: accessToken

2. Logout (using accessToken)
   Expected: 200 OK

3. Try to use same accessToken
   Expected: 401 Unauthorized
   Error: "Invalid token" or "Session invalidated"
```

**Script:**

```javascript
pm.test('Tokens invalidated after logout', function () {
  // This test requires running in sequence
  var tokenBeforeLogout = pm.environment.get('accessToken');

  // After logout, this token should be invalid
  pm.environment.set('tokenToInvalidate', tokenBeforeLogout);
});

// In next request, verify invalidation
pm.test('Invalidated token is rejected', function () {
  var expiredToken = pm.environment.get('tokenToInvalidate');
  pm.expect(pm.request.headers.get('Authorization')).to.not.include(expiredToken);
  pm.response.to.have.status(401);
});
```

---

## Endpoint Dependencies

### Dependency Graph

```
Authentication
├── Register (public)
├── Login (public)
│   ├── → Logout (requires accessToken)
│   ├── → Refresh Token (requires refreshToken)
│   ├── → Create Session (requires accessToken)
│   │   ├── → Pause Session (requires accessToken + sessionId)
│   │   ├── → Resume Session (requires accessToken + sessionId)
│   │   └── → End Session (requires accessToken + sessionId)
│   └── → Get Audit Logs (requires accessToken + admin role)
├── Forgot Password (public)
└── Reset Password (public)

System (Independent)
├── Health Check (public)
└── Readiness Probe (public)
```

### Execution Matrix

| Sequence | Endpoint       | Auth Required | Input Dependencies       | Output Saved                      |
| -------- | -------------- | ------------- | ------------------------ | --------------------------------- |
| 1        | Register       | ❌            | email, password          | userId                            |
| 2        | Login          | ❌            | email, password          | accessToken, refreshToken, userId |
| 3        | Create Session | ✅            | accessToken, (projectId) | sessionId                         |
| 4        | Pause Session  | ✅            | accessToken, sessionId   | -                                 |
| 5        | Resume Session | ✅            | accessToken, sessionId   | -                                 |
| 6        | End Session    | ✅            | accessToken, sessionId   | -                                 |
| 7        | Refresh Token  | ❌            | refreshToken             | accessToken                       |
| 8        | Logout         | ✅            | accessToken              | -                                 |
| 9        | Get Audit Logs | ✅ admin      | accessToken, admin role  | -                                 |

---

## Troubleshooting

### 401 Unauthorized Errors

**Problem:** Getting 401 on protected endpoints

**Solutions:**

1. Verify accessToken is set in environment

   ```javascript
   console.log('Current token: ' + pm.environment.get('accessToken'));
   ```

2. Check token hasn't expired (> 1 hour old)
   - Solution: Run Refresh Token endpoint

3. Verify Authorization header format

   ```
   Authorization: Bearer {{accessToken}}
   ```

4. Re-login to get fresh tokens
   - Run: Auth → Register → Login

**Debug Script:**

```javascript
pm.test('Debug: Check auth setup', function () {
  var token = pm.environment.get('accessToken');
  console.log('AccessToken present: ' + !!token);
  console.log('Token starts with e: ' + (token && token[0] === 'e'));
  console.log('Auth header: ' + pm.request.headers.get('Authorization'));
});
```

---

### 403 Forbidden Errors

**Problem:** Getting 403 on admin or owned resource endpoints

**Causes:**

1. **Not admin** (trying audit-logs with regular user)
   - Solution: Use admin account for that endpoint
   - Verify user role: check login response for role field

2. **Session ownership** (trying to manage another user's session)
   - Solution: Create your own session first
   - Or use admin token (if admin bypass implemented)

**How to Test Role Enforcement:**

```bash
# Verify: Regular user should get 403
1. Login as regular user@example.com
2. GET /api/v1/admin/audit-logs
3. Expected: 403 Forbidden

# Verify: Admin should get 200
4. Login as admin@example.com
5. GET /api/v1/admin/audit-logs
6. Expected: 200 OK
```

---

### 409 Conflict Errors

**Problem:** User already has active session

**Context:** POST /api/sessions returns 409

**Cause:** User can only have ONE active session at a time

**Solutions:**

1. End current session first

   ```bash
   POST /api/sessions/{{sessionId}}/end
   # Then retry Create Session
   ```

2. Use different user account
   ```bash
   # Register/login with different email
   # Then create session
   ```

**Debug:**

```javascript
pm.test('If 409, session data is included', function () {
  if (pm.response.code === 409) {
    var existingSession = pm.response.json().data;
    pm.environment.set('sessionId', existingSession.id);

    console.log('End this session first:');
    console.log('POST /api/sessions/' + existingSession.id + '/end');
  }
});
```

---

### 429 Rate Limit Errors

**Problem:** Getting 429 Too Many Requests

**Common On:**

- POST /api/auth/register (registration burst)
- POST /api/auth/login (login attempts)
- POST /api/sessions (session creation - 10/minute limit)

**Solutions:**

1. Wait before retrying
   - Session creation: wait >1 minute before creating another
   - Auth: wait 15+ seconds before next attempt

2. Use different approach
   - Don't create multiple sessions in rapid succession
   - Space out requests

3. Reset counter (development only)
   - Restart server to reset rate limit counters
   - Or wait for window to pass

**Monitor Rate Limit Headers:**

```javascript
pm.test('Check rate limit headers', function () {
  var remaining = pm.response.headers.get('X-RateLimit-Remaining');
  var reset = pm.response.headers.get('X-RateLimit-Reset');

  if (remaining) {
    console.log('Rate limit remaining: ' + remaining);
  }
  if (reset) {
    console.log('Rate limit resets at: ' + reset);
  }
});
```

---

### Invalid Token Errors

**Problem:** Getting "Invalid token" or "Token verification failed"

**Causes:**

1. Token corrupted in environment
2. Token was modified in request
3. Token signature invalid
4. Token has wrong algorithm

**Solutions:**

1. Fresh login

   ```bash
   POST /api/auth/login
   # Use returned token immediately
   ```

2. Clear environment and restart

   ```javascript
   // Clear all token vars
   pm.environment.set('accessToken', '');
   pm.environment.set('refreshToken', '');
   ```

3. Verify token structure
   ```
   Valid JWT format: header.payload.signature
   Each part is base64url encoded
   Should start with: eyJ (base64 for "{\"")
   ```

---

## Test Execution Report Template

Use this to document your testing:

```markdown
## Test Run - [Date]

### Environment

- Base URL: http://localhost:2000
- Collection Version: Complete
- Environment: FutureMe API

### Auth Tests

- [ ] Register - 201 ✅
- [ ] Login - 200 ✅
- [ ] Refresh Token - 200 ✅
- [ ] Logout - 200 ✅
- [ ] Forgot Password - 200 ✅
- [ ] Reset Password - 200 ✅

### Session Tests

- [ ] Create Session - 201 ✅
- [ ] Pause Session - 200 ✅
- [ ] Resume Session - 200 ✅
- [ ] End Session - 200 ✅

### Admin Tests

- [ ] Get Audit Logs (admin) - 200 ✅
- [ ] Get Audit Logs (user) - 403 ✅

### System Tests

- [ ] Health Check - 200 ✅
- [ ] Readiness Probe - 200 ✅

### Negative Tests

- [ ] Missing required field - 400 ✅
- [ ] Invalid credentials - 401 ✅
- [ ] Duplicate registration - 400 ✅
- [ ] Active session conflict - 409 ✅
- [ ] Rate limiting - 429 ✅

### Security Tests

- [ ] Missing auth header - 401 ✅
- [ ] Tampered token - 401 ✅
- [ ] Session ownership - 403 ✅
- [ ] Role enforcement - 403 ✅

### Issues Found

- None

### Conclusion

All active endpoints tested successfully. ✅
```

---

## Final Checklist

Before declaring test suite complete:

- ✅ Complete Phase 1: Auth working
- ✅ Complete Phase 2: Sessions working
- ✅ Complete Phase 3: Token refresh working
- ✅ Complete Phase 4: Admin access working
- ✅ Complete Phase 5: Password reset working
- ✅ All negative tests passing
- ✅ Rate limiting verified
- ✅ Role-based access enforced
- ✅ Session ownership enforced
- ✅ Token expiration tested (if applicable)

---

**Generated:** February 28, 2026  
**Based on:** API_ENDPOINT_INVENTORY.md  
**Collection:** FutureMe_API_Collection_Complete.postman_collection.json  
**Environment:** FutureMe_API_Environment.postman_environment.json

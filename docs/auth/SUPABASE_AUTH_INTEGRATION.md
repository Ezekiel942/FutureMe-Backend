# Supabase Authentication Integration Guide

**Last Updated:** April 2, 2026  
**Version:** 1.0  
**Status:** Production Ready

## Overview

FutureMe backend has been migrated to use Supabase Auth as the primary authentication provider. This guide documents the authentication flow, token management, and integration patterns.

## Supabase Auth Configuration

### Environment Variables

Required environment variables for Supabase Auth:

```env
SUPABASE_URL=https://ivossqicxlozmofzpnoy.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2b3NzcWljeGxvem1vZnpwbm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzOTAyOTgsImV4cCI6MjA4OTk2NjI5OH0.TR_E9y5Ma01Q5M7vr7fzZzWtwgEiTESqPfWmRt0FVg4
SESSION_EXPIRY=3900  # Token expiration in seconds
```

## Authentication Flow

### 1. User Registration

**Endpoint:** `POST /api/auth/register`

**Request:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Flow:**

1. Frontend calls registration endpoint
2. Backend calls Supabase Auth `signUp()` with email/password
3. Supabase creates user and returns session with access token
4. Backend stores user metadata in Supabase user_metadata
5. Backend returns access token and refresh token to frontend

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "session": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresAt": 1712180532
    }
  }
}
```

### 2. User Login

**Endpoint:** `POST /api/auth/login`

**Request:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Flow:**

1. Frontend calls login endpoint
2. Backend calls Supabase Auth `signInWithPassword(email, password)`
3. Supabase validates credentials and returns session with tokens
4. Backend returns access token and refresh token to frontend

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "session": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresAt": 1712180532
    }
  }
}
```

### 3. Token Refresh

**Endpoint:** `POST /api/auth/refresh`

**Request:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Flow:**

1. Frontend sends refresh token when access token expires
2. Backend calls Supabase Auth `refreshSession(refreshToken)`
3. Supabase validates refresh token and returns new session
4. Backend returns new access token

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": 1712180532
  }
}
```

### 4. User Logout

**Endpoint:** `POST /api/auth/logout`

**Headers:**

```
Authorization: Bearer <accessToken>
```

**Flow:**

1. Frontend sends logout request with access token
2. Backend calls Supabase Auth `signOut()`
3. Supabase invalidates session
4. Backend clears server-side session if any

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Protected Endpoint Access

### Authorization Header Format

All protected endpoints require the Supabase access token in the Authorization header:

```
Authorization: Bearer <accessToken>
```

### Example Request

```bash
curl -X GET http://localhost:2100/api/v1/users/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

### Token Validation Flow

1. Request arrives at backend with Authorization header
2. `extractAuthToken` middleware extracts JWT from header
3. Backend calls `AuthService.verifyToken(token)` to validate signature
4. Supabase JWT is decoded and payload extracted
5. `req.user` is populated with decoded payload (userId, email, etc.)
6. Request proceeds to controller

### Token Payload Structure

Supabase JWT contains:

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "email_verified": true,
  "iat": 1712176932,
  "exp": 1712180532,
  "aud": "authenticated",
  "role": "authenticated"
}
```

Available fields in `req.user`:

- `sub`: User ID (UUID)
- `email`: User email address
- `email_verified`: Boolean flag for email verification
- `iat`: Token issued at timestamp
- `exp`: Token expiration timestamp
- `aud`: Token audience
- `role`: User role (authenticated)

## Token Management

### Token Expiration

- **Access Token:** 3900 seconds (65 minutes)
- **Refresh Token:** 604800 seconds (7 days)

### Refresh Token Rotation

Supabase automatically rotates refresh tokens on use. Each call to `/api/auth/refresh` returns a new refresh token and access token.

### Token Storage (Frontend)

**Recommended approach:**

```javascript
// Store in memory (most secure)
let accessToken = null;
let refreshToken = null;

// Example from auth response
function handleAuthResponse(response) {
  accessToken = response.data.session.accessToken;
  refreshToken = response.data.session.refreshToken;
}

// Use in requests
async function fetchProtected(url) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401) {
    // Token expired, refresh it
    await refreshAccessToken();
    // Retry request
  }

  return response;
}

// Refresh when expired
async function refreshAccessToken() {
  const response = await fetch('http://localhost:2100/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  const data = await response.json();
  accessToken = data.data.accessToken;
  refreshToken = data.data.refreshToken; // New token from rotation
}
```

**Alternative: Secure Cookie Storage**

For web applications, store refresh token in secure, httpOnly cookie:

```javascript
// Backend sets httpOnly cookie on login/register
res.cookie('refreshToken', refreshToken, {
  httpOnly: true,
  secure: true, // HTTPS only
  sameSite: 'strict',
  maxAge: 604800000, // 7 days
});
```

## Error Handling

### Common Authentication Errors

| Error               | Status | Message                                 | Resolution                                     |
| ------------------- | ------ | --------------------------------------- | ---------------------------------------------- |
| Missing header      | 401    | Missing or invalid authorization header | Include Authorization header with Bearer token |
| Invalid token       | 401    | Invalid token                           | Token may be expired or tampered with          |
| Token expired       | 401    | Token expired                           | Use refresh token to get new access token      |
| User not found      | 404    | User not found                          | User may have been deleted                     |
| Invalid credentials | 401    | Invalid email or password               | Verify email and password                      |
| User exists         | 400    | User already exists                     | Use different email or login instead           |
| Weak password       | 400    | Password must be at least 8 characters  | Ensure password meets requirements             |

### Error Response Format

```json
{
  "success": false,
  "message": "Token expired",
  "code": "AUTHENTICATION_ERROR"
}
```

## Tenant Isolation

Supabase Auth integrates with FutureMe's tenant isolation strategy:

1. Each user belongs to one organization (tenant)
2. `organizationId` is stored in user metadata
3. All protected endpoints receive `organizationId` from `req.user.organizationId`
4. `enforceTenantIsolation` middleware validates tenant ownership before allowing access

### Setting TenantOrganization

After user registration, associate with organization:

```javascript
// Backend sets organizationId in user metadata during first login
const { data, error } = await supabase.auth.updateUser({
  data: {
    organization_id: 'org-uuid',
  },
});
```

## Integration Checklist

- [x] Supabase Auth SDK configured
- [x] User registration flow implemented
- [x] User login flow implemented
- [x] Token refresh flow implemented
- [x] User logout flow implemented
- [x] Token validation middleware secured
- [x] Protected endpoints secured
- [x] Error handling implemented
- [x] Monitoring and logging added
- [x] Frontend integration guide created

## Testing

### Manual Testing - Postman

Import the `FutureMe_API.postman_collection.json` and use the Supabase auth flow:

1. **Set Environment Variables**
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_ANON_KEY`: Your Supabase anon key
   - `BASE_URL`: Backend base URL (http://localhost:2100)

2. **Register User**
   - POST `/api/auth/register`
   - Postman will extract and save tokens automatically

3. **Call Protected Endpoints**
   - All protected endpoints will use saved access token from environment

4. **Test Token Refresh**
   - Wait for token to expire or manually refresh with `/api/auth/refresh`

### Automated Testing

```bash
# Run auth tests
pnpm test --testPathPattern=auth

# Run integration tests
pnpm test:integration

# Run all tests with coverage
pnpm test:coverage
```

## Production Deployment

### Security Considerations

1. **HTTPS Only**
   - All auth endpoints must use HTTPS
   - Set `secure: true` on cookies

2. **CORS Configuration**
   - Whitelist only frontend domains
   - Set in `.env.production`

3. **Token Expiration**
   - Access tokens expire after 65 minutes
   - Frontend must implement refresh logic
   - Refresh tokens expire after 7 days

4. **Secrets Management**
   - Store `SUPABASE_URL` and `SUPABASE_ANON_KEY` in secure environment
   - Never commit to version control
   - Use environment variable management tool (e.g., HashiCorp Vault)

### Deployment Checklist

- [ ] HTTPS enabled
- [ ] CORS origins configured
- [ ] Environment variables set securely
- [ ] Rate limiting verified
- [ ] Monitoring enabled
- [ ] Error logging configured
- [ ] Token expiration tested
- [ ] Refresh token rotation validated

## Support & Troubleshooting

### Common Issues

**Q: Token validation fails with "Invalid token"**

- A: Verify token format includes "Bearer " prefix
- A: Check token expiration with `jwt.decode()`
- A: Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` match Supabase project

**Q: 429 Too Many Requests on registration**

- A: Rate limit exceeded (3 attempts per minute)
- A: Wait 1 minute and retry
- A: Check rate limit config in `rateLimit.middleware.ts`

**Q: 401 Unauthorized on protected endpoints**

- A: Token may be expired, refresh first
- A: Authorization header must be present
- A: Verify token not tampered with

**Q: User created but not found in subsequent requests**

- A: Verify `organizationId` is set in user metadata
- A: Check tenant isolation enforcement

## References

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [JWT.io - JWT Decoder](https://jwt.io)
- [Auth Implementation](../apps/backend/src/modules/auth)
- [Auth Middleware](../apps/backend/src/api/middlewares/auth.middleware.ts)

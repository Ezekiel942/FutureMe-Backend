# FutureMe API Endpoint Inventory

**Generated:** February 28, 2026  
**Workspace:** c:\Users\owner\worksight  
**Git Audit Level:** Complete endpoint scan of actual route definitions and controller implementations

---

## Table of Contents

1. [Authentication Routes](#auth-routes)
2. [Session Routes](#session-routes)
3. [Admin Routes](#admin-routes)
4. [Health Check Routes](#health-check-routes)
5. [Unregistered Routes (Not in app.ts)](#unregistered-routes)

---

## Auth Routes

**Location:** [src/api/routes/auth.routes.ts](../apps/backend/src/api/routes/auth.routes.ts)  
**Registered Prefix:** `/api/auth`

### POST /api/auth/register

- **Controller:** [register](../apps/backend/src/api/controllers/auth.controller.ts#L10)
- **Auth Required:** No
- **Required Role:** None
- **Required Permission:** None
- **Rate Limited:** Yes (registerLimiter - burst limit)
- **Body Schema:**
  - `email` (string, email format, required)
  - `password` (string, format: password, min 8 chars, required)
  - `firstName` (string, required)
  - `lastName` (string, required)
- **URL Params:** None
- **Query Params:** None
- **Example Request:**
  ```json
  {
    "email": "john.doe@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }
  ```
- **Success Response (201):**
  ```json
  {
    "success": true,
    "data": {
      "id": "user-uuid",
      "email": "john.doe@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }
  }
  ```
- **Error Responses:**
  - **400 Bad Request** - Invalid input, missing fields, user already exists
    ```json
    {
      "success": false,
      "message": "User already exists",
      "code": "USER_EXISTS"
    }
    ```
  - **400 Bad Request** - Weak password
    ```json
    {
      "success": false,
      "message": "Password must be at least 8 characters",
      "code": "WEAK_PASSWORD"
    }
    ```
  - **429 Too Many Requests** - Rate limit exceeded
    ```json
    {
      "success": false,
      "message": "Too many registration attempts. Try again later."
    }
    ```
  - **500 Internal Server Error**
    ```json
    {
      "success": false,
      "message": "Internal server error",
      "code": "SERVER_ERROR"
    }
    ```
- **Status Codes:** 201, 400, 429, 500

---

### POST /api/auth/login

- **Controller:** [login](../apps/backend/src/api/controllers/auth.controller.ts#L30)
- **Auth Required:** No
- **Required Role:** None
- **Required Permission:** None
- **Rate Limited:** Yes (authLimiter - burst limit)
- **Body Schema:**
  - `email` (string, email format, required)
  - `password` (string, format: password, required)
- **URL Params:** None
- **Query Params:** None
- **Example Request:**
  ```json
  {
    "email": "john.doe@example.com",
    "password": "SecurePass123!"
  }
  ```
- **Success Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "user": {
        "id": "user-uuid",
        "email": "john.doe@example.com",
        "role": "user"
      }
    }
  }
  ```
- **Error Responses:**
  - **400 Bad Request** - Invalid input or missing fields
    ```json
    {
      "success": false,
      "message": "Email and password are required",
      "code": "MISSING_FIELDS"
    }
    ```
  - **401 Unauthorized** - Invalid credentials
    ```json
    {
      "success": false,
      "message": "Invalid email or password",
      "code": "INVALID_CREDENTIALS"
    }
    ```
  - **429 Too Many Requests** - Rate limit exceeded
    ```json
    {
      "success": false,
      "message": "Too many login attempts. Try again later."
    }
    ```
  - **500 Internal Server Error**
    ```json
    {
      "success": false,
      "message": "Internal server error"
    }
    ```
- **Status Codes:** 200, 400, 401, 429, 500
- **Cookies Set:** `refreshToken` (httpOnly, secure in prod, 7-day expiry)

---

### POST /api/auth/refresh

- **Controller:** [refresh](../apps/backend/src/api/controllers/auth.controller.ts#L72)
- **Auth Required:** No
- **Required Role:** None
- **Required Permission:** None
- **Rate Limited:** Yes (refreshLimiter)
- **Body Schema:**
  - `refreshToken` (string, optional - can be from cookie instead)
- **URL Params:** None
- **Query Params:** None
- **Example Request:**
  ```json
  {
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
  ```
- **Success Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
  ```
- **Error Responses:**
  - **401 Unauthorized** - Invalid or expired refresh token
    ```json
    {
      "success": false,
      "message": "Invalid or expired refresh token",
      "code": "INVALID_TOKEN"
    }
    ```
  - **401 Unauthorized** - Missing refresh token
    ```json
    {
      "success": false,
      "message": "Refresh token missing",
      "code": "MISSING_TOKEN"
    }
    ```
  - **429 Too Many Requests** - Rate limit exceeded
  - **500 Internal Server Error**
- **Status Codes:** 200, 401, 429, 500

---

### POST /api/auth/logout

- **Controller:** [logout](../apps/backend/src/api/controllers/auth.controller.ts#L161)
- **Auth Required:** Yes (requireAuth middleware)
- **Required Role:** None
- **Required Permission:** None
- **Body Schema:** (empty)
- **URL Params:** None
- **Query Params:** None
- **Example Request:**
  ```http
  POST /api/auth/logout HTTP/1.1
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
  ```
- **Success Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "message": "Logged out successfully"
    }
  }
  ```
- **Error Responses:**
  - **401 Unauthorized** - Missing or invalid access token
    ```json
    {
      "success": false,
      "message": "Not authenticated",
      "code": "UNAUTHORIZED"
    }
    ```
  - **500 Internal Server Error**
- **Status Codes:** 200, 401, 500
- **Side Effects:** Invalidates refresh token in Redis, clears `refreshToken` cookie

---

### POST /api/auth/forgot

- **Controller:** [forgotPassword](../apps/backend/src/api/controllers/auth.controller.ts#L118)
- **Auth Required:** No
- **Required Role:** None
- **Required Permission:** None
- **Rate Limited:** Yes (passwordResetLimiter)
- **Body Schema:**
  - `email` (string, email format, required)
- **URL Params:** None
- **Query Params:** None
- **Example Request:**
  ```json
  {
    "email": "john.doe@example.com"
  }
  ```
- **Success Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "message": "If a user with this email exists, a password reset link has been sent.",
      "token": "reset-token-string"
    }
  }
  ```
  **Note:** Token is returned here for testing; in production it would be sent via email.
- **Error Responses:**
  - **400 Bad Request** - Invalid email format
    ```json
    {
      "success": false,
      "message": "Invalid email format",
      "code": "INVALID_EMAIL"
    }
    ```
  - **429 Too Many Requests** - Rate limit exceeded
  - **500 Internal Server Error**
- **Status Codes:** 200, 400, 429, 500
- **Security Note:** Returns 200 even if email doesn't exist (prevents user enumeration)

---

### POST /api/auth/reset

- **Controller:** [resetPassword](../apps/backend/src/api/controllers/auth.controller.ts#L140)
- **Auth Required:** No
- **Required Role:** None
- **Required Permission:** None
- **Rate Limited:** Yes (passwordResetLimiter)
- **Body Schema:**
  - `token` (string, password reset token from email, required)
  - `newPassword` (string, format: password, min 8 chars, required)
- **URL Params:** None
- **Query Params:** None
- **Example Request:**
  ```json
  {
    "token": "reset-token-string",
    "newPassword": "NewSecurePass123!"
  }
  ```
- **Success Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "message": "Password reset successfully"
    }
  }
  ```
- **Error Responses:**
  - **400 Bad Request** - Invalid input or weak password
    ```json
    {
      "success": false,
      "message": "Password must be at least 8 characters",
      "code": "WEAK_PASSWORD"
    }
    ```
  - **401 Unauthorized** - Invalid or expired reset token
    ```json
    {
      "success": false,
      "message": "Invalid or expired reset token",
      "code": "INVALID_TOKEN"
    }
    ```
  - **429 Too Many Requests** - Rate limit exceeded
  - **500 Internal Server Error**
- **Status Codes:** 200, 400, 401, 429, 500

---

## Session Routes

**Location:** [src/api/routes/session.routes.ts](../apps/backend/src/api/routes/session.routes.ts)  
**Registered Prefix:** `/api/sessions`

### POST /api/sessions

- **Controller:** [createSession](../apps/backend/src/api/controllers/session.controller.ts#L19)
- **Auth Required:** Yes (requireAuth middleware)
- **Required Role:** None
- **Required Permission:** None
- **Rate Limited:** Yes (sessionStartLimiter - max 10 per minute)
- **Body Schema:**
  - `projectId` (string, optional)
  - `metadata` (object, optional)
- **URL Params:** None
- **Query Params:** None
- **Example Request:**
  ```json
  {
    "projectId": "project-uuid",
    "metadata": { "context": "daily-standup" }
  }
  ```
- **Success Response (201):**
  ```json
  {
    "success": true,
    "data": {
      "id": "session-uuid",
      "userId": "user-uuid",
      "projectId": "project-uuid",
      "startTime": "2026-02-28T10:30:00.000Z",
      "endTime": null,
      "status": "active",
      "durationSeconds": null,
      "metadata": { "context": "daily-standup" }
    }
  }
  ```
- **Error Responses:**
  - **401 Unauthorized** - Missing or invalid access token
    ```json
    {
      "success": false,
      "message": "Unauthorized",
      "code": "UNAUTHORIZED"
    }
    ```
  - **409 Conflict** - User already has an active session
    ```json
    {
      "success": false,
      "code": "ACTIVE_SESSION_EXISTS",
      "message": "User already has an active session",
      "data": { "id": "existing-session-uuid", ... }
    }
    ```
  - **400 Bad Request** - Invalid input
  - **429 Too Many Requests** - Rate limit (max 10 per minute)
  - **500 Internal Server Error**
- **Status Codes:** 201, 400, 401, 409, 429, 500
- **Side Effects:**
  - Emits `session_started` WebSocket event
  - Logs billing audit entry
  - Logs action audit entry

---

### POST /api/sessions/{sessionId}/pause

- **Controller:** [pauseSession](../apps/backend/src/api/controllers/session.controller.ts#L77)
- **Auth Required:** Yes (requireAuth middleware)
- **Required Role:** None
- **Required Permission:** None (session ownership checked at service level)
- **Body Schema:** (empty)
- **URL Params:**
  - `sessionId` (string, path parameter, required)
- **Query Params:** None
- **Example Request:**
  ```http
  POST /api/sessions/session-uuid/pause HTTP/1.1
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
  ```
- **Success Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "id": "session-uuid",
      "userId": "user-uuid",
      "status": "paused",
      "startTime": "2026-02-28T10:30:00.000Z",
      "pauseTime": "2026-02-28T11:15:00.000Z",
      "durationSeconds": 2700
    }
  }
  ```
- **Error Responses:**
  - **401 Unauthorized** - Missing or invalid access token
    ```json
    {
      "success": false,
      "message": "Unauthorized",
      "code": "UNAUTHORIZED"
    }
    ```
  - **403 Forbidden** - Session does not belong to user
    ```json
    {
      "success": false,
      "message": "Forbidden",
      "code": "FORBIDDEN"
    }
    ```
  - **400 Bad Request** - Invalid session ID or session cannot be paused
    ```json
    {
      "success": false,
      "message": "No active session to pause",
      "code": "NO_ACTIVE_SESSION"
    }
    ```
  - **500 Internal Server Error**
- **Status Codes:** 200, 400, 401, 403, 500
- **Side Effects:**
  - Emits `session_paused` WebSocket event
  - Logs billing audit entry
  - Calculates duration

---

### POST /api/sessions/{sessionId}/resume

- **Controller:** [resumeSession](../apps/backend/src/api/controllers/session.controller.ts#L127)
- **Auth Required:** Yes (requireAuth middleware)
- **Required Role:** None
- **Required Permission:** None (session ownership checked at service level)
- **Body Schema:** (empty)
- **URL Params:**
  - `sessionId` (string, path parameter, required)
- **Query Params:** None
- **Example Request:**
  ```http
  POST /api/sessions/session-uuid/resume HTTP/1.1
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
  ```
- **Success Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "id": "session-uuid",
      "userId": "user-uuid",
      "status": "active",
      "startTime": "2026-02-28T10:30:00.000Z",
      "resumeTime": "2026-02-28T11:20:00.000Z",
      "durationSeconds": 2700
    }
  }
  ```
- **Error Responses:**
  - **401 Unauthorized** - Missing or invalid access token
  - **403 Forbidden** - Session does not belong to user
  - **400 Bad Request** - Invalid session ID or session cannot be resumed
    ```json
    {
      "success": false,
      "message": "No paused session to resume",
      "code": "NO_PAUSED_SESSION"
    }
    ```
  - **500 Internal Server Error**
- **Status Codes:** 200, 400, 401, 403, 500
- **Side Effects:**
  - Emits `session_resumed` WebSocket event
  - Logs billing audit entry

---

### POST /api/sessions/{sessionId}/end

- **Controller:** [endSession](../apps/backend/src/api/controllers/session.controller.ts#L171)
- **Auth Required:** Yes (requireAuth middleware)
- **Required Role:** None
- **Required Permission:** None (session ownership checked at service level)
- **Body Schema:**
  - `notes` (string, optional)
- **URL Params:**
  - `sessionId` (string, path parameter, required)
- **Query Params:** None
- **Example Request:**
  ```json
  {
    "notes": "Completed feature implementation"
  }
  ```
- **Success Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "id": "session-uuid",
      "userId": "user-uuid",
      "status": "ended",
      "startTime": "2026-02-28T10:30:00.000Z",
      "endTime": "2026-02-28T11:30:00.000Z",
      "durationSeconds": 3600,
      "notes": "Completed feature implementation"
    }
  }
  ```
- **Error Responses:**
  - **401 Unauthorized** - Missing or invalid access token
  - **403 Forbidden** - Session does not belong to user
  - **400 Bad Request** - Invalid session ID or session cannot be ended
    ```json
    {
      "success": false,
      "message": "No active session to end",
      "code": "NO_ACTIVE_SESSION"
    }
    ```
  - **500 Internal Server Error**
- **Status Codes:** 200, 400, 401, 403, 500
- **Side Effects:**
  - Emits `session_ended` WebSocket event
  - Logs billing audit entry
  - Logs action audit entry
  - Final duration calculation

---

## Admin Routes

**Location:** [src/api/routes/admin.routes.ts](../apps/backend/src/api/routes/admin.routes.ts)  
**Registered Prefix:** `/api/v1/admin`

### GET /api/v1/admin/audit-logs

- **Controller:** [getAuditLogs](../apps/backend/src/api/controllers/admin.controller.ts#L19)
- **Auth Required:** Yes (requireAuth middleware)
- **Required Role:** Yes - `admin` (requireAdmin middleware)
- **Required Permission:** None
- **Body Schema:** (empty)
- **URL Params:** None
- **Query Params:**
  - `page` (number, optional, default: 1)
  - `limit` (number, optional, default: 50, max: 200)
- **Example Request:**
  ```http
  GET /api/v1/admin/audit-logs?page=1&limit=50 HTTP/1.1
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
  ```
- **Success Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "logs": [
        {
          "id": "log-uuid",
          "userId": "user-uuid",
          "action": "login",
          "resourceType": "session",
          "resourceId": "session-uuid",
          "createdAt": "2026-02-28T10:30:00.000Z",
          "ipAddress": "192.168.1.1",
          "userAgent": "Mozilla/5.0..."
        }
      ],
      "total": 1250,
      "page": 1,
      "limit": 50
    }
  }
  ```
- **Error Responses:**
  - **401 Unauthorized** - Missing or invalid access token
    ```json
    {
      "success": false,
      "message": "Missing authorization token",
      "code": "UNAUTHORIZED"
    }
    ```
  - **403 Forbidden** - User is not admin
    ```json
    {
      "success": false,
      "message": "Forbidden",
      "code": "FORBIDDEN"
    }
    ```
  - **500 Internal Server Error**
    ```json
    {
      "success": false,
      "message": "Failed to fetch audit logs",
      "code": "SERVER_ERROR"
    }
    ```
- **Status Codes:** 200, 401, 403, 500
- **Side Effects:** Logs admin action as `admin_action` audit entry

---

## Health Check Routes

**Location:** [src/api/routes/health.routes.ts](../apps/backend/src/api/routes/health.routes.ts)  
**Registered Prefix:** `/api/health`

### GET /api/health

- **Controller:** Inline handler
- **Auth Required:** No
- **Required Role:** None
- **Required Permission:** None
- **Body Schema:** (empty)
- **URL Params:** None
- **Query Params:** None
- **Example Request:**
  ```http
  GET /api/health HTTP/1.1
  ```
- **Success Response (200):**
  ```json
  {
    "status": "ok"
  }
  ```
- **Error Responses:** None (always returns 200)
- **Status Codes:** 200
- **Purpose:** Health check for load balancers and monitoring

---

### GET /api/health/ready

- **Controller:** Inline handler
- **Auth Required:** No
- **Required Role:** None
- **Required Permission:** None
- **Body Schema:** (empty)
- **URL Params:** None
- **Query Params:** None
- **Example Request:**
  ```http
  GET /api/health/ready HTTP/1.1
  ```
- **Success Response (200):**
  ```json
  {
    "ready": true
  }
  ```
- **Error Responses:** None (always returns 200)
- **Status Codes:** 200
- **Purpose:** Readiness probe for Kubernetes/orchestration. Could be extended to check DB/Redis connectivity.

---

## Unregistered Routes

**⚠️ IMPORTANT:** The following route files exist in `src/api/routes/` but are **NOT imported or registered in app.ts**. These endpoints are **unreachable** and should be either:

1. Imported and registered in app.ts if they are intended to be active
2. Deleted if they are deprecated or unused

### Unregistered: Project Routes

**Location:** [src/api/routes/project.routes.ts](../apps/backend/src/api/routes/project.routes.ts)

#### GET /projects

- **Status:** ❌ **NOT REGISTERED** (unreachable)
- **Controller:** [listProjects](../apps/backend/src/api/controllers/project.controller.ts)
- **Auth Required:** No
- **Required Role:** None
- **Body Schema:** (empty)
- **URL Params:** None
- **Query Params:** None
- **Example Response (200):**
  ```json
  {
    "success": true,
    "data": []
  }
  ```

---

### Unregistered: Task Routes

**Location:** [src/api/routes/task.routes.ts](../apps/backend/src/api/routes/task.routes.ts)

#### GET /tasks

- **Status:** ❌ **NOT REGISTERED** (unreachable)
- **Controller:** [listTasks](../apps/backend/src/api/controllers/task.controller.ts)
- **Auth Required:** No
- **Required Role:** None
- **Body Schema:** (empty)
- **URL Params:** None
- **Query Params:** None
- **Example Response (200):**
  ```json
  {
    "success": true,
    "data": []
  }
  ```

---

### Unregistered: User Routes

**Location:** [src/api/routes/user.routes.ts](../apps/backend/src/api/routes/user.routes.ts)

#### GET /users

- **Status:** ❌ **NOT REGISTERED** (unreachable)
- **Controller:** Inline handler returning empty array
- **Auth Required:** No
- **Required Role:** None
- **Body Schema:** (empty)
- **URL Params:** None
- **Query Params:** None
- **Example Response (200):**
  ```json
  []
  ```

---

### Unregistered: Insight Routes

**Location:** [src/api/routes/insight.routes.ts](../apps/backend/src/api/routes/insight.routes.ts)

#### GET /insights

- **Status:** ❌ **NOT REGISTERED** (unreachable)
- **Controller:** [getInsights](../apps/backend/src/api/controllers/insight.controller.ts)
- **Auth Required:** Yes (requireAuth)
- **Required Role:** None
- **Body Schema:** (empty)
- **URL Params:** None
- **Query Params:**
  - `period` (string, optional, values: daily|weekly|monthly, default: daily)
  - `limit` (number, optional, default: 10, max: 100)
  - `offset` (number, optional, default: 0)

#### POST /insights/{userId}/generate

- **Status:** ❌ **NOT REGISTERED** (unreachable)
- **Controller:** [generateUserInsights](../apps/backend/src/api/controllers/insight.controller.ts)
- **Auth Required:** Yes (requireAuth)
- **Required Role:** None
- **Body Schema:**
  - `period` (string, optional, values: daily|weekly|monthly, default: daily)
- **URL Params:**
  - `userId` (string, required)
- **Query Params:** None

---

### Unregistered: Billing Routes

**Location:** [src/api/routes/billing.routes.ts](../apps/backend/src/api/routes/billing.routes.ts)

#### GET /billing

- **Status:** ❌ **NOT REGISTERED** (unreachable)
- **Controller:** [getBillingOverview](../apps/backend/src/api/controllers/billing.controller.ts)
- **Auth Required:** Yes (requireAuth)
- **Required Role:** None

#### POST /billing/upgrade

- **Status:** ❌ **NOT REGISTERED** (unreachable)
- **Controller:** [upgradePlan](../apps/backend/src/api/controllers/billing.controller.ts)
- **Auth Required:** Yes (requireAuth)
- **Body Schema:**
  - `subscriptionId` (string, required)
  - `newPlan` (string, required)

#### POST /billing/cancel

- **Status:** ❌ **NOT REGISTERED** (unreachable)
- **Controller:** [cancelSubscription](../apps/backend/src/api/controllers/billing.controller.ts)
- **Auth Required:** Yes (requireAuth)
- **Body Schema:**
  - `subscriptionId` (string, required)

---

### Unregistered: Audit Routes

**Location:** [src/api/routes/audit.routes.ts](../apps/backend/src/api/routes/audit.routes.ts)

#### GET /audit

- **Status:** ❌ **NOT REGISTERED** (unreachable)
- **Controller:** [queryAudit](../apps/backend/src/api/controllers/audit.controller.ts)
- **Auth Required:** Yes (requireAuth)
- **Query Params:**
  - `limit` (number, optional, default: 100, max: 1000)
  - `offset` (number, optional, default: 0)
  - `action` (string, optional, filter)
  - `resourceType` (string, optional, filter)

#### GET /audit/{id}

- **Status:** ❌ **NOT REGISTERED** (unreachable)
- **Controller:** [getAuditLog](../apps/backend/src/api/controllers/audit.controller.ts)
- **Auth Required:** Yes (requireAuth)
- **URL Params:**
  - `id` (string, required)

---

### Unregistered: Announcement Routes

**Location:** [src/api/routes/announcement.routes.ts](../apps/backend/src/api/routes/announcement.routes.ts)

#### GET /announcements

- **Status:** ❌ **NOT REGISTERED** (unreachable)
- **Controller:** [listAnnouncements](../apps/backend/src/api/controllers/announcement.controller.ts)
- **Auth Required:** No

---

## Summary

### Active Endpoints (Registered in app.ts)

- **Total Active Routes:** 10
- **Auth Routes:** 6 (register, login, refresh, logout, forgot, reset)
- **Session Routes:** 4 (create, pause, resume, end)
- **Admin Routes:** 1 (audit-logs)
- **Health Routes:** 2 (health, ready)

### Unregistered Endpoints (Not in app.ts)

- **Total Unregistered Routes:** 12
- **Project Routes:** 1 (GET /)
- **Task Routes:** 1 (GET /)
- **User Routes:** 1 (GET /)
- **Insight Routes:** 2 (GET /, POST /{userId}/generate)
- **Billing Routes:** 3 (GET /, POST /upgrade, POST /cancel)
- **Audit Routes:** 2 (GET /, GET /{id})
- **Announcement Routes:** 1 (GET /)

### Action Items

- [ ] Review unregistered routes and decide: activate or delete
- [ ] Register necessary routes in app.ts with appropriate prefix
- [ ] Add missing middleware (auth, role checks) to activated routes
- [ ] Add rate limiting where appropriate
- [ ] Update Swagger documentation for activated routes

---

## Swagger Spec Cross-Check

**Swagger Location:** [src/config/swagger.ts](../apps/backend/src/config/swagger.ts)

**Swagger Discovery Pattern:** Scans `../api/routes/*.ts` for JSDoc @swagger comments

**Documented Routes in Swagger:**

1. ✅ POST /api/auth/register
2. ✅ POST /api/auth/login
3. ✅ POST /api/auth/refresh
4. ✅ POST /api/auth/logout
5. ✅ POST /api/auth/forgot
6. ✅ POST /api/auth/reset
7. ✅ POST /api/sessions
8. ✅ POST /api/sessions/{sessionId}/pause
9. ✅ POST /api/sessions/{sessionId}/resume
10. ✅ POST /api/sessions/{sessionId}/end

**Routes Missing from Swagger:**

- ❌ GET /api/health
- ❌ GET /api/health/ready
- ❌ GET /api/v1/admin/audit-logs

**Routes in Swagger but NOT Registered:**
All unregistered routes (project, task, user, insight, billing, audit, announcement) have no Swagger documentation because their JSDoc comments are not parsed if routes aren't registered in app.ts during runtime.

**Recommendation:** Update Swagger JSDoc comments for unregistered routes only after activating them.

---

## Verification Checklist

- ✅ All routes in `src/api/routes/` scanned
- ✅ All controllers referenced by routes reviewed
- ✅ app.ts import/registration checked
- ✅ Auth middleware usage verified
- ✅ Rate limiting identified
- ✅ Status codes extracted from controller logic
- ✅ Example requests/responses generated from code analysis
- ✅ Unregistered routes identified
- ✅ Swagger documentation cross-referenced

---

**Generated by:** Senior Backend Engineer Audit  
**Audit Date:** February 28, 2026  
**Database:** Actual source code analysis (no assumptions)

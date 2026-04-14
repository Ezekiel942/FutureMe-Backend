# Postman Testing Guide - Step by Step

A complete visual guide to testing every endpoint in FutureMe API using Postman.

## Table of Contents

1. [Initial Setup](#initial-setup)
2. [Testing Workflow](#testing-workflow)
3. [Visual Walkthrough](#visual-walkthrough)
4. [Error Handling](#error-handling)

---

## Initial Setup

### Step 1: Import Collection

**Screenshots/Steps:**

1. Open Postman
2. Look for **"Import"** button in the top-left corner
3. Click it and choose **"Upload Files"**
4. Select file: `FutureMe_API_Postman_Collection.json`
5. Click **"Import"** button

**Expected Result:**

- Collection appears in left sidebar titled "FutureMe API - Complete Testing Suite"
- 4 folder groups visible:
  - 🔐 Authentication (4 requests)
  - 📊 Sessions Management (4 requests)
  - 🏥 Health & Status (1 request)

### Step 2: Set Up Environment Variables

**This is AUTOMATIC** - the collection auto-saves tokens from responses.

But you can verify by:

1. Top-right corner: Click **"Environment Quick Look"** icon (eye icon)
2. Verify variables section shows:
   - `baseUrl`: http://localhost:2400
   - `accessToken`: (empty until login)
   - `refreshToken`: (empty until login)
   - `userId`: (empty until register/login)
   - `sessionId`: (empty until session created)

### Step 3: Start Backend

Before testing, ensure backend is running:

```bash
cd apps/backend
pnpm dev
```

**You should see:**

```
[TIMESTAMP] INFO: WebSocket server initialized
[TIMESTAMP] INFO: Backend running on port 2400
```

**Test connection:**

```bash
curl http://localhost:2400/api/health
# Response: { "status": "ok" }
```

---

## Testing Workflow

### Complete End-to-End Test (15 minutes)

Follow this exact sequence for a complete test:

#### **Phase 1: Health Check (1 minute)**

1. **Request:** `GET /api/health`
2. **Location in Postman:**
   - Left sidebar → 🏥 Health & Status → Health Check
3. **Click:** Blue **"Send"** button (top-center)
4. **Expected Response (200 OK):**
   ```json
   {
     "status": "ok"
   }
   ```
5. **Status Indicator:** Green "200" badge appears

#### **Phase 2: Register User (2 minutes)**

1. **Request:** `POST /api/auth/register`
2. **Location in Postman:**
   - Left sidebar → 🔐 Authentication → 1. Register New User
3. **Body Tab:** Review pre-filled request body
   ```json
   {
     "firstName": "John",
     "lastName": "Doe",
     "email": "john.doe@example.com",
     "password": "TestPass123",
     "confirmPassword": "TestPass123"
   }
   ```

   - **Change email** for each test (e.g., "john.doe.1@example.com")
4. **Click:** Blue **"Send"** button
5. **Expected Response (200 OK):**
   ```json
   {
     "success": true,
     "data": {
       "id": "550e8400-e29b-41d4-a716-446655440000", // UUID
       "email": "john.doe@example.com",
       "firstName": "John",
       "lastName": "Doe"
     }
   }
   ```
6. **Auto-saved Variables:**
   - `userId` = user ID from response
   - `userEmail` = email from response

**Verification Checklist:**

-  Response status is 200
-  Response contains user `id`
-  Email matches what was sent
-  No stack trace in response

#### **Phase 3: Login (2 minutes)**

1. **Request:** `POST /api/auth/login`
2. **Location in Postman:**
   - Left sidebar → 🔐 Authentication → 2. Login User
3. **Body Tab:** Verify email/password match registration
   ```json
   {
     "email": "john.doe@example.com",
     "password": "TestPass123"
   }
   ```
4. **Click:** Blue **"Send"** button
5. **Expected Response (200 OK):**
   ```json
   {
     "success": true,
     "data": {
       "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
       "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
       "user": {
         "id": "550e8400-e29b-41d4-a716-446655440000",
         "email": "john.doe@example.com",
         "role": "user"
       }
     }
   }
   ```
6. **Auto-saved Variables:**
   - `accessToken` = JWT token (15 min expiry)
   - `refreshToken` = JWT token (7 days expiry)
   - `userId` = user ID

**Verification Checklist:**

-  Response status is 200
-  Response contains both tokens
-  `accessToken` starts with "eyJ"
-  User role shows as "user"
-  No stack trace in response

#### **Phase 4: Health Check (Verify Still Works)**

1. **Request:** `GET /api/health` (same as Phase 1)
2. **No auth required** - this should always work
3. **Expected:** `{ "status": "ok" }`

#### **Phase 5: Create Session (2 minutes)**

1. **Request:** `POST /api/sessions`
2. **Location in Postman:**
   - Left sidebar → 📊 Sessions Management → 1. Create New Session
3. **Auth Tab:** Should auto-include Bearer token
   - **Verify:** Headers tab shows:
     ```
     Authorization: Bearer {{accessToken}}
     ```
   - Postman automatically replaced `{{accessToken}}` with actual token
4. **Body Tab:** Review body
   ```json
   {
     "projectId": null
   }
   ```
5. **Click:** Blue **"Send"** button
6. **Expected Response (200 OK):**
   ```json
   {
     "success": true,
     "data": {
       "id": "sess-550e8400-e29b-41d4-a716-446655440001",
       "userId": "550e8400-e29b-41d4-a716-446655440000",
       "status": "RUNNING",
       "startTime": "2026-02-12T10:23:45.123Z",
       "projectId": null
     }
   }
   ```
7. **Auto-saved Variables:**
   - `sessionId` = session ID from response

**Verification Checklist:**

-  Response status is 200
-  Status shows "RUNNING"
-  Session has valid ID
-  startTime is recorded
-  `sessionId` variable is set

#### **Phase 6: Pause Session (2 minutes)**

1. **Request:** `POST /api/sessions/{{sessionId}}/pause`
2. **Location in Postman:**
   - Left sidebar → 📊 Sessions Management → 2. Pause Session
3. **URL Check:** Postman auto-replaces `{{sessionId}}` with actual session ID
   - **Verify in URL bar:** `http://localhost:3900/api/sessions/sess-550e8400.../pause`
4. **Click:** Blue **"Send"** button
5. **Expected Response (200 OK):**
   ```json
   {
     "success": true,
     "data": {
       "id": "sess-550e8400-e29b-41d4-a716-446655440001",
       "status": "PAUSED",
       "pauseTime": "2026-02-12T10:24:15.456Z"
     }
   }
   ```

**Verification Checklist:**

-  Response status is 200
-  Status changed to "PAUSED"
-  pauseTime is recorded

#### **Phase 7: Resume Session (2 minutes)**

1. **Request:** `POST /api/sessions/{{sessionId}}/resume`
2. **Location in Postman:**
   - Left sidebar → 📊 Sessions Management → 3. Resume Session
3. **Click:** Blue **"Send"** button
4. **Expected Response (200 OK):**
   ```json
   {
     "success": true,
     "data": {
       "id": "sess-550e8400-e29b-41d4-a716-446655440001",
       "status": "RUNNING",
       "resumeTime": "2026-02-12T10:25:30.789Z"
     }
   }
   ```

**Verification Checklist:**

-  Response status is 200
-  Status back to "RUNNING"
-  resumeTime is recorded

#### **Phase 8: End Session (2 minutes)**

1. **Request:** `POST /api/sessions/{{sessionId}}/end`
2. **Location in Postman:**
   - Left sidebar → 📊 Sessions Management → 4. End Session
3. **Click:** Blue **"Send"** button
4. **Expected Response (200 OK):**
   ```json
   {
     "success": true,
     "data": {
       "id": "sess-550e8400-e29b-41d4-a716-446655440001",
       "status": "COMPLETED",
       "endTime": "2026-02-12T10:26:00.000Z",
       "durationSeconds": 135
     }
   }
   ```

**Verification Checklist:**

-  Response status is 200
-  Status shows "COMPLETED"
-  endTime is recorded
-  durationSeconds calculated

#### **Phase 9: Refresh Token (2 minutes) - OPTIONAL**

1. **Request:** `POST /api/auth/refresh`
2. **Location in Postman:**
   - Left sidebar → 🔐 Authentication → 3. Refresh Access Token
3. **Body Tab:**
   ```json
   {
     "refreshToken": "{{refreshToken}}"
   }
   ```
4. **Click:** Blue **"Send"** button
5. **Expected Response (200 OK):**
   ```json
   {
     "success": true,
     "data": {
       "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     }
   }
   ```
6. **Auto-saved Variables:**
   - `accessToken` = new token (old one still valid for 15 min)

**Verification Checklist:**

-  Response status is 200
-  New accessToken provided
-  Token starts with "eyJ"

#### **Phase 10: Logout (1 minute)**

1. **Request:** `POST /api/auth/logout`
2. **Location in Postman:**
   - Left sidebar → 🔐 Authentication → 4. Logout User
3. **Auth:** Uses current `accessToken`
4. **Click:** Blue **"Send"** button
5. **Expected Response (200 OK):**
   ```json
   {
     "success": true,
     "data": {
       "message": "Logged out successfully"
     }
   }
   ```
6. **Auto-cleared Variables:**
   - `accessToken` = cleared
   - `refreshToken` = cleared

**Verification Checklist:**

-  Response status is 200
-  Success message shown
-  Tokens cleared (check Environment)

---

## Visual Walkthrough

### Postman Interface Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Postman Application                                             │
├──────────────────┬────────────────────────────────────────────────┤
│                  │                                                 
│ Left Sidebar     │ Main Panel (Request/Response)                   │
│ (Collections)    │                                                 │
│                  │ ┌──────────────────────────────────────────┐    │
│ • Collection     │ │ GET /api/health                    Send  │    │
│   Items          │ └──────────────────────────────────────────┘    │
│                  │                                                 │
│                  │ Tabs:                                           │
│ Auth             │ • Params  • Headers  • Body  • Pre-request...  │
│ Sessions         │                                                 │
│ Health           │ Response:                                      │
│ ...              │ ┌──────────────────────────────────────────┐    │
│                  │ │ 200 OK                          JSON     │    │
│                  │ │                                          │    │
│                  │ │ { "status": "ok" }                      │    │
│                  │ └──────────────────────────────────────────┘    │
└──────────────────┴────────────────────────────────────────────────┘

Top-Right Area:
┌──────┬──────────────────────┬─────────────────┐
│ Eye  │ Environment Selector │ Save/Cancel     │
│ Icon │ (Workspace, Env)     │ Buttons         │
└──────┴──────────────────────┴─────────────────┘
```

### Step-by-Step Screenshots (Text Version)

**Finding a Request:**

```
Left Panel → 🔐 Authentication (click to expand)
            ↓
         1. Register New User
         2. Login User
         3. Refresh Access Token
         4. Logout User

Click → "1. Register New User"
```

**Sending a Request:**

```
Main Panel:
┌─────────────────────────────────────────────────┐
│ POST  {{baseUrl}}/api/auth/register      Send→ │   ← Click SEND
└─────────────────────────────────────────────────┘

Wait for Response...

Bottom Panel:
┌──────────────────────────────────┐
│ 200 OK (green badge)             │
│ { "success": true, "data": {} }  │
└──────────────────────────────────┘
```

**Using URL Variables:**

```
Raw URL: http://localhost:3900/api/auth/register

After login, Session endpoint shows:
{{baseUrl}}/api/sessions/{{sessionId}}/pause

Postman auto-replaces with:
http://localhost:3900/api/sessions/session-12345/pause
```

---

## Error Handling

### Common Error Responses

#### 400 Bad Request

**Scenario:** Invalid email format

**Request:**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "invalid-email", // Missing @
  "password": "TestPass123"
}
```

**Response:**

```json
{
  "success": false,
  "message": "valid email is required",
  "code": "VALIDATION_ERROR"
}
```

**Fix:** Use valid email format (x@example.com)

#### 401 Unauthorized

**Scenario:** Missing or invalid token

**Request:**

```
GET /api/sessions
Authorization: Bearer invalid-token
```

**Response:**

```json
{
  "success": false,
  "message": "Invalid token",
  "code": "AUTHENTICATION_ERROR"
}
```

**Fix:**

1. Login first
2. Copy `accessToken` from login response
3. Postman auto-sets it; verify in **Headers** tab

#### 429 Too Many Requests

**Scenario:** 5+ login attempts in 15 minutes

**Response:**

```json
{
  "success": false,
  "message": "Too many authentication attempts, please try again later.",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

**Fix:** Wait 15 minutes or use different email

#### 500 Internal Server Error

**Scenario:** Database error, unexpected exception

**Response:**

```json
{
  "success": false,
  "message": "Internal Server Error",
  "code": "INTERNAL_ERROR"
}
```

**Fix:**

1. Check backend logs: `docker-compose logs -f backend`
2. Verify database is running
3. Restart backend: `pnpm dev`

### How to Debug

**Step 1: Check Response Status**

- Green badge (200-299) = Success 
- Yellow badge (300-399) = Redirect 
- Orange badge (400-499) = Client error 
- Red badge (500-599) = Server error 🔴

**Step 2: Read Error Message**

```json
"message": "This describes what went wrong"
"code": "ERROR_CODE_CATEGORY"
```

**Step 3: Check Headers Tab**

- Look for `Authorization` header
- Should show: `Authorization: Bearer eyJhbGciOi...`

**Step 4: Verify Variables**

- Top-right eye icon → Variables
- Check `accessToken`, `userId`, etc.

**Step 5: Check Backend Logs**

```bash
cd apps/backend
pnpm dev
# Look for error messages
```

---

## Testing Checklist Template

Print or save this checklist:

```
Postman Testing Session: _______________
Date: ________________

🔐 Authentication
[ ] Health Check - GET /api/health
    Status: ___  Response: { "status": "ok" }

[ ] Register User - POST /api/auth/register
    Email: ___________________
    Status: ___  User ID Saved: _______________

[ ] Login - POST /api/auth/login
    Status: ___  accessToken: _________...______
              refreshToken: _________...______

📊 Sessions
[ ] Create Session - POST /api/sessions
    Status: ___  Session ID Saved: _________...

[ ] Pause Session - POST /api/sessions/{id}/pause
    Status: ___  Status Changed to: PAUSED

[ ] Resume Session - POST /api/sessions/{id}/resume
    Status: ___  Status Changed to: RUNNING

[ ] End Session - POST /api/sessions/{id}/end
    Status: ___  Duration: _______ seconds

🔄 Token Management
[ ] Refresh Token - POST /api/auth/refresh
    Status: ___  New Token: _________...______

[ ] Logout - POST /api/auth/logout
    Status: ___  Tokens Cleared: YES [ ] NO [ ]

 All tests passed: YES [ ] NO [ ]
Notes: _________________________________
```

---

**End of Postman Guide**

For more details, see the main README.md

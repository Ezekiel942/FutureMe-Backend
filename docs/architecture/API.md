# FutureMe API Documentation

## Base URL

- Development: `http://localhost:3900`
- Production: `https://api.worksight.local`

## Common Headers

- `Authorization: Bearer <accessToken>` (required for protected endpoints)
- `Content-Type: application/json`

## Global Response Format

### Success

```json
{
  "success": true,
  "data": { ... }
}
```

### Error

```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

`code` values for common cases:

- `INVALID_PAYLOAD`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `RATE_LIMIT_EXCEEDED`
- `INTERNAL_ERROR`

---

## Authentication Endpoints

### POST /api/auth/register

- Auth: none
- Rate limit: 3 requests per hour

#### Request body

```json
{
  "email": "john.doe@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Success response (201)

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "member",
    "tenantId": "uuid"
  }
}
```

#### Errors

- 400 INVALID_EMAIL
- 400 WEAK_PASSWORD
- 400 USER_EXISTS
- 429 RATE_LIMIT_EXCEEDED

### POST /api/auth/login

- Auth: none
- Rate limit: 5 requests per 15 minutes

#### Request body

```json
{
  "email": "john.doe@example.com",
  "password": "SecurePass123!"
}
```

#### Success response (200)

```json
{
  "success": true,
  "data": {
    "accessToken": "jwt-access-token",
    "refreshToken": "jwt-refresh-token",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "email": "john.doe@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "member",
      "tenantId": "uuid"
    }
  }
}
```

#### Errors

- 400 MISSING_FIELDS
- 401 INVALID_CREDENTIALS
- 429 RATE_LIMIT_EXCEEDED

### POST /api/auth/refresh

- Auth: none

#### Request body

```json
{
  "refreshToken": "jwt-refresh-token"
}
```

#### Success response (200)

```json
{
  "success": true,
  "data": {
    "accessToken": "new-jwt-access-token",
    "refreshToken": "new-jwt-refresh-token",
    "expiresIn": 900
  }
}
```

#### Errors

- 401 MISSING_TOKEN
- 401 INVALID_TOKEN
- 429 RATE_LIMIT_EXCEEDED

### POST /api/auth/logout

- Auth: Bearer

#### Request body

empty

#### Success response (200)

```json
{ "success": true, "data": { "message": "Logged out successfully" } }
```

#### Errors

- 401 UNAUTHORIZED

---

## File Upload Endpoints

### POST /api/upload

Upload files to Supabase Storage bucket.

**Auth:** Bearer token required  
**Content-Type:** `multipart/form-data`  
**Rate limit:** 10 uploads per minute per user

#### Request

- **Method:** POST
- **URL:** `/api/upload`
- **Headers:**
  - `Authorization: Bearer <accessToken>`
- **Body:** Form data
  - `file`: File to upload (required)

#### File Restrictions

- **Allowed types:** `image/jpeg`, `image/png`, `application/pdf`
- **Max size:** 5MB
- **Storage:** Supabase Storage bucket `uploads` (public)

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "url": "https://your-project.supabase.co/storage/v1/object/public/uploads/1643723400-abc123.jpg",
    "fileName": "original-filename.jpg",
    "size": 1024000,
    "type": "image/jpeg"
  }
}
```

#### Error Responses

**400 BAD REQUEST - No file uploaded**

```json
{
  "success": false,
  "message": "No file uploaded",
  "code": "NO_FILE"
}
```

**400 BAD REQUEST - Invalid file type**

```json
{
  "success": false,
  "message": "File type image/gif not allowed. Allowed types: image/jpeg, image/png, application/pdf",
  "code": "UPLOAD_FAILED"
}
```

**400 BAD REQUEST - File too large**

```json
{
  "success": false,
  "message": "File size exceeds maximum allowed size of 5MB",
  "code": "UPLOAD_FAILED"
}
```

**401 UNAUTHORIZED**

```json
{
  "success": false,
  "message": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

**500 INTERNAL SERVER ERROR**

```json
{
  "success": false,
  "message": "Upload failed",
  "code": "UPLOAD_FAILED"
}
```

#### Usage Examples

**cURL:**

```bash
curl -X POST http://localhost:2200/api/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/your/image.jpg"
```

**JavaScript (fetch):**

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('/api/upload', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: formData,
});

const result = await response.json();
console.log('Uploaded file URL:', result.data.url);
```

---

## Session Endpoints (v1)

### GET /api/v1/sessions/active

- Auth: Bearer

#### Response (200)

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "projectId": "uuid|null",
    "taskId": "uuid|null",
    "startTime": "2026-03-29T10:00:00.000Z",
    "status": "active",
    "metadata": { ... }
  }
}
```

### GET /api/v1/sessions

- Auth: Bearer
- Query: `page`, `limit`, `status`

#### Response (200)

```json
{
  "success": true,
  "data": {
    "items": [ ...session objects... ],
    "page": 1,
    "limit": 20,
    "total": 125
  }
}
```

### POST /api/v1/sessions

- Auth: Bearer
- Rate limit: 10 requests per minute

#### Request

```json
{
  "projectId": "uuid|null",
  "taskId": "uuid|null",
  "metadata": { "context": "meeting" }
}
```

#### Response (201)

```json
{ "success": true, "data": { ...session object... } }
```

### POST /api/v1/sessions/:sessionId/pause

- Auth: Bearer

#### Response (200)

```json
{
  "success": true,
  "data": { "id": "uuid", "status": "paused", "pausedAt": "2026-03-29T10:30:00.000Z" }
}
```

### POST /api/v1/sessions/:sessionId/resume

- Auth: Bearer

#### Response (200)

```json
{
  "success": true,
  "data": { "id": "uuid", "status": "active", "resumedAt": "2026-03-29T10:40:00.000Z" }
}
```

### POST /api/v1/sessions/:sessionId/end

- Auth: Bearer

#### Request

```json
{ "notes": "Completed user story" }
```

#### Response (200)

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "ended",
    "endTime": "2026-03-29T11:00:00.000Z",
    "durationSeconds": 3600
  }
}
```

#### Errors

- 404 NOT_FOUND
- 409 INVALID_SESSION_STATE

---

## Analytics Endpoints

All analytics endpoints require Bearer.

### GET /api/v1/insights/risk-summary

### GET /api/v1/insights/utilization

### GET /api/v1/insights/financial

### GET /api/v1/insights/efficiency

### GET /api/v1/insights/financial/deep-analysis

### GET /api/v1/insights/summary/:period

#### Response (200)

```json
{
  "success": true,
  "data": {
    "period": "weekly",
    "values": [ ... ],
    "meta": { "from":"...","to":"..." }
  }
}
```

#### Errors

- 400 INVALID_PERIOD
- 401 UNAUTHORIZED

---

## AI Endpoints

All AI endpoints require Bearer.

### POST /api/v1/insights/ai/executive-summary

#### Request

```json
{
  "projectId": "uuid",
  "dateRange": { "from": "2026-03-01", "to": "2026-03-31" }
}
```

#### Response (200)

```json
{
  "success": true,
  "data": {
    "summary": "...",
    "score": 0.87,
    "recommendations": ["..."]
  }
}
```

### GET /api/v1/insights/ai/burnout-analysis/:userId

### GET /api/v1/insights/ai/project-risk/:projectId

### GET /api/v1/insights/ai/project-risk-predictor/:projectId

### GET /api/v1/insights/ai/recommendations

### GET /api/v1/insights/ai/work-coach/:userId

### GET /api/v1/insights/ai/workforce-reassignment

### GET /api/v1/insights/ai/executive-report

### GET /api/v1/insights/ai/burnout-predictor/:userId

#### Response example (200)

```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "aiInsights": [{ "type": "burnout", "score": 0.72, "message": "..." }]
  }
}
```

#### Errors

- 503 AI_SERVICE_UNAVAILABLE
- 429 AI_RATE_LIMIT_EXCEEDED
- 422 AI_INPUT_INVALID

---

## Simulation Endpoints

All require Bearer.

### POST /api/v1/digital-twin/simulations

#### Request

```json
{
  "scenarioType": "team-size-change",
  "parameters": {
    "teamSize": 10,
    "expectedVelocity": 50
  }
}
```

#### Response (201)

```json
{ "success": true, "data": { "id": "uuid", "status": "created" } }
```

### GET /api/v1/digital-twin/simulations

#### Response (200)

```json
{ "success": true, "data": [ ... ] }
```

### POST /api/v1/digital-twin/simulations/:simulationId/run

#### Request

```json
{
  "predictedProductivityChange": 0.1,
  "predictedCompletionChange": 0.05,
  "predictedCostChange": -0.02
}
```

#### Response (200)

```json
{ "success": true, "data": { "id": "uuid", "status": "running" } }
```

### GET /api/v1/digital-twin/simulations/:simulationId/results

#### Response (200)

```json
{ "success": true, "data": { "simulationId": "uuid", "results": { ... } } }
```

### GET /api/v1/digital-twin/workforce-model

#### Response (200)

```json
{
  "success": true,
  "data": {
    "averageProductivity": 0.82,
    "averageTaskDuration": 45,
    "teamUtilization": 0.78,
    "burnoutIndex": 0.16
  }
}
```

### PUT /api/v1/digital-twin/workforce-model

#### Request

```json
{
  "averageProductivity": 0.82,
  "averageTaskDuration": 45,
  "teamUtilization": 0.78,
  "burnoutIndex": 0.16
}
```

#### Response (200)

```json
{ "success": true, "data": { ... } }
```

---

## Health Endpoints

### GET /api/health

Response:

```json
{ "status": "ok" }
```

### GET /api/health/ready

Response:

```json
{ "ready": true }
```

### GET /api/health/healthz

Response:

```json
{ "status": "ok" }
```

---

## WebSocket Events

- Connect: `ws://localhost:3900` or `wss://api.worksight.local` via Socket.IO
- Auth: `io(url, { auth: { token: 'Bearer <accessToken>' }})`

### Server → Client

- `session:started`
- `session:paused`
- `session:resumed`
- `session:ended`
- `risk:detected`
- `anomaly:flagged`
- `user:online`, `user:offline`

### Client → Server

- `authenticate` (body: `{ "userId": "uuid", "token": "<token>" }`)
- `session:subscribe` (body: `{ "sessionId": "uuid" }`)
- `session:unsubscribe` (body: `{ "sessionId": "uuid" }`)

### Standard socket payload

```json
{
  "event": "session:started",
  "data": {
    "sessionId": "uuid",
    "userId": "uuid",
    "status": "active"
  }
}
```

---

## Standard Error Format

- 400: `BAD_REQUEST`
- 401: `UNAUTHORIZED`
- 403: `FORBIDDEN`
- 404: `NOT_FOUND`
- 409: `CONFLICT`
- 429: `RATE_LIMIT_EXCEEDED`
- 500: `INTERNAL_ERROR`

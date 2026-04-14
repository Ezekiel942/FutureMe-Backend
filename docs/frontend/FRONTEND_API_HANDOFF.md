# Frontend API Handoff

**Updated:** 2026-03-29

## Base URL

- Local: `http://localhost:3900`
- Prod: `https://api.worksight.local`

## Auth

All protected endpoints require:
```
Authorization: Bearer <accessToken>
```

### POST /api/auth/register
Request body: `{ email, password, firstName, lastName }`
Response 201: user object (id, email, name, role, tenantId)
Errors: 400, 409, 429

### POST /api/auth/login
Request body: `{ email, password }`
Response 200:
`{ accessToken, refreshToken, expiresIn, user }`

### POST /api/auth/refresh
Request body: `{ refreshToken }` optional (supports httpOnly cookie)
Response 200: new tokens

### POST /api/auth/logout
Protected endpoint. Response 200 success.

### POST /api/auth/forgot
Request body: `{ email }`
Response 200: message

### POST /api/auth/reset
Request body: `{ token, newPassword }`
Response 200: message

## Session Endpoints (v1)

- `GET /api/v1/sessions/active`
- `GET /api/v1/sessions?page=&limit=&status=` (page, limit, status)
- `POST /api/v1/sessions` body `{ projectId?, taskId?, metadata? }`
- `POST /api/v1/sessions/:sessionId/pause`
- `POST /api/v1/sessions/:sessionId/resume`
- `POST /api/v1/sessions/:sessionId/end` body `{ notes? }`

### Session object fields
`id, userId, projectId, taskId, startTime, endTime, durationSeconds, status (active|paused|ended), metadata`

## Analytics Endpoints

- `GET /api/v1/insights/risk-summary`
- `GET /api/v1/insights/utilization`
- `GET /api/v1/insights/financial`
- `GET /api/v1/insights/efficiency`
- `GET /api/v1/insights/financial/deep-analysis`
- `GET /api/v1/insights/summary/:period` (daily|weekly|monthly)

## AI Endpoints

- `POST /api/v1/insights/ai/executive-summary` (project-specific request payload)
- `GET /api/v1/insights/ai/burnout-analysis/:userId`
- `GET /api/v1/insights/ai/project-risk/:projectId`
- `GET /api/v1/insights/ai/project-risk-predictor/:projectId`
- `GET /api/v1/insights/ai/recommendations`
- `GET /api/v1/insights/ai/work-coach/:userId`
- `GET /api/v1/insights/ai/workforce-reassignment`
- `GET /api/v1/insights/ai/executive-report`
- `GET /api/v1/insights/ai/burnout-predictor/:userId`

## Simulation Endpoints

- `POST /api/v1/digital-twin/simulations` body `{ scenarioType, parameters }`
- `GET /api/v1/digital-twin/simulations`
- `POST /api/v1/digital-twin/simulations/:simulationId/run` body `{ predictedProductivityChange, predictedCompletionChange, predictedCostChange }`
- `GET /api/v1/digital-twin/simulations/:simulationId/results`
- `GET /api/v1/digital-twin/workforce-model`
- `PUT /api/v1/digital-twin/workforce-model` body `{ averageProductivity, averageTaskDuration, teamUtilization, burnoutIndex }`

## Health

- `GET /api/health` => `{ status: "ok" }`
- `GET /api/health/ready` => `{ ready: true }`
- `GET /api/health/healthz` => `{ status: "ok" }`

## WebSocket Events

### Client -> Server
- `authenticate` payload `{ userId, token }`
- `session:subscribe` { sessionId }
- `session:unsubscribe` { sessionId }

### Server -> Client
- `session:started`, `session:paused`, `session:resumed`, `session:ended`
- `risk:detected`, `anomaly:flagged`, `insight:updated`
- `user:online`, `user:offline`

## Error Format

```json
{
  "success": false,
  "message": "...",
  "code": "...",
  "details": {}
}
```

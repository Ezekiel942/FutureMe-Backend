# FutureMe API Handoff Document

**Updated:** 2026-03-29
**API Version:** 0.1.0
**Base URL (Dev):** `http://localhost:3900`
**Base URL (Prod):** `https://api.worksight.local`

## Auth

### POST /api/auth/register
- Body: `email`, `password`, `firstName`, `lastName`
- Response 201: user object
- Errors: 400 `USER_EXISTS`, 400 `INVALID_EMAIL`, 400 `WEAK_PASSWORD`, 429

### POST /api/auth/login
- Body: `email`, `password`
- Response 200: `accessToken`, `refreshToken`, `user`
- Errors: 400 `MISSING_FIELDS`, 401 `INVALID_CREDENTIALS`, 429

### POST /api/auth/refresh
- Body: `refreshToken` (or cookie)
- Response 200: new tokens
- Errors: 401 `MISSING_TOKEN`, 401 `INVALID_TOKEN`, 429

### POST /api/auth/logout
- Auth required
- Response 200: `{ message: "Logged out successfully" }`

### POST /api/auth/forgot
- Body: `email`
- Response 200: reset token in dev env
- Errors: 400 `INVALID_EMAIL`, 429

### POST /api/auth/reset
- Body: `token`, `newPassword`
- Response 200: password updated
- Errors: 400 `WEAK_PASSWORD`, 401 `INVALID_TOKEN`

## Sessions

### GET /api/v1/sessions/active
- Returns active session or null

### GET /api/v1/sessions
- Query: `page`, `limit`, `status`
- Returns list + paging

### POST /api/v1/sessions
- Body: `projectId?`, `taskId?`, `metadata?`
- Returns created session

### POST /api/v1/sessions/:sessionId/pause

### POST /api/v1/sessions/:sessionId/resume

### POST /api/v1/sessions/:sessionId/end
- Body: `notes?`
- Returns ended session

## Analytics

### GET /api/v1/insights/risk-summary
### GET /api/v1/insights/utilization
### GET /api/v1/insights/financial
### GET /api/v1/insights/efficiency
### GET /api/v1/insights/financial/deep-analysis
### GET /api/v1/insights/summary/:period

## AI

### POST /api/v1/insights/ai/executive-summary
### GET /api/v1/insights/ai/burnout-analysis/:userId
### GET /api/v1/insights/ai/project-risk/:projectId
### GET /api/v1/insights/ai/project-risk-predictor/:projectId
### GET /api/v1/insights/ai/recommendations
### GET /api/v1/insights/ai/work-coach/:userId
### GET /api/v1/insights/ai/workforce-reassignment
### GET /api/v1/insights/ai/executive-report
### GET /api/v1/insights/ai/burnout-predictor/:userId

## Simulation

### POST /api/v1/digital-twin/simulations
- Body: `scenarioType`, `parameters`

### GET /api/v1/digital-twin/simulations

### POST /api/v1/digital-twin/simulations/:simulationId/run
- Body: `predictedProductivityChange`, `predictedCompletionChange`, `predictedCostChange`

### GET /api/v1/digital-twin/simulations/:simulationId/results

### GET /api/v1/digital-twin/workforce-model
### PUT /api/v1/digital-twin/workforce-model
- Body: `averageProductivity`, `averageTaskDuration`, `teamUtilization`, `burnoutIndex`

## Health

### GET /api/health
### GET /api/health/ready
### GET /api/health/healthz

## WebSocket

### Client connect
`io(baseUrl, { auth: { token: 'Bearer <accessToken>' } })`

### Server events
`session:started`, `session:paused`, `session:resumed`, `session:ended`, `risk:detected`, `anomaly:flagged`, `user:online`, `user:offline`

### Client events
`authenticate`, `session:subscribe`, `session:unsubscribe`

## Error format

All errors use the global response model with `success: false`, `message`, `code`, `details`.

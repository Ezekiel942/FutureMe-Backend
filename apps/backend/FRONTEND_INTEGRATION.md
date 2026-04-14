# Frontend Integration Guide

## Quick Start

### 1. Environment Setup

Create `.env.local` in your frontend project:

```
VITE_API_BASE_URL=http://localhost:3900
VITE_WEBSOCKET_URL=http://localhost:3900
```

### 2. Install Dependencies

```bash
npm install axios socket.io-client jwt-decode
```

## Base URL

- API: `process.env.VITE_API_BASE_URL`
- WebSocket: `process.env.VITE_WEBSOCKET_URL`

## Headers

For protected calls:

- `Content-Type: application/json`
- `Authorization: Bearer <accessToken>`

### Example header builder

```typescript
const authHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});
```

## Authentication Flow

(keep existing auth service code as-is)

## WebSocket Usage

(keep existing websocket service code as-is)

## Example Fetch Calls

```typescript
const apiBase = process.env.VITE_API_BASE_URL;

async function login(email: string, password: string) {
  const res = await fetch(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

async function getActiveSession(token: string) {
  const res = await fetch(`${apiBase}/api/v1/sessions/active`, {
    headers: {
      ...authHeaders(token),
    },
  });
  return res.json();
}

async function startSession(token: string, data: { projectId?: string; taskId?: string; metadata?: any }) {
  const res = await fetch(`${apiBase}/api/v1/sessions`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return res.json();
}
```

## Postman Setup

- Import collection: `FutureMe_API_Postman_Collection.json`
- Environment: `FutureMe_API_Environment.postman_environment.json`

## Notes

- Keep the token refresh flow in interceptors.
- Use WebSocket events for real-time session updates.

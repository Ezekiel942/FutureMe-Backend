# Frontend Environment Setup Guide

**Generated:** March 3, 2026
**Purpose:** Configuration guide for frontend development and production environments.

## Required Environment Variables

Your frontend application must configure the following environment variables to communicate with the backend API.

### VITE_API_BASE_URL

- **Description:** Base URL for all REST API calls.
- **Type:** string
- **Required:** Yes
- **Development:** `http://localhost:3900`
- **Production:** `https://api.worksight.local`
- **Usage in code:**
  ```javascript
  const apiBase = import.meta.env.VITE_API_BASE_URL;
  const loginUrl = `${apiBase}/api/auth/login`;
  ```

### VITE_SOCKET_URL

- **Description:** WebSocket connection URL for real-time events.
- **Type:** string
- **Required:** Yes
- **Development:** `ws://localhost:3900/socket.io`
- **Production:** `wss://api.worksight.local/socket.io`
- **Usage in code:**
  ```javascript
  import io from 'socket.io-client';
  const socket = io(import.meta.env.VITE_SOCKET_URL, {
    auth: { token: accessToken },
  });
  ```

---

## API Endpoint Checklist for Frontend Integration

- `/api/auth/*` for registration, login, refresh, logout
- `/api/v1/sessions/*` for session lifecycle
- `/api/v1/insights/*` for analytics + AI
- `/api/v1/digital-twin/*` for simulation
- `/api/health` and `/api/healthz` for readiness

---

## Common issues

(Existing sections unchanged...)

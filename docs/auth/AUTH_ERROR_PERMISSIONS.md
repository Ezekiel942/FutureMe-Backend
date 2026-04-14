# Authentication, Error Response Standard, and Permission Matrix

**Generated:** March 2, 2026

## Authentication Flow

This section describes the end-to-end authentication flow used by the backend and expected by the frontend.

1. Register

- Endpoint: `POST /api/auth/register`
- Purpose: Create a new user account. Returns created user record (no tokens).

2. Login

- Endpoint: `POST /api/auth/login`
- Purpose: Authenticate user credentials and return both an access token and a refresh token.

3. Receive tokens

- Successful login response (200):

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJI...access.example",
    "refreshToken": "eyJhbGciOiJI...refresh.example",
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "role": "user",
      "organizationId": "org-uuid"
    }
  }
}
```

4. Use `Authorization` header

- For all protected endpoints include the header:

```
Authorization: Bearer <accessToken>
```

5. Token expiration behavior

- Access tokens: short-lived (expected default ~15 minutes). Frontend must treat them as ephemeral and attempt transparent refresh when near expiry.
- Refresh tokens: long-lived (expected default days/weeks) and stored securely (HttpOnly cookie recommended). Refresh tokens may be invalidated on logout or rotation.
- On access token expiry, protected endpoints return a 401 and the frontend should call the refresh flow.

6. Refresh token usage

- Endpoint: `POST /api/auth/refresh`
- Accepts either a `refreshToken` in the request body or a cookie (depending on client integration).
- Successful refresh response (200):

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJI...new-access.example",
    "refreshToken": "eyJhbGciOiJI...new-refresh.example"
  }
}
```

- On invalid or expired refresh token the server returns a 401 and the frontend should send the user to login.

7. Logout

- Endpoint: `POST /api/auth/logout` (requires auth). Invalidates the refresh token server-side and clears cookies where applicable.

Security notes for frontend implementers:

- Store access tokens in memory (or short-lived storage) and prefer HttpOnly secure cookies for refresh tokens when possible.
- Always send `Authorization` header for API calls rather than embedding tokens in query strings.

---

## Error Response Standard

All error responses follow this canonical JSON structure. Frontend code should rely on this shape for error handling and UI messaging.

Canonical format:

```json
{
  "success": false,
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable message",
    "details": null
  }
}
```

- `success`: always `false` for errors.
- `error.code`: machine-readable error code (e.g. `INVALID_CREDENTIALS`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_INPUT`, `INVALID_TOKEN`).
- `error.message`: user-friendly message suitable for display (or for logging when not shown to end users).
- `error.details`: optional field with structured validation details or an array of field errors.

Examples:

- Validation error (400):

```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Password must be at least 8 characters",
    "details": { "password": "minLength:8" }
  }
}
```

- Unauthorized (401):

```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid or expired token",
    "details": null
  }
}
```

Mapping note: some older examples in code use top-level `message` or `code` fields. The canonical shape above is now the front-end contract; if you encounter legacy shapes, map them into this structure before using in UI logic.

---

## Permission Matrix

Reference table for frontend UI gating. This is authoritative for which UI elements and controls should be shown/hidden based on the authenticated user's `role` claim.

| Role           | Permissions                                                                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin`        | Full system access: manage users/org settings, view and export audit logs, manage billing, full read/write on projects/tasks/sessions, grant roles.                  |
| `manager`      | Manage team members (invite/remove), view billing, view and generate insights for team, create/assign projects, read/write tasks within organization.                |
| `project_lead` | Create and manage projects they lead, create and assign tasks within those projects, view project-level reports and sessions, moderate sessions for project members. |
| `user`         | Limited: create/start/stop their own sessions, view own profile and personal insights, view assigned projects and tasks, submit times/notes.                         |

UI gating guidance:

- Check the user's `role` claim on the authenticated `user` object returned at login. Use the permission set above to show/hide controls.
- For finer-grained checks (e.g., ownership of a project), call the relevant API (server enforces ownership and tenant isolation) rather than relying solely on role.

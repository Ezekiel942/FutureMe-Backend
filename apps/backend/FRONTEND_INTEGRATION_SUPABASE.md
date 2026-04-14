# Frontend Integration Guide - Supabase Auth

**Last Updated:** April 2, 2026  
**Backend Version:** 0.1.0  
**Status:** Ready for Integration

## Quick Start

### 1. Install Dependencies

```bash
npm install @supabase/supabase-js
# or
yarn add @supabase/supabase-js
# or
pnpm add @supabase/supabase-js
```

### 2. Configure Environment Variables

Create `.env.local`:

```env
VITE_SUPABASE_URL=https://ivossqicxlozmofzpnoy.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2b3NzcWljeGxvem1vZnpwbm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzOTAyOTgsImV4cCI6MjA4OTk2NjI5OH0.TR_E9y5Ma01Q5M7vr7fzZzWtwgEiTESqPfWmRt0FVg4
VITE_API_BASE_URL=http://localhost:2100
```

### 3. Initialize Supabase Client

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const apiUrl = apiBaseUrl;
```

## Authentication Flows

### Authentication State Management (React Example)

```typescript
// hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: any;
  session: any;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) throw error;

        setAuthState((prev) => ({
          ...prev,
          user: session?.user || null,
          session,
          loading: false,
        }));
      } catch (err: any) {
        setAuthState((prev) => ({
          ...prev,
          error: err.message,
          loading: false,
        }));
      }
    };

    checkAuth();

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState((prev) => ({
        ...prev,
        user: session?.user || null,
        session,
        loading: false,
      }));
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  return authState;
}
```

### User Registration

```typescript
// hooks/useAuth.ts (continued)
interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

async function register(input: RegisterInput) {
  try {
    setAuthState((prev) => ({ ...prev, loading: true, error: null }));

    // Call backend registration endpoint
    const response = await fetch(`${apiUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Registration failed');
    }

    const data = await response.json();

    // Store tokens
    localStorage.setItem('accessToken', data.data.session.accessToken);
    localStorage.setItem('refreshToken', data.data.session.refreshToken);
    localStorage.setItem('expiresAt', data.data.session.expiresAt);

    setAuthState((prev) => ({
      ...prev,
      user: { ...data.data, id: data.data.id },
      session: data.data.session,
      loading: false,
    }));

    return data.data;
  } catch (error: any) {
    setAuthState((prev) => ({
      ...prev,
      error: error.message,
      loading: false,
    }));
    throw error;
  }
}
```

### User Login

```typescript
// hooks/useAuth.ts (continued)
interface LoginInput {
  email: string;
  password: string;
}

async function login(input: LoginInput) {
  try {
    setAuthState((prev) => ({ ...prev, loading: true, error: null }));

    const response = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const data = await response.json();

    // Store tokens
    localStorage.setItem('accessToken', data.data.session.accessToken);
    localStorage.setItem('refreshToken', data.data.session.refreshToken);
    localStorage.setItem('expiresAt', data.data.session.expiresAt);

    setAuthState((prev) => ({
      ...prev,
      user: { ...data.data, id: data.data.id },
      session: data.data.session,
      loading: false,
    }));

    return data.data;
  } catch (error: any) {
    setAuthState((prev) => ({
      ...prev,
      error: error.message,
      loading: false,
    }));
    throw error;
  }
}
```

### Token Refresh

```typescript
// hooks/useAuth.ts (continued)
async function refreshToken() {
  try {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token available');

    const response = await fetch(`${apiUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      // Refresh failed, logout user
      await logout();
      throw new Error('Token refresh failed');
    }

    const data = await response.json();

    // Update tokens
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    localStorage.setItem('expiresAt', data.data.expiresAt);

    return data.data;
  } catch (error: any) {
    console.error('Token refresh error:', error);
    throw error;
  }
}
```

### User Logout

```typescript
// hooks/useAuth.ts (continued)
async function logout() {
  try {
    const accessToken = localStorage.getItem('accessToken');

    if (accessToken) {
      await fetch(`${apiUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    }

    // Clear tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('expiresAt');

    setAuthState({
      user: null,
      session: null,
      loading: false,
      error: null,
    });
  } catch (error: any) {
    console.error('Logout error:', error);
  }
}
```

## API Request Helper

### Authenticated Fetch Wrapper

```typescript
// lib/api.ts
import { apiUrl } from './supabase';

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiFetch(endpoint: string, options: FetchOptions = {}) {
  const { skipAuth = false, ...fetchOptions } = options;

  const url = `${apiUrl}${endpoint}`;
  const headers = new Headers(fetchOptions.headers || {});

  // Add authorization header if needed
  if (!skipAuth) {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    // Check token expiration
    const expiresAt = localStorage.getItem('expiresAt');
    if (expiresAt && parseInt(expiresAt) < Date.now() / 1000) {
      // Token expired, try to refresh
      try {
        await refreshToken();
        const newToken = localStorage.getItem('accessToken');
        headers.set('Authorization', `Bearer ${newToken}`);
      } catch (error) {
        throw new Error('Session expired. Please login again.');
      }
    } else {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Unauthorized, try to refresh
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      throw new Error('Session expired. Please login again.');
    }

    const error = await response.json();
    throw new Error(error.message || `API error: ${response.status}`);
  }

  return response.json();
}
```

## Usage Examples

### Protected Endpoint Examples

```typescript
// Get user profile
async function getUserProfile() {
  return apiFetch('/api/v1/users/profile');
}

// Get user sessions
async function getUserSessions() {
  return apiFetch('/api/v1/sessions?limit=10');
}

// Create new project
async function createProject(data: any) {
  return apiFetch('/api/v1/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// Update project
async function updateProject(id: string, data: any) {
  return apiFetch(`/api/v1/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// Delete project
async function deleteProject(id: string) {
  return apiFetch(`/api/v1/projects/${id}`, {
    method: 'DELETE',
  });
}
```

### React Component Example

```typescript
// components/LoginForm.tsx
import React, { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

export function LoginForm() {
  const { login, loading, error } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login({ email, password })
      // Navigate to dashboard
    } catch (err) {
      console.error('Login failed:', err)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  )
}
```

## Endpoint Reference

### All Available Endpoints

#### Authentication (Public)

- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/forgot` - Request password reset
- `POST /api/auth/reset` - Reset password

#### Sessions (Protected)

- `GET /api/v1/sessions` - List user's sessions
- `POST /api/v1/sessions` - Create new session
- `GET /api/v1/sessions/{id}` - Get session details
- `POST /api/v1/sessions/{id}/pause` - Pause session
- `POST /api/v1/sessions/{id}/resume` - Resume session
- `POST /api/v1/sessions/{id}/end` - End session

#### Projects (Protected)

- `GET /api/v1/projects` - List user's projects
- `POST /api/v1/projects` - Create new project
- `GET /api/v1/projects/{id}` - Get project details
- `PUT /api/v1/projects/{id}` - Update project
- `DELETE /api/v1/projects/{id}` - Delete project

#### Tasks (Protected)

- `GET /api/v1/tasks` - List tasks
- `POST /api/v1/tasks` - Create new task
- `PUT /api/v1/tasks/{id}` - Update task
- `DELETE /api/v1/tasks/{id}` - Delete task

#### Users (Protected)

- `GET /api/v1/users/profile` - Get current user profile
- `PUT /api/v1/users/profile` - Update user profile
- `GET /api/v1/users` - List users (admin only)

#### Insights (Protected)

- `GET /api/v1/insights` - Get insights
- `POST /api/v1/insights/{userId}/generate` - Generate insights
- `GET /api/v1/insights/{userId}/history` - Get insight history

#### Dashboard (Protected)

- `GET /api/v1/dashboard` - Get dashboard data
- `GET /api/v1/dashboard/metrics` - Get dashboard metrics

#### Additional Resources

- `GET /api/v1/announcements` - Get announcements
- `GET /api/v1/billing` - Get billing info
- `GET /api/v1/audit` - Get audit logs (admin)
- `GET /api/v1/workforce` - Get workforce data
- `GET /api/v1/digital-twin` - Get digital twin data
- `GET /api/v1/skills` - Get skill graph data

## Error Handling Best Practices

```typescript
// Common error scenarios
async function handleApiCall() {
  try {
    const result = await apiFetch('/api/v1/users/profile');
    return result;
  } catch (error: any) {
    if (error.message.includes('Session expired')) {
      // Show login prompt
      navigateToLogin();
    } else if (error.message.includes('Not authenticated')) {
      // User not logged in
      navigateToLogin();
    } else if (error.message.includes('Unauthorized')) {
      // Insufficient permissions
      showPermissionError();
    } else {
      // Generic error
      showErrorNotification(error.message);
    }
    throw error;
  }
}
```

## Security Best Practices

1. **Never store sensitive data in localStorage**
   - Access token OK (short-lived)
   - Refresh token: Use httpOnly cookie if possible
   - User ID OK (non-sensitive)

2. **Always use HTTPS in production**
   - Never send tokens over HTTP
   - Set secure flag on cookies

3. **Implement CSRF protection**
   - Use SameSite cookie attribute
   - Validate request origins

4. **Handle token expiration gracefully**
   - Implement refresh logic before expiration
   - Provide clear logout messaging

5. **Validate user input**
   - Email validation
   - Password strength requirements
   - Rate limiting on auth endpoints

## Troubleshooting

### Common Issues

**Q: Getting 401 Unauthorized on all requests**

- A: Verify Authorization header format: `Bearer <token>`
- A: Check token hasn't expired
- A: Try refreshing token

**Q: Token refresh failing**

- A: Verify refresh token is valid
- A: Refresh token expires after 7 days, re-login required
- A: Check backend is running

**Q: CORS errors**

- A: Verify `VITE_API_BASE_URL` matches backend URL
- A: Check backend CORS configuration
- A: Ensure credentials: true if using cookies

**Q: Session lost on page refresh**

- A: Use `useAuth` hook which auto-restores session
- A: Verify tokens stored in localStorage
- A: Check browser doesn't clear localStorage on logout

## Testing Integration

### Manual Testing Checklist

- [ ] User registration works
- [ ] User login works
- [ ] Access token is returned
- [ ] Token is sent in Authorization header
- [ ] Protected endpoints work with token
- [ ] Token refresh works
- [ ] User logout works
- [ ] Session persists on page refresh
- [ ] 401 errors handled correctly
- [ ] Error messages display to user

### Automated Testing

```typescript
// tests/auth.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useAuth } from '@/hooks/useAuth';

describe('Authentication', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should register a new user', async () => {
    const { register } = useAuth();
    const user = await register({
      email: 'test@example.com',
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'User',
    });

    expect(user.email).toBe('test@example.com');
    expect(localStorage.getItem('accessToken')).toBeTruthy();
  });

  it('should login existing user', async () => {
    const { login } = useAuth();
    const user = await login({
      email: 'test@example.com',
      password: 'TestPass123!',
    });

    expect(user.email).toBe('test@example.com');
    expect(localStorage.getItem('accessToken')).toBeTruthy();
  });
});
```

## Next Steps

1. Copy authentication code to your frontend
2. Update environment variables
3. Test authentication flows manually
4. Run automated tests
5. Deploy to production
6. Monitor logs for errors

## Support

For issues or questions:

1. Check [Supabase documentation](https://supabase.com/docs)
2. Review backend logs
3. Check browser console for error details
4. Test with Postman collection first

**Last Updated:** April 2, 2026

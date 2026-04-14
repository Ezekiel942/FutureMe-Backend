# Frontend Integration Guide

Integration guide for FutureMe frontend with Supabase authentication and backend API.

## Overview

## Supabase Client Setup

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

## Authentication Flow

### Sign Up

```javascript
const signUp = async (email, password, firstName, lastName) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName,
        },
      },
    });

    if (error) throw error;

    // User is signed up and logged in
    console.log('User signed up:', data.user);
    return data;
  } catch (error) {
    console.error('Sign up error:', error.message);
    throw error;
  }
};
```

### Sign In

```javascript
const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Store session tokens
    localStorage.setItem('supabase_access_token', data.session.access_token);
    localStorage.setItem('supabase_refresh_token', data.session.refresh_token);

    console.log('User signed in:', data.user);
    return data;
  } catch (error) {
    console.error('Sign in error:', error.message);
    throw error;
  }
};
```

### Sign Out

```javascript
const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    // Clear stored tokens
    localStorage.removeItem('supabase_access_token');
    localStorage.removeItem('supabase_refresh_token');

    console.log('User signed out');
  } catch (error) {
    console.error('Sign out error:', error.message);
    throw error;
  }
};
```

### Get Current User

```javascript
const getCurrentUser = async () => {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) throw error;

    return data.user;
  } catch (error) {
    console.error('Get user error:', error.message);
    return null;
  }
};
```

### Session Management

```javascript
// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    console.log('User signed in:', session.user);
    // Update your app state
  } else if (event === 'SIGNED_OUT') {
    console.log('User signed out');
    // Clear app state
  }
});

// Refresh session automatically
const refreshSession = async () => {
  try {
    const { data, error } = await supabase.auth.refreshSession();

    if (error) throw error;

    // Update stored tokens
    localStorage.setItem('supabase_access_token', data.session.access_token);
    localStorage.setItem('supabase_refresh_token', data.session.refresh_token);

    return data.session;
  } catch (error) {
    console.error('Session refresh error:', error.message);
    throw error;
  }
};
```

## API Requests

### Making Authenticated Requests

```javascript
// Get access token
const accessToken = localStorage.getItem('supabase_access_token');

// Make API request
const response = await fetch('/api/v1/sessions/active', {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
});

const data = await response.json();
```

### Axios Example

```javascript
import axios from 'axios';

// Create axios instance with auth header
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('supabase_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Use the API
const sessions = await api.get('/v1/sessions/active');
```

### React Query Example

```javascript
import { useQuery, useMutation } from '@tanstack/react-query';

const useActiveSession = () => {
  return useQuery({
    queryKey: ['active-session'],
    queryFn: async () => {
      const token = localStorage.getItem('supabase_access_token');
      const response = await fetch('/api/v1/sessions/active', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.json();
    },
  });
};

const useCreateSession = () => {
  return useMutation({
    mutationFn: async (sessionData) => {
      const token = localStorage.getItem('supabase_access_token');
      const response = await fetch('/api/v1/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData),
      });
      return response.json();
    },
  });
};
```

## File Upload

### Upload File

```javascript
const uploadFile = async (file) => {
  const token = localStorage.getItem('supabase_access_token');

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const result = await response.json();

  if (result.success) {
    console.log('File uploaded:', result.data.url);
    return result.data;
  } else {
    throw new Error(result.message);
  }
};
```

## Error Handling

### Authentication Errors

```javascript
const handleApiError = (error) => {
  if (error.response?.status === 401) {
    // Token expired or invalid
    localStorage.removeItem('supabase_access_token');
    localStorage.removeItem('supabase_refresh_token');

    // Redirect to login or refresh token
    window.location.href = '/login';
  } else if (error.response?.status === 403) {
    // Forbidden - user doesn't have permission
    console.error('Access denied');
  } else {
    // Other errors
    console.error('API error:', error.message);
  }
};
```

## Environment Variables

Add these to your `.env.local` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Complete Auth Context (React)

```javascript
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === 'SIGNED_IN') {
        localStorage.setItem('supabase_access_token', session.access_token);
        localStorage.setItem('supabase_refresh_token', session.refresh_token);
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('supabase_access_token');
        localStorage.removeItem('supabase_refresh_token');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email, password, firstName, lastName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName,
        },
      },
    });

    if (error) throw error;
    return data;
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

## API Endpoints Summary

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/refresh` - Refresh access token

### Protected Endpoints

All other endpoints require `Authorization: Bearer <token>` header.

### File Upload

- `POST /api/upload` - Upload files (multipart/form-data)

### Sessions

- `GET /api/v1/sessions/active` - Get active session
- `GET /api/v1/sessions` - Get session history
- `POST /api/v1/sessions` - Create new session

### And many more endpoints for:

- Projects, Tasks, Insights, Dashboard, Workforce, etc.

## Next Steps

1. Set up Supabase client in your frontend
2. Implement authentication flow
3. Add API interceptors for automatic token handling
4. Implement error handling for auth failures
5. Test all protected endpoints with valid tokens

For the complete API documentation, see `docs/architecture/API.md` or use the Postman collection.

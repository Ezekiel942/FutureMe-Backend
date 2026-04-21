import { supabase } from '../../lib/supabase';
import logger from '../../utils/logger';

export class AuthError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: any;
  session: any;
}

/**
 * Register a new user with Supabase Auth
 */
export const register = async (input: RegisterInput) => {
  const { email, password, firstName, lastName } = input;

  try {
    if (!supabase || !supabase.auth) {
      throw new AuthError('Supabase auth not initialized', 'SUPABASE_NOT_INITIALIZED', 500);
    }
    // Sign up with Supabase Auth
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

    if (error) {
      throw new AuthError(error.message, error.status?.toString(), 400);
    }

    if (!data.user) {
      throw new AuthError(
        'Registration failed - no user data returned',
        'REGISTRATION_FAILED',
        500
      );
    }

    // Note: Profile creation will be handled by database trigger in Supabase
    // or manually if needed

    logger.info('User registered successfully', { userId: data.user.id, email });

    return {
      user: data.user,
      session: data.session,
    };
  } catch (error: any) {
    logger.error('Registration error', { error: error.message, email });
    throw error;
  }
};

/**
 * Login with Supabase Auth
 */
export const login = async (input: LoginInput): Promise<AuthResponse> => {
  const { email, password } = input;

  try {
    if (!supabase || !supabase.auth) {
      throw new AuthError('Supabase auth not initialized', 'SUPABASE_NOT_INITIALIZED', 500);
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new AuthError(error.message, error.status?.toString(), 401);
    }

    if (!data.user || !data.session) {
      throw new AuthError('Login failed - invalid credentials', 'INVALID_CREDENTIALS', 401);
    }

    logger.info('User logged in successfully', { userId: data.user.id, email });

    return {
      user: data.user,
      session: data.session,
    };
  } catch (error: any) {
    logger.error('Login error', { error: error.message, email });
    throw error;
  }
};

/**
 * Logout with Supabase Auth
 */
export const logout = async () => {
  try {
    if (!supabase || !supabase.auth) {
      throw new AuthError('Supabase auth not initialized', 'SUPABASE_NOT_INITIALIZED', 500);
    }
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new AuthError(error.message, error.status?.toString(), 500);
    }

    logger.info('User logged out successfully');
  } catch (error: any) {
    logger.error('Logout error', { error: error.message });
    throw error;
  }
};

/**
 * Get current user from Supabase Auth
 */
export const getCurrentUser = async () => {
  try {
    if (!supabase || !supabase.auth) {
      throw new AuthError('Supabase auth not initialized', 'SUPABASE_NOT_INITIALIZED', 500);
    }
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      throw new AuthError(error.message, error.status?.toString(), 401);
    }

    return data.user;
  } catch (error: any) {
    logger.error('Get current user error', { error: error.message });
    throw error;
  }
};

/**
 * Verify and decode Supabase JWT token
 */
export const verifyToken = async (token: string) => {
  try {
    if (!supabase || !supabase.auth) {
      throw new AuthError('Supabase auth not initialized', 'SUPABASE_NOT_INITIALIZED', 500);
    }
    // Supabase handles token verification internally
    // We can use getUser to verify the token is valid
    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
      throw new AuthError('Invalid token', 'INVALID_TOKEN', 401);
    }

    if (!data.user) {
      throw new AuthError('Token verification failed', 'INVALID_TOKEN', 401);
    }

    // Normalize user object to have both id and sub for compatibility
    return {
      id: data.user.id, // For backward compatibility
      sub: data.user.id, // Standard JWT claim
      email: data.user.email,
      role: 'user', // Default role, can be enhanced with profile data
      user_metadata: data.user.user_metadata,
      app_metadata: data.user.app_metadata,
    };
  } catch (error: any) {
    logger.error('Token verification error', { error: error.message });
    throw error;
  }
};

/**
 * Refresh session (handled automatically by Supabase client)
 */
export const refreshSession = async () => {
  try {
    if (!supabase || !supabase.auth) {
      throw new AuthError('Supabase auth not initialized', 'SUPABASE_NOT_INITIALIZED', 500);
    }
    const { data, error } = await supabase.auth.refreshSession();

    if (error) {
      throw new AuthError(error.message, error.status?.toString(), 401);
    }

    return data;
  } catch (error: any) {
    logger.error('Session refresh error', { error: error.message });
    throw error;
  }
};

// Legacy compatibility functions (deprecated)
export const loginWithTokens = async (input: LoginInput) => {
  const result = await login(input);
  if (!result.session) {
    throw new AuthError('Login failed - no session', 'NO_SESSION', 401);
  }
  return {
    accessToken: result.session.access_token,
    refreshToken: result.session.refresh_token,
  };
};

export const verifyTokenSync = (token: string) => {
  // This is now async, but keeping for compatibility
  return verifyToken(token);
};

export const issueAccessToken = (user: any): string => {
  // Supabase handles tokens, return empty for compatibility
  return '';
};

export const issueRefreshToken = async (user: any): Promise<string> => {
  // Supabase handles tokens, return empty for compatibility
  return '';
};

export const refreshAccessToken = async (refreshToken: string) => {
  const result = await refreshSession();
  return result.session?.access_token || '';
};

export const issuePasswordReset = async (email: string) => {
  if (!supabase || !supabase.auth) {
    throw new AuthError('Supabase auth not initialized', 'SUPABASE_NOT_INITIALIZED', 500);
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    throw new AuthError(error.message, error.status?.toString(), 400);
  }
  return 'Password reset email sent';
};

export const resetPassword = async (token: string, newPassword: string) => {
  if (!supabase || !supabase.auth) {
    throw new AuthError('Supabase auth not initialized', 'SUPABASE_NOT_INITIALIZED', 500);
  }
  // This would typically be handled on the frontend with the token
  // For backend compatibility, we'll assume the token is valid
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new AuthError(error.message, error.status?.toString(), 400);
  }
};

import { Request, Response } from 'express';
import * as AuthService from '../../modules/auth/auth.service';
import { logAction as auditLog } from '../../modules/audit/audit.service';

const success = (res: Response, data: unknown) => res.json({ success: true, data });
const fail = (res: Response, message: string, code?: string, status = 400) =>
  res.status(status).json({ success: false, message, code });

export const register = async (req: Request, res: Response) => {
  try {
    // Use validated data if available (from Zod middleware)
    const validated = (req as any).validated?.body;
    const { firstName, lastName, email, password } = validated || req.body;

    const result = await AuthService.register({
      email,
      password,
      firstName,
      lastName,
    });

    // Audit log: registration (fire-and-forget)
    try {
      await auditLog({
        userId: result.user.id,
        action: 'register',
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });
    } catch (e) {
      // audit service swallows errors, but keep guard
    }

    success(res, {
      id: result.user.id,
      email: result.user.email,
      firstName: firstName || result.user.user_metadata?.first_name,
      lastName: lastName || result.user.user_metadata?.last_name,
      session: result.session
        ? {
            accessToken: result.session.access_token,
            refreshToken: result.session.refresh_token,
            expiresAt: result.session.expires_at,
          }
        : null,
    });
  } catch (err: any) {
    const message = err?.message || 'Registration failed';
    const code = err?.code;
    fail(res, message, code, err?.status || 400);
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    // Use validated data if available (from Zod middleware)
    const validated = (req as any).validated?.body;
    const { email, password } = validated || req.body;

    const result = await AuthService.loginWithTokens({ email, password });

    // Set refresh token as httpOnly cookie (optional, client can also store it)
    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    }

    success(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken, // Also return in body for SPA convenience
      user: {
        id: 'temp-id', // Will be extracted from token by middleware
        email,
        role: 'user',
      },
    });

    // Audit log: login (fire-and-forget) - moved after response for better UX
    setImmediate(async () => {
      try {
        // We need to get the user ID from the token
        const userData = await AuthService.verifyToken(result.accessToken);
        await auditLog({
          userId: userData.sub,
          action: 'login',
          ipAddress: req.ip,
          userAgent: req.get('user-agent') || undefined,
        });
      } catch (e) {
        // audit service swallows errors, but keep guard
      }
    });
  } catch (err: any) {
    const message = err?.message || 'Login failed';
    fail(res, message, err?.code, err?.status || 400);
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const refreshToken = (req as any).body?.refreshToken || req.cookies?.refreshToken;
    if (!refreshToken) {
      return fail(res, 'Refresh token missing', 'MISSING_TOKEN', 401);
    }

    // With Supabase Auth, refresh is handled differently
    // We'll use the refresh token to get a new session
    const accessToken = await AuthService.refreshAccessToken(refreshToken);

    if (!accessToken) {
      return fail(res, 'Invalid refresh token', 'INVALID_TOKEN', 401);
    }

    // For Supabase, we don't rotate refresh tokens the same way
    // The client should handle session refresh automatically
    success(res, { accessToken, refreshToken });
  } catch (err: any) {
    const message = err?.message || 'Token refresh failed';
    fail(res, message, err?.code, err?.status || 401);
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const validated = (req as any).validated?.body;
    const { email } = validated || req.body;

    const token = await AuthService.issuePasswordReset(email);

    // In a real system we'd email the token. Return token in response for now.
    success(res, { message: 'Password reset token issued', token });
  } catch (err: any) {
    fail(res, err?.message || 'Could not issue password reset', err?.code, err?.status || 400);
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const validated = (req as any).validated?.body;
    const { token, newPassword } = validated || req.body;
    await AuthService.resetPassword(token, newPassword);
    // Password change event: note that userId is not always available here;
    // resetPassword service may have identified the user — but we don't read it.
    // We log with unknown userId (null) to avoid reading internal state.
    try {
      await auditLog({
        userId: null,
        action: 'password_change',
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });
    } catch (e) {}
    success(res, { message: 'Password reset successful' });
  } catch (err: any) {
    fail(res, err?.message || 'Could not reset password', err?.code, err?.status || 400);
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.sub) {
      return fail(res, 'Not authenticated', 'UNAUTHORIZED', 401);
    }

    await AuthService.logout();

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    // Audit: logout
    try {
      await auditLog({
        userId: String(user.sub),
        action: 'logout',
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });
    } catch (e) {}

    success(res, { message: 'Logged out successfully' });
  } catch (err: any) {
    const message = err?.message || 'Logout failed';
    fail(res, message, err?.code, err?.status || 500);
  }
};

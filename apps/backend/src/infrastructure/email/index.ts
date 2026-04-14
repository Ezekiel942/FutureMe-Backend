import { ResendProvider } from './providers/resend';
import logger from '../../utils/logger';
import { ENV } from '../../config/env';

class EmailService {
  private provider: ResendProvider | null = null;

  constructor() {
    // Only initialize if required environment variables are present
    if (ENV.RESEND_API_KEY && ENV.EMAIL_FROM) {
      this.provider = new ResendProvider();
      logger.info('Email service initialized with Resend provider');
    } else {
      logger.warn('Email service disabled: Missing RESEND_API_KEY or EMAIL_FROM');
    }
  }

  private ensureProvider(): ResendProvider {
    if (!this.provider) {
      throw new Error(
        'Email service is not configured. Please set RESEND_API_KEY and EMAIL_FROM environment variables.'
      );
    }
    return this.provider;
  }

  async sendVerificationEmail(email: string, token: string): Promise<boolean> {
    const verificationUrl = `${ENV.FRONTEND_URL}/verify-email?token=${token}`;

    const subject = 'Verify Your Email Address';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to FutureMe!</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">Verify Email</a>
        <p>If the button doesn't work, copy and paste this URL into your browser:</p>
        <p>${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create an account, please ignore this email.</p>
      </div>
    `;

    const text = `
      Welcome to FutureMe!

      Please verify your email address by visiting: ${verificationUrl}

      This link will expire in 24 hours.

      If you didn't create an account, please ignore this email.
    `;

    return this.ensureProvider().sendEmail(email, subject, html, text);
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    const resetUrl = `${ENV.FRONTEND_URL}/reset-password?token=${token}`;

    const subject = 'Reset Your Password';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your FutureMe account.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">Reset Password</a>
        <p>If the button doesn't work, copy and paste this URL into your browser:</p>
        <p>${resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this reset, please ignore this email.</p>
      </div>
    `;

    const text = `
      Password Reset Request

      You requested a password reset for your FutureMe account.

      Visit this URL to reset your password: ${resetUrl}

      This link will expire in 1 hour.

      If you didn't request this reset, please ignore this email.
    `;

    return this.ensureProvider().sendEmail(email, subject, html, text);
  }

  async sendInviteEmail(
    email: string,
    inviterName: string,
    organizationName: string,
    inviteToken: string
  ): Promise<boolean> {
    const acceptUrl = `${ENV.FRONTEND_URL}/accept-invite?token=${inviteToken}`;

    const subject = `You're invited to join ${organizationName} on FutureMe`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You're Invited!</h2>
        <p>${inviterName} has invited you to join ${organizationName} on FutureMe.</p>
        <p>Click the link below to accept the invitation:</p>
        <a href="${acceptUrl}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">Accept Invitation</a>
        <p>If the button doesn't work, copy and paste this URL into your browser:</p>
        <p>${acceptUrl}</p>
        <p>This invitation will expire in 7 days.</p>
      </div>
    `;

    const text = `
      You're Invited!

      ${inviterName} has invited you to join ${organizationName} on FutureMe.

      Accept the invitation: ${acceptUrl}

      This invitation will expire in 7 days.
    `;

    return this.ensureProvider().sendEmail(email, subject, html, text);
  }
}

export const emailService = new EmailService();
export default emailService;

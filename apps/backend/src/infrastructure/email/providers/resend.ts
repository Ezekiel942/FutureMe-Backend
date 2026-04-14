import { Resend } from 'resend';
import logger from '../../../utils/logger';
import { ENV } from '../../../config/env';

export class ResendProvider {
  private client: Resend;

  constructor() {
    this.client = new Resend(ENV.RESEND_API_KEY);
  }

  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    if (!ENV.EMAIL_FROM) {
      throw new Error('EMAIL_FROM is required to send email via Resend.');
    }

    try {
      const result = await this.client.emails.send({
        from: ENV.EMAIL_FROM,
        to,
        subject,
        html,
        text,
      });

      logger.info('Email sent successfully', {
        provider: 'resend',
        to,
        messageId: result.data?.id,
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to send email via Resend', {
        error: error.message,
        to,
        provider: 'resend',
      });
      return false;
    }
  }
}

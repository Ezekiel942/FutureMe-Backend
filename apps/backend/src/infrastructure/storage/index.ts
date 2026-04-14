import { S3StorageProvider } from './providers/s3';
import { User } from '../../database/models/User.model';
import { AppDataSource } from '../../config/database';
import logger from '../../utils/logger';
import { ENV } from '../../config/env';

class StorageService {
  private provider: S3StorageProvider | null = null;

  constructor() {
    // Only initialize if required AWS environment variables are present
    if (ENV.AWS_ACCESS_KEY_ID && ENV.AWS_SECRET_ACCESS_KEY && ENV.AWS_REGION && ENV.AWS_S3_BUCKET) {
      this.provider = new S3StorageProvider();
      logger.info('Storage service initialized with S3 provider');
    } else {
      logger.warn(
        'Storage service disabled: Missing AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET)'
      );
    }
  }

  private ensureProvider(): S3StorageProvider {
    if (!this.provider) {
      throw new Error(
        'Storage service is not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and AWS_S3_BUCKET environment variables.'
      );
    }
    return this.provider;
  }

  async uploadAvatar(
    userId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<string> {
    try {
      // Validate file type
      if (!mimeType.startsWith('image/')) {
        throw new Error('Only image files are allowed');
      }

      // Validate file size (max 5MB)
      if (fileBuffer.length > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB');
      }

      // Upload to S3
      const avatarUrl = await this.ensureProvider().uploadFile(fileBuffer, fileName, mimeType);

      // Update user record
      const userRepo = AppDataSource.getRepository(User);
      await userRepo.update({ id: userId }, { avatarUrl });

      logger.info('Avatar uploaded successfully', {
        userId,
        avatarUrl,
      });

      return avatarUrl;
    } catch (error: any) {
      logger.error('Failed to upload avatar', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  async deleteAvatar(userId: string): Promise<boolean> {
    try {
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { id: userId } });

      if (!user || !user.avatarUrl) {
        return true; // Nothing to delete
      }

      // Delete from S3
      const deleted = await this.ensureProvider().deleteFile(user.avatarUrl);

      if (deleted) {
        // Update user record
        await userRepo.update(userId, { avatarUrl: null });
        logger.info('Avatar deleted successfully', { userId });
      }

      return deleted;
    } catch (error: any) {
      logger.error('Failed to delete avatar', {
        error: error.message,
        userId,
      });
      return false;
    }
  }

  async getAvatarUrl(userId: string): Promise<string | null> {
    try {
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { id: userId } });

      return user?.avatarUrl || null;
    } catch (error: any) {
      logger.error('Failed to get avatar URL', {
        error: error.message,
        userId,
      });
      return null;
    }
  }
}

export const storageService = new StorageService();
export default storageService;

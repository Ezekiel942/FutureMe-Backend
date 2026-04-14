import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import logger from '../../../utils/logger';
import { ENV } from '../../../config/env';

export class S3StorageProvider {
  private s3Client: S3Client;
  private bucket: string;
  private region: string;

  constructor() {
    const missing = [];
    if (!ENV.AWS_REGION) missing.push('AWS_REGION');
    if (!ENV.AWS_S3_BUCKET) missing.push('AWS_S3_BUCKET');
    if (!ENV.AWS_ACCESS_KEY_ID) missing.push('AWS_ACCESS_KEY_ID');
    if (!ENV.AWS_SECRET_ACCESS_KEY) missing.push('AWS_SECRET_ACCESS_KEY');

    if (missing.length > 0) {
      throw new Error(
        `S3 configuration missing required environment variables: ${missing.join(', ')}`
      );
    }

    const awsRegion = ENV.AWS_REGION as string;
    const awsBucket = ENV.AWS_S3_BUCKET as string;
    const awsAccessKeyId = ENV.AWS_ACCESS_KEY_ID as string;
    const awsSecretAccessKey = ENV.AWS_SECRET_ACCESS_KEY as string;

    this.region = awsRegion;
    this.bucket = awsBucket;

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    });
  }

  async uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    try {
      const key = `avatars/${Date.now()}-${fileName}`;

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
        ACL: 'public-read', // Make avatars publicly accessible
      });

      await this.s3Client.send(command);

      const publicUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

      logger.info('File uploaded to S3 successfully', {
        provider: 's3',
        key,
        publicUrl,
      });

      return publicUrl;
    } catch (error: any) {
      logger.error('Failed to upload file to S3', {
        error: error.message,
        fileName,
        provider: 's3',
      });
      throw new Error('Failed to upload file');
    }
  }

  async deleteFile(url: string): Promise<boolean> {
    try {
      // Extract key from URL
      const urlParts = url.split('/');
      const key = urlParts.slice(-2).join('/'); // Get 'avatars/filename' part

      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);

      logger.info('File deleted from S3 successfully', {
        provider: 's3',
        key,
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to delete file from S3', {
        error: error.message,
        url,
        provider: 's3',
      });
      return false;
    }
  }

  getPublicUrl(key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}

import { supabase } from '../../lib/supabase';
import logger from '../../utils/logger';

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface UploadOptions {
  bucket?: string;
  maxSize?: number; // in bytes
  allowedTypes?: string[];
}

/**
 * Upload service for handling file uploads to Supabase Storage
 */
export class UploadService {
  private readonly defaultBucket = 'uploads';
  private readonly defaultMaxSize = 5 * 1024 * 1024; // 5MB
  private readonly defaultAllowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];

  /**
   * Upload a file to Supabase Storage
   */
  async uploadFile(file: Express.Multer.File, options: UploadOptions = {}): Promise<UploadResult> {
    try {
      const {
        bucket = this.defaultBucket,
        maxSize = this.defaultMaxSize,
        allowedTypes = this.defaultAllowedTypes,
      } = options;

      // Validate file size
      if (file.size > maxSize) {
        return {
          success: false,
          error: `File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`,
        };
      }

      // Validate file type
      if (!allowedTypes.includes(file.mimetype)) {
        return {
          success: false,
          error: `File type ${file.mimetype} not allowed. Allowed types: ${allowedTypes.join(', ')}`,
        };
      }

      // Generate unique filename
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage.from(bucket).upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

      if (error) {
        logger.error('Supabase storage upload error', { error: error.message });
        return {
          success: false,
          error: `Upload failed: ${error.message}`,
        };
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);

      if (!urlData.publicUrl) {
        logger.error('Failed to get public URL for uploaded file', { path: data.path });
        return {
          success: false,
          error: 'Failed to generate public URL',
        };
      }

      logger.info('File uploaded successfully', {
        fileName: file.originalname,
        size: file.size,
        type: file.mimetype,
        bucket,
        path: data.path,
        url: urlData.publicUrl,
      });

      return {
        success: true,
        url: urlData.publicUrl,
      };
    } catch (error) {
      logger.error('Upload service error', {
        error: error instanceof Error ? error.message : String(error),
        fileName: file.originalname,
        fileSize: file.size,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown upload error',
      };
    }
  }

  /**
   * Delete a file from Supabase Storage
   */
  async deleteFile(bucket: string, fileName: string): Promise<boolean> {
    try {
      const { error } = await supabase.storage.from(bucket).remove([fileName]);

      if (error) {
        logger.error('Failed to delete file from storage', {
          error: error.message,
          bucket,
          fileName,
        });
        return false;
      }

      logger.info('File deleted successfully', { bucket, fileName });
      return true;
    } catch (error) {
      logger.error('Delete file error', {
        error: error instanceof Error ? error.message : String(error),
        bucket,
        fileName,
      });
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getFileInfo(bucket: string, fileName: string) {
    try {
      const { data, error } = await supabase.storage.from(bucket).list('', {
        search: fileName,
      });

      if (error) {
        logger.error('Failed to get file info', { error: error.message });
        return null;
      }

      return data?.find((file: any) => file.name === fileName) || null;
    } catch (error) {
      logger.error('Get file info error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}

// Export singleton instance
export const uploadService = new UploadService();

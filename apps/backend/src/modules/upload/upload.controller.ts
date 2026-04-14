import { Request, Response } from 'express';
import { uploadService, UploadResult } from './upload.service';
import { logAction as auditLog } from '../audit/audit.service';

const success = (res: Response, data: unknown) => res.json({ success: true, data });
const fail = (res: Response, message: string, code?: string, status = 400) =>
  res.status(status).json({ success: false, message, code });

/**
 * POST /api/upload
 * Upload a file to Supabase Storage
 */
export const uploadFile = async (req: Request, res: Response) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    // Check if file was uploaded
    if (!req.file) {
      return fail(res, 'No file uploaded', 'NO_FILE', 400);
    }

    const user = req.user;
    const file = req.file;

    // Upload file using service
    const result: UploadResult = await uploadService.uploadFile(file);

    if (!result.success) {
      return fail(res, result.error || 'Upload failed', 'UPLOAD_FAILED', 400);
    }

    // Audit log the upload
    try {
      await auditLog({
        userId: user.sub || user.id,
        action: 'file_upload',
        targetId: result.url,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });
    } catch (auditError) {
      // Log audit error but don't fail the upload
      console.warn('Failed to audit file upload:', auditError);
    }

    // Return success response
    success(res, {
      url: result.url,
      fileName: file.originalname,
      size: file.size,
      type: file.mimetype,
    });
  } catch (error: any) {
    console.error('Upload controller error:', error);
    fail(res, error?.message || 'Upload failed', error?.code, error?.status || 500);
  }
};

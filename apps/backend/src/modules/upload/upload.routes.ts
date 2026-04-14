import { Router } from 'express';
import multer from 'multer';
import { uploadFile } from './upload.controller';
import { extractAuthToken } from '../../api/middlewares/auth.middleware';

const router = Router();

// Configure multer for memory storage (no temp files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only specific file types
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `File type ${file.mimetype} not allowed. Allowed types: ${allowedTypes.join(', ')}`
        )
      );
    }
  },
});

/**
 * POST /api/upload
 * Upload a file (images: jpg, png; documents: pdf)
 * Max size: 5MB
 * Requires authentication
 */
router.post('/', extractAuthToken, upload.single('file'), uploadFile);

export default router;

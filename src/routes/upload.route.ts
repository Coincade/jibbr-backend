import express, { Request, Response, RequestHandler } from 'express';
import multer from 'multer';
import { uploadToSpaces } from '../config/upload.js';
import authMiddleware from '../middleware/Auth.middleware.js';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Max 5 files
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  }
});

/**
 * Upload files and return file references
 * POST /api/upload/files
 */
const uploadFiles = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.files || req.files.length === 0) {
      res.status(400).json({
        message: 'No files provided',
        errors: { files: 'At least one file is required' }
      });
      return;
    }

    const files = req.files as Express.Multer.File[];
    const uploadedFiles = [];

    // Upload each file to Digital Ocean Spaces
    for (const file of files) {
      try {
        const fileUrl = await uploadToSpaces(file);
        const fileId = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
        
        uploadedFiles.push({
          id: fileId,
          filename: file.originalname,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: fileUrl,
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({
          message: 'Failed to upload files',
          errors: { upload: 'File upload failed' }
        });
        return;
      }
    }

    res.status(200).json({
      message: 'Files uploaded successfully',
      data: {
        files: uploadedFiles
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      message: 'Upload failed',
      errors: { upload: 'Internal server error' }
    });
  }
};

/**
 * Get upload progress (for future implementation)
 * GET /api/upload/progress/:uploadId
 */
const getUploadProgress = (req: Request, res: Response): void => {
  // This could be implemented with Redis or similar for tracking upload progress
  res.status(200).json({
    message: 'Upload progress',
    data: {
      uploadId: req.params.uploadId,
      progress: 100, // Placeholder
      status: 'completed'
    }
  });
};

router.post('/files', 
  authMiddleware as unknown as RequestHandler, 
  upload.array('files', 5) as unknown as RequestHandler, 
  uploadFiles as unknown as RequestHandler
);

router.get('/progress/:uploadId', 
  authMiddleware as unknown as RequestHandler, 
  getUploadProgress as unknown as RequestHandler
);

export default router; 
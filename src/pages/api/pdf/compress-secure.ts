import formidable from 'formidable';
import fs from 'fs/promises';
import type {
  NextApiRequest,
  NextApiResponse,
} from 'next';
import path from 'path';

import { authHelpers } from '@/lib/auth-supabase';
import { pdfService } from '@/lib/pdf-service-enhanced';
import {
  validators,
  withAuth,
} from '@/middleware/auth.middleware';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Input validation schema
interface CompressRequest {
  quality?: 'low' | 'medium' | 'high';
  removeImages?: boolean;
}

// Sanitize and validate input
function validateCompressRequest(fields: any): { valid: boolean; data?: CompressRequest; errors?: string[] } {
  const errors: string[] = [];
  const data: CompressRequest = {};

  // Validate quality
  if (fields.quality) {
    const quality = Array.isArray(fields.quality) ? fields.quality[0] : fields.quality;
    if (!['low', 'medium', 'high'].includes(quality)) {
      errors.push('Invalid quality setting');
    } else {
      data.quality = quality as 'low' | 'medium' | 'high';
    }
  }

  // Validate removeImages
  if (fields.removeImages) {
    const removeImages = Array.isArray(fields.removeImages) ? fields.removeImages[0] : fields.removeImages;
    if (removeImages === 'true' || removeImages === 'false') {
      data.removeImages = removeImages === 'true';
    } else {
      errors.push('Invalid removeImages setting');
    }
  }

  return {
    valid: errors.length === 0,
    data: errors.length === 0 ? data : undefined,
    errors: errors.length > 0 ? errors : undefined
  };
}

// Secure file validation
async function validateUploadedFile(file: formidable.File): Promise<{ valid: boolean; error?: string }> {
  try {
    // Check file size (already handled by formidable, but double-check)
    if (file.size > 100 * 1024 * 1024) { // 100MB
      return { valid: false, error: 'File too large' };
    }

    // Check file extension
    const ext = path.extname(file.originalFilename || '').toLowerCase();
    if (ext !== '.pdf') {
      return { valid: false, error: 'Only PDF files are allowed' };
    }

    // Check MIME type
    if (file.mimetype !== 'application/pdf') {
      return { valid: false, error: 'Invalid file type' };
    }

    // Validate filename
    if (file.originalFilename && !validators.filename(file.originalFilename.replace(/[^a-zA-Z0-9._-]/g, ''))) {
      return { valid: false, error: 'Invalid filename' };
    }

    // Read first few bytes to verify PDF signature
    const buffer = await fs.readFile(file.filepath);
    const pdfSignature = buffer.subarray(0, 4);
    if (!pdfSignature.equals(Buffer.from([0x25, 0x50, 0x44, 0x46]))) { // %PDF
      return { valid: false, error: 'Invalid PDF file' };
    }

    return { valid: true };
  } catch (error) {
    console.error('File validation error:', error);
    return { valid: false, error: 'File validation failed' };
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Generate request ID for tracking
  const requestId = (req as any).requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Start performance timing
  const performanceLabel = `pdf_compress_${requestId}`;
  const startTime = Date.now();

  let tempFilePath: string | null = null;

  try {
    // Get authenticated user
    const user = (req as any).user;
    if (!user?.id) {
      throw new Error('Authentication required'); // Will be caught by error middleware
    }

    // Check user credits
    const hasCredits = await authHelpers.hasCredits(user.id, 1);
    if (!hasCredits) {
      const error = new Error('Insufficient credits');
      (error as any).code = 'INSUFFICIENT_CREDITS';
      (error as any).statusCode = 403;
      throw error;
    }

    // Parse form data with security limits
    const form = formidable({
      maxFileSize: 100 * 1024 * 1024, // 100MB
      maxFields: 10,
      maxFieldsSize: 1024, // 1KB for fields
      keepExtensions: true,
      allowEmptyFiles: false,
      filter: ({ name, originalFilename, mimetype }) => {
        // Only allow specific field names
        const allowedFields = ['file', 'quality', 'removeImages'];
        if (name && !allowedFields.includes(name)) {
          return false;
        }

        // For file uploads, validate MIME type
        if (name === 'file' && mimetype !== 'application/pdf') {
          return false;
        }

        return true;
      }
    });

    const [fields, files] = await form.parse(req);

    // Validate file upload
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) {
      return res.status(400).json({
        error: 'No file provided',
        code: 'NO_FILE'
      });
    }

    tempFilePath = file.filepath;

    // Validate uploaded file
    const fileValidation = await validateUploadedFile(file);
    if (!fileValidation.valid) {
      return res.status(400).json({
        error: fileValidation.error,
        code: 'INVALID_FILE'
      });
    }

    // Validate user's file size limit
    const canUpload = await authHelpers.validateFileSize(user.id, file.size);
    if (!canUpload) {
      return res.status(403).json({
        error: 'File size exceeds plan limit',
        code: 'FILE_SIZE_LIMIT'
      });
    }

    // Validate and sanitize request parameters
    const validation = validateCompressRequest(fields);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: validation.errors,
        code: 'INVALID_PARAMS'
      });
    }

    // Read file buffer
    const fileBuffer = await fs.readFile(file.filepath);

    // Process the file using the enhanced service
    const result = await pdfService.processFile(
      user.id,
      fileBuffer,
      file.originalFilename || 'document.pdf',
      'compress',
      validation.data
    );

    // Clean up temp file
    await fs.unlink(file.filepath).catch(() => {});
    tempFilePath = null;

    if (!result.success) {
      return res.status(500).json({
        error: result.error || 'Compression failed',
        code: 'PROCESSING_FAILED'
      });
    }

    // Log successful operation
    const processingTime = Date.now() - startTime;
    console.log(`Compression successful for user ${user.id}: ${processingTime}ms`);

    // Return success response (no sensitive data)
    return res.status(200).json({
      success: true,
      fileId: result.fileId,
      downloadUrl: result.downloadUrl,
      originalSize: result.originalSize,
      compressedSize: result.processedSize,
      compressionRatio: result.compressionRatio,
      processingTime: result.processingTime,
    });

  } catch (error) {
    // Clean up temp file on error
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(() => {});
    }

    console.error('Compression endpoint error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: (req as any).user?.id,
      timestamp: new Date().toISOString()
    });

    // Don't leak internal error details
    if (error instanceof Error) {
      if (error.message.includes('ENOSPC')) {
        return res.status(507).json({
          error: 'Insufficient storage space',
          code: 'STORAGE_FULL'
        });
      }

      if (error.message.includes('timeout')) {
        return res.status(408).json({
          error: 'Processing timeout',
          code: 'TIMEOUT'
        });
      }
    }

    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}

// Export with enhanced middleware stack
export default function enhancedHandler(req: NextApiRequest, res: NextApiResponse) {
  // Apply error handling wrapper
  const errorHandler = (error: any) => {
    // Enhanced error response
    const requestId = (req as any).requestId || `req_${Date.now()}`;
    const statusCode = error.statusCode || 500;

    console.error(`API Error [${requestId}]:`, {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      timestamp: new Date().toISOString(),
    });

    res.status(statusCode).json({
      status: 'error',
      error: process.env.NODE_ENV === 'production' && statusCode >= 500
        ? 'Something went wrong'
        : error.message,
      code: error.code || 'INTERNAL_ERROR',
      requestId,
      timestamp: new Date().toISOString(),
    });
  };

  // Apply middleware stack
  const authHandler = withAuth(async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      await handler(req, res);
    } catch (error) {
      errorHandler(error);
    }
  }, {
    requireAuth: true,
    requireSubscription: false,
    rateLimitType: 'processing',
    validateCSRF: true,
    allowedMethods: ['POST']
  });

  return authHandler(req, res);
}

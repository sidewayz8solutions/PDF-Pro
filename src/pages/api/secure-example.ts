import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/middleware/auth.middleware';
import { withErrorHandling, createError } from '@/middleware/error.middleware';
import { validateRequest, schemas } from '@/lib/validation';
import { securityConfig, securityUtils } from '@/config/security';
import { z } from 'zod';

// Request schema validation
const requestSchema = z.object({
  operation: schemas.operationType,
  filename: schemas.filename.optional(),
  options: z.object({
    quality: schemas.quality.optional(),
    removeImages: z.boolean().optional(),
  }).optional(),
});

type SecureExampleRequest = z.infer<typeof requestSchema>;

// Response type
interface SecureExampleResponse {
  success: boolean;
  message: string;
  data?: any;
  timestamp: string;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SecureExampleResponse>
) {
  // Get authenticated user (added by withAuth middleware)
  const user = (req as any).user;
  
  try {
    // 1. Input validation
    const validation = validateRequest(requestSchema)(req.body);
    if (!validation.success) {
      throw createError.validation.input(validation.errors);
    }

    const { operation, filename, options } = validation.data;

    // 2. Business logic validation
    if (operation === 'compress' && !filename) {
      throw createError.validation.input(['Filename required for compression']);
    }

    // 3. Security checks
    if (filename) {
      const sanitizedFilename = securityUtils.sanitizeFilename(filename);
      if (sanitizedFilename !== filename) {
        throw createError.validation.file('Filename contains invalid characters');
      }
    }

    // 4. Rate limiting check (handled by middleware, but can add custom logic)
    const userAgent = req.headers['user-agent'] || '';
    if (userAgent.length < 10) {
      throw createError.validation.input(['Invalid user agent']);
    }

    // 5. Business logic
    const result = await processSecureOperation(user.id, operation, options);

    // 6. Audit logging
    console.log(`Secure operation completed`, {
      userId: user.id,
      operation,
      timestamp: new Date().toISOString(),
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    // 7. Success response
    return res.status(200).json({
      success: true,
      message: 'Operation completed successfully',
      data: {
        operationId: result.id,
        status: result.status,
        // Don't expose sensitive internal data
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    // Error handling is done by withErrorHandling middleware
    throw error;
  }
}

// Mock business logic function
async function processSecureOperation(
  userId: string,
  operation: string,
  options?: any
): Promise<{ id: string; status: string }> {
  // Simulate processing
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    id: securityUtils.generateSecureToken(16),
    status: 'completed',
  };
}

// Export with all security middleware
export default withErrorHandling(
  withAuth(handler, {
    requireAuth: true,
    requireSubscription: false,
    rateLimitType: 'processing',
    validateCSRF: true,
    allowedMethods: ['POST'],
  })
);

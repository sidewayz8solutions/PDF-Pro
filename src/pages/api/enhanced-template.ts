import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '@/middleware/auth.middleware';
import { withErrorHandling, createError, AppError } from '@/middleware/error.middleware';
import { validateRequest, schemas } from '@/lib/validation';
import { PerformanceTimer } from '@/lib/performance';
import { database } from '@/lib/database';
import { cache } from '@/lib/cache';
import { z } from 'zod';

// Request/Response schemas
const requestSchema = z.object({
  operation: z.enum(['example', 'test']),
  data: z.object({
    name: z.string().min(1).max(100),
    value: z.number().optional(),
  }),
});

const responseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  message: z.string(),
  requestId: z.string(),
  timestamp: z.string(),
  performance: z.object({
    duration: z.number(),
    cached: z.boolean(),
  }).optional(),
});

type EnhancedRequest = z.infer<typeof requestSchema>;
type EnhancedResponse = z.infer<typeof responseSchema>;

// Main handler function
async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EnhancedResponse>
) {
  // Generate request ID for tracking
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  (req as any).requestId = requestId;

  // Start performance timing
  PerformanceTimer.start(`api_${requestId}`);

  try {
    // Get authenticated user (added by withAuth middleware)
    const user = (req as any).user;
    
    // 1. Input validation
    const validation = validateRequest(requestSchema)(req.body);
    if (!validation.success) {
      throw createError.validation.input(validation.errors, requestId);
    }

    const { operation, data } = validation.data;

    // 2. Check cache first
    const cacheKey = `api:enhanced:${user.id}:${operation}:${JSON.stringify(data)}`;
    let result = await cache.get(cacheKey);
    let fromCache = false;

    if (result) {
      fromCache = true;
    } else {
      // 3. Business logic
      result = await processOperation(user.id, operation, data, requestId);
      
      // 4. Cache the result (5 minutes)
      await cache.set(cacheKey, result, 300);
    }

    // 5. Performance measurement
    const duration = PerformanceTimer.end(`api_${requestId}`, {
      operation,
      userId: user.id,
      cached: fromCache,
    });

    // 6. Audit logging
    await logApiUsage(user.id, operation, duration, true, requestId);

    // 7. Success response
    const response: EnhancedResponse = {
      success: true,
      data: result,
      message: 'Operation completed successfully',
      requestId,
      timestamp: new Date().toISOString(),
      performance: {
        duration,
        cached: fromCache,
      },
    };

    // Validate response schema in development
    if (process.env.NODE_ENV === 'development') {
      const responseValidation = responseSchema.safeParse(response);
      if (!responseValidation.success) {
        console.warn('Response schema validation failed:', responseValidation.error);
      }
    }

    return res.status(200).json(response);

  } catch (error) {
    // Performance measurement for errors
    const duration = PerformanceTimer.end(`api_${requestId}`, {
      error: true,
      errorType: error instanceof AppError ? error.code : 'unknown',
    });

    // Audit logging for errors
    const user = (req as any).user;
    if (user) {
      await logApiUsage(user.id, 'unknown', duration, false, requestId, 
        error instanceof Error ? error.message : 'Unknown error');
    }

    // Re-throw for error middleware to handle
    throw error;
  }
}

// Business logic function
async function processOperation(
  userId: string,
  operation: string,
  data: any,
  requestId: string
): Promise<any> {
  switch (operation) {
    case 'example':
      return await handleExampleOperation(userId, data, requestId);
    
    case 'test':
      return await handleTestOperation(userId, data, requestId);
    
    default:
      throw createError.validation.input(`Unknown operation: ${operation}`, requestId);
  }
}

// Example operation handler
async function handleExampleOperation(
  userId: string,
  data: any,
  requestId: string
): Promise<any> {
  try {
    // Database operation with monitoring
    const result = await database.executeQuery(
      async () => {
        const { data: userData, error } = await database.getClient()
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) throw error;
        return userData;
      },
      'get_user_for_example'
    );

    // Simulate some processing
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      user: result,
      processedData: {
        ...data,
        processed: true,
        processedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error(`Example operation failed for user ${userId}:`, error);
    throw createError.business.processing('Example operation failed', requestId);
  }
}

// Test operation handler
async function handleTestOperation(
  userId: string,
  data: any,
  requestId: string
): Promise<any> {
  // Simple test operation
  return {
    test: true,
    data,
    userId,
    timestamp: new Date().toISOString(),
  };
}

// Audit logging function
async function logApiUsage(
  userId: string,
  operation: string,
  duration: number,
  success: boolean,
  requestId: string,
  errorMessage?: string
): Promise<void> {
  try {
    await database.executeQuery(
      async () => {
        const { error } = await database.getClient()
          .from('usage_records')
          .insert({
            user_id: userId,
            operation_type: operation,
            processing_time: duration,
            success,
            error_message: errorMessage,
            file_size: 0, // Not applicable for this API
            credits_used: success ? 1 : 0,
            created_at: new Date().toISOString(),
          });

        if (error) throw error;
      },
      'log_api_usage'
    );
  } catch (error) {
    // Don't fail the main operation if logging fails
    console.error('Failed to log API usage:', error);
  }
}

// Rate limiting configuration for this endpoint
const rateLimitConfig = {
  requireAuth: true,
  requireSubscription: false,
  rateLimitType: 'general' as const,
  validateCSRF: false, // Set to true for state-changing operations
  allowedMethods: ['POST'],
};

// Export with all middleware
export default withErrorHandling(
  withAuth(handler, rateLimitConfig)
);

// Export types for reuse
export type { EnhancedRequest, EnhancedResponse };

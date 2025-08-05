import {
  NextApiRequest,
  NextApiResponse,
} from 'next';
import { ZodError } from 'zod';

// Error types and codes
export enum ErrorCode {
  // Authentication errors
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Validation errors
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_FILE = 'INVALID_FILE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  
  // Business logic errors
  INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS',
  SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  
  // System errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  STORAGE_FULL = 'STORAGE_FULL',
  TIMEOUT = 'TIMEOUT',
}

// Enhanced custom error class
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly isOperational: boolean;
  public readonly timestamp: string;
  public readonly requestId?: string;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 500,
    details?: any,
    isOperational: boolean = true,
    requestId?: string
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    this.requestId = requestId;

    // Maintain proper stack trace
    Error.captureStackTrace(this, AppError);
  }
}

// Legacy alias for backward compatibility
export class APIError extends AppError {
  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 500,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message, code, statusCode, details, isOperational);
    this.name = 'APIError';
  }
}

// Predefined error creators
export const createError = {
  auth: {
    required: (requestId?: string) => new AppError('Authentication required', ErrorCode.AUTH_REQUIRED, 401, undefined, true, requestId),
    invalid: (requestId?: string) => new AppError('Invalid credentials', ErrorCode.INVALID_CREDENTIALS, 401, undefined, true, requestId),
    expired: (requestId?: string) => new AppError('Token expired', ErrorCode.TOKEN_EXPIRED, 401, undefined, true, requestId),
    permissions: (requestId?: string) => new AppError('Insufficient permissions', ErrorCode.INSUFFICIENT_PERMISSIONS, 403, undefined, true, requestId),
  },

  validation: {
    input: (details?: any, requestId?: string) => new AppError('Invalid input', ErrorCode.INVALID_INPUT, 400, details, true, requestId),
    file: (message: string = 'Invalid file', requestId?: string) => new AppError(message, ErrorCode.INVALID_FILE, 400, undefined, true, requestId),
    fileSize: (requestId?: string) => new AppError('File too large', ErrorCode.FILE_TOO_LARGE, 413, undefined, true, requestId),
    format: (requestId?: string) => new AppError('Unsupported file format', ErrorCode.UNSUPPORTED_FORMAT, 415, undefined, true, requestId),
  },

  rateLimit: {
    exceeded: (requestId?: string) => new AppError('Rate limit exceeded', ErrorCode.RATE_LIMIT_EXCEEDED, 429, undefined, true, requestId),
    tooMany: (requestId?: string) => new AppError('Too many requests', ErrorCode.TOO_MANY_REQUESTS, 429, undefined, true, requestId),
  },

  business: {
    credits: (requestId?: string) => new AppError('Insufficient credits', ErrorCode.INSUFFICIENT_CREDITS, 403, undefined, true, requestId),
    subscription: (requestId?: string) => new AppError('Active subscription required', ErrorCode.SUBSCRIPTION_REQUIRED, 403, undefined, true, requestId),
    processing: (message: string = 'Processing failed', requestId?: string) => new AppError(message, ErrorCode.PROCESSING_FAILED, 500, undefined, true, requestId),
    notFound: (requestId?: string) => new AppError('File not found', ErrorCode.FILE_NOT_FOUND, 404, undefined, true, requestId),
  },

  system: {
    internal: (requestId?: string) => new AppError('Internal server error', ErrorCode.INTERNAL_ERROR, 500, undefined, false, requestId),
    unavailable: (requestId?: string) => new AppError('Service temporarily unavailable', ErrorCode.SERVICE_UNAVAILABLE, 503, undefined, false, requestId),
    storage: (requestId?: string) => new AppError('Storage full', ErrorCode.STORAGE_FULL, 507, undefined, false, requestId),
    timeout: (requestId?: string) => new AppError('Request timeout', ErrorCode.TIMEOUT, 408, undefined, true, requestId),
  },
};

// Error logging utility
export class ErrorLogger {
  private static shouldLog(error: any): boolean {
    // Don't log client errors (4xx) except authentication issues
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return error.statusCode === 401 || error.statusCode === 403;
    }
    return true;
  }

  private static sanitizeError(error: any): any {
    const sanitized: any = {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      timestamp: new Date().toISOString(),
    };

    // Only include stack trace in development
    if (process.env.NODE_ENV === 'development') {
      sanitized.stack = error.stack;
    }

    // Include request ID if available
    if (error.requestId) {
      sanitized.requestId = error.requestId;
    }

    return sanitized;
  }

  public static log(error: any, req?: NextApiRequest): void {
    if (!this.shouldLog(error)) {
      return;
    }

    const sanitizedError = this.sanitizeError(error);
    
    // Add request context
    if (req) {
      sanitizedError.request = {
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userId: (req as any).user?.id,
      };
    }

    // Log to console (in production, you'd send to logging service)
    console.error('API Error:', JSON.stringify(sanitizedError, null, 2));

    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to Sentry, DataDog, etc.
      // sentryLogger.captureException(error, { extra: sanitizedError });
    }
  }
}

// Error response formatter
export function formatErrorResponse(error: any): {
  error: string;
  code: string;
  details?: any;
  timestamp: string;
} {
  // Default error response
  let response = {
    error: 'Internal server error',
    code: ErrorCode.INTERNAL_ERROR,
    timestamp: new Date().toISOString(),
  };

  if (error instanceof APIError) {
    response.error = error.message;
    response.code = error.code;
    
    // Only include details in development or for client errors
    if (process.env.NODE_ENV === 'development' || error.statusCode < 500) {
      if (error.details) {
        (response as any).details = error.details;
      }
    }
  } else if (error instanceof ZodError) {
    response.error = 'Validation failed';
    response.code = ErrorCode.INVALID_INPUT;
    (response as any).details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
    }));
  } else if (error.name === 'ValidationError') {
    response.error = 'Validation failed';
    response.code = ErrorCode.INVALID_INPUT;
  } else if (error.code === 'ENOSPC') {
    response.error = 'Storage full';
    response.code = ErrorCode.STORAGE_FULL;
  } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
    response.error = 'Request timeout';
    response.code = ErrorCode.TIMEOUT;
  }

  return response;
}

// Enhanced global error handler
export function errorHandler(
  error: any,
  req: NextApiRequest,
  res: NextApiResponse
): void {
  // Generate request ID if not present
  const requestId = (req as any).requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Log the error with enhanced context
  ErrorLogger.log(error, req);

  // Determine status code
  let statusCode = 500;
  if (error instanceof AppError || error instanceof APIError) {
    statusCode = error.statusCode;
  } else if (error instanceof ZodError) {
    statusCode = 400;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
  } else if (error.code === 'ENOSPC') {
    statusCode = 507;
  } else if (error.code === 'ETIMEDOUT') {
    statusCode = 408;
  }

  // Enhanced error response
  const errorResponse = {
    status: 'error',
    message: process.env.NODE_ENV === 'production' && statusCode >= 500
      ? 'Something went wrong'
      : error.message || 'An error occurred',
    code: error.code || ErrorCode.INTERNAL_ERROR,
    requestId,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      details: error.details,
    }),
  };

  // Send response
  res.status(statusCode).json(errorResponse);
}

// Async error wrapper for API handlers
export function asyncHandler(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      await handler(req, res);
    } catch (error) {
      errorHandler(error, req, res);
    }
  };
}

// Error boundary for API routes
export function withErrorHandling(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      await handler(req, res);
    } catch (error) {
      errorHandler(error, req, res);
    }
  };
}

// Validation error helper
export function throwValidationError(message: string, details?: any): never {
  throw new APIError(message, ErrorCode.INVALID_INPUT, 400, details);
}

// Business logic error helpers
export function throwIfInsufficientCredits(hasCredits: boolean): void {
  if (!hasCredits) {
    throw createError.business.credits();
  }
}

export function throwIfInvalidFile(isValid: boolean, message?: string): void {
  if (!isValid) {
    throw createError.validation.file(message);
  }
}

export function throwIfNotFound(exists: boolean): void {
  if (!exists) {
    throw createError.business.notFound();
  }
}

// Rate limit error helper
export function throwRateLimitError(): never {
  throw createError.rateLimit.exceeded();
}

// Export all utilities
export default {
  APIError,
  createError,
  ErrorLogger,
  formatErrorResponse,
  errorHandler,
  asyncHandler,
  withErrorHandling,
  throwValidationError,
  throwIfInsufficientCredits,
  throwIfInvalidFile,
  throwIfNotFound,
  throwRateLimitError,
};

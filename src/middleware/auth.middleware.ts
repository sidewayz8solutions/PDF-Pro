import {
  createHash,
  timingSafeEqual,
} from 'crypto';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import {
  NextApiRequest,
  NextApiResponse,
} from 'next';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth-supabase';
import { supabaseHelpers } from '@/lib/supabase';

// Enhanced rate limiting configuration
const createRateLimiter = (windowMs: number, max: number, message?: string) => rateLimit({
  windowMs,
  max,
  message: {
    status: 'error',
    error: message || 'Too many requests from this IP',
    retryAfter: Math.ceil(windowMs / 1000),
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use forwarded IP if available (for load balancers)
    return req.headers['x-forwarded-for'] as string ||
           req.headers['x-real-ip'] as string ||
           req.socket.remoteAddress ||
           'unknown';
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.url === '/api/health';
  },
  handler: (req, res) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    res.status(429).json({
      status: 'error',
      error: message || 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(windowMs / 1000),
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// Speed limiting (progressive delay)
const createSpeedLimiter = (windowMs: number, delayAfter: number) => slowDown({
  windowMs,
  delayAfter,
  delayMs: 500, // Start with 500ms delay
  maxDelayMs: 20000, // Max 20 second delay
});

// Different rate limits for different endpoints
export const rateLimiters = {
  // Authentication endpoints - stricter limits
  auth: createRateLimiter(15 * 60 * 1000, 5, 'Too many authentication attempts'), // 5 attempts per 15 minutes

  // PDF processing - moderate limits
  processing: createRateLimiter(60 * 1000, 10, 'Too many processing requests'), // 10 requests per minute

  // General API - lenient limits
  general: createRateLimiter(60 * 1000, 100, 'Too many API requests'), // 100 requests per minute

  // File upload - very strict
  upload: createRateLimiter(60 * 1000, 5, 'Too many file uploads'), // 5 uploads per minute

  // API key endpoints - higher limits for programmatic access
  api: createRateLimiter(60 * 1000, 1000, 'API rate limit exceeded'), // 1000 requests per minute
};

export const speedLimiters = {
  auth: createSpeedLimiter(15 * 60 * 1000, 2),
  processing: createSpeedLimiter(60 * 1000, 5),
  upload: createSpeedLimiter(60 * 1000, 2),
};

// CSRF Token validation
export function validateCSRFToken(req: NextApiRequest): boolean {
  const token = req.headers['x-csrf-token'] as string;
  const sessionToken = req.headers['x-session-token'] as string;
  
  if (!token || !sessionToken) {
    return false;
  }
  
  // Generate expected CSRF token based on session
  const expectedToken = createHash('sha256')
    .update(sessionToken + process.env.NEXTAUTH_SECRET!)
    .digest('hex');
  
  // Use timing-safe comparison to prevent timing attacks
  const tokenBuffer = Buffer.from(token, 'hex');
  const expectedBuffer = Buffer.from(expectedToken, 'hex');
  
  if (tokenBuffer.length !== expectedBuffer.length) {
    return false;
  }
  
  return timingSafeEqual(tokenBuffer, expectedBuffer);
}

// Input validation helpers
export const validators = {
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  },
  
  filename: (filename: string): boolean => {
    // Allow only safe characters in filenames
    const filenameRegex = /^[a-zA-Z0-9._-]+$/;
    return filenameRegex.test(filename) && filename.length <= 255;
  },
  
  uuid: (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  },
  
  fileSize: (size: number, maxSize: number = 100 * 1024 * 1024): boolean => {
    return size > 0 && size <= maxSize;
  },
  
  operationType: (type: string): boolean => {
    const validTypes = ['compress', 'merge', 'split', 'watermark', 'protect', 'convert', 'extract', 'sign'];
    return validTypes.includes(type);
  }
};

// Security headers middleware
export function setSecurityHeaders(res: NextApiResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.stripe.com https://*.supabase.co wss://*.supabase.co",
    "frame-src https://js.stripe.com",
    "object-src 'none'",
    "base-uri 'self'"
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', csp);
}

// Main authentication middleware
export async function authMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  options: {
    requireAuth?: boolean;
    requireSubscription?: boolean;
    rateLimitType?: keyof typeof rateLimiters;
    validateCSRF?: boolean;
    allowedMethods?: string[];
  } = {}
) {
  const {
    requireAuth = true,
    requireSubscription = false,
    rateLimitType = 'general',
    validateCSRF = false,
    allowedMethods = ['GET', 'POST', 'PUT', 'DELETE']
  } = options;

  try {
    // Set security headers
    setSecurityHeaders(res);

    // Method validation
    if (!allowedMethods.includes(req.method!)) {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Apply rate limiting
    const rateLimiter = rateLimiters[rateLimitType];
    const speedLimiter = speedLimiters[rateLimitType];
    
    if (rateLimiter) {
      await new Promise((resolve, reject) => {
        rateLimiter(req as any, res as any, (err: any) => {
          if (err) reject(err);
          else resolve(undefined);
        });
      });
    }
    
    if (speedLimiter) {
      await new Promise((resolve, reject) => {
        speedLimiter(req as any, res as any, (err: any) => {
          if (err) reject(err);
          else resolve(undefined);
        });
      });
    }

    // CSRF validation for state-changing operations
    if (validateCSRF && ['POST', 'PUT', 'DELETE'].includes(req.method!)) {
      if (!validateCSRFToken(req)) {
        return res.status(403).json({ error: 'Invalid CSRF token' });
      }
    }

    // Authentication check
    if (requireAuth) {
      const session = await getServerSession(req, res, authOptions);
      
      if (!session?.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check if user account is active
      const { data: user, error } = await supabaseHelpers.getUserById(session.user.id);
      
      if (error || !user || !user.is_active) {
        return res.status(401).json({ error: 'Account inactive or not found' });
      }

      // Subscription check
      if (requireSubscription) {
        const { data: subscription } = await supabaseHelpers.getUserSubscription(session.user.id);
        
        if (!subscription || subscription.status !== 'ACTIVE') {
          return res.status(403).json({ 
            error: 'Active subscription required',
            code: 'SUBSCRIPTION_REQUIRED'
          });
        }
      }

      // Add user info to request for downstream use
      (req as any).user = {
        id: session.user.id,
        email: session.user.email,
        subscription: session.user.subscription
      };
    }

    return { success: true };

  } catch (error) {
    console.error('Auth middleware error:', error);
    
    // Don't leak internal errors
    if (error instanceof Error && error.message.includes('Rate limit')) {
      return res.status(429).json({ error: 'Too many requests' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// API Key authentication for API endpoints
export async function validateApiKey(req: NextApiRequest): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return { valid: false, error: 'API key required' };
  }

  try {
    // Extract key prefix and hash the full key
    const keyPrefix = apiKey.substring(0, 8);
    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    // Look up API key in database
    const { data: apiKeyRecord, error } = await supabaseHelpers.supabaseAdmin
      .from('api_keys')
      .select('user_id, is_active, usage_count, last_used')
      .eq('key_hash', keyHash)
      .eq('key_prefix', keyPrefix)
      .single();

    if (error || !apiKeyRecord) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (!apiKeyRecord.is_active) {
      return { valid: false, error: 'API key inactive' };
    }

    // Update usage statistics
    await supabaseHelpers.supabaseAdmin
      .from('api_keys')
      .update({
        usage_count: apiKeyRecord.usage_count + 1,
        last_used: new Date().toISOString()
      })
      .eq('key_hash', keyHash);

    return { valid: true, userId: apiKeyRecord.user_id };

  } catch (error) {
    console.error('API key validation error:', error);
    return { valid: false, error: 'API key validation failed' };
  }
}

// Wrapper for API endpoints with authentication
export function withAuth(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  options?: Parameters<typeof authMiddleware>[2]
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const authResult = await authMiddleware(req, res, options);
    
    if (authResult && authResult.success) {
      return handler(req, res);
    }
    
    // Response already sent by middleware
  };
}

// Wrapper for API endpoints with API key authentication
export function withApiKey(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    setSecurityHeaders(res);
    
    const { valid, userId, error } = await validateApiKey(req);
    
    if (!valid) {
      return res.status(401).json({ error: error || 'Invalid API key' });
    }
    
    // Add user info to request
    (req as any).user = { id: userId };
    
    return handler(req, res);
  };
}

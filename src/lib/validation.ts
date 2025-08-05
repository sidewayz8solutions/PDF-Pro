import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// Install zod for schema validation
// npm install zod isomorphic-dompurify

// Common validation schemas
export const schemas = {
  // User input schemas
  email: z.string().email().max(254),
  password: z.string().min(8).max(128).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  ),
  name: z.string().min(1).max(100).regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters'),
  
  // File validation schemas
  filename: z.string().min(1).max(255).regex(
    /^[a-zA-Z0-9._-]+$/,
    'Filename can only contain letters, numbers, dots, underscores, and hyphens'
  ),
  fileSize: z.number().positive().max(100 * 1024 * 1024), // 100MB
  
  // PDF operation schemas
  operationType: z.enum(['compress', 'merge', 'split', 'watermark', 'protect', 'convert', 'extract', 'sign']),
  quality: z.enum(['low', 'medium', 'high']),
  
  // API schemas
  uuid: z.string().uuid(),
  apiKey: z.string().regex(/^[a-zA-Z0-9]{32,}$/, 'Invalid API key format'),
  
  // Pagination schemas
  page: z.number().int().positive().max(1000),
  limit: z.number().int().positive().max(100),
  
  // Search schemas
  searchQuery: z.string().min(1).max(100).regex(
    /^[a-zA-Z0-9\s._-]+$/,
    'Search query contains invalid characters'
  ),
};

// PDF-specific validation schemas
export const pdfSchemas = {
  compress: z.object({
    quality: schemas.quality.optional().default('medium'),
    removeImages: z.boolean().optional().default(false),
    optimizeForWeb: z.boolean().optional().default(false),
  }),
  
  watermark: z.object({
    text: z.string().min(1).max(100),
    opacity: z.number().min(0.1).max(1).optional().default(0.5),
    position: z.enum(['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right']).optional().default('center'),
    fontSize: z.number().int().min(8).max(72).optional().default(24),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional().default('#000000'),
  }),
  
  split: z.object({
    splitType: z.enum(['pages', 'range', 'every']),
    pages: z.array(z.number().int().positive()).optional(),
    startPage: z.number().int().positive().optional(),
    endPage: z.number().int().positive().optional(),
    splitEvery: z.number().int().positive().max(100).optional(),
  }),
  
  protect: z.object({
    password: z.string().min(4).max(50),
    permissions: z.object({
      printing: z.boolean().optional().default(false),
      copying: z.boolean().optional().default(false),
      editing: z.boolean().optional().default(false),
      annotating: z.boolean().optional().default(false),
    }).optional(),
  }),
  
  merge: z.object({
    fileOrder: z.array(z.string().uuid()).min(2).max(20),
    addBookmarks: z.boolean().optional().default(false),
  }),
};

// Sanitization functions
export const sanitizers = {
  // HTML sanitization
  html: (input: string): string => {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
  },
  
  // Filename sanitization
  filename: (input: string): string => {
    return input
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 255);
  },
  
  // Search query sanitization
  searchQuery: (input: string): string => {
    return input
      .replace(/[^a-zA-Z0-9\s._-]/g, '')
      .trim()
      .substring(0, 100);
  },
  
  // SQL injection prevention (for raw queries)
  sqlString: (input: string): string => {
    return input.replace(/['";\\]/g, '');
  },
};

// File validation functions
export const fileValidators = {
  // Validate PDF file signature
  isPDF: (buffer: Buffer): boolean => {
    const pdfSignature = buffer.subarray(0, 4);
    return pdfSignature.equals(Buffer.from([0x25, 0x50, 0x44, 0x46])); // %PDF
  },
  
  // Check for malicious content in PDF
  isSafePDF: async (buffer: Buffer): Promise<{ safe: boolean; reason?: string }> => {
    try {
      // Check for JavaScript in PDF
      const content = buffer.toString('ascii');
      
      // Look for suspicious patterns
      const suspiciousPatterns = [
        /\/JavaScript/i,
        /\/JS/i,
        /\/OpenAction/i,
        /\/Launch/i,
        /\/URI/i,
        /\/SubmitForm/i,
        /\/ImportData/i,
        /\/GoToR/i,
        /\/Sound/i,
        /\/Movie/i,
        /\/EmbeddedFile/i,
      ];
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(content)) {
          return { safe: false, reason: 'PDF contains potentially malicious content' };
        }
      }
      
      // Check file size ratio (compressed vs uncompressed)
      const compressionRatio = buffer.length / content.length;
      if (compressionRatio > 0.9) {
        return { safe: false, reason: 'Suspicious compression ratio' };
      }
      
      return { safe: true };
    } catch (error) {
      return { safe: false, reason: 'PDF validation failed' };
    }
  },
  
  // Validate file metadata
  validateMetadata: (metadata: any): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (metadata.size && metadata.size > 100 * 1024 * 1024) {
      errors.push('File size exceeds limit');
    }
    
    if (metadata.type && metadata.type !== 'application/pdf') {
      errors.push('Invalid file type');
    }
    
    if (metadata.name && metadata.name.length > 255) {
      errors.push('Filename too long');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },
};

// Request validation middleware
export function validateRequest<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): { success: true; data: T } | { success: false; errors: string[] } => {
    try {
      const result = schema.parse(data);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        return { success: false, errors };
      }
      return { success: false, errors: ['Validation failed'] };
    }
  };
}

// Rate limiting validation
export const rateLimitValidators = {
  // Check if IP is in whitelist
  isWhitelisted: (ip: string): boolean => {
    const whitelist = process.env.IP_WHITELIST?.split(',') || [];
    return whitelist.includes(ip);
  },
  
  // Check if IP is in blacklist
  isBlacklisted: (ip: string): boolean => {
    const blacklist = process.env.IP_BLACKLIST?.split(',') || [];
    return blacklist.includes(ip);
  },
  
  // Validate user agent
  isValidUserAgent: (userAgent: string): boolean => {
    // Block empty or suspicious user agents
    if (!userAgent || userAgent.length < 10) {
      return false;
    }
    
    // Block known bot patterns
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
    ];
    
    return !botPatterns.some(pattern => pattern.test(userAgent));
  },
};

// Security validation helpers
export const securityValidators = {
  // Validate CSRF token format
  isValidCSRFToken: (token: string): boolean => {
    return /^[a-f0-9]{64}$/.test(token);
  },
  
  // Validate session token format
  isValidSessionToken: (token: string): boolean => {
    return /^[a-zA-Z0-9+/]{40,}={0,2}$/.test(token);
  },
  
  // Check for SQL injection patterns
  hasSQLInjection: (input: string): boolean => {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(--|\/\*|\*\/)/,
      /(\b(SCRIPT|JAVASCRIPT|VBSCRIPT)\b)/i,
    ];
    
    return sqlPatterns.some(pattern => pattern.test(input));
  },
  
  // Check for XSS patterns
  hasXSS: (input: string): boolean => {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    ];
    
    return xssPatterns.some(pattern => pattern.test(input));
  },
};

// Export validation utilities
export default {
  schemas,
  pdfSchemas,
  sanitizers,
  fileValidators,
  validateRequest,
  rateLimitValidators,
  securityValidators,
};

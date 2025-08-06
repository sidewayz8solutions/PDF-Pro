import { NextApiRequest } from 'next';

// Extend NextAuth types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      subscription?: any
      creditsRemaining?: number
      stripeCustomerId?: string
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
    image?: string | null
    subscription?: any
  }
}

// API Request types
export interface AuthenticatedRequest extends NextApiRequest {
  user?: {
    userId: string
    email: string
    subscription?: any
    apiKeyId?: string
  }
}

// PDF Processing types
export interface ProcessingOptions {
  quality?: 'low' | 'medium' | 'high'
  dpi?: number
  grayscale?: boolean
  removeImages?: boolean
  imageQuality?: number
}

export interface SplitOptions {
  pages?: number[]
  ranges?: Array<{ start: number; end: number }>
  splitEvery?: number
}

export interface MergeOptions {
  insertPageBreaks?: boolean
  uniformSize?: boolean
}

export interface WatermarkOptions {
  text?: string
  image?: Buffer
  opacity?: number
  position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'diagonal'
  fontSize?: number
  color?: { r: number; g: number; b: number }
}

export interface ProtectionOptions {
  userPassword?: string
  ownerPassword?: string
  permissions?: {
    printing?: boolean
    modifying?: boolean
    copying?: boolean
    annotating?: boolean
    fillingForms?: boolean
    contentAccessibility?: boolean
    documentAssembly?: boolean
  }
}

export interface ConversionOptions {
  format?: 'pdf' | 'docx' | 'xlsx' | 'jpg' | 'png'
  quality?: number
  pageRange?: { start: number; end: number }
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  details?: any
}

export interface ProcessingResult {
  downloadUrl: string
  filename: string
  fileSize?: number
  pageCount?: number
  processingTime?: string
  remainingCredits?: number
  metadata?: Record<string, any>
}

export interface CompressionResult extends ProcessingResult {
  originalSize: number
  compressedSize: number
  compressionRatio: number
}

export interface SplitResult extends ProcessingResult {
  filesCount: number
  individualFiles?: Array<{
    url: string
    filename: string
    size: number
  }>
}

export interface MergeResult extends ProcessingResult {
  filesCount: number
  totalPages?: number
}

// Subscription types
export type PlanType = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'BUSINESS'
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'PAUSED'

export interface SubscriptionPlan {
  plan: PlanType
  monthlyCredits: number
  maxFileSize: number // in MB
  apiAccess: boolean
  priorityProcessing: boolean
  customBranding: boolean
  price: number
  features: string[]
}

// Usage tracking
export type OperationType = 
  | 'COMPRESS'
  | 'MERGE'
  | 'SPLIT'
  | 'CONVERT_TO_PDF'
  | 'CONVERT_FROM_PDF'
  | 'EXTRACT_TEXT'
  | 'EXTRACT_IMAGES'
  | 'ADD_WATERMARK'
  | 'REMOVE_WATERMARK'
  | 'PASSWORD_PROTECT'
  | 'UNLOCK'
  | 'E_SIGN'
  | 'OCR'
  | 'ROTATE'
  | 'OPTIMIZE'

export interface UsageRecord {
  operation: OperationType
  credits: number
  timestamp: Date
  fileSize?: number
  processingTime?: number
  success: boolean
}

// File types
export interface FileRecord {
  id: string;
  user_id: string;
  original_name: string;
  file_size: number;
  file_type: string;
  s3_key: string;
  s3_url: string;
  processed_url: string | null;
  operation_type: 'compress' | 'merge' | 'split' | 'watermark' | 'protect' | 'convert' | 'extract' | 'sign';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  processing_time: number | null;
  compression_ratio: number | null;
  pages_count: number | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

// API Key types
export interface ApiKeyRecord {
  id: string
  name: string
  key: string // Masked in responses
  isActive: boolean
  lastUsedAt?: Date
  createdAt: Date
  expiresAt?: Date
  scopes: string[]
  requestsPerMonth: number
  requestsUsed: number
}

// Tool types for UI
export interface PdfTool {
  id: string
  name: string
  description: string
  icon: any
  color: string
  bgColor: string
  endpoint: string
  credits: number
  category?: 'basic' | 'advanced' | 'security' | 'conversion'
}

// Form types
export interface LoginFormData {
  email: string
  password: string
  remember?: boolean
}

export interface SignupFormData {
  name: string
  email: string
  password: string
  confirmPassword: string
  acceptTerms?: boolean
}

export interface ContactFormData {
  name: string
  email: string
  subject: string
  message: string
  company?: string
}

// Error types
export interface ApiError {
  code: string
  message: string
  statusCode: number
  details?: any
}

// Webhook types
export interface WebhookPayload {
  event: string
  data: any
  timestamp: Date
  signature?: string
}

// Pagination
export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  order?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}
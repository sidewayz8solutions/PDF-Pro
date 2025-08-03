import crypto from 'crypto'

export function generateApiKey(): string {
  const prefix = 'sk_live_'
  const key = crypto.randomBytes(32).toString('hex')
  return `${prefix}${key}`
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function calculatePercentage(used: number, total: number): number {
  if (total === 0) return 0
  return Math.round((used / total) * 100)
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? `.${parts.pop()!.toLowerCase()}` : ''
}

export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email)
}

export function generatePassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let password = ''
  
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  
  return password
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 255)
}

export function getRemainingTime(expiresAt: Date | string): string {
  const now = new Date()
  const expires = new Date(expiresAt)
  const diff = expires.getTime() - now.getTime()
  
  if (diff <= 0) return 'Expired'
  
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  
  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `${days} day${days > 1 ? 's' : ''}`
  }
  
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`
  }
  
  return `${minutes} minute${minutes > 1 ? 's' : ''}`
}

export function getOperationName(operation: string): string {
  const names: Record<string, string> = {
    COMPRESS: 'Compress PDF',
    MERGE: 'Merge PDFs',
    SPLIT: 'Split PDF',
    CONVERT_TO_PDF: 'Convert to PDF',
    CONVERT_FROM_PDF: 'Convert from PDF',
    EXTRACT_TEXT: 'Extract Text',
    EXTRACT_IMAGES: 'Extract Images',
    ADD_WATERMARK: 'Add Watermark',
    REMOVE_WATERMARK: 'Remove Watermark',
    PASSWORD_PROTECT: 'Password Protect',
    UNLOCK: 'Unlock PDF',
    E_SIGN: 'E-Sign',
    OCR: 'OCR',
    ROTATE: 'Rotate',
    OPTIMIZE: 'Optimize',
  }
  
  return names[operation] || operation
}

export function getPlanLimits(plan: string) {
  const limits: Record<string, any> = {
    FREE: {
      monthlyCredits: 5,
      maxFileSize: 10, // MB
      apiCalls: 0,
      supportLevel: 'community',
      processingPriority: 'standard',
      dataRetention: 1, // days
    },
    STARTER: {
      monthlyCredits: 100,
      maxFileSize: 50,
      apiCalls: 0,
      supportLevel: 'email',
      processingPriority: 'priority',
      dataRetention: 7,
    },
    PROFESSIONAL: {
      monthlyCredits: 500,
      maxFileSize: 200,
      apiCalls: 1000,
      supportLevel: 'priority',
      processingPriority: 'instant',
      dataRetention: 30,
    },
    BUSINESS: {
      monthlyCredits: 99999, // Unlimited
      maxFileSize: 1000,
      apiCalls: 10000,
      supportLevel: '24/7',
      processingPriority: 'instant',
      dataRetention: 365,
    },
  }
  
  return limits[plan] || limits.FREE
}

export function validateFileSize(sizeInBytes: number, plan: string): boolean {
  const limits = getPlanLimits(plan)
  const maxSizeInBytes = limits.maxFileSize * 1024 * 1024
  return sizeInBytes <= maxSizeInBytes
}

export function getCompressionQuality(plan: string): 'low' | 'medium' | 'high' {
  switch (plan) {
    case 'BUSINESS':
    case 'PROFESSIONAL':
      return 'high'
    case 'STARTER':
      return 'medium'
    default:
      return 'low'
  }
}

export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs')
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs')
  return bcrypt.compare(password, hash)
}

export function generateToken(payload: any, expiresIn: string = '7d'): string {
  const jwt = require('jsonwebtoken')
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn })
}

export function verifyToken(token: string): any {
  const jwt = require('jsonwebtoken')
  return jwt.verify(token, process.env.JWT_SECRET!)
}

export function parseError(error: any): string {
  if (typeof error === 'string') return error
  if (error.message) return error.message
  if (error.error) return error.error
  return 'An unexpected error occurred'
}
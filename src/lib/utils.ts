import crypto from 'crypto'

export function generateApiKey(): string {
  return `pk_${crypto.randomBytes(32).toString('hex')}`
}

export function generateSecretKey(): string {
  return `sk_${crypto.randomBytes(32).toString('hex')}`
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

export function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const extension = getFileExtension(originalName)
  const baseName = originalName.replace(extension, '').replace(/[^a-zA-Z0-9]/g, '_')
  
  return `${baseName}_${timestamp}_${random}${extension}`
}

export function parseError(error: any): string {
  if (typeof error === 'string') return error
  if (error.message) return error.message
  if (error.error) return error.error
  return 'An unexpected error occurred'
}

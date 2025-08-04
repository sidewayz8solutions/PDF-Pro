import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma, getUserWithSubscription, validateApiKey, updateApiKeyUsage } from './prisma'
import { AuthenticatedRequest } from '@/types/types'

// JWT utilities
export function generateJWT(payload: any, expiresIn: string = '7d'): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set')
  }

  // Use require to avoid TypeScript issues with expiresIn type
  const jsonwebtoken = require('jsonwebtoken')
  return jsonwebtoken.sign(payload, secret, { expiresIn })
}

export function verifyJWT(token: string): any {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!)
  } catch (error) {
    throw new Error('Invalid token')
  }
}

// Password utilities
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash)
}

// API Key utilities
export function generateApiKey(): string {
  return `pk_${crypto.randomBytes(32).toString('hex')}`
}

export function generateSecretKey(): string {
  return `sk_${crypto.randomBytes(32).toString('hex')}`
}

// Session utilities
export async function getSession(req: NextApiRequest, res: NextApiResponse) {
  return await getServerSession(req, res, authOptions)
}

export async function requireAuth(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res)
  
  if (!session?.user?.id) {
    throw new Error('Authentication required')
  }
  
  return session
}

export async function requireSubscription(
  req: NextApiRequest, 
  res: NextApiResponse, 
  requiredPlan?: 'STARTER' | 'PROFESSIONAL' | 'BUSINESS'
) {
  const session = await requireAuth(req, res)
  const user = await getUserWithSubscription(session.user.id)
  
  if (!user?.subscription || user.subscription.status !== 'ACTIVE') {
    throw new Error('Active subscription required')
  }
  
  if (requiredPlan) {
    const planHierarchy = ['FREE', 'STARTER', 'PROFESSIONAL', 'BUSINESS']
    const userPlanIndex = planHierarchy.indexOf(user.subscription.plan)
    const requiredPlanIndex = planHierarchy.indexOf(requiredPlan)
    
    if (userPlanIndex < requiredPlanIndex) {
      throw new Error(`${requiredPlan} plan or higher required`)
    }
  }
  
  return { session, user }
}

// Middleware functions
export function withAuth(handler: Function) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const session = await requireAuth(req, res)
      ;(req as AuthenticatedRequest).user = {
        userId: session.user.id,
        email: session.user.email!,
      }
      return await handler(req, res)
    } catch (error) {
      return res.status(401).json({ 
        error: error instanceof Error ? error.message : 'Authentication failed' 
      })
    }
  }
}

export function withApiKey(handler: Function) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const apiKey = req.headers['x-api-key'] as string
      
      if (!apiKey) {
        return res.status(401).json({ error: 'API key required' })
      }
      
      const keyRecord = await validateApiKey(apiKey)
      
      if (!keyRecord || !keyRecord.isActive) {
        return res.status(401).json({ error: 'Invalid API key' })
      }
      
      // Check if key is expired
      if (keyRecord.expiresAt && new Date() > keyRecord.expiresAt) {
        return res.status(401).json({ error: 'API key expired' })
      }
      
      // Check rate limits
      if (keyRecord.requestsUsed >= keyRecord.requestsPerMonth) {
        return res.status(429).json({ 
          error: 'Monthly request limit exceeded',
          limit: keyRecord.requestsPerMonth,
          used: keyRecord.requestsUsed,
          resetsAt: getNextMonthStart()
        })
      }
      
      // Update usage
      await updateApiKeyUsage(keyRecord.id)
      
      ;(req as AuthenticatedRequest).user = {
        userId: keyRecord.user.id,
        email: keyRecord.user.email,
        subscription: keyRecord.user.subscription,
        apiKeyId: keyRecord.id,
      }
      
      return await handler(req, res)
    } catch (error) {
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Authentication failed' 
      })
    }
  }
}

export function withSubscription(requiredPlan?: 'STARTER' | 'PROFESSIONAL' | 'BUSINESS') {
  return function(handler: Function) {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      try {
        const { session, user } = await requireSubscription(req, res, requiredPlan)
        ;(req as AuthenticatedRequest).user = {
          userId: session.user.id,
          email: session.user.email!,
          subscription: user.subscription,
        }
        return await handler(req, res)
      } catch (error) {
        return res.status(403).json({ 
          error: error instanceof Error ? error.message : 'Subscription required' 
        })
      }
    }
  }
}

// Credit management
export async function checkCredits(userId: string, requiredCredits: number = 1): Promise<boolean> {
  const user = await getUserWithSubscription(userId)
  
  if (!user?.subscription) {
    return false
  }
  
  const remainingCredits = user.subscription.monthlyCredits - user.creditsUsed
  return remainingCredits >= requiredCredits
}

export async function deductCredits(userId: string, credits: number = 1): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      creditsUsed: { increment: credits },
    },
  })
}

// Rate limiting utilities
export function getNextMonthStart(): Date {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return nextMonth
}

export function isRateLimited(requests: number, limit: number, resetDate: Date): boolean {
  if (new Date() > resetDate) {
    return false // Reset period has passed
  }
  return requests >= limit
}

// Permission utilities
export function hasPermission(
  subscription: any, 
  permission: 'apiAccess' | 'priorityProcessing' | 'customBranding'
): boolean {
  if (!subscription || subscription.status !== 'ACTIVE') {
    return false
  }
  
  return subscription[permission] === true
}

export function canAccessFeature(
  subscription: any,
  feature: 'watermark' | 'extract' | 'protect' | 'sign' | 'api'
): boolean {
  if (!subscription || subscription.status !== 'ACTIVE') {
    return feature === 'watermark' // Free users can watermark
  }
  
  const plan = subscription.plan
  
  switch (feature) {
    case 'watermark':
      return true // All plans
    case 'extract':
      return ['STARTER', 'PROFESSIONAL', 'BUSINESS'].includes(plan)
    case 'protect':
      return ['PROFESSIONAL', 'BUSINESS'].includes(plan)
    case 'sign':
      return plan === 'BUSINESS'
    case 'api':
      return ['PROFESSIONAL', 'BUSINESS'].includes(plan)
    default:
      return false
  }
}

// File size validation
export function validateFileSize(sizeInBytes: number, subscription: any): boolean {
  if (!subscription) {
    return sizeInBytes <= 10 * 1024 * 1024 // 10MB for free users
  }
  
  const maxSizeInBytes = subscription.maxFileSize * 1024 * 1024
  return sizeInBytes <= maxSizeInBytes
}

// Error handling utilities
export class AuthError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message)
    this.name = 'AuthError'
  }
}

export class SubscriptionError extends Error {
  constructor(message: string, public statusCode: number = 403) {
    super(message)
    this.name = 'SubscriptionError'
  }
}

export class RateLimitError extends Error {
  constructor(message: string, public statusCode: number = 429) {
    super(message)
    this.name = 'RateLimitError'
  }
}

export function handleAuthError(error: any, res: NextApiResponse) {
  if (error instanceof AuthError) {
    return res.status(error.statusCode).json({ error: error.message })
  }
  
  if (error instanceof SubscriptionError) {
    return res.status(error.statusCode).json({ error: error.message })
  }
  
  if (error instanceof RateLimitError) {
    return res.status(error.statusCode).json({ error: error.message })
  }
  
  console.error('Auth error:', error)
  return res.status(500).json({ error: 'Internal server error' })
}

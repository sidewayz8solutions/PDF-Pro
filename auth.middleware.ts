import { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

export interface AuthenticatedRequest extends NextApiRequest {
  user?: {
    userId: string
    email: string
    subscription?: any
  }
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  next: () => void
) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string
      email: string
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { subscription: true }
    })

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    req.user = {
      userId: user.id,
      email: user.email,
      subscription: user.subscription,
    }

    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

export function authenticateApiKey(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  next: () => void
) {
  return async () => {
    try {
      const apiKey = req.headers['x-api-key'] as string

      if (!apiKey) {
        return res.status(401).json({ error: 'API key required' })
      }

      const key = await prisma.apiKey.findUnique({
        where: { key: apiKey },
        include: { 
          user: {
            include: { subscription: true }
          }
        }
      })

      if (!key || !key.isActive) {
        return res.status(401).json({ error: 'Invalid API key' })
      }

      // Check if key is expired
      if (key.expiresAt && new Date() > key.expiresAt) {
        return res.status(401).json({ error: 'API key expired' })
      }

      // Check rate limits
      if (key.requestsUsed >= key.requestsPerMonth) {
        return res.status(429).json({ 
          error: 'Monthly request limit exceeded',
          limit: key.requestsPerMonth,
          used: key.requestsUsed,
          resetsAt: getNextMonthStart()
        })
      }

      // Update last used
      await prisma.apiKey.update({
        where: { id: key.id },
        data: { 
          lastUsedAt: new Date(),
          requestsUsed: { increment: 1 }
        }
      })

      req.user = {
        userId: key.user.id,
        email: key.user.email,
        subscription: key.user.subscription,
        apiKeyId: key.id,
      }

      next()
    } catch (error) {
      return res.status(500).json({ error: 'Authentication failed' })
    }
  }
}

function getNextMonthStart(): Date {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return nextMonth
}
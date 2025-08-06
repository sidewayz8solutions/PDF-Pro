import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

// import type { NextRequest } from 'next/server';

export function middleware(request) {
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // CORS configuration
  const origin = request.headers.get('origin');
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['https://your-domain.com'];
 u
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Max-Age', '86400');
  }
  
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
/**
 * @typedef {import('next').NextApiRequest & {
 *   user?: {
 *     userId: string,
 *     email: string,
 *     subscription?: any,
 *     apiKeyId?: string
 *   }
 * }} AuthenticatedRequest
 */

export async function authenticate(
  req,
  res,
  next
) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

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
  req,
  res,
  next
) {
  return async () => {
    try {
      const apiKey = req.headers['x-api-key']

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

function getNextMonthStart() {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return nextMonth
}
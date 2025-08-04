import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { hashPassword, generateApiKey } from '@/utils'
import { z } from 'zod'

const signupSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(100),
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Validate input
    const result = signupSchema.safeParse(req.body)
    
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Invalid input',
        details: result.error.issues 
      })
    }

    const { name, email, password } = result.data

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' })
    }

    // Hash password
    const hashedPassword = await hashPassword(password)

    // Create user with free subscription
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        provider: 'credentials',
        subscription: {
          create: {
            plan: 'FREE',
            status: 'ACTIVE',
            monthlyCredits: 5,
            maxFileSize: 10,
            apiAccess: false,
            priorityProcessing: false,
            customBranding: false,
            stripeSubscriptionId: '',
            stripePriceId: '',
            stripeCurrentPeriodEnd: new Date(),
          },
        },
      },
      include: {
        subscription: true,
      },
    })

    // Create default API key
    const apiKey = generateApiKey()
    await prisma.apiKey.create({
      data: {
        userId: user.id,
        name: 'Default API Key',
        key: apiKey,
        requestsPerMonth: 100,
        isActive: true,
      },
    })

    // TODO: Send welcome email
    // await sendWelcomeEmail(user.email, user.name)

    // Return success (don't send password back)
    return res.status(201).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        subscription: user.subscription,
      },
      message: 'Account created successfully',
    })

  } catch (error: any) {
    console.error('Signup error:', error)
    
    // Handle Prisma errors
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Email already registered' })
    }
    
    return res.status(500).json({ 
      error: 'Failed to create account',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}
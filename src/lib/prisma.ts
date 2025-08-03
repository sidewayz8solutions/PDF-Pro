import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

// Prevent multiple instances of Prisma Client in development
export const prisma = globalThis.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  errorFormat: 'pretty',
})

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

// Helper functions for common database operations
export async function getUserWithSubscription(userId: string) {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: true,
      apiKeys: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

export async function getUserByEmail(email: string) {
  return await prisma.user.findUnique({
    where: { email },
    include: {
      subscription: true,
    },
  })
}

export async function createUser(data: {
  email: string
  name?: string
  password?: string
  provider?: string
  image?: string
}) {
  return await prisma.user.create({
    data: {
      ...data,
      subscription: {
        create: {
          plan: 'FREE',
          status: 'ACTIVE',
          monthlyCredits: 5,
          maxFileSize: 10,
          apiAccess: false,
          priorityProcessing: false,
          customBranding: false,
        },
      },
    },
    include: {
      subscription: true,
    },
  })
}

export async function updateUserCredits(userId: string, creditsUsed: number) {
  return await prisma.user.update({
    where: { id: userId },
    data: {
      creditsUsed: { increment: creditsUsed },
    },
  })
}

export async function resetMonthlyCredits(userId: string) {
  return await prisma.user.update({
    where: { id: userId },
    data: {
      creditsUsed: 0,
      lastResetDate: new Date(),
    },
  })
}

export async function createUsageRecord(data: {
  userId: string
  operation: string
  credits: number
  inputSize?: number
  outputSize?: number
  processingTime?: number
  apiKeyId?: string
}) {
  return await prisma.usage.create({
    data,
  })
}

export async function getUsageStats(userId: string, startDate?: Date, endDate?: Date) {
  const where: any = { userId }
  
  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = startDate
    if (endDate) where.createdAt.lte = endDate
  }

  const [totalUsage, operationStats] = await Promise.all([
    prisma.usage.aggregate({
      where,
      _sum: {
        credits: true,
        inputSize: true,
        outputSize: true,
      },
      _count: true,
    }),
    prisma.usage.groupBy({
      by: ['operation'],
      where,
      _sum: {
        credits: true,
      },
      _count: true,
    }),
  ])

  return {
    totalUsage,
    operationStats,
  }
}

export async function createApiKey(data: {
  userId: string
  name: string
  key: string
  requestsPerMonth: number
  expiresAt?: Date
}) {
  return await prisma.apiKey.create({
    data,
  })
}

export async function validateApiKey(key: string) {
  return await prisma.apiKey.findUnique({
    where: { key },
    include: {
      user: {
        include: { subscription: true },
      },
    },
  })
}

export async function updateApiKeyUsage(apiKeyId: string) {
  return await prisma.apiKey.update({
    where: { id: apiKeyId },
    data: {
      lastUsedAt: new Date(),
      requestsUsed: { increment: 1 },
    },
  })
}

// File management helpers
export async function createFileRecord(data: {
  userId: string
  originalName: string
  filename: string
  size: number
  mimeType: string
  storageUrl: string
  thumbnailUrl?: string
  pageCount?: number
  isEncrypted?: boolean
  metadata?: any
  expiresAt?: Date
}) {
  return await prisma.file.create({
    data,
  })
}

export async function updateFileStatus(fileId: string, status: 'UPLOADED' | 'PROCESSING' | 'READY' | 'ERROR' | 'DELETED', processingData?: any) {
  return await prisma.file.update({
    where: { id: fileId },
    data: {
      status,
      ...(processingData && { processingData }),
    },
  })
}

export async function getUserFiles(userId: string, limit = 50, offset = 0) {
  return await prisma.file.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    include: {
      usage: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })
}

export async function deleteExpiredFiles() {
  const expiredFiles = await prisma.file.findMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  })

  if (expiredFiles.length > 0) {
    await prisma.file.deleteMany({
      where: {
        id: {
          in: expiredFiles.map(f => f.id),
        },
      },
    })
  }

  return expiredFiles
}

// Subscription helpers
export async function updateSubscription(userId: string, data: {
  stripeSubscriptionId?: string
  stripePriceId?: string
  stripeCurrentPeriodEnd?: Date
  plan?: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'BUSINESS'
  status?: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'PAUSED'
  monthlyCredits?: number
  maxFileSize?: number
  apiAccess?: boolean
  priorityProcessing?: boolean
  customBranding?: boolean
}) {
  return await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      ...data,
    },
    update: data,
  })
}

export async function getActiveSubscriptions() {
  return await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      stripeCurrentPeriodEnd: {
        lt: new Date(),
      },
    },
    include: {
      user: true,
    },
  })
}

// Cleanup functions
export async function cleanupDatabase() {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Delete old usage records (keep last 30 days)
  await prisma.usage.deleteMany({
    where: {
      createdAt: {
        lt: thirtyDaysAgo,
      },
    },
  })

  // Delete expired files
  await deleteExpiredFiles()

  // Deactivate expired API keys
  await prisma.apiKey.updateMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
      isActive: true,
    },
    data: {
      isActive: false,
    },
  })
}

export default prisma

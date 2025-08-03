import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import { PdfProcessor } from '@/lib/pdf/PdfProcessor'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

export const config = {
  api: {
    bodyParser: false,
    sizeLimit: '200mb',
  },
}

// Initialize S3 client if configured
const s3Client = process.env.AWS_ACCESS_KEY_ID
  ? new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  : null

async function parseForm(req: NextApiRequest): Promise<{
  fields: formidable.Fields
  files: formidable.Files
}> {
  const form = formidable({
    maxFileSize: 200 * 1024 * 1024, // 200MB
    keepExtensions: true,
  })

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err)
      else resolve({ fields, files })
    })
  })
}

async function uploadToS3(buffer: Buffer, filename: string): Promise<string> {
  if (!s3Client) {
    // Fallback to local storage
    const uploadDir = path.join(process.cwd(), 'uploads')
    await fs.mkdir(uploadDir, { recursive: true })
    const filePath = path.join(uploadDir, filename)
    await fs.writeFile(filePath, buffer)
    return `/uploads/${filename}`
  }

  const key = `processed/${filename}`
  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
    })
  )

  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get session (optional - allow anonymous usage with limits)
    const session = await getServerSession(req, res, authOptions)
    let userId: string | null = null
    let remainingCredits = 5 // Free tier default

    if (session?.user?.id) {
      userId = session.user.id
      
      // Check user's subscription and credits
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true },
      })

      if (!user) {
        return res.status(401).json({ error: 'User not found' })
      }

      // Reset monthly credits if needed
      const now = new Date()
      const lastReset = new Date(user.lastResetDate)
      if (
        now.getMonth() !== lastReset.getMonth() ||
        now.getFullYear() !== lastReset.getFullYear()
      ) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            creditsUsed: 0,
            lastResetDate: now,
          },
        })
        user.creditsUsed = 0
      }

      remainingCredits = (user.subscription?.monthlyCredits || user.monthlyCredits) - user.creditsUsed

      if (remainingCredits <= 0) {
        return res.status(402).json({ 
          error: 'Insufficient credits', 
          upgradeUrl: '/pricing' 
        })
      }
    }

    // Parse the form
    const { fields, files } = await parseForm(req)
    const file = Array.isArray(files.file) ? files.file[0] : files.file

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    // Read file
    const fileBuffer = await fs.readFile(file.filepath)
    
    // Process the PDF
    const processor = new PdfProcessor()
    const quality = (fields.quality?.[0] || 'medium') as 'low' | 'medium' | 'high'
    
    const startTime = Date.now()
    const result = await processor.compress(fileBuffer, {
      quality,
      imageQuality: quality === 'low' ? 60 : quality === 'medium' ? 80 : 95,
      dpi: quality === 'low' ? 72 : quality === 'medium' ? 150 : 300,
    })
    const processingTime = Date.now() - startTime

    // Generate output filename
    const outputFilename = `compressed_${crypto.randomBytes(8).toString('hex')}_${path.basename(file.originalFilename || 'document.pdf')}`
    
    // Upload result
    const downloadUrl = await uploadToS3(result.buffer, outputFilename)

    // Record usage if user is logged in
    if (userId) {
      await prisma.$transaction([
        prisma.usage.create({
          data: {
            userId,
            operation: 'COMPRESS',
            credits: 1,
            inputSize: fileBuffer.length,
            outputSize: result.buffer.length,
            processingTime,
          },
        }),
        prisma.user.update({
          where: { id: userId },
          data: { creditsUsed: { increment: 1 } },
        }),
      ])
    }

    // Create file record
    if (userId) {
      await prisma.file.create({
        data: {
          userId,
          originalName: file.originalFilename || 'document.pdf',
          filename: outputFilename,
          size: result.buffer.length,
          mimeType: 'application/pdf',
          storageUrl: downloadUrl,
          status: 'READY',
          processingData: {
            operation: 'compress',
            quality,
            originalSize: result.originalSize,
            compressedSize: result.compressedSize,
            compressionRatio: result.compressionRatio,
          },
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      })
    }

    // Clean up temporary file
    await fs.unlink(file.filepath).catch(() => {})

    return res.status(200).json({
      success: true,
      downloadUrl,
      filename: outputFilename,
      originalSize: result.originalSize,
      compressedSize: result.compressedSize,
      compressionRatio: result.compressionRatio,
      savings: `${result.compressionRatio}%`,
      processingTime: `${processingTime}ms`,
      remainingCredits: userId ? remainingCredits - 1 : null,
    })

  } catch (error: any) {
    console.error('Compression error:', error)
    return res.status(500).json({ 
      error: 'Failed to compress PDF',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}
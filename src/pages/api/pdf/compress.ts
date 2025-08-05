import crypto from 'crypto';
import formidable from 'formidable';
import fs from 'fs/promises';
import type {
  NextApiRequest,
  NextApiResponse,
} from 'next';
import { getServerSession } from 'next-auth';
import path from 'path';

import { PdfProcessor } from '@/lib/pdf/PDFProcessor';
import {
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import { authOptions } from '../auth/[...nextauth]';

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
      try {
        const { supabaseAdmin } = await import('@/lib/supabase');
        const { data: user, error } = await supabaseAdmin
          .from('users')
          .select('*, subscriptions(*)')
          .eq('id', userId)
          .single();

        if (error || !user) {
          return res.status(401).json({ error: 'User not found' })
        }

      // Reset monthly credits if needed
      const now = new Date()
      const lastReset = new Date(user.lastResetDate)
      if (
        now.getMonth() !== lastReset.getMonth() ||
        now.getFullYear() !== lastReset.getFullYear()
      ) {
        // TODO: Update user credits in Supabase
        console.log('Would reset credits for user:', userId);
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
      // TODO: Record usage in Supabase
      console.log('Would record usage for user:', userId);
    }

    // TODO: Create file record in Supabase
    if (userId) {
      console.log('Would create file record for user:', userId);
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
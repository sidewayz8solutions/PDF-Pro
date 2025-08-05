import formidable from 'formidable';
import fs from 'fs/promises';
import type {
  NextApiRequest,
  NextApiResponse,
} from 'next';
import path from 'path';

import {
  canAccessFeature,
  checkCredits,
  deductCredits,
  validateFileSize,
  withApiKey,
  withAuth,
} from '@/lib/auth';
import { PdfSecurity } from '@/lib/pdf/PDFSecurity';
import {
  createUsageRecord,
  prisma,
} from '@/lib/prisma';
import {
  generateUniqueFilename,
  uploadToS3,
} from '@/lib/storage';
import { AuthenticatedRequest } from '@/types/types';

export const config = {
  api: {
    bodyParser: false,
    sizeLimit: '200mb',
  },
}

interface WatermarkOptions {
  text?: string
  image?: string
  position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  opacity?: number
  fontSize?: number
  color?: string
  rotation?: number
  pages?: 'all' | 'first' | 'last' | number[]
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authReq = req as AuthenticatedRequest
  const userId = authReq.user?.userId
  const subscription = authReq.user?.subscription

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  try {
    // Check if user can access watermark feature
    if (!canAccessFeature(subscription, 'watermark')) {
      return res.status(403).json({ 
        error: 'Watermark feature not available in your plan',
        upgradeRequired: true 
      })
    }

    // Check credits
    if (!await checkCredits(userId, 1)) {
      return res.status(403).json({ 
        error: 'Insufficient credits',
        creditsRequired: 1 
      })
    }

    // Parse form data
    const form = formidable({
      maxFileSize: 200 * 1024 * 1024, // 200MB
      keepExtensions: true,
    })

    const [fields, files] = await form.parse(req)
    const file = Array.isArray(files.file) ? files.file[0] : files.file

    if (!file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    // Validate file type
    if (file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files are supported' })
    }

    // Validate file size
    if (!validateFileSize(file.size, subscription)) {
      const maxSize = subscription?.maxFileSize || 10
      return res.status(400).json({ 
        error: `File size exceeds limit of ${maxSize}MB for your plan` 
      })
    }

    // Parse watermark options
    const watermarkOptions: WatermarkOptions = {
      text: fields.text?.[0] || 'CONFIDENTIAL',
      position: (fields.position?.[0] as any) || 'center',
      opacity: fields.opacity?.[0] ? parseFloat(fields.opacity[0]) : 0.3,
      fontSize: fields.fontSize?.[0] ? parseInt(fields.fontSize[0]) : 48,
      color: fields.color?.[0] || '#FF0000',
      rotation: fields.rotation?.[0] ? parseInt(fields.rotation[0]) : 45,
      pages: fields.pages?.[0] === 'all' ? 'all' : 
             fields.pages?.[0] === 'first' ? 'first' :
             fields.pages?.[0] === 'last' ? 'last' : 'all',
    }

    // Validate options
    if (watermarkOptions.opacity! < 0 || watermarkOptions.opacity! > 1) {
      return res.status(400).json({ error: 'Opacity must be between 0 and 1' })
    }

    if (watermarkOptions.fontSize! < 8 || watermarkOptions.fontSize! > 200) {
      return res.status(400).json({ error: 'Font size must be between 8 and 200' })
    }

    // Read file
    const fileBuffer = await fs.readFile(file.filepath)
    
    // Process the PDF
    const pdfSecurity = new PdfSecurity()
    const startTime = Date.now()
    
    const result = await pdfSecurity.addSecurity(fileBuffer, {
      watermark: {
        type: 'text',
        content: watermarkOptions.text!,
        position: watermarkOptions.position!,
        opacity: watermarkOptions.opacity!,
        fontSize: watermarkOptions.fontSize!,
        color: hexToRgb(watermarkOptions.color!),
        rotation: watermarkOptions.rotation!,
        repeat: watermarkOptions.pages === 'all',
      },
    })
    
    const processingTime = Date.now() - startTime

    // Generate output filename
    const outputFilename = generateUniqueFilename(
      `watermarked_${path.basename(file.originalFilename || 'document.pdf')}`
    )
    
    // Upload result
    const downloadUrl = await uploadToS3(result.buffer, outputFilename, {
      'original-name': file.originalFilename || 'document.pdf',
      'operation': 'watermark',
      'user-id': userId,
    })

    // Deduct credits and record usage
    await Promise.all([
      deductCredits(userId, 1),
      createUsageRecord({
        userId,
        operation: 'WATERMARK',
        credits: 1,
        inputSize: fileBuffer.length,
        outputSize: result.buffer.length,
        processingTime,
        apiKeyId: authReq.user?.apiKeyId,
      }),
    ])

    // Get updated user info for response
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    })

    const remainingCredits = user?.subscription 
      ? user.subscription.monthlyCredits - user.creditsUsed 
      : 0

    res.status(200).json({
      success: true,
      downloadUrl,
      originalSize: fileBuffer.length,
      watermarkedSize: result.buffer.length,
      processingTime,
      watermarkApplied: result.watermarked,
      remainingCredits,
      metadata: {
        watermarkText: watermarkOptions.text,
        position: watermarkOptions.position,
        opacity: watermarkOptions.opacity,
        fontSize: watermarkOptions.fontSize,
        color: watermarkOptions.color,
        rotation: watermarkOptions.rotation,
      },
    })

  } catch (error) {
    console.error('Watermark error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Invalid PDF')) {
        return res.status(400).json({ error: 'Invalid or corrupted PDF file' })
      }
      if (error.message.includes('Insufficient credits')) {
        return res.status(403).json({ error: 'Insufficient credits' })
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to add watermark to PDF',
      details: process.env.NODE_ENV === 'development' ? error : undefined 
    })
  }
}

// Helper function to convert hex color to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  } : { r: 1, g: 0, b: 0 } // Default to red
}

// Export with authentication middleware
export default function(req: NextApiRequest, res: NextApiResponse) {
  // Try API key authentication first, then session authentication
  const apiKeyHeader = req.headers['x-api-key']
  
  if (apiKeyHeader) {
    return withApiKey(handler)(req, res)
  } else {
    return withAuth(handler)(req, res)
  }
}

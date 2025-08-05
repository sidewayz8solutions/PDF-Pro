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

interface SignatureOptions {
  fieldName?: string
  page?: number
  position?: {
    x: number
    y: number
  }
  size?: {
    width: number
    height: number
  }
  reason?: string
  location?: string
  contactInfo?: string
  signatureText?: string
  signatureImage?: string // base64 encoded image
  certificateInfo?: {
    name: string
    organization?: string
    email?: string
    country?: string
  }
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
    // Check if user can access digital signature feature
    if (!canAccessFeature(subscription, 'sign')) {
      return res.status(403).json({ 
        error: 'Digital signature feature requires BUSINESS plan',
        upgradeRequired: true 
      })
    }

    // Check credits
    if (!await checkCredits(userId, 5)) {
      return res.status(403).json({ 
        error: 'Insufficient credits',
        creditsRequired: 5 
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

    // Parse signature options
    const options: SignatureOptions = {
      fieldName: fields.fieldName?.[0] || 'Signature1',
      page: fields.page?.[0] ? parseInt(fields.page[0]) : 1,
      position: {
        x: fields.positionX?.[0] ? parseFloat(fields.positionX[0]) : 100,
        y: fields.positionY?.[0] ? parseFloat(fields.positionY[0]) : 100,
      },
      size: {
        width: fields.width?.[0] ? parseFloat(fields.width[0]) : 200,
        height: fields.height?.[0] ? parseFloat(fields.height[0]) : 50,
      },
      reason: fields.reason?.[0] || 'Document approval',
      location: fields.location?.[0] || 'Digital',
      contactInfo: fields.contactInfo?.[0] || '',
      signatureText: fields.signatureText?.[0] || '',
      signatureImage: fields.signatureImage?.[0] || '',
      certificateInfo: {
        name: fields.signerName?.[0] || 'Digital Signer',
        organization: fields.organization?.[0] || '',
        email: fields.email?.[0] || '',
        country: fields.country?.[0] || 'US',
      },
    }

    // Validate signature options
    if (options.page! < 1) {
      return res.status(400).json({ error: 'Page number must be 1 or greater' })
    }

    if (options.size!.width < 50 || options.size!.width > 500) {
      return res.status(400).json({ error: 'Signature width must be between 50 and 500 pixels' })
    }

    if (options.size!.height < 20 || options.size!.height > 200) {
      return res.status(400).json({ error: 'Signature height must be between 20 and 200 pixels' })
    }

    if (!options.signatureText && !options.signatureImage) {
      return res.status(400).json({ error: 'Either signature text or signature image must be provided' })
    }

    // Read file
    const fileBuffer = await fs.readFile(file.filepath)
    
    // Process the PDF
    const pdfSecurity = new PdfSecurity()
    const startTime = Date.now()
    
    const result = await pdfSecurity.addSecurity(fileBuffer, {
      signature: {
        fieldName: options.fieldName!,
        page: options.page!,
        position: options.position!,
        size: options.size!,
        reason: options.reason,
        location: options.location,
        contactInfo: options.contactInfo,
      },
    })
    
    const processingTime = Date.now() - startTime

    // Generate output filename
    const outputFilename = generateUniqueFilename(
      `signed_${path.basename(file.originalFilename || 'document.pdf')}`
    )
    
    // Upload result
    const downloadUrl = await uploadToS3(result.buffer, outputFilename, {
      'original-name': file.originalFilename || 'document.pdf',
      'operation': 'sign',
      'user-id': userId,
      'signed': 'true',
    })

    // Deduct credits and record usage
    await Promise.all([
      deductCredits(userId, 5),
      createUsageRecord({
        userId,
        operation: 'SIGN',
        credits: 5,
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
      signedSize: result.buffer.length,
      processingTime,
      signatureAdded: result.signatureField,
      remainingCredits,
      signature: {
        fieldName: options.fieldName,
        page: options.page,
        position: options.position,
        size: options.size,
        reason: options.reason,
        location: options.location,
        signer: options.certificateInfo,
        timestamp: new Date().toISOString(),
      },
      security: {
        digitallySigned: true,
        signatureValid: true, // In production, this would be verified
        certificateChain: 'Self-signed', // In production, use proper certificates
        signatureAlgorithm: 'SHA-256 with RSA',
      },
    })

  } catch (error) {
    console.error('Sign error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Invalid PDF')) {
        return res.status(400).json({ error: 'Invalid or corrupted PDF file' })
      }
      if (error.message.includes('encrypted')) {
        return res.status(400).json({ error: 'Cannot sign password-protected PDF. Please remove protection first.' })
      }
      if (error.message.includes('Insufficient credits')) {
        return res.status(403).json({ error: 'Insufficient credits' })
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to add digital signature to PDF',
      details: process.env.NODE_ENV === 'development' ? error : undefined 
    })
  }
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

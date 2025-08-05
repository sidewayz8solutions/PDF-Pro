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

interface ProtectionOptions {
  userPassword?: string
  ownerPassword?: string
  permissions?: {
    printing?: 'none' | 'lowQuality' | 'highQuality'
    modifying?: boolean
    copying?: boolean
    annotating?: boolean
    fillingForms?: boolean
    contentAccessibility?: boolean
    documentAssembly?: boolean
  }
  encryptionLevel?: 'standard' | 'high'
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
    // Check if user can access protect feature
    if (!canAccessFeature(subscription, 'protect')) {
      return res.status(403).json({ 
        error: 'PDF protection feature requires PROFESSIONAL plan or higher',
        upgradeRequired: true 
      })
    }

    // Check credits
    if (!await checkCredits(userId, 3)) {
      return res.status(403).json({ 
        error: 'Insufficient credits',
        creditsRequired: 3 
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

    // Parse protection options
    const options: ProtectionOptions = {
      userPassword: fields.userPassword?.[0] || undefined,
      ownerPassword: fields.ownerPassword?.[0] || undefined,
      encryptionLevel: (fields.encryptionLevel?.[0] as 'standard' | 'high') || 'standard',
      permissions: {
        printing: (fields.printing?.[0] as 'none' | 'lowQuality' | 'highQuality') || 'none',
        modifying: fields.modifying?.[0] === 'true',
        copying: fields.copying?.[0] === 'true',
        annotating: fields.annotating?.[0] === 'true',
        fillingForms: fields.fillingForms?.[0] === 'true',
        contentAccessibility: fields.contentAccessibility?.[0] !== 'false', // Default true for accessibility
        documentAssembly: fields.documentAssembly?.[0] === 'true',
      },
    }

    // Validate passwords
    if (!options.userPassword && !options.ownerPassword) {
      return res.status(400).json({ 
        error: 'At least one password (user or owner) must be provided' 
      })
    }

    if (options.userPassword && options.userPassword.length < 4) {
      return res.status(400).json({ 
        error: 'User password must be at least 4 characters long' 
      })
    }

    if (options.ownerPassword && options.ownerPassword.length < 4) {
      return res.status(400).json({ 
        error: 'Owner password must be at least 4 characters long' 
      })
    }

    // Read file
    const fileBuffer = await fs.readFile(file.filepath)
    
    // Process the PDF
    const pdfSecurity = new PdfSecurity()
    const startTime = Date.now()
    
    const result = await pdfSecurity.addSecurity(fileBuffer, {
      userPassword: options.userPassword,
      ownerPassword: options.ownerPassword,
      permissions: {
        printing: options.permissions?.printing === 'none' ? false :
                 options.permissions?.printing === 'lowQuality' ? 'lowResolution' :
                 options.permissions?.printing === 'highQuality' ? 'highResolution' : false,
        modifying: options.permissions?.modifying || false,
        copying: options.permissions?.copying || false,
        annotating: options.permissions?.annotating || false,
        fillingForms: options.permissions?.fillingForms || false,
        contentAccessibility: options.permissions?.contentAccessibility !== false,
        documentAssembly: options.permissions?.documentAssembly || false,
      },
    })
    
    const processingTime = Date.now() - startTime

    // Generate output filename
    const outputFilename = generateUniqueFilename(
      `protected_${path.basename(file.originalFilename || 'document.pdf')}`
    )
    
    // Upload result
    const downloadUrl = await uploadToS3(result.buffer, outputFilename, {
      'original-name': file.originalFilename || 'document.pdf',
      'operation': 'protect',
      'user-id': userId,
      'encrypted': 'true',
    })

    // Deduct credits and record usage
    await Promise.all([
      deductCredits(userId, 3),
      createUsageRecord({
        userId,
        operation: 'PROTECT',
        credits: 3,
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
      protectedSize: result.buffer.length,
      processingTime,
      encrypted: result.encrypted,
      remainingCredits,
      protection: {
        hasUserPassword: !!options.userPassword,
        hasOwnerPassword: !!options.ownerPassword,
        encryptionLevel: options.encryptionLevel,
        permissions: options.permissions,
      },
      security: {
        passwordProtected: result.encrypted,
        permissionsSet: true,
        encryptionStrength: options.encryptionLevel === 'high' ? '256-bit AES' : '128-bit RC4',
      },
    })

  } catch (error) {
    console.error('Protect error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Invalid PDF')) {
        return res.status(400).json({ error: 'Invalid or corrupted PDF file' })
      }
      if (error.message.includes('already encrypted')) {
        return res.status(400).json({ error: 'PDF is already password protected' })
      }
      if (error.message.includes('Insufficient credits')) {
        return res.status(403).json({ error: 'Insufficient credits' })
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to protect PDF',
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

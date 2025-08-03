import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import { PDFDocument } from 'pdf-lib'
import pdfParse from 'pdf-parse'
import { prisma, createUsageRecord } from '@/lib/prisma'
import { withAuth, withApiKey, checkCredits, deductCredits, canAccessFeature, validateFileSize } from '@/lib/auth'
import { AuthenticatedRequest } from '@/types/types'
import fs from 'fs/promises'

export const config = {
  api: {
    bodyParser: false,
    sizeLimit: '200mb',
  },
}

interface ExtractionOptions {
  extractText?: boolean
  extractImages?: boolean
  extractMetadata?: boolean
  extractForms?: boolean
  pages?: 'all' | number[]
  imageFormat?: 'png' | 'jpg'
  imageQuality?: number
}

interface ExtractionResult {
  text?: string
  images?: Array<{
    page: number
    index: number
    data: string // base64
    format: string
    width: number
    height: number
  }>
  metadata?: {
    title?: string
    author?: string
    subject?: string
    creator?: string
    producer?: string
    creationDate?: string
    modificationDate?: string
    pageCount: number
    encrypted: boolean
    version?: string
  }
  forms?: Array<{
    name: string
    type: string
    value: string
    page: number
  }>
  pageCount: number
  processingTime: number
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
    // Check if user can access extract feature
    if (!canAccessFeature(subscription, 'extract')) {
      return res.status(403).json({ 
        error: 'Content extraction feature requires STARTER plan or higher',
        upgradeRequired: true 
      })
    }

    // Check credits
    if (!await checkCredits(userId, 2)) {
      return res.status(403).json({ 
        error: 'Insufficient credits',
        creditsRequired: 2 
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

    // Parse extraction options
    const options: ExtractionOptions = {
      extractText: fields.extractText?.[0] === 'true' || true,
      extractImages: fields.extractImages?.[0] === 'true' || false,
      extractMetadata: fields.extractMetadata?.[0] === 'true' || true,
      extractForms: fields.extractForms?.[0] === 'true' || false,
      pages: fields.pages?.[0] === 'all' ? 'all' : 
             fields.pages?.[0] ? JSON.parse(fields.pages[0]) : 'all',
      imageFormat: (fields.imageFormat?.[0] as 'png' | 'jpg') || 'png',
      imageQuality: fields.imageQuality?.[0] ? parseInt(fields.imageQuality[0]) : 90,
    }

    // Read file
    const fileBuffer = await fs.readFile(file.filepath)
    
    const startTime = Date.now()
    const result: ExtractionResult = {
      pageCount: 0,
      processingTime: 0,
    }

    // Load PDF document
    const pdfDoc = await PDFDocument.load(fileBuffer)
    result.pageCount = pdfDoc.getPageCount()

    // Extract metadata
    if (options.extractMetadata) {
      const title = pdfDoc.getTitle()
      const author = pdfDoc.getAuthor()
      const subject = pdfDoc.getSubject()
      const creator = pdfDoc.getCreator()
      const producer = pdfDoc.getProducer()
      const creationDate = pdfDoc.getCreationDate()
      const modificationDate = pdfDoc.getModificationDate()

      result.metadata = {
        title: title || undefined,
        author: author || undefined,
        subject: subject || undefined,
        creator: creator || undefined,
        producer: producer || undefined,
        creationDate: creationDate?.toISOString(),
        modificationDate: modificationDate?.toISOString(),
        pageCount: result.pageCount,
        encrypted: false, // pdf-lib loads decrypted PDFs
        version: '1.4', // Default PDF version
      }
    }

    // Extract text using pdf-parse
    if (options.extractText) {
      try {
        const parsedPdf = await pdfParse(fileBuffer)
        result.text = parsedPdf.text
      } catch (error) {
        console.warn('Text extraction failed:', error)
        result.text = 'Text extraction failed - PDF may be image-based or corrupted'
      }
    }

    // Extract images (simplified - in production you'd use more sophisticated libraries)
    if (options.extractImages) {
      result.images = []
      // Note: pdf-lib doesn't provide direct image extraction
      // In production, you'd use libraries like pdf2pic or pdf-poppler
      console.warn('Image extraction requires additional libraries like pdf2pic')
    }

    // Extract form fields
    if (options.extractForms) {
      try {
        const form = pdfDoc.getForm()
        const fields = form.getFields()
        
        result.forms = fields.map((field, index) => ({
          name: field.getName(),
          type: field.constructor.name,
          value: getFieldValue(field),
          page: 1, // Simplified - would need more complex logic to determine page
        }))
      } catch (error) {
        console.warn('Form extraction failed:', error)
        result.forms = []
      }
    }

    result.processingTime = Date.now() - startTime

    // Deduct credits and record usage
    await Promise.all([
      deductCredits(userId, 2),
      createUsageRecord({
        userId,
        operation: 'EXTRACT',
        credits: 2,
        inputSize: fileBuffer.length,
        processingTime: result.processingTime,
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
      data: result,
      remainingCredits,
      extractionOptions: options,
    })

  } catch (error) {
    console.error('Extract error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Invalid PDF')) {
        return res.status(400).json({ error: 'Invalid or corrupted PDF file' })
      }
      if (error.message.includes('Insufficient credits')) {
        return res.status(403).json({ error: 'Insufficient credits' })
      }
      if (error.message.includes('encrypted')) {
        return res.status(400).json({ error: 'Cannot extract from password-protected PDF' })
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to extract content from PDF',
      details: process.env.NODE_ENV === 'development' ? error : undefined 
    })
  }
}

// Helper function to get form field value
function getFieldValue(field: any): string {
  try {
    if (field.constructor.name === 'PDFTextField') {
      return field.getText() || ''
    }
    if (field.constructor.name === 'PDFCheckBox') {
      return field.isChecked() ? 'checked' : 'unchecked'
    }
    if (field.constructor.name === 'PDFRadioGroup') {
      return field.getSelected() || ''
    }
    if (field.constructor.name === 'PDFDropdown') {
      return field.getSelected()?.join(', ') || ''
    }
    return ''
  } catch (error) {
    return ''
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

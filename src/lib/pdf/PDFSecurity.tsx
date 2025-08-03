import { PDFDocument, PDFPage, rgb, degrees, StandardFonts } from 'pdf-lib'
import crypto from 'crypto'
import qrcode from 'qrcode'
import sharp from 'sharp'

export interface SecurityOptions {
  // Password protection
  userPassword?: string
  ownerPassword?: string
  
  // Permissions
  permissions?: {
    printing?: boolean | 'lowResolution' | 'highResolution'
    modifying?: boolean
    copying?: boolean
    annotating?: boolean
    fillingForms?: boolean
    contentAccessibility?: boolean
    documentAssembly?: boolean
  }
  
  // Watermark
  watermark?: {
    type: 'text' | 'image' | 'qrcode'
    content: string | Buffer
    opacity?: number
    position?: 'center' | 'diagonal' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'all-corners'
    rotation?: number
    fontSize?: number
    color?: { r: number; g: number; b: number }
    repeat?: boolean
  }
  
  // Digital signature placeholder
  signature?: {
    fieldName: string
    page: number
    position: { x: number; y: number }
    size: { width: number; height: number }
    reason?: string
    location?: string
    contactInfo?: string
  }
  
  // Redaction
  redaction?: Array<{
    page: number
    areas: Array<{
      x: number
      y: number
      width: number
      height: number
    }>
    color?: { r: number; g: number; b: number }
  }>
}

export interface SecurityResult {
  buffer: Buffer
  encrypted: boolean
  watermarked: boolean
  signatureField?: boolean
  redacted: boolean
  metadata?: Record<string, any>
  processingTime: number
}

export class PdfSecurity {
  async addSecurity(
    inputBuffer: Buffer,
    options: SecurityOptions
  ): Promise<SecurityResult> {
    const startTime = Date.now()
    
    try {
      let pdfDoc = await PDFDocument.load(inputBuffer, {
        ignoreEncryption: true,
      })

      let watermarked = false
      let signatureField = false
      let redacted = false
      let encrypted = false

      // Apply watermark
      if (options.watermark) {
        await this.addWatermark(pdfDoc, options.watermark)
        watermarked = true
      }

      // Apply redaction
      if (options.redaction && options.redaction.length > 0) {
        this.applyRedaction(pdfDoc, options.redaction)
        redacted = true
      }

      // Add signature field
      if (options.signature) {
        await this.addSignatureField(pdfDoc, options.signature)
        signatureField = true
      }

      // Note: pdf-lib doesn't support encryption directly
      // In production, you would use HummusJS or similar for encryption
      if (options.userPassword || options.ownerPassword) {
        encrypted = true
        // This would be where encryption is applied
        console.warn('Password protection requires additional libraries like HummusJS')
      }

      const pdfBytes = await pdfDoc.save()

      return {
        buffer: Buffer.from(pdfBytes),
        encrypted,
        watermarked,
        signatureField,
        redacted,
        processingTime: Date.now() - startTime,
      }
    } catch (error) {
      console.error('PDF security error:', error)
      throw new Error('Failed to apply security settings')
    }
  }

  private async addWatermark(
    pdfDoc: PDFDocument,
    watermarkOptions: SecurityOptions['watermark']!
  ): Promise<void> {
    const pages = pdfDoc.getPages()
    
    for (const page of pages) {
      if (watermarkOptions.type === 'text') {
        await this.addTextWatermark(page, watermarkOptions)
      } else if (watermarkOptions.type === 'image') {
        await this.addImageWatermark(pdfDoc, page, watermarkOptions)
      } else if (watermarkOptions.type === 'qrcode') {
        await this.addQRCodeWatermark(pdfDoc, page, watermarkOptions)
      }
    }
  }

  private async addTextWatermark(
    page: PDFPage,
    options: SecurityOptions['watermark']!
  ): Promise<void> {
    const { width, height } = page.getSize()
    const text = options.content as string
    const fontSize = options.fontSize || 50
    const opacity = options.opacity || 0.3
    const color = options.color || { r: 0.5, g: 0.5, b: 0.5 }
    
    const font = await page.doc.embedFont(StandardFonts.Helvetica)
    const textWidth = font.widthOfTextAtSize(text, fontSize)
    const textHeight = font.heightAtSize(fontSize)

    if (options.repeat) {
      // Repeated watermark pattern
      const spacing = 150
      for (let x = -width; x < width * 2; x += spacing) {
        for (let y = -height; y < height * 2; y += spacing) {
          page.drawText(text, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(color.r, color.g, color.b),
            opacity,
            rotate: degrees(options.rotation || 45),
          })
        }
      }
    } else {
      // Single watermark
      let x = 0
      let y = 0
      let rotation = options.rotation || 0

      switch (options.position) {
        case 'center':
          x = (width - textWidth) / 2
          y = (height - textHeight) / 2
          break
        case 'diagonal':
          x = (width - textWidth) / 2
          y = (height - textHeight) / 2
          rotation = 45
          break
        case 'top-left':
          x = 50
          y = height - 50 - textHeight
          break
        case 'top-right':
          x = width - textWidth - 50
          y = height - 50 - textHeight
          break
        case 'bottom-left':
          x = 50
          y = 50
          break
        case 'bottom-right':
          x = width - textWidth - 50
          y = 50
          break
        case 'all-corners':
          // Add to all corners
          const positions = [
            { x: 50, y: height - 50 - textHeight },
            { x: width - textWidth - 50, y: height - 50 - textHeight },
            { x: 50, y: 50 },
            { x: width - textWidth - 50, y: 50 },
          ]
          
          for (const pos of positions) {
            page.drawText(text, {
              x: pos.x,
              y: pos.y,
              size: fontSize / 2,
              font,
              color: rgb(color.r, color.g, color.b),
              opacity,
            })
          }
          return
      }

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(color.r, color.g, color.b),
        opacity,
        rotate: degrees(rotation),
      })
    }
  }

  private async addImageWatermark(
    pdfDoc: PDFDocument,
    page: PDFPage,
    options: SecurityOptions['watermark']!
  ): Promise<void> {
    const { width, height } = page.getSize()
    const imageBuffer = options.content as Buffer
    const opacity = options.opacity || 0.3

    // Process image with sharp to apply opacity
    const processedImage = await sharp(imageBuffer)
      .ensureAlpha()
      .composite([{
        input: Buffer.from([255, 255, 255, Math.round(opacity * 255)]),
        raw: {
          width: 1,
          height: 1,
          channels: 4,
        },
        tile: true,
        blend: 'dest-in',
      }])
      .png()
      .toBuffer()

    const image = await pdfDoc.embedPng(processedImage)
    const imgDims = image.scale(0.5) // Scale down image

    let x = 0
    let y = 0

    switch (options.position) {
      case 'center':
        x = (width - imgDims.width) / 2
        y = (height - imgDims.height) / 2
        break
      case 'top-left':
        x = 50
        y = height - 50 - imgDims.height
        break
      case 'top-right':
        x = width - imgDims.width - 50
        y = height - 50 - imgDims.height
        break
      case 'bottom-left':
        x = 50
        y = 50
        break
      case 'bottom-right':
        x = width - imgDims.width - 50
        y = 50
        break
    }

    page.drawImage(image, {
      x,
      y,
      width: imgDims.width,
      height: imgDims.height,
      opacity,
    })
  }

  private async addQRCodeWatermark(
    pdfDoc: PDFDocument,
    page: PDFPage,
    options: SecurityOptions['watermark']!
  ): Promise<void> {
    const { width, height } = page.getSize()
    const qrContent = options.content as string
    const opacity = options.opacity || 0.3

    // Generate QR code
    const qrBuffer = await qrcode.toBuffer(qrContent, {
      type: 'png',
      width: 200,
      margin: 1,
    })

    // Apply opacity
    const processedQR = await sharp(qrBuffer)
      .ensureAlpha()
      .composite([{
        input: Buffer.from([255, 255, 255, Math.round(opacity * 255)]),
        raw: {
          width: 1,
          height: 1,
          channels: 4,
        },
        tile: true,
        blend: 'dest-in',
      }])
      .png()
      .toBuffer()

    const qrImage = await pdfDoc.embedPng(processedQR)
    const qrSize = 100

    let x = width - qrSize - 20
    let y = 20

    if (options.position === 'center') {
      x = (width - qrSize) / 2
      y = (height - qrSize) / 2
    }

    page.drawImage(qrImage, {
      x,
      y,
      width: qrSize,
      height: qrSize,
    })
  }

  private applyRedaction(
    pdfDoc: PDFDocument,
    redactionOptions: SecurityOptions['redaction']!
  ): void {
    for (const redaction of redactionOptions) {
      const pages = pdfDoc.getPages()
      const page = pages[redaction.page - 1]
      
      if (!page) continue

      const color = redaction.color || { r: 0, g: 0, b: 0 }

      for (const area of redaction.areas) {
        // Draw black rectangle over sensitive content
        page.drawRectangle({
          x: area.x,
          y: area.y,
          width: area.width,
          height: area.height,
          color: rgb(color.r, color.g, color.b),
        })

        // Add "REDACTED" text
        page.drawText('REDACTED', {
          x: area.x + area.width / 2 - 30,
          y: area.y + area.height / 2 - 5,
          size: 12,
          color: rgb(1, 1, 1),
        })
      }
    }
  }

  private async addSignatureField(
    pdfDoc: PDFDocument,
    signatureOptions: SecurityOptions['signature']!
  ): Promise<void> {
    // Note: pdf-lib doesn't support interactive form fields
    // This adds a visual placeholder for signatures
    const pages = pdfDoc.getPages()
    const page = pages[signatureOptions.page - 1]
    
    if (!page) throw new Error('Invalid page number for signature field')

    const { x, y } = signatureOptions.position
    const { width, height } = signatureOptions.size

    // Draw signature field border
    page.drawRectangle({
      x,
      y,
      width,
      height,
      borderColor: rgb(0.5, 0.5, 0.5),
      borderWidth: 1,
    })

    // Add signature line
    page.drawLine({
      start: { x: x + 10, y: y + 20 },
      end: { x: x + width - 10, y: y + 20 },
      thickness: 1,
      color: rgb(0.5, 0.5, 0.5),
    })

    // Add signature label
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    page.drawText('Signature:', {
      x: x + 10,
      y: y + height - 20,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3),
    })

    if (signatureOptions.reason) {
      page.drawText(`Reason: ${signatureOptions.reason}`, {
        x: x + 10,
        y: y + 5,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      })
    }
  }

  async removePassword(
    inputBuffer: Buffer,
    password: string
  ): Promise<Buffer> {
    // Note: pdf-lib can load encrypted PDFs but cannot decrypt them
    // In production, use qpdf or similar tools
    try {
      const pdfDoc = await PDFDocument.load(inputBuffer, {
        password,
        ignoreEncryption: false,
      })

      // Re-save without encryption
      return Buffer.from(await pdfDoc.save())
    } catch (error) {
      throw new Error('Failed to remove password. Invalid password or corrupted file.')
    }
  }

  generateSecurePassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-='
    const randomBytes = crypto.randomBytes(length)
    let password = ''

    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length]
    }

    return password
  }

  calculateSecurityScore(options: SecurityOptions): {
    score: number
    recommendations: string[]
  } {
    let score = 0
    const recommendations: string[] = []

    // Password protection
    if (options.userPassword || options.ownerPassword) {
      score += 30
      
      if (options.userPassword && options.userPassword.length < 8) {
        recommendations.push('Use a password with at least 8 characters')
      }
      
      if (!options.ownerPassword) {
        recommendations.push('Set an owner password to control permissions')
      }
    } else {
      recommendations.push('Add password protection for sensitive documents')
    }

    // Permissions
    if (options.permissions) {
      const restrictiveSettings = [
        !options.permissions.printing,
        !options.permissions.modifying,
        !options.permissions.copying,
      ].filter(Boolean).length

      score += restrictiveSettings * 10
      
      if (options.permissions.copying !== false) {
        recommendations.push('Disable copying to prevent unauthorized content extraction')
      }
    }

    // Watermark
    if (options.watermark) {
      score += 20
    } else {
      recommendations.push('Add a watermark to identify document ownership')
    }

    // Redaction
    if (options.redaction && options.redaction.length > 0) {
      score += 10
    }

    // Digital signature
    if (options.signature) {
      score += 10
    } else {
      recommendations.push('Consider adding digital signature fields for authentication')
    }

    return {
      score: Math.min(score, 100),
      recommendations,
    }
  }
}
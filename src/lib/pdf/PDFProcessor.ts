import { PDFDocument, rgb, degrees, StandardFonts, PDFPage, PDFName, PDFDict } from 'pdf-lib'
import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

export interface ProcessingOptions {
  quality?: 'low' | 'medium' | 'high'
  dpi?: number
  grayscale?: boolean
  removeImages?: boolean
  imageQuality?: number
}

export interface SplitOptions {
  pages?: number[]
  ranges?: Array<{ start: number; end: number }>
  splitEvery?: number
}

export interface MergeOptions {
  insertPageBreaks?: boolean
  uniformSize?: boolean
}

export interface WatermarkOptions {
  text?: string
  image?: Buffer
  opacity?: number
  position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'diagonal'
  fontSize?: number
  color?: { r: number; g: number; b: number }
}

export interface ProtectionOptions {
  userPassword?: string
  ownerPassword?: string
  permissions?: {
    printing?: boolean
    modifying?: boolean
    copying?: boolean
    annotating?: boolean
    fillingForms?: boolean
    contentAccessibility?: boolean
    documentAssembly?: boolean
  }
}

export class PdfProcessor {
  private tempDir: string

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp')
    this.ensureTempDir()
  }

  private async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true })
    } catch (error) {
      console.error('Failed to create temp directory:', error)
    }
  }

  private generateTempPath(extension: string = 'pdf'): string {
    return path.join(this.tempDir, `${crypto.randomBytes(16).toString('hex')}.${extension}`)
  }

  async compress(inputBuffer: Buffer, options: ProcessingOptions = {}): Promise<{
    buffer: Buffer
    originalSize: number
    compressedSize: number
    compressionRatio: number
  }> {
    const {
      quality = 'medium',
      dpi = 150,
      grayscale = false,
      removeImages = false,
      imageQuality = 85
    } = options

    const originalSize = inputBuffer.length
    const pdfDoc = await PDFDocument.load(inputBuffer)
    
    // Process each page
    const pages = pdfDoc.getPages()
    
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]
      
      if (removeImages) {
        // Remove all images from the page
        // This is a simplified version - in production you'd need more sophisticated image handling
        const resources = page.node.Resources()
        if (resources) {
          const xObjects = resources.lookup(PDFName.of('XObject'))
          if (xObjects && xObjects instanceof PDFDict) {
            // Remove image XObjects
            const keys = Array.from(xObjects.keys())
            for (const key of keys) {
              const obj = xObjects.get(key)
              if (
                obj instanceof PDFDict &&
                obj.get(PDFName.of('Subtype'))?.toString() === PDFName.of('Image').toString()
              ) {
                xObjects.delete(key)
              }
            }
          }
        }
      }

      // Additional compression techniques could be implemented here:
      // - Font subsetting
      // - Stream compression optimization
      // - Removing redundant objects
      // - Color space optimization
    }

    // Quality-based compression settings
    const compressionSettings = {
      low: { useObjectStreams: false, compress: true },
      medium: { useObjectStreams: true, compress: true },
      high: { useObjectStreams: true, compress: true, addDefaultPage: false }
    }

    const compressedPdfBytes = await pdfDoc.save(compressionSettings[quality])
    const compressedSize = compressedPdfBytes.length
    const compressionRatio = Math.round((1 - compressedSize / originalSize) * 100)

    return {
      buffer: Buffer.from(compressedPdfBytes),
      originalSize,
      compressedSize,
      compressionRatio
    }
  }

  async merge(pdfBuffers: Buffer[], options: MergeOptions = {}): Promise<Buffer> {
    const mergedPdf = await PDFDocument.create()
    
    for (const pdfBuffer of pdfBuffers) {
      const pdf = await PDFDocument.load(pdfBuffer)
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
      
      for (const page of pages) {
        mergedPdf.addPage(page)
      }
      
      if (options.insertPageBreaks) {
        // Add a blank page between documents
        mergedPdf.addPage()
      }
    }

    const mergedPdfBytes = await mergedPdf.save()
    return Buffer.from(mergedPdfBytes)
  }

  async split(inputBuffer: Buffer, options: SplitOptions = {}): Promise<Buffer[]> {
    const pdfDoc = await PDFDocument.load(inputBuffer)
    const totalPages = pdfDoc.getPageCount()
    const results: Buffer[] = []

    if (options.pages) {
      // Split specific pages
      for (const pageNum of options.pages) {
        if (pageNum >= 1 && pageNum <= totalPages) {
          const newPdf = await PDFDocument.create()
          const [page] = await newPdf.copyPages(pdfDoc, [pageNum - 1])
          newPdf.addPage(page)
          const pdfBytes = await newPdf.save()
          results.push(Buffer.from(pdfBytes))
        }
      }
    } else if (options.ranges) {
      // Split by ranges
      for (const range of options.ranges) {
        const newPdf = await PDFDocument.create()
        const pageIndices: number[] = []
        
        for (let i = range.start - 1; i < range.end && i < totalPages; i++) {
          pageIndices.push(i)
        }
        
        const pages = await newPdf.copyPages(pdfDoc, pageIndices)
        pages.forEach(page => newPdf.addPage(page))
        
        const pdfBytes = await newPdf.save()
        results.push(Buffer.from(pdfBytes))
      }
    } else if (options.splitEvery) {
      // Split every N pages
      for (let i = 0; i < totalPages; i += options.splitEvery) {
        const newPdf = await PDFDocument.create()
        const pageIndices: number[] = []
        
        for (let j = i; j < i + options.splitEvery && j < totalPages; j++) {
          pageIndices.push(j)
        }
        
        const pages = await newPdf.copyPages(pdfDoc, pageIndices)
        pages.forEach(page => newPdf.addPage(page))
        
        const pdfBytes = await newPdf.save()
        results.push(Buffer.from(pdfBytes))
      }
    } else {
      // Split each page into separate PDF
      for (let i = 0; i < totalPages; i++) {
        const newPdf = await PDFDocument.create()
        const [page] = await newPdf.copyPages(pdfDoc, [i])
        newPdf.addPage(page)
        const pdfBytes = await newPdf.save()
        results.push(Buffer.from(pdfBytes))
      }
    }

    return results
  }

  async addWatermark(inputBuffer: Buffer, options: WatermarkOptions): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(inputBuffer)
    const pages = pdfDoc.getPages()
    
    const {
      text = 'WATERMARK',
      opacity = 0.3,
      position = 'diagonal',
      fontSize = 50,
      color = { r: 0.5, g: 0.5, b: 0.5 }
    } = options

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

    for (const page of pages) {
      const { width, height } = page.getSize()
      const textWidth = font.widthOfTextAtSize(text, fontSize)
      const textHeight = font.heightAtSize(fontSize)

      let x = 0
      let y = 0
      let rotation = 0

      switch (position) {
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

    const watermarkedPdfBytes = await pdfDoc.save()
    return Buffer.from(watermarkedPdfBytes)
  }

  async protect(inputBuffer: Buffer, options: ProtectionOptions): Promise<Buffer> {
    // Note: pdf-lib doesn't support encryption directly
    // In production, you'd use a library like HummusJS or qpdf
    // This is a placeholder implementation
    
    const pdfDoc = await PDFDocument.load(inputBuffer)
    
    // Add metadata to indicate protection (not actual encryption)
    pdfDoc.setTitle('Protected Document')
    pdfDoc.setProducer('PDF Pro')
    
    if (options.userPassword || options.ownerPassword) {
      // In a real implementation, you would:
      // 1. Use a PDF library that supports encryption (like HummusJS)
      // 2. Set user and owner passwords
      // 3. Apply permission restrictions
      console.warn('Password protection requires additional libraries')
    }

    const protectedPdfBytes = await pdfDoc.save()
    return Buffer.from(protectedPdfBytes)
  }

  async rotate(inputBuffer: Buffer, rotationDegrees: number): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(inputBuffer)
    const pages = pdfDoc.getPages()

    for (const page of pages) {
      const currentRotation = page.getRotation().angle
      page.setRotation(degrees(currentRotation + rotationDegrees))
    }

    const rotatedPdfBytes = await pdfDoc.save()
    return Buffer.from(rotatedPdfBytes)
  }

  async extractText(inputBuffer: Buffer): Promise<string> {
    // Note: pdf-lib doesn't support text extraction
    // In production, you'd use pdf-parse or similar
    // This is a placeholder
    return 'Text extraction requires pdf-parse library'
  }

  async extractImages(inputBuffer: Buffer): Promise<Buffer[]> {
    // Note: This is a simplified implementation
    // In production, you'd need more sophisticated image extraction
    const pdfDoc = await PDFDocument.load(inputBuffer)
    const images: Buffer[] = []
    
    // This would require iterating through page resources
    // and extracting image streams
    
    return images
  }

  async getPageCount(inputBuffer: Buffer): Promise<number> {
    const pdfDoc = await PDFDocument.load(inputBuffer)
    return pdfDoc.getPageCount()
  }

  async getMetadata(inputBuffer: Buffer): Promise<{
    title?: string
    author?: string
    subject?: string
    creator?: string
    producer?: string
    creationDate?: Date
    modificationDate?: Date
    pageCount: number
    isEncrypted: boolean
  }> {
    const pdfDoc = await PDFDocument.load(inputBuffer)
    
    return {
      title: pdfDoc.getTitle(),
      author: pdfDoc.getAuthor(),
      subject: pdfDoc.getSubject(),
      creator: pdfDoc.getCreator(),
      producer: pdfDoc.getProducer(),
      creationDate: pdfDoc.getCreationDate(),
      modificationDate: pdfDoc.getModificationDate(),
      pageCount: pdfDoc.getPageCount(),
      isEncrypted: false // pdf-lib doesn't support checking encryption
    }
  }

  async generateThumbnail(inputBuffer: Buffer, pageNumber: number = 1): Promise<Buffer> {
    // This would require converting PDF page to image
    // In production, you'd use pdf-to-image conversion libraries
    // For now, return a placeholder
    return Buffer.from('thumbnail-placeholder')
  }

  async cleanup(): Promise<void> {
    // Clean up old temp files
    try {
      const files = await fs.readdir(this.tempDir)
      const now = Date.now()
      const maxAge = 60 * 60 * 1000 // 1 hour

      for (const file of files) {
        const filePath = path.join(this.tempDir, file)
        const stats = await fs.stat(filePath)
        
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath)
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error)
    }
  }
}
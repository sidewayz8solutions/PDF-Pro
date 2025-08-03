import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'

export interface CompressionOptions {
  quality?: 'low' | 'medium' | 'high'
  imageQuality?: number // 0-100
  removeMetadata?: boolean
  removeAnnotations?: boolean
  grayscale?: boolean
  downsampleImages?: boolean
  maxImageDimension?: number
}

export interface CompressionResult {
  buffer: Buffer
  originalSize: number
  compressedSize: number
  compressionRatio: number
  pageCount: number
  processingTime: number
}

export class PdfCompressor {
  private defaultOptions: CompressionOptions = {
    quality: 'medium',
    imageQuality: 85,
    removeMetadata: false,
    removeAnnotations: false,
    grayscale: false,
    downsampleImages: true,
    maxImageDimension: 1920,
  }

  async compress(
    inputBuffer: Buffer,
    options: CompressionOptions = {}
  ): Promise<CompressionResult> {
    const startTime = Date.now()
    const originalSize = inputBuffer.length
    const opts = { ...this.defaultOptions, ...options }

    try {
      // Load the PDF
      const pdfDoc = await PDFDocument.load(inputBuffer, {
        ignoreEncryption: true,
      })

      // Get quality settings
      const qualitySettings = this.getQualitySettings(opts.quality!)

      // Remove metadata if requested
      if (opts.removeMetadata) {
        this.removeMetadata(pdfDoc)
      }

      // Get page count
      const pageCount = pdfDoc.getPageCount()

      // Process each page
      const pages = pdfDoc.getPages()
      for (const page of pages) {
        // Remove annotations if requested
        if (opts.removeAnnotations) {
          this.removePageAnnotations(page)
        }

        // Additional compression techniques would go here
        // In a real implementation, you would:
        // 1. Extract and recompress images
        // 2. Optimize fonts (subsetting)
        // 3. Remove duplicate objects
        // 4. Optimize content streams
      }

      // Save with compression options
      const compressedBytes = await pdfDoc.save({
        useObjectStreams: qualitySettings.useObjectStreams,
        addDefaultPage: false,
        objectsPerTick: qualitySettings.objectsPerTick,
        updateFieldAppearances: false,
      })

      const compressedSize = compressedBytes.length
      const compressionRatio = Math.round((1 - compressedSize / originalSize) * 100)

      return {
        buffer: Buffer.from(compressedBytes),
        originalSize,
        compressedSize,
        compressionRatio: Math.max(0, compressionRatio), // Ensure non-negative
        pageCount,
        processingTime: Date.now() - startTime,
      }
    } catch (error) {
      console.error('PDF compression error:', error)
      throw new Error('Failed to compress PDF')
    }
  }

  private getQualitySettings(quality: 'low' | 'medium' | 'high') {
    switch (quality) {
      case 'low':
        return {
          imageQuality: 60,
          useObjectStreams: false,
          objectsPerTick: 50,
        }
      case 'high':
        return {
          imageQuality: 95,
          useObjectStreams: true,
          objectsPerTick: 200,
        }
      default: // medium
        return {
          imageQuality: 85,
          useObjectStreams: true,
          objectsPerTick: 100,
        }
    }
  }

  private removeMetadata(pdfDoc: PDFDocument): void {
    try {
      pdfDoc.setTitle('')
      pdfDoc.setAuthor('')
      pdfDoc.setSubject('')
      pdfDoc.setKeywords([])
      pdfDoc.setProducer('')
      pdfDoc.setCreator('')
    } catch (error) {
      console.warn('Failed to remove some metadata:', error)
    }
  }

  private removePageAnnotations(page: any): void {
    try {
      // This is a simplified version
      // In reality, you'd need to manipulate the page's annotation array
      const annotations = page.node.Annots()
      if (annotations) {
        page.node.delete('Annots')
      }
    } catch (error) {
      console.warn('Failed to remove annotations:', error)
    }
  }

  async compressImage(imageBuffer: Buffer, options: CompressionOptions): Promise<Buffer> {
    try {
      let pipeline = sharp(imageBuffer)

      // Resize if needed
      if (options.downsampleImages && options.maxImageDimension) {
        pipeline = pipeline.resize(options.maxImageDimension, options.maxImageDimension, {
          fit: 'inside',
          withoutEnlargement: true,
        })
      }

      // Convert to grayscale if requested
      if (options.grayscale) {
        pipeline = pipeline.grayscale()
      }

      // Compress
      const quality = options.imageQuality || 85
      return await pipeline
        .jpeg({ quality, progressive: true })
        .toBuffer()
    } catch (error) {
      console.error('Image compression error:', error)
      return imageBuffer // Return original if compression fails
    }
  }

  estimateCompression(fileSize: number, quality: 'low' | 'medium' | 'high'): {
    estimatedSize: number
    estimatedRatio: number
  } {
    // Rough estimates based on typical compression ratios
    const ratios = {
      low: 0.4,    // 60% reduction
      medium: 0.65, // 35% reduction
      high: 0.85,   // 15% reduction
    }

    const ratio = ratios[quality]
    const estimatedSize = Math.round(fileSize * ratio)

    return {
      estimatedSize,
      estimatedRatio: Math.round((1 - ratio) * 100),
    }
  }
}
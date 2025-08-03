import { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'

export interface SplitOptions {
  // Split by specific pages
  pages?: number[]
  
  // Split by ranges
  ranges?: Array<{
    start: number
    end: number
    filename?: string
  }>
  
  // Split every N pages
  splitEvery?: number
  
  // Split by file size (approximate)
  maxFileSize?: number // in MB
  
  // Extract specific content
  extractBookmarks?: boolean
  extractAttachments?: boolean
  
  // Output options
  outputFormat?: 'separate' | 'zip'
  filenamePattern?: string // e.g., "page_{n}.pdf" or "document_part_{n}.pdf"
}

export interface SplitResult {
  files: Array<{
    buffer: Buffer
    filename: string
    pages: number[]
    pageCount: number
    size: number
  }>
  zipBuffer?: Buffer
  totalPages: number
  processingTime: number
}

export class PdfSplitter {
  private defaultOptions: SplitOptions = {
    outputFormat: 'separate',
    filenamePattern: 'page_{n}.pdf',
  }

  async split(
    inputBuffer: Buffer,
    options: SplitOptions = {}
  ): Promise<SplitResult> {
    const startTime = Date.now()
    const opts = { ...this.defaultOptions, ...options }
    
    try {
      const pdfDoc = await PDFDocument.load(inputBuffer, {
        ignoreEncryption: true,
      })
      
      const totalPages = pdfDoc.getPageCount()
      const results: SplitResult['files'] = []

      // Determine split strategy
      if (opts.pages) {
        // Split specific pages
        results.push(...await this.splitByPages(pdfDoc, opts.pages, opts))
      } else if (opts.ranges) {
        // Split by ranges
        results.push(...await this.splitByRanges(pdfDoc, opts.ranges, opts))
      } else if (opts.splitEvery) {
        // Split every N pages
        results.push(...await this.splitEveryNPages(pdfDoc, opts.splitEvery, opts))
      } else if (opts.maxFileSize) {
        // Split by file size
        results.push(...await this.splitByFileSize(pdfDoc, opts.maxFileSize, opts))
      } else {
        // Default: split into individual pages
        results.push(...await this.splitIntoSinglePages(pdfDoc, opts))
      }

      // Create ZIP if requested
      let zipBuffer: Buffer | undefined
      if (opts.outputFormat === 'zip' && results.length > 1) {
        zipBuffer = await this.createZip(results)
      }

      return {
        files: results,
        zipBuffer,
        totalPages,
        processingTime: Date.now() - startTime,
      }
    } catch (error) {
      console.error('PDF split error:', error)
      throw new Error('Failed to split PDF')
    }
  }

  private async splitByPages(
    pdfDoc: PDFDocument,
    pages: number[],
    options: SplitOptions
  ): Promise<SplitResult['files']> {
    const results: SplitResult['files'] = []

    for (let i = 0; i < pages.length; i++) {
      const pageNum = pages[i] - 1 // Convert to 0-based index
      
      if (pageNum < 0 || pageNum >= pdfDoc.getPageCount()) {
        throw new Error(`Invalid page number: ${pages[i]}`)
      }

      const newPdf = await PDFDocument.create()
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNum])
      newPdf.addPage(copiedPage)

      const pdfBytes = await newPdf.save()
      const filename = this.generateFilename(options.filenamePattern!, pages[i])

      results.push({
        buffer: Buffer.from(pdfBytes),
        filename,
        pages: [pages[i]],
        pageCount: 1,
        size: pdfBytes.length,
      })
    }

    return results
  }

  private async splitByRanges(
    pdfDoc: PDFDocument,
    ranges: Array<{ start: number; end: number; filename?: string }>,
    options: SplitOptions
  ): Promise<SplitResult['files']> {
    const results: SplitResult['files'] = []

    for (let i = 0; i < ranges.length; i++) {
      const { start, end, filename } = ranges[i]
      
      // Validate range
      if (start < 1 || end > pdfDoc.getPageCount() || start > end) {
        throw new Error(`Invalid range: ${start}-${end}`)
      }

      const pageIndices = []
      for (let j = start - 1; j < end; j++) {
        pageIndices.push(j)
      }

      const newPdf = await PDFDocument.create()
      const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices)
      copiedPages.forEach(page => newPdf.addPage(page))

      const pdfBytes = await newPdf.save()
      const outputFilename = filename || 
        this.generateFilename(options.filenamePattern!, `${start}-${end}`)

      results.push({
        buffer: Buffer.from(pdfBytes),
        filename: outputFilename,
        pages: pageIndices.map(idx => idx + 1),
        pageCount: pageIndices.length,
        size: pdfBytes.length,
      })
    }

    return results
  }

  private async splitEveryNPages(
    pdfDoc: PDFDocument,
    n: number,
    options: SplitOptions
  ): Promise<SplitResult['files']> {
    const results: SplitResult['files'] = []
    const totalPages = pdfDoc.getPageCount()
    let partNumber = 1

    for (let i = 0; i < totalPages; i += n) {
      const pageIndices = []
      const end = Math.min(i + n, totalPages)
      
      for (let j = i; j < end; j++) {
        pageIndices.push(j)
      }

      const newPdf = await PDFDocument.create()
      const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices)
      copiedPages.forEach(page => newPdf.addPage(page))

      const pdfBytes = await newPdf.save()
      const filename = this.generateFilename(
        options.filenamePattern!.replace('page', 'part'),
        partNumber
      )

      results.push({
        buffer: Buffer.from(pdfBytes),
        filename,
        pages: pageIndices.map(idx => idx + 1),
        pageCount: pageIndices.length,
        size: pdfBytes.length,
      })

      partNumber++
    }

    return results
  }

  private async splitByFileSize(
    pdfDoc: PDFDocument,
    maxSizeMB: number,
    options: SplitOptions
  ): Promise<SplitResult['files']> {
    const results: SplitResult['files'] = []
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    const totalPages = pdfDoc.getPageCount()
    
    let currentPdf = await PDFDocument.create()
    let currentPages: number[] = []
    let partNumber = 1

    for (let i = 0; i < totalPages; i++) {
      const [copiedPage] = await currentPdf.copyPages(pdfDoc, [i])
      currentPdf.addPage(copiedPage)
      currentPages.push(i + 1)

      // Check size
      const tempBytes = await currentPdf.save()
      
      if (tempBytes.length > maxSizeBytes && currentPages.length > 1) {
        // Remove last page and save current PDF
        currentPdf.removePage(currentPages.length - 1)
        currentPages.pop()

        const pdfBytes = await currentPdf.save()
        const filename = this.generateFilename(
          options.filenamePattern!.replace('page', 'part'),
          partNumber
        )

        results.push({
          buffer: Buffer.from(pdfBytes),
          filename,
          pages: [...currentPages],
          pageCount: currentPages.length,
          size: pdfBytes.length,
        })

        // Start new PDF with the page that exceeded the limit
        currentPdf = await PDFDocument.create()
        const [newPage] = await currentPdf.copyPages(pdfDoc, [i])
        currentPdf.addPage(newPage)
        currentPages = [i + 1]
        partNumber++
      }
    }

    // Save remaining pages
    if (currentPages.length > 0) {
      const pdfBytes = await currentPdf.save()
      const filename = this.generateFilename(
        options.filenamePattern!.replace('page', 'part'),
        partNumber
      )

      results.push({
        buffer: Buffer.from(pdfBytes),
        filename,
        pages: currentPages,
        pageCount: currentPages.length,
        size: pdfBytes.length,
      })
    }

    return results
  }

  private async splitIntoSinglePages(
    pdfDoc: PDFDocument,
    options: SplitOptions
  ): Promise<SplitResult['files']> {
    const results: SplitResult['files'] = []
    const totalPages = pdfDoc.getPageCount()

    for (let i = 0; i < totalPages; i++) {
      const newPdf = await PDFDocument.create()
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [i])
      newPdf.addPage(copiedPage)

      const pdfBytes = await newPdf.save()
      const filename = this.generateFilename(options.filenamePattern!, i + 1)

      results.push({
        buffer: Buffer.from(pdfBytes),
        filename,
        pages: [i + 1],
        pageCount: 1,
        size: pdfBytes.length,
      })
    }

    return results
  }

  private generateFilename(pattern: string, value: number | string): string {
    return pattern
      .replace('{n}', value.toString())
      .replace('{N}', value.toString().padStart(3, '0'))
  }

  private async createZip(files: SplitResult['files']): Promise<Buffer> {
    const zip = new JSZip()

    for (const file of files) {
      zip.file(file.filename, file.buffer)
    }

    return await zip.generateAsync({ 
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })
  }

  async extractPages(
    pdfBuffer: Buffer,
    pageNumbers: number[]
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    const newPdf = await PDFDocument.create()

    // Convert to 0-based indices and validate
    const pageIndices = pageNumbers.map(n => {
      const idx = n - 1
      if (idx < 0 || idx >= pdfDoc.getPageCount()) {
        throw new Error(`Invalid page number: ${n}`)
      }
      return idx
    })

    const pages = await newPdf.copyPages(pdfDoc, pageIndices)
    pages.forEach(page => newPdf.addPage(page))

    return Buffer.from(await newPdf.save())
  }
}
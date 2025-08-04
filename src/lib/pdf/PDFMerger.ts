import { PDFDocument, PDFPage, rgb, degrees } from 'pdf-lib'

export interface MergeOptions {
  insertPageBreaks?: boolean
  pageBreakText?: string
  addPageNumbers?: boolean
  pageNumberFormat?: 'bottom-center' | 'bottom-right' | 'top-right'
  addTableOfContents?: boolean
  bookmarks?: Array<{ title: string; pageIndex: number }>
  uniformPageSize?: boolean
  orientation?: 'portrait' | 'landscape' | 'auto'
}

export interface MergeResult {
  buffer: Buffer
  totalPages: number
  filesCount: number
  metadata: {
    sources: Array<{
      filename?: string
      pages: number
      startPage: number
      endPage: number
    }>
  }
  processingTime: number
}

export class PdfMerger {
  private defaultOptions: MergeOptions = {
    insertPageBreaks: false,
    pageBreakText: '',
    addPageNumbers: false,
    pageNumberFormat: 'bottom-center',
    addTableOfContents: false,
    uniformPageSize: false,
    orientation: 'auto',
  }

  async merge(
    pdfBuffers: Array<{ buffer: Buffer; filename?: string }>,
    options: MergeOptions = {}
  ): Promise<MergeResult> {
    const startTime = Date.now()
    const opts = { ...this.defaultOptions, ...options }
    
    if (pdfBuffers.length === 0) {
      throw new Error('No PDFs provided to merge')
    }

    try {
      // Create new PDF document
      const mergedPdf = await PDFDocument.create()
      const metadata: MergeResult['metadata'] = { sources: [] }
      
      let currentPageIndex = 0
      const pageMapping: Array<{ sourceIndex: number; pageIndex: number }> = []

      // Add table of contents page if requested
      if (opts.addTableOfContents) {
        await this.addTableOfContents(mergedPdf, pdfBuffers, opts)
        currentPageIndex = 1
      }

      // Process each PDF
      for (let i = 0; i < pdfBuffers.length; i++) {
        const { buffer, filename } = pdfBuffers[i]
        
        try {
          const pdfDoc = await PDFDocument.load(buffer, {
            ignoreEncryption: true,
          })

          const pageIndices = pdfDoc.getPageIndices()
          const copiedPages = await mergedPdf.copyPages(pdfDoc, pageIndices)

          const sourceInfo = {
            filename: filename || `Document ${i + 1}`,
            pages: copiedPages.length,
            startPage: currentPageIndex + 1,
            endPage: currentPageIndex + copiedPages.length,
          }

          // Add page break if requested (except before first document)
          if (opts.insertPageBreaks && i > 0) {
            const pageBreak = this.createPageBreak(mergedPdf, opts.pageBreakText || '')
            mergedPdf.addPage(pageBreak)
            currentPageIndex++
          }

          // Add copied pages
          for (let j = 0; j < copiedPages.length; j++) {
            const page = copiedPages[j]
            
            // Uniform page size if requested
            if (opts.uniformPageSize) {
              this.standardizePage(page, opts.orientation!)
            }

            mergedPdf.addPage(page)
            pageMapping.push({ sourceIndex: i, pageIndex: j })
            currentPageIndex++
          }

          metadata.sources.push(sourceInfo)
        } catch (error) {
          console.error(`Failed to process PDF ${i + 1}:`, error)
          throw new Error(`Failed to process ${filename || `PDF ${i + 1}`}`)
        }
      }

      // Add page numbers if requested
      if (opts.addPageNumbers) {
        await this.addPageNumbers(mergedPdf, opts.pageNumberFormat!, opts.addTableOfContents ? 1 : 0)
      }

      // Add bookmarks if provided
      if (opts.bookmarks && opts.bookmarks.length > 0) {
        await this.addBookmarks(mergedPdf, opts.bookmarks)
      }

      // Save the merged PDF
      const mergedPdfBytes = await mergedPdf.save()

      return {
        buffer: Buffer.from(mergedPdfBytes),
        totalPages: mergedPdf.getPageCount(),
        filesCount: pdfBuffers.length,
        metadata,
        processingTime: Date.now() - startTime,
      }
    } catch (error) {
      console.error('PDF merge error:', error)
      throw error
    }
  }

  private createPageBreak(pdfDoc: PDFDocument, text: string): PDFPage {
    const page = pdfDoc.addPage()
    const { width, height } = page.getSize()

    if (text) {
      const fontSize = 16
      page.drawText(text, {
        x: width / 2 - (text.length * fontSize) / 4,
        y: height / 2,
        size: fontSize,
        color: rgb(0.5, 0.5, 0.5),
      })
    }

    return page
  }

  private standardizePage(page: PDFPage, orientation: 'portrait' | 'landscape' | 'auto'): void {
    const { width, height } = page.getSize()
    const isLandscape = width > height

    if (orientation === 'portrait' && isLandscape) {
      page.setRotation(degrees(90))
    } else if (orientation === 'landscape' && !isLandscape) {
      page.setRotation(degrees(90))
    }
  }

  private async addPageNumbers(
    pdfDoc: PDFDocument,
    format: string,
    startOffset: number = 0
  ): Promise<void> {
    const pages = pdfDoc.getPages()
    const totalPages = pages.length - startOffset

    for (let i = startOffset; i < pages.length; i++) {
      const page = pages[i]
      const { width, height } = page.getSize()
      const pageNumber = i - startOffset + 1
      const text = `Page ${pageNumber} of ${totalPages}`

      let x = 0
      let y = 0

      switch (format) {
        case 'bottom-center':
          x = width / 2 - (text.length * 4)
          y = 30
          break
        case 'bottom-right':
          x = width - 100
          y = 30
          break
        case 'top-right':
          x = width - 100
          y = height - 30
          break
      }

      page.drawText(text, {
        x,
        y,
        size: 10,
        color: rgb(0.5, 0.5, 0.5),
      })
    }
  }

  private async addTableOfContents(
    pdfDoc: PDFDocument,
    sources: Array<{ buffer: Buffer; filename?: string }>,
    options: MergeOptions
  ): Promise<void> {
    const tocPage = pdfDoc.addPage()
    const { width, height } = tocPage.getSize()
    
    // Title
    tocPage.drawText('Table of Contents', {
      x: 50,
      y: height - 50,
      size: 24,
      color: rgb(0, 0, 0),
    })

    let yPosition = height - 100
    let pageOffset = 1 // TOC page itself

    for (let i = 0; i < sources.length; i++) {
      const { filename } = sources[i]
      const pdfDoc = await PDFDocument.load(sources[i].buffer)
      const pageCount = pdfDoc.getPageCount()

      // Draw entry
      const entryText = `${i + 1}. ${filename || `Document ${i + 1}`}`
      const pageText = `Page ${pageOffset + 1}`

      tocPage.drawText(entryText, {
        x: 50,
        y: yPosition,
        size: 12,
        color: rgb(0, 0, 0),
      })

      tocPage.drawText(pageText, {
        x: width - 100,
        y: yPosition,
        size: 12,
        color: rgb(0, 0, 0),
      })

      // Draw dotted line
      const dots = '.'.repeat(Math.floor((width - 200 - entryText.length * 6) / 6))
      tocPage.drawText(dots, {
        x: 50 + entryText.length * 6 + 10,
        y: yPosition,
        size: 12,
        color: rgb(0.5, 0.5, 0.5),
      })

      yPosition -= 25
      pageOffset += pageCount
      
      if (options.insertPageBreaks && i < sources.length - 1) {
        pageOffset++ // Account for page break
      }
    }
  }

  private async addBookmarks(
    pdfDoc: PDFDocument,
    bookmarks: Array<{ title: string; pageIndex: number }>
  ): Promise<void> {
    // Note: pdf-lib doesn't support bookmarks/outlines directly
    // This would require lower-level PDF manipulation
    // For now, this is a placeholder
    console.warn('Bookmarks are not yet implemented in pdf-lib')
  }

  async rearrangePages(
    pdfBuffer: Buffer,
    pageOrder: number[]
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    const totalPages = pdfDoc.getPageCount()

    // Validate page order
    if (pageOrder.some(p => p < 0 || p >= totalPages)) {
      throw new Error('Invalid page numbers in order array')
    }

    // Create new document with rearranged pages
    const newPdf = await PDFDocument.create()
    const pages = await newPdf.copyPages(pdfDoc, pageOrder)
    
    pages.forEach(page => newPdf.addPage(page))

    return Buffer.from(await newPdf.save())
  }
}
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import mammoth from 'mammoth';
import {
  PDFDocument,
  rgb,
  StandardFonts,
} from 'pdf-lib';
import sharp from 'sharp';

export interface ConversionOptions {
  // General options
  pageSize?: 'A4' | 'Letter' | 'Legal'
  orientation?: 'portrait' | 'landscape'
  margins?: {
    top: number
    bottom: number
    left: number
    right: number
  }
  
  // Text options
  fontSize?: number
  fontFamily?: string
  lineHeight?: number
  
  // Image options
  imageQuality?: number
  maxImageWidth?: number
  maxImageHeight?: number
  
  // Table options
  tableStyle?: 'grid' | 'simple' | 'striped'
  
  // Metadata
  title?: string
  author?: string
  subject?: string
}

export interface ConversionResult {
  buffer: Buffer
  format: string
  pageCount?: number
  metadata?: Record<string, any>
  processingTime: number
}

export class PdfConverter {
  private defaultOptions: ConversionOptions = {
    pageSize: 'A4',
    orientation: 'portrait',
    margins: { top: 72, bottom: 72, left: 72, right: 72 },
    fontSize: 12,
    fontFamily: 'Helvetica',
    lineHeight: 1.5,
    imageQuality: 90,
    maxImageWidth: 500,
    maxImageHeight: 700,
    tableStyle: 'grid',
  }

  private pageSizes = {
    A4: { width: 595, height: 842 },
    Letter: { width: 612, height: 792 },
    Legal: { width: 612, height: 1008 },
  }

  async convertToPdf(
    inputBuffer: Buffer,
    inputFormat: string,
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    const startTime = Date.now()
    const opts = { ...this.defaultOptions, ...options }

    try {
      let result: Buffer

      switch (inputFormat.toLowerCase()) {
        case 'docx':
        case 'doc':
          result = await this.convertDocxToPdf(inputBuffer, opts)
          break
        case 'xlsx':
        case 'xls':
          result = await this.convertExcelToPdf(inputBuffer, opts)
          break
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'bmp':
        case 'webp':
          result = await this.convertImageToPdf(inputBuffer, opts)
          break
        case 'txt':
          result = await this.convertTextToPdf(inputBuffer.toString('utf-8'), opts)
          break
        case 'html':
          result = await this.convertHtmlToPdf(inputBuffer.toString('utf-8'), opts)
          break
        default:
          throw new Error(`Unsupported format: ${inputFormat}`)
      }

      return {
        buffer: result,
        format: 'pdf',
        processingTime: Date.now() - startTime,
      }
    } catch (error) {
      console.error('Conversion error:', error)
      throw new Error(`Failed to convert ${inputFormat} to PDF`)
    }
  }

  async convertFromPdf(
    pdfBuffer: Buffer,
    outputFormat: string,
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    const startTime = Date.now()

    try {
      let result: Buffer

      switch (outputFormat.toLowerCase()) {
        case 'docx':
          result = await this.convertPdfToDocx(pdfBuffer, options)
          break
        case 'txt':
          result = await this.convertPdfToText(pdfBuffer, options)
          break
        case 'jpg':
        case 'jpeg':
        case 'png':
          result = await this.convertPdfToImage(pdfBuffer, outputFormat, options)
          break
        default:
          throw new Error(`Unsupported output format: ${outputFormat}`)
      }

      return {
        buffer: result,
        format: outputFormat,
        processingTime: Date.now() - startTime,
      }
    } catch (error) {
      console.error('Conversion error:', error)
      throw new Error(`Failed to convert PDF to ${outputFormat}`)
    }
  }

  private async convertDocxToPdf(
    docxBuffer: Buffer,
    options: ConversionOptions
  ): Promise<Buffer> {
    // Extract text and basic formatting from DOCX
    const result = await mammoth.extractRawText({ buffer: docxBuffer })
    const text = result.value

    // Also get HTML for better formatting
    const htmlResult = await mammoth.convertToHtml({ buffer: docxBuffer })
    const html = htmlResult.value

    // Create PDF
    const pdfDoc = await PDFDocument.create()
    this.setMetadata(pdfDoc, options)

    // Parse HTML to get paragraphs
    const paragraphs = this.parseHtmlToParagraphs(html)

    // Add pages and content
    let currentPage = pdfDoc.addPage(this.getPageSize(options))
    let yPosition = currentPage.getHeight() - options.margins!.top
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

    for (const paragraph of paragraphs) {
      const lines = this.wrapText(
        paragraph.text,
        font,
        options.fontSize!,
        currentPage.getWidth() - options.margins!.left - options.margins!.right
      )

      for (const line of lines) {
        if (yPosition - options.fontSize! < options.margins!.bottom) {
          currentPage = pdfDoc.addPage(this.getPageSize(options))
          yPosition = currentPage.getHeight() - options.margins!.top
        }

        currentPage.drawText(line, {
          x: options.margins!.left,
          y: yPosition,
          size: options.fontSize!,
          font,
          color: rgb(0, 0, 0),
        })

        yPosition -= options.fontSize! * options.lineHeight!
      }

      // Add paragraph spacing
      yPosition -= options.fontSize! * 0.5
    }

    return Buffer.from(await pdfDoc.save())
  }

  private async convertExcelToPdf(
    excelBuffer: Buffer,
    options: ConversionOptions
  ): Promise<Buffer> {
    const ExcelJS = require('exceljs')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(excelBuffer)

    const pdfDoc = await PDFDocument.create()
    this.setMetadata(pdfDoc, options)

    for (const worksheet of workbook.worksheets) {
      const data: any[][] = []

      // Convert worksheet to array format
      worksheet.eachRow((row: any, rowNumber: number) => {
        const rowData: any[] = []
        row.eachCell((cell: any, colNumber: number) => {
          rowData[colNumber - 1] = cell.value
        })
        data.push(rowData)
      })

      if (data.length === 0) continue

      const page = pdfDoc.addPage(this.getPageSize(options))
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const fontSize = 10
      const cellPadding = 5
      
      // Calculate column widths
      const columnWidths = this.calculateColumnWidths(data, font, fontSize)
      const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0)
      
      // Start position
      let xPosition = options.margins!.left
      let yPosition = page.getHeight() - options.margins!.top

      // Draw table
      for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
        const row = data[rowIndex]
        const isHeader = rowIndex === 0
        const rowHeight = fontSize + cellPadding * 2

        // Check if we need a new page
        if (yPosition - rowHeight < options.margins!.bottom) {
          const newPage = pdfDoc.addPage(this.getPageSize(options))
          yPosition = newPage.getHeight() - options.margins!.top
        }

        xPosition = options.margins!.left

        for (let colIndex = 0; colIndex < row.length; colIndex++) {
          const cellValue = String(row[colIndex] || '')
          const cellWidth = columnWidths[colIndex]

          // Draw cell border
          if (options.tableStyle === 'grid') {
            page.drawRectangle({
              x: xPosition,
              y: yPosition - rowHeight,
              width: cellWidth,
              height: rowHeight,
              borderColor: rgb(0.8, 0.8, 0.8),
              borderWidth: 1,
            })
          }

          // Draw cell text
          page.drawText(cellValue.substring(0, 50), {
            x: xPosition + cellPadding,
            y: yPosition - fontSize - cellPadding,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          })

          xPosition += cellWidth
        }

        yPosition -= rowHeight
      }
    }

    return Buffer.from(await pdfDoc.save())
  }

  private async convertImageToPdf(
    imageBuffer: Buffer,
    options: ConversionOptions
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create()
    this.setMetadata(pdfDoc, options)

    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata()
    const { width = 800, height = 600, format } = metadata

    // Calculate page size to fit image
    const pageSize = this.getPageSize(options)
    const maxWidth = pageSize[0] - options.margins!.left - options.margins!.right
    const maxHeight = pageSize[1] - options.margins!.top - options.margins!.bottom

    // Calculate scale to fit
    const scale = Math.min(maxWidth / width, maxHeight / height, 1)
    const scaledWidth = width * scale
    const scaledHeight = height * scale

    // Create page
    const page = pdfDoc.addPage(pageSize)

    // Embed image
    let embeddedImage
    if (format === 'jpeg' || format === 'jpg') {
      embeddedImage = await pdfDoc.embedJpg(imageBuffer)
    } else if (format === 'png') {
      embeddedImage = await pdfDoc.embedPng(imageBuffer)
    } else {
      // Convert to JPEG for other formats
      const jpegBuffer = await sharp(imageBuffer).jpeg().toBuffer()
      embeddedImage = await pdfDoc.embedJpg(jpegBuffer)
    }

    // Center image on page
    const xPosition = (page.getWidth() - scaledWidth) / 2
    const yPosition = (page.getHeight() - scaledHeight) / 2

    page.drawImage(embeddedImage, {
      x: xPosition,
      y: yPosition,
      width: scaledWidth,
      height: scaledHeight,
    })

    return Buffer.from(await pdfDoc.save())
  }

  private async convertTextToPdf(
    text: string,
    options: ConversionOptions
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create()
    this.setMetadata(pdfDoc, options)

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const lines = text.split('\n')
    
    let currentPage = pdfDoc.addPage(this.getPageSize(options))
    let yPosition = currentPage.getHeight() - options.margins!.top

    for (const line of lines) {
      const wrappedLines = this.wrapText(
        line,
        font,
        options.fontSize!,
        currentPage.getWidth() - options.margins!.left - options.margins!.right
      )

      for (const wrappedLine of wrappedLines) {
        if (yPosition - options.fontSize! < options.margins!.bottom) {
          currentPage = pdfDoc.addPage(this.getPageSize(options))
          yPosition = currentPage.getHeight() - options.margins!.top
        }

        currentPage.drawText(wrappedLine, {
          x: options.margins!.left,
          y: yPosition,
          size: options.fontSize!,
          font,
          color: rgb(0, 0, 0),
        })

        yPosition -= options.fontSize! * options.lineHeight!
      }
    }

    return Buffer.from(await pdfDoc.save())
  }

  private async convertHtmlToPdf(
    html: string,
    options: ConversionOptions
  ): Promise<Buffer> {
    // Simple HTML to PDF conversion
    // In production, you'd use a proper HTML renderer like Puppeteer
    const text = html.replace(/<[^>]*>/g, '') // Strip HTML tags
    return this.convertTextToPdf(text, options)
  }

  private async convertPdfToDocx(
    pdfBuffer: Buffer,
    options: ConversionOptions
  ): Promise<Buffer> {
    // Note: This is a simplified conversion
    // Real PDF to DOCX conversion requires complex text extraction
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    const pages = pdfDoc.getPages()

    const doc = new DocxDocument({
      sections: [{
        properties: {},
        children: pages.map(page => 
          new Paragraph({
            children: [
              new TextRun({
                text: "Page content would be extracted here",
                size: 24,
              }),
            ],
          })
        ),
      }],
    })

    return Buffer.from(await Packer.toBuffer(doc))
  }

  private async convertPdfToText(
    pdfBuffer: Buffer,
    options: ConversionOptions
  ): Promise<Buffer> {
    // Note: pdf-lib doesn't support text extraction
    // In production, use pdf-parse or similar
    return Buffer.from('Text extraction requires additional libraries')
  }

  private async convertPdfToImage(
    pdfBuffer: Buffer,
    format: string,
    options: ConversionOptions
  ): Promise<Buffer> {
    // Note: This requires PDF rendering capabilities
    // In production, use pdf-to-image libraries
    throw new Error('PDF to image conversion requires additional libraries')
  }

  private getPageSize(options: ConversionOptions): [number, number] {
    const size = this.pageSizes[options.pageSize!]
    return options.orientation === 'landscape' 
      ? [size.height, size.width]
      : [size.width, size.height]
  }

  private setMetadata(pdfDoc: PDFDocument, options: ConversionOptions): void {
    if (options.title) pdfDoc.setTitle(options.title)
    if (options.author) pdfDoc.setAuthor(options.author)
    if (options.subject) pdfDoc.setSubject(options.subject)
    pdfDoc.setProducer('PDF Pro Converter')
    pdfDoc.setCreationDate(new Date())
  }

  private wrapText(
    text: string,
    font: any,
    fontSize: number,
    maxWidth: number
  ): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const width = font.widthOfTextAtSize(testLine, fontSize)

      if (width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      lines.push(currentLine)
    }

    return lines.length > 0 ? lines : ['']
  }

  private parseHtmlToParagraphs(html: string): Array<{ text: string; style?: string }> {
    const paragraphs: Array<{ text: string; style?: string }> = []
    
    // Simple HTML parsing - in production use a proper parser
    const blocks = html.split(/<\/?(p|h[1-6]|div|br)>/gi)
    
    for (const block of blocks) {
      const text = block.replace(/<[^>]*>/g, '').trim()
      if (text) {
        paragraphs.push({ text })
      }
    }

    return paragraphs
  }

  private calculateColumnWidths(
    data: any[][],
    font: any,
    fontSize: number
  ): number[] {
    const columnCount = Math.max(...data.map(row => row.length))
    const widths: number[] = new Array(columnCount).fill(50)

    for (let col = 0; col < columnCount; col++) {
      let maxWidth = 50
      for (const row of data) {
        if (row[col]) {
          const width = font.widthOfTextAtSize(String(row[col]), fontSize) + 20
          maxWidth = Math.max(maxWidth, Math.min(width, 200))
        }
      }
      widths[col] = maxWidth
    }

    return widths
  }
}
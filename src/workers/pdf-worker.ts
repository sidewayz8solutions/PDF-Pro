import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

// Worker pool management
class WorkerPool {
  private workers: Worker[] = [];
  private queue: Array<{ task: any; resolve: Function; reject: Function }> = [];
  private maxWorkers: number;
  private currentWorkers: number = 0;

  constructor(maxWorkers: number = 4) {
    this.maxWorkers = Math.min(maxWorkers, require('os').cpus().length);
  }

  async execute<T>(task: any): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.queue.length === 0 || this.currentWorkers >= this.maxWorkers) {
      return;
    }

    const { task, resolve, reject } = this.queue.shift()!;
    this.currentWorkers++;

    try {
      const worker = new Worker(__filename, {
        workerData: task,
      });

      worker.on('message', (result) => {
        this.currentWorkers--;
        worker.terminate();
        resolve(result);
        this.processQueue();
      });

      worker.on('error', (error) => {
        this.currentWorkers--;
        worker.terminate();
        reject(error);
        this.processQueue();
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          this.currentWorkers--;
          reject(new Error(`Worker stopped with exit code ${code}`));
          this.processQueue();
        }
      });
    } catch (error) {
      this.currentWorkers--;
      reject(error);
      this.processQueue();
    }
  }

  async terminate() {
    await Promise.all(this.workers.map(worker => worker.terminate()));
    this.workers = [];
    this.currentWorkers = 0;
  }
}

// PDF processing functions for worker thread
async function compressPDF(buffer: Buffer, options: any): Promise<{ buffer: Buffer; compressionRatio: number }> {
  const pdfDoc = await PDFDocument.load(buffer);
  
  // Compression strategies
  if (options.removeImages) {
    const pages = pdfDoc.getPages();
    for (const page of pages) {
      // Remove images (simplified - in real implementation, you'd iterate through content streams)
      const { width, height } = page.getSize();
      page.drawRectangle({
        x: 0,
        y: 0,
        width,
        height,
        color: rgb(1, 1, 1),
      });
    }
  }

  // Optimize fonts
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  // Save with compression
  const compressedBuffer = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 50,
  });

  const compressionRatio = ((buffer.length - compressedBuffer.length) / buffer.length) * 100;

  return {
    buffer: Buffer.from(compressedBuffer),
    compressionRatio: Math.max(0, compressionRatio),
  };
}

async function mergePDFs(buffers: Buffer[]): Promise<Buffer> {
  const mergedPdf = await PDFDocument.create();

  for (const buffer of buffers) {
    const pdf = await PDFDocument.load(buffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const mergedBuffer = await mergedPdf.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });

  return Buffer.from(mergedBuffer);
}

async function splitPDF(buffer: Buffer, options: any): Promise<Buffer[]> {
  const pdfDoc = await PDFDocument.load(buffer);
  const pageCount = pdfDoc.getPageCount();
  const results: Buffer[] = [];

  if (options.splitEvery) {
    // Split every N pages
    for (let i = 0; i < pageCount; i += options.splitEvery) {
      const newPdf = await PDFDocument.create();
      const endPage = Math.min(i + options.splitEvery, pageCount);
      
      for (let j = i; j < endPage; j++) {
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [j]);
        newPdf.addPage(copiedPage);
      }
      
      const pdfBytes = await newPdf.save();
      results.push(Buffer.from(pdfBytes));
    }
  } else if (options.pages) {
    // Split specific pages
    for (const pageNum of options.pages) {
      if (pageNum > 0 && pageNum <= pageCount) {
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNum - 1]);
        newPdf.addPage(copiedPage);
        
        const pdfBytes = await newPdf.save();
        results.push(Buffer.from(pdfBytes));
      }
    }
  } else {
    // Split each page individually
    for (let i = 0; i < pageCount; i++) {
      const newPdf = await PDFDocument.create();
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
      newPdf.addPage(copiedPage);
      
      const pdfBytes = await newPdf.save();
      results.push(Buffer.from(pdfBytes));
    }
  }

  return results;
}

async function addWatermark(buffer: Buffer, options: any): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(buffer);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const watermarkText = options.text || 'WATERMARK';
  const opacity = options.opacity || 0.3;
  const fontSize = options.fontSize || 24;

  for (const page of pages) {
    const { width, height } = page.getSize();
    
    // Calculate text position
    const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
    const textHeight = font.heightAtSize(fontSize);
    
    let x = (width - textWidth) / 2;
    let y = (height - textHeight) / 2;
    
    // Adjust position based on options
    if (options.position) {
      switch (options.position) {
        case 'top-left':
          x = 50;
          y = height - 50;
          break;
        case 'top-right':
          x = width - textWidth - 50;
          y = height - 50;
          break;
        case 'bottom-left':
          x = 50;
          y = 50;
          break;
        case 'bottom-right':
          x = width - textWidth - 50;
          y = 50;
          break;
      }
    }

    page.drawText(watermarkText, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity,
      rotate: { angle: Math.PI / 6 }, // 30 degrees
    });
  }

  const watermarkedBuffer = await pdfDoc.save();
  return Buffer.from(watermarkedBuffer);
}

async function protectPDF(buffer: Buffer, options: any): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(buffer);
  
  // Set password and permissions
  const protectedBuffer = await pdfDoc.save({
    userPassword: options.password,
    ownerPassword: options.ownerPassword || options.password + '_owner',
    permissions: {
      printing: options.permissions?.printing || false,
      modifying: options.permissions?.editing || false,
      copying: options.permissions?.copying || false,
      annotating: options.permissions?.annotating || false,
      fillingForms: options.permissions?.fillingForms || false,
      contentAccessibility: true, // Always allow for accessibility
      documentAssembly: options.permissions?.assembly || false,
    },
  });

  return Buffer.from(protectedBuffer);
}

// Worker thread execution
if (!isMainThread) {
  const { operation, buffer, buffers, options } = workerData;

  (async () => {
    try {
      let result;

      switch (operation) {
        case 'compress':
          result = await compressPDF(buffer, options);
          break;
        case 'merge':
          result = await mergePDFs(buffers);
          break;
        case 'split':
          result = await splitPDF(buffer, options);
          break;
        case 'watermark':
          result = await addWatermark(buffer, options);
          break;
        case 'protect':
          result = await protectPDF(buffer, options);
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      parentPort?.postMessage({ success: true, result });
    } catch (error) {
      parentPort?.postMessage({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  })();
}

// Main thread exports
export class PDFWorkerPool {
  private static instance: WorkerPool;

  static getInstance(): WorkerPool {
    if (!this.instance) {
      this.instance = new WorkerPool(4); // 4 workers max
    }
    return this.instance;
  }

  static async compressPDF(
    buffer: Buffer, 
    options: { quality?: string; removeImages?: boolean } = {}
  ): Promise<{ buffer: Buffer; compressionRatio: number }> {
    const pool = this.getInstance();
    const result = await pool.execute({
      operation: 'compress',
      buffer,
      options,
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.result;
  }

  static async mergePDFs(buffers: Buffer[]): Promise<Buffer> {
    const pool = this.getInstance();
    const result = await pool.execute({
      operation: 'merge',
      buffers,
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.result;
  }

  static async splitPDF(
    buffer: Buffer,
    options: { splitEvery?: number; pages?: number[] } = {}
  ): Promise<Buffer[]> {
    const pool = this.getInstance();
    const result = await pool.execute({
      operation: 'split',
      buffer,
      options,
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.result;
  }

  static async addWatermark(
    buffer: Buffer,
    options: { 
      text?: string; 
      opacity?: number; 
      position?: string;
      fontSize?: number;
    } = {}
  ): Promise<Buffer> {
    const pool = this.getInstance();
    const result = await pool.execute({
      operation: 'watermark',
      buffer,
      options,
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.result;
  }

  static async protectPDF(
    buffer: Buffer,
    options: { 
      password: string; 
      ownerPassword?: string;
      permissions?: any;
    }
  ): Promise<Buffer> {
    const pool = this.getInstance();
    const result = await pool.execute({
      operation: 'protect',
      buffer,
      options,
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.result;
  }

  static async terminate(): Promise<void> {
    if (this.instance) {
      await this.instance.terminate();
    }
  }
}

export default PDFWorkerPool;

// PDF Processing Web Worker
// This worker handles CPU-intensive PDF operations off the main thread

// Import PDF-lib for client-side PDF processing
importScripts('https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js');

class PDFWorker {
  constructor() {
    this.isProcessing = false;
    this.currentOperation = null;
  }

  async compressPDF(arrayBuffer, options = {}) {
    try {
      this.updateProgress(10, 'Loading PDF document...');
      
      const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
      const originalSize = arrayBuffer.byteLength;
      
      this.updateProgress(30, 'Analyzing document structure...');
      
      // Apply compression based on quality setting
      const { quality = 'medium', removeImages = false } = options;
      
      if (removeImages) {
        this.updateProgress(50, 'Removing images...');
        await this.removeImages(pdfDoc);
      }
      
      this.updateProgress(70, 'Optimizing document...');
      
      // Compression settings based on quality
      const compressionSettings = {
        low: { useObjectStreams: false, compress: true },
        medium: { useObjectStreams: true, compress: true },
        high: { useObjectStreams: true, compress: true, addDefaultPage: false }
      };
      
      this.updateProgress(90, 'Finalizing compression...');
      
      const compressedBytes = await pdfDoc.save(compressionSettings[quality]);
      const compressedSize = compressedBytes.byteLength;
      const compressionRatio = Math.round((1 - compressedSize / originalSize) * 100);
      
      this.updateProgress(100, 'Compression complete!');
      
      return {
        success: true,
        data: compressedBytes,
        originalSize,
        compressedSize,
        compressionRatio
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async mergePDFs(pdfBuffers, options = {}) {
    try {
      this.updateProgress(5, 'Initializing merge operation...');
      
      const mergedPdf = await PDFLib.PDFDocument.create();
      let totalPages = 0;
      
      for (let i = 0; i < pdfBuffers.length; i++) {
        const progress = 10 + (i / pdfBuffers.length) * 70;
        this.updateProgress(progress, `Processing document ${i + 1} of ${pdfBuffers.length}...`);
        
        const pdfDoc = await PDFLib.PDFDocument.load(pdfBuffers[i]);
        const pageIndices = pdfDoc.getPageIndices();
        const copiedPages = await mergedPdf.copyPages(pdfDoc, pageIndices);
        
        copiedPages.forEach(page => mergedPdf.addPage(page));
        totalPages += copiedPages.length;
      }
      
      this.updateProgress(85, 'Finalizing merged document...');
      
      const mergedBytes = await mergedPdf.save();
      
      this.updateProgress(100, 'Merge complete!');
      
      return {
        success: true,
        data: mergedBytes,
        totalPages,
        filesCount: pdfBuffers.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async splitPDF(arrayBuffer, options = {}) {
    try {
      this.updateProgress(10, 'Loading PDF document...');
      
      const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
      const totalPages = pdfDoc.getPageCount();
      
      const { splitEvery = 1, pages = null } = options;
      const results = [];
      
      if (pages && Array.isArray(pages)) {
        // Split specific pages
        for (let i = 0; i < pages.length; i++) {
          const progress = 20 + (i / pages.length) * 60;
          this.updateProgress(progress, `Extracting page ${pages[i]}...`);
          
          const newPdf = await PDFLib.PDFDocument.create();
          const [copiedPage] = await newPdf.copyPages(pdfDoc, [pages[i] - 1]);
          newPdf.addPage(copiedPage);
          
          const pdfBytes = await newPdf.save();
          results.push({
            data: pdfBytes,
            pageNumber: pages[i],
            filename: `page_${pages[i]}.pdf`
          });
        }
      } else {
        // Split every N pages
        for (let i = 0; i < totalPages; i += splitEvery) {
          const progress = 20 + (i / totalPages) * 60;
          this.updateProgress(progress, `Creating split ${Math.floor(i / splitEvery) + 1}...`);
          
          const newPdf = await PDFLib.PDFDocument.create();
          const endPage = Math.min(i + splitEvery, totalPages);
          const pageIndices = Array.from({ length: endPage - i }, (_, idx) => i + idx);
          
          const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
          copiedPages.forEach(page => newPdf.addPage(page));
          
          const pdfBytes = await newPdf.save();
          results.push({
            data: pdfBytes,
            startPage: i + 1,
            endPage,
            filename: `split_${Math.floor(i / splitEvery) + 1}.pdf`
          });
        }
      }
      
      this.updateProgress(100, 'Split complete!');
      
      return {
        success: true,
        results,
        totalSplits: results.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async addWatermark(arrayBuffer, watermarkOptions = {}) {
    try {
      this.updateProgress(10, 'Loading PDF document...');
      
      const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();
      
      const {
        text = 'WATERMARK',
        opacity = 0.3,
        fontSize = 50,
        rotation = 45,
        color = [0.5, 0.5, 0.5]
      } = watermarkOptions;
      
      this.updateProgress(30, 'Preparing watermark...');
      
      const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
      
      for (let i = 0; i < pages.length; i++) {
        const progress = 40 + (i / pages.length) * 50;
        this.updateProgress(progress, `Adding watermark to page ${i + 1}...`);
        
        const page = pages[i];
        const { width, height } = page.getSize();
        
        page.drawText(text, {
          x: width / 2,
          y: height / 2,
          size: fontSize,
          font,
          color: PDFLib.rgb(color[0], color[1], color[2]),
          opacity,
          rotate: PDFLib.degrees(rotation),
        });
      }
      
      this.updateProgress(95, 'Finalizing watermarked document...');
      
      const watermarkedBytes = await pdfDoc.save();
      
      this.updateProgress(100, 'Watermark complete!');
      
      return {
        success: true,
        data: watermarkedBytes
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async removeImages(pdfDoc) {
    // This is a simplified implementation
    // In a real scenario, you'd need more sophisticated image detection and removal
    const pages = pdfDoc.getPages();
    
    for (const page of pages) {
      // Remove XObjects that are likely images
      const pageDict = page.node;
      const resources = pageDict.lookup(PDFLib.PDFName.of('Resources'));
      
      if (resources && resources instanceof PDFLib.PDFDict) {
        const xObject = resources.lookup(PDFLib.PDFName.of('XObject'));
        if (xObject && xObject instanceof PDFLib.PDFDict) {
          // Clear XObjects (this removes images but also other objects)
          resources.delete(PDFLib.PDFName.of('XObject'));
        }
      }
    }
  }

  updateProgress(percentage, message) {
    self.postMessage({
      type: 'progress',
      progress: percentage,
      message
    });
  }
}

// Worker instance
const worker = new PDFWorker();

// Message handler
self.onmessage = async function(e) {
  const { type, data, options, id } = e.data;
  
  try {
    worker.isProcessing = true;
    worker.currentOperation = type;
    
    let result;
    
    switch (type) {
      case 'compress':
        result = await worker.compressPDF(data, options);
        break;
      case 'merge':
        result = await worker.mergePDFs(data, options);
        break;
      case 'split':
        result = await worker.splitPDF(data, options);
        break;
      case 'watermark':
        result = await worker.addWatermark(data, options);
        break;
      default:
        result = {
          success: false,
          error: `Unknown operation: ${type}`
        };
    }
    
    self.postMessage({
      type: 'complete',
      id,
      result
    });
    
  } catch (error) {
    self.postMessage({
      type: 'error',
      id,
      error: error.message
    });
  } finally {
    worker.isProcessing = false;
    worker.currentOperation = null;
  }
};

// Handle worker termination
self.onclose = function() {
  worker.isProcessing = false;
  worker.currentOperation = null;
};

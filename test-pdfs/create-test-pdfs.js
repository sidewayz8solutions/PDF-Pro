const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function createTestPDFs() {
  // Create test directory if it doesn't exist
  const testDir = path.join(__dirname);
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // 1. Create a small test PDF (for compression testing)
  console.log('Creating small test PDF...');
  const smallPdf = await PDFDocument.create();
  const helveticaFont = await smallPdf.embedFont(StandardFonts.Helvetica);
  
  const page1 = smallPdf.addPage([600, 400]);
  page1.drawText('Small Test PDF', {
    x: 50,
    y: 350,
    size: 30,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  });
  
  page1.drawText('This is a small PDF file for testing compression.', {
    x: 50,
    y: 300,
    size: 14,
    font: helveticaFont,
    color: rgb(0.2, 0.2, 0.2),
  });
  
  page1.drawText('File size should be under 1MB.', {
    x: 50,
    y: 280,
    size: 12,
    font: helveticaFont,
    color: rgb(0.4, 0.4, 0.4),
  });

  const smallPdfBytes = await smallPdf.save();
  fs.writeFileSync(path.join(testDir, 'small-test.pdf'), smallPdfBytes);
  console.log(`Created small-test.pdf (${smallPdfBytes.length} bytes)`);

  // 2. Create a medium test PDF (for merge testing)
  console.log('Creating medium test PDF...');
  const mediumPdf = await PDFDocument.create();
  
  for (let i = 1; i <= 5; i++) {
    const page = mediumPdf.addPage([600, 800]);
    page.drawText(`Medium Test PDF - Page ${i}`, {
      x: 50,
      y: 750,
      size: 24,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });
    
    page.drawText(`This is page ${i} of a medium-sized PDF for testing.`, {
      x: 50,
      y: 700,
      size: 14,
      font: helveticaFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    
    // Add some content to make it more realistic
    for (let j = 1; j <= 20; j++) {
      page.drawText(`Line ${j}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.`, {
        x: 50,
        y: 650 - (j * 25),
        size: 10,
        font: helveticaFont,
        color: rgb(0.3, 0.3, 0.3),
      });
    }
  }

  const mediumPdfBytes = await mediumPdf.save();
  fs.writeFileSync(path.join(testDir, 'medium-test.pdf'), mediumPdfBytes);
  console.log(`Created medium-test.pdf (${mediumPdfBytes.length} bytes)`);

  // 3. Create another PDF for merge testing
  console.log('Creating second merge test PDF...');
  const mergePdf = await PDFDocument.create();
  
  for (let i = 1; i <= 3; i++) {
    const page = mergePdf.addPage([600, 800]);
    page.drawText(`Merge Test PDF - Page ${i}`, {
      x: 50,
      y: 750,
      size: 24,
      font: helveticaFont,
      color: rgb(0.5, 0, 0.5),
    });
    
    page.drawText(`This PDF will be merged with others.`, {
      x: 50,
      y: 700,
      size: 14,
      font: helveticaFont,
      color: rgb(0.4, 0, 0.4),
    });
    
    // Add different content
    for (let j = 1; j <= 15; j++) {
      page.drawText(`Merge content line ${j}: Different text for variety.`, {
        x: 50,
        y: 650 - (j * 30),
        size: 12,
        font: helveticaFont,
        color: rgb(0.6, 0, 0.6),
      });
    }
  }

  const mergePdfBytes = await mergePdf.save();
  fs.writeFileSync(path.join(testDir, 'merge-test.pdf'), mergePdfBytes);
  console.log(`Created merge-test.pdf (${mergePdfBytes.length} bytes)`);

  // 4. Create a multi-page PDF for split testing
  console.log('Creating multi-page split test PDF...');
  const splitPdf = await PDFDocument.create();
  
  for (let i = 1; i <= 10; i++) {
    const page = splitPdf.addPage([600, 800]);
    page.drawText(`Split Test PDF - Page ${i}`, {
      x: 50,
      y: 750,
      size: 24,
      font: helveticaFont,
      color: rgb(0, 0.5, 0),
    });
    
    page.drawText(`This is page ${i} of 10. Perfect for split testing.`, {
      x: 50,
      y: 700,
      size: 14,
      font: helveticaFont,
      color: rgb(0, 0.4, 0),
    });
    
    // Add page-specific content
    page.drawText(`Page ${i} specific content:`, {
      x: 50,
      y: 650,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0.3, 0),
    });
    
    for (let j = 1; j <= 10; j++) {
      page.drawText(`• Item ${j} on page ${i}`, {
        x: 70,
        y: 620 - (j * 20),
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0.2, 0),
      });
    }
  }

  const splitPdfBytes = await splitPdf.save();
  fs.writeFileSync(path.join(testDir, 'split-test.pdf'), splitPdfBytes);
  console.log(`Created split-test.pdf (${splitPdfBytes.length} bytes)`);

  // 5. Create a watermark test PDF
  console.log('Creating watermark test PDF...');
  const watermarkPdf = await PDFDocument.create();
  
  for (let i = 1; i <= 3; i++) {
    const page = watermarkPdf.addPage([600, 800]);
    page.drawText(`Watermark Test PDF - Page ${i}`, {
      x: 50,
      y: 750,
      size: 24,
      font: helveticaFont,
      color: rgb(0, 0, 0.5),
    });
    
    page.drawText('This PDF will be used to test watermark functionality.', {
      x: 50,
      y: 700,
      size: 14,
      font: helveticaFont,
      color: rgb(0, 0, 0.4),
    });
    
    // Add content that will be visible with watermark
    for (let j = 1; j <= 20; j++) {
      page.drawText(`Content line ${j}: This text should be visible under the watermark.`, {
        x: 50,
        y: 650 - (j * 25),
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0.3),
      });
    }
  }

  const watermarkPdfBytes = await watermarkPdf.save();
  fs.writeFileSync(path.join(testDir, 'watermark-test.pdf'), watermarkPdfBytes);
  console.log(`Created watermark-test.pdf (${watermarkPdfBytes.length} bytes)`);

  console.log('\n✅ All test PDFs created successfully!');
  console.log('Files created:');
  console.log('- small-test.pdf (for compression)');
  console.log('- medium-test.pdf (for merge)');
  console.log('- merge-test.pdf (for merge)');
  console.log('- split-test.pdf (for split)');
  console.log('- watermark-test.pdf (for watermark)');
}

createTestPDFs().catch(console.error);

import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { PdfPageLayout, PdfWatermarkConfig, PdfPageNumberConfig, ImageFormat } from './types';
import { loadImage } from './image-processing';

// Client-side PDF.js singleton
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsLib: any = null;

export async function getPdfJs() {
  if (typeof window === 'undefined') {
    throw new Error('PDF operations can only be performed in browser environments.');
  }
  if (!pdfjsLib) {
    const pdfjs = await import('pdfjs-dist');
    // Point to local public worker for 100% offline client-side execution
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    pdfjsLib = pdfjs;
  }
  return pdfjsLib;
}

/**
 * Parses basic document metadata: page count and page dimensions.
 */
export async function getPdfMetadata(file: File | Blob): Promise<{
  pageCount: number;
  pages: { pageIndex: number; width: number; height: number; rotation: number }[];
}> {
  const arrayBuffer = await file.arrayBuffer();
  const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const pageCount = doc.getPageCount();
  const pages = doc.getPages().map((page, idx) => {
    const { width, height } = page.getSize();
    const rotation = page.getRotation().angle;
    return {
      pageIndex: idx,
      width: Math.round(width),
      height: Math.round(height),
      rotation,
    };
  });

  return { pageCount, pages };
}

/**
 * Render a single PDF page to an HTML5 Canvas using PDF.js.
 */
export async function renderPdfPageToCanvas(
  file: File | Blob,
  pageNumber: number, // 1-indexed
  scale = 1.0
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(pageNumber);

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Could not acquire 2D canvas context.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  return { canvas, width: canvas.width, height: canvas.height };
}

/**
 * Render a thumbnail preview of a PDF page as a lightweight Data URL.
 */
export async function renderPdfPageThumbnail(
  file: File | Blob,
  pageNumber: number,
  maxWidth = 240
): Promise<string> {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(pageNumber);

  const unscaledViewport = page.getViewport({ scale: 1.0 });
  const scale = maxWidth / unscaledViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Could not acquire 2D canvas context.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  return canvas.toDataURL('image/jpeg', 0.82);
}

/**
 * Merge multiple PDF files into one combined PDF document.
 */
export async function mergePdfDocuments(
  files: (File | Blob)[],
  onProgress?: (current: number, total: number) => void
): Promise<{ blob: Blob; pageCount: number }> {
  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const arrayBuffer = await file.arrayBuffer();
    const sourceDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const copiedPages = await mergedPdf.copyPages(sourceDoc, sourceDoc.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));

    if (onProgress) {
      onProgress(i + 1, files.length);
    }
  }

  const pdfBytes = await mergedPdf.save();
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  return { blob, pageCount: mergedPdf.getPageCount() };
}

/**
 * Extract selected pages (0-indexed) into a single new PDF document.
 */
export async function extractPdfPages(
  file: File | Blob,
  pageIndices: number[]
): Promise<Blob> {
  if (pageIndices.length === 0) {
    throw new Error('At least one page must be selected to extract.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const sourceDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const newDoc = await PDFDocument.create();

  const copiedPages = await newDoc.copyPages(sourceDoc, pageIndices);
  copiedPages.forEach((page) => newDoc.addPage(page));

  const pdfBytes = await newDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

/**
 * Split every single page of a PDF into individual PDF files.
 */
export async function splitPdfIntoIndividualPages(
  file: File | Blob,
  baseName = 'page'
): Promise<{ name: string; blob: Blob }[]> {
  const arrayBuffer = await file.arrayBuffer();
  const sourceDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const count = sourceDoc.getPageCount();
  const results: { name: string; blob: Blob }[] = [];

  for (let i = 0; i < count; i++) {
    const singleDoc = await PDFDocument.create();
    const [page] = await singleDoc.copyPages(sourceDoc, [i]);
    singleDoc.addPage(page);

    const pdfBytes = await singleDoc.save();
    const pad = count >= 100 ? 3 : 2;
    const num = String(i + 1).padStart(pad, '0');
    results.push({
      name: `${baseName}-page-${num}.pdf`,
      blob: new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }),
    });
  }

  return results;
}

/**
 * Extract Odd or Even pages from a PDF document.
 * Odd: 1st, 3rd, 5th... (0-indexed: 0, 2, 4...)
 * Even: 2nd, 4th, 6th... (0-indexed: 1, 3, 5...)
 */
export async function extractOddEvenPages(
  file: File | Blob,
  mode: 'odd' | 'even'
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const sourceDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const count = sourceDoc.getPageCount();
  const indices: number[] = [];

  for (let i = 0; i < count; i++) {
    const isOdd = (i + 1) % 2 !== 0;
    if (mode === 'odd' && isOdd) indices.push(i);
    if (mode === 'even' && !isOdd) indices.push(i);
  }

  if (indices.length === 0) {
    throw new Error(`The document does not have any ${mode} pages.`);
  }

  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(sourceDoc, indices);
  copiedPages.forEach((page) => newDoc.addPage(page));

  const pdfBytes = await newDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

/**
 * Helper to convert any image Blob (JPG, PNG, WebP, AVIF) to JPEG/PNG bytes that pdf-lib can embed.
 */
async function prepareImageForPdf(
  doc: PDFDocument,
  blob: Blob
) {
  // If it's already image/jpeg or image/png, we can directly try embedding
  const type = blob.type.toLowerCase();
  const buffer = await blob.arrayBuffer();

  if (type === 'image/jpeg' || type === 'image/jpg') {
    try {
      return await doc.embedJpg(buffer);
    } catch {
      // Fall through to canvas re-encoding if format signature is non-standard
    }
  }

  if (type === 'image/png') {
    try {
      return await doc.embedPng(buffer);
    } catch {
      // Fall through to canvas re-encoding
    }
  }

  // Fallback: draw through canvas to get a clean PNG/JPEG
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/png');
  });

  const pngBytes = await pngBlob.arrayBuffer();
  return await doc.embedPng(pngBytes);
}

/**
 * Convert multiple image files into a single structured PDF document.
 */
export async function convertImagesToPdf(
  images: { blob: Blob; name: string }[],
  layout: PdfPageLayout
): Promise<Blob> {
  if (images.length === 0) {
    throw new Error('At least one image is required.');
  }

  const doc = await PDFDocument.create();

  // Page dimensions in points (72 pt = 1 inch)
  const PAGE_SIZES: Record<'a4' | 'letter', [number, number]> = {
    a4: [595.28, 841.89],
    letter: [612.0, 792.0],
  };

  const MARGINS: Record<'none' | 'small' | 'normal' | 'large', number> = {
    none: 0,
    small: 18,  // ~0.25 inch
    normal: 36, // ~0.5 inch
    large: 54,  // ~0.75 inch
  };

  const margin = MARGINS[layout.margin];

  for (const item of images) {
    const embeddedImg = await prepareImageForPdf(doc, item.blob);
    const imgWidth = embeddedImg.width;
    const imgHeight = embeddedImg.height;

    let pageWidth = 0;
    let pageHeight = 0;

    if (layout.pageSize === 'fit') {
      pageWidth = imgWidth + margin * 2;
      pageHeight = imgHeight + margin * 2;
    } else {
      const baseDimensions = PAGE_SIZES[layout.pageSize];
      let isLandscape = false;
      if (layout.orientation === 'landscape') {
        isLandscape = true;
      } else if (layout.orientation === 'auto') {
        isLandscape = imgWidth > imgHeight;
      }

      pageWidth = isLandscape ? Math.max(...baseDimensions) : Math.min(...baseDimensions);
      pageHeight = isLandscape ? Math.min(...baseDimensions) : Math.max(...baseDimensions);
    }

    const page = doc.addPage([pageWidth, pageHeight]);

    // Fit image inside available printable area
    const printableWidth = Math.max(pageWidth - margin * 2, 1);
    const printableHeight = Math.max(pageHeight - margin * 2, 1);

    const scale = Math.min(printableWidth / imgWidth, printableHeight / imgHeight);
    const drawWidth = imgWidth * scale;
    const drawHeight = imgHeight * scale;

    // Center image on the page
    const x = margin + (printableWidth - drawWidth) / 2;
    const y = margin + (printableHeight - drawHeight) / 2;

    page.drawImage(embeddedImg, {
      x,
      y,
      width: drawWidth,
      height: drawHeight,
    });
  }

  const pdfBytes = await doc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

/**
 * Rasterize PDF pages into image blobs (PNG, JPEG, WebP) with configurable scale/DPI.
 */
export async function convertPdfToImages(
  file: File | Blob,
  format: ImageFormat,
  scale = 2.0,
  onProgress?: (current: number, total: number) => void
): Promise<{ name: string; blob: Blob; width: number; height: number }[]> {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDoc = await loadingTask.promise;
  const count = pdfDoc.numPages;
  const results: { name: string; blob: Blob; width: number; height: number }[] = [];

  const baseName = (file instanceof File ? file.name : 'document').replace(/\.[^/.]+$/, '');
  const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png';

  for (let i = 1; i <= count; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not acquire 2D canvas context.');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Canvas image generation failed'))),
        format,
        format === 'image/jpeg' ? 0.92 : undefined
      );
    });

    const pad = count >= 100 ? 3 : 2;
    const num = String(i).padStart(pad, '0');
    results.push({
      name: `${baseName}-page-${num}.${ext}`,
      blob,
      width: canvas.width,
      height: canvas.height,
    });

    if (onProgress) {
      onProgress(i, count);
    }
  }

  return results;
}

/**
 * Rotate pages of a PDF document and optionally delete specified pages.
 */
export async function rotateAndOrganizePdf(
  file: File | Blob,
  pageRotations: Map<number, number>, // 0-indexed page -> absolute rotation degrees (0, 90, 180, 270)
  deletedPages?: Set<number>          // 0-indexed pages to remove
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const sourceDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const count = sourceDoc.getPageCount();

  const newDoc = await PDFDocument.create();

  for (let i = 0; i < count; i++) {
    if (deletedPages && deletedPages.has(i)) {
      continue;
    }

    const [copiedPage] = await newDoc.copyPages(sourceDoc, [i]);
    const rot = pageRotations.get(i);
    if (rot !== undefined) {
      copiedPage.setRotation(degrees(rot % 360));
    }
    newDoc.addPage(copiedPage);
  }

  if (newDoc.getPageCount() === 0) {
    throw new Error('All pages were deleted. At least one page must remain.');
  }

  const pdfBytes = await newDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

/**
 * Apply text watermark and/or page numbers to all pages of a PDF.
 */
export async function applyWatermarkAndPageNumbers(
  file: File | Blob,
  watermark?: PdfWatermarkConfig,
  pageNumbers?: PdfPageNumberConfig
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const pages = doc.getPages();
  const totalPages = pages.length;

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Parse color hex helper
  const parseHexToRgb = (hex: string) => {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) / 255 || 0;
    const g = parseInt(clean.substring(2, 4), 16) / 255 || 0;
    const b = parseInt(clean.substring(4, 6), 16) / 255 || 0;
    return rgb(r, g, b);
  };

  pages.forEach((page, idx) => {
    const { width, height } = page.getSize();
    const currentNum = (pageNumbers?.startNumber || 1) + idx;

    // 1. Watermark
    if (watermark && watermark.text.trim()) {
      const text = watermark.text;
      const fontSize = watermark.fontSize || 48;
      const textWidth = fontBold.widthOfTextAtSize(text, fontSize);
      const textHeight = fontBold.heightAtSize(fontSize);
      const color = parseHexToRgb(watermark.color || '#000000');
      const opacity = Math.min(Math.max(watermark.opacity, 0.05), 1.0);

      const x = (width - textWidth) / 2;
      let y = (height - textHeight) / 2;
      let rot = degrees(watermark.rotationAngle || -45);

      if (watermark.position === 'header') {
        y = height - textHeight - 36;
        rot = degrees(0);
      } else if (watermark.position === 'footer') {
        y = 36;
        rot = degrees(0);
      } else if (watermark.position === 'center') {
        rot = degrees(0);
      }

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font: fontBold,
        color,
        opacity,
        rotate: rot,
      });
    }

    // 2. Page numbers
    if (pageNumbers) {
      let label = `${currentNum}`;
      if (pageNumbers.format === 'page-x-of-y') {
        label = `Page ${currentNum} of ${totalPages}`;
      } else if (pageNumbers.format === 'page-x') {
        label = `Page ${currentNum}`;
      }

      const pSize = pageNumbers.fontSize || 10;
      const pWidth = font.widthOfTextAtSize(label, pSize);
      const marginOffset = 30;

      let px = (width - pWidth) / 2;
      let py = marginOffset;

      if (pageNumbers.position === 'bottom-left') {
        px = marginOffset;
        py = marginOffset;
      } else if (pageNumbers.position === 'bottom-right') {
        px = width - pWidth - marginOffset;
        py = marginOffset;
      } else if (pageNumbers.position === 'top-center') {
        px = (width - pWidth) / 2;
        py = height - marginOffset - pSize;
      } else if (pageNumbers.position === 'top-right') {
        px = width - pWidth - marginOffset;
        py = height - marginOffset - pSize;
      }

      page.drawText(label, {
        x: px,
        y: py,
        size: pSize,
        font,
        color: rgb(0.3, 0.3, 0.3),
        opacity: 0.9,
      });
    }
  });

  const pdfBytes = await doc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

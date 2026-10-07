/** PDF tools — pdf-lib + pdf.js */
import {
  formatBytes, downloadBlob, arrayBufferToBlob, parsePageRanges, getPageSizes,
} from '../utils.js';
import { setProgress, showToast } from '../ui.js';


/* ------------------------------------------------------------------ */
/* Lazy loader for Buffer + pdf-lib                                    */
/* Loads only when a PDF tool is used — saves ~370 KB on initial load */
/* ------------------------------------------------------------------ */
let _pdfLibPromise = null;

export function ensurePDFLibLoaded() {
  if (window.PDFLib) return Promise.resolve();
  if (_pdfLibPromise) return _pdfLibPromise;

  _pdfLibPromise = (async () => {
    // Step 1 — Buffer polyfill
    if (!window.Buffer) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = './js/lib/buffer.min.js';
        s.onload = resolve;
        s.onerror = () => reject(new Error('buffer.min.js failed to load'));
        document.head.appendChild(s);
      });
      if (!window.Buffer && window.buffer?.Buffer) {
        window.Buffer = window.buffer.Buffer;
      }
      window.global = window;
      globalThis.Buffer = window.Buffer;
      if (!window.process) {
        window.process = { env: {}, browser: true, version: '' };
      }
    }

    // Step 2 — pdf-lib (needs Buffer ready)
    if (!window.PDFLib) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = './js/lib/pdf-lib.min.js';
        s.async = false;
        s.onload = resolve;
        s.onerror = () => reject(new Error('pdf-lib failed to load'));
        document.head.appendChild(s);
      });
    }
  })();

  return _pdfLibPromise;
}

function getPDFLib() {
  const lib = window.PDFLib;
  if (!lib) throw new Error('pdf-lib not loaded');
  return lib;
}

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  // dynamic import fallback
  try {
    const mod = await import('../lib/pdf.min.mjs');
    window.pdfjsLib = mod;
    mod.GlobalWorkerOptions.workerSrc = './js/lib/pdf.worker.min.mjs';
    return mod;
  } catch (e) {
    throw new Error('pdf.js failed to load: ' + e.message);
  }
}

export async function mergePDFs(files, onProgress) {
  const { PDFDocument } = getPDFLib();
  const mergedPdf = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    onProgress?.(((i + 1) / files.length) * 100, `Merging ${i + 1}/${files.length}...`);
    const bytes = await files[i].arrayBuffer();
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    pages.forEach(p => mergedPdf.addPage(p));
  }
  const saved = await mergedPdf.save();
  return arrayBufferToBlob(saved);
}

export async function splitPDF(file, ranges, everyPage = false) {
  const { PDFDocument } = getPDFLib();
  const bytes = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = srcDoc.getPageCount();
  let rangeList = ranges;
  if (everyPage) {
    rangeList = Array.from({ length: total }, (_, i) => [i]);
  }
  const results = [];
  for (const range of rangeList) {
    const newDoc = await PDFDocument.create();
    const pages = await newDoc.copyPages(srcDoc, range);
    pages.forEach(p => newDoc.addPage(p));
    results.push(arrayBufferToBlob(await newDoc.save()));
  }
  return results;
}

export async function compressPDF(file, quality = 0.7, scale = 1.5, onProgress) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const { jsPDF } = window.jspdf || window;
  if (!jsPDF) throw new Error('jsPDF not loaded');

  let outputPdf = null;
  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.((i / pdf.numPages) * 100, `Compressing page ${i}/${pdf.numPages}...`);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const imgData = canvas.toDataURL('image/jpeg', quality);
    const w = viewport.width;
    const h = viewport.height;
    // Use mm roughly based on 72dpi pts
    const mmW = (w / scale) * 0.352778;
    const mmH = (h / scale) * 0.352778;
    if (i === 1) {
      outputPdf = new jsPDF({
        orientation: mmW > mmH ? 'l' : 'p',
        unit: 'mm',
        format: [mmW, mmH],
      });
    } else {
      outputPdf.addPage([mmW, mmH], mmW > mmH ? 'l' : 'p');
    }
    outputPdf.addImage(imgData, 'JPEG', 0, 0, mmW, mmH);
    canvas.width = 0; canvas.height = 0;
  }
  return outputPdf.output('blob');
}

export async function deletePages(file, pagesToDelete) {
  const { PDFDocument } = getPDFLib();
  const bytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const sorted = [...pagesToDelete].sort((a, b) => b - a);
  sorted.forEach(i => {
    if (i >= 0 && i < pdfDoc.getPageCount()) pdfDoc.removePage(i);
  });
  return arrayBufferToBlob(await pdfDoc.save());
}

export async function extractPages(file, pageIndices) {
  const { PDFDocument } = getPDFLib();
  const bytes = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const newDoc = await PDFDocument.create();
  const pages = await newDoc.copyPages(srcDoc, pageIndices);
  pages.forEach(p => newDoc.addPage(p));
  return arrayBufferToBlob(await newDoc.save());
}

export async function rotatePages(file, angle, pageIndices = null) {
  const { PDFDocument, degrees } = getPDFLib();
  const bytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const targets = pageIndices ?? pages.map((_, i) => i);
  targets.forEach(i => {
    if (i >= 0 && i < pages.length) {
      const page = pages[i];
      const current = page.getRotation().angle;
      page.setRotation(degrees(current + angle));
    }
  });
  return arrayBufferToBlob(await pdfDoc.save());
}

export async function reorderPages(file, order) {
  const { PDFDocument } = getPDFLib();
  const bytes = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const newDoc = await PDFDocument.create();
  const pages = await newDoc.copyPages(srcDoc, order);
  pages.forEach(p => newDoc.addPage(p));
  return arrayBufferToBlob(await newDoc.save());
}

export async function addWatermark(file, text, options = {}) {
  const { PDFDocument, rgb, StandardFonts, degrees } = getPDFLib();
  const bytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const {
    fontSize = 48,
    opacity = 0.3,
    angle = 45,
    color = { r: 0.5, g: 0.5, b: 0.5 },
  } = options;
  const col = rgb(color.r, color.g, color.b);
  pdfDoc.getPages().forEach(page => {
    const { width, height } = page.getSize();
    page.drawText(text, {
      x: width / 4,
      y: height / 3,
      size: fontSize,
      font,
      color: col,
      opacity,
      rotate: degrees(angle),
    });
  });
  return arrayBufferToBlob(await pdfDoc.save());
}

export async function addPageNumbers(file, options = {}) {
  const { PDFDocument, rgb, StandardFonts } = getPDFLib();
  const { startNumber = 1, format = 'Page {n} of {total}', position = 'bottom-center' } = options;
  const bytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const total = pdfDoc.getPageCount();
  pdfDoc.getPages().forEach((page, i) => {
    const { width, height } = page.getSize();
    const label = format
      .replace('{n}', String(i + startNumber))
      .replace('{total}', String(total));
    const textWidth = font.widthOfTextAtSize(label, 10);
    let x = (width - textWidth) / 2;
    let y = 20;
    if (position === 'bottom-right') { x = width - textWidth - 20; y = 20; }
    if (position === 'top-center') { x = (width - textWidth) / 2; y = height - 30; }
    page.drawText(label, {
      x, y, size: 10, font, color: rgb(0.3, 0.3, 0.3),
    });
  });
  return arrayBufferToBlob(await pdfDoc.save());
}

export async function removeMetadata(file) {
  const { PDFDocument } = getPDFLib();
  const bytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
  pdfDoc.setTitle('');
  pdfDoc.setAuthor('');
  pdfDoc.setSubject('');
  pdfDoc.setKeywords([]);
  pdfDoc.setCreator('');
  pdfDoc.setProducer('');
  return arrayBufferToBlob(await pdfDoc.save());
}

export async function extractText(file, onProgress) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.((i / pdf.numPages) * 100, `Extracting page ${i}/${pdf.numPages}...`);
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += `--- Page ${i} ---\n${pageText}\n\n`;
  }
  return fullText;
}

export async function imagesToPDF(files, pageSizeKey = 'a4', orient = 'portrait', onProgress) {
  const { PDFDocument } = getPDFLib();
  const sizes = getPageSizes();
  let pageSize = sizes[pageSizeKey] || sizes.a4;
  if (orient === 'landscape' && pageSize) pageSize = [pageSize[1], pageSize[0]];

  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    onProgress?.(((i + 1) / files.length) * 100, `Adding image ${i + 1}/${files.length}...`);
    const file = files[i];
    let bytes = await file.arrayBuffer();
    let image;
    const type = file.type;
    if (type === 'image/jpeg' || type === 'image/jpg') {
      image = await pdfDoc.embedJpg(bytes);
    } else if (type === 'image/png') {
      image = await pdfDoc.embedPng(bytes);
    } else {
      const pngBlob = await (await import('../utils.js')).convertToPngBlob(file);
      bytes = await pngBlob.arrayBuffer();
      image = await pdfDoc.embedPng(bytes);
    }
    const { width: iw, height: ih } = image.scale(1);
    let pw, ph;
    if (pageSizeKey === 'fit' || !pageSize) {
      pw = iw; ph = ih;
    } else {
      pw = pageSize[0]; ph = pageSize[1];
    }
    const page = pdfDoc.addPage([pw, ph]);
    const scale = Math.min(pw / iw, ph / ih);
    page.drawImage(image, {
      x: (pw - iw * scale) / 2,
      y: (ph - ih * scale) / 2,
      width: iw * scale,
      height: ih * scale,
    });
  }
  return arrayBufferToBlob(await pdfDoc.save());
}

export async function pdfToImages(file, format = 'png', scale = 2, quality = 0.92, onProgress) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const images = [];
  const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.((i / pdf.numPages) * 100, `Rendering page ${i}/${pdf.numPages}...`);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const blob = await new Promise(r => canvas.toBlob(r, mime, quality));
    images.push(blob);
    canvas.width = 0; canvas.height = 0;
  }
  return images;
}

export async function createBlankPDF(pageCount = 1, sizeKey = 'a4', orient = 'portrait') {
  const { PDFDocument } = getPDFLib();
  const sizes = getPageSizes();
  let size = sizes[sizeKey] || sizes.a4;
  if (orient === 'landscape') size = [size[1], size[0]];
  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) pdfDoc.addPage(size);
  return arrayBufferToBlob(await pdfDoc.save());
}

export async function renderPageThumbnails(file, maxPages = 50) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const count = Math.min(pdf.numPages, maxPages);
  const thumbs = [];
  for (let i = 1; i <= count; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.3 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    thumbs.push({ index: i - 1, canvas, pageNum: i });
  }
  return { thumbs, totalPages: pdf.numPages };
}

export async function tryUnlockPDF(file, password) {
  const { PDFDocument } = getPDFLib();
  const bytes = await file.arrayBuffer();
  try {
    const pdfDoc = await PDFDocument.load(bytes, { password, ignoreEncryption: false });
    return arrayBufferToBlob(await pdfDoc.save());
  } catch (e) {
    // pdf-lib may not fully support decryption without pdf-lib-encrypt
    throw new Error('Unable to unlock: wrong password or encryption not supported client-side without pdf-lib-encrypt.');
  }
}

export async function tryProtectPDF(file, userPassword, ownerPassword) {
  const { PDFDocument } = getPDFLib();
  const bytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });

  // ✅ @cantoo/pdf-lib: encrypt() mutates the document in-place
  //    (does NOT return bytes)
  pdfDoc.encrypt({
    userPassword: userPassword || ownerPassword || '',
    ownerPassword: ownerPassword || userPassword || '',
    permissions: {
      printing: 'highResolution',
      modifying: false,
      copying: false,
      annotating: false,
      fillingForms: false,
      contentAccessibility: true,
      documentAssembly: false,
    },
  });

  // ✅ save() AFTER encrypt() gives the encrypted bytes
  const encryptedBytes = await pdfDoc.save();
  return new Blob([encryptedBytes], { type: 'application/pdf' });
}
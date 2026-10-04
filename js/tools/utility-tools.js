/** Utility tools */
import {
  formatBytes, downloadBlob, sha256Hex, sha1Hex, sha512Hex,
  imageToBase64, base64ToBlob,
} from '../utils.js';

export async function getFileInfo(file) {
  const info = {
    name: file.name,
    size: file.size,
    sizeFormatted: formatBytes(file.size),
    type: file.type || 'unknown',
    lastModified: new Date(file.lastModified).toLocaleString(),
  };

  if (file.type === 'application/pdf') {
    try {
      let pdfjs = window.pdfjsLib;
      if (!pdfjs) {
        const mod = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs');
        pdfjs = mod;
        mod.GlobalWorkerOptions.workerSrc =
          'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';
      }
      const data = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjs.getDocument({ data }).promise;
      info.pages = pdf.numPages;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      info.pageSize = `${Math.round(viewport.width)}×${Math.round(viewport.height)} pts`;
    } catch (e) {
      info.pages = '—';
      info.error = e.message;
    }
  } else if (file.type.startsWith('image/')) {
    try {
      const bitmap = await createImageBitmap(file);
      info.width = bitmap.width;
      info.height = bitmap.height;
      bitmap.close?.();
    } catch (_) {
      info.width = '—';
      info.height = '—';
    }
  }
  return info;
}

export async function createZip(files, zipName = 'zendoc-output.zip') {
  if (!window.JSZip) throw new Error('JSZip not loaded');
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.name || 'file', file);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, zipName);
  return blob;
}

export async function generateHash(file, algo = 'SHA-256') {
  if (algo === 'SHA-1') return sha1Hex(file);
  if (algo === 'SHA-512') return sha512Hex(file);
  return sha256Hex(file);
}

export { imageToBase64, base64ToBlob, formatBytes };

/** ZenDoc utilities */

export function formatBytes(bytes) {
  if (bytes == null || isNaN(bytes)) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export function downloadBlob(blob, filename) {
  if (typeof saveAs === 'function') {
    saveAs(blob, filename);
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function arrayBufferToBlob(buf, type = 'application/pdf') {
  return new Blob([buf], { type });
}

export async function fileToArrayBuffer(file) {
  return file.arrayBuffer();
}

export function createObjectURL(blob) {
  return URL.createObjectURL(blob);
}

export function revokeObjectURL(url) {
  try { URL.revokeObjectURL(url); } catch (_) { }
}

export function parsePageRanges(str, totalPages) {
  // "1-5, 7, 10-12" → 0-based indices
  const indices = new Set();
  if (!str || !str.trim()) return [];
  const parts = str.split(',');
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    if (p.includes('-')) {
      const [a, b] = p.split('-').map(s => parseInt(s.trim(), 10));
      if (isNaN(a) || isNaN(b)) continue;
      const start = Math.max(1, Math.min(a, b));
      const end = Math.min(totalPages, Math.max(a, b));
      for (let i = start; i <= end; i++) indices.add(i - 1);
    } else {
      const n = parseInt(p, 10);
      if (!isNaN(n) && n >= 1 && n <= totalPages) indices.add(n - 1);
    }
  }
  return Array.from(indices).sort((a, b) => a - b);
}

export function warnLargeFile(file) {
  return file.size > 50 * 1024 * 1024;
}

export async function convertToPngBlob(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
}

export async function sha256Hex(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha1Hex(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha512Hex(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-512', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function imageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function base64ToBlob(dataUrl) {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const bstr = atob(arr[1] || arr[0]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new Blob([u8arr], { type: mime });
}

export function getAcceptForTool(toolId) {
  const pdf = '.pdf,application/pdf';
  const img = 'image/jpeg,image/png,image/webp,image/bmp,.jpg,.jpeg,.png,.webp,.bmp';
  const both = pdf + ',' + img;
  const map = {
    merge: pdf, split: pdf, 'compress-pdf': pdf, 'delete-pages': pdf,
    'extract-pages': pdf, rotate: pdf, reorder: pdf, 'watermark-pdf': pdf,
    'page-numbers': pdf, 'remove-meta': pdf, protect: pdf, unlock: pdf,
    'extract-text': pdf, 'images-to-pdf': img, 'pdf-to-images': pdf,
    'compress-img': img, resize: img, 'convert-img': img, crop: img,
    'rotate-img': img, 'remove-exif': img, 'watermark-img': img,
    'file-info': both, 'blank-pdf': '', zip: both, hash: both, base64: both,
  };
  return map[toolId] || both;
}

export function getPageSizes() {
  return {
    a4: [595.28, 841.89],
    letter: [612, 792],
    a3: [841.89, 1190.55],
    fit: null,
  };
}

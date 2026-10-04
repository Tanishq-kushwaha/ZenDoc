/** Image tools */
import { downloadBlob } from '../utils.js';

export async function compressImage(file, options = {}) {
  const imageCompression = window.imageCompression;
  if (!imageCompression) throw new Error('browser-image-compression not loaded');
  const defaultOptions = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    initialQuality: 0.8,
  };
  return imageCompression(file, { ...defaultOptions, ...options });
}

export async function resizeImage(file, targetWidth, targetHeight) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close?.();
  const type = file.type || 'image/png';
  return new Promise(r => canvas.toBlob(r, type, 0.92));
}

export async function convertImage(file, targetFormat, quality = 0.92) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (targetFormat === 'jpeg' || targetFormat === 'jpg') {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const mime = targetFormat === 'jpeg' || targetFormat === 'jpg'
    ? 'image/jpeg'
    : targetFormat === 'webp'
      ? 'image/webp'
      : 'image/png';
  return new Promise(r => canvas.toBlob(r, mime, quality));
}

export async function cropImage(file, { x, y, width, height }) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(
    bitmap,
    x, y, width, height,
    0, 0, width, height
  );
  bitmap.close?.();
  return new Promise(r => canvas.toBlob(r, file.type || 'image/png', 0.92));
}

export async function rotateImage(file, angle, flipH = false, flipV = false) {
  const bitmap = await createImageBitmap(file);
  const rad = (angle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const newW = Math.round(bitmap.width * cos + bitmap.height * sin) || bitmap.width;
  const newH = Math.round(bitmap.width * sin + bitmap.height * cos) || bitmap.height;
  const canvas = document.createElement('canvas');
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext('2d');
  ctx.translate(newW / 2, newH / 2);
  ctx.rotate(rad);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close?.();
  return new Promise(r => canvas.toBlob(r, file.type || 'image/png', 0.92));
}

export async function removeExif(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return new Promise(r => canvas.toBlob(r, file.type || 'image/jpeg', 0.95));
}

export async function watermarkImage(file, text, options = {}) {
  const {
    fontSize = 36,
    opacity = 0.5,
    color = 'white',
    position = 'center',
  } = options;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (position === 'center') {
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  } else if (position === 'tile') {
    for (let x = fontSize; x < canvas.width; x += fontSize * 6) {
      for (let y = fontSize; y < canvas.height; y += fontSize * 4) {
        ctx.fillText(text, x, y);
      }
    }
  } else {
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(text, canvas.width - 16, canvas.height - 16);
  }
  return new Promise(r => canvas.toBlob(r, file.type || 'image/png', 0.92));
}

export async function getImageDimensions(file) {
  const bitmap = await createImageBitmap(file);
  const dims = { width: bitmap.width, height: bitmap.height };
  bitmap.close?.();
  return dims;
}

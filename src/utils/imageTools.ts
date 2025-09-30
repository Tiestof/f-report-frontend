/**
 * ============================================================
 * Archivo: src/utils/imageTools.ts
 * Propósito:
 *  - Utilidades de imagen en cliente (canvas).
 *  - Detección de imagen.
 *  - Compresión a JPEG en BLANCO Y NEGRO y en COLOR.
 * ============================================================
 */

/** True si el File es imagen (según mimetype) */
export function isImageFile(f: File) {
  return /^image\//i.test(f.type || '');
}

type CompressOpts = {
  maxW?: number;
  maxH?: number;
  qualityStart?: number;   // 0..1
  qualityMin?: number;     // 0..1
  targetMaxBytes?: number; // bytes
};

// ========== BLANCO Y NEGRO ==========
export async function grayscaleCompressToJpegBlob(
  file: File,
  opts: CompressOpts = {}
): Promise<Blob> {
  const {
    maxW = 1600,
    maxH = 1200,
    qualityStart = 0.8,
    qualityMin = 0.5,
    targetMaxBytes = 2 * 1024 * 1024,
  } = opts;

  const img = await fileToHTMLImageElement(file);
  const { w, h } = fitSize(img.naturalWidth, img.naturalHeight, maxW, maxH);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);

  // Escala de grises
  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = y;
  }
  ctx.putImageData(im, 0, 0);

  // Export con ajuste de calidad
  return await exportWithTarget(canvas, 'image/jpeg', qualityStart, qualityMin, targetMaxBytes);
}

// ========== COLOR (para cámara/HEIC) ==========
export async function colorCompressToJpegBlob(
  file: File,
  opts: CompressOpts = {}
): Promise<Blob> {
  const {
    maxW = 1600,
    maxH = 1200,
    qualityStart = 0.85,
    qualityMin = 0.6,
    targetMaxBytes = 2 * 1024 * 1024,
  } = opts;

  const img = await fileToHTMLImageElement(file);
  const { w, h } = fitSize(img.naturalWidth, img.naturalHeight, maxW, maxH);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);

  // Sin conversión a gris: mantenemos color
  return await exportWithTarget(canvas, 'image/jpeg', qualityStart, qualityMin, targetMaxBytes);
}

// ========== Helpers ==========
function fileToHTMLImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function fitSize(srcW: number, srcH: number, maxW: number, maxH: number) {
  const r = Math.min(maxW / srcW, maxH / srcH, 1);
  return { w: Math.round(srcW * r), h: Math.round(srcH * r) };
}

async function exportWithTarget(
  canvas: HTMLCanvasElement,
  type: string,
  qualityStart: number,
  qualityMin: number,
  targetMaxBytes: number
): Promise<Blob> {
  let q = qualityStart;
  let blob = await canvasToBlob(canvas, type, q);
  if (!blob) throw new Error('No fue posible crear JPG');

  while (blob.size > targetMaxBytes && q > qualityMin) {
    q = Math.max(qualityMin, q - 0.08);
    const next = await canvasToBlob(canvas, type, q);
    if (!next) break;
    blob = next;
  }
  return blob;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b as Blob), type, quality);
  });
}

/**
 * ============================================================
 * Archivo: src/utils/imageTools.ts
 * Descripción: Compresión y B/N en cliente usando Canvas.
 * ============================================================
 */

type Opts = { maxW?: number; maxH?: number; grayscale?: boolean; quality?: number };

export async function compressToJpegDataURL(file: File, opts: Opts = {}): Promise<string> {
  const img = await readFileToImage(file);
  const { canvas, ctx, w, h } = drawToCanvas(img, opts.maxW ?? 1600, opts.maxH ?? 1200);
  if (opts.grayscale) toGrayscale(ctx, w, h);
  return canvas.toDataURL('image/jpeg', opts.quality ?? 0.7);
}

function readFileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = String(fr.result);
    };
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

function drawToCanvas(img: HTMLImageElement, maxW: number, maxH: number) {
  let { width: w, height: h } = img;
  const r = Math.min(maxW / w, maxH / h, 1);
  w = Math.round(w * r); h = Math.round(h * r);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  return { canvas, ctx, w, h };
}

function toGrayscale(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const imgData = ctx.getImageData(0,0,w,h);
  const d = imgData.data;
  for (let i=0; i<d.length; i+=4) {
    const y = 0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2];
    d[i] = d[i+1] = d[i+2] = y;
  }
  ctx.putImageData(imgData, 0, 0);
}

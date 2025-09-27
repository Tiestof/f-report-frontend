/**
 * ============================================================
 * Archivo: src/components/ui/SignaturePad.tsx
 * Componente: SignaturePad (Pointer Events + DPR)
 * Descripción: Canvas para firma digital. Exporta PNG DataURL.
 * ============================================================
 */

import { useEffect, useRef } from 'react';

type Props = {
  height?: number; // CSS height (el ancho se ajusta al contenedor)
  onChange?: (dataUrl: string) => void;
};

export default function SignaturePad({ height = 220, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);

  function setupCanvas() {
    const c = canvasRef.current;
    if (!c) return;
    const parent = c.parentElement;
    const cssW = Math.max(280, parent?.clientWidth || c.clientWidth || 600);
    const cssH = height;
    const dpr = window.devicePixelRatio || 1;

    c.width = Math.floor(cssW * dpr);
    c.height = Math.floor(cssH * dpr);
    c.style.width = `${cssW}px`;
    c.style.height = `${cssH}px`;

    const ctx = c.getContext('2d');
    ctxRef.current = ctx;
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.lineWidth = Math.max(2, 2 * dpr);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111';
  }

  useEffect(() => {
    setupCanvas();
    const onResize = () => setupCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function coords(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const scaleX = c.width / r.width;
    const scaleY = c.height / r.height;
    return {
      x: (e.clientX - r.left) * scaleX,
      y: (e.clientY - r.top) * scaleY,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const c = canvasRef.current, ctx = ctxRef.current;
    if (!c || !ctx) return;
    drawingRef.current = true;
    c.setPointerCapture?.(e.pointerId);
    const { x, y } = coords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = ctxRef.current; if (!ctx) return;
    const { x, y } = coords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function onPointerUp(e?: React.PointerEvent<HTMLCanvasElement>) {
    if (e) e.preventDefault();
    drawingRef.current = false;
    ctxRef.current?.beginPath();
    if (onChange && canvasRef.current) onChange(canvasRef.current.toDataURL('image/png'));
  }

  function clear() {
    const c = canvasRef.current, ctx = ctxRef.current;
    if (!c || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    if (onChange) onChange(c.toDataURL('image/png'));
  }

  return (
    <div className="rounded-xl border border-slate-300 dark:border-slate-700 p-2">
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height, touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="flex justify-end mt-2">
        <button type="button" className="px-2 py-1 rounded-lg border text-xs" onClick={clear}>
          Limpiar
        </button>
      </div>
    </div>
  );
}

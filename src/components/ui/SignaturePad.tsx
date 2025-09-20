/**
 * ============================================================
 * Archivo: src/components/ui/SignaturePad.tsx
 * Componente: SignaturePad
 * Descripción: Canvas simple para “firma digital”. Exporta DataURL PNG.
 * ============================================================
 */

import { useEffect, useRef } from 'react';

type Props = {
  width?: number;
  height?: number;
  onChange?: (dataUrl: string) => void;
};

export default function SignaturePad({ width = 480, height = 160, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111';
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    let x = 0,
      y = 0;
    if ('touches' in e && e.touches.length) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else if ('clientX' in e) {
      x = (e as React.MouseEvent).clientX - rect.left;
      y = (e as React.MouseEvent).clientY - rect.top;
    }
    return { x, y };
  };

  const start = (e: any) => {
    drawing.current = true;
    last.current = getPos(e);
  };
  const move = (e: any) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const pos = getPos(e);
    const l = last.current!;
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    last.current = pos;
  };
  const end = () => {
    drawing.current = false;
    last.current = null;
    if (onChange) onChange(canvasRef.current!.toDataURL('image/png'));
  };
  const clear = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    if (onChange) onChange(c.toDataURL('image/png'));
  };

  return (
    <div className="rounded-xl border p-2">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full touch-none rounded-lg bg-white"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div className="flex justify-end mt-2">
        <button type="button" className="px-2 py-1 rounded-lg border text-xs" onClick={clear}>
          Limpiar
        </button>
      </div>
    </div>
  );
}

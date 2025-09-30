/**
 * ============================================================
 * Archivo: src/components/ui/SignaturePad.tsx
 * Componente: SignaturePad (robusto y cross-browser)
 * Propósito:
 *  - Canvas de firma con soporte Pointer Events y fallbacks mouse/touch.
 *  - Escala por DPR; trazo proporcional; fondo blanco.
 *  - Evita setPointerCapture() (problemas en Chrome Android dentro de scroll).
 *  - Expone clear() y toDataURL() vía forwardRef.
 * Notas:
 *  - Se eliminan los preventDefault() en touch* para evitar el warning
 *    "Unable to preventDefault inside passive event listener".
 *  - Mantenemos style { touchAction:'none' } para bloquear el scroll durante la firma.
 * ============================================================
 */

import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';

export type SignaturePadHandle = {
  clear: () => void;
  toDataURL: (type?: string, quality?: number) => string;
};

type Props = {
  /** Alto CSS. El ancho se ajusta al contenedor. */
  height?: number;
  /** Ancho mínimo CSS para asegurar área cómoda. */
  minWidth?: number;
  /** Callback opcional cuando cambia la firma (devuelve DataURL PNG). */
  onChange?: (dataUrl: string) => void;
  /** Grosor base del trazo (se escala con DPR). */
  baseLineWidth?: number;
};

const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  {
    height = 220,
    minWidth = 280,
    onChange,
    baseLineWidth = 2,
  }: Props,
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const drawingRef = useRef(false);
  const activePointerId = useRef<number | null>(null);

  const setupCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;

    const parent = c.parentElement;
    const cssW = Math.max(minWidth, parent?.clientWidth || c.clientWidth || 600);
    const cssH = height;
    const dpr = window.devicePixelRatio || 1;

    c.width = Math.floor(cssW * dpr);
    c.height = Math.floor(cssH * dpr);
    c.style.width = `${cssW}px`;
    c.style.height = `${cssH}px`;
    c.style.display = 'block'; // evitar glitches de inline-canvas

    const ctx = c.getContext('2d');
    ctxRef.current = ctx;
    if (!ctx) return;

    // Fondo blanco
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);

    // Trazo negro con grosor proporcional al DPR
    ctx.lineWidth = Math.max(baseLineWidth, baseLineWidth * dpr);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111';
  }, [height, minWidth, baseLineWidth]);

  useEffect(() => {
    setupCanvas();
    const onResize = () => setupCanvas();
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, [setupCanvas]);

  const getCoords = (clientX: number, clientY: number) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const scaleX = c.width / r.width;
    const scaleY = c.height / r.height;
    return {
      x: (clientX - r.left) * scaleX,
      y: (clientY - r.top) * scaleY,
    };
  };

  // ---------- Pointer Events ----------
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const c = canvasRef.current;
    const ctx = ctxRef.current;
    if (!c || !ctx) return;

    drawingRef.current = true;
    activePointerId.current = e.pointerId;

    const { x, y } = getCoords(e.clientX, e.clientY);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || activePointerId.current !== e.pointerId) return;
    e.preventDefault();
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { x, y } = getCoords(e.clientX, e.clientY);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const finishStroke = () => {
    drawingRef.current = false;
    activePointerId.current = null;
    ctxRef.current?.beginPath();
    if (onChange && canvasRef.current) {
      onChange(canvasRef.current.toDataURL('image/png'));
    }
  };

  const onPointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e) e.preventDefault();
    finishStroke();
  };

  const onPointerCancel = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e) e.preventDefault();
    finishStroke();
  };

  // ---------- Fallback: Mouse ----------
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if ((e.buttons & 1) === 0) return; // solo botón primario
    onPointerDown((e as unknown) as React.PointerEvent<HTMLCanvasElement>);
  };
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    onPointerMove((e as unknown) as React.PointerEvent<HTMLCanvasElement>);
  };
  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    onPointerUp((e as unknown) as React.PointerEvent<HTMLCanvasElement>);
  };

  // ---------- Fallback: Touch ----------
  // Importante:
  //  - NO usamos preventDefault() aquí para evitar el warning de listeners pasivos.
  //  - La prevención del scroll ya la hace style={{ touchAction:'none' }}.
  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!e.touches.length) return;
    const t = e.touches[0];
    const c = canvasRef.current;
    const ctx = ctxRef.current;
    if (!c || !ctx) return;

    drawingRef.current = true;
    const { x, y } = getCoords(t.clientX, t.clientY);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !e.touches.length) return;
    const t = e.touches[0];
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { x, y } = getCoords(t.clientX, t.clientY);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const onTouchEnd = (_e: React.TouchEvent<HTMLCanvasElement>) => {
    finishStroke();
  };

  // ---------- API pública ----------
  const clear = useCallback(() => {
    const c = canvasRef.current;
    const ctx = ctxRef.current;
    if (!c || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    if (onChange) onChange(c.toDataURL('image/png'));
  }, [onChange]);

  const toDataURL = (type?: string, quality?: number) =>
    canvasRef.current?.toDataURL(type, quality) ?? '';

  useImperativeHandle(ref, () => ({
    clear,
    toDataURL,
  }));

  return (
    <div className="rounded-xl border border-slate-300 dark:border-slate-700 p-2">
      <canvas
        ref={canvasRef}
        className="w-full select-none"
        style={{
          height,
          touchAction: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          msTouchAction: 'none' as any,
          pointerEvents: 'auto',
        }}
        // Pointer events
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerCancel}
        // Fallbacks
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        // Evitar menú contextual
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="flex justify-end mt-2">
        <button
          type="button"
          className="px-2 py-1 rounded-lg border text-xs"
          onClick={clear}
        >
          Limpiar
        </button>
      </div>
    </div>
  );
});

export default SignaturePad;

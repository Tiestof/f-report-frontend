/**
 * ============================================================
 * Archivo: src/components/ui/SignaturePad.tsx
 * Componente: SignaturePad (iOS-safe, cross-browser)
 * Propósito:
 *  - Canvas de firma con soporte Pointer Events + fallbacks.
 *  - Calibración robusta: useLayoutEffect + rAF + ResizeObserver.
 *  - Evita setPointerCapture(); detiene propagación para no
 *    perder toques en contenedores con scroll/overlays.
 *  - Expone clear() y toDataURL() vía forwardRef.
 * ============================================================
 */

import React, {
  useLayoutEffect,
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
  /** Callback opcional cuando cambia la firma (DataURL PNG). */
  onChange?: (dataUrl: string) => void;
  /** Grosor base del trazo (se escala con DPR). */
  baseLineWidth?: number;
  /** Clases extra para el contenedor raíz. */
  className?: string;
};

const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  {
    height = 220,
    minWidth = 280,
    onChange,
    baseLineWidth = 2,
    className,
  }: Props,
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const drawingRef = useRef(false);
  const activePointerId = useRef<number | null>(null);
  const lastCssWRef = useRef<number>(0);

  const setupCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;

    const parent = c.parentElement;
    let cssW = Math.max(minWidth, parent?.clientWidth || c.clientWidth || 600);
    const cssH = height;

    // Si por timing el contenedor aún no tiene width, prueba con innerWidth
    if (!cssW || cssW <= 1) cssW = Math.max(minWidth, Math.floor(window.innerWidth * 0.9));

    const dpr = window.devicePixelRatio || 1;

    c.width = Math.floor(cssW * dpr);
    c.height = Math.floor(cssH * dpr);
    c.style.width = `${cssW}px`;
    c.style.height = `${cssH}px`;
    c.style.display = 'block';

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

    lastCssWRef.current = cssW;
  }, [height, minWidth, baseLineWidth]);

  // Medición inicial *antes del pintado* (consistente) y rAF para trasición/animaciones.
  useLayoutEffect(() => {
    setupCanvas();
    const raf = requestAnimationFrame(setupCanvas);
    return () => cancelAnimationFrame(raf);
  }, [setupCanvas]);

  // ResizeObserver para cambios posteriores de layout (apertura modal, rotación, etc.).
  useEffect(() => {
    const c = canvasRef.current;
    const parent = c?.parentElement;
    if (!parent) return;

    const ro = new ResizeObserver(() => {
      setupCanvas();
    });
    ro.observe(parent);
    return () => {
      ro.disconnect();
    };
  }, [setupCanvas]);

  const getCoords = (clientX: number, clientY: number) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const scaleX = c.width / (r.width || 1);
    const scaleY = c.height / (r.height || 1);
    return {
      x: (clientX - r.left) * scaleX,
      y: (clientY - r.top) * scaleY,
    };
  };

  // Recalibra "en caliente" si por timing el canvas quedó sin medida válida.
  const ensureCalibrated = () => {
    const c = canvasRef.current!;
    if (!c.width || !c.height || (c.parentElement && (c.parentElement.clientWidth !== lastCssWRef.current))) {
      setupCanvas();
    }
  };

  // ---------- Pointer Events ----------
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const c = canvasRef.current;
    const ctx = ctxRef.current;
    if (!c || !ctx) return;

    ensureCalibrated();

    drawingRef.current = true;
    activePointerId.current = e.pointerId;

    const { x, y } = getCoords(e.clientX, e.clientY);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || activePointerId.current !== e.pointerId) return;
    e.stopPropagation();
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
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    finishStroke();
  };

  const onPointerCancel = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    finishStroke();
  };

  // ---------- Fallback: Mouse ----------
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if ((e.buttons & 1) === 0) return;
    onPointerDown((e as unknown) as React.PointerEvent<HTMLCanvasElement>);
  };
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    onPointerMove((e as unknown) as React.PointerEvent<HTMLCanvasElement>);
  };
  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    onPointerUp((e as unknown) as React.PointerEvent<HTMLCanvasElement>);
  };

  // ---------- Fallback: Touch ----------
  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.stopPropagation(); // evita que el modal/overlay “robe” el toque
    if (!e.touches.length) return;
    ensureCalibrated();

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
    e.stopPropagation();
    if (!drawingRef.current || !e.touches.length) return;
    const t = e.touches[0];
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { x, y } = getCoords(t.clientX, t.clientY);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
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

  const rootClass = `rounded-xl border border-slate-300 dark:border-slate-700 p-2 ${className ?? ''}`;

  return (
    <div
      className={rootClass}
      // Capturamos eventos en el wrapper también para que nada suba al overlay
      onPointerDownCapture={(e) => e.stopPropagation()}
      onTouchStartCapture={(e) => e.stopPropagation()}
    >
      <canvas
        ref={canvasRef}
        className="w-full select-none"
        style={{
          height,
          touchAction: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          WebkitTouchCallout: 'none',
          msTouchAction: 'none' as any,
          pointerEvents: 'auto',
          cursor: 'crosshair',
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
          aria-label="Limpiar firma"
          title="Limpiar firma"
        >
          Limpiar
        </button>
      </div>
    </div>
  );
});

export default SignaturePad;

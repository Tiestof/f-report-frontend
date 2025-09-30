/**
 * ============================================================
 * Archivo: src/components/ui/SignaturePad.tsx
 * Componente: SignaturePad (iOS-safe + Debug)
 * Propósito:
 *  - Dibujo robusto en iOS Safari/Chrome y escritorio (mouse).
 *  - Maneja Pointer Events y Touch nativo (iOS) con { passive:false }.
 *  - Calibración (ResizeObserver + useLayoutEffect + rAF).
 *  - Bloquea scroll solo mientras dibujas (opcional).
 *  - Overlay "tocar para activar" (opcional).
 *  - Logs detallados (activables por prop).
 * API pública: clear(), toDataURL().
 * ============================================================
 */

import React, {
  useLayoutEffect,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useState,
} from 'react';

export type SignaturePadHandle = {
  clear: () => void;
  toDataURL: (type?: string, quality?: number) => string;
};

type Props = {
  height?: number;          // Alto CSS
  minWidth?: number;        // Ancho mínimo CSS
  onChange?: (dataUrl: string) => void; // callback PNG dataURL al terminar un trazo
  baseLineWidth?: number;   // Grosor base (escala con DPR)
  className?: string;       // Clases extra contenedor
  debug?: boolean;          // Activa logs detallados
  lockScrollWhileDrawing?: boolean; // Bloquear scroll del body mientras se dibuja (default: true en iOS)
  requireTapToActivate?: boolean;   // Muestra overlay para “activar” antes de dibujar
};

function isIOSWebKit(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iP(ad|hone|od)/i.test(ua);
}

const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  {
    height = 220,
    minWidth = 280,
    onChange,
    baseLineWidth = 2,
    className,
    debug = false,
    lockScrollWhileDrawing,
    requireTapToActivate = false,
  }: Props,
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const drawingRef = useRef(false);
  const activePointerId = useRef<number | null>(null);
  const lastCssWRef = useRef<number>(0);
  const usedNativeTouchRef = useRef<boolean>(false);
  const isIOS = isIOSWebKit();

  const shouldLockScroll = lockScrollWhileDrawing ?? isIOS;
  const [armed, setArmed] = useState(!requireTapToActivate);

  const log = (...args: any[]) => {
    if (!debug) return;
    console.debug('[SignaturePad]', ...args);
  };

  const setupCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;

    const parent = c.parentElement;
    let cssW = Math.max(minWidth, parent?.clientWidth || c.clientWidth || 0);
    const cssH = height;

    if (!cssW || cssW <= 1) cssW = Math.max(minWidth, Math.floor((typeof window !== 'undefined' ? window.innerWidth : 800) * 0.9));

    const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;

    c.width = Math.floor(cssW * dpr);
    c.height = Math.floor(cssH * dpr);
    c.style.width = `${cssW}px`;
    c.style.height = `${cssH}px`;
    c.style.display = 'block';

    const ctx = c.getContext('2d');
    ctxRef.current = ctx;
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.lineWidth = Math.max(baseLineWidth, baseLineWidth * dpr);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111';

    lastCssWRef.current = cssW;

    log('setupCanvas', { cssW, cssH, dpr, pixelW: c.width, pixelH: c.height });
  }, [height, minWidth, baseLineWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  const ensureCalibrated = () => {
    const c = canvasRef.current;
    if (!c) return;
    if (!c.width || !c.height || (c.parentElement && c.parentElement.clientWidth !== lastCssWRef.current)) {
      log('ensureCalibrated: recalibrando');
      setupCanvas();
    }
  };

  const getCoords = (clientX: number, clientY: number) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const scaleX = c.width / Math.max(1, r.width);
    const scaleY = c.height / Math.max(1, r.height);
    const x = (clientX - r.left) * scaleX;
    const y = (clientY - r.top) * scaleY;
    return { x, y, r };
  };

  useLayoutEffect(() => {
    setupCanvas();
    const raf = requestAnimationFrame(setupCanvas);
    return () => cancelAnimationFrame(raf);
  }, [setupCanvas]);

  useEffect(() => {
    const c = canvasRef.current;
    const parent = c?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => setupCanvas());
    ro.observe(parent);
    return () => ro.disconnect();
  }, [setupCanvas]);

  // Bloqueo de scroll mientras dibujas
  const bodyOverflowPrev = useRef<{ body?: string; html?: string }>({});
  const lockScroll = () => {
    if (!shouldLockScroll) return;
    const b = document.body as any;
    const h = document.documentElement as any;
    bodyOverflowPrev.current = { body: b.style.overflow, html: h.style.overflow };
    b.style.overflow = 'hidden';
    h.style.overflow = 'hidden';
    log('lockScroll');
  };
  const unlockScroll = () => {
    if (!shouldLockScroll) return;
    const b = document.body as any;
    const h = document.documentElement as any;
    b.style.overflow = bodyOverflowPrev.current.body ?? '';
    h.style.overflow = bodyOverflowPrev.current.html ?? '';
    log('unlockScroll');
  };

  // ===================== POINTER EVENTS =====================
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!armed) return;
    e.stopPropagation();
    e.preventDefault();

    ensureCalibrated();

    const ctx = ctxRef.current;
    if (!ctx) return;
    drawingRef.current = true;
    activePointerId.current = e.pointerId;

    const { x, y, r } = getCoords(e.clientX, e.clientY);
    ctx.beginPath();
    ctx.moveTo(x, y);

    lockScroll();
    log('pointerdown', { x, y, rect: { w: r.width, h: r.height } });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!armed) return;
    if (!drawingRef.current || activePointerId.current !== e.pointerId) return;
    e.stopPropagation();
    e.preventDefault();

    const ctx = ctxRef.current;
    if (!ctx) return;
    const { x, y } = getCoords(e.clientX, e.clientY);
    ctx.lineTo(x, y);
    ctx.stroke();

    log('pointermove', { x, y });
  };

  const endStroke = () => {
    drawingRef.current = false;
    activePointerId.current = null;
    ctxRef.current?.beginPath();
    unlockScroll();
    if (onChange && canvasRef.current) onChange(canvasRef.current.toDataURL('image/png'));
  };

  const onPointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (!armed) return;
    if (e) { e.stopPropagation(); e.preventDefault(); }
    endStroke();
    log('pointerup');
  };

  // ===================== TOUCH NATIVO (iOS) =====================
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const touchstart = (e: TouchEvent) => {
      if (!armed) return;
      e.stopPropagation();
      e.preventDefault();

      usedNativeTouchRef.current = true;
      ensureCalibrated();

      const ctx = ctxRef.current;
      if (!ctx || !e.touches.length) return;
      const t = e.touches[0];
      const { x, y, r } = getCoords(t.clientX, t.clientY);

      drawingRef.current = true;
      ctx.beginPath();
      ctx.moveTo(x, y);

      lockScroll();
      log('touchstart', { x, y, rect: { w: r.width, h: r.height } });
    };

    const touchmove = (e: TouchEvent) => {
      if (!armed) return;
      if (!drawingRef.current || !e.touches.length) return;
      e.stopPropagation();
      e.preventDefault();

      const ctx = ctxRef.current;
      if (!ctx) return;
      const t = e.touches[0];
      const { x, y } = getCoords(t.clientX, t.clientY);
      ctx.lineTo(x, y);
      ctx.stroke();

      log('touchmove', { x, y });
    };

    const finish = (tag: string) => {
      endStroke();
      log(tag);
    };

    const touchend = (e: TouchEvent) => {
      if (!armed) return;
      e.stopPropagation();
      e.preventDefault();
      finish('touchend');
    };

    const touchcancel = (e: TouchEvent) => {
      if (!armed) return;
      e.stopPropagation();
      e.preventDefault();
      finish('touchcancel');
    };

    // Listeners nativos con passive:false para poder preventDefault en iOS
    c.addEventListener('touchstart', touchstart, { passive: false });
    c.addEventListener('touchmove', touchmove, { passive: false });
    c.addEventListener('touchend', touchend, { passive: false });
    c.addEventListener('touchcancel', touchcancel, { passive: false });

    return () => {
      c.removeEventListener('touchstart', touchstart);
      c.removeEventListener('touchmove', touchmove);
      c.removeEventListener('touchend', touchend);
      c.removeEventListener('touchcancel', touchcancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, onChange]);

  // ---- API pública ----
  const clear = useCallback(() => {
    const c = canvasRef.current;
    const ctx = ctxRef.current;
    if (!c || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    if (onChange) onChange(c.toDataURL('image/png'));
    log('clear');
  }, [onChange]); // eslint-disable-line react-hooks/exhaustive-deps

  const toDataURL = (type?: string, quality?: number) =>
    canvasRef.current?.toDataURL(type, quality) ?? '';

  useImperativeHandle(ref, () => ({ clear, toDataURL }));

  const rootClass = `relative rounded-xl border border-slate-300 dark:border-slate-700 p-2 ${className ?? ''}`;

  return (
    <div className={rootClass}>
      {/* Overlay de “tocar para activar” */}
      {requireTapToActivate && !armed && (
        <button
          type="button"
          onClick={() => {
            setArmed(true);
            requestAnimationFrame(setupCanvas);
            log('armed via overlay');
          }}
          className="absolute inset-2 z-10 grid place-items-center rounded-lg bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm"
          style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
        >
          <span className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-sm shadow">Tocar para activar la firma</span>
        </button>
      )}

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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />

      <div className="flex justify-between items-center mt-2">
        <div className="text-[10px] text-slate-400">
          {debug ? (
            <span>
              iOS:{String(isIOS)} · nativeTouch:{String(usedNativeTouchRef.current)}
            </span>
          ) : <span aria-hidden="true">&nbsp;</span>}
        </div>
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

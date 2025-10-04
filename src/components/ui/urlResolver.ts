/**
 * ============================================================
 * Archivo: src/components/ui/urlResolver.ts
 * Propósito:
 *  - Resolver rutas de medios (imágenes/PDF) coherentemente con el backend.
 *  - Evitar 404 comunes como /api/uploads vs /uploads a nivel de dominio.
 *  - Detectar si es imagen por extensión o data URL.
 * ============================================================
 */

import api from '../../services/api';

/** Devuelve el ORIGIN para archivos estáticos (baseURL sin '/api'). */
export function getApiOrigin(): string {
  const base = (api.defaults?.baseURL || '').trim(); // ej: https://f-report.xyz/api
  if (!base) return window.location.origin;          // fallback al origin actual
  try {
    const url = new URL(base);
    // si termina con /api -> quitarlo
    const cleaned = url.pathname.replace(/\/+$/, '');
    if (cleaned.endsWith('/api')) {
      url.pathname = cleaned.slice(0, -4); // quita '/api'
    }
    // normaliza trailing slash vacío
    url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString().replace(/\/+$/, '');
  } catch {
    // si por alguna razón no parsea, fallback:
    return base.replace(/\/api\/?$/, '');
  }
}

/** ¿Es imagen por content type aproximado (extensión o data url)? */
export function isImageUrl(u?: string | null): boolean {
  if (!u) return false;
  if (u.startsWith('data:image/')) return true;
  return /\.(png|jpe?g|gif|bmp|webp|svg)(\?.*)?$/i.test(u);
}

/**
 * Normaliza una URL para medios:
 *  - data:, http(s): se respeta tal cual.
 *  - Si comienza con /uploads/ → prefija el origin (sin /api).
 *  - Si es un nombre de archivo tipo EVI_*.jpg → construye `${origin}/uploads/<file>`.
 *  - Cualquier otra ruta relativa → `${origin}/${ruta-sin-slash-inicial}`.
 */
export function resolveMediaUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;

  // data URL o http(s) tal cual
  if (v.startsWith('data:') || /^https?:\/\//i.test(v)) return v;

  const origin = getApiOrigin(); // ej: https://f-report.xyz

  // /uploads/... → origin + /uploads/...
  if (v.startsWith('/uploads/')) {
    return `${origin}${v}`;
  }

  // Sólo nombre de archivo (EVI_..., PDF, etc.)
  if (/^[A-Za-z0-9._-]+\.(png|jpe?g|gif|bmp|webp|svg|pdf)$/i.test(v)) {
    return `${origin}/uploads/${v}`;
  }

  // Ruta relativa cualquiera → origin + /ruta
  return `${origin}/${v.replace(/^\/+/, '')}`;
}

/**
 * Alternativa de ruta opuesta (para fallback onError):
 *  - Si veníamos de /uploads/ → probar /api/uploads/
 *  - Si veníamos de /api/uploads/ → probar /uploads/
 */
export function swapUploadsApi(url: string): string {
  if (!url) return url;
  if (/\/api\/uploads\//.test(url)) {
    return url.replace('/api/uploads/', '/uploads/');
  }
  if (/\/uploads\//.test(url)) {
    // intenta con /api/uploads
    return url.replace('/uploads/', '/api/uploads/');
  }
  return url;
}

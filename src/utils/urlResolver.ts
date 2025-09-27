/**
 * ============================================================
 * Archivo: src/utils/urlResolver.ts
 * Propósito:
 *   - Resolver URLs de media devolviendo un absoluto válido
 *     en dev/prod.
 *   - Para rutas bajo /uploads, forzar SIEMPRE el ORIGIN de la API
 *     y normalizar www. ↔ apex (evita 404 de Nginx).
 * Env esperadas:
 *   - VITE_API_BASE_URL (ej. https://f-report.xyz/api ó /api)
 *   - VITE_PUBLIC_BASE_URL (opcional)
 * ============================================================
 */

const RAW_API = (import.meta as any)?.env?.VITE_API_BASE_URL || '';
const RAW_PUBLIC = (import.meta as any)?.env?.VITE_PUBLIC_BASE_URL || '';

const trimSlash = (s: string) => (s || '').replace(/\/+$/, '');

function parseOrigin(s: string): string {
  try {
    const u = new URL(s, window.location.origin);
    return u.origin;
  } catch {
    return '';
  }
}

const API_ORIGIN = parseOrigin(RAW_API);
const PUBLIC_BASE = trimSlash(RAW_PUBLIC);

/** Devuelve true si por extensión parece imagen. */
export function isImageUrl(url?: string | null): boolean {
  if (!url) return false;
  return /\.(png|jpe?g|webp|gif)$/i.test(url);
}

function isUploadsPath(path: string) {
  return path.startsWith('/uploads/');
}

/**
 * Normaliza host www. ↔ apex usando el origin de la API
 * solo para rutas /uploads.
 */
function normalizeUploadsHost(absUrl: string): string {
  if (!API_ORIGIN) return absUrl;
  try {
    const u = new URL(absUrl);
    if (isUploadsPath(u.pathname)) {
      const api = new URL(API_ORIGIN);
      // Reemplazar host y protocolo por los de la API
      u.protocol = api.protocol;
      u.host = api.host;
      return u.toString();
    }
    return absUrl;
  } catch {
    return absUrl;
  }
}

/**
 * Resuelve una URL de media:
 * - Si es absoluta http/https:
 *     • Si es /uploads/*, normaliza host a API_ORIGIN (evita 404).
 *     • Si no, se respeta tal cual.
 * - Si empieza con '/uploads':
 *     • Devuelve API_ORIGIN + path (o PUBLIC_BASE si no hay API_ORIGIN).
 * - Si empieza con '/':
 *     • Usa PUBLIC_BASE o API_ORIGIN; si no, deja relativa.
 */
export function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';

  if (/^https?:\/\//i.test(url)) {
    return normalizeUploadsHost(url);
  }

  const path = url.startsWith('/') ? url : `/${url}`;

  if (isUploadsPath(path)) {
    if (API_ORIGIN) return API_ORIGIN + path;
    if (PUBLIC_BASE) return PUBLIC_BASE + path;
    return path;
  }

  const base = PUBLIC_BASE || API_ORIGIN || '';
  return base ? base + path : path;
}

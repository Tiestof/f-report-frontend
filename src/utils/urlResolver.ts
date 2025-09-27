/**
 * ============================================================
 * Archivo: src/utils/urlResolver.ts
 * Propósito:
 *   - Normalizar/Resolver URLs de media (evidencias) para que
 *     funcionen en desarrollo y producción.
 *   - Si el backend devuelve '/uploads/...' en local, el <img/>
 *     del front apuntaba a Vite (localhost:5173) y daba 404.
 *     Aquí forzamos el host correcto.
 * Uso:
 *   - import { resolveMediaUrl } from '../utils/urlResolver';
 *   - const src = resolveMediaUrl(ev.url);
 * Env requeridas:
 *   - VITE_PUBLIC_BASE_URL (ej: https://f-report.xyz)
 *   - VITE_API_BASE_URL (fallback para sacar origin)
 * ============================================================
 */

const PUBLIC_BASE_RAW = (import.meta as any)?.env?.VITE_PUBLIC_BASE_URL || '';
const API_BASE_RAW = (import.meta as any)?.env?.VITE_API_BASE_URL || '';

const trimEndSlash = (s: string) => s.replace(/\/+$/, '');

const PUBLIC_BASE = PUBLIC_BASE_RAW ? trimEndSlash(PUBLIC_BASE_RAW) : '';
const API_ORIGIN = (() => {
  try {
    const u = new URL(API_BASE_RAW);
    return trimEndSlash(u.origin);
  } catch {
    return '';
  }
})();

/**
 * Resuelve una URL de media:
 * - Si ya viene absoluta (http/https), la respeta.
 * - Si comienza con '/', la antepone con PUBLIC_BASE o con el
 *   origin que se deduce de VITE_API_BASE_URL.
 * - En cualquier otro caso, retorna tal cual.
 */
export function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;

  if (url.startsWith('/')) {
    const base = PUBLIC_BASE || API_ORIGIN || '';
    if (!base) return url; // último recurso
    return `${base}${url}`;
  }

  return url;
}

/** Heurística simple para saber si una URL es de imagen (por extensión). */
export function isImageUrl(url?: string | null): boolean {
  if (!url) return false;
  return /\.(png|jpe?g|webp|gif)$/i.test(url);
}

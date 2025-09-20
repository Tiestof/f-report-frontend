/**
 * ============================================================
 * Archivo: src/components/modals/ConfirmSaveModal.tsx
 * Componente: ConfirmSaveModal
 * Descripción: Modal simple de confirmación con resumen o contenido custom.
 * ============================================================
 */

import type { ReactNode } from 'react';

type Props = {
  open?: boolean;
  title: string;
  description?: string;
  /** Si prefieres clave/valor, usa 'details'; si usas contenido libre, pasa 'children'. */
  details?: Record<string, ReactNode>;
  children?: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export default function ConfirmSaveModal({
  open = true,
  title,
  description,
  details,
  children,
  confirmLabel = 'Confirmar',
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 shadow-xl p-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}

        {details && (
          <div className="mt-3 divide-y divide-gray-100 dark:divide-zinc-800">
            {Object.entries(details).map(([k, v]) => (
              <div key={k} className="flex justify-between py-2 text-sm">
                <span className="text-gray-500">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
          </div>
        )}

        {children && <div className="mt-3">{children}</div>}

        <div className="mt-4 flex justify-end gap-2">
          <button className="px-3 py-2 rounded-xl border" onClick={onCancel}>
            Cancelar
          </button>
          <button className="px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * ============================================================
 * Archivo: src/components/modals/EvidenciasModal.tsx
 * Componente: EvidenciasModal
 * Descripción:
 *  - Permite ingresar múltiples evidencias.
 *  - Caso especial: TipoEvidencia = 3 (Firma Digital)
 *      • Muestra pad de firma + nombre y apellido.
 *      • Guarda imagen de la firma en `url` (DataURL) y `modelo = "<Nombre> <Apellido>"`.
 *      • Resto de campos nulos.
 *  - Para otros tipos: adjuntar imagen (comprimida/BN) y campos modelo, serie, IPs, MAC, etc.
 * ============================================================
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTiposEvidencia } from '../../services/catalogosService';
import { createEvidencia } from '../../services/evidenciasService';
import SignaturePad from '../ui/SignaturePad';
import FileUploader from '../ui/FileUploader';
import { compressToJpegDataURL } from '../../utils/imageTools';
import { toast } from 'sonner';

type Props = {
  idReporte: number;
  onClose: () => void;
  onSaved: () => void;
};

type TipoEvidencia = { id_tipo_evidencia: number; descripcion_tipo_evidencia: string };

type Row = {
  id_tipo_evidencia?: number;
  // Comunes
  modelo?: string;
  numero_serie?: string;
  ipv4?: string;
  ipv6?: string;
  macadd?: string;
  nombre_maquina?: string;
  url?: string; // DataURL o URL real
  // Firma digital:
  nombre?: string;
  apellido?: string;
  firmaDataUrl?: string | null;
};

export default function EvidenciasModal({ idReporte, onClose, onSaved }: Props) {
  const { data: tipos = [] } = useQuery<TipoEvidencia[]>({
    queryKey: ['tipos-evidencia'],
    queryFn: getTiposEvidencia,
    staleTime: 10 * 60 * 1000,
  });

  const [rows, setRows] = useState<Row[]>([{}]);
  const isFirma = (t?: number) => t === 3;

  const addRow = () => setRows((rs) => [...rs, {}]);
  const removeRow = (idx: number) => setRows((rs) => rs.filter((_, i) => i !== idx));

  const onFile = async (idx: number, f: File | null) => {
    if (!f) {
      setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, url: undefined } : r)));
      return;
    }
    const dataUrl = await compressToJpegDataURL(f, { maxW: 1600, maxH: 1200, grayscale: true, quality: 0.7 });
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, url: dataUrl } : r)));
  };

  const saveAll = async () => {
    try {
      for (const r of rows) {
        if (!r.id_tipo_evidencia) continue;

        if (isFirma(r.id_tipo_evidencia)) {
          const full = `${r.nombre ?? ''} ${r.apellido ?? ''}`.trim();
          if (!r.firmaDataUrl || !full) continue;

          await createEvidencia({
            id_reporte: idReporte,
            id_tipo_evidencia: r.id_tipo_evidencia,
            url: r.firmaDataUrl, // NOT NULL en DB
            modelo: full, // nombre + apellido
            numero_serie: null,
            ipv4: null,
            ipv6: null,
            macadd: null,
            nombre_maquina: null,
          });
        } else {
          await createEvidencia({
            id_reporte: idReporte,
            id_tipo_evidencia: r.id_tipo_evidencia,
            url: r.url ?? '',
            modelo: r.modelo ?? null,
            numero_serie: r.numero_serie ?? null,
            ipv4: r.ipv4 ?? null,
            ipv6: r.ipv6 ?? null,
            macadd: r.macadd ?? null,
            nombre_maquina: r.nombre_maquina ?? null,
          });
        }
      }
      toast.success('Evidencias guardadas');
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Error al guardar evidencias');
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-zinc-900 shadow-xl p-4">
        <h3 className="text-lg font-semibold">Evidencias del reporte #{idReporte}</h3>

        <div className="mt-3 flex flex-col gap-4 max-h-[60vh] overflow-auto pr-1">
          {rows.map((row, idx) => {
            const tipo = row.id_tipo_evidencia;
            return (
              <div key={idx} className="rounded-xl border p-3 grid grid-cols-1 md:grid-cols-6 gap-2">
                <div>
                  <label className="text-xs">Tipo evidencia</label>
                  <select
                    className="input w-full"
                    value={tipo ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : undefined;
                      setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, id_tipo_evidencia: val } : r)));
                    }}
                  >
                    <option value="">—</option>
                    {tipos.map((t) => (
                      <option key={t.id_tipo_evidencia} value={t.id_tipo_evidencia}>
                        {t.descripcion_tipo_evidencia}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Firma digital */}
                {isFirma(tipo) ? (
                  <>
                    <div className="md:col-span-3">
                      <label className="text-xs">Pad de firma</label>
                      <SignaturePad
                        height={140}
                        onChange={(dataUrl: string) =>
                          setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, firmaDataUrl: dataUrl } : r)))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs">Nombre</label>
                      <input
                        className="input w-full"
                        value={row.nombre ?? ''}
                        onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, nombre: e.target.value } : r)))}
                      />
                    </div>
                    <div>
                      <label className="text-xs">Apellido</label>
                      <input
                        className="input w-full"
                        value={row.apellido ?? ''}
                        onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, apellido: e.target.value } : r)))}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="md:col-span-2">
                      <label className="text-xs">Modelo</label>
                      <input
                        className="input w-full"
                        value={row.modelo ?? ''}
                        onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, modelo: e.target.value } : r)))}
                      />
                    </div>
                    <div>
                      <label className="text-xs">N° Serie</label>
                      <input
                        className="input w-full"
                        value={row.numero_serie ?? ''}
                        onChange={(e) =>
                          setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, numero_serie: e.target.value } : r)))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs">IPv4</label>
                      <input
                        className="input w-full"
                        value={row.ipv4 ?? ''}
                        onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ipv4: e.target.value } : r)))}
                      />
                    </div>
                    <div>
                      <label className="text-xs">IPv6</label>
                      <input
                        className="input w-full"
                        value={row.ipv6 ?? ''}
                        onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ipv6: e.target.value } : r)))}
                      />
                    </div>
                    <div>
                      <label className="text-xs">MAC</label>
                      <input
                        className="input w-full"
                        value={row.macadd ?? ''}
                        onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, macadd: e.target.value } : r)))}
                      />
                    </div>
                    <div>
                      <label className="text-xs">Nombre equipo</label>
                      <input
                        className="input w-full"
                        value={row.nombre_maquina ?? ''}
                        onChange={(e) =>
                          setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, nombre_maquina: e.target.value } : r)))
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs">Foto/Archivo</label>
                      <FileUploader onFile={(f) => onFile(idx, f)} preview={row.url} accept="image/*" capture />
                    </div>
                  </>
                )}

                <div className="md:col-span-6 flex justify-end">
                  <button className="px-2 py-1 rounded-lg border text-xs" onClick={() => removeRow(idx)}>
                    Quitar
                  </button>
                </div>
              </div>
            );
          })}
          <button className="self-start px-3 py-2 rounded-xl border text-sm" onClick={addRow}>
            + Agregar evidencia
          </button>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className="px-3 py-2 rounded-xl border" onClick={onClose}>
            Cerrar
          </button>
          <button className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={saveAll}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

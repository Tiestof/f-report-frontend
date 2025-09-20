/**
 * ============================================================
 * Archivo: src/components/ui/FileUploader.tsx
 * Componente: FileUploader
 * Descripción: Input de archivo con preview (DataURL) y opción capture móvil.
 * ============================================================
 */

type Props = {
  onFile: (file: File | null) => void;
  preview?: string;
  accept?: string;
  capture?: boolean;
};

export default function FileUploader({ onFile, preview, accept, capture }: Props) {
  return (
    <div className="space-y-2">
      <input
        type="file"
        accept={accept}
        capture={capture ? 'environment' : undefined}
        onChange={e => onFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm"
      />
      {preview && <img src={preview} alt="preview" className="w-full max-h-36 object-contain rounded-lg border" />}
      <div className="text-[10px] text-gray-400">
        Las imágenes se comprimen y convierten a B/N antes de subirlas.
      </div>
    </div>
  );
}

/**
 * ============================================================
 * Archivo: src/components/ui/ListBox.tsx
 * Descripción:
 *  ListBox accesible (Headless UI) reutilizable para selects ricos.
 *  - Muestra label + valor seleccionado
 *  - Soporta placeholder
 *  - Teclado y screen readers (WCAG 2.1 AA)
 *
 * Uso:
 *  <ListBox
 *    label="Técnico"
 *    options={[{value:'1111', label:'Juan Pérez — 11.111.111-1'}]}
 *    value={selected}
 *    onChange={setSelected}
 *    placeholder="Selecciona técnico…"
 *  />
 * ============================================================
 */

import { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';

export type LBOption<T = any> = { value: T; label: string };

interface ListBoxProps<T = any> {
  label?: string;
  options: LBOption<T>[];
  value: LBOption<T> | null;
  onChange: (opt: LBOption<T> | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// Íconos inline (sin dependencias)
function ChevronUpDownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M7 7l3-3 3 3H7zm0 6l3 3 3-3H7z" />
    </svg>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 010 1.415l-7.07 7.07a1 1 0 01-1.415 0L3.296 8.85a1 1 0 111.415-1.415l4.093 4.093 6.364-6.364a1 1 0 011.536.126z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function ListBox<T>({
  label,
  options,
  value,
  onChange,
  placeholder = 'Selecciona…',
  disabled = false,
  className = '',
}: ListBoxProps<T>) {
  return (
    <div className={`w-full ${className}`}>
      {label && <label className="block text-sm font-medium mb-1">{label}</label>}

      <Listbox value={value} onChange={onChange} disabled={disabled}>
        <div className="relative">
          <Listbox.Button
            className="relative w-full cursor-default rounded border bg-white py-2 pl-3 pr-10 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            aria-label={label}
          >
            <span className="block truncate text-sm">
              {value ? value.label : <span className="text-zinc-500">{placeholder}</span>}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon className="h-4 w-4 opacity-60" />
            </span>
          </Listbox.Button>

          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-white py-1 text-sm shadow-lg focus:outline-none">
              {options.length === 0 && (
                <div className="px-3 py-2 text-zinc-500">Sin opciones</div>
              )}
              {options.map((opt, idx) => (
                <Listbox.Option
                  key={`${idx}-${String((opt as any).value)}`}
                  className={({ active }) =>
                    `relative cursor-default select-none py-2 pl-10 pr-4 ${
                      active ? 'bg-blue-50 text-blue-900' : 'text-zinc-900'
                    }`
                  }
                  value={opt}
                >
                  {({ selected }) => (
                    <>
                      <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                        {opt.label}
                      </span>
                      {selected ? (
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                          <CheckIcon className="h-4 w-4" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  );
}

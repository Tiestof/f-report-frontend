/**
 * Componente: RUTInput
 * Descripción: Campo de entrada para RUT chileno con autoformato,
 * validación en tiempo real y feedback visual. Soporta RUT cortos (1-9, 2-7).
 */

import { useState } from 'react';
import { validateRUT } from '../../utils/rutValidator';
import { formatRUTDisplay } from '../../utils/rutFormatter';

interface RUTInputProps {
  value: string;
  onChange: (value: string, isValid: boolean) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

export default function RUTInput({
  value,
  onChange,
  label = 'RUT',
  placeholder = '12.345.678-9',
  required = true
}: RUTInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isValid, setIsValid] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.toUpperCase();
    const formatted = formatRUTDisplay(raw);
    setInputValue(formatted);

    const cleaned = formatted.replace(/\./g, '').replace(/-/g, '');
    const valid = cleaned.length >= 2 ? validateRUT(cleaned) : false;
    setIsValid(valid);
    console.log('DEBUG RUT CHANGE:', cleaned, 'Valido:', valid);
    onChange(cleaned, valid);
  };

  return (
    <div className="flex flex-col w-full">
      <label className="mb-1 text-sm font-medium text-gray-700">
        {label}{required && '*'}
      </label>
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={`border p-2 rounded-md focus:outline-none focus:ring-2 transition-all 
          ${isValid ? 'border-green-500 focus:ring-green-400' : 'border-gray-300 focus:ring-blue-400'}`}
      />
      {!isValid && inputValue.length >= 2 && (
        <span className="text-xs text-red-600 mt-1">El RUT ingresado no es válido</span>
      )}
    </div>
  );
}

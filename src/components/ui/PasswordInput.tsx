/**
 * Componente: PasswordInput
 * Descripción: Campo de entrada para contraseña con ofuscación,
 * toggle de visibilidad y feedback visual sin duplicar el botón.
 */

import { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
}

export default function PasswordInput({
  value,
  onChange,
  label = 'Contraseña',
  placeholder = '********',
  required = true,
  minLength = 4
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isValid = value.length >= minLength;

  return (
    <div className="flex flex-col w-full">
      <label className="mb-1 text-sm font-medium text-gray-700">
        {label}{required && '*'}
      </label>
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`border p-2 rounded-md w-full pr-10 focus:outline-none focus:ring-2 transition-all 
            ${isValid ? 'border-gray-300 focus:ring-blue-400' : 'border-red-500 focus:ring-red-400'}`}
        />
        {/* Un solo botón que cambia el ícono */}
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
          tabIndex={-1}
        >
          {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
        </button>
      </div>
      {!isValid && value.length > 0 && (
        <span className="text-xs text-red-600 mt-1">
          La contraseña debe tener al menos {minLength} caracteres
        </span>
      )}
    </div>
  );
}

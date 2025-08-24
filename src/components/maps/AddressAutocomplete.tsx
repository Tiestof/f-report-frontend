import { useEffect, useRef, useState } from 'react';
import { Autocomplete } from '@react-google-maps/api';

type Props = {
  label?: string;
  defaultValue?: string;
  disabled?: boolean;
  componentRestrictions?: google.maps.places.ComponentRestrictions;
  onSelect: (data: {
    address: string;
    numero?: string;
    lat?: number;
    lng?: number;
    placeId?: string;
  }) => void;
};

export default function AddressAutocomplete({
  label = 'Dirección',
  defaultValue = '',
  disabled = false,
  componentRestrictions,
  onSelect,
}: Props) {
  const [text, setText] = useState(defaultValue);
  const acRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Mantener defaultValue sincronizado si cambias entre edición/nuevo
  useEffect(() => { setText(defaultValue || ''); }, [defaultValue]);

  const onPlaceChanged = () => {
    const ac = acRef.current;
    if (!ac) return;
    const place = ac.getPlace();
    if (!place || !place.geometry || !place.geometry.location) return;

    const loc = place.geometry.location;
    const lat = loc.lat();
    const lng = loc.lng();
    const formatted = place.formatted_address || text;

    const numero =
      place.address_components?.find((c) => c.types.includes('street_number'))?.long_name;

    // Fijamos el texto final (no re-montamos el mapa aquí)
    setText(formatted);

    onSelect({
      address: formatted,
      numero,
      lat,
      lng,
      placeId: place.place_id,
    });
  };

  const googleReady = typeof window !== 'undefined' && (window as any).google && (window as any).google.maps;

  return (
    <div className="w-full">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{label}</label>
      {googleReady && !disabled ? (
        <Autocomplete
          onLoad={(ac) => (acRef.current = ac)}
          onPlaceChanged={onPlaceChanged}
          options={{ fields: ['formatted_address', 'geometry', 'place_id', 'address_components'], componentRestrictions }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            placeholder="Ingresa una dirección"
            autoComplete="off"
            className="border rounded-md p-2 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none transition"
          />
        </Autocomplete>
      ) : (
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ingresa una dirección"
          disabled={disabled}
          className="border rounded-md p-2 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none transition"
        />
      )}
    </div>
  );
}

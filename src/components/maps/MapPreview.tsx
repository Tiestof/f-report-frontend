/**
 * ============================================================
 * Archivo: src/components/maps/MapPreview.tsx
 * Componente: MapPreview
 * Descripción:
 *  - Mini mapa (GoogleMap) para previsualizar la dirección seleccionada.
 *  - Centra en lat/lng y coloca un marcador.
 *  - Forzamos re-mount del mapa con `key` cuando cambian lat/lng para evitar
 *    el “pantallazo blanco” después de seleccionar una dirección.
 * ============================================================
 */

import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { GoogleMap, MarkerF } from '@react-google-maps/api';

type MapPreviewProps = {
  lat?: number | null;
  lng?: number | null;
  zoom?: number;
  width?: string;   // ej: '100%'
  height?: string;  // ej: '220px'
};

export default function MapPreview({
  lat,
  lng,
  zoom = 16,
  width = '100%',
  height = '220px',
}: MapPreviewProps) {
  const hasCoords = typeof lat === 'number' && typeof lng === 'number';

  const mapContainerStyle = useMemo<CSSProperties>(() => ({
    width,
    height,
    borderRadius: '12px',
    overflow: 'hidden',
  }), [width, height]);

  const center = useMemo<google.maps.LatLngLiteral | null>(() => {
    return hasCoords ? { lat: lat as number, lng: lng as number } : null;
  }, [hasCoords, lat, lng]);

  const mapOptions = useMemo<google.maps.MapOptions>(() => ({
    disableDefaultUI: true,
    zoomControl: true,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
    clickableIcons: false,
    backgroundColor: '#ffffff',
    gestureHandling: 'greedy',
  }), []);

  // Clave única por coordenadas para forzar re-mount del mapa al cambiar center
  const mapKey = center ? `${center.lat.toFixed(6)}-${center.lng.toFixed(6)}` : 'no-center';

  return (
    <div>
      {center ? (
        <GoogleMap
          key={mapKey}
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={zoom}
          options={mapOptions}
        >
          <MarkerF position={center} />
        </GoogleMap>
      ) : (
        <div
          style={mapContainerStyle}
          className="flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 text-sm"
          aria-live="polite"
        >
          Selecciona una dirección para ver el mapa
        </div>
      )}
    </div>
  );
}

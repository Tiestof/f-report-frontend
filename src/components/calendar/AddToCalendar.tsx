/**
 * ============================================================
 * Archivo: src/components/calendar/AddToCalendar.tsx
 * Propósito:
 *  - Botones para "Agregar a Google Calendar" (sin OAuth)
 *    y "Descargar .ics" (universal para iOS/Android/Outlook).
 * Dependencias:
 *  - utils/calendar.ts
 * Accesibilidad:
 *  - Botones con aria-label y enlaces seguros.
 * ============================================================
 */

import React from 'react';
import { buildGoogleCalendarUrl, buildICS, makeICSBlobUrl } from '../../utils/calendar';

interface Props {
  title: string;
  location?: string;
  description?: string;
  /** Fecha/hora de inicio y fin (Date o string ISO) */
  start: Date | string;
  end: Date | string;
  fileName?: string;
}

const AddToCalendar: React.FC<Props> = ({
  title,
  location,
  description,
  start,
  end,
  fileName = 'F-REPORT-evento.ics',
}) => {
  const googleUrl = buildGoogleCalendarUrl({ title, location, description, start, end });
  const ics = buildICS({ title, location, description, start, end });
  const icsUrl = makeICSBlobUrl(ics);

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <a
        href={googleUrl}
        target="_blank"
        rel="noreferrer"
        className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm text-center"
        aria-label="Agregar a Google Calendar"
      >
        Agregar a Google Calendar
      </a>
      <a
        href={icsUrl}
        download={fileName}
        className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm text-center"
        aria-label="Descargar archivo iCal"
      >
        Descargar .ics
      </a>
    </div>
  );
};

export default AddToCalendar;

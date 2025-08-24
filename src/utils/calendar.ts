/**
 * ============================================================
 * Archivo: src/utils/calendar.ts
 * Propósito:
 *  - Construir URL para Google Calendar (action=TEMPLATE)
 *  - Generar contenido iCal (.ics) y blob URL descargable
 * ============================================================
 */

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function toICSDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

export function buildGoogleCalendarUrl(params: {
  title: string;
  description?: string;
  location?: string;
  start: Date | string;
  end: Date | string;
}): string {
  const { title, description = '', location = '', start, end } = params;
  const dates = `${toICSDateTime(start)}/${toICSDateTime(end)}`;
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const url =
    `${base}&text=${encodeURIComponent(title)}` +
    `&details=${encodeURIComponent(description)}` +
    `&location=${encodeURIComponent(location)}` +
    `&dates=${dates}`;
  return url;
}

export function buildICS(params: {
  uid?: string;
  title: string;
  description?: string;
  location?: string;
  start: Date | string;
  end: Date | string;
  organizerEmail?: string;
}): string {
  const {
    uid = `${Date.now()}@freport.local`,
    title,
    description = '',
    location = '',
    start,
    end,
    organizerEmail = 'noreply@freport.local',
  } = params;

  const dtStart = toICSDateTime(start);
  const dtEnd = toICSDateTime(end);
  const dtStamp = toICSDateTime(new Date());

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//F-REPORT//Agenda//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICS(title)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `LOCATION:${escapeICS(location)}`,
    `ORGANIZER:mailto:${organizerEmail}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function makeICSBlobUrl(ics: string): string {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  return URL.createObjectURL(blob);
}

// Minimal RFC 5545 .ics generator. Single all-day events keyed off
// follow_up_date. No external deps.

import type { Application } from '../types';
import { TERMINAL_STAGES, POSITIVE_TERMINALS } from '../types';
import { downloadFile } from './csv';

export interface CalendarEvent {
  uid: string;
  summary: string;
  description: string;
  date: string;        // YYYY-MM-DD
  appId: string;
  kind: 'follow-up' | 'interview' | 'decision';
  status: string;
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function dateStamp(): string {
  const d = new Date();
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function addDays(yyyymmdd: string, days: number): string {
  const d = new Date(yyyymmdd + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function ymdCompact(yyyymmdd: string): string {
  return yyyymmdd.replace(/-/g, '');
}

// Smart event label based on application stage.
export function eventLabel(app: Application): { kind: CalendarEvent['kind']; summary: string } {
  switch (app.current_status) {
    case 'phone-screen':   return { kind: 'interview', summary: `Phone screen prep — ${app.company}` };
    case 'hiring-manager': return { kind: 'interview', summary: `Hiring-manager call — ${app.company}` };
    case 'technical':      return { kind: 'interview', summary: `Technical interview — ${app.company}` };
    case 'onsite':         return { kind: 'interview', summary: `Onsite — ${app.company}` };
    case 'offer':          return { kind: 'decision',  summary: `Decide on ${app.company} offer` };
    default:               return { kind: 'follow-up', summary: `Follow up — ${app.company}` };
  }
}

export function applicationToEvent(app: Application): CalendarEvent | null {
  if (!app.follow_up_date) return null;
  // Skip terminal apps (rejected, ghosted, withdrawn, accepted) since the
  // event is no longer relevant. Offers are surfaced as decision events.
  if (TERMINAL_STAGES.includes(app.current_status) &&
      !POSITIVE_TERMINALS.includes(app.current_status)) return null;

  const { kind, summary } = eventLabel(app);
  const desc = [
    app.role ? `Role: ${app.role}` : '',
    app.sector ? `Sector: ${app.sector}` : '',
    app.contact_name ? `Contact: ${app.contact_name}` : '',
    app.notes ? `Notes: ${app.notes}` : '',
  ].filter(Boolean).join('\n');

  return {
    uid: `${app.id}-${app.follow_up_date}@job-tracker`,
    summary,
    description: desc,
    date: app.follow_up_date,
    appId: app.id,
    kind,
    status: app.current_status,
  };
}

export function buildIcs(events: CalendarEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//job-tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  const stamp = dateStamp();
  for (const ev of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${ymdCompact(ev.date)}`);
    lines.push(`DTEND;VALUE=DATE:${ymdCompact(addDays(ev.date, 1))}`);
    lines.push(`SUMMARY:${escapeIcs(ev.summary)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeIcs(ev.description)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcs(events: CalendarEvent[], filename: string): void {
  if (events.length === 0) {
    alert('No upcoming events to export.');
    return;
  }
  downloadFile(filename, buildIcs(events), 'text/calendar');
}

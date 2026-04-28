import type { Application, Stage, Source, Relationship } from '../types';
import { STAGES, SOURCES, RELATIONSHIPS } from '../types';

const COLUMNS = [
  'applied_date',
  'company',
  'role',
  'sector',
  'company_stage',
  'company_size',
  'location',
  'source',
  'cv_version',
  'current_status',
  'last_update',
  'salary_min',
  'salary_max',
  'interest_rating',
  'contact_name',
  'contact_email',
  'contact_relationship',
  'follow_up_date',
  'notes',
] as const;

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportCsv(apps: Application[]): string {
  const lines: string[] = [];
  lines.push(COLUMNS.join(','));
  for (const app of apps) {
    const row = COLUMNS.map((col) => (app as unknown as Record<string, unknown>)[col]);
    lines.push(row.map(escapeCell).join(','));
  }
  return lines.join('\n');
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let i = 0;
  let inQuotes = false;
  const len = text.length;
  while (i < len) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cell += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { row.push(cell); cell = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { row.push(cell); cell = ''; rows.push(row); row = []; i++; continue; }
    cell += ch; i++;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.length > 0));
}

export interface ImportResult {
  applications: Application[];
  warnings: string[];
}

function asStage(v: string | undefined): Stage {
  const cleaned = (v ?? '').trim().toLowerCase().replace(/\s+/g, '-');
  if ((STAGES as readonly string[]).includes(cleaned)) return cleaned as Stage;
  return 'applied';
}

function asSource(v: string | undefined): Source | undefined {
  if (!v) return undefined;
  const cleaned = v.trim().toLowerCase().replace(/\s+/g, '-');
  if ((SOURCES as readonly string[]).includes(cleaned)) return cleaned as Source;
  return 'other';
}

function asRel(v: string | undefined): Relationship | undefined {
  if (!v) return undefined;
  const cleaned = v.trim().toLowerCase().replace(/\s+/g, '-');
  if ((RELATIONSHIPS as readonly string[]).includes(cleaned)) return cleaned as Relationship;
  return 'other';
}

function num(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function nonEmpty(v: string | undefined): string | undefined {
  return v && v.trim() ? v.trim() : undefined;
}

export function importCsv(text: string): ImportResult {
  const rows = parseCsv(text);
  const warnings: string[] = [];
  if (rows.length === 0) return { applications: [], warnings: ['Empty CSV.'] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const indexOf = (name: string) => header.indexOf(name);
  const required = ['applied_date', 'company', 'current_status'];
  for (const r of required) if (indexOf(r) < 0) warnings.push(`Missing required column: ${r}`);

  const applications: Application[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const get = (col: string) => {
      const idx = indexOf(col);
      return idx >= 0 ? cells[idx] : undefined;
    };
    const applied_date = nonEmpty(get('applied_date')) ?? '';
    const company = nonEmpty(get('company')) ?? '';
    if (!applied_date || !company) {
      warnings.push(`Row ${i + 1}: skipped (missing applied_date or company).`);
      continue;
    }
    applications.push({
      id: `${applied_date}-${company}-${i}`.replace(/\s+/g, '-').toLowerCase(),
      applied_date,
      company,
      role: nonEmpty(get('role')),
      sector: nonEmpty(get('sector')),
      company_stage: nonEmpty(get('company_stage')),
      company_size: nonEmpty(get('company_size')),
      location: nonEmpty(get('location')),
      source: asSource(get('source')),
      cv_version: nonEmpty(get('cv_version')),
      current_status: asStage(get('current_status')),
      last_update: nonEmpty(get('last_update')),
      salary_min: num(get('salary_min')),
      salary_max: num(get('salary_max')),
      interest_rating: num(get('interest_rating')),
      contact_name: nonEmpty(get('contact_name')),
      contact_email: nonEmpty(get('contact_email')),
      contact_relationship: asRel(get('contact_relationship')),
      follow_up_date: nonEmpty(get('follow_up_date')),
      notes: nonEmpty(get('notes')),
    });
  }
  return { applications, warnings };
}

export function downloadFile(filename: string, content: string, mime = 'text/csv'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

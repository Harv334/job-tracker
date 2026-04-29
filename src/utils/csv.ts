// CSV import + (prettified) export. Export uses Title Case headers,
// human-readable status/source/relationship values, currency-formatted
// salaries, and a UTF-8 BOM so Excel auto-detects encoding when you open
// the file directly. Re-importing this file via Smart Import works because
// our header detector handles the Title Case forms via synonyms.

import type { Application, Stage, Source, Relationship, CvVersion } from '../types';
import { STAGES, SOURCES, RELATIONSHIPS } from '../types';
import { prettyStage, prettySource } from './stats';

interface Column {
  header: string;
  get: (a: Application, ctx: ExportContext) => string;
}

interface ExportContext {
  cvLabel: (id: string | undefined) => string;
}

// Use the centralised locale formatter — defaults to GBP / en-GB.
import { fmtMoney } from './locale';

const COLUMNS: Column[] = [
  { header: 'Date',         get: (a) => a.applied_date },
  { header: 'Company',      get: (a) => a.company },
  { header: 'Role',         get: (a) => a.role ?? '' },
  { header: 'Sector',       get: (a) => a.sector ?? '' },
  { header: 'Source',       get: (a) => (a.source ? prettySource(a.source) : '') },
  { header: 'CV',           get: (a, ctx) => ctx.cvLabel(a.cv_version) },
  { header: 'Status',       get: (a) => prettyStage(a.current_status) },
  { header: 'Interest',     get: (a) => (a.interest_rating ? '★'.repeat(a.interest_rating) : '') },
  { header: 'Contact',      get: (a) => a.contact_name ?? '' },
  { header: 'Relationship', get: (a) => (a.contact_relationship ? prettySource(a.contact_relationship) : '') },
  { header: 'Follow-up',    get: (a) => a.follow_up_date ?? '' },
  { header: 'Last update',  get: (a) => a.last_update ?? '' },
  { header: 'Salary min',   get: (a) => fmtMoney(a.salary_min) },
  { header: 'Salary max',   get: (a) => fmtMoney(a.salary_max) },
  { header: 'Notes',        get: (a) => a.notes ?? '' },
];

function escapeCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function exportCsv(apps: Application[], cvs: CvVersion[] = []): string {
  const ctx: ExportContext = {
    cvLabel: (id) => (id ? cvs.find((c) => c.id === id)?.label ?? id : ''),
  };
  const lines: string[] = [];
  lines.push(COLUMNS.map((c) => c.header).join(','));
  for (const a of apps) {
    lines.push(COLUMNS.map((c) => escapeCell(c.get(a, ctx))).join(','));
  }
  // UTF-8 BOM so Excel auto-detects UTF-8 instead of mangling accents.
  return '﻿' + lines.join('\r\n') + '\r\n';
}

// ---- Importer (kept for legacy / API users; the Smart Import modal is
// preferred for foreign trackers since it handles synonyms and weird formats) ----

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let i = 0;
  let inQuotes = false;
  // Strip BOM if present.
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
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
  const cleaned = String(v).replace(/[$,£€\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function nonEmpty(v: string | undefined): string | undefined {
  return v && v.trim() ? v.trim() : undefined;
}

export function importCsv(text: string): ImportResult {
  const rows = parseCsv(text);
  const warnings: string[] = [];
  if (rows.length === 0) return { applications: [], warnings: ['Empty CSV.'] };
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/[ \-]/g, '_'));
  const indexOf = (name: string) => header.indexOf(name);

  const applications: Application[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const get = (col: string) => {
      const idx = indexOf(col);
      return idx >= 0 ? cells[idx] : undefined;
    };
    const applied_date = nonEmpty(get('applied_date') ?? get('date')) ?? '';
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
      cv_version: nonEmpty(get('cv') ?? get('cv_version')),
      current_status: asStage(get('status') ?? get('current_status')),
      last_update: nonEmpty(get('last_update')),
      salary_min: num(get('salary_min')),
      salary_max: num(get('salary_max')),
      interest_rating: get('interest') ? (get('interest') as string).match(/★/g)?.length : num(get('interest_rating')),
      contact_name: nonEmpty(get('contact') ?? get('contact_name')),
      contact_email: nonEmpty(get('contact_email')),
      contact_relationship: asRel(get('relationship') ?? get('contact_relationship')),
      follow_up_date: nonEmpty(get('follow_up')) ?? nonEmpty(get('follow_up_date')),
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

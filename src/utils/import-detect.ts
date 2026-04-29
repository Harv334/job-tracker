// Smart-import heuristics. Given a foreign tracker's headers and rows,
// guess which canonical field each column represents, normalize enum
// values (status, source) to our internal vocabulary, and parse dates
// from the most common formats users have.

import type { Stage, Source, Application, Relationship } from '../types';
import { STAGES, SOURCES, RELATIONSHIPS } from '../types';

// ---- Canonical fields ------------------------------------------------------

export const CANONICAL_FIELDS = [
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
  'salary',          // virtual — split into min/max if matched
  'interest_rating',
  'contact_name',
  'contact_email',
  'contact_relationship',
  'follow_up_date',
  'notes',
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

// Synonyms: lowercase candidate substrings for each canonical field. We
// match against header strings via "header contains synonym" — so partial
// matches like "Date Applied" → applied_date work.
const FIELD_SYNONYMS: Record<CanonicalField, string[]> = {
  applied_date:    ['applied date', 'date applied', 'application date', 'submission date', 'submitted', 'apply date', 'date'],
  company:         ['company name', 'employer', 'organization', 'organisation', 'company', 'firm', 'org'],
  role:            ['job title', 'position', 'role', 'title', 'job'],
  sector:          ['sector', 'industry', 'vertical', 'category'],
  company_stage:   ['company stage', 'funding stage', 'stage of company', 'series'],
  company_size:    ['company size', 'employee count', 'headcount', 'size'],
  location:        ['location', 'city', 'office', 'where', 'place', 'remote'],
  source:          ['source', 'channel', 'how applied', 'how did you', 'origin', 'lead source'],
  cv_version:      ['cv version', 'resume version', 'cv', 'resume'],
  current_status:  ['current status', 'status', 'stage', 'state', 'phase', 'progress'],
  last_update:     ['last update', 'last updated', 'updated', 'modified', 'last activity'],
  salary_min:      ['salary min', 'min salary', 'salary low', 'comp min', 'minimum salary', 'low'],
  salary_max:      ['salary max', 'max salary', 'salary high', 'comp max', 'maximum salary', 'high'],
  salary:          ['salary', 'compensation', 'comp', 'pay', 'wage', 'salary range'],
  interest_rating: ['interest', 'rating', 'priority', 'excitement', 'fit'],
  contact_name:    ['contact', 'recruiter', 'recruiter name', 'point of contact', 'poc'],
  contact_email:   ['contact email', 'recruiter email', 'email'],
  contact_relationship: ['relationship', 'rel', 'contact type'],
  follow_up_date:  ['follow up', 'followup', 'follow-up', 'next action', 'next step'],
  notes:           ['notes', 'comments', 'description', 'note', 'memo'],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Returns a mapping from each input header to the best-matching canonical
// field, or null if nothing matched well enough.
export function detectColumnMapping(headers: string[]): Map<string, CanonicalField | null> {
  const result = new Map<string, CanonicalField | null>();
  const used = new Set<CanonicalField>();

  // Score-based pass — most specific synonyms win first.
  const scored: { header: string; field: CanonicalField; score: number }[] = [];
  for (const header of headers) {
    const norm = normalizeHeader(header);
    for (const [field, syns] of Object.entries(FIELD_SYNONYMS) as [CanonicalField, string[]][]) {
      for (const syn of syns) {
        if (norm === syn) scored.push({ header, field, score: 100 });
        else if (norm.includes(syn)) scored.push({ header, field, score: syn.length });
      }
    }
  }
  scored.sort((a, b) => b.score - a.score);

  // Greedy assignment — first claim wins, no double-mapping.
  for (const { header, field } of scored) {
    if (result.has(header)) continue;
    if (used.has(field)) continue;
    result.set(header, field);
    used.add(field);
  }

  // Mark anything unmatched as null so the UI can show "Ignore".
  for (const h of headers) if (!result.has(h)) result.set(h, null);

  return result;
}

// ---- Value normalization ---------------------------------------------------

const STATUS_SYNONYMS: { match: RegExp; out: Stage }[] = [
  { match: /^(submitted|applied|sent|application sent|in review)$/i,                out: 'applied' },
  { match: /(phone screen|phone interview|recruiter (call|chat|screen)|screening|hr screen)/i, out: 'phone-screen' },
  { match: /(hiring manager|hm screen|hm call|manager screen|hm interview)/i,        out: 'hiring-manager' },
  { match: /(technical|tech screen|coding|take[- ]home|assessment|coding challenge)/i, out: 'technical' },
  { match: /(onsite|on[- ]site|final round|final|loop|panel)/i,                      out: 'onsite' },
  { match: /(offer extended|received offer|got offer|^offer$|offer received)/i,      out: 'offer' },
  { match: /(accepted|signed|joined|started)/i,                                       out: 'accepted' },
  { match: /(rejected|declined|not selected|denied|no thanks|^no$|reject)/i,         out: 'rejected' },
  { match: /(ghosted|no response|silent|unanswered|never heard)/i,                   out: 'ghosted' },
  { match: /(withdrawn|withdrew|pulled|cancelled|canceled)/i,                         out: 'withdrawn' },
];

export function normalizeStatus(v: string | undefined): Stage {
  if (!v) return 'applied';
  const s = v.trim();
  // Direct enum match
  const cleaned = s.toLowerCase().replace(/\s+/g, '-');
  if ((STAGES as readonly string[]).includes(cleaned)) return cleaned as Stage;
  // Synonym match
  for (const { match, out } of STATUS_SYNONYMS) {
    if (match.test(s)) return out;
  }
  return 'applied';
}

const SOURCE_SYNONYMS: { match: RegExp; out: Source }[] = [
  { match: /(referral|referred|friend|connection|warm intro)/i,                     out: 'referral' },
  { match: /(linkedin|li[ -]post|li[ -]message)/i,                                  out: 'linkedin' },
  { match: /(cold (email|outreach|message)|cold[- ]email|outreach)/i,               out: 'cold-email' },
  { match: /(recruiter (reached|contacted|outbound)|inbound recruiter|sourcer)/i,   out: 'recruiter' },
  { match: /(job board|indeed|glassdoor|monster|wellfound|ziprecruiter|company (site|page|website)|careers page|company website)/i, out: 'job-board' },
];

export function normalizeSource(v: string | undefined): Source | undefined {
  if (!v) return undefined;
  const s = v.trim();
  const cleaned = s.toLowerCase().replace(/\s+/g, '-');
  if ((SOURCES as readonly string[]).includes(cleaned)) return cleaned as Source;
  for (const { match, out } of SOURCE_SYNONYMS) {
    if (match.test(s)) return out;
  }
  return 'other';
}

export function normalizeRelationship(v: string | undefined): Relationship | undefined {
  if (!v) return undefined;
  const s = v.toLowerCase();
  if (s.includes('recruiter')) return 'recruiter';
  if (s.includes('hiring') || s === 'hm') return 'hiring-manager';
  if (s.includes('referrer') || s.includes('referral')) return 'referrer';
  const cleaned = s.replace(/\s+/g, '-');
  if ((RELATIONSHIPS as readonly string[]).includes(cleaned)) return cleaned as Relationship;
  return 'other';
}

// ---- Date parsing ----------------------------------------------------------

// Accept ISO, common US/EU, "Jan 15 2024" / "January 15, 2024", "1/15/24".
// Returns YYYY-MM-DD or undefined.
export function parseDate(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const s = v.trim();
  if (!s) return undefined;

  // ISO already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Slash-separated. Heuristic: 4-digit year decides position.
  const slash = s.match(/^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})$/);
  if (slash) {
    const [, a, b, c] = slash;
    let y: number, m: number, d: number;
    if (a.length === 4) { y = +a; m = +b; d = +c; }
    else if (c.length === 4) {
      // Could be MM/DD/YYYY or DD/MM/YYYY. Use simple US default; if first part > 12, swap.
      if (+a > 12 && +b <= 12) { d = +a; m = +b; y = +c; }
      else                     { m = +a; d = +b; y = +c; }
    } else {
      // Two-digit year — assume 2000s.
      m = +a; d = +b; y = 2000 + +c;
    }
    if (y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }
  }

  // Native parse for "Jan 15 2024" etc.
  const t = Date.parse(s);
  if (!isNaN(t)) return new Date(t).toISOString().slice(0, 10);

  return undefined;
}

// ---- Salary parsing --------------------------------------------------------

export function parseSalaryRange(v: string | undefined): { min?: number; max?: number } {
  if (!v) return {};
  const cleaned = v.replace(/[$,£€\s]/g, '');
  // "100k-130k" or "100000-130000"
  const range = cleaned.match(/(\d+\.?\d*)\s*(k|m)?\s*[-–to]+\s*(\d+\.?\d*)\s*(k|m)?/i);
  if (range) {
    const [, lo, loSuf, hi, hiSuf] = range;
    return { min: scale(+lo, loSuf), max: scale(+hi, hiSuf) };
  }
  const single = cleaned.match(/(\d+\.?\d*)\s*(k|m)?/i);
  if (single) {
    const [, n, suf] = single;
    const x = scale(+n, suf);
    return { min: x, max: x };
  }
  return {};
}

function scale(n: number, suffix: string | undefined): number {
  if (!suffix) return n;
  if (suffix.toLowerCase() === 'k') return n * 1000;
  if (suffix.toLowerCase() === 'm') return n * 1_000_000;
  return n;
}

// ---- Apply mapping to rows -------------------------------------------------

export interface ApplyOptions {
  // user-overridden mappings (header → canonical or null/ignore)
  mapping: Map<string, CanonicalField | null>;
}

function rid(): string { return Math.random().toString(36).slice(2, 10); }

function nonEmpty(v: string | undefined): string | undefined {
  return v && v.trim() ? v.trim() : undefined;
}

function num(v: string | undefined): number | undefined {
  if (v === undefined || v === null) return undefined;
  const cleaned = String(v).replace(/[$,£€\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

export interface ApplyResult {
  applications: Application[];
  warnings: string[];
}

export function applyMapping(
  headers: string[],
  rows: string[][],
  opts: ApplyOptions
): ApplyResult {
  const idxOf = (canonical: CanonicalField) => {
    for (const [hdr, field] of opts.mapping) {
      if (field === canonical) return headers.indexOf(hdr);
    }
    return -1;
  };
  const get = (cells: string[], canonical: CanonicalField): string | undefined => {
    const i = idxOf(canonical);
    return i >= 0 ? cells[i] : undefined;
  };

  const warnings: string[] = [];
  if (idxOf('company') < 0)     warnings.push('No "company" column detected — rows will be skipped.');
  if (idxOf('applied_date') < 0) warnings.push('No "applied_date" column detected — using today\'s date for all rows.');

  const today = new Date().toISOString().slice(0, 10);
  const applications: Application[] = [];

  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i];
    const company = nonEmpty(get(cells, 'company'));
    if (!company) continue;
    const applied_date = parseDate(get(cells, 'applied_date')) ?? today;

    let salary_min = num(get(cells, 'salary_min'));
    let salary_max = num(get(cells, 'salary_max'));
    if (salary_min === undefined && salary_max === undefined) {
      const r = parseSalaryRange(get(cells, 'salary'));
      salary_min = r.min;
      salary_max = r.max;
    }

    applications.push({
      id: `${applied_date}-${company}-${rid()}`.toLowerCase().replace(/\s+/g, '-'),
      applied_date,
      company,
      role: nonEmpty(get(cells, 'role')),
      sector: nonEmpty(get(cells, 'sector')),
      company_stage: nonEmpty(get(cells, 'company_stage')),
      company_size: nonEmpty(get(cells, 'company_size')),
      location: nonEmpty(get(cells, 'location')),
      source: normalizeSource(get(cells, 'source')),
      cv_version: nonEmpty(get(cells, 'cv_version')),
      current_status: normalizeStatus(get(cells, 'current_status')),
      last_update: parseDate(get(cells, 'last_update')),
      salary_min,
      salary_max,
      interest_rating: num(get(cells, 'interest_rating')),
      contact_name: nonEmpty(get(cells, 'contact_name')),
      contact_email: nonEmpty(get(cells, 'contact_email')),
      contact_relationship: normalizeRelationship(get(cells, 'contact_relationship')),
      follow_up_date: parseDate(get(cells, 'follow_up_date')),
      notes: nonEmpty(get(cells, 'notes')),
    });
  }

  return { applications, warnings };
}

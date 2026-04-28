// Styled .xlsx export using `write-excel-file`. Single sheet with frozen
// header row, column widths, status-colored cells, currency/date formats.

import writeXlsxFile from 'write-excel-file';
import type { Application, CvVersion, Stage } from '../types';
import { POSITIVE_TERMINALS } from '../types';
import { prettyStage, prettySource } from './stats';

// Brand-aligned colors. Hex without #.
const HEADER_BG = '4F46E5';
const HEADER_FG = 'FFFFFF';
const STAGE_FILL: Record<string, string> = {
  applied:          'FEF3C7',  // amber-100
  'phone-screen':   'EDE9FE',  // violet-100
  'hiring-manager': 'F3E8FF',  // purple-100
  technical:        'FAE8FF',  // fuchsia-100
  onsite:           'FCE7F3',  // pink-100
  offer:            'D1FAE5',  // emerald-100
  accepted:         'A7F3D0',  // emerald-200
  rejected:         'FEE2E2',  // red-100
  ghosted:          'E5E7EB',  // gray-200
  withdrawn:        'FEF3C7',  // amber-100
};

interface HeaderCell {
  value: string;
  fontWeight: 'bold';
  align: 'left' | 'center' | 'right';
  backgroundColor: string;
  color: string;
  borderColor: string;
}

interface BodyCell {
  type?: typeof String | typeof Number | typeof Date;
  value: unknown;
  format?: string;
  backgroundColor?: string;
  align?: 'left' | 'center' | 'right';
  fontWeight?: 'bold';
  color?: string;
}

const HEADER_BASE: Omit<HeaderCell, 'value' | 'align'> = {
  fontWeight: 'bold',
  backgroundColor: HEADER_BG,
  color: HEADER_FG,
  borderColor: HEADER_BG,
};

function header(value: string, align: HeaderCell['align'] = 'left'): HeaderCell {
  return { value, align, ...HEADER_BASE };
}

function statusCell(stage: Stage): BodyCell {
  return {
    type: String,
    value: prettyStage(stage),
    backgroundColor: STAGE_FILL[stage] ?? 'FFFFFF',
    align: 'center',
    fontWeight: POSITIVE_TERMINALS.includes(stage) ? 'bold' : undefined,
  };
}

function ratingCell(n: number | undefined): BodyCell {
  if (!n) return { type: String, value: '', align: 'center' };
  return { type: String, value: '★'.repeat(n), align: 'center', color: 'D97706' };
}

function dateCell(iso: string | undefined): BodyCell {
  if (!iso) return { type: String, value: '' };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { type: String, value: iso };
  return { type: Date, value: d, format: 'yyyy-mm-dd' };
}

function moneyCell(n: number | undefined): BodyCell {
  if (n === undefined || n === null) return { type: String, value: '' };
  return { type: Number, value: n, format: '$#,##0', align: 'right' };
}

function textCell(v: string | undefined, opts: Partial<BodyCell> = {}): BodyCell {
  return { type: String, value: v ?? '', ...opts };
}

const COLUMNS = [
  { width: 12 }, // Date
  { width: 22 }, // Company
  { width: 26 }, // Role
  { width: 14 }, // Sector
  { width: 12 }, // Source
  { width: 16 }, // CV
  { width: 16 }, // Status
  { width: 10 }, // Interest
  { width: 16 }, // Contact
  { width: 14 }, // Rel.
  { width: 12 }, // Follow-up
  { width: 12 }, // Last update
  { width: 12 }, // Salary min
  { width: 12 }, // Salary max
  { width: 32 }, // Notes
];

const HEADERS = [
  header('Date',         'left'),
  header('Company',      'left'),
  header('Role',         'left'),
  header('Sector',       'left'),
  header('Source',       'left'),
  header('CV',           'left'),
  header('Status',       'center'),
  header('Interest',     'center'),
  header('Contact',      'left'),
  header('Relationship', 'left'),
  header('Follow-up',    'left'),
  header('Last update',  'left'),
  header('Salary min',   'right'),
  header('Salary max',   'right'),
  header('Notes',        'left'),
];

export async function exportXlsx(
  apps: Application[],
  cvs: CvVersion[],
  filename: string
): Promise<void> {
  const cvLabel = (id: string | undefined) =>
    id ? cvs.find((c) => c.id === id)?.label ?? id : '';

  const data: BodyCell[][] = [HEADERS as unknown as BodyCell[]];

  for (const app of apps) {
    data.push([
      dateCell(app.applied_date),
      textCell(app.company, { fontWeight: 'bold' }),
      textCell(app.role),
      textCell(app.sector),
      textCell(app.source ? prettySource(app.source) : ''),
      textCell(cvLabel(app.cv_version)),
      statusCell(app.current_status),
      ratingCell(app.interest_rating),
      textCell(app.contact_name),
      textCell(app.contact_relationship ? prettySource(app.contact_relationship) : ''),
      dateCell(app.follow_up_date),
      dateCell(app.last_update),
      moneyCell(app.salary_min),
      moneyCell(app.salary_max),
      textCell(app.notes),
    ]);
  }

  // The write-excel-file types are awkward for single-sheet output; the
  // runtime accepts our shape fine, so cast through unknown.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (writeXlsxFile as any)(data, {
    columns: COLUMNS,
    headerStyle: HEADER_BASE,
    fileName: filename,
    sheet: 'Applications',
    stickyRowsCount: 1,
  });
}

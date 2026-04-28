// Stage names — keep this list canonical. The Sankey, table, and stats all
// rely on it. Add new stages here first.
export const STAGES = [
  'applied',
  'phone-screen',
  'hiring-manager',
  'technical',
  'onsite',
  'offer',
  'accepted',
  'rejected',
  'ghosted',
  'withdrawn',
] as const;

export type Stage = (typeof STAGES)[number];

// Stages where a candidate is still in the funnel (vs. terminal outcomes).
export const ACTIVE_STAGES: Stage[] = [
  'applied',
  'phone-screen',
  'hiring-manager',
  'technical',
  'onsite',
];

export const TERMINAL_STAGES: Stage[] = [
  'offer',
  'accepted',
  'rejected',
  'ghosted',
  'withdrawn',
];

export const POSITIVE_TERMINALS: Stage[] = ['offer', 'accepted'];

export type Source =
  | 'referral'
  | 'linkedin'
  | 'cold-email'
  | 'recruiter'
  | 'job-board'
  | 'other';

export interface StageEntry {
  stage: Stage;
  date: string | null; // ISO date (YYYY-MM-DD) or null if not yet reached
}

export interface Application {
  id: string;
  company: string;
  role: string;
  sector: string;
  company_stage: string; // series-a, series-b, public, etc.
  company_size: string;
  location: string;
  source: Source;
  referrer?: string;
  cv_version: string;
  cover_letter_version?: string;
  applied_date: string;
  current_status: Stage;
  outcome_stage?: Stage; // last active stage reached before a terminal outcome
  stages: StageEntry[];
  salary_range: number[]; // [] if unknown, or [low, high]
  notes?: string;
  links?: Record<string, string>;
}

export interface CvVersion {
  id: string;
  label: string;
  description: string;
  created: string;
}

export interface AppData {
  applications: Application[];
  cvs: CvVersion[];
}

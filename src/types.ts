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

export const ACTIVE_STAGES: Stage[] = [
  'applied',
  'phone-screen',
  'hiring-manager',
  'technical',
  'onsite',
];

export const FORWARD_STAGES: Stage[] = [
  'applied',
  'phone-screen',
  'hiring-manager',
  'technical',
  'onsite',
  'offer',
  'accepted',
];

export const TERMINAL_STAGES: Stage[] = [
  'offer',
  'accepted',
  'rejected',
  'ghosted',
  'withdrawn',
];

export const POSITIVE_TERMINALS: Stage[] = ['offer', 'accepted'];

export const SOURCES = [
  'referral',
  'linkedin',
  'cold-email',
  'recruiter',
  'job-board',
  'other',
] as const;

export type Source = (typeof SOURCES)[number];

export const RELATIONSHIPS = [
  'recruiter',
  'hiring-manager',
  'referrer',
  'other',
] as const;

export type Relationship = (typeof RELATIONSHIPS)[number];

export interface StageEntry {
  stage: Stage;
  date: string | null;
}

export interface Application {
  id: string;
  company: string;
  role?: string;
  sector?: string;
  company_stage?: string;
  company_size?: string;
  location?: string;
  source?: Source;
  referrer?: string;
  cv_version?: string;
  cover_letter_version?: string;
  applied_date: string;
  last_update?: string;
  current_status: Stage;
  outcome_stage?: Stage;
  stages?: StageEntry[];
  salary_min?: number;
  salary_max?: number;
  notes?: string;
  links?: Record<string, string>;
  // New
  interest_rating?: number;       // 1-5 stars (your interest in the role)
  contact_name?: string;
  contact_email?: string;
  contact_relationship?: Relationship;
  follow_up_date?: string;        // when to nudge
}

export interface CvVersion {
  id: string;
  label: string;
  description?: string;
  created: string;
  has_file?: boolean;
  filename?: string;
  size?: number;
}

export interface AppData {
  applications: Application[];
  cvs: CvVersion[];
}

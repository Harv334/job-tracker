import { aiCall } from './client';
import type { Application } from '../types';
import { TERMINAL_STAGES, POSITIVE_TERMINALS } from '../types';

const SYSTEM = `You are a job-search coach analyzing a candidate's recent
rejections and ghosts. Be concise, specific, and actionable. Highlight
patterns the candidate might not see (sectors, role levels, stages where
they're losing, CV-version effects, time-of-year). Do not invent data.
Format: 3-5 short bullet points (one sentence each).`;

interface RejectionRecord {
  sector?: string;
  role?: string;
  stage_lost: string;
  source?: string;
  cv_version?: string;
  notes?: string;
}

function summarizeForModel(apps: Application[]): RejectionRecord[] {
  const dead = apps.filter(
    (a) =>
      TERMINAL_STAGES.includes(a.current_status) &&
      !POSITIVE_TERMINALS.includes(a.current_status)
  );
  return dead.map((a) => ({
    sector: a.sector,
    role: a.role,
    stage_lost: a.outcome_stage ?? a.current_status,
    source: a.source,
    cv_version: a.cv_version,
    notes: a.notes ? a.notes.slice(0, 200) : undefined,
  }));
}

export async function analyzeRejectionPatterns(apps: Application[]): Promise<string> {
  const records = summarizeForModel(apps);
  if (records.length < 5) {
    return 'Not enough rejected/ghosted applications yet (need at least 5) to find patterns.';
  }
  const prompt =
    `Recent rejections/ghosts (${records.length} total):\n\n` +
    JSON.stringify(records, null, 2) +
    `\n\nIdentify patterns and suggest 2-3 specific changes the candidate could try next.`;
  return aiCall(prompt, { system: SYSTEM, maxTokens: 600 });
}

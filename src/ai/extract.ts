import { aiCall, extractJson } from './client';
import type { Application, Source } from '../types';

export interface JdExtractResult {
  company?: string;
  role?: string;
  sector?: string;
  company_stage?: string;
  company_size?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
}

const SYSTEM = `You extract structured data from job descriptions for a UK
job seeker. Default assumptions: GBP for any salary unless explicitly USD/EUR;
UK locations unless stated otherwise.

Output ONLY a JSON object with these fields (omit any you can't determine):
{
  "company": "Company name",
  "role": "Role title (no seniority prefix unless meaningful)",
  "sector": "lowercase short label, e.g. fintech, healthtech, ai-ml, climate, devtools, ecommerce, gaming, edtech, govtech, mediatech, crypto, b2b-saas, banking, insurance, pharma, legal, consulting, retail",
  "company_stage": "one of: pre-seed, seed, series-a, series-b, series-c, series-d, public, private, government, charity",
  "company_size": "one of: 1-20, 20-100, 100-500, 500-1000, 1000-10000, 10000+",
  "location": "Concise UK-style location, e.g. 'London (Hybrid)', 'Manchester (On-site)', 'Remote (UK)', 'Edinburgh (Hybrid)'",
  "salary_min": numeric annual GBP lower bound (no symbols, no commas, e.g. 90000),
  "salary_max": numeric annual GBP upper bound
}
If salary is given in £k (e.g. "£90k"), convert to whole pounds (90000).
If salary is given as a day rate (e.g. "£500/day"), skip the salary fields.
Do not invent fields. If a value isn't present in the JD, omit the key.`;

export async function extractFromJd(jdText: string): Promise<JdExtractResult> {
  const trimmed = jdText.trim().slice(0, 12000);
  const text = await aiCall(
    `Job description:\n\n${trimmed}\n\nReturn the JSON object.`,
    { system: SYSTEM, maxTokens: 600 }
  );
  return extractJson<JdExtractResult>(text);
}

export function mergeExtracted(
  app: Application,
  extracted: JdExtractResult,
  source?: Source
): Application {
  return {
    ...app,
    company: app.company || extracted.company || '',
    role: app.role || extracted.role,
    sector: app.sector || extracted.sector,
    company_stage: app.company_stage || extracted.company_stage,
    company_size: app.company_size || extracted.company_size,
    location: app.location || extracted.location,
    salary_min: app.salary_min ?? extracted.salary_min,
    salary_max: app.salary_max ?? extracted.salary_max,
    source: app.source || source,
  };
}

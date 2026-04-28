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

const SYSTEM = `You extract structured data from job descriptions.
Output ONLY a JSON object with these fields (omit any you can't determine):
{
  "company": "Company name",
  "role": "Role title (no seniority prefix unless meaningful)",
  "sector": "lowercase short label, e.g. fintech, healthtech, ai-ml, climate, devtools, ecommerce, gaming, edtech, govtech, mediatech, crypto, b2b-saas",
  "company_stage": "one of: pre-seed, seed, series-a, series-b, series-c, series-d, public, private, nonprofit",
  "company_size": "one of: 1-20, 20-100, 100-500, 500-1000, 1000-10000, 10000+",
  "location": "Concise location, e.g. Remote (US), London (Hybrid)",
  "salary_min": numeric annual USD or local-currency lower bound,
  "salary_max": numeric annual upper bound
}
Do not invent fields. If a value isn't present in the JD, omit the key.`;

export async function extractFromJd(jdText: string): Promise<JdExtractResult> {
  const trimmed = jdText.trim().slice(0, 12000);
  const text = await aiCall(
    `Job description:\n\n${trimmed}\n\nReturn the JSON object.`,
    { system: SYSTEM, maxTokens: 600 }
  );
  return extractJson<JdExtractResult>(text);
}

// Merge extracted fields onto an existing Application without overwriting
// values the user already filled in.
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

import { aiCall, extractJson } from './client';
import type { CanonicalField } from '../utils/import-detect';
import { CANONICAL_FIELDS } from '../utils/import-detect';

const SYSTEM = `You map foreign job-tracker spreadsheet columns to a fixed
canonical schema. Output ONLY a JSON object whose keys are the exact column
header names from the input, and values are one of these canonical fields
(or null to ignore the column):

${CANONICAL_FIELDS.join(', ')}

Use null for any column you cannot confidently assign. Each canonical field
should appear AT MOST ONCE in your output.`;

export async function aiSuggestMapping(
  headers: string[],
  sampleRows: string[][]
): Promise<Map<string, CanonicalField | null>> {
  const prompt =
    `Headers: ${JSON.stringify(headers)}\n\n` +
    `Sample rows (first 3):\n${sampleRows.slice(0, 3).map((r) => JSON.stringify(r)).join('\n')}\n\n` +
    `Return the JSON mapping object.`;

  const text = await aiCall(prompt, { system: SYSTEM, maxTokens: 800 });
  const obj = extractJson<Record<string, string | null>>(text);

  const map = new Map<string, CanonicalField | null>();
  for (const h of headers) {
    const v = obj[h];
    if (typeof v === 'string' && (CANONICAL_FIELDS as readonly string[]).includes(v)) {
      map.set(h, v as CanonicalField);
    } else {
      map.set(h, null);
    }
  }
  return map;
}

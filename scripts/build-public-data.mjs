// Reads data/applications.private.json (your real data, gitignored) and
// emits an anonymized data/applications.public.json that the deployed site
// reads when no private file is available.
//
// What gets stripped:
//   - company name (replaced with sector + stage label)
//   - referrer name
//   - notes (kept only as length indicator)
//   - links
//   - salary numbers (kept as banded ranges)
//
// What stays: stages, dates, sector, company_stage, source, cv_version.
// Edit the rules below as needed.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const inputPath = resolve(root, 'data/applications.private.json');
const outputPath = resolve(root, 'data/applications.public.json');

if (!existsSync(inputPath)) {
  console.warn(
    `[build-public-data] no ${inputPath} present — skipping. The deployed site will fall back to applications.sample.json.`
  );
  process.exit(0);
}

const file = JSON.parse(readFileSync(inputPath, 'utf8'));

function bandSalary(range) {
  if (!Array.isArray(range) || range.length !== 2) return [];
  const [lo, hi] = range;
  const round = (n) => Math.round(n / 20000) * 20000;
  return [round(lo), round(hi)];
}

function anonymizeRole(role) {
  return role
    .replace(/^(senior|lead|principal|staff|group|junior)\s+/i, '')
    .replace(/,.*/, '')
    .trim();
}

const sanitized = file.applications.map((a, i) => {
  const tag = `${a.sector} · ${a.company_stage}`;
  return {
    id: `anon-${i + 1}`,
    company: tag,
    role: anonymizeRole(a.role),
    sector: a.sector,
    company_stage: a.company_stage,
    company_size: a.company_size,
    location: a.location,
    source: a.source,
    cv_version: a.cv_version,
    cover_letter_version: a.cover_letter_version,
    applied_date: a.applied_date,
    current_status: a.current_status,
    outcome_stage: a.outcome_stage,
    stages: a.stages,
    salary_range: bandSalary(a.salary_range ?? []),
    notes: a.notes ? `(${a.notes.length} chars)` : '',
    links: {},
  };
});

writeFileSync(
  outputPath,
  JSON.stringify({ applications: sanitized }, null, 2),
  'utf8'
);
console.log(
  `[build-public-data] wrote ${sanitized.length} anonymized applications → ${outputPath}`
);

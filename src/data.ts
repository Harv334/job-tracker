import type { AppData, Application, CvVersion } from './types';
import applicationsSample from '../data/applications.sample.json';
import cvsSample from '../data/cvs.json';
import { loadApplications, loadCvMeta, saveApplications, saveCvMeta } from './storage/local';

function normalize(raw: unknown): Application {
  const r = raw as Record<string, unknown>;
  let salary_min = r.salary_min as number | undefined;
  let salary_max = r.salary_max as number | undefined;
  const range = r.salary_range as number[] | undefined;
  if (Array.isArray(range) && range.length === 2) {
    salary_min ??= range[0];
    salary_max ??= range[1];
  }
  return {
    id: String(r.id ?? Math.random().toString(36).slice(2, 10)),
    company: String(r.company ?? ''),
    role: r.role as string | undefined,
    sector: r.sector as string | undefined,
    company_stage: r.company_stage as string | undefined,
    company_size: r.company_size as string | undefined,
    location: r.location as string | undefined,
    source: r.source as Application['source'],
    referrer: r.referrer as string | undefined,
    cv_version: r.cv_version as string | undefined,
    cover_letter_version: r.cover_letter_version as string | undefined,
    applied_date: String(r.applied_date ?? ''),
    last_update: r.last_update as string | undefined,
    current_status: (r.current_status as Application['current_status']) ?? 'applied',
    outcome_stage: r.outcome_stage as Application['outcome_stage'],
    stages: r.stages as Application['stages'],
    salary_min,
    salary_max,
    notes: r.notes as string | undefined,
    links: r.links as Record<string, string> | undefined,
  };
}

export function loadAll(): AppData {
  return {
    applications: loadApplications().map(normalize),
    cvs: loadCvMeta(),
  };
}

export function saveApps(apps: Application[]): void {
  saveApplications(apps);
}

export function saveCvs(cvs: CvVersion[]): void {
  saveCvMeta(cvs);
}

export function loadSampleIntoStorage(): AppData {
  const sampleApps = (applicationsSample as { applications: unknown[] }).applications;
  const apps = sampleApps.map(normalize);
  const cvs = (cvsSample as { versions: CvVersion[] }).versions;
  saveApplications(apps);
  saveCvMeta(cvs);
  return { applications: apps, cvs };
}

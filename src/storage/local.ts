// localStorage-backed store for applications and CV metadata.
// Single-user, browser-local. No server, no auth.

import type { Application, CvVersion } from '../types';

const KEY_APPS = 'jt:applications:v1';
const KEY_CVS  = 'jt:cv-meta:v1';

interface AppsBlob { applications: Application[] }
interface CvBlob   { versions: CvVersion[] }

function safeRead<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`localStorage parse error for ${key}:`, err);
    return null;
  }
}

function safeWrite(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`localStorage write error for ${key}:`, err);
    alert(
      'Could not save your data — your browser storage may be full. ' +
      'Try exporting to CSV and clearing some entries.'
    );
  }
}

export function loadApplications(): Application[] {
  return safeRead<AppsBlob>(KEY_APPS)?.applications ?? [];
}

export function saveApplications(applications: Application[]): void {
  safeWrite(KEY_APPS, { applications });
}

export function loadCvMeta(): CvVersion[] {
  return safeRead<CvBlob>(KEY_CVS)?.versions ?? [];
}

export function saveCvMeta(versions: CvVersion[]): void {
  safeWrite(KEY_CVS, { versions });
}

export function clearAll(): void {
  localStorage.removeItem(KEY_APPS);
  localStorage.removeItem(KEY_CVS);
}

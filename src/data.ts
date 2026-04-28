import type { AppData, Application, CvVersion } from './types';

// Vite resolves these relative to the project root.
import applicationsSample from '../data/applications.sample.json';
import cvsJson from '../data/cvs.json';

// At runtime we try to fetch the private file first (only present locally /
// in private deploys), and fall back to the bundled sample file.
async function tryFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface AppsFile {
  applications: Application[];
}
interface CvFile {
  versions: CvVersion[];
}

export async function loadData(): Promise<AppData> {
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');

  // Order: private (gitignored) → public anonymized (built) → sample (bundled).
  const apps =
    (await tryFetch<AppsFile>(`${base}/data/applications.private.json`)) ??
    (await tryFetch<AppsFile>(`${base}/data/applications.public.json`)) ??
    (applicationsSample as AppsFile);

  return {
    applications: apps.applications,
    cvs: (cvsJson as CvFile).versions,
  };
}

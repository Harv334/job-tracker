import {
  type Application,
  type Stage,
  type StageEntry,
  ACTIVE_STAGES,
  FORWARD_STAGES,
  POSITIVE_TERMINALS,
  TERMINAL_STAGES,
} from '../types';

export interface FunnelKpis {
  totalApplications: number;
  responseRate: number;
  interviewRate: number;
  onsiteRate: number;
  offerRate: number;
  rejectionRate: number;
  ghostRate: number;
  active: number;
  medianDaysToFirstResponse: number | null;
  medianDaysToOutcome: number | null;
}

export function getStages(app: Application): StageEntry[] {
  if (app.stages && app.stages.length > 0) return app.stages;

  const finalDate = app.last_update ?? app.applied_date;
  const out: StageEntry[] = [{ stage: 'applied', date: app.applied_date }];

  if (FORWARD_STAGES.includes(app.current_status) && app.current_status !== 'applied') {
    const idx = FORWARD_STAGES.indexOf(app.current_status);
    for (let i = 1; i <= idx; i++) {
      out.push({
        stage: FORWARD_STAGES[i],
        date: i === idx ? finalDate : app.applied_date,
      });
    }
  } else if (TERMINAL_STAGES.includes(app.current_status) &&
             !POSITIVE_TERMINALS.includes(app.current_status)) {
    if (app.outcome_stage) {
      const outIdx = FORWARD_STAGES.indexOf(app.outcome_stage);
      for (let i = 1; i <= outIdx; i++) {
        out.push({ stage: FORWARD_STAGES[i], date: app.applied_date });
      }
    }
    out.push({ stage: app.current_status, date: finalDate });
  }
  return out;
}

function reachedAtLeast(app: Application, stage: Stage): boolean {
  const target = FORWARD_STAGES.indexOf(stage);
  if (target < 0) return false;
  const stages = getStages(app);
  return stages.some((s) => {
    const idx = FORWARD_STAGES.indexOf(s.stage);
    return idx >= target;
  });
}

function isTerminal(app: Application): boolean {
  return TERMINAL_STAGES.includes(app.current_status);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeKpis(apps: Application[]): FunnelKpis {
  const total = apps.length;
  if (total === 0) {
    return {
      totalApplications: 0, responseRate: 0, interviewRate: 0, onsiteRate: 0,
      offerRate: 0, rejectionRate: 0, ghostRate: 0, active: 0,
      medianDaysToFirstResponse: null, medianDaysToOutcome: null,
    };
  }

  const responses = apps.filter((a) => reachedAtLeast(a, 'phone-screen')).length;
  const interviews = apps.filter((a) => reachedAtLeast(a, 'hiring-manager')).length;
  const onsites = apps.filter((a) => reachedAtLeast(a, 'onsite')).length;
  const offers = apps.filter((a) => POSITIVE_TERMINALS.includes(a.current_status)).length;
  const rejects = apps.filter((a) => a.current_status === 'rejected').length;
  const ghosts = apps.filter((a) => a.current_status === 'ghosted').length;
  const active = apps.filter((a) => ACTIVE_STAGES.includes(a.current_status)).length;

  const firstResponseDays: number[] = [];
  for (const app of apps) {
    const stages = getStages(app);
    const applied = stages.find((s) => s.stage === 'applied')?.date;
    const first = stages.find((s) => s.stage !== 'applied' && s.date);
    if (applied && first?.date) firstResponseDays.push(daysBetween(applied, first.date));
  }

  const outcomeDays: number[] = [];
  for (const app of apps) {
    if (!isTerminal(app)) continue;
    const stages = getStages(app);
    const applied = stages.find((s) => s.stage === 'applied')?.date;
    const terminal = stages.find((s) => TERMINAL_STAGES.includes(s.stage));
    if (applied && terminal?.date) outcomeDays.push(daysBetween(applied, terminal.date));
  }

  return {
    totalApplications: total,
    responseRate: responses / total,
    interviewRate: interviews / total,
    onsiteRate: onsites / total,
    offerRate: offers / total,
    rejectionRate: rejects / total,
    ghostRate: ghosts / total,
    active,
    medianDaysToFirstResponse: median(firstResponseDays),
    medianDaysToOutcome: median(outcomeDays),
  };
}

export function countBy<K extends string>(
  apps: Application[],
  key: (a: Application) => K | undefined
): Map<K, number> {
  const m = new Map<K, number>();
  for (const a of apps) {
    const k = key(a);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export interface CvEffectiveness {
  cv: string;
  applications: number;
  interviews: number;
  offers: number;
  interviewRate: number;
  offerRate: number;
}

export function cvEffectiveness(apps: Application[]): CvEffectiveness[] {
  const groups = new Map<string, Application[]>();
  for (const a of apps) {
    if (!a.cv_version) continue;
    const arr = groups.get(a.cv_version) ?? [];
    arr.push(a);
    groups.set(a.cv_version, arr);
  }
  return [...groups.entries()].map(([cv, list]) => {
    const interviews = list.filter((a) => reachedAtLeast(a, 'hiring-manager')).length;
    const offers = list.filter((a) => POSITIVE_TERMINALS.includes(a.current_status)).length;
    return {
      cv,
      applications: list.length,
      interviews,
      offers,
      interviewRate: interviews / list.length,
      offerRate: offers / list.length,
    };
  });
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export function buildSankeyLinks(apps: Application[]): {
  nodes: { name: string }[];
  links: SankeyLink[];
} {
  const counts = new Map<string, number>();
  const nodeSet = new Set<string>();
  const bump = (a: string, b: string) => {
    nodeSet.add(a); nodeSet.add(b);
    const k = `${a}|${b}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };

  for (const app of apps) {
    const stages = getStages(app);
    const ordered = [...stages].sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : Infinity;
      const db = b.date ? new Date(b.date).getTime() : Infinity;
      return da - db;
    });
    for (let i = 0; i < ordered.length - 1; i++) {
      bump(prettyStage(ordered[i].stage), prettyStage(ordered[i + 1].stage));
    }
    if (ACTIVE_STAGES.includes(app.current_status) && app.current_status !== 'applied') {
      bump(prettyStage(app.current_status), 'In progress');
    } else if (app.current_status === 'applied') {
      bump('Applied', 'In progress');
    }
  }

  const links: SankeyLink[] = [...counts.entries()].map(([k, value]) => {
    const [source, target] = k.split('|');
    return { source, target, value };
  });
  return { nodes: [...nodeSet].map((name) => ({ name })), links };
}

export function prettyStage(s: Stage | string): string {
  switch (s) {
    case 'applied': return 'Applied';
    case 'phone-screen': return 'Phone screen';
    case 'hiring-manager': return 'Hiring manager';
    case 'technical': return 'Technical';
    case 'onsite': return 'Onsite';
    case 'offer': return 'Offer';
    case 'accepted': return 'Accepted';
    case 'rejected': return 'Rejected';
    case 'ghosted': return 'Ghosted';
    case 'withdrawn': return 'Withdrawn';
    default: return s;
  }
}

export function prettySource(s: string): string {
  return s
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

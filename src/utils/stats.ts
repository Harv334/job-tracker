import {
  type Application,
  type Stage,
  ACTIVE_STAGES,
  POSITIVE_TERMINALS,
  TERMINAL_STAGES,
} from '../types';

export interface FunnelKpis {
  totalApplications: number;
  responseRate: number;        // any movement past 'applied'
  interviewRate: number;       // reached hiring-manager+
  onsiteRate: number;          // reached onsite+
  offerRate: number;           // ended (or sitting) at offer/accepted
  rejectionRate: number;
  ghostRate: number;
  active: number;              // currently in funnel, not terminal
  medianDaysToFirstResponse: number | null;
  medianDaysToOutcome: number | null;
}

const stageOrder: Stage[] = [
  'applied',
  'phone-screen',
  'hiring-manager',
  'technical',
  'onsite',
  'offer',
];

function reachedAtLeast(app: Application, stage: Stage): boolean {
  const target = stageOrder.indexOf(stage);
  if (target < 0) return false;
  return app.stages.some((s) => {
    const idx = stageOrder.indexOf(s.stage);
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
      totalApplications: 0,
      responseRate: 0,
      interviewRate: 0,
      onsiteRate: 0,
      offerRate: 0,
      rejectionRate: 0,
      ghostRate: 0,
      active: 0,
      medianDaysToFirstResponse: null,
      medianDaysToOutcome: null,
    };
  }

  const responses = apps.filter((a) => reachedAtLeast(a, 'phone-screen')).length;
  const interviews = apps.filter((a) => reachedAtLeast(a, 'hiring-manager')).length;
  const onsites = apps.filter((a) => reachedAtLeast(a, 'onsite')).length;
  const offers = apps.filter((a) => POSITIVE_TERMINALS.includes(a.current_status)).length;
  const rejects = apps.filter((a) => a.current_status === 'rejected').length;
  const ghosts = apps.filter((a) => a.current_status === 'ghosted').length;
  const active = apps.filter(
    (a) => ACTIVE_STAGES.includes(a.current_status) && a.current_status !== 'applied'
  ).length + apps.filter((a) => a.current_status === 'applied' && !isTerminal(a)).length;

  // Days to first response: applied -> first non-applied stage entry with a date.
  const firstResponseDays: number[] = [];
  for (const app of apps) {
    const applied = app.stages.find((s) => s.stage === 'applied')?.date;
    const first = app.stages.find((s) => s.stage !== 'applied' && s.date);
    if (applied && first?.date) firstResponseDays.push(daysBetween(applied, first.date));
  }

  // Days to outcome: applied -> terminal stage date.
  const outcomeDays: number[] = [];
  for (const app of apps) {
    if (!isTerminal(app)) continue;
    const applied = app.stages.find((s) => s.stage === 'applied')?.date;
    const terminal = app.stages.find((s) => TERMINAL_STAGES.includes(s.stage));
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

// ---- Group counts ---------------------------------------------------------

export function countBy<K extends string>(
  apps: Application[],
  key: (a: Application) => K
): Map<K, number> {
  const m = new Map<K, number>();
  for (const a of apps) {
    const k = key(a);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

// CV-version effectiveness: per CV version, count interviews and offers.
export interface CvEffectiveness {
  cv: string;
  applications: number;
  interviews: number;     // reached hiring-manager+
  offers: number;
  interviewRate: number;
  offerRate: number;
}

export function cvEffectiveness(apps: Application[]): CvEffectiveness[] {
  const groups = new Map<string, Application[]>();
  for (const a of apps) {
    const arr = groups.get(a.cv_version) ?? [];
    arr.push(a);
    groups.set(a.cv_version, arr);
  }

  return [...groups.entries()].map(([cv, list]) => {
    const interviews = list.filter((a) => reachedAtLeast(a, 'hiring-manager')).length;
    const offers = list.filter((a) =>
      POSITIVE_TERMINALS.includes(a.current_status)
    ).length;
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

// ---- Sankey link generation ----------------------------------------------

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

// Walk each application's stage history and emit one link per consecutive
// (stage_n -> stage_n+1) transition. Active applications get a final link
// to a synthetic "In progress" node so they show up in the diagram.
export function buildSankeyLinks(apps: Application[]): {
  nodes: { name: string }[];
  links: SankeyLink[];
} {
  const counts = new Map<string, number>();
  const nodeSet = new Set<string>();

  const bump = (a: string, b: string) => {
    nodeSet.add(a);
    nodeSet.add(b);
    const k = `${a}|${b}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };

  for (const app of apps) {
    const ordered = [...app.stages].sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : Infinity;
      const db = b.date ? new Date(b.date).getTime() : Infinity;
      return da - db;
    });
    for (let i = 0; i < ordered.length - 1; i++) {
      bump(prettyStage(ordered[i].stage), prettyStage(ordered[i + 1].stage));
    }
    // If currently active, draw a link from current_status -> "In progress".
    if (
      ACTIVE_STAGES.includes(app.current_status) &&
      app.current_status !== 'applied'
    ) {
      bump(prettyStage(app.current_status), 'In progress');
    } else if (app.current_status === 'applied') {
      bump('Applied', 'In progress');
    }
  }

  const links: SankeyLink[] = [...counts.entries()].map(([k, value]) => {
    const [source, target] = k.split('|');
    return { source, target, value };
  });

  return {
    nodes: [...nodeSet].map((name) => ({ name })),
    links,
  };
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

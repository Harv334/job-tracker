import type { FunnelKpis } from '../utils/stats';

interface Tile {
  label: string;
  value: string;
  sub?: string;
}

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

export function renderKpis(container: HTMLElement, k: FunnelKpis): void {
  const tiles: Tile[] = [
    {
      label: 'Total applications',
      value: String(k.totalApplications),
      sub: `${k.active} active in funnel`,
    },
    {
      label: 'Response rate',
      value: pct(k.responseRate),
      sub: 'reached recruiter screen',
    },
    {
      label: 'Interview rate',
      value: pct(k.interviewRate),
      sub: 'reached hiring manager',
    },
    {
      label: 'Onsite rate',
      value: pct(k.onsiteRate),
      sub: 'reached final round',
    },
    {
      label: 'Offer rate',
      value: pct(k.offerRate),
      sub: 'of total applications',
    },
    {
      label: 'Median: first response',
      value:
        k.medianDaysToFirstResponse == null
          ? '—'
          : `${k.medianDaysToFirstResponse} d`,
      sub: 'after applying',
    },
    {
      label: 'Median: time to outcome',
      value: k.medianDaysToOutcome == null ? '—' : `${k.medianDaysToOutcome} d`,
      sub: 'apply → terminal',
    },
    {
      label: 'Ghost rate',
      value: pct(k.ghostRate),
      sub: 'no response after 30d',
    },
  ];

  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className =
    'grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3';

  for (const t of tiles) {
    const div = document.createElement('div');
    div.className = 'card-tight';
    div.innerHTML = `
      <div class="kpi-label">${t.label}</div>
      <div class="kpi-value">${t.value}</div>
      ${t.sub ? `<div class="kpi-sub">${t.sub}</div>` : ''}
    `;
    grid.appendChild(div);
  }
  container.appendChild(grid);
}

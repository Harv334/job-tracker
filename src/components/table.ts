import type { Application, CvVersion, Stage } from '../types';
import { ACTIVE_STAGES, POSITIVE_TERMINALS } from '../types';
import { prettyStage, prettySource } from '../utils/stats';

interface TableState {
  search: string;
  status: 'all' | 'active' | 'offer' | 'rejected' | 'ghosted';
  sector: string; // 'all' or specific
  sort: 'recent' | 'company' | 'stage';
}

function statusBadge(status: Stage): string {
  if (POSITIVE_TERMINALS.includes(status)) {
    return `<span class="badge badge-offer">${prettyStage(status)}</span>`;
  }
  if (status === 'rejected') {
    return `<span class="badge badge-rejected">Rejected</span>`;
  }
  if (status === 'ghosted') {
    return `<span class="badge badge-ghosted">Ghosted</span>`;
  }
  if (status === 'withdrawn') {
    return `<span class="badge badge-ghosted">Withdrawn</span>`;
  }
  if (status === 'applied') {
    return `<span class="badge badge-applied">Applied</span>`;
  }
  return `<span class="badge badge-active">${prettyStage(status)}</span>`;
}

function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.round((now - then) / (1000 * 60 * 60 * 24));
}

function lastActivityDate(app: Application): string {
  const dated = app.stages.filter((s) => s.date).map((s) => s.date as string);
  if (dated.length === 0) return app.applied_date;
  return dated.sort().slice(-1)[0];
}

export function renderTable(
  container: HTMLElement,
  apps: Application[],
  cvs: CvVersion[]
): void {
  const state: TableState = {
    search: '',
    status: 'all',
    sector: 'all',
    sort: 'recent',
  };

  const sectors = [...new Set(apps.map((a) => a.sector))].sort();
  const cvLabel = (id: string) => cvs.find((c) => c.id === id)?.label ?? id;

  container.innerHTML = `
    <div class="card">
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <h3 class="text-sm font-semibold uppercase tracking-wider mr-auto">Applications</h3>
        <input id="tbl-search" placeholder="Search…" class="input w-48" />
        <select id="tbl-status" class="input">
          <option value="all">All statuses</option>
          <option value="active">Active in funnel</option>
          <option value="offer">Offers</option>
          <option value="rejected">Rejected</option>
          <option value="ghosted">Ghosted</option>
        </select>
        <select id="tbl-sector" class="input">
          <option value="all">All sectors</option>
          ${sectors.map((s) => `<option value="${s}">${s}</option>`).join('')}
        </select>
        <select id="tbl-sort" class="input">
          <option value="recent">Most recent activity</option>
          <option value="company">Company A→Z</option>
          <option value="stage">Stage</option>
        </select>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-ink-400 uppercase text-xs tracking-wider">
            <tr class="border-b border-ink-700">
              <th class="text-left py-2 pr-3">Company</th>
              <th class="text-left py-2 pr-3">Role</th>
              <th class="text-left py-2 pr-3">Sector</th>
              <th class="text-left py-2 pr-3">Source</th>
              <th class="text-left py-2 pr-3">CV</th>
              <th class="text-left py-2 pr-3">Status</th>
              <th class="text-right py-2 pr-3">Last activity</th>
            </tr>
          </thead>
          <tbody id="tbl-body"></tbody>
        </table>
      </div>
    </div>
  `;

  const body = container.querySelector('#tbl-body') as HTMLElement;
  const search = container.querySelector('#tbl-search') as HTMLInputElement;
  const status = container.querySelector('#tbl-status') as HTMLSelectElement;
  const sector = container.querySelector('#tbl-sector') as HTMLSelectElement;
  const sort = container.querySelector('#tbl-sort') as HTMLSelectElement;

  function matchesStatus(a: Application): boolean {
    switch (state.status) {
      case 'all': return true;
      case 'active': return ACTIVE_STAGES.includes(a.current_status);
      case 'offer': return POSITIVE_TERMINALS.includes(a.current_status);
      case 'rejected': return a.current_status === 'rejected';
      case 'ghosted': return a.current_status === 'ghosted';
    }
  }

  function render() {
    const filtered = apps
      .filter((a) => {
        if (state.search) {
          const q = state.search.toLowerCase();
          if (
            !a.company.toLowerCase().includes(q) &&
            !a.role.toLowerCase().includes(q) &&
            !(a.notes ?? '').toLowerCase().includes(q)
          ) return false;
        }
        if (!matchesStatus(a)) return false;
        if (state.sector !== 'all' && a.sector !== state.sector) return false;
        return true;
      })
      .sort((a, b) => {
        switch (state.sort) {
          case 'company': return a.company.localeCompare(b.company);
          case 'stage':   return a.current_status.localeCompare(b.current_status);
          case 'recent':
          default: {
            const la = lastActivityDate(a);
            const lb = lastActivityDate(b);
            return lb.localeCompare(la);
          }
        }
      });

    if (filtered.length === 0) {
      body.innerHTML = `<tr><td colspan="7" class="text-center text-ink-400 py-6">No matching applications</td></tr>`;
      return;
    }

    body.innerHTML = filtered.map((a) => {
      const last = lastActivityDate(a);
      const stale = ACTIVE_STAGES.includes(a.current_status) && daysSince(last) > 14;
      return `
        <tr class="table-row border-b border-ink-700/60">
          <td class="py-2 pr-3 font-medium text-ink-50">${a.company}</td>
          <td class="py-2 pr-3 text-ink-200">${a.role}</td>
          <td class="py-2 pr-3 text-ink-300">${a.sector}</td>
          <td class="py-2 pr-3 text-ink-300">${prettySource(a.source)}</td>
          <td class="py-2 pr-3 text-ink-300">${cvLabel(a.cv_version)}</td>
          <td class="py-2 pr-3">${statusBadge(a.current_status)}</td>
          <td class="py-2 pr-3 text-right text-ink-300 tabular-nums">
            ${last}
            ${stale ? `<span class="ml-2 text-warn text-xs" title="No activity in 14+ days">●</span>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  }

  search.addEventListener('input', () => {
    state.search = search.value;
    render();
  });
  status.addEventListener('change', () => {
    state.status = status.value as TableState['status'];
    render();
  });
  sector.addEventListener('change', () => {
    state.sector = sector.value;
    render();
  });
  sort.addEventListener('change', () => {
    state.sort = sort.value as TableState['sort'];
    render();
  });

  render();
}

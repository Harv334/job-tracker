import './style.css';
import { loadData } from './data';
import { computeKpis } from './utils/stats';
import { renderSankey } from './components/sankey';
import { renderKpis } from './components/kpis';
import { renderBreakdownCharts } from './components/charts';
import { renderTable } from './components/table';

const app = document.getElementById('app')!;

function header(): HTMLElement {
  const el = document.createElement('header');
  el.className = 'flex items-end justify-between flex-wrap gap-2 mb-2';
  el.innerHTML = `
    <div>
      <h1 class="text-2xl md:text-3xl font-semibold tracking-tight text-ink-50">Job Tracker</h1>
      <p class="text-sm text-ink-400 mt-1">Live funnel + outcomes for your application pipeline.</p>
    </div>
    <div class="text-right">
      <div class="text-xs text-ink-400">Last updated</div>
      <div class="text-sm text-ink-200 tabular-nums">${new Date().toLocaleString()}</div>
    </div>
  `;
  return el;
}

function section(title: string, subtitle?: string): { card: HTMLElement; body: HTMLElement } {
  const card = document.createElement('section');
  card.className = 'card';
  card.innerHTML = `
    <div class="flex items-baseline justify-between mb-3">
      <h2 class="text-sm font-semibold text-ink-100 uppercase tracking-wider">${title}</h2>
      ${subtitle ? `<span class="text-xs text-ink-400">${subtitle}</span>` : ''}
    </div>
    <div class="section-body"></div>
  `;
  return { card, body: card.querySelector('.section-body') as HTMLElement };
}

async function main() {
  app.innerHTML = '<p class="text-ink-400 text-sm">Loading…</p>';
  const data = await loadData();
  app.innerHTML = '';

  app.appendChild(header());

  const kpiHost = document.createElement('div');
  app.appendChild(kpiHost);
  renderKpis(kpiHost, computeKpis(data.applications));

  const sankey = section(
    'Application funnel',
    `${data.applications.length} applications · stage transitions`
  );
  app.appendChild(sankey.card);
  renderSankey(sankey.body, data.applications);

  const charts = section('Breakdowns');
  app.appendChild(charts.card);
  renderBreakdownCharts(charts.body, data.applications, data.cvs);

  const tableHost = document.createElement('div');
  app.appendChild(tableHost);
  renderTable(tableHost, data.applications, data.cvs);

  // Re-render Sankey on resize so it adapts to viewport.
  window.addEventListener('resize', () => {
    renderSankey(sankey.body, data.applications);
  });
}

main().catch((err) => {
  console.error(err);
  app.innerHTML = `<div class="card text-danger">Failed to load: ${String(err)}</div>`;
});

import './style.css';
import type { CvVersion } from './types';
import { loadAll } from './data';
import { computeKpis } from './utils/stats';
import { renderSankey } from './components/sankey';
import { renderKpis } from './components/kpis';
import { renderBreakdownCharts } from './components/charts';
import { renderSpreadsheet } from './components/spreadsheet';
import { renderCvManager } from './components/cv-manager';
import { renderTabs, type TabsHandle } from './components/tabs';

const app = document.getElementById('app')!;

let state = loadAll();
let tabs: TabsHandle | null = null;

function header(): HTMLElement {
  const el = document.createElement('header');
  el.className = 'flex items-end justify-between flex-wrap gap-3 mb-2';
  el.innerHTML = `
    <div>
      <h1 class="text-2xl md:text-3xl font-semibold tracking-tight text-ink-900">Job Tracker</h1>
      <p class="text-sm text-ink-500 mt-1">
        Track your applications, see your funnel, attribute outcomes to specific CVs.
        Your data lives only in your browser.
      </p>
    </div>
  `;
  return el;
}

function renderSpreadsheetTab(host: HTMLElement) {
  renderSpreadsheet(host, state.applications, state.cvs, {
    onChange: (apps) => {
      state.applications = apps;
      tabs?.refreshBadges();
    },
  });
}

function renderDashboardTab(host: HTMLElement) {
  if (state.applications.length === 0) {
    host.innerHTML = `
      <div class="card text-center py-12">
        <div class="text-ink-700 font-medium">Your dashboard is empty.</div>
        <p class="text-sm text-ink-500 mt-2">
          Head to the Spreadsheet tab and add a few applications, then come back here.
        </p>
      </div>
    `;
    return;
  }

  host.innerHTML = '';
  const kpiHost = document.createElement('div');
  host.appendChild(kpiHost);
  renderKpis(kpiHost, computeKpis(state.applications));

  const sankeyCard = document.createElement('section');
  sankeyCard.className = 'card mt-6';
  sankeyCard.innerHTML = `
    <div class="flex items-baseline justify-between mb-3">
      <h2 class="text-sm font-semibold text-ink-700 uppercase tracking-wider">Application funnel</h2>
      <span class="text-xs text-ink-500">${state.applications.length} applications</span>
    </div>
    <div class="sankey-body"></div>
  `;
  host.appendChild(sankeyCard);
  const sankeyBody = sankeyCard.querySelector('.sankey-body') as HTMLElement;
  renderSankey(sankeyBody, state.applications);

  const breakdownCard = document.createElement('section');
  breakdownCard.className = 'card mt-6';
  breakdownCard.innerHTML = `
    <div class="flex items-baseline justify-between mb-3">
      <h2 class="text-sm font-semibold text-ink-700 uppercase tracking-wider">Breakdowns</h2>
    </div>
    <div class="breakdown-body"></div>
  `;
  host.appendChild(breakdownCard);
  renderBreakdownCharts(
    breakdownCard.querySelector('.breakdown-body') as HTMLElement,
    state.applications,
    state.cvs
  );

  const onResize = () => renderSankey(sankeyBody, state.applications);
  window.addEventListener('resize', onResize);
}

function renderCvsTab(host: HTMLElement) {
  renderCvManager(host, state.cvs, {
    onChange: (cvs: CvVersion[]) => {
      state.cvs = cvs;
      tabs?.refreshBadges();
    },
  });
}

function main() {
  app.innerHTML = '';
  app.appendChild(header());
  const tabHost = document.createElement('div');
  app.appendChild(tabHost);

  tabs = renderTabs(tabHost, [
    {
      id: 'spreadsheet',
      label: 'Spreadsheet',
      badge: () => (state.applications.length > 0 ? String(state.applications.length) : null),
      render: renderSpreadsheetTab,
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      render: renderDashboardTab,
    },
    {
      id: 'cvs',
      label: 'CVs',
      badge: () => (state.cvs.length > 0 ? String(state.cvs.length) : null),
      render: renderCvsTab,
    },
  ]);

  window.addEventListener('storage', () => {
    state = loadAll();
    tabs?.refreshBadges();
  });
}

try {
  main();
} catch (err) {
  console.error(err);
  app.innerHTML = `<div class="card text-danger">Failed to start: ${String(err)}</div>`;
}

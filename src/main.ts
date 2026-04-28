import './style.css';
import type { Application, CvVersion } from './types';
import { ACTIVE_STAGES } from './types';
import { loadAll } from './data';
import { computeKpis } from './utils/stats';
import { renderSankey } from './components/sankey';
import { renderKpis } from './components/kpis';
import { renderBreakdownCharts } from './components/charts';
import { renderSpreadsheet } from './components/spreadsheet';
import { renderKanban } from './components/kanban';
import { renderCvManager } from './components/cv-manager';
import { renderAiInsights } from './components/ai-insights';
import { openAiSettings } from './components/ai-settings';
import { renderTabs, type TabsHandle } from './components/tabs';
import { isConfigured } from './ai/config';

const app = document.getElementById('app')!;

let state = loadAll();
let tabs: TabsHandle | null = null;

function renderHeader(): HTMLElement {
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
    <div class="flex items-center gap-2">
      <button class="btn-secondary text-xs" data-act="ai-settings" title="AI settings (BYOK)">
        <span aria-hidden="true">⚙</span>
        <span>AI ${isConfigured() ? '· on' : '· off'}</span>
      </button>
    </div>
  `;
  el.querySelector('[data-act="ai-settings"]')!.addEventListener('click', () => {
    openAiSettings(() => {
      // Re-render header so the on/off label reflects new state.
      const newHeader = renderHeader();
      el.replaceWith(newHeader);
    });
  });
  return el;
}

function renderFollowUpBanner(host: HTMLElement, apps: Application[]): void {
  const today = new Date().toISOString().slice(0, 10);
  const dueOrOverdue = apps.filter(
    (a) => a.follow_up_date && a.follow_up_date <= today
           && ACTIVE_STAGES.includes(a.current_status)
  );
  if (dueOrOverdue.length === 0) return;
  const banner = document.createElement('div');
  banner.className =
    'mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-2';
  banner.innerHTML = `
    <span aria-hidden="true">⏰</span>
    <span><strong>${dueOrOverdue.length}</strong> application${dueOrOverdue.length === 1 ? '' : 's'} need a follow-up:
      ${dueOrOverdue.slice(0, 3).map((a) => a.company).join(', ')}${dueOrOverdue.length > 3 ? `, +${dueOrOverdue.length - 3} more` : ''}.
    </span>
  `;
  host.appendChild(banner);
}

function renderTwentyAppNudge(host: HTMLElement, total: number): void {
  // Surface a friendly nudge once the user crosses ~20 apps for the first
  // time per session, encouraging them to look at the funnel.
  const dismissed = sessionStorage.getItem('jt:20-nudge') === '1';
  if (total < 20 || dismissed) return;
  const card = document.createElement('div');
  card.className =
    'mb-4 p-3 rounded-lg bg-accent-soft border border-accent/30 text-sm flex items-center justify-between gap-2';
  card.innerHTML = `
    <span class="text-ink-700">
      You've logged <strong>${total} applications</strong> — a good moment to look at your funnel and spot patterns.
    </span>
    <button class="btn-ghost text-xs" data-dismiss>Dismiss</button>
  `;
  card.querySelector('[data-dismiss]')!.addEventListener('click', () => {
    sessionStorage.setItem('jt:20-nudge', '1');
    card.remove();
  });
  host.appendChild(card);
}

function renderSpreadsheetTab(host: HTMLElement) {
  renderSpreadsheet(host, state.applications, state.cvs, {
    onChange: (apps) => {
      state.applications = apps;
      tabs?.refreshBadges();
    },
  });
}

function renderKanbanTab(host: HTMLElement) {
  renderKanban(host, state.applications, {
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
  renderFollowUpBanner(host, state.applications);
  renderTwentyAppNudge(host, state.applications.length);

  const kpiHost = document.createElement('div');
  host.appendChild(kpiHost);
  renderKpis(kpiHost, computeKpis(state.applications));

  const aiHost = document.createElement('div');
  host.appendChild(aiHost);
  renderAiInsights(aiHost, state.applications);

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
  app.appendChild(renderHeader());
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
      id: 'kanban',
      label: 'Kanban',
      render: renderKanbanTab,
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

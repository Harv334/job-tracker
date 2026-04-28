// Kanban board grouped by current_status. Drag-drop a card to change its
// stage. Auto-saves to localStorage via the same callback the spreadsheet uses.

import type { Application, Stage } from '../types';
import { saveApps } from '../data';
import { prettyStage } from '../utils/stats';

interface KanbanCallbacks {
  onChange: (apps: Application[]) => void;
}

const COLUMNS: Stage[] = [
  'applied',
  'phone-screen',
  'hiring-manager',
  'technical',
  'onsite',
  'offer',
  'rejected',
];

const COLUMN_COLORS: Record<string, string> = {
  applied: 'border-amber-300',
  'phone-screen': 'border-violet-300',
  'hiring-manager': 'border-purple-300',
  technical: 'border-fuchsia-300',
  onsite: 'border-pink-300',
  offer: 'border-emerald-300',
  rejected: 'border-red-300',
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
          .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function daysAgo(iso: string | undefined): string {
  if (!iso) return '';
  const days = Math.round((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

function cardHtml(app: Application): string {
  const star = app.interest_rating ? '★'.repeat(app.interest_rating) : '';
  const lastUpdate = app.last_update ?? app.applied_date;
  const stale = (() => {
    const days = Math.round((Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24));
    return days > 14 && !['rejected', 'ghosted', 'accepted', 'withdrawn'].includes(app.current_status);
  })();
  return `
    <div class="kanban-card" draggable="true" data-id="${app.id}">
      <div class="font-medium text-ink-900 text-sm truncate">${escapeAttr(app.company || '(untitled)')}</div>
      <div class="text-xs text-ink-600 truncate mt-0.5">${escapeAttr(app.role ?? '')}</div>
      <div class="flex items-center justify-between mt-2 text-xs text-ink-500">
        <span class="text-amber-500">${star}</span>
        <span class="tabular-nums">${daysAgo(lastUpdate)}${stale ? ' <span class="text-warn">●</span>' : ''}</span>
      </div>
    </div>
  `;
}

export function renderKanban(
  host: HTMLElement,
  apps: Application[],
  cb: KanbanCallbacks
): void {
  let rows: Application[] = [...apps];

  if (rows.length === 0) {
    host.innerHTML = `
      <div class="card text-center py-12 text-ink-500 text-sm">
        Nothing to show yet. Add applications in the Spreadsheet tab — they'll appear here as cards.
      </div>
    `;
    return;
  }

  host.innerHTML = `
    <div class="text-xs text-ink-500 mb-3">
      Drag a card between columns to update its status. Yellow dot = stale (no activity in 14+ days).
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3" id="kanban-grid"></div>
  `;
  const grid = host.querySelector('#kanban-grid') as HTMLElement;

  function renderColumns() {
    grid.innerHTML = COLUMNS.map((stage) => {
      const inCol = rows.filter((a) => a.current_status === stage);
      return `
        <div class="kanban-col" data-stage="${stage}">
          <div class="kanban-col-header border-t-4 ${COLUMN_COLORS[stage] ?? ''}">
            <span class="text-xs font-semibold uppercase tracking-wider text-ink-700">${prettyStage(stage)}</span>
            <span class="text-xs text-ink-500">${inCol.length}</span>
          </div>
          <div class="kanban-col-body">
            ${inCol.map(cardHtml).join('') ||
              '<div class="text-xs text-ink-400 italic px-2 py-3">empty</div>'}
          </div>
        </div>
      `;
    }).join('');
    wireDnd();
  }

  function wireDnd() {
    grid.querySelectorAll('.kanban-card').forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        const id = (card as HTMLElement).dataset.id!;
        (e as DragEvent).dataTransfer?.setData('text/plain', id);
        card.classList.add('opacity-50');
      });
      card.addEventListener('dragend', () => card.classList.remove('opacity-50'));
    });
    grid.querySelectorAll<HTMLElement>('.kanban-col').forEach((col) => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        col.classList.add('ring-2', 'ring-accent');
      });
      col.addEventListener('dragleave', () => {
        col.classList.remove('ring-2', 'ring-accent');
      });
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('ring-2', 'ring-accent');
        const id = (e as DragEvent).dataTransfer?.getData('text/plain');
        const newStage = col.dataset.stage as Stage | undefined;
        if (!id || !newStage) return;
        const app = rows.find((a) => a.id === id);
        if (!app || app.current_status === newStage) return;
        app.current_status = newStage;
        app.last_update = todayIso();
        saveApps(rows);
        cb.onChange(rows);
        renderColumns();
      });
    });
  }

  renderColumns();
}

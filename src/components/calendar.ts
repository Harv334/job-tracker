// Month-grid calendar showing follow-up / interview / decision chips.
// Click a chip to see details + download a single-event .ics file. Bulk
// "Export all" downloads every upcoming event as one .ics.

import type { Application } from '../types';
import { applicationToEvent, downloadIcs, type CalendarEvent } from '../utils/ics';

interface CalendarCallbacks {
  onJumpToApp?: (appId: string) => void;
}

const KIND_CLASS: Record<CalendarEvent['kind'], string> = {
  'follow-up': 'cal-chip-followup',
  interview:   'cal-chip-interview',
  decision:    'cal-chip-decision',
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function ymd(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' : ''}${m}-${day < 10 ? '0' : ''}${day}`;
}
function monthLabel(d: Date): string {
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

export function renderCalendar(
  host: HTMLElement,
  apps: Application[],
  cb: CalendarCallbacks = {}
): void {
  let viewMonth = startOfMonth(new Date());

  function eventsByDate(): Map<string, { ev: CalendarEvent; app: Application }[]> {
    const map = new Map<string, { ev: CalendarEvent; app: Application }[]>();
    for (const app of apps) {
      const ev = applicationToEvent(app);
      if (!ev) continue;
      const arr = map.get(ev.date) ?? [];
      arr.push({ ev, app });
      map.set(ev.date, arr);
    }
    return map;
  }

  function upcomingEvents(): CalendarEvent[] {
    const today = ymd(new Date());
    const all: CalendarEvent[] = [];
    for (const app of apps) {
      const ev = applicationToEvent(app);
      if (ev && ev.date >= today) all.push(ev);
    }
    return all.sort((a, b) => a.date.localeCompare(b.date));
  }

  function renderAll(): void {
    const evMap = eventsByDate();
    const monthStart = viewMonth;
    const firstWeekday = monthStart.getDay();
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const today = ymd(new Date());

    // Build a 6-row grid that always covers any month layout.
    const cells: { date: string | null; dayNum: number | null }[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push({ date: null, dayNum: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = ymd(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
      cells.push({ date, dayNum: d });
    }
    while (cells.length < 42) cells.push({ date: null, dayNum: null });

    const upcoming = upcomingEvents();

    host.innerHTML = `
      <div class="card">
        <div class="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div class="flex items-center gap-2">
            <button class="btn-ghost text-lg px-2" data-act="prev" title="Previous month">‹</button>
            <h2 class="text-lg font-semibold text-ink-900 min-w-[10rem] text-center">${monthLabel(viewMonth)}</h2>
            <button class="btn-ghost text-lg px-2" data-act="next" title="Next month">›</button>
            <button class="btn-secondary text-xs ml-2" data-act="today">Today</button>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-ink-500">${upcoming.length} upcoming</span>
            <button class="btn-secondary" data-act="export-all">Export all to calendar (.ics)</button>
          </div>
        </div>

        <div class="grid grid-cols-7 gap-px bg-ink-200 border border-ink-200 rounded-lg overflow-hidden">
          ${DAY_LABELS.map((d) => `<div class="bg-ink-100 text-xs uppercase tracking-wider text-ink-500 font-semibold px-2 py-1.5 text-center">${d}</div>`).join('')}
          ${cells.map((c) => {
            if (!c.date) return `<div class="bg-ink-50 min-h-[88px]"></div>`;
            const events = evMap.get(c.date) ?? [];
            const isToday = c.date === today;
            const isPast = c.date < today;
            return `
              <div class="bg-white min-h-[88px] p-1.5 ${isPast ? 'opacity-70' : ''} ${isToday ? 'ring-2 ring-accent ring-inset' : ''}">
                <div class="text-xs ${isToday ? 'font-bold text-accent' : 'text-ink-500'} mb-1">${c.dayNum}</div>
                <div class="flex flex-col gap-0.5">
                  ${events.slice(0, 3).map(({ ev, app }) => `
                    <button class="cal-chip ${KIND_CLASS[ev.kind]}" data-app-id="${app.id}" title="${escapeAttr(ev.summary)}${app.notes ? ` — ${escapeAttr(app.notes)}` : ''}">
                      ${escapeAttr(ev.summary)}
                    </button>
                  `).join('')}
                  ${events.length > 3 ? `<span class="text-xs text-ink-400 px-1">+${events.length - 3} more</span>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="flex items-center gap-4 mt-3 text-xs text-ink-500">
          <span class="inline-flex items-center gap-1.5"><span class="cal-swatch cal-chip-followup"></span> Follow-up</span>
          <span class="inline-flex items-center gap-1.5"><span class="cal-swatch cal-chip-interview"></span> Interview</span>
          <span class="inline-flex items-center gap-1.5"><span class="cal-swatch cal-chip-decision"></span> Decision</span>
        </div>
      </div>

      <div class="card mt-4">
        <h3 class="text-sm font-semibold uppercase tracking-wider text-ink-700 mb-3">Upcoming events</h3>
        ${upcoming.length === 0
          ? '<p class="text-sm text-ink-500">No upcoming events. Add a follow-up date to any application in the Spreadsheet tab.</p>'
          : `<ul class="divide-y divide-ink-200">
              ${upcoming.slice(0, 20).map((ev) => `
                <li class="py-2 flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <span class="cal-swatch ${KIND_CLASS[ev.kind]}"></span>
                    <span class="text-sm font-medium text-ink-900 truncate">${escapeAttr(ev.summary)}</span>
                    <span class="text-xs text-ink-500 tabular-nums">${ev.date}</span>
                  </div>
                  <button class="btn-ghost text-xs" data-export-uid="${ev.uid}">Add to calendar</button>
                </li>
              `).join('')}
            </ul>`
        }
      </div>
    `;

    host.querySelector('[data-act="prev"]')!.addEventListener('click', () => {
      viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
      renderAll();
    });
    host.querySelector('[data-act="next"]')!.addEventListener('click', () => {
      viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
      renderAll();
    });
    host.querySelector('[data-act="today"]')!.addEventListener('click', () => {
      viewMonth = startOfMonth(new Date());
      renderAll();
    });
    host.querySelector('[data-act="export-all"]')!.addEventListener('click', () => {
      downloadIcs(upcoming, `job-tracker-events-${ymd(new Date())}.ics`);
    });

    // Per-row "Add to calendar" — single-event .ics
    host.querySelectorAll<HTMLElement>('[data-export-uid]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = btn.getAttribute('data-export-uid')!;
        const single = upcoming.find((e) => e.uid === uid);
        if (single) downloadIcs([single], `${slugify(single.summary)}.ics`);
      });
    });

    // Click chip → jump to spreadsheet (if callback provided) or just show details
    host.querySelectorAll<HTMLElement>('[data-app-id]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const id = chip.getAttribute('data-app-id')!;
        if (cb.onJumpToApp) cb.onJumpToApp(id);
      });
    });
  }

  renderAll();
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
          .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

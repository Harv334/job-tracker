// Excel-style editable table. Inline inputs, native browser navigation
// (Tab moves cell-by-cell, arrow keys work in inputs). Auto-saves on blur.

import {
  type Application,
  type CvVersion,
  type Stage,
  type Source,
  STAGES,
  SOURCES,
} from '../types';
import { prettyStage, prettySource } from '../utils/stats';
import { exportCsv, importCsv, downloadFile } from '../utils/csv';
import { saveApps, loadSampleIntoStorage } from '../data';

interface SpreadsheetCallbacks {
  onChange: (apps: Application[]) => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function rid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function blankApp(): Application {
  return {
    id: rid(),
    company: '',
    applied_date: todayIso(),
    current_status: 'applied',
  };
}

export function renderSpreadsheet(
  host: HTMLElement,
  apps: Application[],
  cvs: CvVersion[],
  cb: SpreadsheetCallbacks
): void {
  let rows: Application[] = apps.length > 0 ? [...apps] : [blankApp()];

  host.innerHTML = '';

  // ----- Toolbar -------------------------------------------------------
  const toolbar = document.createElement('div');
  toolbar.className = 'flex flex-wrap items-center justify-between gap-3 mb-4';
  toolbar.innerHTML = `
    <div class="flex items-center gap-2">
      <button class="btn-secondary" data-act="add">+ Add row</button>
      <button class="btn-secondary" data-act="import">Import CSV</button>
      <button class="btn-secondary" data-act="export">Export CSV</button>
      <input type="file" accept=".csv,text/csv" class="hidden" data-act="file" />
    </div>
    <div class="flex items-center gap-2">
      <span id="ss-count" class="text-sm text-ink-500"></span>
      ${
        apps.length === 0
          ? `<button class="btn-ghost" data-act="sample">Load sample data</button>`
          : `<button class="btn-ghost" data-act="clear">Clear all</button>`
      }
    </div>
  `;
  host.appendChild(toolbar);

  const empty = document.createElement('div');
  empty.className = 'card text-center py-12 hidden';
  empty.innerHTML = `
    <div class="text-ink-500 text-sm">
      Your tracker is empty. Add your first application above, or load some
      sample data to see what the dashboard looks like.
    </div>
  `;
  host.appendChild(empty);

  // ----- Table ---------------------------------------------------------
  const tableWrap = document.createElement('div');
  tableWrap.className = 'card overflow-x-auto p-0';
  tableWrap.innerHTML = `
    <table class="ss-table">
      <thead>
        <tr>
          <th class="row-num">#</th>
          <th>Date applied</th>
          <th>Company</th>
          <th>Role</th>
          <th>Sector</th>
          <th>Source</th>
          <th>CV</th>
          <th>Status</th>
          <th>Last update</th>
          <th>Salary min</th>
          <th>Salary max</th>
          <th>Notes</th>
          <th class="col-actions"></th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;
  host.appendChild(tableWrap);

  const tbody = tableWrap.querySelector('tbody') as HTMLTableSectionElement;
  const countEl = toolbar.querySelector('#ss-count') as HTMLElement;
  const fileInput = toolbar.querySelector('[data-act="file"]') as HTMLInputElement;

  // ----- Render --------------------------------------------------------
  function commit(): void {
    saveApps(rows);
    cb.onChange(rows);
    countEl.textContent = `${rows.length} application${rows.length === 1 ? '' : 's'}`;
    empty.classList.toggle('hidden', rows.length > 0);
  }

  function rowHtml(app: Application, idx: number): string {
    const cvOptions = ['<option value="">—</option>']
      .concat(cvs.map((c) => `<option value="${c.id}">${escapeAttr(c.label)}</option>`))
      .join('');
    const stageOptions = STAGES
      .map((s) => `<option value="${s}">${prettyStage(s)}</option>`)
      .join('');
    const sourceOptions = ['<option value="">—</option>']
      .concat(SOURCES.map((s) => `<option value="${s}">${prettySource(s)}</option>`))
      .join('');

    return `
      <tr data-id="${app.id}">
        <td class="row-num">${idx + 1}</td>
        <td><input type="date" data-field="applied_date" value="${escapeAttr(app.applied_date)}" /></td>
        <td><input type="text" data-field="company" value="${escapeAttr(app.company)}" placeholder="Acme Corp" /></td>
        <td><input type="text" data-field="role" value="${escapeAttr(app.role ?? '')}" placeholder="Senior PM" /></td>
        <td><input type="text" data-field="sector" value="${escapeAttr(app.sector ?? '')}" placeholder="fintech" /></td>
        <td><select data-field="source">${sourceOptions}</select></td>
        <td><select data-field="cv_version">${cvOptions}</select></td>
        <td><select data-field="current_status">${stageOptions}</select></td>
        <td><input type="date" data-field="last_update" value="${escapeAttr(app.last_update ?? '')}" /></td>
        <td><input type="number" data-field="salary_min" value="${app.salary_min ?? ''}" placeholder="—" /></td>
        <td><input type="number" data-field="salary_max" value="${app.salary_max ?? ''}" placeholder="—" /></td>
        <td><input type="text" data-field="notes" value="${escapeAttr(app.notes ?? '')}" placeholder="—" /></td>
        <td class="col-actions">
          <button class="btn-ghost text-xs px-2" data-act="del" title="Delete row">✕</button>
        </td>
      </tr>
    `;
  }

  function renderAll(): void {
    tbody.innerHTML = rows.map(rowHtml).join('');
    // Set the value on each select after the row is in the DOM (selects'
    // selected option is hard to set via attribute alone for unknown values).
    for (const tr of Array.from(tbody.querySelectorAll('tr'))) {
      const id = tr.getAttribute('data-id')!;
      const app = rows.find((a) => a.id === id);
      if (!app) continue;
      const setSel = (field: string, val: string) => {
        const sel = tr.querySelector(`[data-field="${field}"]`) as HTMLSelectElement;
        if (sel) sel.value = val;
      };
      setSel('current_status', app.current_status);
      setSel('source', app.source ?? '');
      setSel('cv_version', app.cv_version ?? '');
    }
    commit();
  }

  // ----- Cell editing --------------------------------------------------
  tbody.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    const tr = target.closest('tr') as HTMLTableRowElement | null;
    if (!tr) return;
    const id = tr.getAttribute('data-id')!;
    const app = rows.find((a) => a.id === id);
    if (!app) return;

    const field = target.getAttribute('data-field') as keyof Application | null;
    if (!field) return;
    const value = target.value;

    switch (field) {
      case 'applied_date':
        app.applied_date = value || todayIso();
        break;
      case 'company':
        app.company = value;
        break;
      case 'role':
        app.role = value || undefined;
        break;
      case 'sector':
        app.sector = value || undefined;
        break;
      case 'source':
        app.source = (value as Source) || undefined;
        break;
      case 'cv_version':
        app.cv_version = value || undefined;
        break;
      case 'current_status': {
        const next = value as Stage;
        if (next !== app.current_status) app.last_update = todayIso();
        app.current_status = next;
        const lastInput = tr.querySelector('[data-field="last_update"]') as HTMLInputElement | null;
        if (lastInput && app.last_update) lastInput.value = app.last_update;
        break;
      }
      case 'last_update':
        app.last_update = value || undefined;
        break;
      case 'salary_min': {
        const n = Number(value);
        app.salary_min = Number.isFinite(n) && value !== '' ? n : undefined;
        break;
      }
      case 'salary_max': {
        const n = Number(value);
        app.salary_max = Number.isFinite(n) && value !== '' ? n : undefined;
        break;
      }
      case 'notes':
        app.notes = value || undefined;
        break;
    }
    commit();
  });

  tbody.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-act="del"]') as HTMLElement | null;
    if (!btn) return;
    const tr = btn.closest('tr') as HTMLTableRowElement;
    const id = tr.getAttribute('data-id')!;
    rows = rows.filter((r) => r.id !== id);
    if (rows.length === 0) rows.push(blankApp());
    renderAll();
  });

  // ----- Toolbar wiring ------------------------------------------------
  toolbar.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button[data-act]') as HTMLButtonElement | null;
    if (!btn) return;
    const act = btn.dataset.act;
    switch (act) {
      case 'add': {
        rows.push(blankApp());
        renderAll();
        break;
      }
      case 'import': {
        fileInput.click();
        break;
      }
      case 'export': {
        const csv = exportCsv(rows.filter((r) => r.company));
        const stamp = todayIso();
        downloadFile(`job-applications-${stamp}.csv`, csv);
        break;
      }
      case 'sample': {
        const data = loadSampleIntoStorage();
        rows = [...data.applications];
        // Re-render the toolbar to swap "Load sample" → "Clear all"
        host.innerHTML = '';
        renderSpreadsheet(host, rows, data.cvs, cb);
        break;
      }
      case 'clear': {
        if (confirm('Delete all applications? This can\'t be undone (export to CSV first if you want a backup).')) {
          rows = [blankApp()];
          host.innerHTML = '';
          renderSpreadsheet(host, [], cvs, cb);
        }
        break;
      }
    }
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const result = importCsv(text);
      if (result.warnings.length > 0) {
        alert('Imported with warnings:\n\n' + result.warnings.join('\n'));
      }
      const merge = confirm(
        `Import ${result.applications.length} rows?\n\n` +
        `OK = REPLACE current data.\nCancel = APPEND to current data.`
      );
      if (merge) {
        rows = result.applications;
      } else {
        // Append to existing (filtering out the empty placeholder row, if any).
        rows = [...rows.filter((r) => r.company), ...result.applications];
      }
      if (rows.length === 0) rows.push(blankApp());
      host.innerHTML = '';
      renderSpreadsheet(host, rows, cvs, cb);
    };
    reader.readAsText(file);
    fileInput.value = '';
  });

  renderAll();
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

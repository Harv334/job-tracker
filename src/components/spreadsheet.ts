import {
  type Application,
  type CvVersion,
  type Stage,
  type Source,
  type Relationship,
  STAGES,
  SOURCES,
  RELATIONSHIPS,
} from '../types';
import { prettyStage, prettySource } from '../utils/stats';
import { exportCsv, importCsv, downloadFile } from '../utils/csv';
import { saveApps, loadSampleIntoStorage } from '../data';
import { openJdExtractModal } from './ai-jd-modal';
import { openSmartImportModal } from './smart-import-modal';
import { mergeExtracted } from '../ai/extract';

interface SpreadsheetCallbacks {
  onChange: (apps: Application[]) => void;
}

function todayIso(): string { return new Date().toISOString().slice(0, 10); }
function rid(): string { return Math.random().toString(36).slice(2, 10); }

function blankApp(): Application {
  return { id: rid(), company: '', applied_date: todayIso(), current_status: 'applied' };
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
          .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderSpreadsheet(
  host: HTMLElement,
  apps: Application[],
  cvs: CvVersion[],
  cb: SpreadsheetCallbacks
): void {
  let rows: Application[] = apps.length > 0 ? [...apps] : [blankApp()];

  host.innerHTML = '';

  const toolbar = document.createElement('div');
  toolbar.className = 'flex flex-wrap items-center justify-between gap-3 mb-4';
  toolbar.innerHTML = `
    <div class="flex items-center gap-2 flex-wrap">
      <button class="btn-secondary" data-act="add">+ Add row</button>
      <button class="btn-secondary" data-act="add-from-jd" title="Paste a JD, AI fills the row">+ Add from JD</button>
      <button class="btn-secondary" data-act="import" title="Auto-detect columns from any tracker">Smart import</button>
      <button class="btn-primary" data-act="export" title="Download a polished CSV">⬇ Export CSV</button>
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
      Your tracker is empty. Add your first application above, or load some sample data.
    </div>
  `;
  host.appendChild(empty);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'card overflow-x-auto p-0';
  tableWrap.innerHTML = `
    <table class="ss-table">
      <thead>
        <tr>
          <th class="row-num">#</th>
          <th>Date</th>
          <th>Company</th>
          <th>Role</th>
          <th>Sector</th>
          <th>Source</th>
          <th>CV</th>
          <th>Status</th>
          <th>Interest</th>
          <th>Contact</th>
          <th>Rel.</th>
          <th>Follow-up</th>
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

  function commit(): void {
    saveApps(rows);
    cb.onChange(rows);
    countEl.textContent = `${rows.length} application${rows.length === 1 ? '' : 's'}`;
    empty.classList.toggle('hidden', rows.length > 0);
  }

  function starHtml(rating: number | undefined): string {
    const r = rating ?? 0;
    let html = '<span class="stars" data-field="interest_rating">';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="star ${i <= r ? 'on' : ''}" data-star="${i}">★</span>`;
    }
    html += '</span>';
    return html;
  }

  function rowHtml(app: Application, idx: number): string {
    const cvOptions = ['<option value="">—</option>']
      .concat(cvs.map((c) => `<option value="${c.id}">${escapeAttr(c.label)}</option>`))
      .join('');
    const stageOptions = STAGES.map((s) => `<option value="${s}">${prettyStage(s)}</option>`).join('');
    const sourceOptions = ['<option value="">—</option>']
      .concat(SOURCES.map((s) => `<option value="${s}">${prettySource(s)}</option>`)).join('');
    const relOptions = ['<option value="">—</option>']
      .concat(RELATIONSHIPS.map((r) => `<option value="${r}">${prettySource(r)}</option>`)).join('');

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
        <td>${starHtml(app.interest_rating)}</td>
        <td><input type="text" data-field="contact_name" value="${escapeAttr(app.contact_name ?? '')}" placeholder="Jane D." /></td>
        <td><select data-field="contact_relationship">${relOptions}</select></td>
        <td><input type="date" data-field="follow_up_date" value="${escapeAttr(app.follow_up_date ?? '')}" /></td>
        <td><input type="date" data-field="last_update" value="${escapeAttr(app.last_update ?? '')}" /></td>
        <td><input type="number" data-field="salary_min" value="${app.salary_min ?? ''}" placeholder="£" /></td>
        <td><input type="number" data-field="salary_max" value="${app.salary_max ?? ''}" placeholder="£" /></td>
        <td><input type="text" data-field="notes" value="${escapeAttr(app.notes ?? '')}" placeholder="—" /></td>
        <td class="col-actions">
          <button class="btn-ghost text-xs px-2" data-act="del" title="Delete row">×</button>
        </td>
      </tr>
    `;
  }

  function renderAll(): void {
    tbody.innerHTML = rows.map(rowHtml).join('');
    for (const tr of Array.from(tbody.querySelectorAll('tr'))) {
      const id = tr.getAttribute('data-id')!;
      const app = rows.find((a) => a.id === id);
      if (!app) continue;
      const setSel = (field: string, val: string) => {
        const sel = tr.querySelector(`[data-field="${field}"]`) as HTMLSelectElement | null;
        if (sel) sel.value = val;
      };
      setSel('current_status', app.current_status);
      setSel('source', app.source ?? '');
      setSel('cv_version', app.cv_version ?? '');
      setSel('contact_relationship', app.contact_relationship ?? '');
    }
    commit();
  }

  // Cell editing
  tbody.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    const tr = target.closest('tr') as HTMLTableRowElement | null;
    if (!tr) return;
    const id = tr.getAttribute('data-id')!;
    const app = rows.find((a) => a.id === id);
    if (!app) return;
    const field = target.getAttribute('data-field') as string | null;
    if (!field) return;
    const v = target.value;
    switch (field) {
      case 'applied_date': app.applied_date = v || todayIso(); break;
      case 'company':      app.company = v; break;
      case 'role':         app.role = v || undefined; break;
      case 'sector':       app.sector = v || undefined; break;
      case 'source':       app.source = (v as Source) || undefined; break;
      case 'cv_version':   app.cv_version = v || undefined; break;
      case 'current_status': {
        const next = v as Stage;
        if (next !== app.current_status) app.last_update = todayIso();
        app.current_status = next;
        const lu = tr.querySelector('[data-field="last_update"]') as HTMLInputElement | null;
        if (lu && app.last_update) lu.value = app.last_update;
        break;
      }
      case 'contact_name':         app.contact_name = v || undefined; break;
      case 'contact_relationship': app.contact_relationship = (v as Relationship) || undefined; break;
      case 'follow_up_date':       app.follow_up_date = v || undefined; break;
      case 'last_update':          app.last_update = v || undefined; break;
      case 'salary_min': {
        const n = Number(v);
        app.salary_min = Number.isFinite(n) && v !== '' ? n : undefined;
        break;
      }
      case 'salary_max': {
        const n = Number(v);
        app.salary_max = Number.isFinite(n) && v !== '' ? n : undefined;
        break;
      }
      case 'notes': app.notes = v || undefined; break;
    }
    commit();
  });

  // Star rating clicks
  tbody.addEventListener('click', (e) => {
    const star = (e.target as HTMLElement).closest('[data-star]') as HTMLElement | null;
    if (star) {
      const tr = star.closest('tr') as HTMLTableRowElement;
      const id = tr.getAttribute('data-id')!;
      const app = rows.find((a) => a.id === id);
      if (!app) return;
      const n = Number(star.getAttribute('data-star'));
      app.interest_rating = app.interest_rating === n ? undefined : n;
      // Update visuals
      const stars = star.parentElement!.querySelectorAll<HTMLElement>('.star');
      const r = app.interest_rating ?? 0;
      stars.forEach((s, i) => s.classList.toggle('on', i + 1 <= r));
      commit();
      return;
    }
    const del = (e.target as HTMLElement).closest('[data-act="del"]') as HTMLElement | null;
    if (del) {
      const tr = del.closest('tr') as HTMLTableRowElement;
      const id = tr.getAttribute('data-id')!;
      rows = rows.filter((r) => r.id !== id);
      if (rows.length === 0) rows.push(blankApp());
      renderAll();
    }
  });

  // Toolbar
  toolbar.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest('button[data-act]') as HTMLButtonElement | null;
    if (!btn) return;
    const act = btn.dataset.act;
    switch (act) {
      case 'add':
        rows.push(blankApp());
        renderAll();
        break;
      case 'add-from-jd':
        openJdExtractModal((extracted) => {
          const app = mergeExtracted(blankApp(), extracted);
          rows.push(app);
          renderAll();
        });
        break;
      case 'import':
        openSmartImportModal({
          onImport: (apps, replace) => {
            rows = replace ? apps : [...rows.filter((r) => r.company), ...apps];
            if (rows.length === 0) rows.push(blankApp());
            host.innerHTML = '';
            renderSpreadsheet(host, rows, cvs, cb);
          },
        });
        break;
      case 'export': {
        const csv = exportCsv(rows.filter((r) => r.company), cvs);
        downloadFile(`job-applications-${todayIso()}.csv`, csv);
        break;
      }
      case 'sample': {
        const data = loadSampleIntoStorage();
        rows = [...data.applications];
        host.innerHTML = '';
        renderSpreadsheet(host, rows, data.cvs, cb);
        break;
      }
      case 'clear':
        if (confirm("Delete all applications? This can't be undone.")) {
          rows = [blankApp()];
          host.innerHTML = '';
          renderSpreadsheet(host, [], cvs, cb);
        }
        break;
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
      const replace = confirm(
        `Import ${result.applications.length} rows?\n\n` +
        `OK = REPLACE current data.\nCancel = APPEND to current data.`
      );
      rows = replace
        ? result.applications
        : [...rows.filter((r) => r.company), ...result.applications];
      if (rows.length === 0) rows.push(blankApp());
      host.innerHTML = '';
      renderSpreadsheet(host, rows, cvs, cb);
    };
    reader.readAsText(file);
    fileInput.value = '';
  });

  renderAll();
}

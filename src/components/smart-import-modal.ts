// Smart Import modal: drop-or-paste a foreign tracker, review the
// auto-detected column mapping, optionally have AI refine it, then commit.

import type { Application } from '../types';
import {
  detectColumnMapping,
  applyMapping,
  CANONICAL_FIELDS,
  type CanonicalField,
} from '../utils/import-detect';
import { isConfigured } from '../ai/config';
import { aiSuggestMapping } from '../ai/import-mapper';

interface SmartImportCallbacks {
  onImport: (apps: Application[], replace: boolean) => void;
}

// Same RFC-4180-ish parser as utils/csv.ts. Also handles tab-separated
// (which is what you get when pasting from Excel/Google Sheets).
function parseDelimited(text: string): string[][] {
  // Heuristic: count tabs vs commas in the header line; whichever wins is
  // the delimiter. Falls back to comma.
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const delim = tabCount > commaCount ? '\t' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let i = 0;
  let inQuotes = false;
  const len = text.length;
  while (i < len) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cell += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === delim) { row.push(cell); cell = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { row.push(cell); cell = ''; rows.push(row); row = []; i++; continue; }
    cell += ch; i++;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.length > 0));
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
          .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function openSmartImportModal(cb: SmartImportCallbacks): void {
  const overlay = document.createElement('div');
  overlay.className =
    'fixed inset-0 bg-ink-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4';
  overlay.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-3xl p-6 border border-ink-200 max-h-[90vh] overflow-y-auto" role="dialog">
      <div class="flex items-start justify-between mb-3">
        <div>
          <h3 class="text-lg font-semibold text-ink-900">Smart import</h3>
          <p class="text-sm text-ink-500 mt-1">
            Drop a CSV or paste from Excel / Google Sheets. We'll auto-detect column
            mappings and let you review before import.
          </p>
        </div>
        <button class="btn-ghost text-xl" data-act="close" aria-label="Close">×</button>
      </div>

      <div data-step="1">
        <div class="space-y-3">
          <div class="border-2 border-dashed border-ink-300 rounded-lg p-6 text-center bg-ink-100/40"
               id="dropzone">
            <p class="text-sm text-ink-500 mb-2">Drop a CSV file here</p>
            <input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values"
                   class="hidden" id="filepick" />
            <button class="btn-secondary" data-act="pick-file">Choose file…</button>
          </div>
          <div class="text-center text-xs text-ink-500">— or paste below —</div>
          <textarea id="paste-area" class="input w-full h-40 font-mono text-xs"
                    placeholder="Paste rows from Excel / Google Sheets / CSV..."></textarea>
          <div class="flex justify-end gap-2">
            <button class="btn-secondary" data-act="cancel">Cancel</button>
            <button class="btn-primary" data-act="parse">Parse</button>
          </div>
        </div>
      </div>

      <div data-step="2" class="hidden">
        <div class="text-sm text-ink-500 mb-3" id="step2-desc"></div>
        <div class="border border-ink-200 rounded-lg overflow-hidden mb-3">
          <table class="w-full text-sm">
            <thead class="bg-ink-100 text-xs uppercase tracking-wider text-ink-500">
              <tr>
                <th class="text-left px-3 py-2">Source column</th>
                <th class="text-left px-3 py-2">Sample value</th>
                <th class="text-left px-3 py-2">→ Map to</th>
              </tr>
            </thead>
            <tbody id="mapping-rows"></tbody>
          </table>
        </div>

        <div class="flex items-center justify-between mb-3">
          <button class="btn-secondary" data-act="ai-refine">
            ${isConfigured() ? 'Refine with AI' : 'Set up AI to refine'}
          </button>
          <span class="text-xs text-ink-500" id="ai-status"></span>
        </div>

        <div id="warnings" class="text-xs text-amber-700 mb-3"></div>

        <h4 class="text-xs uppercase tracking-wider text-ink-500 mb-2">Preview (first 3 rows)</h4>
        <div class="border border-ink-200 rounded-lg overflow-x-auto mb-4 max-h-48">
          <table class="w-full text-xs" id="preview-table"></table>
        </div>

        <div class="flex items-center justify-end gap-2">
          <button class="btn-secondary" data-act="back">Back</button>
          <button class="btn-secondary" data-act="import-append">Append</button>
          <button class="btn-primary" data-act="import-replace">Replace all</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  let parsedHeaders: string[] = [];
  let parsedRows: string[][] = [];
  let mapping: Map<string, CanonicalField | null> = new Map();

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-act="close"]')!.addEventListener('click', close);
  overlay.querySelector('[data-act="cancel"]')!.addEventListener('click', close);

  const step1 = overlay.querySelector('[data-step="1"]') as HTMLElement;
  const step2 = overlay.querySelector('[data-step="2"]') as HTMLElement;
  const fileInput = overlay.querySelector('#filepick') as HTMLInputElement;
  const pasteArea = overlay.querySelector('#paste-area') as HTMLTextAreaElement;

  overlay.querySelector('[data-act="pick-file"]')!.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      pasteArea.value = String(reader.result ?? '');
    };
    reader.readAsText(file);
  });

  // Drag-drop wiring
  const dropzone = overlay.querySelector('#dropzone') as HTMLElement;
  ['dragover', 'dragenter'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('border-accent', 'bg-accent-soft');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    dropzone.addEventListener(evt, () => dropzone.classList.remove('border-accent', 'bg-accent-soft'));
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = (e as DragEvent).dataTransfer?.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { pasteArea.value = String(reader.result ?? ''); };
    reader.readAsText(f);
  });

  overlay.querySelector('[data-act="parse"]')!.addEventListener('click', () => {
    const text = pasteArea.value;
    if (!text.trim()) {
      alert('Drop a file or paste some rows first.');
      return;
    }
    const rows = parseDelimited(text);
    if (rows.length < 2) {
      alert('Need at least a header row and one data row.');
      return;
    }
    parsedHeaders = rows[0];
    parsedRows = rows.slice(1);
    mapping = detectColumnMapping(parsedHeaders);
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
    renderStep2();
  });

  overlay.querySelector('[data-act="back"]')!.addEventListener('click', () => {
    step2.classList.add('hidden');
    step1.classList.remove('hidden');
  });

  function renderStep2(): void {
    const desc = overlay.querySelector('#step2-desc') as HTMLElement;
    desc.textContent =
      `Detected ${parsedHeaders.length} columns and ${parsedRows.length} rows. ` +
      `Review the mappings below and adjust any that look wrong, then import.`;

    const mapBody = overlay.querySelector('#mapping-rows') as HTMLElement;
    mapBody.innerHTML = parsedHeaders.map((h, i) => {
      const sample = parsedRows[0]?.[i] ?? '';
      const sample2 = parsedRows[1]?.[i] ?? '';
      const sampleStr = (sample || sample2 || '').slice(0, 40);
      const cur = mapping.get(h) ?? '';
      const opts = ['<option value="">— ignore —</option>']
        .concat(CANONICAL_FIELDS.map((f) => `<option value="${f}" ${f === cur ? 'selected' : ''}>${f}</option>`))
        .join('');
      return `
        <tr class="border-t border-ink-200">
          <td class="px-3 py-1.5 text-ink-900 font-medium">${escapeAttr(h)}</td>
          <td class="px-3 py-1.5 text-ink-500 truncate max-w-xs">${escapeAttr(sampleStr)}</td>
          <td class="px-3 py-1.5"><select class="input" data-hdr="${escapeAttr(h)}">${opts}</select></td>
        </tr>
      `;
    }).join('');

    mapBody.querySelectorAll<HTMLSelectElement>('select[data-hdr]').forEach((sel) => {
      sel.addEventListener('change', () => {
        const hdr = sel.getAttribute('data-hdr')!;
        const value = sel.value;
        // Enforce: each canonical field used at most once. If the user picks
        // a field already used, clear the previous owner.
        if (value) {
          for (const [otherHdr, otherField] of mapping) {
            if (otherHdr !== hdr && otherField === value) {
              mapping.set(otherHdr, null);
            }
          }
        }
        mapping.set(hdr, value ? (value as CanonicalField) : null);
        renderStep2();  // re-render to reflect cleared duplicates
      });
    });

    renderPreview();
  }

  function renderPreview(): void {
    const previewTable = overlay.querySelector('#preview-table') as HTMLElement;
    const result = applyMapping(parsedHeaders, parsedRows.slice(0, 3), { mapping });
    const warningsBox = overlay.querySelector('#warnings') as HTMLElement;
    warningsBox.innerHTML = result.warnings.map((w) => `• ${escapeAttr(w)}`).join('<br>');

    if (result.applications.length === 0) {
      previewTable.innerHTML = '<tbody><tr><td class="p-3 text-ink-500">No rows would import (missing company column or all rows blank).</td></tr></tbody>';
      return;
    }
    const fields = ['applied_date', 'company', 'role', 'sector', 'source', 'current_status'] as const;
    previewTable.innerHTML = `
      <thead class="bg-ink-100 text-ink-500 uppercase tracking-wider">
        <tr>${fields.map((f) => `<th class="text-left px-2 py-1">${f}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${result.applications.map((a) => `
          <tr class="border-t border-ink-200">
            ${fields.map((f) => `<td class="px-2 py-1 text-ink-700">${escapeAttr(String((a as unknown as Record<string,unknown>)[f] ?? ''))}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    `;
  }

  // AI refine
  overlay.querySelector('[data-act="ai-refine"]')!.addEventListener('click', async () => {
    if (!isConfigured()) {
      const { openAiSettings } = await import('./ai-settings');
      openAiSettings();
      return;
    }
    const status = overlay.querySelector('#ai-status') as HTMLElement;
    status.textContent = 'Asking Claude...';
    try {
      const aiMap = await aiSuggestMapping(parsedHeaders, parsedRows.slice(0, 3));
      mapping = aiMap;
      status.textContent = 'Refined.';
      renderStep2();
    } catch (err) {
      status.innerHTML = `<span class="text-danger">Failed: ${escapeAttr((err as Error).message)}</span>`;
    }
  });

  // Final import
  function commitImport(replace: boolean): void {
    const result = applyMapping(parsedHeaders, parsedRows, { mapping });
    if (result.applications.length === 0) {
      alert('Nothing to import — check the column mappings.');
      return;
    }
    cb.onImport(result.applications, replace);
    close();
  }
  overlay.querySelector('[data-act="import-replace"]')!.addEventListener('click', () => commitImport(true));
  overlay.querySelector('[data-act="import-append"]')!.addEventListener('click', () => commitImport(false));
}

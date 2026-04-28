// Upload, list, download, delete CVs. Files live in IndexedDB, metadata in
// localStorage. The two are kept in sync by ID.

import type { CvVersion } from '../types';
import { saveCvs } from '../data';
import { putCvFile, getCvFile, deleteCvFile, listCvFiles } from '../storage/cv-store';

interface CvManagerCallbacks {
  onChange: (cvs: CvVersion[]) => void;
}

function rid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtSize(bytes: number | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function renderCvManager(
  host: HTMLElement,
  cvs: CvVersion[],
  cb: CvManagerCallbacks
): void {
  let versions = [...cvs];

  host.innerHTML = `
    <div class="card">
      <div class="flex items-end justify-between gap-3 mb-2 flex-wrap">
        <div>
          <h2 class="text-lg font-semibold text-ink-900">CV versions</h2>
          <p class="text-sm text-ink-500 mt-1">
            Upload your CVs (PDF or DOCX). Each version gets a label you can pick from
            the CV column in the spreadsheet, so you can later see which version
            converts best.
          </p>
        </div>
        <div class="flex gap-2">
          <button class="btn-secondary" data-act="add-meta">+ Add label only</button>
          <button class="btn-primary" data-act="upload">+ Upload CV file</button>
          <input type="file" accept=".pdf,.docx,.doc" class="hidden" data-act="file" />
        </div>
      </div>
      <div class="text-xs text-ink-400 mb-4">
        Files are stored in your browser's IndexedDB. They never leave your device.
      </div>
      <div id="cv-list"></div>
    </div>
  `;

  const list = host.querySelector('#cv-list') as HTMLElement;
  const fileInput = host.querySelector('[data-act="file"]') as HTMLInputElement;

  function commit(): void {
    saveCvs(versions);
    cb.onChange(versions);
    renderList();
  }

  function renderList(): void {
    if (versions.length === 0) {
      list.innerHTML = `
        <div class="text-center py-8 text-sm text-ink-500 border border-dashed border-ink-300 rounded-lg">
          No CV versions yet. Add one above.
        </div>
      `;
      return;
    }
    list.innerHTML = `
      <div class="grid gap-2">
        ${versions
          .slice()
          .sort((a, b) => (b.created ?? '').localeCompare(a.created ?? ''))
          .map((v) => cvCardHtml(v))
          .join('')}
      </div>
    `;
  }

  function cvCardHtml(v: CvVersion): string {
    return `
      <div class="border border-ink-200 rounded-lg p-3 flex items-center gap-3" data-cv-id="${v.id}">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <input type="text" value="${escapeAttr(v.label)}" data-field="label"
                   class="input flex-1 max-w-md" placeholder="e.g. v3 — Product-focused" />
            ${v.has_file
              ? `<span class="badge badge-active">${escapeAttr(v.filename ?? 'file')} · ${fmtSize(v.size)}</span>`
              : `<span class="badge badge-ghosted">label only</span>`}
          </div>
          <input type="text" value="${escapeAttr(v.description ?? '')}" data-field="description"
                 class="input mt-2 w-full max-w-md" placeholder="Optional description" />
          <div class="text-xs text-ink-400 mt-1">Added ${escapeAttr(v.created)}</div>
        </div>
        <div class="flex gap-1">
          ${v.has_file ? `<button class="btn-secondary text-xs" data-act="download">Download</button>` : ''}
          ${v.has_file
            ? `<button class="btn-ghost text-xs" data-act="replace">Replace file</button>`
            : `<button class="btn-ghost text-xs" data-act="attach">Attach file</button>`}
          <button class="btn-danger text-xs" data-act="delete">Delete</button>
        </div>
      </div>
    `;
  }

  // ----- Wiring --------------------------------------------------------
  let pendingTarget: { cvId?: string; act?: 'new' | 'replace' | 'attach' } = {};

  host.querySelector('[data-act="upload"]')!.addEventListener('click', () => {
    pendingTarget = { act: 'new' };
    fileInput.click();
  });

  host.querySelector('[data-act="add-meta"]')!.addEventListener('click', () => {
    versions.push({
      id: rid(),
      label: 'New CV version',
      created: todayIso(),
      has_file: false,
    });
    commit();
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      if (!confirm(`This file is ${fmtSize(file.size)}. Files >20MB may slow down the page. Continue?`)) {
        fileInput.value = '';
        return;
      }
    }

    if (pendingTarget.act === 'new') {
      const id = rid();
      await putCvFile({
        id,
        name: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        uploadedAt: todayIso(),
        blob: file,
      });
      versions.push({
        id,
        label: file.name.replace(/\.[^.]+$/, ''),
        created: todayIso(),
        has_file: true,
        filename: file.name,
        size: file.size,
      });
    } else if ((pendingTarget.act === 'replace' || pendingTarget.act === 'attach') && pendingTarget.cvId) {
      await putCvFile({
        id: pendingTarget.cvId,
        name: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        uploadedAt: todayIso(),
        blob: file,
      });
      const v = versions.find((x) => x.id === pendingTarget.cvId);
      if (v) {
        v.has_file = true;
        v.filename = file.name;
        v.size = file.size;
      }
    }
    fileInput.value = '';
    pendingTarget = {};
    commit();
  });

  list.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    const card = target.closest('[data-cv-id]') as HTMLElement | null;
    if (!card) return;
    const id = card.getAttribute('data-cv-id')!;
    const v = versions.find((x) => x.id === id);
    if (!v) return;
    const field = target.getAttribute('data-field');
    if (field === 'label') v.label = target.value || 'Untitled';
    else if (field === 'description') v.description = target.value || undefined;
    saveCvs(versions);
    cb.onChange(versions);
  });

  list.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!btn) return;
    const card = btn.closest('[data-cv-id]') as HTMLElement | null;
    if (!card) return;
    const id = card.getAttribute('data-cv-id')!;
    const v = versions.find((x) => x.id === id);
    if (!v) return;
    const act = btn.getAttribute('data-act');

    if (act === 'delete') {
      if (!confirm(`Delete CV "${v.label}"?`)) return;
      await deleteCvFile(id).catch(() => undefined);
      versions = versions.filter((x) => x.id !== id);
      commit();
    } else if (act === 'download') {
      const file = await getCvFile(id);
      if (!file) {
        alert('File not found in storage. It may have been cleared.');
        return;
      }
      const url = URL.createObjectURL(file.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } else if (act === 'replace') {
      pendingTarget = { cvId: id, act: 'replace' };
      fileInput.click();
    } else if (act === 'attach') {
      pendingTarget = { cvId: id, act: 'attach' };
      fileInput.click();
    }
  });

  // Reconcile: if metadata claims a file but IndexedDB doesn't have it, mark
  // it as label-only so the UI doesn't lie.
  void (async () => {
    const present = new Set((await listCvFiles()).map((f) => f.id));
    let dirty = false;
    for (const v of versions) {
      if (v.has_file && !present.has(v.id)) {
        v.has_file = false;
        v.filename = undefined;
        v.size = undefined;
        dirty = true;
      }
    }
    if (dirty) commit();
    else renderList();
  })();
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

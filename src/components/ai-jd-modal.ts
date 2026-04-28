import { extractFromJd } from '../ai/extract';
import { isConfigured } from '../ai/config';
import { openAiSettings } from './ai-settings';
import type { Application } from '../types';

export function openJdExtractModal(
  onExtract: (extracted: Partial<Application>) => void
): void {
  if (!isConfigured()) {
    if (confirm('AI features need an Anthropic API key first. Add one now?')) {
      openAiSettings();
    }
    return;
  }

  const overlay = document.createElement('div');
  overlay.className =
    'fixed inset-0 bg-ink-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4';
  overlay.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 border border-ink-200" role="dialog">
      <div class="flex items-start justify-between mb-3">
        <div>
          <h3 class="text-lg font-semibold text-ink-900">Add row from job description</h3>
          <p class="text-sm text-ink-500 mt-1">
            Paste the JD text. AI will extract company, role, sector, salary, and more
            into a new row.
          </p>
        </div>
        <button class="btn-ghost text-xl" data-act="close" aria-label="Close">×</button>
      </div>

      <textarea class="input w-full h-64 font-mono text-xs" data-field="jd"
        placeholder="Paste the full job description here..."></textarea>

      <div class="text-xs text-ink-500 mt-2" data-status></div>

      <div class="mt-4 flex items-center justify-end gap-2">
        <button class="btn-secondary" data-act="cancel">Cancel</button>
        <button class="btn-primary" data-act="run">Extract</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  const status = overlay.querySelector('[data-status]') as HTMLElement;
  const runBtn = overlay.querySelector('[data-act="run"]') as HTMLButtonElement;
  const ta = overlay.querySelector('[data-field="jd"]') as HTMLTextAreaElement;

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-act="close"]')!.addEventListener('click', close);
  overlay.querySelector('[data-act="cancel"]')!.addEventListener('click', close);

  runBtn.addEventListener('click', async () => {
    const text = ta.value.trim();
    if (!text) {
      status.textContent = 'Paste a job description first.';
      return;
    }
    runBtn.disabled = true;
    status.textContent = 'Extracting...';
    try {
      const extracted = await extractFromJd(text);
      onExtract(extracted);
      close();
    } catch (err) {
      status.textContent = `Failed: ${(err as Error).message}`;
      runBtn.disabled = false;
    }
  });
}

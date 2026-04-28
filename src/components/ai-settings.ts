import { loadConfig, saveConfig, DEFAULT_AI_MODEL } from '../ai/config';
import type { AiConfig } from '../ai/config';

export function openAiSettings(onChange?: () => void): void {
  const existing = loadConfig();
  const overlay = document.createElement('div');
  overlay.className =
    'fixed inset-0 bg-ink-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4';
  overlay.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 border border-ink-200" role="dialog">
      <div class="flex items-start justify-between mb-2">
        <div>
          <h3 class="text-lg font-semibold text-ink-900">AI settings</h3>
          <p class="text-sm text-ink-500 mt-1">
            Bring your own Anthropic API key. Calls go directly from your browser to
            Anthropic — your key stays in this device's localStorage and is never sent
            anywhere else.
          </p>
        </div>
        <button class="btn-ghost text-xl" data-act="close" aria-label="Close">×</button>
      </div>

      <div class="mt-4">
        <label class="block text-sm font-medium text-ink-700 mb-1">Anthropic API key</label>
        <input type="password" class="input w-full" placeholder="sk-ant-..."
               value="${existing?.apiKey ?? ''}" data-field="apiKey" />
        <p class="text-xs text-ink-500 mt-1">
          Get one at <span class="text-accent">console.anthropic.com</span>. Costs are
          on your account; this app makes no charges.
        </p>
      </div>

      <div class="mt-3">
        <label class="block text-sm font-medium text-ink-700 mb-1">Model</label>
        <select class="input w-full" data-field="model">
          <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 — fast, cheap (recommended)</option>
          <option value="claude-sonnet-4-6">Claude Sonnet 4.6 — smarter, slower, costlier</option>
        </select>
      </div>

      <div class="mt-6 flex items-center justify-end gap-2">
        ${existing ? '<button class="btn-danger" data-act="remove">Remove key</button>' : ''}
        <button class="btn-secondary" data-act="cancel">Cancel</button>
        <button class="btn-primary" data-act="save">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const modelSel = overlay.querySelector('[data-field="model"]') as HTMLSelectElement;
  modelSel.value = existing?.model ?? DEFAULT_AI_MODEL;

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('[data-act="close"]')!.addEventListener('click', close);
  overlay.querySelector('[data-act="cancel"]')!.addEventListener('click', close);
  overlay.querySelector('[data-act="save"]')!.addEventListener('click', () => {
    const apiKey = (overlay.querySelector('[data-field="apiKey"]') as HTMLInputElement).value.trim();
    if (!apiKey) {
      alert('Please paste an API key, or click Cancel.');
      return;
    }
    const cfg: AiConfig = { apiKey, model: modelSel.value };
    saveConfig(cfg);
    onChange?.();
    close();
  });
  const removeBtn = overlay.querySelector('[data-act="remove"]');
  removeBtn?.addEventListener('click', () => {
    if (confirm('Remove your API key? AI features will stop working until you add one again.')) {
      saveConfig(null);
      onChange?.();
      close();
    }
  });
}

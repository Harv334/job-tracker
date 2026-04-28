import { analyzeRejectionPatterns } from '../ai/insights';
import { isConfigured } from '../ai/config';
import type { Application } from '../types';
import { TERMINAL_STAGES, POSITIVE_TERMINALS } from '../types';

export function renderAiInsights(host: HTMLElement, apps: Application[]): void {
  const dead = apps.filter(
    (a) => TERMINAL_STAGES.includes(a.current_status) &&
           !POSITIVE_TERMINALS.includes(a.current_status)
  );

  // Don't even show the card if there's nothing useful to analyze.
  if (dead.length < 5) {
    host.innerHTML = '';
    return;
  }

  const configured = isConfigured();
  host.innerHTML = `
    <section class="card mt-6 border-l-4 border-l-accent">
      <div class="flex items-start justify-between gap-3 mb-2">
        <div>
          <h2 class="text-sm font-semibold text-ink-700 uppercase tracking-wider">
            AI insights — rejection patterns
          </h2>
          <p class="text-sm text-ink-500 mt-1">
            Analyze your ${dead.length} rejected/ghosted applications to spot patterns.
          </p>
        </div>
        ${configured
          ? '<button class="btn-primary" data-act="run">Analyze</button>'
          : '<button class="btn-secondary" data-act="setup">Set up AI</button>'}
      </div>
      <div class="result mt-3 text-sm text-ink-700 whitespace-pre-line"></div>
    </section>
  `;

  const runBtn = host.querySelector('[data-act="run"]') as HTMLButtonElement | null;
  const setupBtn = host.querySelector('[data-act="setup"]') as HTMLButtonElement | null;
  const result = host.querySelector('.result') as HTMLElement;

  setupBtn?.addEventListener('click', async () => {
    const { openAiSettings } = await import('./ai-settings');
    openAiSettings(() => renderAiInsights(host, apps));
  });

  runBtn?.addEventListener('click', async () => {
    runBtn.disabled = true;
    runBtn.textContent = 'Analyzing...';
    result.textContent = '';
    try {
      const text = await analyzeRejectionPatterns(apps);
      result.textContent = text;
    } catch (err) {
      result.innerHTML = `<span class="text-danger">Failed: ${(err as Error).message}</span>`;
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = 'Re-analyze';
    }
  });
}

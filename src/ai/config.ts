// BYOK (Bring Your Own Key) — the user's Anthropic API key lives in
// localStorage and is sent directly to Anthropic from the browser.
// We never see it. Trade-off: clearing browser data removes it.

const KEY = 'jt:ai-config:v1';

export interface AiConfig {
  apiKey: string;
  model: string; // e.g. 'claude-haiku-4-5-20251001'
}

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export function loadConfig(): AiConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AiConfig;
    if (!parsed.apiKey) return null;
    return { apiKey: parsed.apiKey, model: parsed.model || DEFAULT_MODEL };
  } catch {
    return null;
  }
}

export function saveConfig(cfg: AiConfig | null): void {
  if (cfg && cfg.apiKey) {
    localStorage.setItem(KEY, JSON.stringify(cfg));
  } else {
    localStorage.removeItem(KEY);
  }
}

export function isConfigured(): boolean {
  return !!loadConfig();
}

export const DEFAULT_AI_MODEL = DEFAULT_MODEL;

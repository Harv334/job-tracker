import { loadConfig } from './config';

export class AiNotConfiguredError extends Error {
  constructor() {
    super('No Anthropic API key configured. Click the AI settings icon to add one.');
  }
}

interface AnthropicMessageResponse {
  content: { type: string; text?: string }[];
  stop_reason?: string;
  usage?: { input_tokens: number; output_tokens: number };
}

export interface AiCallOptions {
  system?: string;
  maxTokens?: number;
}

export async function aiCall(prompt: string, opts: AiCallOptions = {}): Promise<string> {
  const cfg = loadConfig();
  if (!cfg) throw new AiNotConfiguredError();

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: opts.maxTokens ?? 1024,
      system: opts.system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${text || res.statusText}`);
  }

  const data = (await res.json()) as AnthropicMessageResponse;
  const block = data.content.find((c) => c.type === 'text');
  return block?.text ?? '';
}

// Best-effort JSON extraction. The model may wrap output in ```json``` fences
// or include preamble — we try several recovery strategies.
export function extractJson<T = unknown>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const trimmed = candidate.trim();
  // Find first { and last } — JSON object body
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1)) as T;
  }
  return JSON.parse(trimmed) as T;
}

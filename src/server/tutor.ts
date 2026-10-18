/**
 * AI tutor back end (Groq, OpenAI-compatible API). Runs on the server only:
 * the API key must never reach the browser. Shared by the Vercel function
 * (api/chat.ts) and the Vite dev server, and unit-tested with a fake fetch.
 *
 * Relative imports only — this file is bundled outside the app's path aliases.
 */

export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models';
/** Groq retired llama-3.3-70b-versatile in 2026; if this one goes too, handleChat finds a replacement. */
export const DEFAULT_MODEL = 'openai/gpt-oss-120b';

const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 1000;
const MAX_CONTEXT_CHARS = 8000;
const RATE_LIMIT = 15; // requests…
const RATE_WINDOW_MS = 10 * 60 * 1000; // …per 10 minutes per client

export const SYSTEM_PROMPT = `You are PocketLab Tutor, a friendly physics teacher for students aged 13–19.
The student has just done an experiment in PocketLab, a web app that turns a phone into lab equipment.
Below the conversation you get the experiment, the student's own measured numbers and how they were calculated.

Rules:
- Use ONLY the numbers given in the context. Never invent measurements or results.
- Explain in simple everyday words first. Use a formula only when it helps, written in plain text (e.g. T = 2π√(L/g)), and say what each symbol means.
- Keep answers short: at most about 150 words unless the student asks for more. Use short paragraphs or a few bullet points.
- Help the student think: when useful, end with one short question that guides them to the next idea. Do not just hand over homework answers.
- If the result differs from the accepted value, help find the most likely reasons, using the listed sources of error.
- Stay on this experiment, physics, maths and doing science. Politely decline anything else.
- Never suggest dangerous set-ups (heights, people on spinning chairs, electricity, fire).
- Reply in the same language the student writes in.`;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  status: number;
  body: { reply?: string; error?: string };
}

const hits = new Map<string, number[]>();

/** Best-effort, per-instance rate limit (serverless instances are reused, so it does help). */
export function rateLimited(client: string, now = Date.now()): boolean {
  const recent = (hits.get(client) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(client, recent);
    return true;
  }
  recent.push(now);
  hits.set(client, recent);
  return false;
}

export function resetRateLimit() {
  hits.clear();
}

/** Validates untrusted input from the browser. */
export function parseRequest(body: unknown): { messages: ChatMessage[]; context: string } | string {
  if (typeof body !== 'object' || body === null) return 'Invalid request.';
  const b = body as { messages?: unknown; context?: unknown };
  if (!Array.isArray(b.messages) || b.messages.length === 0) return 'No question was sent.';
  if (b.messages.length > MAX_MESSAGES) return 'This conversation is too long — start a new one.';
  const messages: ChatMessage[] = [];
  for (const m of b.messages) {
    const role = (m as ChatMessage)?.role;
    const content = (m as ChatMessage)?.content;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string' || !content.trim()) return 'Invalid message.';
    if (content.length > MAX_MESSAGE_CHARS) return `Please keep questions under ${MAX_MESSAGE_CHARS} characters.`;
    messages.push({ role, content });
  }
  if (messages[messages.length - 1].role !== 'user') return 'The last message must be a question.';
  const context = typeof b.context === 'string' ? b.context.slice(0, MAX_CONTEXT_CHARS) : '';
  return { messages, context };
}

export async function handleChat(
  body: unknown,
  opts: { apiKey?: string; model?: string; client: string; fetchImpl?: typeof fetch },
): Promise<ChatResult> {
  if (!opts.apiKey) return { status: 503, body: { error: 'not_configured' } };
  const parsed = parseRequest(body);
  if (typeof parsed === 'string') return { status: 400, body: { error: parsed } };
  if (rateLimited(opts.client)) {
    return { status: 429, body: { error: 'You asked a lot of questions in a short time — please wait a few minutes.' } };
  }

  const doFetch = opts.fetchImpl ?? fetch;
  const messages = [
    { role: 'system', content: `${SYSTEM_PROMPT}

--- EXPERIMENT CONTEXT ---
${parsed.context || '(no experiment data)'}` },
    ...parsed.messages,
  ];
  const ask = (model: string) =>
    doFetch(GROQ_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({ model, temperature: 0.3, max_tokens: 500, messages }),
    });

  let model = opts.model || cachedModel || DEFAULT_MODEL;
  let res: Response;
  try {
    res = await ask(model);
    // Groq retires models regularly. If ours is gone, pick a current one and retry once.
    if (res.status === 400 || res.status === 404) {
      const detail = await res.clone().text();
      if (/model/i.test(detail)) {
        console.error(`[tutor] model "${model}" unavailable (${res.status}): ${detail.slice(0, 300)}`);
        const replacement = await availableModel(doFetch, opts.apiKey, model);
        if (replacement) {
          model = replacement;
          cachedModel = replacement;
          res = await ask(model);
        }
      }
    }
  } catch (e) {
    console.error('[tutor] Groq unreachable:', e instanceof Error ? e.message : e);
    return { status: 502, body: { error: 'The AI service could not be reached. Try again in a moment.' } };
  }

  if (!res.ok) {
    // Logged server-side (never the key) so the cause is visible in the hosting logs.
    const detail = await res.text().catch(() => '');
    console.error(`[tutor] Groq ${res.status} with model "${model}": ${detail.slice(0, 300)}`);
    if (res.status === 429) return { status: 429, body: { error: 'The AI tutor is busy right now. Try again in a minute.' } };
    if (res.status === 401 || res.status === 403) {
      return { status: 502, body: { error: 'The AI tutor’s API key was rejected. The site owner needs to check GROQ_API_KEY.' } };
    }
    return { status: 502, body: { error: 'The AI service returned an error. Try again later.' } };
  }

  const data = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) return { status: 502, body: { error: 'The AI tutor gave an empty answer. Try asking differently.' } };
  return { status: 200, body: { reply } };
}

/** Model chosen after a retirement, reused for the life of this server instance. */
let cachedModel: string | null = null;

export function resetModelCache() {
  cachedModel = null;
}

/** Text chat models only (no speech, moderation or embedding models), best first. */
export function chooseModel(ids: string[], avoid?: string): string | null {
  const usable = ids.filter((id) => id !== avoid && !/whisper|guard|tts|playai|embed|distil|vision|audio|orpheus|compound/i.test(id));
  const preference = [/llama-3\.3-70b/i, /llama-4/i, /gpt-oss-120b/i, /llama.*70b/i, /gpt-oss/i, /qwen/i, /llama/i, /kimi|mixtral|gemma/i];
  for (const p of preference) {
    const hit = usable.find((id) => p.test(id));
    if (hit) return hit;
  }
  return usable[0] ?? null;
}

async function availableModel(doFetch: typeof fetch, apiKey: string, avoid: string): Promise<string | null> {
  try {
    const res = await doFetch(GROQ_MODELS_URL, { headers: { authorization: `Bearer ${apiKey}` } });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { id?: string; active?: boolean }[] };
    const ids = (data.data ?? []).filter((m) => m.id && m.active !== false).map((m) => m.id!);
    const chosen = chooseModel(ids, avoid);
    console.error(`[tutor] switching to model "${chosen}"`);
    return chosen;
  } catch {
    return null;
  }
}

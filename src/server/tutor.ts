/**
 * AI tutor back end (Groq, OpenAI-compatible API). Runs on the server only:
 * the API key must never reach the browser. Shared by the Vercel function
 * (api/chat.ts) and the Vite dev server, and unit-tested with a fake fetch.
 *
 * Relative imports only — this file is bundled outside the app's path aliases.
 */

export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

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

  const payload = {
    model: opts.model || DEFAULT_MODEL,
    temperature: 0.3,
    max_tokens: 500,
    messages: [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\n--- EXPERIMENT CONTEXT ---\n${parsed.context || '(no experiment data)'}` },
      ...parsed.messages,
    ],
  };

  let res: Response;
  try {
    res = await (opts.fetchImpl ?? fetch)(GROQ_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify(payload),
    });
  } catch {
    return { status: 502, body: { error: 'The AI service could not be reached. Try again in a moment.' } };
  }
  if (res.status === 429) return { status: 429, body: { error: 'The AI tutor is busy right now. Try again in a minute.' } };
  if (!res.ok) return { status: 502, body: { error: 'The AI service returned an error. Try again later.' } };

  const data = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) return { status: 502, body: { error: 'The AI tutor gave an empty answer. Try asking differently.' } };
  return { status: 200, body: { reply } };
}

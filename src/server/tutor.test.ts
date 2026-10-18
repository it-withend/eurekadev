import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MODEL, GROQ_URL, handleChat, parseRequest, rateLimited, resetRateLimit } from './tutor';

const ok = (reply: string) =>
  vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: reply } }] }), { status: 200 }));
const ask = { messages: [{ role: 'user', content: 'Why is my g a bit low?' }], context: 'Experiment: pendulum. g = 9.71 ± 0.05' };

describe('AI tutor back end', () => {
  beforeEach(() => resetRateLimit());

  it('refuses politely when no API key is configured', async () => {
    expect(await handleChat(ask, { client: 'a' })).toEqual({ status: 503, body: { error: 'not_configured' } });
  });

  it('sends the system prompt, the experiment context and the question to Groq', async () => {
    const fetchImpl = ok('Your string might be a little shorter than you measured.');
    const r = await handleChat(ask, { apiKey: 'test-key', client: 'a', fetchImpl });
    expect(r).toEqual({ status: 200, body: { reply: 'Your string might be a little shorter than you measured.' } });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GROQ_URL);
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer test-key');
    const payload = JSON.parse(init.body as string);
    expect(payload.model).toBe(DEFAULT_MODEL);
    expect(payload.messages[0].role).toBe('system');
    expect(payload.messages[0].content).toContain('Use ONLY the numbers given');
    expect(payload.messages[0].content).toContain('g = 9.71 ± 0.05');
    expect(payload.messages.at(-1)).toEqual(ask.messages[0]);
  });

  it('validates what the browser sends', () => {
    expect(parseRequest(null)).toMatch(/Invalid/);
    expect(parseRequest({ messages: [] })).toMatch(/No question/);
    expect(parseRequest({ messages: [{ role: 'system', content: 'hi' }] })).toMatch(/Invalid message/);
    expect(parseRequest({ messages: [{ role: 'user', content: 'x'.repeat(1001) }] })).toMatch(/under 1000/);
    expect(parseRequest({ messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] })).toMatch(/must be a question/);
    const longContext = parseRequest({ messages: [{ role: 'user', content: 'a' }], context: 'c'.repeat(20000) });
    expect(typeof longContext !== 'string' && longContext.context.length).toBe(8000);
  });

  it('rate-limits a single client', () => {
    for (let i = 0; i < 15; i++) expect(rateLimited('b', 1000 + i)).toBe(false);
    expect(rateLimited('b', 2000)).toBe(true);
    expect(rateLimited('c', 2000)).toBe(false); // other students are unaffected
    expect(rateLimited('b', 1000 + 11 * 60 * 1000)).toBe(false); // window passed
  });

  it('turns upstream failures into friendly errors', async () => {
    const down = vi.fn(async () => {
      throw new Error('network');
    });
    expect((await handleChat(ask, { apiKey: 'k', client: 'd', fetchImpl: down })).status).toBe(502);
    const busy = vi.fn(async () => new Response('{}', { status: 429 }));
    expect((await handleChat(ask, { apiKey: 'k', client: 'e', fetchImpl: busy })).body.error).toMatch(/busy/);
    const empty = vi.fn(async () => new Response('{"choices":[]}', { status: 200 }));
    expect((await handleChat(ask, { apiKey: 'k', client: 'f', fetchImpl: empty })).body.error).toMatch(/empty/);
  });
});

/**
 * Vercel serverless function: POST /api/chat → AI tutor answer.
 * Set GROQ_API_KEY (and optionally GROQ_MODEL) in the Vercel project settings.
 */
// Explicit .js: Vercel runs this as a native ES module, and Node needs file extensions.
import { handleChat } from '../src/server/tutor.js';

export async function POST(request: Request): Promise<Response> {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // handled as an invalid request below
  }
  const client = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const result = await handleChat(body, {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL,
    client,
  });
  return Response.json(result.body, { status: result.status, headers: { 'cache-control': 'no-store' } });
}

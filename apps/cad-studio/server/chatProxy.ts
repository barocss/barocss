// The chat's local dev proxy (a Vite plugin): the browser posts {system, tools, messages}; this adds
// the API key from the environment, the model and the request options, calls the Claude Messages API
// with streaming and streams the events straight back. The key never reaches the browser bundle.
//   ANTHROPIC_API_KEY=… pnpm dev            (optional: CAD_STUDIO_CHAT_MODEL, CAD_STUDIO_CHAT_EFFORT, ANTHROPIC_BASE_URL)
// (Plain fetch: the app adds no dependency, and this is the whole of its API use.)
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

export const DEFAULT_MODEL = 'claude-opus-5-5';
const MAX_BODY = 4 * 1024 * 1024;
/** Models that take server-side refusal fallbacks in their "default" form. */
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5']);

type Env = Record<string, string | undefined>;
type Next = (err?: unknown) => void;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => { size += c.length; if (size > MAX_BODY) { reject(new Error('Request too large.')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const sendJson = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body));
};

/** The Messages API request for a browser request (the model, limits and options are the proxy's). */
export function upstreamBody(request: { system: unknown; tools: unknown; messages: unknown }, env: Env) {
  const model = env.CAD_STUDIO_CHAT_MODEL || DEFAULT_MODEL;
  return {
    model, max_tokens: 32000, stream: true,
    // Adaptive thinking is this model's default; effort is the depth control (medium is its default too, set explicitly).
    output_config: { effort: env.CAD_STUDIO_CHAT_EFFORT || 'medium' },
    // Prompt caching: the system prompt and tools are stable, the history grows append-only.
    cache_control: { type: 'ephemeral' },
    ...(FALLBACK_MODELS.has(model) ? { fallbacks: 'default' } : {}),
    system: request.system, tools: request.tools, messages: request.messages,
  };
}

export function createChatHandler({ env = process.env as Env, fetchImpl = fetch }: { env?: Env; fetchImpl?: typeof fetch } = {}) {
  return async (req: IncomingMessage, res: ServerResponse, next?: Next) => {
    const path = (req.url ?? '').split('?')[0];
    const key = env.ANTHROPIC_API_KEY, model = env.CAD_STUDIO_CHAT_MODEL || DEFAULT_MODEL;
    if (req.method === 'GET' && (path === '/status' || path === '/api/chat/status')) {
      return sendJson(res, 200, key ? { enabled: true, model } : { enabled: false, model, reason: 'Set ANTHROPIC_API_KEY in the environment of the studio’s dev server (ANTHROPIC_API_KEY=… pnpm dev) to chat.' });
    }
    if (req.method !== 'POST' || (path !== '/' && path !== '' && path !== '/api/chat')) return next ? next() : sendJson(res, 404, { error: { message: 'Not found.' } });
    if (!key) return sendJson(res, 503, { error: { message: 'ANTHROPIC_API_KEY is not set for the dev server.' } });
    let request: { system?: unknown; tools?: unknown; messages?: unknown };
    try { request = JSON.parse(await readBody(req)); } catch (e) { return sendJson(res, 400, { error: { message: e instanceof Error ? e.message : 'Invalid JSON.' } }); }
    if (typeof request.system !== 'string' || !Array.isArray(request.tools) || !Array.isArray(request.messages)) return sendJson(res, 400, { error: { message: 'Expected {system, tools, messages}.' } });
    const abort = new AbortController();
    res.on('close', () => { if (!res.writableFinished) abort.abort(); });
    const body = upstreamBody(request as { system: string; tools: unknown[]; messages: unknown[] }, env);
    let upstream: Response;
    try {
      upstream = await fetchImpl(`${(env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '')}/v1/messages`, {
        method: 'POST', signal: abort.signal,
        headers: {
          'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01',
          ...('fallbacks' in body ? { 'anthropic-beta': 'server-side-fallback-2026-07-01' } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch (e) { return sendJson(res, 502, { error: { message: `Could not reach the Claude API: ${e instanceof Error ? e.message : String(e)}` } }); }
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '');
      res.statusCode = upstream.status; res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json'); res.end(text);
      return;
    }
    res.statusCode = 200; res.setHeader('content-type', 'text/event-stream'); res.setHeader('cache-control', 'no-cache');
    const reader = upstream.body.getReader();
    try {
      for (;;) { const { done, value } = await reader.read(); if (done) break; res.write(value); }
    } catch { /* the browser went away */ }
    res.end();
  };
}

export function chatProxy(): Plugin {
  const handler = createChatHandler();
  return {
    name: 'cad-studio-chat-proxy',
    configureServer(server) { server.middlewares.use('/api/chat', (req, res, next) => { void handler(req, res, next); }); },
    configurePreviewServer(server) { server.middlewares.use('/api/chat', (req, res, next) => { void handler(req, res, next); }); },
  };
}

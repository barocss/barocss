// AI coffee kiosk: every screen is written by a model for the current persona and order state,
// sanitised here, and styled in the browser by the BaroCSS runtime.
//   node examples/ai-kiosk/server.mjs            (real `claude -p`, model from KIOSK_MODEL, default haiku)
//   KIOSK_GENERATOR=stub node examples/ai-kiosk/server.mjs   (canned HTML, no CLI)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { applyAction, facts, newState, setContext } from './lib/order.mjs';
import { buildPrompt } from './lib/prompt.mjs';
import { sanitize } from './lib/sanitize.mjs';
import { claudeGenerator, stubGenerator } from './lib/generators.mjs';
import { noopCheck } from './lib/noop.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const menu = JSON.parse(fs.readFileSync(path.join(HERE, 'menu.json'), 'utf8'));
const ITEM_IDS = new Set(menu.items.map((i) => i.id));
// Prebuilt browser runtime, served as /vendor/barocss.js. Override with BARO_BROWSER_DIST=/abs/dist.
const BROWSER_DIST = process.env.BARO_BROWSER_DIST || path.resolve(HERE, '../../packages/barocss-browser/dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.map': 'application/json' };
const STATIC_OK = new Set(['/index.html', '/kiosk.js', '/menu.json', '/lib/contract.mjs', '/lib/sanitize.mjs']);
const MAX_BODY = 16 * 1024;
const MAX_SESSIONS = 200;

/** Resolve a request path to a file strictly inside `root`, or null. */
export function safeResolve(root, urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath); } catch { return null; }
  if (p.includes('\0') || p.includes('\\')) return null;
  const abs = path.resolve(root, '.' + path.posix.normalize('/' + p));
  const rootAbs = path.resolve(root);
  return abs.startsWith(rootAbs + path.sep) ? abs : null;
}

export function createKioskServer({ generator, log = () => {} } = {}) {
  const sessions = new Map();
  const session = (id) => {
    if (typeof id !== 'string' || !/^[a-f0-9-]{8,64}$/.test(id)) id = crypto.randomUUID();
    if (!sessions.has(id)) {
      if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
      sessions.set(id, { state: newState(), variant: 0 });
    }
    return [id, sessions.get(id)];
  };

  async function screen(body) {
    const [id, ses] = session(body.session);
    if (body.context) setContext(ses.state, body.context);
    if (body.action && body.action !== 'regenerate') {
      ses.state = applyAction(menu, ses.state, body.action, { item: body.item ?? undefined, option: body.option ?? undefined });
    }
    ses.variant = body.action === 'regenerate' ? ses.variant + 1 : 0;
    const f = facts(menu, ses.state);
    const prompt = buildPrompt({ menu, facts: f, variant: ses.variant });
    const t0 = Date.now();
    const raw = await generator.generate({ prompt, facts: f, menu, variant: ses.variant });
    const genMs = Date.now() - t0;
    const clean = sanitize(raw.html, { itemIds: ITEM_IDS });
    const noop = await noopCheck(clean.html);
    log(`[kiosk] ${f.step} persona=${f.persona} gen=${genMs}ms unstyled=${noop.unstyled.length}`);
    return { session: id, html: clean.html, removed: clean.removed, facts: f, noop, timings: { genMs, ...raw.meta }, generator: generator.name, prompt, rawHtml: raw.html };
  }

  const send = (res, code, type, data) => {
    res.writeHead(code, { 'content-type': type, 'x-content-type-options': 'nosniff', 'cache-control': 'no-store',
      'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" });
    res.end(data);
  };

  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'POST' && url.pathname === '/screen') {
      let body = ''; let tooBig = false;
      req.on('data', (d) => { body += d; if (body.length > MAX_BODY) { tooBig = true; req.destroy(); } });
      req.on('end', async () => {
        if (tooBig) return;
        let parsed;
        try { parsed = JSON.parse(body || '{}'); } catch { return send(res, 400, 'application/json', '{"error":"bad json"}'); }
        try {
          const out = await screen(parsed);
          if (!parsed.debug) { delete out.prompt; delete out.rawHtml; }
          send(res, 200, 'application/json', JSON.stringify(out));
        } catch (err) {
          send(res, 422, 'application/json', JSON.stringify({ error: String(err.message).slice(0, 200) }));
        }
      });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain', 'method not allowed');
    let file = null;
    if (url.pathname === '/') file = path.join(HERE, 'index.html');
    else if (url.pathname.startsWith('/vendor/')) {
      const f = url.pathname.slice('/vendor/'.length);
      if (f === 'barocss.js' || f === 'barocss.js.map') file = safeResolve(path.join(BROWSER_DIST, 'cdn'), f);
    } else if (STATIC_OK.has(url.pathname)) file = safeResolve(HERE, url.pathname);
    if (!file || !fs.existsSync(file)) return send(res, 404, 'text/plain', 'not found');
    send(res, 200, TYPES[path.extname(file)] ?? 'application/octet-stream', fs.readFileSync(file));
  });
}

export function generatorFromEnv(env = process.env) {
  return env.KIOSK_GENERATOR === 'stub' ? stubGenerator()
    : claudeGenerator({ model: env.KIOSK_MODEL || 'haiku', timeoutMs: Number(env.KIOSK_TIMEOUT_MS) || undefined });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8510;
  const generator = generatorFromEnv();
  // eslint-disable-next-line no-console
  createKioskServer({ generator, log: console.log }).listen(port, '127.0.0.1', () => console.log(`kiosk (${generator.name}) on http://127.0.0.1:${port}/`));
}

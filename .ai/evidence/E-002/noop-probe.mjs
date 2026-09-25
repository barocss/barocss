// Grader-side no-op check for every class token the agents added (post-run analysis; not shown to agents).
// Tokens: every class value the agents wrote in their tool calls (WRITTEN, transcribed in order from
// tasks/X*.json tool_calls, including throwaway probe elements) plus the final class diff per task.
// Each token is applied ALONE to the task's target element on a fresh page; a token is a no-op when no computed
// property of the element changes. Records the generated rule text and console messages naming it.
// Usage from repo root: PW_MCP_DIR=… [CHROME_PATH=…] node .ai/evidence/E-002/noop-probe.mjs  → noop-probe.json
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const req = createRequire(join(process.env.PW_MCP_DIR, 'node_modules/@playwright/mcp/package.json'));
const { chromium } = req('playwright-core');
const PORT = Number(process.env.PORT || 8812);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', ROOT], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(800);
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const p = await b.newPage({ viewport: { width: 1024, height: 900 } });
let msgs = [];
p.on('console', (m) => msgs.push(`[${m.type()}] ${m.text()}`));
const url = `http://127.0.0.1:${PORT}/.ai/evidence/E-002/index.html`;
const computed = (id) => p.evaluate((id) => { const cs = getComputedStyle(document.querySelector(`[data-testid="${id}"]`)); const o = {}; for (const k of cs) o[k] = cs.getPropertyValue(k); return o; }, id);

const TARGET = { X1: 'pricing-card', X2: 'media', X3: 'intro', X4: 'save-button' };
const WRITTEN = {
  X1: ['rounded-4xl', 'rounded-3xl', 'rounded-2xl'],
  X2: ['aspect-video', 'aspect-[16/9]'],
  X3: ['text-balance', '[text-wrap:balance]', '[color:red]', 'text-pretty', 'whitespace-nowrap', 'text-wrap', 'text-nowrap', 'text-clip', 'text-ellipsis', 'truncate', 'break-words'],
  X4: ['text-shadow-sm', 'text-shadow-xs', 'text-shadow-2xs', 'text-shadow', 'text-shadow-md', 'text-shadow-[0_1px_2px_rgba(0,0,0,0.3)]', 'shadow-lg', '[text-shadow:0_1px_2px_rgba(0,0,0,0.35)]', '[text-shadow:0_1px_2px_rgb(0_0_0_/_0.35)]', '[color:red]', 'bg-[#ff0000]', 'w-[300px]'],
};
const out = {};
for (const f of readdirSync(join(HERE, 'tasks')).filter((f) => /^X\d\.json$/.test(f)).sort()) {
  const rec = JSON.parse(readFileSync(join(HERE, 'tasks', f), 'utf8'));
  const t = rec.task; out[t] = [];
  const toks = [...(WRITTEN[t] || [])];
  for (const { before, after } of Object.values(rec.classes_changed || {})) {
    const bset = new Set((before || '').split(/\s+/).filter(Boolean));
    for (const x of (after || '').split(/\s+/)) if (x && !bset.has(x) && !toks.includes(x)) toks.push(x);
  }
  const id = TARGET[t];
  {
    for (const tok of toks) {
      msgs = [];
      await p.goto(url); await p.waitForSelector('html[data-baro-ready]'); await sleep(300);
      const c0 = await computed(id);
      await p.evaluate(([id, tok]) => document.querySelector(`[data-testid="${id}"]`).classList.add(tok), [id, tok]); await sleep(400);
      const c1 = await computed(id);
      const changed = Object.keys(c1).filter((k) => c0[k] !== c1[k]).map((k) => `${k}: ${c0[k]} → ${c1[k]}`);
      const rules = await p.evaluate((tok) => { const esc = CSS.escape(tok), o = []; const w = (rs) => { for (const r of rs) { if (r.cssRules) w(r.cssRules); if (r.selectorText?.includes('.' + esc)) o.push(r.cssText); } }; for (const s of document.styleSheets) { try { w(s.cssRules); } catch {} } return o; }, tok);
      out[t].push({ element: id, token: tok, noop: changed.length === 0, changed: changed.slice(0, 8), rules, consoleNamingToken: msgs.filter((m) => m.includes(tok)) });
      console.log(t, id, tok, changed.length === 0 ? 'NO-OP' : `effect(${changed.length})`);
    }
  }
}
writeFileSync(join(HERE, 'noop-probe.json'), JSON.stringify(out, null, 2) + '\n');
await b.close(); srv.kill();

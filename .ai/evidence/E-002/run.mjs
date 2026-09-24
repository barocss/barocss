// E-002 runner (adapted from E-001). Usage (from repo root, after `pnpm --filter @barocss/browser build:cdn`):
//   PW_MCP_DIR=<dir containing node_modules/@playwright/mcp> [CHROME_PATH=…] [MODEL=…] node .ai/evidence/E-002/run.mjs X1 [X2 ...]
// Per task: fresh headless Chromium (CDP :9333) → baseline snapshot in a throwaway tab →
// `claude -p` actor with ONLY Playwright-MCP browser tools (cwd = empty temp dir), model pinned to E-001's →
// grade the agent's tab at 1024px (grader also scans the agent's tool-call code) → write tasks/<X>.json.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const PW_MCP_DIR = process.env.PW_MCP_DIR;
if (!PW_MCP_DIR) throw new Error('set PW_MCP_DIR');
const req = createRequire(join(PW_MCP_DIR, 'node_modules/@playwright/mcp/package.json'));
const { chromium } = req('playwright-core');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MCP_CLI = join(PW_MCP_DIR, 'node_modules/@playwright/mcp/cli.js');

const PORT = 8765, CDP = 9333;
const URL_ = `http://127.0.0.1:${PORT}/`;
const MODEL = process.env.MODEL || 'claude-opus-4-8[1m]'; // E-001's actor model
const TASKS = {
  X1: 'Give the pricing card the `rounded-4xl` corner radius.',
  X2: 'Make the media placeholder in the pricing card keep a 16:9 aspect ratio.',
  X3: 'Balance the line breaks of the intro paragraph so its lines are roughly even.',
  X4: 'Give the Save button a subtle text shadow.',
};
const prompt = (t) => `Page URL: ${URL_}

The page is styled with BaroCSS, a runtime utility-class CSS engine with Tailwind-compatible class names. Change styling by editing class names on elements in the live page, then verify the result and report whether the task is done.

Task: ${TASKS[t]}`;

// Static server over the repo root, allowlisted to the page and the built runtime only.
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json' };
function serve() {
  return new Promise((ok) => {
    const s = createServer((rq, rs) => {
      const p = rq.url.split('?')[0];
      const file = p === '/' ? join(HERE, 'index.html')
        : p.startsWith('/packages/barocss-browser/dist/cdn/') ? join(ROOT, p) : null;
      if (!file || !existsSync(file)) { rs.writeHead(404); return rs.end('not found'); }
      rs.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
      rs.end(readFileSync(file));
    }).listen(PORT, '127.0.0.1', () => ok(s));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function launchBrowser() {
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'e002-chr-'))}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', 'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`http://127.0.0.1:${CDP}/json/version`)).ok) return proc; } catch {}
    await sleep(200);
  }
  throw new Error('chromium did not start');
}

const graderSrc = readFileSync(join(HERE, 'grader.js'), 'utf8').replace(/^export /gm, '');
const evalSnap = (page) => page.evaluate(`(() => { ${graderSrc}; return snapshot(); })()`);
const evalGrade = (page, b, c, calls) => page.evaluate(`(() => { ${graderSrc}; return grade(${JSON.stringify(b)}, ${JSON.stringify(c)}, ${JSON.stringify(calls)}); })()`);
const classesOf = (page) => page.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll('[data-testid]')].map((el, i) => [`${el.dataset.testid}#${i}`, el.className])));
async function snapAt(page) {
  const out = {};
  for (const w of [1024]) { await page.setViewportSize({ width: w, height: 900 }); await sleep(300); out[w] = await evalSnap(page); }
  return out;
}

function runAgent(t, rawPath) {
  const cwd = mkdtempSync(join(tmpdir(), 'e002-agent-'));
  const mcp = join(cwd, 'mcp.json');
  writeFileSync(mcp, JSON.stringify({ mcpServers: { playwright: { command: 'node', args: [MCP_CLI, '--cdp-endpoint', `http://127.0.0.1:${CDP}`] } } }));
  const args = ['-p', prompt(t), '--output-format', 'stream-json', '--verbose', '--mcp-config', mcp, '--strict-mcp-config',
    '--model', MODEL, '--tools', '', '--allowedTools', 'mcp__playwright', '--setting-sources', '', '--no-session-persistence'];
  return new Promise((ok) => {
    // Print mode otherwise starts turn 1 before MCP connects (agent sees zero tools).
    const p = spawn('claude', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, MCP_CONNECTION_NONBLOCKING: 'false' } });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d));
    const kill = setTimeout(() => p.kill('SIGTERM'), 15 * 60 * 1000);
    p.on('close', (code) => { clearTimeout(kill); writeFileSync(rawPath, out); ok({ code, err, lines: out.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) }); });
  });
}

function condense(lines) {
  const init = lines.find((l) => l.type === 'system' && l.subtype === 'init') || {};
  const final = lines.find((l) => l.type === 'result') || {};
  const calls = [], byId = {}, texts = [];
  for (const l of lines) {
    for (const c of l.message?.content || []) {
      if (l.type === 'assistant' && c.type === 'tool_use') { byId[c.id] = calls.length; calls.push({ tool: c.name.replace('mcp__playwright__', ''), input: c.input }); }
      if (l.type === 'assistant' && c.type === 'text' && c.text) texts.push({ after_call: calls.length - 1, text: c.text });
      if (l.type === 'user' && c.type === 'tool_result' && byId[c.tool_use_id] !== undefined) {
        const body = Array.isArray(c.content) ? c.content.map((x) => x.text ?? `[${x.type}]`).join('\n') : String(c.content ?? '');
        calls[byId[c.tool_use_id]].result = body.length > 2500 ? body.slice(0, 2500) + '…[truncated]' : body;
      }
    }
  }
  return { model: init.model, tools_available: init.tools, tool_calls: calls, assistant_text: texts, final_text: final.result, is_error: final.is_error, num_turns: final.num_turns, duration_ms: final.duration_ms, cost_usd: final.total_cost_usd };
}

const server = await serve();
const tasks = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TASKS);
mkdirSync(join(HERE, 'tasks'), { recursive: true });
const rawDir = mkdtempSync(join(tmpdir(), 'e002-raw-'));
for (const t of tasks) {
  const proc = await launchBrowser();
  try {
    let b = await chromium.connectOverCDP(`http://127.0.0.1:${CDP}`);
    const bp = await b.contexts()[0].newPage();
    await bp.goto(URL_); await bp.waitForSelector('html[data-baro-ready]'); await sleep(300);
    const baseline = await snapAt(bp); const classesBefore = await classesOf(bp);
    await bp.close(); await b.close();

    const agent = await runAgent(t, join(rawDir, `${t}.jsonl`));

    b = await chromium.connectOverCDP(`http://127.0.0.1:${CDP}`);
    const pages = b.contexts().flatMap((c) => c.pages()).filter((p) => p.url().startsWith(URL_));
    let grader = { error: 'agent left no tab on the page URL' }, current = null, classesAfter = null;
    if (pages.length) {
      const page = pages[pages.length - 1];
      classesAfter = await classesOf(page);
      current = await snapAt(page);
      grader = (await evalGrade(page, baseline, current, condense(agent.lines).tool_calls))[t];
    }
    await b.close();
    const changed = Object.fromEntries(Object.entries(classesAfter || {}).filter(([k, v]) => classesBefore[k] !== v).map(([k, v]) => [k, { before: classesBefore[k], after: v }]));
    const rec = { task: t, prompt: prompt(t), agent_exit: agent.code, agent_stderr: agent.err.slice(0, 2000), ...condense(agent.lines), classes_changed: changed, grader, baseline, current };
    writeFileSync(join(HERE, 'tasks', `${t}.json`), JSON.stringify(rec, null, 2) + '\n');
    console.log(t, 'grader:', grader.pass, '| turns:', rec.num_turns, '| raw:', join(rawDir, `${t}.jsonl`));
  } finally { proc.kill('SIGTERM'); await sleep(500); }
}
server.close();

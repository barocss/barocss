// E-011 runner = E-007's run.mjs, changed ONLY to (a) serve the pinned bf979c6 site (env.mjs re-point) and (b) take a
// second arg ARM ∈ {arm0,arm1,arm2} that, for arm1/arm2, injects a report into the SAME actor context after its first
// DOM generation and before its claim, via a PostToolUse hook (report_hook.mjs). arm0 = no hook = the E-007 harness
// unchanged (a harness control; the recorded E-007 runs are the primary arm-0 baseline — see SUMMARY). Tasks, prompt,
// actor model, tools, grader and classifier are frozen and identical across arms; only the injected report differs.
// Environment/actor unchanged from E-006/E-007: apps/barocss-site (pinned) on `vite` dev (env.mjs arm D), Chromium's
// only network path is env.mjs's proxy (app origin only), headless `claude -p` with only Playwright-MCP tools, fresh
// context, empty cwd.
// Usage (from repo root; set up the pin first: git worktree add /tmp/e011-pin bf979c6 && cd /tmp/e011-pin && pnpm install):
//   PW_MCP_DIR=<dir with node_modules/@playwright/mcp> [PIN_ROOT=/tmp/e011-pin] [CHROME_PATH=…] [MODEL=…] \
//     node .ai/evidence/E-011/run.mjs <G1|G2|G3> <arm0|arm1|arm2>
// One run: dev server (pinned) + guard → fresh headless Chromium (CDP :9333, proxied) → baseline DOM tree + class set in
// a throwaway tab → actor (arm1/arm2: report injected after first DOM insert) → grade the agent's tab → classify every
// written token on a fresh tab → runs/<task>.<arm>.json.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { startApp, startGuard, chromeArgs } from './env.mjs';
import { classify, counts, codeOf } from './classify.mjs';
import { gradeRun, baselineTree, analyzeCalls } from './grade.mjs';

// E-007's env.mjs guard proxy leaves the incoming request socket without an 'error' handler, so an aborted proxied
// request (Chromium's background traffic churns connections) surfaces as an unhandled ECONNRESET that crashes the
// process before the actor runs (E-007 hit this too — SUMMARY: "G3's first attempt crashed with an unhandled
// ECONNRESET"). Ignore ONLY aborted-connection resets here (runner-level, env.mjs untouched); rethrow anything else.
process.on('uncaughtException', (e) => { if (e && (e.code === 'ECONNRESET' || e.code === 'EPIPE')) { console.error('[run] ignored transient socket error:', e.code); return; } throw e; });

const HERE = dirname(fileURLToPath(import.meta.url));
const PW_MCP_DIR = process.env.PW_MCP_DIR;
if (!PW_MCP_DIR) throw new Error('set PW_MCP_DIR');
const req = createRequire(join(PW_MCP_DIR, 'node_modules/@playwright/mcp/package.json'));
const { chromium } = req('playwright-core');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MCP_CLI = join(PW_MCP_DIR, 'node_modules/@playwright/mcp/cli.js');

const PROXY = 8899, CDP = 9333;
const MODEL = process.env.MODEL || 'claude-opus-4-8[1m]'; // E-001's actor model
const TASKS = {
  G1: 'Add a pricing section below the hero with three plan cards (Free, Pro, Team); each has a name, a price, a short feature list and a call-to-action button, and the Pro card is visually highlighted as recommended.',
  G2: 'Add a newsletter sign-up card below the hero: a heading, one line of supporting text, an email field with a subscribe button beside it, and a small helper line under the field; it should look polished and fit the page.',
  G3: 'Add a testimonials section below the hero: three quote cards in a responsive grid (one column on small screens, three on wide ones), each with the quote, the person\'s name, their role and a round avatar placeholder.',
};
const [T, ARM = 'arm0'] = process.argv.slice(2);
if (!TASKS[T]) throw new Error('usage: run.mjs <G1|G2|G3> <arm0|arm1|arm2>');
if (!['arm0', 'arm1', 'arm2'].includes(ARM)) throw new Error('arm must be arm0|arm1|arm2');
const app = await startApp('D');
const URL_ = app.url;
const prompt = (t) => `Page URL: ${URL_}

The page is styled with BaroCSS, a runtime utility-class CSS engine with Tailwind-compatible class names. Build the requested UI in the live page using BaroCSS class names only, not inline styles or hand-written CSS. Then verify that it renders as you intended and report whether the task is done.

Task: ${TASKS[t]}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function launchBrowser() {
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'e007-chr-'))}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', ...chromeArgs(PROXY), 'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`http://127.0.0.1:${CDP}/json/version`)).ok) return proc; } catch {}
    await sleep(200);
  }
  throw new Error('chromium did not start');
}

function runAgent(t, rawPath, hookState) {
  const cwd = mkdtempSync(join(tmpdir(), 'e011-agent-'));
  const mcp = join(cwd, 'mcp.json');
  writeFileSync(mcp, JSON.stringify({ mcpServers: { playwright: { command: 'node', args: [MCP_CLI, '--cdp-endpoint', `http://127.0.0.1:${CDP}`] } } }));
  const args = ['-p', prompt(t), '--output-format', 'stream-json', '--verbose', '--mcp-config', mcp, '--strict-mcp-config',
    '--model', MODEL, '--tools', '', '--allowedTools', 'mcp__playwright', '--setting-sources', '', '--no-session-persistence'];
  // arm1/arm2: register the PostToolUse report hook via an explicit --settings file (runner wiring, not a prompt change).
  if (hookState) {
    const stateFile = join(cwd, 'hookstate.json');
    writeFileSync(stateFile, JSON.stringify(hookState));
    const settings = { hooks: { PostToolUse: [ { matcher: 'mcp__playwright__browser_evaluate', hooks: [ { type: 'command', command: `node ${join(HERE, 'report_hook.mjs')} ${stateFile}` } ] } ] } };
    const settingsFile = join(cwd, 'settings.json');
    writeFileSync(settingsFile, JSON.stringify(settings));
    args.push('--settings', settingsFile);
  }
  return new Promise((ok) => {
    // Print mode otherwise starts turn 1 before MCP connects (agent sees zero tools).
    const p = spawn('claude', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, MCP_CONNECTION_NONBLOCKING: 'false' } });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d));
    const kill = setTimeout(() => p.kill('SIGTERM'), 20 * 60 * 1000);
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

// Per-token record for every PARITY-MISS (default page state) the agent wrote or left in the section (method step 4).
// Check hints = later calls (after the token's first write) by kind; which property was checked is read from the calls.
const HINTS = { computedStyle: /getComputedStyle/, cssText: /cssRules|styleSheets|getCss\s*\(|\.sheet\b|cssText/ };
function missRecords(tokens, def, an, grader, calls, finalText) {
  return tokens.filter((t) => def[t]?.class === 'PARITY-MISS').map((t) => {
    const first = an.firstCall[t];
    const later = first === undefined ? [] : calls.map((c, i) => ({ c, i })).filter(({ i }) => i > first);
    return {
      token: t, firstTry: an.firstTry.includes(t), firstCall: first ?? null,
      inFinalSection: grader.sectionTokens?.includes(t) ?? false,
      finalClassOnAgentPage: grader.sectionClass?.[t]?.class ?? null,
      namedInFinalText: !!finalText && finalText.includes(t),
      laterCallsNamingToken: later.filter(({ c }) => codeOf(c).includes(t)).map(({ i }) => i),
      laterChecks: {
        computedStyle: later.filter(({ c }) => HINTS.computedStyle.test(codeOf(c))).map(({ i }) => i),
        cssText: later.filter(({ c }) => HINTS.cssText.test(codeOf(c))).map(({ i }) => i),
        screenshot: later.filter(({ c }) => /screenshot/.test(c.tool)).map(({ i }) => i),
        console: later.filter(({ c }) => /console/.test(c.tool)).map(({ i }) => i),
      },
      bcRules: def[t].bcRules, undefinedVars: def[t].undefinedVars,
    };
  });
}

const guard = await startGuard(app.port, PROXY);
mkdirSync(join(HERE, 'runs'), { recursive: true });
const rawDir = mkdtempSync(join(tmpdir(), 'e011-raw-'));
const logPath = join(rawDir, `${T}.${ARM}.hooklog.jsonl`);
const donePath = join(rawDir, `${T}.${ARM}.injected`);
const proc = await launchBrowser();
try {
  let b = await chromium.connectOverCDP(`http://127.0.0.1:${CDP}`);
  const bp = await b.contexts()[0].newPage();
  await bp.goto(URL_); await bp.waitForSelector('body.baro-boot-done', { timeout: 15000 }); await sleep(300);
  const baseline = await baselineTree(bp);
  await bp.close(); await b.close();

  // arm1/arm2 wire the report hook; arm0 runs the E-007 harness unchanged (no hook). The hook computes the section
  // with the frozen grader diff over this baseline tree, so the report covers exactly the graded section.
  const hookState = ARM === 'arm0' ? null : { arm: ARM, cdpPort: CDP, appUrl: URL_, pwDir: PW_MCP_DIR, baselineTree: baseline, donePath, logPath };
  const agent = await runAgent(T, join(rawDir, `${T}.jsonl`), hookState);
  const run = condense(agent.lines);
  const injected = existsSync(logPath) ? readFileSync(logPath, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];

  b = await chromium.connectOverCDP(`http://127.0.0.1:${CDP}`);
  const pages = b.contexts().flatMap((c) => c.pages()).filter((p) => p.url().startsWith(URL_));
  let grader = { error: 'agent left no tab on the page URL', sectionTokens: [], sectionClass: {} };
  if (pages.length) grader = await gradeRun(pages[pages.length - 1], T, baseline, run.tool_calls);
  const an = await analyzeCalls(run.tool_calls);
  const fp = await b.contexts()[0].newPage();
  await fp.setViewportSize({ width: 1280, height: 900 });
  await fp.goto(URL_); await fp.waitForSelector('body.baro-boot-done', { timeout: 15000 }); await sleep(300);
  const all = [...new Set([...an.written, ...grader.sectionTokens])];
  const def = await classify(fp, all);
  await fp.close(); await b.close();

  const rec = {
    run: T, task: T, arm: ARM, pinnedCommit: 'bf979c6', prompt: prompt(T), agent_exit: agent.code, agent_stderr: agent.err.slice(0, 2000),
    injected_report: injected.filter((x) => x.text).map((x) => ({ added: x.added, rows: x.rows, text: x.text })),
    hook_events: injected,
    model: run.model, num_turns: run.num_turns, duration_ms: run.duration_ms, cost_usd: run.cost_usd, is_error: run.is_error,
    final_text: run.final_text,
    grader: { pass: grader.pass ?? false, reasons: grader.reasons ?? [grader.error], parts: grader.parts, writes: grader.scan?.writes, configCalls: grader.scan?.configCalls, remainingMisses: grader.remainingMisses, diff: grader.diff },
    first_try: { call: an.firstInsertCall, tokens: an.firstTry, counts: counts(an.firstTry, def), misses: an.firstTry.filter((t) => def[t].class === 'PARITY-MISS'), agent: an.firstTry.filter((t) => def[t].class === 'AGENT') },
    final_section: { tokens: grader.sectionTokens, counts: counts(grader.sectionTokens, grader.sectionClass), countsDefaultState: counts(grader.sectionTokens, def), misses: grader.remainingMisses, agent: grader.sectionTokens.filter((t) => grader.sectionClass[t]?.class === 'AGENT') },
    written: { tokens: an.written, counts: counts(an.written, def), perCall: an.perCall },
    parity_misses: missRecords(all, def, an, grader, run.tool_calls, run.final_text),
    classification_default_state: def, classification_final_page: grader.sectionClass,
    refused_requests: guard.refused.slice(0, 50),
    tools_available: run.tools_available, tool_calls: run.tool_calls, assistant_text: run.assistant_text,
  };
  writeFileSync(join(HERE, 'runs', `${T}.${ARM}.json`), JSON.stringify(rec, null, 2) + '\n');
  console.log(T, ARM, 'grader:', rec.grader.pass, rec.grader.reasons.join('; '), '| first-try misses:', rec.first_try.misses.join(' ') || '-', '| injected:', rec.injected_report.length ? `${rec.injected_report[0].rows?.filter((r) => r.status && r.status !== 'RESOLVED').length ?? '?'} non-resolved flagged` : 'none', '| turns:', rec.num_turns, '| cost:', rec.cost_usd, '| raw:', join(rawDir, `${T}.jsonl`));
} finally { proc.kill('SIGTERM'); await sleep(500); guard.close(); app.stop(); }

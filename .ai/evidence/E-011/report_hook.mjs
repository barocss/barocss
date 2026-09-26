// E-011 PostToolUse hook (runner wiring only — no prompt/task/model/tool change). Fires after each Playwright
// tool call the actor makes. On the actor's FIRST DOM-inserting browser_evaluate (and only then), it computes the
// arm's report for the just-generated section and returns it as `additionalContext`, so the actor sees the report in
// the SAME context right after it generates and BEFORE it verifies/claims done (AGENTS.md §3 method step 6).
// The report content is the experimental treatment; the hook adds no instruction to bypass anything.
//
// Usage: configured in a per-run settings.json written by run.mjs:
//   { "hooks": { "PostToolUse": [ { "matcher": "mcp__playwright__browser_evaluate",
//       "hooks": [ { "type": "command", "command": "node <abs>/report_hook.mjs <stateFile>" } ] } ] } }
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { codeOf, isDomInsert } from './classify.mjs';
import { computeReport } from './arm_report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
let LOGPATH = join(HERE, '.hooklog.jsonl');
const emit = (ctx) => { if (ctx) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: ctx } })); process.exit(0); };
const log = (obj) => { try { writeFileSync(LOGPATH, JSON.stringify({ ...obj }) + '\n', { flag: 'a' }); } catch {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const stateFile = process.argv[2];
let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', async () => {
  let hook, state;
  try { hook = JSON.parse(input); state = JSON.parse(readFileSync(stateFile, 'utf8')); } catch (e) { log({ err: 'parse', e: String(e) }); emit(null); return; }
  if (state.logPath) LOGPATH = state.logPath;
  try {
    if (existsSync(state.donePath)) { emit(null); return; }               // already injected once
    const call = { input: hook.tool_input || {} };
    if (!isDomInsert(call)) { log({ skip: 'not-dom-insert', tool: hook.tool_name, code: codeOf(call).slice(0, 120) }); emit(null); return; }
    writeFileSync(state.donePath, '1');                                    // claim the first-insert slot before the async read
    const req = createRequire(join(state.pwDir, 'node_modules/@playwright/mcp/package.json'));
    const { chromium } = req('playwright-core');
    const b = await chromium.connectOverCDP(`http://127.0.0.1:${state.cdpPort}`);
    const pages = b.contexts().flatMap((c) => c.pages()).filter((p) => p.url().startsWith(state.appUrl));
    if (!pages.length) { await b.close(); log({ err: 'no-page' }); emit(null); return; }
    const page = pages[pages.length - 1];
    await sleep(1400);                                                     // let the runtime observer cache newly-added classes
    const report = await computeReport(page, state.arm, state.baselineTree);
    await b.close();
    log({ arm: state.arm, added: report.added?.length, rows: report.rows, text: report.text });
    emit(report.text);
  } catch (e) { log({ err: 'run', e: String(e && e.stack || e) }); emit(null); }
});

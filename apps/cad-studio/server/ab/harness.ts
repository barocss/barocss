// The brief harness (A5.5, O13): each brief, each run, on a fresh document, through the real chat server
// (server/chatServer.ts: the CLI spawned with the v2 tools and prompt, the MCP tool server on a state file). It was
// the v1/v2 A/B until O105 dropped v1 and the json arm with it; one arm is left, `hybrid`. The
// agent is the `claude` CLI (live) or the scripted stand-in (dry run: test/fixtures/scripted-claude.mjs makes the
// brief's ideal calls through the same path). The part it leaves is checked against the brief's oracle — hard
// requirements the agent never sees — by the kernel. Measured per run: pass, the oracle's outcomes, tool calls,
// refusals, wall time, tokens (the CLI's usage when live; estimated from what was sent when scripted).
import { createServer, type Server } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { checkSpec } from '@barocss/cad-model/chat/spec';
import { TOOLSET } from '@barocss/cad-model/chat/toolset';
import { createChatServer, stateNote, type TurnUsage } from '../chatServer';
import type { Arm, Brief, Call } from './briefs';
import { turnEventsOf } from '../turnEvents';

/** Characters a token, for the scripted estimate (an estimate: English and JSON run about 3.5–4.5). */
export const CHARS_PER_TOKEN = 4;

export interface Tokens { input: number; output: number; /** Input not read from the prompt cache (each turn's new part). */ newInput: number; estimated: boolean; cost_usd?: number }
export interface RunResult {
  brief: string; arm: Arm; run: number; variant: number;
  pass: boolean; oracle: { id: string; status: string; measured?: unknown }[];
  calls: number; refusals: number; tools: string[]; wallMs: number; end: string; error?: string; tokens: Tokens;
}
export interface AbOptions {
  mode: 'scripted' | 'live';
  briefs: Brief[]; arms: Arm[]; runs: number;
  /** The CLI: `claude` (live) or the scripted stand-in. */
  claude: string; model?: string;
  /** The bundled MCP tool server (server/cadMcp.ts). */
  mcpScript: string;
  workDir: string;
  log?: (line: string) => void;
}

const ORIGIN = 'http://ab.localhost';
let revision = 1;
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, revision++);

/** One turn through the chat server: its events. */
async function turn(url: string, body: object): Promise<{ events: { type: string; [k: string]: any }[] }> {
  const r = await fetch(`${url}/turn`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`the chat server answered ${r.status}: ${await r.text()}`);
  return { events: turnEventsOf(await r.text()) };
}

/** What a model reads and writes for the calls the scripted agent made (one call a model turn, then the answer). */
export function estimateTokens(userText: string, log: { args: number; result: number }[]): Tokens {
  const set = TOOLSET;
  // (The CLI sends the MCP tools as API tools: their names prefixed, description, input schema.)
  const fixed = set.prompt.length + JSON.stringify(set.tools.map(t => ({ name: `mcp__cad__${t.name}`, description: t.description, input_schema: t.input_schema }))).length + userText.length;
  const TOOL_USE = 60, TOOL_RESULT = 40, ANSWER = 300;
  let input = 0, history = 0, output = ANSWER;
  for (let k = 0; k <= log.length; k++) {
    input += fixed + history;
    if (k < log.length) { history += log[k].args + TOOL_USE + log[k].result + TOOL_RESULT; output += log[k].args + TOOL_USE; }
  }
  const newInput = fixed + log.reduce((s, c) => s + c.args + TOOL_USE + c.result + TOOL_RESULT, 0);
  const t = (c: number) => Math.round(c / CHARS_PER_TOKEN);
  return { input: t(input), output: t(output), newInput: t(newInput), estimated: true };
}
const fromUsage = (u: TurnUsage | undefined): Tokens => ({
  input: (u?.input_tokens ?? 0) + (u?.cache_read_input_tokens ?? 0) + (u?.cache_creation_input_tokens ?? 0), output: u?.output_tokens ?? 0,
  newInput: (u?.input_tokens ?? 0) + (u?.cache_creation_input_tokens ?? 0), estimated: false, ...(u?.total_cost_usd !== undefined ? { cost_usd: u.total_cost_usd } : {}),
});

/** The part checked against the brief's oracle (its own requirements set aside): each outcome, and whether every hard one passed. */
export async function oracleOf(doc: StudioDoc, brief: Brief, variant: number): Promise<{ pass: boolean; oracle: RunResult['oracle'] }> {
  const reqs = brief.oracle(brief.variants[variant]), checked = { ...doc, requirements: reqs };
  const r = await evaluate(checked);
  if (!r.ok) return { pass: false, oracle: reqs.map(q => ({ id: q.id, status: 'unknown', measured: 'the part does not evaluate' })) };
  const spec = await checkSpec(checked, r.bodies, evaluate);
  const oracle = reqs.map(q => { const o = spec.outcomes.get(q.id); return { id: q.id, status: o?.status ?? 'unknown', ...(o && 'measured' in o ? { measured: (o as { measured?: unknown }).measured } : {}) }; });
  return { pass: reqs.filter(q => q.hard).every(q => oracle.find(o => o.id === q.id)?.status === 'pass'), oracle };
}

/** Runs every brief × arm × run, one at a time. */
export async function runAb(o: AbOptions): Promise<RunResult[]> {
  const handler = createChatServer({ claude: o.claude, ...(o.model ? { model: o.model } : {}), mcpScript: o.mcpScript, workDir: o.workDir, origins: [ORIGIN] });
  const server: Server = createServer((req, res) => { void handler(req, res); });
  await new Promise<void>(res => server.listen(0, '127.0.0.1', res));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const saved = { log: process.env.CAD_AB_LOG }, out: RunResult[] = [];
  try {
    for (const brief of o.briefs) for (let run = 0; run < o.runs; run++) for (const arm of o.arms) {
      const variant = run % brief.variants.length, p = brief.variants[variant], prompt = brief.prompt(p);
      const logDir = mkdtempSync(join(o.workDir, 'ab-')), logPath = join(logDir, 'calls.jsonl');
      process.env.CAD_AB_LOG = logPath;
      const calls: Call[] | undefined = o.mode === 'scripted' ? brief.scripted[arm](p) : undefined;
      const text = calls ? `${prompt}\n\nscript ${JSON.stringify({ calls })}` : prompt;
      const t0 = Date.now(), { events } = await turn(url, { text, doc: emptyDoc(), autonomy: 2 }), wallMs = Date.now() - t0;
      const tools = events.filter(e => e.type === 'tool'), done = events.find(e => e.type === 'done');
      const doc: StudioDoc = done?.doc ?? emptyDoc();
      const { pass, oracle } = await oracleOf(doc, brief, variant);
      let log: { args: number; result: number }[] = [];
      try { log = readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { /* live: none */ }
      const tokens = o.mode === 'scripted' ? estimateTokens(`${stateNote(emptyDoc(), 2)}\n\n${prompt}`, log) : fromUsage(done?.usage);
      const r: RunResult = { brief: brief.id, arm, run, variant, pass, oracle, calls: tools.length, refusals: tools.filter(e => e.isError).length, tools: tools.map(e => String(e.name)), wallMs, end: String(done?.end ?? 'none'), ...(done?.error ? { error: String(done.error) } : {}), tokens };
      out.push(r);
      o.log?.(`${brief.id} ${arm} #${run}: ${pass ? 'pass' : 'FAIL'} — ${r.calls} calls, ${r.refusals} refused, ${tokens.input} in / ${tokens.output} out tokens${tokens.estimated ? ' (est.)' : ''}, ${wallMs} ms`);
      rmSync(logDir, { recursive: true, force: true });
    }
  } finally {
    if (saved.log === undefined) delete process.env.CAD_AB_LOG; else process.env.CAD_AB_LOG = saved.log;
    await new Promise<void>(res => server.close(() => res()));
  }
  return out;
}

export interface ArmSummary { runs: number; passed: number; passAtK: boolean; passPowK: boolean; calls: number; refusals: number; tokens: { input: number; newInput: number; output: number }; wallMs: number }
/** Per brief and arm: passes, pass@k (any of the k runs) and pass^k (all of them), and the means; then the totals per arm. */
export function summarizeAb(results: readonly RunResult[]): { byBrief: Record<string, Partial<Record<Arm, ArmSummary>>>; byArm: Partial<Record<Arm, ArmSummary & { briefs: number; passRate: number }>> } {
  const byBrief: Record<string, Partial<Record<Arm, ArmSummary>>> = {};
  const mean = (xs: number[]) => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;
  const mean1 = (xs: number[]) => xs.length ? Math.round(10 * xs.reduce((a, b) => a + b, 0) / xs.length) / 10 : 0;
  const group = (rs: readonly RunResult[]): ArmSummary => ({
    runs: rs.length, passed: rs.filter(r => r.pass).length, passAtK: rs.some(r => r.pass), passPowK: rs.every(r => r.pass),
    calls: mean1(rs.map(r => r.calls)), refusals: mean1(rs.map(r => r.refusals)), wallMs: mean(rs.map(r => r.wallMs)),
    tokens: { input: mean(rs.map(r => r.tokens.input)), newInput: mean(rs.map(r => r.tokens.newInput)), output: mean(rs.map(r => r.tokens.output)) },
  });
  for (const id of [...new Set(results.map(r => r.brief))]) for (const arm of [...new Set(results.map(r => r.arm))]) {
    const rs = results.filter(r => r.brief === id && r.arm === arm);
    if (rs.length) (byBrief[id] ??= {})[arm] = group(rs);
  }
  const byArm: Partial<Record<Arm, ArmSummary & { briefs: number; passRate: number }>> = {};
  for (const arm of [...new Set(results.map(r => r.arm))]) {
    const rs = results.filter(r => r.arm === arm);
    byArm[arm] = { ...group(rs), briefs: new Set(rs.map(r => r.brief)).size, passRate: rs.length ? rs.filter(r => r.pass).length / rs.length : 0 };
  }
  return { byBrief, byArm };
}

/** The report as Markdown: the table per brief and arm, the totals, how the tokens were counted. */
export function reportAb(results: readonly RunResult[], mode: 'scripted' | 'live'): string {
  const s = summarizeAb(results), arms = [...new Set(results.map(r => r.arm))];
  const row = (id: string, arm: Arm, a: ArmSummary) => `| ${id} | ${arm} | ${a.passed}/${a.runs} | ${a.passAtK ? 'yes' : 'no'} | ${a.passPowK ? 'yes' : 'no'} | ${a.calls} | ${a.refusals} | ${a.tokens.input} | ${a.tokens.newInput} | ${a.tokens.output} | ${a.wallMs} |`;
  return [
    `# Briefs ${mode === 'scripted' ? 'dry run (scripted agent)' : 'live run'}`, '',
    `Arm: hybrid (the v2 tools with model.run; the json arm went with v1, O105). Tokens ${mode === 'scripted' ? `estimated at ${CHARS_PER_TOKEN} characters a token from what each model turn would read (one tool call a turn)` : 'as the CLI reported them'}; "new" is input not read from the prompt cache.`, '',
    '| brief | arm | passed | pass@k | pass^k | calls | refused | input tokens | new input | output | wall ms |', '|---|---|---|---|---|---|---|---|---|---|---|',
    ...Object.entries(s.byBrief).flatMap(([id, a]) => arms.filter(arm => a[arm]).map(arm => row(id, arm, a[arm]!))), '',
    '| arm | briefs | pass rate | calls a brief | refused | input tokens a brief | new input | output |', '|---|---|---|---|---|---|---|---|',
    ...arms.map(arm => { const a = s.byArm[arm]!; return `| ${arm} | ${a.briefs} | ${(100 * a.passRate).toFixed(0)} % | ${a.calls} | ${a.refusals} | ${a.tokens.input} | ${a.tokens.newInput} | ${a.tokens.output} |`; }), '',
  ].join('\n');
}

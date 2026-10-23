// O15, RD10's L3 run (O46's protocol, the owner's go-ahead 2026-10-23): a model sizes arm-3r from O48's undersized start
// with RD9's harness as its tool (robot_check, listed for this run only), through the real chat server and cad-mcp, as a
// chat turn runs. Each run is independent: a fresh folder, the same start, the byte-identical prompt, no session resumed.
// Success is decided only by a fresh `cad-cli robot-check` on what the run saved — the part and the duty it last checked
// — with the brief's own terms (poses, dwells, life) unchanged; never by the model's word. Guards: the CLI's own
// --max-budget-usd (8), a 30-minute wall clock, the chat's turn cap; a run whose result reports no total_cost_usd counts
// as over budget and stops the series; no run starts that could take the total past US$25. A failed run is recorded as
// it is: the brief is never edited and run again.
//   node scripts/robot-l3.mjs --scripted [--runs 3] --out dir          the dry run (scripted-claude follows the sizer's answer)
//   CAD_ROBOT_L3_LIVE=1 node scripts/robot-l3.mjs --live --out dir      the live run (billed; the owner's go-ahead, O15)
import { createServer, type Server } from 'node:http';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { readStudioDoc } from '@barocss/cad-model/engine/migrate';
import { encodeStudioFile } from '@barocss/cad-model/engine/container';
import { robotSizeOfDoc } from '@barocss/cad-model/chat/robot';
import type { Duty } from '@barocss/cad-model/robot/harness';
import { createChatServer } from '../chatServer';
import { withRatings } from './tool';
import { turnEventsOf } from '../turnEvents';

export const MODEL = 'claude-opus-5-5';
// (CAD_ROBOT_L3_WALL_MS: the wall clock's test-only override, for the dry run's hang check.)
const RUN_BUDGET_USD = 8, TOTAL_BUDGET_USD = 25, WALL_MS = Number(process.env.CAD_ROBOT_L3_WALL_MS) || 30 * 60 * 1000, ORIGIN = 'http://robot-l3.localhost';
const P1 = { 'base~l1': 1, 'l1~l2': 0.9, 'l2~l3': 0.6 }, P2 = { 'base~l1': -0.8, 'l1~l2': -1, 'l2~l3': -0.7 };
/** O48's brief: arm-3r between two poses, 0.5 s dwells, 20 000 h, at 6 rad/s and 60 rad/s². */
const BRIEF: Duty = { moves: [{ from: {}, to: P1, profile: 'trapezoid', limits: { velocity: 6, acceleration: 60 }, dwell_s: 0.5 }, { from: P1, to: P2, profile: 'trapezoid', limits: { velocity: 6, acceleration: 60 }, dwell_s: 0.5 }], life_h: 20000 };
const on = (ratio: number) => ({ motor: 'maxon-608131', reducer: `hd-csg-14-${ratio}-2a-r-bb-lw` });

/** O48's undersized start: ratings 1 rad/s and 1 N·m, every joint on 100:1. */
export function start(conformance: string): { doc: StudioDoc; duty: Duty } {
  const r = readStudioDoc(readFileSync(join(conformance, 'rd/arm-3r/robot.bcad'), 'utf8'));
  if (!('doc' in r)) throw new Error(r.error);
  const joints = Object.fromEntries(Object.entries(r.doc.robot!.joints!).map(([k, v]) => [k, { ...v, velocity: 1, effort: 1 }]));
  return { doc: { ...r.doc, robot: { version: 1, joints } }, duty: { ...BRIEF, actuators: { 'base~l1': on(100), 'l1~l2': on(100), 'l2~l3': on(100) } } };
}

/** The brief as the model reads it: byte-identical across runs (its sha256 recorded). */
export function prompt(duty: Duty): string {
  return [
    'Size this robot arm (arm-3r: three turning joints base~l1, l1~l2, l2~l3; a 1.7 kg payload locked on l3) for its duty, so that every margin of robot_check is above 0.',
    'Its joint ratings and its actuators are too small for the duty. You may change: the joints\' ratings (robot_check\'s "joints": velocity, effort), the actuators (a motor and a reducer per joint, in the duty\'s "actuators"; assembly.size lists the pairs that suit a move), and the motion profile (the moves\' "limits").',
    'Do not change the arm\'s geometry, the poses ("from", "to"), the dwells or the life.',
    'Check with robot_check, passing the ratings and the duty you chose; the last design you check is the one judged. When every margin is above 0, stop and say what you changed.',
    '', `The duty: ${JSON.stringify(duty)}`,
  ].join('\n');
}

const sha = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');
/** Whether the duty the run saved keeps the brief's own terms: the same moves' poses, profiles and dwells, the same life. */
export function keepsBrief(saved: Duty, brief: Duty): string | null {
  if (saved.life_h !== brief.life_h) return `the life changed (${saved.life_h} h, the brief's ${brief.life_h} h)`;
  if (saved.moves.length !== brief.moves.length) return 'the moves changed';
  for (const [i, m] of saved.moves.entries()) {
    const b = brief.moves[i];
    if (JSON.stringify(m.from) !== JSON.stringify(b.from) || JSON.stringify(m.to) !== JSON.stringify(b.to) || m.dwell_s !== b.dwell_s) return `move ${i}'s poses or dwell changed`;
  }
  return null;
}

export interface RunRecord {
  run: number; model: string; promptSha256: string; end: string; error?: string; wallMs: number;
  usage: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number; num_turns?: number; total_cost_usd?: number } | null;
  transcriptSha256: string; tools: { name: string; isError: boolean }[]; checks: { ok: boolean; least: unknown; failing: number; unknowns: number; actuators: unknown; joints: unknown }[];
  result: { pass: boolean; why: string; exit: number | null; least: unknown; margins: number };
}

/** One run in its own folder through a fresh chat server: the record, and the part and duty it left (in `dir`). */
async function oneRun(k: number, o: { claude: string; mcpScript: string; cli: string; conformance: string; dir: string; scripted?: (s: { doc: StudioDoc; duty: Duty }) => Promise<string>; costEnv?: string }): Promise<RunRecord> {
  const s = start(o.conformance), text = prompt(s.duty), dutyPath = join(o.dir, 'duty.json'), logPath = join(o.dir, 'checks.jsonl');
  writeFileSync(dutyPath, JSON.stringify(s.duty, null, 1) + '\n'); writeFileSync(logPath, '');
  const env = { CAD_ROBOT_L3: '1', CAD_ROBOT_L3_DUTY: dutyPath, CAD_ROBOT_L3_LOG: logPath, CAD_MAX_BUDGET_USD: String(RUN_BUDGET_USD), ...(o.costEnv ? { CAD_SCRIPTED_COST_USD: o.costEnv } : {}) };
  const was = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  const handler = createChatServer({ claude: o.claude, model: MODEL, mcpScript: o.mcpScript, workDir: o.dir, origins: [ORIGIN] });
  const server: Server = createServer((req, res) => { void handler(req, res); });
  await new Promise<void>(res => server.listen(0, '127.0.0.1', res));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`, abort = new AbortController(), timer = setTimeout(() => abort.abort(), WALL_MS);
  const t0 = Date.now();
  const events: { type: string; [key: string]: any }[] = [];
  let raw = '', end = 'error', error: string | undefined;
  try {
    const body = { text: o.scripted ? `${text}\n\n${await o.scripted(s)}` : text, doc: s.doc, autonomy: 4 };
    const r = await fetch(`${url}/turn`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify(body), signal: abort.signal });
    raw = await r.text();
    events.push(...turnEventsOf(raw));
    const done = events.find(e => e.type === 'done'); end = String(done?.end ?? 'error'); error = done?.error;
  } catch (e) { end = abort.signal.aborted ? 'wall-clock' : 'error'; error = e instanceof Error ? e.message : String(e); }
  finally {
    clearTimeout(timer); await new Promise<void>(res => server.close(() => res()));
    for (const [key, v] of Object.entries(was)) { if (v === undefined) delete process.env[key]; else process.env[key] = v; }
  }
  const wallMs = Date.now() - t0, done = events.find(e => e.type === 'done');
  // (The design the run last checked — the part with the ratings it passed, and the duty — saved, then judged afresh.)
  let ratings: Record<string, { velocity?: number; effort?: number }> = {};
  try { ratings = JSON.parse(readFileSync(join(o.dir, 'duty.joints.json'), 'utf8')); } catch { /* none passed */ }
  const doc: StudioDoc = withRatings(done?.doc ?? s.doc, ratings), part = join(o.dir, 'sized.bcad'); writeFileSync(part, encodeStudioFile(doc));
  writeFileSync(join(o.dir, 'transcript.txt'), raw);
  const saved = JSON.parse(readFileSync(dutyPath, 'utf8')) as Duty, changedBrief = keepsBrief(saved, BRIEF);
  // (Asynchronous: a blocking spawn here held the event loop, and with it the chat server's kill of a timed-out CLI.)
  const fresh = await new Promise<{ status: number | null; stdout: string }>(res => execFile(process.execPath, [o.cli, 'robot-check', part, dutyPath], { encoding: 'utf8', maxBuffer: 64 << 20 }, (e, stdout) => res({ status: e ? (typeof e.code === 'number' ? e.code : null) : 0, stdout })));
  let report: { ok?: boolean; least?: unknown; margins?: { ok: boolean }[] } = {};
  try { report = JSON.parse(fresh.stdout); } catch { /* none */ }
  const pass = !changedBrief && fresh.status === 0 && report.ok === true;
  return {
    run: k, model: MODEL, promptSha256: sha(text), end, ...(error ? { error } : {}), wallMs,
    usage: done?.usage ?? null, transcriptSha256: sha(raw),
    tools: events.filter(e => e.type === 'tool').map(e => ({ name: String(e.name), isError: !!e.isError })),
    checks: readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)),
    result: { pass, why: changedBrief ?? (pass ? 'every margin above 0 on a fresh harness run' : fresh.status === 0 ? 'the fresh run did not pass' : `the fresh harness run failed (exit ${fresh.status})`), exit: fresh.status, least: report.least ?? null, margins: report.margins?.length ?? 0 },
  };
}

/** The scripted dry run's calls: the sizer's own answer, as a model would make it. */
async function sizerScript(s: { doc: StudioDoc; duty: Duty }): Promise<string> {
  const evaluate = async (d: StudioDoc) => evaluatePart(d, 1), e = await evaluate(s.doc);
  if (!e.ok) throw new Error('the start does not evaluate');
  const { sized, doc } = await robotSizeOfDoc(s.doc, e.bodies, evaluate, s.duty);
  const joints = Object.fromEntries(Object.entries(doc.robot!.joints!).map(([k, v]) => [k, { velocity: v.velocity, effort: v.effort }]));
  return `script ${JSON.stringify({ calls: [
    { tool: 'robot_check', args: { duty: s.duty } },
    { tool: 'robot_check', args: { joints, duty: sized.duty } },
  ] })}`;
}

export async function robotL3Main(argv: readonly string[], paths: { mcpScript: string; scripted: string; cli: string; conformance: string }): Promise<number> {
  const get = (key: string) => { const i = argv.indexOf(key); return i >= 0 ? argv[i + 1] : undefined; };
  const live = argv.includes('--live'), scripted = argv.includes('--scripted');
  if (live === scripted) { process.stderr.write('robot-l3: pass --scripted (the dry run) or --live\n'); return 2; }
  if (live && process.env.CAD_ROBOT_L3_LIVE !== '1') { process.stderr.write('robot-l3: live runs call the model and are billed: set CAD_ROBOT_L3_LIVE=1 as well as --live\n'); return 2; }
  const runs = Number(get('--runs') ?? 3), out = resolve(get('--out') ?? 'robot-l3-out');
  if (!Number.isInteger(runs) || runs < 1) { process.stderr.write('robot-l3: --runs is a whole number\n'); return 2; }
  mkdirSync(out, { recursive: true });
  const records: RunRecord[] = [];
  let total = 0, stopped: string | null = null;
  for (let k = 1; k <= runs; k++) {
    if (total + RUN_BUDGET_USD > TOTAL_BUDGET_USD) { stopped = `run ${k} not started: the total (US$${total.toFixed(2)}) could pass US$${TOTAL_BUDGET_USD}`; break; }
    const dir = mkdtempSync(join(out, `run${k}-`));
    const r = await oneRun(k, { claude: live ? (process.env.CAD_STUDIO_CLAUDE ?? 'claude') : paths.scripted, mcpScript: paths.mcpScript, cli: paths.cli, conformance: paths.conformance, dir, ...(scripted ? { scripted: sizerScript, costEnv: get('--fake-cost') ?? '0.01' } : {}) });
    records.push(r);
    writeFileSync(join(out, 'records.json'), JSON.stringify({ records, total, stopped }, null, 1) + '\n');
    process.stdout.write(`run ${k}: ${r.result.pass ? 'PASS' : 'FAIL'} — ${r.result.why}; end ${r.end}; cost ${r.usage?.total_cost_usd ?? 'none reported'}; ${r.checks.length} checks, ${r.tools.length} calls, ${Math.round(r.wallMs / 1000)} s\n`);
    // (The model never ran — the CLI refused at once, as at an account's usage limit: not a model's failure, and no run is
    // spent on the next.)
    if (r.end === 'error' && !(r.usage?.output_tokens)) { stopped = `run ${k}: the CLI did not run the model (${r.error ?? 'no reason given'}): the series stops`; break; }
    const cost = r.usage?.total_cost_usd;
    if (typeof cost !== 'number') { stopped = `run ${k} reported no total_cost_usd: treated as over budget, the series stops`; break; }
    total += cost;
    if (cost > RUN_BUDGET_USD) { stopped = `run ${k} cost US$${cost} (over US$${RUN_BUDGET_USD}): the series stops`; break; }
  }
  writeFileSync(join(out, 'records.json'), JSON.stringify({ records, total, stopped }, null, 1) + '\n');
  process.stdout.write(`total US$${total.toFixed(4)}${stopped ? `; stopped: ${stopped}` : ''}\nwritten: ${join(out, 'records.json')}\n`);
  return 0;
}

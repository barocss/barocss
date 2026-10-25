// The AI evaluation (2026-10-24, the owner: "AI 로 어디까지 되는지 제대로 확인 해줘"): Codex given each brief of the
// ladder (briefs.ts) through the studio's v2 tools (codex.ts), the part it leaves judged afresh by the brief's oracle in
// a new process (oracle.ts), k runs a brief. Runs are kept for the future gallery site in the store (store.ts has the
// layout and the schemas), by default ~/.cache/barocss-ai-eval/<brief-id>/<run-n>/. Nothing here is committed output.
//   node scripts/ai-eval/ai-eval.mjs run [--briefs a,b] [--runs 3] [--parallel 2] [--model m] [--effort high] [--max-calls 120] [--max-turns 4] [--wall-min 40] [--store dir]
//   node scripts/ai-eval/ai-eval.mjs judge <run dir>      the run's part judged again (a fresh process)
//   node scripts/ai-eval/ai-eval.mjs rejudge [--briefs a,b] every kept run judged again, then the report
//   node scripts/ai-eval/ai-eval.mjs report [--store dir] index.json and report.md from every run kept
//   node scripts/ai-eval/ai-eval.mjs migrate              the first layout (runs/…) moved into <brief-id>/<run-n>/
//   node scripts/ai-eval/ai-eval.mjs list                 the ladder
import { execFile, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { receivePersonRowFiles, type RowFileInput } from '@barocss/cad-model/engine/rowFiles';
import { TOOLSET, listed } from '@barocss/cad-model/chat/toolset';
import { BRIEFS, type Brief } from './briefs';
import { runCodex, type CodexRun } from './codex';
import { elementsOf, judge, scoreOf, type Review, type Score } from './oracle';
import { CAMERA_SCHEMA, INDEX_SCHEMA, RECORD_SCHEMA, SCORE_SCHEMA, migrate, newRunDir, runDirs } from './store';
import { AUTONOMY } from './codex';
import { lookOf } from '@barocss/cad-model/app/bodies';
import { dispatchTool, acceptProposal, type ChatState } from '@barocss/cad-model/chat/tools';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { RUNGS } from '@barocss/cad-model/rb9/rungs';
import { sample } from '@barocss/cad-model/rb9/core';
import { renderBodies, type Camera, type View } from './render';
import type { PlacedBody } from '@barocss/cad-model/team/clearanceMap';

const GATE = join(homedir(), '.claude/local-mods/barocss-lanes-guard/bin/gate.sh');
const sha = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');
const get = (argv: readonly string[], k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };

/** The document the person opened, or an empty part. */
async function startOf(b: Brief): Promise<StudioDoc> {
  if (!b.start) return emptyDoc();
  const r = await readStudioFile(new Uint8Array(readFileSync(b.start)));
  if ('error' in r) throw new Error(`${b.start}: ${r.error}`);
  return r.doc;
}
/** The person's attachments: each file at turn 1, and the note the chat server adds to the message (chatServer.ts). */
function attachments(b: Brief, conversation: string): { rowFiles?: RowFileInput[]; rowNote: string } {
  if (!b.files?.length) return { rowNote: '' };
  const rowFiles = b.files.map(path => ({ name: basename(path), text: readFileSync(path, 'utf8'), turn: 1 }));
  const files = receivePersonRowFiles(conversation, rowFiles, 1);
  return { rowFiles, rowNote: '\n\n[Files supplied by the person in this conversation; features.load_rows takes file by id:\n' + files.files.map(f => `${f.id}: ${JSON.stringify(f.source.filename)} (user turn ${f.source.turn}, SHA256 ${f.source.sha256})`).join('\n') + ']' };
}

/** The harness's version: its commit (and "+dirty"), passed by ai-eval.mjs; the tool contract's beside it. */
const HARNESS = process.env.AI_EVAL_HARNESS ?? 'unknown';
export interface RunRecord {
  schema?: string; n?: number; harness?: string; tools?: string; autonomy?: number; caps?: { maxCalls: number; maxTurns: number; wallMs: number };
  brief: string; ladder: string; title: string; run: string; model: string; effort: string; at: string;
  promptSha256: string; end: CodexRun['end']; error?: string; wallMs: number; turns: number;
  calls: CodexRun['calls']; refusals: number; messages: string[]; usage: CodexRun['usage']; accepted: CodexRun['accepted'];
  /** What a model reads each turn before the conversation: the tools as listed, the system prompt, the first message (A5.1's budget is 25 000 for the first two). */
  budget: { toolsChars: number; promptChars: number; messageChars: number };
}

async function oneRun(b: Brief, k: number, o: { store: string; mcpScript: string; model?: string; effort: string; maxCalls: number; maxTurns: number; wallMs: number; self: string }): Promise<string> {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, ''), id = `${stamp}-r${k}`;
  const { n, dir } = newRunDir(o.store, b.id), work = join(dir, 'work');
  mkdirSync(work, { recursive: true });
  const conversation = sha(`${b.id}/${id}`).slice(0, 24), doc = await startOf(b), { rowFiles, rowNote } = attachments(b, conversation);
  // (The machine's load first, the lanes' light gate: a run is mostly the model's time, its tool calls light.)
  spawnSync('sh', [GATE, 'acquire', 'light', '900', `ai-eval ${b.id}`], { stdio: 'inherit' });
  const caps = { maxCalls: b.caps?.maxCalls ?? o.maxCalls, maxTurns: b.caps?.maxTurns ?? o.maxTurns, wallMs: b.caps?.wallMin ? b.caps.wallMin * 60_000 : o.wallMs };
  const run = await runCodex({ dir: work, node: process.execPath, mcpScript: o.mcpScript, ...(o.model ? { model: o.model } : {}), effort: o.effort, doc, brief: b.prompt, ...(rowFiles ? { rowFiles } : {}), rowNote, conversation, ...caps });
  const prompt = readFileSync(join(work, 'prompt.txt'), 'utf8');
  writeFileSync(join(dir, 'prompt.txt'), prompt);
  writeFileSync(join(dir, 'part.bcad'), encodeStudioFile(run.doc));
  const record: RunRecord = {
    schema: RECORD_SCHEMA, n, harness: HARNESS, tools: TOOLSET.version, autonomy: AUTONOMY, caps,
    brief: b.id, ladder: b.ladder, title: b.title, run: id, model: o.model ?? 'codex default', effort: o.effort, at: new Date().toISOString(),
    promptSha256: sha(prompt), end: run.end, ...(run.error ? { error: run.error } : {}), wallMs: run.wallMs, turns: run.turns,
    calls: run.calls, refusals: run.calls.filter(c => !c.ok).length, messages: run.messages, usage: run.usage, accepted: run.accepted,
    budget: { toolsChars: JSON.stringify(TOOLSET.tools.map(listed)).length, promptChars: TOOLSET.prompt.length, messageChars: prompt.length },
  };
  writeFileSync(join(dir, 'record.json'), JSON.stringify(record, null, 1) + '\n');
  // (Judged in a new process, from the saved file alone: never this process's state, never the model's word.)
  await new Promise<void>(res => execFile(process.execPath, [o.self, 'judge', dir], { maxBuffer: 64 << 20 }, (e, out, err) => { if (e) process.stderr.write(`judge ${dir}: ${err || e.message}\n`); res(); }));
  let score: Partial<Score> = {}; try { score = JSON.parse(readFileSync(join(dir, 'score.json'), 'utf8')); } catch { /* not judged */ }
  return `${b.id} #${n} (r${k}): ${score.pass ? 'PASS' : 'FAIL'} ${score.hardPassed ?? '?'}/${score.hard ?? '?'} hard, score ${score.score ?? '?'}; end ${run.end}; ${run.turns} turns, ${run.calls.length} calls (${record.refusals} refused), ${Math.round(run.wallMs / 1000)} s`;
}

const VIEWS_SAVED: View[] = ['iso', 'iso-back', 'front', 'side', 'top'];
/** The run judged afresh: score.json, the stills and their cameras beside its part. */
async function judgeRun(dir: string): Promise<number> {
  const record = JSON.parse(readFileSync(join(dir, 'record.json'), 'utf8')) as RunRecord, b = BRIEFS.find(x => x.id === record.brief);
  if (!b) { process.stderr.write(`no brief ${record.brief}\n`); return 2; }
  const read = await readStudioFile(new Uint8Array(readFileSync(join(dir, 'part.bcad'))));
  if ('error' in read) { writeFileSync(join(dir, 'score.json'), JSON.stringify({ schema: SCORE_SCHEMA, ...scoreOf([]), pass: false, error: read.error }, null, 1)); return 1; }
  const j = await judge(read.doc);
  let checks; try { checks = await b.oracle(j, record.calls); } catch (e) { checks = [{ id: 'oracle', what: 'the oracle ran', pass: false, hard: true, measured: e instanceof Error ? e.stack : String(e) }]; }
  let review: Review | null = null; try { review = JSON.parse(readFileSync(join(dir, 'review.json'), 'utf8')); } catch { /* none yet */ }
  const elements = b.elements ? await elementsOf(b.elements, j, record.calls, review) : null;
  // (The stills: the assembly as placed, else the base part's bodies where they are; each body in its own colour where it has one.)
  const bodies: PlacedBody[] = j.placed.length ? j.placed : (j.base ?? []).map(x => ({ key: x.key, mesh: x.mesh, brep: null, pose: { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] as [number, number, number] } }));
  const colourOf = (key: string) => {
    const [part, body] = key.includes('/') ? key.split('/') : ['base', key], doc = part === 'base' ? read.doc : read.doc.instances?.find(i => i.id === part)?.doc;
    const own = doc ? (part === 'base' ? j.base : j.parts[part])?.find(x => x.key === body) : undefined;
    return doc && own ? lookOf(doc, own).color : undefined;
  };
  const cameras: Record<string, Camera> = {}, renders: { view: View; file: string }[] = [];
  for (const view of VIEWS_SAVED) {
    const r = renderBodies(bodies, view, { colourOf });
    if (!r) break;
    writeFileSync(join(dir, `render-${view}.png`), r.png); cameras[view] = r.camera; renders.push({ view, file: `render-${view}.png` });
    if (view === 'iso') writeFileSync(join(dir, 'render.png'), r.png);
  }
  if (renders.length) writeFileSync(join(dir, 'camera.json'), JSON.stringify({ schema: CAMERA_SCHEMA, renderer: 'ai-eval software rasteriser (scripts/ai-eval/render.ts): display meshes, orthographic, flat shaded', cameras }, null, 1) + '\n');
  const score = scoreOf(checks), calls = record.calls, byAction: Record<string, number> = {};
  for (const c of calls) { const k = `${c.tool}.${(c.args as { action?: string } | null)?.action ?? ''}`; byAction[k] = (byAction[k] ?? 0) + 1; }
  const slowest = [...calls].sort((x, y) => y.ms - x.ms)[0];
  writeFileSync(join(dir, 'score.json'), JSON.stringify({
    schema: SCORE_SCHEMA, judgedAt: new Date().toISOString(),
    brief: { id: b.id, ladder: b.ladder, title: b.title, promptSha256: record.promptSha256 },
    run: { n: record.n ?? null, id: record.run, at: record.at, model: record.model, effort: record.effort, autonomy: record.autonomy ?? AUTONOMY, harness: record.harness ?? 'unknown', judgedBy: HARNESS, tools: record.tools ?? TOOLSET.version, caps: record.caps ?? null },
    ...score, elements,
    outcome: { end: record.end, ...(record.error ? { error: record.error } : {}), turns: record.turns, accepted: record.accepted.length, notAccepted: record.accepted.filter(x => !x.ok).length },
    calls: { count: calls.length, refused: record.refusals, byAction },
    timings: { wallMs: record.wallMs, toolMs: calls.reduce((t, c) => t + c.ms, 0), slowestCall: slowest ? { tool: slowest.tool, action: (slowest.args as { action?: string } | null)?.action ?? null, ms: slowest.ms } : null },
    usage: record.usage, budget: record.budget, renders,
  }, null, 1) + '\n');
  return 0;
}

/**
 * The oracles checked on a known build (`validate`): RB9's rungs by their own scripted ideal agent, this ladder's by the
 * reference calls beside its brief (a file argument "$file:<name>" is the person's file of that name; a call
 * {"tool": "@accept"} is the person accepting every open proposal). A correct build must pass: a failure is the
 * oracle's or the tool path's, found before any model runs.
 */
async function validate(ids: string[] | undefined): Promise<number> {
  const evaluate = async (d: StudioDoc) => evaluateDoc(d, 1);
  let bad = 0;
  for (const b of BRIEFS.filter(x => !ids || ids.includes(x.id))) {
    let calls = b.reference;
    if (b.rb9) { const n = Number(/^RB9\.(\d+)/.exec(b.rb9)![1]), rung = RUNGS.find(r => r.n === n)!; calls = rung.scripted(sample(rung.space, 1, 5)); }
    if (!calls) { process.stdout.write(`${b.id}: no reference build\n`); continue; }
    const conversation = sha(b.id).slice(0, 24), { rowFiles } = attachments(b, conversation), doc = await startOf(b);
    const files = rowFiles ? receivePersonRowFiles(conversation, rowFiles, 1) : undefined;
    const e0 = await evaluate(doc);
    let state = { doc, bodies: e0.ok ? e0.bodies : [], turnBase: doc, turns: [b.prompt], ...(files ? { rowFiles: files } : {}) } as unknown as ChatState;
    const done: { tool: string; args: unknown; ok: boolean; text: string; turn: number; ms: number; error?: string }[] = [];
    const fileId = (v: unknown): unknown => typeof v === 'string' && v.startsWith('$file:') ? files?.files.find(f => f.source.filename === v.slice(6))?.id : Array.isArray(v) ? v.map(fileId) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fileId(x)])) : v;
    for (const c of calls) {
      if (c.tool === '@accept') {
        for (const p of (state.doc.proposals ?? []).filter(q => q.status === 'open')) { const a = await acceptProposal(state, p.id, evaluate); if ('error' in a) process.stdout.write(`  accept ${p.id}: ${a.error}\n`); else state = a.state; }
        continue;
      }
      const args = fileId(c.args) as Record<string, unknown>, r = await dispatchTool(state, c.tool, args, evaluate);
      done.push({ tool: c.tool, args, ok: !r.isError, text: r.content.slice(0, 3000), turn: 1, ms: 0 });
      if (r.isError) { process.stdout.write(`  ${c.tool} ${JSON.stringify(args).slice(0, 200)} refused: ${r.content.slice(0, 400)}\n`); break; }
      state = r.state;
    }
    const checks = await b.oracle(await judge(state.doc), done), s = scoreOf(checks);
    if (!s.pass) bad++;
    process.stdout.write(`${b.id}: ${s.pass ? 'PASS' : 'FAIL'} ${s.hardPassed}/${s.hard} hard\n${checks.filter(c => !c.pass).map(c => `  ${c.hard ? 'FAIL' : 'soft'} ${c.id} ${c.what}: ${JSON.stringify(c.measured)?.slice(0, 300)} (want ${JSON.stringify(c.expected)?.slice(0, 120)})`).join('\n')}${checks.some(c => !c.pass) ? '\n' : ''}`);
  }
  return bad ? 1 : 0;
}

/** index.json and report.md over every run kept. */
function report(store: string): string {
  type Elements = { id: string; status?: string; by: string }[] | null;
  const rows: { record: RunRecord; score: Score & { error?: string; elements?: Elements }; dir: string; n: number }[] = [];
  for (const { dir, n } of runDirs(store)) {
    try { rows.push({ record: JSON.parse(readFileSync(join(dir, 'record.json'), 'utf8')), score: JSON.parse(readFileSync(join(dir, 'score.json'), 'utf8')), dir, n }); } catch { /* unfinished */ }
  }
  // (index.json, barocss-ai-eval/index@1: the briefs with their prompts and each run's summary, paths relative to the store.)
  writeFileSync(join(store, 'index.json'), JSON.stringify({ schema: INDEX_SCHEMA, updated: new Date().toISOString(), briefs: BRIEFS.filter(b => rows.some(x => x.record.brief === b.id)).map(b => ({
    id: b.id, ladder: b.ladder, title: b.title, prompt: b.prompt, ...(b.elements ? { elements: b.elements.map(e => ({ id: e.id, what: e.what, scripted: !!e.oracle })) } : {}),
    runs: rows.filter(x => x.record.brief === b.id).map(({ record: r, score: s, n }) => ({
      n, dir: `${b.id}/${n}`, at: r.at, model: r.model, harness: r.harness ?? 'unknown', pass: s.pass, score: s.score, end: r.end, turns: r.turns, calls: r.calls.length, wallMs: r.wallMs,
      ...(s.elements ? { elements: Object.fromEntries(s.elements.map(e => [e.id, e.status ?? 'pending'])) } : {}),
      prompt: `${b.id}/${n}/prompt.txt`, part: `${b.id}/${n}/part.bcad`, scoreFile: `${b.id}/${n}/score.json`, render: existsSync(join(store, b.id, String(n), 'render.png')) ? `${b.id}/${n}/render.png` : null,
    })),
  })) }, null, 1) + '\n');
  const pct = (a: number, n: number) => n ? `${Math.round(100 * a / n)} %` : '—';
  const out = ['# AI evaluation — runs kept', '', '| ladder | brief | passed | mean score | turns | calls | refused | wall s | tokens in (cached) / out | ends |', '|---|---|---|---|---|---|---|---|---|---|'];
  for (const b of BRIEFS) {
    const rs = rows.filter(x => x.record.brief === b.id); if (!rs.length) continue;
    const n = rs.length, mean = (f: (x: typeof rs[number]) => number) => (rs.reduce((s, x) => s + f(x), 0) / n);
    out.push(`| ${b.ladder} | ${b.id} | ${rs.filter(x => x.score.pass).length}/${n} | ${mean(x => x.score.score).toFixed(2)} | ${mean(x => x.record.turns).toFixed(1)} | ${mean(x => x.record.calls.length).toFixed(1)} | ${mean(x => x.record.refusals).toFixed(1)} | ${mean(x => x.record.wallMs / 1000).toFixed(0)} | ${Math.round(mean(x => x.record.usage.input_tokens) / 1000)}k (${Math.round(mean(x => x.record.usage.cached_input_tokens) / 1000)}k) / ${Math.round(mean(x => x.record.usage.output_tokens + x.record.usage.reasoning_output_tokens) / 1000)}k | ${[...new Set(rs.map(x => x.record.end))].join(', ')} |`);
  }
  out.push('', '| ladder | runs | passed |', '|---|---|---|');
  for (const l of [...new Set(BRIEFS.map(b => b.ladder))]) { const rs = rows.filter(x => x.record.ladder === l); if (rs.length) out.push(`| ${l} | ${rs.length} | ${pct(rs.filter(x => x.score.pass).length, rs.length)} |`); }
  // (The long briefs: each element across the runs — done, approximated, missing, refused, pending review.)
  const mark: Record<string, string> = { done: 'done', approximated: 'approx', missing: 'missing', refused: 'refused' };
  for (const b of BRIEFS.filter(x => x.elements)) {
    const rs = rows.filter(x => x.record.brief === b.id); if (!rs.length) continue;
    out.push('', `### ${b.id}: elements`, '', `| element | ${rs.map(x => `#${x.n}`).join(' | ')} |`, `|---|${rs.map(() => '---').join('|')}|`);
    for (const e of b.elements!) out.push(`| ${e.what} | ${rs.map(x => { const r = x.score.elements?.find(y => y.id === e.id) as { status?: string; how?: string; by: string } | undefined; return r?.status ? `${mark[r.status]}${r.by === 'review' ? ' (r)' : ''}` : 'pending'; }).join(' | ')} |`);
  }
  out.push('', '## Failed checks', '');
  for (const b of BRIEFS) {
    const rs = rows.filter(x => x.record.brief === b.id), failed = new Map<string, number>();
    for (const x of rs) for (const c of x.score.checks ?? []) if (!c.pass) failed.set(`${c.hard ? '' : '(soft) '}${c.id}: ${c.what}`, (failed.get(`${c.hard ? '' : '(soft) '}${c.id}: ${c.what}`) ?? 0) + 1);
    if (failed.size) out.push(`- **${b.id}**: ${[...failed].map(([k, v]) => `${k} ×${v}`).join('; ')}`);
  }
  out.push('', '## Refusals (first 160 characters, by tool)', '');
  const refusals = new Map<string, number>();
  for (const x of rows) for (const c of x.record.calls) if (!c.ok) { const key = `${x.record.brief} ${c.tool}.${(c.args as { action?: string } | null)?.action ?? ''}: ${(c.error ?? '').replace(/\s+/g, ' ').slice(0, 160)}`; refusals.set(key, (refusals.get(key) ?? 0) + 1); }
  for (const [k, v] of [...refusals].sort((a, b) => b[1] - a[1])) out.push(`- ×${v} ${k}`);
  const text = out.join('\n') + '\n';
  writeFileSync(join(store, 'report.md'), text);
  // (details.md: each run's failed checks, refusals, the person's accepts and the agent's last words.)
  const d: string[] = ['# AI evaluation — each run', ''];
  for (const b of BRIEFS) for (const { record: r, score: s } of rows.filter(x => x.record.brief === b.id)) {
    d.push(`## ${b.id} ${r.run}: ${s.pass ? 'PASS' : 'FAIL'} ${s.hardPassed}/${s.hard}, score ${s.score}; ${r.end}${r.error ? ` (${r.error.slice(0, 200)})` : ''}; ${r.turns} turns, ${r.calls.length} calls, ${r.refusals} refused, ${Math.round(r.wallMs / 1000)} s`, '');
    for (const c of s.checks ?? []) if (!c.pass) d.push(`- ${c.hard ? 'FAIL' : 'soft'} ${c.id}: ${c.what} — got ${JSON.stringify(c.measured)?.slice(0, 300)}${c.expected !== undefined ? `, want ${JSON.stringify(c.expected)?.slice(0, 160)}` : ''}`);
    for (const c of r.calls) if (!c.ok) d.push(`- refused (turn ${c.turn}) ${c.tool}.${(c.args as { action?: string } | null)?.action ?? ''} ${JSON.stringify(c.args)?.slice(0, 220)} → ${(c.error ?? '').replace(/\s+/g, ' ').slice(0, 320)}`);
    for (const a of r.accepted) d.push(`- person (turn ${a.turn}): ${a.ok ? 'accepted' : 'could not accept'} ${a.id} "${a.title}"${a.error ? `: ${a.error.slice(0, 200)}` : ''}`);
    d.push('', `> ${(r.messages.at(-1) ?? '').replace(/\n+/g, ' ').slice(0, 700)}`, '');
  }
  writeFileSync(join(store, 'details.md'), d.join('\n') + '\n');
  return text;
}

export async function aiEvalMain(argv: readonly string[], paths: { mcpScript: string; self: string }): Promise<number> {
  const store = get(argv, '--store') ?? join(homedir(), '.cache/barocss-ai-eval');
  const cmd = argv[0];
  if (cmd === 'list') { for (const b of BRIEFS) process.stdout.write(`${b.ladder.padEnd(15)} ${b.id.padEnd(28)} ${b.title}\n`); return 0; }
  if (cmd === 'judge') return judgeRun(argv[1]);
  if (cmd === 'migrate') { for (const m of migrate(store)) process.stdout.write(`${m}\n`); return 0; }
  // (Every kept run judged again, each in a fresh process, with the oracles as they are now; then the report.)
  if (cmd === 'rejudge') {
    const ids = get(argv, '--briefs')?.split(',');
    for (const { brief, dir } of runDirs(store)) {
      if (ids && !ids.includes(brief)) continue;
      const out = spawnSync(process.execPath, [paths.self, 'judge', dir], { encoding: 'utf8', maxBuffer: 64 << 20 });
      if (out.status !== 0) process.stderr.write(`judge ${dir}: ${out.stderr}\n`);
    }
    process.stdout.write(report(store)); return 0;
  }
  if (cmd === 'validate') return validate(get(argv, '--briefs')?.split(','));
  if (cmd === 'report') { process.stdout.write(report(store)); return 0; }
  if (cmd !== 'run') { process.stderr.write('ai-eval: run | judge <dir> | rejudge | migrate | validate | report | list\n'); return 2; }
  const ids = get(argv, '--briefs')?.split(','), briefs = ids ? BRIEFS.filter(b => ids.includes(b.id)) : BRIEFS;
  if (!briefs.length || (ids && briefs.length !== ids.length)) { process.stderr.write(`ai-eval: briefs are ${BRIEFS.map(b => b.id).join(', ')}\n`); return 2; }
  const runs = Number(get(argv, '--runs') ?? 3), parallel = Number(get(argv, '--parallel') ?? 2);
  const o = { store, mcpScript: paths.mcpScript, self: paths.self, ...(get(argv, '--model') ? { model: get(argv, '--model') } : {}), effort: get(argv, '--effort') ?? 'high', maxCalls: Number(get(argv, '--max-calls') ?? 120), maxTurns: Number(get(argv, '--max-turns') ?? 4), wallMs: Number(get(argv, '--wall-min') ?? 40) * 60_000 };
  // (Run k of every brief before run k + 1 of any: a series cut short still covers the ladder.)
  const jobs = Array.from({ length: runs }, (_, k) => briefs.map(b => ({ b, k: k + 1 }))).flat();
  let next = 0;
  const worker = async () => { while (next < jobs.length) { const { b, k } = jobs[next++]; try { process.stdout.write(`${await oneRun(b, k, o)}\n`); } catch (e) { process.stdout.write(`${b.id} r${k}: harness error ${e instanceof Error ? e.stack : String(e)}\n`); } report(store); } };
  await Promise.all(Array.from({ length: Math.max(1, parallel) }, worker));
  process.stdout.write(report(store));
  return 0;
}

// (Run as the bundle's entry: ai-eval.mjs builds this file and server/cadMcp.ts side by side.)
if (process.argv[1] && /cli\.mjs$/.test(process.argv[1])) void aiEvalMain(process.argv.slice(2), { mcpScript: join(import.meta.dirname, 'cadMcp.mjs'), self: process.argv[1] }).then(code => process.exit(code));

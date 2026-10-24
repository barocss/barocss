// The CLI (A5.4, O12): a part built by a script (run_script, A5.2) for batch work and CI, written as .bcad, STEP and
// STL, its requirements checked. The same tool layer as the chat and cad-mcp; the person running it is the author, so
// no autonomy gate applies (the script is theirs). Exit codes: 0 done, 1 the script or a tool refused, 2 usage,
// 3 a hard requirement fails (--check).
//   cad-cli run part.cad.js -o part.bcad [--doc base.bcad] [--step part.step] [--stl part.stl] [--check] [--dry-run]
//   cad-cli check part.bcad
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { mjcfOfDoc, urdfOfDoc } from '@barocss/cad-model/chat/robot';
import { readMjcf } from '@barocss/cad-model/robot/mjcfCheck';
import { readUrdf } from '@barocss/cad-model/robot/urdfCheck';
import { encodeStudioFile } from '@barocss/cad-model/engine/container';
import { evaluateDoc, exportStudioStep, stlFor } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { dispatchTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { lumpStls, meshToStl } from '@barocss/cad-model/engine/stl';
import { notLocalModel, openModel, writeAtomic } from './cadDoc';
import { runPartsScenario, runScenario, runSummary, type PartsScenario, type Scenario } from '@barocss/cad-model/team/scripted';
import { metricsOf, type Labelled } from '@barocss/cad-model/team/metrics';
import { verifyBundle, writeBundle } from '@barocss/cad-model/team/bundle';
import { inProcessReopen, type Reopen } from '@barocss/cad-model/team/candidates';
import { runBoardScenario, type BoardScenario } from '@barocss/cad-model/team/boardScenario';
import { canonical } from '@barocss/cad-model/team/team';
import { MARGIN_ESTIMATE_MM, mouldHalves, splitStraddles, toolingPlan, type ToolingPlan } from '@barocss/cad-model/mould/tooling';
import { partingLine } from '@barocss/cad-model/mould/parting';
import { undercuts } from '@barocss/cad-model/mould/undercut';
import { patternOf } from '@barocss/cad-model/casting/pattern';
import { chooseStock, stockDoc, stockFile } from '@barocss/cad-model/machining/stock';
import { nestCutList, nestingCsv } from '@barocss/cad-model/frames/nesting';
import { partCutList } from '@barocss/cad-model/app/cutList';
import { camPreview, camSvg } from '@barocss/cad-model/machining/cam';
import { turningOf } from '@barocss/cad-model/machining/turning';
import { holesOf } from '@barocss/cad-model/machining/holes';
import { receivePersonRowFiles, type PersonRowFiles } from '@barocss/cad-model/engine/rowFiles';
import { sha256Text } from '@barocss/cad-model/util/digest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { quotePackage } from '@barocss/cad-model/mould/quote';
import { readDuty, robotCheckOfDoc, robotSizeOfDoc, treeOfDoc } from '@barocss/cad-model/chat/robot';
import { sourceBytes, sourceName, sourceRecord } from '@barocss/cad-model/team/source';

/** A STEP file for the CLI's reports: the text, or the refusal's words (R7.3c: exportStudioStep throws). */
function stepOrError(doc: StudioDoc, name: string): ReturnType<typeof exportStudioStep> | { error: string } {
  try { return exportStudioStep(doc, { name }); } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
}

/** A mould plan as mould.json shows it: without the loops' points (the lumps' classifier's). */
/** A row list named on the person's own command line (rows rule b): the file they supplied, received as the chat receives
 *  an attached one — its name, its bytes' SHA-256, turn 1 — and passed to the loader by its reference, never as rows. */
function personListFile(path: string): { rowFiles: PersonRowFiles; file: string } | { error: string } {
  const full = resolve(path);
  let text: string;
  try { text = readFileSync(full, 'utf8'); } catch (e) { return { error: `${path}: ${e instanceof Error ? e.message : String(e)}` }; }
  try {
    const rowFiles = receivePersonRowFiles(sha256Text(`cad-cli ${full}`).slice(0, 24), [{ name: basename(full), text, turn: 1 }], 1);
    return { rowFiles, file: rowFiles.files[0].id };
  } catch (e) { return { error: `${path}: ${e instanceof Error ? e.message : String(e)}` }; }
}
const withoutLoops = ({ loops: _, ...rest }: ToolingPlan) => rest;
export const CLI_USAGE = `cad-cli run <script | -> [-o part.bcad] [--doc base.bcad] [--step part.step] [--stl part.stl] [--check] [--dry-run]
  Runs a run_script script (on base.bcad, else an empty part) and writes what is asked; prints a JSON summary.
  --stl writes one file per body when there are several (part-b1.stl, part-b3.stl, …).
  --check runs the part's requirements; a failing hard one exits 3.
cad-cli check part.bcad
  Runs a saved part's requirements: the summary, exit 3 when a hard one fails.
cad-cli urdf part.bcad -o folder [--name robot]
  Writes the assembly as URDF (folder/robot.urdf and folder/meshes/*.stl), checked against the URDF spec; exit 1 when refused.
cad-cli mjcf part.bcad -o folder [--name robot]
  Writes it as a MuJoCo MJCF model (folder/robot.xml and folder/meshes/*.stl), checked; exit 1 when refused.
cad-cli mould-quote part.bcad -o package.zip [--quantity n]
  Writes the injection-moulding quote package (IM6): part.step, dfm.json, dfm.md, quote.json and manifest.json; exit 1 while anything is open.
cad-cli team --metrics folder
  Runs every scenario in the folder (A7, A8) and prints each detector's true and false positives and negatives, precision
  and recall against the scenarios' seeded-defect labels (A8.5).
cad-cli bundle write part.bcad -o folder [--baseline BL1]
  Writes the export bundle (A8.6): the document, its approved BOM baseline, materials with sources, the analysis results
  with their freshness, the ECRs, and a manifest of digests; prints what is missing or stale. Exit 1 when not complete.
cad-cli bundle verify folder
  Reads a bundle back from its files alone: every digest and pin checked, each result's freshness against the document;
  prints what is missing, changed or stale. Exit 0 only when complete and intact.
cad-cli robot-check part.bcad duty.json
  RD9's design-check harness: every margin of the robot against the duty (its moves out and back, dwells, life):
  the actuators (RD3), the joints' ranges and ratings, the sweep (RM6), the model's consistency. Exit 0 only when
  every margin is above 0 and nothing is unknown, else 1.
cad-cli robot-size part.bcad duty.json -o sized.bcad
  RD10's scripted sizer: one change a round (an actuator, a rating, or a slower profile) until every harness margin is
  above 0; writes sized.bcad (the ratings) and sized.duty.json (the actuators, the profile); prints the trace. Exit 0
  when sized, 1 when it stopped (BRIEF_INFEASIBLE: a range or a sweep no sizing fixes; NOT_CONVERGED).
cad-cli board scenario.json [--fresh]
  Runs a candidate board's scenario (A7.5): candidates built in isolation, cancelled, timed out, accepted through the
  Integrator and the replay gate, undone and redone; prints each step's outcome and whether it is the scenario's
  expected one. --fresh reads every accepted part back in a fresh process (cad-cli replay). Exit 1 when one differs.
cad-cli nest part.bcad -o folder [--list lengths.json] [--kerf mm]
  Nests the frame members' cut list into the shop's stock lengths (FRb) — the part's own, or a list given: [{id, length,
  count?, section?, source}] — with the saw's kerf (yours, else 3 mm, an estimate); exact up to 14 pieces a section, else
  first-fit-decreasing with its gap to the lower bound. Writes nesting.json and nesting.csv; exit 1 when refused or a
  piece is left over.
cad-cli stock part.bcad -o folder [--list stock.json] [--allowance mm]
  The stock a part is machined from (CNC7b): the smallest block (milled) or bar (turned) on the shop's list — the part's
  own, or one given — around it with the allowance a face (yours, else 1 mm, an estimate); writes stock.json and
  stock.step. Exit 1 when none is loaded or none fits.
cad-cli pattern part.bcad -o folder
  A sand-cast part's pattern (IM8b): the machining allowance on the faces marked machined (set_casting) and the
  shrinkage, both from your casting rules by the alloy and the part's size; writes pattern.step and pattern.json
  (the factors, their bands and pages). Exit 1 when it cannot be made, and why.
cad-cli mould part.bcad -o folder [--margin mm]
  A moulded part's two halves (IM7 S0) where no face needs a split: a block about the part (10 mm a side, an
  estimate, or --margin), the part taken out, cut at the flat parting plane across the pull (the document's); writes
  mould.step (both halves) and mould.json (the plane, the halves' volumes, shut-offs, side cores' directions, what is
  not built). Exit 1 with the code when it cannot (a straddling face or a stepped parting line waits for D149).
cad-cli cam-preview part.bcad -o folder [--tool mm]
  NOT FOR PRODUCTION. An optional 2.5D preview of outlines (CNC8): the recognised pockets' contour loops at each
  step-down and the holes' drill points, as cam-preview.json and one SVG a setup, each saying so in its first line. No
  G-code, no feeds or speeds, no collision check. The tool's diameter given, else 6 mm (an estimate).
cad-cli replay part.bcad
  Reads a saved part as the studio opens it and evaluates it afresh: prints its facts and its requirements' verdicts
  (A7.5's replay gate reads an accepted part back with it). Exit 1 when it does not read.
cad-cli team scenario.json
  Runs a scripted team (A7: the Requirements role's ops, the Designer's patches, the Verifier's rules) through the
  Integrator's gates; prints each patch's trace. Exit 1 when no patch was applied.`;

export interface CliIo { stdout: NodeJS.WritableStream; stderr: NodeJS.WritableStream; stdin?: () => Promise<string> }

let revision = 1;
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, revision++);
const say = (w: NodeJS.WritableStream, o: unknown) => void w.write(JSON.stringify(o, null, 1) + '\n');
async function stateOf(doc: StudioDoc): Promise<ChatState | { error: string }> {
  const r = await evaluate(doc);
  return r.ok ? { doc, bodies: r.bodies } : { error: `${r.error.title}. ${r.error.hint}` };
}
async function checks(s: ChatState): Promise<{ summary: { pass: number; fail: number; unknown: number; hard_failing?: number }; failures?: unknown[]; note?: string }> {
  if (!s.doc.requirements?.length) return { summary: { pass: 0, fail: 0, unknown: 0, hard_failing: 0 }, note: 'the part has no requirements' };
  return JSON.parse((await dispatchTool(s, 'check_spec', {}, evaluate)).content);
}

type RunOptions = { script: string; out?: string; doc?: string; step?: string; stl?: string; check: boolean; dry: boolean };
function runOptions(argv: readonly string[]): RunOptions | { error: string } {
  const o: Partial<RunOptions> = { check: false, dry: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = argv[i + 1], path = (k: 'out' | 'doc' | 'step' | 'stl') => { if (!v || v.startsWith('--')) return false; o[k] = resolve(v); i++; return true; };
    if (a === '-o' || a === '--out') { if (!path('out')) return { error: `${a} takes a file` }; }
    else if (a === '--doc') { if (!path('doc')) return { error: '--doc takes a file' }; }
    else if (a === '--step') { if (!path('step')) return { error: '--step takes a file' }; }
    else if (a === '--stl') { if (!path('stl')) return { error: '--stl takes a file' }; }
    else if (a === '--check') o.check = true;
    else if (a === '--dry-run') o.dry = true;
    else if (!a.startsWith('--') && o.script === undefined) o.script = a;
    else return { error: `unknown or extra argument "${a}"` };
  }
  if (o.script === undefined) return { error: 'run takes a script file (or - for standard input)' };
  for (const [k, ext] of [['out', /\.bcad$/i], ['step', /\.(step|stp)$/i], ['stl', /\.stl$/i]] as const) if (o[k] && !ext.test(o[k]!)) return { error: `--${k === 'out' ? 'o' : k} ${o[k]}: not a .${k === 'out' ? 'bcad' : k} file` };
  if (o.doc) { const why = notLocalModel(o.doc); if (why) return { error: why }; }
  return o as RunOptions;
}

/** `cad-cli`: the exit code; the summary on stdout, problems on stderr. */
export async function cliMain(argv: readonly string[], io: CliIo = { stdout: process.stdout, stderr: process.stderr }): Promise<number> {
  const [cmd, ...rest] = argv;
  const usage = (why: string) => { io.stderr.write(`cad-cli: ${why}\n${CLI_USAGE}\n`); return 2; };
  const failed = (why: string, code = 1) => { io.stderr.write(`cad-cli: ${why}\n`); return code; };
  if (cmd === undefined || cmd === 'help' || cmd === '--help' || cmd === '-h') { io.stdout.write(`${CLI_USAGE}\n`); return cmd === undefined ? 2 : 0; }
  if (cmd === 'team') {
    // (A7, O31: a scripted team through the Integrator; the traces printed.)
    if (rest[0] === '--metrics') {
      // (A8.5: every scenario in the folders given, its traces against its seeded labels.)
      const dirs = rest.slice(1); if (!dirs.length) { io.stderr.write(`team --metrics takes scenario folders\n${CLI_USAGE}\n`); return 2; }
      const runs: Labelled[] = [];
      for (const dir of dirs) for (const f of readdirSync(resolve(dir)).filter(n => n.endsWith('.json')).sort()) {
        const sc = JSON.parse(readFileSync(join(resolve(dir), f), 'utf8')) as (Scenario | PartsScenario) & { expect?: { seeded?: (string | string[] | null)[] } };
        if (!sc.expect?.seeded) continue;
        const traces = 'architect' in sc ? (await runPartsScenario(sc as PartsScenario, evaluate)).traces : (await runScenario(sc as Scenario, evaluate)).traces;
        runs.push({ case: sc.case, traces, seeded: sc.expect.seeded });
      }
      say(io.stdout, { scenarios: runs.length, detectors: metricsOf(runs) });
      return 0;
    }
    const file = rest[0];
    if (!file) { io.stderr.write(`team takes a scenario file\n${CLI_USAGE}\n`); return 2; }
    let sc: Scenario;
    try { sc = JSON.parse(readFileSync(resolve(file), 'utf8')) as Scenario; } catch (e) { io.stderr.write(`${file}: ${e instanceof Error ? e.message : String(e)}\n`); return 2; }
    if (!sc || !Array.isArray(sc.designer)) { io.stderr.write(`${file}: a scenario has its designer steps\n`); return 2; }
    const r = await runScenario(sc, evaluate);
    say(io.stdout, runSummary(r));
    return r.accepted > 0 ? 0 : 1;
  }
  if (cmd === 'replay') {
    // (A7.5, O94: a saved part read and evaluated afresh — the replay gate's reader in a fresh process.)
    if (rest.length !== 1) return usage('replay takes one .bcad file');
    const back = await inProcessReopen(evaluate)(new Uint8Array(readFileSync(resolve(rest[0]))));
    say(io.stdout, back);
    return 'error' in back ? 1 : 0;
  }
  if (cmd === 'board') {
    // (A7.5, O94: a candidate board's scenario; --fresh, each accepted part read back by a spawned cad-cli replay.)
    const file = rest.find(a => !a.startsWith('--')); if (!file) return usage('board takes a scenario file');
    let sc: BoardScenario;
    try { sc = JSON.parse(readFileSync(resolve(file), 'utf8')) as BoardScenario; } catch (e) { return failed(`${file}: ${e instanceof Error ? e.message : String(e)}`); }
    const reopen: Reopen | undefined = rest.includes('--fresh') ? async bytes => {
      const dir = mkdtempSync(join(tmpdir(), 'cad-replay-')), path = join(dir, 'part.bcad');
      try {
        writeFileSync(path, bytes);
        const r = spawnSync(process.execPath, [process.argv[1], 'replay', path], { encoding: 'utf8' });
        try { return JSON.parse(r.stdout); } catch { return { error: `the fresh reader gave no result (exit ${r.status}): ${r.stderr.slice(0, 200)}` }; }
      } finally { rmSync(dir, { recursive: true, force: true }); }
    } : undefined;
    const r = await runBoardScenario(sc, evaluate, reopen), same = r.steps.map((x, k) => canonical(x) === canonical(sc.expect[k]));
    say(io.stdout, { case: sc.case, steps: r.steps, matches: same.every(Boolean), differ: same.flatMap((ok, k) => ok ? [] : [k]) });
    return same.every(Boolean) && same.length === sc.expect.length ? 0 : 1;
  }
  if (cmd === 'bundle') {
    // (A8.6, O42: the export bundle written from a saved part, or read back from its folder alone.)
    const [sub, ...args] = rest;
    if (sub === 'verify') {
      if (args.length !== 1) return usage('bundle verify takes one folder');
      const dir = resolve(args[0]);
      const c = await verifyBundle(path => { const f = join(dir, path); return existsSync(f) ? new Uint8Array(readFileSync(f)) : null; }, evaluate);
      say(io.stdout, c);
      return c.complete ? 0 : 1;
    }
    if (sub !== 'write') return usage('bundle takes write or verify');
    const oi = args.indexOf('-o'), bi = args.indexOf('--baseline'), file = args.find((a, i) => !a.startsWith('-') && args[i - 1] !== '-o' && args[i - 1] !== '--baseline');
    if (!file || oi < 0 || !args[oi + 1]) return usage('bundle write takes a .bcad file and -o folder');
    const opened = await openModel(resolve(file));
    if ('error' in opened) return failed(opened.error);
    const b = await writeBundle(opened.doc, evaluate, bi >= 0 && args[bi + 1] ? { baseline: args[bi + 1] } : {}), dir = resolve(args[oi + 1]);
    mkdirSync(dir, { recursive: true });
    for (const [path, bytes] of b.files) writeAtomic(join(dir, path), bytes);
    say(io.stdout, { complete: b.manifest.complete, missing: b.manifest.missing, stale: b.manifest.stale, wrote: [...b.files.keys()].map(p => join(dir, p)) });
    return b.manifest.complete ? 0 : 1;
  }
  if (cmd === 'mould-quote') {
    // (IM6, O82: the injection-moulding quote package of a saved part, as one zip; exit 1 while anything is open.)
    const oi = rest.indexOf('-o'), qi = rest.indexOf('--quantity'), file = rest.find((a, i) => !a.startsWith('-') && rest[i - 1] !== '-o' && rest[i - 1] !== '--quantity');
    if (!file || oi < 0 || !rest[oi + 1]) return usage('mould-quote takes a .bcad file and -o package.zip');
    const opened = await openModel(resolve(file));
    if ('error' in opened) return failed(opened.error);
    const e = await evaluate(opened.doc); if (!e?.ok) return failed('the part does not evaluate');
    const q = await quotePackage(opened.doc, e.bodies, evaluate, { name: basename(file).replace(/\.[^.]+$/, ''), ...(qi >= 0 ? { quantity: Number(rest[qi + 1]) } : {}) });
    if ('error' in q) return failed(q.error);
    writeAtomic(resolve(rest[oi + 1]), q.zip);
    say(io.stdout, { complete: q.manifest.complete, open: q.manifest.open, files: q.manifest.files.map(f => f.path), wrote: resolve(rest[oi + 1]) });
    return q.manifest.complete ? 0 : 1;
  }
  if (cmd === 'stock') {
    // (CNC7b, O102: the stock of a saved part from the shop's list — stock.json and stock.step; exit 1 when none is chosen.)
    const oi = rest.indexOf('-o'), li = rest.indexOf('--list'), ai = rest.indexOf('--allowance'), file = rest.find((a, i) => !a.startsWith('-') && !['-o', '--list', '--allowance'].includes(rest[i - 1]));
    if (!file || oi < 0 || !rest[oi + 1]) return usage('stock takes a .bcad file and -o folder [--list stock.json] [--allowance mm]');
    const opened = await openModel(resolve(file));
    if ('error' in opened) return failed(opened.error);
    let s0 = await stateOf(opened.doc); if ('error' in s0) return failed(s0.error);
    if (li >= 0 || ai >= 0) {
      const list = li >= 0 ? personListFile(rest[li + 1]) : undefined;
      if (list && 'error' in list) return failed(list.error);
      const set = await dispatchTool(list ? { ...s0, rowFiles: list.rowFiles } : s0, 'set_stock', { ...(list ? { file: list.file } : {}), ...(ai >= 0 ? { allowance: Number(rest[ai + 1]) } : {}) }, evaluate);
      if (set.isError) return failed(JSON.parse(set.content).error ?? set.content);
      s0 = set.state;
    }
    const process = s0.doc.process === 'cnc-turning' ? 'cnc-turning' : 'cnc-milling';
    const turning = process === 'cnc-turning' ? turningOf(s0.doc, s0.bodies, holesOf(s0.bodies)) : null, r = chooseStock(s0.doc, s0.bodies, process, turning);
    if (!r.ok) { say(io.stdout, { ok: false, code: r.code, message: r.message, allowance: r.allowance }); return 1; }
    const dir = resolve(rest[oi + 1]); mkdirSync(dir, { recursive: true });
    const step = stepOrError(stockDoc(r.choice), 'stock');
    if ('error' in step) return failed(`the stock's STEP: ${step.error}`);
    writeAtomic(join(dir, 'stock.json'), new TextEncoder().encode(JSON.stringify(stockFile(r.choice), null, 1) + '\n'));
    writeAtomic(join(dir, 'stock.step'), new TextEncoder().encode(step.text));
    say(io.stdout, { ok: true, row: r.choice.row.id, size: r.choice.size, allowance: r.choice.allowance, wrote: [join(dir, 'stock.json'), join(dir, 'stock.step')] });
    return 0;
  }
  if (cmd === 'nest') {
    // (FRb, O116: a saved part's frame members nested into the shop's stock lengths — nesting.json and nesting.csv; exit 1 when refused or a piece is left over.)
    const oi = rest.indexOf('-o'), li = rest.indexOf('--list'), ki = rest.indexOf('--kerf'), file = rest.find((a, i) => !a.startsWith('-') && !['-o', '--list', '--kerf'].includes(rest[i - 1]));
    if (!file || oi < 0 || !rest[oi + 1]) return usage('nest takes a .bcad file and -o folder [--list lengths.json] [--kerf mm]');
    const opened = await openModel(resolve(file));
    if ('error' in opened) return failed(opened.error);
    let s0 = await stateOf(opened.doc); if ('error' in s0) return failed(s0.error);
    if (li >= 0 || ki >= 0) {
      const list = li >= 0 ? personListFile(rest[li + 1]) : undefined;
      if (list && 'error' in list) return failed(list.error);
      const set = await dispatchTool(list ? { ...s0, rowFiles: list.rowFiles } : s0, 'set_frame_stock', { ...(list ? { file: list.file } : {}), ...(ki >= 0 ? { kerf: Number(rest[ki + 1]) } : {}) }, evaluate);
      if (set.isError) return failed(JSON.parse(set.content).error ?? set.content);
      s0 = set.state;
    }
    const r = nestCutList(s0.doc, partCutList(s0.doc, s0.bodies));
    if (!r.ok) { say(io.stdout, { ok: false, code: r.code, message: r.message }); return 1; }
    const dir = resolve(rest[oi + 1]); mkdirSync(dir, { recursive: true });
    writeAtomic(join(dir, 'nesting.json'), new TextEncoder().encode(JSON.stringify(r.nesting, null, 1) + '\n'));
    writeAtomic(join(dir, 'nesting.csv'), new TextEncoder().encode(nestingCsv(r.nesting)));
    say(io.stdout, { ok: !r.nesting.unplaced.length, ...r.nesting.totals, kerf: r.nesting.kerf, sections: r.nesting.sections.map(x => ({ section: x.section, method: x.method, optimal: x.optimal })), unplaced: r.nesting.unplaced.map(p => `${p.name}: ${p.code}`), wrote: [join(dir, 'nesting.json'), join(dir, 'nesting.csv')] });
    return r.nesting.unplaced.length ? 1 : 0;
  }
  if (cmd === 'pattern') {
    // (IM8b, O108: a sand-cast part's pattern — pattern.step and pattern.json; exit 1 with the code when none is made.)
    const oi = rest.indexOf('-o'), file = rest.find((a, i) => !a.startsWith('-') && rest[i - 1] !== '-o');
    if (!file || oi < 0 || !rest[oi + 1]) return usage('pattern takes a .bcad file and -o folder');
    const opened = await openModel(resolve(file));
    if ('error' in opened) return failed(opened.error);
    const s0 = await stateOf(opened.doc); if ('error' in s0) return failed(s0.error);
    const p = await patternOf(s0.doc, s0.bodies, evaluate);
    if (!p.ok) { say(io.stdout, { ok: false, code: p.code, message: p.message }); return 1; }
    const dir = resolve(rest[oi + 1]); mkdirSync(dir, { recursive: true });
    const step = stepOrError(p.doc, 'pattern');
    if ('error' in step) return failed(`the pattern's STEP: ${step.error}`);
    writeAtomic(join(dir, 'pattern.json'), new TextEncoder().encode(JSON.stringify(p.file, null, 1) + '\n'));
    writeAtomic(join(dir, 'pattern.step'), new TextEncoder().encode(step.text));
    say(io.stdout, { ok: true, factor: p.file.shrink.factor, machining: p.file.machining?.mm ?? null, wrote: [join(dir, 'pattern.json'), join(dir, 'pattern.step')] });
    return 0;
  }
  if (cmd === 'mould') {
    // (IM7 S0, O110: the halves where no face straddles — mould.step and mould.json; exit 1 with the code otherwise.)
    const oi = rest.indexOf('-o'), mi = rest.indexOf('--margin'), file = rest.find((a, i) => !a.startsWith('-') && !['-o', '--margin'].includes(rest[i - 1]));
    if (!file || oi < 0 || !rest[oi + 1]) return usage('mould takes a .bcad file and -o folder [--margin mm]');
    const margin = mi >= 0 ? Number(rest[mi + 1]) : MARGIN_ESTIMATE_MM;
    if (!(margin > 0 && margin < 1000)) return usage('--margin is mm a side, more than 0');
    const opened = await openModel(resolve(file));
    if ('error' in opened) return failed(opened.error);
    const s0 = await stateOf(opened.doc); if ('error' in s0) return failed(s0.error);
    const pull = s0.doc.mould?.pull ?? null;
    // (IM7b, O113: the straddling faces split along their isoclines first — the kernel's D149 — then the plan on the split part.)
    const sp = pull ? splitStraddles(s0.doc, s0.bodies, pull, s0.doc.mould?.sides ?? {}) : null;
    if (sp && !sp.ok) { say(io.stdout, { ok: false, code: sp.code, message: sp.message }); return 1; }
    const doc = sp?.doc ?? s0.doc, bodies = sp?.bodies ?? s0.bodies;
    const plan = toolingPlan(bodies, pull, sp?.parting ?? (pull ? partingLine(doc, bodies, pull, s0.doc.mould?.sides ?? {}) : null), pull ? undercuts(bodies, pull).regions : [], margin, sp?.resolved ?? []);
    if (!plan.ok) { say(io.stdout, { ok: false, code: plan.code, message: plan.message, waitsFor: plan.waitsFor }); return 1; }
    const halves = mouldHalves(doc, bodies, plan.plan);
    if (!halves.ok) { say(io.stdout, { ok: false, code: halves.code, message: halves.message }); return 1; }
    const dir = resolve(rest[oi + 1]); mkdirSync(dir, { recursive: true });
    const step = stepOrError(halves.doc, 'mould');
    if ('error' in step) return failed(`the halves' STEP: ${step.error}`);
    const vol = (bs: readonly { volumeMM3?: number | null }[]) => Math.round(bs.reduce((t, b) => t + (b.volumeMM3 ?? 0), 0) * 1e3) / 1e3;
    const shown = withoutLoops(plan.plan);
    const json = { format: 'barocss-mould', version: 1, ...shown, split: sp?.split ?? [], halves: { plus: { label: 'moves along the pull (B side, usually the core)', lumps: halves.plus.length, volume_mm3: vol(halves.plus) }, minus: { label: 'fixed (A side, usually the cavity)', lumps: halves.minus.length, volume_mm3: vol(halves.minus) } },
      lumps: halves.lumps.map(l => ({ key: l.body.key, half: l.half, basis: l.basis, volume_mm3: vol([l.body]) })), margin: { mm: margin, basis: mi >= 0 ? 'set' : 'estimate' } };
    writeAtomic(join(dir, 'mould.json'), new TextEncoder().encode(JSON.stringify(json, null, 1) + '\n'));
    writeAtomic(join(dir, 'mould.step'), new TextEncoder().encode(step.text));
    say(io.stdout, { ok: true, plane: `${plan.plan.axis} = ${plan.plan.planeAt}`, shutOffs: plan.plan.shutOffs.length, sideCores: plan.plan.sideCores.length, wrote: [join(dir, 'mould.json'), join(dir, 'mould.step')] });
    return 0;
  }
  if (cmd === 'cam-preview') {
    // (CNC8, O103: an optional 2.5D preview of outlines — NOT FOR PRODUCTION, said in every file's first line; no G-code.)
    const oi = rest.indexOf('-o'), ti = rest.indexOf('--tool'), file = rest.find((a, i) => !a.startsWith('-') && !['-o', '--tool'].includes(rest[i - 1]));
    if (!file || oi < 0 || !rest[oi + 1]) return usage('cam-preview takes a .bcad file and -o folder [--tool mm]');
    const opened = await openModel(resolve(file));
    if ('error' in opened) return failed(opened.error);
    const s0 = await stateOf(opened.doc); if ('error' in s0) return failed(s0.error);
    const p = camPreview(s0.doc, s0.bodies, ti >= 0 ? { toolMM: Number(rest[ti + 1]) } : {}), dir = resolve(rest[oi + 1]);
    mkdirSync(dir, { recursive: true });
    const wrote = [join(dir, 'cam-preview.json')];
    writeAtomic(wrote[0], new TextEncoder().encode(JSON.stringify(p, null, 1) + '\n'));
    for (const setup of [...new Set(p.operations.map(o => o.setup))]) { const f = join(dir, `cam-preview-${setup.replace('−', '-').replace('+', 'p').replace('-', 'm')}.svg`); writeAtomic(f, new TextEncoder().encode(camSvg(p, setup))); wrote.push(f); }
    say(io.stdout, { notForProduction: true, banner: p.banner, operations: p.operations.length, skipped: p.skipped, wrote });
    return 0;
  }
  if (cmd === 'robot-check') {
    // (RD9, O47: the harness on a saved robot and a duty file.)
    if (rest.length !== 2) return usage('robot-check takes a .bcad file and a duty .json');
    const opened = await openModel(resolve(rest[0]));
    if ('error' in opened) return failed(opened.error);
    const s = await stateOf(opened.doc);
    if ('error' in s) return failed(s.error);
    let raw: unknown;
    try { raw = JSON.parse(readFileSync(resolve(rest[1]), 'utf8')); } catch (e) { return failed(`${rest[1]}: ${e instanceof Error ? e.message : String(e)}`, 2); }
    const duty = readDuty(await treeOfDoc(s.doc, s.bodies, evaluate), raw);
    if ('error' in duty) return failed(`${rest[1]}: ${duty.error}`, 2);
    const r = await robotCheckOfDoc(s.doc, s.bodies, evaluate, duty);
    say(io.stdout, r);
    return r.ok ? 0 : 1;
  }
  if (cmd === 'robot-size') {
    // (RD10, O48: the scripted sizer on a saved robot and a duty; the sized design written beside -o.)
    const oi = rest.indexOf('-o'), files = rest.filter((a, i) => !a.startsWith('-') && rest[i - 1] !== '-o');
    if (files.length !== 2 || oi < 0 || !rest[oi + 1]) return usage('robot-size takes a .bcad file, a duty .json and -o sized.bcad');
    const opened = await openModel(resolve(files[0]));
    if ('error' in opened) return failed(opened.error);
    const s = await stateOf(opened.doc);
    if ('error' in s) return failed(s.error);
    let raw: unknown;
    try { raw = JSON.parse(readFileSync(resolve(files[1]), 'utf8')); } catch (e) { return failed(`${files[1]}: ${e instanceof Error ? e.message : String(e)}`, 2); }
    const duty = readDuty(await treeOfDoc(s.doc, s.bodies, evaluate), raw);
    if ('error' in duty) return failed(`${files[1]}: ${duty.error}`, 2);
    const { sized, doc } = await robotSizeOfDoc(s.doc, s.bodies, evaluate, duty), out = resolve(rest[oi + 1]), dutyOut = out.replace(/\.bcad$/i, '') + '.duty.json';
    writeAtomic(out, encodeStudioFile(doc)); writeAtomic(dutyOut, JSON.stringify(sized.duty, null, 1) + '\n');
    say(io.stdout, { ok: sized.ok, rounds: sized.rounds, trace: sized.trace, ...(sized.stopped ? { stopped: sized.stopped } : {}), least: sized.report.least, wrote: [out, dutyOut] });
    return sized.ok ? 0 : 1;
  }
  if (cmd === 'check') {
    if (rest.length !== 1) return usage('check takes one .bcad file');
    const opened = await openModel(resolve(rest[0]));
    if ('error' in opened) return failed(opened.error);
    const s = await stateOf(opened.doc);
    if ('error' in s) return failed(s.error);
    const c = await checks(s);
    say(io.stdout, { ok: !c.summary.hard_failing, checks: c });
    return c.summary.hard_failing ? 3 : 0;
  }
  if (cmd === 'urdf' || cmd === 'mjcf') {
    const file = rest.find(a => !a.startsWith('-') && rest[rest.indexOf(a) - 1] !== '-o' && rest[rest.indexOf(a) - 1] !== '--name'), oi = rest.indexOf('-o'), ni = rest.indexOf('--name');
    if (!file || oi < 0 || !rest[oi + 1]) return usage('urdf takes a .bcad file and -o folder');
    const opened = await openModel(resolve(file));
    if ('error' in opened) return failed(opened.error);
    const s = await stateOf(opened.doc);
    if ('error' in s) return failed(s.error);
    const robot = ni >= 0 ? rest[ni + 1] ?? 'robot' : 'robot', dir = resolve(rest[oi + 1]);
    const r = cmd === 'urdf' ? await urdfOfDoc(opened.doc, s.bodies, evaluate, robot) : await mjcfOfDoc(opened.doc, s.bodies, evaluate, robot);
    if (!r.ok) return failed(`${cmd.toUpperCase()} refused: ${r.refusals.map(x => `[${x.code}] ${x.message}`).join(' ')}`);
    const text = 'urdf' in r ? r.urdf : r.xml, main = join(dir, cmd === 'urdf' ? 'robot.urdf' : 'robot.xml');
    mkdirSync(join(dir, 'meshes'), { recursive: true });
    writeAtomic(main, text);
    for (const f of r.files) writeAtomic(join(dir, f.path), f.data);
    // (O9: the export as external readers pin it, its source beside it: the revision, the input digest, the hand-set values.)
    writeAtomic(join(dir, sourceName(main.replace(/^.*[\\/]/, ''))), sourceBytes(sourceRecord(opened.doc, [main.replace(/^.*[\\/]/, ''), ...r.files.map(f => f.path)], { robot: true })));
    const files = new Set(r.files.map(f => f.path)), check = cmd === 'urdf' ? readUrdf(text, files) : readMjcf(text, files);
    say(io.stdout, { ok: !check.issues.length, ...('links' in check.model ? { links: check.model.links.length, joints: check.model.joints.length } : { bodies: check.model.bodies.length }), wrote: [main, ...r.files.map(f => join(dir, f.path))], notes: r.notes, check: check.issues });
    return check.issues.length ? 1 : 0;
  }
  if (cmd !== 'run') return usage(`unknown command "${cmd}"`);
  const o = runOptions(rest);
  if ('error' in o) return usage(o.error);
  let source: string;
  try { source = o.script === '-' ? await (io.stdin ?? readStdin)() : readFileSync(resolve(o.script), 'utf8'); } catch (e) { return failed(`cannot read the script: ${e instanceof Error ? e.message : String(e)}`); }
  const base = o.doc ? await openModel(o.doc) : null;
  if (base && 'error' in base) return failed(base.error);
  const start = await stateOf(base ? base.doc : emptyDoc());
  if ('error' in start) return failed(start.error);
  const r = await dispatchTool(start, 'run_script', { source, dryRun: o.dry }, evaluate), body = JSON.parse(r.content);
  // (A refusal as the compiler would say it: file:line:col, then the reason.)
  if (r.isError) return failed(`${o.script === '-' ? '<stdin>' : o.script}${body.line ? `:${body.line}:${body.col}` : ''}: ${String(body.error).replace(/^(\[\w+\]) line \d+:\d+: /, '$1 ')}`);
  const s = r.state, wrote: string[] = [], notes: string[] = [];
  if (!o.dry) {
    try {
      if (o.out) { writeAtomic(o.out, encodeStudioFile(s.doc)); wrote.push(o.out); }
      if (o.step) { const step = stepOrError(s.doc, o.step.replace(/^.*[\\/]/, '').replace(/\.\w+$/, '')); if ('error' in step) return failed(`STEP: ${step.error}`); writeAtomic(o.step, step.text); wrote.push(o.step); if (step.omitted) notes.push(...step.omitted); }
      if (o.stl) {
        if (!s.bodies.length) return failed('STL: there is no body to write');
        for (const b of s.bodies) {
          const path = s.bodies.length === 1 ? o.stl : o.stl.replace(/\.stl$/i, `-${b.key}.stl`);
          // (O8: a body whose pieces only touch along an edge or a point, one STL a piece: <name>-lump1.stl, …)
          const lumps = b.lumpTouch?.length ? lumpStls(b.mesh, b.key) : null;
          if (lumps) { for (const f of lumps) { const at = path.replace(/\.stl$/i, `-lump${f.lump + 1}.stl`); writeAtomic(at, f.bytes); wrote.push(at); } continue; }
          writeAtomic(path, stlFor(s.doc, b.key) ?? meshToStl(b.mesh, b.key)); wrote.push(path);
        }
        // (O9: an STL's header cannot carry its source; the record beside it does, for every STL this run wrote.)
        const stls = wrote.filter(w => /\.stl$/i.test(w)), at = sourceName(o.stl);
        writeAtomic(at, sourceBytes(sourceRecord(s.doc, stls.map(w => w.replace(/^.*[\\/]/, ''))))); wrote.push(at);
      }
    } catch (e) { return failed(`writing: ${e instanceof Error ? e.message : String(e)}`); }
  }
  const c = o.check ? await checks(s) : undefined;
  say(io.stdout, { ok: !c?.summary.hard_failing, ...(o.dry ? { dryRun: true } : {}), calls: body.calls.length, names: body.names, facts: body.facts ?? body.change, wrote, ...(notes.length ? { notes } : {}), ...(c ? { checks: c } : {}) });
  return c?.summary.hard_failing ? 3 : 0;
}

async function readStdin(): Promise<string> { let t = ''; for await (const chunk of process.stdin) t += chunk; return t; }

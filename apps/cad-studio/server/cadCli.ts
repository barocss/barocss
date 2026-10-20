// The CLI (A5.4, O12): a part built by a script (run_script, A5.2) for batch work and CI, written as .bcad, STEP and
// STL, its requirements checked. The same tool layer as the chat and cad-mcp; the person running it is the author, so
// no autonomy gate applies (the script is theirs). Exit codes: 0 done, 1 the script or a tool refused, 2 usage,
// 3 a hard requirement fails (--check).
//   cad-cli run part.cad.js -o part.bcad [--doc base.bcad] [--step part.step] [--stl part.stl] [--check] [--dry-run]
//   cad-cli check part.bcad
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { mjcfOfDoc, urdfOfDoc } from '../src/chat/robot';
import { readMjcf } from '../src/robot/mjcfCheck';
import { readUrdf } from '../src/robot/urdfCheck';
import { encodeStudioFile } from '../src/engine/container';
import { evaluateDoc, stepFor, stlFor } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { meshToStl } from '../src/ui/files';
import { notLocalModel, openModel, writeAtomic } from './cadDoc';
import { runScenario, runSummary, type Scenario } from '../src/team/scripted';

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
    const file = rest[0];
    if (!file) { io.stderr.write(`team takes a scenario file\n${CLI_USAGE}\n`); return 2; }
    let sc: Scenario;
    try { sc = JSON.parse(readFileSync(resolve(file), 'utf8')) as Scenario; } catch (e) { io.stderr.write(`${file}: ${e instanceof Error ? e.message : String(e)}\n`); return 2; }
    if (!sc || !Array.isArray(sc.designer)) { io.stderr.write(`${file}: a scenario has its designer steps\n`); return 2; }
    const r = await runScenario(sc, evaluate);
    say(io.stdout, runSummary(r));
    return r.accepted > 0 ? 0 : 1;
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
  const s = r.state, wrote: string[] = [];
  if (!o.dry) {
    try {
      if (o.out) { writeAtomic(o.out, encodeStudioFile(s.doc)); wrote.push(o.out); }
      if (o.step) { const step = stepFor(s.doc, o.step.replace(/^.*[\\/]/, '').replace(/\.\w+$/, '')); if ('error' in step) return failed(`STEP: ${step.error}`); writeAtomic(o.step, step.text); wrote.push(o.step); }
      if (o.stl) {
        if (!s.bodies.length) return failed('STL: there is no body to write');
        for (const b of s.bodies) {
          const path = s.bodies.length === 1 ? o.stl : o.stl.replace(/\.stl$/i, `-${b.key}.stl`);
          writeAtomic(path, stlFor(s.doc, b.key) ?? meshToStl(b.mesh, b.key)); wrote.push(path);
        }
      }
    } catch (e) { return failed(`writing: ${e instanceof Error ? e.message : String(e)}`); }
  }
  const c = o.check ? await checks(s) : undefined;
  say(io.stdout, { ok: !c?.summary.hard_failing, ...(o.dry ? { dryRun: true } : {}), calls: body.calls.length, names: body.names, facts: body.facts ?? body.change, wrote, ...(c ? { checks: c } : {}) });
  return c?.summary.hard_failing ? 3 : 0;
}

async function readStdin(): Promise<string> { let t = ''; for await (const chunk of process.stdin) t += chunk; return t; }

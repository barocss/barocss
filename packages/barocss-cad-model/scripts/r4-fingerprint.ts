// The documents and what is recorded of each (scripts/r4-fingerprint.mjs runs it). Documents: every .bcad in the
// package's and the studio's test fixtures and the kernel's conformance folders; every cad-model document inside the
// conformance JSON; each agent-call fixture (test/fixtures/*.calls.json) replayed; each RB9 rung's scripted calls at
// its four corner trials; O11's variability fixtures, each master and its variants. Recorded: the evaluation (bodies whole, meshes included; or its refusal), the rebuild's
// states, STEP (its time stamp left out), STL per body, B-reps (with and without made parts), the BOM, the clearance
// map of an assembly, the drawing's dimensions and issues; and once, the tool list and prompt a model reads.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { StudioDoc } from '../src/engine/doc';
import { brepsFor, evaluateDoc, stepFor, stlFor, type EvalResult } from '../src/engine/evaluate';
import { readStudioFile } from '../src/engine/container';
import { rebuildReport } from '../src/team/rebuild';
import { bomView, deriveBom } from '../src/team/assembly';
import { assemblyPlacedBodies, clearanceMap } from '../src/team/clearanceMap';
import { drawingInputs } from '../src/chat/drawing';
import { drawingIssues, issueContext } from '../src/drawing/issues';
import { RUNGS } from '../src/rb9/rungs';
import { build, sample } from '../src/rb9/core';
import { TOOLSET } from '../src/chat/toolset';
import { variantNamed } from '../src/assembly/variability';
import { o11Masters } from '../test/o11-fixtures';

const repo = resolve(import.meta.dirname, '../../..');
const ROOTS = ['packages/barocss-cad-model/test/fixtures', 'apps/cad-studio/test/fixtures', 'packages/barocss-cad/conformance'];
// (Wall times left out, the only values that differ run to run: the clearance map's \`timing\` and the gear-contact
// note's "(checked in N ms)".)
const TIMED = /\(checked in \d+ ms\)/g;
const json = (v: unknown) => JSON.stringify(v, (k, x: unknown) => k === 'timing' ? undefined : typeof x === 'string' ? x.replace(TIMED, '(checked in # ms)') : ArrayBuffer.isView(x) && !(x instanceof DataView) ? Array.from(x as unknown as ArrayLike<number>) : x instanceof Map ? [...x] : x instanceof Set ? [...x] : x);
const sha = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');
const message = (e: unknown) => e instanceof Error ? `${e.name}: ${e.message}` : String(e);
let revision = 1;
const evaluate = async (doc: StudioDoc): Promise<EvalResult> => evaluateDoc(doc, revision++);

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out); else out.push(p);
  }
  return out;
}
/** The cad-model documents inside a JSON value, by their path in it. */
function docsIn(v: unknown, at: string, out: [string, StudioDoc][]): void {
  if (Array.isArray(v)) { v.forEach((x, i) => docsIn(x, `${at}/${i}`, out)); return; }
  if (!v || typeof v !== 'object') return;
  const o = v as Record<string, unknown>;
  if (o.format === 'barocss-cad-model' && Array.isArray(o.nodes)) { out.push([at, o as unknown as StudioDoc]); return; }
  for (const k of Object.keys(o)) docsIn(o[k], `${at}/${k}`, out);
}

async function record(doc: StudioDoc): Promise<Record<string, unknown>> {
  const r: Record<string, unknown> = {};
  const ev = evaluateDoc(doc, revision++);
  if (!ev.ok) r.error = ev.error;
  else {
    r.bodies = sha(json(ev.bodies.map(b => b)));
    r.keys = ev.bodies.map(b => [b.key, b.family, b.volumeMM3, b.massG]);
    r.rebuild = rebuildReport(doc, ev)?.features.map(f => [f.id, f.label, f.state]) ?? null;
    r.stl = ev.bodies.map(b => { const s = stlFor(doc, b.key); return s ? sha(s) : null; });
  }
  const safe = async (k: string, f: () => unknown) => { try { r[k] = await f(); } catch (e) { r[k] = { threw: message(e) }; } };
  await safe('step', () => { const s = stepFor(doc, 'part'); return 'error' in s ? s : { text: sha(s.text.replace(/FILE_NAME\([^;]*;/, 'FILE_NAME;')), omitted: s.omitted ?? null }; });
  await safe('breps', () => { const b = brepsFor(doc); return 'error' in b ? b : sha(json(b)); });
  await safe('brepsMade', () => { const b = brepsFor(doc, { made: true }); return 'error' in b ? b : sha(json(b)); });
  await safe('bom', async () => deriveBom(await bomView(doc, evaluate)).lines);
  if (doc.instances?.length) await safe('clearance', async () => sha(json(clearanceMap(await assemblyPlacedBodies(doc, evaluate)))));
  await safe('drawing', () => { const d = drawingInputs(doc); if (typeof d === 'string') return d; const c = issueContext(d); return { dims: c.sheet.dimensions.map(x => x.ok ? (x as { text: string }).text : `not ok ${x.dim.id}`), issues: drawingIssues(c).map(x => `${x.code}: ${x.message}`) }; });
  return r;
}

const docs: [string, StudioDoc | (() => Promise<StudioDoc>)][] = [];
for (const root of ROOTS) for (const p of files(join(repo, root))) {
  const name = relative(repo, p);
  if (p.endsWith('.bcad')) docs.push([name, async () => { const r = await readStudioFile(new Uint8Array(readFileSync(p))); if (!('doc' in r)) throw new Error(`${name}: ${json(r)}`); return r.doc; }]);
  else if (p.endsWith('.calls.json')) docs.push([name, async () => (await build((JSON.parse(readFileSync(p, 'utf8')) as { calls: { tool: string; args: Record<string, unknown> }[] }).calls)).doc]);
  else if (p.endsWith('.json')) { const found: [string, StudioDoc][] = []; try { docsIn(JSON.parse(readFileSync(p, 'utf8')), '', found); } catch { /* not JSON */ } for (const [at, d] of found) docs.push([`${name}#${at}`, d]); }
}
// (O11: each variability fixture's master and its variants, regenerated from it.)
for (const [name, master] of await o11Masters(repo)) {
  docs.push([`o11/${name}/master`, master]);
  for (const v of master.variability?.variants ?? []) docs.push([`o11/${name}/${v.name}`, async () => { const r = variantNamed(master, v.name); if ('error' in r) throw new Error(r.error); return r.doc; }]);
}
for (const rung of RUNGS) for (let k = 0; k < 4; k++) { const p = sample(rung.space, 1, k); docs.push([`rb9/${rung.id}/${k}`, async () => (await build(rung.scripted(p), rung.prompt(p))).doc]); }

const out: Record<string, unknown> = { toolset: sha(json(TOOLSET)) };
const lines: string[] = [`toolset ${out.toolset}`];
for (const [name, d] of docs) {
  let rec: Record<string, unknown>;
  try { rec = await record(typeof d === 'function' ? await d() : d); } catch (e) { rec = { threw: message(e) }; }
  out[name] = rec; const h = sha(json(rec)); lines.push(`${h.slice(0, 16)} ${name}`);
}
const whole = sha(json(out));
console.log(lines.join('\n')); console.log(`${docs.length} documents; fingerprint ${whole}`);
if (process.argv[2]) writeFileSync(process.argv[2], json(out) + '\n');

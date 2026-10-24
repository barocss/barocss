// The Boolean's commutativity over the L4 fuzz's trees (K16, D271): every union and intersection node of the fuzz
// corpus's shrunk trees and of the seeds' generated trees, evaluated as A op B and as B op A. Both must build to one
// volume (within their mass methods' accuracy, or within the fuzz's oracle bound where that is wider), or both must
// refuse. A one-sided refusal (A∪B builds, B∪A refuses) is a robust refusal: the kernel knew how to build that body.
//   node scripts/rb/commute.mjs [--seeds 20261023,20261024,20261025,20261026] [--runs N] [--jobs N] [--timeout S] [--corpus-only]
// Prints the pairs by verdict: SAME (both built, one volume), BOTH-REFUSED, and the findings ONE-SIDED (one order
// refused, the other built), DIFFER (both built, the volumes apart past the bound, each against the oracle), EMPTY-SIDED
// (one order empty), BROKEN (either order INVALID, CRASH or TIMEOUT). Known findings: robustness/commute-todo.json
// ([{ case: "seed:k@path", note }]) mark TODO; any other finding exits 1. Needs dist/ (build:library).
import { fork } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join, resolve } from 'node:path';
import { random } from './property.mjs';
import { caseOf, documentOf } from './fuzz-gen.mjs';
import { oracle } from './fuzz-oracle.mjs';

const pkg = resolve(import.meta.dirname, '../..'), args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const seeds = option('--seeds', '20261023,20261024,20261025,20261026').split(',').filter(Boolean).map(Number), runs = Number(option('--runs', 200));
const jobs = Number(option('--jobs', Math.max(1, availableParallelism() - 1))), timeout = 1000 * Number(option('--timeout', 60)), corpusOnly = args.includes('--corpus-only');
// (A mass method's stated accuracy, relative; as the properties take them, scripts/rb/property.mjs.)
const METHOD_TOL = { 'closed-form': 1e-9, 'planar-exact': 1e-9, quadrature: 2e-5, tessellated: 2e-3 };
const BROKEN = new Set(['INVALID', 'CRASH', 'TIMEOUT']);

// ---- the worker pool (the fuzz's worker: the root's output checked strictly, watertight, its mass) ------------------
const kernel = join(pkg, 'dist/index.js'), idle = [], waiting = [];
let nextId = 0;
function spawn() {
  const child = fork(join(pkg, 'scripts/rb/fuzz-worker.mjs'), [], { env: { ...process.env, RB_KERNEL: kernel }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: ['--max-old-space-size=4096'] });
  const w = { child, task: null };
  child.on('message', m => {
    if (m.ready) { release(w); return; }
    const t = w.task; if (!t || m.id !== t.id) return;
    clearTimeout(t.timer); w.task = null; t.done(m.result); release(w);
  });
  return w;
}
function release(w) { const t = waiting.shift(); if (t) start(w, t); else idle.push(w); }
function start(w, t) {
  w.task = t;
  t.timer = setTimeout(() => { w.child.removeAllListeners('message'); w.child.kill('SIGKILL'); t.done({ status: 'TIMEOUT', detail: `killed after ${timeout / 1000} s` }); spawn(); }, timeout);
  w.child.send({ id: t.id, document: t.document, root: t.root });
}
const evaluate = tree => { const { document, root } = documentOf(tree); return new Promise(done => { const t = { id: nextId++, document, root, done }, w = idle.shift(); if (w) start(w, t); else waiting.push(t); }); };
for (let k = 0; k < jobs; k++) spawn();

// ---- the pairs ----------------------------------------------------------------------------------------------------
/** Every union and intersection node of a tree, with its path (r, r.a, r.b.c …: a Boolean's operands, a pattern's child). */
function commutative(tree, path = 'r', out = []) {
  if (tree.leaf) return out;
  if (tree.pattern) return commutative(tree.child, `${path}.c`, out);
  if (tree.op === 'union' || tree.op === 'intersect') out.push({ path, node: tree });
  commutative(tree.a, `${path}.a`, out); commutative(tree.b, `${path}.b`, out);
  return out;
}
const sources = [];
const corpusDir = join(pkg, 'robustness/corpus/fuzz');
if (existsSync(corpusDir)) for (const name of readdirSync(corpusDir).sort()) {
  const j = JSON.parse(readFileSync(join(corpusDir, name), 'utf8'));
  if (j.fuzz?.tree) sources.push({ id: `corpus ${j.fuzz.seed}:${j.fuzz.k}`, key: `${j.fuzz.seed}:${j.fuzz.k}`, tree: j.fuzz.tree });
}
// (The seeds' cases as the fuzz draws them: one generator a seed, `runs` trees in turn.)
if (!corpusOnly) for (const seed of seeds) { const rnd = random(seed); for (let k = 0; k < runs; k++) sources.push({ id: `${seed}:${k}`, key: `${seed}:${k}`, tree: caseOf(rnd).tree }); }
const seen = new Set(), pairs = [];
for (const s of sources) for (const { path, node } of commutative(s.tree)) {
  const ab = JSON.stringify(node); if (seen.has(ab)) continue; seen.add(ab);
  pairs.push({ case: `${s.key}@${path}`, id: `${s.id}@${path}`, node, swapped: { ...node, a: node.b, b: node.a } });
}

// ---- judging -----------------------------------------------------------------------------------------------------
const tolOf = (x, y) => Math.max(METHOD_TOL[x.method] ?? 2e-3, METHOD_TOL[y.method] ?? 2e-3) * Math.max(x.volumeMM3, y.volumeMM3) + 1e-9;
const said = r => r.status === 'OK' ? (r.empty ? 'empty' : `${r.volumeMM3.toPrecision(10)} mm³ (${r.method})`) : `${r.status}${r.code ? ` ${r.code}` : ''}: ${String(r.detail ?? '').slice(0, 140)}`;
/** One pair's verdict. Volumes past the methods' accuracy are judged by the oracle: within its bound (the fuzz's), SAME. */
function verdict(p, ab, ba) {
  const base = { ...p, ab, ba };
  if (BROKEN.has(ab.status) || BROKEN.has(ba.status)) return { ...base, verdict: 'BROKEN' };
  const okA = ab.status !== 'REFUSED', okB = ba.status !== 'REFUSED';
  if (!okA && !okB) return { ...base, verdict: 'BOTH-REFUSED' };
  if (okA !== okB) return { ...base, verdict: 'ONE-SIDED' };
  if (ab.empty || ba.empty) return { ...base, verdict: ab.empty && ba.empty ? 'SAME' : 'EMPTY-SIDED' };
  const d = Math.abs(ab.volumeMM3 - ba.volumeMM3);
  if (d <= tolOf(ab, ba)) return { ...base, verdict: 'SAME' };
  const o = oracle(p.node), bound = Math.max(2 * o.e, 1e-4 * o.volumeMM3, 1e-9);
  return { ...base, verdict: d <= bound ? 'SAME' : 'DIFFER', oracle: { volumeMM3: o.volumeMM3, e: o.e, bound } };
}

const t0 = performance.now(), results = [];
let cursor = 0;
await Promise.all(Array.from({ length: jobs }, async () => {
  for (let k = cursor++; k < pairs.length; k = cursor++) { const p = pairs[k], [ab, ba] = [await evaluate(p.node), await evaluate(p.swapped)]; results[k] = verdict(p, ab, ba); }
}));
for (const w of idle) w.child.kill();

const todoFile = join(pkg, 'robustness/commute-todo.json'), todo = existsSync(todoFile) ? JSON.parse(readFileSync(todoFile, 'utf8')) : [];
const FINDINGS = new Set(['ONE-SIDED', 'DIFFER', 'EMPTY-SIDED', 'BROKEN']), findings = results.filter(r => FINDINGS.has(r.verdict));
for (const f of findings) f.mark = todo.some(t => t.case === f.case) ? 'TODO' : 'NEW';
const by = v => results.filter(r => r.verdict === v).length;
console.log(`commutativity: ${sources.length} trees (${sources.filter(s => s.id.startsWith('corpus')).length} from the corpus; seeds ${corpusOnly ? '—' : seeds.join(', ')} × ${runs}), ${pairs.length} union and intersection nodes, jobs ${jobs}, ${((performance.now() - t0) / 1000).toFixed(0)} s`);
console.log(`SAME ${by('SAME')}, BOTH-REFUSED ${by('BOTH-REFUSED')}, ONE-SIDED ${by('ONE-SIDED')}, DIFFER ${by('DIFFER')}, EMPTY-SIDED ${by('EMPTY-SIDED')}, BROKEN ${by('BROKEN')}`);
for (const f of findings) {
  console.log(`${f.mark} ${f.verdict} ${f.id} (${f.node.op})\n     A op B: ${said(f.ab)}\n     B op A: ${said(f.ba)}${f.oracle ? `\n     oracle ${f.oracle.volumeMM3.toPrecision(10)} mm³ ± ${f.oracle.bound.toExponential(2)}` : ''}\n     ${JSON.stringify(f.node).slice(0, 600)}`);
}
process.exit(findings.some(f => f.mark === 'NEW') ? 1 : 0);

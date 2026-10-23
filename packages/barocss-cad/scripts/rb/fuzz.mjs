// The L4 fuzz (RB5, K10, D188): seeded random CSG trees through the kernel, each against the independent ray oracle.
//   node scripts/rb/fuzz.mjs [--runs N] [--seed S|random] [--jobs N] [--timeout S] [--save] [--record]
// (RB_FUZZ_RUNS, RB_FUZZ_SEED likewise; defaults 200 cases, seed 20261023.) Each case is OK (valid, watertight, its
// volume and centroid within the oracle's bounds, or empty where the oracle is), KNOWN (so, a prismatic crescent's
// touch, D195), REFUSED (a typed error: counted by code), APPROX (the tessellated mass, off by more than the bound but
// within the volumeBoundMM3 it states, with the oracle's e: honest, but the quadrature gave up; counted, not a finding;
// D249), or a finding: WRONG (a stated bound exceeded too), INVALID, CRASH, TIMEOUT. A finding is shrunk to its smallest tree keeping its status;
// with --save it is written to robustness/corpus/fuzz/ as a replayable case with the oracle's values (RB runs it).
// Known findings: robustness/fuzz-todo.json ([{ case: "seed:k", note }]) mark TODO; any other exits 1.
import { fork, execSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism, loadavg } from 'node:os';
import { join, resolve } from 'node:path';
import { random } from './property.mjs';
import { caseOf, documentOf, leavesOf, shrinkTree } from './fuzz-gen.mjs';
import { oracle } from './fuzz-oracle.mjs';

const pkg = resolve(import.meta.dirname, '../..'), args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const seedArg = option('--seed', process.env.RB_FUZZ_SEED ?? '20261023'), seed = seedArg === 'random' ? Math.floor(Math.random() * 2 ** 31) : Number(seedArg);
const runs = Number(option('--runs', process.env.RB_FUZZ_RUNS ?? 200)), jobs = Number(option('--jobs', Math.max(1, availableParallelism() - 1)));
const timeout = 1000 * Number(option('--timeout', 60)), save = args.includes('--save'), record = args.includes('--record');
const FINDINGS = new Set(['WRONG', 'INVALID', 'CRASH', 'TIMEOUT']);

// ---- the worker pool ------------------------------------------------------------------------------------------
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
const evaluate = (document, root) => new Promise(done => { const t = { id: nextId++, document, root, done }, w = idle.shift(); if (w) start(w, t); else waiting.push(t); });
for (let k = 0; k < jobs; k++) spawn();

// ---- judging ---------------------------------------------------------------------------------------------------
/** A kernel result against an oracle: its status and why. */
function verdict(r, o, document, root) {
  const size = Math.max(1, ...o.box.hi.map((x, k) => x - o.box.lo[k])), tolV = Math.max(2 * o.e, 1e-4 * o.volumeMM3, 1e-9), tolC = Math.max(2 * o.eCentroid, 1e-4 * size);
  const base = { document, root, oracle: { volumeMM3: o.volumeMM3, centroidMM: o.centroidMM, e: o.e, eCentroid: o.eCentroid, n: o.n, K: o.K }, tolV, tolC, ms: r.ms };
  if (r.status !== 'OK') return { ...base, status: r.status, detail: r.detail, code: r.code };
  if (r.empty) return o.volumeMM3 <= tolV ? { ...base, status: 'OK', empty: true } : { ...base, status: 'WRONG', detail: `empty, the oracle ${o.volumeMM3.toPrecision(6)} mm³ (e ${o.e.toExponential(1)})` };
  const dV = r.volumeMM3 - o.volumeMM3;
  if (Math.abs(dV) > tolV) {
    const off = `volume ${r.volumeMM3.toPrecision(9)} vs the oracle ${o.volumeMM3.toPrecision(9)} (off ${dV.toExponential(2)}, bound ${tolV.toExponential(1)}, e ${o.e.toExponential(1)} at ${o.n}²×${o.K}; ${r.method}`;
    const stated = r.method === 'tessellated' && Number.isFinite(r.volumeBoundMM3) ? r.volumeBoundMM3 : undefined;
    if (stated !== undefined && Math.abs(dV) <= stated + o.e) return { ...base, status: 'APPROX', kernel: r, detail: `${off}, within its stated bound ${stated.toExponential(2)})` };
    return { ...base, status: 'WRONG', kernel: r, detail: `${off}${stated !== undefined ? `, past its stated bound ${stated.toExponential(2)}` : ''})` };
  }
  if (o.volumeMM3 > 1e-6 * size ** 3) {
    const dC = Math.max(...r.centroidMM.map((x, k) => Math.abs(x - o.centroidMM[k])));
    if (dC > tolC) return { ...base, status: 'WRONG', kernel: r, detail: `centroid ${r.centroidMM.map(x => +x.toFixed(6))} vs the oracle ${o.centroidMM.map(x => +x.toFixed(6))} (off ${dC.toExponential(2)}, bound ${tolC.toExponential(1)} at ${o.n}²×${o.K})` };
  }
  return { ...base, status: r.known ? 'KNOWN' : 'OK', ...(r.known ? { detail: r.known } : {}), kernel: r };
}
/**
 * A tree's case through the kernel and the oracle. A WRONG verdict is confirmed against the oracle at 4n and 8 shifts
 * (its error a quarter or less): one it does not confirm was the oracle's limit, not the kernel's error (D188).
 */
async function judge(tree) {
  // (The oracle in this process while the worker evaluates the next lane's case: `jobs` lanes at a time.)
  const { document, root } = documentOf(tree), r = await evaluate(document, root), first = verdict(r, oracle(tree), document, root);
  if (first.status !== 'WRONG' && first.status !== 'APPROX') return first;
  const fine = verdict(r, oracle(tree, 512, 8), document, root);
  return fine.status === first.status ? fine : { ...fine, confirmedAway: first.detail };
}
/** The smallest tree whose case keeps `status` (at most 80 steps). */
async function shrink(tree, status) {
  let best = tree, steps = 0;
  for (let better = true; better && steps < 80; steps++) {
    better = false;
    for (const c of shrinkTree(best).sort((a, b) => leavesOf(a) - leavesOf(b))) { const j = await judge(c); if (j.status === status) { best = c; better = true; break; } }
  }
  return best;
}

// ---- the run ---------------------------------------------------------------------------------------------------
const load = loadavg()[0], rnd = random(seed), cases = Array.from({ length: runs }, () => caseOf(rnd)), t0 = performance.now();
const results = new Array(cases.length);
let cursor = 0;
await Promise.all(Array.from({ length: jobs }, async () => { for (let k = cursor++; k < cases.length; k = cursor++) results[k] = { k, snap: cases[k].snap, tree: cases[k].tree, ...(await judge(cases[k].tree)) }; }));
const todoFile = join(pkg, 'robustness/fuzz-todo.json'), todo = existsSync(todoFile) ? JSON.parse(readFileSync(todoFile, 'utf8')) : [];
const findings = results.filter(r => FINDINGS.has(r.status));
for (const f of findings) {
  f.mark = todo.some(t => t.case === `${seed}:${f.k}`) ? 'TODO' : 'NEW';
  f.smallest = await shrink(f.tree, f.status);
  const s = await judge(f.smallest); f.small = s;
  if (save) {
    const dir = join(pkg, 'robustness/corpus/fuzz'); mkdirSync(dir, { recursive: true });
    const expect = s.status === 'WRONG' && s.detail?.startsWith('empty') || s.oracle.volumeMM3 <= s.tolV ? { outputs: [] }
      : { outputs: [{ volumeMM3: { value: s.oracle.volumeMM3, relTol: s.tolV / s.oracle.volumeMM3, absTol: s.tolV }, centroidMM: { value: s.oracle.centroidMM, absTol: s.tolC } }] };
    writeFileSync(join(dir, `fuzz-${seed}-${f.k}.json`), JSON.stringify({ id: `fuzz-${seed}-${f.k}`, about: `L4 fuzz finding (seed ${seed}, case ${f.k}): ${f.status} — ${String(s.detail ?? f.detail).slice(0, 240)}`,
      input: { partDocument: s.document }, expect, oracle: `scripts/rb/fuzz-oracle.mjs: z rays, a turned ${s.oracle.n}² lattice at ${s.oracle.K} shifts, e ${s.oracle.e.toExponential(2)} mm³, centroid e ${s.oracle.eCentroid.toExponential(2)} mm`, fuzz: { seed, k: f.k, status: s.status, tree: f.smallest } }, null, 2) + '\n');
  }
}
for (const w of idle) w.child.kill();

const by = s => results.filter(r => r.status === s).length, codes = {}, away = results.filter(r => r.confirmedAway).length;
for (const r of results) if (r.status === 'REFUSED') { const key = `${r.code ?? '?'}: ${String(r.detail ?? '').replace(/^.*?: /, '').replace(/[-\d.]+/g, '#').slice(0, 70)}`; codes[key] = (codes[key] ?? 0) + 1; }
const ms = results.map(r => r.ms ?? 0).sort((a, b) => a - b), pct = q => ms[Math.min(ms.length - 1, Math.floor(q * ms.length))] ?? 0;
console.log(`seed ${seed}, ${runs} cases (${results.filter(r => r.snap).length} snapped), jobs ${jobs}, load ${load.toFixed(1)}, ${((performance.now() - t0) / 1000).toFixed(0)} s; kernel p50 ${pct(0.5).toFixed(0)} ms, p95 ${pct(0.95).toFixed(0)} ms`);
console.log(`OK ${by('OK')} (${results.filter(r => r.empty).length} empty; ${away} first judged WRONG or APPROX, judged again by the finer oracle), KNOWN ${by('KNOWN')}, APPROX ${by('APPROX')}, REFUSED ${by('REFUSED')}, WRONG ${by('WRONG')}, INVALID ${by('INVALID')}, CRASH ${by('CRASH')}, TIMEOUT ${by('TIMEOUT')}`);
for (const [k, n] of Object.entries(codes).sort((a, b) => b[1] - a[1])) console.log(`  refused ×${n}  ${k}`);
for (const r of results) if (r.status === 'APPROX') console.log(`APPROX case ${r.k}${r.snap ? ' (snapped)' : ''}: ${String(r.detail).slice(0, 220)}`);
for (const f of findings) console.log(`${f.mark} case ${f.k} ${f.status}${f.snap ? ' (snapped)' : ''}: ${String(f.detail).slice(0, 200)}\n     smallest (${leavesOf(f.smallest)} leaves): ${f.small.status} — ${String(f.small.detail ?? '').slice(0, 200)}\n     ${JSON.stringify(f.smallest).slice(0, 600)}`);
if (record) {
  let commit = 'unknown'; try { commit = execSync('git rev-parse --short HEAD', { cwd: pkg }).toString().trim(); } catch { /* not a checkout */ }
  appendFileSync(join(pkg, 'robustness/fuzz.jsonl'), JSON.stringify({ commit, date: new Date().toISOString().slice(0, 10), seed, runs, load: +load.toFixed(1), totals: Object.fromEntries(['OK', 'KNOWN', 'APPROX', 'REFUSED', 'WRONG', 'INVALID', 'CRASH', 'TIMEOUT'].map(s => [s, by(s)])), refusals: codes, findings: findings.map(f => ({ k: f.k, status: f.status, mark: f.mark })) }) + '\n');
}
process.exit(findings.some(f => f.mark === 'NEW') ? 1 : 0);

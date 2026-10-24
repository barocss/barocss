// R5 fingerprint: every RB corpus case and the L4 fuzz cases of seeds 20261023/20261024 (200 each), per output its validity, F/E/V, area, mass properties as float64 hex and a sha256 of its tessellation; refusals by name, code and full message — byte-identical before and after a pure refactor (compare the printed sha256, or `cmp` the two files).
//   pnpm -s build:library && node scripts/r5-fingerprint.mjs [out.jsonl] [jobs]   (FP_PROFILE=1: evaluate with { profile: true }; FP_LIMIT=n: every n-th case)
import { fork } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const [outArg = 'r5-fingerprint.jsonl', jobsArg] = process.argv.slice(2), self = fileURLToPath(import.meta.url), pkgArg = resolve(import.meta.dirname, '..');
if (process.env.FP_WORKER) {
  const pkg = process.env.FP_PKG, cad = await import(pathToFileURL(join(pkg, 'dist/index.js')).href);
  const hex = x => { const b = new DataView(new ArrayBuffer(8)); b.setFloat64(0, x); return b.getBigUint64(0).toString(16).padStart(16, '0'); };
  const enc = v => typeof v === 'number' ? hex(v) : Array.isArray(v) ? v.map(enc) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, enc(v[k])])) : v;
  const err = c => ({ name: c?.name, code: c?.code, message: String(c?.message ?? c) });
  const tryOr = f => { try { return f(); } catch (c) { return { error: err(c) }; } };
  function body(b) {
    const brep = b.brep ?? b;
    return {
      id: b.id, fev: [brep.faces.length, brep.edges.length, brep.vertices.length], area: tryOr(() => enc(cad.brepSurfaceArea(brep))),
      validate: tryOr(() => { const r = b.brep ? cad.checkOutput(b) : cad.checkBrep(brep, { strict: true }); return { valid: r.valid, issues: r.issues }; }),
      mass: tryOr(() => enc(b.brep ? cad.massPropertiesOf(b) : cad.brepMassProperties(brep, 1))),
      mesh: tryOr(() => { const m = cad.tessellateBrep(brep, { segmentsPerQuarter: 8 }), h = createHash('sha256'); h.update(Buffer.from(new Float64Array(m.positionsMM).buffer)); h.update(Buffer.from(new Uint32Array(m.indices).buffer)); return h.digest('hex'); }),
    };
  }
  process.on('message', ({ k, id, file, document }) => {
    let r; const t0 = performance.now();
    try {
      if (file && /\.(step|stp)$/i.test(file)) r = { bodies: [body(cad.importStep(readFileSync(file, 'utf8')))] };
      else { const doc = document ?? (j => j.input?.partDocument ?? j)(JSON.parse(readFileSync(file, 'utf8'))); r = { bodies: cad.evaluateCadPart(doc, undefined, process.env.FP_PROFILE ? { profile: true } : undefined).outputs.map(body) }; }
    } catch (c) { r = { refused: err(c) }; }
    process.send({ k, line: JSON.stringify({ id, ...r }), ms: performance.now() - t0 });
  });
  process.send({ ready: true });
} else {
  const pkg = resolve(pkgArg), jobs = Number(jobsArg ?? 3), cases = [];
  for (const root of ['conformance', 'robustness/corpus'].map(f => resolve(pkg, f)).filter(existsSync)) {
    const walk = dir => { for (const name of readdirSync(dir).sort()) { const p = join(dir, name); if (statSync(p).isDirectory()) walk(p); else if (/\.(json|step|stp)$/i.test(name)) {
      const json = p.endsWith('.json') ? JSON.parse(readFileSync(p, 'utf8')) : null;
      if (json?.supersededBy || (json && !json.input?.partDocument && json.format !== 'barocss-cad-part')) continue;
      cases.push({ id: relative(pkg, p).split(sep).join('/'), file: p });
    } } };
    walk(root);
  }
  const { random } = await import(pathToFileURL(join(pkg, 'scripts/rb/property.mjs')).href), { caseOf, documentOf } = await import(pathToFileURL(join(pkg, 'scripts/rb/fuzz-gen.mjs')).href);
  for (const seed of [20261023, 20261024]) { const rnd = random(seed); for (let k = 0; k < 200; k++) cases.push({ id: `fuzz:${seed}:${k}`, document: documentOf(caseOf(rnd).tree).document }); }
  if (process.env.FP_LIMIT) cases.splice(0, cases.length, ...cases.filter((_, k) => k % Number(process.env.FP_LIMIT) === 0));
  const lines = new Array(cases.length), times = new Array(cases.length);
  await Promise.all(Array.from({ length: jobs }, (_, w) => new Promise(done => {
    const mine = cases.map((c, k) => ({ ...c, k })).filter(c => c.k % jobs === w);
    const child = fork(self, [], { env: { ...process.env, FP_WORKER: '1', FP_PKG: pkg }, execArgv: ['--max-old-space-size=4096'] });
    let i = 0; const next = () => { if (i >= mine.length) { child.kill(); done(); return; } const c = mine[i++]; child.send({ k: c.k, id: c.id, file: c.file, document: c.document }); };
    child.on('message', m => { if (m.ready) next(); else { lines[m.k] = m.line; times[m.k] = m.ms; next(); } });
    child.on('exit', code => { if (i < mine.length || lines.some((l, k) => k % jobs === w && l === undefined)) { console.error('worker', w, 'exited', code); process.exitCode = 1; done(); } });
  })));
  const text = lines.join('\n') + '\n'; writeFileSync(outArg, text);
  writeFileSync(outArg + '.times', cases.map((c, k) => `${times[k]?.toFixed(0)}\t${c.id}`).sort((a, b) => parseFloat(b) - parseFloat(a)).join('\n') + '\n');
  console.log(cases.length, 'cases', 'sha256', createHash('sha256').update(text).digest('hex'), outArg);
}

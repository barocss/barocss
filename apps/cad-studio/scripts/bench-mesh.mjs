// The mesh-body measurement (opt-in, no budgets yet): each fixture through the studio's mesh path in its own
// process (its peak memory, and a timeout that names the step it hung in), then a summary table.
// Run: pnpm bench:mesh [fixture ...]; with --facets, the F0 spike (test/bench/facet-spike.ts) instead   (MESH_TIMEOUT_S, default 900; MESH_BOOLEANS=both|union|split|none, default both up to 50k triangles; MESH_JSON=1 for the raw lines)
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const out = mkdtempSync(join(tmpdir(), 'cad-studio-bench-mesh-'));
if (process.argv.includes('--facets')) {
  await build({ entryPoints: [join(root, 'test/bench/facet-spike.ts')], outfile: join(out, 'facet-spike.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning' });
  const r = spawnSync(process.execPath, ['--max-old-space-size=12288', '--expose-gc', join(out, 'facet-spike.mjs'), ...process.argv.slice(2).filter(a => a !== '--facets')], { stdio: 'inherit' });
  rmSync(out, { recursive: true, force: true });
  process.exit(r.status ?? 1);
}
await build({ entryPoints: [join(root, 'test/bench/mesh-bench.ts')], outfile: join(out, 'mesh-bench.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning' });
const all = ['organic-2k', 'organic-5k', 'organic-20k', 'organic-200k', 'organic-1000k', 'scan-200k', 'broken-hole', 'broken-flipped', 'broken-nonmanifold', 'broken-degenerate', 'broken-shells', 'broken-selfintersect'];
const names = process.argv.slice(2).length ? process.argv.slice(2) : all, timeout = 1000 * Number(process.env.MESH_TIMEOUT_S ?? 900);

/** One fixture's lines, and what stopped it (a timeout or a crash) when it did not reach the end. */
function run(name) {
  return new Promise(done => {
    const lines = [], child = spawn(process.execPath, ['--max-old-space-size=12288', join(out, 'mesh-bench.mjs'), name], { stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '', err = '';
    child.stdout.on('data', d => { buf += d; let k; while ((k = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, k); buf = buf.slice(k + 1); try { const j = JSON.parse(l); lines.push(j); if (process.env.MESH_JSON) console.log(name, l); else process.stderr.write(`  ${name}: ${j.step}${j.ok ? '' : ' ✗'} ${j.ms ?? ''}\n`); } catch { /* not a line of ours */ } } });
    child.stderr.on('data', d => { err += d; });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.on('exit', (code, signal) => { clearTimeout(timer); done({ name, lines, stopped: lines.at(-1)?.step === 'end' ? null : signal === 'SIGKILL' ? `timeout after ${timeout / 1000} s` : `exit ${code ?? signal}: ${err.trim().split('\n').slice(-1)[0] ?? ''}` }); });
  });
}

const results = [];
for (const name of names) results.push(await run(name));
rmSync(out, { recursive: true, force: true });

const steps = ['readStl', 'brepFromTriangles', 'display mesh (bodyMesh)', 'GPU geometry (prepare)', 'pick (BVH, first ray)', 'pick (200 rays)', 'union with a box', 'split at y = mid (one side)', 'STL export'];
const short = { 'readStl': 'read', 'brepFromTriangles': 'B-rep', 'display mesh (bodyMesh)': 'display', 'GPU geometry (prepare)': 'GPU prep', 'pick (BVH, first ray)': 'BVH+ray', 'pick (200 rays)': 'pick×200', 'union with a box': 'union', 'split at y = mid (one side)': 'split', 'STL export': 'STL out' };
const cell = (r, s) => { const l = r.lines.find(x => x.step === s); return !l ? (r.stopped && !r.lines.some(x => steps.indexOf(x.step) > steps.indexOf(s)) ? '…' : '–') : l.skipped ? '–' : l.ok ? `${l.ms} ms` : '✗'; };
const pad = (s, n) => String(s).padEnd(n);
console.log(`\n${pad('fixture', 21)}${pad('tris', 9)}${pad('faces', 8)}${steps.map(s => pad(short[s], 11)).join('')}${pad('save MB', 9)}${pad('wire MB', 9)}${pad('RSS MB', 8)}`);
for (const r of results) {
  const f = k => r.lines.find(x => x.step === k);
  console.log(`${pad(r.name, 21)}${pad(f('generate')?.triangles ?? '?', 9)}${pad(f('brepFromTriangles')?.faces ?? '–', 8)}${steps.map(s => pad(cell(r, s), 11)).join('')}${pad(f('save (.bcad mesh node JSON)')?.MB ?? '–', 9)}${pad(f('wire (display mesh, structured clone)')?.MB ?? '–', 9)}${pad(f('end')?.maxRSSMB ?? '–', 8)}`);
}
console.log('\nFirst failures:');
for (const r of results) {
  const bad = r.lines.find(x => !x.ok && !x.skipped && !x.info), limit = r.lines.find(x => x.step === 'studio limit' && !x.ok);
  console.log(`  ${pad(r.name, 21)}${bad ? `${bad.step}: ${bad.error}` : r.stopped ? `stopped in the step after "${r.lines.at(-1)?.step}": ${r.stopped}` : 'none'}${limit ? '  [over the studio limit]' : ''}`);
}

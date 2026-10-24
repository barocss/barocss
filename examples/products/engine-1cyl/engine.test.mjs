// P1: engine.bcad beside build.ts is what the build makes, byte for byte; it passes the brief's checks (check.ts) —
// and the checks catch an engine that doesn't: the piston's bore mate taken out, the cycle no longer closes.
//   node --test examples/products/engine-1cyl/engine.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const here = import.meta.dirname, dir = mkdtempSync(join(tmpdir(), 'engine-1cyl-test-'));
await build({
  stdin: { contents: "export { engine, partMass, pistonPin } from './build.ts'; export { checkEngine } from './check.ts';", resolveDir: here, loader: 'ts' },
  outfile: join(dir, 'p1.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning', define: { 'import.meta.dirname': JSON.stringify(here) },
  // (The kernel's own exports, as cad-model resolves them.)
  nodePaths: [join(here, '../../../packages/barocss-cad-model/node_modules')],
});
const { engine, partMass, pistonPin, checkEngine } = await import(pathToFileURL(join(dir, 'p1.mjs')).href);
rmSync(dir, { recursive: true, force: true });
const committed = readFileSync(join(here, 'engine.bcad'), 'utf8');

test('engine.bcad is the build\'s, byte for byte', () => {
  assert.equal(JSON.stringify(engine().doc), committed);
});

test('it passes the brief\'s checks (the sweep in run.mjs)', async t => {
  const r = await checkEngine(JSON.parse(committed), { sweep: false });
  t.diagnostic(JSON.stringify(r.figures));
  assert.ok(r.ok, JSON.stringify(r.checks.filter(c => !c.ok)));
  assert.deepEqual(r.checks.map(c => c.id), ['parts', 'solves', 'cycle', 'timing', 'masses', 'balance', 'outputs']);
  assert.equal(r.figures.stroke, 50);
  assert.equal(r.figures.bore, 56);
  // Independent bore/stroke volume: pi/4 * 56^2 * 50, in mm^3. Figures are rounded to 0.001.
  assert.equal(r.figures.displacement, Math.round(Math.PI / 4 * 56 ** 2 * 50 * 1000) / 1000);
  assert.equal(r.figures.camRatio, 0.5);
});

test('the piston pin and P1 mass helper keep independent tube values in MMGS', t => {
  // The pin is a 46 mm tube with radii 7 and 4 mm, in steel at 7.85 g/cm^3.
  const p = pistonPin(), m = p.mass(), combined = partMass(p);
  t.diagnostic(JSON.stringify({ facade: m, combined }));
  const volume = Math.PI * (7 ** 2 - 4 ** 2) * 46, mass = volume * 7.85 / 1000;
  const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-9, `${actual} != ${expected}`);
  close(m.volume, volume); close(m.mass, mass);
  close(combined.volume, volume); close(combined.mass, mass);
  for (const c of [m.centroid, combined.centroid]) c.forEach((v, i) => close(v, i === 2 ? 23 : 0));
  const side = mass * (3 * (7 ** 2 + 4 ** 2) + 46 ** 2) / 12, axial = mass * (7 ** 2 + 4 ** 2) / 2;
  m.inertia.forEach((row, i) => row.forEach((v, j) => close(v, i !== j ? 0 : i === 2 ? axial : side)));
});

test('without the piston\'s bore mate the slider-crank has no loop: the cycle check fails, the others stand', async () => {
  const doc = JSON.parse(committed), piston = doc.instances.find(i => i.name === 'piston').id, block = doc.instances.find(i => i.name === 'cylinder-block').id;
  doc.mates = doc.mates.filter(m => !(m.kind === 'concentric' && [m.a.part, m.b.part].includes(piston) && [m.a.part, m.b.part].includes(block)));
  const r = await checkEngine(doc, { sweep: false, outputs: false }), by = Object.fromEntries(r.checks.map(c => [c.id, c]));
  assert.equal(r.ok, false);
  assert.equal(by.cycle.ok, false);
  assert.match(by.cycle.detail, /no closed loop/);
  assert.ok(by.parts.ok && by.timing.ok && by.masses.ok, JSON.stringify(r.checks));
});

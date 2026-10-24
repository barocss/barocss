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
  stdin: { contents: "export { engine } from './build.ts'; export { checkEngine } from './check.ts';", resolveDir: here, loader: 'ts' },
  outfile: join(dir, 'p1.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning', define: { 'import.meta.dirname': JSON.stringify(here) },
});
const { engine, checkEngine } = await import(pathToFileURL(join(dir, 'p1.mjs')).href);
rmSync(dir, { recursive: true, force: true });
const committed = readFileSync(join(here, 'engine.bcad'), 'utf8');

test('engine.bcad is the build\'s, byte for byte', () => {
  assert.equal(JSON.stringify(engine().doc), committed);
});

test('it passes the brief\'s checks (the sweep in run.mjs)', () => {
  const r = checkEngine(JSON.parse(committed), { sweep: false });
  assert.ok(r.ok, JSON.stringify(r.checks.filter(c => !c.ok)));
  assert.deepEqual(r.checks.map(c => c.id), ['parts', 'solves', 'cycle', 'timing', 'masses', 'balance']);
  assert.equal(r.figures.strokeMM, 50);
  assert.equal(r.figures.camRatio, 0.5);
});

test('without the piston\'s bore mate the slider-crank has no loop: the cycle check fails, the others stand', () => {
  const doc = JSON.parse(committed), piston = doc.instances.find(i => i.name === 'piston').id, block = doc.instances.find(i => i.name === 'cylinder-block').id;
  doc.mates = doc.mates.filter(m => !(m.kind === 'concentric' && [m.a.part, m.b.part].includes(piston) && [m.a.part, m.b.part].includes(block)));
  const r = checkEngine(doc, { sweep: false }), by = Object.fromEntries(r.checks.map(c => [c.id, c]));
  assert.equal(r.ok, false);
  assert.equal(by.cycle.ok, false);
  assert.match(by.cycle.detail, /no closed loop/);
  assert.ok(by.parts.ok && by.timing.ok && by.masses.ok, JSON.stringify(r.checks));
});

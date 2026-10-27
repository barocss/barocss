import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const here = import.meta.dirname, dir = mkdtempSync(join(tmpdir(), 'p2-engineering-test-'));
let api;
try {
  await build({ stdin: { contents: `export * from './engineering.ts'; export { roundedRect } from './build.ts';
    export { part, assembly, Plane, Location } from '../../../packages/barocss-cad-model/src/api';
    export { partBreps } from '../../../packages/barocss-cad-model/src/engine/evaluate';
    export { bodiesOf } from '../../../packages/barocss-cad-model/src/api/core';
    export { meshClearance } from '@barocss/cad';`, resolveDir: here, loader: 'ts' },
    outfile: join(dir, 'test.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning',
    define: { 'import.meta.dirname': JSON.stringify(here) }, nodePaths: [join(here, '../../../packages/barocss-cad-model/node_modules')] });
  api = await import(pathToFileURL(join(dir, 'test.mjs')).href);
} finally { rmSync(dir, { recursive: true, force: true }); }

function housing({ wall = 2, draft = 1, gap = 0.1, dx = 0, radiusDelta = 0 } = {}) {
  const g = 18 * Math.tan(draft * Math.PI / 180);
  const bottom = api.part().extrude(api.roundedRect(api.Plane.XY, 150 - 2 * g, 72 - 2 * g, 8 - g), { h: 18, draft: -draft })
    .shell(b => b.faces().facing('+z'), { t: wall })
    .union(q => q.extrude(api.roundedRect(api.Plane.XY.offset(18), 147.8, 69.8, 6.9), { h: 2 })
      .subtract(r => r.extrude(api.roundedRect(api.Plane.XY.offset(17), 146, 68, 6), { h: 4 })));
  const cover = api.part().extrude(api.roundedRect(api.Plane.XY, 150, 72, 8), { h: 10, draft })
    .shell(b => b.faces().facing('-z'), { t: wall })
    .subtract(q => q.extrude(api.roundedRect(api.Plane.XY.offset(-1), 150 - 2 * (1.1 - gap), 72 - 2 * (1.1 - gap), 8 - (1.1 - gap) + radiusDelta), { h: 3 + gap }));
  return api.assembly('rim-fixture', bottom).addPart('cover', cover, { at: api.Location.of({ position: [dx, 0, 18] }) }).doc;
}
const failing = (ms, prefix) => ms.filter(m => m.id.startsWith(prefix)).some(m => m.actual === null || Math.abs(m.actual - m.expected) > m.tolerance);

test('independent planes and circular corners measure 2 mm, 1 degree and 0.1 mm', () => {
  const doc = housing(), before = JSON.stringify(doc), ms = api.measureHousing(doc);
  assert.equal(ms.length, 27);
  assert.ok(!failing(ms, 'wall:'), JSON.stringify(ms));
  assert.ok(!failing(ms, 'draft:'), JSON.stringify(ms));
  assert.ok(!failing(ms, 'fit:'), JSON.stringify(ms));
  assert.equal(JSON.stringify(doc), before);
});
test('wrong wall thickness cannot pass the nominal-wall oracle', () => assert.ok(failing(api.measureHousing(housing({ wall: 1.8 })), 'wall:')));
test('zero draft cannot pass the one-degree oracle', () => assert.ok(failing(api.measureHousing(housing({ draft: 0 })), 'draft:')));
test('a zero-clearance rebate cannot pass the fit oracle', () => assert.ok(failing(api.measureHousing(housing({ gap: 0 })), 'fit:')));
test('incorrect corner radii cannot pass while the straight side gaps still pass', () => {
  const ms = api.measureHousing(housing({ radiusDelta: 0.2 }));
  assert.ok(!failing(ms, 'fit:side:'));
  assert.ok(failing(ms, 'fit:corner:'));
});
test('a shifted cover cannot pass the fit oracle', () => assert.ok(failing(api.measureHousing(housing({ dx: 0.2 })), 'fit:')));

function body(key, p) {
  return { key, mesh: api.bodiesOf(p.doc)[0].mesh, brep: api.partBreps(p.doc)[0].brep,
    pose: { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] } };
}
test('containment is detected even when the two surfaces have positive clearance', () => {
  const outer = body('outer', api.part().box({ w: 10, d: 10, h: 10 })), inner = body('inner', api.part().box({ w: 2, d: 2, h: 2, x: 4, y: 4, z: 4 }));
  const gap = api.meshClearance(outer.mesh.positions, outer.mesh.indices, inner.mesh.positions, inner.mesh.indices).distance;
  assert.ok(gap > 0);
  const [r] = api.checkInterference([outer, inner]);
  assert.equal(r.status, 'overlap');
  assert.ok(Math.abs(r.volume - 8) <= 8e-9, JSON.stringify(r));
});
test('annular bore and solid shaft overlap matches a closed form', () => {
  const sleeve = api.part().cylinder({ r: 3, h: 4 }).subtract(q => q.cylinder({ r: 1, h: 6, z: -1 }));
  const [r] = api.checkInterference([body('sleeve', sleeve), body('shaft', api.part().cylinder({ r: 1.5, h: 4 }))]);
  assert.equal(r.status, 'overlap');
  const expected = Math.PI * (1.5 ** 2 - 1) * 4;
  assert.ok(Math.abs(r.volume - expected) <= expected * 1e-9, JSON.stringify(r));
});
test('touching and separated boxes have no positive overlap', () => {
  const a = body('a', api.part().box({ w: 2, d: 2, h: 2 }));
  for (const x of [2, 4]) {
    const [r] = api.checkInterference([a, body('b', api.part().box({ w: 2, d: 2, h: 2, x }))]);
    assert.notEqual(r.status, 'overlap'); assert.notEqual(r.status, 'refused'); assert.equal(r.volume, 0);
  }
});
test('missing exact geometry stays refused; it is never a zero-volume pass', () => {
  const a = body('a', api.part().box({ w: 2, d: 2, h: 2 }));
  const [r] = api.checkInterference([a, { ...a, key: 'no-brep', brep: null }]);
  assert.equal(r.status, 'refused'); assert.equal(r.code, 'P2_NO_BREP'); assert.equal(r.volume, undefined);
});

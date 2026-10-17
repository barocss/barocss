import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluateCadPart, tessellateBrep, exportStep, importStep, checkBrep, brepMassProperties, brepSurfaceArea } from '../dist/index.js';
import { openEdges } from '../scripts/rb/stages.mjs';

// Every conformance case (conformance/<step>/*.json) against this kernel: see conformance/README.md.
const root = resolve(import.meta.dirname, '../conformance');
const cases = readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory()).flatMap(d => readdirSync(join(root, d.name)).filter(f => f.endsWith('.json')).map(f => join(root, d.name, f)));
const base = name => name.replace(/#\d+$/, '');

for (const file of cases) {
  const c = JSON.parse(readFileSync(file, 'utf8'));
  test(`conformance ${c.id}: ${c.about}`, () => {
    assert.equal(`${c.step.toLowerCase()}-${file.split('/').pop().replace(/\.json$/, '')}`, c.id, 'id matches the file');
    if (c.expect.error) {
      assert.throws(() => evaluateCadPart(c.input.partDocument), e => e.code === c.expect.error.code && e.message.includes(c.expect.error.messageIncludes));
      return;
    }
    const outputs = evaluateCadPart(c.input.partDocument).outputs;
    assert.equal(outputs.length, c.expect.outputs.length, 'outputs');
    c.expect.outputs.forEach((want, k) => {
      const o = outputs[k], m = o.massProperties(1), report = o.validate();
      assert.equal(report.valid, true, report.issues[0]);
      assert.ok(Math.abs(m.volumeMM3 - want.volumeMM3.value) <= want.volumeMM3.relTol * Math.abs(want.volumeMM3.value), `output ${k} volume ${m.volumeMM3} vs ${want.volumeMM3.value}`);
      m.centroidMM.forEach((x, i) => assert.ok(Math.abs(x - want.centroidMM.value[i]) <= want.centroidMM.absTol, `output ${k} centroid ${m.centroidMM} vs ${want.centroidMM.value}`));
      assert.equal(o.bodyCount, want.bodies, `output ${k} bodies`);
      assert.deepEqual(report.topology.map(t => ({ shells: t.shells, genus: t.genus })), want.topology, `output ${k} topology`);
      const names = o.brep.faces.map(f => base(f.name ?? f.id));
      if (want.faceNames) assert.deepEqual([...new Set(names)].sort(), want.faceNames, `output ${k} face names`);
      if (want.faceNamePattern) assert.ok(names.every(n => new RegExp(want.faceNamePattern).test(n)), `output ${k} face names match ${want.faceNamePattern}`);
      if (want.areaMM2) assert.ok(Math.abs(o.surfaceArea() - want.areaMM2.value) <= want.areaMM2.relTol * want.areaMM2.value, `output ${k} area ${o.surfaceArea()} vs ${want.areaMM2.value}`);
      if (want.tessellation?.watertight) { const mesh = tessellateBrep(o.brep, { segmentsPerQuarter: want.tessellation.segmentsPerQuarter }); assert.equal(openEdges(mesh.positionsMM, mesh.indices), 0, `output ${k} tessellation watertight`); }
    });
    if (c.expect.stepRoundTrip) {
      const back = importStep(exportStep(outputs.map(o => o.brep), { name: c.id })), r = checkBrep(back, { strict: true }), tol = c.expect.stepRoundTrip.relTol;
      assert.equal(r.valid, true, `round trip: ${r.issues[0]}`);
      const v0 = outputs.reduce((s, o) => s + o.massProperties(1).volumeMM3, 0), a0 = outputs.reduce((s, o) => s + o.surfaceArea(), 0);
      assert.ok(Math.abs(brepMassProperties(back, 1).volumeMM3 - v0) <= tol * v0, 'round-trip volume');
      assert.ok(Math.abs(brepSurfaceArea(back) - a0) <= tol * a0, 'round-trip area');
    }
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeExperimental as C } from '@barocss/gpu';
import { evaluatePart, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { accessSamples } from '@barocss/cad-model/machining/access';
import { wallSamples } from '@barocss/cad-model/chat/analysis';
import { accessMapOf, accessStep } from '../src/viewport/scalarMaps';

// G25 (G-R12): the GPU analyses' inputs and folds, on the CPU mirror, against the studio's own CPU maps on real parts —
// so the GPU pass computes what the panels' numbers are. Access (G25b): cad-model's accessSamples per triangle (share and
// OR mask) equal the experimental samples folded back. Thickness (G25a): cad-model's wallSamples depth and local per
// triangle equal the mirror within f32 (1e-4 of the part's size). On the CNC8 pocket plate and the r14 geometric plate.

const fixture = (name: string): StudioDoc => ({ ...emptyDoc(), ...JSON.parse(readFileSync(join(process.cwd(), name), 'utf8')) } as StudioDoc);
const r14 = (): StudioDoc => ({ ...emptyDoc(), ...(JSON.parse(readFileSync(join(process.cwd(), '../../packages/barocss-cad/conformance/r14/tol-plate-geometric/case.json'), 'utf8')) as { input: { document: StudioDoc } }).input.document } as StudioDoc);
const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluatePart(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.ok ? r.bodies : []; };
const cases: [string, () => StudioDoc][] = [['the CNC8 pocket plate', () => fixture('test/fixtures/cnc8-pocket.bcad')], ['the r14 geometric plate', r14]];

test('G25b access: cad-model\'s per-triangle share and mask equal the experimental samples folded back', () => {
  for (const [name, make] of cases) {
    const bodies = bodiesOf(make()), cpu = accessSamples(bodies);
    // (The studio's step, as its GPU map uses it: accessSamples' own, the bodies' diagonal over 200, at least 0.1.)
    const step = accessStep(bodies);
    bodies.forEach((b, i) => {
      const s = C.accessSampleSet(b.mesh.positions, b.mesh.indices, step), r = C.accessByTriangle(s, C.cpuAccessMasks(C.packBvh(b.mesh), s));
      const map = accessMapOf(b.key, r.unreachedShare, true);
      assert.match(map.legend.title, /GPU estimate/); assert.equal(map.values.length, cpu[i].unreachedShare.length);
      let worst = 0, masks = 0;
      for (let t = 0; t < s.triangles; t++) { worst = Math.max(worst, Math.abs(r.unreachedShare[t] - cpu[i].unreachedShare[t])); if (r.mask[t] !== cpu[i].mask[t]) masks++; }
      assert.ok(worst < 1e-5 && masks === 0, `${name} body ${i}: worst share ${worst}, ${masks} masks differ`);
    });
  }
});

test('G25a thickness: cad-model\'s wallSamples depth and local per triangle equal the mirror within f32', () => {
  for (const [name, make] of cases) {
    for (const b of bodiesOf(make())) {
      const w = wallSamples(b), rays = C.wallRays(b.mesh.positions, b.mesh.indices), size = Math.max(1, ...b.mesh.bounds.max.map(Math.abs), ...b.mesh.bounds.min.map(Math.abs));
      const g = C.cpuWallThickness(C.packBvh(b.mesh), rays, 1e-6);
      let worst = 0, misses = 0;
      for (let t = 0; t < rays.count; t++) {
        if (Number.isFinite(w.depth[t]) !== Number.isFinite(g.depth[t])) { misses++; continue; }
        if (Number.isFinite(w.depth[t])) worst = Math.max(worst, Math.abs(w.depth[t] - g.depth[t]), Math.abs(w.local[t] - g.local[t]));
      }
      assert.ok(misses === 0 && worst <= 1e-4 * size, `${name}: worst ${worst}, ${misses} hit/miss differ`);
    }
  }
});

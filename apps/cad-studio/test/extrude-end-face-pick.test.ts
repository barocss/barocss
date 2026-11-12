import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceExtrudeEndFace, shownExtrudeEndFace } from '../src/app/extrudeEndFace';
import type { Active } from '../src/app/commandState';
import { extrudeCommand } from '@barocss/cad-model/app/profileCommands';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';

test('an Extrude end face maps through reordered previews and refuses generated or ambiguous ownership', () => {
  const doc: StudioDoc = {
    format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
    nodes: [
      { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [-5, -5], max: [15, 15] },
      { id: 'n1', kind: 'extrude', sketch: 0, from: 20, height: 5 },
      { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] },
    ],
    outputs: { b1: { node: 1, side: 'solid' } }, nextId: 3,
  };
  const base = evaluateDoc(doc, 0);
  assert.ok(base.ok);
  const active: Active = {
    cmd: extrudeCommand, values: { depth: 'to-face', endBody: 0, endFace: 'n1.bottom' }, preview: 'ok',
    ctx: { doc, viewportEndFace: true, bodies: base.bodies, selection: { sketches: [2], faces: [], edges: [], bodies: [] } },
  };
  const preview = evaluateDoc(active.cmd.build!(active.ctx, active.values), 1);
  assert.ok(preview.ok);
  const [retained, generated] = preview.bodies;
  const shown = [generated, retained];
  const face = retained.mesh.faces.find(face => face.name === 'n1.bottom')!.index;
  const hit = { face: { body: 1, face }, edge: null };
  assert.deepEqual(sourceExtrudeEndFace(active, shown, hit), { body: 0, face });
  assert.deepEqual(shownExtrudeEndFace(active, shown), { body: 1, face });
  assert.equal(sourceExtrudeEndFace(active, shown, { ...hit, face: { body: 0, face } }), null);
  assert.equal(sourceExtrudeEndFace(active, shown, { ...hit, instance: 'i1' }), null);
  assert.equal(sourceExtrudeEndFace(active, shown, { ...hit, instanceCap: { body: 1 } }), null);
  assert.equal(sourceExtrudeEndFace(active, shown, { ...hit, direct: 'surface' }), null);
  assert.equal(sourceExtrudeEndFace(active, [...shown, retained], hit), null);
  const wrongRef = { ...retained, ref: { node: 3, side: 'solid' as const } };
  assert.equal(sourceExtrudeEndFace(active, [generated, wrongRef], hit), null);
  const mergedFace = { ...retained.mesh.faces[face], name: 'n1.bottom+n1.side0' };
  const merged = { ...retained, mesh: { ...retained.mesh, faces: retained.mesh.faces.map((value, index) => index === face ? mergedFace : value) } };
  assert.equal(sourceExtrudeEndFace(active, [generated, merged], hit), null);
});

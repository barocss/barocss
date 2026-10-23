import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { rectanglePart } from '@barocss/cad-model/engine/doc';
import { mergeBodies } from '../src/viewport/sectionView';

// O179: a cut body's pieces merged for the section view sum their volumes — so the merged volume is from the mesh when
// any piece's is, its bound the pieces' sum (unknown when one's is), never the first piece's alone; exact pieces, none.
const box = (): BodyResult => { const r = evaluateDoc(rectanglePart(10, 10, 10), 1); assert.ok(r.ok); return r.bodies[0]; };
const fromMesh = (b: BodyResult, boundMM3: number | null): BodyResult => ({ ...b, volumeBasis: { method: 'tessellated', boundMM3 } });

test('O179: merged pieces — a tessellated piece makes the whole one, bounds summed; one unknown, unknown; all exact, none', () => {
  const a = box(), b = box();
  assert.equal(mergeBodies([a, b]).volumeBasis, undefined);
  assert.deepEqual(mergeBodies([a, fromMesh(b, 2)]).volumeBasis, { method: 'tessellated', boundMM3: 2 });
  assert.deepEqual(mergeBodies([fromMesh(a, 1.5), fromMesh(b, 2)]).volumeBasis, { method: 'tessellated', boundMM3: 3.5 });
  assert.deepEqual(mergeBodies([fromMesh(a, 1.5), fromMesh(b, null)]).volumeBasis, { method: 'tessellated', boundMM3: null });
  assert.ok(Math.abs(mergeBodies([a, b]).volumeMM3! - 2 * a.volumeMM3!) < 1e-9);
});

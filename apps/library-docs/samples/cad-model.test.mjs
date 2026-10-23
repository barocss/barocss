// @barocss/cad-model as a program uses it: modules imported by path; a studio document built, evaluated into bodies,
// written as STEP, saved as a .bcad and read back, its revision unchanged. The cad-model page includes the #region
// blocks. Run: pnpm test:samples
import test from 'node:test';
import assert from 'node:assert/strict';
// #region import
import { rectanglePart, withNode } from '@barocss/cad-model/engine/doc';
import { evaluateDoc, stepFor } from '@barocss/cad-model/engine/evaluate';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { revisionOf } from '@barocss/cad-model/util/revision';
// #endregion import

test('a document: built, evaluated, written as STEP, saved and read back', async () => {
  // #region doc
  // A 40 × 20 × 5 plate (its sketch and extrude), then a Ø6 hole through it.
  const plate = rectanglePart(40, 20, 5);
  const doc = withNode(plate, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [10, 10], radius: 3 });

  const result = evaluateDoc(doc, 1);          // the bodies, their display meshes and masses
  assert.ok(result.ok);
  const [body] = result.bodies;
  assert.ok(Math.abs(body.volumeMM3 - (40 * 20 * 5 - Math.PI * 9 * 5)) < 1e-6);

  const step = stepFor(doc, 'plate');          // the exact solids, naming the revision they came from
  assert.ok('text' in step);
  assert.equal(step.source, revisionOf(doc));
  // #endregion doc

  // #region file
  const bytes = encodeStudioFile(doc);         // plain JSON, or the BCADPACK container when it holds mesh data
  const back = await readStudioFile(bytes);
  assert.ok('doc' in back);
  assert.equal(revisionOf(back.doc), revisionOf(doc));
  // #endregion file
});

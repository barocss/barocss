// @barocss/cad-model as a program uses it: modules imported by path; a studio document written through the object
// facade, evaluated into bodies by the core, written as STEP, saved as a .bcad and read back, its revision unchanged. The
// cad-model page includes the #region blocks. Run: pnpm test:samples
import test from 'node:test';
import assert from 'node:assert/strict';
// #region import
import { part } from '@barocss/cad-model/api';                                  // the object facade
import { evaluateDoc, stepFor } from '@barocss/cad-model/engine/evaluate';     // the core, module by module
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { revisionOf } from '@barocss/cad-model/util/revision';
// #endregion import

test('a document: built, evaluated, written as STEP, saved and read back', async () => {
  // #region doc
  // A 40 × 20 × 5 plate, then a Ø6 hole through it.
  const plate = part('plate')
    .box({ w: 40, d: 20, h: 5 })
    .hole(body => body.faces().facing('+z'), { d: 6, x: 10, y: 10 });
  const doc = plate.doc;                       // the studio document, as the studio's own commands write it

  const result = evaluateDoc(doc, 1);          // the core: the bodies, their display meshes and masses
  assert.ok(result.ok);
  const [body] = result.bodies;
  assert.ok(Math.abs(body.volumeMM3 - (40 * 20 * 5 - Math.PI * 9 * 5)) < 1e-6);
  assert.equal(plate.mass('al6061').volumeMM3, body.volumeMM3);

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

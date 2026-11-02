import test from 'node:test';
import assert from 'node:assert/strict';
import { rectanglePart, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { modelPrint, defaultDrawing } from '@barocss/cad-model/drawing/types';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { drawingRevisionPrint } from '../src/ui/drawing/revisionPrint';

function parameterized(): StudioDoc {
  const doc = rectanglePart(60, 40, 10);
  const sketch = doc.nodes[0]; assert.ok(sketch.kind === 'sketch' && sketch.profile === 'rectangle');
  sketch.max[0] = { parameter: 'W' };
  return { ...doc, parameters: { W: 60 } };
}

test('parameter-only geometry edits change the stamp while the same authored nodes stay exact', () => {
  const doc = parameterized(), before = structuredClone(doc), changed = { ...doc, parameters: { W: 70 } };
  assert.deepEqual(changed.nodes, doc.nodes);
  assert.notEqual(drawingRevisionPrint(changed), drawingRevisionPrint(doc));
  assert.deepEqual(doc, before, 'reading a stamp does not change the document');
});

test('parameter-free parts retain the exact legacy stamp and changed nodes still invalidate it', () => {
  const doc = rectanglePart(60, 40, 10);
  assert.equal(drawingRevisionPrint(doc), modelPrint(doc.nodes));
  const changed = structuredClone(doc), extrude = changed.nodes[1]; assert.ok(extrude.kind === 'extrude'); extrude.height = 12;
  assert.notEqual(drawingRevisionPrint(changed), drawingRevisionPrint(doc));
  assert.equal(drawingRevisionPrint(changed), modelPrint(changed.nodes));
  const bound = parameterized(), changedBound = structuredClone(bound), boundExtrude = changedBound.nodes[1];
  assert.ok(boundExtrude.kind === 'extrude'); boundExtrude.height = 12;
  assert.notEqual(drawingRevisionPrint(changedBound), drawingRevisionPrint(bound));
});

test('drawing revision, layout and observed dimension signature enrichment do not change a model stamp', () => {
  const doc = parameterized(), old = drawingRevisionPrint(doc);
  const drawing = { ...defaultDrawing(), revision: 'A', revisedModel: old, dimensions: [{
    id: 'd1', view: 'top' as const, kind: 'linear' as const, orient: 'horizontal' as const, place: [20, -10] as [number, number],
    a: { edge: 'n1.bottom|n1.side0', at: 'end' as const, near: [0, 0, 0] as [number, number, number] },
    b: { edge: 'n1.bottom|n1.side0', at: 'end' as const, near: [60, 0, 0] as [number, number, number] },
  }] };
  const before = { ...doc, drawing }, changed = structuredClone(before);
  changed.drawing.revision = 'B'; changed.drawing.revisedModel = 'new issue'; changed.drawing.scale = 0.5;
  const dim = changed.drawing.dimensions[0];
  Object.assign(dim.a, { sig: { k: 'line', p: [35, 0, 0], d: [1, 0, 0], s: 70 } });
  Object.assign(dim.b, { sig: { k: 'line', p: [35, 40, 0], d: [-1, 0, 0], s: 70 } });
  assert.equal(drawingRevisionPrint(before), old); assert.equal(drawingRevisionPrint(changed), old);
  assert.notDeepEqual(changed.drawing, before.drawing);
});

test('Save/Open preserves a multi-parameter stamp and tracks authored parameter values', async () => {
  const doc = { ...parameterized(), parameters: { W: 60, Depth: 40, Unused: 3 } };
  const stamp = drawingRevisionPrint(doc), opened = await readStudioFile(encodeStudioFile(doc));
  assert.ok('doc' in opened); assert.equal(drawingRevisionPrint(opened.doc), stamp);
  assert.notEqual(drawingRevisionPrint({ ...doc, parameters: { ...doc.parameters, Depth: 45 } }), stamp);
  assert.notEqual(drawingRevisionPrint({ ...doc, parameters: { ...doc.parameters, Unused: 4 } }), stamp, 'all authored parameter values are covered; no usage inference');
});

test('an old node-only stamp on a parameterized part remains outdated until the user stamps it again', () => {
  const doc = parameterized(), legacy = modelPrint(doc.nodes), current = drawingRevisionPrint(doc);
  assert.notEqual(current, legacy);
  const stamped = { ...doc, drawing: { ...defaultDrawing(), revision: 'A', revisedModel: legacy } };
  assert.equal(stamped.drawing.revisedModel, legacy, 'reading the new dependency never auto-restamps a saved issue');
  assert.notEqual(stamped.drawing.revisedModel, drawingRevisionPrint(stamped));
  assert.equal(drawingRevisionPrint({ ...stamped, parameters: {} }), legacy, 'empty parameters use the exact old contract');
});

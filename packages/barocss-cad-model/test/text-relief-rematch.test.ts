import test from 'node:test';
import assert from 'node:assert/strict';
import { rectanglePart, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { evaluatePart, type EvalResult } from '../src/engine/evaluate';
import { rematchNames } from '../src/engine/rematch';

// Matcher integration only: authored replacement names on one real box exercise the edit registry.
// This does not run a font provider or qualify native topology renaming.
function source(): StudioDoc {
  return withNode(rectanglePart(40, 30, 10), { kind: 'text-relief', parent: { node: 1, side: 'solid' },
    faces: ['n1.top'], text: 'A n1.top', font: { blob: 'a'.repeat(64), filename: 'source.ttf',
      source: 'Provided n1.top', license: 'Provided fixture' }, size: 10, at: [5, 5], depth: 2,
    mode: 'emboss', tolerance: 0.01 });
}
function edited(doc: StudioDoc): StudioDoc {
  return { ...doc, nodes: doc.nodes.map((node, i) => i === 0 && node.kind === 'sketch'
    ? { ...node, profile: 'rectangle', min: [0, 0], max: [41, 30] } as ModelNode : node) };
}
async function matcher(after: 'unique' | 'ambiguous' | 'gone') {
  const result = evaluatePart(rectanglePart(40, 30, 10), 1); assert.ok(result.ok);
  let calls = 0;
  return { evaluate: async (): Promise<EvalResult> => {
    const out = structuredClone(result); if (calls++ === 0) return out;
    const faces = out.bodies[0].mesh.faces, index = faces.findIndex(face => face.name === 'n1.top');
    assert.ok(index >= 0);
    const top = { ...faces[index], name: 'replacement.top' };
    if (after === 'gone') faces.splice(index, 1);
    else {
      faces[index] = top;
      if (after === 'ambiguous') {
        faces[index] = { ...top, centroid: [top.centroid[0], top.centroid[1], top.centroid[2] + 0.001] };
        faces.push({ ...top, name: 'other.top', centroid: [top.centroid[0], top.centroid[1], top.centroid[2] - 0.001] });
      }
    }
    return out;
  }, calls: () => calls };
}

test('text relief rematches a renamed cap without changing source metadata', async () => {
  const before = source(), next = edited(before), original = structuredClone({ before, next }), mock = await matcher('unique');
  const result = await rematchNames(before, next, mock.evaluate);
  assert.ok('doc' in result); assert.equal(mock.calls(), 2);
  assert.deepEqual(result.changes, [{ node: 2, from: 'n1.top', to: 'replacement.top' }]);
  const node = result.doc.nodes[2]; assert.ok(node.kind === 'text-relief');
  assert.deepEqual(node.faces, ['replacement.top']); assert.deepEqual(node.rematched, { 'replacement.top': 'n1.top' });
  assert.equal(node.text, 'A n1.top'); assert.equal(node.font.source, 'Provided n1.top');
  assert.deepEqual({ before, next }, original);
});

test('text relief refuses an edit when its former cap is ambiguous or gone', async () => {
  for (const kind of ['ambiguous', 'gone'] as const) {
    const before = source(), next = edited(before), original = structuredClone({ before, next }), mock = await matcher(kind);
    const result = await rematchNames(before, next, mock.evaluate);
    assert.ok('error' in result, kind);
    assert.match(result.error, kind === 'ambiguous' ? /now one of/ : /is gone after this edit/);
    assert.deepEqual({ before, next }, original);
  }
});

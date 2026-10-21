import test from 'node:test';
import assert from 'node:assert/strict';
import { referencesOf, markedReferences } from '@barocss/cad-model/engine/references';
import { modelHash } from '@barocss/cad-model/chat/spec';
import { rectanglePart, withNode, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';

// PERF3 A6 (D82): the references' copy is copy-on-write — the setters never reach the source (frozen here), the
// nodes they do not touch stay the same objects — and the read-only walk copies nothing.
function frozen<T>(x: T): T { if (x && typeof x === 'object' && !Object.isFrozen(x)) { Object.freeze(x); for (const v of Object.values(x)) frozen(v); } return x; }
function docWithRefs(): StudioDoc {
  let doc = rectanglePart(40, 30, 10);
  doc = withNode(doc, { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['e1', 'e2'], radius: 1, sigs: { e1: { k: 'line' } }, rematched: { e2: 'e9' } } as unknown as ModelNode);
  return { ...doc, bodies: { b2: { faces: { 'f1': '#f00' }, faceSigs: { f1: { k: 'plane' } } } } as unknown as StudioDoc['bodies'],
    mates: [{ id: 'm1', kind: 'flush', a: { part: 'p1', face: 'top' }, b: { part: 'p2', face: 'bottom' } }] as unknown as StudioDoc['mates'] };
}

test('the setters change the copy only; untouched nodes are shared; the read-only walk is the document itself', () => {
  const src = frozen(docWithRefs()), before = JSON.stringify(src);
  const { doc, refs } = referencesOf(src);
  assert.equal(doc.nodes[0], src.nodes[0]); assert.equal(doc.nodes[1], src.nodes[1]); assert.notEqual(doc.nodes[2], src.nodes[2]);
  for (const r of refs) { r.rename(r.name + 'x', true); r.setSig({ k: 'x' } as never); r.clear(); }
  assert.equal(JSON.stringify(src), before);
  assert.deepEqual((doc.nodes[2] as unknown as { edges: string[] }).edges, ['e1x', 'e2x']);
  assert.equal(doc.mates![0].a.face, 'topx');
  assert.equal(referencesOf(src, true).doc, src);
  assert.deepEqual(markedReferences(src).map(m => [m.was, m.now]), [['e9', 'e2']]);
});

test('modelHash: kept by the objects it reads, the same value as the whole walk', () => {
  const d = docWithRefs(), s = JSON.stringify([d.nodes, d.parameters, d.bodies]); let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  const expected = h.toString(16).padStart(8, '0');
  assert.equal(modelHash(d), expected); assert.equal(modelHash({ ...d, selection: undefined } as StudioDoc), expected);
  assert.notEqual(modelHash({ ...d, parameters: { w: 1 } }), expected);
});

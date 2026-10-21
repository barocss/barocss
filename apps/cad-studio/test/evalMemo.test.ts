import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluationKey } from '@barocss/cad-model/engine/evalMemo';
import { rectanglePart, withNode, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';

// PERF3 A3 (D82): the evaluation memo's key — equal parts equal keys whatever their objects, any change a new key,
// and long texts and arrays not written out on every lookup.
const line = "#123=CARTESIAN_POINT('',(12.3456789,23.456789,34.56789));\n";
const step = (mb: number, tail = '') => line.repeat(Math.ceil(mb * 1e6 / line.length)) + tail;
const withImport = (text: string): StudioDoc => withNode(withNode(rectanglePart(20, 10, 5), { kind: 'import', name: 'x', step: text } as ModelNode), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [5, 5], radius: 1 });
const best = (f: () => unknown) => { f(); let b = Infinity; for (let i = 0; i < 5; i++) { const t = performance.now(); f(); b = Math.min(b, performance.now() - t); } return b; };

test('equal parts (new objects, a new copy of the text) share a key; a changed character, number or parameter does not', () => {
  const a = withImport(step(1)), b: StudioDoc = JSON.parse(JSON.stringify(a));
  assert.equal(evaluationKey(a), evaluationKey(b));
  assert.notEqual(evaluationKey(a), evaluationKey(withImport(step(1, 'x'))));
  assert.notEqual(evaluationKey(a), evaluationKey({ ...a, parameters: { w: 2 } }));
  const positions = Array.from({ length: 3 * 3000 }, (_, i) => i * 0.5), faces = Array.from({ length: 2000 }, (_, i) => [i, i + 1, i + 2, i + 3]);
  const cage = (p: number[]) => withNode(rectanglePart(20, 10, 5), { kind: 'subd', name: 's', cage: { positions: p, faces } } as ModelNode);
  const moved = [...positions]; moved[4321] += 1e-9;
  assert.equal(evaluationKey(cage(positions)), evaluationKey(cage([...positions])));
  assert.notEqual(evaluationKey(cage(positions)), evaluationKey(cage(moved)));
});

test('a key with a 30 MB STEP import costs little: the same nodes, nodes made again, the text read again', () => {
  const a = withImport(step(30));
  const same = best(() => evaluationKey(a));
  const remade = best(() => evaluationKey({ ...a, nodes: a.nodes.map(n => ({ ...n })) }));
  const copies = Array.from({ length: 6 }, () => JSON.parse(JSON.stringify(a)) as StudioDoc); let k = 0;
  const reread = best(() => evaluationKey(copies[k++]));
  console.log(`key ms, 30 MB import: same nodes ${same.toFixed(2)}, nodes made again ${remade.toFixed(2)}, text read again ${reread.toFixed(2)} (whole JSON: 69)`);
  assert.ok(same < 1 && remade < 5, `${same} ${remade}`);
});

test('a key with a 200k-triangle inline mesh or a 2k-face cage costs little', () => {
  const positions = Array.from({ length: 600000 }, (_, i) => (i * 7919) % 1000 / 10), indices = Array.from({ length: 600000 }, (_, i) => i % 200000);
  const mesh = withNode(rectanglePart(20, 10, 5), { kind: 'mesh', name: 'm', unit: 'mm', positions, indices } as ModelNode);
  const meshSame = best(() => evaluationKey(mesh)), copies = Array.from({ length: 6 }, () => JSON.parse(JSON.stringify(mesh)) as StudioDoc); let k = 0;
  const meshReread = best(() => evaluationKey(copies[k++]));
  const cp = Array.from({ length: 3 * 2100 }, (_, i) => (i * 31) % 997 / 10), faces = Array.from({ length: 2048 }, (_, i) => [i % 2000, (i + 1) % 2000, (i + 2) % 2000, (i + 3) % 2000]);
  const cage = withNode(rectanglePart(20, 10, 5), { kind: 'subd', name: 's', cage: { positions: cp, faces } } as ModelNode), cages = Array.from({ length: 6 }, () => JSON.parse(JSON.stringify(cage)) as StudioDoc); let j = 0;
  const cageReread = best(() => evaluationKey(cages[j++]));
  console.log(`key ms, 200k-triangle inline mesh: same nodes ${meshSame.toFixed(2)}, read again ${meshReread.toFixed(2)} (whole JSON: 53); 2k-face cage read again ${cageReread.toFixed(2)} (whole JSON: 0.57)`);
  assert.ok(meshSame < 1, String(meshSame));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, rectanglePart, withNode, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { editFields, type EditField } from '@barocss/cad-model/app/editFields';

const field = (nodes: readonly ModelNode[], i: number, key: string): EditField => {
  const f = editFields(nodes, i).find(x => x.key === key);
  assert.ok(f, `no field ${key} among ${editFields(nodes, i).map(x => x.key).join(', ')}`);
  return f;
};
const volume = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies.map(b => b.volumeMM3!); };
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));

test('edit fields: an extrude edits its sketch\'s width and corner as well as its distance', () => {
  const doc = rectanglePart(60, 40, 20);
  const w = field(doc.nodes, 1, 'w');
  assert.equal(w.kind, 'number');
  if (w.kind !== 'number') return;
  assert.equal(w.get(doc.nodes), 60);
  const nodes = w.set(doc.nodes, 30);
  assert.deepEqual((nodes[0] as { min: number[]; max: number[] }).max, [30, 40]);
  assert.ok(near(volume({ ...doc, nodes })[0], 30 * 40 * 20));
  // Moving the corner keeps the size.
  const c = field(nodes, 1, 'c0');
  if (c.kind !== 'number') return assert.fail();
  const moved = c.set(nodes, 5);
  assert.deepEqual([(moved[0] as { min: number[] }).min, (moved[0] as { max: number[] }).max], [[5, 0], [35, 40]]);
  // The original list is unchanged.
  assert.deepEqual((doc.nodes[0] as { max: number[] }).max, [60, 40]);
});

test('edit fields: a circle extrude edits its diameter; a parameter-driven size is left out', () => {
  let doc = withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5 });
  doc = withNode(doc, { kind: 'extrude', sketch: 0, height: 10 });
  const dia = field(doc.nodes, 1, 'dia');
  if (dia.kind !== 'number') return assert.fail();
  assert.equal(dia.get(doc.nodes), 10);
  assert.ok(near(volume({ ...doc, nodes: dia.set(doc.nodes, 4) })[0], Math.PI * 4 * 10, 2e-3));
  const p = { ...doc, nodes: doc.nodes.map((n, i) => i === 1 ? { ...n, height: { parameter: 'h' } } as ModelNode : n) };
  const h = field(p.nodes, 1, 'h');
  assert.ok(h.kind === 'number' && Number.isNaN(h.get(p.nodes)));
});

test('edit fields: choice and toggle fields — a loft turns smooth, a pipe bends the other way, a pattern counts', () => {
  let doc = emptyDoc();
  for (const r of [10, 6, 9]) doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [0, 0], radius: r });
  doc = withNode(doc, { kind: 'loft', sections: [{ sketch: 0, z: 0 }, { sketch: 1, z: 15 }, { sketch: 2, z: 30 }] });
  const smooth = field(doc.nodes, 3, 'smooth');
  if (smooth.kind !== 'toggle') return assert.fail();
  assert.equal(smooth.get(doc.nodes), false);
  const nodes = smooth.set(doc.nodes, true);
  assert.equal((nodes[3] as { smooth?: boolean }).smooth, true);
  const z = field(nodes, 3, 'z1');
  if (z.kind !== 'number') return assert.fail();
  assert.equal(z.get(nodes), 15);
  // Each section's sketch is editable under its own label.
  assert.ok(editFields(nodes, 3).some(f => f.label === 'Section 2 · Diameter'));
  assert.equal(volume({ ...doc, nodes }).length, 1);

  let pipe = withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 2 });
  pipe = withNode(pipe, { kind: 'sweep', sketch: 0, path: [{ kind: 'straight', length: 20 }, { kind: 'bend', radius: 10, angleDegrees: 90, toward: 'x' }] });
  const toward = field(pipe.nodes, 1, 'toward1');
  if (toward.kind !== 'choice') return assert.fail();
  assert.deepEqual(toward.options.map(o => o.value), ['x', '-x', 'y', '-y']);
  const bent = toward.set(pipe.nodes, '-y');
  assert.equal(((bent[1] as { path: { toward?: string }[] }).path[1]).toward, '-y');
  assert.equal(volume({ ...pipe, nodes: bent }).length, 1);

  let pat = rectanglePart(10, 10, 5);
  pat = withNode(pat, { kind: 'circular-pattern', parent: { node: 1, side: 'solid' }, axis: 'z', angleDegrees: 90, count: 4 });
  const count = field(pat.nodes, 2, 'count');
  if (count.kind !== 'number') return assert.fail();
  const six = count.set(pat.nodes, 6.4);
  assert.deepEqual([(six[2] as { count: number }).count, (six[2] as { angleDegrees: number }).angleDegrees], [6, 60]);
});

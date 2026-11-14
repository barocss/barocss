import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { editCommand } from '../src/app/editCommand';
import { editFields, type BindableField, type EditField } from '../src/app/editFields';

const field = (nodes: readonly ModelNode[], i: number, key: string): EditField => {
  const f = editFields(nodes, i).find(x => x.key === key);
  assert.ok(f, `no field ${key} among ${editFields(nodes, i).map(x => x.key).join(', ')}`);
  return f;
};
const volume = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies.map(b => b.volume!); };
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

test('an attached Cut Distance moves its start with the end held on the sketch', () => {
  const base = rectanglePart(40, 30, 10), target = { node: 1, side: 'solid' } as const;
  const profile = withNode(base, { kind: 'sketch', profile: 'circle', center: [20, 15], radius: 5, on: target,
    plane: { origin: [0, 0, 10], xAxis: [1, 0, 0], normal: [0, 0, 1] } });
  const tool = withNode(profile, { kind: 'extrude', sketch: 2, height: 2, from: -2 });
  const cut = withNode(tool, { kind: 'difference', parent: target, tool: { node: 3, side: 'solid' } });
  const distance = editFields(cut.nodes, 3, { D: 4 }).find(f => f.key === 'h') as BindableField;
  assert.equal(distance.bind(cut.nodes, 'D'), null, 'a single positive parameter cannot write the paired inverse value');
  assert.deepEqual(distance.set(cut.nodes, -4), cut.nodes);
  const deeper = distance.set(cut.nodes, 4);
  assert.deepEqual(deeper[3], { ...cut.nodes[3], height: 4, from: -4 });
  assert.equal(deeper[4], cut.nodes[4]);
  assert.ok(near(volume({ ...cut, nodes: deeper })[0], 12000 - 100 * Math.PI, 1e-10));
  const shifted = field(cut.nodes, 3, 'from') as BindableField;
  assert.deepEqual(distance.set(shifted.set(cut.nodes, -1), 4)[3], { ...cut.nodes[3], height: 4, from: -1 });
  assert.deepEqual(distance.set(tool.nodes, 4)[3], { ...tool.nodes[3], height: 4 });
});

test('drafted anchored Cut edits positive depth and converts both draft transitions around the same sketch', () => {
  const base = rectanglePart(40, 30, 10), target = { node: 1, side: 'solid' } as const;
  const profile = withNode(base, { kind: 'sketch', profile: 'rectangle', min: [14, 11], max: [26, 19], on: target,
    plane: { origin: [0, 0, 10], xAxis: [1, 0, 0], normal: [0, 0, 1] } });
  const tool = withNode(profile, { kind: 'extrude', sketch: 2, height: -2, draft: 10 });
  const cut = withNode(tool, { kind: 'difference', parent: target, tool: { node: 3, side: 'solid' } });
  const distance = editFields(cut.nodes, 3, { D: 4 }).find(f => f.key === 'h') as BindableField;
  const draft = editFields(cut.nodes, 3, { D: 4 }).find(f => f.key === 'draft') as BindableField;
  assert.equal(distance.get(cut.nodes), 2);
  assert.equal(distance.bind(cut.nodes, 'D'), null);
  assert.equal(draft.bind(cut.nodes, 'D'), null);
  assert.deepEqual(distance.set(cut.nodes, -4), cut.nodes);
  const deeper = distance.set(cut.nodes, 4);
  assert.deepEqual(deeper[3], { ...cut.nodes[3], height: -4 });
  const straight = draft.set(deeper, 0);
  assert.deepEqual(straight[3], { id: 'n3', kind: 'extrude', sketch: 2, height: 4, from: -4 });
  assert.deepEqual(draft.set(straight, 10), deeper);
  assert.deepEqual(draft.set(straight, -10)[3], { ...deeper[3], draft: -10 });
  assert.equal(distance.get(tool.nodes), -2, 'standalone extrusion uses its signed distance');
  const start = field(cut.nodes, 3, 'from') as BindableField;
  const shifted = start.set(cut.nodes, -1);
  assert.equal(distance.get(shifted), -2, 'explicit movement retains the signed edit');
  assert.deepEqual(distance.set(shifted, -4)[3], { ...deeper[3], from: -1 });
  assert.equal(distance.get([{ ...cut.nodes[0] }, ...cut.nodes.slice(1, 3), { ...tool.nodes[3], draft: 0 } as ModelNode, cut.nodes[4]]), 2);
  const ctx = { doc: { ...cut, nodes: deeper }, selection: { bodies: [], edges: [], faces: [] }, bodies: [] };
  const command = editCommand(3, deeper)!;
  const values = command.defaults!(ctx);
  assert.equal(values.h, 4);
  assert.throws(() => command.build!(ctx, { ...values, h: -4 }), /Cut Distance/);
  const noDraft = command.build!(ctx, { ...values, draft: 0 });
  const straightContext = { ...ctx, doc: noDraft };
  const straightValues = command.defaults!(straightContext);
  assert.equal(straightValues.from, -4);
  assert.deepEqual(command.build!(straightContext, { ...straightValues, h: 5 }).nodes[3], { ...straight[3], height: 5, from: -5 });
  const handle = command.handles!(straightContext, straightValues).find(handle => handle.key === 'h');
  assert.deepEqual(handle?.at, [20, 15, 6]);
  assert.equal(handle?.dir[2], -1);
  assert.equal(handle?.scale, 1);
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
  pipe = withNode(pipe, { kind: 'sweep', sketch: 0, path: [{ kind: 'straight', length: 20 }, { kind: 'bend', radius: 10, angle: 90, toward: 'x' }] });
  const toward = field(pipe.nodes, 1, 'toward1');
  if (toward.kind !== 'choice') return assert.fail();
  assert.deepEqual(toward.options.map(o => o.value), ['x', '-x', 'y', '-y']);
  const bent = toward.set(pipe.nodes, '-y');
  assert.equal(((bent[1] as { path: { toward?: string }[] }).path[1]).toward, '-y');
  assert.equal(volume({ ...pipe, nodes: bent }).length, 1);

  let pat = rectanglePart(10, 10, 5);
  pat = withNode(pat, { kind: 'circular-pattern', parent: { node: 1, side: 'solid' }, axis: 'z', angle: 90, count: 4 });
  const count = field(pat.nodes, 2, 'count');
  if (count.kind !== 'number') return assert.fail();
  assert.deepEqual(count.integerRange, { min: 2, max: 36 });
  for (const invalid of [6.4, 0, 1, 37, 65]) assert.deepEqual(count.set(pat.nodes, invalid), pat.nodes);
  const six = count.set(pat.nodes, 6);
  assert.deepEqual([(six[2] as { count: number }).count, (six[2] as { angle: number }).angle], [6, 60]);
});

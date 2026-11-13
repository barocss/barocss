import assert from 'node:assert/strict';
import test from 'node:test';
import { commands, type Ctx, type Values } from '../src/app/commands';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { rectanglePart, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc, partBreps } from '../src/engine/evaluate';
import { isRefusal } from '../src/engine/refusal';

const command = commands.find(cmd => cmd.id === 'circular-pattern')!;
const axes = ['x', 'y'] as const, modes = ['one', 'separate'] as const;
type Point = [number, number, number];
function setup(): Ctx {
  const doc = rectanglePart(4, 6, 8), sketch = doc.nodes[0];
  assert.ok(sketch.kind === 'sketch' && sketch.profile === 'rectangle');
  doc.nodes[0] = { ...sketch, min: [10, 20], max: [14, 26] };
  const result = evaluateDoc(doc, 1);
  assert.ok(result.ok);
  return { doc, bodies: result.bodies, selection: { faces: [], edges: [], bodies: [0] } };
}
const inputs = (ctx: Ctx, axis: string, count: Values['count'], result: string): Values =>
  ({ ...command.defaults!(ctx), axis, count, result });
const invalid = (error: unknown) => isRefusal(error, 'VALUE') && /90°.*whole-number Count from 2 to 4/.test(error.message);

test('both X/Y result modes reject unsupported counts before constructing any copies', () => {
  const ctx = setup(), before = structuredClone(ctx.doc);
  for (const axis of axes) for (const mode of modes) {
    for (const count of [5, 9, 36, 2.5, 0, 1, -4, Infinity, -Infinity, NaN, '', 'unknown']) {
      assert.throws(() => command.build!(ctx, inputs(ctx, axis, count, mode)), invalid);
      assert.deepEqual(ctx.doc, before);
    }
  }
});

test('axis-sensitive Count fields keep the raw values and the existing Z range and spread', () => {
  const ctx = setup(), original = { ...inputs(ctx, 'z', 9, 'one'), span: -720, px: 2, py: 3 };
  for (const axis of [...axes, 'z']) {
    const values: Values = { ...original, axis };
    const field = command.fields!(ctx, values).find(field => field.key === 'count');
    assert.ok(field?.kind === 'count');
    assert.deepEqual([field.min, field.max, values.count], [2, axis === 'z' ? 36 : 4, 9]);
    if (axis !== 'z') assert.throws(() => command.build!(ctx, values), invalid);
  }
  const result = command.build!(ctx, original).nodes.at(-1);
  assert.ok(result?.kind === 'circular-pattern');
  assert.equal(result.count, 9);
  assert.equal(result.span, -720);
  assert.equal(result.angle, -90);
  assert.deepEqual(result.pivot, [2, 3, 0]);
});

test('both Z result modes refuse invalid counts and accept both field bounds', () => {
  const ctx = setup(), before = structuredClone(ctx.doc);
  for (const mode of modes) {
    for (const count of [0, 1, -4, 2.5, 37, Infinity, -Infinity, NaN, '', 'unknown']) {
      assert.throws(() => command.build!(ctx, inputs(ctx, 'z', count, mode)),
        error => isRefusal(error, 'VALUE') && /whole-number Count from 2 to 36/.test(error.message));
      assert.deepEqual(ctx.doc, before);
    }
    for (const count of [2, 36]) {
      const doc = command.build!(ctx, inputs(ctx, 'z', count, mode));
      assert.equal(Object.keys(doc.outputs).length, mode === 'one' ? 1 : count);
      assert.deepEqual(doc.nodes.slice(0, 2), before.nodes);
    }
  }
});

function corners(axis: typeof axes[number], count: number): Set<string> {
  const original: Point[] = [10, 14].flatMap(x => [20, 26].flatMap(y => [0, 8].map(z => [x, y, z] as Point)));
  let piece = original;
  const expected = new Set<string>();
  for (let copy = 0; copy < count; copy++) {
    piece.forEach(p => expected.add(p.join(',')));
    piece = piece.map(([x, y, z]) => axis === 'x' ? [x, -z, y] : [z, y, -x]);
  }
  return expected;
}

test('supported counts preserve native quarter-turn corners, disjoint solids and output ownership', () => {
  const ctx = setup();
  for (const axis of axes) for (const mode of modes) for (const count of [2, 3, 4]) {
    const doc = command.build!(ctx, inputs(ctx, axis, count, mode));
    assert.deepEqual(doc.nodes.slice(0, 2), ctx.doc.nodes);
    const native = partBreps(doc), evaluated = evaluateDoc(doc, 1);
    assert.ok(evaluated.ok);
    assert.equal(native.length, mode === 'one' ? 1 : count);
    if (mode === 'one') {
      const node = doc.nodes[2];
      assert.ok(node.kind === 'circular-pattern');
      assert.deepEqual([node.axis, node.count, node.angle], [axis, count, 90]);
      assert.equal(native[0].brep.bodies.length, count);
    } else {
      assert.ok(native.every(output => output.brep.bodies.length === 1));
      assert.deepEqual(doc.nodes.filter(node => node.kind === 'rotate').map(node => [node.axis, node.angle]),
        Array.from({ length: count - 1 }, (_, copy) => [axis, (copy + 1) * 90]));
    }
    const actual = new Set(native.flatMap(({ brep }) => brep.vertices.map(({ point }) => {
      const rounded = point.map(value => Math.round(value));
      assert.ok(point.every((value, i) => Math.abs(value - rounded[i]) < 1e-9));
      return rounded.join(',');
    })));
    assert.deepEqual(actual, corners(axis, count));
    const total = evaluated.bodies.reduce((sum, body) => sum + (body.volume ?? 0), 0);
    assert.ok(Math.abs(total - count * 192) < 1e-7);
  }
});

test('native legacy X/Y Count1 and Count4 documents still round-trip', async () => {
  const ctx = setup();
  for (const axis of axes) {
    const created = command.build!(ctx, inputs(ctx, axis, 4, 'one')), node = created.nodes[2];
    assert.ok(node.kind === 'circular-pattern');
    for (const count of [1, 4]) {
      const doc: StudioDoc = { ...created, nodes: [...created.nodes.slice(0, 2), { ...node, count }] };
      const read = await readStudioFile(encodeStudioFile(doc));
      assert.ok('doc' in read);
      assert.deepEqual(read.doc, doc);
      const result = evaluateDoc(read.doc, 1);
      assert.ok(result.ok);
      assert.ok(Math.abs((result.bodies[0].volume ?? 0) - count * 192) < 1e-7);
    }
  }
});

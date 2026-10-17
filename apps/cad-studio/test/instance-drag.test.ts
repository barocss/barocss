import test from 'node:test';
import assert from 'node:assert/strict';
import { gizmoAxes, movedInstance, previewMatrix, turnedInstance } from '../src/assembly/drag';
import { rotationMatrix } from '../src/assembly/mates';
import { rectanglePart, type PartInstance } from '../src/engine/doc';

type V = [number, number, number];
const placeOf = (inst: PartInstance, p: V): V => { const R = rotationMatrix(inst.rotation); return [0, 1, 2].map(i => R[i * 3] * p[0] + R[i * 3 + 1] * p[1] + R[i * 3 + 2] * p[2] + inst.position[i]) as V; };
const byMatrix = (m: Float64Array, p: V): V => [0, 1, 2].map(i => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i]) as V;
const near = (a: readonly number[], b: readonly number[]) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
const block: PartInstance = { id: 'b', name: 'b', doc: rectanglePart(10, 6, 4), position: [20, 5, 0], rotation: [0, 0, 30] };

test('instance drag: a move adds to the position; a turn about a world axis keeps the centre', () => {
  assert.deepEqual(movedInstance(block, [3, 0, -2]).position, [23, 5, -2]);
  const c: V = [25, 8, 2], turned = turnedInstance(block, 2, 90, c);
  // Every point of the part goes round the centre by 90° about Z.
  for (const p of [[0, 0, 0], [10, 6, 4], [10, 0, 0]] as V[]) {
    const before = placeOf(block, p), after = placeOf(turned, p);
    assert.ok(near(after, [c[0] - (before[1] - c[1]), c[1] + (before[0] - c[0]), before[2]]), JSON.stringify({ p, before, after }));
  }
  assert.deepEqual(turned.rotation, [0, 0, 120]);
  // About X, from a turned stance: still a rigid turn about the world axis.
  const tx = turnedInstance(block, 0, 45, c);
  for (const p of [[0, 0, 0], [10, 6, 4]] as V[]) {
    const b = placeOf(block, p), a = placeOf(tx, p), s = Math.SQRT1_2;
    assert.ok(near(a, [b[0], c[1] + s * (b[1] - c[1]) - s * (b[2] - c[2]), c[2] + s * (b[1] - c[1]) + s * (b[2] - c[2])]), JSON.stringify({ p, a, b }));
  }
});

test('instance drag: the preview matrix moves the placed part where the committed placement puts it', () => {
  const c: V = [25, 8, 2];
  for (const drag of [{ kind: 'move' as const, delta: [1, 2, 3] as V }, { kind: 'turn' as const, axis: 1 as const, degrees: 37, centre: c }]) {
    const next = drag.kind === 'move' ? movedInstance(block, drag.delta) : turnedInstance(block, drag.axis, drag.degrees, drag.centre), m = previewMatrix(drag);
    for (const p of [[0, 0, 0], [10, 6, 4], [3, 1, 2]] as V[]) assert.ok(near(byMatrix(m, placeOf(block, p)), placeOf(next, p)), JSON.stringify({ drag, p }));
  }
});

test('instance drag: fixed, hidden and fully mated parts get no gizmo; a part that can only slide gets arrows', () => {
  assert.equal(gizmoAxes({ ...block, grounded: true }, undefined), null);
  assert.equal(gizmoAxes({ ...block, hidden: true }, undefined), null);
  assert.equal(gizmoAxes(block, { turns: 0, slides: 0 }), null);
  assert.deepEqual(gizmoAxes(block, { turns: 0, slides: 2 }), { move: [0, 1, 2], turn: [] });
  assert.deepEqual(gizmoAxes(block, undefined), { move: [0, 1, 2], turn: [0, 1, 2] });
});

test('a dragged move lines up with other bodies’ sides and middles within the tolerance', async () => {
  const { alignMove } = await import('../src/assembly/drag');
  const box = { min: [0, 0, 0], max: [10, 10, 10] }, other = { min: [30, 0, 0], max: [50, 10, 20] };
  // Dragged along X to 19.4: its high side (29.4) is drawn onto the other's low side (30).
  assert.deepEqual(alignMove(box, [other], [19.4, 0, 0], [true, false, false], 1), { move: [20, 0, 0], snapped: [0] });
  // Too far (2.5 mm off) or along an axis not dragged: left as it is.
  assert.deepEqual(alignMove(box, [other], [17.5, 0, 3.6], [true, false, false], 1).move, [17.5, 0, 3.6]);
  // Middles line up too (Z: 5 + 4.6 → the other's middle 10).
  assert.deepEqual(alignMove(box, [other], [0, 0, 4.6], [false, false, true], 1).move, [0, 0, 5]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { rectanglePart, type PartInstance, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { addAssemblyStep } from '@barocss/cad-model/assembly/steps';
import { OrbitCamera } from '../src/viewport/camera';
import { STEPS_COMMAND, cameraOfView, clampStep, stepAfter, shownSelection, stepOffer, stepsDisplay, viewOfCamera } from '../src/app/assemblySteps';
import { PALETTE_EXTRA } from '../src/app/studioConstants';

// Roadmap 10 ⑥: the Steps panel's pure rules — what a step hides, highlights and fades, its explode scale, its view, what a selection offers.
// Display only: the document handed in is never changed by any of them.

const plate = rectanglePart(40, 40, 10);
const inst = (id: string, z: number): PartInstance => ({ id, name: `Part ${id}`, doc: plate, position: [0, 0, z], rotation: [0, 0, 0], part: { id: 'plate', rev: 'A' } });
const base: StudioDoc = { ...rectanglePart(100, 100, 2), instances: [inst('p1', 0), inst('p2', 10), inst('p3', 20), inst('p4', 30)] };
let doc = addAssemblyStep(base, { name: 'Plates', add: ['p1', 'p2'], explode: 1 }).doc;
doc = addAssemblyStep(doc, { name: 'Block', add: ['p3'], view: { eye: [60, 0, 0], target: [0, 0, 0], up: [0, 0, 1] } }).doc;
doc = addAssemblyStep(doc, { name: 'Top', add: ['p4'] }).doc;
const stepped = doc, snapshot = JSON.stringify(doc);

test('a step hides the waiting parts, highlights its own and takes its explode scale', () => {
  const first = stepsDisplay(stepped, 0, false)!;
  assert.deepEqual([...first.hidden].sort(), ['p3', 'p4']);
  assert.deepEqual(first.highlight, ['p1', 'p2']);
  assert.equal(first.opaque, undefined);
  assert.equal(first.explode, 1);
  const middle = stepsDisplay(stepped, 1, false)!;
  assert.deepEqual([...middle.hidden], ['p4']);
  assert.deepEqual(middle.highlight, ['p3']);
  assert.equal(middle.explode, 0, 'a step with no recorded scale is shown unexploded');
  const last = stepsDisplay(stepped, 2, false)!;
  assert.deepEqual([...last.hidden], []);
  assert.deepEqual(last.highlight, ['p4']);
  assert.equal(JSON.stringify(stepped), snapshot, 'the document is never changed');
});

test('faded: nothing is hidden, the shown parts stay opaque and the waiting ones fade', () => {
  const d = stepsDisplay(stepped, 1, true)!;
  assert.equal(d.hidden.size, 0);
  assert.deepEqual(d.opaque, ['p1', 'p2', 'p3']);
  assert.equal(stepsDisplay(stepped, 2, true)!.opaque, undefined, 'nothing waits at the last step: nothing fades');
});

test('a part in no step shows at the last step only; a missing part is kept, never hidden by name', () => {
  const partial = addAssemblyStep(addAssemblyStep(base, { add: ['p1'] }).doc, { add: ['p2'] }).doc;
  assert.deepEqual([...stepsDisplay(partial, 0, false)!.hidden].sort(), ['p2', 'p3', 'p4']);
  assert.deepEqual([...stepsDisplay(partial, 1, false)!.hidden], []);
  const stale = { ...stepped, assemblySteps: [{ id: 'step1', name: 'Fit', add: ['p1', 'p9'] }, { id: 'step2', name: 'Rest', add: ['p2'] }] } as StudioDoc;
  const s = stepsDisplay(stale, 0, false)!;
  assert.deepEqual(s.state.unresolved, ['p9']);
  assert.deepEqual(s.highlight, ['p1']);
  assert.equal(stepsDisplay(base, 0, false), null, 'no steps: nothing to show');
});

test('Prev and Next stop at the ends; the position is clamped into the steps', () => {
  assert.equal(stepAfter(0, -1, 3), 0);
  assert.equal(stepAfter(2, 1, 3), 2);
  assert.equal(stepAfter(1, 1, 3), 2);
  assert.equal(clampStep(7, 3), 2);
  assert.equal(clampStep(-4, 3), 0);
  assert.equal(clampStep(Number.NaN, 3), 0);
  assert.equal(clampStep(2, 0), 0);
  // The same step is shown whichever way it is reached.
  const a = stepsDisplay(stepped, stepAfter(stepAfter(0, 1, 3), 1, 3), false)!, b = stepsDisplay(stepped, 2, false)!;
  assert.deepEqual([[...a.hidden], a.highlight, a.explode], [[...b.hidden], b.highlight, b.explode]);
  assert.equal(stepsDisplay(stepped, 99, false)!.state.index, 2);
});

test('a recommended view is an orbit camera: the eye\'s distance and direction from the target; a camera records back to the same view', () => {
  const cam = cameraOfView({ eye: [60, 0, 0], target: [0, 0, 0], up: [0, 0, 1] }, { fovY: 0.5, ortho: false });
  assert.deepEqual([cam.target, cam.distance, cam.fovY, cam.ortho], [[0, 0, 0], 60, 0.5, false]);
  assert.ok(Math.abs(cam.yaw) < 1e-12 && Math.abs(cam.pitch) < 1e-12);
  const top = cameraOfView({ eye: [0, 0, 80], target: [0, 0, 0], up: [0, 1, 0] }, { fovY: 0.5, ortho: true });
  assert.ok(Math.abs(top.pitch - Math.PI / 2) < 1e-9 && top.ortho);
  const view = { eye: [30, -40, 25] as [number, number, number], target: [5, 5, 5] as [number, number, number], up: [0, 0, 1] as [number, number, number] };
  const back = viewOfCamera(cameraOfView(view, { fovY: 0.5, ortho: false }));
  view.eye.forEach((v, k) => assert.ok(Math.abs(back.eye[k] - v) < 1e-3, `eye ${k}: ${back.eye[k]} vs ${v}`));
  assert.deepEqual(back.target, [5, 5, 5]);
  assert.ok(Math.abs(back.up[2]) > 0.5, 'up points upward for an orbit camera');
  const orbit = new OrbitCamera();
  const recorded = viewOfCamera({ target: [...orbit.target], distance: orbit.distance, yaw: orbit.yaw, pitch: orbit.pitch, fovY: orbit.fovY, ortho: false });
  recorded.eye.forEach((v, k) => assert.ok(Math.abs(v - orbit.eye()[k]) < 1e-3));
});

test('the selection offers the step of the one selected part (not the shown one), or says it is in none', () => {
  assert.deepEqual(stepOffer(stepped, ['p3'], 0), { kind: 'go', index: 1, name: 'Block', part: 'p3' });
  assert.equal(stepOffer(stepped, ['p3'], 1), null);
  assert.equal(stepOffer(stepped, ['p1', 'p3'], 0), null, 'several parts: no offer');
  assert.equal(stepOffer(stepped, ['sub/p3'], 0), null, 'a nested path: no offer');
  assert.equal(stepOffer(stepped, ['nope'], 0), null);
  const partial = addAssemblyStep(base, { add: ['p1'] }).doc;
  assert.deepEqual(stepOffer(partial, ['p2'], 0), { kind: 'none', part: 'p2' });
  assert.equal(stepOffer(base, ['p2'], 0), null, 'no steps: no offer');
});

test('"Assembly steps" is a palette command, available once parts are placed', () => {
  assert.ok(PALETTE_EXTRA.includes(STEPS_COMMAND));
  const ctx = (d: StudioDoc) => ({ doc: d }) as Parameters<typeof STEPS_COMMAND.available>[0];
  assert.deepEqual(STEPS_COMMAND.available(ctx(base)), { ok: true });
  const none = STEPS_COMMAND.available(ctx(rectanglePart(10, 10, 2)));
  assert.ok(!none.ok && /need placed parts/.test(none.reason));
});

test('a waiting (hidden) part has no outline or gizmo: the lit selection leaves out hidden ids, nested paths of them too', () => {
  const hidden = stepsDisplay(stepped, 0, false)!.hidden;
  assert.deepEqual(shownSelection(['p3'], hidden), []);
  assert.deepEqual(shownSelection(['p1', 'p3', 'p4/x', 'p2/y'], hidden), ['p1', 'p2/y']);
  assert.deepEqual(shownSelection(['p3'], stepsDisplay(stepped, 2, false)!.hidden), ['p3']);
  assert.deepEqual(shownSelection(['p3'], stepsDisplay(stepped, 0, true)!.hidden), ['p3'], 'faded parts are shown, so they stay lit');
});

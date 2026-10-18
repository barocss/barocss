import test from 'node:test';
import assert from 'node:assert/strict';
import { subdBrep, checkBrep, brepMassProperties, validateCage } from '@barocss/cad';
import { boxCage } from '../src/app/primitives';
import { commitDrag, dragged, fullCage, pickCage, previewLevels, previewTriangles, redoSession, runOp, select, selectionCentre, startSession, undoSession, validationOf, type CageSession } from '../src/subd/cageEdit';

// R8.2 (D81): the cage-editing session — picking, selection with loops, dragging and extruding on a drag, the
// operations, the session's own undo, the mirror. Every step's cage is valid and the kernel builds it.
const sound = (s: CageSession) => { const v = validationOf(s); assert.equal(v.valid, true, JSON.stringify(v)); const b = subdBrep(fullCage(s)); assert.equal(checkBrep(b).valid, true, checkBrep(b).issues[0]); return b; };
const vol = (s: CageSession) => brepMassProperties(subdBrep(fullCage(s)), 1).volumeMM3;
/** Looking down −Z from above, 10 px a mm, y up the screen. */
const project = (p: [number, number, number]): [number, number, number] => [400 + 10 * p[0], 300 - 10 * p[1], -p[2]];

test('picking from above: the top face under the pointer (the nearest of the faces there), a vertex within 8 px, an edge within 6 px; nothing far off', () => {
  const s = startSession(0, boxCage(30, 20, 16, 2, [0, 0, 0]));
  const face = pickCage(s.cage, project, 400 + 50, 300 - 50, 'face');
  assert.equal(face?.kind, 'face');
  const f = s.cage.faces[(face as { f: number }).f]; assert.ok(f.every(v => s.cage.positions[3 * v + 2] === 16), 'the top face, nearest the eye');
  const v = pickCage(s.cage, project, 400 + 150 + 3, 300 - 100 - 2, 'vertex'); assert.equal(v?.kind, 'vertex');
  assert.equal(pickCage(s.cage, project, 400 + 75, 300 - 100 + 4, 'edge')?.kind, 'edge');
  assert.equal(pickCage(s.cage, project, 2000, 2000, 'vertex'), null);
});

test('a session on the SubD box: the top face dragged up 5 (one step), Shift-dragged (extruded: 4 side faces), undone and redone; an edge loop picked and a loop inserted; creases; delete and fill; weld', () => {
  let s = startSession(0, boxCage(30, 20, 16, 2, [0, 0, 0]));
  const v0 = vol(s), top = s.cage.faces.findIndex(f => f.every(v => s.cage.positions[3 * v + 2] === 16));
  s = select(s, { kind: 'face', f: top }, false);
  assert.deepEqual(selectionCentre(s)!.map(x => +x.toFixed(6))[2], 16);
  // While dragged, nothing is a step yet.
  assert.equal(dragged(s, [0, 0, 5], false).cage.positions.filter((x, i) => i % 3 === 2 && x === 21).length, 4); assert.equal(s.undo.length, 0);
  s = commitDrag(s, [0, 0, 5], false); sound(s); assert.ok(vol(s) > v0); assert.equal(s.undo.length, 1);
  const faces = s.cage.faces.length;
  s = commitDrag(s, [0, 0, 4], true); sound(s); assert.equal(s.cage.faces.length, faces + 4); assert.equal(s.sel.faces.length, 1);
  const extruded = vol(s);
  s = undoSession(s); assert.equal(s.cage.faces.length, faces); s = redoSession(s); assert.ok(Math.abs(vol(s) - extruded) < 1e-9);
  // An edge loop round the box's middle, and a loop inserted beside it.
  const mid = s.cage.faces.flatMap(f => f.map((v, i) => [v, f[(i + 1) % f.length]] as [number, number])).find(([a, b]) => s.cage.positions[3 * a + 2] === 8 && s.cage.positions[3 * b + 2] === 8)!;
  const looped = select(s, { kind: 'edge', a: mid[0], b: mid[1] }, false, 'loop'); assert.ok(looped.sel.edges.length >= 8);
  const vertical = s.cage.faces.flatMap(f => f.map((v, i) => [v, f[(i + 1) % f.length]] as [number, number])).find(([a, b]) => s.cage.positions[3 * a + 2] === 0 && s.cage.positions[3 * b + 2] === 8)!;
  const before = s.cage.faces.length;
  s = runOp(select(s, { kind: 'edge', a: vertical[0], b: vertical[1] }, false), 'insert-loop'); sound(s); assert.ok(s.cage.faces.length > before && s.sel.edges.length >= 8);
  s = runOp(s, 'crease'); assert.ok((s.cage.creases ?? []).length >= 8); sound(s);
  // The extruded top deleted (a hole), then filled.
  s = runOp(select(s, { kind: 'face', f: s.cage.faces.findIndex(f => f.every(v => s.cage.positions[3 * v + 2] === 25)) }, false), 'delete');
  assert.equal(validationOf(s).boundaryEdges.length, 4);
  const hole = validationOf(s).boundaryEdges;
  s = runOp({ ...s, sel: { vertices: [], edges: hole, faces: [] } }, 'fill'); sound(s); assert.equal(validationOf(s).boundaryEdges.length, 0);
  assert.throws(() => runOp({ ...s, sel: { vertices: [], edges: [], faces: [] } }, 'delete'), /pick faces/);
});

test('mirror across X: the box of 2 quads across halved (its plane ring kept on the plane), a vertex dragged off it mirrors; a face beside the plane extruded with no wall in the plane; mirror off makes it whole', () => {
  let s = startSession(0, boxCage(30, 20, 16, 2, [0, 0, 0]));
  const whole = vol(s);
  s = runOp(s, 'mirror-x'); assert.equal(s.mirror, 'x'); assert.ok(Math.abs(vol(s) / whole - 1) < 1e-12, 'the same body');
  assert.ok(s.cage.positions.every((x, i) => i % 3 !== 0 || x >= 0));
  // The plane's vertices move along it only.
  const plane = Array.from({ length: s.cage.positions.length / 3 }, (_, v) => v).filter(v => s.cage.positions[3 * v] === 0);
  s = commitDrag({ ...s, sel: { vertices: plane.slice(0, 1), edges: [], faces: [] } }, [3, 0, 2], false);
  assert.equal(s.cage.positions[3 * plane[0]], 0); sound(s);
  const side = s.cage.faces.findIndex(f => f.some(v => s.cage.positions[3 * v] === 0) && f.every(v => s.cage.positions[3 * v + 2] === 16));
  s = commitDrag({ ...s, sel: { vertices: [], edges: [], faces: [side] } }, [0, 0, 5], true); sound(s);
  const full = fullCage(s); assert.ok(brepMassProperties(subdBrep(full), 1).centroidMM[0] === 0 || Math.abs(brepMassProperties(subdBrep(full), 1).centroidMM[0]) < 1e-9);
  s = runOp(s, 'mirror-off'); assert.equal(s.mirror, undefined); sound(s);
  assert.throws(() => runOp(startSession(0, boxCage(30, 20, 16, 1, [0, 0, 0])), 'mirror-x'), /crosses the X plane/);
});

test('the preview: as fine as stays quick (level 2 for the box of 6 a side, 1 for ~2 000 faces); Smooth near the limit, Box the cage\'s own faces', () => {
  const b6 = boxCage(30, 20, 16, 6, [0, 0, 0]), b18 = boxCage(30, 20, 16, 18, [0, 0, 0]);
  assert.deepEqual([previewLevels(b6), previewLevels(b18)], [2, 1]);
  const smooth = previewTriangles(b6, true), box = previewTriangles(b6, false);
  assert.equal(box.indices.length / 3, 2 * b6.faces.length); assert.equal(box.normals, null);
  assert.equal(smooth.indices.length / 3, 2 * b6.faces.length * 16);
  assert.equal(validateCage(b18).valid, true);
});

test('PERF3 C16: an extrusion dragged validates its cage once — the same validation every step, equal to one worked out afresh, and topology changes still seen', () => {
  let s = startSession(0, boxCage(30, 20, 16, 18, [0, 0, 0]));
  s = { ...select({ ...s, mode: 'face' }, { kind: 'face', f: 7 }, false) };
  const steps = [1, 2, 3, 4, 5].map(k => ({ ...s, ...dragged(s, [0, 0, 0.5 * k], true) }));
  const t0 = performance.now(), first = validationOf(steps[0]), cold = performance.now() - t0;
  let warm = 0;
  for (const st of steps.slice(1)) { const t1 = performance.now(), v = validationOf(st); warm = Math.max(warm, performance.now() - t1); assert.equal(v, first); assert.deepEqual(v, validateCage(fullCage(st))); }
  assert.ok(warm < 0.5 * cold, `${warm.toFixed(2)} ms a step against ${cold.toFixed(2)} ms`);
  // Another topology (the session before extruding): validated anew, and right.
  assert.deepEqual(validationOf(s), validateCage(fullCage(s)));
  assert.notEqual(validationOf(s), first);
});

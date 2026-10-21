import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluatePart, placeBody, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { tablesFor } from '@barocss/cad-model/assembly/faces';
import { solveDoc } from '@barocss/cad-model/chat/assembly';
import { rotationMatrix } from '@barocss/cad-model/assembly/mates';
import { explodeOffsets, movedBody } from '@barocss/cad-model/assembly/explode';
import { jointTreeOf } from '@barocss/cad-model/robot/joints';
import { forwardKinematics } from '@barocss/cad-model/robot/fk';
import { posedInstances } from '@barocss/cad-model/robot/preview';
import { boundsUnder, instancePoses, motionOf, poseMatrix } from '../src/viewport/instancePose';
import { GpuRenderer } from '../src/viewport/gpuRenderer';
import type { InstanceItem } from '../src/viewport/renderer';

// G1: the joints' pose and the explode as one matrix per instance on its meshes. The matrices put every vertex, edge
// point and box where the moved copies (posedInstances, explodeOffsets, movedBody) put them; the renderer makes an
// instance's meshes once and only moves them while a joint plays or the explode changes.

const CASES = resolve(process.cwd(), '../../packages/barocss-cad/conformance/rm');
const caseDoc = (name: string): StudioDoc => JSON.parse(readFileSync(resolve(CASES, name, 'case.json'), 'utf8')).input.document;
const apply = (M: ArrayLike<number>, P: ArrayLike<number>, v: number) => [0, 1, 2].map(r => M[r] * P[v] + M[4 + r] * P[v + 1] + M[8 + r] * P[v + 2] + M[12 + r]);

/** The arm's part and its two links as the studio places them (solved by their mates, evaluated, moved to their placement). */
async function arm() {
  const doc = caseDoc('chain-2r'), s = solveDoc(doc), part = await evaluatePart(s.doc, 1);
  assert.ok(part.ok);
  const instances: { id: string; bodies: BodyResult[] }[] = [];
  for (const inst of s.doc.instances!) {
    const r = await evaluatePart(inst.doc, 1); assert.ok(r.ok);
    instances.push({ id: inst.id, bodies: r.bodies.map(b => placeBody({ ...b, mesh: { ...b.mesh, positions: b.mesh.positions.slice(), normals: b.mesh.normals.slice(), edgeLines: b.mesh.edgeLines.slice() } }, rotationMatrix(inst.rotation), inst.position)) });
  }
  const tree = jointTreeOf(s.doc, { instances: s.doc.instances ?? [], problems: s.problems }, tablesFor(s.doc));
  return { part: part.bodies, instances, tree };
}

test('G1 the pose matrices: every vertex, edge point and box where the moved copies put them, over random poses and explode factors', async () => {
  const { part, instances, tree } = await arm();
  let seed = 11; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let worst = 0, boxes = 0;
  for (let k = 0; k < 24; k++) {
    const q = { 'base~a': (rand() * 2 - 1) * Math.PI, 'a~b': (rand() * 2 - 1) * Math.PI }, explode = [0, 0.5, 1, 2][k % 4];
    const fk = forwardKinematics(tree, q);
    // The copies, as the studio made them before G1.
    const posed = posedInstances(instances, fk), off = explode ? explodeOffsets(part, posed, explode) : new Map();
    const copies = posed.map(i => { const d = off.get(i.id); return d ? { id: i.id, bodies: i.bodies.map(b => movedBody(b, d)) } : i; });
    const poses = instancePoses(part, instances, fk, explode);
    instances.forEach((inst, ii) => inst.bodies.forEach((b, bi) => {
      const M = poses.get(inst.id) ?? poseMatrix(undefined, undefined), want = copies[ii].bodies[bi].mesh;
      for (let v = 0; v < b.mesh.positions.length; v += 3) { const p = apply(M, b.mesh.positions, v); for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(p[c] - want.positions[v + c])); }
      for (let v = 0; v < b.mesh.edgeLines.length; v += 3) { const p = apply(M, b.mesh.edgeLines, v); for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(p[c] - want.edgeLines[v + c])); }
      const box = boundsUnder(b.mesh.positions, M);
      for (let c = 0; c < 3; c++) boxes = Math.max(boxes, Math.abs(box.min[c] - want.bounds.min[c]), Math.abs(box.max[c] - want.bounds.max[c]));
    }));
  }
  // (Float32 positions of about 100 mm: the copies round once more than the matrix does.)
  assert.ok(worst < 1e-4, `worst ${worst} mm`);
  assert.ok(boxes < 1e-4, `boxes ${boxes} mm`);
  // At home, without an explode: nothing moves, no matrix.
  assert.equal(instancePoses(part, instances, forwardKinematics(tree, {}), 0).size, 0);
  assert.equal(instancePoses(part, instances, null, 0).size, 0);
  // A matrix's motion back: the same rotation and move.
  const M = poseMatrix(forwardKinematics(tree, { 'base~a': 0.7 }).motions.get('a'), [1, 2, 3]), m = motionOf(M);
  assert.deepEqual(Array.from(poseMatrix(m, undefined)), Array.from(M));
});

/** A stand-in for the viewer: meshes that keep their transform and material, counted as they are made and removed. */
function fakeViewer() {
  const log = { added: 0, removed: 0, colors: 0, transforms: 0 };
  class Mesh {
    material: unknown = {}; outline: unknown = null; visible = true; pickable = true; private t: ArrayLike<number> = poseMatrix(undefined, undefined);
    constructor(readonly geometry: { setColors(c: unknown): void; dispose(): void }, readonly name?: string) {}
    get transform() { return this.t; }
    set transform(m: ArrayLike<number>) { this.t = Float64Array.from(m); log.transforms++; }
    get bounds() { return null; }
    remove() { log.removed++; }
  }
  const geometry = () => ({ setColors() { log.colors++; }, setUVs() {}, dispose() {} });
  const viewer = {
    add(_input: unknown, o: { name?: string } = {}) { log.added++; return new Mesh(geometry(), o.name); },
    createGeometry: geometry, requestRender() {}, setBackground() {}, grid: {}, dispose() {},
  };
  return { viewer, log };
}

test('G1 the renderer: an instance\'s meshes made once — a new selection, the same bodies again and every pose only move them; a changed or gone instance alone is rebuilt or released', async () => {
  const { instances, tree } = await arm(), { viewer, log } = fakeViewer();
  const r = new (GpuRenderer as unknown as new (c: unknown, v: unknown) => GpuRenderer)({}, viewer);
  const items: InstanceItem[] = instances.map(i => ({ ...i }));
  const perInstance = instances.map(i => i.bodies.length + i.bodies.filter(b => b.mesh.edgeLines.length).length);
  r.setInstances(items, []);
  assert.equal(log.added, perInstance[0] + perInstance[1]);
  const made = log.added, painted = log.colors;
  // A new selection, then the same bodies in new objects (a re-evaluation that changed nothing): nothing made, nothing repainted but the outline.
  r.setInstances(items, ['a']); r.setInstances(items.map(i => ({ id: i.id, bodies: i.bodies.map(b => ({ ...b })) })), ['a']);
  assert.deepEqual([log.added, log.removed, log.colors], [made, 0, painted]);
  // 60 frames of a joint played: transforms only.
  for (let f = 0; f < 60; f++) r.setInstanceTransforms(instancePoses([], instances, forwardKinematics(tree, { 'base~a': f / 30 }), 0));
  assert.deepEqual([log.added, log.removed], [made, 0]);
  assert.ok(log.transforms > 0);
  // The placed meshes moved by the pose; the gizmo's drag goes after it.
  const meshes = (r as unknown as { instances: { id: string; surfaces: { transform: ArrayLike<number> }[] }[] }).instances;
  const pose = instancePoses([], instances, forwardKinematics(tree, { 'base~a': 1 }), 0);
  r.setInstanceTransforms(pose);
  assert.deepEqual(Array.from(meshes.find(i => i.id === 'a')!.surfaces[0].transform), Array.from(pose.get('a')!));
  const drag = poseMatrix(undefined, [0, 0, 5]);
  r.setInstancePreview({ id: 'a', matrix: drag });
  const t = meshes.find(i => i.id === 'a')!.surfaces[0].transform, p = pose.get('a')!;
  assert.ok([12, 13, 14].every(i => Math.abs(t[i] - (p[i] + (i === 14 ? 5 : 0))) < 1e-12), 'the drag after the pose');
  r.setInstancePreview(null);
  // The same transform again: the mesh is not touched (its block not sent again).
  const before = log.transforms; r.setInstanceTransforms(pose); assert.equal(log.transforms, before);
  // One instance's bodies changed (moved 1 mm): only its meshes made again; the other kept.
  const moved = { id: 'b', bodies: instances[1].bodies.map(b => movedBody(b, [1, 0, 0])) };
  r.setInstances([items[0], moved], []);
  assert.deepEqual([log.added - made, log.removed], [perInstance[1], perInstance[1]]);
  // Thread rings: a new instance mesh of lines, kept while they are the same.
  const rings = new Float32Array([0, 0, 0, 1, 0, 0]);
  r.setInstances([{ ...items[0], threads: rings }, moved], []);
  const withRings = log.added; r.setInstances([{ ...items[0], threads: Float32Array.from(rings) }, moved], []);
  assert.equal(log.added, withRings, 'the same rings: kept');
  // Gone: released.
  r.setInstances([], []);
  assert.equal(log.removed, log.added);
});

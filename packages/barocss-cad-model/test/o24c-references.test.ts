import test from 'node:test';
import assert from 'node:assert/strict';
import { transformBrep } from '@barocss/cad';
import { emptyDoc, rectanglePart, cylinderPart, withNode, type StudioDoc } from '../src/engine/doc';
import { faceTableFrom, faceTableOf } from '../src/assembly/faces';
import { edgeShape, mergeEdges } from '../src/assembly/shapes';
import { addMate } from '../src/assembly/edit';
import { solveAssembly, type MateFace, type Vec3 } from '../src/assembly/mates';
import { evaluatePart, partBreps } from '../src/engine/evaluate';
import { captureSignatures, verifyReferences } from '../src/engine/references';
import { readStudioDoc } from '../src/engine/migrate';
import { isRefusal } from '../src/engine/refusal';
import { dispatchTool } from '../src/chat/tools';
import { treeOfDoc } from '../src/chat/robot';

const near = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const vector = (a: readonly number[], b: readonly number[], tol = 1e-9) => a.forEach((x, k) => near(x, b[k], tol));
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const ball = () => withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'loop', segments: [{ kind: 'arc', start: [0, -6], center: [0, 0], direction: 'ccw' }, { kind: 'line', start: [0, 6] }] }), { kind: 'revolve', sketch: 0, axis: 'y', angle: 360 });
const cone = () => withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'polygon', points: [[0, 0], [8, 0], [4, 12], [0, 12]] }), { kind: 'revolve', sketch: 0, axis: 'y', angle: 360 });
const named = (doc: StudioDoc, kind: MateFace['kind']) => {
  const found = Object.entries(faceTableOf(doc)).find(([, f]) => f.kind === kind);
  assert.ok(found, `${kind}: ${JSON.stringify(faceTableOf(doc))}`);
  return found;
};

test('O24 c: revolved sphere and cone, box edges, circular rims and face centres match closed forms', () => {
  const [, sphere] = named(ball(), 'sphere'); assert.equal(sphere.kind, 'sphere');
  vector(sphere.point, [0, 0, 0]); near(sphere.radius, 6); assert.equal(sphere.outer, true);
  const [, taper] = named(cone(), 'cone'); assert.equal(taper.kind, 'cone');
  vector(taper.point, [0, 24, 0]); vector(taper.axis, [0, -1, 0]); near(taper.half, Math.atan(1 / 3));
  vector(taper.span!, [12, 24]); assert.equal(taper.outer, true);
  const box = faceTableOf(rectanglePart(10, 20, 5)), top = box['n1.top']; assert.equal(top.kind, 'plane');
  vector(top.centre!, [5, 10, 5]);
  const lines = Object.entries(box).filter(([, f]) => f.kind === 'line'); assert.equal(lines.length, 12);
  assert.ok(lines.every(([key]) => key.includes('|')), 'persistent edge names');
  const round = faceTableOf(cylinderPart(4, 20)), side = round['n1.side0']; assert.equal(side.kind, 'cylinder');
  vector(side.span!, [0, 20]);
  const rims = Object.values(round).filter(f => f.kind === 'circle'); assert.equal(rims.length, 2);
  for (const rim of rims) { assert.equal(rim.kind, 'circle'); near(rim.radius, 4); assert.equal(rim.ends, undefined); }
});

test('O24 c: edge merging preserves open arcs and refuses gaps between straight pieces', () => {
  const arc = (from: number, to: number): MateFace => {
    const points: Vec3[] = Array.from({ length: 9 }, (_, i) => { const t = from + (to - from) * i / 8; return [3 * Math.cos(t), 3 * Math.sin(t), 0]; });
    const f = edgeShape(points, false); assert.ok(f); return f;
  };
  const first = arc(0, Math.PI / 2), second = arc(Math.PI / 2, Math.PI), joined = mergeEdges(first, second);
  assert.equal(joined?.kind, 'circle'); assert.ok(joined.ends, 'a half circle is still an arc');
  vector(joined.ends[0], [3, 0, 0]); vector(joined.ends[1], [-3, 0, 0]);
  const whole = mergeEdges(joined, arc(Math.PI, 2 * Math.PI)); assert.equal(whole?.kind, 'circle'); assert.equal(whole.ends, undefined);
  assert.equal(mergeEdges(first, arc(Math.PI, 3 * Math.PI / 2)), null, 'disconnected arcs');
  const line = (x: number, length: number): MateFace => ({ kind: 'line', point: [x, 0, 0], axis: [1, 0, 0], length });
  assert.equal(mergeEdges(line(0, 2), line(4, 2)), null, 'no invented edge across a gap');
  assert.deepEqual(mergeEdges(line(0, 2), line(2, 2)), line(0, 4));
});

test('O24 c: edge classification is invariant under translation and does not flatten a distant arc', () => {
  const points: Vec3[] = Array.from({ length: 9 }, (_, i) => [1e8 + Math.cos(i * Math.PI / 16), Math.sin(i * Math.PI / 16), 0]);
  assert.equal(edgeShape(points, false)?.kind, 'circle');
});

test('O24 c: a flat face with an off-centre circular hole has its analytic area centroid', () => {
  const doc = withNode(rectanglePart(20, 20, 5), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [6, 8], radius: 2 });
  const top = faceTableOf(doc)['n1.top']; assert.equal(top.kind, 'plane');
  const hole = 4 * Math.PI;
  vector(top.centre!, [(4000 - 6 * hole) / (400 - hole), (4000 - 8 * hole) / (400 - hole), 5]);
});

test('O24 c: sphere and cone classification survives a large translation; a torus stays unmateable', () => {
  const offset: Vec3 = [1e5, -2e5, 3e5];
  const table = (doc: StudioDoc) => faceTableFrom(partBreps(doc).map(o => ({ brep: transformBrep(o.brep, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], offset }) })));
  const sphere = Object.values(table(ball())).find(f => f.kind === 'sphere'); assert.ok(sphere?.kind === 'sphere');
  vector(sphere.point, offset); near(sphere.radius, 6);
  const taper = Object.values(table(cone())).find(f => f.kind === 'cone'); assert.ok(taper?.kind === 'cone');
  vector(taper.point, [offset[0], offset[1] + 24, offset[2]]); near(taper.half, Math.atan(1 / 3));
  const torus = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [10, 0], radius: 3 }), { kind: 'revolve', sketch: 0, axis: 'y', angle: 360 });
  assert.ok(!Object.values(faceTableOf(torus)).some(f => f.kind === 'sphere' || f.kind === 'cone'));
});

test('O24 c: cone/circle concentric, edge/plane coincident and sphere tangency solve without drift', () => {
  const base = rectanglePart(20, 20, 5), pin = cylinderPart(4, 10), sphere = ball(), taper = cone();
  const [coneFace] = named(taper, 'cone'), [rim] = named(pin, 'circle'), [ballFace] = named(sphere, 'sphere');
  const doc: StudioDoc = { ...taper, instances: [{ id: 'p', name: 'pin', doc: pin, position: [50, 0, 0], rotation: [0, 0, 0] }] };
  const r = addMate(doc, { kind: 'concentric', a: { part: 'base', face: coneFace }, b: { part: 'p', face: rim } });
  assert.deepEqual(r.problems, []); assert.deepEqual([r.freedom.turns, r.freedom.slides], [1, 1]);
  const lineTable = faceTableOf(base), line = Object.entries(lineTable).find(([, f]) => f.kind === 'line' && Math.abs(f.axis[2]) < 1e-9)![0];
  const edge = addMate({ ...base, instances: [{ id: 'p', name: 'box', doc: base, position: [0, 0, 50], rotation: [0, 0, 0] }] }, { kind: 'coincident', a: { part: 'base', face: 'n1.top' }, b: { part: 'p', face: line } });
  assert.deepEqual(edge.problems, []);
  const face = lineTable[line]; assert.equal(face.kind, 'line'); near(edge.doc.instances![0].position[2] + face.point[2], 5);
  for (const flip of [false, true]) {
    const s = addMate({ ...base, instances: [{ id: 'p', name: 'ball', doc: sphere, position: [7, 8, 50], rotation: [10, 20, 30] }] }, { kind: 'tangent', flip, a: { part: 'base', face: 'n1.top' }, b: { part: 'p', face: ballFace } });
    assert.deepEqual(s.problems, []); vector(s.doc.instances![0].position, [7, 8, flip ? -1 : 11]);
    assert.deepEqual([s.freedom.turns, s.freedom.slides], [3, 2]);
  }
  assert.throws(() => addMate(doc, { kind: 'tangent', a: { part: 'base', face: coneFace }, b: { part: 'p', face: rim } }), e => isRefusal(e, 'MATE_FACES'));
  const table = { s: { kind: 'sphere', point: [1, 2, 3], radius: 4, outer: true } } as const;
  const spheres = solveAssembly([{ id: 'p', name: 'ball', doc: sphere, position: [50, 50, 50], rotation: [0, 0, 0] }], [{ id: 'm', kind: 'concentric', a: { part: 'base', face: 's' }, b: { part: 'p', face: 's' } }], () => table as unknown as Record<string, MateFace>);
  assert.deepEqual(spheres.problems, []); vector(spheres.instances[0].position, [0, 0, 0]);
  assert.deepEqual([spheres.freedom.p.turns, spheres.freedom.p.slides], [3, 0]);
});

test('O24 c: v2 assembly reads new references, adds a mate, saves, reopens and builds its joint tree', async () => {
  const sphere = ball(), [face] = named(sphere, 'sphere');
  let doc: StudioDoc = { ...sphere, instances: [{ id: 'p', name: 'ball', doc: sphere, position: [7, 8, 50], rotation: [0, 0, 0] }] };
  const built = await evaluate(doc); assert.ok(built.ok);
  const listed = await dispatchTool({ doc, bodies: built.bodies }, 'assembly', { action: 'get', faces_of: 'p' }, evaluate);
  assert.ok(!listed.isError, listed.content); assert.match(listed.content, /sphere/);
  const added = await dispatchTool({ doc, bodies: built.bodies }, 'assembly', { action: 'add_mate', kind: 'concentric', a: { part: 'base', face }, b: { part: 'p', face } }, evaluate);
  assert.ok(!added.isError && added.changed, added.content); doc = added.state.doc;
  doc = captureSignatures(doc, added.state.bodies);
  assert.equal(doc.mates![0].b.sig?.k, 'sphere');
  const opened = readStudioDoc(JSON.stringify(doc)); assert.ok('doc' in opened);
  const rebuilt = await evaluate(opened.doc); assert.ok(rebuilt.ok);
  const verified = await verifyReferences(opened.doc, rebuilt.bodies, evaluate); assert.deepEqual(verified.problems, []);
  const tree = await treeOfDoc(opened.doc, rebuilt.bodies, evaluate); assert.deepEqual(tree.problems, []);
});

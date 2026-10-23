import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { lumpTouches, lumpTriangles } from '../src/engine/lumps';
import { lumpStls, meshToStl } from '../src/engine/stl';
import { threeMfModelOf } from '../src/print/export3mf';
import { write3mf } from '../src/print/threemf';
import { printability } from '../src/print/rules';
import { bodyName } from '../src/app/bodies';
import { bomView, deriveBom } from '../src/team/assembly';
import { bomPanelData, purchaseCsv } from '../src/team/bom';

// O8 (the kernel's D204, D205): pieces of one body that touch only along a line or at a point. The kernel now keeps
// their union (it refused it: "The bodies only touch along an edge or a point"); a mesh welded by position reads the
// touch as an edge of four faces. So: the exports write a lump at a time (3MF objects, STL files), the print checks
// measure a lump at a time, the manufacturability result warns in the old refusal's words naming the lumps, and the
// BOM says how many solids the part comes as. One lump, or lumps apart, export as before.
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
/** Two 10 mm cubes, the second at (x, y, z), then their union (union-touch's). */
function cubes(x: number, y: number, z: number): StudioDoc {
  let d = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] });
  d = withNode(d, { kind: 'extrude', sketch: 0, height: 10 });
  d = withNode(d, { kind: 'sketch', profile: 'rectangle', min: [x, y], max: [x + 10, y + 10] });
  d = withNode(d, { kind: 'extrude', sketch: 2, height: 10, ...(z ? { from: z } : {}) });
  return withNode(d, { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } });
}
/**
 * The kernel's case (b), D205's own: a box and a cylinder r 2 tangent to its face y = 0 from outside, both turned 30°
 * about X, their union either way round — the contact a line where the cylinder only touches the face.
 */
function boxCylinder(flip: boolean): StudioDoc {
  let d = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [-8, 0], max: [0, 3] });
  d = withNode(d, { kind: 'extrude', sketch: 0, height: 8, from: -2 });
  d = withNode(d, { kind: 'rotate', parent: { node: 1, side: 'solid' }, axis: 'x', angleDegrees: 30, pivot: [0, 0, 0] });
  d = withNode(d, { kind: 'sketch', profile: 'circle', center: [-2, -2], radius: 2 });
  d = withNode(d, { kind: 'extrude', sketch: 3, height: 4, from: 1 });
  d = withNode(d, { kind: 'rotate', parent: { node: 4, side: 'solid' }, axis: 'x', angleDegrees: 30, pivot: [0, 0, 0] });
  return withNode(d, { kind: 'union', left: { node: flip ? 5 : 2, side: 'solid' }, right: { node: flip ? 2 : 5, side: 'solid' } });
}
const bodyOf = (doc: StudioDoc): BodyResult => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail); assert.equal(r.bodies.length, 1); return r.bodies[0]; };

test('O8: lumps touching along an edge, at a point, a corner on an edge, a cylinder tangent (either way round) — found; apart, face to face — not', () => {
  for (const [label, doc] of [['edge', cubes(10, 10, 0)], ['point', cubes(10, 10, 10)], ['corner on an edge', cubes(10, 10, 5)], ['box ∪ cylinder, turned 30°', boxCylinder(false)], ['cylinder ∪ box, turned 30°', boxCylinder(true)]] as const) {
    const b = bodyOf(doc);
    assert.deepEqual([b.pieces, b.lumpTouch], [2, [[0, 1]]], label);
    assert.deepEqual(lumpTouches(b.mesh), [[0, 1]], label);
  }
  // (Case (b) is the kernel's own, its volume the kernel's: 8 · 3 · 8 + π · 2² · 4.)
  for (const flip of [false, true]) assert.ok(Math.abs(bodyOf(boxCylinder(flip)).volumeMM3! - (192 + 16 * Math.PI)) <= 1e-6 * 242, String(flip));
  const apart = bodyOf(cubes(20, 0, 0));
  assert.deepEqual([apart.pieces, apart.lumpTouch], [2, undefined], 'apart: two pieces, no touch');
  const faces = bodyOf(cubes(10, 0, 0));
  assert.deepEqual([faces.pieces, faces.lumpTouch, lumpTriangles(faces.mesh)], [undefined, undefined, null], 'face to face: one solid');
});

test('O8: the exports a lump at a time — 3MF objects named "<body> / lump k", no edge of four faces; an STL a lump; one lump and lumps apart as before', async () => {
  const doc = cubes(10, 10, 0), b = bodyOf(doc), name = bodyName(doc, b);
  const model = threeMfModelOf(doc, [{ doc, bodies: [b] }], 'touch');
  assert.ok(typeof model !== 'string');
  assert.deepEqual(model.objects.map(o => o.name), [`${name} / lump 1`, `${name} / lump 2`]);
  const w = await write3mf(model); assert.ok(!('error' in w), 'error' in w ? w.error : '');
  assert.deepEqual([w.stats.objects, w.stats.openEdges, w.stats.repeatedEdges], [2, 0, 0]);
  // (The whole body as one object — the export before O8 — has the touching edge as an edge of four faces.)
  const one = await write3mf({ title: 'one', objects: [{ name, positions: b.mesh.positions, indices: b.mesh.indices, material: '', color: '' }], items: [{ object: 0, name }] });
  assert.ok(!('error' in one) && one.stats.repeatedEdges > 0, 'error' in one ? one.error : String(one.stats.repeatedEdges));
  // (STL: one file a lump, the two lumps' triangles all of the body's.)
  const stls = lumpStls(b.mesh, b.key)!;
  assert.equal(stls.length, 2);
  const triangles = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset).getUint32(80, true);
  assert.equal(stls.reduce((n, f) => n + triangles(f.bytes), 0), b.mesh.indices.length / 3);
  // (One lump: no lump field on its faces, no split — its STL and 3MF are the body's as before, byte for byte.)
  const plate = rectanglePart(40, 20, 5), pb = bodyOf(plate);
  assert.equal(lumpStls(pb.mesh, pb.key), null);
  assert.ok(pb.mesh.faces.every(f => f.lump === undefined));
  const pm = threeMfModelOf(plate, [{ doc: plate, bodies: [pb] }], 'plate'); assert.ok(typeof pm !== 'string');
  assert.ok(pm.objects.length === 1 && pm.objects[0].positions === pb.mesh.positions && pm.objects[0].indices === pb.mesh.indices, 'the body\'s own mesh, as before');
  assert.deepEqual(meshToStl(pb.mesh, pb.key), meshToStl(pb.mesh, pb.key));
  // (Lumps apart: one object, as before — welded, nothing touches.)
  const apart = cubes(20, 0, 0), ab = bodyOf(apart), am = threeMfModelOf(apart, [{ doc: apart, bodies: [ab] }], 'apart'); assert.ok(typeof am !== 'string');
  assert.ok(am.objects.length === 1 && am.objects[0].positions === ab.mesh.positions);
});

test('O8: the manufacturability result warns that the lumps only touch, naming them as the 3MF objects; lumps apart and one lump, no warning', async () => {
  for (const doc0 of [cubes(10, 10, 0), boxCylinder(true)]) {
    const doc: StudioDoc = { ...doc0, process: 'fdm' }, b = bodyOf(doc), name = bodyName(doc, b);
    const rep = await printability(doc, [b], evaluate), warn = rep.rules.find(r => r.id === 'lump-touch');
    assert.ok(warn && warn.status === 'warn', JSON.stringify(rep.rules.map(r => r.id)));
    assert.equal(warn.message, `The bodies only touch along an edge or a point: ${name} / lump 1, ${name} / lump 2`);
    assert.deepEqual(warn.entities, [`${name} / lump 1`, `${name} / lump 2`]);
    // (Measured a lump at a time: the thinnest wall is a lump's own — a cube's 10, the box's 3 — not the touch's zero.)
    const wall = rep.rules.find(r => r.id === 'wall');
    assert.ok(wall?.value !== undefined && wall.value > 2.5, JSON.stringify(wall));
  }
  // (Whatever the process: none chosen, the warning still.)
  assert.ok((await printability(cubes(10, 10, 0), [bodyOf(cubes(10, 10, 0))], evaluate)).rules.some(r => r.id === 'lump-touch'));
  for (const doc of [{ ...cubes(20, 0, 0), process: 'fdm' as const }, { ...rectanglePart(40, 20, 5), process: 'fdm' as const }]) {
    assert.ok(!(await printability(doc, [bodyOf(doc)], evaluate)).rules.some(r => r.id === 'lump-touch'));
  }
});

test('O8: the BOM line of a part in several solids says how many (lumps), the CSV too; a part in one, as before', async () => {
  const doc: StudioDoc = { ...emptyDoc(), instances: [{ id: 'p1', name: 'Pair', doc: cubes(10, 10, 0), position: [0, 0, 0], rotation: [0, 0, 0] }, { id: 'p2', name: 'Plate', doc: rectanglePart(40, 20, 5), position: [50, 0, 0], rotation: [0, 0, 0] }] };
  const bom = deriveBom(await bomView(doc, evaluate));
  assert.deepEqual(bom.lines.map(l => [l.item, l.lumps]), [['Pair', 2], ['Plate', undefined]]);
  const csv = purchaseCsv(await bomPanelData(doc, evaluate), true).trim().split('\n');
  assert.ok(csv.some(r => /^\d+,Pair,1,part,2 lumps,/.test(r)), csv.join(' | '));
  assert.ok(csv.some(r => /^\d+,Plate,1,part,,/.test(r)), csv.join(' | '));
});

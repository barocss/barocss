import test from 'node:test';
import assert from 'node:assert/strict';
import { part, BarocssError, type BodyQuery } from '../src/api';
import { evaluateDoc, type BodyResult } from '../src/engine/evaluate';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { commands, type Ctx } from '../src/app/commands';
import type { StudioDoc } from '../src/engine/doc';

// A face fillet between two flat faces that do not touch. Expectations from the inputs: an L (wall x 0..5, floor
// z 0..5, 20 deep) with a 3 mm chamfer in its inside corner; a round r tangent to the floor and the wall fills
// r² − πr²/4 per mm less the chamfer's 4.5 mm².
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const XZ = { origin: [0, 0, 0] as [number, number, number], normal: [0, -1, 0] as [number, number, number], xAxis: [1, 0, 0] as [number, number, number] };
const L: StudioDoc = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [
  { kind: 'sketch', profile: 'polygon', plane: XZ, points: [[0, 0], [30, 0], [30, 5], [8, 5], [5, 8], [5, 30], [0, 30]], id: 'n0' },
  { kind: 'extrude', sketch: 0, height: 20, id: 'n1' }], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 } as StudioDoc;
const before = 20 * (30 * 5 + 5 * 25 + 4.5), filled = (r: number) => before + 20 * (r * r - Math.PI * r * r / 4 - 4.5);
const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail); return r.bodies; };
const volumeOf = (doc: StudioDoc) => { const b = bodiesOf(doc); assert.equal(b.length, 1); assert.ok(b[0].volume !== null); return b[0].volume; };
// The floor's top (z 5, facing +Z) and the wall's inside (x 5, facing +X).
const floorAndWall = (b: BodyQuery) => b.faces().where(f => f.kind === 'plane' && ((f.normal[2] > 0.99 && Math.abs(f.centroid[2] - 5) < 1e-6) || (f.normal[0] > 0.99 && Math.abs(f.centroid[0] - 5) < 1e-6)));

test('public face fillet: the floor and the wall, stored by name with signatures, the chamfer filled to the round', async () => {
  const base = part('L', L), made = base.faceFillet(floorAndWall, { radius: 6 }), doc = made.doc, node = doc.nodes.at(-1);
  assert.ok(node && node.kind === 'face-fillet'); assert.equal(node.radius, 6); assert.equal(node.faces.length, 2);
  assert.ok(node.faces.every(n => node.sigs?.[n]), 'both faces keep a signature for re-matching');
  close(volumeOf(doc), filled(6));
  assert.ok(bodiesOf(doc)[0].mesh.faces.some(f => f.kind === 'curved' && Math.abs((f.radius ?? 0) - 6) < 1e-9));
  const opened = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in opened, JSON.stringify(opened)); assert.deepEqual(opened.doc, doc);
  close(volumeOf(opened.doc), filled(6));
  // Too big a round for the 25 mm floor: refused, the part kept.
  const kept = structuredClone(base.doc);
  assert.throws(() => base.faceFillet(floorAndWall, { radius: 26 }), e => e instanceof BarocssError && /FACE_FILLET_RADIUS/.test(e.message));
  assert.throws(() => base.faceFillet(b => b.faces().facing('+z').first(), { radius: 2 }), e => e instanceof BarocssError && e.code === 'FACE_FILLET_PICK');
  assert.throws(() => base.faceFillet(floorAndWall, { radius: 'x' as never }), e => e instanceof BarocssError && e.code === 'VALUE');
  assert.deepEqual(base.doc, kept);
});

test('Studio face fillet: offered on two non-parallel flat faces, its radius editable', () => {
  const ff = commands.find(c => c.id === 'face-fillet')!, bodies = bodiesOf(L);
  const pick = (test: (f: BodyResult['mesh']['faces'][number]) => boolean): Ctx => ({ doc: L, bodies, selection: { faces: bodies[0].mesh.faces.map((f, face) => ({ f, face })).filter(({ f }) => test(f)).map(({ face }) => ({ body: 0, face })), edges: [], bodies: [] } });
  const both = pick(f => f.kind === 'plane' && ((f.normal[2] > 0.99 && Math.abs(f.centroid[2] - 5) < 1e-6) || (f.normal[0] > 0.99 && Math.abs(f.centroid[0] - 5) < 1e-6)));
  assert.equal(both.selection.faces.length, 2); assert.equal(ff.available(both).ok, true);
  const v = ff.defaults!(both); assert.equal(v.r, 2);
  const built = ff.build!(both, { r: 6 }), node = built.nodes.at(-1)!; assert.ok(node.kind === 'face-fillet' && node.radius === 6);
  close(volumeOf(built), filled(6));
  const parallel = pick(f => f.kind === 'plane' && Math.abs(f.normal[2]) > 0.99 && (Math.abs(f.centroid[2] - 5) < 1e-6 || Math.abs(f.centroid[2]) < 1e-6));
  assert.equal(ff.available(parallel).ok, false); assert.throws(() => ff.build!(parallel, v), /parallel/);
  assert.equal(ff.available(pick(f => f.kind === 'plane' && f.normal[2] > 0.99 && Math.abs(f.centroid[2] - 5) < 1e-6)).ok, false, 'one face is not enough');
});

// A boss (Ø20, z 4..25) joined to a 60 × 60 × 5 plate: the round in its base, revolved: Pappus, the r × r square less
// the quarter disc, its centroid at radius 10 + off.
const ring = (R: number, r: number) => { const A = r * r - Math.PI * r * r / 4, off = (r ** 3 / 2 - Math.PI * r * r / 4 * (r - 4 * r / (3 * Math.PI))) / A; return 2 * Math.PI * (R + off) * A; };
const boss: StudioDoc = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [
  { kind: 'sketch', profile: 'rectangle', min: [-30, -30], max: [30, 30], id: 'n0' }, { kind: 'extrude', sketch: 0, height: 5, id: 'n1' },
  { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10, id: 'n2' }, { kind: 'extrude', sketch: 2, height: 21, from: 4, id: 'n3' },
  { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' }, id: 'n4' }], outputs: { b4: { node: 4, side: 'solid' } }, nextId: 5 } as StudioDoc;

test('face fillet: a flat face and a round one — a boss\'s base, through the API and the Studio command', () => {
  const topAndBoss = (b: BodyQuery) => b.faces().where(f => (f.kind === 'plane' && f.normal[2] > 0.99 && Math.abs(f.centroid[2] - 5) < 1e-6) || f.kind === 'curved');
  const made = part('boss', boss).faceFillet(b => topAndBoss(b), { radius: 4 }), node = made.doc.nodes.at(-1);
  assert.ok(node?.kind === 'face-fillet' && node.faces.some(n => /^n3\.side0$/.test(n)), JSON.stringify(node));
  close(volumeOf(made.doc), volumeOf(boss) + ring(10, 4));
  const ff = commands.find(c => c.id === 'face-fillet')!, bodies = bodiesOf(boss);
  const sel = bodies[0].mesh.faces.map((f, face) => ({ f, face })).filter(({ f }) => (f.kind === 'plane' && f.normal[2] > 0.99 && Math.abs(f.centroid[2] - 5) < 1e-6) || f.kind === 'curved').slice(0, 2);
  const ctx: Ctx = { doc: boss, bodies, selection: { faces: sel.map(({ face }) => ({ body: 0, face })), edges: [], bodies: [] } };
  assert.equal(ff.available(ctx).ok, true, JSON.stringify(ff.available(ctx)));
  close(volumeOf(ff.build!(ctx, { r: 4 })), volumeOf(boss) + ring(10, 4));
  // The boss's side and the plate's side (x = 30): the axis lies along that face, not square to it.
  const side = bodies[0].mesh.faces.map((f, face) => ({ f, face })).filter(({ f }) => f.kind === 'curved' || (f.kind === 'plane' && f.normal[0] > 0.99)).slice(0, 2);
  assert.equal(ff.available({ ...ctx, selection: { faces: side.map(({ face }) => ({ body: 0, face })), edges: [], bodies: [] } }).ok, false);
});

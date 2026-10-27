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
  // The boss's side and the plate's side (x = 30): offered (the axis runs along that face), but the two do not run
  // beside each other (the plate's side ends at z 5, the boss starts there), so the kernel refuses with the reason.
  const side = bodies[0].mesh.faces.map((f, face) => ({ f, face })).filter(({ f }) => f.kind === 'curved' || (f.kind === 'plane' && f.normal[0] > 0.99)).slice(0, 2);
  const sideCtx: Ctx = { ...ctx, selection: { faces: side.map(({ face }) => ({ body: 0, face })), edges: [], bodies: [] } };
  assert.equal(ff.available(sideCtx).ok, true);
  const r = evaluateDoc(ff.build!(sideCtx, { r: 4 }), 1); assert.ok(!r.ok && /FACE_FILLET_FACES/.test(r.error.detail), r.ok ? 'built' : r.error.detail);
});

// Two bosses (radius 6, centres 10 apart, 10 tall) joined: both necks filled. The oracle: each corner's section from
// its centre X (8 from both centres), tangent points and corner, its area from a dense polygon.
const eight: StudioDoc = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [
  { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 6, id: 'n0' }, { kind: 'extrude', sketch: 0, height: 10, id: 'n1' },
  { kind: 'sketch', profile: 'circle', center: [10, 0], radius: 6, id: 'n2' }, { kind: 'extrude', sketch: 2, height: 10, id: 'n3' },
  { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' }, id: 'n4' }], outputs: { b4: { node: 4, side: 'solid' } }, nextId: 5 } as StudioDoc;
const arcPts = (P: number[], Q: number[], M: number[], n = 20000) => { const a0 = Math.atan2(P[1] - M[1], P[0] - M[0]); let da = Math.atan2(Q[1] - M[1], Q[0] - M[0]) - a0; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI; const R = Math.hypot(P[0] - M[0], P[1] - M[1]); return Array.from({ length: n }, (_, i) => [M[0] + R * Math.cos(a0 + da * i / n), M[1] + R * Math.sin(a0 + da * i / n)]); };

test('face fillet: two parallel round faces — joined bosses, both necks filled, through the Studio command', () => {
  const X = [5, Math.sqrt(39)], tA = [X[0] * 0.75, X[1] * 0.75], tB = [10 + (X[0] - 10) * 0.75, X[1] * 0.75], C = [5, Math.sqrt(11)];
  const pts = [...arcPts(C, tA, [0, 0]), ...arcPts(tA, tB, X), ...arcPts(tB, C, [10, 0])], Q = Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
  const ff = commands.find(c => c.id === 'face-fillet')!, bodies = bodiesOf(eight);
  const rounds = bodies[0].mesh.faces.map((f, face) => ({ f, face })).filter(({ f }) => f.kind === 'curved');
  // One face of each boss.
  const pickA = rounds.find(({ f }) => f.name.startsWith('n1.'))!, pickB = rounds.find(({ f }) => f.name.startsWith('n3.'))!;
  const ctx: Ctx = { doc: eight, bodies, selection: { faces: [pickA, pickB].map(({ face }) => ({ body: 0, face })), edges: [], bodies: [] } };
  assert.equal(ff.available(ctx).ok, true, JSON.stringify(ff.available(ctx)));
  const built = ff.build!(ctx, { r: 2 }), v = volumeOf(built), want = volumeOf(eight) + 2 * 10 * Q;
  assert.ok(Math.abs(v - want) <= 1e-6 * want, `${v} vs ${want}`);
});

// A tapered boss (its side a cone from radius 10 at the plate's top z 5 to 6 at z 25) turned on a plate of radius 30:
// the round at its base, revolved. The oracle: the section built by hand in (radius, height), revolved as a dense polygon.
const XZm = { origin: [0, 0, 0] as [number, number, number], normal: [0, -1, 0] as [number, number, number], xAxis: [1, 0, 0] as [number, number, number] };
const taper: StudioDoc = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [
  { kind: 'sketch', profile: 'polygon', plane: XZm, points: [[0, 0], [30, 0], [30, 5], [10, 5], [6, 25], [0, 25]], id: 'n0' },
  { kind: 'revolve', sketch: 0, axis: 'y', origin: [0, 0], angle: 360, id: 'n1' }], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 } as StudioDoc;

test('face fillet: a cone and a plane — a tapered boss\'s base, through the Studio command', () => {
  const g = Math.hypot(4, 20), dA = [1, 0], dB = [-4 / g, 20 / g], C = [10, 5], r = 3, th = Math.acos(dA[0] * dB[0] + dA[1] * dB[1]), a = r / Math.tan(th / 2), bis = [dA[0] + dB[0], dA[1] + dB[1]], bl = Math.hypot(bis[0], bis[1]);
  const X = [C[0] + bis[0] / bl * r / Math.sin(th / 2), C[1] + bis[1] / bl * r / Math.sin(th / 2)], tA = [C[0] + a, C[1]], tB = [C[0] + dB[0] * a, C[1] + dB[1] * a];
  const pts = [C, tA, ...arcPts(tA, tB, X)]; let mom = 0; pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; mom += (p[0] + q[0]) * (p[0] * q[1] - q[0] * p[1]); });
  const added = Math.abs(2 * Math.PI * mom / 6);
  const ff = commands.find(c => c.id === 'face-fillet')!, bodies = bodiesOf(taper), faces = bodies[0].mesh.faces;
  const top = faces.findIndex(f => f.kind === 'plane' && f.normal[2] > 0.99 && Math.abs(f.centroid[2] - 5) < 1e-6), cone = faces.findIndex(f => f.kind === 'curved' && f.centroid[2] > 6 && f.centroid[2] < 24);
  assert.ok(top >= 0 && cone >= 0, faces.map(f => `${f.name}:${f.kind}`).join(' '));
  const ctx: Ctx = { doc: taper, bodies, selection: { faces: [{ body: 0, face: top }, { body: 0, face: cone }], edges: [], bodies: [] } };
  assert.equal(ff.available(ctx).ok, true, JSON.stringify(ff.available(ctx)));
  const v = volumeOf(ff.build!(ctx, { r: 3 })), want = volumeOf(taper) + added;
  assert.ok(Math.abs(v - want) <= 1e-6 * want, `${v} vs ${want}`);
});

// A ball (radius 6 about height 25) on a stem (radius 3): the round where they meet, revolved. The oracle: centre
// (4.5, 19) — 1.5 off the stem, 7.5 from the ball's centre —, tangent points, corner, a dense polygon revolved.
const j = 25 - Math.sqrt(27);
const ball: StudioDoc = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [
  { kind: 'sketch', profile: 'loop', plane: XZm, segments: [{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [3, 0] }, { kind: 'arc', start: [3, j], center: [0, 25], direction: 'ccw' }, { kind: 'line', start: [0, 31] }], id: 'n0' },
  { kind: 'revolve', sketch: 0, axis: 'y', origin: [0, 0], angle: 360, id: 'n1' }], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 } as StudioDoc;

test('face fillet: a sphere and a cylinder — a ball on its stem, through the Studio command', () => {
  const X = [4.5, 19], tA = [3, 19], tB = [6 * 4.5 / 7.5, 25 - 6 * 6 / 7.5], C = [3, j];
  const pts = [C, tA, ...arcPts(tA, tB, X), ...arcPts(tB, C, [0, 25])]; let mom = 0; pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; mom += (p[0] + q[0]) * (p[0] * q[1] - q[0] * p[1]); });
  const added = Math.abs(2 * Math.PI * mom / 6);
  const ff = commands.find(c => c.id === 'face-fillet')!, bodies = bodiesOf(ball), faces = bodies[0].mesh.faces;
  const stem = faces.findIndex(f => f.kind === 'curved' && f.centroid[2] < j), sphere = faces.findIndex(f => f.kind === 'curved' && f.centroid[2] > j);
  assert.ok(stem >= 0 && sphere >= 0, faces.map(f => `${f.name}:${f.kind}`).join(' '));
  const ctx: Ctx = { doc: ball, bodies, selection: { faces: [{ body: 0, face: stem }, { body: 0, face: sphere }], edges: [], bodies: [] } };
  assert.equal(ff.available(ctx).ok, true, JSON.stringify(ff.available(ctx)));
  const v = volumeOf(ff.build!(ctx, { r: 1.5 })), want = volumeOf(ball) + added;
  assert.ok(Math.abs(v - want) <= 1e-6 * want, `${v} vs ${want}`);
});

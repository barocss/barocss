import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, loadCadPart, booleanAnalytic, curveDomain, evaluateCurve, CadPartError } from '../dist/index.js';

const section = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 };
const frame = () => ({ id: 'f', kind: 'frame', points: [[0, 0, 0], [400, 0, 0], [400, 300, 0], [0, 300, 0], [0, 0, 300], [400, 0, 300], [400, 300, 300], [0, 300, 300]], segments: [[0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [7, 4]], section, corners: { multi: 'order' } });
const bead = (member, end, extra = {}) => ({ id: `w${member}${end}`, kind: 'weld-bead', frame: 'f', on: { member, end }, leg: 3, ...extra });
const all = () => [4, 5, 6, 7].flatMap(k => ['start', 'end'].map(end => bead(k, end)));
const pair = () => [bead(4, 'start'), bead(7, 'end')];
const manifest = beads => ({ version: 1, policy: 'equal-length', joints: beads.map(b => ({ ...b.on, leg: b.leg })) });
const document = (beads = all(), f = frame(), sharing = manifest(beads)) => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [f, ...beads.map(b => ({ ...b, ...(sharing === null ? {} : { sharing }) }))] });
const near = (got, want, scale, label) => assert.ok(Math.abs(got - want) <= 1e-12 * scale, `${label}: ${got} vs ${want}`);
const density = 7850;

// Independent exact triangle moments. No production report, mass or tensor supplies the oracle.
function moments(prisms) {
  const pieces = prisms.map(({ vertices, d, h }) => {
    const t = [0, 1, 2].map(i => vertices.reduce((s, v) => s + v[i], 0) / 3);
    const c = t.map((v, i) => v + d[i] * h / 2), V = 4.5 * h;
    const cov = [0, 1, 2].map(i => [0, 1, 2].map(j => vertices.reduce((s, v) => s + (v[i] - t[i]) * (v[j] - t[j]), 0) / 12 + d[i] * d[j] * h ** 2 / 12));
    return { c, V, cov };
  });
  const V = pieces.reduce((s, p) => s + p.V, 0), C = [0, 1, 2].map(i => pieces.reduce((s, p) => s + p.V * p.c[i], 0) / V);
  const S = [0, 1, 2].map(i => [0, 1, 2].map(j => pieces.reduce((s, p) => s + p.V * (p.cov[i][j] + (p.c[i] - C[i]) * (p.c[j] - C[j])), 0)));
  const trace = S[0][0] + S[1][1] + S[2][2];
  return { volumeMM3: V, centroidMM: C, inertiaCentroidKgM2: S.map((row, i) => row.map((v, j) => density * 1e-15 * ((i === j ? trace : 0) - v))) };
}
const local = [
  [{ vertices: [[0, 0, -3], [3, 0, 0], [0, 0, 0]], d: [0, -1, 0], h: 40 }, { vertices: [[0, 0, 0], [3, 0, 0], [0, 3, 0]], d: [0, 0, 1], h: 20 }],
  [{ vertices: [[-40, 0, -3], [-40, 3, 0], [-40, 0, 0]], d: [1, 0, 0], h: 40 }, { vertices: [[0, 0, 20], [3, 0, 20], [0, 3, 20]], d: [0, 0, 1], h: 20 }],
];
const corners = [
  { ids: ['w4start', 'w7end'], o: [20, 20, 280], x: [1, 0, 0], y: [0, 1, 0] },
  { ids: ['w4end', 'w5start'], o: [380, 20, 280], x: [-1, 0, 0], y: [0, 1, 0] },
  { ids: ['w5end', 'w6start'], o: [380, 280, 280], x: [0, -1, 0], y: [-1, 0, 0] },
  { ids: ['w6end', 'w7start'], o: [20, 280, 280], x: [1, 0, 0], y: [0, -1, 0] },
];
function checkMoments(s, move = p => p, rotate = p => p) {
  for (const corner of corners) for (let owner = 0; owner < 2; owner++) {
    const dir = p => p.map((_, i) => corner.x[i] * p[0] + corner.y[i] * p[1] + (i === 2 ? p[2] : 0));
    const point = p => dir(p).map((v, i) => v + corner.o[i]);
    const expected = moments(local[owner].map(p => ({ ...p, vertices: p.vertices.map(v => move(point(v))), d: rotate(dir(p.d)) })));
    const out = s.output(corner.ids[owner]), actual = out.massProperties(density), label = out.id;
    near(actual.volumeMM3, expected.volumeMM3, 270, `${label} volume`);
    near(actual.massKG, 270 * density * 1e-9, 0.003, `${label} mass`);
    actual.centroidMM.forEach((v, k) => near(v, expected.centroidMM[k], 400, `${label} centroid ${k}`));
    const scale = Math.max(...expected.inertiaCentroidKgM2.flat().map(Math.abs));
    actual.inertiaCentroidKgM2.forEach((row, i) => row.forEach((v, j) => near(v, expected.inertiaCentroidKgM2[i][j], scale, `${label} inertia ${i}${j}`)));
    const seam = out.bead.sharedSeams[0];
    assert.deepEqual(seam.ownedInterval, owner === 0 ? [0, 0.5] : [0.5, 1]);
    assert.deepEqual(seam.joints, corner.ids.map(id => s.output(id).bead.on));
    assert.equal(seam.id, JSON.stringify(['shared-seam-v1', 'f', seam.joints]));
    const path = [move(corner.o), move(corner.o.map((x, k) => x + (k === 2 ? 40 : 0)))];
    seam.pathMM.forEach((p, i) => p.forEach((v, j) => near(v, path[i][j], 400, `${label} path ${i}${j}`)));
    near(seam.lengthMM, 40, 40, `${label} length`); near(seam.nominalSharedVolumeMM3, 180, 180, `${label} nominal shared`); near(seam.ownedSharedVolumeMM3, 90, 90, `${label} owned shared`);
    assert.ok(out.validate().valid);
  }
}
const expectedPair = { frame: 'f', joints: [{ member: 4, end: 'start' }, { member: 7, end: 'end' }] };
function refusal(doc, tag = 'BEAD_SHARED_CONTEXT', component = expectedPair) {
  let caught;
  assert.throws(() => evaluateCadPart(doc), e => {
    assert.ok(e instanceof CadPartError); assert.equal(e.details?.category ?? e.code, 'PARAMETER'); assert.ok(e.message.includes(`[${tag}]`), e.message);
    assert.deepEqual(e.sharedComponent, component); caught = e; return true;
  });
  return caught;
}

test('A9 actual owned B-reps match independent volume, centroid and all nine inertia entries', () => {
  const s = evaluateCadPart(document()); checkMoments(s);
  const outputs = s.outputs.filter(o => o.bead);
  for (let a = 0; a < outputs.length; a++) for (let b = a + 1; b < outputs.length; b++) assert.equal(booleanAnalytic(outputs[a].brep, outputs[b].brep, 'intersection').bodies.length, 0);
  checkMoments(loadCadPart(s.save()));
});

test('participant/manifest order and feature names do not change semantic ids, geometry or moments', () => {
  const doc = document(), reversed = { ...doc, features: [doc.features[0], ...doc.features.slice(1).reverse().map(b => ({ ...b, sharing: { ...b.sharing, joints: [...b.sharing.joints].reverse() } }))] };
  const first = evaluateCadPart(doc), second = evaluateCadPart(reversed); checkMoments(second);
  for (const w of second.outputs.filter(o => o.bead)) assert.deepEqual(w.bead.sharedSeams, first.output(w.id).bead.sharedSeams);
  const renamed = evaluateCadPart({ ...doc, features: doc.features.map(f => f.kind === 'weld-bead' ? { ...f, id: `renamed_${f.id}` } : f) });
  for (const w of first.outputs.filter(o => o.bead)) assert.deepEqual(renamed.output(`renamed_${w.id}`).bead.sharedSeams, w.bead.sharedSeams);
});

test('proper 30-degree rotation and translation move actual moments and the oriented path once', () => {
  const a = Math.PI / 6, c = Math.cos(a), s = Math.sin(a), rotate = ([x, y, z]) => [c * x - s * y, s * x + c * y, z], move = p => rotate(p).map((v, k) => v + [7, -11, 13][k]);
  // Vertical members use the documented fallback up axis. Rotate their authored roll as well.
  const f = frame(); f.points = f.points.map(move); f.up = rotate([0, 0, 1]); f.overrides = [0, 1, 2, 3].map(member => ({ member, roll: 30 }));
  checkMoments(evaluateCadPart(document(all(), f)), move, rotate);
});

test('absent, malformed, missing, duplicate and inconsistent frame manifests refuse the actual pair', () => {
  refusal(document(all(), frame(), null));
  for (const patch of [{ version: 2 }, { policy: 'future' }, { unknown: true }, { joints: [] }, { joints: [...manifest(all()).joints, manifest(all()).joints[0]] }, { joints: [...manifest(all()).joints.slice(1)] }, { joints: manifest(all()).joints.map((j, i) => i === 0 ? { ...j, leg: 2 } : j) }]) refusal(document(all(), frame(), { ...manifest(all()), ...patch }));
  const contradictory = document(); contradictory.features.find(f => f.id === 'w7end').sharing = { ...manifest(all()), joints: [] }; refusal(contradictory);
  const sparse = manifest(all()); delete sparse.joints[0]; refusal(document(all(), frame(), sparse));
});

test('a duplicate actual endpoint cannot create an independent nominal owner', () => {
  const beads = [...pair(), bead(4, 'start', { id: 'duplicate' })]; refusal(document(beads, frame(), manifest(pair())));
});

test('three actual endpoint boundaries report their whole connected component, not an initiating pair', () => {
  const f = frame(); f.points.push([150, 150, 300]); f.segments.push([8, 4]);
  const beads = [...pair(), bead(8, 'end')], component = { frame: 'f', joints: [...expectedPair.joints, { member: 8, end: 'end' }] };
  refusal(document(beads, f), 'BEAD_SHARED_UNSUPPORTED', component); refusal(document([...beads].reverse(), f, null), 'BEAD_SHARED_CONTEXT', component);
});

test('unequal legs, inner, curved and oblique shared components refuse without returning a peer', () => {
  refusal(document([bead(4, 'start', { leg: 2 }), bead(7, 'end')]), 'BEAD_SHARED_UNSUPPORTED');
  refusal(document([bead(4, 'start', { inner: true }), bead(7, 'end')]), 'BEAD_SHARED_UNSUPPORTED');
  const curved = frame(); curved.overrides = [4, 7].map(member => ({ member, section: { ...section, outerRadius: 6 } })); refusal(document(pair(), curved), 'BEAD_SHARED_UNSUPPORTED');
  const oblique = frame(); oblique.points[5][2] = 330; assert.notEqual(evaluateCadPart(document([], oblique)).output('f/4').member.axis[2], 0); refusal(document(pair(), oblique), 'BEAD_SHARED_UNSUPPORTED');
});

test('partial and multiple actual boundary runs are outside the complete single-run contract', () => {
  const partial = frame(); partial.overrides = [{ member: 4, section: { ...section, height: 30 } }]; refusal(document(pair(), partial), 'BEAD_SHARED_UNSUPPORTED');
  const multi = frame(); multi.overrides = [4, 7].map(member => ({ member, section: { kind: 'channel', width: 40, height: 40, web: 3, flange: 3, rootRadius: 0 }, anchor: 'center' }));
  const base = evaluateCadPart(document([], multi));
  for (const member of [4, 7]) {
    const b = base.outputs.find(o => o.member.frame.member === member).brep;
    const intervals = b.edges.filter(e => e.curve.degree === 1).map(e => curveDomain(e.curve).map(t => evaluateCurve(e.curve, t))).filter(ps => ps.every(p => Math.abs(p[0] - 20) < 1e-6 && Math.abs(p[1] - 20) < 1e-6)).map(ps => ps.map(p => p[2]).sort((a, b) => a - b));
    assert.ok(intervals.some(([a, b]) => a === 280 && b === 283)); assert.ok(intervals.some(([a, b]) => a === 317 && b === 320));
  }
  refusal(document(pair(), multi), 'BEAD_SHARED_UNSUPPORTED');
});

test('a parameter or flag error carries the complete geometric component', () => {
  refusal(document([bead(4, 'start', { leg: { parameter: 'missing' } }), bead(7, 'end')]));
  refusal(document([bead(4, 'start', { inner: 'invalid' }), bead(7, 'end')]), 'BEAD_SHARED_UNSUPPORTED');
});

test('atomic retry removes exactly the failed component and rebuilds the remaining declared manifest', () => {
  const beads = all().map(b => b.id === 'w4start' ? { ...b, leg: 2 } : b), doc = document(beads);
  const error = refusal(doc, 'BEAD_SHARED_UNSUPPORTED'), removed = new Set(error.sharedComponent.joints.map(j => `${j.member}:${j.end}`));
  const remaining = beads.filter(b => !removed.has(`${b.on.member}:${b.on.end}`)), retried = evaluateCadPart(document(remaining));
  assert.deepEqual(retried.outputs.filter(o => o.bead).map(o => o.id), remaining.map(b => b.id));
  for (const b of remaining) near(retried.output(b.id).bead.volumeMM3, 270, 270, b.id);
  assert.equal(new Set(retried.outputs.flatMap(o => o.bead?.sharedSeams.map(s => s.id) ?? [])).size, 3);
  const isolated = evaluateCadPart(document([bead(4, 'start')])).output('w4start'); near(isolated.bead.volumeMM3, 360, 360, 'an authored peer removal is a new isolated input'); assert.deepEqual(isolated.bead.sharedSeams, []);
});

test('peer/leg/policy changes invalidate cached owned results while unchanged documents reuse them', () => {
  const doc = document(), s = evaluateCadPart(doc), unchanged = s.withDocument(doc); assert.equal(unchanged.recomputation.reused.length, 9);
  const edited = structuredClone(doc); edited.features.find(f => f.id === 'w7end').leg = 2;
  const ctx = manifest(edited.features.filter(f => f.kind === 'weld-bead')); edited.features.filter(f => f.kind === 'weld-bead').forEach(f => { f.sharing = ctx; });
  assert.throws(() => s.withDocument(edited), e => e.message.includes('[BEAD_SHARED_UNSUPPORTED]') && e.sharedComponent.joints.length === 2);
  assert.throws(() => s.withDocument(document(all(), frame(), null)), e => e.message.includes('[BEAD_SHARED_CONTEXT]'));
  const kept = all().filter(b => b.id !== 'w7end'), next = s.withDocument(document(kept)); near(next.output('w4start').bead.volumeMM3, 360, 360, 'removed peer invalidates');
  const changedFrame = frame(); changedFrame.overrides = [{ member: 4, section: { ...section, height: 30 } }];
  assert.throws(() => s.withDocument(document(all(), changedFrame)), e => e.message.includes('[BEAD_SHARED_UNSUPPORTED]') && e.sharedComponent.joints.length === 2);
  const paramBeads = all().map(b => b.id === 'w7end' ? { ...b, leg: { parameter: 'leg' } } : b), paramDoc = { ...document(paramBeads), parameters: { leg: 3 } };
  const param = evaluateCadPart(paramDoc); assert.throws(() => param.withParameters({ leg: 2 }), e => e.message.includes('[BEAD_SHARED_UNSUPPORTED]') && e.sharedComponent.joints.length === 2);
});

test('an invalid peer leg refuses only its actual component even when unrelated features evaluate first', () => {
  const wrong = all().map(b => b.id === 'w4start' ? { ...b, leg: { parameter: 'missing' } } : b);
  const beads = [...wrong.filter(b => !['w4start', 'w7end'].includes(b.id)), ...wrong.filter(b => ['w4start', 'w7end'].includes(b.id))];
  const error = refusal(document(beads));
  const remaining = beads.filter(b => !error.sharedComponent.joints.some(j => j.member === b.on.member && j.end === b.on.end));
  const s = evaluateCadPart(document(remaining)); for (const b of remaining) near(s.output(b.id).bead.volumeMM3, 270, 270, b.id);
});

test('isolated 360 T and ordinary gussets retain their actual quantities; gusset/cap sharing is refused', () => {
  const tee = { id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 0, 800], [500, 0, 400], [0, 0, 400]], segments: [[0, 1], [2, 3]], section, corners: { tee: 'butt' } };
  const t = evaluateCadPart(document([bead(1, 'end')], tee)).output('w1end');
  near(t.bead.volumeMM3, 360, 360, 'isolated T actual'); near(t.bead.nominalVolumeMM3, 360, 360, 'isolated T nominal'); assert.deepEqual(t.bead.sharedSeams, []);
  const f = { id: 'f', kind: 'frame', points: [[600, 0, 0], [0, 0, 0], [0, 0, 600]], segments: [[0, 1], [1, 2]], section, corners: { default: 'mitre' } };
  const gusset = { id: 'g', kind: 'gusset', frame: 'f', point: 1, legs: [120, 100], thickness: 5, clip: 15 }, w = { id: 'w', kind: 'weld-bead', frame: 'f', on: { gusset: 'g' }, leg: 3 };
  const s = evaluateCadPart({ ...document([]), features: [f, gusset, w] }), g = s.output('w');
  near(g.bead.volumeMM3, 1710, 1710, 'gusset actual'); near(g.bead.nominalVolumeMM3, 1710, 1710, 'gusset nominal'); assert.deepEqual(g.bead.sharedSeams, []);
  for (const on of [{ gusset: 'g' }, { cap: 'c' }]) assert.throws(() => evaluateCadPart({ ...document([]), features: [f, gusset, { id: 'c', kind: 'end-cap', frame: 'f', member: 0, end: 'start', fit: 'over', thickness: 4 }, { ...w, on, sharing: manifest([]) }] }), e => (e.details?.category ?? e.code) === 'PARAMETER' && e.message.includes('[BEAD_SHARED_UNSUPPORTED]'));
});

test('structured refusal data is complete independently of the bounded message text', () => {
  const joints = Array.from({ length: 100 }, (_, member) => ({ member, end: 'start' })), e = new CadPartError('PARAMETER', 'f', 'x'.repeat(2000), { frame: 'f', joints });
  assert.equal(e.message.length, 1024); assert.equal(e.sharedComponent.joints.length, 100);
});

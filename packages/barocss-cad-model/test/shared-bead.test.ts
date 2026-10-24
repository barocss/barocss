import test from 'node:test';
import assert from 'node:assert/strict';
import { booleanAnalytic, CadPartError } from '@barocss/cad';
import type { StudioDoc } from '../src/engine/doc';
import { evaluateDoc, partBreps } from '../src/engine/evaluate';
import { beadIdOf, beadsOf, toPartDocument, withBeadRetry } from '../src/engine/part';
import { beadAccounting } from '../src/frames/beadAccounting';
import { weldList } from '../src/frames/welds';
import { dispatchTool } from '../src/chat/tools';
import { joints, policy, table } from './helpers/shared-bead-scene';
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
function ok(doc: StudioDoc) { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(r)); return r; }
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) <= Math.max(1, Math.abs(b)) * 1e-12, `${a} vs ${b}`);

test('shared table through actual v2 weld edit: 8 owned 270, nominal 2880, 4 ids, full manifest and no overlapping bead B-reps', async () => {
  const all = table(), bare = { ...all, frames: { ...all.frames!, beadOwnership: undefined, welds: [] } };
  let calls = 0;
  const out = await dispatchTool({ doc: bare, bodies: ok(bare).bodies }, 'features', { action: 'welds', beadOwnership: policy,
    welds: joints.map(joint => ({ joint, kind: 'fillet', size: 3 })) }, async d => { calls++; return evaluate(d); });
  assert.equal(out.isError, false, out.content); assert.equal(calls, 1);
  const { doc, bodies } = out.state, beads = bodies.filter(b => b.element?.kind === 'weld-bead');
  assert.equal(bodies.length, 16); assert.equal(beads.length, 8);
  for (const b of beads) { near(b.volume!, 270); assert.ok(b.element?.kind === 'weld-bead'); near(b.element.report.nominalVolume, 360);
    const s = b.element.report.sharedSeams[0]; assert.equal(s.joints.length, 2);
    assert.equal(s.id, JSON.stringify(['shared-seam-v1', 'n0', s.joints])); near(s.length, 40); near(s.nominalSharedVolume, 180); near(s.ownedSharedVolume, 90);
  }
  const a = weldList(doc, bodies).totals.beads!;
  assert.equal(a.complete, true); assert.equal(a.bodyCount, 8); near(a.ownedVolumeMM3, 2160); near(a.nominalVolume, 2880); assert.equal(a.sharedSeamCount, 4);
  const features = toPartDocument(doc).features.filter(f => f.kind === 'weld-bead');
  assert.equal(features.length, 8); for (const f of features) { assert.ok(f.kind === 'weld-bead'); assert.equal(f.sharing?.joints.length, 8); }
  const breps = partBreps(doc).filter(b => b.key.startsWith('bead_'));
  for (let i = 0; i < breps.length; i++) for (let j = i + 1; j < breps.length; j++) assert.equal(booleanAnalytic(breps[i].brep, breps[j].brep, 'intersection').bodies.length, 0);
});

test('unequal peer atomically refuses two joints, replans remaining manifest, and keeps three unrelated shared components', () => {
  const doc = table(), bad: StudioDoc = { ...doc, frames: { ...doc.frames!, welds: doc.frames!.welds!.map(w => w.joint === joints[0] ? { ...w, size: 2 } : w) } };
  const r = ok(bad), a = beadAccounting(bad, r.bodies)!;
  assert.equal(a.complete, false); assert.deepEqual(a.refusedJointIds, ['b0_part4.start', 'b0_part7.end']);
  assert.equal(a.bodyCount, 6); near(a.ownedVolumeMM3, 1620); near(a.nominalVolume, 2160); assert.equal(a.sharedSeamCount, 3);
  for (const b of r.bodies.filter(b => b.element?.kind === 'weld-bead')) near(b.volume!, 270);
  const request = toPartDocument(bad).features.filter(f => f.kind === 'weld-bead');
  assert.equal(request.length, 6); for (const f of request) { assert.ok(f.kind === 'weld-bead'); assert.equal(f.sharing?.joints.length, 6); }
  for (const j of weldList(bad, r.bodies).joints.filter(j => a.refusedJointIds.includes(j.id))) {
    assert.ok(j.bead && 'refused' in j.bead); assert.match(j.bead.refused, /BEAD_SHARED_UNSUPPORTED/); assert.equal(j.bead.sharedComponent?.joints.length, 2);
  }
  assert.equal(bad.frames!.welds!.length, 8, 'authored records survive retry');
  const fixed = ok(doc); assert.equal(beadAccounting(doc, fixed.bodies)!.complete, true, 'peer edit invalidates all old refusal keys');
});

test('default missing policy refuses all actual pairs; an authored peer removal can legitimately leave a 360 singleton', () => {
  const doc = table(), legacy: StudioDoc = { ...doc, frames: { ...doc.frames!, beadOwnership: undefined } };
  const r = ok(legacy), a = beadAccounting(legacy, r.bodies)!;
  assert.equal(r.bodies.length, 8); assert.equal(a.complete, false); assert.equal(a.refusedJointIds.length, 8); assert.equal(a.ownedVolumeMM3, 0);
  assert.ok(weldList(legacy, r.bodies).joints.every(j => j.bead && 'refused' in j.bead && /BEAD_SHARED_CONTEXT/.test(j.bead.refused)));
  const removed: StudioDoc = { ...doc, frames: { ...doc.frames!, welds: doc.frames!.welds!.filter(w => w.joint !== 'b0_part7.end') } };
  const next = ok(removed), singleton = next.bodies.find(b => b.key === beadIdOf('b0_part4.start'))!;
  near(singleton.volume!, 360); assert.equal(beadAccounting(removed, next.bodies)!.complete, true);
});

test('three-way actual component is refused atomically and no partial nominal survivor is emitted', () => {
  const doc = table(), n = doc.nodes[0]; assert.ok(n.kind === 'frame' && n.points && n.segments);
  const bad: StudioDoc = { ...doc, nodes: [{ ...n, points: [...n.points, [150, 150, 300]], segments: [...n.segments, [8, 4]] }],
    frames: { ...doc.frames!, welds: [...doc.frames!.welds!, { joint: 'b0_part8.end', size: 3, kind: 'fillet' }] } };
  const e = ok(bad), a = beadAccounting(bad, e.bodies)!;
  assert.equal(a.complete, false); assert.deepEqual(a.refusedJointIds, ['b0_part4.start', 'b0_part7.end', 'b0_part8.end']);
  assert.equal(a.bodyCount, 6); near(a.ownedVolumeMM3, 1620);
});

test('retry refuses to turn global or incomplete component errors into successful subsets (fault injection only)', () => {
  const doc = { ...table(), parameters: { globalRefusalProbe: 1 } }, first = beadsOf(doc)[0];
  for (const component of [undefined, { frame: 'n0', joints: [{ member: 4, end: 'start' as const }] }]) {
    let calls = 0;
    const error = new CadPartError('PARAMETER', first.feature.id, '[BEAD_SHARED_UNSUPPORTED] unproved global failure', component);
    assert.throws(() => withBeadRetry(doc, () => { calls++; throw error; }), e => e === error); assert.equal(calls, 1);
  }
  assert.equal(toPartDocument(doc).features.filter(f => f.kind === 'weld-bead').length, 8);
});

test('all eight owned bodies retain independent prism centroid and full inertia through Model evaluation', () => {
  // Triangle barycentric covariance + uniform extrusion + parallel axis. No production mass/report feeds the oracle.
  const corners = [
    { ids: ['4.start', '7.end'], o: [20, 20, 280], x: [1, 0, 0], y: [0, 1, 0] },
    { ids: ['4.end', '5.start'], o: [380, 20, 280], x: [-1, 0, 0], y: [0, 1, 0] },
    { ids: ['5.end', '6.start'], o: [380, 280, 280], x: [0, -1, 0], y: [-1, 0, 0] },
    { ids: ['6.end', '7.start'], o: [20, 280, 280], x: [1, 0, 0], y: [0, -1, 0] },
  ];
  const local = [
    [{ v: [[0, 0, -3], [3, 0, 0], [0, 0, 0]], d: [0, -1, 0], h: 40 }, { v: [[0, 0, 0], [3, 0, 0], [0, 3, 0]], d: [0, 0, 1], h: 20 }],
    [{ v: [[-40, 0, -3], [-40, 3, 0], [-40, 0, 0]], d: [1, 0, 0], h: 40 }, { v: [[0, 0, 20], [3, 0, 20], [0, 3, 20]], d: [0, 0, 1], h: 20 }],
  ];
  const r = ok(table());
  for (const corner of corners) for (let owner = 0; owner < 2; owner++) {
    const dir = (p: number[]) => p.map((_, i) => corner.x[i] * p[0] + corner.y[i] * p[1] + (i === 2 ? p[2] : 0));
    const pieces = local[owner].map(p => {
      const v = p.v.map(x => dir(x).map((x, i) => x + corner.o[i])), d = dir(p.d);
      const t = [0, 1, 2].map(i => v.reduce((s, q) => s + q[i], 0) / 3), c = t.map((x, i) => x + d[i] * p.h / 2);
      const cov = [0, 1, 2].map(i => [0, 1, 2].map(j => v.reduce((s, q) => s + (q[i] - t[i]) * (q[j] - t[j]), 0) / 12 + d[i] * d[j] * p.h ** 2 / 12));
      return { V: 4.5 * p.h, c, cov };
    });
    const V = pieces.reduce((s, p) => s + p.V, 0), C = [0, 1, 2].map(i => pieces.reduce((s, p) => s + p.V * p.c[i], 0) / V);
    const S = [0, 1, 2].map(i => [0, 1, 2].map(j => pieces.reduce((s, p) => s + p.V * (p.cov[i][j] + (p.c[i] - C[i]) * (p.c[j] - C[j])), 0)));
    const trace = S[0][0] + S[1][1] + S[2][2], I = S.map((row, i) => row.map((v, j) => 2700e-15 * ((i === j ? trace : 0) - v)));
    const b = r.bodies.find(b => b.key === beadIdOf(`b0_part${corner.ids[owner]}`))!;
    near(b.volume!, V); near(b.mass!, V * .0027); b.centroid!.forEach((x, i) => near(x, C[i]));
    const scale = Math.max(...I.flat().map(Math.abs));
    b.inertia!.forEach((row, i) => row.forEach((v, j) => assert.ok(Math.abs(v - I[i][j]) <= 1e-12 * scale, `${b.key} I${i}${j}: ${v} vs ${I[i][j]}`)));
  }
});

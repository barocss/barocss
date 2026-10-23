import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, brepMassProperties, checkBrep } from '../dist/index.js';
import { finishBrepEdges } from '../dist/blend/edge-finish.js';
import { setRingStations } from '../dist/blend/rolling-ball.js';

// R10.4b (D96): overflow onto a sharp edge — a cliff. Where a rolling-ball fillet's contact would run off its face across
// a sharp edge of it, the ball rolls on touching the other face and that edge (the fillet meets the edge along a curve on
// it, the face beyond untouched), until it can touch a face again: span by span, cut where the contact reaches the edge
// and where the ball leaves the wedge outside it. Checked against Pappus where the ball rolls round a boss's sharp top rim
// (forced: R10.1 keeps refusing that as RADIUS_EXCEEDS_FACE), and on a pipe tee with a short branch.
const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
const out = f => evaluateCadPart(D(f)).outputs.at(-1);
const yz = { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] };

test('R10.4b a boss\'s foot filleted larger than the boss (forced through the rolling ball): the ball rolls on the sharp top rim all round — by Pappus to 2e-7; as a feature, R10.1 still refuses it (RADIUS_EXCEEDS_FACE)', () => {
  const R = 8, H = 4, boss = [{ id: 'as', kind: 'sketch', profile: 'rectangle', min: [-30, -30], max: [30, 30] }, { id: 'a', kind: 'extrude', sketch: 'as', height: 10 }, { id: 'bs', kind: 'sketch', profile: 'circle', center: [0, 0], radius: R }, { id: 'b', kind: 'extrude', sketch: 'bs', height: H, from: 10 }, { id: 'u', kind: 'union', target: 'a', tool: 'b' }];
  const o0 = out(boss), v0 = o0.massProperties(1).volumeMM3, foot = o0.brep.edges.filter(e => /a\.top/.test(e.name) && /b\.side0/.test(e.name)).map(e => e.name);
  for (const r of [4.5, 5, 6]) {
    // (The meridian region between the plate, the wall up to the rim (R, 10 + H) and the ball's arc down from the rim to the plate.)
    const xc = R + Math.sqrt(r * r - (r - H) ** 2), zc = 10 + r, pts = [[xc, 10], [R, 10], [R, 10 + H]], b0 = Math.atan2(10 + H - zc, R - xc), n = 200000;
    for (let i = 1; i <= n; i++) { const t = b0 + (-Math.PI / 2 - b0) * i / n; pts.push([xc + r * Math.cos(t), zc + r * Math.sin(t)]); }
    let M = 0; for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; M += (x0 + x1) * (x0 * y1 - x1 * y0) / 6; }
    const g = finishBrepEdges(o0.brep, foot, r, 'fillet', 'f', { general: true });
    assert.equal(checkBrep(g).valid, true, `r ${r}`);
    const got = brepMassProperties(g, 1).volumeMM3 - v0, exact = 2 * Math.PI * Math.abs(M);
    assert.ok(Math.abs(got / exact - 1) < 2e-7, `r ${r}: ${got} vs ${exact} (${got / exact - 1})`);
  }
  assert.throws(() => out([...boss, { id: 'f', kind: 'fillet', target: 'u', edges: foot, radius: 5 }]), e => e.code === 'PARAMETER' && /RADIUS_EXCEEDS_FACE/.test(e.message));
});

test('R10.4b a pipe tee whose branch stands 12 high, its junction filleted 3 (refused at R10.2a: the contact on the branch would reach 13): where it would run off the branch, the ball rolls along its top rim — valid, one body, the report in bounds, the fillet meeting the rim, its volume within 1e-6 of a loft through twice the stations', () => {
  const tee = [{ id: 'as', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10, plane: yz }, { id: 'a', kind: 'extrude', sketch: 'as', height: 60 }, { id: 'bs', kind: 'sketch', profile: 'circle', center: [30, 0], radius: 5 }, { id: 'b', kind: 'extrude', sketch: 'bs', height: 12 }, { id: 'u', kind: 'union', target: 'a', tool: 'b' }];
  const o0 = out(tee), v0 = o0.massProperties(1).volumeMM3, edge = o0.brep.edges.find(e => /a\.side0/.test(e.name) && /b\.side0/.test(e.name)).name;
  const o = out([...tee, { id: 'f', kind: 'fillet', target: 'u', edges: [edge], radius: 3 }]);
  assert.equal(o.validate().valid, true);
  assert.equal(o.bodyCount, 1);
  const [rep] = o.fillet, added = o.massProperties(1).volumeMM3 - v0;
  assert.ok(rep.contactMM <= 2.5e-7 && rep.normalDeg < 1e-3 && rep.sectionMM <= 1e-6 && rep.ballMM < 1e-8, JSON.stringify(rep));
  // The fillet meets the branch's top rim (z = 12, radius 5 about (30, 0)) along an edge of the result.
  assert.ok(o.brep.edges.some(e => /f\.face/.test(e.name) && /b\.top/.test(e.name) && [e.curve.controlPoints[0], e.curve.controlPoints.at(-1)].every(p => Math.abs(p[2] - 12) < 1e-6 && Math.abs(Math.hypot(p[0] - 30, p[1]) - 5) < 1e-6)), 'a fillet edge on the rim');
  setRingStations(2 * rep.stations);
  try { const fine = out([...tee, { id: 'f', kind: 'fillet', target: 'u', edges: [edge], radius: 3 }]).massProperties(1).volumeMM3 - v0; assert.ok(Math.abs(fine / added - 1) < 1e-6, `${added} vs ${fine}`); }
  finally { setRingStations(null); }
});

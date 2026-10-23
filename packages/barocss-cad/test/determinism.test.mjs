import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { evaluateCadPart } from '../dist/index.js';
import { setRingStations } from '../dist/blend/rolling-ball.js';

// D101: no state outlives an evaluation. Each model, evaluated alone, after the others and again, gives the same
// B-rep to the bit (its vertices and its face count) and the same volume — the rolling ball's variable radius at fixed
// station counts, R10.B's capped tool, the corner balls, a mitred top, a coaxial cone rim and a gear pair.
const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
const out = f => evaluateCadPart(D(f)).outputs.at(-1);
const at = (b, y, z) => b.edges.find(e => e.curve.degree === 1 && e.curve.controlPoints.every(p => Math.abs(p[1] - y) < 1e-9 && Math.abs(p[2] - z) < 1e-9)).name;
const yz = { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] };

const groove = () => {
  const body = [{ id: 'p', kind: 'sketch', profile: 'rectangle', min: [8, -20], max: [32, 20] }, { id: 'pe', kind: 'extrude', sketch: 'p', height: 10 },
    { id: 'cs', kind: 'sketch', profile: 'circle', center: [0, 10], radius: 4, plane: yz }, { id: 'c0', kind: 'extrude', sketch: 'cs', height: 60, from: -10 },
    { id: 'c', kind: 'rotate', target: 'c0', axis: 'y', angleDegrees: 10, pivot: [20, 0, 10] }, { id: 'g', kind: 'difference', target: 'pe', tool: 'c' }];
  const rims = out(body).brep.edges.filter(e => /c0\.side0/.test(e.name) && /pe\.top/.test(e.name) && e.curve.controlPoints[0][1] > 0);
  const pts = rims.flatMap(e => [e.curve.controlPoints[0], e.curve.controlPoints.at(-1)]), ends = pts.filter(p => pts.filter(q => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 1e-9).length === 1).sort((a, b) => a[0] - b[0]);
  return [...body, { id: 'f', kind: 'fillet', target: 'g', edges: rims.map(e => e.name), radii: [{ at: ends[0], radius: 0.6 }, { at: ends[1], radius: 1.2 }] }];
};
const step = () => {
  const t = Math.tan(Math.PI / 18), q = d => [[0, 0], [40, 0], [40 + d * t, d], [d * t, d]];
  const body = [{ id: 's', kind: 'sketch', profile: 'polygon', points: q(30) }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 },
    { id: 'q', kind: 'sketch', profile: 'polygon', points: q(15) }, { id: 'f0', kind: 'extrude', sketch: 'q', height: 10, from: 10 }, { id: 'u', kind: 'union', target: 'e', tool: 'f0' }];
  const rounded = [...body, { id: 'g', kind: 'fillet', target: 'u', edges: [at(out(body).brep, 15, 20)], radius: 4 }];
  return [...rounded, { id: 'f', kind: 'fillet', target: 'g', edges: [at(out(rounded).brep, 15, 10)], radius: 11 }];
};
const box = () => { const b = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 20] }, { id: 'e', kind: 'extrude', sketch: 's', height: 12 }]; return [...b, { id: 'f', kind: 'fillet', target: 'e', edges: out(b).brep.edges.map(e => e.name), radius: 3 }]; };
const lplate = () => { const L = [{ id: 's', kind: 'sketch', profile: 'polygon', points: [[0, 0], [40, 0], [40, 20], [20, 20], [20, 40], [0, 40]] }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 }]; return [...L, { id: 'f', kind: 'fillet', target: 'e', edges: out(L).brep.edges.filter(e => /e\.top/.test(e.name)).map(e => e.name), radius: 2 }]; };
const cone = () => {
  const body = [{ id: 's', kind: 'sketch', profile: 'polygon', points: [[0, 0], [9, 0], [9, 10], [4.833, 14.172], [0, 14.172]], plane: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] } }, { id: 'r', kind: 'revolve', sketch: 's', axis: { origin: [0, 0], direction: 'y' } }];
  return [...body, { id: 'f', kind: 'fillet', target: 'r', edges: [out(body).brep.edges.find(e => /side1#1/.test(e.name) && /side2#1/.test(e.name)).name], radius: 1 }];
};
const gears = () => [{ id: 'g1', kind: 'spur-gear', module: 2, teeth: 18, faceWidth: 8 }, { id: 'g2', kind: 'spur-gear', module: 2, teeth: 30, faceWidth: 8, mesh: { gear: 'g1' } }];

/** A fingerprint of the model's last output: its face count, volume and every vertex's coordinates, to the bit. */
const print = ([name, make, stations]) => {
  setRingStations(stations ?? null);
  try {
    const o = out(make()), h = createHash('sha256');
    for (const v of o.brep.vertices) h.update(new Uint8Array(Float64Array.from(v.point).buffer));
    return `${name} ${o.brep.faces.length} ${o.massProperties(1).volumeMM3} ${h.digest('hex')}`;
  } catch (e) { return `${name} refused ${e.code}: ${e.message}`; }
  finally { setRingStations(null); }
};

test('D101 no state outlives an evaluation: eight models evaluated in order, in reverse and again give the same B-rep to the bit', () => {
  const models = [['groove-200', groove, 200], ['groove-342', groove, 342], ['groove', groove], ['step-11', step], ['box', box], ['l-plate', lplate], ['cone-rim', cone], ['gears', gears]];
  const first = models.map(print), back = [...models].reverse().map(print).reverse(), again = models.map(print);
  assert.deepEqual(back, first);
  assert.deepEqual(again, first);
  assert.ok(first.every(s => !/refused/.test(s)), first.join('\n'));
});

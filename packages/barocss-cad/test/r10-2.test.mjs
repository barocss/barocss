import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, brepMassProperties, checkBrep } from '../dist/index.js';
import { finishBrepEdges } from '../dist/edge-finish.js';
import { setRingStations } from '../dist/rolling-ball.js';

// R10.2a (D89): the rolling-ball fillet of a closed chain between any two faces — stations solved where the ball touches
// both, the tool lofted through their sections (C² cubic, its patches breaking where the contacts cross the faces' seams)
// and applied by the analytic Boolean, its contact faces meeting the body along their contacts only. Checked against the
// closed forms where they exist (the general path forced on a boss's foot, a hole's rim, a cone's rim); elsewhere (a pipe
// tee, crossing rods) by its report — contacts on their faces, G1 there, sections against the true ones — and by its
// volume against a finer loft.
const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
const out = f => evaluateCadPart(D(f)).outputs.at(-1);
const yz = { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] }, xz = { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] };
const plate = [{ id: 'as', kind: 'sketch', profile: 'rectangle', min: [-30, -30], max: [30, 30] }, { id: 'a', kind: 'extrude', sketch: 'as', height: 10 }];
const boss = [...plate, { id: 'bs', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 8 }, { id: 'b', kind: 'extrude', sketch: 'bs', height: 15, from: 10 }, { id: 'u', kind: 'union', target: 'a', tool: 'b' }];
const hole = [...plate, { id: 'h', kind: 'hole', target: 'a', center: [0, 0], radius: 8 }];
const cone = [{ id: 's', kind: 'sketch', profile: 'polygon', points: [[0, 0], [10, 0], [10, 10], [4, 16], [0, 16]], plane: xz }, { id: 'r', kind: 'revolve', sketch: 's', axis: { origin: [0, 0], direction: 'y' } }];
const tee = (height = 25) => [{ id: 'as', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10, plane: yz }, { id: 'a', kind: 'extrude', sketch: 'as', height: 60 },
  { id: 'bs', kind: 'sketch', profile: 'circle', center: [30, 0], radius: 5 }, { id: 'b', kind: 'extrude', sketch: 'bs', height }, { id: 'u', kind: 'union', target: 'a', tool: 'b' }];
const junction = (body, a = /a\.side0/, b = /b\.side0/) => out(body).brep.edges.find(e => a.test(e.name) && b.test(e.name)).name;
const fillet = (target, edge, radius) => ({ id: 'f', kind: 'fillet', target, edges: [edge], radius });

test('R10.2a the general path against the closed forms: a boss\'s foot (concave), a hole\'s rim (convex), a cone\'s rim — forced through the rolling ball, the same fillet', () => {
  for (const [what, body, edge, rel] of [
    ['boss foot', boss, junction(boss, /a\.top/), 5e-7], ['hole rim', hole, junction(hole, /a\.top/, /h\.side0/), 5e-7], ['cone rim', cone, junction(cone, /side1#1/, /side2#1/), 5e-6],
  ]) {
    const o0 = out(body), exact = out([...body, fillet(o0.id, edge, 2)]), reports = [];
    const general = finishBrepEdges(o0.brep, [edge], 2, 'fillet', 'f', { general: true, reports });
    assert.equal(checkBrep(general).valid, true, what);
    const v0 = o0.massProperties(1).volumeMM3, ve = exact.massProperties(1).volumeMM3 - v0, vg = brepMassProperties(general, 1).volumeMM3 - v0;
    // (The loft follows the true sections to its reported deviation, so the fillet's volume to about that over its area.)
    assert.ok(Math.abs(vg / ve - 1) < rel, `${what}: ${vg} vs ${ve} (${vg / ve - 1})`);
    assert.equal(reports.length, 1);
    assert.ok(reports[0].contactMM <= 2.5e-7 && reports[0].normalDeg < 1e-3 && reports[0].ballMM < 1e-8 && reports[0].sectionMM < 1e-6, `${what}: ${JSON.stringify(reports[0])}`);
  }
});

test('R10.2a a pipe tee and crossing rods (no closed form): valid, the fillet\'s report in bounds, its volume within 1e-6 of a finer loft\'s; the whole loop from one of its edges', () => {
  const cross = [...tee().slice(0, 2), { id: 'bs', kind: 'sketch', profile: 'circle', center: [20, 0], radius: 3, plane: { origin: [0, 0, -15], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'b', kind: 'extrude', sketch: 'bs', height: 30 }, { id: 'u', kind: 'union', target: 'a', tool: 'b' }];
  for (const [what, body, r] of [['tee', tee(), 2], ['crossing rods', cross, 1]]) {
    const o0 = out(body), edge = junction(body), o = out([...body, fillet('u', edge, r)]);
    assert.equal(o.validate().valid, true, what);
    const [rep] = o.fillet, added = o.massProperties(1).volumeMM3 - o0.massProperties(1).volumeMM3;
    assert.ok(rep.edges.length > 1 && rep.edges.includes(edge), `${what}: the loop's ${rep.edges.length} edges`);
    assert.ok(rep.contactMM <= 2.5e-7 && rep.normalDeg < 1e-3 && rep.ballMM < 1e-8 && rep.sectionMM < 1e-6, `${what}: ${JSON.stringify(rep)}`);
    assert.ok(added > 0, `${what}: a concave fillet adds material (${added})`);
    // A finer loft (twice the stations) agrees.
    setRingStations(2 * rep.stations);
    try { const fine = out([...body, fillet('u', edge, r)]).massProperties(1).volumeMM3 - o0.massProperties(1).volumeMM3; assert.ok(Math.abs(fine / added - 1) < 1e-6, `${what}: ${added} vs ${fine}`); }
    finally { setRingStations(null); }
    assert.equal(o.brep.faces.filter(f => /^f\.face#\d+$/.test(f.name)).length, rep.patches, `${what}: one fillet face a patch`);
  }
});

test('R10.2a refusals: a fillet running off its faces (a short branch) — CONTACT_LEAVES_FACE; general chamfers not yet (an open chain of general edges, refused here at first, is R10.2b\'s: r10-2b.test.mjs)', () => {
  // The branch stands 12 high, its foot at 8.66–10: a ball of 3 would touch it up to 13.
  assert.throws(() => out([...tee(12), fillet('u', junction(tee(12)), 3)]), e => e.code === 'PARAMETER' && /\[CONTACT_LEAVES_FACE\]/.test(e.message));
  assert.throws(() => out([...tee(), { id: 'f', kind: 'chamfer', target: 'u', edges: [junction(tee())], distance: 1 }]), e => e.code === 'CAPABILITY' && /chamfers between general faces/.test(e.message));
});

test('R10.2a names: every face but the fillet\'s keeps its name as the radius changes; the fillet\'s faces are f.face#k, one a patch', () => {
  const body = tee(), edge = junction(body), names = r => out([...body, fillet('u', edge, r)]).brep.faces.map(f => f.name.replace(/#\d+$/, '')).filter(n => n !== 'f.face').sort();
  assert.deepEqual(names(1), names(2));
  assert.ok(names(2).includes('a.side0') && names(2).includes('b.side0') && names(2).includes('b.top'), names(2).join(' '));
});

test('R10.2 the pipe clamp\'s lug as a B-rep (the coordinator\'s probe): each lug-to-tube edge filleted alone by R10.1 — rulings (translational) and arcs (plane × square cylinder) — and the loop in one feature (refused here at first: the ball rolls round the lug\'s edges at its inside corners) built by R10.3a (r10-3a.test.mjs)', () => {
  // A tube along X (20 out, 14 in), a lug 20 × 8 × 19 standing on it with its broad faces (y = ±4) along the axis and its
  // narrow ones (x = 20, 40) square to it; a hole through the lug square to its broad faces.
  const xzAt = y => ({ origin: [0, y, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] });
  const lug = [{ id: 'ts', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 20, plane: yz, holes: [[{ kind: 'arc', start: [14, 0], center: [0, 0], direction: 'ccw' }]] }, { id: 't', kind: 'extrude', sketch: 'ts', height: 60 },
    { id: 'ls', kind: 'sketch', profile: 'rectangle', min: [20, 16], max: [40, 35], plane: xzAt(4) }, { id: 'l', kind: 'extrude', sketch: 'ls', height: 8 }, { id: 'u', kind: 'union', target: 't', tool: 'l' },
    { id: 'hs', kind: 'sketch', profile: 'circle', center: [30, 28], radius: 4, plane: xzAt(10) }, { id: 'h', kind: 'extrude', sketch: 'hs', height: 20 }, { id: 'c', kind: 'difference', target: 'u', tool: 'h' }];
  const o0 = out(lug), edges = o0.brep.edges.filter(e => /t\.side0/.test(e.name) && /(^|\|)l\./.test(e.name));
  assert.deepEqual(edges.map(e => e.curve.degree === 1 ? 'ruling' : 'arc').sort(), ['arc', 'arc', 'ruling', 'ruling']);
  for (const e of edges) {
    const o = out([...lug, fillet('c', e.name, 2)]);
    assert.equal(o.validate().valid, true, e.name);
    assert.ok(o.massProperties(1).volumeMM3 > o0.massProperties(1).volumeMM3, e.name);
  }
  assert.equal(evaluateCadPart(D([...lug, { id: 'f', kind: 'fillet', target: 'c', edges: edges.map(e => e.name), radius: 2 }])).outputs.at(-1).validate().valid, true);
});

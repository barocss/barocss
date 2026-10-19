import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart } from '../dist/index.js';
import { setRingStations } from '../dist/rolling-ball.js';

// R10.3a (D92): the rolling ball round an edge at a corner. Where two finished edges meet at an inside corner of the face
// they share, and the edge between their other faces (not finished) turns the other way to the fillet — a box boss's
// upright edge at its foot, a lug's corner standing on a tube, an L-plate's inner upright edge under its rounded top —
// the ball leaves one face at that edge, rolls round it touching the shared face and the edge, and goes on along the
// next face: one tool for the chain, its corner a canal surface about the edge (a horn torus quarter where the shared
// face is a plane square to the edge). Where a rolling-ball chain meets another finished edge at a convex corner of their
// shared face, both run past and the Boolean makes the mitre (as R10.1's do).
const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
const out = f => evaluateCadPart(D(f)).outputs.at(-1);
const fillet = (target, edges, radius) => ({ id: 'f', kind: 'fillet', target, edges, radius });
// The closed forms: a straight fillet's section (1 − π/4) r²; a quarter turn of it about the upright edge (Pappus, its
// first moment about the edge r³ (5/6 − π/4)); two convex straight fillets meeting square in a mitre overlap by r³ (5/3 − π/2).
const straight = r => (1 - Math.PI / 4) * r * r, corner = r => Math.PI / 2 * r ** 3 * (5 / 6 - Math.PI / 4), mitre = r => r ** 3 * (5 / 3 - Math.PI / 2);

const boss = [{ id: 'ps', kind: 'sketch', profile: 'rectangle', min: [-30, -30], max: [30, 30] }, { id: 'p', kind: 'extrude', sketch: 'ps', height: 10 },
  { id: 'bs', kind: 'sketch', profile: 'rectangle', min: [-10, -6], max: [10, 6] }, { id: 'b', kind: 'extrude', sketch: 'bs', height: 15, from: 10 }, { id: 'u', kind: 'union', target: 'p', tool: 'b' }];
const foot = body => out(body).brep.edges.filter(e => /p\.top/.test(e.name) && /b\.side/.test(e.name)).map(e => e.name);

test('R10.3a a box boss\'s foot, all four edges in one feature (refused before: inside corners of the plate\'s top): the ball rolls round each upright edge — the fillet\'s added volume (1 − π/4) r² × 64 + 4 quarter turns, to 1e-8; contacts exact on the planes, the report in bounds', () => {
  const o0 = out(boss), v0 = o0.massProperties(1).volumeMM3;
  for (const r of [1, 2, 4]) {
    const o = out([...boss, fillet('u', foot(boss), r)]);
    assert.equal(o.validate().valid, true, `r ${r}`);
    assert.equal(o.bodyCount, 1);
    const got = o.massProperties(1).volumeMM3 - v0, exact = straight(r) * 64 + 4 * corner(r);
    assert.ok(Math.abs(got / exact - 1) < 1e-8, `r ${r}: ${got} vs ${exact} (${got / exact - 1})`);
    const [rep] = o.fillet;
    assert.equal(rep.edges.length, 4);
    assert.ok(rep.contactMM <= 2.5e-7 && rep.sectionMM <= 1e-6 && rep.ballMM < 1e-8, JSON.stringify(rep));
  }
});

test('R10.3a an L-plate\'s top rounded (convex): its two inner edges round the inner upright edge (the ball inside the material, rolling round a concave edge), and all six edges — the inner corner rolled, the five outer ones mitred — each to its closed form (1e-8, the mitres 5e-8)', () => {
  const L = [{ id: 's', kind: 'sketch', profile: 'polygon', points: [[0, 0], [40, 0], [40, 20], [20, 20], [20, 40], [0, 40]] }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 }];
  const o0 = out(L), v0 = o0.massProperties(1).volumeMM3, top = o0.brep.edges.filter(e => /e\.top/.test(e.name)).map(e => e.name), r = 2;
  const inner = o0.brep.edges.filter(e => /e\.top/.test(e.name) && e.curve.controlPoints.some(p => p[0] === 20 && p[1] === 20)).map(e => e.name);
  assert.equal(inner.length, 2);
  // (The mitres are R10.1's Booleans of two cylinders, their intersection curves fitted: 2e-8 there.)
  for (const [what, edges, exact, rel] of [['inner', inner, straight(r) * 40 + corner(r), 1e-8], ['all six', top, straight(r) * 160 - 5 * mitre(r) + corner(r), 5e-8]]) {
    const o = out([...L, fillet('e', edges, r)]);
    assert.equal(o.validate().valid, true, what);
    const got = v0 - o.massProperties(1).volumeMM3;
    assert.ok(Math.abs(got / exact - 1) < rel, `${what}: ${got} vs ${exact} (${got / exact - 1})`);
  }
});

test('R10.3a the pipe clamp\'s lug loop in one feature (the coordinator\'s probe, refused at R10.2): the ball rolls round the lug\'s four upright edges between rulings and arcs on the tube — valid, one body, the report in bounds, its volume within 1e-6 of a loft through twice the stations', () => {
  const yz = { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] }, xzAt = y => ({ origin: [0, y, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] });
  const lug = [{ id: 'ts', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 20, plane: yz, holes: [[{ kind: 'arc', start: [14, 0], center: [0, 0], direction: 'ccw' }]] }, { id: 't', kind: 'extrude', sketch: 'ts', height: 60 },
    { id: 'ls', kind: 'sketch', profile: 'rectangle', min: [20, 16], max: [40, 35], plane: xzAt(4) }, { id: 'l', kind: 'extrude', sketch: 'ls', height: 8 }, { id: 'u', kind: 'union', target: 't', tool: 'l' },
    { id: 'hs', kind: 'sketch', profile: 'circle', center: [30, 28], radius: 4, plane: xzAt(10) }, { id: 'h', kind: 'extrude', sketch: 'hs', height: 20 }, { id: 'c', kind: 'difference', target: 'u', tool: 'h' }];
  const o0 = out(lug), v0 = o0.massProperties(1).volumeMM3, edges = o0.brep.edges.filter(e => /t\.side0/.test(e.name) && /(^|\|)l\./.test(e.name)).map(e => e.name);
  const o = out([...lug, fillet('c', edges, 2)]);
  assert.equal(o.validate().valid, true);
  assert.equal(o.bodyCount, 1);
  const [rep] = o.fillet, added = o.massProperties(1).volumeMM3 - v0;
  assert.equal(rep.edges.length, 4);
  assert.ok(rep.contactMM <= 2.5e-7 && rep.normalDeg < 1e-3 && rep.sectionMM <= 1e-6 && rep.ballMM < 1e-8, JSON.stringify(rep));
  setRingStations(2 * rep.stations);
  try { const fine = out([...lug, fillet('c', edges, 2)]).massProperties(1).volumeMM3 - v0; assert.ok(Math.abs(fine / added - 1) < 1e-6, `${added} vs ${fine}`); }
  finally { setRingStations(null); }
});
// (R10.3a refused a corner of three finished edges — the boss's foot and one upright edge — as VERTEX_BLEND_UNSUPPORTED;
// R10.3b blends it: r10-3b.test.mjs.)

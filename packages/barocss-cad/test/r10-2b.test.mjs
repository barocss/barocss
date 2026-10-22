import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, brepMassProperties, checkBrep } from '../dist/index.js';
import { finishBrepEdges } from '../dist/edge-finish.js';

// R10.2b (D90): the rolling-ball fillet of an open chain. Its tool is capped at its ends: where the body ends past a
// convex end it runs on, a step at a time, until its section clears the end face (the Boolean trims it); a concave end
// where the body ends, or a convex one at a wall, runs on and is cut by that face's plane (a square stop would leave a
// wedge). Checked against closed forms with the general path forced (a groove along a plate, a rod lying across one at
// an angle), and the same end cut now made by R10.1's closed-form tools (they stopped square: 0.6–1.5 % too much).
const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
const out = f => evaluateCadPart(D(f)).outputs.at(-1);
const yz = { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] };
const plate = [{ id: 'p', kind: 'sketch', profile: 'rectangle', min: [0, -20], max: [40, 20] }, { id: 'pe', kind: 'extrude', sketch: 'p', height: 10 }];
/** The plate from x0 to x1 (the groove's rims, ellipse arcs from x ≈ −3 to 43, end well short of their tips on 8–32). */
const plateFrom = (x0, x1) => [{ ...plate[0], min: [x0, -20], max: [x1, 20] }, plate[1]];
const rod = [{ id: 'cs', kind: 'sketch', profile: 'circle', center: [0, 10], radius: 4, plane: yz }, { id: 'c0', kind: 'extrude', sketch: 'cs', height: 60, from: -10 }];
/** A rod (radius 4, its axis at the plate's top) cut from the plate (a groove) or joined to it, turned `deg` about `axis` through the plate's middle. */
const across = (op, axis, deg, slab = plate) => [...slab, ...rod, ...(deg ? [{ id: 'c', kind: 'rotate', target: 'c0', axis, angleDegrees: deg, pivot: [20, 0, 10] }] : []), { id: 'g', kind: op, target: 'pe', tool: deg ? 'c' : 'c0' }];
const rim = body => out(body).brep.edges.find(e => /c0\.side0/.test(e.name) && /pe\.top/.test(e.name) && e.curve.controlPoints[0][1] > 0).name;
const fillet = (target, edges, radius) => ({ id: 'f', kind: 'fillet', target, edges, radius });
// The section between the plate's top and the rod, r 1 (the R10.1 closed form: the triangle less two sectors).
const section = r => { const yc = Math.sqrt((4 + r) ** 2 - r ** 2); return yc * r / 2 - r * r * Math.atan2(yc, r) / 2 - 16 * Math.atan2(r, yc) / 2; };

test('R10.2b against closed forms, the general path forced: a groove along the plate (convex, run past both ends) and a rod lying across it at 10° (concave, cut by both oblique ends) — the fillet\'s volume to rounding', () => {
  for (const [what, body, sign, length, rel] of [
    ['groove', across('difference', 'y', 0), -1, 40, 1e-9],
    ['rod at 10°', across('union', 'z', 10), 1, 40 / Math.cos(Math.PI / 18), 2e-6],
  ]) {
    const o0 = out(body), reports = [], g = finishBrepEdges(o0.brep, [rim(body)], 1, 'fillet', 'f', { general: true, reports });
    assert.equal(checkBrep(g).valid, true, what);
    const got = sign * (brepMassProperties(g, 1).volumeMM3 - o0.massProperties(1).volumeMM3), exact = section(1) * length;
    assert.ok(Math.abs(got / exact - 1) < rel, `${what}: ${got} vs ${exact} (${got / exact - 1})`);
    assert.ok(reports[0].contactMM <= 2.5e-7 && reports[0].normalDeg < 1e-3, `${what}: ${JSON.stringify(reports[0])}`);
  }
});

test('R10.2b an oblique groove (a rod tilted 10° about Y: its rims ellipse arcs) on a plate from 8 to 32 — both rims filleted, one body, valid, the report in bounds; on a plate from 0 to 40, where the rims end near their tips, the round runs off the top before the rim ends: refused (R10.4)', () => {
  const long = across('difference', 'y', 10);
  assert.throws(() => out([...long, fillet('g', [rim(long)], 1)]), e => e.code === 'PARAMETER' && /\[CONTACT_LEAVES_FACE\]/.test(e.message));
  const body = across('difference', 'y', 10, plateFrom(8, 32)), edges = out(body).brep.edges.filter(e => /c0\.side0/.test(e.name) && /pe\.top/.test(e.name));
  for (const side of [1, -1]) {
    const edge = edges.find(e => Math.sign(e.curve.controlPoints[0][1]) === side).name, o = out([...body, fillet('g', [edge], 1)]);
    assert.equal(o.validate().valid, true, `y ${side}`);
    assert.equal(o.bodyCount, 1, `y ${side}`);
    const [rep] = o.fillet;
    assert.ok(rep.contactMM <= 2.5e-7 && rep.normalDeg < 1e-3 && rep.sectionMM < 2e-6 && rep.ballMM < 1e-8, JSON.stringify(rep));
    assert.ok(o.massProperties(1).volumeMM3 < out(body).massProperties(1).volumeMM3, 'a convex fillet removes material');
  }
});

test('R10.1\'s closed-form tools end where an oblique end face is: a rib turned 10° and 25° on a plate, its concave feet filleted — (1 − π/4) r² × 40 / cos θ a foot, to rounding (they stopped square before, 0.6–1.5 % over)', () => {
  const rib = deg => [...plate, { id: 'rs', kind: 'sketch', profile: 'rectangle', min: [-10, -2], max: [50, 2] }, { id: 'r0', kind: 'extrude', sketch: 'rs', height: 6, from: 10 }, ...(deg ? [{ id: 'r', kind: 'rotate', target: 'r0', axis: 'z', angleDegrees: deg, pivot: [20, 0, 10] }] : []), { id: 'u', kind: 'union', target: 'pe', tool: deg ? 'r' : 'r0' }];
  for (const deg of [0, 10, 25]) {
    const body = rib(deg), o0 = out(body), feet = o0.brep.edges.filter(e => /r0\.side/.test(e.name) && /pe\.top/.test(e.name) && e.curve.degree === 1).map(e => e.name);
    const o = out([...body, fillet('u', feet, 1)]), exact = feet.length * (1 - Math.PI / 4) * 40 / Math.cos(deg * Math.PI / 180);
    assert.equal(o.validate().valid, true, `${deg}°`);
    assert.ok(Math.abs((o.massProperties(1).volumeMM3 - o0.massProperties(1).volumeMM3) / exact - 1) < 2e-7, `${deg}°`);
  }
  // The rod lying across at 10° by R10.1's translational tool: the same cut ends.
  const body = across('union', 'z', 10), o0 = out(body), o = out([...body, fillet('g', [rim(body)], 1)]);
  assert.ok(Math.abs((o.massProperties(1).volumeMM3 - o0.massProperties(1).volumeMM3) / (section(1) * 40 / Math.cos(Math.PI / 18)) - 1) < 2e-6);
});

// (An end square on a face — the rod lying straight across, forced — was refused here; it builds since R10.B: r10-b.test.mjs.)
test('R10.2b refusals: an end meeting another finished edge (a vertex blend, R10.3)', () => {
  const groove = across('difference', 'y', 10, plateFrom(8, 32)), b = out(groove).brep, edge = b.edges.find(e => /c0\.side0/.test(e.name) && /pe\.top/.test(e.name) && e.curve.controlPoints[0][1] > 0);
  // The plate's top edge at the rim's end (x = 40) as well: they meet at a vertex.
  const end = b.edges.find(e => /pe\.side[13]/.test(e.name) && /pe\.top/.test(e.name) && e.vertices.some(v => edge.vertices.includes(v)));
  assert.ok(end, 'the top edge at the rim\'s end');
  assert.throws(() => out([...groove, fillet('g', [edge.name, end.name], 1)]), e => e.code === 'CAPABILITY' && /meets another finished edge at its end/.test(e.message));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, checkOutput, massPropertiesOf } from '../dist/index.js';

// R10.3c (D94): R10.1's closed-form tools ending at a cylinder across the edge — a rod's feet on a round plate, ending at
// its rim — run past and are cut by that cylinder, near that end only (they stopped square before: 1.7–6.5 % too much on
// the cases tried). Where the tool's end would lie across a seam between the body's faces on that cylinder, or the Boolean
// fails with the cut, the end stops square as before.
const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
const out = f => evaluateCadPart(D(f)).outputs.at(-1);
const yz = { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] };
const rod = (from = -10) => [{ id: 'cs', kind: 'sketch', profile: 'circle', center: [0, 10], radius: 4, plane: yz }, { id: 'c0', kind: 'extrude', sketch: 'cs', height: 60, from }];
// The fillet's section between the plate's top (z = 10) and the rod (radius 4, its axis at the top), radius r: at y its
// height h(y) — above the top or the rod, below the fillet's arc.
const X16 = [0.0950125098376374, 0.2816035507792589, 0.4580167776572274, 0.6178762444026438, 0.7554044083550030, 0.8656312023878318, 0.9445750230732326, 0.9894009349916499], W16 = [0.1894506104550685, 0.1826034150449236, 0.1691565193950025, 0.1495959888165767, 0.1246289712555339, 0.0951585116824928, 0.0622535239386479, 0.0271524594117541];
const gl = (f, a, b, n = 400) => { let s = 0; const hh = (b - a) / n; for (let i = 0; i < n; i++) { const m = a + (i + 0.5) * hh; for (let k = 0; k < 8; k++) { const d = hh / 2 * X16[k]; s += hh / 2 * W16[k] * (f(m - d) + f(m + d)); } } return s; };
/** The two feet's fillets of the rod across a round plate of radius R: ∫ over each section of the chord 2 √(R² − y²) at y. */
function onDisc(R, r) {
  const yc = Math.sqrt((4 + r) ** 2 - r ** 2), yt = 4 * yc / (4 + r);
  const h = y => Math.max(0, 10 + r - Math.sqrt(Math.max(0, r * r - (y - yc) ** 2)) - (y < 4 ? 10 + Math.sqrt(16 - y * y) : 10)), g = y => h(y) * 2 * Math.sqrt(R * R - y * y);
  // (Across [yt, 4] in t with y = 4 − t²: the rod's √(16 − y²) has an infinite slope at 4.)
  return 2 * (gl(t => g(4 - t * t) * 2 * t, 0, Math.sqrt(4 - yt)) + gl(g, 4, yc));
}

test('R10.3c a rod across a round plate, its feet filleted (R10.1\'s translational tools): cut by the plate\'s rim — the two feet\'s ∫ of the section across the disc\'s chord, to 1e-6 (the tools\' cuts by the rim are fitted curves); near a seam of the rim, the ends stop square as before (valid, over)', () => {
  const R = 20, disc = [{ id: 'p', kind: 'sketch', profile: 'circle', center: [0, 0], radius: R }, { id: 'pe', kind: 'extrude', sketch: 'p', height: 10 }];
  const across = deg => [...disc, ...rod(-30), ...(deg ? [{ id: 'c', kind: 'rotate', target: 'c0', axis: 'z', angle: deg, pivot: [0, 0, 10] }] : []), { id: 'g', kind: 'union', target: 'pe', tool: deg ? 'c' : 'c0' }];
  for (const [deg, r] of [[0, 1], [45, 1], [60, 1.5], [90, 2], [25, 2]]) {
    const body = across(deg), o0 = out(body), feet = o0.brep.edges.filter(e => /c0\.side0/.test(e.name) && /pe\.top/.test(e.name)).map(e => e.name);
    const o = out([...body, { id: 'f', kind: 'fillet', target: 'g', edges: feet, radius: r }]);
    assert.equal(checkOutput(o).valid, true, `${deg}° r ${r}`);
    const got = massPropertiesOf(o).volume - massPropertiesOf(o0).volume, exact = onDisc(R, r);
    assert.ok(Math.abs(got / exact - 1) < 1e-6, `${deg}° r ${r}: ${got} vs ${exact} (${got / exact - 1})`);
  }
  // At 10° one foot's ends lie across the rim's seams (x = ±20): those stop square at their vertices, as before.
  const body = across(10), o0 = out(body), feet = o0.brep.edges.filter(e => /c0\.side0/.test(e.name) && /pe\.top/.test(e.name)).map(e => e.name);
  const o = out([...body, { id: 'f', kind: 'fillet', target: 'g', edges: feet, radius: 1 }]);
  assert.equal(checkOutput(o).valid, true);
  const got = massPropertiesOf(o).volume - massPropertiesOf(o0).volume, exact = onDisc(R, 1);
  assert.ok(got > exact && got < 1.02 * exact, `${got} vs ${exact}`);
});

test('R10.3c refusals kept: a general fillet ending at a curved face (a tilted rod\'s foot ending at a round plate\'s rim), or square on a plane (r10-2b) — the analytic Boolean fails there on the cases tried', () => {
  const disc = [{ id: 'p', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 20 }, { id: 'pe', kind: 'extrude', sketch: 'p', height: 10 }];
  const body = [...disc, ...rod(-30), { id: 'c', kind: 'rotate', target: 'c0', axis: 'y', angle: 5, pivot: [0, 0, 10] }, { id: 'g', kind: 'union', target: 'pe', tool: 'c' }];
  const foot = out(body).brep.edges.find(e => /c0\.side0/.test(e.name) && /pe\.top/.test(e.name)).name;
  assert.throws(() => out([...body, { id: 'f', kind: 'fillet', target: 'g', edges: [foot], radius: 1 }]), e => e.code === 'CAPABILITY' && /meets a curved face/.test(e.message));
});

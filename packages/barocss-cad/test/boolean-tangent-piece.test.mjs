import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, tessellateBrep, checkBrep } from '../dist/index.js';
import { documentOf } from '../scripts/rb/fuzz-gen.mjs';

const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const leaf = (kind, dims, rot, move) => ({ leaf: { kind, ...dims, rot: rot.map(([axis, deg]) => ({ axis, deg })), move } });
const selfTouch = /boundary touches itself at \(.*\), where one surface only touches another: not a manifold solid/;

test('analytic Boolean: a piece whose middle lies on a plane that only touches it is re-judged; one lump touching itself there is refused, typed (D205)', () => {
  // L4 fuzz 56, shrunk: a box less (a cylinder r 2 tangent inside two of its sides ∪ a box) — the hole's wall touches the
  // outer face y = 0 along a line, a zero wall. Refused before as "edge … has 1 uses" (half the wall misjudged as on that
  // face); now as what it is.
  const tree = { op: 'difference', a: leaf('box', { w: 8, d: 3, h: 8 }, [['y', 180], ['x', 180]], [0, 0, -2]),
    b: { op: 'union', a: leaf('cyl', { r: 2, h: 4 }, [], [-2, -2, 1]), b: leaf('box', { w: 1, d: 5, h: 5 }, [['y', 90]], [-1, 2, -2]) } };
  const { document } = documentOf(tree);
  assert.throws(() => evaluateCadPart(document), e => e.code === 'GEOMETRY' && selfTouch.test(e.message));
  // Two cavities tangent at a point (the exact body, were it a solid: 8000 − 4π·20 − 9π·20 = 7183.1859 mm³) — refused.
  const cube = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 20] }, { id: 'e', kind: 'extrude', sketch: 's', height: 20 }];
  assert.throws(() => evaluateCadPart(D([...cube, { kind: 'hole', center: [5, 10], radius: 2, axis: 'y', id: 'h1', target: 'e' }, { kind: 'hole', center: [10, 10], radius: 3, id: 'h2', target: 'h1' }])),
    e => e.code === 'GEOMETRY' && selfTouch.test(e.message));
});

test('analytic Boolean: two lumps that only touch where a piece is re-judged are two bodies, either way round (D205)', () => {
  // A box and a cylinder r 2 tangent to its face y = 0 from outside, both turned 30° about x: half the cylinder's wall has
  // its middle on the line of touch. Refused before; now the two bodies of D204's contract, 8 · 3 · 8 + π · 4 · 4 mm³.
  const doc = (a, b) => D([{ id: 'bs', kind: 'sketch', profile: 'rectangle', min: [-8, 0], max: [0, 3] }, { id: 'b0', kind: 'extrude', sketch: 'bs', height: 8, from: -2 }, { id: 'b', kind: 'rotate', target: 'b0', axis: 'x', angleDegrees: 30, pivot: [0, 0, 0] },
    { id: 'cs', kind: 'sketch', profile: 'circle', center: [-2, -2], radius: 2 }, { id: 'c0', kind: 'extrude', sketch: 'cs', height: 4, from: 1 }, { id: 'c', kind: 'rotate', target: 'c0', axis: 'x', angleDegrees: 30, pivot: [0, 0, 0] },
    { id: 'u', kind: 'union', target: a, tool: b }]);
  const exact = 8 * 3 * 8 + 16 * Math.PI;
  for (const [a, b] of [['b', 'c'], ['c', 'b']]) {
    const o = evaluateCadPart(doc(a, b)).output('u'), m = o.massProperties(1), names = o.brep.faces.filter(f => o.brep.shells.find(s => s.id === f.shell).body === 'u_body0').map(f => f.name.split('.')[0]);
    assert.equal(o.bodyCount, 2, `${a} ∪ ${b}`);
    assert.equal(checkBrep(o.brep, { strict: true }).valid, true);
    assert.ok(Math.abs(m.volumeMM3 - exact) <= 1e-9 * exact, `${a} ∪ ${b}: ${m.volumeMM3} vs ${exact}`);
    // (The tool's lump first, as for lumps apart: D204.)
    assert.ok(names.every(n => n.startsWith(b === 'c' ? 'c' : 'b')), `${a} ∪ ${b}: body0 ${names}`);
    const mesh = tessellateBrep(o.brep, { segmentsPerQuarter: 8 });
    assert.ok(mesh.indices.length > 0);
  }
});

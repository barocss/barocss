import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart } from '../dist/index.js';

// A cone (r 3, h 4, apex up) less what lies past the plane x = −1: the plane trims its apex face along a hyperbola.
const R1 = 3, H = 4, d = 1;
const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
  { id: 'cs', kind: 'sketch', profile: 'loop', segments: [[0, 0], [R1, 0], [0, H]].map(start => ({ kind: 'line', start })), plane: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] } },
  { id: 'cone', kind: 'revolve', sketch: 'cs', axis: { origin: [0, 0], direction: 'y' }, angleDegrees: 360 },
  { id: 'bs', kind: 'sketch', profile: 'rectangle', min: [-d, -5], max: [6, 5] }, { id: 'box', kind: 'extrude', sketch: 'bs', height: 6 },
  { id: 'i', kind: 'intersect', target: 'cone', tool: 'box' }] };
/** The cone's volume less its part past x = −d: ∫ of the circle segment's area over z (Gauss–Legendre, 4000 panels). */
function exact() {
  const seg = r => r <= d ? 0 : r * r * Math.acos(d / r) - d * Math.sqrt(r * r - d * d), zEnd = H * (1 - d / R1);
  const g = [[-0.906179845938664, 0.236926885056189], [-0.538469310105683, 0.478628670499366], [0, 0.568888888888889], [0.538469310105683, 0.478628670499366], [0.906179845938664, 0.236926885056189]];
  let past = 0; const N = 4000;
  for (let k = 0; k < N; k++) { const a = zEnd * k / N, b = zEnd * (k + 1) / N; for (const [x, w] of g) past += w * (b - a) / 2 * seg(R1 * (1 - ((a + b) / 2 + x * (b - a) / 2) / H)); }
  return Math.PI * R1 * R1 * H / 3 - past;
}

test('mass: a face reaching its pole takes the strips of its trims away from the pole (D192)', () => {
  // (Before D192 the apex face kept its whole hyperbola's chord error, extrapolated as the square of the step: 5.3e-4
  // of the volume off. Now 5e-10, the closed form's own panels.)
  const m = evaluateCadPart(doc).output('i').massProperties(1), V = exact();
  assert.equal(m.method, 'quadrature');
  assert.ok(Math.abs(m.volumeMM3 - V) <= 1e-8 * V, `${m.volumeMM3} vs ${V}`);
});

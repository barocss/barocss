import { writeFileSync } from 'node:fs';
import { loftSolid } from '../../../../../packages/barocss-cad/dist/index.js';
const square = w => [[0, 0], [w, 0], [w, w], [0, w]].map(start => ({ kind: 'line', start }));
const circle = r => [{ kind: 'arc', start: [r, 0], center: [0, 0], direction: 'ccw' }];
const u = [0, 1, 0], v = [0, 0, 1], n = [1, 0, 0], O = [-2, 3, 4];
const world = p => O.map((x, c) => u[c] * p[0] + v[c] * p[1] + n[c] * p[2] + x);
const records = [];
for (const count of [2, 3, 8]) for (const curved of [false, true]) {
  const sections = Array.from({ length: count }, (_, i) => { const h = i / (count - 1); return { profile: curved ? circle(1 + h) : square(1 + h), frame: { origin: world([2 * h, h, h]), xAxis: [...u], yAxis: [...v] } }; });
  const controls = sections.map((_, i) => { const h = i / (count - 1); return world([(curved ? 1 + h : 0) + 2 * h, h, h]); });
  const guide = { kind: 'nurbs', degree: 1, knots: [0, 0, ...Array.from({ length: count - 2 }, (_, i) => i + 1), count - 1, count - 1], controlPoints: controls };
  const input = { id: 'L', name: 'L', sections, guide }; let outcome;
  try { const made = loftSolid(input); outcome = { returned: { faces: made.brep.faces.length, mass: made.mass(1) } }; }
  catch (e) { outcome = { threw: { name: e.name, code: e.code, message: e.message } }; }
  records.push({ sectionCount: count, profile: curved ? 'circle' : 'polygon', input, expected: { volume: curved ? 7 * Math.PI / 3 : 7 / 3 }, outcome });
  console.log(JSON.stringify({ sectionCount: count, profile: curved ? 'circle' : 'polygon', outcome }));
}
writeFileSync(new URL('./baseline-results.json', import.meta.url), JSON.stringify({ node: process.version, status: 'reproduced', records }, null, 2) + '\n');

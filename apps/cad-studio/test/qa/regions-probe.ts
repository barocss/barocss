// QA probe: one sketch with overlapping closed shapes (what the sketch builder makes when a second shape
// overlaps the first without being inside it): the extruded volume vs the union of the areas.
import { evaluateDoc } from '../../src/engine/evaluate';
import { emptyDoc, withNode } from '../../src/engine/doc';
import { profileOf } from '../../src/sketch/loops';
import type { DisplayMesh } from '../../src/engine/mesh';
const meshVol = (m: DisplayMesh) => { let v = 0; const p = m.positions, i = m.indices; for (let t = 0; t < i.length; t += 3) { const a = i[t] * 3, b = i[t + 1] * 3, c = i[t + 2] * 3; v += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6; } return v; };
const lens = (r: number, d: number) => 2 * r * r * Math.acos(d / (2 * r)) - d / 2 * Math.sqrt(4 * r * r - d * d);
const seg = (r: number, h: number) => r * r * Math.acos(h / r) - h * Math.sqrt(r * r - h * h);
const cases: [string, unknown[], number][] = [
  ['two circles r10, centres 12 apart', [{ kind: 'circle', c: [0, 0], r: 10 }, { kind: 'circle', c: [12, 0], r: 10 }], 2 * Math.PI * 100 - lens(10, 12)],
  ['two circles r10, centres 25 apart (disjoint)', [{ kind: 'circle', c: [0, 0], r: 10 }, { kind: 'circle', c: [25, 0], r: 10 }], 2 * Math.PI * 100],
  ['rect 40x20 + circle r5 at (42,10) over the right edge', [{ kind: 'rectangle', a: [0, 0], b: [40, 20] }, { kind: 'circle', c: [42, 10], r: 5 }], 800 + Math.PI * 25 - seg(5, 2)],
  ['rect 40x20 + circle r5 at (20,21) over the top edge', [{ kind: 'rectangle', a: [0, 0], b: [40, 20] }, { kind: 'circle', c: [20, 21], r: 5 }], 800 + Math.PI * 25 - seg(5, 1)],
  ['rect 40x20 then circle r5 at (20,19) (classified HOLE)', [{ kind: 'rectangle', a: [0, 0], b: [40, 20] }, { kind: 'circle', c: [20, 19], r: 5 }], 800 + Math.PI * 25 - seg(5, 1)],
  ['two rectangles overlapping', [{ kind: 'rectangle', a: [0, 0], b: [10, 10] }, { kind: 'rectangle', a: [5, 5], b: [15, 15] }], 175],
  ['circle then rect overlapping it', [{ kind: 'circle', c: [0, 0], r: 10 }, { kind: 'rectangle', a: [5, -3], b: [20, 3] }], Math.PI * 100 + 90 - (/* rect part inside circle */ (() => { let a = 0; const n = 20000; for (let k = 0; k < n; k++) { const y = -3 + 6 * (k + 0.5) / n; a += Math.max(0, Math.sqrt(100 - y * y) - 5) * 6 / n; } return a; })())],
];
for (const [name, shapes, area] of cases) {
  let p: ReturnType<typeof profileOf>;
  // (Every shape's first point inside another leaves no outer loop: profileOf throws, see REPORT C1.)
  try { p = profileOf(shapes as never); } catch (e) { console.log(JSON.stringify({ name, threw: String(e) })); continue; }
  if ('error' in p) { console.log(JSON.stringify({ name, error: p.error })); continue; }
  const role = p.node.holes ? 'hole' : p.node.regions ? 'region' : 'single';
  const r = evaluateDoc(withNode(withNode(emptyDoc(), p.node), { kind: 'extrude', sketch: 0, height: 5 }), 1);
  console.log(JSON.stringify(r.ok ? { name, role, expected: +(area * 5).toFixed(2), kernel: r.bodies.map(b => +(b.volumeMM3 ?? NaN).toFixed(2)), mesh: r.bodies.map(b => +meshVol(b.mesh).toFixed(2)), bodies: r.bodies.length, faces: r.bodies.map(b => b.mesh.faces.length) } : { name, role, refused: r.error.title, detail: r.error.detail }));
}

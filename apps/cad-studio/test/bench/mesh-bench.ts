// One mesh body through the studio's path, step by step: read the file, make it a B-rep, show it, upload and
// pick it, a Boolean with a box and a split, the saved and sent sizes, STL out. Each step prints a JSON line
// as it ends (time, heap, sizes, or the error it stopped at), so a step that hangs is told by the runner.
// Run through scripts/bench-mesh.mjs (one fixture per process, for its peak memory): pnpm bench:mesh.
import { serialize } from 'node:v8';
import { booleanPolyhedra, brepFromTriangles, brepMassProperties, CadPartLimits, encodeBinaryStl, readStl, type Brep } from '@barocss/cad';
import { bodyMesh, type DisplayMesh } from '../../src/engine/mesh';
import { meshInMM } from '../../src/engine/meshImport';
import { prepareGeometry, rayTriangles, type PreparedGeometry } from '../../../../packages/barocss-gpu/src/viewer/geometry';
import { addBox, fixtures, random } from './mesh-fixtures';

const name = process.argv[2], make = fixtures().get(name);
if (!make) { console.error(`unknown fixture ${name}: ${[...fixtures().keys()].join(', ')}`); process.exit(2); }

let peakHeap = 0;
function step<T>(label: string, run: () => T, report: (value: T) => Record<string, unknown> = () => ({})): T | undefined {
  const t0 = performance.now();
  try {
    const value = run(), ms = performance.now() - t0, heap = process.memoryUsage().heapUsed;
    peakHeap = Math.max(peakHeap, heap);
    console.log(JSON.stringify({ step: label, ok: true, ms: Math.round(ms), heapMB: Math.round(heap / 2 ** 20), ...report(value) }));
    return value;
  } catch (cause) {
    console.log(JSON.stringify({ step: label, ok: false, ms: Math.round(performance.now() - t0), error: String(cause instanceof Error ? `${cause.name}: ${cause.message}` : cause).slice(0, 300) }));
    return undefined;
  }
}
const skip = (label: string, why: string) => console.log(JSON.stringify({ step: label, ok: false, skipped: true, error: why }));

/** A closed box (two triangles a side) as a mesh B-rep. */
function boxBrep(id: string, lo: readonly number[], hi: readonly number[]): Brep {
  const c = [0, 1, 2].map(k => (lo[k] + hi[k]) / 2), pos: number[] = [], idx: number[] = [];
  addBox(pos, idx, [0, 0, 0], 1);
  for (let v = 0; v < pos.length; v += 3) for (let k = 0; k < 3; k++) pos[v + k] = c[k] + pos[v + k] * (hi[k] - lo[k]) / 2;
  return brepFromTriangles(pos, idx, { id });
}

const fixture = step('generate', make, f => ({ triangles: f.indices.length / 3, vertices: f.positions.length / 3 }))!;
const triangles = fixture.indices.length / 3;
// The file as the user drops it: a binary STL (triangle soup, so the studio welds it).
const file = step('write STL file', () => encodeBinaryStl(fixture.positions, fixture.indices, name), b => ({ bytes: b.length }))!;
const soup = step('readStl', () => readStl(file), p => ({ vertices: p.length / 3 }));
const welded = soup && step('weld to mm (studio)', () => meshInMM({ positions: soup, indices: null }, 'mm'), m => ({ vertices: m.positions.length / 3 }));
// The studio's mesh feature refuses more than CadPartLimits.meshTriangles; the harness goes past it to see what follows.
console.log(JSON.stringify({ step: 'studio limit', ok: triangles <= CadPartLimits.meshTriangles, info: true, error: triangles <= CadPartLimits.meshTriangles ? undefined : `${triangles} triangles > CadPartLimits.meshTriangles ${CadPartLimits.meshTriangles} (raised in this harness only)` }));
const brep = welded && step('brepFromTriangles', () => brepFromTriangles(welded.positions, welded.indices, { id: 'm', maximumTriangles: 4_000_000 }), b => ({ faces: b.faces.length, edges: b.edges.length, vertices: b.vertices.length }));
const display: DisplayMesh | undefined = brep ? step('display mesh (bodyMesh)', () => bodyMesh(brep, 0, 8), m => ({ triangles: m.indices.length / 3, vertices: m.positions.length / 3, faces: m.faces.length, edgeSegments: m.edgeLines.length / 6 })) : (skip('display mesh (bodyMesh)', 'no B-rep'), undefined);
let gpu: PreparedGeometry | undefined;
if (display) {
  gpu = step('GPU geometry (prepare)', () => prepareGeometry({ positions: display.positions, normals: display.normals, indices: display.indices }),
    g => ({ uploadMB: +((g.positions.byteLength + g.normals.byteLength + g.colors.byteLength + (g.indices?.byteLength ?? 0) + display.edgeLines.byteLength) / 2 ** 20).toFixed(1) }));
  if (gpu) {
    const g = gpu, rnd = random(7), rays = 200;
    step('pick (BVH, first ray)', () => rayTriangles(g, [0, 0, 200], [0.01, 0.01, -1]), hit => ({ hit: !!hit }));
    step(`pick (${rays} rays)`, () => { let hits = 0; for (let k = 0; k < rays; k++) { const a = rnd() * 2 * Math.PI; if (rayTriangles(g, [120 * Math.cos(a), 120 * Math.sin(a), 30 * (rnd() - 0.5)], [-Math.cos(a), -Math.sin(a), 0])) hits++; } return hits; }, hits => ({ hits }));
  }
} else skip('GPU geometry (prepare)', 'no display mesh');
// (Saved as the studio saves a document: JSON.stringify(doc, null, 2), a number a line.)
if (welded) step('save (.bcad mesh node JSON)', () => JSON.stringify({ kind: 'mesh', name: `${name}.stl`, unit: 'mm', positions: welded.positions, indices: welded.indices }, null, 2).length, n => ({ MB: +(n / 2 ** 20).toFixed(2) }));
if (display) {
  step('wire (display mesh, structured clone)', () => serialize({ key: 'm', family: 'planar', mesh: display }).length, n => ({ MB: +(n / 2 ** 20).toFixed(2) }));
  step('STL export', () => encodeBinaryStl(display.positions, display.indices, name).length, n => ({ MB: +(n / 2 ** 20).toFixed(2) }));
}
// (MESH_BOOLEANS=both|union|split|none; by default not tried past 50k triangles: a 5k mesh's union already takes about a minute.)
const booleans = process.env.MESH_BOOLEANS ?? (triangles > 50_000 ? 'none' : 'both');
if (booleans === 'none' && !process.env.MESH_BOOLEANS) { skip('union with a box', 'not tried past 50k triangles (MESH_BOOLEANS=both to force)'); skip('split at y = mid (one side)', 'not tried past 50k triangles'); }
if (brep && booleans !== 'none') {
  // A box through the ring's wall (union), and half the body cut away (a split at y = 0, one side).
  const b = brep, xs = welded!.positions;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < xs.length; v += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], xs[v + k]); hi[k] = Math.max(hi[k], xs[v + k]); }
  const mid = [0, 1, 2].map(k => (lo[k] + hi[k]) / 2), span = [0, 1, 2].map(k => hi[k] - lo[k]);
  if (booleans !== 'split') step('union with a box', () => booleanPolyhedra(b, boxBrep('box', [hi[0] - 0.15 * span[0], mid[1] - 0.1 * span[1], mid[2] - 0.6 * span[2]], [hi[0] + 0.1 * span[0], mid[1] + 0.1 * span[1], mid[2] + 0.6 * span[2]]), 'union', { id: 'u' }), r => ({ faces: r.faces.length, volume: +brepMassProperties(r, 1000).volumeMM3.toFixed(2) }));
  if (booleans !== 'union') step('split at y = mid (one side)', () => booleanPolyhedra(b, boxBrep('half', [lo[0] - 1, mid[1] + 1e-3 * span[1], lo[2] - 1], [hi[0] + 1, hi[1] + 1, hi[2] + 1]), 'difference', { id: 's' }), r => ({ faces: r.faces.length, volume: +brepMassProperties(r, 1000).volumeMM3.toFixed(2) }));
} else if (booleans !== 'none') { skip('union with a box', 'no B-rep'); skip('split at y = mid (one side)', 'no B-rep'); }
console.log(JSON.stringify({ step: 'end', ok: true, info: true, peakHeapMB: Math.round(peakHeap / 2 ** 20), maxRSSMB: Math.round(process.resourceUsage().maxRSS / 1024) }));

// G23's data side, A (the S0 in decisions-outer.md, with the GPU lane's additions): a print's layers, for display —
// no slicer, no toolpaths (README §4). The part is turned so its build direction is +Z and set on the bed (its lowest
// point at z 0): the turn and offset are given as a column-major 4×4 (model → bed). The GPU lane draws "printed up to
// layer k" as the model in the bed frame cut by one plane at the layer's top; this gives, on demand and cached, a
// layer's closed contours (the plane through the display meshes, outer loops anticlockwise and holes clockwise), its
// overhang (AM2's rule, the overhanging triangles its band crosses) and its support (AM4's columns spanning it), both
// as merged polygons in the contours' winding; and once, in the summary, every support column (its footprint and its z
// range) for the GPU lane to extrude and clip. The columns are AM4's own — from each overhanging triangle's centroid
// straight down (K2 rays) to the part or the bed — so their volume is AM4's support volume for the direction.
import { booleanPolygons, rayHit, triangleBvh, type TriangleBvh } from '@barocss/cad';
import type { DisplayMesh } from '../engine/mesh';

export const PRINT_LAYERS_VERSION = 'print-layers-v1';
type Vec3 = [number, number, number];
type XY = [number, number];
/** A closed loop on a layer: x, y pairs flat (bed mm), at the layer's z; holes clockwise. */
export interface LayerLoop { points: Float64Array; hole: boolean }
export interface PrintLayer { k: number; z: number; contours: LayerLoop[]; overhang: LayerLoop[]; support: LayerLoop[] }
/** An AM4 support column: its footprint (the overhanging triangle projected on the bed, anticlockwise, x, y flat) from z0 up to z1. */
export interface SupportColumn { footprint: Float64Array; z0: number; z1: number }
export interface PrintLayers {
  version: typeof PRINT_LAYERS_VERSION;
  direction: Vec3; directionSource: 'given' | 'default';
  /** Model → bed, column-major: the turn taking the direction to +Z, then down onto the bed. */
  modelToBed: number[];
  layerMM: { mm: number; basis: 'set' | 'estimate' };
  limit: { deg: number; basis: 'set' | 'estimate' };
  count: number; height: number;
  supportColumns: SupportColumn[];
  supportVolumeMM3: number;
  /** The contours are the display meshes' (to their chord), not the exact surfaces'. */
  basis: 'display mesh';
  /** A layer, worked out on first asking and kept. */
  layer(k: number): PrintLayer;
}

const cross = (a: readonly number[], b: readonly number[]): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v: readonly number[]): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
/** The bed frame's axes: u, v across the bed, b up (right-handed); +Z stays as it is. */
function axesOf(b: Vec3): [Vec3, Vec3, Vec3] {
  if (Math.abs(b[0]) < 1e-15 && Math.abs(b[1]) < 1e-15 && b[2] > 0) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const ref = Math.abs(b[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], u = norm(cross(ref, b)), v = cross(b, u);
  return [u, v, b];
}
const CHUNK = 64;

/** The layers of the bodies printed along `direction` (unset: +Z, said), `layerHeight` thick, mm (unset: 0.2, an estimate); overhangs past `overhangLimit` degrees from the vertical supported. */
export function printLayers(meshes: readonly DisplayMesh[], o: { layerHeight?: number; direction?: readonly number[]; overhangLimit?: number } = {}): PrintLayers {
  const direction = norm(o.direction ?? [0, 0, 1]), [u, v, b] = axesOf(direction);
  const h = o.layerHeight ?? 0.2, limit = o.overhangLimit ?? 45, s = Math.sin(limit * Math.PI / 180);
  // (Every body's vertices in the bed frame, welded by position so faces' edges meet; the triangles over all of them.)
  const P: number[] = [], I: number[] = [], weld = new Map<string, number>();
  let low = Infinity;
  for (const m of meshes) for (let i = 0; i < m.positions.length; i += 3) low = Math.min(low, m.positions[i] * b[0] + m.positions[i + 1] * b[1] + m.positions[i + 2] * b[2]);
  for (const m of meshes) {
    const ids: number[] = [];
    for (let i = 0; i < m.positions.length; i += 3) {
      const x = m.positions[i], y = m.positions[i + 1], z = m.positions[i + 2], key = `${x},${y},${z}`;
      let id = weld.get(key);
      if (id === undefined) { id = P.length / 3; weld.set(key, id); P.push(x * u[0] + y * u[1] + z * u[2], x * v[0] + y * v[1] + z * v[2], x * b[0] + y * b[1] + z * b[2] - low); }
      ids.push(id);
    }
    for (const k of m.indices) I.push(ids[k]);
  }
  let top = 0; for (let i = 2; i < P.length; i += 3) top = Math.max(top, P[i]);
  const count = Math.max(1, Math.ceil(top / h - 1e-9)), nt = I.length / 3;
  const modelToBed = [u[0], v[0], b[0], 0, u[1], v[1], b[1], 0, u[2], v[2], b[2], 0, 0, 0, -low, 1].map(x => x + 0);
  // (Triangles by the 64-layer chunks their z-range spans: a layer looks only at its chunk's.)
  const zmin = new Float64Array(nt), zmax = new Float64Array(nt), chunks: number[][] = Array.from({ length: Math.ceil(count / CHUNK) + 1 }, () => []);
  for (let t = 0; t < nt; t++) {
    const a = P[3 * I[3 * t] + 2], c = P[3 * I[3 * t + 1] + 2], d = P[3 * I[3 * t + 2] + 2];
    zmin[t] = Math.min(a, c, d); zmax[t] = Math.max(a, c, d);
    const k0 = Math.max(0, Math.floor((zmin[t] / h - 0.5) / CHUNK)), k1 = Math.min(chunks.length - 1, Math.floor((zmax[t] / h + 0.5) / CHUNK));
    for (let c2 = k0; c2 <= k1; c2++) chunks[c2].push(t);
  }
  // (AM4's support columns: each overhanging triangle's projected area from its centroid down to the part or the bed.)
  const Pb = Float64Array.from(P), Ib = Uint32Array.from(I), bvh: TriangleBvh = triangleBvh(Pb, Ib);
  const overhanging: number[] = [], columns: SupportColumn[] = [];
  let supportVolume = 0;
  for (let t = 0; t < nt; t++) {
    const a = 3 * I[3 * t], e = 3 * I[3 * t + 1], f = 3 * I[3 * t + 2];
    const n = cross([P[e] - P[a], P[e + 1] - P[a + 1], P[e + 2] - P[a + 2]], [P[f] - P[a], P[f + 1] - P[a + 1], P[f + 2] - P[a + 2]]), twice = Math.hypot(n[0], n[1], n[2]);
    if (!(twice > 0)) continue;
    const nb = n[2] / twice;
    if (!(-nb > s + 1e-12)) continue;
    const c: Vec3 = [(P[a] + P[e] + P[f]) / 3, (P[a + 1] + P[e + 1] + P[f + 1]) / 3, (P[a + 2] + P[e + 2] + P[f + 2]) / 3];
    if (c[2] < 1e-6) continue;
    overhanging.push(t);
    const L = Math.min(rayHit(bvh, c, [0, 0, -1]), c[2]);
    supportVolume += (twice / 2) * -nb * L;
    columns.push({ footprint: Float64Array.from(ccw([[P[a], P[a + 1]], [P[e], P[e + 1]], [P[f], P[f + 1]]]).flat()), z0: c[2] - L, z1: c[2] });
  }
  const cache = new Map<number, PrintLayer>();
  const layer = (k: number): PrintLayer => {
    const hit = cache.get(k); if (hit) return hit;
    if (!(Number.isInteger(k) && k >= 0 && k < count)) throw new RangeError(`no layer ${k} (0 to ${count - 1})`);
    const z = (k + 0.5) * h, list = chunks[Math.floor(k / CHUNK)] ?? [];
    const out: PrintLayer = { k, z, contours: contoursAt(P, I, list, zmin, zmax, z), overhang: merged(P, I, overhanging.filter(t => zmax[t] >= z - h / 2 && zmin[t] <= z + h / 2)), support: merged(P, I, overhanging.filter((_, j) => columns[j].z0 <= z && z <= columns[j].z1)) };
    cache.set(k, out);
    return out;
  };
  return {
    version: PRINT_LAYERS_VERSION, direction, directionSource: o.direction ? 'given' : 'default', modelToBed,
    layerMM: { mm: h, basis: o.layerHeight !== undefined ? 'set' : 'estimate' }, limit: { deg: limit, basis: o.overhangLimit !== undefined ? 'set' : 'estimate' },
    count, height: top, supportColumns: columns, supportVolumeMM3: supportVolume, basis: 'display mesh', layer,
  };
}

const signed = (p: readonly XY[]) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; };
const ccw = (p: XY[]): XY[] => signed(p) < 0 ? p.reverse() : p;
/** Whether a point is inside a loop (even–odd). */
function inside(pt: XY, loop: readonly XY[]): boolean {
  let c = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) { const a = loop[i], b = loop[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; }
  return c;
}
/** Loops as the layer gives them: nesting by even–odd, outer anticlockwise, holes clockwise. */
function wound(loops: XY[][]): LayerLoop[] {
  return loops.filter(l => l.length >= 3 && Math.abs(signed(l)) > 1e-12).map(l => {
    const depth = loops.filter(o => o !== l && o.length >= 3 && inside(l[0], o)).length, hole = depth % 2 === 1, a = signed(l);
    const pts = (hole ? a > 0 : a < 0) ? [...l].reverse() : l;
    return { points: Float64Array.from(pts.flat()), hole };
  });
}

/** The plane z through the triangles (by their welded vertices): a segment a crossing triangle, stitched by the edges crossed. */
function contoursAt(P: readonly number[], I: readonly number[], list: readonly number[], zmin: Float64Array, zmax: Float64Array, z: number): LayerLoop[] {
  const next = new Map<string, string>(), at = new Map<string, XY>();
  const point = (i: number, j: number): string => {
    const key = i < j ? `${i}:${j}` : `${j}:${i}`;
    if (!at.has(key)) { const a = P[3 * i + 2], c = P[3 * j + 2], t = (z - a) / (c - a); at.set(key, [P[3 * i] + t * (P[3 * j] - P[3 * i]), P[3 * i + 1] + t * (P[3 * j + 1] - P[3 * i + 1])]); }
    return key;
  };
  for (const t of list) {
    if (!(zmin[t] <= z && z <= zmax[t])) continue;
    const v = [I[3 * t], I[3 * t + 1], I[3 * t + 2]], up = v.map(i => P[3 * i + 2] >= z);
    const crossings: string[] = [];
    // (Along the triangle's own winding: the segment goes from the edge it enters the region below by to the one it leaves by.)
    for (let e = 0; e < 3; e++) { const i = v[e], j = v[(e + 1) % 3]; if (up[e] !== up[(e + 1) % 3]) crossings.push((up[e] ? 'd' : 'u') + point(i, j)); }
    if (crossings.length !== 2) continue;
    const from = crossings.find(c => c[0] === 'd')!.slice(1), to = crossings.find(c => c[0] === 'u')!.slice(1);
    next.set(from, to);
  }
  const loops: XY[][] = [], seen = new Set<string>();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop: XY[] = []; let k: string | undefined = start;
    while (k !== undefined && !seen.has(k)) { seen.add(k); loop.push(at.get(k)!); k = next.get(k); }
    if (k === start) loops.push(loop);
  }
  return wound(loops);
}

/**
 * Triangles' footprints merged: each anticlockwise in plan, the edges used once walked into loops (a connected patch is
 * one region), then the regions whose boxes meet united by the kernel's exact planar Boolean.
 */
function merged(P: readonly number[], I: readonly number[], tris: readonly number[]): LayerLoop[] {
  if (!tris.length) return [];
  const edges = new Map<string, [number, number]>();
  for (const t of tris) {
    let v = [I[3 * t], I[3 * t + 1], I[3 * t + 2]];
    const area = signed(v.map(i => [P[3 * i], P[3 * i + 1]] as XY)); if (Math.abs(area) < 1e-12) continue;
    if (area < 0) v = [v[0], v[2], v[1]];
    for (let e = 0; e < 3; e++) { const a = v[e], c = v[(e + 1) % 3], back = `${c}>${a}`; if (edges.has(back)) edges.delete(back); else edges.set(`${a}>${c}`, [a, c]); }
  }
  const from = new Map<number, number>(); for (const [a, c] of edges.values()) from.set(a, c);
  const loops: XY[][] = [], used = new Set<number>();
  for (const s of from.keys()) {
    if (used.has(s)) continue;
    const loop: XY[] = []; let k: number | undefined = s;
    while (k !== undefined && !used.has(k)) { used.add(k); loop.push([P[3 * k], P[3 * k + 1]]); k = from.get(k); }
    if (k === s && loop.length >= 3) loops.push(loop);
  }
  const regions = wound(loops);
  // (Overlapping patches — one overhang above another — united exactly; apart, they stay as they are.)
  const outers = regions.filter(r => !r.hole);
  if (outers.length < 2) return regions;
  const box = (r: LayerLoop) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let i = 0; i < r.points.length; i += 2) { x0 = Math.min(x0, r.points[i]); x1 = Math.max(x1, r.points[i]); y0 = Math.min(y0, r.points[i + 1]); y1 = Math.max(y1, r.points[i + 1]); } return [x0, y0, x1, y1]; };
  const boxes = outers.map(box), meet = boxes.some((a, i) => boxes.some((c, j) => j > i && a[0] < c[2] && c[0] < a[2] && a[1] < c[3] && c[1] < a[3]));
  if (!meet) return regions;
  const xy = (r: LayerLoop): XY[] => Array.from({ length: r.points.length / 2 }, (_, i) => [r.points[2 * i], r.points[2 * i + 1]] as XY);
  const polys = outers.map(o => ({ outer: xy(o), holes: regions.filter(r => r.hole && inside(xy(r)[0], xy(o))).map(xy) }));
  const united = booleanPolygons(polys, [], 'union');
  return united.flatMap(p => [{ points: Float64Array.from(p.outer.flat()), hole: false }, ...p.holes.map(hh => ({ points: Float64Array.from(hh.flat()), hole: true }))]);
}

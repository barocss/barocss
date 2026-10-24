// Splitting a part too big for the printer's bed (AM6, O51): along the one axis that needs it into the fewest even
// pieces that each fit (AM1's bed-fit: the build height along the print direction, the two other extents sorted
// against the bed's, an in-plane turn allowed), with connectors on each cut face — dowels (a separate pin, a bore in
// both pieces) or plugs (the pin made one with the lower piece, a bore in the upper) — each bore at the given radial
// fit and `length/2 + fit` deep, each placed at least d/2 + fit + wall inside the cut face. Built from existing
// features only (split, hole, sketch + extrude, union), appended as one change.
import { withNode, type BodyRef, type ModelNode, type StudioDoc } from '../engine/doc';
import { evaluatePart, type BodyResult } from '../engine/evaluate';
import { bodyKeyFor } from '../engine/ids';
import { printerProfile, processProfile } from '../library/materials';
import { refOf } from '../app/bodyRef';
import type { DisplayMesh, Vec3 } from '../engine/mesh';
import { refusal } from '../engine/refusal';

export type SplitCode = 'NOT_NEEDED' | 'ONE_BODY' | 'NO_PRINTER' | 'DIRECTION_NOT_AXIS' | 'TOO_BIG_TWO_WAYS' | 'NO_ROOM' | 'BAD_CONNECTOR';
export interface SplitOptions { connector: 'dowel' | 'plug'; d: number; length: number; count?: number; fit?: number; wall?: number }
export interface Connector { cut: number; at: Vec3; boreRadius: number; pinRadius: number; depth: number; pin: string | null }
export interface SplitReport { axis: 'x' | 'y' | 'z'; cuts: number[]; pieces: { key: string; box: { min: Vec3; max: Vec3 }; fits: boolean }[]; connectors: Connector[]; fit: number; bed: [number, number, number] }

const AXES = ['x', 'y', 'z'] as const;
/** AM1's bed-fit: the height along the build axis within the build height, the two others sorted within the bed's. */
export function fitsBed(ext: readonly number[], up: number, bed: readonly number[]): boolean {
  const flat = [0, 1, 2].filter(k => k !== up).map(k => ext[k]).sort((a, b) => b - a), b2 = [bed[0], bed[1]].sort((a, b) => b - a);
  return ext[up] <= bed[2] + 1e-9 && flat[0] <= b2[0] + 1e-9 && flat[1] <= b2[1] + 1e-9;
}
const extentOf = (m: DisplayMesh) => [0, 1, 2].map(k => m.bounds.max[k] - m.bounds.min[k]);
/** The print direction's axis (+Z when none): an axis-aligned one only. */
function upAxis(doc: StudioDoc): number {
  const d = doc.print?.direction ?? [0, 0, 1], k = d.findIndex(x => Math.abs(x) > 1e-9);
  if (k < 0 || d.some((x, i) => i !== k && Math.abs(x) > 1e-9)) throw refusal('DIRECTION_NOT_AXIS', `the print direction (${d.join(', ')}) is not along X, Y or Z: a split for the bed takes an axis-aligned one`);
  return k;
}

// ——— the cut face: its triangles in the plane, and how far a point is inside it
interface Region { tris: number[][]; edges: [number[], number[]][]; lo: number[]; hi: number[] }
/** A cut face's triangles and boundary in its plane's two coordinates (`a`, `b`: the other axes). */
function regionOf(m: DisplayMesh, face: number, a: number, b: number): Region {
  const tris: number[][] = [], count = new Map<string, { p: number[]; q: number[]; n: number }>(), lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  for (let t = 0; t < m.indices.length; t += 3) {
    if (m.faceOfVertex[m.indices[t]] !== face) continue;
    const pts = [0, 1, 2].map(j => { const v = m.indices[t + j]; return [m.positions[v * 3 + a], m.positions[v * 3 + b]]; });
    tris.push(pts.flat());
    for (const p of pts) { lo[0] = Math.min(lo[0], p[0]); lo[1] = Math.min(lo[1], p[1]); hi[0] = Math.max(hi[0], p[0]); hi[1] = Math.max(hi[1], p[1]); }
    for (let j = 0; j < 3; j++) {
      const p = pts[j], q = pts[(j + 1) % 3], key = [p, q].map(x => `${x[0].toFixed(4)},${x[1].toFixed(4)}`).sort().join('|'), e = count.get(key);
      if (e) e.n++; else count.set(key, { p, q, n: 1 });
    }
  }
  return { tris, edges: [...count.values()].filter(e => e.n === 1).map(e => [e.p, e.q]), lo, hi };
}
function inTriangle(t: number[], x: number, y: number): boolean {
  const d1 = (x - t[2]) * (t[1] - t[3]) - (t[0] - t[2]) * (y - t[3]), d2 = (x - t[4]) * (t[3] - t[5]) - (t[2] - t[4]) * (y - t[5]), d3 = (x - t[0]) * (t[5] - t[1]) - (t[4] - t[0]) * (y - t[1]);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}
/** How far (x, y) is inside the region: its distance to the boundary, or −1 outside. */
function depthIn(r: Region, x: number, y: number): number {
  if (!r.tris.some(t => inTriangle(t, x, y))) return -1;
  let d = Infinity;
  for (const [p, q] of r.edges) {
    const ex = q[0] - p[0], ey = q[1] - p[1], L = ex * ex + ey * ey, s = L ? Math.max(0, Math.min(1, ((x - p[0]) * ex + (y - p[1]) * ey) / L)) : 0;
    d = Math.min(d, Math.hypot(x - p[0] - s * ex, y - p[1] - s * ey));
  }
  return d;
}
const r2 = (v: number) => Math.round(v * 100) / 100;
/** The most room anywhere in the region: the deepest point on a 0.25 mm grid (what a refusal reports). */
function deepest(r: Region): number {
  let best = 0;
  for (let x = r.lo[0]; x <= r.hi[0] + 1e-9; x += 0.25) for (let y = r.lo[1]; y <= r.hi[1] + 1e-9; y += 0.25) best = Math.max(best, depthIn(r, x, y));
  return best;
}
/**
 * `count` points at least `need` inside the region, spread along its longer extent: first evenly along the line through
 * its middle; a point that is not that far in is looked for on a 1 mm grid across the region at its spot's share.
 */
function connectorPoints(r: Region, count: number, need: number): number[][] | { room: number } {
  const long = r.hi[0] - r.lo[0] >= r.hi[1] - r.lo[1] ? 0 : 1, other = 1 - long, out: number[][] = [];
  for (let i = 0; i < count; i++) {
    const s = r.lo[long] + (r.hi[long] - r.lo[long]) * (i + 1) / (count + 1), mid = (r.lo[other] + r.hi[other]) / 2;
    let best: number[] | null = null;
    for (let dt = 0; dt <= r.hi[other] - r.lo[other] && !best; dt += 1) for (const sign of [1, -1]) {
      const t = mid + sign * dt, p = long === 0 ? [r2(s), r2(t)] : [r2(t), r2(s)], d = depthIn(r, p[0], p[1]);
      if (d >= need) { best = p; break; }
    }
    if (!best) return { room: deepest(r) };
    out.push(best);
  }
  return out;
}

/** The split's features appended to the document, and what they make. */
export function planBedSplit(doc: StudioDoc, bodies: readonly BodyResult[], o: SplitOptions): { doc: StudioDoc; report: SplitReport } {
  if (bodies.length !== 1) throw refusal('ONE_BODY', `split for the bed takes a part of one body; this one has ${bodies.length}`);
  const printer = printerProfile(doc.printer);
  if (!printer) throw refusal('NO_PRINTER', 'choose a printer first: the split is for its build volume');
  const count = o.count ?? 2, fit = o.fit ?? processProfile(doc.process ?? printer.process)?.thresholds.fitGap?.value ?? NaN, wall = o.wall ?? 2;
  if (!(o.d > 0 && o.length > 0 && Number.isInteger(count) && count >= 1 && count <= 8 && fit > 0 && wall >= 0)) throw refusal('BAD_CONNECTOR', `a connector needs d > 0, length > 0, 1–8 a cut, fit > 0 and wall ≥ 0 (d ${o.d}, length ${o.length}, count ${count}, fit ${fit}, wall ${wall})`);
  const up = upAxis(doc), bed = printer.buildMM, body = bodies[0], ext = extentOf(body.mesh);
  if (fitsBed(ext, up, bed)) throw refusal('NOT_NEEDED', `the part (${ext.map(r2).join(' × ')} mm) fits ${printer.label} as it is`);
  // (The axis: the build axis when it is too tall, else the longer in-plane one; the fewest even pieces that fit.)
  const flat = [0, 1, 2].filter(k => k !== up), k = ext[up] > bed[2] + 1e-9 ? up : ext[flat[0]] >= ext[flat[1]] ? flat[0] : flat[1];
  let n = 0;
  for (let m = 2; m <= 20; m++) { const e = ext.slice(); e[k] /= m; if (fitsBed(e, up, bed)) { n = m; break; } }
  if (!n) throw refusal('TOO_BIG_TWO_WAYS', `no split along one axis makes ${printer.label}'s pieces: the part (${ext.map(r2).join(' × ')} mm) is too big two ways`);
  const axis = AXES[k], [a, b] = [0, 1, 2].filter(x => x !== k), lo = body.mesh.bounds.min[k], cuts = Array.from({ length: n - 1 }, (_, i) => lo + ext[k] * (i + 1) / n);
  const rPin = o.d / 2, rBore = rPin + fit, depth = o.length / 2 + fit, need = rBore + wall;
  // (The cuts as a chain: each split's upper side split again; then each cut face's connector points, read once all are cut.)
  let out = doc, upper: BodyRef = refOf(body);
  const splits: number[] = [];
  for (const at of cuts) { out = withNode(out, { kind: 'split', parent: upper, at, axis } as ModelNode); splits.push(out.nodes.length - 1); upper = { node: out.nodes.length - 1, side: 'positive' }; }
  const cutDoc = out, cutEval = evaluatePart(cutDoc, 0);
  if (!cutEval.ok) throw refusal('NO_ROOM', 'the part could not be cut');
  const points: number[][][] = [];
  for (const [i, s] of splits.entries()) {
    const lower = cutEval.bodies.find(x => x.key === bodyKeyFor(cutDoc.nodes, s, 'negative'));
    const id = cutDoc.nodes[s].id, f = lower?.mesh.faces.find(x => x.name.split('+').some(nm => nm.startsWith(`${id}.cut`)));
    if (!lower || !f) throw refusal('NO_ROOM', `cut ${i + 1} at ${axis} = ${r2(cuts[i])} has no cut face`);
    const p = connectorPoints(regionOf(lower.mesh, f.index, a, b), count, need);
    if (!Array.isArray(p)) throw refusal('NO_ROOM', `cut ${i + 1} at ${axis} = ${r2(cuts[i])}: no room for ${count} bore${count > 1 ? 's' : ''} of Ø${r2(2 * rBore)} with ${wall} mm of wall (needs ${r2(need)} mm inside the cut face; it has ${r2(Math.max(0, p.room))})`);
    points.push(p);
  }
  // (The features again, now with the bores: each cut's lower piece bored from its top (max side), the upper from its bottom.)
  out = doc; upper = refOf(body);
  const connectors: Connector[] = [], pinRefs: BodyRef[] = [], plugs: { lowerIdx: number; pins: number[] }[] = [];
  const pieceRefs: BodyRef[] = [];
  for (const [i, at] of cuts.entries()) {
    out = withNode(out, { kind: 'split', parent: upper, at, axis } as ModelNode); const s = out.nodes.length - 1;
    let lower: BodyRef = { node: s, side: 'negative' }, top: BodyRef = { node: s, side: 'positive' };
    for (const p of points[i]) {
      if (o.connector === 'dowel') { out = withNode(out, { kind: 'hole', parent: lower, center: [p[0], p[1]], radius: rBore, axis, side: 'max', depth } as ModelNode); lower = { node: out.nodes.length - 1, side: 'solid' }; }
      out = withNode(out, { kind: 'hole', parent: top, center: [p[0], p[1]], radius: rBore, axis, side: 'min', depth } as ModelNode); top = { node: out.nodes.length - 1, side: 'solid' };
    }
    // (The pins: a circle on a plane length/2 below the cut, its normal along the axis, extruded `length`.)
    const pins: number[] = [];
    for (const p of points[i]) {
      const origin: Vec3 = [0, 0, 0]; origin[k] = at - o.length / 2;
      const normal: Vec3 = [0, 0, 0]; normal[k] = 1;
      const xAxis: Vec3 = [0, 0, 0]; xAxis[a] = 1;
      // (The centre in the plane's own frame: u along xAxis, v along normal × xAxis — for Y that is −Z, so projected, not copied.)
      const w: Vec3 = [0, 0, 0]; w[a] = p[0]; w[b] = p[1];
      const v: Vec3 = [normal[1] * xAxis[2] - normal[2] * xAxis[1], normal[2] * xAxis[0] - normal[0] * xAxis[2], normal[0] * xAxis[1] - normal[1] * xAxis[0]];
      const uv = [w[0] * xAxis[0] + w[1] * xAxis[1] + w[2] * xAxis[2], w[0] * v[0] + w[1] * v[1] + w[2] * v[2]];
      out = withNode(out, { kind: 'sketch', profile: 'circle', center: uv, radius: rPin, plane: { origin, normal, xAxis } } as ModelNode);
      out = withNode(out, { kind: 'extrude', sketch: out.nodes.length - 1, height: o.length } as ModelNode);
      pins.push(out.nodes.length - 1);
      const c: Vec3 = [0, 0, 0]; c[k] = r2(at); c[a] = p[0]; c[b] = p[1];
      connectors.push({ cut: i, at: c, boreRadius: rBore, pinRadius: rPin, depth, pin: null });
    }
    if (o.connector === 'plug') { for (const pin of pins) { out = withNode(out, { kind: 'union', left: lower, right: { node: pin, side: 'solid' } } as ModelNode); lower = { node: out.nodes.length - 1, side: 'solid' }; } plugs.push({ lowerIdx: i, pins }); }
    else for (const pin of pins) pinRefs.push({ node: pin, side: 'solid' });
    pieceRefs.push(lower); upper = top;
  }
  pieceRefs.push(upper);
  const done = evaluatePart(out, 0);
  if (!done.ok) throw refusal('NO_ROOM', 'the connectors could not be made');
  const keyOf = (r: BodyRef) => bodyKeyFor(out.nodes, r.node, r.side);
  const pieces = pieceRefs.map(r => { const bd = done.bodies.find(x => x.key === keyOf(r))!; return { key: bd.key, box: { min: [...bd.mesh.bounds.min] as Vec3, max: [...bd.mesh.bounds.max] as Vec3 }, fits: fitsBed(extentOf(bd.mesh), up, bed) }; });
  if (o.connector === 'dowel') connectors.forEach((c, i) => { c.pin = keyOf(pinRefs[i]); });
  return { doc: out, report: { axis, cuts: cuts.map(r2), pieces, connectors, fit, bed: [bed[0], bed[1], bed[2]] } };
}

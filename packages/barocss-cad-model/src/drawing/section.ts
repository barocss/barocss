// In the engine worker: a section, the part cut by the plane square to a view's depth at `at` along it, seen as that
// view with the material in front of the plane taken away (O148 X1: the front, top or right view; section A–A of older
// drawings is the front's — Y = y for the default front from −Y; R14.3b: X = ±y or Y = −y for the others). The kernel's
// split cuts each body the plane crosses (the far side is kept); a body wholly behind the plane stays whole, one wholly
// in front goes. The cut faces (planar faces on the plane) come back as rings in view coordinates, to hatch.
import { evaluateCadPart, outputOf, faceGeometry, projectBrepHiddenLines, tessellateBrep, type Brep, type BrepProjection, type CadPartFeature, type ProjectedCurve, type ProjectedEdge } from '@barocss/cad';
import { clipProjectionOutside, clipRingsOutside, type ViewBreak } from './breaks';
import { bodyKeyOf, toPartDocument, withBeadRetry } from '../engine/part';
import { boughtOutputIds } from '../engine/evaluate';
import type { StudioDoc } from '../engine/doc';
import { sectionFrame, type Orientation } from './views';
export { sectionDepth } from './views';
import type { DrawingSection, SectionViewId, XY } from './types';

/** `ringBodies`: each ring's body (the part's output index: one body hatched the same in every section). */
export type SectionResult = { ok: true; projection: BrepProjection; rings: XY[][]; ringBodies: number[] } | { ok: false; error: string };
/** O148 X1: a section of the drawing and what cutting it gave. */
export type SectionCut = DrawingSection & { result: SectionResult };

/**
 * `skip`: outputs not cut nor drawn — a part's bought elements in its own drawing (O174). `dir` (O178): an aligned
 * section's plane normal — the part cut by the plane dot(p, dir/|dir|) = y, the far side kept, seen along it.
 */
/** `faceOnly` (DR-4): the projection holds only the edges lying on the plane (the cut faces' outlines), its extent theirs. */
export function sectionOf(doc: StudioDoc, y: number, orientation: Orientation = 'y-', view: SectionViewId = 'front', skip?: ReadonlySet<string>, dir?: [number, number, number], faceOnly = false): SectionResult {
  // The depth `d` (unit, away from the viewer): the plane is dot(p, d) = y, the far side (kept) dot(p, d) > y. A principal
  // section's is its view's depth axis (k), cut by the kernel's axis split as it always was; an aligned one's, its own.
  const frame = sectionFrame({ view, ...(dir ? { dir } : {}) }, orientation), { d, principal } = frame;
  const axis = principal ? (['x', 'y', 'z'] as const)[principal.k] : null, at = principal ? principal.sign * y : y;
  try {
    // (The beads the kernel refused found first, so the cut's part leaves them out too.)
    const outputs = withBeadRetry(doc, q => evaluateCadPart(q)).outputs, part = toPartDocument(doc);
    const cuts: CadPartFeature[] = [], keep: string[] = [], body: number[] = [];
    outputs.forEach((o, n) => {
      if (skip?.has(o.id)) return;
      const X = tessellateBrep(o.brep, { segmentsPerQuarter: 4 }).positions;
      let lo = Infinity, hi = -Infinity; for (let i = 0; i < X.length; i += 3) { const v = X[i] * d[0] + X[i + 1] * d[1] + X[i + 2] * d[2]; lo = Math.min(lo, v); hi = Math.max(hi, v); }
      const tol = 1e-6 * Math.max(1, Math.abs(hi), Math.abs(lo));
      if (hi <= y + tol) return; // wholly in front of the plane
      if (lo >= y - tol) { keep.push(o.id); body.push(n); return; } // wholly behind it
      // (The cut keyed by its body — `section_<body key>` — so its faces' and edges' names, and the dimensions on them, stay
      // the same when other bodies come and go before it; item 4.)
      const id = `section_${bodyKeyOf(o.id, doc.nodes).replace(/[^A-Za-z0-9_-]/g, '_')}`.slice(0, 64);
      cuts.push((axis ? { id, kind: 'split', target: o.id, axis, at } : { id, kind: 'split', target: o.id, normal: d, at: y }) as CadPartFeature);
      keep.push(`${id}/${axis ? (principal!.sign > 0 ? 1 : 0) : 1}`); body.push(n);
    });
    if (!keep.length) return { ok: false, error: axis ? `Nothing of the part lies behind ${axis.toUpperCase()} = ${at}.` : `Nothing of the part lies behind the plane at ${y} along [${d.map(x => +x.toFixed(6)).join(', ')}].` };
    const cut = evaluateCadPart({ ...part, features: [...part.features, ...cuts] });
    const breps = keep.map(id => outputOf(cut, id).brep);
    const projection = projectBrepHiddenLines(breps, frame.view);
    const rings: XY[][] = [], ringBodies: number[] = [];
    breps.forEach((b, i) => { for (const r of principal ? cutRings(b, at, projection, principal.k) : planeRings(b, d, y, projection)) { rings.push(r); ringBodies.push(body[i]); } });
    return { ok: true, projection: faceOnly ? onPlane(projection, breps, d, y) : projection, rings, ringBodies };
  } catch (cause) { return { ok: false, error: cause instanceof Error ? cause.message : String(cause) }; }
}
/** O148 X1: every section of the drawing, cut. */
/** `made` (O174): a part's drawing — its bought elements neither cut nor drawn, as its views leave them. */
export function sectionsCut(doc: StudioDoc, list: readonly DrawingSection[], orientation: Orientation = 'y-', made = false): SectionCut[] {
  const skip = made && list.length ? boughtOutputIds(doc) : undefined;
  return list.map(x => ({ ...x, result: x.steps ? offsetSection(doc, x, orientation, skip) : x.half ? halfSection(doc, x, orientation, skip) : sectionOf(doc, x.at, orientation, x.view, skip, x.dir, !!(x.removed || x.revolved)) }));
}

/**
 * DR-4: a section's projection less everything but the cut faces' outlines — the edges of the faces on the plane
 * dot(p, d) = y (by name, and on the plane where their ends or circle say so; the far side's edges and the silhouettes
 * along the cut go). Each kept curve is the kernel's own, so the outline is exact; the extent is the kept curves'.
 */
export function onPlane(pr: BrepProjection, breps: readonly Brep[], d: readonly number[], y: number): BrepProjection {
  const names = new Set<string>(), tol = 1e-6 * Math.max(1, Math.abs(y));
  for (const b of breps) {
    const loops = new Map(b.loops.map(l => [l.id, l])), coedges = new Map(b.coedges.map(c => [c.id, c])), edges = new Map(b.edges.map(e => [e.id, e]));
    for (const face of b.faces) {
      let g; try { g = faceGeometry(face); } catch { continue; }
      if (g.kind !== 'plane' || Math.abs(Math.abs(g.n[0] * d[0] + g.n[1] * d[1] + g.n[2] * d[2]) - 1) > 1e-9 || Math.abs(g.o[0] * d[0] + g.o[1] * d[1] + g.o[2] * d[2] - y) > tol) continue;
      for (const lid of face.loops) for (const cid of loops.get(lid)!.coedges) { const e = edges.get(coedges.get(cid)!.edge); if (e) names.add(e.name ?? e.id); }
    }
  }
  const kept: ProjectedEdge[] = [];
  for (const e of pr.edges) if (names.has(e.name) && (!e.ends || (onIt(e.ends[0], d, y, tol) && onIt(e.ends[1], d, y, tol))) && (!e.circle || (onIt(e.circle.center, d, y, tol) && Math.abs(Math.abs(e.circle.normal[0] * d[0] + e.circle.normal[1] * d[1] + e.circle.normal[2] * d[2]) - 1) <= 1e-9))) kept.push(e);
  const min: [number, number] = [Infinity, Infinity], max: [number, number] = [-Infinity, -Infinity];
  for (const e of kept) for (const p of e.pieces) curveExtent(p.curve, min, max);
  return { right: pr.right, up: pr.up, toward: pr.toward, edges: kept, min: kept.length ? min : [0, 0], max: kept.length ? max : [0, 0] };
}
const onIt = (p: readonly number[], d: readonly number[], y: number, tol: number) => Math.abs(p[0] * d[0] + p[1] * d[1] + p[2] * d[2] - y) <= tol;
const grow = (min: [number, number], max: [number, number], x: number, y: number) => { if (x < min[0]) min[0] = x; if (y < min[1]) min[1] = y; if (x > max[0]) max[0] = x; if (y > max[1]) max[1] = y; };
const growArc = (c: Extract<ProjectedCurve, { kind: 'arc' }>, t: number, min: [number, number], max: [number, number]) => grow(min, max, c.center[0] + c.u[0] * Math.cos(t) + c.v[0] * Math.sin(t), c.center[1] + c.u[1] * Math.cos(t) + c.v[1] * Math.sin(t));
/** A curve's exact extent added to min/max: a line's ends, a polyline's points, an arc's ends and its turning points inside its range. */
function curveExtent(c: ProjectedCurve, min: [number, number], max: [number, number]): void {
  if (c.kind === 'line') { grow(min, max, c.a[0], c.a[1]); grow(min, max, c.b[0], c.b[1]); return; }
  if (c.kind === 'polyline') { for (const p of c.points) grow(min, max, p[0], p[1]); return; }
  const lo = Math.min(c.t0, c.t1), hi = Math.max(c.t0, c.t1);
  growArc(c, lo, min, max); growArc(c, hi, min, max);
  // (x(t) = cx + ux cos t + vx sin t turns where tan t = vx/ux, every π; likewise y.)
  for (const k of [0, 1] as const) { const base = Math.atan2(c.v[k], c.u[k]); for (let t = base + Math.PI * Math.ceil((lo - base) / Math.PI); t < hi; t += Math.PI) if (t > lo) growArc(c, t, min, max); }
}

/**
 * DR-3: an offset (stepped) section, composed of exact single-plane sections: each plane's section kept over its band of
 * the section view's coordinate (the plane at `at` before the first step, at each step's `at` from its `past` on), its
 * cut rings clipped to the band. Every plane is seen along the same depth, so each band is exactly what that plane shows
 * there; no line is drawn at a step.
 */
export function offsetSection(doc: StudioDoc, s: DrawingSection, orientation: Orientation = 'y-', skip?: ReadonlySet<string>): SectionResult {
  const steps = s.steps ?? [], axis: 0 | 1 = s.along === 'vertical' ? 1 : 0, depths = [s.at, ...steps.map(x => x.at)], bounds = [-Infinity, ...steps.map(x => x.past), Infinity];
  const cut = new Map<number, SectionResult>(), parts: { pr: BrepProjection; rings: XY[][]; bodies: number[]; lo: number; hi: number }[] = [];
  for (let i = 0; i < depths.length; i++) {
    const r = cut.get(depths[i]) ?? sectionOf(doc, depths[i], orientation, s.view, skip);
    cut.set(depths[i], r);
    if (!r.ok) return { ok: false, error: `${r.error} (the plane at ${depths[i]})` };
    parts.push({ pr: r.projection, rings: r.rings, bodies: r.ringBodies, lo: bounds[i], hi: bounds[i + 1] });
  }
  return composeSides(parts, axis);
}

/**
 * DR-3: a half section, composed exactly: the section's own projection and cut faces on the cut side of the centreline,
 * the part's uncut view on the other (both seen along the section's depth, so each half is exactly what it shows there).
 */
export function halfSection(doc: StudioDoc, s: DrawingSection, orientation: Orientation = 'y-', skip?: ReadonlySet<string>): SectionResult {
  const h = s.half!, r = sectionOf(doc, s.at, orientation, s.view, skip);
  if (!r.ok) return r;
  let exterior: BrepProjection;
  try {
    const outputs = withBeadRetry(doc, q => evaluateCadPart(q)).outputs, breps: Brep[] = [];
    for (const o of outputs) if (!skip?.has(o.id)) breps.push(o.brep);
    exterior = projectBrepHiddenLines(breps, sectionFrame({ view: s.view }, orientation).view);
  } catch (cause) { return { ok: false, error: cause instanceof Error ? cause.message : String(cause) }; }
  const axis: 0 | 1 = h.line === 'vertical' ? 0 : 1, after = h.cut === 'after';
  return composeSides([
    { pr: r.projection, rings: r.rings, bodies: r.ringBodies, lo: after ? h.at : -Infinity, hi: after ? Infinity : h.at },
    { pr: exterior, rings: [], bodies: [], lo: after ? -Infinity : h.at, hi: after ? h.at : Infinity },
  ], axis);
}

/** Projections (and their rings) each kept over its band [lo, hi] of one view axis, put together: one projection and its rings. */
function composeSides(parts: readonly { pr: BrepProjection; rings: XY[][]; bodies: number[]; lo: number; hi: number }[], axis: 0 | 1): SectionResult {
  const edges: ProjectedEdge[] = [], rings: XY[][] = [], ringBodies: number[] = [], min: [number, number] = [Infinity, Infinity], max: [number, number] = [-Infinity, -Infinity];
  for (const part of parts) {
    // (Kept inside the band: outside (−∞, lo) and outside (hi, ∞); an infinite side needs no cut.)
    const keep: ViewBreak[] = [];
    if (Number.isFinite(part.lo)) keep.push({ axis, from: -Infinity, to: part.lo, gap: 0 });
    if (Number.isFinite(part.hi)) keep.push({ axis, from: part.hi, to: Infinity, gap: 0 });
    const clipped = clipProjectionOutside(part.pr, keep);
    for (const e of clipped.edges) {
      if (e.pieces.length) { edges.push(e); continue; }
      // (An edge on visible ink, piece-less, kept with the band that holds one of its ends.)
      const V = axis === 0 ? part.pr.right : part.pr.up;
      for (const p of e.ends ?? []) { const w = p[0] * V[0] + p[1] * V[1] + p[2] * V[2]; if (w >= part.lo && w <= part.hi) { edges.push(e); break; } }
    }
    const r = keep.length ? clipRingsOutside(part.rings, keep) : { rings: part.rings, kept: part.rings.map((_, k) => k) };
    for (let i = 0; i < r.rings.length; i++) { rings.push(r.rings[i]); ringBodies.push(part.bodies[r.kept[i]] ?? 0); }
    for (const k of [0, 1] as const) {
      const lo = k === axis ? Math.max(part.pr.min[k], part.lo) : part.pr.min[k], hi = k === axis ? Math.min(part.pr.max[k], part.hi) : part.pr.max[k];
      if (lo <= hi) { min[k] = Math.min(min[k], lo); max[k] = Math.max(max[k], hi); }
    }
  }
  const first = parts[0].pr;
  return { ok: true, projection: { right: first.right, up: first.up, toward: first.toward, edges, min, max }, rings, ringBodies };
}

/** The loops of a B-rep's faces on the plane square to axis `k` (1: Y) at `y`, as rings in the projection's view coordinates. */
export function cutRings(brep: Brep, y: number, pr: BrepProjection, k: 0 | 1 | 2 = 1): XY[][] {
  return planeRings(brep, AXES[k], y, pr);
}
const AXES: readonly (readonly [number, number, number])[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
/** The loops of a B-rep's faces on the plane dot(p, d) = y (`d` a unit vector; O178: an aligned section's), as rings in the projection's view coordinates. */
export function planeRings(brep: Brep, d: readonly number[], y: number, pr: BrepProjection): XY[][] {
  const mesh = tessellateBrep(brep, { segmentsPerQuarter: 16 }), samples = new Map(mesh.edges.map(e => [e.edgeId, e.points]));
  const loops = new Map(brep.loops.map(l => [l.id, l])), coedges = new Map(brep.coedges.map(c => [c.id, c]));
  const P = (x: number, yy: number, z: number): XY => [x * pr.right[0] + yy * pr.right[1] + z * pr.right[2], x * pr.up[0] + yy * pr.up[1] + z * pr.up[2]];
  const rings: XY[][] = [];
  for (const face of brep.faces) {
    let g; try { g = faceGeometry(face); } catch { continue; }
    if (g.kind !== 'plane' || Math.abs(Math.abs(g.n[0] * d[0] + g.n[1] * d[1] + g.n[2] * d[2]) - 1) > 1e-9 || Math.abs(g.o[0] * d[0] + g.o[1] * d[1] + g.o[2] * d[2] - y) > 1e-6 * Math.max(1, Math.abs(y))) continue;
    for (const lid of face.loops) {
      const ring: XY[] = [];
      for (const cid of loops.get(lid)!.coedges) {
        const c = coedges.get(cid)!, pts = samples.get(c.edge); if (!pts) continue;
        const run: XY[] = []; for (let k = 0; k < pts.length; k += 3) run.push(P(pts[k], pts[k + 1], pts[k + 2]));
        if (c.sense === 'reversed') run.reverse();
        ring.push(...(ring.length ? run.slice(1) : run));
      }
      if (ring.length >= 3) rings.push(ring);
    }
  }
  return rings;
}

// The cavity t inside a closed body whose faces all meet smoothly (a SubD body; R11.2a, D110): every face's surface
// offset by the wall along its normal, fitted, on the body's own topology — no Boolean (the offset sheets of smooth
// faces meet along the offsets of their shared edges). A NURBS offset is not a NURBS: each face's offset is
// interpolated at the Greville points of a cubic spline space — the face's own knots, each interior one once more (an
// offset is one order less continuous there), refined — on a grid of cells, each fitted on its own and refined, or the
// grid recut, until it is within the target of the exact offset everywhere it is measured; the kernel's cap of 16 × 16
// control points a surface is kept (cells are their own faces). The fit's deviation is reported and is every entity's
// tolerance. Refused by name: a face curving more tightly than the wall (`OFFSET_FOLDS`), a wall meeting another part of
// the body (`WALL_TOO_THIN`), a fit that does not reach the target (`APPROX_TOLERANCE_NOT_MET`), a body this is not for.
import { BrepError, buildBrep, isFacetFace, lineCurve, nurbsOf, type Brep, type BrepFace } from '../brep/brep-core.js';
import { faceGeometry } from '../brep/analytic-boolean.js';
import { curveDomain, curveEvaluator, evaluateCurve, surfaceDomain, surfaceEvaluator } from '../core/math.js';
import { tessellateBrepWithParameters } from '../brep/brep-tessellate.js';
import { evaluateSurfaceCurvature } from '../nurbs/surfaces/local-curvature.js';
import { add, cross, dot, len, scale, sub, unit } from '../core/vec3.js';
import type { Curve, Point, Surface } from '../types.js';

const refuse = (detail: string): never => { throw new BrepError('GEOMETRY', `CAPABILITY: shell: ${detail}`); };
/** An entity's id as a curve's or surface's (an identifier: letters, digits, _ and -). */
const ident = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '_').replace(/^(?=[^A-Za-z_])/, '_');
/** The kernel's most control points a surface direction (math.ts `validateSurface`). */
const MAX_POLES = 16;
/**
 * Below this angle (rad) between two faces' normals along their edge, the edge is smooth: a fitted fillet meets its faces
 * within 1.5e-5 (the pipe tee's rolling ball, at its edges' middles); the offsets' gap there, t times the angle, is
 * counted in the deviation.
 */
const SMOOTH = 1e-4;

export interface OffsetCavityReport {
  /** The largest distance of a fitted face or edge from the exact offset, where measured (mm). */
  readonly deviationMM: number;
  /** The deviation allowed: 1e-6 of the body's size. */
  readonly targetMM: number;
  /** Faces of the cavity (the body's faces, cut into cells where the fit needs it). */
  readonly faces: number;
  /** The tightest convex curvature radius on the body (mm), against the wall. */
  readonly minRadiusMM: number;
}

/** Whether this route takes the body closed: every face an untrimmed NURBS patch or a plane or cylinder, every edge smooth. */
export function smoothClosedBody(body: Brep): boolean { return smoothOffsetBody(body, new Set()); }

/**
 * Whether this route takes the body with the faces named in `open` opened: one closed body; every kept face an untrimmed
 * NURBS patch (offset fitted) or a plane or a circular cylinder however trimmed (offset exactly, R11.2c-1, D112); every
 * edge between two kept faces smooth — the opening may take away the body's sharp edges, as a pipe's open ends do.
 */
export function smoothOffsetBody(body: Brep, open: ReadonlySet<string>): boolean {
  if (body.faces.some(isFacetFace) || body.bodies.length !== 1 || body.shells.some(s => !s.closed)) return false;
  const size = sizeOf(body), kept = new Map<string, Patch | Exact>();
  for (const f of body.faces) { if (f.name && open.has(f.name)) continue; const k = keptFace(body, f, size); if (!k) return false; kept.set(f.id, k); }
  if (!kept.size) return false;
  try { for (const m of meetsOf(body, kept)) if (m.angle > SMOOTH) return false; } catch { return false; }
  return true;
}
/** The largest angle between the kept faces' normals along their edges (smooth, below SMOOTH). */
function largestKink(body: Brep, open: ReadonlySet<string>, region?: ReadonlySet<string>): number {
  const size = sizeOf(body), kept = new Map<string, Patch | Exact>();
  for (const f of body.faces) if (region ? region.has(f.id) : !(f.name && open.has(f.name))) kept.set(f.id, keptFace(body, f, size)!);
  return Math.max(0, ...meetsOf(body, kept, true).map(m => m.angle));
}
/** The body's size: its largest coordinate (vertices and control points), at least 1. */
function sizeOf(body: Brep): number {
  let size = 1;
  for (const v of body.vertices) for (const x of v.point) size = Math.max(size, Math.abs(x));
  for (const f of body.faces) for (const row of nurbsOf(f).controlPoints) for (const p of row) for (const x of p) size = Math.max(size, Math.abs(x));
  return size;
}
/** A kept face as this route offsets it: a plane or cylinder (exact, however trimmed), else an untrimmed patch (fitted), else none. */
function keptFace(body: Brep, f: BrepFace, size: number): Patch | Exact | null {
  const exact = exactOf(f, size);
  if (exact) return exact;
  const loops = new Map(body.loops.map(l => [l.id, l])), coedges = new Map(body.coedges.map(c => [c.id, c])), edges = new Map(body.edges.map(e => [e.id, e]));
  const S = nurbsOf(f);
  if (f.loops.length === 1 && loops.get(f.loops[0])!.kind === 'outer' && S.degreeU <= 3 && S.degreeV <= 3) {
    const F = patchOf(f, size);
    try { for (const cid of loops.get(f.loops[0])!.coedges) { const c = coedges.get(cid)!; sideUse(F, edges.get(c.edge)!.curve, c.edge, size); } return F; } catch { /* trimmed: none */ }
  }
  return null;
}

/** The cavity t inside `body` (its faces turned as the body's: `withCavities` turns them inside out). */
/** (Tests: a face's derivatives by this route's own evaluator.) */
export function derivativesForTest(f: BrepFace, u: number, v: number): { P: Point; Su: Point; Sv: Point; Suu: Point; Suv: Point; Svv: Point; convex: number } { const F = patchOf(f, 1), d = F.d2; d.at(u, v, 2); const out = { P: [...d.P] as Point, Su: [...d.Su] as Point, Sv: [...d.Sv] as Point, Suu: [...d.Suu] as Point, Suv: [...d.Suv] as Point, Svv: [...d.Svv] as Point }; return { ...out, convex: convexCurvature(F, u, v) }; }

export function offsetCavity(body: Brep, t: number, id: string, label = id): { cavity: Brep; report: OffsetCavityReport } {
  const made = offsetWall(body, t, id, label, new Set());
  return { cavity: made.brep, report: made.report };
}

/**
 * The shell of the body t thick with the faces named in `open` taken away (R11.2b, D111): its kept faces, their offset
 * (the cavity's cells, turned inside out) and, along each edge between a kept face and an opened one, the wall's end — the
 * band from the edge to its offset, square to the kept face (ruled along its normal): the wall is the union of the faces'
 * normal bands, so taking a face away takes its band. No Boolean.
 */
export function offsetShell(body: Brep, t: number, open: ReadonlySet<string>, id: string, label = id): { shell: Brep; report: OffsetCavityReport } {
  if (!open.size) refuse('an opened shell needs a face to open');
  const made = offsetWall(body, t, id, label, open);
  return { shell: made.brep, report: made.report };
}

/**
 * A region's slab (R11.2c-2, D113): the faces whose ids `region` names — a smooth region of untrimmed patches, planes and
 * cylinders — offset t in (the inner sheet, turned inside out) and out by 1.37 t (or half the tightest concave radius),
 * closed along every edge of the region by bands ruled along its normals. Its reach out is reported as `reachMM`.
 */
export function regionSlab(body: Brep, region: ReadonlySet<string>, t: number, id: string, label = id): { slab: Brep; report: OffsetCavityReport } {
  const made = offsetWall(body, t, id, label, new Set(), { region });
  return { slab: made.brep, report: made.report };
}

/**
 * Refused where a surface thickened from `lo` to `hi` along its normal (∂S/∂u × ∂S/∂v) turns over (R11.3, D114): an
 * offset towards the side it curves to, deeper than its radius there (t·κ ≥ 1) — the same check as a shell's, each knot
 * span sampled with its edges and climbed (D110). Degrees above 3: sampled on a fine grid.
 */
export function thickenFoldCheck(surface: Surface, name: string, lo: number, hi: number): void {
  if (surface.degreeU <= 3 && surface.degreeV <= 3) {
    const F = patchOf({ id: name, name, surface, sense: 'forward', loops: [], shell: '' } as BrepFace, 1);
    if (hi > 0) foldCheck([F], hi, -1);
    if (lo < 0) foldCheck([F], -lo, 1);
    return;
  }
  const { u, v } = surfaceDomain(surface), n = 64;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    const uu = i === n ? u[1] : u[0] + (u[1] - u[0]) * i / n, vv = j === n ? v[1] : v[0] + (v[1] - v[0]) * j / n;
    let k: readonly number[];
    try { k = evaluateSurfaceCurvature(surface, uu, vv).principalCurvaturesPerMM; } catch { continue; }
    for (const x of k) {
      // (Positive bends towards the normal: an offset along it folds past 1/κ, one against it past −1/κ.)
      const t = x > 0 ? hi : -lo;
      if (t > 0 && t * Math.abs(x) >= 1) refuse(`[OFFSET_FOLDS] face ${name} curves more tightly than the wall at (${+uu.toFixed(6)}, ${+vv.toFixed(6)}): its radius there ${+(1 / Math.abs(x)).toPrecision(6)} mm, the wall ${t} mm — the offset turns over`);
    }
  }
}

/** The faces' smooth edges: each edge between two of the faces named by id, its largest angle between their normals. */
export function edgeAngles(body: Brep, faceIds: ReadonlySet<string>): Map<string, number> {
  const size = sizeOf(body), kept = new Map<string, Patch | Exact>();
  for (const f of body.faces) if (faceIds.has(f.id)) { const k = keptFace(body, f, size); if (k) kept.set(f.id, k); }
  return new Map(meetsOf(body, kept, true).map(m => [m.edge, m.angle]));
}
/** Whether a face is one this route offsets (an untrimmed patch, a plane or a cylinder). */
export function offsetFace(body: Brep, f: BrepFace): boolean { return keptFace(body, f, sizeOf(body)) !== null; }
/** The angle (rad) below which this route takes an edge as smooth. */
export const SMOOTH_EDGE = SMOOTH;

/**
 * The cavity (nothing opened), the opened shell, or a region's slab (`slab`: the faces whose ids it names offset t in and a
 * reach out, closed along the region's edges; R11.2c-2, D113).
 */
function offsetWall(body: Brep, t: number, id: string, label: string, open: ReadonlySet<string>, slab?: { readonly region: ReadonlySet<string> }): { brep: Brep; report: OffsetCavityReport } {
  if (!(t > 0)) refuse('the wall must be positive');
  const opened = slab ? (f: BrepFace) => !slab.region.has(f.id) : (f: BrepFace) => !!f.name && open.has(f.name);
  if (body.faces.every(opened)) refuse('every face is opened');
  if (!slab && !smoothOffsetBody(body, open)) refuse('the offset route takes a closed body whose kept faces are untrimmed patches, planes or cylinders meeting smoothly');
  const size = sizeOf(body), target = 1e-6 * size, near = 1e-7 * size;
  // (Only the kept faces are offset; an opened face's band is gone, and with it what it could fold or meet.)
  const kept = body.faces.filter(f => !opened(f)).map(f => keptFace(body, f, size) ?? refuse(`face ${f.name ?? f.id} is not an untrimmed patch, a plane or a cylinder (the offset route's faces)`));
  const faces = kept.filter(isPatch), exacts = kept.filter(isExact);
  const minRadius = Math.min(foldCheck(faces, t), exactFold(exacts, t));
  // A slab's outer sheet: 1.37 walls out (the slab route's reach), or half the tightest concave radius where that is less.
  const reach = slab ? Math.min(1.37 * t, 0.5 * Math.min(foldCheck(faces, 0, -1), ...exacts.filter(X => X.cylinder && X.cylinder.out < 0).map(X => X.cylinder!.r))) : 0;
  // Each face's grid of cells, fitted within the target; a slab's two sheets on one grid (each refitted on the other's).
  let fits = faces.map(F => fitFace(F, t, target)), outs: FaceFit[] = [];
  if (slab) for (let round = 0; ; round++) {
    outs = faces.map((F, i) => fitFace(F, -reach, target, fits[i]));
    if (outs.every((o, i) => o.cu.length === fits[i].cu.length && o.cv.length === fits[i].cv.length)) break;
    if (round === 4) refuse('[APPROX_TOLERANCE_NOT_MET] a slab\'s two sheets do not settle on one grid of cells');
    fits = faces.map((F, i) => fitFace(F, t, target, outs[i]));
  }
  thinCheck(body, faces, fits, t, slab ? [] : body.faces.filter(opened).map(f => patchOf(f, size)), exacts);
  // ---- Topology: the body's, its edges split where a face's grid line meets them ----
  const loops = new Map(body.loops.map(l => [l.id, l])), coedges = new Map(body.coedges.map(c => [c.id, c])), edges = new Map(body.edges.map(e => [e.id, e]));
  const faceOfEdge = new Map<string, Patch>(), exactOfEdge = new Map<string, Exact>();
  for (const F of faces) for (const cid of loops.get(F.face.loops[0])!.coedges) { const e = coedges.get(cid)!.edge; if (!faceOfEdge.has(e)) faceOfEdge.set(e, F); }
  for (const X of exacts) for (const lid of X.face.loops) for (const cid of loops.get(lid)!.coedges) { const e = coedges.get(cid)!.edge; if (!exactOfEdge.has(e)) exactOfEdge.set(e, X); }
  const vertices = new Registry(near);
  const cut = new Map<string, number[]>();
  for (const e of body.edges) cut.set(e.id, []);
  // Every original vertex; every point where a grid line of a face meets one of its sides.
  for (const v of body.vertices) vertices.at(v.point);
  const sides = new Map<Patch, SideUse[]>();
  for (const F of faces) {
    const uses = loops.get(F.face.loops[0])!.coedges.map(cid => { const c = coedges.get(cid)!; return sideUse(F, edges.get(c.edge)!.curve, c.edge, size); });
    sides.set(F, uses);
    const fit = fits[faces.indexOf(F)];
    for (const u of uses) {
      const lines = u.side === 0 || u.side === 2 ? fit.cu : fit.cv, lo = Math.min(u.s0, u.s1), hi = Math.max(u.s0, u.s1);
      for (const s of lines) if (s > lo + 1e-12 * (hi - lo) && s < hi - 1e-12 * (hi - lo)) {
        const p = sidePoint(F, u.side, s), curve = edges.get(u.edge)!.curve;
        cut.get(u.edge)!.push(curveParam(curve, p)); vertices.at(p);
      }
    }
  }
  // Each kept edge's cuts: snapped to its own knots within rounding, the same cut from two faces once; an edge of exact
  // faces only in pieces of at most the kernel's poles (a band on each).
  const cutsOf = new Map<string, number[]>();
  for (const e of body.edges) {
    const [c0, c1] = curveDomain(e.curve);
    if (!faceOfEdge.has(e.id)) { if (exactOfEdge.has(e.id)) cutsOf.set(e.id, chunksOf(e.curve)); continue; }
    const eps = 1e-9 * (c1 - c0), kn = [...new Set(e.curve.knots)], ts = [c0];
    for (const x0 of [...cut.get(e.id)!].sort((x, y) => x - y)) { const x = kn.find(k => Math.abs(k - x0) <= eps) ?? x0; if (x - ts[ts.length - 1] > eps && c1 - x > eps) ts.push(x); }
    ts.push(c1);
    cutsOf.set(e.id, ts);
  }
  // (Where two faces meet within SMOOTH but not exactly, their offsets part by the offset times the angle along the edge.)
  let deviation = Math.max(0, ...fits.map(f => f.deviation), ...outs.map(f => f.deviation), Math.max(t, reach) * largestKink(body, open, slab?.region));
  type Use = { edge: string; sense: 'forward' | 'reversed' };
  type Piece = { id: string; curve: Curve; a: string; b: string; from: Point; to: Point };
  type FaceInput = { id: string; name: string; surface: Surface; sense: 'forward' | 'reversed'; loops: { kind: 'outer' | 'inner'; uses: Use[] }[] };
  /**
   * The faces' offset tt (inside for tt > 0) as one sheet on the body's topology: the edges' pieces (the exact offset of
   * the body's edge along its first face's normal, fitted; an exact face's map of it), the cells (their sides the pieces
   * along the face's boundary, or grid edges inside it), the exact faces mapped. Ids under `pre`, names under `as`.
   */
  const sheet = (tt: number, fitsT: readonly FaceFit[], pre: string, as: string) => {
    const pieces: Piece[] = [], piecesOf = new Map<string, Piece[]>(), offsetAt = new Map<string, Point>();
    const vertexOffset = (key: string, p: Point, F: Patch) => { let q = offsetAt.get(key); if (!q) { const [u, v] = project(F, p); q = offsetPoint(F, tt, u, v); offsetAt.set(key, q); } return q; };
    for (const e of body.edges) {
      const F = faceOfEdge.get(e.id), X = exactOfEdge.get(e.id), ts = cutsOf.get(e.id), list: Piece[] = [];
      if (!ts || (!F && !X)) continue;
      for (let k = 0; k + 1 < ts.length; k++) {
        const P0 = evaluateCurve(e.curve, ts[k]), P1 = evaluateCurve(e.curve, ts[k + 1]), a = vertices.at(P0), b = vertices.at(P1);
        let curve: Curve;
        if (F) {
          const q0 = vertexOffset(a, P0, F), q1 = vertexOffset(b, P1, F), use = sides.get(F)!.find(x => x.edge === e.id)!, sa = sideParam(F, use.side, P0).s, sb = sideParam(F, use.side, P1).s;
          const fitted = fitEdge(F, use.side, sa, sb, tt, q0, q1, target, ident(`${pre}_e_${e.id}_${k}`));
          deviation = Math.max(deviation, fitted.deviation); curve = fitted.curve;
        } else {
          if (!offsetAt.has(a)) offsetAt.set(a, mapExact(X!, tt, P0));
          if (!offsetAt.has(b)) offsetAt.set(b, mapExact(X!, tt, P1));
          const own = ts.length > 2 ? curvePiece(e.curve, ts[k], ts[k + 1], ident(`${pre}_o_${e.id}_${k}`)) : e.curve;
          curve = mapCurve(X!, tt, own, ident(`${pre}_e_${e.id}_${k}`));
        }
        const piece = { id: `${e.id}#${k}`, curve, a, b, from: P0, to: P1 };
        list.push(piece); pieces.push(piece);
      }
      piecesOf.set(e.id, list);
    }
    const gridEdges: { id: string; curve: Curve; a: string; b: string }[] = [], faceInputs: FaceInput[] = [];
    faces.forEach((F, fi) => {
      const fit = fitsT[fi], nu = fit.cu.length - 1, nv = fit.cv.length - 1, gid = (s: string) => `${pre}_g${fi}_${s}`;
      // The grid's nodes: on the face's boundary the registered points, inside it their own.
      const node = (i: number, j: number) => {
        const u = fit.cu[i], v = fit.cv[j], p = F.at(u, v), key = vertices.at(p);
        if (!offsetAt.has(key)) offsetAt.set(key, offsetPoint(F, tt, u, v));
        return key;
      };
      // Grid edges inside the face: along u at v = cv[j] (0 < j < nv), along v at u = cu[i] (0 < i < nu).
      for (let j = 1; j < nv; j++) for (let i = 0; i < nu; i++) gridEdges.push({ id: gid(`h${i}_${j}`), curve: fit.cells[i][j].iso('v', 0), a: node(i, j), b: node(i + 1, j) });
      for (let i = 1; i < nu; i++) for (let j = 0; j < nv; j++) gridEdges.push({ id: gid(`v${i}_${j}`), curve: fit.cells[i][j].iso('u', 0), a: node(i, j), b: node(i, j + 1) });
      const uses = sides.get(F)!;
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        // Counter-clockwise in (u, v): along u at the bottom, along v at the right, back along u at the top, down at the left.
        const loop: Use[] = [];
        const along = (side: 0 | 1 | 2 | 3, s0: number, s1: number, inner: string | null) => {
          if (inner) { loop.push({ edge: inner, sense: side === 0 || side === 1 ? 'forward' : 'reversed' }); return; }
          loop.push(...boundaryRun(F, uses, piecesOf, side, s0, s1));
        };
        along(0, fit.cu[i], fit.cu[i + 1], j > 0 ? gid(`h${i}_${j}`) : null);
        along(1, fit.cv[j], fit.cv[j + 1], i + 1 < nu ? gid(`v${i + 1}_${j}`) : null);
        along(2, fit.cu[i + 1], fit.cu[i], j + 1 < nv ? gid(`h${i}_${j + 1}`) : null);
        along(3, fit.cv[j + 1], fit.cv[j], i > 0 ? gid(`v${i}_${j}`) : null);
        // (A reversed face's loop runs the other way: counter-clockwise about its outward normal.)
        const ordered = F.sense > 0 ? loop : [...loop].reverse().map(x => ({ edge: x.edge, sense: (x.sense === 'forward' ? 'reversed' : 'forward') as 'forward' | 'reversed' }));
        faceInputs.push({ id: `${pre}_f${fi}_${i}_${j}`, name: `${as}.${F.name}.c${i}_${j}`, surface: fit.cells[i][j].surface, sense: F.face.sense, loops: [{ kind: 'outer', uses: ordered }] });
      }
    });
    // The exact faces: the face's surface mapped, its loops through its edges' pieces (in order, or back for a reversed use).
    const piecesUse = (cid: string): Use[] => { const c = coedges.get(cid)!, list = piecesOf.get(c.edge)!; return (c.sense === 'forward' ? list : [...list].reverse()).map(x => ({ edge: x.id, sense: c.sense })); };
    exacts.forEach((X, xi) => faceInputs.push({ id: `${pre}_x${xi}`, name: `${as}.${X.name}`, surface: mapSurface(X, tt, nurbsOf(X.face), ident(`${pre}_xs${xi}`)), sense: X.face.sense,
      loops: X.face.loops.map(lid => { const l = loops.get(lid)!; return { kind: l.kind, uses: l.coedges.flatMap(piecesUse) }; }) }));
    const used = new Set([...pieces.flatMap(p => [p.a, p.b]), ...gridEdges.flatMap(g => [g.a, g.b])]);
    const verts = vertices.keys().filter(k => used.has(k)).map(k => ({ id: `${pre}_${k}`, point: offsetAt.get(k) ?? refuse(`a vertex of the offset was not placed (${k})`) }));
    const edgeInputs = [...pieces.map(p => ({ id: `${pre}_${p.id}`, curve: p.curve, vertices: [`${pre}_${p.a}`, `${pre}_${p.b}`] as [string, string] })), ...gridEdges.map(g => ({ id: `${pre}_${g.id}`, curve: g.curve, vertices: [`${pre}_${g.a}`, `${pre}_${g.b}`] as [string, string] }))];
    const prefixed = (uses: readonly Use[]) => uses.map(u => ({ edge: `${pre}_${u.edge}`, sense: u.sense }));
    return { piecesOf, offsetAt, faceInputs, verts, edgeInputs, prefixed };
  };
  const inner = sheet(t, fits, id, `${label}.in`);
  const flip = (uses: readonly Use[]) => [...uses].reverse().map(u => ({ edge: u.edge, sense: (u.sense === 'forward' ? 'reversed' : 'forward') as 'forward' | 'reversed' }));
  if (!open.size && !slab) {
    const tolerance = Math.max(2 * deviation, near), report = { deviationMM: deviation, targetMM: target, faces: inner.faceInputs.length, minRadiusMM: minRadius };
    const cavity = buildBrep({ source: { family: 'shell', id }, vertices: inner.verts.map(v => ({ ...v, toleranceMM: tolerance })), edges: inner.edgeInputs.map(e => ({ ...e, toleranceMM: tolerance })), toleranceMM: tolerance,
      bodies: [{ id, kind: 'solid', shells: [{ id: `${id}_s`, closed: true, faces: inner.faceInputs.map(f => ({ id: f.id, name: f.name, surface: f.surface, sense: f.sense, loops: f.loops.map(l => ({ kind: l.kind, uses: inner.prefixed(l.uses) })) })) }] }] });
    return { brep: cavity, report };
  }
  // ---- The wall's ends: a band at each edge between a kept face and another ----
  const facesOfEdge = new Map<string, { face: BrepFace; sense: 'forward' | 'reversed' }[]>();
  for (const f of body.faces) for (const lid of f.loops) for (const cid of loops.get(lid)!.coedges) { const c = coedges.get(cid)!; facesOfEdge.set(c.edge, [...(facesOfEdge.get(c.edge) ?? []), { face: f, sense: c.sense }]); }
  const keptEdges = body.edges.filter(e => (facesOfEdge.get(e.id) ?? []).some(x => !opened(x.face)));
  const rim = keptEdges.filter(e => (facesOfEdge.get(e.id) ?? []).some(x => opened(x.face)));
  // A vertex the opening touches twice (kept and opened faces alternating round it more than once) would have its wall's
  // end meet itself along one radial: not a manifold.
  const rimAt = new Map<string, number>();
  for (const e of rim) for (const v of e.vertices) rimAt.set(v, (rimAt.get(v) ?? 0) + 1);
  for (const [v, n] of rimAt) if (n > 2) refuse(`[OPENING_AT_A_VERTEX] the ${slab ? 'region\'s faces meet the others' : 'opened faces meet the kept ones'} ${n / 2} times round the vertex at (${body.vertices.find(x => x.id === v)!.point.map(x => +x.toFixed(6)).join(', ')}): the wall's ends would touch there; ${slab ? 'not supported yet' : 'open the faces between, or neither'}`);
  if (slab) return slabOf();
  return openedShell();

  /** A region's slab: its outer sheet, its inner one turned inside out, and bands from one to the other along its edges. */
  function slabOf(): { brep: Brep; report: OffsetCavityReport } {
    const outer = sheet(-reach, outs, `${id}_out`, `${label}.out`);
    const bands: FaceInput[] = [], radials = new Map<string, { id: string; curve: Curve; a: string; b: string }>();
    const radialAt = (key: string) => {
      let r = radials.get(key);
      if (!r) { const p = outer.offsetAt.get(key) ?? refuse(`a slab's vertex has no outer offset (${key})`), q = inner.offsetAt.get(key) ?? refuse(`a slab's vertex has no inner offset (${key})`); r = { id: `${id}_r_${key}`, curve: lineCurve(ident(`${id}_r_${key}`), p, q), a: `${id}_out_${key}`, b: `${id}_${key}` }; radials.set(key, r); }
      return r;
    };
    for (const e of rim) {
      const keptUse = facesOfEdge.get(e.id)!.find(x => !opened(x.face))!, F = faces.find(x => x.face === keptUse.face), use = F ? sides.get(F)!.find(x => x.edge === e.id)! : null;
      const out = outer.piecesOf.get(e.id)!, inn = inner.piecesOf.get(e.id)!;
      out.forEach((po, k) => {
        let band: { surface: Surface; deviation: number };
        if (F && use) { const sa = sideParam(F, use.side, po.from).s, sb = sideParam(F, use.side, po.to).s; band = fitBand(F, use.side, sa, sb, t, target, ident(`${id}_b_${e.id}_${k}`), -reach); }
        else band = { surface: ruledBetween(po.curve, inn[k].curve, ident(`${id}_b_${e.id}_${k}`)), deviation: 0 };
        deviation = Math.max(deviation, band.deviation);
        // Along the piece (u), from the outer sheet to the inner (v): as the opened shell's bands (D111), the outer piece for the edge.
        const r0 = radialAt(po.a), r1 = radialAt(po.b);
        const loop: Use[] = [{ edge: `${id}_out_${po.id}`, sense: 'forward' }, { edge: r1.id, sense: 'forward' }, { edge: `${id}_${inn[k].id}`, sense: 'reversed' }, { edge: r0.id, sense: 'reversed' }];
        const sense = keptUse.sense === 'forward' ? 'reversed' : 'forward';
        bands.push({ id: `${id}_band_${ident(e.id)}_${k}`, name: `${label}.end.${e.name ?? e.id}${out.length > 1 ? `#${k + 1}` : ''}`, surface: band.surface, sense, loops: [{ kind: 'outer', uses: sense === 'forward' ? loop : flip(loop) }] });
      });
    }
    const tolerance = Math.max(2 * deviation, near), report = { deviationMM: deviation, targetMM: target, faces: inner.faceInputs.length + outer.faceInputs.length + bands.length, minRadiusMM: minRadius };
    const brep = buildBrep({
      source: { family: 'shell', id },
      vertices: [...outer.verts, ...inner.verts].map(v => ({ ...v, toleranceMM: tolerance })),
      edges: [...outer.edgeInputs, ...inner.edgeInputs, ...[...radials.values()].map(r => ({ id: r.id, curve: r.curve, vertices: [r.a, r.b] as [string, string] }))].map(e => ({ ...e, toleranceMM: tolerance })),
      toleranceMM: tolerance,
      bodies: [{ id, kind: 'solid', shells: [{ id: `${id}_s`, closed: true, faces: [
        ...outer.faceInputs.map(f => ({ id: f.id, name: f.name, surface: f.surface, sense: f.sense, loops: f.loops.map(l => ({ kind: l.kind, uses: outer.prefixed(l.uses) })) })),
        ...inner.faceInputs.map(f => ({ id: f.id, name: f.name, surface: f.surface, sense: (f.sense === 'forward' ? 'reversed' : 'forward') as 'forward' | 'reversed', loops: f.loops.map(l => ({ kind: l.kind, uses: flip(inner.prefixed(l.uses)) })) })),
        ...bands.map(b => ({ id: b.id, name: b.name, surface: b.surface, sense: b.sense, loops: b.loops })),
      ] }] }],
    });
    return { brep, report };
  }

  /** The opened shell (D111): the kept faces as they are, the cells turned inside out, a band at each edge of the opening. */
  function openedShell(): { brep: Brep; report: OffsetCavityReport } {
    const keptVertices = new Set(keptEdges.flatMap(e => [...e.vertices])), vertexPoint = new Map(body.vertices.map(v => [v.id, v.point]));
    const bands: FaceInput[] = [], radials = new Map<string, { id: string; curve: Curve; a: string; b: string }>();
    const radialAt = (v: string) => {
      let r = radials.get(v);
      if (!r) { const p = vertexPoint.get(v)!, key = vertices.at(p), q = inner.offsetAt.get(key) ?? refuse(`a rim vertex has no offset (${v})`); r = { id: `${id}_r_${ident(v)}`, curve: lineCurve(ident(`${id}_r_${v}`), p, q), a: `o_${v}`, b: `${id}_${key}` }; radials.set(v, r); }
      return r;
    };
    // Each rim edge in the pieces its offset was cut into (exact pieces of its curve), a band on each.
    const rimPieces = new Map<string, { id: string; curve: Curve; a: string; b: string; name?: string }[]>();
    const rimVertex = (e: string, k: number, ts: readonly number[], v: readonly [string, string]) => k === 0 ? v[0] : k === ts.length - 1 ? v[1] : `${e}@${k}`;
    for (const e of rim) {
      const keptUse = facesOfEdge.get(e.id)!.find(x => !opened(x.face))!, F = faces.find(x => x.face === keptUse.face), use = F ? sides.get(F)!.find(x => x.edge === e.id)! : null;
      const ts = cutsOf.get(e.id)!, list = inner.piecesOf.get(e.id)!, own: { id: string; curve: Curve; a: string; b: string; name?: string }[] = [];
      for (let k = 0; k + 1 < ts.length; k++) {
        const va = rimVertex(e.id, k, ts, e.vertices), vb = rimVertex(e.id, k + 1, ts, e.vertices);
        for (const [v, x] of [[va, ts[k]], [vb, ts[k + 1]]] as const) if (!vertexPoint.has(v)) vertexPoint.set(v, evaluateCurve(e.curve, x));
        const piece = { id: ts.length > 2 ? `${e.id}@${k}_${k + 1}` : e.id, curve: ts.length > 2 ? curvePiece(e.curve, ts[k], ts[k + 1], ident(`${id}_o_${e.id}_${k}`)) : e.curve, a: va, b: vb, ...(e.name ? { name: ts.length > 2 ? `${e.name}#${k + 1}` : e.name } : {}) };
        own.push(piece);
        let band: { surface: Surface; deviation: number };
        if (F && use) { const sa = sideParam(F, use.side, vertexPoint.get(va)!).s, sb = sideParam(F, use.side, vertexPoint.get(vb)!).s; band = fitBand(F, use.side, sa, sb, t, target, ident(`${id}_b_${e.id}_${k}`)); }
        // (Along an exact face, the ruled band between the piece and its map: exact.)
        else band = { surface: ruledBetween(piece.curve, list[k].curve, ident(`${id}_b_${e.id}_${k}`)), deviation: 0 };
        deviation = Math.max(deviation, band.deviation);
        // Along the piece (u), from it to its offset (v): the piece, the radial at its end, its offset back, the radial at its start.
        const r0 = radialAt(va), r1 = radialAt(vb);
        const loop: Use[] = [{ edge: `o_${piece.id}`, sense: 'forward' }, { edge: r1.id, sense: 'forward' }, { edge: `${id}_${list[k].id}`, sense: 'reversed' }, { edge: r0.id, sense: 'reversed' }];
        // Outward is towards the opening: across the edge from the kept face (its loop's left), so the band's du × dv,
        // the edge's direction × the inward normal, faces out where the kept face's loop runs against the edge.
        const sense = keptUse.sense === 'forward' ? 'reversed' : 'forward';
        bands.push({ id: `${id}_band_${ident(e.id)}_${k}`, name: `${label}.rim.${e.name ?? e.id}${ts.length > 2 ? `#${k + 1}` : ''}`, surface: band.surface, sense, loops: [{ kind: 'outer', uses: sense === 'forward' ? loop : flip(loop) }] });
      }
      rimPieces.set(e.id, own);
    }
    const shellTolerance = Math.max(2 * deviation, near), report = { deviationMM: deviation, targetMM: target, faces: inner.faceInputs.length, minRadiusMM: minRadius };
    const rimVertexIds = new Set<string>();
    for (const list of rimPieces.values()) for (const p of list) { keptVertices.add(p.a); keptVertices.add(p.b); rimVertexIds.add(p.a); rimVertexIds.add(p.b); }
    const keptLoop = (lid: string) => loops.get(lid)!.coedges.flatMap(cid => {
      const c = coedges.get(cid)!, list = rimPieces.get(c.edge);
      if (!list) return [{ edge: `o_${c.edge}`, sense: c.sense }];
      return (c.sense === 'forward' ? list : [...list].reverse()).map(p => ({ edge: `o_${p.id}`, sense: c.sense }));
    });
    const shell = buildBrep({
      source: { family: 'shell', id },
      vertices: [...[...keptVertices].map(v => ({ id: `o_${v}`, point: vertexPoint.get(v)!, toleranceMM: Math.max(body.vertices.find(x => x.id === v)?.toleranceMM ?? 0, rimVertexIds.has(v) ? shellTolerance : 0) })), ...inner.verts.map(v => ({ ...v, toleranceMM: shellTolerance }))],
      edges: [...keptEdges.filter(e => !rimPieces.has(e.id)).map(e => ({ id: `o_${e.id}`, curve: e.curve, vertices: [`o_${e.vertices[0]}`, `o_${e.vertices[1]}`] as [string, string], toleranceMM: e.toleranceMM, ...(e.name ? { name: e.name } : {}) })),
        ...[...rimPieces.values()].flat().map(p => ({ id: `o_${p.id}`, curve: p.curve, vertices: [`o_${p.a}`, `o_${p.b}`] as [string, string], toleranceMM: shellTolerance, ...(p.name ? { name: p.name } : {}) })),
        ...inner.edgeInputs.map(e => ({ ...e, toleranceMM: shellTolerance })), ...[...radials.values()].map(r => ({ id: r.id, curve: r.curve, vertices: [r.a, r.b] as [string, string], toleranceMM: shellTolerance }))],
      bodies: [{ id, kind: 'solid', shells: [{ id: `${id}_s`, closed: true, faces: [
        ...body.faces.filter(f => !opened(f)).map(f => ({ id: `o_${ident(f.id)}`, surface: f.surface, sense: f.sense, ...(f.name ? { name: f.name } : {}), loops: f.loops.map(lid => ({ kind: loops.get(lid)!.kind, uses: keptLoop(lid) })) })),
        ...inner.faceInputs.map(f => ({ id: f.id, name: f.name, surface: f.surface, sense: (f.sense === 'forward' ? 'reversed' : 'forward') as 'forward' | 'reversed', loops: f.loops.map(l => ({ kind: l.kind, uses: flip(inner.prefixed(l.uses)) })) })),
        ...bands.map(b => ({ id: b.id, name: b.name, surface: b.surface, sense: b.sense, loops: b.loops })),
      ] }] }],
    });
    return { brep: shell, report: { ...report, deviationMM: deviation } };
  }
}

/**
 * The piece of a NURBS curve between parameters a < b, exactly: each knot inserted to the full multiplicity there
 * (Boehm, on the homogeneous points), the middle segment kept.
 */
function curvePiece(curve: Curve, a: number, b: number, id: string): Curve {
  let K = [...curve.knots], P = curve.controlPoints.map((p, i) => [p[0] * curve.weights[i], p[1] * curve.weights[i], p[2] * curve.weights[i], curve.weights[i]]);
  const p = curve.degree;
  for (const x of [a, b]) {
    const have = K.filter(k => k === x).length;
    for (let r = have; r < p; r++) {
      const n = P.length - 1;
      let k = p; while (k + 1 < K.length && K[k + 1] <= x) k++;
      if (k > n) k = n;
      const Q: number[][] = [];
      for (let i = 0; i <= n + 1; i++) {
        if (i <= k - p) Q.push(P[i]);
        else if (i > k) Q.push(P[i - 1]);
        else { const al = (x - K[i]) / (K[i + p] - K[i]); Q.push(P[i].map((c, j) => al * c + (1 - al) * P[i - 1][j])); }
      }
      K = [...K.slice(0, k + 1), x, ...K.slice(k + 1)]; P = Q;
    }
  }
  // a and b now have p knots inside (p + 1 at an end of the curve): the curve's point at a is control point
  // lastIndexOf(a) − p, at b indexOf(b) − 1; the knots between clamped p + 1 times at each end.
  const first = K.lastIndexOf(a) - p, last = K.indexOf(b) - 1, Kp = [...Array(p + 1).fill(a), ...K.filter(k => k > a && k < b), ...Array(p + 1).fill(b)];
  const pts = P.slice(first, last + 1);
  return { kind: 'curve', id, degree: p, knots: Kp, controlPoints: pts.map(h => [h[0] / h[3], h[1] / h[3], h[2] / h[3]] as Point), weights: pts.map(h => h[3]) };
}

/**
 * The wall's end along an edge on side `side` of its face, from side parameter sa to sb: the ruled band from the face's
 * side to its offset there, cubic along the edge (w ∈ [0, 1], the side's knots each once more, refined until both rows are
 * within the target), linear across. Its deviation.
 */
function fitBand(F: Patch, side: 0 | 1 | 2 | 3, sa: number, sb: number, t: number, target: number, id: string, t0 = 0): { surface: Surface; deviation: number } {
  const k = side === 0 || side === 2 ? F.ku : F.kv, lo = Math.min(sa, sb), hi = Math.max(sa, sb), toW = (x: number) => (x - sa) / (sb - sa);
  const uvAt = (w: number) => sideUV(F, side, sa + (sb - sa) * w);
  for (let r = 2; ; r++) {
    const K = cellKnots(k, lo, hi, r).map(toW).sort((x, y) => x - y), g = greville(K);
    // (Row 0 the face's offset t0 — the face itself, or a slab's outer sheet — row 1 its offset t.)
    const P = interpolate(K, g.map(w => { const [u, v] = uvAt(w); return [t0 ? offsetPoint(F, t0, u, v) : F.at(u, v), offsetPoint(F, t, u, v)]; }));
    const surface: Surface = { kind: 'surface', id, degreeU: 3, degreeV: 1, knotsU: K, knotsV: [0, 0, 1, 1], controlPoints: P, weights: P.map(r2 => r2.map(() => 1)) };
    const at = surfaceEvaluator(surface);
    let deviation = 0;
    for (const w of between(g)) { const [u, v] = uvAt(w); deviation = Math.max(deviation, len(sub(t0 ? offsetPoint(F, t0, u, v) : F.at(u, v), at(w, 0))), len(sub(offsetPoint(F, t, u, v), at(w, 1)))); }
    if (deviation <= target || poles(K) >= MAX_POLES) return { surface, deviation };
  }
}

// ---- Faces offset exactly ----

/**
 * A kept face whose offset is exact (R11.2c-1, D112): a plane, moved along its normal, or a circular cylinder, scaled about
 * its axis (a convex one to r − t, a hole to r + t) — affine maps, so the face's own NURBS surface and its edges map onto
 * the offset exactly, and the face keeps whatever trims it (a Boolean's, a fillet's contact).
 */
interface Exact { readonly kind: 'exact'; readonly face: BrepFace; readonly name: string; readonly plane?: { readonly n: Point; readonly o: Point }; readonly cylinder?: { readonly c: Point; readonly a: Point; readonly r: number; readonly out: number } }
const isExact = (k: Patch | Exact): k is Exact => 'kind' in k && k.kind === 'exact';
const isPatch = (k: Patch | Exact): k is Patch => !isExact(k);
function exactOf(f: BrepFace, size: number): Exact | null {
  let g: ReturnType<typeof faceGeometry>;
  try { g = faceGeometry(f, size); } catch { return null; }
  const name = f.name ?? f.id;
  if (g.kind === 'plane') return { kind: 'exact', face: f, name, plane: { n: unit(g.n), o: g.o } };
  if (g.kind === 'cylinder') return { kind: 'exact', face: f, name, cylinder: { c: g.c, a: unit(g.a), r: g.r, out: g.out } };
  return null;
}
/** A point of the exact face's surface, t inside it. */
function mapExact(X: Exact, t: number, p: Point): Point {
  if (X.plane) return sub(p, scale(X.plane.n, t));
  const { c, a, r, out } = X.cylinder!, d = sub(p, c), h = dot(d, a);
  return add(add(c, scale(a, h)), scale(sub(d, scale(a, h)), (r - t * out) / r));
}
function exactNormal(X: Exact, p: Point): Point {
  if (X.plane) return X.plane.n;
  const { c, a, out } = X.cylinder!, d = sub(p, c);
  return scale(unit(sub(d, scale(a, dot(d, a)))), out > 0 ? 1 : -1);
}
/** The point of the exact face's surface nearest q (along its normal). */
function exactFoot(X: Exact, q: Point): Point {
  if (X.plane) return sub(q, scale(X.plane.n, dot(sub(q, X.plane.o), X.plane.n)));
  const { c, a, r } = X.cylinder!, d = sub(q, c), h = dot(d, a), radial = sub(d, scale(a, h)), l = len(radial);
  return add(add(c, scale(a, h)), l > 0 ? scale(radial, r / l) : scale(unit(cross(a, Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), r));
}
const mapCurve = (X: Exact, t: number, c: Curve, id: string): Curve => ({ ...c, id, controlPoints: c.controlPoints.map(p => mapExact(X, t, p)) });
const mapSurface = (X: Exact, t: number, S: Surface, id: string): Surface => ({ ...S, id, controlPoints: S.controlPoints.map(row => row.map(p => mapExact(X, t, p))) });
/** Refused where a convex cylinder is no wider than the wall (its offset gone, or a line); its radius, against the wall. */
function exactFold(exacts: readonly Exact[], t: number): number {
  let min = Infinity;
  for (const X of exacts) {
    if (!X.cylinder || X.cylinder.out < 0) continue;
    const r = X.cylinder.r;
    if (t >= r) refuse(`[OFFSET_FOLDS] face ${X.name} (a cylinder) curves more tightly than the wall: its radius ${+r.toPrecision(6)} mm, the wall ${t} mm — the offset turns over`);
    min = Math.min(min, r);
  }
  return min;
}
/** A curve's parameters cut so no piece has more control points than a surface may (a band on each). */
function chunksOf(c: Curve): number[] {
  const [c0, c1] = curveDomain(c), ts = [c0];
  if (c.controlPoints.length <= MAX_POLES) return [c0, c1];
  // (A piece from knot a to b has degree + 1 poles and one more for each knot between, counted with multiplicity.)
  const inner = c.knots.slice(c.degree + 1, c.knots.length - c.degree - 1);
  let count = 0;
  for (let i = 0; i < inner.length; i++) {
    count++;
    const x = inner[i];
    if (count + c.degree + 1 >= MAX_POLES && x > ts[ts.length - 1] && x < c1 && (i + 1 >= inner.length || inner[i + 1] !== x)) { ts.push(x); count = 0; }
  }
  ts.push(c1);
  return ts;
}
/** The ruled surface from curve a (v = 0) to curve b (v = 1), the two of one degree, knots and weights. */
function ruledBetween(a: Curve, b: Curve, id: string): Surface {
  return { kind: 'surface', id, degreeU: a.degree, degreeV: 1, knotsU: [...a.knots], knotsV: [0, 0, 1, 1], controlPoints: a.controlPoints.map((p, i) => [p, b.controlPoints[i]]), weights: a.weights.map(w => [w, w]) };
}

// ---- Faces as patches ----

/** A face as a whole patch: its surface, its outward sign, its domain and its distinct knots with their multiplicities. */
interface Patch { readonly face: BrepFace; readonly name: string; readonly S: Surface; readonly sense: 1 | -1; readonly U: [number, number]; readonly V: [number, number]; readonly ku: Knots; readonly kv: Knots; readonly at: (u: number, v: number) => Point; readonly d2: Derivs }
interface Knots { readonly at: number[]; readonly mult: number[] }
function knotsOf(K: readonly number[]): Knots {
  const at: number[] = [], mult: number[] = [];
  for (const x of K) { if (at.length && x === at[at.length - 1]) mult[mult.length - 1]++; else { at.push(x); mult.push(1); } }
  return { at, mult };
}
function patchOf(f: BrepFace, size: number): Patch {
  const S = nurbsOf(f), { u, v } = surfaceDomain(S);
  if (S.degreeU > 3 || S.degreeV > 3) refuse(`face ${f.name ?? f.id} is of degree above 3 (the offset is fitted cubic)`);
  void size;
  return { face: f, name: f.name ?? f.id, S, sense: f.sense === 'forward' ? 1 : -1, U: [u[0], u[1]], V: [v[0], v[1]], ku: knotsOf(S.knotsU), kv: knotsOf(S.knotsV), at: surfaceEvaluator(S), d2: new Derivs(S) };
}

/**
 * A face's point and first and second derivatives at (u, v), the surface checked once (the kernel's evaluators check
 * it at every call — most of this route's time before): rational B-spline, derivative basis functions (Piegl & Tiller
 * A2.3), the quotient rule. Results in the instance's own arrays, read before the next call.
 */
class Derivs {
  readonly P: Point = [0, 0, 0]; readonly Su: Point = [0, 0, 0]; readonly Sv: Point = [0, 0, 0]; readonly Suu: Point = [0, 0, 0]; readonly Suv: Point = [0, 0, 0]; readonly Svv: Point = [0, 0, 0];
  private readonly nu: number; private readonly nv: number;
  private readonly du: number[][] = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]; private readonly dv: number[][] = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  private readonly A: number[] = new Array<number>(4 * 9).fill(0);
  constructor(private readonly S: Surface) { this.nu = S.controlPoints.length - 1; this.nv = S.controlPoints[0].length - 1; }
  /** Fills P and the derivatives at (u, v); `order` 1 skips the second ones. */
  at(u: number, v: number, order: 1 | 2 = 2): void {
    const S = this.S, pu = S.degreeU, pv = S.degreeV, iu = findSpan(this.nu, pu, u, S.knotsU), iv = findSpan(this.nv, pv, v, S.knotsV);
    dersBasis(iu, u, pu, order, S.knotsU, this.du); dersBasis(iv, v, pv, order, S.knotsV, this.dv);
    // Homogeneous sums: A[(k·3 + l)·4 + c] for ∂^k u ∂^l v (k + l ≤ 2), c = x, y, z, w.
    const A = this.A; A.fill(0);
    for (let a = 0; a <= pu; a++) for (let b = 0; b <= pv; b++) {
      const cp = S.controlPoints[iu - pu + a][iv - pv + b], w = S.weights[iu - pu + a][iv - pv + b], X = cp[0] * w, Y = cp[1] * w, Z = cp[2] * w;
      for (let k = 0; k <= order; k++) for (let l = 0; k + l <= order; l++) {
        const f = this.du[k][a] * this.dv[l][b], o = (k * 3 + l) * 4;
        A[o] += f * X; A[o + 1] += f * Y; A[o + 2] += f * Z; A[o + 3] += f * w;
      }
    }
    const w = A[3], wu = A[3 * 4 + 3], wv = A[1 * 4 + 3];
    for (let c = 0; c < 3; c++) {
      const p = A[c] / w, su = (A[3 * 4 + c] - wu * p) / w, sv = (A[1 * 4 + c] - wv * p) / w;
      this.P[c] = p; this.Su[c] = su; this.Sv[c] = sv;
      if (order === 2) {
        const wuu = A[6 * 4 + 3], wuv = A[4 * 4 + 3], wvv = A[2 * 4 + 3];
        this.Suu[c] = (A[6 * 4 + c] - 2 * wu * su - wuu * p) / w;
        this.Suv[c] = (A[4 * 4 + c] - wu * sv - wv * su - wuv * p) / w;
        this.Svv[c] = (A[2 * 4 + c] - 2 * wv * sv - wvv * p) / w;
      }
    }
  }
}
function findSpan(n: number, p: number, u: number, K: readonly number[]): number {
  if (u >= K[n + 1]) return n;
  if (u <= K[p]) return p;
  let lo = p, hi = n + 1, mid = (lo + hi) >> 1;
  while (u < K[mid] || u >= K[mid + 1]) { if (u < K[mid]) hi = mid; else lo = mid; mid = (lo + hi) >> 1; }
  return mid;
}
/** Basis functions and their derivatives up to `order` at u (Piegl & Tiller A2.3), into out[k][0 … p]. */
function dersBasis(i: number, u: number, p: number, order: number, K: readonly number[], out: number[][]): void {
  const ndu = [[1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], left = [0, 0, 0, 0], right = [0, 0, 0, 0];
  for (let j = 1; j <= p; j++) {
    left[j] = u - K[i + 1 - j]; right[j] = K[i + j] - u;
    let saved = 0;
    for (let r = 0; r < j; r++) { ndu[j][r] = right[r + 1] + left[j - r]; const tmp = ndu[r][j - 1] / ndu[j][r]; ndu[r][j] = saved + right[r + 1] * tmp; saved = left[j - r] * tmp; }
    ndu[j][j] = saved;
  }
  for (let j = 0; j <= p; j++) out[0][j] = ndu[j][p];
  const a = [[0, 0, 0, 0], [0, 0, 0, 0]];
  for (let r = 0; r <= p; r++) {
    let s1 = 0, s2 = 1; a[0][0] = 1;
    for (let k = 1; k <= order; k++) {
      let d = 0; const rk = r - k, pk = p - k;
      if (r >= k) { a[s2][0] = a[s1][0] / ndu[pk + 1][rk]; d = a[s2][0] * ndu[rk][pk]; }
      const j1 = rk >= -1 ? 1 : -rk, j2 = r - 1 <= pk ? k - 1 : p - r;
      for (let j = j1; j <= j2; j++) { a[s2][j] = (a[s1][j] - a[s1][j - 1]) / ndu[pk + 1][rk + j]; d += a[s2][j] * ndu[rk + j][pk]; }
      if (r <= pk) { a[s2][k] = -a[s1][k - 1] / ndu[pk + 1][r]; d += a[s2][k] * ndu[r][pk]; }
      out[k][r] = d; const tmp = s1; s1 = s2; s2 = tmp;
    }
  }
  let f = p;
  for (let k = 1; k <= order; k++) { for (let j = 0; j <= p; j++) out[k][j] *= f; f *= p - k; }
}
const cross3 = (a: Point, b: Point): Point => cross(a, b);
/** The point t inside the face at (u, v), along its outward normal (from the first derivatives). */
function offsetPoint(F: Patch, t: number, u: number, v: number): Point {
  const d = F.d2; d.at(u, v, 1);
  const n = cross3(d.Su, d.Sv), l = len(n) * F.sense;
  if (!(Math.abs(l) > 1e-300)) refuse(`face ${F.name} has no normal at (${u}, ${v})`);
  return [d.P[0] - t * n[0] / l, d.P[1] - t * n[1] / l, d.P[2] - t * n[2] / l];
}
/** The outward unit normal of the face at (u, v). */
function normalOf(F: Patch, u: number, v: number): Point {
  const d = F.d2; d.at(u, v, 1);
  const n = cross3(d.Su, d.Sv), l = len(n) * F.sense;
  return [n[0] / l, n[1] / l, n[2] / l];
}
/** A point of a side of the face's domain: 0 v = V0 (along u), 1 u = U1 (along v), 2 v = V1, 3 u = U0. */
function sidePoint(F: Patch, side: number, s: number): Point {
  return side === 0 ? F.at(s, F.V[0]) : side === 1 ? F.at(F.U[1], s) : side === 2 ? F.at(s, F.V[1]) : F.at(F.U[0], s);
}
const sideUV = (F: Patch, side: number, s: number): [number, number] => side === 0 ? [s, F.V[0]] : side === 1 ? [F.U[1], s] : side === 2 ? [s, F.V[1]] : [F.U[0], s];
/** The parameter on a side of the face nearest a point (sampled, then golden section). */
function sideParam(F: Patch, side: number, p: Point): { s: number; d: number } {
  const [a0, a1] = side === 0 || side === 2 ? F.U : F.V, N = 32;
  let best = a0, bd = Infinity;
  for (let i = 0; i <= N; i++) { const s = a0 + (a1 - a0) * i / N, d = len(sub(sidePoint(F, side, s), p)); if (d < bd) { bd = d; best = s; } }
  let lo = Math.max(a0, best - (a1 - a0) / N), hi = Math.min(a1, best + (a1 - a0) / N);
  const g = (Math.sqrt(5) - 1) / 2;
  for (let it = 0; it < 80 && hi - lo > 1e-15 * (a1 - a0); it++) {
    const x1 = hi - g * (hi - lo), x2 = lo + g * (hi - lo);
    if (len(sub(sidePoint(F, side, x1), p)) < len(sub(sidePoint(F, side, x2), p))) hi = x2; else lo = x1;
  }
  const s = (lo + hi) / 2;
  return { s, d: len(sub(sidePoint(F, side, s), p)) };
}
/** Where a point on the face's boundary lies, as (u, v). */
function project(F: Patch, p: Point): [number, number] {
  let best: [number, number] = [F.U[0], F.V[0]], bd = Infinity;
  for (let k = 0; k < 4; k++) { const { s, d } = sideParam(F, k, p); if (d < bd) { bd = d; best = sideUV(F, k, s); } }
  return best;
}
/** A coedge's edge as a run along one side of the face: the side, and its parameters at the edge's start and end. */
interface SideUse { readonly edge: string; readonly side: 0 | 1 | 2 | 3; readonly s0: number; readonly s1: number }
function sideUse(F: Patch, curve: Curve, edge: string, size: number): SideUse {
  const [c0, c1] = curveDomain(curve), a = evaluateCurve(curve, c0), m = evaluateCurve(curve, (c0 + c1) / 2), b = evaluateCurve(curve, c1);
  for (const side of [0, 1, 2, 3] as const) {
    const pa = sideParam(F, side, a), pm = sideParam(F, side, m), pb = sideParam(F, side, b);
    if (Math.max(pa.d, pm.d, pb.d) < 1e-7 * size) return { edge, side, s0: pa.s, s1: pb.s };
  }
  return refuse(`face ${F.name}: an edge of it does not run along its patch's boundary (a trimmed face is not supported yet)`);
}
/** An edge curve's parameter at a point on it (sampled, then golden section). */
function curveParam(curve: Curve, p: Point): number {
  const [c0, c1] = curveDomain(curve), N = 64, at = curveEvaluator(curve);
  let best = c0, bd = Infinity;
  for (let i = 0; i <= N; i++) { const x = c0 + (c1 - c0) * i / N, d = len(sub(at(x), p)); if (d < bd) { bd = d; best = x; } }
  let lo = Math.max(c0, best - (c1 - c0) / N), hi = Math.min(c1, best + (c1 - c0) / N);
  const g = (Math.sqrt(5) - 1) / 2;
  for (let it = 0; it < 90 && hi - lo > 1e-15 * (c1 - c0); it++) {
    const x1 = hi - g * (hi - lo), x2 = lo + g * (hi - lo);
    if (len(sub(at(x1), p)) < len(sub(at(x2), p))) hi = x2; else lo = x1;
  }
  return (lo + hi) / 2;
}
/**
 * The run of edge pieces along a side of the face from s0 to s1 (side parameters), as coedges going that way: the
 * pieces of the face's edges on that side whose ends lie within the run.
 */
function boundaryRun(F: Patch, uses: readonly SideUse[], piecesOf: ReadonlyMap<string, readonly { id: string; from: Point; to: Point }[]>, side: 0 | 1 | 2 | 3, s0: number, s1: number): { edge: string; sense: 'forward' | 'reversed' }[] {
  const lo = Math.min(s0, s1), hi = Math.max(s0, s1), eps = 1e-9 * Math.max(1, Math.abs(hi - lo)), up = s1 > s0, out: { at: number; edge: string; sense: 'forward' | 'reversed' }[] = [];
  for (const u of uses) {
    if (u.side !== side) continue;
    for (const p of piecesOf.get(u.edge)!) {
      const a = sideParam(F, side, p.from).s, b = sideParam(F, side, p.to).s;
      if (Math.min(a, b) < lo - eps || Math.max(a, b) > hi + eps) continue;
      out.push({ at: Math.min(a, b), edge: p.id, sense: (b > a) === up ? 'forward' : 'reversed' });
    }
  }
  out.sort((x, y) => up ? x.at - y.at : y.at - x.at);
  if (!out.length) refuse(`face ${F.name}: no edge runs along its side ${side} between ${s0} and ${s1}`);
  return out.map(x => ({ edge: x.edge, sense: x.sense }));
}

/** Points the same within `near` are one vertex. */
class Registry {
  private readonly cells = new Map<string, { key: string; p: Point }[]>();
  private readonly order: string[] = [];
  constructor(private readonly near: number) {}
  at(p: Point): string {
    const q = this.near * 4, c = [Math.floor(p[0] / q), Math.floor(p[1] / q), Math.floor(p[2] / q)];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let d = -1; d <= 1; d++) {
      for (const x of this.cells.get(`${c[0] + a},${c[1] + b},${c[2] + d}`) ?? []) if (len(sub(x.p, p)) <= this.near) return x.key;
    }
    const key = `v${this.order.length}`, cell = `${c[0]},${c[1]},${c[2]}`;
    this.cells.set(cell, [...(this.cells.get(cell) ?? []), { key, p }]); this.order.push(key);
    return key;
  }
  keys(): string[] { return [...this.order]; }
}

// ---- Edges between faces ----

/** Every edge between two kept faces: the largest angle between their outward normals, at its middle and quarters (and ends with `ends`). */
function meetsOf(body: Brep, kept: ReadonlyMap<string, Patch | Exact>, ends = false): { edge: string; angle: number }[] {
  const loops = new Map(body.loops.map(l => [l.id, l])), coedges = new Map(body.coedges.map(c => [c.id, c])), uses = new Map<string, BrepFace[]>();
  for (const f of body.faces) for (const lid of f.loops) for (const cid of loops.get(lid)!.coedges) { const e = coedges.get(cid)!.edge; uses.set(e, [...(uses.get(e) ?? []), f]); }
  const out: { edge: string; angle: number }[] = [];
  for (const e of body.edges) {
    const fs = uses.get(e.id) ?? [];
    if (fs.length !== 2) throw new Error('an edge with other than two faces');
    if (fs[0] === fs[1]) continue;
    const A = kept.get(fs[0].id), B = kept.get(fs[1].id);
    if (!A || !B) continue;
    const [c0, c1] = curveDomain(e.curve);
    let angle = 0;
    for (const x of ends ? [0, 0.25, 0.5, 0.75, 1] : [0.25, 0.5, 0.75]) { const p = evaluateCurve(e.curve, c0 + (c1 - c0) * x), na = normalNear(A, p), nb = normalNear(B, p); angle = Math.max(angle, Math.atan2(len(cross(na, nb)), dot(na, nb))); }
    out.push({ edge: e.id, angle });
  }
  return out;
}
/** A kept face's outward unit normal at a point on its boundary. */
function normalNear(k: Patch | Exact, p: Point): Point {
  if (isExact(k)) return exactNormal(k, p);
  const [u, v] = project(k, p);
  return normalOf(k, u, v);
}

// ---- Folding and thin walls ----

/** The face's largest convex principal curvature at (u, v); NaN where the second derivatives are not defined. */
function convexCurvature(F: Patch, u: number, v: number, sign: 1 | -1 = 1): number {
  // (From the fundamental forms against the unit normal Su × Sv; convex towards the inside, positive, for the outward one.)
  const d = F.d2; d.at(u, v, 2);
  const N = cross3(d.Su, d.Sv), l = len(N);
  if (!(l > 1e-300)) return NaN;
  const n: Point = [N[0] / l, N[1] / l, N[2] / l], E = dot(d.Su, d.Su), Fm = dot(d.Su, d.Sv), G = dot(d.Sv, d.Sv), L = dot(n, d.Suu), M = dot(n, d.Suv), Nn = dot(n, d.Svv), det = E * G - Fm * Fm;
  const H = (E * Nn - 2 * Fm * M + G * L) / (2 * det), K = (L * Nn - M * M) / det, root = Math.sqrt(Math.max(0, H * H - K));
  // (sign −1: the largest concave one, for an offset outwards.)
  return Math.max(-sign * F.sense * (H - root), -sign * F.sense * (H + root));
}
/** A knot span's end moved inside it by rounding where it is an interior knot (C¹ there: the second derivatives one-sided). */
const inside = (x: number, lo: number, hi: number, k: Knots) => x === lo && lo > k.at[0] ? lo + 1e-9 * (hi - lo) : x === hi && hi < k.at[k.at.length - 1] ? hi - 1e-9 * (hi - lo) : x;
/**
 * Refused where t·κ ≥ 1 for a convex principal curvature κ (the offset turns over there). Each knot span sampled on a
 * 9 × 9 grid with its edges — the tightest curvature of a SubD cap lies on its boundary, beside its extraordinary corner
 * (1.480 mm on the cube's, where interior points gave 1.509) — and from the largest samples, a climb (each parameter in
 * turn, golden section, the step halving) to the local largest. The tightest radius.
 */
function foldCheck(faces: readonly Patch[], t: number, sign: 1 | -1 = 1): number {
  const seeds: { F: Patch; k: number; u: number; v: number; u0: number; u1: number; v0: number; v1: number; sign: 1 | -1 }[] = [];
  for (const F of faces) for (let a = 0; a + 1 < F.ku.at.length; a++) for (let c = 0; c + 1 < F.kv.at.length; c++) {
    const u0 = F.ku.at[a], u1 = F.ku.at[a + 1], v0 = F.kv.at[c], v1 = F.kv.at[c + 1];
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
      const u = inside(u0 + (u1 - u0) * i / 8, u0, u1, F.ku), v = inside(v0 + (v1 - v0) * j / 8, v0, v1, F.kv), k = convexCurvature(F, u, v, sign);
      if (k > 0) seeds.push({ F, k, u, v, u0, u1, v0, v1, sign });
    }
  }
  // (The six largest samples climbed: only the largest curvature decides.)
  seeds.sort((x, y) => y.k - x.k);
  let kmax = 0;
  for (const s of seeds.slice(0, 6)) {
    let { u, v } = s, h = Math.max(s.u1 - s.u0, s.v1 - s.v0) / 8;
    for (let round = 0; round < 20; round++, h /= 2) {
      u = climb(s.F, u, v, Math.max(s.u0, u - h), Math.min(s.u1, u + h), true, s);
      v = climb(s.F, u, v, Math.max(s.v0, v - h), Math.min(s.v1, v + h), false, s);
    }
    const k = Math.max(s.k, convexCurvature(s.F, u, v, sign) || 0);
    if (k > kmax) kmax = k;
    if (t * k >= 1) refuse(`[OFFSET_FOLDS] face ${s.F.name} curves more tightly than the wall at (${+u.toFixed(6)}, ${+v.toFixed(6)}): its radius there ${+(1 / k).toPrecision(6)} mm, the wall ${t} mm — the offset turns over`);
  }
  return kmax > 0 ? 1 / kmax : Infinity;
}
/** Golden section for the largest convex curvature along u (or v) on [lo, hi], the other parameter held. */
function climb(F: Patch, u: number, v: number, lo: number, hi: number, alongU: boolean, s: { u0: number; u1: number; v0: number; v1: number; sign: 1 | -1 }): number {
  const g = (Math.sqrt(5) - 1) / 2, kOf = (x: number) => { const y = alongU ? inside(x, s.u0, s.u1, F.ku) : inside(x, s.v0, s.v1, F.kv), k = alongU ? convexCurvature(F, y, v, s.sign) : convexCurvature(F, u, y, s.sign); return Number.isNaN(k) ? -Infinity : k; };
  let a = lo, b = hi, x1 = b - g * (b - a), x2 = a + g * (b - a), f1 = kOf(x1), f2 = kOf(x2);
  for (let it = 0; it < 24; it++) { if (f1 > f2) { b = x2; x2 = x1; f2 = f1; x1 = b - g * (b - a); f1 = kOf(x1); } else { a = x1; x1 = x2; f1 = f2; x2 = a + g * (b - a); f2 = kOf(x2); } }
  // The ends too: the largest is often at the span's edge.
  const best = [[(a + b) / 2, kOf((a + b) / 2)], [lo, kOf(lo)], [hi, kOf(hi)], [alongU ? u : v, kOf(alongU ? u : v)]].sort((p, q) => q[1] - p[1])[0][0];
  return alongU ? inside(best, s.u0, s.u1, F.ku) : inside(best, s.v0, s.v1, F.kv);
}

/**
 * Refused where an offset point (each fitted cell's interpolation points) comes nearer than the wall to another part of
 * the body — a wall thinner than twice the wall there, where the offsets of its two sides would cross. Candidates from
 * the body's tessellation within the wall, then the nearest point on that face's own surface (Newton from the
 * triangle's parameters).
 */
function thinCheck(body: Brep, faces: readonly Patch[], fits: readonly FaceFit[], t: number, openedFaces: readonly Patch[] = [], exacts: readonly Exact[] = []): void {
  const { mesh, parameters } = tessellateBrepWithParameters(body, { segmentsPerQuarter: 16 }), P = mesh.positionsMM, I = mesh.indices;
  const faceOfTri = new Int32Array(I.length / 3), uvOf = new Float64Array(2 * P.length / 3), patchOfFace = new Map(faces.map(F => [F.face.id, F])), openedOf = new Map(openedFaces.map(F => [F.face.id, F])), exactOfFace = new Map(exacts.map(X => [X.face.id, X]));
  mesh.faces.forEach((mf, k) => { for (let i = mf.indexOffset / 3; i < (mf.indexOffset + mf.indexCount) / 3; i++) faceOfTri[i] = k; const par = parameters.get(mf.faceId); if (par) par.uv.forEach((uv, j) => { uvOf[2 * (mf.vertexOffset + j)] = uv[0]; uvOf[2 * (mf.vertexOffset + j) + 1] = uv[1]; }); });
  // Triangles by grid cell of the wall's size.
  const h = t, grid = new Map<string, number[]>();
  for (let i = 0; i < I.length / 3; i++) {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let k = 0; k < 3; k++) { const q = 3 * I[3 * i + k]; x0 = Math.min(x0, P[q]); x1 = Math.max(x1, P[q]); y0 = Math.min(y0, P[q + 1]); y1 = Math.max(y1, P[q + 1]); z0 = Math.min(z0, P[q + 2]); z1 = Math.max(z1, P[q + 2]); }
    for (let a = Math.floor(x0 / h); a <= Math.floor(x1 / h); a++) for (let b = Math.floor(y0 / h); b <= Math.floor(y1 / h); b++) for (let c = Math.floor(z0 / h); c <= Math.floor(z1 / h); c++) { const key = `${a},${b},${c}`, list = grid.get(key); if (list) list.push(i); else grid.set(key, [i]); }
  }
  // The offset points to check: the cells' interpolation points; an exact face's tessellation points, mapped.
  const samples: { name: string; q: Point }[] = [];
  faces.forEach((F, fi) => { for (const row of fits[fi].cells) for (const cell of row) for (const q of cell.samples) samples.push({ name: F.name, q }); });
  for (const mf of mesh.faces) { const X = exactOfFace.get(mf.faceId); if (X) for (let j = 0; j < mf.vertexCount; j++) { const k = 3 * (mf.vertexOffset + j); samples.push({ name: X.name, q: mapExact(X, t, [P[k], P[k + 1], P[k + 2]]) }); } }
  // (The tessellation's chord on a cylinder: a foot within it of a triangle lies on that face.)
  const chord = 2e-3 * Math.max(t, ...exacts.map(X => X.cylinder?.r ?? 0));
  {
    for (const { name: Fname, q } of samples) {
      const seen = new Set<number>(), cx = Math.floor(q[0] / h), cy = Math.floor(q[1] / h), cz = Math.floor(q[2] / h);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) for (const i of grid.get(`${cx + a},${cy + b},${cz + c}`) ?? []) {
        if (seen.has(i)) continue; seen.add(i);
        if (!(triangleDistance(P, I, i, q) < t * (1 - 1e-3))) continue;
        // The face's own surface there: the nearest point from the triangle's parameters.
        const mf = mesh.faces[faceOfTri[i]], G = patchOfFace.get(mf.faceId), j0 = I[3 * i], X = exactOfFace.get(mf.faceId);
        if (X) {
          // An exact face: the foot of q on its surface, if that lies on this triangle (else another triangle's foot decides).
          const foot = exactFoot(X, q);
          if (triangleDistance(P, I, i, foot) > chord) continue;
          const d = len(sub(q, foot));
          if (d < t * (1 - 1e-6)) refuse(`[WALL_TOO_THIN] the wall of ${t} mm inside face ${Fname} comes ${+d.toPrecision(6)} mm from face ${X.name}: the body is thinner than twice the wall there`);
          continue;
        }
        if (!G) {
          // An opened face is no wall: the wall may come near it (what is between runs out through the opening), not cross it.
          // (A face neither kept nor opened — another region's, in a slab — is not this check's: the slabs' union takes it.)
          const O = openedOf.get(mf.faceId);
          if (!O) continue;
          const [u, v] = nearestOn(O, q, uvOf[2 * j0], uvOf[2 * j0 + 1]), r = sub(q, O.at(u, v));
          if (dot(r, normalOf(O, u, v)) > 1e-6 * t) refuse(`[WALL_TOO_THIN] the wall of ${t} mm inside face ${Fname} runs out through the opened face ${O.name}, ${+len(r).toPrecision(6)} mm past it: the body is thinner than the wall there`);
          continue;
        }
        const d = surfaceDistance(G, q, uvOf[2 * j0], uvOf[2 * j0 + 1]);
        if (d < t * (1 - 1e-6)) refuse(`[WALL_TOO_THIN] the wall of ${t} mm inside face ${Fname} comes ${+d.toPrecision(6)} mm from face ${G.name}: the body is thinner than twice the wall there`);
      }
    }
  }
}
function triangleDistance(P: ArrayLike<number>, I: ArrayLike<number>, i: number, q: Point): number {
  const a: Point = [P[3 * I[3 * i]], P[3 * I[3 * i] + 1], P[3 * I[3 * i] + 2]], b: Point = [P[3 * I[3 * i + 1]], P[3 * I[3 * i + 1] + 1], P[3 * I[3 * i + 1] + 2]], c: Point = [P[3 * I[3 * i + 2]], P[3 * I[3 * i + 2] + 1], P[3 * I[3 * i + 2] + 2]];
  // (Ericson's closest point on a triangle.)
  const ab = sub(b, a), ac = sub(c, a), ap = sub(q, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return len(ap);
  const bp = sub(q, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return len(bp);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const w = d1 / (d1 - d3); return len(sub(q, [a[0] + ab[0] * w, a[1] + ab[1] * w, a[2] + ab[2] * w])); }
  const cp = sub(q, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return len(cp);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return len(sub(q, [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w])); }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return len(sub(q, [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w])); }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return len(sub(q, [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]));
}
/** The distance from q to the face's surface, by Newton from (u, v) (kept in the domain). */
function surfaceDistance(F: Patch, q: Point, u0: number, v0: number): number { const [u, v] = nearestOn(F, q, u0, v0); return len(sub(F.at(u, v), q)); }
/** The face's nearest point to q, by Newton from (u, v) (kept in the domain). */
function nearestOn(F: Patch, q: Point, u0: number, v0: number): [number, number] {
  let u = Math.min(F.U[1], Math.max(F.U[0], u0)), v = Math.min(F.V[1], Math.max(F.V[0], v0));
  for (let it = 0; it < 40; it++) {
    const d = F.d2; d.at(u, v, 1);
    const r = sub(d.P, q), a = dot(d.Su, d.Su), b = dot(d.Su, d.Sv), c = dot(d.Sv, d.Sv), g1 = dot(r, d.Su), g2 = dot(r, d.Sv), det = a * c - b * b;
    if (!(Math.abs(det) > 1e-300)) break;
    const du = (c * g1 - b * g2) / det, dv = (a * g2 - b * g1) / det;
    u = Math.min(F.U[1], Math.max(F.U[0], u - du)); v = Math.min(F.V[1], Math.max(F.V[0], v - dv));
    if (Math.abs(du) + Math.abs(dv) < 1e-15 * (F.U[1] - F.U[0] + F.V[1] - F.V[0])) break;
  }
  return [u, v];
}

// ---- Fitting ----

/** A fitted cell: its surface, the points it interpolates (offset points), and its boundary as a curve. */
interface Cell { readonly surface: Surface; readonly samples: readonly Point[]; readonly deviation: number; iso(axis: 'u' | 'v', end: 0 | 1): Curve }
interface FaceFit { readonly cu: number[]; readonly cv: number[]; readonly cells: Cell[][]; readonly deviation: number }

/** A cubic knot vector on [a, b]: the face's knots inside it, each once more (C⁰ at most), each span cut in r. */
function cellKnots(k: Knots, a: number, b: number, r: number): number[] {
  const breaks: { at: number; mult: number }[] = [];
  // (A knot within rounding of an end is that end: a span of 1e-16 would make the fit singular.)
  const eps = 1e-9 * (b - a);
  k.at.forEach((x, i) => { if (x > a + eps && x < b - eps) breaks.push({ at: x, mult: Math.min(3, k.mult[i] + 1) }); });
  const pts = [a, ...breaks.map(x => x.at), b], out = [a, a, a, a];
  for (let i = 0; i + 1 < pts.length; i++) {
    for (let j = 1; j < r; j++) out.push(pts[i] + (pts[i + 1] - pts[i]) * j / r);
    if (i + 1 < pts.length - 1) for (let m = 0; m < breaks[i].mult; m++) out.push(pts[i + 1]);
  }
  out.push(b, b, b, b);
  return out;
}
const poles = (K: readonly number[]) => K.length - 4;
const greville = (K: readonly number[]) => Array.from({ length: K.length - 4 }, (_, i) => (K[i + 1] + K[i + 2] + K[i + 3]) / 3);
function spanOf(n: number, u: number, K: readonly number[]): number {
  if (u >= K[n + 1]) return n;
  // (A Greville point at the start, (a + a + a) / 3, can round below a: the search below would never end.)
  if (u <= K[3]) return 3;
  let lo = 3, hi = n + 1, mid = (lo + hi) >> 1;
  while (u < K[mid] || u >= K[mid + 1]) { if (u < K[mid]) hi = mid; else lo = mid; mid = (lo + hi) >> 1; }
  return mid;
}
function basisAt(i: number, u: number, K: readonly number[]): number[] {
  const N = [1, 0, 0, 0], left = [0, 0, 0, 0], right = [0, 0, 0, 0];
  for (let j = 1; j <= 3; j++) {
    left[j] = u - K[i + 1 - j]; right[j] = K[i + j] - u;
    let saved = 0;
    for (let r = 0; r < j; r++) { const tmp = N[r] / (right[r + 1] + left[j - r]); N[r] = saved + right[r + 1] * tmp; saved = left[j - r] * tmp; }
    N[j] = saved;
  }
  return N;
}
/** Solves A X = B (Gaussian elimination, partial pivoting; A square, B several columns). */
function solve(A: number[][], B: number[][]): number[][] {
  const n = A.length, w = B[0].length, M = A.map((r, i) => [...r, ...B[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    if (!(Math.abs(M[c][c]) > 1e-300)) refuse('an offset fit is singular (a degenerate face)');
    for (let r = 0; r < n; r++) if (r !== c && M[r][c] !== 0) { const f = M[r][c] / M[c][c]; for (let k = c; k < n + w; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r.slice(n).map(x => x / r[i]));
}
/** Interpolation at the Greville points of K: rows of points (each row its own columns) → control rows. */
function interpolate(K: readonly number[], rows: readonly (readonly Point[])[]): Point[][] {
  const g = greville(K), n = g.length - 1, A = g.map(u => { const row = new Array<number>(n + 1).fill(0), i = spanOf(n, u, K), N = basisAt(i, u, K); for (let k = 0; k <= 3; k++) row[i - 3 + k] = N[k]; return row; });
  const m = rows[0].length;
  return solve(A, rows.map(r => r.flatMap(p => [p[0], p[1], p[2]]))).map(r => Array.from({ length: m }, (_, j) => [r[3 * j], r[3 * j + 1], r[3 * j + 2]] as Point));
}
/** The cell [a, b] × [c, d] of the face's offset, interpolated at the Greville points of (KU, KV); its deviation on a grid between them. */
function fitCell(F: Patch, t: number, KU: number[], KV: number[], id: string): Cell {
  const gu = greville(KU), gv = greville(KV), pts = gu.map(u => gv.map(v => offsetPoint(F, t, u, v)));
  const a = interpolate(KU, pts), b = interpolate(KV, gv.map((_, j) => a.map(r => r[j]))), cp = a.map((_, i) => b.map(r => r[i]));
  const surface: Surface = { kind: 'surface', id, degreeU: 3, degreeV: 3, knotsU: KU, knotsV: KV, controlPoints: cp, weights: cp.map(r => r.map(() => 1)) };
  // Measured between the interpolation points (where the error is largest) and at the spans' quarters.
  const mu = between(gu), mv = between(gv);
  let deviation = 0;
  const cellAt = surfaceEvaluator(surface);
  for (const u of mu) for (const v of mv) deviation = Math.max(deviation, len(sub(offsetPoint(F, t, u, v), cellAt(u, v))));
  return { surface, samples: pts.flat(), deviation, iso: (axis, end) => isoCurve(surface, axis, end, `${id}_${axis}${end}`) };
}
/** Parameters between consecutive ones, and a quarter in from each. */
function between(g: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < g.length; i++) out.push(g[i] + (g[i + 1] - g[i]) * 0.25, (g[i] + g[i + 1]) / 2, g[i] + (g[i + 1] - g[i]) * 0.75);
  return out;
}
/** A cubic surface's boundary at u = u0 (axis 'u', end 0) or u1, or at v = v0 / v1, as a curve along the other parameter. */
function isoCurve(S: Surface, axis: 'u' | 'v', end: 0 | 1, id: string): Curve {
  if (axis === 'u') { const row = S.controlPoints[end ? S.controlPoints.length - 1 : 0]; return { kind: 'curve', id, degree: 3, knots: [...S.knotsV], controlPoints: row.map(p => [...p] as Point), weights: row.map(() => 1) }; }
  const col = S.controlPoints.map(r => r[end ? r.length - 1 : 0]);
  return { kind: 'curve', id, degree: 3, knots: [...S.knotsU], controlPoints: col.map(p => [...p] as Point), weights: col.map(() => 1) };
}

/**
 * A face's offset on a grid of cells, each within the target: the grid starts at the knot spans grouped so a cell
 * fits the pole cap; a cell refines its spans (2 to as many as the cap allows) until within the target; where the cap
 * is reached first, the grid is cut through that cell's middle (both ways) and the face fitted again.
 */
function fitFace(F: Patch, t: number, target: number, start?: { readonly cu: readonly number[]; readonly cv: readonly number[] }): FaceFit {
  const groups = (k: Knots, lo: number, hi: number) => {
    // Spans together while (the spans · 3 + 2) poles fit the cap at 2 a span.
    const cuts = [lo]; let n = 0;
    for (let i = 1; i < k.at.length; i++) { n++; if (k.at[i] < hi && (n + 1) * 3 + 2 > MAX_POLES) { cuts.push(k.at[i]); n = 0; } }
    cuts.push(hi); return [...new Set(cuts)];
  };
  // (From a grid given — another offset's of the same face, so the two share their cuts — or the face's spans grouped.)
  let cu = start ? [...start.cu] : groups(F.ku, F.U[0], F.U[1]), cv = start ? [...start.cv] : groups(F.kv, F.V[0], F.V[1]);
  for (let round = 0; round < 12; round++) {
    const cells: Cell[][] = [], worse: [number, number][] = [];
    let deviation = 0;
    for (let i = 0; i + 1 < cu.length; i++) {
      const col: Cell[] = [];
      for (let j = 0; j + 1 < cv.length; j++) {
        let best: Cell | null = null;
        for (let r = 2; ; r++) {
          const KU = cellKnots(F.ku, cu[i], cu[i + 1], r), KV = cellKnots(F.kv, cv[j], cv[j + 1], r);
          if (poles(KU) > MAX_POLES || poles(KV) > MAX_POLES) break;
          best = fitCell(F, t, KU, KV, ident(`${F.face.id}_c${i}_${j}`));
          if (best.deviation <= target) break;
        }
        if (!best) best = fitCell(F, t, cellKnots(F.ku, cu[i], cu[i + 1], 1), cellKnots(F.kv, cv[j], cv[j + 1], 1), ident(`${F.face.id}_c${i}_${j}`));
        if (best.deviation > target) worse.push([i, j]);
        deviation = Math.max(deviation, best.deviation); col.push(best);
      }
      cells.push(col);
    }
    if (!worse.length) return { cu, cv, cells, deviation };
    // Cut the grid through the middle of every cell that did not fit.
    const nu = new Set(cu), nv = new Set(cv);
    for (const [i, j] of worse) { nu.add((cu[i] + cu[i + 1]) / 2); nv.add((cv[j] + cv[j + 1]) / 2); }
    cu = [...nu].sort((x, y) => x - y); cv = [...nv].sort((x, y) => x - y);
    if (cu.length > 65 || cv.length > 65) break;
  }
  return refuse(`[APPROX_TOLERANCE_NOT_MET] face ${F.name}: its offset does not fit within ${target.toPrecision(3)} mm (1e-6 of the body's size) on a grid of up to 64 × 64 cells`);
}

/**
 * An edge piece's offset, fitted cubic through its ends' vertices: the piece runs along side `side` of its face from
 * side parameter sa to sb, so its offset is the face's offset along that side — fitted in w ∈ [0, 1] (s = sa + (sb − sa) w)
 * on the side's knots, each once more, refined until within the target. Its deviation.
 */
function fitEdge(F: Patch, side: 0 | 1 | 2 | 3, sa: number, sb: number, t: number, q0: Point, q1: Point, target: number, id: string): { curve: Curve; deviation: number } {
  const k = side === 0 || side === 2 ? F.ku : F.kv, lo = Math.min(sa, sb), hi = Math.max(sa, sb), toW = (x: number) => (x - sa) / (sb - sa);
  const at = (w: number) => { const [u, v] = sideUV(F, side, sa + (sb - sa) * w); return offsetPoint(F, t, u, v); };
  for (let r = 2; ; r++) {
    const K = cellKnots(k, lo, hi, r).map(toW).sort((x, y) => x - y), g = greville(K);
    const pts = g.map((w, i) => i === 0 ? q0 : i === g.length - 1 ? q1 : at(w));
    const cp = interpolate(K, pts.map(p => [p])).map(r2 => r2[0]);
    const curve: Curve = { kind: 'curve', id, degree: 3, knots: K, controlPoints: cp, weights: cp.map(() => 1) };
    let deviation = 0;
    const curveAt = curveEvaluator(curve);
    for (const w of between(g)) deviation = Math.max(deviation, len(sub(at(w), curveAt(w))));
    if (deviation <= target || poles(K) >= 60) return { curve, deviation };
  }
}

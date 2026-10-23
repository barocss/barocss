// STEP (ISO 10303-21) import of B-rep solids into the shared B-rep, where every face is a bounded
// NURBS patch without seams and every edge has two vertices.
//
//   surfaces   PLANE; CYLINDRICAL, CONICAL, SPHERICAL and TOROIDAL_SURFACE as exact rational patches of
//              revolution over the face's extent (the profile — line or arc — turned through the face's
//              angles); B-spline surfaces (rational or not) as they are; SURFACE_OF_LINEAR_EXTRUSION
//              (σ = C(u) + v·V) and SURFACE_OF_REVOLUTION (C(v) turned u about the axis, C in a plane
//              through it) of a B-spline curve or a conic, as exact patches over the face's extent
//   curves     LINE; CIRCLE and ELLIPSE as rational quadratic arcs; B-spline curves; SURFACE_CURVE,
//              SEAM_CURVE and TRIMMED_CURVE by their 3D curve
//   seams      a face going once round its axis (a cylinder's wall bounded by two circles and a seam
//              edge used twice) is cut in two at the opposite angle: the circles are split there (and
//              so in their other faces' loops too), and the halves meet along a new edge
//   closed     an edge starting and ending at one vertex is split in two
//
// A face once round with holes is cut where no hole is. Other entities (offset surfaces, vertex loops,
// holes across a seam) are refused by name.
import { BrepError, buildBrep, mergeBreps, type Brep } from '../brep/brep-core.js';
import { facetBrepFromTriangles, facetBrepsFromTriangles } from '../mesh/facet-brep.js';
import { withCavities } from '../brep/brep-glue.js';
import { brepMassProperties } from '../brep/solid-mass.js';
import { classifyPointInFacets } from '../mesh/facet-bvh.js';
import { MeshBrepError } from '../mesh/mesh-brep.js';
import { curveDomain, evaluateCurve } from '../core/math.js';
import { add, cross, dot, len, scale, sub, unit } from '../core/vec3.js';
import type { Curve, Point, Surface } from '../types.js';

// ---- Part 21 -----------------------------------------------------------------------------------------
type Value = number | string | { ref: number } | { enum: string } | null | '*' | Value[] | { type: string; args: Value[] };
interface Entity { type: string; args: Value[]; parts?: { type: string; args: Value[] }[] }
const refuse = (detail: string): never => { throw new BrepError('INPUT', 'STEP: ' + detail); };

// (Tokens matched where the reader stands — sticky, without a copy of the rest of the text — and white space told by
// its code, the regular expression only past ASCII: the same tokens as before, about a quarter faster; PERF3 C16.)
const REF = /\d+/y, ENUM = /\.([A-Z0-9_]+)\./y, NUM = /[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/y, WORD = /[A-Z_][A-Z0-9_]*/y, HEAD = /#(\d+)\s*=\s*/y;
const sticky = (re: RegExp, s: string, at: number): RegExpExecArray | null => { re.lastIndex = at; return re.exec(s); };
/** Whether a character is white space as /\s/ has it. */
function space(s: string, i: number): boolean {
  const c = s.charCodeAt(i);
  return c === 32 || (c >= 9 && c <= 13) || (c > 127 && (c === 0xa0 || /\s/.test(s[i])));
}
/** The DATA section's instances: simple ones and complex ones (as their partial entities). */
function parseData(source: string): Map<number, Entity> {
  const data = /DATA;([\s\S]*?)ENDSEC;/.exec(source.includes('/*') ? source.replace(/\/\*[\s\S]*?\*\//g, '') : source);
  if (!data) refuse('no DATA section');
  const s = data![1], out = new Map<number, Entity>();
  let i = 0;
  const ws = () => { while (i < s.length && space(s, i)) i++; };
  const value = (): Value => {
    ws();
    const c = s[i];
    if (c === '(') { i++; const list: Value[] = []; ws(); if (s[i] === ')') { i++; return list; } for (;;) { list.push(value()); ws(); if (s[i] === ',') { i++; continue; } if (s[i] === ')') { i++; return list; } refuse(`bad list near ${s.slice(i, i + 20)}`); } }
    if (c === "'") {
      // (A quote doubled is one quote.)
      let t = ''; i++;
      for (;;) { const q = s.indexOf("'", i); if (q < 0) refuse('unterminated string'); t += s.slice(i, q); if (s[q + 1] === "'") { t += "'"; i = q + 2; continue; } i = q + 1; return t; }
    }
    if (c === '#') { i++; const m = sticky(REF, s, i)!; i += m[0].length; return { ref: Number(m[0]) }; }
    if (c === '.') { const m = sticky(ENUM, s, i); if (!m) refuse('bad enumeration'); i += m![0].length; return { enum: m![1] }; }
    if (c === '$') { i++; return null; }
    if (c === '*') { i++; return '*'; }
    const num = sticky(NUM, s, i);
    if (num) { i += num[0].length; return Number(num[0]); }
    const word = sticky(WORD, s, i);
    if (word) { i += word[0].length; ws(); const args = value(); return { type: word[0], args: args as Value[] }; } // a typed parameter (LENGTH_MEASURE(…))
    return refuse(`unexpected ${s.slice(i, i + 20)}`);
  };
  while (i < s.length) {
    ws(); if (i >= s.length) break;
    const head = sticky(HEAD, s, i); if (!head) refuse(`expected an instance near ${s.slice(i, i + 30)}`);
    i += head![0].length; ws();
    if (s[i] === '(') {
      i++; const parts: { type: string; args: Value[] }[] = [];
      for (;;) { ws(); if (s[i] === ')') { i++; break; } const w = sticky(WORD, s, i); if (!w) refuse('bad complex instance'); i += w![0].length; parts.push({ type: w![0], args: value() as Value[] }); }
      out.set(Number(head![1]), { type: 'COMPLEX', args: [], parts });
    } else {
      const w = sticky(WORD, s, i); if (!w) refuse('expected an entity name');
      i += w![0].length; out.set(Number(head![1]), { type: w![0], args: value() as Value[] });
    }
    ws(); if (s[i] === ';') i++;
  }
  return out;
}
const expand = (values: readonly number[], mults: readonly number[]) => values.flatMap((v, k) => Array(mults[k]).fill(v) as number[]);
const TAU = 2 * Math.PI;
const wrap = (a: number) => ((a % TAU) + TAU) % TAU;

// ---- geometry ----------------------------------------------------------------------------------------
interface Frame { o: Point; x: Point; y: Point; z: Point }
/** An edge's geometry, in its own direction: a line, a conic over an angle range, or a B-spline. */
type Geo = { kind: 'line'; p: Point; q: Point } | { kind: 'conic'; f: Frame; a: number; b: number; t0: number; sweep: number } | { kind: 'curve'; c: Curve };
/** A swept curve: a B-spline over its whole domain, or a conic (param: its angle). */
type Swept = { kind: 'curve'; c: Curve } | { kind: 'conic'; f: Frame; a: number; b: number };
type SurfDef = { kind: 'plane'; f: Frame } | { kind: 'cylinder'; f: Frame; r: number } | { kind: 'cone'; f: Frame; r: number; tan: number } | { kind: 'sphere'; f: Frame; r: number } | { kind: 'torus'; f: Frame; R: number; r: number } | { kind: 'bspline'; s: Surface }
  /** σ(u, v) = C(u) + v·d. */
  | { kind: 'extrusion'; swept: Swept; d: Point }
  /** C(v) turned u about f.z through f.o; C lies in the half-plane of f.x (and f.z). */
  | { kind: 'revolution'; swept: Swept; f: Frame };
type Analytic = Exclude<SurfDef, { kind: 'plane' } | { kind: 'bspline' } | { kind: 'extrusion' } | { kind: 'revolution' }>;

const conicAt = (g: Extract<Geo, { kind: 'conic' }>, t: number): Point => add(g.f.o, add(scale(g.f.x, g.a * Math.cos(t)), scale(g.f.y, g.b * Math.sin(t))));
function geoAt(g: Geo, u: number): Point {
  if (g.kind === 'line') return add(g.p, scale(sub(g.q, g.p), u));
  if (g.kind === 'conic') return conicAt(g, g.t0 + g.sweep * u);
  const [t0, t1] = curveDomain(g.c); return evaluateCurve(g.c, t0 + (t1 - t0) * u);
}
/** The part of an edge's geometry from fraction u0 to u1 (lines and conics; B-splines are not split). */
function geoPart(g: Geo, u0: number, u1: number, p: Point, q: Point): Geo {
  if (g.kind === 'line') return { kind: 'line', p, q };
  if (g.kind === 'conic') return { ...g, t0: g.t0 + g.sweep * u0, sweep: g.sweep * (u1 - u0) };
  return refuse('a B-spline edge would have to be split (not supported yet)');
}
/** Rational quadratic arc points of a conic from t0 through sweep (spans of at most a quarter turn). */
function conicCurve(g: Extract<Geo, { kind: 'conic' }>, id: string): Curve {
  const spans = Math.max(1, Math.ceil(Math.abs(g.sweep) / (Math.PI / 2) - 1e-12)), dt = g.sweep / spans, w = Math.cos(dt / 2), cps: Point[] = [], ws: number[] = [], knots = [0, 0, 0];
  const at = (t: number, k: number): Point => add(g.f.o, add(scale(g.f.x, g.a * k * Math.cos(t)), scale(g.f.y, g.b * k * Math.sin(t))));
  for (let s = 0; s < spans; s++) { const ta = g.t0 + dt * s; if (!s) { cps.push(at(ta, 1)); ws.push(1); } cps.push(at(ta + dt / 2, 1 / w), at(ta + dt, 1)); ws.push(w, 1); if (s < spans - 1) knots.push((s + 1) / spans, (s + 1) / spans); }
  knots.push(1, 1, 1);
  return { kind: 'curve', id, degree: 2, controlPoints: cps, knots, weights: ws };
}
function toCurve(g: Geo, id: string): Curve {
  if (g.kind === 'line') return { kind: 'curve', id, degree: 1, knots: [0, 0, 1, 1], controlPoints: [g.p, g.q], weights: [1, 1] };
  if (g.kind === 'conic') return conicCurve(g, id);
  return { ...g.c, id };
}
function reverseCurve(c: Curve): Curve {
  const [t0, t1] = curveDomain(c);
  return { ...c, controlPoints: [...c.controlPoints].reverse(), weights: [...c.weights].reverse(), knots: [...c.knots].reverse().map(k => t0 + t1 - k) };
}

/** A surface's natural coordinates of a point (u: angle about the axis; v: height or latitude). */
function natural(sd: SurfDef, p: Point): [number, number] {
  if (sd.kind === 'plane' || sd.kind === 'bspline' || sd.kind === 'extrusion') return [0, 0];
  if (sd.kind === 'revolution') { const d = sub(p, sd.f.o); return [Math.atan2(dot(d, sd.f.y), dot(d, sd.f.x)), dot(d, sd.f.z)]; }
  const d = sub(p, sd.f.o), u = Math.atan2(dot(d, sd.f.y), dot(d, sd.f.x)), h = dot(d, sd.f.z), rho = Math.hypot(dot(d, sd.f.x), dot(d, sd.f.y));
  if (sd.kind === 'cylinder' || sd.kind === 'cone') return [u, h];
  if (sd.kind === 'sphere') return [u, Math.atan2(h, rho)];
  return [u, Math.atan2(h, rho - sd.R)];
}
const periodic = (sd: SurfDef) => sd.kind === 'cylinder' || sd.kind === 'cone' || sd.kind === 'sphere' || sd.kind === 'torus' || sd.kind === 'revolution';

// Swept curves.
const sweptAt = (w: Swept, t: number): Point => w.kind === 'curve' ? evaluateCurve(w.c, t) : add(w.f.o, add(scale(w.f.x, w.a * Math.cos(t)), scale(w.f.y, w.b * Math.sin(t))));
/** The swept curve as NURBS: a B-spline whole, a conic from angle t0 to t1. */
const sweptCurve = (w: Swept, t0: number, t1: number): Curve => w.kind === 'curve' ? w.c : conicCurve({ kind: 'conic', f: w.f, a: w.a, b: w.b, t0, sweep: t1 - t0 }, 'w');
/** The parameter of the swept curve's point nearest by `dist` (sampled, then refined by golden sections). */
function nearestOn(w: Swept, dist: (x: Point) => number): number {
  const [t0, t1] = w.kind === 'curve' ? curveDomain(w.c) : [-Math.PI, Math.PI], N = 128;
  let best = t0, d = Infinity;
  for (let k = 0; k <= N; k++) { const t = t0 + (t1 - t0) * k / N, e = dist(sweptAt(w, t)); if (e < d) { d = e; best = t; } }
  let lo = best - (t1 - t0) / N, hi = best + (t1 - t0) / N;
  if (w.kind === 'curve') { lo = Math.max(t0, lo); hi = Math.min(t1, hi); }
  for (let it = 0; it < 80; it++) { const a = lo + (hi - lo) * 0.381966, b = lo + (hi - lo) * 0.618034; if (dist(sweptAt(w, a)) < dist(sweptAt(w, b))) hi = b; else lo = a; }
  return (lo + hi) / 2;
}
/** Where a point of a surface swept by a curve lies: the curve's parameter there and the sweep's (height along d, or angle). */
function sweptCoords(sd: Extract<SurfDef, { kind: 'extrusion' } | { kind: 'revolution' }>, p: Point): [number, number] {
  if (sd.kind === 'extrusion') {
    const d = sd.d, t = nearestOn(sd.swept, x => { const w = sub(p, x); return len(sub(w, scale(d, dot(w, d)))); });
    return [t, dot(sub(p, sweptAt(sd.swept, t)), d)];
  }
  const f = sd.f, q = sub(p, f.o), h = dot(q, f.z), rho = Math.hypot(dot(q, f.x), dot(q, f.y)), m = add(f.o, add(scale(f.x, rho), scale(f.z, h)));
  return [nearestOn(sd.swept, x => len(sub(x, m))), Math.atan2(dot(q, f.y), dot(q, f.x))];
}
/** The smallest arc holding these angles (by the widest gap between them): its start and span. */
function arcHolding(angles: number[]): { start: number; span: number; ties: boolean } {
  const a = [...new Set(angles.map(wrap))].sort((x, y) => x - y);
  const gaps = a.map((x, i) => ({ size: i ? x - a[i - 1] : x + TAU - a[a.length - 1], start: x })).sort((x, y) => y.size - x.size);
  return { start: gaps[0].start, span: TAU - gaps[0].size, ties: gaps.length > 1 && gaps[0].size - gaps[1].size < 1e-6 };
}
/** A surface swept by a curve over the face's extent (its points `pts`), parametrized as STEP has it. */
function sweptPatch(sd: Extract<SurfDef, { kind: 'extrusion' } | { kind: 'revolution' }>, pts: readonly Point[], id: string, name: string): Surface {
  const coords = pts.map(p => sweptCoords(sd, p)), w = sd.swept;
  // The swept curve: a B-spline whole; a conic over the arc holding the face (a little more).
  let K: Curve;
  if (w.kind === 'curve') K = w.c;
  else { const h = arcHolding(coords.map(c => c[0])), m = Math.min(1e-3, (TAU - h.span) / 4); if (h.span > TAU - 1e-6) refuse(`a face once round a swept circle is not supported yet (${name})`); K = sweptCurve(w, h.start - m, h.start + h.span + m); }
  const cps = K.controlPoints as Point[];
  if (sd.kind === 'extrusion') {
    const vs = coords.map(c => c[1]), lo = Math.min(...vs), hi = Math.max(...vs), pad = Math.max(1e-6, 0.01 * (hi - lo)), v0 = lo - pad, v1 = hi + pad;
    return { kind: 'surface', id, degreeU: K.degree, degreeV: 1, knotsU: [...K.knots], knotsV: [0, 0, 1, 1], controlPoints: cps.map(P => [add(P, scale(sd.d, v0)), add(P, scale(sd.d, v1))]), weights: K.weights.map(x => [x, x]) };
  }
  const h = arcHolding(coords.map(c => c[1]));
  if (h.ties) refuse(`a face of revolution bounded by two meridians only is not supported yet (${name})`);
  if (h.span > TAU - 1e-6) refuse(`a face of revolution going once round without a seam is not supported (${name})`);
  const m = Math.min(1e-3, (TAU - h.span) / 4), f = sd.f;
  const ring = conicCurve({ kind: 'conic', f: { o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, a: 1, b: 1, t0: h.start - m, sweep: h.span + 2 * m }, 'r');
  // Each control point turns on its own circle: its radial part along the ring's (cos, sin)/w points.
  const at = (r: Point, P: Point): Point => { const q = sub(P, f.o), x = dot(q, f.x), z = dot(q, f.z); return add(f.o, add(scale(f.z, z), add(scale(f.x, x * r[0]), scale(f.y, x * r[1])))); };
  return { kind: 'surface', id, degreeU: 2, degreeV: K.degree, knotsU: ring.knots, knotsV: [...K.knots], controlPoints: ring.controlPoints.map(r => cps.map(P => at(r as Point, P))), weights: ring.weights.map(wu => K.weights.map(wv => wu * wv)) };
}
/** A geometry turned by `angle` about the axis through o along z. */
function turned(g: Geo, o: Point, z: Point, angle: number): Geo {
  const c = Math.cos(angle), sn = Math.sin(angle);
  const vec = (v: Point): Point => add(add(scale(v, c), scale(cross(z, v), sn)), scale(z, dot(z, v) * (1 - c)));
  const pt = (p: Point): Point => add(o, vec(sub(p, o)));
  if (g.kind === 'line') return { kind: 'line', p: pt(g.p), q: pt(g.q) };
  if (g.kind === 'conic') return { ...g, f: { o: pt(g.f.o), x: vec(g.f.x), y: vec(g.f.y), z: vec(g.f.z) } };
  return { kind: 'curve', c: { ...g.c, controlPoints: g.c.controlPoints.map(p => pt(p as Point)) } };
}

/** The profile of a surface of revolution between v0 and v1, as (ρ, h) control points, weights and knots. */
function profileOf(sd: Analytic, v0: number, v1: number): { pts: [number, number][]; w: number[]; knots: number[]; degree: number } {
  if (sd.kind === 'cylinder') return { pts: [[sd.r, v0], [sd.r, v1]], w: [1, 1], knots: [0, 0, 1, 1], degree: 1 };
  if (sd.kind === 'cone') return { pts: [[sd.r + v0 * sd.tan, v0], [sd.r + v1 * sd.tan, v1]], w: [1, 1], knots: [0, 0, 1, 1], degree: 1 };
  const [c, r] = sd.kind === 'sphere' ? [0, sd.r] : [sd.R, sd.r];
  const arc = conicCurve({ kind: 'conic', f: { o: [c, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, a: r, b: r, t0: v0, sweep: v1 - v0 }, 'p');
  return { pts: arc.controlPoints.map(p => [p[0], p[1]] as [number, number]), w: arc.weights, knots: arc.knots, degree: 2 };
}
/** The patch of a surface of revolution over angles [u0, u1] and profile [v0, v1]. */
function revolutionPatch(sd: Analytic, u0: number, u1: number, v0: number, v1: number, id: string): Surface {
  const ring = conicCurve({ kind: 'conic', f: { o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, a: 1, b: 1, t0: u0, sweep: u1 - u0 }, 'r'), prof = profileOf(sd, v0, v1), f = sd.f;
  const at = (ring2: Point, rho: number, h: number): Point => add(f.o, add(scale(f.x, rho * ring2[0]), add(scale(f.y, rho * ring2[1]), scale(f.z, h))));
  return { kind: 'surface', id, degreeU: 2, degreeV: prof.degree, knotsU: ring.knots, knotsV: prof.knots,
    controlPoints: ring.controlPoints.map(rp => prof.pts.map(([rho, h]) => at(rp, rho, h))), weights: ring.weights.map(wu => prof.w.map(wv => wu * wv)) };
}
/** The surface's own outward normal at a point (for the face's sense). */
function naturalNormal(sd: SurfDef, p: Point): Point {
  if (sd.kind === 'plane') return sd.f.z;
  if (sd.kind === 'bspline' || sd.kind === 'extrusion' || sd.kind === 'revolution') return [0, 0, 0];
  const d = sub(p, sd.f.o), h = dot(d, sd.f.z), radial = unit(sub(d, scale(sd.f.z, h)));
  if (sd.kind === 'cylinder') return radial;
  if (sd.kind === 'cone') return unit(sub(radial, scale(sd.f.z, sd.tan)));
  if (sd.kind === 'sphere') return unit(d);
  return unit(sub(d, scale(radial, sd.R)));
}

// ---- import ------------------------------------------------------------------------------------------
interface IEdge { id: string; geo: Geo; v: [string, string]; name?: string }
interface IUse { edge: string; fwd: boolean }
interface IFace { id: string; sd: SurfDef; same: boolean; loops: { outer: boolean; uses: IUse[] }[]; name?: string }

/** Reads the solids of a STEP file as one B-rep. */
export function importStep(source: string, options: { readonly id?: string } = {}): Brep {
  const data = parseData(source), id = options.id ?? 'step';
  const get = (v: Value | undefined): Entity => { if (!v || typeof v !== 'object' || !('ref' in v)) refuse('expected a reference'); const e = data.get((v as { ref: number }).ref); if (!e) refuse(`#${(v as { ref: number }).ref} is missing`); return e!; };
  const refNo = (v: Value) => (v as { ref: number }).ref, num = (v: Value) => v as number, list = (v: Value) => v as Value[], flag = (v: Value) => (v as { enum: string }).enum === 'T';
  const part = (e: Entity, type: string) => e.parts?.find(p => p.type === type);
  const pointOf = (v: Value): Point => { const e = get(v); if (e.type !== 'CARTESIAN_POINT') refuse(`expected a point, found ${e.type}`); return list(e.args[1]).map(num) as Point; };
  const dirOf = (v: Value): Point => unit(list(get(v).args[1]).map(num) as Point);
  const frameOf = (v: Value): Frame => { const a = get(v).args; const z = a[2] === null ? [0, 0, 1] as Point : dirOf(a[2]); let x = a[3] === null || a[3] === undefined ? (Math.abs(z[0]) < 0.9 ? [1, 0, 0] as Point : [0, 1, 0] as Point) : dirOf(a[3]); x = unit(sub(x, scale(z, dot(x, z)))); return { o: pointOf(a[1]), x, y: cross(z, x), z }; };

  // Vertices.
  const points = new Map<string, Point>();
  const vertexOf = (v: Value) => { const n = refNo(v), vid = `${id}_v${n}`; if (!points.has(vid)) points.set(vid, pointOf(get(v).args[1])); return vid; };

  // Edges, in their own direction (first vertex to second).
  const edges = new Map<string, IEdge>();
  const curveEntity = (e: Entity): Entity => {
    if (e.type === 'SURFACE_CURVE' || e.type === 'SEAM_CURVE') return curveEntity(get(e.args[1]));
    if (e.type === 'TRIMMED_CURVE') return curveEntity(get(e.args[1]));
    return e;
  };
  const geoOf = (raw: Entity, a: Point, b: Point, same: boolean): Geo => {
    const e = curveEntity(raw);
    if (e.type === 'LINE') return { kind: 'line', p: a, q: b };
    if (e.type === 'CIRCLE' || e.type === 'ELLIPSE') {
      const f = frameOf(e.args[1]), ra = num(e.args[2]), rb = e.type === 'ELLIPSE' ? num(e.args[3]) : ra;
      const ang = (p: Point) => { const d = sub(p, f.o); return Math.atan2(dot(d, f.y) / rb, dot(d, f.x) / ra); };
      // The curve runs counter-clockwise about its axis; the edge with it (same) or against it.
      const t0 = ang(a); let sweep = same ? wrap(ang(b) - t0) : -wrap(t0 - ang(b));
      if (Math.abs(sweep) <= 1e-12) sweep = same ? TAU : -TAU; // a closed edge goes once round
      return { kind: 'conic', f, a: ra, b: rb, t0, sweep };
    }
    const c = bsplineOf(e);
    if (!c) return refuse(`${e.type} curves are not supported yet`);
    return { kind: 'curve', c: same ? c : reverseCurve(c) };
  };
  function bsplineOf(e: Entity): Curve | null {
    let c: Curve | null = null;
    if (e.type === 'B_SPLINE_CURVE_WITH_KNOTS') { const g = e.args; c = { kind: 'curve', id: 'c', degree: num(g[1]), controlPoints: list(g[2]).map(pointOf), knots: expand(list(g[7]).map(num), list(g[6]).map(num)), weights: list(g[2]).map(() => 1) }; }
    else if (e.type === 'COMPLEX' && part(e, 'B_SPLINE_CURVE')) {
      const bc = part(e, 'B_SPLINE_CURVE')!.args, kn = part(e, 'B_SPLINE_CURVE_WITH_KNOTS')!.args, w = part(e, 'RATIONAL_B_SPLINE_CURVE');
      c = { kind: 'curve', id: 'c', degree: num(bc[0]), controlPoints: list(bc[1]).map(pointOf), knots: expand(list(kn[1]).map(num), list(kn[0]).map(num)), weights: w ? list(w.args[0]).map(num) : list(bc[1]).map(() => 1) };
    }
    return c;
  }
  /** A swept curve; a line gives an analytic surface instead (a plane, cylinder or cone), or null. */
  const sweptOf = (raw: Entity): Swept | { line: Point; dir: Point } => {
    const e = curveEntity(raw);
    if (e.type === 'LINE') return { line: pointOf(e.args[1]), dir: dirOf(get(e.args[2]).args[1]) };
    if (e.type === 'CIRCLE' || e.type === 'ELLIPSE') { const ra = num(e.args[2]); return { kind: 'conic', f: frameOf(e.args[1]), a: ra, b: e.type === 'ELLIPSE' ? num(e.args[3]) : ra }; }
    const c = bsplineOf(e);
    if (!c) return refuse(`surfaces swept by ${e.type} curves are not supported yet`);
    return { kind: 'curve', c };
  };
  const edgeOf = (v: Value): IEdge => {
    const n = refNo(v), eid = `${id}_e${n}`; let x = edges.get(eid); if (x) return x;
    const e = get(v); if (e.type !== 'EDGE_CURVE') refuse(`${e.type} edges are not supported`);
    const a = vertexOf(e.args[1]), b = vertexOf(e.args[2]);
    x = { id: eid, geo: geoOf(get(e.args[3]), points.get(a)!, points.get(b)!, flag(e.args[4])), v: [a, b], ...(e.args[0] ? { name: e.args[0] as string } : {}) };
    edges.set(eid, x); return x;
  };

  // Surfaces.
  const surfDefOf = (e: Entity): SurfDef => {
    if (e.type === 'PLANE') return { kind: 'plane', f: frameOf(e.args[1]) };
    if (e.type === 'CYLINDRICAL_SURFACE') return { kind: 'cylinder', f: frameOf(e.args[1]), r: num(e.args[2]) };
    if (e.type === 'CONICAL_SURFACE') return { kind: 'cone', f: frameOf(e.args[1]), r: num(e.args[2]), tan: Math.tan(num(e.args[3])) };
    if (e.type === 'SPHERICAL_SURFACE') return { kind: 'sphere', f: frameOf(e.args[1]), r: num(e.args[2]) };
    if (e.type === 'TOROIDAL_SURFACE') return { kind: 'torus', f: frameOf(e.args[1]), R: num(e.args[2]), r: num(e.args[3]) };
    if (e.type === 'B_SPLINE_SURFACE_WITH_KNOTS') {
      const g = e.args, rows = list(g[3]).map(r => list(r).map(pointOf));
      return { kind: 'bspline', s: { kind: 'surface', id: 's', degreeU: num(g[1]), degreeV: num(g[2]), controlPoints: rows, knotsU: expand(list(g[10]).map(num), list(g[8]).map(num)), knotsV: expand(list(g[11]).map(num), list(g[9]).map(num)), weights: rows.map(r => r.map(() => 1)) } };
    }
    if (e.type === 'COMPLEX' && part(e, 'B_SPLINE_SURFACE')) {
      const bs = part(e, 'B_SPLINE_SURFACE')!.args, kn = part(e, 'B_SPLINE_SURFACE_WITH_KNOTS')!.args, w = part(e, 'RATIONAL_B_SPLINE_SURFACE'), rows = list(bs[2]).map(r => list(r).map(pointOf));
      return { kind: 'bspline', s: { kind: 'surface', id: 's', degreeU: num(bs[0]), degreeV: num(bs[1]), controlPoints: rows, knotsU: expand(list(kn[2]).map(num), list(kn[0]).map(num)), knotsV: expand(list(kn[3]).map(num), list(kn[1]).map(num)), weights: w ? list(w.args[0]).map(r => list(r).map(num)) : rows.map(r => r.map(() => 1)) } };
    }
    if (e.type === 'SURFACE_OF_LINEAR_EXTRUSION') {
      const vec = get(e.args[2]), d = scale(dirOf(vec.args[1]), 1), w = sweptOf(get(e.args[1]));
      // σ = C(u) + v·V with V the vector (its magnitude scales v only: the patch spans the face).
      if ('line' in w) { const x = unit(w.dir), z = unit(cross(x, d)); if (!(len(cross(x, d)) > 1e-9)) refuse('an extrusion of a line along itself'); return { kind: 'plane', f: { o: w.line, x, y: cross(z, x), z } }; }
      return { kind: 'extrusion', swept: w, d };
    }
    if (e.type === 'SURFACE_OF_REVOLUTION') {
      const ax = get(e.args[2]), o = pointOf(ax.args[1]), z = ax.args[2] === null ? [0, 0, 1] as Point : dirOf(ax.args[2]), w = sweptOf(get(e.args[1]));
      // The meridian the curve lies in: from its points off the axis.
      const probe: Point[] = 'line' in w ? [w.line, add(w.line, w.dir)] : w.kind === 'curve' ? w.c.controlPoints as Point[] : [0, 1, 2, 3].map(k => sweptAt(w, k * Math.PI / 2));
      const radial = (p: Point) => { const q = sub(p, o); return sub(q, scale(z, dot(q, z))); };
      const far = probe.map(radial).reduce((m, r) => len(r) > len(m) ? r : m, [0, 0, 0] as Point);
      if (!(len(far) > 1e-9)) refuse('a surface of revolution of a curve on its axis');
      const x = unit(far), y = cross(z, x), size = Math.max(1, ...probe.map(p => len(sub(p, o))));
      if (probe.some(p => Math.abs(dot(radial(p), y)) > 1e-7 * size)) refuse('a surface of revolution of a curve off a plane through its axis is not supported yet');
      const f: Frame = { o, x, y, z };
      if ('line' in w) {
        // A line turned about the axis: a cylinder (parallel) or a cone.
        const dir = dot(w.dir, z) < 0 ? scale(w.dir, -1) : w.dir, along = dot(dir, z), q = sub(w.line, o);
        if (Math.abs(along) < 1e-9) refuse('a surface of revolution of a line square to its axis (a plane ring) is not supported yet');
        const t = -dot(q, z) / along, foot = add(w.line, scale(dir, t)), r = dot(sub(foot, o), x), slope = dot(dir, x) / along;
        const fr: Frame = { o, x, y, z };
        return Math.abs(slope) < 1e-12 ? { kind: 'cylinder', f: fr, r } : { kind: 'cone', f: fr, r, tan: slope };
      }
      return { kind: 'revolution', swept: w, f };
    }
    return refuse(`${e.type} surfaces are not supported yet`);
  };

  // Faces and bodies.
  const faces: IFace[] = [];
  const faceOf = (v: Value, k: number): IFace => {
    const e = get(v); if (e.type !== 'ADVANCED_FACE' && e.type !== 'FACE_SURFACE') refuse(`${e.type} faces are not supported`);
    const loops = list(e.args[1]).map(bv => {
      const b = get(bv), loop = get(b.args[1]);
      if (loop.type !== 'EDGE_LOOP') refuse(`${loop.type} bounds are not supported yet`);
      let uses = list(loop.args[1]).map(ov => { const o = get(ov); return { edge: edgeOf(o.args[3]).id, fwd: flag(o.args[4]) }; });
      if (!flag(b.args[2])) uses = [...uses].reverse().map(u => ({ edge: u.edge, fwd: !u.fwd }));
      return { outer: b.type === 'FACE_OUTER_BOUND', uses };
    });
    if (loops.length && !loops.some(l => l.outer)) loops[0].outer = true;
    return { id: `${id}_f${k}_${refNo(v)}`, sd: surfDefOf(get(e.args[2])), same: flag(e.args[3]), loops, ...(e.args[0] ? { name: e.args[0] as string } : {}) };
  };
  const shellFaces = (v: Value) => { const s = get(v); const shell = s.type === 'ORIENTED_CLOSED_SHELL' ? get(s.args[2]) : s; if (shell.type !== 'CLOSED_SHELL') refuse(`${shell.type} shells are not supported`); return list(shell.args[1]); };
  const bodies: { id: string; shells: { id: string; faces: IFace[] }[] }[] = [];
  let k = 0;
  for (const [n, e] of data) {
    if (e.type !== 'MANIFOLD_SOLID_BREP' && e.type !== 'BREP_WITH_VOIDS') continue;
    const shells = [e.args[1], ...(e.type === 'BREP_WITH_VOIDS' ? list(e.args[2]) : [])].map((sv, si) => {
      // (One at a time: a big file's faces spread into one call would overflow the stack.)
      const fs = shellFaces(sv).map(fv => faceOf(fv, k++)); for (const f of fs) faces.push(f); return { id: `${id}_sh${n}_${si}`, faces: fs };
    });
    bodies.push({ id: `${id}_b${n}`, shells });
  }
  // AP242 tessellated bodies (R3.5): facet faces, beside the B-rep solids (a convergent file holds both).
  const meshes = tessellatedBreps(data, id);
  if (!bodies.length) { if (meshes.length) return meshes.length === 1 ? meshes[0] : mergeBreps(meshes, { family: 'step', id }); refuse('no solid (MANIFOLD_SOLID_BREP, TESSELLATED_SOLID) in the file'); }

  // Splitting an edge at a fraction: a new vertex, two edges, every use replaced in loop order.
  let fresh = 0;
  const splitEdge = (eid: string, u: number): string => {
    const e = edges.get(eid)!, x = geoAt(e.geo, u), vid = `${id}_sv${fresh++}`;
    points.set(vid, x);
    const a: IEdge = { id: `${eid}_a${fresh}`, geo: geoPart(e.geo, 0, u, points.get(e.v[0])!, x), v: [e.v[0], vid], ...(e.name ? { name: e.name } : {}) };
    const b: IEdge = { id: `${eid}_b${fresh}`, geo: geoPart(e.geo, u, 1, x, points.get(e.v[1])!), v: [vid, e.v[1]], ...(e.name ? { name: e.name } : {}) };
    edges.delete(eid); edges.set(a.id, a); edges.set(b.id, b);
    for (const f of faces) for (const l of f.loops) l.uses = l.uses.flatMap(us => us.edge !== eid ? [us] : us.fwd ? [{ edge: a.id, fwd: true }, { edge: b.id, fwd: true }] : [{ edge: b.id, fwd: false }, { edge: a.id, fwd: false }]);
    return vid;
  };

  // Seams: a face once round its axis is cut in two at the opposite angle.
  for (const f of [...faces]) {
    if (!periodic(f.sd)) continue;
    const li = f.loops.findIndex(l => { const ids = l.uses.map(u => u.edge); return ids.some((x, i) => ids.indexOf(x) !== i); });
    if (li < 0) continue;
    const loop = f.loops[li], holes = f.loops.filter((_, k) => k !== li);
    const ids = loop.uses.map(u => u.edge), seam = ids.find((x, i) => ids.indexOf(x) !== i)!, i1 = ids.indexOf(seam), i2 = ids.lastIndexOf(seam);
    const n = loop.uses.length, rot = [...loop.uses.slice(i1), ...loop.uses.slice(0, i1)], j = (i2 - i1 + n) % n;
    const sPlus = rot[0], c1 = rot.slice(1, j), c2 = rot.slice(j + 1);
    const sd = f.sd, seamAngle = natural(sd, geoAt(edges.get(seam)!.geo, 0.5))[0];
    // The cut goes half round from the seam, or where it is clearest of the face's holes.
    const extents = holes.map(h => arcHolding(h.uses.flatMap(us => Array.from({ length: 9 }, (_, i) => natural(sd, geoAt(edges.get(us.edge)!.geo, i / 8))[0]))));
    const inside = (a: number, x: { start: number; span: number }) => wrap(a - x.start) <= x.span;
    if (extents.some(x => inside(seamAngle, x))) refuse(`a hole across the seam of a face once round its axis is not supported yet (${f.name || f.id})`);
    const clearance = (a: number) => Math.min(wrap(a - seamAngle), wrap(seamAngle - a), ...extents.map(x => inside(a, x) ? -1 : Math.min(wrap(x.start - a), wrap(a - x.start - x.span))));
    let cut = seamAngle + Math.PI;
    if (extents.length && extents.some(x => inside(cut, x) || clearance(cut) < 1e-3)) {
      let best = -Infinity;
      for (let k = 1; k < 720; k++) { const a = seamAngle + TAU * k / 720, c = clearance(a); if (c > best) { best = c; cut = a; } }
      if (!(best > 1e-6)) refuse(`the holes of a face once round its axis leave no room to cut it (${f.name || f.id})`);
    }
    // Where a chain crosses the cut angle (by bisection on the edge holding it): a vertex there.
    const meet = (chain: IUse[]): string | null => {
      if (!chain.length) return null; // the chain is a point (a pole)
      for (const us of chain) {
        const e = edges.get(us.edge)!, g = (u: number) => { const d = wrap(natural(sd, geoAt(e.geo, u))[0] - cut + Math.PI) - Math.PI; return d; };
        const N = 64; let prev = g(0);
        for (let s = 1; s <= N; s++) {
          const cur = g(s / N);
          if (Math.abs(cur) < 1e-12) return s === N ? e.v[1] : splitEdge(e.id, s / N);
          if (prev * cur < 0 && Math.abs(prev - cur) < Math.PI) {
            let lo = (s - 1) / N, hi = s / N; for (let it = 0; it < 80; it++) { const m = (lo + hi) / 2; if (g(m) * prev > 0) lo = m; else hi = m; }
            const u = (lo + hi) / 2;
            if (u * len(sub(points.get(e.v[1])!, points.get(e.v[0])!)) < 1e-9 && u < 1e-9) return e.v[0];
            return splitEdge(e.id, u);
          }
          prev = cur;
        }
      }
      return refuse(`a face once round its axis whose boundary never reaches the opposite side (${f.name || f.id})`);
    };
    const seamFrom = (us: IUse) => { const e = edges.get(us.edge)!; return us.fwd ? e.v[0] : e.v[1]; };
    const seamTo = (us: IUse) => { const e = edges.get(us.edge)!; return us.fwd ? e.v[1] : e.v[0]; };
    const Q1 = seamFrom(sPlus), Q2 = seamTo(sPlus);
    const P2 = meet(c1) ?? Q2, P1 = meet(c2) ?? Q1;
    // The chains again (split edges replaced), each cut at its new vertex.
    const fresh1 = f.loops[li].uses, s1 = fresh1.findIndex(u => u.edge === seam && u.fwd === sPlus.fwd);
    const R = [...fresh1.slice(s1), ...fresh1.slice(0, s1)], jj = R.findIndex((u, i) => i > 0 && u.edge === seam);
    const C1 = R.slice(1, jj), C2 = R.slice(jj + 1);
    const cutAt = (chain: IUse[], P: string) => { const at = chain.findIndex(u => seamFrom(u) === P); return at < 0 ? [chain, []] : [chain.slice(0, at), chain.slice(at)]; };
    const [C1a, C1b] = cutAt(C1, P2), [C2a, C2b] = cutAt(C2, P1);
    // The new edge along the cut, from P1 to P2: a generator, or an arc of the profile (sphere, torus).
    const p1 = points.get(P1)!, p2 = points.get(P2)!, sid = `${f.id}_cut`;
    let geo: Geo;
    if (sd.kind === 'revolution') {
      // The seam turned onto the cut: its ends turn onto P1 and P2.
      const sg = edges.get(seam)!, forward = seamFrom(sPlus) === sg.v[0], g = turned(sg.geo, sd.f.o, sd.f.z, cut - seamAngle);
      geo = forward ? g : g.kind === 'line' ? { kind: 'line', p: g.q, q: g.p } : g.kind === 'conic' ? { ...g, t0: g.t0 + g.sweep, sweep: -g.sweep } : { kind: 'curve', c: reverseCurve(g.c) };
      if (len(sub(geoAt(geo, 0), p1)) > 1e-6 * Math.max(1, len(p1)) || len(sub(geoAt(geo, 1), p2)) > 1e-6 * Math.max(1, len(p2))) refuse(`a face of revolution whose seam does not turn onto its opposite side is not supported yet (${f.name || f.id})`);
    } else if (sd.kind === 'cylinder' || sd.kind === 'cone') geo = { kind: 'line', p: p1, q: p2 };
    else {
      const s = sd as Extract<SurfDef, { kind: 'sphere' } | { kind: 'torus' }>, e1 = add(scale(s.f.x, Math.cos(cut)), scale(s.f.y, Math.sin(cut))), centre = s.kind === 'sphere' ? s.f.o : add(s.f.o, scale(e1, s.R)), r = s.r;
      const fr: Frame = { o: centre, x: e1, y: s.f.z, z: cross(e1, s.f.z) }, ang = (p: Point) => Math.atan2(dot(sub(p, centre), fr.y), dot(sub(p, centre), fr.x));
      const t0 = ang(p1), t1 = ang(p2), mid = natural(sd, geoAt(edges.get(seam)!.geo, 0.5))[1];
      // The arc through the seam's own latitude range.
      const ccw = wrap(t1 - t0), via = wrap(mid - t0);
      geo = { kind: 'conic', f: fr, a: r, b: r, t0, sweep: via <= ccw ? ccw : ccw - TAU };
    }
    edges.set(sid, { id: sid, geo, v: [P1, P2] });
    // The halves are named as any face split in two: name#1, name#2.
    const half = (uses: IUse[], suffix: string, k: number): IFace => ({ ...f, id: `${f.id}${suffix}`, loops: [{ outer: true, uses }], ...(f.name ? { name: `${f.name}#${k}` } : {}) });
    const A = half([R[0], ...C1a, { edge: sid, fwd: false }, ...C2b], '_a', 1), B = half([{ edge: sid, fwd: true }, ...C1b, R[jj], ...C2a], '_b', 2);
    // Each hole goes with the half on its side of the cut (the half from the seam towards A's chain).
    if (holes.length) {
      const relCut = wrap(cut - seamAngle), probe = [...C1a, ...C2b][0], aLow = probe ? wrap(natural(sd, geoAt(edges.get(probe.edge)!.geo, 0.5))[0] - seamAngle) < relCut : true;
      holes.forEach((h, k) => { const x = extents[k], mid = x.start + x.span / 2, low = wrap(mid - seamAngle) < relCut; (low === aLow ? A : B).loops.push({ outer: false, uses: h.uses }); });
    }
    faces.splice(faces.indexOf(f), 1, A, B);
    for (const b of bodies) for (const sh of b.shells) { const at = sh.faces.indexOf(f); if (at >= 0) sh.faces.splice(at, 1, A, B); }
  }
  // Closed edges (one vertex at both ends) are split in two.
  for (const e of [...edges.values()]) if (e.v[0] === e.v[1]) splitEdge(e.id, 0.5);

  // Patches over each face's extent.
  const curves = new Map<string, Curve>();
  for (const e of edges.values()) {
    const c = toCurve(e.geo, e.id), cp = c.controlPoints as Point[];
    cp[0] = points.get(e.v[0])!; cp[cp.length - 1] = points.get(e.v[1])!; curves.set(e.id, c);
  }
  // Boundary samples along each loop in its own direction.
  const loopPoints = (f: IFace) => f.loops.map(l => l.uses.flatMap(us => { const c = curves.get(us.edge)!, [t0, t1] = curveDomain(c), ps = Array.from({ length: 9 }, (_, i) => evaluateCurve(c, t0 + (t1 - t0) * i / 8)); return us.fwd ? ps : ps.reverse(); }));
  const boundaryOf = (f: IFace) => loopPoints(f).flat();
  const surfaceFor = (f: IFace): { surface: Surface; sense: 'forward' | 'reversed' } => {
    const sd = f.sd, pts = boundaryOf(f), sid = `${f.id}_s`;
    let surface: Surface;
    if (sd.kind === 'bspline') return { surface: { ...sd.s, id: sid }, sense: f.same ? 'forward' : 'reversed' };
    // Swept surfaces are parametrized as STEP has them, so the face's sense is its own.
    if (sd.kind === 'extrusion' || sd.kind === 'revolution') return { surface: sweptPatch(sd, pts, sid, f.name || f.id), sense: f.same ? 'forward' : 'reversed' };
    if (sd.kind === 'plane') {
      const p = sd.f, uv = pts.map(q => [dot(sub(q, p.o), p.x), dot(sub(q, p.o), p.y)]);
      const pad = 1 + 0.01 * Math.max(1, ...uv.flat().map(Math.abs)), u0 = Math.min(...uv.map(q => q[0])) - pad, u1 = Math.max(...uv.map(q => q[0])) + pad, v0 = Math.min(...uv.map(q => q[1])) - pad, v1 = Math.max(...uv.map(q => q[1])) + pad;
      const at = (u: number, v: number): Point => add(p.o, add(scale(p.x, u), scale(p.y, v)));
      surface = { kind: 'surface', id: sid, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[at(u0, v0), at(u0, v1)], [at(u1, v0), at(u1, v1)]], weights: [[1, 1], [1, 1]] };
    } else {
      // Angles: the smallest arc holding every boundary point (by the widest gap between them).
      const nat = pts.map(p => natural(sd, p)), angles = [...new Set(nat.map(q => wrap(q[0])))].sort((a, b) => a - b);
      const gaps = angles.map((a, i) => ({ size: (i ? a - angles[i - 1] : a + TAU - angles[angles.length - 1]), start: a })).sort((x, y) => y.size - x.size), an = sd as Analytic;
      const vs = nat.map(q => q[1]), vlo = Math.min(...vs), vhi = Math.max(...vs), dv = Math.max(1e-6, (vhi - vlo) * 0.01);
      let v0 = vlo - dv, v1 = vhi + dv;
      if (sd.kind === 'sphere') { v0 = Math.max(-Math.PI / 2, v0); v1 = Math.min(Math.PI / 2, v1); }
      // The face lies across the widest gap's complement; two equal gaps (a half bounded only by two
      // meridians) are told apart by the loops' turning about the surface's normal.
      let pick = gaps[0];
      if (gaps.length > 1 && gaps[0].size - gaps[1].size < 1e-6) {
        let area: Point = [0, 0, 0];
        for (const ring of loopPoints(f)) for (let i = 0; i < ring.length; i++) area = add(area, scale(cross(ring[i], ring[(i + 1) % ring.length]), 0.5));
        const score = (g: { size: number; start: number }) => { const mid = g.start + (TAU - g.size) / 2, vm = (vlo + vhi) / 2, probe = revolutionPatch(an, mid - 1e-3, mid + 1e-3, vm - 1e-3, vm + 1e-3, 'probe'), P = probe.controlPoints[1][Math.floor(probe.controlPoints[1].length / 2)] as Point; return dot(area, naturalNormal(sd, P)) * (f.same ? 1 : -1); };
        if (score(gaps[1]) > score(gaps[0])) pick = gaps[1];
      }
      const span = TAU - pick.size, margin = Math.min(1e-3, pick.size / 4);
      if (span > TAU - 1e-6) refuse(`a face going once round its axis without a seam is not supported (${f.name || f.id})`);
      surface = revolutionPatch(an, pick.start - margin, pick.start + span + margin, v0, v1, sid);
    }
    // The face's sense: its surface's outward normal (or the reverse) against the patch's own.
    const S = surface, P = S.controlPoints as Point[][], m = Math.floor(P.length / 2), n2 = Math.floor(P[0].length / 2);
    const own = cross(sub(P[Math.min(P.length - 1, m + 1)][n2], P[Math.max(0, m - 1)][n2]), sub(P[m][Math.min(P[0].length - 1, n2 + 1)], P[m][Math.max(0, n2 - 1)]));
    const natN = naturalNormal(sd, P[m][n2]);
    return { surface, sense: (dot(own, natN) >= 0) === f.same ? 'forward' : 'reversed' };
  };

  // Names a file repeats (several bodies exported with the same feature names) are numbered in file order,
  // as pieces of one face are: name#1, name#2 (a B-rep's names are unique).
  const faceNames = renumbered(bodies.flatMap(b => b.shells.flatMap(sh => sh.faces.map(f => f.name)))), edgeNames = renumbered([...edges.values()].map(e => e.name));
  let fi = 0, ei = 0;
  for (const b of bodies) for (const sh of b.shells) for (const f of sh.faces) { const n = faceNames[fi++]; if (n !== undefined) f.name = n; }
  for (const e of edges.values()) { const n = edgeNames[ei++]; if (n !== undefined) e.name = n; }
  // The file's distance accuracy, where it is larger than the 1e-6 mm this writer gives exact bodies (a tolerant B-rep's,
  // D110): its entities' tolerance, at most 1e-5 of the model's size.
  let accuracy = 0;
  for (const e of data.values()) if (e.type === 'UNCERTAINTY_MEASURE_WITH_UNIT' && e.args[2] === 'distance_accuracy_value') { const m = e.args[0] as { type?: string; args?: Value[] } | number; const x = typeof m === 'number' ? m : Array.isArray(m?.args) ? m.args[0] as number : NaN; if (Number.isFinite(x)) accuracy = Math.max(accuracy, x); }
  let extent = 0;
  for (const p of points.values()) for (const x of p) extent = Math.max(extent, Math.abs(x));
  const tolerant = accuracy > 1e-6 * (1 + 1e-9) ? Math.min(accuracy, 1e-5 * Math.max(1, extent)) : undefined;
  const brep = buildBrep({
    ...(tolerant ? { toleranceMM: tolerant } : {}),
    source: { family: 'step', id },
    vertices: [...points].map(([vid, point]) => ({ id: vid, point })),
    edges: [...edges.values()].map(e => ({ id: e.id, curve: curves.get(e.id)!, vertices: e.v, ...(e.name ? { name: e.name } : {}) })),
    bodies: bodies.map(b => ({ id: b.id, kind: 'solid' as const, shells: b.shells.map(sh => ({ id: sh.id, closed: true, faces: sh.faces.map(f => {
      const { surface, sense } = surfaceFor(f);
      return { id: f.id, surface, sense, loops: f.loops.map(l => ({ kind: (l.outer ? 'outer' : 'inner') as 'outer' | 'inner', uses: l.uses.map(us => ({ edge: us.edge, sense: (us.fwd ? 'forward' : 'reversed') as 'forward' | 'reversed' })) })), ...(f.name ? { name: f.name } : {}) };
    }) })) })),
  });
  // Unnamed edges are named by their two faces (as edges of any body), numbered where that repeats.
  const faceName = new Map(brep.faces.map(f => [f.id, f.name ?? f.id])), loopFace = new Map(brep.loops.map(l => [l.id, l.face]));
  const byEdge = new Map<string, string[]>(); for (const c of brep.coedges) byEdge.set(c.edge, [...(byEdge.get(c.edge) ?? []), faceName.get(loopFace.get(c.loop)!)!]);
  const base = (eid: string) => [...new Set(byEdge.get(eid))].sort().join('|'), count = new Map<string, number>(), seen = new Map<string, number>();
  for (const e of brep.edges) if (!e.name) count.set(base(e.id), (count.get(base(e.id)) ?? 0) + 1);
  const analytic: Brep = { ...brep, edges: brep.edges.map(e => { if (e.name) return e; const b = base(e.id), k = (seen.get(b) ?? 0) + 1; seen.set(b, k); return { ...e, name: count.get(b)! > 1 ? `${b}#${k}` : b }; }) };
  return meshes.length ? mergeBreps([analytic, ...meshes], { family: 'step', id }) : analytic;
}

/** A STEP file's tessellated solids and shells as triangle meshes: each one's corners, triangles, faces (per triangle) and face names. */
interface StepMesh { readonly id: string; readonly name: string; readonly positions: Float64Array; readonly indices: Uint32Array; readonly faces: Int32Array; readonly faceNames: readonly string[]; readonly shell: boolean }
function tessellatedMeshes(data: Map<number, Entity>, id: string): StepMesh[] {
  const get = (v: Value): Entity => { const e = v && typeof v === 'object' && 'ref' in v ? data.get((v as { ref: number }).ref) : undefined; if (!e) refuse('expected a reference to an instance in the file'); return e!; };
  const out: StepMesh[] = [];
  for (const [n, e] of data) {
    if (e.type !== 'TESSELLATED_SOLID' && e.type !== 'TESSELLATED_SHELL') continue;
    const positions: number[] = [], indices: number[] = [], faces: number[] = [], names: string[] = [], base = new Map<number, number>();
    (e.args[1] as Value[]).forEach((fv, k) => {
      const f = get(fv);
      if (f.type !== 'TRIANGULATED_FACE') refuse(`${f.type} tessellated faces are not supported yet`);
      const listRef = (f.args[1] as { ref: number }).ref, coords = get(f.args[1]);
      if (coords.type !== 'COORDINATES_LIST') refuse(`${coords.type} coordinates are not supported`);
      let at = base.get(listRef);
      if (at === undefined) { at = positions.length / 3; base.set(listRef, at); for (const p of coords.args[2] as Value[]) for (const x of p as Value[]) positions.push(x as number); }
      const pn = (f.args[5] as Value[]).map(x => x as number), count = (coords.args[2] as Value[]).length;
      for (const t of f.args[6] as Value[]) {
        const corner = (t as Value[]).map(x => x as number);
        if (corner.length !== 3) refuse('a triangulated face with a triangle of other than three corners');
        for (const c of corner) { const j = pn.length ? pn[c - 1] - 1 : c - 1; if (!(j >= 0 && j < count)) refuse('a triangle names a corner the coordinates list does not have'); indices.push(at + j); }
        faces.push(k);
      }
      names.push(typeof f.args[0] === 'string' && f.args[0] ? f.args[0] : `face${k}`);
    });
    out.push({ id: `${id}_t${n}`, name: typeof e.args[0] === 'string' && e.args[0] ? e.args[0] : `mesh${n}`, positions: Float64Array.from(positions), indices: Uint32Array.from(indices), faces: Int32Array.from(faces), faceNames: renumbered(names).map(x => x!), shell: e.type === 'TESSELLATED_SHELL' });
  }
  return out;
}
/**
 * The tessellated bodies as facet B-reps: each triangulated face's triangles kept to faces of their own, named as in
 * the file. A tessellated solid that does not close, or a tessellated shell, comes in as an open sheet (said so,
 * never closed by guessing: the studio offers its repair).
 */
function tessellatedBreps(data: Map<number, Entity>, id: string): Brep[] {
  return tessellatedMeshes(data, id).map(m => {
    const o = { id: m.id, groups: m.faces, groupName: (g: number) => m.faceNames[g], maximumTriangles: Infinity };
    if (!m.shell) {
      try { return facetBrepFromTriangles(m.positions, m.indices, o); }
      catch (e) {
        if (!(e instanceof MeshBrepError) || !/not closed|more than one piece|pieces/.test(e.message)) throw e;
        // (A closed hollow solid — a mesh shelled, R11.3, D114 — in pieces: the largest its outside, the others its voids.)
        if (!/not closed/.test(e.message)) {
          const pieces = facetBrepsFromTriangles(m.positions, m.indices, o).map(b => ({ b, v: Math.abs(brepMassProperties(b, 1).volumeMM3) })).sort((x, y) => y.v - x.v);
          // (Only pieces inside the largest are voids; lumps apart are the file's to name as bodies of their own.)
          if (pieces.slice(1).every(p => classifyPointInFacets(pieces[0].b, p.b.vertices[0].point) === 'inside')) return pieces.slice(1).reduce((acc, p) => withCavities(acc, p.b, { family: 'step', id: m.id }), pieces[0].b);
          throw e;
        }
      }
    }
    return facetBrepFromTriangles(m.positions, m.indices, { ...o, open: true });
  });
}
/**
 * A STEP file's tessellated meshes — every one when the file holds nothing else (no B-rep solid), else null — for the
 * studio to check and repair as a mesh (M3) before it becomes a part.
 */
export function stepMeshes(source: string): { name: string; positions: Float64Array; indices: Uint32Array }[] | null {
  const data = parseData(source);
  for (const e of data.values()) if (e.type === 'MANIFOLD_SOLID_BREP' || e.type === 'BREP_WITH_VOIDS') return null;
  const meshes = tessellatedMeshes(data, 'step');
  return meshes.length ? meshes.map(m => ({ name: m.name, positions: m.positions, indices: m.indices })) : null;
}
const TESSELLATED_RECORDS = ['COORDINATES_LIST(', 'TRIANGULATED_FACE('];
/**
 * How many of a STEP file's characters hold tessellated geometry (its COORDINATES_LIST and TRIANGULATED_FACE records,
 * COMPLEX_TRIANGULATED_FACE alike), found by a scan without parsing: the import's size caps tell a mesh file from a
 * B-rep one by it (D49). A record runs from its keyword to the next ';' — a ';' in a quoted name ends it early, so
 * it is counted short, never long.
 */
export function stepTessellatedChars(source: string): number {
  let total = 0;
  for (const word of TESSELLATED_RECORDS) {
    for (let at = source.indexOf(word); at >= 0; at = source.indexOf(word, at)) {
      const end = source.indexOf(';', at);
      if (end < 0) { total += source.length - at; break; }
      total += end - at; at = end;
    }
  }
  return total;
}

/** Names, those that occur more than once numbered in order of occurrence (`name#1`, `name#2`…); missing ones stay missing. */
function renumbered(names: readonly (string | undefined)[]): (string | undefined)[] {
  const count = new Map<string, number>(), seen = new Map<string, number>();
  for (const n of names) if (n) count.set(n, (count.get(n) ?? 0) + 1);
  return names.map(n => { if (!n || count.get(n)! < 2) return n; const k = (seen.get(n) ?? 0) + 1; seen.set(n, k); return `${n}#${k}`; });
}

/** A STEP file's geometric validation properties (CAx-IF), as written for its part; each may be missing. */
export interface StepValidationProperties {
  readonly volumeMM3?: number; readonly areaMM2?: number; readonly centroidMM?: Point;
  readonly box?: { readonly min: Point; readonly max: Point };
}
/**
 * The validation properties a STEP file carries: PROPERTY_DEFINITIONs named 'geometric validation property'
 * whose representations are 'volume', 'surface area', 'centroid' or 'bounding box' (values in mm).
 */
export function stepValidationProperties(source: string): StepValidationProperties {
  const data = parseData(source), out: { volumeMM3?: number; areaMM2?: number; centroidMM?: Point; box?: { min: Point; max: Point } } = {};
  const ref = (v: Value) => (v && typeof v === 'object' && 'ref' in v ? (v as { ref: number }).ref : -1);
  const gvp = new Set<number>();
  for (const [k, e] of data) if (e.type === 'PROPERTY_DEFINITION' && e.args[0] === 'geometric validation property') gvp.add(k);
  for (const e of data.values()) {
    if (e.type !== 'PROPERTY_DEFINITION_REPRESENTATION' || !gvp.has(ref(e.args[0]))) continue;
    const rep = data.get(ref(e.args[1])); if (!rep || !Array.isArray(rep.args[1])) continue;
    const items = (rep.args[1] as Value[]).map(v => data.get(ref(v))).filter((x): x is Entity => !!x);
    const measure = () => { const m = items.find(x => x.type === 'MEASURE_REPRESENTATION_ITEM')?.args[1]; return m && typeof m === 'object' && 'args' in m ? Number((m as { args: Value[] }).args[0]) : undefined; };
    const pointNamed = (name?: string) => { const p = items.find(x => x.type === 'CARTESIAN_POINT' && (name === undefined || x.args[0] === name)); return p ? (p.args[1] as Value[]).map(Number) as Point : undefined; };
    if (rep.args[0] === 'volume') out.volumeMM3 = measure();
    else if (rep.args[0] === 'surface area') out.areaMM2 = measure();
    else if (rep.args[0] === 'centroid') out.centroidMM = pointNamed();
    else if (rep.args[0] === 'bounding box') { const min = pointNamed('minimum point'), max = pointNamed('maximum point'); if (min && max) out.box = { min, max }; }
  }
  return out;
}

/** One property compared: the file's value, the model's, and the difference measured against its limit. */
export interface ValidationCheck { readonly expected: number | Point; readonly actual: number | Point; readonly difference: number; readonly limit: number; readonly ok: boolean }
/**
 * The file's validation properties against the model read from it (its volume, area and centroid as measured
 * here). Limits are CAx-IF's: volume and area within 1 %, the centroid within 0.1 % of the box's diagonal.
 */
export function compareValidationProperties(expected: StepValidationProperties, actual: { readonly volumeMM3: number; readonly areaMM2: number; readonly centroidMM: Point; readonly box: { readonly min: Point; readonly max: Point } }): { readonly volume?: ValidationCheck; readonly area?: ValidationCheck; readonly centroid?: ValidationCheck; readonly ok: boolean } {
  const rel = (e: number, a: number): ValidationCheck => ({ expected: e, actual: a, difference: Math.abs(a - e) / Math.max(Math.abs(e), 1e-300), limit: 0.01, ok: Math.abs(a - e) <= 0.01 * Math.abs(e) });
  const box = expected.box ?? actual.box, diagonal = Math.hypot(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]);
  const volume = expected.volumeMM3 === undefined ? undefined : rel(expected.volumeMM3, actual.volumeMM3);
  const area = expected.areaMM2 === undefined ? undefined : rel(expected.areaMM2, actual.areaMM2);
  const centroid = expected.centroidMM === undefined ? undefined : (() => { const d = Math.hypot(...[0, 1, 2].map(k => actual.centroidMM[k] - expected.centroidMM![k])); return { expected: expected.centroidMM!, actual: actual.centroidMM, difference: d, limit: 1e-3 * diagonal, ok: d <= 1e-3 * diagonal }; })();
  return { ...(volume ? { volume } : {}), ...(area ? { area } : {}), ...(centroid ? { centroid } : {}), ok: [volume, area, centroid].every(c => !c || c.ok) };
}

// STEP (ISO 10303-21) import of B-rep solids into the shared B-rep, where every face is a bounded
// NURBS patch without seams and every edge has two vertices.
//
//   surfaces   PLANE; CYLINDRICAL, CONICAL, SPHERICAL and TOROIDAL_SURFACE as exact rational patches of
//              revolution over the face's extent (the profile — line or arc — turned through the face's
//              angles); B-spline surfaces (rational or not) as they are
//   curves     LINE; CIRCLE and ELLIPSE as rational quadratic arcs; B-spline curves; SURFACE_CURVE,
//              SEAM_CURVE and TRIMMED_CURVE by their 3D curve
//   seams      a face going once round its axis (a cylinder's wall bounded by two circles and a seam
//              edge used twice) is cut in two at the opposite angle: the circles are split there (and
//              so in their other faces' loops too), and the halves meet along a new edge
//   closed     an edge starting and ending at one vertex is split in two
//
// Other entities (surfaces of revolution or extrusion, offset surfaces, vertex loops, faces with a
// seam and holes) are refused by name.
import { BrepError, buildBrep, type Brep } from './brep-core.js';
import { curveDomain, evaluateCurve } from './math.js';
import { add, cross, dot, len, scale, sub, unit } from './vec3.js';
import type { Curve, Point, Surface } from './types.js';

// ---- Part 21 -----------------------------------------------------------------------------------------
type Value = number | string | { ref: number } | { enum: string } | null | '*' | Value[] | { type: string; args: Value[] };
interface Entity { type: string; args: Value[]; parts?: { type: string; args: Value[] }[] }
const refuse = (detail: string): never => { throw new BrepError('INPUT', 'STEP: ' + detail); };

/** The DATA section's instances: simple ones and complex ones (as their partial entities). */
function parseData(source: string): Map<number, Entity> {
  const data = /DATA;([\s\S]*?)ENDSEC;/.exec(source.replace(/\/\*[\s\S]*?\*\//g, ''));
  if (!data) refuse('no DATA section');
  const s = data![1], out = new Map<number, Entity>();
  let i = 0;
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  const value = (): Value => {
    ws();
    const c = s[i];
    if (c === '(') { i++; const list: Value[] = []; ws(); if (s[i] === ')') { i++; return list; } for (;;) { list.push(value()); ws(); if (s[i] === ',') { i++; continue; } if (s[i] === ')') { i++; return list; } refuse(`bad list near ${s.slice(i, i + 20)}`); } }
    if (c === "'") { let t = ''; i++; for (;;) { if (i >= s.length) refuse('unterminated string'); if (s[i] === "'") { if (s[i + 1] === "'") { t += "'"; i += 2; continue; } i++; return t; } t += s[i++]; } }
    if (c === '#') { i++; const m = /^\d+/.exec(s.slice(i))!; i += m[0].length; return { ref: Number(m[0]) }; }
    if (c === '.') { const m = /^\.([A-Z0-9_]+)\./.exec(s.slice(i)); if (!m) refuse('bad enumeration'); i += m![0].length; return { enum: m![1] }; }
    if (c === '$') { i++; return null; }
    if (c === '*') { i++; return '*'; }
    const num = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i));
    if (num) { i += num[0].length; return Number(num[0]); }
    const word = /^[A-Z_][A-Z0-9_]*/.exec(s.slice(i));
    if (word) { i += word[0].length; ws(); const args = value(); return { type: word[0], args: args as Value[] }; } // a typed parameter (LENGTH_MEASURE(…))
    return refuse(`unexpected ${s.slice(i, i + 20)}`);
  };
  while (i < s.length) {
    ws(); if (i >= s.length) break;
    const head = /^#(\d+)\s*=\s*/.exec(s.slice(i)); if (!head) refuse(`expected an instance near ${s.slice(i, i + 30)}`);
    i += head![0].length; ws();
    if (s[i] === '(') {
      i++; const parts: { type: string; args: Value[] }[] = [];
      for (;;) { ws(); if (s[i] === ')') { i++; break; } const w = /^[A-Z_][A-Z0-9_]*/.exec(s.slice(i)); if (!w) refuse('bad complex instance'); i += w![0].length; parts.push({ type: w![0], args: value() as Value[] }); }
      out.set(Number(head![1]), { type: 'COMPLEX', args: [], parts });
    } else {
      const w = /^[A-Z_][A-Z0-9_]*/.exec(s.slice(i)); if (!w) refuse('expected an entity name');
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
type SurfDef = { kind: 'plane'; f: Frame } | { kind: 'cylinder'; f: Frame; r: number } | { kind: 'cone'; f: Frame; r: number; tan: number } | { kind: 'sphere'; f: Frame; r: number } | { kind: 'torus'; f: Frame; R: number; r: number } | { kind: 'bspline'; s: Surface };

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
  if (sd.kind === 'plane' || sd.kind === 'bspline') return [0, 0];
  const d = sub(p, sd.f.o), u = Math.atan2(dot(d, sd.f.y), dot(d, sd.f.x)), h = dot(d, sd.f.z), rho = Math.hypot(dot(d, sd.f.x), dot(d, sd.f.y));
  if (sd.kind === 'cylinder' || sd.kind === 'cone') return [u, h];
  if (sd.kind === 'sphere') return [u, Math.atan2(h, rho)];
  return [u, Math.atan2(h, rho - sd.R)];
}
const periodic = (sd: SurfDef) => sd.kind === 'cylinder' || sd.kind === 'cone' || sd.kind === 'sphere' || sd.kind === 'torus';

/** The profile of a surface of revolution between v0 and v1, as (ρ, h) control points, weights and knots. */
function profileOf(sd: Exclude<SurfDef, { kind: 'plane' } | { kind: 'bspline' }>, v0: number, v1: number): { pts: [number, number][]; w: number[]; knots: number[]; degree: number } {
  if (sd.kind === 'cylinder') return { pts: [[sd.r, v0], [sd.r, v1]], w: [1, 1], knots: [0, 0, 1, 1], degree: 1 };
  if (sd.kind === 'cone') return { pts: [[sd.r + v0 * sd.tan, v0], [sd.r + v1 * sd.tan, v1]], w: [1, 1], knots: [0, 0, 1, 1], degree: 1 };
  const [c, r] = sd.kind === 'sphere' ? [0, sd.r] : [sd.R, sd.r];
  const arc = conicCurve({ kind: 'conic', f: { o: [c, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, a: r, b: r, t0: v0, sweep: v1 - v0 }, 'p');
  return { pts: arc.controlPoints.map(p => [p[0], p[1]] as [number, number]), w: arc.weights, knots: arc.knots, degree: 2 };
}
/** The patch of a surface of revolution over angles [u0, u1] and profile [v0, v1]. */
function revolutionPatch(sd: Exclude<SurfDef, { kind: 'plane' } | { kind: 'bspline' }>, u0: number, u1: number, v0: number, v1: number, id: string): Surface {
  const ring = conicCurve({ kind: 'conic', f: { o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, a: 1, b: 1, t0: u0, sweep: u1 - u0 }, 'r'), prof = profileOf(sd, v0, v1), f = sd.f;
  const at = (ring2: Point, rho: number, h: number): Point => add(f.o, add(scale(f.x, rho * ring2[0]), add(scale(f.y, rho * ring2[1]), scale(f.z, h))));
  return { kind: 'surface', id, degreeU: 2, degreeV: prof.degree, knotsU: ring.knots, knotsV: prof.knots,
    controlPoints: ring.controlPoints.map(rp => prof.pts.map(([rho, h]) => at(rp, rho, h))), weights: ring.weights.map(wu => prof.w.map(wv => wu * wv)) };
}
/** The surface's own outward normal at a point (for the face's sense). */
function naturalNormal(sd: SurfDef, p: Point): Point {
  if (sd.kind === 'plane') return sd.f.z;
  if (sd.kind === 'bspline') return [0, 0, 0];
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
    let c: Curve | null = null;
    if (e.type === 'B_SPLINE_CURVE_WITH_KNOTS') { const g = e.args; c = { kind: 'curve', id: 'c', degree: num(g[1]), controlPoints: list(g[2]).map(pointOf), knots: expand(list(g[7]).map(num), list(g[6]).map(num)), weights: list(g[2]).map(() => 1) }; }
    else if (e.type === 'COMPLEX' && part(e, 'B_SPLINE_CURVE')) {
      const bc = part(e, 'B_SPLINE_CURVE')!.args, kn = part(e, 'B_SPLINE_CURVE_WITH_KNOTS')!.args, w = part(e, 'RATIONAL_B_SPLINE_CURVE');
      c = { kind: 'curve', id: 'c', degree: num(bc[0]), controlPoints: list(bc[1]).map(pointOf), knots: expand(list(kn[1]).map(num), list(kn[0]).map(num)), weights: w ? list(w.args[0]).map(num) : list(bc[1]).map(() => 1) };
    }
    if (!c) return refuse(`${e.type} curves are not supported yet`);
    return { kind: 'curve', c: same ? c : reverseCurve(c) };
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
      const fs = shellFaces(sv).map(fv => faceOf(fv, k++)); faces.push(...fs); return { id: `${id}_sh${n}_${si}`, faces: fs };
    });
    bodies.push({ id: `${id}_b${n}`, shells });
  }
  if (!bodies.length) refuse('no solid (MANIFOLD_SOLID_BREP) in the file');

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
    const loop = f.loops.find(l => { const ids = l.uses.map(u => u.edge); return ids.some((x, i) => ids.indexOf(x) !== i); });
    if (!loop) continue;
    if (f.loops.length > 1) refuse(`a face going once round its axis with holes in it is not supported yet (${f.name || f.id})`);
    const ids = loop.uses.map(u => u.edge), seam = ids.find((x, i) => ids.indexOf(x) !== i)!, i1 = ids.indexOf(seam), i2 = ids.lastIndexOf(seam);
    const n = loop.uses.length, rot = [...loop.uses.slice(i1), ...loop.uses.slice(0, i1)], j = (i2 - i1 + n) % n;
    const sPlus = rot[0], c1 = rot.slice(1, j), c2 = rot.slice(j + 1);
    const sd = f.sd, seamAngle = natural(sd, geoAt(edges.get(seam)!.geo, 0.5))[0], cut = seamAngle + Math.PI;
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
    const fresh1 = f.loops[0].uses, s1 = fresh1.findIndex(u => u.edge === seam && u.fwd === sPlus.fwd);
    const R = [...fresh1.slice(s1), ...fresh1.slice(0, s1)], jj = R.findIndex((u, i) => i > 0 && u.edge === seam);
    const C1 = R.slice(1, jj), C2 = R.slice(jj + 1);
    const cutAt = (chain: IUse[], P: string) => { const at = chain.findIndex(u => seamFrom(u) === P); return at < 0 ? [chain, []] : [chain.slice(0, at), chain.slice(at)]; };
    const [C1a, C1b] = cutAt(C1, P2), [C2a, C2b] = cutAt(C2, P1);
    // The new edge along the cut, from P1 to P2: a generator, or an arc of the profile (sphere, torus).
    const p1 = points.get(P1)!, p2 = points.get(P2)!, sid = `${f.id}_cut`;
    let geo: Geo;
    if (sd.kind === 'cylinder' || sd.kind === 'cone') geo = { kind: 'line', p: p1, q: p2 };
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
    if (sd.kind === 'plane') {
      const p = sd.f, uv = pts.map(q => [dot(sub(q, p.o), p.x), dot(sub(q, p.o), p.y)]);
      const pad = 1 + 0.01 * Math.max(1, ...uv.flat().map(Math.abs)), u0 = Math.min(...uv.map(q => q[0])) - pad, u1 = Math.max(...uv.map(q => q[0])) + pad, v0 = Math.min(...uv.map(q => q[1])) - pad, v1 = Math.max(...uv.map(q => q[1])) + pad;
      const at = (u: number, v: number): Point => add(p.o, add(scale(p.x, u), scale(p.y, v)));
      surface = { kind: 'surface', id: sid, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[at(u0, v0), at(u0, v1)], [at(u1, v0), at(u1, v1)]], weights: [[1, 1], [1, 1]] };
    } else {
      // Angles: the smallest arc holding every boundary point (by the widest gap between them).
      const nat = pts.map(p => natural(sd, p)), angles = [...new Set(nat.map(q => wrap(q[0])))].sort((a, b) => a - b);
      const gaps = angles.map((a, i) => ({ size: (i ? a - angles[i - 1] : a + TAU - angles[angles.length - 1]), start: a })).sort((x, y) => y.size - x.size);
      const vs = nat.map(q => q[1]), vlo = Math.min(...vs), vhi = Math.max(...vs), dv = Math.max(1e-6, (vhi - vlo) * 0.01);
      let v0 = vlo - dv, v1 = vhi + dv;
      if (sd.kind === 'sphere') { v0 = Math.max(-Math.PI / 2, v0); v1 = Math.min(Math.PI / 2, v1); }
      // The face lies across the widest gap's complement; two equal gaps (a half bounded only by two
      // meridians) are told apart by the loops' turning about the surface's normal.
      let pick = gaps[0];
      if (gaps.length > 1 && gaps[0].size - gaps[1].size < 1e-6) {
        let area: Point = [0, 0, 0];
        for (const ring of loopPoints(f)) for (let i = 0; i < ring.length; i++) area = add(area, scale(cross(ring[i], ring[(i + 1) % ring.length]), 0.5));
        const score = (g: { size: number; start: number }) => { const mid = g.start + (TAU - g.size) / 2, vm = (vlo + vhi) / 2, probe = revolutionPatch(sd, mid - 1e-3, mid + 1e-3, vm - 1e-3, vm + 1e-3, 'probe'), P = probe.controlPoints[1][Math.floor(probe.controlPoints[1].length / 2)] as Point; return dot(area, naturalNormal(sd, P)) * (f.same ? 1 : -1); };
        if (score(gaps[1]) > score(gaps[0])) pick = gaps[1];
      }
      const span = TAU - pick.size, margin = Math.min(1e-3, pick.size / 4);
      if (span > TAU - 1e-6) refuse(`a face going once round its axis without a seam is not supported (${f.name || f.id})`);
      surface = revolutionPatch(sd, pick.start - margin, pick.start + span + margin, v0, v1, sid);
    }
    // The face's sense: its surface's outward normal (or the reverse) against the patch's own.
    const S = surface, P = S.controlPoints as Point[][], m = Math.floor(P.length / 2), n2 = Math.floor(P[0].length / 2);
    const own = cross(sub(P[Math.min(P.length - 1, m + 1)][n2], P[Math.max(0, m - 1)][n2]), sub(P[m][Math.min(P[0].length - 1, n2 + 1)], P[m][Math.max(0, n2 - 1)]));
    const natN = naturalNormal(sd, P[m][n2]);
    return { surface, sense: (dot(own, natN) >= 0) === f.same ? 'forward' : 'reversed' };
  };

  const brep = buildBrep({
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
  return { ...brep, edges: brep.edges.map(e => { if (e.name) return e; const b = base(e.id), k = (seen.get(b) ?? 0) + 1; seen.set(b, k); return { ...e, name: count.get(b)! > 1 ? `${b}#${k}` : b }; }) };
}

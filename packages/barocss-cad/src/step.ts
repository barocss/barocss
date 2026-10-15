// STEP (ISO 10303-21, AP214 automotive_design) exchange of a B-rep solid. Export writes each body as a
// MANIFOLD_SOLID_BREP (BREP_WITH_VOIDS when it has cavities) of ADVANCED_FACEs: planes as PLANE, every
// other surface exactly as its (rational) B-spline, straight edges as LINE and the rest as (rational)
// B-spline curves, in millimetres with the product structure other systems expect. Face names travel
// as the faces' names. Import reads the same subset back (planes, B-spline surfaces and curves, lines),
// so a part round-trips exactly; other entities (cylinders, circles, …) are refused by name for now.
import { BrepError, buildBrep, type Brep, type BrepFaceInput } from './brep-core.js';
import { faceGeometry } from './analytic-boolean.js';
import { curveDomain, evaluateCurve } from './math.js';
import { add, cross, dot, len, scale, sub, unit } from './vec3.js';
import type { Curve, Point, Surface } from './types.js';

// ---- export ------------------------------------------------------------------------------------------
const real = (x: number): string => {
  if (!Number.isFinite(x)) throw new BrepError('INPUT', 'STEP: a coordinate is not finite');
  const v = Object.is(x, -0) ? 0 : x, s = String(v);
  if (/e/i.test(s)) { const [m, e] = s.split(/e/i); return (m.includes('.') ? m : m + '.') + 'E' + e; }
  return s.includes('.') ? s : s + '.';
};
const text = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/[^\x20-\x7e]/g, '_')}'`;
/** A full knot vector as distinct knots and multiplicities. */
function knotPairs(knots: readonly number[]): { values: number[]; mults: number[] } {
  const values: number[] = [], mults: number[] = [];
  for (const k of knots) { if (values.length && k === values[values.length - 1]) mults[mults.length - 1]++; else { values.push(k); mults.push(1); } }
  return { values, mults };
}

export interface StepExportOptions {
  /** The product's name (and the file name in the header). */
  readonly name?: string;
  /** ISO 8601 time stamp for the header (default: now). */
  readonly timestamp?: string;
}

/** One STEP file of every solid of the given B-reps (a part's bodies), as one product. */
export function exportStep(input: Brep | readonly Brep[], options: StepExportOptions = {}): string {
  const breps = Array.isArray(input) ? input as readonly Brep[] : [input as Brep];
  const name = options.name ?? breps[0]?.source.id ?? 'part', lines: string[] = [];
  let next = 1;
  const add_ = (entity: string): string => { const id = `#${next++}`; lines.push(`${id}=${entity};`); return id; };
  const points = new Map<string, string>();
  const point = (p: readonly number[]) => { const k = p.map(real).join(','); let id = points.get(k); if (!id) { id = add_(`CARTESIAN_POINT('',(${k}))`); points.set(k, id); } return id; };
  const direction = (d: readonly number[]) => add_(`DIRECTION('',(${d.map(real).join(',')}))`);
  const placement = (o: Point, z: Point, x: Point) => add_(`AXIS2_PLACEMENT_3D('',${point(o)},${direction(z)},${direction(x)})`);

  // Product structure, units and the representation context.
  const appContext = add_(`APPLICATION_CONTEXT('core data for automotive mechanical design processes')`);
  add_(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,${appContext})`);
  const productContext = add_(`PRODUCT_CONTEXT('',${appContext},'mechanical')`);
  const product = add_(`PRODUCT(${text(name)},${text(name)},'',(${productContext}))`);
  add_(`PRODUCT_RELATED_PRODUCT_CATEGORY('part',$,(${product}))`);
  const formation = add_(`PRODUCT_DEFINITION_FORMATION('','',${product})`);
  const definitionContext = add_(`PRODUCT_DEFINITION_CONTEXT('part definition',${appContext},'design')`);
  const definition = add_(`PRODUCT_DEFINITION('design','',${formation},${definitionContext})`);
  const shape = add_(`PRODUCT_DEFINITION_SHAPE('','',${definition})`);
  const mm = add_(`(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))`);
  const radian = add_(`(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))`);
  const steradian = add_(`(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())`);
  const uncertainty = add_(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-06),${mm},'distance_accuracy_value','confusion accuracy')`);
  const context = add_(`(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((${uncertainty}))GLOBAL_UNIT_ASSIGNED_CONTEXT((${mm},${radian},${steradian}))REPRESENTATION_CONTEXT('Context3D','3D Context with UNIT and UNCERTAINTY'))`);

  const solids = breps.flatMap(brep => solidsOf(brep));
  if (!solids.length) throw new BrepError('INPUT', 'STEP: the B-rep has no solid body');
  function solidsOf(brep: Brep): string[] {
  // Vertices and edges.
  const vertexId = new Map<string, string>();
  for (const v of brep.vertices) vertexId.set(v.id, add_(`VERTEX_POINT('',${point(v.point)})`));
  const edgeId = new Map<string, string>();
  for (const e of brep.edges) {
    const c = e.curve;
    let geometry: string;
    if (c.degree === 1 && c.controlPoints.length === 2) {
      const [a, b] = c.controlPoints, d = sub(b as Point, a as Point), l = len(d);
      geometry = add_(`LINE('',${point(a)},${add_(`VECTOR('',${direction(unit(d))},${real(l)})`)})`);
    } else geometry = bsplineCurve(c, add_, point);
    edgeId.set(e.id, add_(`EDGE_CURVE(${text(e.name ?? '')},${vertexId.get(e.vertices[0])},${vertexId.get(e.vertices[1])},${geometry},.T.)`));
  }

  // Faces.
  const loops = new Map(brep.loops.map(l => [l.id, l])), coedges = new Map(brep.coedges.map(c => [c.id, c]));
  const faceId = new Map<string, string>();
  for (const f of brep.faces) {
    const S = f.surface, g = S.degreeU === 1 && S.degreeV === 1 && S.controlPoints.length === 2 && S.controlPoints[0].length === 2 ? faceGeometry(f) : { kind: 'other' as const };
    let surface: string, sameSense: boolean;
    if (g.kind === 'plane') {
      const e1 = unit(sub(S.controlPoints[1][0] as Point, S.controlPoints[0][0] as Point));
      surface = add_(`PLANE('',${placement(g.o, g.n, unit(sub(e1, scale(g.n, dot(e1, g.n)))))})`); sameSense = true;
    } else { surface = bsplineSurface(S, add_, point); sameSense = f.sense === 'forward'; }
    const bounds = f.loops.map(lid => {
      const l = loops.get(lid)!, edges = l.coedges.map(cid => { const c = coedges.get(cid)!; return add_(`ORIENTED_EDGE('',*,*,${edgeId.get(c.edge)},${c.sense === 'forward' ? '.T.' : '.F.'})`); });
      const loop = add_(`EDGE_LOOP('',(${edges.join(',')}))`);
      return add_(`${l.kind === 'outer' ? 'FACE_OUTER_BOUND' : 'FACE_BOUND'}('',${loop},.T.)`);
    });
    faceId.set(f.id, add_(`ADVANCED_FACE(${text(f.name ?? '')},(${bounds.join(',')}),${surface},${sameSense ? '.T.' : '.F.'})`));
  }

  // Bodies: the first shell is the outer one, any further shells are cavities.
  const shellOf = new Map(brep.shells.map(s => [s.id, s]));
  return brep.bodies.filter(b => b.kind === 'solid').map(b => {
    const shells = b.shells.map(sid => add_(`CLOSED_SHELL('',(${shellOf.get(sid)!.faces.map(fid => faceId.get(fid)).join(',')}))`));
    if (shells.length === 1) return add_(`MANIFOLD_SOLID_BREP(${text(b.id)},${shells[0]})`);
    const voids = shells.slice(1).map(s => add_(`ORIENTED_CLOSED_SHELL('',*,${s},.F.)`));
    return add_(`BREP_WITH_VOIDS(${text(b.id)},${shells[0]},(${voids.join(',')}))`);
  });
  }
  const origin = placement([0, 0, 0], [0, 0, 1], [1, 0, 0]);
  const representation = add_(`ADVANCED_BREP_SHAPE_REPRESENTATION(${text(name)},(${[...solids, origin].join(',')}),${context})`);
  add_(`SHAPE_DEFINITION_REPRESENTATION(${shape},${representation})`);

  const stamp = options.timestamp ?? new Date().toISOString().slice(0, 19);
  return ['ISO-10303-21;', 'HEADER;', `FILE_DESCRIPTION(('BaroCSS CAD part'),'2;1');`, `FILE_NAME(${text(name + '.step')},${text(stamp)},(''),(''),'BaroCSS CAD','BaroCSS CAD','');`,
    `FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));`, 'ENDSEC;', 'DATA;', ...lines, 'ENDSEC;', 'END-ISO-10303-21;', ''].join('\n');
}

function bsplineCurve(c: Curve, add_: (e: string) => string, point: (p: readonly number[]) => string): string {
  const { values, mults } = knotPairs(c.knots), cps = c.controlPoints.map(point).join(',');
  const rational = c.weights.some(w => w !== 1);
  if (!rational) return add_(`B_SPLINE_CURVE_WITH_KNOTS('',${c.degree},(${cps}),.UNSPECIFIED.,.F.,.F.,(${mults.join(',')}),(${values.map(real).join(',')}),.UNSPECIFIED.)`);
  return add_(`(BOUNDED_CURVE()B_SPLINE_CURVE(${c.degree},(${cps}),.UNSPECIFIED.,.F.,.F.)B_SPLINE_CURVE_WITH_KNOTS((${mults.join(',')}),(${values.map(real).join(',')}),.UNSPECIFIED.)CURVE()GEOMETRIC_REPRESENTATION_ITEM()RATIONAL_B_SPLINE_CURVE((${c.weights.map(real).join(',')}))REPRESENTATION_ITEM(''))`);
}
function bsplineSurface(S: Surface, add_: (e: string) => string, point: (p: readonly number[]) => string): string {
  const u = knotPairs(S.knotsU), v = knotPairs(S.knotsV), cps = S.controlPoints.map(row => `(${row.map(point).join(',')})`).join(',');
  const rational = S.weights.some(row => row.some(w => w !== 1)), knots = `(${u.mults.join(',')}),(${v.mults.join(',')}),(${u.values.map(real).join(',')}),(${v.values.map(real).join(',')}),.UNSPECIFIED.`;
  if (!rational) return add_(`B_SPLINE_SURFACE_WITH_KNOTS('',${S.degreeU},${S.degreeV},(${cps}),.UNSPECIFIED.,.F.,.F.,.F.,${knots})`);
  return add_(`(BOUNDED_SURFACE()B_SPLINE_SURFACE(${S.degreeU},${S.degreeV},(${cps}),.UNSPECIFIED.,.F.,.F.,.F.)B_SPLINE_SURFACE_WITH_KNOTS(${knots})GEOMETRIC_REPRESENTATION_ITEM()RATIONAL_B_SPLINE_SURFACE((${S.weights.map(row => `(${row.map(real).join(',')})`).join(',')}))REPRESENTATION_ITEM('')SURFACE())`);
}

// ---- import ------------------------------------------------------------------------------------------
type Value = number | string | { ref: number } | { enum: string } | null | '*' | Value[] | { type: string; args: Value[] };
interface Entity { type: string; args: Value[]; parts?: { type: string; args: Value[] }[] }

/** The DATA section's instances: simple ones and complex ones (as their partial entities). */
function parseData(source: string): Map<number, Entity> {
  const data = /DATA;([\s\S]*?)ENDSEC;/.exec(source.replace(/\/\*[\s\S]*?\*\//g, ''));
  if (!data) throw new BrepError('INPUT', 'STEP: no DATA section');
  const s = data[1], out = new Map<number, Entity>();
  let i = 0;
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  const value = (): Value => {
    ws();
    const c = s[i];
    if (c === '(') { i++; const list: Value[] = []; ws(); if (s[i] === ')') { i++; return list; } for (;;) { list.push(value()); ws(); if (s[i] === ',') { i++; continue; } if (s[i] === ')') { i++; return list; } throw new BrepError('INPUT', `STEP: bad list near ${s.slice(i, i + 20)}`); } }
    if (c === "'") { let t = ''; i++; for (;;) { if (s[i] === "'") { if (s[i + 1] === "'") { t += "'"; i += 2; continue; } i++; return t; } t += s[i++]; } }
    if (c === '#') { i++; const m = /^\d+/.exec(s.slice(i))!; i += m[0].length; return { ref: Number(m[0]) }; }
    if (c === '.') { const m = /^\.([A-Z0-9_]+)\./.exec(s.slice(i)); if (!m) throw new BrepError('INPUT', 'STEP: bad enumeration'); i += m[0].length; return { enum: m[1] }; }
    if (c === '$') { i++; return null; }
    if (c === '*') { i++; return '*'; }
    const num = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i));
    if (num) { i += num[0].length; return Number(num[0]); }
    const word = /^[A-Z_][A-Z0-9_]*/.exec(s.slice(i));
    if (word) { i += word[0].length; ws(); const args = value(); return { type: word[0], args: args as Value[] }; } // a typed parameter (LENGTH_MEASURE(…))
    throw new BrepError('INPUT', `STEP: unexpected ${s.slice(i, i + 20)}`);
  };
  while (i < s.length) {
    ws(); if (i >= s.length) break;
    const head = /^#(\d+)\s*=\s*/.exec(s.slice(i)); if (!head) throw new BrepError('INPUT', `STEP: expected an instance near ${s.slice(i, i + 30)}`);
    i += head[0].length; ws();
    if (s[i] === '(') {
      // Complex: (A(...)B(...)…)
      i++; const parts: { type: string; args: Value[] }[] = [];
      for (;;) { ws(); if (s[i] === ')') { i++; break; } const w = /^[A-Z_][A-Z0-9_]*/.exec(s.slice(i))!; i += w[0].length; parts.push({ type: w[0], args: value() as Value[] }); }
      out.set(Number(head[1]), { type: 'COMPLEX', args: [], parts });
    } else {
      const w = /^[A-Z_][A-Z0-9_]*/.exec(s.slice(i)); if (!w) throw new BrepError('INPUT', 'STEP: expected an entity name');
      i += w[0].length; out.set(Number(head[1]), { type: w[0], args: value() as Value[] });
    }
    ws(); if (s[i] === ';') i++;
  }
  return out;
}

const expand = (values: readonly number[], mults: readonly number[]) => values.flatMap((v, k) => Array(mults[k]).fill(v) as number[]);

/** Reads the solids of a STEP file (the subset exportStep writes) as one B-rep. */
export function importStep(source: string, options: { readonly id?: string } = {}): Brep {
  const data = parseData(source), id = options.id ?? 'step';
  const get = (v: Value | undefined): Entity => { if (!v || typeof v !== 'object' || !('ref' in v)) throw new BrepError('INPUT', 'STEP: expected a reference'); const e = data.get(v.ref); if (!e) throw new BrepError('INPUT', `STEP: #${v.ref} is missing`); return e; };
  const refNo = (v: Value) => (v as { ref: number }).ref;
  const num = (v: Value) => v as number, list = (v: Value) => v as Value[];
  const part = (e: Entity, type: string) => e.parts?.find(p => p.type === type);
  const pointOf = (v: Value): Point => { const e = get(v); if (e.type !== 'CARTESIAN_POINT') throw new BrepError('INPUT', 'STEP: expected a point'); return list(e.args[1]).map(num) as Point; };
  const dirOf = (v: Value): Point => unit(list(get(v).args[1]).map(num) as Point);
  const placementOf = (v: Value) => { const a = get(v).args; const z = a[2] === null ? [0, 0, 1] as Point : dirOf(a[2]); let x = a[3] === null ? [1, 0, 0] as Point : dirOf(a[3]); x = unit(sub(x, scale(z, dot(x, z)))); return { o: pointOf(a[1]), z, x, y: cross(z, x) }; };

  const vertices = new Map<number, { id: string; point: Point }>();
  const vertex = (v: Value) => { const n = refNo(v); let x = vertices.get(n); if (!x) { const e = get(v); x = { id: `${id}_v${n}`, point: pointOf(e.args[1]) }; vertices.set(n, x); } return x; };
  const edges = new Map<number, { id: string; curve: Curve; vertices: [string, string]; name?: string }>();
  const edge = (v: Value) => {
    const n = refNo(v); let x = edges.get(n); if (x) return x;
    const e = get(v); if (e.type !== 'EDGE_CURVE') throw new BrepError('INPUT', `STEP: ${e.type} edges are not supported`);
    const a = vertex(e.args[1]), b = vertex(e.args[2]), same = (e.args[4] as { enum: string }).enum === 'T', cid = `${id}_e${n}`;
    let curve = curveOf(get(e.args[3]), a.point, b.point, same, cid);
    // An edge runs along its curve from its first vertex to its second.
    if (!same) curve = reverseCurve(curve);
    const cp = curve.controlPoints as Point[]; cp[0] = a.point; cp[cp.length - 1] = b.point;
    x = { id: cid, curve, vertices: [a.id, b.id], ...(e.args[0] ? { name: e.args[0] as string } : {}) }; edges.set(n, x); return x;
  };
  function curveOf(e: Entity, a: Point, b: Point, same: boolean, cid: string): Curve {
    if (e.type === 'LINE') return { kind: 'curve', id: cid, degree: 1, knots: [0, 0, 1, 1], controlPoints: same ? [a, b] : [b, a], weights: [1, 1] };
    if (e.type === 'B_SPLINE_CURVE_WITH_KNOTS') { const g = e.args; return { kind: 'curve', id: cid, degree: num(g[1]), controlPoints: list(g[2]).map(pointOf), knots: expand(list(g[7]).map(num), list(g[6]).map(num)), weights: list(g[2]).map(() => 1) }; }
    if (e.type === 'COMPLEX' && part(e, 'B_SPLINE_CURVE')) {
      const bc = part(e, 'B_SPLINE_CURVE')!.args, kn = part(e, 'B_SPLINE_CURVE_WITH_KNOTS')!.args, w = part(e, 'RATIONAL_B_SPLINE_CURVE');
      return { kind: 'curve', id: cid, degree: num(bc[0]), controlPoints: list(bc[1]).map(pointOf), knots: expand(list(kn[1]).map(num), list(kn[0]).map(num)), weights: w ? list(w.args[0]).map(num) : list(bc[1]).map(() => 1) };
    }
    throw new BrepError('INPUT', `STEP: ${e.type} curves are not supported yet`);
  }
  function surfaceOf(e: Entity, sid: string, boundary: Point[]): { surface: Surface; normal?: Point } {
    if (e.type === 'PLANE') {
      // A plane becomes a bilinear patch over its face's extent (a little wider).
      const p = placementOf(e.args[1]), uv = boundary.map(q => [dot(sub(q, p.o), p.x), dot(sub(q, p.o), p.y)]);
      const pad = 1 + 0.01 * Math.max(1, ...uv.flat().map(Math.abs)), u0 = Math.min(...uv.map(q => q[0])) - pad, u1 = Math.max(...uv.map(q => q[0])) + pad, v0 = Math.min(...uv.map(q => q[1])) - pad, v1 = Math.max(...uv.map(q => q[1])) + pad;
      const at = (u: number, v: number): Point => add(p.o, add(scale(p.x, u), scale(p.y, v)));
      return { surface: { kind: 'surface', id: sid, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[at(u0, v0), at(u0, v1)], [at(u1, v0), at(u1, v1)]], weights: [[1, 1], [1, 1]] }, normal: p.z };
    }
    if (e.type === 'B_SPLINE_SURFACE_WITH_KNOTS') {
      const g = e.args, rows = list(g[3]).map(r => list(r).map(pointOf));
      return { surface: { kind: 'surface', id: sid, degreeU: num(g[1]), degreeV: num(g[2]), controlPoints: rows, knotsU: expand(list(g[10]).map(num), list(g[8]).map(num)), knotsV: expand(list(g[11]).map(num), list(g[9]).map(num)), weights: rows.map(r => r.map(() => 1)) } };
    }
    if (e.type === 'COMPLEX' && part(e, 'B_SPLINE_SURFACE')) {
      const bs = part(e, 'B_SPLINE_SURFACE')!.args, kn = part(e, 'B_SPLINE_SURFACE_WITH_KNOTS')!.args, w = part(e, 'RATIONAL_B_SPLINE_SURFACE'), rows = list(bs[2]).map(r => list(r).map(pointOf));
      return { surface: { kind: 'surface', id: sid, degreeU: num(bs[0]), degreeV: num(bs[1]), controlPoints: rows, knotsU: expand(list(kn[2]).map(num), list(kn[0]).map(num)), knotsV: expand(list(kn[3]).map(num), list(kn[1]).map(num)), weights: w ? list(w.args[0]).map(r => list(r).map(num)) : rows.map(r => r.map(() => 1)) } };
    }
    throw new BrepError('INPUT', `STEP: ${e.type} surfaces are not supported yet`);
  }
  function reverseCurve(c: Curve): Curve {
    const [t0, t1] = curveDomain(c);
    return { ...c, controlPoints: [...c.controlPoints].reverse(), weights: [...c.weights].reverse(), knots: [...c.knots].reverse().map(k => t0 + t1 - k) };
  }

  const faceOf = (v: Value, k: number): BrepFaceInput => {
    const e = get(v); if (e.type !== 'ADVANCED_FACE' && e.type !== 'FACE_SURFACE') throw new BrepError('INPUT', `STEP: ${e.type} faces are not supported`);
    const loops = list(e.args[1]).map(bv => {
      const b = get(bv), loop = get(b.args[1]), flip = (b.args[2] as { enum: string }).enum === 'F';
      if (loop.type !== 'EDGE_LOOP') throw new BrepError('INPUT', `STEP: ${loop.type} bounds are not supported`);
      let uses = list(loop.args[1]).map(ov => { const o = get(ov); const ed = edge(o.args[3]); const fw = (o.args[4] as { enum: string }).enum === 'T'; return { edge: ed.id, sense: (fw ? 'forward' : 'reversed') as 'forward' | 'reversed' }; });
      if (flip) uses = [...uses].reverse().map(u => ({ edge: u.edge, sense: u.sense === 'forward' ? 'reversed' as const : 'forward' as const }));
      return { kind: (b.type === 'FACE_OUTER_BOUND' ? 'outer' : 'inner') as 'outer' | 'inner', uses };
    });
    if (!loops.some(l => l.kind === 'outer') && loops.length) loops[0] = { ...loops[0], kind: 'outer' };
    const boundary = loops.flatMap(l => l.uses.flatMap(u => { const ed = [...edges.values()].find(x => x.id === u.edge)!, [t0, t1] = curveDomain(ed.curve); return [0, 0.25, 0.5, 0.75, 1].map(f => evaluateCurve(ed.curve, t0 + (t1 - t0) * f)); }));
    const { surface, normal } = surfaceOf(get(e.args[2]), `${id}_s${refNo(v)}`, boundary), same = (e.args[3] as { enum: string }).enum === 'T';
    // For a plane the patch's own normal is the placement's z; otherwise ∂S/∂u × ∂S/∂v.
    let sense: 'forward' | 'reversed' = same ? 'forward' : 'reversed';
    if (normal) { const P = surface.controlPoints as Point[][], n = cross(sub(P[1][0], P[0][0]), sub(P[0][1], P[0][0])); if (dot(n, normal) < 0) sense = sense === 'forward' ? 'reversed' : 'forward'; }
    return { id: `${id}_f${k}_${refNo(v)}`, surface, sense, loops, ...(e.args[0] ? { name: e.args[0] as string } : {}) };
  };
  const shellFaces = (v: Value) => { const s = get(v); const shell = s.type === 'ORIENTED_CLOSED_SHELL' ? get(s.args[2]) : s; return list(shell.args[1]); };
  const bodies: Parameters<typeof buildBrep>[0]['bodies'][number][] = [];
  let k = 0;
  for (const [n, e] of data) {
    if (e.type !== 'MANIFOLD_SOLID_BREP' && e.type !== 'BREP_WITH_VOIDS') continue;
    const shells = [e.args[1], ...(e.type === 'BREP_WITH_VOIDS' ? list(e.args[2]) : [])].map((sv, si) => ({ id: `${id}_sh${n}_${si}`, closed: true, faces: shellFaces(sv).map(fv => faceOf(fv, k++)) }));
    bodies.push({ id: `${id}_b${n}`, kind: 'solid', shells });
  }
  if (!bodies.length) throw new BrepError('INPUT', 'STEP: no solid (MANIFOLD_SOLID_BREP) in the file');
  return buildBrep({ source: { family: 'step', id }, vertices: [...vertices.values()], edges: [...edges.values()], bodies });
}

// STEP (ISO 10303-21, AP214 automotive_design) exchange of a B-rep solid. Export writes each body as a
// MANIFOLD_SOLID_BREP (BREP_WITH_VOIDS when it has cavities) of ADVANCED_FACEs: planes as PLANE, every
// other surface exactly as its (rational) B-spline, straight edges as LINE and the rest as (rational)
// B-spline curves, in millimetres with the product structure other systems expect. Face names travel
// as the faces' names. importStep (step-import.ts) reads these files back exactly, and the analytic
// entities other systems write.
import { BrepError, type Brep } from './brep-core.js';
import { faceGeometry } from './analytic-boolean.js';
import { brepMassProperties, brepSurfaceArea } from './solid-mass.js';
import { tessellateBrep } from './brep-tessellate.js';
import { dot, len, scale, sub, unit } from './vec3.js';
import type { Curve, FacetPatch, Point, Surface } from './types.js';
import { brepFromTriangles } from './mesh-brep.js';

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
  /**
   * CAx-IF geometric validation properties of the part (volume, surface area, centroid, and a bounding box):
   * written by default, so a reader can check what it imported; false leaves them out (no mass computed).
   */
  readonly validationProperties?: boolean;
}

/** One STEP file of every solid of the given B-reps (a part's bodies), as one product. */
export function exportStep(input: Brep | readonly Brep[], options: StepExportOptions = {}): string {
  // (F0: a facet body is written as its triangles, planar faces merged where flat — the planar mesh B-rep any
  // reader takes. AP242 tessellated faces come with R3.5.)
  const breps = (Array.isArray(input) ? input as readonly Brep[] : [input as Brep]).map(planarFacets);
  const name = options.name ?? breps[0]?.source.id ?? 'part', lines: string[] = [];
  let next = 1;
  const add_ = (entity: string): string => { const id = `#${next++}`; lines.push(`${id}=${entity};`); return id; };
  const points = new Map<string, string>();
  const point = (p: readonly number[]) => { const k = p.map(real).join(','); let id = points.get(k); if (!id) { id = add_(`CARTESIAN_POINT('',(${k}))`); points.set(k, id); } return id; };
  // (Directions shared like points: a faceted solid's planes, lines and their axes repeat the same few.)
  const directions = new Map<string, string>();
  const direction = (d: readonly number[]) => { const k = d.map(real).join(','); let id = directions.get(k); if (!id) { id = add_(`DIRECTION('',(${k}))`); directions.set(k, id); } return id; };
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
    const S = f.surface as Surface, g = S.degreeU === 1 && S.degreeV === 1 && S.controlPoints.length === 2 && S.controlPoints[0].length === 2 ? faceGeometry(f) : { kind: 'other' as const };
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
  if (options.validationProperties !== false) writeValidationProperties(breps, add_, shape, context, mm, name);

  const stamp = options.timestamp ?? new Date().toISOString().slice(0, 19);
  return ['ISO-10303-21;', 'HEADER;', `FILE_DESCRIPTION(('BaroCSS CAD part'),'2;1');`, `FILE_NAME(${text(name + '.step')},${text(stamp)},(''),(''),'BaroCSS CAD','BaroCSS CAD','');`,
    `FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));`, 'ENDSEC;', 'DATA;', ...lines, 'ENDSEC;', 'END-ISO-10303-21;', ''].join('\n');
}

/**
 * The part's geometric validation properties (CAx-IF recommended practice): its volume, surface area and
 * centroid, each a REPRESENTATION tied to the shape by a PROPERTY_DEFINITION named 'geometric validation
 * property', and its bounding box (two points) the same way. Volume and centroid sum the solids'.
 */
function writeValidationProperties(breps: readonly Brep[], add_: (e: string) => string, shape: string, context: string, mm: string, name: string): void {
  let volume = 0, area = 0; const moment = [0, 0, 0], lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const b of breps) {
    if (!b.bodies.some(x => x.kind === 'solid')) continue;
    const m = brepMassProperties(b, 1); volume += m.volumeMM3; for (let k = 0; k < 3; k++) moment[k] += m.volumeMM3 * m.centroidMM[k];
    area += brepSurfaceArea(b);
    const mesh = tessellateBrep(b, { segmentsPerQuarter: 16 }), P = mesh.positionsMM;
    for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { if (P[i + k] < lo[k]) lo[k] = P[i + k]; if (P[i + k] > hi[k]) hi[k] = P[i + k]; }
  }
  if (!(volume > 0)) return;
  const property = (what: string, representation: string) => { const def = add_(`PROPERTY_DEFINITION('geometric validation property',${text(`${what} of ${name}`)},${shape})`); add_(`PROPERTY_DEFINITION_REPRESENTATION(${def},${representation})`); };
  const volumeUnit = add_(`(DERIVED_UNIT((${add_(`DERIVED_UNIT_ELEMENT(${mm},3.)`)}))VOLUME_UNIT())`), areaUnit = add_(`(AREA_UNIT()DERIVED_UNIT((${add_(`DERIVED_UNIT_ELEMENT(${mm},2.)`)})))`);
  property('volume', add_(`REPRESENTATION('volume',(${add_(`MEASURE_REPRESENTATION_ITEM('volume measure',VOLUME_MEASURE(${real(volume)}),${volumeUnit})`)}),${context})`));
  property('surface area', add_(`REPRESENTATION('surface area',(${add_(`MEASURE_REPRESENTATION_ITEM('surface area measure',AREA_MEASURE(${real(area)}),${areaUnit})`)}),${context})`));
  const centre = moment.map(x => x / volume);
  property('centroid', add_(`REPRESENTATION('centroid',(${add_(`CARTESIAN_POINT('centre point',(${centre.map(real).join(',')}))`)}),${context})`));
  property('bounding box', add_(`REPRESENTATION('bounding box',(${add_(`CARTESIAN_POINT('minimum point',(${lo.map(real).join(',')}))`)},${add_(`CARTESIAN_POINT('maximum point',(${hi.map(real).join(',')}))`)}),${context})`));
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

export { importStep, stepValidationProperties, compareValidationProperties, type StepValidationProperties, type ValidationCheck } from './step-import.js';

/** A body whose faces are all facets, as the planar B-rep of its triangles (others as they are; mixed refused). */
function planarFacets(brep: Brep): Brep {
  if (!brep.faces.some(f => f.surface.kind === 'facets')) return brep;
  if (!brep.faces.every(f => f.surface.kind === 'facets')) throw new BrepError('GEOMETRY', 'STEP: a body mixing mesh and other faces cannot be written yet');
  const positions: number[] = [], indices: number[] = [];
  for (const f of brep.faces) {
    const F = f.surface as FacetPatch, base = positions.length / 3, X = F.indices, fw = f.sense === 'forward';
    for (let i = 0; i < F.positions.length; i++) positions.push(F.positions[i]);
    for (let t = 0; t < X.length; t += 3) indices.push(base + X[t], base + (fw ? X[t + 1] : X[t + 2]), base + (fw ? X[t + 2] : X[t + 1]));
  }
  return brepFromTriangles(positions, indices, { id: brep.bodies[0]?.id ?? brep.source.id, maximumTriangles: Infinity });
}

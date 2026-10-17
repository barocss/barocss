// Direct geometry: NURBS curves and surfaces kept beside the feature model, each an object of an
// authored CAD source (the `.barocad` language). Operations are @barocss/cad's: their results are new
// sources and objects; an operation that makes new objects hides the ones it was made from (so they
// can be shown again), one that refines an object's own source (poles, knots, degree, interval) moves the
// object to the refined source.
import {
  buildAlignedRationalRuledSurface, buildTranslationalSweepSurface, compileCadModel, editSourceCurveControlPolygon, editSourceSurfaceControlNetWide,
  elevateSourceSurfaceAxisDegree, extractSourceCurveInterval, extractSurfaceIsoCurve, extractSurfaceRegion, insertSourceCurveKnot,
  insertSourceSurfaceKnot, joinCurves, reverseCurveWide, reverseSurfaceAxis, sampleCurve, splitCurveAtParameter, splitSurfaceAtParameter,
  tessellateSurface, curveDomain, surfaceDomain, evaluateCurveCurvature, evaluateSurfaceCurvature, exportIGES, importIGES, IGESImportError, transformNativeGeometryAffine, buildMultiSectionLoftSurface, type CadAffineMatrix3x4, type Curve, type Model, type Surface,
} from '@barocss/cad';

export interface DirectObject { id: string; name: string; source: string; geometry: string; hidden?: boolean }
export interface DirectGeometry {
  /** Authored CAD sources by key. */
  sources: Record<string, string>;
  objects: DirectObject[];
}
export const emptyDirect = (): DirectGeometry => ({ sources: {}, objects: [] });

const compiled = new Map<string, Model>();
/** A source's model (compiled once per text). */
export function modelOf(text: string): Model {
  let m = compiled.get(text);
  if (!m) {
    const r = compileCadModel(text, { sourceVersion: 0 });
    if (!r.ok) throw new Error(r.diagnostics.map(d => d.message).join('; ') || 'The CAD source does not compile.');
    m = r.model; compiled.set(text, m);
    if (compiled.size > 256) compiled.delete(compiled.keys().next().value!);
  }
  return m;
}

/** An object's curve or surface. */
export function geometryOf(d: DirectGeometry, o: DirectObject): Curve | Surface {
  const g = modelOf(d.sources[o.source]).objects.find(x => x.id === o.geometry);
  if (!g || (g.kind !== 'curve' && g.kind !== 'surface')) throw new Error(`${o.name} is not a curve or a surface of its source.`);
  return g as Curve | Surface;
}

/** Every geometry id of every source (new ids must not collide with any). */
function usedIds(d: DirectGeometry): Set<string> {
  const ids = new Set<string>();
  for (const text of Object.values(d.sources)) { const m = modelOf(text); ids.add(m.name); for (const o of m.objects) ids.add(o.id); }
  for (const o of d.objects) ids.add(o.id);
  return ids;
}
const fresh = (used: Set<string>, stem: string) => { for (let i = 1; ; i++) { const id = `${stem}_${i}`; if (!used.has(id)) { used.add(id); return id; } } };

/** Add a CAD source's curves and surfaces as objects. */
export function importSource(d: DirectGeometry, text: string, label: string): DirectGeometry {
  const model = modelOf(text), used = usedIds(d), key = fresh(new Set(Object.keys(d.sources)), 'src');
  const objects = model.objects.filter(o => o.kind === 'curve' || o.kind === 'surface').map(o => ({ id: fresh(used, 'obj'), name: `${label} · ${o.id}`, source: key, geometry: o.id }));
  if (!objects.length) throw new Error('This CAD source has no curves or surfaces.');
  return { sources: { ...d.sources, [key]: text }, objects: [...d.objects, ...objects] };
}

/**
 * An IGES file's curves and surfaces (rational B-spline curves and surfaces, entities 126 and 128, in mm, as
 * BaroCSS writes them; at most 16) added as direct geometry, with what came in; or why it cannot be read.
 */
export function importIGESFile(d: DirectGeometry, text: string, label: string): { direct: DirectGeometry; curves: number; surfaces: number } {
  const id = (label.replace(/[^A-Za-z0-9_]/g, '_').replace(/^[^A-Za-z_]/, '_') || 'iges').slice(0, 32);
  let r;
  try { r = importIGES(text, { sourceId: id, modelName: id, idPrefix: id, maximumEntities: 16, maximumRecords: 8192 }); }
  catch (e) {
    if (e instanceof IGESImportError) throw new Error(`This IGES file cannot be read (${e.code}): only untransformed NURBS curves and surfaces (entities 126 and 128) in mm, at most 16, are read so far. ${e.message.replace(/^Native IGES import: /, '')}`);
    throw e;
  }
  // (The result is a frozen snapshot: its source is read out as plain text.)
  return { direct: importSource(d, String(r.source), label), curves: Number(r.report.curveCount), surfaces: Number(r.report.surfaceCount) };
}

const object = (d: DirectGeometry, id: string) => { const o = d.objects.find(x => x.id === id); if (!o) throw new Error('No such object.'); return o; };
const curveOf = (d: DirectGeometry, id: string) => { const g = geometryOf(d, object(d, id)); if (g.kind !== 'curve') throw new Error('Pick a curve.'); return g; };
const surfaceOf = (d: DirectGeometry, id: string) => { const g = geometryOf(d, object(d, id)); if (g.kind !== 'surface') throw new Error('Pick a surface.'); return g; };

/** Add a result source with new objects; hide the objects they came from. */
function add(d: DirectGeometry, from: string[], text: string, made: { geometry: string; name: string }[]): DirectGeometry {
  const used = usedIds(d), key = fresh(new Set(Object.keys(d.sources)), 'src');
  return {
    sources: { ...d.sources, [key]: text },
    objects: [...d.objects.map(o => from.includes(o.id) ? { ...o, hidden: true } : o), ...made.map(m => ({ id: fresh(used, 'obj'), name: m.name, source: key, geometry: m.geometry }))],
  };
}
/** Move an object to a refined source of its own (same geometry id). */
function refine(d: DirectGeometry, id: string, text: string): DirectGeometry {
  const key = fresh(new Set(Object.keys(d.sources)), 'src');
  return { sources: { ...d.sources, [key]: text }, objects: d.objects.map(o => o.id === id ? { ...o, source: key } : o) };
}
const nameOf = (d: DirectGeometry, id: string) => object(d, id).name;

export const directOps = {
  splitCurve(d: DirectGeometry, id: string, t: number) {
    const used = usedIds(d), r = splitCurveAtParameter(curveOf(d, id), { parameter: t, lowerCurveId: fresh(used, 'lower'), upperCurveId: fresh(used, 'upper') });
    return add(d, [id], r.source, [{ geometry: r.lower.id, name: `${nameOf(d, id)} · lower` }, { geometry: r.upper.id, name: `${nameOf(d, id)} · upper` }]);
  },
  joinCurves(d: DirectGeometry, a: string, b: string) {
    const r = joinCurves(curveOf(d, a), curveOf(d, b), { curveId: fresh(usedIds(d), 'joined') });
    return add(d, [a, b], r.source, [{ geometry: r.curve.id, name: 'Joined curve' }]);
  },
  reverseCurve(d: DirectGeometry, id: string) {
    const r = reverseCurveWide(curveOf(d, id), { curveId: fresh(usedIds(d), 'reversed') });
    return add(d, [id], r.source, [{ geometry: r.curve.id, name: `${nameOf(d, id)} · reversed` }]);
  },
  insertCurveKnot(d: DirectGeometry, id: string, knot: number) {
    const o = object(d, id), r = insertSourceCurveKnot({ source: d.sources[o.source], sourceVersion: 0, curveId: o.geometry, knot, maximumObservations: 128 });
    return refine(d, id, r.source);
  },
  curveInterval(d: DirectGeometry, id: string, from: number, to: number) {
    const o = object(d, id), r = extractSourceCurveInterval({ source: d.sources[o.source], sourceVersion: 0, curveId: o.geometry, interval: [from, to], maximumObservations: 256 });
    return refine(d, id, r.source);
  },
  editCurvePole(d: DirectGeometry, id: string, index: number, pole: { xMM?: number; yMM?: number; zMM?: number; weight?: number }) {
    const o = object(d, id), r = editSourceCurveControlPolygon({ source: d.sources[o.source], sourceVersion: 0, curveId: o.geometry, edits: { poleEdits: [{ index, ...pole }] } });
    return refine(d, id, r.source);
  },
  splitSurface(d: DirectGeometry, id: string, axis: 'u' | 'v', p: number) {
    const used = usedIds(d), r = splitSurfaceAtParameter(surfaceOf(d, id), { axis, parameter: p, lowerSurfaceId: fresh(used, 'lower'), upperSurfaceId: fresh(used, 'upper') });
    return add(d, [id], r.source, [{ geometry: r.lower.id, name: `${nameOf(d, id)} · ${axis} lower` }, { geometry: r.upper.id, name: `${nameOf(d, id)} · ${axis} upper` }]);
  },
  surfaceRegion(d: DirectGeometry, id: string, u: [number, number], v: [number, number]) {
    const used = usedIds(d), r = extractSurfaceRegion(surfaceOf(d, id), { surfaceId: fresh(used, 'region'), uInterval: u, vInterval: v, resultIdPrefix: freshPrefix(used, 'rg') });
    return add(d, [id], r.source, [{ geometry: r.surface.id, name: `${nameOf(d, id)} · region` }]);
  },
  isoCurve(d: DirectGeometry, id: string, axis: 'u' | 'v', p: number) {
    const r = extractSurfaceIsoCurve(surfaceOf(d, id), { fixedAxis: axis, parameter: p, curveId: fresh(usedIds(d), 'iso') });
    // (An iso-curve adds to the surface; nothing is hidden.)
    return add(d, [], r.source, [{ geometry: r.curve.id, name: `${nameOf(d, id)} · ${axis} = ${p}` }]);
  },
  reverseSurface(d: DirectGeometry, id: string, axis: 'u' | 'v') {
    const used = usedIds(d), r = reverseSurfaceAxis(surfaceOf(d, id), { surfaceId: fresh(used, 'reversed'), axis, resultIdPrefix: freshPrefix(used, 'sr') });
    return add(d, [id], r.source, [{ geometry: r.surface.id, name: `${nameOf(d, id)} · ${axis} reversed` }]);
  },
  insertSurfaceKnot(d: DirectGeometry, id: string, axis: 'u' | 'v', knot: number) {
    const o = object(d, id), r = insertSourceSurfaceKnot({ source: d.sources[o.source], sourceVersion: 0, surfaceId: o.geometry, axis, knot, maximumObservations: 1024 });
    return refine(d, id, r.source);
  },
  elevateDegree(d: DirectGeometry, id: string, axis: 'u' | 'v') {
    const o = object(d, id), s = surfaceOf(d, id), targetDegree = (axis === 'u' ? s.degreeU : s.degreeV) + 1;
    const r = (elevateSourceSurfaceAxisDegree as (req: unknown) => { source: string })({ source: d.sources[o.source], sourceVersion: 0, surfaceId: o.geometry, axis, targetDegree, maximumObservations: 1024 });
    return refine(d, id, r.source);
  },
  editSurfacePole(d: DirectGeometry, id: string, uIndex: number, vIndex: number, pole: { xMM?: number; yMM?: number; zMM?: number; weight?: number }) {
    const o = object(d, id), r = editSourceSurfaceControlNetWide({ source: d.sources[o.source], sourceVersion: 0, surfaceId: o.geometry, edits: { poleEdits: [{ uIndex, vIndex, ...pole }] } });
    return refine(d, id, r.source);
  },
  ruledSurface(d: DirectGeometry, a: string, b: string) {
    const used = usedIds(d), first = curveOf(d, a), second = curveOf(d, b), surfaceId = fresh(used, 'ruled'), resultIdPrefix = freshPrefix(used, 'er', 8);
    const ra = fresh(used, 'ra'), rb = fresh(used, 'rb');
    // A section that needs no knots aligned keeps its id; one that does gets a new one: try each pairing.
    let last: unknown;
    for (const [firstAlignedId, secondAlignedId] of [[first.id, second.id], [ra, second.id], [first.id, rb], [ra, rb]]) {
      try {
        const r = buildAlignedRationalRuledSurface(first, second, { surfaceId, firstAlignedId, secondAlignedId, resultIdPrefix, maximumInsertedKnots: 14, maximumRefinementOperations: 14 });
        return add(d, [], r.ruled.source, [{ geometry: r.ruled.surface.id, name: 'Ruled surface' }]);
      } catch (e) { last = e; if (!/explicit output IDs|retain their original IDs/.test(String((e as Error)?.message))) throw e; }
    }
    throw last;
  },
  /** Move, turn or scale objects in place: each to a new source with its transformed geometry. */
  transform(d: DirectGeometry, ids: string[], matrixOf: (centre: [number, number, number]) => CadAffineMatrix3x4) {
    let next = d;
    for (const id of ids) {
      const o = object(next, id), g = geometryOf(next, o), r = transformNativeGeometryAffine(g, matrixOf(centreOf(g)), { geometryId: fresh(usedIds(next), 'moved'), maximumObservations: 64 });
      const key = fresh(new Set(Object.keys(next.sources)), 'src');
      next = { sources: { ...next.sources, [key]: r.source }, objects: next.objects.map(x => x.id === id ? { ...x, source: key, geometry: r.geometry.id } : x) };
    }
    return next;
  },
  move(d: DirectGeometry, ids: string[], by: [number, number, number]) {
    return directOps.transform(d, ids, () => [1, 0, 0, by[0], 0, 1, 0, by[1], 0, 0, 1, by[2]]);
  },
  /** About each object's centre (its control points' box). */
  rotate(d: DirectGeometry, ids: string[], axis: 'x' | 'y' | 'z', degrees: number) {
    // (Exact at multiples of 90°: a contribution of 1e-17 would only blur the transform.)
    const a = (degrees * Math.PI) / 180, snap = (x: number) => Math.abs(x) < 1e-12 ? 0 : Math.abs(Math.abs(x) - 1) < 1e-12 ? Math.sign(x) : x;
    const c = snap(Math.cos(a)), s = snap(Math.sin(a));
    const R = axis === 'x' ? [1, 0, 0, 0, c, -s, 0, s, c] : axis === 'y' ? [c, 0, s, 0, 1, 0, -s, 0, c] : [c, -s, 0, s, c, 0, 0, 0, 1];
    return directOps.transform(d, ids, p => aboutCentre(R, p));
  },
  scale(d: DirectGeometry, ids: string[], k: number) {
    if (!(k > 0)) throw new Error('A scale is a positive factor.');
    return directOps.transform(d, ids, p => aboutCentre([k, 0, 0, 0, k, 0, 0, 0, k], p));
  },
  duplicate(d: DirectGeometry, ids: string[]) {
    const used = usedIds(d);
    return { ...d, objects: [...d.objects, ...ids.map(id => { const o = object(d, id); return { ...o, id: fresh(used, 'obj'), name: `${o.name} copy`, hidden: false }; })] };
  },
  rename(d: DirectGeometry, id: string, name: string) {
    const n = name.trim();
    if (!n) throw new Error('A name is needed.');
    return { ...d, objects: d.objects.map(o => o.id === id ? { ...o, name: n } : o) };
  },
  /** A surface through 2–15 curves of the same degree and knots, in selection order (cubic across them when there are enough). */
  loft(d: DirectGeometry, ids: string[]) {
    if (ids.length < 2 || ids.length > 15) throw new Error('Loft through 2 to 15 curves.');
    const sections = ids.map(id => curveOf(d, id)), n = sections.length;
    const r = buildMultiSectionLoftSurface(sections, sections.map((_, i) => i / (n - 1)), {
      surfaceId: fresh(usedIds(d), 'loft'), degreeV: Math.min(3, n - 1), maximumBasisEvaluations: 3600, maximumEliminationSteps: 1680, maximumObservations: 465 });
    return add(d, [], r.source, [{ geometry: r.surface.id, name: 'Lofted surface' }]);
  },
  sweep(d: DirectGeometry, profile: string, rail: string) {
    const r = buildTranslationalSweepSurface(curveOf(d, profile), curveOf(d, rail), { surfaceId: fresh(usedIds(d), 'swept'), maximumObservations: 961 });
    return add(d, [], r.source, [{ geometry: r.surface.id, name: 'Swept surface' }]);
  },
};

/** A short prefix none of whose role names is taken (the operations derive helper ids from it). */
function freshPrefix(used: Set<string>, stem: string, max = 20): string {
  for (let i = 1; ; i++) {
    const p = `${stem}${i}`;
    if (p.length > max) throw new Error('No free id prefix.');
    if (![...used].some(id => id.startsWith(p))) { used.add(p); return p; }
  }
}

export interface DirectDisplay {
  id: string; name: string; kind: 'curve' | 'surface';
  /** Surfaces: a triangle mesh (mm); curves: line segments (pairs of points). */
  positions: Float32Array; normals?: Float32Array; indices?: Uint32Array;
  /** Curves: the control polygon; surfaces: the control net rows and columns (segments). */
  controls: Float32Array;
}

/** What the viewport draws of the visible objects. Objects that fail to evaluate are left out. */
export function directDisplay(d: DirectGeometry | undefined): DirectDisplay[] {
  if (!d) return [];
  return d.objects.filter(o => !o.hidden).flatMap((o): DirectDisplay[] => {
    try {
      const g = geometryOf(d, o);
      if (g.kind === 'curve') {
        const pts = sampleCurve(g, 128).map(s => s.point), seg: number[] = [], ctl: number[] = [];
        for (let i = 0; i + 1 < pts.length; i++) seg.push(...pts[i], ...pts[i + 1]);
        for (let i = 0; i + 1 < g.controlPoints.length; i++) ctl.push(...g.controlPoints[i], ...g.controlPoints[i + 1]);
        return [{ id: o.id, name: o.name, kind: 'curve', positions: new Float32Array(seg), controls: new Float32Array(ctl) }];
      }
      const p = tessellateSurface(g, { countU: 32, countV: 32, revision: 0 }).packet, ctl: number[] = [], P = g.controlPoints;
      for (let i = 0; i < P.length; i++) for (let j = 0; j < P[i].length; j++) {
        if (i + 1 < P.length) ctl.push(...P[i][j], ...P[i + 1][j]);
        if (j + 1 < P[i].length) ctl.push(...P[i][j], ...P[i][j + 1]);
      }
      return [{ id: o.id, name: o.name, kind: 'surface', positions: Float32Array.from(p.positions), normals: Float32Array.from(p.normals), indices: Uint32Array.from(p.indices), controls: new Float32Array(ctl) }];
    } catch { return []; }
  });
}

/** An object's parameter domain(s), for the tools' fields. */
export function domainsOf(d: DirectGeometry, id: string): { kind: 'curve'; t: [number, number] } | { kind: 'surface'; u: [number, number]; v: [number, number] } {
  const g = geometryOf(d, object(d, id));
  if (g.kind === 'curve') return { kind: 'curve', t: curveDomain(g) };
  const dom = surfaceDomain(g);
  return { kind: 'surface', u: dom.u, v: dom.v };
}

/** A curve's length: the polyline through 4096 samples (about 1e-7 relative for smooth curves). */
export function curveLength(d: DirectGeometry, id: string): number {
  const pts = sampleCurve(curveOf(d, id), 4096).map(s => s.point);
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
  return l;
}
/** A curve at a parameter: its point, tangent and radius of curvature (null where it is straight). */
export function analyzeCurve(d: DirectGeometry, id: string, t: number) {
  const r = evaluateCurveCurvature(curveOf(d, id), t);
  return { point: r.derivatives.point, tangent: r.unitTangent, curvature: r.curvaturePerMM, radius: r.radiusMM };
}
/** A surface at (u, v): its point, normal and mean and Gaussian curvature. */
export function analyzeSurface(d: DirectGeometry, id: string, u: number, v: number) {
  const r = evaluateSurfaceCurvature(surfaceOf(d, id), u, v);
  return { point: r.derivatives.point, normal: r.unitNormal, mean: r.meanCurvaturePerMM, gaussian: r.gaussianCurvaturePerMM2 };
}
/** The visible curves and surfaces as one IGES file (at most 16; named by their object ids). */
export function directIGES(d: DirectGeometry, name = 'barocss_part'): string {
  const visible = d.objects.filter(o => !o.hidden);
  if (!visible.length) throw new Error('There are no visible curves or surfaces to export.');
  if (visible.length > 16) throw new Error('IGES export takes at most 16 curves and surfaces: hide some first.');
  const objects = visible.map(o => ({ ...geometryOf(d, o), id: o.id }));
  const model: Model = { name: name.replace(/[^A-Za-z0-9_]/g, '_').replace(/^[^A-Za-z_]/, '_').slice(0, 64) || 'part', version: 0, lengthUnit: 'mm', objects };
  return exportIGES(model, objects.map(o => o.id)).iges;
}

/** The centre of a curve's or surface's control points' box. */
function centreOf(g: Curve | Surface): [number, number, number] {
  const pts = g.kind === 'curve' ? g.controlPoints : g.controlPoints.flat();
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
  return [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
}
/** A 3×3 linear map about a point, as a row-major 3×4 affine matrix. */
function aboutCentre(R: number[], c: [number, number, number]): CadAffineMatrix3x4 {
  const t = [0, 1, 2].map(r => c[r] - (R[3 * r] * c[0] + R[3 * r + 1] * c[1] + R[3 * r + 2] * c[2]));
  return [R[0], R[1], R[2], t[0], R[3], R[4], R[5], t[1], R[6], R[7], R[8], t[2]];
}

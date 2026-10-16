// Direct geometry: NURBS curves and surfaces kept beside the feature model, each an object of an
// authored CAD source (the `.barocad` language). Operations are @barocss/cad's: their results are new
// sources and objects; an operation that makes new objects hides the ones it was made from (so they
// can be shown again), one that refines an object's own source (poles, knots, degree, interval) moves the
// object to the refined source.
import {
  buildAlignedRationalRuledSurface, buildTranslationalSweepSurface, compileCadModel, editSourceCurveControlPolygon, editSourceSurfaceControlNetWide,
  elevateSourceSurfaceAxisDegree, extractSourceCurveInterval, extractSurfaceIsoCurve, extractSurfaceRegion, insertSourceCurveKnot,
  insertSourceSurfaceKnot, joinCurves, reverseCurveWide, reverseSurfaceAxis, sampleCurve, splitCurveAtParameter, splitSurfaceAtParameter,
  tessellateSurface, curveDomain, surfaceDomain, type Curve, type Model, type Surface,
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

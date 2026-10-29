// Direct geometry: NURBS curves and surfaces kept beside the feature model, each an object of an
// authored CAD source (the `.barocad` language). Operations are @barocss/cad's: their results are new
// sources and objects; an operation that makes new objects hides the ones it was made from (so they
// can be shown again), one that refines an object's own source (poles, knots, degree, interval) moves the
// object to the refined source.
import { approximateCurvePlain, buildAlignedRationalRuledSurface, buildBezierCoonsSurface, buildMultiSectionLoftSurface, buildTranslationalSweepSurface, type CadAffineMatrix3x4, compileCadModel, type Curve, curveDomain, editSourceCurveControlPolygon, editSourceSurfaceControlNetWide, elevateSourceCurveDegree, elevateSourceSurfaceAxisDegree, evaluateCurve, evaluateCurveCurvature, evaluateSurface, evaluateSurfaceCurvature, exportIGES, extractSourceCurveInterval, extractSurfaceIsoCurve, extractSurfaceRegion, extractTrimmedSurfaceRegion, IGESImportError, importIGES, insertSourceCurveKnot, insertSourceSurfaceKnot, interpolateSurfacePlain, intersectPatches, joinCurves, type Model, removeCurveKnotPlain, reverseCurveWide, reverseSurfaceAxis, reverseTrimmedSurfaceAxis, sampleCurve, splitCurveAtParameter, splitSurfaceAtParameter, splitTrimmedSurfaceAtParameter, type Surface, surfaceDomain, surfaceEvaluator, SurfaceIntersectionError, transformNativeGeometryAffine, TrimmedSurfaceAxisReversalError, TrimmedSurfaceParameterSplitError, TrimmedSurfaceRegionError } from '@barocss/cad';
import { curvesSource, surfacesSource } from './curveSource';
import { keptAt, projectLoop, trimmedMesh, type TrimLoop } from './trim';
import { nextFreeId } from '../util/ids';
import { refusal } from './refusal';

export interface DirectObject {
  id: string; name: string; source: string; geometry: string; hidden?: boolean;
  /** A surface's trims: loops in its (u, v) domain, each keeping what is outside it (a hole) or inside it. */
  trims?: TrimLoop[];
}
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
    if (!r.ok) throw refusal('DIRECT_SOURCE', r.diagnostics.map(d => d.message).join('; ') || 'The CAD source does not compile.');
    m = r.model; compiled.set(text, m);
    if (compiled.size > 256) compiled.delete(compiled.keys().next().value!);
  }
  return m;
}

/** An object's curve or surface. */
export function geometryOf(d: DirectGeometry, o: DirectObject): Curve | Surface {
  const g = modelOf(d.sources[o.source]).objects.find(x => x.id === o.geometry);
  if (!g || (g.kind !== 'curve' && g.kind !== 'surface')) throw refusal('DIRECT_PICK', `${o.name} is not a curve or a surface of its source.`);
  return g as Curve | Surface;
}

/** Every geometry id of every source (new ids must not collide with any). */
function usedIds(d: DirectGeometry): Set<string> {
  const ids = new Set<string>();
  for (const text of Object.values(d.sources)) { const m = modelOf(text); ids.add(m.name); for (const o of m.objects) ids.add(o.id); }
  for (const o of d.objects) ids.add(o.id);
  return ids;
}
const fresh = (used: Set<string>, stem: string) => { const id = nextFreeId(`${stem}_`, used); used.add(id); return id; };

/** Add a CAD source's curves and surfaces as objects. */
export function importSource(d: DirectGeometry, text: string, label: string): DirectGeometry {
  const model = modelOf(text), used = usedIds(d), key = fresh(new Set(Object.keys(d.sources)), 'src');
  const objects = model.objects.filter(o => o.kind === 'curve' || o.kind === 'surface').map(o => ({ id: fresh(used, 'obj'), name: `${label} · ${o.id}`, source: key, geometry: o.id }));
  if (!objects.length) throw refusal('DIRECT_SOURCE', 'This CAD source has no curves or surfaces.');
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
    if (e instanceof IGESImportError) throw refusal('IGES_READ', `This IGES file cannot be read (${e.code}): only untransformed NURBS curves and surfaces (entities 126 and 128) in mm, at most 16, are read so far. ${e.message.replace(/^Native IGES import: /, '')}`);
    throw e;
  }
  // (The result is a frozen snapshot: its source is read out as plain text.)
  return { direct: importSource(d, String(r.source), label), curves: Number(r.report.curveCount), surfaces: Number(r.report.surfaceCount) };
}

const object = (d: DirectGeometry, id: string) => { const o = d.objects.find(x => x.id === id); if (!o) throw refusal('DIRECT_PICK', 'No such object.'); return o; };
const curveOf = (d: DirectGeometry, id: string) => { const g = geometryOf(d, object(d, id)); if (g.kind !== 'curve') throw refusal('DIRECT_PICK', 'Pick a curve.'); return g; };
const selectedSurface = (d: DirectGeometry, id: string) => {
  const o = object(d, id), surface = geometryOf(d, o);
  if (surface.kind !== 'surface') throw refusal('DIRECT_PICK', 'Pick a surface.');
  return { object: o, surface };
};
const surfaceOf = (d: DirectGeometry, id: string) => { const g = geometryOf(d, object(d, id)); if (g.kind !== 'surface') throw refusal('DIRECT_PICK', 'Pick a surface.'); return g; };

/** Refuse consumers that use only the support surface and cannot carry its trims. */
function requireWholeSurface(o: DirectObject, operation: string, code: 'DIRECT_VALUE' | 'DIRECT_INTERSECT' | 'IGES_EXPORT'): void {
  if (o.trims !== undefined && (!Array.isArray(o.trims) || o.trims.length > 0)) {
    throw refusal(code, `This operation does not preserve surface trims (${operation}). Use Untrim first only if you want to remove the trims.`);
  }
}
function wholeSurfaceOf(d: DirectGeometry, id: string, operation: string): Surface {
  const picked = selectedSurface(d, id);
  requireWholeSurface(picked.object, operation, 'DIRECT_VALUE');
  return picked.surface;
}

/** Copy accepted trim metadata before the new direct object is published. */
function copyTrimLoops(loops: readonly TrimLoop[]): TrimLoop[] {
  const owned: TrimLoop[] = [];
  for (const loop of loops) {
    const uv: [number, number][] = [];
    for (const point of loop.uv) uv.push([point[0], point[1]]);
    owned.push({ keep: loop.keep, uv });
  }
  return owned;
}

/** Add a result source with new objects; hide the objects they came from. */
function add(d: DirectGeometry, from: string[], text: string, made: { geometry: string; name: string; trims?: TrimLoop[] }[]): DirectGeometry {
  const used = usedIds(d), key = fresh(new Set(Object.keys(d.sources)), 'src');
  return {
    sources: { ...d.sources, [key]: text },
    objects: [...d.objects.map(o => from.includes(o.id) ? { ...o, hidden: true } : o), ...made.map(m => ({ id: fresh(used, 'obj'), name: m.name, source: key, geometry: m.geometry, ...(m.trims === undefined ? {} : { trims: m.trims }) }))],
  };
}
/** Move an object to a refined source of its own (same geometry id). */
function refine(d: DirectGeometry, id: string, text: string): DirectGeometry {
  const key = fresh(new Set(Object.keys(d.sources)), 'src');
  return { sources: { ...d.sources, [key]: text }, objects: d.objects.map(o => o.id === id ? { ...o, source: key } : o) };
}
const nameOf = (d: DirectGeometry, id: string) => object(d, id).name;

export const directOps = {
  /** The surface trimmed by a closed curve projected onto it: the region inside the loop cut away (or kept alone). */
  trimByCurve(d: DirectGeometry, surface: string, curve: string, keep: 'outside' | 'inside' = 'outside') {
    const o = object(d, surface), loops = o.trims ?? [], uv = projectLoop(surfaceOf(d, surface), curveOf(d, curve), loops);
    return { ...d, objects: d.objects.map(x => x.id === surface ? { ...x, trims: [...loops, { uv, keep }] } : x) };
  },
  /** The surface whole again (its trims taken off). */
  untrim(d: DirectGeometry, surface: string) {
    surfaceOf(d, surface);
    return { ...d, objects: d.objects.map(x => { if (x.id !== surface) return x; const whole = { ...x }; delete whole.trims; return whole; }) };
  },
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
    const picked = selectedSurface(d, id), trims = picked.object.trims;
    if (trims !== undefined && !Array.isArray(trims)) requireWholeSurface(picked.object, 'Split surface', 'DIRECT_VALUE');
    if (trims && trims.length > 0) {
      let matches = 0;
      for (const candidate of d.objects) if (candidate.id === id) matches++;
      if (matches !== 1) throw refusal('DIRECT_PICK', 'The selected surface object ID is ambiguous.');
      const used = usedIds(d), options = { axis, parameter: p, lowerSurfaceId: fresh(used, 'lower'), upperSurfaceId: fresh(used, 'upper') };
      let r;
      try { r = splitTrimmedSurfaceAtParameter(picked.surface, trims, options); }
      catch (e) {
        if (e instanceof TrimmedSurfaceParameterSplitError) throw refusal('DIRECT_VALUE', e.message);
        throw e;
      }
      // Own every component sidecar before one publication; an empty side creates no object.
      const made = [];
      for (const component of r.components) made.push({
        geometry: component.surfaceId,
        name: `${picked.object.name} · ${axis} ${component.side} · region ${component.componentIndex + 1}`,
        trims: copyTrimLoops(component.trimLoops),
      });
      return add(d, [id], r.source, made);
    }
    const s = picked.surface, used = usedIds(d), r = splitSurfaceAtParameter(s, { axis, parameter: p, lowerSurfaceId: fresh(used, 'lower'), upperSurfaceId: fresh(used, 'upper') });
    return add(d, [id], r.source, [{ geometry: r.lower.id, name: `${nameOf(d, id)} · ${axis} lower` }, { geometry: r.upper.id, name: `${nameOf(d, id)} · ${axis} upper` }]);
  },
  surfaceRegion(d: DirectGeometry, id: string, u: [number, number], v: [number, number]) {
    const picked = selectedSurface(d, id), trims = picked.object.trims;
    if (trims !== undefined && !Array.isArray(trims)) requireWholeSurface(picked.object, 'Extract region', 'DIRECT_VALUE');
    if (trims && trims.length > 0) {
      let matches = 0;
      for (const candidate of d.objects) if (candidate.id === id) matches++;
      if (matches !== 1) throw refusal('DIRECT_PICK', 'The selected surface object ID is ambiguous.');
      const used = usedIds(d), options = { surfaceId: fresh(used, 'region'), uInterval: u, vInterval: v, resultIdPrefix: freshPrefix(used, 'rg') };
      let r;
      try { r = extractTrimmedSurfaceRegion(picked.surface, trims, options); }
      catch (e) {
        if (e instanceof TrimmedSurfaceRegionError) throw refusal('DIRECT_VALUE', e.message);
        throw e;
      }
      // Empty material refuses in the producer; own all masks before one successful publication.
      const made = [];
      for (const component of r.components) made.push({
        geometry: component.surfaceId,
        name: `${picked.object.name} · region ${component.componentIndex + 1}`,
        trims: copyTrimLoops(component.trimLoops),
      });
      return add(d, [id], r.source, made);
    }
    const s = picked.surface, used = usedIds(d), r = extractSurfaceRegion(s, { surfaceId: fresh(used, 'region'), uInterval: u, vInterval: v, resultIdPrefix: freshPrefix(used, 'rg') });
    return add(d, [id], r.source, [{ geometry: r.surface.id, name: `${nameOf(d, id)} · region` }]);
  },
  isoCurve(d: DirectGeometry, id: string, axis: 'u' | 'v', p: number) {
    const r = extractSurfaceIsoCurve(surfaceOf(d, id), { fixedAxis: axis, parameter: p, curveId: fresh(usedIds(d), 'iso') });
    // (An iso-curve adds to the surface; nothing is hidden.)
    return add(d, [], r.source, [{ geometry: r.curve.id, name: `${nameOf(d, id)} · ${axis} = ${p}` }]);
  },
  reverseSurface(d: DirectGeometry, id: string, axis: 'u' | 'v') {
    const picked = selectedSurface(d, id), trims = picked.object.trims;
    if (trims !== undefined && !Array.isArray(trims)) requireWholeSurface(picked.object, 'Reverse surface', 'DIRECT_VALUE');
    const used = usedIds(d), options = { surfaceId: fresh(used, 'reversed'), axis, resultIdPrefix: freshPrefix(used, 'sr') };
    if (trims && trims.length > 0) {
      let matches = 0;
      for (const candidate of d.objects) if (candidate.id === id) matches++;
      if (matches !== 1) throw refusal('DIRECT_PICK', 'The selected surface object ID is ambiguous.');
      let r;
      try { r = reverseTrimmedSurfaceAxis(picked.surface, trims, options); }
      catch (e) {
        if (e instanceof TrimmedSurfaceAxisReversalError) throw refusal('DIRECT_VALUE', e.message);
        throw e;
      }
      // Copy the sidecar before publishing the result; the hidden source retains its original trims.
      const owned = copyTrimLoops(r.trimLoops);
      return add(d, [id], r.source, [{ geometry: r.surface.id, name: `${nameOf(d, id)} · ${axis} reversed`, trims: owned }]);
    }
    const r = reverseSurfaceAxis(picked.surface, options);
    return add(d, [id], r.source, [{ geometry: r.surface.id, name: `${nameOf(d, id)} · ${axis} reversed` }]);
  },
  insertSurfaceKnot(d: DirectGeometry, id: string, axis: 'u' | 'v', knot: number) {
    const o = object(d, id), r = insertSourceSurfaceKnot({ source: d.sources[o.source], sourceVersion: 0, surfaceId: o.geometry, axis, knot, maximumObservations: 1024 });
    return refine(d, id, r.source);
  },
  elevateCurveDegree(d: DirectGeometry, id: string) {
    const o = object(d, id), c = curveOf(d, id);
    if (c.degree >= 5) throw refusal('DIRECT_DEGREE', 'The curve is already degree 5, the highest raised to.');
    const r = elevateSourceCurveDegree({ source: d.sources[o.source], sourceVersion: 0, curveId: o.geometry, targetDegree: c.degree + 1, maximumObservations: 128 } as Parameters<typeof elevateSourceCurveDegree>[0]);
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
  /**
   * A surface filling a loop of four curves (a Coons patch: each pair of opposite sides blended, less the
   * corners' bilinear part). The curves must meet end to end, in any order and either way round. Four
   * single-span polynomial Bezier sides (degree 1..3, opposite degrees equal, corners exactly shared) give
   * the exact patch (K03); any other loop is sampled and interpolated as a bicubic B-spline.
   */
  fill(d: DirectGeometry, ids: string[]) {
    if (ids.length !== 4) throw refusal('DIRECT_LOOP', 'Pick four curves that meet end to end in a loop.');
    const cs = ids.map(id => curveOf(d, id)), at = (c: Curve, s: number) => { const [a, b] = curveDomain(c); return evaluateCurve(c, a + (b - a) * s); };
    const end = (c: Curve, k: 0 | 1) => at(c, k), gap = (p: readonly number[], q: readonly number[]) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    const size = Math.max(...cs.flatMap(c => [0, 0.5, 1].map(s => gap(at(c, s), end(cs[0], 0))))), tol = 1e-4 * Math.max(1, size);
    // Chain them: each next curve starts (or, reversed, ends) where the last one ended.
    const loop: { c: Curve; flip: boolean }[] = [{ c: cs[0], flip: false }], left = cs.slice(1);
    while (left.length) {
      const last = loop[loop.length - 1], tip = end(last.c, last.flip ? 0 : 1);
      const k = left.findIndex(c => gap(end(c, 0), tip) < tol || gap(end(c, 1), tip) < tol);
      if (k < 0) throw refusal('DIRECT_LOOP', 'The four curves do not meet end to end: each must start where another ends.');
      const c = left.splice(k, 1)[0]; loop.push({ c, flip: gap(end(c, 0), tip) >= tol });
    }
    if (gap(end(loop[3].c, loop[3].flip ? 0 : 1), end(loop[0].c, 0)) >= tol) throw refusal('DIRECT_LOOP', 'The curves do not close into a loop.');
    const exact = exactFill(d, loop);
    if (exact) return exact;
    const side = (k: number) => (s: number) => at(loop[k].c, loop[k].flip ? 1 - s : s);
    // Bottom C0(u) = side 0, right D1(v) = side 1, top C2(u) = side 2 backwards, left D0(v) = side 3 backwards.
    const C0 = side(0), D1 = side(1), C2 = (u: number) => side(2)(1 - u), D0 = (v: number) => side(3)(1 - v);
    // (16 × 16 samples: the most poles a surface of the source language takes each way.)
    const P00 = C0(0), P10 = C0(1), P01 = C2(0), P11 = C2(1), n = 15;
    const grid = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => {
      const u = i / n, v = j / n, a = C0(u), b = C2(u), c = D0(v), e = D1(v);
      return [0, 1, 2].map(k => (1 - v) * a[k] + v * b[k] + (1 - u) * c[k] + u * e[k] - ((1 - u) * (1 - v) * P00[k] + u * (1 - v) * P10[k] + (1 - u) * v * P01[k] + u * v * P11[k])) as [number, number, number];
    }));
    const fit = interpolateSurfacePlain(grid);
    return add(d, [], surfacesSource('fill', [fit]), [{ geometry: 's1', name: 'Filled surface' }]);
  },
  /** The surface run on past one of its edges along its tangent there by `distance` mm (re-fitted as a bicubic B-spline). */
  extendSurface(d: DirectGeometry, id: string, edge: 'u-min' | 'u-max' | 'v-min' | 'v-max', distance: number) {
    if (!(distance > 0)) throw refusal('DIRECT_VALUE', 'Extend by a positive distance.');
    // (12 rows of the surface and 4 beyond it, 16 across: the most poles a surface takes each way.)
    const s = wholeSurfaceOf(d, id, 'Extend surface'), dom = surfaceDomain(s), n = 11, across = 15, extra = 4, alongU = edge.startsWith('u'), atMax = edge.endsWith('max');
    const [a0, a1] = alongU ? dom.u : dom.v, [b0, b1] = alongU ? dom.v : dom.u;
    const S = (a: number, b: number) => alongU ? evaluateSurface(s, a, b) : evaluateSurface(s, b, a);
    // Rows across the extended direction: the surface's own, then straight on along the unit tangent at the edge.
    const rows: [number, number, number][][] = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; rows.push(Array.from({ length: across + 1 }, (_, j) => S(a, b0 + (b1 - b0) * j / across) as [number, number, number])); }
    const eA = atMax ? a1 : a0, h = (a1 - a0) * 1e-3, tangent = (b: number) => { const p = S(eA, b), q = S(atMax ? eA - h : eA + h, b), t = [0, 1, 2].map(k => (p[k] - q[k])), l = Math.hypot(...t) || 1; return t.map(x => x / l); };
    const edgeRow = atMax ? rows[n] : rows[0], tans = Array.from({ length: across + 1 }, (_, j) => tangent(b0 + (b1 - b0) * j / across));
    const more = Array.from({ length: extra }, (_, k) => edgeRow.map((p, j) => p.map((x, c) => x + tans[j][c] * distance * (k + 1) / extra) as [number, number, number]));
    const all = atMax ? [...rows, ...more] : [...more.reverse(), ...rows];
    // (Back to u along the first index when the run was across v.)
    const grid = alongU ? all : all[0].map((_, j) => all.map(r => r[j]));
    return add(d, [id], surfacesSource('extended', [interpolateSurfacePlain(grid)]), [{ geometry: 's1', name: `${nameOf(d, id)} · extended` }]);
  },
  /**
   * The curve fitted again with `count` poles (least squares through 64 samples of it, cubic, its ends
   * kept); its name says the largest gap from the samples, in mm.
   */
  refitCurve(d: DirectGeometry, id: string, count: number) {
    const c = curveOf(d, id), pts = sampleCurve(c, 64).map(s => [s.point[0], s.point[1], s.point[2]] as [number, number, number]);
    const f = approximateCurvePlain(pts, Math.round(count)), fc: Curve = { kind: 'curve', id: 'f', degree: f.degree, knots: f.knots, controlPoints: f.points, weights: f.weights };
    // The largest distance from a sample to the fit (each against the nearest of 512 points along it).
    const along = sampleCurve(fc, 512).map(s => s.point), worst = Math.max(...pts.map(p => Math.min(...along.map(q => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])))));
    return add(d, [id], curvesSource('fitted', [{ degree: f.degree, knots: f.knots, points: f.points, weights: f.weights }]), [{ geometry: 'c1', name: `${nameOf(d, id)} · ${f.points.length} poles (±${Math.round(worst * 1000) / 1000})` }]);
  },
  /** The curve without its interior knot nearest `u`, when it stays within `tol` mm; refused when the knot carries shape. */
  removeCurveKnot(d: DirectGeometry, id: string, u: number, tol: number) {
    const c = curveOf(d, id), r = removeCurveKnotPlain({ degree: c.degree, knots: [...c.knots], points: c.controlPoints.map(p => [p[0], p[1], p[2]] as [number, number, number]), weights: [...c.weights] }, u, tol);
    if (!r) throw refusal('DIRECT_KNOT', `That knot cannot come out without moving the curve more than ${tol} mm (or it has none inside).`);
    return add(d, [id], curvesSource('knot', [r]), [{ geometry: 'c1', name: `${nameOf(d, id)} · knot removed` }]);
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
    if (!(k > 0)) throw refusal('DIRECT_VALUE', 'A scale is a positive factor.');
    return directOps.transform(d, ids, p => aboutCentre([k, 0, 0, 0, k, 0, 0, 0, k], p));
  },
  /** Stretched along X, Y and Z by their own factors, about each object's centre. */
  stretch(d: DirectGeometry, ids: string[], k: [number, number, number]) {
    if (!k.every(x => x > 0)) throw refusal('DIRECT_VALUE', 'Each stretch is a positive factor.');
    return directOps.transform(d, ids, p => aboutCentre([k[0], 0, 0, 0, k[1], 0, 0, 0, k[2]], p));
  },
  /** Sheared: `along` moves by `k` times the distance along `by` (x += k·y for along x, by y), about each centre. */
  shear(d: DirectGeometry, ids: string[], along: 'x' | 'y' | 'z', by: 'x' | 'y' | 'z', k: number) {
    if (along === by) throw refusal('DIRECT_VALUE', 'A shear moves one axis by another: pick two different axes.');
    if (!Number.isFinite(k)) throw refusal('DIRECT_VALUE', 'Give the shear a factor.');
    const R = [1, 0, 0, 0, 1, 0, 0, 0, 1]; R['xyz'.indexOf(along) * 3 + 'xyz'.indexOf(by)] = k;
    return directOps.transform(d, ids, p => aboutCentre(R, p));
  },
  duplicate(d: DirectGeometry, ids: string[]) {
    const used = usedIds(d);
    return { ...d, objects: [...d.objects, ...ids.map(id => { const o = object(d, id); return { ...o, id: fresh(used, 'obj'), name: `${o.name} copy`, hidden: false }; })] };
  },
  rename(d: DirectGeometry, id: string, name: string) {
    const n = name.trim();
    if (!n) throw refusal('DIRECT_VALUE', 'A name is needed.');
    return { ...d, objects: d.objects.map(o => o.id === id ? { ...o, name: n } : o) };
  },
  /** A surface through 2–15 curves of the same degree and knots, in selection order (cubic across them when there are enough). */
  loft(d: DirectGeometry, ids: string[]) {
    if (ids.length < 2 || ids.length > 15) throw refusal('DIRECT_LOFT', 'Loft through 2 to 15 curves.');
    // (Each section its own id: curves from different sources may share one.)
    const used = usedIds(d), sections = compatible(d, ids).map(g => ({ ...g, id: fresh(used, 'section') })), n = sections.length;
    const r = buildMultiSectionLoftSurface(sections, sections.map((_, i) => i / (n - 1)), {
      surfaceId: fresh(usedIds(d), 'loft'), degreeV: Math.min(3, n - 1), maximumBasisEvaluations: 3600, maximumEliminationSteps: 1680, maximumObservations: 465 });
    return add(d, [], r.source, [{ geometry: r.surface.id, name: 'Lofted surface' }]);
  },
  sweep(d: DirectGeometry, profile: string, rail: string) {
    const r = buildTranslationalSweepSurface(curveOf(d, profile), curveOf(d, rail), { surfaceId: fresh(usedIds(d), 'swept'), maximumObservations: 961 });
    return add(d, [], r.source, [{ geometry: r.surface.id, name: 'Swept surface' }]);
  },
};

/**
 * The curves made alike for a loft (the same degree and knots), shape kept: each raised to the highest
 * degree among them, then given the knots the others have (exact degree elevation and knot insertion).
 * Their domains must match.
 */
function compatible(d: DirectGeometry, ids: string[]): Curve[] {
  const doms = ids.map(id => curveDomain(curveOf(d, id)));
  if (doms.some(t => Math.abs(t[0] - doms[0][0]) > 1e-12 || Math.abs(t[1] - doms[0][1]) > 1e-12)) throw refusal('DIRECT_RANGE', 'The curves run over different parameter ranges: trim or rebuild them to one range first.');
  let w = d;
  const top = Math.max(...ids.map(id => curveOf(w, id).degree));
  for (const id of ids) while (curveOf(w, id).degree < top) w = directOps.elevateCurveDegree(w, id);
  // Interior knots with their multiplicities; each curve takes the most any curve has of each.
  const counts = (c: Curve) => { const m = new Map<number, number>(), k = c.knots, p = c.degree; for (let i = p + 1; i < k.length - p - 1; i++) m.set(k[i], (m.get(k[i]) ?? 0) + 1); return m; };
  const want = new Map<number, number>();
  for (const id of ids) for (const [k, n] of counts(curveOf(w, id))) {
    const near = [...want.keys()].find(x => Math.abs(x - k) < 1e-12) ?? k; want.set(near, Math.max(want.get(near) ?? 0, n));
  }
  for (const id of ids) for (const [k, n] of want) {
    const have = () => [...counts(curveOf(w, id))].filter(([x]) => Math.abs(x - k) < 1e-12).reduce((t, [, c]) => t + c, 0);
    for (let guard = 0; have() < n && guard < 8; guard++) w = directOps.insertCurveKnot(w, id, k);
  }
  return ids.map(id => curveOf(w, id));
}

/** Where a curve crosses the plane `axis` = `at`: its parameters and points (sampled, then bisected to 1e-12). */
export function curvePlaneCrossings(d: DirectGeometry, id: string, axis: 'x' | 'y' | 'z', at: number): { t: number; point: [number, number, number] }[] {
  const c = curveOf(d, id), [t0, t1] = curveDomain(c), k = 'xyz'.indexOf(axis), f = (t: number) => evaluateCurve(c, t)[k] - at, N = 512, out: { t: number; point: [number, number, number] }[] = [];
  if (Array.from({ length: 33 }, (_, i) => f(t0 + (t1 - t0) * i / 32)).every(v => Math.abs(v) < 1e-9)) throw refusal('DIRECT_PLANE', `The curve lies in the plane ${axis.toUpperCase()} = ${at}: it does not cross it.`);
  let pt = t0, pf = f(t0);
  if (Math.abs(pf) < 1e-12) out.push({ t: t0, point: [...evaluateCurve(c, t0)] as [number, number, number] });
  for (let i = 1; i <= N; i++) {
    const t = t0 + (t1 - t0) * i / N, v = f(t);
    if (Math.abs(v) < 1e-12) out.push({ t, point: [...evaluateCurve(c, t)] as [number, number, number] });
    else if (pf * v < 0 && Math.abs(pf) >= 1e-12) {
      let lo = pt, hi = t, flo = pf;
      for (let it = 0; it < 80 && hi - lo > 1e-14 * (1 + Math.abs(hi)); it++) { const m = (lo + hi) / 2, fm = f(m); if (flo * fm <= 0) hi = m; else { lo = m; flo = fm; } }
      const tt = (lo + hi) / 2; out.push({ t: tt, point: [...evaluateCurve(c, tt)] as [number, number, number] });
    }
    pt = t; pf = v;
  }
  return out;
}
/**
 * Where two surfaces meet, as curves (each traced chain a polyline through its points, at most 64), or
 * why not: none where they do not meet, refused where they touch or overlap along a curve.
 */
export function surfaceIntersection(d: DirectGeometry, a: string, b: string): { direct: DirectGeometry; count: number } {
  const first = selectedSurface(d, a), second = selectedSurface(d, b);
  requireWholeSurface(first.object, 'Intersect surfaces', 'DIRECT_INTERSECT');
  requireWholeSurface(second.object, 'Intersect surfaces', 'DIRECT_INTERSECT');
  const A = first.surface, B = second.surface, da = surfaceDomain(A), db = surfaceDomain(B);
  // Past its domain a patch runs on along its tangent plane (so the marcher's corrections converge at an edge).
  const patch = (s: Surface, dom: { u: [number, number]; v: [number, number] }) => ({
    at: (p: [number, number]) => {
      const u = Math.min(dom.u[1], Math.max(dom.u[0], p[0])), v = Math.min(dom.v[1], Math.max(dom.v[0], p[1])), q = evaluateSurface(s, u, v);
      if (u === p[0] && v === p[1]) return q;
      const hu = 1e-6 * (dom.u[1] - dom.u[0]), hv = 1e-6 * (dom.v[1] - dom.v[0]), su = u - hu >= dom.u[0] ? -1 : 1, sv = v - hv >= dom.v[0] ? -1 : 1;
      const qu = evaluateSurface(s, u + su * hu, v), qv = evaluateSurface(s, u, v + sv * hv), du = p[0] - u, dv = p[1] - v;
      return [0, 1, 2].map(k => q[k] + (qu[k] - q[k]) / (su * hu) * du + (qv[k] - q[k]) / (sv * hv) * dv) as [number, number, number];
    },
    box: [[dom.u[0], dom.v[0]], [dom.u[1], dom.v[1]]] as [[number, number], [number, number]],
  });
  const pa = patch(A, da), pb = patch(B, db), pts = [...A.controlPoints.flat(), ...B.controlPoints.flat()];
  const lo = [0, 1, 2].map(k => Math.min(...pts.map(p => p[k]))), hi = [0, 1, 2].map(k => Math.max(...pts.map(p => p[k]))), diag = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 1;
  let chains;
  try { chains = intersectPatches(pa, pb, { step: diag / 120, tolerance: 1e-6 * diag }); }
  catch (e) { if (e instanceof SurfaceIntersectionError) throw refusal('DIRECT_INTERSECT', `These surfaces cannot be intersected: ${e.message.replace(/^Surface intersection: /, '')}.`); throw e; }
  if (!chains.length) throw refusal('DIRECT_INTERSECT', 'These surfaces do not meet.');
  const num = (v: number) => String(Math.round(v * 1e9) / 1e9);
  const curves = chains.slice(0, 16).map((ch, k) => {
    const ps = [...ch.points, ...(ch.closed ? [ch.points[0]] : [])], step = Math.max(1, Math.ceil((ps.length - 1) / 63)), poly = ps.filter((_, i) => i % step === 0 || i === ps.length - 1);
    return `  @curve #x${k + 1} { type: nurbs; degree: 1; knots: [${[0, ...poly.map((_, i) => i), poly.length - 1].join(',')}]; control-points: [${poly.map(p => `[${p.map(num).join(',')}]`).join(',')}]; weights: [${poly.map(() => 1).join(',')}]; }`;
  });
  const text = `@model meet {\n  version: 0;\n  length-unit: mm;\n${curves.join('\n')}\n}`;
  const direct = importSource(d, text, `${nameOf(d, a)} × ${nameOf(d, b)}`);
  return { direct, count: curves.length };
}

/** A Bezier side as the loop runs it: reversed, its poles (and weights) in the other order; its [0,1] knots are symmetric. */
function runAs(c: Curve, flip: boolean): Curve {
  return flip ? { ...c, controlPoints: [...c.controlPoints].reverse(), weights: [...c.weights].reverse() } : c;
}
/**
 * The exact Coons patch of a chained loop when all four sides are polynomial Bezier spans the kernel admits, or null
 * (then the caller samples). Bottom = side 0, right = side 1, top = side 2 and left = side 3, the last two run backwards.
 */
function exactFill(d: DirectGeometry, loop: readonly { c: Curve; flip: boolean }[]): DirectGeometry | null {
  const used = usedIds(d), surfaceId = fresh(used, 'fill');
  let made: ReturnType<typeof buildBezierCoonsSurface>;
  try {
    made = buildBezierCoonsSurface({ bottom: runAs(loop[0].c, loop[0].flip), right: runAs(loop[1].c, loop[1].flip),
      top: runAs(loop[2].c, !loop[2].flip), left: runAs(loop[3].c, !loop[3].flip) }, { surfaceId });
  } catch { return null; }
  return add(d, [], made.source, [{ geometry: made.surface.id, name: 'Filled surface' }]);
}

/** A short prefix none of whose role names is taken (the operations derive helper ids from it). */
function freshPrefix(used: Set<string>, stem: string, max = 20): string {
  for (let i = 1; ; i++) {
    const p = `${stem}${i}`;
    if (p.length > max) throw refusal('DIRECT_ID', 'No free id prefix.');
    if (![...used].some(id => id.startsWith(p))) { used.add(p); return p; }
  }
}

export interface DirectDisplay {
  id: string; name: string; kind: 'curve' | 'surface';
  /** Surfaces: a triangle mesh (mm); curves: line segments (pairs of points). */
  positions: Float32Array; normals?: Float32Array; indices?: Uint32Array;
  /** Curves: the control polygon; surfaces: the control net rows and columns (segments). */
  controls: Float32Array;
  /** Surfaces: isocurves of both families, eight each way (segments). */
  isos?: Float32Array;
}

/** What the viewport draws of the visible objects. Objects that fail to evaluate are left out. */
// Each object's display, by its source text and geometry (a pole drag re-evaluates one object, not all):
// only the entries the last call used are kept.
let displays = new Map<string, { text: string; trims?: TrimLoop[]; out: DirectDisplay[] }>();
export function directDisplay(d: DirectGeometry | undefined): DirectDisplay[] {
  if (!d) return [];
  const used = new Map<string, { text: string; trims?: TrimLoop[]; out: DirectDisplay[] }>();
  const shown = d.objects.filter(o => !o.hidden).flatMap((o): DirectDisplay[] => {
    const key = `${o.id}\u0000${o.name}\u0000${o.source}\u0000${o.geometry}`, text = d.sources[o.source], have = displays.get(key);
    if (have && have.text === text && have.trims === o.trims) { used.set(key, have); return have.out; }
    const out = displayOf(d, o); used.set(key, { text, trims: o.trims, out }); return out;
  });
  displays = used;
  return shown;
}
/** A generated isocurve sample stays in the native closed domain, including its exact endpoints. */
function displayParameter(lo: number, hi: number, index: number, count: number): number {
  if (index === 0) return lo;
  if (index === count) return hi;
  return Math.max(lo, Math.min(hi, lo + (hi - lo) * index / count));
}
function displayOf(d: DirectGeometry, o: DirectGeometry['objects'][number]): DirectDisplay[] {
  try {
    const g = geometryOf(d, o);
    if (g.kind === 'curve') {
      const pts = sampleCurve(g, 128).map(s => s.point), seg: number[] = [], ctl: number[] = [];
      for (let i = 0; i + 1 < pts.length; i++) seg.push(...pts[i], ...pts[i + 1]);
      for (let i = 0; i + 1 < g.controlPoints.length; i++) ctl.push(...g.controlPoints[i], ...g.controlPoints[i + 1]);
      return [{ id: o.id, name: o.name, kind: 'curve', positions: new Float32Array(seg), controls: new Float32Array(ctl) }];
    }
    const trims = o.trims?.length ? o.trims : null;
    const p = trims ? trimmedMesh(g, trims) : trimmedMesh(g, [], 31), ctl: number[] = [], P = g.controlPoints;
    for (let i = 0; i < P.length; i++) for (let j = 0; j < P[i].length; j++) {
      if (i + 1 < P.length) ctl.push(...P[i][j], ...P[i + 1][j]);
      if (j + 1 < P[i].length) ctl.push(...P[i][j], ...P[i][j + 1]);
    }
    // Isocurves: u = const and v = const at eight steps across each domain (ends included).
    // (Redrawn on every pole drag step: one evaluator, validated once, for all its samples.)
    const dom = surfaceDomain(g), at = surfaceEvaluator(g), iso: number[] = [], N = 32, su = dom.u[1] - dom.u[0], sv = dom.v[1] - dom.v[0];
    for (const [fixU, a, b] of [[true, dom.u, dom.v], [false, dom.v, dom.u]] as const) for (let k = 0; k <= 7; k++) {
      const c = displayParameter(a[0], a[1], k, 7);
      let prev: readonly number[] | null = null;
      let was = true;
      for (let i = 0; i <= N; i++) {
        const t = displayParameter(b[0], b[1], i, N), u = fixU ? c : t, v = fixU ? t : c, q = at(u, v), keep = !trims || keptAt(trims, u, v, su, sv);
        if (prev && keep && was) iso.push(...prev, ...q); prev = q; was = keep;
      }
    }
    // The trim loops' edges on the surface.
    for (const l of trims ?? []) for (let k = 0; k < l.uv.length; k++) { const a = l.uv[k], b = l.uv[(k + 1) % l.uv.length]; iso.push(...at(a[0], a[1]), ...at(b[0], b[1])); }
    return [{ id: o.id, name: o.name, kind: 'surface', positions: Float32Array.from(p.positions), normals: Float32Array.from(p.normals), indices: Uint32Array.from(p.indices), controls: new Float32Array(ctl), isos: new Float32Array(iso) }];
  } catch { return []; }
}

/** An object's parameter domain(s), for the tools' fields. */
/** The poles of a curve (keys "i") or a surface (keys "i,j"), for picking and dragging in the viewport. */
export function polesOf(d: DirectGeometry, id: string): { key: string; at: [number, number, number] }[] {
  const g = geometryOf(d, object(d, id));
  if (g.kind === 'curve') return g.controlPoints.map((p, i) => ({ key: String(i), at: [p[0], p[1], p[2]] }));
  return g.controlPoints.flatMap((row, i) => row.map((p, j) => ({ key: `${i},${j}`, at: [p[0], p[1], p[2]] as [number, number, number] })));
}
/** The object with one pole (a `polesOf` key) moved to `at`. */
export function movePole(d: DirectGeometry, id: string, key: string, at: readonly number[]): DirectGeometry {
  const pole = { xMM: at[0], yMM: at[1], zMM: at[2] }, [i, j] = key.split(',').map(Number);
  return key.includes(',') ? directOps.editSurfacePole(d, id, i, j, pole) : directOps.editCurvePole(d, id, i, pole);
}

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
  return { point: r.derivatives.point, tangent: r.unitTangent, curvature: r.curvaturePer, radius: r.radius };
}
/** A surface at (u, v): its point, normal and mean and Gaussian curvature. */
export function analyzeSurface(d: DirectGeometry, id: string, u: number, v: number) {
  const r = evaluateSurfaceCurvature(surfaceOf(d, id), u, v);
  return { point: r.derivatives.point, normal: r.unitNormal, mean: r.meanCurvaturePer, gaussian: r.gaussianCurvaturePer };
}
/** The visible curves and surfaces as one IGES file (at most 16; named by their object ids). */
export function directIGES(d: DirectGeometry, name = 'barocss_part'): string {
  const visible = d.objects.filter(o => !o.hidden);
  if (!visible.length) throw refusal('IGES_EXPORT', 'There are no visible curves or surfaces to export.');
  if (visible.length > 16) throw refusal('IGES_EXPORT', 'IGES export takes at most 16 curves and surfaces: hide some first.');
  const objects: (Curve | Surface)[] = [];
  for (const o of visible) {
    const g = geometryOf(d, o);
    if (g.kind === 'surface') requireWholeSurface(o, 'Export IGES', 'IGES_EXPORT');
    objects.push({ ...g, id: o.id });
  }
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

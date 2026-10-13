import type { Curve, Surface, OwnNativeFaceMesh, OwnPlateHolePreviewContext, StoredCirclePrismSolidResult,
  XYCirclePrismShellBundle, XYCirclePrismShellPreviewResult, XYCirclePrismShellReport } from '@barocss/cad';

/** Copied native proof, never a certification of these sampled triangles or ideal pi-volume. */
export type ModelingCircleQualification = StoredCirclePrismSolidResult['certificate'];
export interface ModelingCircleLineage extends XYCirclePrismShellBundle {
  source: { modelId: string; sourceVersion: 0; objectIds: string[] };
}
export interface ModelingCircleDisplayComponent {
  family: 'stored-rational-circle-prism'; role: string; solidId: string;
  adapterBasis: 'authored-xyz-despite-original-y-up-label';
  preview: XYCirclePrismShellPreviewResult; mesh: OwnNativeFaceMesh;
  qualification: ModelingCircleQualification; lineage: ModelingCircleLineage;
}
const BASIS = 'authored-xyz-despite-original-y-up-label';
const RING = Array.from({ length: 17 }, (_, i) => i / 4);
const QUALIFICATION = { kind: 'restricted-stored-rational-circle-prism-solid', version: 0, lengthUnit: 'mm',
  geometryAuthority: 'stored-coefficient-mathematical-model', solid: true, topologyCertified: true, embeddedStoredGeometryCertified: true,
  materialComponentCount: 1, genus: 0, faceCount: 3, vertexCount: 2, edgeCount: 3, loopCount: 3, edgeUseCount: 6, eulerCharacteristic: 2 } as const;
function check(value: unknown, message: string): asserts value { if (!value) throw new Error('Circle display: ' + message); }
function exact(value: object, fields: string[]): void {
  check(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === fields.length
    && fields.every(k => Object.hasOwn(value, k)), 'exact copied fields required: ' + fields.join(','));
}
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => same(v, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
    return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => Object.hasOwn(y, k) && same(x[k], y[k]));
  }
  return Object.is(a, b);
}
function id(value: unknown, limit = 128): asserts value is string {
  check(typeof value === 'string' && value.length <= limit && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), 'bounded native identity');
}
function unique(values: string[]): void { values.forEach(v => id(v)); check(new Set(values).size === values.length, 'unique native identities'); }
function tuple(value: unknown, length: number): asserts value is number[] {
  check(Array.isArray(value) && value.length === length && value.every(v => typeof v === 'number' && Number.isFinite(v)), 'finite numeric tuple');
}
function near(a: number[], b: number[], tolerance = 1e-7): boolean {
  return a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= tolerance);
}
function close(a: number, b: number): boolean { return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-10 * Math.max(1, Math.abs(a), Math.abs(b)); }
/** No getters, geometry evaluation, construction, qualification, or source compilation. */
function copyOwn<T>(input: T): T {
  let remaining = 131072, characters = 0; const active = new Set<object>();
  function copy(v: unknown, depth: number): unknown {
    check(--remaining >= 0 && depth <= 24, 'own-data occurrence/depth budget');
    if (typeof v === 'number') { check(Number.isFinite(v), 'finite copied numbers'); return v; }
    if (typeof v === 'string') { characters += v.length; check(v.length <= 262144 && characters <= 1048576, 'copied string budget'); return v; }
    if (v === null || typeof v === 'boolean') return v;
    check(typeof v === 'object' && !active.has(v), 'plain acyclic own data');
    const array = Array.isArray(v), proto = Object.getPrototypeOf(v), keys = Reflect.ownKeys(v), descriptors = Object.getOwnPropertyDescriptors(v);
    check(array ? proto === Array.prototype : proto === Object.prototype || proto === null, 'foreign prototype');
    check(keys.length <= (array ? 23815 : 64) && keys.every(k => typeof k === 'string' && k.length <= 128 && 'value' in descriptors[k]
      && (array && k === 'length' || descriptors[k].enumerable)), 'accessors/symbols/hidden fields refuse');
    active.add(v);
    try {
      if (array) {
        const length = descriptors.length.value as number;
        check(length <= 23814 && keys.length === length + 1, 'dense bounded array');
        return Array.from({ length }, (_, i) => { check(Object.hasOwn(descriptors, String(i)), 'sparse array'); return copy(descriptors[String(i)].value, depth + 1); });
      }
      return Object.fromEntries((keys as string[]).map(k => [k, copy(descriptors[k].value, depth + 1)]));
    } finally { active.delete(v); }
  }
  const result = copy(input, 0) as T; check(JSON.stringify(result).length <= 2 * 1024 * 1024, 'transport exceeds 2 MiB'); return result;
}
function curve(c: Curve): void {
  exact(c, ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']); id(c.id);
  check(c.kind === 'curve' && (c.degree === 1 || c.degree === 2) && c.controlPoints.length === (c.degree === 1 ? 2 : 9), 'native curve inventory');
  tuple(c.knots, c.controlPoints.length + c.degree + 1); tuple(c.weights, c.controlPoints.length);
  c.controlPoints.forEach(p => tuple(p, 3)); check(c.weights.every(v => v > 0), 'positive native weights');
  check(same(c.knots, c.degree === 2 ? [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4] : [0, 0, c.knots.at(-1), c.knots.at(-1)])
    && (c.knots.at(-1) === 1 || c.knots.at(-1) === 4), 'native curve domain/knots');
}
function surface(s: Surface, wall: boolean): void {
  exact(s, ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']); id(s.id);
  check(s.kind === 'surface' && s.degreeU === (wall ? 2 : 1) && s.degreeV === 1
    && same(s.knotsU, wall ? [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4] : [0, 0, 1, 1]) && same(s.knotsV, [0, 0, 1, 1])
    && s.controlPoints.length === (wall ? 9 : 2) && s.weights.length === s.controlPoints.length, 'native Surface domain/inventory');
  for (const [i, row] of s.controlPoints.entries()) { check(row.length === 2, 'native Surface row'); row.forEach(p => tuple(p, 3)); tuple(s.weights[i], 2); check(s.weights[i].every(v => v > 0), 'positive Surface weights'); }
}
/** Retained affine coefficients bind copied UV to copied XYZ; no native evaluator or replacement sample. */
function capSampleMatchesAffineSupport(s: Surface, uv: number[], point: number[]): boolean {
  const origin = s.controlPoints[0][0], u = s.controlPoints[1][0].map((v, a) => v - origin[a]);
  const v = s.controlPoints[0][1].map((n, a) => n - origin[a]);
  check(s.degreeU === 1 && s.degreeV === 1 && same(s.weights, [[1, 1], [1, 1]])
    && u[0] > 0 && u[1] === 0 && u[2] === 0 && v[1] > 0 && v[0] === 0 && v[2] === 0
    && near(s.controlPoints[1][1], origin.map((n, a) => n + u[a] + v[a])), 'retained affine XY cap support');
  const residual = point.map((n, a) => n - (origin[a] + uv[0] * u[a] + uv[1] * v[a]));
  return residual.every(Number.isFinite) && Math.hypot(...residual) <= 1e-7;
}
function qualification(q: ModelingCircleQualification, l: ModelingCircleLineage): void {
  exact(q, [...Object.keys(QUALIFICATION), 'planarFaces', 'ringProof', 'wallProof', 'vertexLinks', 'faceAdjacency', 'arithmetic', 'directCounts']);
  check(Object.entries(QUALIFICATION).every(([k, v]) => q[k as keyof typeof QUALIFICATION] === v), 'copied stored-boundary qualification');
  const t = l.topology;
  check(q.planarFaces.length === 2 && q.vertexLinks.length === 2 && q.faceAdjacency.length === 3, 'complete copied proof inventory');
  for (const [i, p] of q.planarFaces.entries()) { exact(p, ['faceId', 'normalSign', 'useId', 'poleCompositionCount']);
    check(p.faceId === t.faces[i].id && p.normalSign === (i === 0 ? -1 : 1) && p.useId === t.loops[i].uses[0].id && p.poleCompositionCount === 9, 'cap proof identity'); }
  exact(q.ringProof, ['bottomEdgeId', 'topEdgeId', 'storedMiddleWeight', 'quadrants']);
  check(q.ringProof.bottomEdgeId === t.edges[0].id && q.ringProof.topEdgeId === t.edges[1].id
    && q.ringProof.storedMiddleWeight === (l.geometry.objects[0] as Curve).weights[1] && q.ringProof.quadrants.length === 4, 'ring proof identity');
  for (const [i, quadrant] of q.ringProof.quadrants.entries()) {
    exact(quadrant, ['index', 'derivativeNumeratorsX', 'derivativeNumeratorsY']); check(quadrant.index === i, 'ordered native quadrant proof');
    for (const coefficients of [quadrant.derivativeNumeratorsX, quadrant.derivativeNumeratorsY]) {
      check(coefficients.length === 3, 'complete copied derivative numerators');
      for (const f of coefficients) { exact(f, ['numerator', 'denominator']); check(/^-?(0|[1-9][0-9]{0,127})$/.test(f.numerator)
        && /^[1-9][0-9]{0,127}$/.test(f.denominator), 'bounded native fraction strings'); }
    }
  }
  exact(q.wallProof, ['faceId', 'seamEdgeId', 'heightMM']);
  check(q.wallProof.faceId === t.faces[2].id && q.wallProof.seamEdgeId === t.edges[2].id && q.wallProof.heightMM === l.construction.heightMM, 'wall proof identity');
  for (const [i, link] of q.vertexLinks.entries()) {
    exact(link, ['vertexId', 'germs', 'corners', 'cycle']);
    check(link.vertexId === t.vertices[i].id && link.germs.length === 3 && link.corners.length === 3 && link.cycle.length === 3, 'native vertex-link inventory');
    const germ = (g: typeof link.germs[number]) => { exact(g, ['edgeId', 'endpointIndex']);
      check((g.endpointIndex === 0 || g.endpointIndex === 1) && t.edges.some(e => e.id === g.edgeId && e.vertexIds[g.endpointIndex] === link.vertexId), 'native incident endpoint germ'); };
    [...link.germs, ...link.cycle].forEach(germ);
    check(new Set(link.germs.map(g => g.edgeId + ':' + g.endpointIndex)).size === 3
      && link.germs.every(g => link.cycle.some(c => same(c, g))), 'complete native vertex-link cycle');
    for (const c of link.corners) { exact(c, ['faceId', 'loopId', 'incomingUseId', 'outgoingUseId', 'from', 'to']); germ(c.from); germ(c.to);
      const loop = t.loops.find(v => v.id === c.loopId && v.faceId === c.faceId), incoming = loop?.uses.findIndex(u => u.id === c.incomingUseId);
      check(loop && incoming !== undefined && incoming >= 0 && loop.uses[(incoming + 1) % loop.uses.length].id === c.outgoingUseId
        && loop.uses[incoming].edgeId === c.from.edgeId && loop.uses[(incoming + 1) % loop.uses.length].edgeId === c.to.edgeId
        && c.from.endpointIndex === (loop.uses[incoming].sense === 'forward' ? 1 : 0)
        && c.to.endpointIndex === (loop.uses[(incoming + 1) % loop.uses.length].sense === 'forward' ? 0 : 1), 'native corner/use identity');
    }
    check(same(link.cycle[0], link.germs[0]) && link.cycle.every((g, j) => link.corners.filter(c => same(c.from, g)).length === 1
      && link.corners.some(c => same(c.from, g) && same(c.to, link.cycle[(j + 1) % 3]))), 'copied oriented endpoint-germ cycle');
  }
  for (const [i, a] of q.faceAdjacency.entries()) { exact(a, ['faceId', 'adjacentFaceIds']);
    check(a.faceId === t.faces[i].id && same(a.adjacentFaceIds, i < 2 ? [t.faces[2].id] : t.faces.map(f => f.id)), 'complete cap/wall/seam adjacency'); }
  exact(q.arithmetic, ['operations', 'gcdSteps', 'floatSearchSteps', 'floatConversions', 'maximumObservedBits']);
  check(Object.values(q.arithmetic).every(v => Number.isSafeInteger(v) && v >= 0) && q.arithmetic.operations > 0
    && q.arithmetic.maximumObservedBits > 0 && q.arithmetic.floatConversions === 0 && q.arithmetic.floatSearchSteps === 0, 'copied proof arithmetic observations');
  check(same(q.directCounts, { parentReconstructionCalls: 1, wholeModelCompilations: 1, capUseCount: 2, capPoleCompositions: 18,
    wallUseCount: 4, cornerCount: 6, germCount: 6 }), 'copied direct qualification counts');
}
function lineage(l: ModelingCircleLineage, r: XYCirclePrismShellReport, solidId: string): void {
  exact(l, ['construction', 'geometry', 'topology', 'source']);
  const { construction: c, geometry: g, topology: t } = l;
  exact(c, ['profile', 'shellId', 'heightMM']); exact(c.profile, ['kind', 'id', 'center', 'radius']); tuple(c.profile.center, 2); id(c.profile.id, 48); id(c.shellId, 48);
  check(c.profile.kind === 'circle' && c.profile.center.every(v => Math.abs(v) <= 10000) && c.profile.radius >= .001 && c.profile.radius <= 10000
    && c.heightMM >= .001 && c.heightMM <= 10000, 'finite authored circle dimensions');
  exact(g, ['name', 'version', 'lengthUnit', 'objects']); id(g.name);
  check(g.version === 0 && g.lengthUnit === 'mm' && g.objects.length === 6, 'complete native world model'); unique(g.objects.map(o => o.id));
  exact(l.source, ['modelId', 'sourceVersion', 'objectIds']);
  check(l.source.modelId === g.name && l.source.sourceVersion === 0 && same(l.source.objectIds, g.objects.map(o => o.id)), 'complete original Source0/model identities');
  exact(t, ['version', 'kind', 'id', 'sourceCurveId', 'vertices', 'edges', 'faces', 'loops']);
  check(t.version === 0 && t.kind === 'xy-circle-prism-shell' && t.id === solidId && t.id === c.shellId && t.sourceCurveId === c.profile.id
    && t.vertices.length === 2 && t.edges.length === 3 && t.faces.length === 3 && t.loops.length === 3, 'complete native shell inventory/identity');
  unique([t.id, ...t.vertices.map(v => v.id), ...t.edges.map(e => e.id), ...t.faces.map(f => f.id), ...t.loops.map(v => v.id),
    ...g.objects.map(o => o.id), ...t.loops.flatMap(v => v.uses.flatMap(u => [u.id, u.pcurve.curve.id]))]);
  for (const v of t.vertices) { exact(v, ['id', 'point']); tuple(v.point, 3); }
  for (const [i, e] of t.edges.entries()) { exact(e, ['id', 'curveId', 'vertexIds', 'sourceParameterRange']);
    check(e.curveId === g.objects[i].id && same(e.sourceParameterRange, [0, i === 2 ? 1 : 4])
      && same(e.vertexIds, i < 2 ? [t.vertices[i].id, t.vertices[i].id] : t.vertices.map(v => v.id)), 'native closed-ring/seam edge identity');
    curve(g.objects[i] as Curve); check(g.objects[i].kind === 'curve', 'native curve order'); }
  for (const [i, f] of t.faces.entries()) { exact(f, ['id', 'surfaceId', 'outerLoopId', 'orientation', 'role']);
    check(f.role === ['bottom-cap', 'top-cap', 'wall'][i] && f.orientation === (i === 0 ? 'reverse' : 'forward')
      && f.surfaceId === g.objects[i + 3].id && f.outerLoopId === t.loops[i].id, 'ordered native face/surface/sense identity');
    surface(g.objects[i + 3] as Surface, i === 2);
    const loop = t.loops[i]; exact(loop, ['id', 'faceId', 'uses']);
    check(loop.faceId === f.id && loop.uses.length === (i === 2 ? 4 : 1), 'complete original native loop uses');
    for (const [j, use] of loop.uses.entries()) {
      exact(use, ['id', 'edgeId', 'sense', 'pcurve']); exact(use.pcurve, ['coordinateSystem', 'domain', 'curve']); curve(use.pcurve.curve);
      const edge = t.edges[i === 2 ? [0, 2, 1, 2][j] : i];
      check(use.edgeId === edge.id && use.sense === (i === 2 ? ['forward', 'forward', 'reverse', 'reverse'][j] : i === 0 ? 'reverse' : 'forward')
        && use.pcurve.coordinateSystem === 'uv' && same(use.pcurve.domain, edge.sourceParameterRange)
        && use.pcurve.curve.controlPoints.every(p => p[2] === 0), 'native directed pcurve/use correspondence');
      const pc = use.pcurve.curve;
      if (i < 2) {
        const boundary = g.objects[i] as Curve;
        check(pc.degree === boundary.degree && same(pc.knots, boundary.knots) && same(pc.weights, boundary.weights)
          && pc.controlPoints.every(p => p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1), 'whole retained cap pcurve basis/domain');
      } else {
        const endpoints = [[[0, 0, 0], [4, 0, 0]], [[4, 0, 0], [4, 1, 0]], [[0, 1, 0], [4, 1, 0]], [[0, 0, 0], [0, 1, 0]]];
        check(pc.degree === 1 && same(pc.weights, [1, 1]) && same(pc.controlPoints, endpoints[j]), 'native wall boundary/seam pcurve endpoint mapping');
      }
      const nextUse = loop.uses[(j + 1) % loop.uses.length], next = t.edges.find(e => e.id === nextUse.edgeId);
      check(next && edge.vertexIds[use.sense === 'forward' ? 1 : 0] === next.vertexIds[nextUse.sense === 'forward' ? 0 : 1], 'native directed loop closure');
    }
  }
  const [bottom, top, seam] = g.objects.slice(0, 3) as Curve[], [base, cap, wall] = g.objects.slice(3) as Surface[];
  check(same(bottom.controlPoints[0], t.vertices[0].point) && same(bottom.controlPoints.at(-1), t.vertices[0].point)
    && same(top.controlPoints[0], t.vertices[1].point) && same(top.controlPoints.at(-1), t.vertices[1].point)
    && same(seam.controlPoints, t.vertices.map(v => v.point)), 'native curve endpoints');
  check(same(bottom.weights, top.weights) && top.controlPoints.every((p, i) => p[0] === bottom.controlPoints[i][0]
    && p[1] === bottom.controlPoints[i][1] && p[2] - bottom.controlPoints[i][2] === c.heightMM)
    && wall.controlPoints.every((row, i) => same(row, [bottom.controlPoints[i], top.controlPoints[i]])
      && row.every((_, j) => wall.weights[i][j] === bottom.weights[i])), 'stored extrusion coefficient correspondence');
  check(base.controlPoints.flat().every(p => p[2] === 0) && cap.controlPoints.flat().every(p => p[2] === c.heightMM)
    && cap.controlPoints.every((row, i) => row.every((p, j) => p[0] === base.controlPoints[i][j][0] && p[1] === base.controlPoints[i][j][1])), 'stored cap plane correspondence');
  nativeReport(r, l);
}
function nativeReport(r: XYCirclePrismShellReport, l: ModelingCircleLineage): void {
  exact(r, ['trimFamily', 'sourceCurveId', 'shellId', 'heightMM', 'centerMM', 'radiusMM', 'baseFaceReport', 'geometryIds', 'domains', 'vertexCount',
    'edgeCount', 'edgeUseCount', 'faceCount', 'loopCount', 'nativeObjectCount', 'boundsMM', 'edgeIncidence', 'loopObservations', 'normalObservations',
    'referenceVolumeMM3', 'referenceLateralAreaMM2', 'referenceBoundaryAreaMM2', 'incidenceValid', 'candidateClosedShell', 'periodic', 'geometricValidity', 'topologyCertified', 'solid', 'limits']);
  const t = l.topology, c = l.construction;
  check(r.trimFamily === 'xy-circle-prism-shell-v0' && r.sourceCurveId === t.sourceCurveId && r.shellId === t.id
    && r.heightMM === c.heightMM && same(r.centerMM, c.profile.center) && r.radiusMM === c.profile.radius
    && r.vertexCount === 2 && r.edgeCount === 3 && r.edgeUseCount === 6 && r.faceCount === 3 && r.loopCount === 3 && r.nativeObjectCount === 6
    && r.incidenceValid === true && r.candidateClosedShell === true && r.periodic === false && r.geometricValidity === 'not-certified'
    && r.topologyCertified === false && r.solid === false, 'native parent remains uncertified');
  check(same(r.geometryIds, { bottomCurveId: t.edges[0].curveId, topCurveId: t.edges[1].curveId, seamCurveId: t.edges[2].curveId,
    bottomSurfaceId: t.faces[0].surfaceId, topSurfaceId: t.faces[1].surfaceId, wallSurfaceId: t.faces[2].surfaceId }), 'native report geometry identities');
  check(same(r.domains, { bottomCurve: [0, 4], topCurve: [0, 4], seamCurve: [0, 1], bottomSurface: { u: [0, 1], v: [0, 1] },
    topSurface: { u: [0, 1], v: [0, 1] }, wallSurface: { u: [0, 4], v: [0, 1] } }), 'complete original native domains');
  exact(r.boundsMM, ['min', 'max']); tuple(r.boundsMM.min, 3); tuple(r.boundsMM.max, 3);
  const base = l.geometry.objects[3] as Surface, cap = l.geometry.objects[4] as Surface;
  check(same(r.boundsMM.min, base.controlPoints[0][0]) && same(r.boundsMM.max, cap.controlPoints[1][1])
    && r.boundsMM.min.every((v, a) => v < r.boundsMM.max[a]), 'native bounds/plane coefficient correspondence');
  check(r.edgeIncidence.length === 3 && r.loopObservations.length === 3 && r.normalObservations.length === 6, 'complete native report observations');
  for (const [i, e] of t.edges.entries()) {
    const uses = t.loops.flatMap(loop => loop.uses.filter(u => u.edgeId === e.id).map(u => ({ faceId: loop.faceId, loopId: loop.id, useId: u.id, sense: u.sense })));
    check(uses.length === 2 && uses[0].sense !== uses[1].sense && same(r.edgeIncidence[i], { edgeId: e.id, uses }), 'both opposite edge uses including same-wall seam');
  }
  for (const [i, loop] of t.loops.entries()) check(same(r.loopObservations[i], { loopId: loop.id, faceId: loop.faceId, useCount: loop.uses.length, closed: true }), 'native loop observation identity');
  for (const [i, o] of r.normalObservations.entries()) {
    exact(o, ['faceId', 'surfaceId', 'uv', 'pointMM', 'normal']); tuple(o.uv, 2); tuple(o.pointMM, 3); tuple(o.normal, 3);
    const f = t.faces[Math.min(i, 2)]; check(o.faceId === f.id && o.surfaceId === f.surfaceId
      && near(o.uv, i < 2 ? [.5, .5] : [i - 1.5, .5]) && Math.abs(Math.hypot(...o.normal) - 1) <= 1e-6, 'native normal observation identity');
    if (i < 2) check(o.normal[0] === 0 && o.normal[1] === 0 && o.normal[2] === (i === 0 ? -1 : 1)
      && near(o.pointMM, [...c.profile.center, i === 0 ? 0 : c.heightMM]), 'cap center observation');
    else check(o.normal[2] === 0 && o.normal[0] * (o.pointMM[0] - c.profile.center[0]) + o.normal[1] * (o.pointMM[1] - c.profile.center[1]) > 0, 'native outward wall normal');
  }
  check([r.referenceVolumeMM3, r.referenceLateralAreaMM2, r.referenceBoundaryAreaMM2].every(v => Number.isFinite(v) && v > 0), 'finite unqualified reference observations');
  check(same(r.limits, { authoredIdCharacters: 48, derivedIdCharacters: 80, snapshotValues: 32768, snapshotDepth: 14,
    arrayElements: 128, recordFields: 24, stringCharacters: 128, evaluationComparisonMM: 1e-7 }), 'native limits');
  const b = r.baseFaceReport;
  exact(b, ['trimFamily', 'sourceCurveId', 'faceId', 'surfaceId', 'outerLoopId', 'edgeId', 'pcurveId', 'seamVertexId', 'nativeDomain', 'uvDomain',
    'surfaceDomain', 'centerMM', 'radiusMM', 'boundsMM', 'vertexCount', 'edgeCount', 'loopUseCount', 'nativeObjectCount', 'referenceDiskAreaMM2',
    'incidenceValid', 'periodic', 'geometricValidity', 'topologyCertified', 'solid', 'limits']);
  check(b.trimFamily === 'xy-circle-planar-face-v0' && b.sourceCurveId === t.sourceCurveId && b.faceId === t.faces[0].id
    && b.surfaceId === t.faces[0].surfaceId && b.outerLoopId === t.loops[0].id && b.edgeId === t.edges[0].id
    && b.pcurveId === t.loops[0].uses[0].pcurve.curve.id && b.seamVertexId === t.vertices[0].id
    && same(b.centerMM, c.profile.center) && b.radiusMM === c.profile.radius && same(b.nativeDomain, [0, 4]) && same(b.uvDomain, [0, 4])
    && same(b.surfaceDomain, r.domains.bottomSurface) && same(b.boundsMM, { min: base.controlPoints[0][0], max: base.controlPoints[1][1] })
    && b.vertexCount === 1 && b.edgeCount === 1 && b.loopUseCount === 1 && b.nativeObjectCount === 2 && b.referenceDiskAreaMM2 > 0
    && b.incidenceValid === true && b.periodic === false && b.geometricValidity === 'not-certified' && b.topologyCertified === false && b.solid === false, 'original unqualified base-face report');
  check(same(b.limits, { authoredIdCharacters: 64, derivedIdCharacters: 80, snapshotValues: 8192, snapshotDepth: 10, arrayElements: 64,
    recordFields: 12, stringCharacters: 128, evaluationComparisonMM: 1e-7, derivativeComparisonRelative: 1e-9, planeToleranceMM: 1e-7, boundaryToleranceMM: 1e-7 }), 'base-face limits');
}
function copiedLineage(native: StoredCirclePrismSolidResult): ModelingCircleLineage {
  return { ...native.parent.bundle, source: { modelId: native.world.model.name, sourceVersion: native.world.model.version,
    objectIds: native.world.model.objects.map(o => o.id) } };
}
/** All authored outputs are preflighted before the first output is sampled. */
export function preflightModelingCircle(nativeInput: StoredCirclePrismSolidResult): void {
  const native = copyOwn(nativeInput); exact(native, ['parent', 'world', 'certificate']);
  exact(native.parent, ['profile', 'baseFace', 'bundle', 'report']); exact(native.parent.bundle, ['construction', 'geometry', 'topology']);
  exact(native.world, ['source', 'model']);
  check(typeof native.world.source === 'string' && native.world.source.length > 0 && same(native.world.model, native.parent.bundle.geometry), 'original whole native Source0/model binding');
  const l = copiedLineage(native); lineage(l, native.parent.report, native.parent.bundle.topology.id); qualification(native.certificate, l);
  exact(native.parent.baseFace, ['profile', 'bundle', 'report']);
  const base = native.parent.baseFace.bundle; exact(base, ['construction', 'geometry', 'topology']);
  exact(base.geometry, ['name', 'version', 'lengthUnit', 'objects']);
  check(same(base.construction, l.construction.profile) && base.geometry.version === 0 && base.geometry.lengthUnit === 'mm'
    && base.geometry.objects.length === 2 && same(base.geometry.objects, [l.geometry.objects[0], l.geometry.objects[3]])
    && same(base.topology.vertices, [l.topology.vertices[0]]) && same(base.topology.edges, [l.topology.edges[0]])
    && base.topology.sourceCurveId === l.topology.sourceCurveId && base.topology.face.id === l.topology.faces[0].id
    && base.topology.face.surfaceId === l.topology.faces[0].surfaceId && base.topology.face.outerLoopId === l.topology.loops[0].id
    && base.topology.face.orientation === 'forward' && base.topology.loop.id === l.topology.loops[0].id
    && base.topology.loop.uses.length === 1 && base.topology.loop.uses[0].edgeId === l.topology.edges[0].id
    && base.topology.loop.uses[0].sense === 'forward' && same(base.topology.loop.uses[0].pcurve, l.topology.loops[0].uses[0].pcurve), 'complete original base-face native identities');
  check(same(native.parent.profile, native.parent.baseFace.profile) && native.parent.profile.curve.id === l.topology.sourceCurveId
    && same(native.parent.profile.curve, l.geometry.objects[0]) && same(native.parent.baseFace.report, native.parent.report.baseFaceReport), 'original circle profile/base-face ancestry');
}
function rawMesh(preview: XYCirclePrismShellPreviewResult, context: OwnPlateHolePreviewContext): OwnNativeFaceMesh {
  const packet = preview.packet;
  check(preview.faceRanges.length === 3 && packet.positions.length === 294 && packet.normals.length === 294
    && packet.parameters.length === 196 && packet.indices.length === 192, 'fixed-k4 inventory before partition');
  for (const [i, f] of preview.faceRanges.entries()) check(same(f.vertexRange, [[0, 17], [17, 34], [34, 98]][i])
    && same(f.indexRange, [[0, 48], [48, 96], [96, 192]][i])
    && packet.indices.slice(...f.indexRange).every(v => Number.isInteger(v) && v >= f.vertexRange[0] && v < f.vertexRange[1]), 'validated ranges before exact face slicing');
  return { format: 'barocss-native-face-mesh', version: 0, lengthUnit: 'mm', nativeFrame: 'part-xyz', context,
    chunks: preview.faceRanges.map((f, i) => ({ faceToken: 'circle_face_' + i, nativeFaceId: f.faceId,
      faceOrientation: f.orientation === 'reverse' ? 'reversed' : 'forward', normalSource: 'native-surface-evaluation',
      positionsMM: packet.positions.slice(f.vertexRange[0] * 3, f.vertexRange[1] * 3), normals: packet.normals.slice(f.vertexRange[0] * 3, f.vertexRange[1] * 3),
      parametersUV: packet.parameters.slice(f.vertexRange[0] * 2, f.vertexRange[1] * 2),
      indices: packet.indices.slice(...f.indexRange).map(v => v - f.vertexRange[0]) })) };
}
/** Copies the actual fixed-k4 result. Only exact face slicing/local-index subtraction occurs. */
export function projectModelingCircle(nativeInput: StoredCirclePrismSolidResult, previewInput: XYCirclePrismShellPreviewResult,
  role: string, context: OwnPlateHolePreviewContext): ModelingCircleDisplayComponent {
  preflightModelingCircle(nativeInput);
  const native = copyOwn(nativeInput), preview = copyOwn(previewInput);
  check(same(preview.report.native, native.parent.report), 'actual preview/native source report correspondence');
  const component: ModelingCircleDisplayComponent = { family: 'stored-rational-circle-prism', role, solidId: native.parent.bundle.topology.id,
    adapterBasis: BASIS, preview, mesh: rawMesh(preview, copyOwn(context)), qualification: native.certificate, lineage: copiedLineage(native) };
  validateModelingCircle(component); return component;
}
/** Receiving correspondence, never a rerun of native qualification or rational geometry. */
export function validateModelingCircle(input: ModelingCircleDisplayComponent): void {
  const component = copyOwn(input);
  exact(component, ['family', 'role', 'solidId', 'adapterBasis', 'preview', 'mesh', 'qualification', 'lineage']); id(component.role, 48); id(component.solidId, 48);
  check(component.family === 'stored-rational-circle-prism' && component.adapterBasis === BASIS, 'explicit original authored XYZ adapter basis');
  const { preview: p, lineage: l, mesh } = component;
  exact(p, ['packet', 'faceRanges', 'edgePaths', 'edgeProvenance', 'report']);
  lineage(l, p.report.native, component.solidId); qualification(component.qualification, l);
  const packet = p.packet, report = p.report, t = l.topology;
  exact(packet, ['version', 'surfaceId', 'revision', 'lengthUnit', 'coordinateSystem', 'winding', 'positions', 'normals', 'indices', 'parameters', 'bounds']);
  id(packet.surfaceId, 64);
  const nativeIds = [t.id, l.geometry.name, ...l.geometry.objects.map(o => o.id), ...t.faces.map(f => f.id),
    ...t.vertices.map(v => v.id), ...t.edges.map(e => e.id), ...t.loops.flatMap(loop => [loop.id, ...loop.uses.flatMap(use => [use.id, use.pcurve.curve.id])])];
  check(!nativeIds.includes(packet.surfaceId), 'display mesh identity must not collide with native source identities');
  check(packet.version === 0 && packet.lengthUnit === 'mm' && packet.coordinateSystem === 'right-handed-y-up' && packet.winding === 'ccw'
    && Number.isInteger(packet.revision) && packet.revision >= 0 && packet.revision <= 2147483647, 'preserved original packet metadata');
  tuple(packet.positions, 294); tuple(packet.normals, 294); tuple(packet.parameters, 196); tuple(packet.indices, 192);
  check(packet.positions.every(v => Math.abs(v) <= 1e6) && packet.indices.every(v => Number.isInteger(v) && v >= 0 && v < 98)
    && p.faceRanges.length === 3 && p.edgePaths.length === 3 && p.edgeProvenance.length === 3, 'exact k4 finite inventory');
  const point = (i: number) => packet.positions.slice(i * 3, i * 3 + 3), normal = (i: number) => packet.normals.slice(i * 3, i * 3 + 3);
  const uv = (i: number) => packet.parameters.slice(i * 2, i * 2 + 2);
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let i = 0; i < 98; i++) { check(Math.abs(Math.hypot(...normal(i)) - 1) <= 1e-6, 'native unit normals');
    for (let a = 0; a < 3; a++) { bounds.min[a] = Math.min(bounds.min[a], point(i)[a]); bounds.max[a] = Math.max(bounds.max[a], point(i)[a]);
      check(point(i)[a] >= report.native.boundsMM.min[a] - 1e-7 && point(i)[a] <= report.native.boundsMM.max[a] + 1e-7, 'sampled/native bounds correspondence'); } }
  check(same(packet.bounds, bounds) && same(report.boundsMM, bounds), 'actual sampled packet/report bounds');
  for (const [i, edge] of t.edges.entries()) {
    const path = p.edgePaths[i], provenance = p.edgeProvenance[i]; exact(path, ['id', 'points']);
    exact(provenance, ['shellId', 'edgeId', 'curveId', 'vertexIds', 'sourceParameterRange', 'sampledParameters', 'uses']);
    check(path.id === edge.id && path.points.length === (i === 2 ? 2 : 17) && provenance.shellId === t.id && provenance.edgeId === edge.id
      && provenance.curveId === edge.curveId && same(provenance.vertexIds, edge.vertexIds) && same(provenance.sourceParameterRange, edge.sourceParameterRange)
      && same(provenance.sampledParameters, i === 2 ? [0, 1] : RING) && provenance.uses.length === 2, 'complete original edge path/provenance');
    path.points.forEach(v => tuple(v, 3));
    check(same(path.points[0], t.vertices[i === 1 ? 1 : 0].point) && same(path.points.at(-1), t.vertices[i === 0 ? 0 : 1].point), 'both closed-ring endpoints and seam endpoints');
    const uses = t.loops.flatMap(loop => loop.uses.filter(u => u.edgeId === edge.id).map(use => ({ loop, use })));
    for (const [j, { loop, use }] of uses.entries()) {
      const copied = provenance.uses[j], face = t.faces.find(f => f.id === loop.faceId)!;
      exact(copied, ['useId', 'faceId', 'surfaceId', 'loopId', 'pcurveId', 'sense', 'pcurve', 'sampledUVs', 'observedBindingDifferenceMM']);
      check(copied.useId === use.id && copied.faceId === face.id && copied.surfaceId === face.surfaceId && copied.loopId === loop.id
        && copied.pcurveId === use.pcurve.curve.id && copied.sense === use.sense && same(copied.pcurve, use.pcurve)
        && copied.sampledUVs.length === path.points.length && copied.observedBindingDifferenceMM >= 0 && copied.observedBindingDifferenceMM <= 1e-7, 'actual native use/pcurve identity');
      const domain = face.role === 'wall' ? report.native.domains.wallSurface : report.native.domains.bottomSurface;
      copied.sampledUVs.forEach(v => { tuple(v, 2); check(v[0] >= domain.u[0] && v[0] <= domain.u[1] && v[1] >= domain.v[0] && v[1] <= domain.v[1], 'sampled edge-use native domain'); });
      if (face.role === 'wall') check(copied.sampledUVs.every((v, k) => near(v, i < 2 ? [RING[k], i] : [j === 0 ? 4 : 0, k], 0)), 'wall ring/seam ordered UV uses');
      else {
        check(same(copied.sampledUVs[0], copied.sampledUVs.at(-1)), 'closed cap UV endpoints');
        const support = l.geometry.objects.find(o => o.id === copied.surfaceId) as Surface;
        check(copied.sampledUVs.every((sample, k) => capSampleMatchesAffineSupport(support, sample, path.points[k])),
          'sampled cap UV must bind retained affine Surface to original edge point');
      }
    }
    check(provenance.uses[0].sense !== provenance.uses[1].sense && (i !== 2 || provenance.uses.every(u => u.faceId === t.faces[2].id)), 'both opposite same-wall seam uses');
  }
  let vertexEnd = 0, indexEnd = 0; const areas: number[] = [];
  for (const [i, range] of p.faceRanges.entries()) {
    exact(range, ['faceId', 'surfaceId', 'role', 'orientation', 'vertexRange', 'indexRange', 'domain', i === 2 ? 'wallPanels' : 'capSampling']);
    const face = t.faces[i], end = i === 0 ? 17 : i === 1 ? 34 : 98, stop = i === 0 ? 48 : i === 1 ? 96 : 192;
    check(range.faceId === face.id && range.surfaceId === face.surfaceId && range.role === face.role && range.orientation === face.orientation
      && same(range.vertexRange, [vertexEnd, end]) && same(range.indexRange, [indexEnd, stop])
      && same(range.domain, i === 2 ? report.native.domains.wallSurface : report.native.domains.bottomSurface), 'ordered disjoint contiguous complete native face ranges');
    for (let v = vertexEnd; v < end; v++) check(uv(v)[0] >= range.domain.u[0] && uv(v)[0] <= range.domain.u[1]
      && uv(v)[1] >= range.domain.v[0] && uv(v)[1] <= range.domain.v[1], 'native per-vertex UV domain');
    if (i < 2) {
      const cap = range.capSampling!, use = t.loops[i].uses[0], edge = t.edges[i], edgeUse = p.edgeProvenance[i].uses[0];
      exact(cap, ['kind', 'edgeId', 'curveId', 'loopId', 'useId', 'pcurveId', 'loopSense', 'centerUV', 'boundaryParameters']);
      check(cap.kind === 'native-parameter-fan' && cap.edgeId === edge.id && cap.curveId === edge.curveId && cap.loopId === t.loops[i].id
        && cap.useId === use.id && cap.pcurveId === use.pcurve.curve.id && cap.loopSense === use.sense
        && same(cap.boundaryParameters, RING.slice(0, -1)) && same(uv(vertexEnd), cap.centerUV)
        && same(cap.centerUV, report.native.normalObservations[i].uv)
        && near(point(vertexEnd), report.native.normalObservations[i].pointMM), 'original native cap center/fan sampling');
      const support = l.geometry.objects[i + 3] as Surface;
      for (let j = 0; j < 17; j++) {
        check(normal(vertexEnd + j)[0] === 0 && normal(vertexEnd + j)[1] === 0 && normal(vertexEnd + j)[2] === (i === 0 ? -1 : 1), 'native cap face-sense normals');
        check(capSampleMatchesAffineSupport(support, uv(vertexEnd + j), point(vertexEnd + j)), 'cap packet UV must bind retained affine Surface to original sample');
      }
      for (let j = 0; j < 16; j++) {
        const a = vertexEnd + 1 + j, b = vertexEnd + 1 + (j + 1) % 16;
        check(same(uv(a), edgeUse.sampledUVs[j]) && near(point(a), p.edgePaths[i].points[j]), 'genuine cap UVs/native edge samples');
        check(same(packet.indices.slice(indexEnd + j * 3, indexEnd + j * 3 + 3), [vertexEnd, i === 0 ? b : a, i === 0 ? a : b]), 'exact original cap index winding');
      }
    } else {
      check(range.wallPanels!.length === 16, 'complete native wall panels');
      for (const [j, panel] of range.wallPanels!.entries()) {
        exact(panel, ['parameterRange', 'normalSampleUV', 'normal', 'vertexRange', 'indexRange']); tuple(panel.normal, 3);
        const start = vertexEnd + j * 4, offset = indexEnd + j * 6;
        check(same(panel.parameterRange, [RING[j], RING[j + 1]]) && same(panel.normalSampleUV, [(RING[j] + RING[j + 1]) / 2, .5])
          && same(panel.vertexRange, [start, start + 4]) && same(panel.indexRange, [offset, offset + 6]), 'ordered native wall panel metadata');
        check(same(packet.parameters.slice(start * 2, (start + 4) * 2), [RING[j], 0, RING[j + 1], 0, RING[j], 1, RING[j + 1], 1])
          && same(packet.indices.slice(offset, offset + 6), [start, start + 1, start + 2, start + 1, start + 3, start + 2]), 'exact wall UV/index layout');
        for (let k = 0; k < 4; k++) check(same(normal(start + k), panel.normal)
          && near(point(start + k), p.edgePaths[k < 2 ? 0 : 1].points[j + k % 2]), 'native wall panel/closed-ring correspondence');
        check(panel.normal[2] === 0 && [0, 1].every(k => panel.normal[0] * (point(start + k)[0] - l.construction.profile.center[0])
          + panel.normal[1] * (point(start + k)[1] - l.construction.profile.center[1]) > 0), 'native wall normals outward');
      }
    }
    let area = 0;
    for (let offset = indexEnd; offset < stop; offset += 3) {
      const ids = packet.indices.slice(offset, offset + 3); check(ids.every(v => v >= vertexEnd && v < end), 'no cross-face index');
      for (const float32 of [false, true]) {
        const [a, b, c] = ids.map(v => point(v).map(n => float32 ? Math.fround(n) : n)), ab = b.map((n, j) => n - a[j]), ac = c.map((n, j) => n - a[j]);
        const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]], length = Math.hypot(...cross);
        check(Number.isFinite(length) && length > 0 && ids.every(v => cross.reduce((dot, n, j) => dot + n * normal(v)[j], 0) > 0), 'actual/Float32 nondegenerate original outward winding');
        if (!float32) area += length / 2;
      }
    }
    areas.push(area); vertexEnd = end; indexEnd = stop;
  }
  check(vertexEnd === 98 && indexEnd === 192, 'complete k4 partition');
  previewReport(p, areas);
  exact(mesh, ['format', 'version', 'lengthUnit', 'nativeFrame', 'context', 'chunks']);
  exact(mesh.context, ['documentId', 'bodyId', 'documentRevision', 'kernelResultRevision', 'topologyRevision', 'taskToken']);
  for (const v of Object.values(mesh.context)) check(typeof v === 'string' && v.length >= 1 && v.length <= 48 && /^[\x21-\x7e]+$/.test(v), 'bounded result context');
  check(mesh.context.bodyId === component.solidId && mesh.context.documentRevision === String(packet.revision)
    && mesh.context.kernelResultRevision === String(packet.revision) && mesh.context.topologyRevision === String(packet.revision), 'original preview/result revision context');
  check(same(mesh, rawMesh(p, mesh.context)), 'only native face slicing/local-index subtraction is permitted');
}
function previewReport(p: XYCirclePrismShellPreviewResult, areas: number[]): void {
  const r = p.report;
  exact(r, ['kind', 'native', 'shellId', 'sourceCurveId', 'meshId', 'revision', 'segmentsPerQuarter', 'faceCount', 'vertexCount', 'triangleCount',
    'edgePathCount', 'edgePathPointCounts', 'boundsMM', 'areasMM2', 'referenceBoundaryAreaMM2', 'areaDifferenceMM2', 'observedChordDeviationMM',
    'chordDeviationByEdge', 'observedSurfaceBindingDifferenceMM', 'sampling', 'existingGPUOverlayPathBudget', 'limits', 'periodic', 'candidateClosedShell',
    'geometricValidity', 'topologyCertified', 'solid']);
  check(r.kind === 'xy-circle-prism-shell-preview' && r.shellId === r.native.shellId && r.sourceCurveId === r.native.sourceCurveId
    && r.meshId === p.packet.surfaceId && r.revision === p.packet.revision && r.segmentsPerQuarter === 4 && r.faceCount === 3 && r.vertexCount === 98
    && r.triangleCount === 64 && r.edgePathCount === 3 && same(r.edgePathPointCounts, [17, 17, 2])
    && r.periodic === false && r.candidateClosedShell === true && r.geometricValidity === 'not-certified' && r.topologyCertified === false && r.solid === false, 'sampled preview stays explicitly uncertified');
  exact(r.areasMM2, ['bottomCap', 'topCap', 'wall', 'total']);
  check([r.areasMM2.bottomCap, r.areasMM2.topCap, r.areasMM2.wall].every((v, i) => v > 0 && close(v, areas[i]))
    && close(r.areasMM2.total, areas.reduce((sum, v) => sum + v, 0)) && r.referenceBoundaryAreaMM2 === r.native.referenceBoundaryAreaMM2
    && r.areaDifferenceMM2 === r.areasMM2.total - r.referenceBoundaryAreaMM2, 'sampled triangle area observations');
  check(r.chordDeviationByEdge.length === 2 && r.chordDeviationByEdge.every((v, i) => {
    exact(v, ['edgeId', 'observedChordDeviationMM']); return v.edgeId === p.edgePaths[i].id && Number.isFinite(v.observedChordDeviationMM) && v.observedChordDeviationMM >= 0;
  }) && r.observedChordDeviationMM === Math.max(...r.chordDeviationByEdge.map(v => v.observedChordDeviationMM))
    && r.observedSurfaceBindingDifferenceMM >= Math.max(...p.edgeProvenance.flatMap(e => e.uses.map(u => u.observedBindingDifferenceMM)))
    && r.observedSurfaceBindingDifferenceMM <= 1e-7, 'retained chord/binding observations');
  check(same(r.sampling, { kind: 'uniform-native-parameter', segmentsPerQuarter: 4, boundaryParameters: RING.slice(0, -1), wallNormalMethod: 'native-midpoint-faceted' })
    && same(r.existingGPUOverlayPathBudget, { maximumPathPoints: 64, segmentsPerQuarterMaximum: 15, withinPathBudget: true }), 'fixed genuine k4 native sampling');
  check(same(r.limits, { segmentsPerQuarter: [2, 32], maximumVertices: 770, maximumTriangles: 512, maximumEdgePaths: 3, maximumCirclePathPoints: 129,
    snapshotValues: 32768, snapshotDepth: 14, arrayElements: 128, recordFields: 24, stringCharacters: 128, meshIdCharacters: 64,
    evaluationComparisonMM: 1e-7, float32Policy: 'positive-outward-world-coordinate-triangles' }), 'native preview finite limits');
}

import { buildConvexPlanarFace } from './own-convex-planar-face.js';
import type { ConvexPlanarFaceResult, ConvexPlanarFaceUse } from './own-convex-planar-face.js';
import { qualifyConvexPlanarSolid, validateConvexPlanarSolid } from './convex-planar-solid.js';
import type { ConvexPlanarSolidResult, ConvexPlanarSolidReport, ConvexPlanarSolidVertexReference } from './convex-planar-solid.js';
import { check, id, same, SolidSnapshotLedger, ConvexPlanarSolidError } from './convex-planar-solid-proof-internal.js';
import type { ConvexPlanarSolidDiagnosticCode, ExactPointData } from './convex-planar-solid-proof-internal.js';
import { SectionRationalContext } from './section-rational-internal.js';
import type { SectionFraction, SectionRational } from './section-rational-internal.js';

import type { Point, Curve, Surface } from './types.js';

/** World-origin cardinal plane reflection in authored XYZ millimetres. */
export type CardinalMirrorPlane = 'xy' | 'xz' | 'yz';
export type CardinalMirrorSpec = Readonly<{ plane: CardinalMirrorPlane }>;
const refuse = (): never => { throw new RangeError('Finite XYZ and supported world-origin mirror plane required'); };

/** Snapshot own data before reading geometry. No caller getter influences the map. */
function admit(point: Point, spec: CardinalMirrorSpec): { point: Point; spec: CardinalMirrorSpec } {
  try {
    if (!Array.isArray(point) || Object.getPrototypeOf(point) !== Array.prototype) refuse();
    const entries = Object.getOwnPropertyDescriptors(point) as unknown as Record<string, PropertyDescriptor | undefined>;
    if (Reflect.ownKeys(entries).length !== 4 || !Object.hasOwn(entries, 'length') || entries.length?.value !== 3) refuse();
    const values = [0, 1, 2].map(i => {
      const item = entries[String(i)];
      if (item === undefined) return refuse();
      const value: unknown = item.value;
      if (!Object.hasOwn(item, 'value') || !item.enumerable || typeof value !== 'number'
        || !Number.isFinite(value) || Math.abs(value) > 10000) return refuse();
      return value;
    }) as Point;
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)
      || (Object.getPrototypeOf(spec) !== Object.prototype && Object.getPrototypeOf(spec) !== null)) refuse();
    const options = Object.getOwnPropertyDescriptors(spec);
    if (Reflect.ownKeys(options).length !== 1 || !Object.hasOwn(options, 'plane')
      || !('value' in options.plane) || !options.plane.enumerable) refuse();
    const plane: unknown = options.plane.value;
    if (plane !== 'xy' && plane !== 'xz' && plane !== 'yz') refuse();
    return { point: values, spec: { plane: plane as CardinalMirrorPlane } };
  } catch { return refuse(); }
}

export function mirrorCardinalPoint(point: Point, spec: CardinalMirrorSpec): Point {
  const admitted = admit(point, spec), [x, y, z] = admitted.point;
  return admitted.spec.plane === 'xy' ? [x, y, -z] : admitted.spec.plane === 'xz' ? [x, -y, z] : [-x, y, z];
}
/** Independent coefficient copy. Qualification belongs to the complete native Solid. */
export function mirrorCardinalCurve(source: Curve, spec: CardinalMirrorSpec): Curve {
  return { ...source, knots: [...source.knots], weights: [...source.weights],
    controlPoints: source.controlPoints.map(point => mirrorCardinalPoint(point, spec)) };
}
/** Preserve the Surface axes and pole order; the native Face sense changes once. */
export function mirrorCardinalSurface(source: Surface, spec: CardinalMirrorSpec): Surface {
  return { ...source, knotsU: [...source.knotsU], knotsV: [...source.knotsV], weights: source.weights.map(row => [...row]),
    controlPoints: source.controlPoints.map(row => row.map(point => mirrorCardinalPoint(point, spec))) };
}

type Mapping<T> = { original: T; mirrored: T };
type FaceReference = { sourceId: string; faceId: string; surfaceId: string; loopId: string; evaluationId: string };
type LocalReference = { sourceId: string; faceId: string };
type DirectCalls = { parentValidationCount: number; initialFaceConstructionCount: number; targetQualificationCount: number; retries: 0 };
type ExactWork = ReturnType<SectionRationalContext['counts']>;
type Progress = { parentValidation: ConvexPlanarSolidReport | null; directCalls: DirectCalls; exactWork: ExactWork };
type Lineage = {
  faces: Mapping<FaceReference>[];
  curves: Mapping<LocalReference & { curveId: string }>[];
  pcurves: Mapping<LocalReference & { pcurveId: string }>[];
  uses: Mapping<LocalReference & { useId: string }>[];
  localEdges: Mapping<LocalReference & { edgeId: string }>[];
  localVertices: Mapping<ConvexPlanarSolidVertexReference>[];
  edges: Mapping<{ edgeId: string }>[];
  vertices: Mapping<{ vertexId: string }>[];
};

/** Private evidence for the primary model's one bounded, terminal owned copy. */
export interface ModelingMirrorResult {
  request: { parent: ConvexPlanarSolidResult; spec: CardinalMirrorSpec; prefix: string };
  solid: ConvexPlanarSolidResult;
  lineage: Lineage;
  report: {
    schema: 'barocss-modeling-mirror'; version: 0; lengthUnit: 'mm'; solid: true;
    determinant: -1; orientationFlipCount: number;
    parentValidation: ConvexPlanarSolidReport;
    targetQualification: ConvexPlanarSolidReport;
    directCalls: DirectCalls;
    initialFaceConstruction: {
      faceCount: number; sourceCompilationCount: number; bindingObservationCount: number;
      curveD1Count: number; pcurveD1Count: number; surfaceD1Count: number; totalD1Count: number;
      scope: 'direct-calls-and-known-parent-loop-work-not-hidden-provider-internals';
    };
    exactWork: ExactWork;
    preservation: {
      completeParent: true; cardinalPlaneReflection: true; signedCoefficientBits: true;
      basisAndWeightBits: true; directedDomainBits: true; reversedDirectedTraversal: true; exactParameterMaps: true;
      bijectiveLineage: true; exactMirroredNormals: true; exactMirroredSupportsAndVertices: true; supportOffsetsUnchanged: true;
      exactVolumeUnchanged: true; independentSourceNamespaces: true;
    };
    numericPolicy: 'exact-rationals-of-stored-binary64-no-welding-no-tolerance-promotion';
    validationScope: 'whole-result-self-consistency-not-authenticity';
    persistentNamingCertified: false;
    limits: { faces: 10; directedUses: 48; pairs: 24; vertices: 16; coordinateAbsMM: 10000; rationalOperations: 200000; integerBits: 8192 };
    dataCharge: 'unchanged-solid-snapshot-ledger-alias-occurrences-not-v8-heap';
  };
}

class ModelingMirrorError extends Error {
  constructor(readonly code: ConvexPlanarSolidDiagnosticCode, readonly stage: string, readonly entity: string,
    detail: string, readonly report: Progress, cause: unknown) {
    super(('Modeling mirror: ' + detail).slice(0, 1024), { cause }); this.name = 'ModelingMirrorError';
    const freeze = (value: unknown): void => {
      if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    };
    // Completed work is retained, with no partial target geometry and without
    // changing or replacing the original provider error in cause.
    freeze(report);
  }
}

const key = (sourceId: string, localId: string): string => sourceId + '/' + localId;
const memberKey = (member: ConvexPlanarSolidVertexReference): string => key(member.sourceId, member.faceId) + '/' + member.vertexId;
const faceReference = (sourceId: string, face: ConvexPlanarFaceResult): FaceReference => ({ sourceId, faceId: face.options.faceId,
  surfaceId: face.plane.id, loopId: face.loop.id, evaluationId: face.options.evaluationId });

/** Fixed origin-plane reflections. Coefficient order remains unchanged. */
function cardinalSignedMap(spec: CardinalMirrorSpec): readonly (readonly [0 | 1 | 2, 1 | -1])[] {
  return spec.plane === 'xy' ? [[0, 1], [1, 1], [2, -1]] :
    spec.plane === 'xz' ? [[0, 1], [1, -1], [2, 1]] : [[0, -1], [1, 1], [2, 1]];
}
const oppositeSense = (sense: 'forward' | 'reverse'): 'forward' | 'reverse' => sense === 'forward' ? 'reverse' : 'forward';
const reversedCycle = <T>(cycle: readonly T[]): T[] => [cycle[0], ...cycle.slice(1).reverse()];

/** Reconstruct and qualify one terminal copy about the world origin. */
export function buildModelingMirror(parentInput: ConvexPlanarSolidResult, specInput: CardinalMirrorSpec, prefixInput: string): ModelingMirrorResult {
  const ledger = new SolidSnapshotLedger();
  const rational = new SectionRationalContext((code, detail) => { throw new ConvexPlanarSolidError(code, detail); });
  const directCalls: DirectCalls = { parentValidationCount: 0, initialFaceConstructionCount: 0, targetQualificationCount: 0, retries: 0 };
  let parentValidation: ConvexPlanarSolidReport | null = null, stage = 'snapshot', entity = 'request';
  const at = <T>(nextStage: string, nextEntity: string, action: () => T): T => { stage = nextStage; entity = nextEntity; return action(); };
  try {
    // Complete, bounded own-data admission happens before reading the retained parent.
    const request = ledger.copy({ parent: parentInput, spec: specInput, prefix: prefixInput }, true);
    const { parent, spec, prefix } = request;
    at('admission', 'spec', () => check(spec !== null && typeof spec === 'object' && !Array.isArray(spec)
      && Object.keys(spec).length === 1 && Object.hasOwn(spec, 'plane')
      && (spec.plane === 'xy' || spec.plane === 'xz' || spec.plane === 'yz'), 'INPUT', 'Cardinal mirror plane through the world origin required'));
    const signedMap = cardinalSignedMap(spec);
    at('admission', 'prefix', () => id(prefix, 16));
    parentValidation = at('parent-validation', 'parent', () => { directCalls.parentValidationCount++; return validateConvexPlanarSolid(parent); });
    const originals = parent.request.assets;
    at('admission', 'parent-inventory', () => check(originals.length <= 10 && parent.graph.edges.length <= 24 && parent.graph.vertices.length <= 16
      && originals.reduce((sum, a) => sum + a.face.topology.loop.uses.length, 0) <= 48, 'BUDGET', 'Qualified convex inventory exceeds10 Faces/48 uses/24 pairs/16 vertices'));

    // Include the complete original namespaces, not just the parent's solid ID.
    const originalIds = new Set<string>([parent.request.options.solidId, parent.request.options.resultIdPrefix]);
    for (const { sourceId, face } of originals) {
      [sourceId, face.plane.id, face.loop.id, face.options.faceId, face.options.evaluationId, face.options.resultIdPrefix,
        ...face.loop.edges.map(c => c.id), ...face.pcurves.map(c => c.id), ...face.topology.vertices.map(v => v.id),
        ...face.topology.edges.map(e => e.id), ...face.topology.loop.uses.map(u => u.id)].forEach(value => originalIds.add(value));
    }
    [...parent.graph.vertices, ...parent.graph.edges].forEach(item => originalIds.add(item.id));
    const generatedIds = new Set<string>();
    const fresh = (value: string, maximum = 48): string => at('identity', value, () => {
      id(value, maximum); check(!originalIds.has(value) && !generatedIds.has(value), 'IDENTITY', 'Every mirrored namespace must be distinct from the complete parent and other target identities');
      generatedIds.add(value); return value;
    });
    const solidOptions = { solidId: fresh(prefix + '_solid'), resultIdPrefix: fresh(prefix + '_s', 20) };
    for (const [i] of parent.graph.edges.entries()) fresh(solidOptions.resultIdPrefix + '_e_' + i);
    for (const [i] of parent.graph.vertices.entries()) fresh(solidOptions.resultIdPrefix + '_v_' + i);
    const names = originals.map(({ face }, i) => {
      const facePrefix = fresh(prefix + '_f' + i, 20);
      const result = { sourceId: fresh(facePrefix + '_src'), surfaceId: fresh(facePrefix + '_surface'), loopId: fresh(facePrefix + '_loop'),
        options: { faceId: fresh(facePrefix + '_face'), evaluationId: fresh(facePrefix + '_model'), resultIdPrefix: facePrefix, orientation: oppositeSense(face.options.orientation) },
        curveIds: face.loop.edges.map((_, j) => fresh(facePrefix + '_curve_' + j)) };
      for (const [j] of face.loop.edges.entries()) for (const role of ['v', 'e', 'use', 'uv']) fresh(facePrefix + '_' + role + '_' + j);
      return result;
    });

    // A signed permutation is already exactly represented. Positive components
    // copy the selected coefficient; negative components use unary negation,
    // including +0/-0. Do not cache numeric keys, which merge the two zero signs.
    const mirroredPoint = (point: Point, location: string): Point => signedMap.map(([axis, sign], targetAxis) =>
      at('stage-coefficients', location + '/' + targetAxis, () => {
        const value = sign === 1 ? point[axis] : -point[axis];
        check(Number.isFinite(value) && Math.abs(value) <= 10000, 'REPRESENTABILITY', 'Exact target coordinate exceeds +/-10000mm');
        return value;
      })) as Point;
    const staged = originals.map(({ sourceId, face }, i) => {
      const name = names[i];
      const plane: Surface = { ...face.plane, id: name.surfaceId,
        knotsU: [...face.plane.knotsU], knotsV: [...face.plane.knotsV], weights: face.plane.weights.map(row => [...row]),
        controlPoints: face.plane.controlPoints.map((row, u) => row.map((point, v) => mirroredPoint(point, key(sourceId, face.plane.id) + '/' + u + '/' + v))) };
      const edges: Curve[] = face.loop.edges.map((curve, j) => ({ ...curve, id: name.curveIds[j], knots: [...curve.knots], weights: [...curve.weights],
        controlPoints: curve.controlPoints.map((point, p) => mirroredPoint(point, key(sourceId, curve.id) + '/' + p)) }));
      return { sourceId: name.sourceId, plane, loop: { id: name.loopId, edges }, options: name.options };
    });
    // This boundary is intentional: all Surface/Line coefficients for ALL Faces
    // have passed signed permutation and coordinate bounds before the first native Face.
    const assets = staged.map(plan => ({ sourceId: plan.sourceId, face: at('face-construction', plan.sourceId, () => {
      directCalls.initialFaceConstructionCount++; return buildConvexPlanarFace(plan.plane, plan.loop, plan.options);
    }) }));
    const lineage: Lineage = { faces: [], curves: [], pcurves: [], uses: [], localEdges: [], localVertices: [], edges: [], vertices: [] };
    const useMap = new Map<string, { sourceId: string; useId: string }>();
    const vertexMap = new Map<string, ConvexPlanarSolidVertexReference>();
    const fraction = (value: SectionFraction): SectionRational => rational.rat(BigInt(value.numerator), BigInt(value.denominator));
    const equalFraction = (a: SectionFraction, b: SectionFraction): boolean => rational.compare(fraction(a), fraction(b)) === 0;
    const checkPoint = (a: Point, b: Point): void => {
      for (const [targetAxis, [sourceAxis, sign]] of signedMap.entries()) {
        const source = rational.from(a[sourceAxis]), expected = sign === 1 ? source : rational.neg(source);
        check(rational.compare(expected, rational.from(b[targetAxis])) === 0, 'BINDING', 'Actual target point differs from exact mirrored parent');
      }
    };
    for (const [i, original] of originals.entries()) at('face-lineage', original.sourceId, () => {
      const mirrored = assets[i], a = original.face, b = mirrored.face, plan = staged[i];
      check(same(b.plane, plan.plane) && same(b.loop, plan.loop) && same(b.options, plan.options), 'OWNED', 'Native Face did not adopt the complete staged Surface/Line data');
      check(a.sourceVersion === b.sourceVersion && b.sourceVersion === 0 && oppositeSense(a.options.orientation) === b.options.orientation
        && a.report.authoredOrientation === b.report.authoredOrientation, 'BINDING', 'Actual Source0 and exactly one Face sense inversion required');
      check(a.topology.vertices.length === b.topology.vertices.length && a.topology.edges.length === b.topology.edges.length
        && a.topology.loop.uses.length === b.topology.loop.uses.length && a.pcurves.length === b.pcurves.length, 'COVERAGE', 'Complete local inventory must correspond bijectively');
      lineage.faces.push({ original: faceReference(original.sourceId, a), mirrored: faceReference(mirrored.sourceId, b) });
      const from = { sourceId: original.sourceId, faceId: a.options.faceId }, to = { sourceId: mirrored.sourceId, faceId: b.options.faceId };
      for (const [j, curve] of a.loop.edges.entries()) {
        const next = b.loop.edges[j];
        check(curve.degree === next.degree && same(curve.knots, next.knots) && same(curve.weights, next.weights), 'BINDING', 'Line basis/domain/weight bits changed');
        lineage.curves.push({ original: { ...from, curveId: curve.id }, mirrored: { ...to, curveId: next.id } });
      }
      check(a.plane.degreeU === b.plane.degreeU && a.plane.degreeV === b.plane.degreeV && same(a.plane.knotsU, b.plane.knotsU)
        && same(a.plane.knotsV, b.plane.knotsV) && same(a.plane.weights, b.plane.weights), 'BINDING', 'Surface basis/domain/weight bits changed');
      for (const [j, vertex] of a.topology.vertices.entries()) {
        const next = b.topology.vertices[j], originalRef = { ...from, vertexId: vertex.id }, mirroredRef = { ...to, vertexId: next.id };
        checkPoint(vertex.point, next.point); vertexMap.set(memberKey(originalRef), mirroredRef);
        lineage.localVertices.push({ original: originalRef, mirrored: mirroredRef });
      }
      const curveMap = new Map(a.loop.edges.map((c, j) => [c.id, b.loop.edges[j].id]));
      const edgeMap = new Map(a.topology.edges.map((e, j) => [e.id, b.topology.edges[j].id]));
      const localVertex = (vertexId: string): string => {
        const ref = vertexMap.get(memberKey({ ...from, vertexId })); check(ref !== undefined, 'COVERAGE', 'Local vertex lineage is missing'); return ref.vertexId;
      };
      for (const [j, edge] of a.topology.edges.entries()) {
        const next = b.topology.edges[j];
        check(curveMap.get(edge.curveId) === next.curveId && same(edge.vertexIds.map(localVertex), next.vertexIds), 'INCIDENCE', 'Local edge membership changed');
        lineage.localEdges.push({ original: { ...from, edgeId: edge.id }, mirrored: { ...to, edgeId: next.id } });
      }
      const pcurveMap = new Map<string, string>();
      for (const pc of a.pcurves) {
        const matches = b.pcurves.filter(next => next.curveId === curveMap.get(pc.curveId));
        check(matches.length === 1, 'COVERAGE', 'One actual generated pcurve per original Line required');
        const next = matches[0];
        check(edgeMap.get(pc.edgeId) === next.edgeId && same(pc.domain, next.domain)
          && pc.curve.degree === next.curve.degree && same(pc.curve.knots, next.curve.knots) && same(pc.curve.weights, next.curve.weights), 'BINDING', 'Generated pcurve domain/basis/weight bits changed');
        pcurveMap.set(pc.id, next.id);
        lineage.pcurves.push({ original: { ...from, pcurveId: pc.id }, mirrored: { ...to, pcurveId: next.id } });
      }
      check(same(a.topology.loop.uses.slice().reverse().map(use => curveMap.get(use.curveId)), b.topology.loop.uses.map(use => use.curveId)),
        'BINDING', 'Actual native use cycle must reverse through complete Curve lineage');
      for (const use of a.topology.loop.uses) {
        const matches: ConvexPlanarFaceUse[] = b.topology.loop.uses.filter(next =>
          curveMap.get(use.curveId) === next.curveId && edgeMap.get(use.edgeId) === next.edgeId);
        check(matches.length === 1, 'COVERAGE', 'One actual target use per original Curve/edge required');
        const next = matches[0];
        check(pcurveMap.get(use.pcurveId) === next.pcurveId && oppositeSense(use.sense) === next.sense
          && same(use.interval.slice().reverse(), next.interval) && same(use.vertexIds.slice().reverse().map(localVertex), next.vertexIds),
          'BINDING', 'Actual native use sense, interval and endpoints must reverse once');
        const ref = { sourceId: mirrored.sourceId, useId: next.id };
        check(!useMap.has(key(original.sourceId, use.id)), 'COVERAGE', 'Repeated original directed use');
        useMap.set(key(original.sourceId, use.id), ref);
        lineage.uses.push({ original: { ...from, useId: use.id }, mirrored: { ...to, useId: next.id } });
      }
    });
    const edgePairs = at('pair-remapping', 'parent.request.edgePairs', () => parent.request.edgePairs.map(pair => {
      const a = useMap.get(key(pair.a.sourceId, pair.a.useId)), b = useMap.get(key(pair.b.sourceId, pair.b.useId));
      check(a !== undefined && b !== undefined, 'COVERAGE', 'Every original qualified pair requires two actual mirrored uses'); return { a, b };
    }));
    const solid = at('target-qualification', solidOptions.solidId, () => {
      directCalls.targetQualificationCount++; return qualifyConvexPlanarSolid(assets, edgePairs, solidOptions);
    });

    at('solid-lineage', solidOptions.solidId, () => {
      check(same(solid.request.assets, assets) && same(solid.request.edgePairs, edgePairs), 'OWNED', 'Qualifier must retain complete actual Faces and remapped pairs');
      check(parent.graph.faces.length === solid.graph.faces.length && parent.graph.edges.length === solid.graph.edges.length
        && parent.graph.vertices.length === solid.graph.vertices.length && parent.supports.length === solid.supports.length, 'COVERAGE', 'Complete global inventory must correspond bijectively');
      const globalVertexMap = new Map<string, string>(), usedVertices = new Set<string>();
      for (const vertex of parent.graph.vertices) {
        const expected = vertex.members.map(member => {
          const next = vertexMap.get(memberKey(member)); check(next !== undefined, 'COVERAGE', 'Global vertex member has no actual local mapping'); return memberKey(next);
        }).sort();
        const matches = solid.graph.vertices.filter(next => same(next.members.map(memberKey).sort(), expected));
        check(matches.length === 1 && !usedVertices.has(matches[0].id), 'COVERAGE', 'Exact global vertex member sets must be bijective');
        const next = matches[0]; checkPoint(vertex.pointMM, next.pointMM); usedVertices.add(next.id); globalVertexMap.set(vertex.id, next.id);
        lineage.vertices.push({ original: { vertexId: vertex.id }, mirrored: { vertexId: next.id } });
      }
      const globalEdgeMap = new Map<string, string>(), usedEdges = new Set<string>();
      for (const edge of parent.graph.edges) {
        const expected = edge.uses.map(ref => useMap.get(key(ref.sourceId, ref.use.id)));
        const matches = solid.graph.edges.filter(next => next.uses.length === expected.length
          && next.uses.every((ref, j) => ref.sourceId === expected[j]?.sourceId && ref.use.id === expected[j]?.useId));
        check(matches.length === 1 && !usedEdges.has(matches[0].id), 'COVERAGE', 'Exact directed edge pair membership must be bijective');
        const next = matches[0];
        check(edge.pairIndex === next.pairIndex && same(edge.vertexIds.slice().reverse().map(v => globalVertexMap.get(v)), next.vertexIds), 'INCIDENCE', 'Paired edge order or directed vertex correspondence changed');
        check(equalFraction(edge.parameterMapAtoB.scale, next.parameterMapAtoB.scale)
          && equalFraction(edge.parameterMapAtoB.offset, next.parameterMapAtoB.offset), 'BINDING', 'Exact directed parameter map changed');
        usedEdges.add(next.id); globalEdgeMap.set(edge.id, next.id);
        lineage.edges.push({ original: { edgeId: edge.id }, mirrored: { edgeId: next.id } });
      }
      const mappedFace = (sourceId: string, faceId: string): FaceReference => {
        const found = lineage.faces.find(f => f.original.sourceId === sourceId && f.original.faceId === faceId);
        check(found !== undefined, 'COVERAGE', 'Source-qualified Face mapping required'); return found.mirrored;
      };
      for (const face of parent.graph.faces) {
        const ref = mappedFace(face.sourceId, face.faceId), matches = solid.graph.faces.filter(next => next.sourceId === ref.sourceId && next.faceId === ref.faceId);
        check(matches.length === 1, 'COVERAGE', 'One target graph Face per original required');
        const next = matches[0];
        check(next.surfaceId === ref.surfaceId && next.loopId === ref.loopId && same(reversedCycle(face.vertexIds).map(v => globalVertexMap.get(v)), next.vertexIds)
          && same(face.edgeIds.slice().reverse().map(e => globalEdgeMap.get(e)), next.edgeIds), 'INCIDENCE', 'Face loop membership/order changed');
      }
      for (const link of parent.graph.vertexLinks) {
        const next = solid.graph.vertexLinks.find(v => v.vertexId === globalVertexMap.get(link.vertexId));
        check(next !== undefined && same(reversedCycle(link.cycleEdgeIds).map(e => globalEdgeMap.get(e)), next.cycleEdgeIds), 'INCIDENCE', 'Exact vertex link cycle changed');
        const arcs = link.arcs.map(arc => { const ref = mappedFace(arc.sourceId, arc.faceId); return { sourceId: ref.sourceId, faceId: ref.faceId,
          fromEdgeId: globalEdgeMap.get(arc.toEdgeId), toEdgeId: globalEdgeMap.get(arc.fromEdgeId) }; });
        check(same(arcs, next.arcs), 'INCIDENCE', 'Vertex link Face/edge membership changed');
      }
      const checkExactPoint = (a: ExactPointData, b: ExactPointData): void => {
        check(signedMap.every(([sourceAxis, sign], targetAxis) => {
          const source = fraction(a[sourceAxis]);
          return rational.compare(sign === 1 ? source : rational.neg(source), fraction(b[targetAxis])) === 0;
        }), 'BINDING', 'Certified exact vector differs from mirrored parent');
      };
      for (const support of parent.supports) {
        const ref = mappedFace(support.sourceId, support.faceId), matches = solid.supports.filter(s => s.sourceId === ref.sourceId && s.faceId === ref.faceId);
        check(matches.length === 1 && matches[0].surfaceId === ref.surfaceId, 'COVERAGE', 'Exactly one corresponding target support required');
        const next = matches[0];
        checkExactPoint(support.originMM, next.originMM);
        checkExactPoint(support.outwardNormal, next.outwardNormal);
        check(equalFraction(support.offset, next.offset), 'BINDING', 'Exact mirrored support offset changed');
      }
      checkExactPoint(parent.certificate.strictInteriorMM, solid.certificate.strictInteriorMM);
      check(equalFraction(parent.certificate.volumeMM3, solid.certificate.volumeMM3), 'BINDING', 'Certified rational volume changed');
      // Each mapping's identity inventory must be injective on both sides. Coverage
      // above establishes surjectivity against the complete actual inventories.
      for (const mappings of Object.values(lineage)) {
        check(new Set(mappings.map(m => JSON.stringify(m.original))).size === mappings.length
          && new Set(mappings.map(m => JSON.stringify(m.mirrored))).size === mappings.length, 'COVERAGE', 'Lineage must be bijective, never a nearest-point naming claim');
      }
    });
    const bindingCount = assets.reduce((sum, a) => sum + a.face.bindings.length, 0);
    const result: ModelingMirrorResult = { request, solid, lineage, report: {
      schema: 'barocss-modeling-mirror', version: 0, lengthUnit: 'mm', solid: true, determinant: -1, orientationFlipCount: assets.length, parentValidation, targetQualification: solid.report,
      directCalls: { ...directCalls },
      initialFaceConstruction: { faceCount: assets.length, sourceCompilationCount: assets.length, bindingObservationCount: bindingCount,
        curveD1Count: bindingCount, pcurveD1Count: bindingCount, surfaceD1Count: bindingCount, totalD1Count: bindingCount * 3,
        scope: 'direct-calls-and-known-parent-loop-work-not-hidden-provider-internals' },
      exactWork: rational.counts(),
      preservation: { completeParent: true, cardinalPlaneReflection: true, signedCoefficientBits: true, basisAndWeightBits: true,
        directedDomainBits: true, reversedDirectedTraversal: true, exactParameterMaps: true, bijectiveLineage: true, exactMirroredNormals: true,
        exactMirroredSupportsAndVertices: true, supportOffsetsUnchanged: true, exactVolumeUnchanged: true, independentSourceNamespaces: true },
      numericPolicy: 'exact-rationals-of-stored-binary64-no-welding-no-tolerance-promotion', validationScope: 'whole-result-self-consistency-not-authenticity',
      persistentNamingCertified: false,
      limits: { faces: 10, directedUses: 48, pairs: 24, vertices: 16, coordinateAbsMM: 10000, rationalOperations: 200000, integerBits: 8192 },
      dataCharge: 'unchanged-solid-snapshot-ledger-alias-occurrences-not-v8-heap',
    } };
    return at('snapshot', 'result', () => ledger.copy(result, true));
  } catch (cause) {
    const code = cause instanceof ConvexPlanarSolidError ? cause.code : 'NATIVE';
    const detail = stage === 'stage-coefficients' && code === 'REPRESENTABILITY'
      ? 'Exact target coordinate is not representable within the bounded binary64 policy: ' + (cause instanceof Error ? cause.message : '')
      : cause instanceof Error ? cause.message : 'Native construction refused';
    throw new ModelingMirrorError(code, stage, entity, detail, { parentValidation, directCalls: { ...directCalls }, exactWork: rational.counts() }, cause);
  }
}

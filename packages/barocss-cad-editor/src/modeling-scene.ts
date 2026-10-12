import type { OwnPlateHolePreviewResult, StoredPlateHoleSolidCertificate } from '@barocss/cad';
import { prepareEngineScene, prepareEngineCameraRay, raycastEngineScene, prepareKernelFacePreview, resolveKernelFaceReference } from '@barocss/gpu';
import type { EngineSceneV0, TriangleGeometryV0, KernelFacePreview, KernelFaceReference, KernelFaceBinding } from '@barocss/gpu';
import { preparePrismFeatureScene, pickPrismFeatureScene } from './prism-feature-scene.js';
import type { PrismDisplayPacket, PrismDisplayComponent, PrismDisplayScene, PrismFaceSelection } from './prism-feature-scene.js';

/** Copied native qualification, not a new certificate or a claim about the sampled mesh. */
export type ModelingHoleQualification = Pick<StoredPlateHoleSolidCertificate, 'kind' | 'version' | 'lengthUnit' | 'geometryAuthority'
  | 'solid' | 'topologyCertified' | 'embeddedStoredGeometryCertified' | 'materialComponentCount' | 'genus'
  | 'faceCount' | 'vertexCount' | 'edgeCount' | 'loopCount' | 'edgeUseCount' | 'weightedEuler'>;
export interface ModelingHoleLineage {
  bodyId: string;
  faces: { id: string; role: 'outer-side' | 'bottom-cap' | 'top-cap' | 'hole-wall'; surfaceId: string;
    orientation: 'forward' | 'reverse'; outerLoopId: string; innerLoopIds: string[] }[];
  vertices: { id: string; point: [number, number, number] }[];
  edges: { id: string; curveId: string; vertexIds: [string, string]; sourceParameterRange: [number, number] }[];
  loops: { id: string; faceId: string; role: 'outer' | 'inner';
    uses: { id: string; edgeId: string; sense: 'forward' | 'reverse'; pcurveId: string; domain: [number, number] }[] }[];
}
export interface ModelingHoleDisplayComponent {
  family: 'stored-rational-plate-hole'; role: string; solidId: string; preview: OwnPlateHolePreviewResult;
  qualification: ModelingHoleQualification; lineage: ModelingHoleLineage;
}
export interface ModelingBodyDisplayPacket {
  profile: 'model-body-faces'; documentId: string; revision: number; taskToken: string;
  components: ({ family: 'convex-planar'; component: PrismDisplayComponent } | ModelingHoleDisplayComponent)[];
  outcomes: { role: string; solidId: string; family: 'convex-planar' | 'stored-rational-plate-hole'; status: 'solid' }[];
}
export type ModelingDisplayPacket = PrismDisplayPacket | ModelingBodyDisplayPacket;
export interface ModelingBodyDisplayScene { packet: ModelingBodyDisplayPacket; selectedOutput: string; scene: EngineSceneV0; canvasLabel: string }
export type ModelingDisplayScene = PrismDisplayScene | ModelingBodyDisplayScene;
export interface ModelingHoleFaceSelection {
  family: 'stored-rational-plate-hole'; documentId: string; revision: number; role: string; solidId: string;
  reference: KernelFaceReference; provenance: OwnPlateHolePreviewResult['provenance'][number]; lineage: ModelingHoleLineage;
  triangleIndex: number; approximate: true;
}
export type ModelingFaceSelection = PrismFaceSelection | ModelingHoleFaceSelection;
type Accepted = { packet: ModelingBodyDisplayPacket; holes: Map<string, KernelFacePreview>; convex: Map<string, PrismDisplayScene>; selectedOutput: string };
// Structured clones and public snapshots carry no receiving-realm prepared authority.
const accepted = new WeakMap<ModelingDisplayScene, Accepted>();
function check(value: unknown, detail: string): asserts value { if (!value) throw new Error(`Modeling display: ${detail}`); }
function exact(value: object, fields: string[]): void {
  check(value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === fields.length && fields.every(k => Object.hasOwn(value, k)), 'exact copied fields required: ' + fields.join(','));
}
function token(value: unknown, limit = 128): asserts value is string {
  check(typeof value === 'string' && value.length >= 1 && value.length <= limit && /^[\x21-\x7e]+$/.test(value), 'bounded opaque ASCII identity required');
}
function equal(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b); }
function numeric(value: unknown, length: number): asserts value is number[] {
  check(Array.isArray(value) && value.length === length && value.every(n => typeof n === 'number' && Number.isFinite(n)), 'finite numeric tuple required');
}
/** Descriptor-first copy: no getters, foreign prototypes, sparse arrays, cycles or unbounded transport. */
function snapshot<T>(input: T): T {
  let remaining = 131072, characters = 0; const active = new Set<object>();
  function copy(v: unknown, depth: number): unknown {
    check(--remaining >= 0 && depth <= 24, 'own-data occurrence/depth budget');
    if (typeof v === 'number') { check(Number.isFinite(v), 'finite copied number required'); return v; }
    if (typeof v === 'string') { characters += v.length; check(v.length <= 512 && characters <= 1048576, 'copied string budget'); return v; }
    if (v === null || typeof v === 'boolean') return v;
    check(typeof v === 'object' && !active.has(v), 'plain acyclic data required');
    const array = Array.isArray(v), proto = Object.getPrototypeOf(v);
    check(array ? proto === Array.prototype : proto === Object.prototype || proto === null, 'foreign data prototype');
    if (array) check(v.length <= 23814, 'array budget');
    const keys = Reflect.ownKeys(v), descriptors = Object.getOwnPropertyDescriptors(v);
    check(keys.length <= (array ? 23815 : 64) && keys.every(k => typeof k === 'string' && k.length <= 128 && 'value' in descriptors[k]
      && (array && k === 'length' || descriptors[k].enumerable)), 'accessors/symbols/hidden fields refuse');
    active.add(v);
    try {
      if (array) { check(keys.length === v.length + 1, 'dense array required'); return Array.from({ length: v.length }, (_, i) => {
        check(Object.hasOwn(descriptors, String(i)), 'sparse array'); return copy(descriptors[String(i)].value, depth + 1);
      }); }
      return Object.fromEntries((keys as string[]).map(k => [k, copy(descriptors[k].value, depth + 1)]));
    } finally { active.delete(v); }
  }
  const result = copy(input, 0) as T; check(JSON.stringify(result).length <= 2 * 1024 * 1024, 'packet exceeds 2 MiB'); return result;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value;
}
const QUALIFICATION: ModelingHoleQualification = { kind: 'restricted-stored-rational-plate-hole-solid', version: 0, lengthUnit: 'mm',
  geometryAuthority: 'stored-coefficient-mathematical-model', solid: true, topologyCertified: true, embeddedStoredGeometryCertified: true,
  materialComponentCount: 1, genus: 1, faceCount: 7, vertexCount: 10, edgeCount: 15, loopCount: 9, edgeUseCount: 30, weightedEuler: 0 };
function admitHole(component: ModelingHoleDisplayComponent, packet: ModelingBodyDisplayPacket): KernelFacePreview {
  exact(component, ['family', 'role', 'solidId', 'preview', 'qualification', 'lineage']);
  exact(component.qualification, Object.keys(QUALIFICATION));
  check(Object.entries(QUALIFICATION).every(([key, value]) => component.qualification[key as keyof ModelingHoleQualification] === value), 'copied native qualification mismatch');
  const { preview, lineage } = component; exact(preview, ['mesh', 'provenance', 'report']);
  exact(lineage, ['bodyId', 'faces', 'vertices', 'edges', 'loops']);
  check(lineage.bodyId === component.solidId, 'native body identity mismatch'); token(component.solidId, 48);
  const context = preview.mesh.context;
  check(context.documentId === packet.documentId && context.bodyId === component.solidId && context.taskToken === packet.taskToken
    && context.documentRevision === String(packet.revision) && context.kernelResultRevision === String(packet.revision)
    && context.topologyRevision === String(packet.revision), 'request/document/revision/body context mismatch');
  // This is the only axis conversion. Its opaque prepared result never crosses the Worker boundary.
  const prepared = prepareKernelFacePreview(preview.mesh, { displayId: component.role, packetRevision: packet.revision });
  check(preview.mesh.chunks.length === 7 && preview.provenance.length === 7 && lineage.faces.length === 7
    && lineage.vertices.length === 10 && lineage.edges.length === 15 && lineage.loops.length === 9, 'complete seven-face native inventory required');
  const unique = (values: string[]) => { values.forEach(v => token(v)); check(new Set(values).size === values.length, 'unique native identities required'); };
  unique([...lineage.faces.flatMap(f => [f.id, f.surfaceId]), ...lineage.vertices.map(v => v.id), ...lineage.edges.flatMap(e => [e.id, e.curveId]),
    ...lineage.loops.flatMap(l => [l.id, ...l.uses.flatMap(u => [u.id, u.pcurveId])])]);
  const roles = lineage.faces.map(f => f.role);
  check(roles.filter(r => r === 'outer-side').length === 4 && ['bottom-cap', 'top-cap', 'hole-wall'].every(r => roles.filter(v => v === r).length === 1), 'native face role inventory');
  for (const vertex of lineage.vertices) { exact(vertex, ['id', 'point']); numeric(vertex.point, 3); }
  for (const edge of lineage.edges) {
    exact(edge, ['id', 'curveId', 'vertexIds', 'sourceParameterRange']); numeric(edge.sourceParameterRange, 2);
    check(edge.sourceParameterRange[0] < edge.sourceParameterRange[1] && edge.vertexIds.length === 2
      && edge.vertexIds.every(id => lineage.vertices.some(v => v.id === id)), 'native edge identity/range');
  }
  for (const loop of lineage.loops) {
    exact(loop, ['id', 'faceId', 'role', 'uses']);
    check(lineage.faces.some(f => f.id === loop.faceId) && ['inner', 'outer'].includes(loop.role)
      && loop.uses.length === (loop.role === 'inner' ? 1 : 4), 'original loop inventory');
    for (const [i, use] of loop.uses.entries()) {
      exact(use, ['id', 'edgeId', 'sense', 'pcurveId', 'domain']); numeric(use.domain, 2);
      const edge = lineage.edges.find(e => e.id === use.edgeId), nextUse = loop.uses[(i + 1) % loop.uses.length];
      const next = lineage.edges.find(e => e.id === nextUse.edgeId);
      check(edge && next && ['forward', 'reverse'].includes(use.sense) && equal(use.domain, edge.sourceParameterRange)
        && edge.vertexIds[use.sense === 'forward' ? 1 : 0] === next.vertexIds[nextUse.sense === 'forward' ? 0 : 1], 'complete directed native use/closure');
    }
  }
  const report = preview.report, native = report.native;
  exact(report, ['kind', 'native', 'segmentsPerQuarter', 'ringParameters', 'faceCount', 'vertexCount', 'triangleCount', 'cornerRayObservations',
    'maximumCornerRayResidualMM', 'maximumNativeBoundaryDifferenceMM', 'normalMethod', 'approximation', 'geometricValidity', 'topologyCertified', 'solid', 'limits']);
  check(report.kind === 'own-plate-circular-hole-preview' && report.segmentsPerQuarter === 4 && report.faceCount === 7
    && report.vertexCount === prepared.packet.positions.length / 3 && report.triangleCount === prepared.packet.indices.length / 3
    && report.normalMethod === 'actual-native-surface-D1-with-face-sense' && report.approximation === 'sampled-native-circle-ring-and-faceted-surface'
    && report.geometricValidity === 'not-certified' && report.topologyCertified === false && report.solid === false, 'sampled preview report cannot certify a solid');
  exact(report.limits, ['maximumFaces', 'maximumVertices', 'maximumTriangles', 'maximumCornerRayIterations', 'localBindingComparisonMM']);
  check(equal(report.limits, { maximumFaces: 64, maximumVertices: 4096, maximumTriangles: 7938, maximumCornerRayIterations: 56, localBindingComparisonMM: 1e-7 }), 'native preview limits');
  const ring = report.ringParameters;
  check(Array.isArray(ring) && ring.length >= 17 && ring.length <= 21 && ring[0] === 0 && ring.at(-1) === 4
    && ring.every((v, i) => typeof v === 'number' && (i === 0 || v > ring[i - 1]))
    && Array.from({ length: 17 }, (_, i) => i / 4).every(v => ring.includes(v)), 'complete sampled native ring inventory');
  check(report.cornerRayObservations.length === 4 && report.maximumCornerRayResidualMM >= 0 && report.maximumCornerRayResidualMM <= 1e-7
    && report.maximumNativeBoundaryDifferenceMM >= 0 && report.maximumNativeBoundaryDifferenceMM <= 1e-7, 'native preview correspondence observations');
  for (const observation of report.cornerRayObservations) {
    exact(observation, ['cornerMM', 'parameter', 'iterations', 'observedRayResidualMM']); numeric(observation.cornerMM, 2);
    check(ring.includes(observation.parameter) && Number.isInteger(observation.iterations) && observation.iterations >= 1 && observation.iterations <= 56
      && observation.observedRayResidualMM >= 0 && observation.observedRayResidualMM <= report.maximumCornerRayResidualMM, 'native corner observation');
  }
  exact(native, ['kind', 'bodyId', 'featureId', 'lengthUnit', 'boundsMM', 'clearanceMM', 'faceCount', 'vertexCount', 'edgeCount', 'loopCount', 'edgeUseCount',
    'edgeIncidence', 'loopObservations', 'normalObservations', 'referenceVolumeMM3', 'referenceCapAreaMM2', 'referenceCavityAreaMM2', 'referenceSemantics',
    'incidenceValid', 'candidateClosedShell', 'geometricValidity', 'topologyCertified', 'solid', 'limits']);
  token(native.featureId, 48);
  check(native.kind === 'own-axis-plate-circular-through-hole-candidate' && native.bodyId === component.solidId && native.lengthUnit === 'mm'
    && native.faceCount === 7 && native.vertexCount === 10 && native.edgeCount === 15 && native.loopCount === 9 && native.edgeUseCount === 30
    && native.incidenceValid === true && native.candidateClosedShell === true && native.geometricValidity === 'not-certified'
    && native.topologyCertified === false && native.solid === false && native.referenceSemantics === 'analytic-authored-family-formula-not-certified', 'native source report qualification');
  exact(native.boundsMM, ['min', 'max']); numeric(native.boundsMM.min, 3); numeric(native.boundsMM.max, 3); numeric(native.clearanceMM, 4);
  check(native.boundsMM.min.every(v => v === 0) && native.boundsMM.max.every(v => v > 0) && native.clearanceMM.every(v => v > 0)
    && [native.referenceVolumeMM3, native.referenceCapAreaMM2, native.referenceCavityAreaMM2].every(v => Number.isFinite(v) && v > 0), 'native source dimensions/reference observations');
  for (const vertex of lineage.vertices) check(vertex.point.every((v, axis) => v >= native.boundsMM.min[axis] - 1e-7 && v <= native.boundsMM.max[axis] + 1e-7)
    && preview.mesh.chunks.some(c => c.positionsMM.some((_, i) => i % 3 === 0 && vertex.point.every((v, axis) => Math.abs(v - c.positionsMM[i + axis]) <= 1e-7))), 'original native vertex must occur on sampled boundaries');
  const radius = (native.boundsMM.max[0] - native.clearanceMM[0] - native.clearanceMM[1]) / 2;
  const centre = [native.clearanceMM[0] + radius, native.clearanceMM[2] + radius];
  check(radius > 0 && Math.abs(native.boundsMM.max[1] - native.clearanceMM[2] - native.clearanceMM[3] - 2 * radius) <= 1e-7, 'source hole clearance correspondence');
  exact(native.limits, ['authoredBodyIdCharacters', 'authoredIdCharacters', 'dimensionsIntegerMM', 'nativeRadiusMM', 'nativeComparisonMM']);
  check(equal(native.limits, { authoredBodyIdCharacters: 32, authoredIdCharacters: 48, dimensionsIntegerMM: [1, 10000], nativeRadiusMM: [.001, 10000], nativeComparisonMM: 1e-7 }), 'source report limits');
  check(native.edgeIncidence.length === 15 && native.loopObservations.length === 9 && native.normalObservations.length === 10, 'source report inventories');
  for (const [i, edge] of lineage.edges.entries()) {
    const incidence = native.edgeIncidence[i]; exact(incidence, ['edgeId', 'uses']);
    const uses = lineage.loops.flatMap(l => l.uses.filter(u => u.edgeId === edge.id).map(u => ({ faceId: l.faceId, loopId: l.id, useId: u.id, sense: u.sense })));
    check(incidence.edgeId === edge.id && uses.length === 2 && uses[0].sense !== uses[1].sense && equal(uses, incidence.uses), 'original paired edge incidence');
  }
  for (const [i, loop] of lineage.loops.entries()) {
    const observation = native.loopObservations[i]; exact(observation, ['loopId', 'directedClosed', 'signedUVAreaObservation']);
    const face = lineage.faces.find(f => f.id === loop.faceId)!;
    check(observation.loopId === loop.id && observation.directedClosed === true && observation.signedUVAreaObservation !== 0
      && (face.role === 'hole-wall' || (observation.signedUVAreaObservation > 0) === (loop.role === 'outer')), 'native loop observation identity/orientation');
  }
  for (const observation of native.normalObservations) {
    exact(observation, ['faceId', 'uv', 'pointMM', 'normal']); numeric(observation.uv, 2); numeric(observation.pointMM, 3); numeric(observation.normal, 3);
    check(lineage.faces.some(f => f.id === observation.faceId) && Math.abs(Math.hypot(...observation.normal) - 1) <= 1e-6, 'source normal observation identity');
  }
  const wallIndex = lineage.faces.findIndex(f => f.role === 'hole-wall');
  const wallChunk = preview.mesh.chunks[wallIndex];
  const near = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= 1e-7);
  for (const [i, face] of lineage.faces.entries()) {
    exact(face, ['id', 'role', 'surfaceId', 'orientation', 'outerLoopId', 'innerLoopIds']);
    const chunk = preview.mesh.chunks[i], provenance = preview.provenance[i], loops = lineage.loops.filter(l => l.faceId === face.id);
    const cap = face.role === 'bottom-cap' || face.role === 'top-cap';
    check(face.orientation === (face.role === 'hole-wall' ? 'reverse' : 'forward') && chunk.faceOrientation === (face.orientation === 'reverse' ? 'reversed' : 'forward')
      && chunk.nativeFaceId === face.id && chunk.normalSource === 'native-surface-evaluation', 'actual face/normal orientation required');
    check(face.innerLoopIds.length === (cap ? 1 : 0) && loops.length === (cap ? 2 : 1)
      && loops[0].id === face.outerLoopId && loops[0].role === 'outer' && equal(loops.slice(1).map(l => l.id), face.innerLoopIds)
      && loops.slice(1).every(l => l.role === 'inner'), 'cap must retain original outer and inner loops');
    exact(provenance, ['faceToken', 'nativeFaceId', 'nativeSurfaceId', 'role', 'orientation', 'nativeLoopIds', 'nativeEdgeIds', 'panels']);
    check(provenance.faceToken === chunk.faceToken && provenance.nativeFaceId === face.id && provenance.nativeSurfaceId === face.surfaceId
      && provenance.role === face.role && provenance.orientation === face.orientation && equal(provenance.nativeLoopIds, loops.map(l => l.id))
      && equal(provenance.nativeEdgeIds, [...new Set(loops.flatMap(l => l.uses.map(u => u.edgeId)))]), 'original face/surface/loop/edge provenance required');
    const observations = native.normalObservations.filter(o => o.faceId === face.id);
    check(observations.length === (face.role === 'hole-wall' ? 4 : 1), 'complete per-face source normal observations');
    const count = face.role === 'outer-side' ? 1 : ring.length - 1;
    check(provenance.panels.length === count && chunk.positionsMM.length === count * 12 && chunk.indices.length === count * 6, 'complete native panel coverage');
    for (const [j, panel] of provenance.panels.entries()) {
      exact(panel, ['vertexRange', 'indexRange', 'normalSampleUV', 'normal']); numeric(panel.normalSampleUV, 2); numeric(panel.normal, 3);
      check(equal(panel.vertexRange, [j * 4, (j + 1) * 4]) && equal(panel.indexRange, [j * 6, (j + 1) * 6]), 'complete ordered native panel ranges');
      const points = Array.from({ length: 4 }, (_, k) => chunk.positionsMM.slice((j * 4 + k) * 3, (j * 4 + k + 1) * 3));
      check(points.every((point, k) => equal(chunk.normals.slice((j * 4 + k) * 3, (j * 4 + k + 1) * 3), panel.normal)
        && point.every((v, axis) => v >= native.boundsMM.min[axis] - 1e-7 && v <= native.boundsMM.max[axis] + 1e-7)), 'actual panel normals/bounds');
      const local = chunk.indices.slice(j * 6, (j + 1) * 6).map(v => v - j * 4);
      const uv = (k: number) => chunk.parametersUV.slice((j * 4 + k) * 2, (j * 4 + k + 1) * 2);
      const expected = [[0, 1, 2], [1, 3, 2]].flatMap(([a, b, c]) => {
        const A = uv(a), B = uv(b), C = uv(c), signed = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
        check(Number.isFinite(signed) && signed !== 0, 'native UV triangle is degenerate');
        if (signed < 0) [b, c] = [c, b];
        if (face.orientation === 'reverse') [b, c] = [c, b];
        return [a, b, c];
      });
      check(equal(local, expected), 'original signed-UV and face-sense triangle mapping');
      if (face.role !== 'hole-wall') check(equal(panel.normal, observations[0].normal), 'panel/source normal observation mismatch');
      if (cap) {
        const z = face.role === 'bottom-cap' ? 0 : native.boundsMM.max[2];
        check(points.every(p => Math.abs(p[2] - z) <= 1e-7) && panel.normal[0] === 0 && panel.normal[1] === 0
          && panel.normal[2] === (face.role === 'bottom-cap' ? -1 : 1), 'native cap orientation');
        check([points[0], points[2]].every(p => Math.abs(Math.hypot(p[0] - centre[0], p[1] - centre[1]) - radius) <= 1e-7)
          && [points[1], points[3]].every(p => p[0] === 0 || p[0] === native.boundsMM.max[0] || p[1] === 0 || p[1] === native.boundsMM.max[1]), 'annular cap panels must retain aperture');
        const wallStart = j * 4 + (face.role === 'bottom-cap' ? 0 : 2), next = ((j + 1) % count) * 4;
        check(near(points[0], wallChunk.positionsMM.slice(wallStart * 3, wallStart * 3 + 3))
          && near(points[2], wallChunk.positionsMM.slice((wallStart + 1) * 3, (wallStart + 2) * 3))
          && near(points[2], chunk.positionsMM.slice(next * 3, next * 3 + 3))
          && near(points[3], chunk.positionsMM.slice((next + 1) * 3, (next + 2) * 3)), 'complete annular cap/wall panel continuity');
      } else if (face.role === 'hole-wall') {
        check(panel.normal[2] === 0 && points.every(p => panel.normal[0] * (p[0] - centre[0]) + panel.normal[1] * (p[1] - centre[1]) < 0), 'native cavity normals must point inward');
        check(equal(chunk.parametersUV.slice(j * 8, (j + 1) * 8), [ring[j], 0, ring[j + 1], 0, ring[j], 1, ring[j + 1], 1])
          && equal(panel.normalSampleUV, [ring[j] + (ring[j + 1] - ring[j]) / 2, .5]), 'original wall parameter panels');
        const next = ((j + 1) % count) * 4;
        check(near(points[1], chunk.positionsMM.slice(next * 3, next * 3 + 3))
          && near(points[3], chunk.positionsMM.slice((next + 2) * 3, (next + 3) * 3)), 'complete native wall ring continuity');
      }
    }
  }
  return prepared;
}
function sceneForHole(component: ModelingHoleDisplayComponent, prepared: KernelFacePreview, aspect: number): EngineSceneV0 {
  const geometry: TriangleGeometryV0 = { format: 'barocss-gpu-triangle-geometry', version: 0, id: 'model_geometry_' + component.role,
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', winding: 'ccw', positions: [...prepared.packet.positions], normals: [...prepared.packet.normals],
    uvs: [...prepared.packet.parameters], indices: [...prepared.packet.indices] };
  const { min, max } = prepared.packet.bounds, target = min.map((v, i) => (v + max[i]) / 2) as [number, number, number];
  const radius = Math.max(.001, Math.hypot(...max.map((v, i) => (v - min[i]) / 2)));
  const halfAngle = Math.min(Math.PI / 7.2, Math.atan(Math.tan(Math.PI / 7.2) * aspect));
  const distance = radius * 1.2 / Math.sin(halfAngle), direction = [1, .75, 1], length = Math.hypot(...direction);
  const scene: EngineSceneV0 = { format: 'barocss-gpu-engine-scene', version: 0, id: 'modeling_body_scene', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene',
    background: [.025, .035, .05], camera: { eye: direction.map((v, i) => target[i] + v * distance / length) as [number, number, number], target,
      up: [0, 1, 0], fovYDegrees: 50, near: Math.max(.0001, distance - radius * 1.1), far: distance + radius * 1.1 }, geometries: [geometry],
    materials: [{ id: 'prism_material', type: 'unlit', colorSpace: 'linear', color: [.3, .58, .8] }],
    nodes: [{ id: 'model_node_' + component.role, parentId: null, type: 'mesh', geometryId: geometry.id, materialId: 'prism_material',
      translation: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1], visible: true }] };
  // Native success does not relax EngineScene's actual ±1000/normal/camera/Float32 limits.
  prepareEngineScene(scene); return scene;
}
/** Admits every saved output, including hidden bodies; selection changes visibility only. */
export function prepareModelingScene(input: ModelingDisplayPacket, aspect = 1, selectedOutput?: string): ModelingDisplayScene {
  const profile = Object.getOwnPropertyDescriptor(input, 'profile');
  check(!profile || 'value' in profile, 'own profile tag required');
  if (profile?.value !== 'model-body-faces') {
    return preparePrismFeatureScene(input as PrismDisplayPacket, 'result', aspect);
  }
  const packet = snapshot(input) as ModelingBodyDisplayPacket;
  exact(packet, ['profile', 'documentId', 'revision', 'taskToken', 'components', 'outcomes']); token(packet.documentId, 48); token(packet.taskToken, 48);
  check(Number.isInteger(packet.revision) && packet.revision >= 0 && packet.revision <= 2147483647, 'bounded document revision');
  check(Number.isFinite(aspect) && aspect >= 1 / 2048 && aspect <= 2048, 'invalid viewport aspect');
  check(Array.isArray(packet.components) && packet.components.length >= 1 && packet.components.length <= 8
    && Array.isArray(packet.outcomes) && packet.outcomes.length === packet.components.length, 'complete bounded output inventory');
  const holes = new Map<string, KernelFacePreview>(), convex = new Map<string, PrismDisplayScene>(), scenes = new Map<string, EngineSceneV0>();
  for (const [i, component] of packet.components.entries()) {
    const outcome = packet.outcomes[i]; exact(outcome, ['role', 'solidId', 'family', 'status']);
    check(/^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(outcome.role) && !['__proto__', 'prototype', 'constructor'].includes(outcome.role)
      && !scenes.has(outcome.role) && outcome.status === 'solid' && outcome.family === component.family, 'unique named output family required');
    if (component.family === 'convex-planar') {
      exact(component, ['family', 'component']);
      check(component.component.role === outcome.role && component.component.report.solidId === outcome.solidId, 'convex output identity mismatch');
      const display = preparePrismFeatureScene({ profile: 'model-outputs', documentId: packet.documentId, revision: packet.revision,
        components: [component.component], outcomes: [{ role: outcome.role, solidId: outcome.solidId, status: 'solid' }] }, 'result', aspect);
      convex.set(outcome.role, display); scenes.set(outcome.role, display.scene);
    } else {
      check(component.family === 'stored-rational-plate-hole' && component.role === outcome.role && component.solidId === outcome.solidId, 'known native output family/identity required');
      const prepared = admitHole(component, packet); holes.set(outcome.role, prepared); scenes.set(outcome.role, sceneForHole(component, prepared, aspect));
    }
  }
  check(holes.size > 0, 'mixed-family profile requires a stored-rational hole output');
  const selected = selectedOutput ?? packet.outcomes.at(-1)!.role, scene = scenes.get(selected);
  check(scene, 'selected output missing from admitted inventory');
  const family = packet.outcomes.find(o => o.role === selected)!.family;
  const display: ModelingBodyDisplayScene = freeze({ packet, selectedOutput: selected, scene, canvasLabel: `Model output ${selected} (${family})` });
  accepted.set(display, { packet, holes, convex, selectedOutput: selected }); return display;
}
/** Only the original accepted scene can resolve result-scoped copied references. */
export function resolveModelingFaceReference(display: ModelingDisplayScene, reference: KernelFaceReference): KernelFaceBinding | null {
  const authority = accepted.get(display); check(authority, 'original accepted scene required');
  const prepared = authority.holes.get(authority.selectedOutput); check(prepared, 'selected output has no sampled native faces');
  const binding = resolveKernelFaceReference(prepared, reference); return binding ? structuredClone(binding) : null;
}
export function pickModelingScene(display: ModelingDisplayScene, width: number, height: number, x: number, y: number): ModelingFaceSelection | null {
  if (display.packet.profile !== 'model-body-faces') return pickPrismFeatureScene({ packet: display.packet, view: 'result', scene: display.scene }, width, height, x, y);
  const authority = accepted.get(display); check(authority, 'original accepted scene required');
  const convex = authority.convex.get(authority.selectedOutput); if (convex) return pickPrismFeatureScene(convex, width, height, x, y);
  const prepared = authority.holes.get(authority.selectedOutput)!;
  const { ray } = prepareEngineCameraRay(display.scene.camera, { format: 'barocss-gpu-engine-camera-ray-request', version: 0,
    pixelOrigin: 'bottom-left', sampling: 'pixel-center', viewportWidth: width, viewportHeight: height, pixelX: x, pixelY: y });
  const hit = raycastEngineScene(display.scene, ray); if (!hit) return null;
  const binding = prepared.faces.find(f => hit.triangleIndex * 3 >= f.indexRange[0] && hit.triangleIndex * 3 < f.indexRange[1]);
  check(binding && resolveKernelFaceReference(prepared, binding.reference), 'picked face lacks original prepared authority');
  const component = authority.packet.components.find(c => c.family === 'stored-rational-plate-hole' && c.role === authority.selectedOutput) as ModelingHoleDisplayComponent;
  const provenance = component.preview.provenance.find(p => p.faceToken === binding.reference.faceToken)!;
  return structuredClone({ family: 'stored-rational-plate-hole', documentId: authority.packet.documentId, revision: authority.packet.revision,
    role: component.role, solidId: component.solidId, reference: binding.reference, provenance, lineage: component.lineage, triangleIndex: hit.triangleIndex, approximate: true });
}

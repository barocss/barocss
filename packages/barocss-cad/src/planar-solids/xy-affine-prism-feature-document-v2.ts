import { featureFields, featureIdentity, featureRevision, featureLength, signedJson } from '../xy-affine-prism-feature-document-internal.js';
import { chamferConvexPlanarSolid, ConvexPlanarSolidChamferError } from '../convex-planar-solid-chamfer.js';
import type { ConvexPlanarChamferUseReference, ConvexPlanarSolidChamferResult } from '../convex-planar-solid-chamfer.js';
import { buildXYAffineSketch } from '../xy-affine-sketch.js';
import type { XYAffineSketchSuccess } from '../xy-affine-sketch.js';
import { buildXYAffineSketchPrism, resolveXYAffineSketchPrismWall } from '../xy-affine-sketch-prism.js';
import type { XYAffineSketchPrismCoordinateSpanOptions, XYAffineSketchPrismCoordinateSpanResult } from '../xy-affine-sketch-prism.js';
import { subtractConvexPlanarSlab, ConvexPlanarSlabSubtractionError } from '../convex-planar-slab-subtraction.js';
import type { ConvexPlanarSlabSubtractionOptions, ConvexPlanarSlabSubtractionResult } from '../convex-planar-slab-subtraction.js';
import { SlabSubtractionLedger, same, SLAB_LIMITS } from './convex-planar-slab-subtraction-internal.js';
import { parseCadDocumentOwnJson, cadDocumentOwnUtf8Bytes } from '../cad-document.js';

import type { ConvexPlanarSolidGraph, ConvexPlanarSolidResult } from '../convex-planar-solid.js';
import type { ConvexPlanarSlabSubtractionEdgeOrigin } from '../convex-planar-slab-subtraction.js';
import { XYAffinePrismFeatureError } from './xy-affine-prism-feature-document.js';
import type { XYAffinePrismSketchNode, XYAffinePrismComponentRecipe, XYAffinePrismSubtractionNode, XYAffinePrismChamferNode, XYAffinePrismFeatureParameter, XYAffinePrismFeatureDocumentV1, XYAffinePrismFeatureEdits, XYAffinePrismFeatureWorkV1, XYAffinePrismFeatureResultV1, XYAffinePrismFeatureUpdateV1, XYAffinePrismFeatureDiagnosticCode } from './xy-affine-prism-feature-document.js';

export interface XYAffinePrismNodeV2 { id: string; kind: 'prism'; sketchNodeId: string; options: Omit<XYAffineSketchPrismCoordinateSpanOptions, 'sourceId' | 'sourceRevision'> }
export interface XYAffinePrismChamferNodeV2 extends Omit<XYAffinePrismChamferNode, 'parentPrismId'> {
  parent: { kind: 'subtraction-component'; subtractionNodeId: string; componentRole: 'second'; solidId: string };
}
/** One complete serial-part profile; never a chart-only v2 or implicit migration. */
export interface XYAffinePrismFeatureDocumentV2 extends Omit<XYAffinePrismFeatureDocumentV1, 'version' | 'nodes'> {
  version: 2; nodes: [XYAffinePrismSketchNode, XYAffinePrismSketchNode, XYAffinePrismNodeV2, XYAffinePrismNodeV2, XYAffinePrismSubtractionNode, XYAffinePrismChamferNodeV2];
}
export interface XYAffinePrismFeatureWorkV2 extends XYAffinePrismFeatureWorkV1 {
  /** Additional ExactAffinePlane contexts; excluded from legacy child-scoped rationalWork. */
  exactAffineContexts: number;
}
export interface XYAffinePrismChamferResolutionV2 {
  parent: XYAffinePrismChamferNodeV2['parent']; originalPrismNodeId: string; originalTopEdgeId: string; componentEdgeId: string;
  a: { reference: ConvexPlanarChamferUseReference; origin: ConvexPlanarSlabSubtractionEdgeOrigin };
  b: { reference: ConvexPlanarChamferUseReference; origin: ConvexPlanarSlabSubtractionEdgeOrigin };
  policy: 'original-face-and-complete-use-lineage-to-one-opposite-pair'; persistentNamingCertified: false;
}
export interface XYAffinePrismFeatureResultV2 extends Omit<XYAffinePrismFeatureResultV1, 'document' | 'prisms' | 'chamfer' | 'report'> {
  document: XYAffinePrismFeatureDocumentV2; prisms: [XYAffineSketchPrismCoordinateSpanResult, XYAffineSketchPrismCoordinateSpanResult];
  chamfer: ConvexPlanarSolidChamferResult; chamferResolution: XYAffinePrismChamferResolutionV2;
  report: Omit<XYAffinePrismFeatureResultV1['report'], 'version' | 'coldWork'> & { version: 2; coldWork: XYAffinePrismFeatureWorkV2 };
}
export interface XYAffinePrismFeatureUpdateV2 {
  result: XYAffinePrismFeatureResultV2;
  transaction: { request: { previousDocument: XYAffinePrismFeatureDocumentV2; edits: XYAffinePrismFeatureEdits };
    report: Omit<XYAffinePrismFeatureUpdateV1['transaction']['report'], 'validation' | 'candidate'> & { validation: XYAffinePrismFeatureWorkV2; candidate: XYAffinePrismFeatureWorkV2 } };
}
type Document = XYAffinePrismFeatureDocumentV2;
type Work = XYAffinePrismFeatureWorkV2;
type Result = XYAffinePrismFeatureResultV2;
type Update = XYAffinePrismFeatureUpdateV2;
const FILE_LIMIT = 262144;
// Conservative supported-envelope ceilings; exact observed shape counts are separate campaign assertions.
const PHASE_LIMITS: Work = { sketchBuilds: 2, prismBuilds: 2, wallResolutions: 2, subtractions: 1, chamfers: 1,
  sourceCompilations: 204, faceCompilations: 197, bindingObservations: 2970, totalD1: 8910,
  rationalContexts: 20, rationalOperations: 4000000, gcdSteps: 4000000, exactAffineContexts: 237 };
const zero = (): Work => Object.fromEntries(Object.keys(PHASE_LIMITS).map(k => [k, 0])) as unknown as Work;
interface State { ledger: SlabSubtractionLedger; stage: string; nodeId: string | null; work: Work }
const state = (): State => ({ ledger: new SlabSubtractionLedger(), stage: 'input', nodeId: null, work: zero() });
function check(s: State, value: boolean, code: XYAffinePrismFeatureDiagnosticCode, detail: string): asserts value {
  if (!value) throw new XYAffinePrismFeatureError(code, s.stage, s.nodeId, detail, { ...s.work });
}
function wrap<T>(s: State, action: () => T, code: XYAffinePrismFeatureDiagnosticCode = 'NATIVE'): T {
  try { return action(); } catch (cause) {
    if (cause instanceof XYAffinePrismFeatureError) throw cause;
    throw new XYAffinePrismFeatureError((cause instanceof ConvexPlanarSlabSubtractionError || cause instanceof ConvexPlanarSolidChamferError) && cause.code === 'BUDGET' ? 'BUDGET' : code, s.stage, s.nodeId, cause instanceof Error ? cause.message : 'Operation refused', { ...s.work }, cause);
  }
}
const reject = (s: State) => (code: 'INPUT' | 'IDENTITY' | 'REVISION' | 'PARAMETER', detail: string): never => { throw new XYAffinePrismFeatureError(code, s.stage, s.nodeId, detail, { ...s.work }); };
function fields(s: State, v: unknown, keys: string[]): Record<string, unknown> { return featureFields(v, keys, reject(s)); }
function id(s: State, v: unknown, max = 48): void { featureIdentity(v, max, reject(s)); }
function revision(s: State, v: unknown): void { featureRevision(v, reject(s)); }
function length(s: State, v: unknown): void { featureLength(v, reject(s)); }
function own<T>(s: State, v: T, result = false): T { return wrap(s, () => s.ledger.copy(v, result), 'INPUT'); }
function file(s: State, doc: Document): string {
  const text = signedJson(doc) + '\n'; check(s, text.length <= FILE_LIMIT && cadDocumentOwnUtf8Bytes(text, 'JSON') <= FILE_LIMIT, 'BUDGET', 'Authored file exceeds 262144 UTF16/UTF8 units'); return text;
}
function dependencies(n: Document['nodes'][number]): string[] {
  return n.kind === 'sketch' ? [] : n.kind === 'prism' ? [n.sketchNodeId] : n.kind === 'chamfer' ? [n.parent.subtractionNodeId] : [n.parentPrismId, n.toolPrismId];
}
function admit(s: State, input: Document): Document {
  const d = own(s, input); fields(s, d, ['format', 'version', 'id', 'revision', 'lengthUnit', 'nodes', 'parameters']);
  check(s, d.format === 'barocss-xy-affine-prism-feature-document' && d.version === 2 && d.lengthUnit === 'mm', 'VERSION', 'Exact version two serial-part millimetre document required'); id(s, d.id); revision(s, d.revision);
  check(s, Array.isArray(d.nodes) && d.nodes.length === 6, 'INPUT', 'Exactly six serial fixed-role nodes required');
  const kinds = ['sketch', 'sketch', 'prism', 'prism', 'subtraction', 'chamfer'];
  for (const [i, n] of d.nodes.entries()) {
    s.nodeId = n?.id ?? null; check(s, n !== undefined && n !== null && typeof n === 'object' && n.kind === kinds[i], 'DEPENDENCY', 'Fixed sketch/sketch/prism/prism/subtraction role order required'); id(s, n.id);
    if (n.kind === 'sketch') { fields(s, n, ['id', 'kind', 'sourceId', 'revision', 'document']); id(s, n.sourceId); revision(s, n.revision); fields(s, n.document, ['format', 'version', 'profile', 'id', 'lengthUnit', 'points', 'segments', 'referenceLines', 'constraints']); id(s, n.document.id); check(s, Array.isArray(n.document.constraints) && n.document.constraints.length <= 32 && Array.isArray(n.document.segments) && n.document.segments.length <= 8, 'BUDGET', 'Bounded sketch constraints and segments required'); }
    else if (n.kind === 'prism') {
      fields(s, n, ['id', 'kind', 'sketchNodeId', 'options']); id(s, n.sketchNodeId);
      fields(s, n.options, ['orderedSegmentIds', 'heightMM', 'capChart', 'solidId', 'resultIdPrefix', 'chartPolicy']); id(s, n.options.solidId); id(s, n.options.resultIdPrefix, 12); fields(s, n.options.chartPolicy, ['version', 'kind']); check(s, n.options.chartPolicy.version === 1 && n.options.chartPolicy.kind === 'coordinate-span', 'VERSION', 'Explicit coordinate-span version one chart policy required');
    } else if (n.kind === 'chamfer') {
      fields(s, n, ['id', 'kind', 'parent', 'distanceMM', 'reference', 'options']); fields(s, n.parent, ['kind', 'subtractionNodeId', 'componentRole', 'solidId']); id(s, n.parent.subtractionNodeId); id(s, n.parent.solidId); check(s, n.parent.kind === 'subtraction-component' && n.parent.componentRole === 'second', 'DEPENDENCY', 'Fixed second subtraction component parent required'); length(s, n.distanceMM); check(s, n.distanceMM > 0, 'PARAMETER', 'Positive chamfer distance required');
      fields(s, n.options, ['operationId', 'resultIdPrefix', 'retainedSolidId', 'removedSolidId']); id(s, n.options.operationId); id(s, n.options.resultIdPrefix, 10); id(s, n.options.retainedSolidId); id(s, n.options.removedSolidId);
      fields(s, n.reference, ['sourceId', 'sketchId', 'sourceRevision', 'segmentId', 'role', 'a', 'b']);
      id(s, n.reference.sourceId); id(s, n.reference.sketchId); id(s, n.reference.segmentId); revision(s, n.reference.sourceRevision); check(s, n.reference.role === 'top', 'REFERENCE', 'Only named segment top edges supported');
      for (const ref of [n.reference.a, n.reference.b]) { fields(s, ref, ['sourceId', 'faceId', 'surfaceId', 'loopId', 'useId', 'curveId', 'pcurveId']); for (const value of Object.values(ref)) id(s, value); }
      check(s, !same(n.reference.a, n.reference.b), 'REFERENCE', 'Two distinct complete references required');
    } else {
      fields(s, n, ['id', 'kind', 'parentPrismId', 'toolPrismId', 'operationId', 'first', 'second']); id(s, n.parentPrismId); id(s, n.toolPrismId); id(s, n.operationId);
      for (const role of ['first', 'second'] as const) { const c = n[role]; fields(s, c, ['reference', 'solidId', 'resultIdPrefix']); id(s, c.solidId); id(s, c.resultIdPrefix, 10); fields(s, c.reference, ['sourceId', 'sketchId', 'sourceRevision', 'segmentId']); id(s, c.reference.sourceId); id(s, c.reference.sketchId); id(s, c.reference.segmentId); revision(s, c.reference.sourceRevision); }
    }
  }
  const nodes = d.nodes as Document['nodes'][number][];
  const ids = nodes.map(n => n.id); check(s, new Set(ids).size === nodes.length && !ids.includes(d.id), 'IDENTITY', 'Distinct document and node identities required');
  // Bounded admission from the existing Boolean graph pattern, not a new general scheduler.
  const done = new Set<string>(), pending = new Set(ids);
  for (const n of nodes) for (const ref of dependencies(n)) { s.nodeId = n.id; check(s, ids.includes(ref), 'DEPENDENCY', 'Missing dependency: ' + ref); }
  while (pending.size) {
    const ready = nodes.find(n => pending.has(n.id) && dependencies(n).every(ref => done.has(ref)));
    check(s, ready !== undefined, 'DEPENDENCY', 'Cyclic dependencies refused'); done.add(ready.id); pending.delete(ready.id);
  }
  const [a, b, p, t, cut] = d.nodes; const detail = d.nodes[5];
  check(s, p.sketchNodeId === a.id && t.sketchNodeId === b.id && cut.parentPrismId === p.id && cut.toolPrismId === t.id, 'DEPENDENCY', 'Dependencies must select the exact fixed-role node and kind');
  check(s, a.sourceId !== b.sourceId && a.document.id !== b.document.id, 'IDENTITY', 'Distinct source/sketch contexts required');
  const native = [p.options.solidId, t.options.solidId, cut.operationId, cut.first.solidId, cut.second.solidId];
  check(s, new Set(native).size === native.length, 'IDENTITY', 'Distinct operation and Solid identities required');
  const prefixes = [p.options.resultIdPrefix, t.options.resultIdPrefix, cut.first.resultIdPrefix, cut.second.resultIdPrefix];
  check(s, new Set(prefixes).size === 4, 'IDENTITY', 'Distinct producer prefixes required');
  const contexts = [p, t].flatMap(n => [n.options.resultIdPrefix + '_b', n.options.resultIdPrefix + '_t', ...Array.from({ length: 8 }, (_, i) => n.options.resultIdPrefix + '_w_' + i)]).concat([cut.first, cut.second].flatMap(n => Array.from({ length: 12 }, (_, i) => n.resultIdPrefix + '_f' + i)));
  check(s, new Set(contexts).size === contexts.length, 'IDENTITY', 'Planned source namespaces collide');
  {
    if (detail) {
      check(s, detail.parent.subtractionNodeId === cut.id && detail.parent.solidId === cut.second.solidId, 'DEPENDENCY', 'Chamfer must depend on the exact second subtraction component');
      const ref = detail.reference; check(s, ref.sourceId === a.sourceId && ref.sketchId === a.document.id && ref.sourceRevision === a.revision && a.document.segments.some(segment => segment.id === ref.segmentId), 'REFERENCE', 'Original chamfer sketch/segment context must be current');
    }
    const generated = detail ? [detail.options.resultIdPrefix + '_ch_src', detail.options.resultIdPrefix + '_cap_n', detail.options.resultIdPrefix + '_cap_p'] : [];
    const identities = [d.id, ...ids, a.sourceId, b.sourceId, a.document.id, b.document.id, ...native, ...prefixes, ...contexts, ...generated, ...(detail ? [detail.options.operationId, detail.options.retainedSolidId, detail.options.removedSolidId, detail.options.resultIdPrefix] : [])];
    check(s, new Set(identities).size === identities.length, 'IDENTITY', 'Document, node, operation, output and planned source namespaces collide');
    const allPrefixes = [...prefixes, ...(detail ? [detail.options.resultIdPrefix] : [])]; check(s, new Set(allPrefixes).size === allPrefixes.length, 'IDENTITY', 'Producer prefixes collide');
  }
  for (const c of [cut.first, cut.second]) { s.nodeId = cut.id; check(s, c.reference.sourceId === b.sourceId && c.reference.sketchId === b.document.id && c.reference.sourceRevision === b.revision, 'REFERENCE', 'Selected source context or revision is stale'); check(s, b.document.segments.some(seg => seg.id === c.reference.segmentId), 'REFERENCE', 'Selected original segment is missing'); }
  check(s, cut.first.reference.segmentId !== cut.second.reference.segmentId, 'REFERENCE', 'Distinct selected segments required');
  check(s, Array.isArray(d.parameters) && d.parameters.length <= 16, 'BUDGET', 'At most sixteen literal parameters required');
  const parameterIds = new Set<string>(), bindings = new Set<string>(); let count = 0;
  for (const parameter of d.parameters) {
    fields(s, parameter, ['id', 'unit', 'valueMM', 'bindings']); id(s, parameter.id); length(s, parameter.valueMM);
    check(s, parameter.unit === 'mm' && !parameterIds.has(parameter.id) && !ids.includes(parameter.id) && parameter.id !== d.id, 'PARAMETER', 'Unique literal-mm parameter required'); parameterIds.add(parameter.id);
    check(s, Array.isArray(parameter.bindings) && parameter.bindings.length > 0 && parameter.bindings.length <= 32, 'BUDGET', 'One to 32 parameter bindings required');
    for (const binding of parameter.bindings) {
      check(s, ++count <= 32, 'BUDGET', 'At most 32 total edit bindings');
      check(s, binding !== null && typeof binding === 'object', 'INPUT', 'Exact own record required');
      if ('kind' in binding && binding.kind !== 'fixed-sketch-coordinate') {
        let key: string, actual: number;
        if (binding.kind === 'prism-height') { fields(s, binding, ['kind', 'prismNodeId']); const prism = [p, t].find(n => n.id === binding.prismNodeId); check(s, prism !== undefined, 'PARAMETER', 'Height binding must select a prism'); key = binding.prismNodeId + '/height'; actual = prism.options.heightMM; }
        else { fields(s, binding, ['kind', 'chamferNodeId']); check(s, binding.kind === 'chamfer-distance' && detail !== undefined && detail.id === binding.chamferNodeId, 'PARAMETER', 'Distance binding must select the optional chamfer'); key = binding.chamferNodeId + '/distance'; actual = detail.distanceMM; }
        check(s, !bindings.has(key) && Object.is(actual, parameter.valueMM) && parameter.valueMM > 0, 'PARAMETER', 'Unique dimension binding must match actual positive literal bits'); bindings.add(key); continue;
      }
      check(s, !('kind' in binding) || binding.kind === 'fixed-sketch-coordinate', 'PARAMETER', 'Coordinate binding required');
      fields(s, binding, ['kind', 'sketchNodeId', 'constraintId', 'axis']); check(s, 'kind' in binding && binding.kind === 'fixed-sketch-coordinate', 'PARAMETER', 'Version two coordinate bindings must be explicitly typed');
      const coordinate = binding as XYAffinePrismFeatureParameter['bindings'][number]; id(s, coordinate.constraintId);
      const sketch = [a, b].find(n => n.id === coordinate.sketchNodeId); s.nodeId = coordinate.sketchNodeId;
      check(s, sketch !== undefined && (coordinate.axis === 'x' || coordinate.axis === 'y'), 'PARAMETER', 'Binding must select a sketch coordinate');
      const matches = sketch.document.constraints.filter(c => c.id === coordinate.constraintId), constraint = matches[0];
      check(s, matches.length === 1 && constraint.kind === 'fixed' && Array.isArray(constraint.target) && constraint.target.length === 2, 'PARAMETER', 'Binding must select one original fixed constraint');
      const key = coordinate.sketchNodeId + '/' + coordinate.constraintId + '/' + coordinate.axis;
      check(s, !bindings.has(key) && Object.is(constraint.target[coordinate.axis === 'x' ? 0 : 1], parameter.valueMM), 'PARAMETER', 'Unique binding must match actual literal target bits'); bindings.add(key);
    }
  }
  s.nodeId = null; file(s, d); return d;
}
function add(s: State, work: Partial<Work>): void {
  for (const k of Object.keys(work) as (keyof Work)[]) s.work[k] = (s.work[k] ?? 0) + work[k]!;
  const limits = PHASE_LIMITS;
  for (const k of Object.keys(limits) as (keyof Work)[]) check(s, s.work[k]! <= limits[k]!, 'BUDGET', 'Phase work ceiling exceeded: ' + k);
}
function sketchWork(s: State, sketch: XYAffineSketchSuccess): void { add(s, { sourceCompilations: 1, rationalContexts: 1, rationalOperations: sketch.report.rationalWork.operations, gcdSteps: sketch.report.rationalWork.gcdSteps }); }
function prismWork(s: State, prism: XYAffineSketchPrismCoordinateSpanResult): void {
  const n = prism.report.childNativeWork, e = prism.report.exactWork;
  add(s, { sourceCompilations: n.sourceCompilationCount, faceCompilations: n.initialFaceConstructionCount + n.solidFaceReconstructionCount, bindingObservations: n.bindingObservationCount, totalD1: n.totalD1Count, exactAffineContexts: 2 * n.initialFaceConstructionCount + n.solidFaceReconstructionCount, rationalContexts: 2, rationalOperations: e.sketch.operations + e.solid.operations, gcdSteps: e.sketch.gcdSteps + e.solid.gcdSteps });
}
function slabWork(s: State, slab: ConvexPlanarSlabSubtractionResult): void {
  const n = slab.report.nativeWork, e = slab.report.exactWork;
  add(s, { sourceCompilations: n.sourceCompilations, faceCompilations: n.faceCompilations, bindingObservations: n.bindingObservations, totalD1: n.totalD1, exactAffineContexts: n.faceCompilations, rationalContexts: e.contextCount, rationalOperations: e.aggregateOperations, gcdSteps: e.aggregateGcdSteps });
}
function chamferWork(s: State, chamfer: ConvexPlanarSolidChamferResult): void {
  const n = chamfer.report.nativeWork, e = chamfer.report.exactWork;
  add(s, { sourceCompilations: n.totalSourceCompilations, faceCompilations: n.faceCompilations, bindingObservations: n.bindingObservations, totalD1: n.totalD1, exactAffineContexts: n.faceCompilations, rationalContexts: e.contextCount, rationalOperations: e.aggregateOperations, gcdSteps: e.aggregateGcdSteps });
}
type GraphUse = ConvexPlanarSolidGraph['edges'][number]['uses'][number];
const useReference = (u: GraphUse): ConvexPlanarChamferUseReference => ({ sourceId: u.sourceId, faceId: u.faceId, surfaceId: u.surfaceId, loopId: u.loopId, useId: u.use.id, curveId: u.use.curveId, pcurveId: u.use.pcurveId });
/** Resolve only fresh producer provenance, never positions, generated-ID guesses or array ordinals. */
function resolveComponent(s: State, document: Document, prism: XYAffineSketchPrismCoordinateSpanResult, subtraction: ConvexPlanarSlabSubtractionResult): { parent: ConvexPlanarSolidResult; resolution: XYAffinePrismChamferResolutionV2 } {
  const detail = document.nodes[5], selected = detail.reference, lineage = prism.lineage;
  check(s, lineage.sourceId === selected.sourceId && lineage.sketchId === selected.sketchId && lineage.sourceRevision === selected.sourceRevision, 'REFERENCE', 'Original source context differs from actual prism lineage');
  const segments = lineage.segments.filter(segment => segment.segmentId === selected.segmentId);
  check(s, segments.length === 1, 'REFERENCE', 'Exactly one original segment lineage required');
  const originalEdges = prism.solid.graph.edges.filter(edge => edge.id === segments[0].topEdgeId);
  check(s, originalEdges.length === 1 && originalEdges[0].uses.length === 2, 'REFERENCE', 'Named original segment top edge must have exactly two uses');
  const original = [selected.a, selected.b].map(ref => {
    const uses = originalEdges[0].uses.filter(u => same(ref, useReference(u)));
    check(s, uses.length === 1, 'REFERENCE', 'Persisted complete original use differs from named prism top edge'); return uses[0];
  });
  check(s, !same(selected.a, selected.b), 'REFERENCE', 'Distinct original uses required');
  const component = subtraction.second;
  check(s, component.role === 'second' && component.outcome.kind === 'solid', 'REFERENCE', 'Selected second component is empty or has wrong role');
  const parent = component.outcome.solid;
  check(s, parent.request.options.solidId === detail.parent.solidId, 'REFERENCE', 'Selected component Solid identity differs');
  const derived = original.map(u => {
    const candidates = component.lineage.faces.flatMap(face => {
      // Each output edge occurrence may carry both opposite origins. Its owning face
      // disambiguates the occurrence before matching the complete original per-face use.
      const owns = face.sources.some(source => source.operand === 'parent' && source.sourceId === u.sourceId && source.faceId === u.faceId && source.surfaceId === u.surfaceId && source.loopId === u.loopId);
      if (!owns) return [];
      return face.edges.flatMap(edge => edge.originalEdges.filter(origin => origin.operand === 'parent' && origin.sourceId === u.sourceId && origin.faceId === u.faceId && origin.surfaceId === u.surfaceId && origin.loopId === u.loopId && origin.edgeId === u.use.edgeId && origin.useId === u.use.id && origin.curveId === u.use.curveId && origin.pcurveId === u.use.pcurveId).map(origin => ({ face: face.output, useId: edge.useId, origin })));
    });
    check(s, candidates.length === 1, 'REFERENCE', 'Original use must have exactly one retained component occurrence');
    const candidate = candidates[0], uses = parent.graph.edges.flatMap(edge => edge.uses.filter(actual => actual.sourceId === candidate.face.sourceId && actual.faceId === candidate.face.faceId && actual.surfaceId === candidate.face.surfaceId && actual.loopId === candidate.face.loopId && actual.use.id === candidate.useId));
    check(s, uses.length === 1, 'REFERENCE', 'Derived occurrence must name exactly one actual component use');
    return { reference: useReference(uses[0]), origin: candidate.origin };
  });
  check(s, !same(derived[0].reference, derived[1].reference), 'REFERENCE', 'Derived opposite uses must be distinct');
  const edges = parent.graph.edges.filter(edge => edge.uses.length === 2 && derived.every(d => edge.uses.some(u => same(useReference(u), d.reference))));
  check(s, edges.length === 1, 'REFERENCE', 'Derived uses must belong to exactly one qualified opposite-paired component edge');
  return { parent, resolution: { parent: detail.parent, originalPrismNodeId: document.nodes[2].id, originalTopEdgeId: originalEdges[0].id, componentEdgeId: edges[0].id, a: derived[0], b: derived[1], policy: 'original-face-and-complete-use-lineage-to-one-opposite-pair', persistentNamingCertified: false } };
}
function evaluate(s: State, input: Document, previous?: Result): { result: Result; actions: Update['transaction']['report']['actions'] } {
  const document = admit(s, input), [a, b, p, t, cut] = document.nodes, actions: Update['transaction']['report']['actions'] = [];
  const sketches = [a, b].map((n, i) => {
    s.stage = 'sketch'; s.nodeId = n.id; const old = previous?.sketches[i], changed = !old || !same(n.document, old.document); actions.push({ nodeId: n.id, action: changed ? 'rebuilt' : 'retained' });
    if (!changed) return old!; add(s, { sketchBuilds: 1 }); const result = wrap(s, () => buildXYAffineSketch(n.document)); sketchWork(s, result); return result;
  }) as Result['sketches'];
  const prisms = [p, t].map((n, i) => {
    s.stage = 'prism'; s.nodeId = n.id; const source = i ? b : a, options = { ...n.options, sourceId: source.sourceId, sourceRevision: source.revision }, request = { sketch: sketches[i], options }, old = previous?.prisms[i], changed = !old || !same(request, old.request);
    actions.push({ nodeId: n.id, action: changed ? 'rebuilt' : 'retained' }); if (!changed) return old!;
    s.ledger.copy(request, true, true); add(s, { prismBuilds: 1 }); const result = wrap(s, () => buildXYAffineSketchPrism(request.sketch, options)); prismWork(s, result); return result;
  }) as Result['prisms'];
  s.nodeId = cut.id; s.stage = 'wall-reference';
  const walls = [cut.first, cut.second].map((component, i) => {
    const old = previous?.walls[i];
    if (old && same(prisms[1], previous!.prisms[1]) && same(component.reference, old.reference)) return old;
    add(s, { wallResolutions: 1 }); const result = wrap(s, () => resolveXYAffineSketchPrismWall(prisms[1], component.reference)); prismWork(s, prisms[1]);
    check(s, result.status === 'preserved' && result.targets.length === 1, 'REFERENCE', 'Original selected wall is stale, deleted or ambiguous'); return result;
  }) as Result['walls'];
  const component = (c: XYAffinePrismComponentRecipe, i: number) => ({ solidId: c.solidId, resultIdPrefix: c.resultIdPrefix, toolFace: { sourceId: walls[i].targets[0].sourceId, faceId: walls[i].targets[0].faceId } });
  const options: ConvexPlanarSlabSubtractionOptions = { operationId: cut.operationId, first: component(cut.first, 0), second: component(cut.second, 1) };
  const request = { parent: prisms[0].solid, tool: prisms[1].solid, options }, changed = !previous || !same(request, previous.subtraction.request);
  s.stage = 'subtraction'; actions.push({ nodeId: cut.id, action: changed ? 'rebuilt' : 'retained' });
  let subtraction = previous?.subtraction;
  if (changed) { s.ledger.copy(request, true, true); add(s, { subtractions: 1 }); subtraction = wrap(s, () => subtractConvexPlanarSlab(request.parent, request.tool, options)); slabWork(s, subtraction); }
  const detail = document.nodes[5]; s.stage = 'chamfer-reference'; s.nodeId = detail.id;
  const resolved = resolveComponent(s, document, prisms[0], subtraction!);
  const chamferResolution = resolved.resolution, parent = resolved.parent;
  const selection = { parentSolidId: detail.parent.solidId, a: chamferResolution.a.reference, b: chamferResolution.b.reference };
  const chamferRequest = { selection, distanceMM: detail.distanceMM, options: detail.options }, old = previous?.chamfer;
  const changedChamfer = !old || !same(parent, old.split.request.parent) || !same(chamferRequest, old.request);
  actions.push({ nodeId: detail.id, action: changedChamfer ? 'rebuilt' : 'retained' }); s.stage = 'chamfer';
  let chamfer: ConvexPlanarSolidChamferResult;
  if (changedChamfer) { s.ledger.copy({ parent, ...chamferRequest }, true, true); add(s, { chamfers: 1 }); chamfer = wrap(s, () => chamferConvexPlanarSolid(parent, selection, detail.distanceMM, detail.options)); chamferWork(s, chamfer); }
  else chamfer = old!;
  const cold: State = { ...s, work: zero() };
  for (const sketch of sketches) { add(cold, { sketchBuilds: 1 }); sketchWork(cold, sketch); }
  for (const prism of prisms) { add(cold, { prismBuilds: 1 }); prismWork(cold, prism); }
  for (let i = 0; i < walls.length; i++) { add(cold, { wallResolutions: 1 }); prismWork(cold, prisms[1]); }
  add(cold, { subtractions: 1 }); slabWork(cold, subtraction!);
  if (chamfer) { add(cold, { chamfers: 1 }); chamferWork(cold, chamfer); }
  const result: Result = { document, chamfer, chamferResolution, sketches, prisms, walls, subtraction: subtraction!, report: {
    schema: 'barocss-xy-affine-prism-feature-result', version: 2, nodeOrder: document.nodes.map(n => n!.id), dependencies: document.nodes.map(n => ({ nodeId: n!.id, dependsOn: dependencies(n!) })), coldWork: cold.work,
    componentRoles: (['first', 'second'] as const).map(role => ({ role, solidId: cut[role].solidId, status: subtraction![role].outcome.kind })), authority: 'authored-sketches-literal-mm-bindings-and-fixed-feature-recipes', workScope: 'complete-cold-orchestration-including-provider-and-wall-lookup-reconstruction', persistentTopologyNamingCertified: false, editorFileUICertified: false } };
  s.ledger.copy(result, true, true, true); return { result, actions };
}
function rebuild(s: State, input: Result): Result {
  s.stage = 'prior-validation'; const old = own(s, input, true); fields(s, old, ['document', 'sketches', 'prisms', 'walls', 'subtraction', 'report', 'chamfer', 'chamferResolution']);
  const expected = evaluate(s, old.document).result; s.stage = 'owned'; s.nodeId = null;
  check(s, same(old, expected), 'OWNED', 'Complete retained document, geometry, references, proofs or work differ from cold rebuild'); return expected;
}
function edits(s: State, input: XYAffinePrismFeatureEdits, doc: Document): XYAffinePrismFeatureEdits {
  const e = own(s, input); fields(s, e, ['expectedRevision', 'revision', 'parameterEdits']); revision(s, e.expectedRevision); revision(s, e.revision);
  check(s, e.expectedRevision === doc.revision && e.revision === doc.revision + 1, 'REVISION', 'Expected current revision and exact +1 required');
  check(s, Array.isArray(e.parameterEdits) && e.parameterEdits.length <= 16, 'BUDGET', 'At most sixteen existing parameter setters required'); const seen = new Set<string>();
  for (const setter of e.parameterEdits) { fields(s, setter, ['parameterId', 'valueMM']); id(s, setter.parameterId); length(s, setter.valueMM); check(s, !seen.has(setter.parameterId) && doc.parameters.some(p => p.id === setter.parameterId), 'PARAMETER', 'One setter per existing parameter required'); seen.add(setter.parameterId); }
  return e;
}
function apply(s: State, previous: Result, input: XYAffinePrismFeatureEdits, validation: Work): Update {
  s.stage = 'update'; s.nodeId = null; s.work = zero(); const e = edits(s, input, previous.document), document = own(s, previous.document), changed = new Set<string>(); let parameterChanged = false; document.revision = e.revision;
  for (const setter of e.parameterEdits) {
    const parameter = document.parameters.find(p => p.id === setter.parameterId)!;
    if (Object.is(parameter.valueMM, setter.valueMM)) continue; parameter.valueMM = setter.valueMM; parameterChanged = true;
    for (const binding of parameter.bindings) {
      if ('kind' in binding && binding.kind !== 'fixed-sketch-coordinate') {
        if (binding.kind === 'prism-height') { const node = document.nodes.find(n => n?.id === binding.prismNodeId) as XYAffinePrismNodeV2; node.options.heightMM = setter.valueMM; }
        else { const node = document.nodes.find(n => n?.id === binding.chamferNodeId) as XYAffinePrismChamferNodeV2; node.distanceMM = setter.valueMM; }
        continue;
      }
      const node = document.nodes.find(n => n?.id === binding.sketchNodeId) as XYAffinePrismSketchNode, constraint = node.document.constraints.find(c => c.id === binding.constraintId)!;
      check(s, constraint.kind === 'fixed', 'PARAMETER', 'Fixed constraint binding required'); constraint.target[binding.axis === 'x' ? 0 : 1] = setter.valueMM; changed.add(node.id);
    }
  }
  for (const n of document.nodes.slice(0, 2) as XYAffinePrismSketchNode[]) if (changed.has(n.id)) { n.revision++; revision(s, n.revision); }
  const tool = document.nodes[1]; for (const c of [document.nodes[4].first, document.nodes[4].second]) c.reference.sourceRevision = tool.revision;
  if (changed.has(document.nodes[0].id)) {
    // Only constraint targets can change in this transaction. Immutable segment and complete use pair
    // are still checked against the newly built prism before the candidate can commit.
    document.nodes[5].reference.sourceRevision = document.nodes[0].revision;
  }
  const { result, actions } = evaluate(s, document, previous);
  return { result, transaction: { request: { previousDocument: previous.document, edits: e }, report: { previousRevision: previous.document.revision, revision: document.revision, noOp: !parameterChanged, actions, validation, candidate: { ...s.work }, atomic: true, workScope: 'one-prior-cold-validation-separated-from-actual-selective-candidate-work' } } };
}
function evaluatePublic(s: State, document: Document): Result {
  return wrap(s, () => own(s, evaluate(s, document).result, true));
}
function updatePublic(s: State, previous: Result, input: XYAffinePrismFeatureEdits): Update {
  return wrap(s, () => { const request = own(s, { previous, edits: input }, true), accepted = rebuild(s, request.previous), validation = { ...s.work }; return own(s, apply(s, accepted, request.edits, validation), true); });
}
function validatePublic(s: State, input: Result): Result['report'] {
  return wrap(s, () => own(s, rebuild(s, input).report, true));
}
function replayPublic(s: State, input: Update): Update['transaction']['report'] {
  return wrap(s, () => { const old = own(s, input, true); fields(s, old, ['result', 'transaction']); fields(s, old.transaction, ['request', 'report']); fields(s, old.transaction.request, ['previousDocument', 'edits']);
    const previous = evaluate(s, old.transaction.request.previousDocument).result, validation = { ...s.work }, expected = apply(s, previous, old.transaction.request.edits, validation);
    s.stage = 'owned'; check(s, same(old, expected), 'OWNED', 'Whole transaction differs from authored prior replay'); return own(s, expected.transaction.report, true); });
}
function serializePublic(s: State, document: Document): string {
  return wrap(s, () => { const accepted = evaluate(s, document).result; s.stage = 'codec'; return file(s, accepted.document); }, 'CODEC');
}
function parsePublic(s: State, text: string): Result {
  s.stage = 'codec'; return wrap(s, () => { check(s, typeof text === 'string' && text.length <= FILE_LIMIT && cadDocumentOwnUtf8Bytes(text, 'JSON') <= FILE_LIMIT, 'CODEC', 'Bounded well-formed authored JSON required');
    const document = parseCadDocumentOwnJson(text) as Document; return own(s, evaluate(s, document).result, true); }, 'CODEC');
}
/** Explicit version-two entrypoints; no automatic migration or widened v0 return types. */
export function evaluateXYAffinePrismFeatureDocumentV2(document: XYAffinePrismFeatureDocumentV2): XYAffinePrismFeatureResultV2 {
  return evaluatePublic(state(), document) as XYAffinePrismFeatureResultV2;
}
export function updateXYAffinePrismFeatureDocumentV2(previous: XYAffinePrismFeatureResultV2, input: XYAffinePrismFeatureEdits): XYAffinePrismFeatureUpdateV2 {
  return updatePublic(state(), previous, input) as XYAffinePrismFeatureUpdateV2;
}
export function validateXYAffinePrismFeatureDocumentV2(input: XYAffinePrismFeatureResultV2): XYAffinePrismFeatureResultV2['report'] {
  return validatePublic(state(), input) as XYAffinePrismFeatureResultV2['report'];
}
export function validateXYAffinePrismFeatureDocumentUpdateV2(input: XYAffinePrismFeatureUpdateV2): XYAffinePrismFeatureUpdateV2['transaction']['report'] {
  return replayPublic(state(), input) as XYAffinePrismFeatureUpdateV2['transaction']['report'];
}
export function serializeXYAffinePrismFeatureDocumentV2(document: XYAffinePrismFeatureDocumentV2): string {
  return serializePublic(state(), document);
}
export function parseXYAffinePrismFeatureDocumentV2(text: string): XYAffinePrismFeatureResultV2 {
  return parsePublic(state(), text) as XYAffinePrismFeatureResultV2;
}
export const XYAffinePrismFeatureDocumentLimitsV2 = Object.freeze({ authoredBytes: FILE_LIMIT, phaseWork: Object.freeze(PHASE_LIMITS), updateWork: Object.freeze(Object.fromEntries(Object.entries(PHASE_LIMITS).map(([k, v]) => [k, 2 * v])) as unknown as XYAffinePrismFeatureWorkV2), snapshot: SLAB_LIMITS });

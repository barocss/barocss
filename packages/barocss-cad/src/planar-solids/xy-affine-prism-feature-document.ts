import { featureFields, featureIdentity, featureRevision, featureLength, signedJson } from '../xy-affine-prism-feature-document-internal.js';
import { chamferConvexPlanarSolid, ConvexPlanarSolidChamferError } from '../convex-planar-solid-chamfer.js';
import type { ConvexPlanarChamferUseReference, ConvexPlanarSolidChamferResult, ConvexPlanarSolidChamferOptions } from '../convex-planar-solid-chamfer.js';
import { buildXYAffineSketch } from '../xy-affine-sketch.js';
import type { XYAffineSketchDocumentV0, XYAffineSketchSuccess } from '../xy-affine-sketch.js';
import { buildXYAffineSketchPrism, resolveXYAffineSketchPrismWall } from '../xy-affine-sketch-prism.js';
import type { XYAffineSketchPrismOptions, XYAffineSketchPrismResult, XYAffineSketchPrismWallReference, XYAffineSketchPrismWallResolution } from '../xy-affine-sketch-prism.js';
import { subtractConvexPlanarSlab, ConvexPlanarSlabSubtractionError } from '../convex-planar-slab-subtraction.js';
import type { ConvexPlanarSlabSubtractionOptions, ConvexPlanarSlabSubtractionResult } from '../convex-planar-slab-subtraction.js';
import { SlabSubtractionLedger, same, SLAB_LIMITS } from './convex-planar-slab-subtraction-internal.js';
import { parseCadDocumentOwnJson, cadDocumentOwnUtf8Bytes } from '../cad-document.js';
import { KernelError } from '../core/barocss-error.js';

export interface XYAffinePrismSketchNode { id: string; kind: 'sketch'; sourceId: string; revision: number; document: XYAffineSketchDocumentV0 }
export interface XYAffinePrismNode { id: string; kind: 'prism'; sketchNodeId: string; options: Omit<XYAffineSketchPrismOptions, 'sourceId' | 'sourceRevision'> }
export interface XYAffinePrismComponentRecipe { reference: XYAffineSketchPrismWallReference; solidId: string; resultIdPrefix: string }
export interface XYAffinePrismSubtractionNode { id: string; kind: 'subtraction'; parentPrismId: string; toolPrismId: string; operationId: string; first: XYAffinePrismComponentRecipe; second: XYAffinePrismComponentRecipe }
export interface XYAffinePrismFeatureParameter { id: string; unit: 'mm'; valueMM: number; bindings: { sketchNodeId: string; constraintId: string; axis: 'x' | 'y' }[] }
export interface XYAffinePrismFeatureDocumentV0 {
  format: 'barocss-xy-affine-prism-feature-document'; version: 0; id: string; revision: number; lengthUnit: 'mm';
  nodes: [XYAffinePrismSketchNode, XYAffinePrismSketchNode, XYAffinePrismNode, XYAffinePrismNode, XYAffinePrismSubtractionNode];
  parameters: XYAffinePrismFeatureParameter[];
}
export interface XYAffinePrismFeatureEdits { expectedRevision: number; revision: number; parameterEdits: { parameterId: string; valueMM: number }[] }
export interface XYAffinePrismFeatureWork {
  sketchBuilds: number; prismBuilds: number; wallResolutions: number; subtractions: number;
  sourceCompilations: number; faceCompilations: number; bindingObservations: number; totalD1: number;
  rationalContexts: number; rationalOperations: number; gcdSteps: number;
}
export interface XYAffinePrismFeatureResult {
  document: XYAffinePrismFeatureDocumentV0; sketches: [XYAffineSketchSuccess, XYAffineSketchSuccess];
  prisms: [XYAffineSketchPrismResult, XYAffineSketchPrismResult];
  walls: [XYAffineSketchPrismWallResolution, XYAffineSketchPrismWallResolution]; subtraction: ConvexPlanarSlabSubtractionResult;
  report: { schema: 'barocss-xy-affine-prism-feature-result'; version: 0; nodeOrder: string[];
    dependencies: { nodeId: string; dependsOn: string[] }[]; coldWork: XYAffinePrismFeatureWork;
    componentRoles: { role: 'first' | 'second'; solidId: string; status: 'solid' | 'empty' }[];
    authority: 'authored-sketches-literal-mm-bindings-and-fixed-feature-recipes';
    workScope: 'complete-cold-orchestration-including-provider-and-wall-lookup-reconstruction';
    persistentTopologyNamingCertified: false; editorFileUICertified: false };
}
export interface XYAffinePrismFeatureUpdate {
  result: XYAffinePrismFeatureResult;
  transaction: { request: { previousDocument: XYAffinePrismFeatureDocumentV0; edits: XYAffinePrismFeatureEdits };
    report: { previousRevision: number; revision: number; noOp: boolean;
      actions: { nodeId: string; action: 'rebuilt' | 'retained' }[];
      validation: XYAffinePrismFeatureWork; candidate: XYAffinePrismFeatureWork;
      atomic: true; workScope: 'one-prior-cold-validation-separated-from-actual-selective-candidate-work' } };
}
/** Version one adds a sibling detail feature, never a chamfered subtraction graph. */
export interface XYAffinePrismChamferNode {
  id: string; kind: 'chamfer'; parentPrismId: string; distanceMM: number;
  reference: XYAffineSketchPrismWallReference & { role: 'top'; a: ConvexPlanarChamferUseReference; b: ConvexPlanarChamferUseReference };
  options: ConvexPlanarSolidChamferOptions;
}
export type XYAffinePrismFeatureBindingV1 =
  | ({ kind: 'fixed-sketch-coordinate' } & XYAffinePrismFeatureParameter['bindings'][number])
  | { kind: 'prism-height'; prismNodeId: string }
  | { kind: 'chamfer-distance'; chamferNodeId: string };
export interface XYAffinePrismFeatureParameterV1 { id: string; unit: 'mm'; valueMM: number; bindings: XYAffinePrismFeatureBindingV1[] }
export interface XYAffinePrismFeatureDocumentV1 extends Omit<XYAffinePrismFeatureDocumentV0, 'version' | 'nodes' | 'parameters'> {
  version: 1; nodes: [...XYAffinePrismFeatureDocumentV0['nodes'], XYAffinePrismChamferNode?]; parameters: XYAffinePrismFeatureParameterV1[];
}
export interface XYAffinePrismFeatureWorkV1 extends XYAffinePrismFeatureWork { chamfers: number }
export interface XYAffinePrismFeatureResultV1 extends Omit<XYAffinePrismFeatureResult, 'document' | 'report'> {
  document: XYAffinePrismFeatureDocumentV1; chamfer: ConvexPlanarSolidChamferResult | null;
  report: Omit<XYAffinePrismFeatureResult['report'], 'version' | 'coldWork'> & { version: 1; coldWork: XYAffinePrismFeatureWorkV1 };
}
export interface XYAffinePrismFeatureUpdateV1 {
  result: XYAffinePrismFeatureResultV1;
  transaction: { request: { previousDocument: XYAffinePrismFeatureDocumentV1; edits: XYAffinePrismFeatureEdits };
    report: Omit<XYAffinePrismFeatureUpdate['transaction']['report'], 'validation' | 'candidate'> & { validation: XYAffinePrismFeatureWorkV1; candidate: XYAffinePrismFeatureWorkV1 } };
}
type Document = XYAffinePrismFeatureDocumentV0 | XYAffinePrismFeatureDocumentV1;
type Work = XYAffinePrismFeatureWork & { chamfers?: number };
type Result = Omit<XYAffinePrismFeatureResult, 'document' | 'report'> & { document: Document; chamfer?: ConvexPlanarSolidChamferResult | null; report: Omit<XYAffinePrismFeatureResult['report'], 'version' | 'coldWork'> & { version: 0 | 1; coldWork: Work } };
type Update = { result: Result; transaction: { request: { previousDocument: Document; edits: XYAffinePrismFeatureEdits }; report: Omit<XYAffinePrismFeatureUpdate['transaction']['report'], 'validation' | 'candidate'> & { validation: Work; candidate: Work } } };
export type XYAffinePrismFeatureDiagnosticCode = 'INPUT' | 'VERSION' | 'IDENTITY' | 'DEPENDENCY' | 'REVISION' | 'PARAMETER' | 'REFERENCE' | 'NATIVE' | 'OWNED' | 'CODEC' | 'BUDGET';
export class XYAffinePrismFeatureError extends KernelError {
  constructor(readonly code: XYAffinePrismFeatureDiagnosticCode, readonly stage: string, readonly nodeId: string | null,
    detail: string, readonly attempted: XYAffinePrismFeatureWork, cause?: unknown) {
    super(('XY affine prism feature document: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'XYAffinePrismFeatureError';
  }
}
const FILE_LIMIT = 262144;
const PHASE_LIMITS = { sketchBuilds: 2, prismBuilds: 2, wallResolutions: 2, subtractions: 1,
  sourceCompilations: 158, faceCompilations: 152, bindingObservations: 2304, totalD1: 6912,
  rationalContexts: 15, rationalOperations: 3000000, gcdSteps: 3000000 };
const PHASE_LIMITS_V1 = { ...PHASE_LIMITS, chamfers: 1, sourceCompilations: 204, faceCompilations: 197, bindingObservations: 2970, totalD1: 8910, rationalContexts: 20, rationalOperations: 4000000, gcdSteps: 4000000 };
const zero = (version: 0 | 1 = 0): Work => Object.fromEntries(Object.keys(version ? PHASE_LIMITS_V1 : PHASE_LIMITS).map(k => [k, 0])) as unknown as Work;
interface State { ledger: SlabSubtractionLedger; stage: string; nodeId: string | null; work: Work; version: 0 | 1 }
const state = (version: 0 | 1 = 0): State => ({ ledger: new SlabSubtractionLedger(), stage: 'input', nodeId: null, work: zero(version), version });
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
function dependencies(n: NonNullable<XYAffinePrismFeatureDocumentV1['nodes'][number]>): string[] {
  return n.kind === 'sketch' ? [] : n.kind === 'prism' ? [n.sketchNodeId] : n.kind === 'chamfer' ? [n.parentPrismId] : [n.parentPrismId, n.toolPrismId];
}
function admit(s: State, input: Document): Document {
  const d = own(s, input); fields(s, d, ['format', 'version', 'id', 'revision', 'lengthUnit', 'nodes', 'parameters']);
  check(s, d.format === 'barocss-xy-affine-prism-feature-document' && d.version === s.version && d.lengthUnit === 'mm', 'VERSION', s.version === 0 ? 'Exact version zero millimetre document required' : 'Exact version one millimetre document required'); id(s, d.id); revision(s, d.revision);
  check(s, Array.isArray(d.nodes) && (d.nodes.length === 5 || s.version === 1 && d.nodes.length === 6), 'INPUT', s.version === 0 ? 'Exactly five fixed-role nodes required' : 'Five fixed-role nodes and optional chamfer required');
  const kinds = ['sketch', 'sketch', 'prism', 'prism', 'subtraction', 'chamfer'];
  for (const [i, n] of d.nodes.entries()) {
    s.nodeId = n?.id ?? null; check(s, n !== undefined && n !== null && typeof n === 'object' && n.kind === kinds[i], 'DEPENDENCY', 'Fixed sketch/sketch/prism/prism/subtraction role order required'); id(s, n.id);
    if (n.kind === 'sketch') { fields(s, n, ['id', 'kind', 'sourceId', 'revision', 'document']); id(s, n.sourceId); revision(s, n.revision); fields(s, n.document, ['format', 'version', 'profile', 'id', 'lengthUnit', 'points', 'segments', 'referenceLines', 'constraints']); id(s, n.document.id); check(s, Array.isArray(n.document.constraints) && n.document.constraints.length <= 32 && Array.isArray(n.document.segments) && n.document.segments.length <= 8, 'BUDGET', 'Bounded sketch constraints and segments required'); }
    else if (n.kind === 'prism') {
      fields(s, n, ['id', 'kind', 'sketchNodeId', 'options']); id(s, n.sketchNodeId);
      fields(s, n.options, ['orderedSegmentIds', 'heightMM', 'capChart', 'solidId', 'resultIdPrefix']); id(s, n.options.solidId); id(s, n.options.resultIdPrefix, 12);
    } else if (n.kind === 'chamfer') {
      fields(s, n, ['id', 'kind', 'parentPrismId', 'distanceMM', 'reference', 'options']); id(s, n.parentPrismId); length(s, n.distanceMM); check(s, n.distanceMM > 0, 'PARAMETER', 'Positive chamfer distance required');
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
  const nodes = d.nodes as NonNullable<XYAffinePrismFeatureDocumentV1['nodes'][number]>[];
  const ids = nodes.map(n => n.id); check(s, new Set(ids).size === nodes.length && !ids.includes(d.id), 'IDENTITY', 'Distinct document and node identities required');
  // Bounded admission from the existing Boolean graph pattern, not a new general scheduler.
  const done = new Set<string>(), pending = new Set(ids);
  for (const n of nodes) for (const ref of dependencies(n)) { s.nodeId = n.id; check(s, ids.includes(ref), 'DEPENDENCY', 'Missing dependency: ' + ref); }
  while (pending.size) {
    const ready = nodes.find(n => pending.has(n.id) && dependencies(n).every(ref => done.has(ref)));
    check(s, ready !== undefined, 'DEPENDENCY', 'Cyclic dependencies refused'); done.add(ready.id); pending.delete(ready.id);
  }
  const [a, b, p, t, cut] = d.nodes; const detail = d.version === 1 ? d.nodes[5] : undefined;
  check(s, p.sketchNodeId === a.id && t.sketchNodeId === b.id && cut.parentPrismId === p.id && cut.toolPrismId === t.id, 'DEPENDENCY', 'Dependencies must select the exact fixed-role node and kind');
  check(s, a.sourceId !== b.sourceId && a.document.id !== b.document.id, 'IDENTITY', 'Distinct source/sketch contexts required');
  const native = [p.options.solidId, t.options.solidId, cut.operationId, cut.first.solidId, cut.second.solidId];
  check(s, new Set(native).size === native.length, 'IDENTITY', 'Distinct operation and Solid identities required');
  const prefixes = [p.options.resultIdPrefix, t.options.resultIdPrefix, cut.first.resultIdPrefix, cut.second.resultIdPrefix];
  check(s, new Set(prefixes).size === 4, 'IDENTITY', 'Distinct producer prefixes required');
  const contexts = [p, t].flatMap(n => [n.options.resultIdPrefix + '_b', n.options.resultIdPrefix + '_t', ...Array.from({ length: 8 }, (_, i) => n.options.resultIdPrefix + '_w_' + i)]).concat([cut.first, cut.second].flatMap(n => Array.from({ length: 12 }, (_, i) => n.resultIdPrefix + '_f' + i)));
  check(s, new Set(contexts).size === contexts.length, 'IDENTITY', 'Planned source namespaces collide');
  if (s.version === 1) {
    if (detail) {
      check(s, detail.parentPrismId === p.id, 'DEPENDENCY', 'Chamfer depends only on the first prism');
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
      if (s.version === 0) fields(s, binding, ['sketchNodeId', 'constraintId', 'axis']);
      else check(s, binding !== null && typeof binding === 'object', 'INPUT', 'Exact own record required');
      if (s.version === 1 && 'kind' in binding && binding.kind !== 'fixed-sketch-coordinate') {
        check(s, s.version === 1, 'PARAMETER', 'Typed dimensions require version one');
        let key: string, actual: number;
        if (binding.kind === 'prism-height') { fields(s, binding, ['kind', 'prismNodeId']); const prism = [p, t].find(n => n.id === binding.prismNodeId); check(s, prism !== undefined, 'PARAMETER', 'Height binding must select a prism'); key = binding.prismNodeId + '/height'; actual = prism.options.heightMM; }
        else { fields(s, binding, ['kind', 'chamferNodeId']); check(s, binding.kind === 'chamfer-distance' && detail !== undefined && detail.id === binding.chamferNodeId, 'PARAMETER', 'Distance binding must select the optional chamfer'); key = binding.chamferNodeId + '/distance'; actual = detail.distanceMM; }
        check(s, !bindings.has(key) && Object.is(actual, parameter.valueMM) && parameter.valueMM > 0, 'PARAMETER', 'Unique dimension binding must match actual positive literal bits'); bindings.add(key); continue;
      }
      check(s, !('kind' in binding) || binding.kind === 'fixed-sketch-coordinate', 'PARAMETER', 'Coordinate binding required');
      fields(s, binding, s.version === 1 ? ['kind', 'sketchNodeId', 'constraintId', 'axis'] : ['sketchNodeId', 'constraintId', 'axis']); check(s, s.version === 0 || 'kind' in binding && binding.kind === 'fixed-sketch-coordinate', 'PARAMETER', 'Version one coordinate bindings must be explicitly typed');
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
  const limits: Work = s.version ? PHASE_LIMITS_V1 : PHASE_LIMITS;
  for (const k of Object.keys(limits) as (keyof Work)[]) check(s, s.work[k]! <= limits[k]!, 'BUDGET', 'Phase work ceiling exceeded: ' + k);
}
function sketchWork(s: State, sketch: XYAffineSketchSuccess): void { add(s, { sourceCompilations: 1, rationalContexts: 1, rationalOperations: sketch.report.rationalWork.operations, gcdSteps: sketch.report.rationalWork.gcdSteps }); }
function prismWork(s: State, prism: XYAffineSketchPrismResult): void {
  const n = prism.report.childNativeWork, e = prism.report.exactWork;
  add(s, { sourceCompilations: n.sourceCompilationCount, faceCompilations: n.initialFaceConstructionCount + n.solidFaceReconstructionCount, bindingObservations: n.bindingObservationCount, totalD1: n.totalD1Count, rationalContexts: 2, rationalOperations: e.sketch.operations + e.solid.operations, gcdSteps: e.sketch.gcdSteps + e.solid.gcdSteps });
}
function slabWork(s: State, slab: ConvexPlanarSlabSubtractionResult): void {
  const n = slab.report.nativeWork, e = slab.report.exactWork;
  add(s, { sourceCompilations: n.sourceCompilations, faceCompilations: n.faceCompilations, bindingObservations: n.bindingObservations, totalD1: n.totalD1, rationalContexts: e.contextCount, rationalOperations: e.aggregateOperations, gcdSteps: e.aggregateGcdSteps });
}
function chamferWork(s: State, chamfer: ConvexPlanarSolidChamferResult): void {
  const n = chamfer.report.nativeWork, e = chamfer.report.exactWork;
  add(s, { sourceCompilations: n.totalSourceCompilations, faceCompilations: n.faceCompilations, bindingObservations: n.bindingObservations, totalD1: n.totalD1, rationalContexts: e.contextCount, rationalOperations: e.aggregateOperations, gcdSteps: e.aggregateGcdSteps });
}
function evaluate(s: State, input: Document, previous?: Result): { result: Result; actions: XYAffinePrismFeatureUpdate['transaction']['report']['actions'] } {
  const document = admit(s, input), [a, b, p, t, cut] = document.nodes, actions: XYAffinePrismFeatureUpdate['transaction']['report']['actions'] = [];
  const sketches = [a, b].map((n, i) => {
    s.stage = 'sketch'; s.nodeId = n.id; const old = previous?.sketches[i], changed = !old || !same(n.document, old.document); actions.push({ nodeId: n.id, action: changed ? 'rebuilt' : 'retained' });
    if (!changed) return old!; add(s, { sketchBuilds: 1 }); const result = wrap(s, () => buildXYAffineSketch(n.document)); sketchWork(s, result); return result;
  }) as XYAffinePrismFeatureResult['sketches'];
  const prisms = [p, t].map((n, i) => {
    s.stage = 'prism'; s.nodeId = n.id; const source = i ? b : a, options = { ...n.options, sourceId: source.sourceId, sourceRevision: source.revision }, request = { sketch: sketches[i], options }, old = previous?.prisms[i], changed = !old || !same(request, old.request);
    actions.push({ nodeId: n.id, action: changed ? 'rebuilt' : 'retained' }); if (!changed) return old!;
    s.ledger.copy(request, true, true); add(s, { prismBuilds: 1 }); const result = wrap(s, () => buildXYAffineSketchPrism(request.sketch, options)); prismWork(s, result); return result;
  }) as XYAffinePrismFeatureResult['prisms'];
  s.nodeId = cut.id; s.stage = 'wall-reference';
  const walls = [cut.first, cut.second].map((component, i) => {
    const old = previous?.walls[i];
    if (old && same(prisms[1], previous!.prisms[1]) && same(component.reference, old.reference)) return old;
    add(s, { wallResolutions: 1 }); const result = wrap(s, () => resolveXYAffineSketchPrismWall(prisms[1], component.reference)); prismWork(s, prisms[1]);
    check(s, result.status === 'preserved' && result.targets.length === 1, 'REFERENCE', 'Original selected wall is stale, deleted or ambiguous'); return result;
  }) as XYAffinePrismFeatureResult['walls'];
  const component = (c: XYAffinePrismComponentRecipe, i: number) => ({ solidId: c.solidId, resultIdPrefix: c.resultIdPrefix, toolFace: { sourceId: walls[i].targets[0].sourceId, faceId: walls[i].targets[0].faceId } });
  const options: ConvexPlanarSlabSubtractionOptions = { operationId: cut.operationId, first: component(cut.first, 0), second: component(cut.second, 1) };
  const request = { parent: prisms[0].solid, tool: prisms[1].solid, options }, changed = !previous || !same(request, previous.subtraction.request);
  s.stage = 'subtraction'; actions.push({ nodeId: cut.id, action: changed ? 'rebuilt' : 'retained' });
  let subtraction = previous?.subtraction;
  if (changed) { s.ledger.copy(request, true, true); add(s, { subtractions: 1 }); subtraction = wrap(s, () => subtractConvexPlanarSlab(request.parent, request.tool, options)); slabWork(s, subtraction); }
  const detail = document.version === 1 ? document.nodes[5] : undefined;
  let chamfer: ConvexPlanarSolidChamferResult | null = null;
  if (detail) {
    s.stage = 'chamfer-reference'; s.nodeId = detail.id;
    const selected = detail.reference, prism = prisms[0], lineage = prism.lineage;
    check(s, lineage.sourceId === selected.sourceId && lineage.sketchId === selected.sketchId && lineage.sourceRevision === selected.sourceRevision, 'REFERENCE', 'Chamfer source context differs from actual parent lineage');
    const segments = lineage.segments.filter(segment => segment.segmentId === selected.segmentId);
    check(s, segments.length === 1, 'REFERENCE', 'Exactly one original segment lineage required');
    const edges = prism.solid.graph.edges.filter(edge => edge.id === segments[0].topEdgeId);
    check(s, edges.length === 1, 'REFERENCE', 'Named segment top edge missing from actual graph');
    const refs = edges[0].uses.map(u => ({ sourceId: u.sourceId, faceId: u.faceId, surfaceId: u.surfaceId, loopId: u.loopId, useId: u.use.id, curveId: u.use.curveId, pcurveId: u.use.pcurveId }));
    check(s, refs.length === 2 && [selected.a, selected.b].every(ref => refs.some(actual => same(ref, actual))), 'REFERENCE', 'Persisted complete source/use pair differs from named top edge');
    const selection = { parentSolidId: prism.solid.request.options.solidId, a: selected.a, b: selected.b }, request = { selection, distanceMM: detail.distanceMM, options: detail.options };
    const old = previous?.chamfer, rebuild = !old || !same(prism.solid, previous!.prisms[0].solid) || !same(request, old.request);
    actions.push({ nodeId: detail.id, action: rebuild ? 'rebuilt' : 'retained' }); s.stage = 'chamfer';
    if (rebuild) { s.ledger.copy({ parent: prism.solid, ...request }, true, true); add(s, { chamfers: 1 }); chamfer = wrap(s, () => chamferConvexPlanarSolid(prism.solid, selection, detail.distanceMM, detail.options)); chamferWork(s, chamfer); }
    else chamfer = old!;
  }
  const cold: State = { ...s, work: zero(s.version) };
  for (const sketch of sketches) { add(cold, { sketchBuilds: 1 }); sketchWork(cold, sketch); }
  for (const prism of prisms) { add(cold, { prismBuilds: 1 }); prismWork(cold, prism); }
  for (let i = 0; i < walls.length; i++) { add(cold, { wallResolutions: 1 }); prismWork(cold, prisms[1]); }
  add(cold, { subtractions: 1 }); slabWork(cold, subtraction!);
  if (chamfer) { add(cold, { chamfers: 1 }); chamferWork(cold, chamfer); }
  const result: Result = { document, ...(s.version === 1 ? { chamfer } : {}), sketches, prisms, walls, subtraction: subtraction!, report: {
    schema: 'barocss-xy-affine-prism-feature-result', version: s.version, nodeOrder: document.nodes.map(n => n!.id), dependencies: document.nodes.map(n => ({ nodeId: n!.id, dependsOn: dependencies(n!) })), coldWork: cold.work,
    componentRoles: (['first', 'second'] as const).map(role => ({ role, solidId: cut[role].solidId, status: subtraction![role].outcome.kind })), authority: 'authored-sketches-literal-mm-bindings-and-fixed-feature-recipes', workScope: 'complete-cold-orchestration-including-provider-and-wall-lookup-reconstruction', persistentTopologyNamingCertified: false, editorFileUICertified: false } };
  s.ledger.copy(result, true, true, true); return { result, actions };
}
function rebuild(s: State, input: Result): Result {
  s.stage = 'prior-validation'; const old = own(s, input, true); fields(s, old, ['document', 'sketches', 'prisms', 'walls', 'subtraction', 'report', ...(s.version === 1 ? ['chamfer'] : [])]);
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
  s.stage = 'update'; s.nodeId = null; s.work = zero(s.version); const e = edits(s, input, previous.document), document = own(s, previous.document), changed = new Set<string>(); let parameterChanged = false; document.revision = e.revision;
  for (const setter of e.parameterEdits) {
    const parameter = document.parameters.find(p => p.id === setter.parameterId)!;
    if (Object.is(parameter.valueMM, setter.valueMM)) continue; parameter.valueMM = setter.valueMM; parameterChanged = true;
    for (const binding of parameter.bindings) {
      if ('kind' in binding && binding.kind !== 'fixed-sketch-coordinate') {
        if (binding.kind === 'prism-height') { const node = document.nodes.find(n => n?.id === binding.prismNodeId) as XYAffinePrismNode; node.options.heightMM = setter.valueMM; }
        else { const node = document.nodes.find(n => n?.id === binding.chamferNodeId) as XYAffinePrismChamferNode; node.distanceMM = setter.valueMM; }
        continue;
      }
      const node = document.nodes.find(n => n?.id === binding.sketchNodeId) as XYAffinePrismSketchNode, constraint = node.document.constraints.find(c => c.id === binding.constraintId)!;
      check(s, constraint.kind === 'fixed', 'PARAMETER', 'Fixed constraint binding required'); constraint.target[binding.axis === 'x' ? 0 : 1] = setter.valueMM; changed.add(node.id);
    }
  }
  for (const n of document.nodes.slice(0, 2) as XYAffinePrismSketchNode[]) if (changed.has(n.id)) { n.revision++; revision(s, n.revision); }
  const tool = document.nodes[1]; for (const c of [document.nodes[4].first, document.nodes[4].second]) c.reference.sourceRevision = tool.revision;
  if (document.version === 1 && document.nodes[5] && changed.has(document.nodes[0].id)) {
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
/** Exactly the fixed authored sketch/prism/subtraction composition; no general graph scheduling. */
export function evaluateXYAffinePrismFeatureDocument(document: XYAffinePrismFeatureDocumentV0): XYAffinePrismFeatureResult {
  return evaluatePublic(state(), document) as XYAffinePrismFeatureResult;
}
/** Mandatory complete prior validation, then actual request-equality selective candidate work. */
export function updateXYAffinePrismFeatureDocument(previous: XYAffinePrismFeatureResult, input: XYAffinePrismFeatureEdits): XYAffinePrismFeatureUpdate {
  return updatePublic(state(), previous, input) as XYAffinePrismFeatureUpdate;
}
export function validateXYAffinePrismFeatureDocument(input: XYAffinePrismFeatureResult): XYAffinePrismFeatureResult['report'] {
  return validatePublic(state(), input) as XYAffinePrismFeatureResult['report'];
}
export function validateXYAffinePrismFeatureDocumentUpdate(input: XYAffinePrismFeatureUpdate): XYAffinePrismFeatureUpdate['transaction']['report'] {
  return replayPublic(state(), input) as XYAffinePrismFeatureUpdate['transaction']['report'];
}
/** Admit through real producers; persist only authored state with signed zero and one newline. */
export function serializeXYAffinePrismFeatureDocument(document: XYAffinePrismFeatureDocumentV0): string {
  return serializePublic(state(), document);
}
/** Strict authored JSON grammar, followed by fresh native reconstruction. */
export function parseXYAffinePrismFeatureDocument(text: string): XYAffinePrismFeatureResult {
  return parsePublic(state(), text) as XYAffinePrismFeatureResult;
}
// Child snapshot ledgers remain unchanged; this whole public call uses one cumulative ledger.
export const XYAffinePrismFeatureDocumentLimits = Object.freeze({ authoredBytes: FILE_LIMIT, phaseWork: Object.freeze(PHASE_LIMITS), updateWork: Object.freeze(Object.fromEntries(Object.entries(PHASE_LIMITS).map(([k, v]) => [k, 2 * v])) as unknown as XYAffinePrismFeatureWork), snapshot: SLAB_LIMITS });

/** Explicit version-one entrypoints; no automatic migration or widened v0 return types. */
export function evaluateXYAffinePrismFeatureDocumentV1(document: XYAffinePrismFeatureDocumentV1): XYAffinePrismFeatureResultV1 {
  return evaluatePublic(state(1), document) as XYAffinePrismFeatureResultV1;
}
export function updateXYAffinePrismFeatureDocumentV1(previous: XYAffinePrismFeatureResultV1, input: XYAffinePrismFeatureEdits): XYAffinePrismFeatureUpdateV1 {
  return updatePublic(state(1), previous, input) as XYAffinePrismFeatureUpdateV1;
}
export function validateXYAffinePrismFeatureDocumentV1(input: XYAffinePrismFeatureResultV1): XYAffinePrismFeatureResultV1['report'] {
  return validatePublic(state(1), input) as XYAffinePrismFeatureResultV1['report'];
}
export function validateXYAffinePrismFeatureDocumentUpdateV1(input: XYAffinePrismFeatureUpdateV1): XYAffinePrismFeatureUpdateV1['transaction']['report'] {
  return replayPublic(state(1), input) as XYAffinePrismFeatureUpdateV1['transaction']['report'];
}
export function serializeXYAffinePrismFeatureDocumentV1(document: XYAffinePrismFeatureDocumentV1): string {
  return serializePublic(state(1), document);
}
export function parseXYAffinePrismFeatureDocumentV1(text: string): XYAffinePrismFeatureResultV1 {
  return parsePublic(state(1), text) as XYAffinePrismFeatureResultV1;
}
export const XYAffinePrismFeatureDocumentLimitsV1 = Object.freeze({ authoredBytes: FILE_LIMIT, phaseWork: Object.freeze(PHASE_LIMITS_V1), updateWork: Object.freeze(Object.fromEntries(Object.entries(PHASE_LIMITS_V1).map(([k, v]) => [k, 2 * v])) as unknown as XYAffinePrismFeatureWorkV1), snapshot: SLAB_LIMITS });

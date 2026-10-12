import { buildXYAffineSketch } from './xy-affine-sketch.js';
import type { XYAffineSketchDocumentV0, XYAffineSketchSuccess } from './xy-affine-sketch.js';
import { buildXYAffineSketchPrism, resolveXYAffineSketchPrismWall } from './xy-affine-sketch-prism.js';
import type { XYAffineSketchPrismOptions, XYAffineSketchPrismResult, XYAffineSketchPrismWallReference, XYAffineSketchPrismWallResolution } from './xy-affine-sketch-prism.js';
import { subtractConvexPlanarSlab, ConvexPlanarSlabSubtractionError } from './convex-planar-slab-subtraction.js';
import type { ConvexPlanarSlabSubtractionOptions, ConvexPlanarSlabSubtractionResult } from './convex-planar-slab-subtraction.js';
import { SlabSubtractionLedger, same, SLAB_LIMITS } from './convex-planar-slab-subtraction-internal.js';
import { parseCadDocumentOwnJson, cadDocumentOwnUtf8Bytes } from './cad-document.js';

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
export type XYAffinePrismFeatureDiagnosticCode = 'INPUT' | 'VERSION' | 'IDENTITY' | 'DEPENDENCY' | 'REVISION' | 'PARAMETER' | 'REFERENCE' | 'NATIVE' | 'OWNED' | 'CODEC' | 'BUDGET';
export class XYAffinePrismFeatureError extends Error {
  constructor(readonly code: XYAffinePrismFeatureDiagnosticCode, readonly stage: string, readonly nodeId: string | null,
    detail: string, readonly attempted: XYAffinePrismFeatureWork, cause?: unknown) {
    super(('XY affine prism feature document: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'XYAffinePrismFeatureError';
  }
}
const FILE_LIMIT = 262144;
const PHASE_LIMITS = { sketchBuilds: 2, prismBuilds: 2, wallResolutions: 2, subtractions: 1,
  sourceCompilations: 158, faceCompilations: 152, bindingObservations: 2304, totalD1: 6912,
  rationalContexts: 15, rationalOperations: 3000000, gcdSteps: 3000000 };
const zero = (): XYAffinePrismFeatureWork => Object.fromEntries(Object.keys(PHASE_LIMITS).map(k => [k, 0])) as unknown as XYAffinePrismFeatureWork;
interface State { ledger: SlabSubtractionLedger; stage: string; nodeId: string | null; work: XYAffinePrismFeatureWork }
const state = (): State => ({ ledger: new SlabSubtractionLedger(), stage: 'input', nodeId: null, work: zero() });
function check(s: State, value: boolean, code: XYAffinePrismFeatureDiagnosticCode, detail: string): asserts value {
  if (!value) throw new XYAffinePrismFeatureError(code, s.stage, s.nodeId, detail, { ...s.work });
}
function wrap<T>(s: State, action: () => T, code: XYAffinePrismFeatureDiagnosticCode = 'NATIVE'): T {
  try { return action(); } catch (cause) {
    if (cause instanceof XYAffinePrismFeatureError) throw cause;
    throw new XYAffinePrismFeatureError(cause instanceof ConvexPlanarSlabSubtractionError && cause.code === 'BUDGET' ? 'BUDGET' : code, s.stage, s.nodeId, cause instanceof Error ? cause.message : 'Operation refused', { ...s.work }, cause);
  }
}
function fields(s: State, v: unknown, keys: string[]): Record<string, unknown> {
  check(s, v !== null && typeof v === 'object' && !Array.isArray(v), 'INPUT', 'Exact own record required');
  const o = v as Record<string, unknown>; check(s, Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k)), 'INPUT', 'Exact fields required: ' + keys.join(',')); return o;
}
function id(s: State, v: unknown, max = 48): void { check(s, typeof v === 'string' && v.length <= max && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(v), 'IDENTITY', 'Bounded ASCII identity required'); }
function revision(s: State, v: unknown): void { check(s, typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1000000000 && !Object.is(v, -0), 'REVISION', 'Revision integer 0..1000000000 without negative zero required'); }
function length(s: State, v: unknown): void { check(s, typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 10000, 'PARAMETER', 'Finite literal millimetres within +/-10000 required'); }
function own<T>(s: State, v: T, result = false): T { return wrap(s, () => s.ledger.copy(v, result), 'INPUT'); }
function signedJson(v: unknown): string {
  if (typeof v === 'number') return Object.is(v, -0) ? '-0' : JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(signedJson).join(',') + ']';
  if (v !== null && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + signedJson((v as Record<string, unknown>)[k])).join(',') + '}';
  return JSON.stringify(v);
}
function file(s: State, doc: XYAffinePrismFeatureDocumentV0): string {
  const text = signedJson(doc) + '\n'; check(s, text.length <= FILE_LIMIT && cadDocumentOwnUtf8Bytes(text, 'JSON') <= FILE_LIMIT, 'BUDGET', 'Authored file exceeds 262144 UTF16/UTF8 units'); return text;
}
function dependencies(n: XYAffinePrismFeatureDocumentV0['nodes'][number]): string[] {
  return n.kind === 'sketch' ? [] : n.kind === 'prism' ? [n.sketchNodeId] : [n.parentPrismId, n.toolPrismId];
}
function admit(s: State, input: XYAffinePrismFeatureDocumentV0): XYAffinePrismFeatureDocumentV0 {
  const d = own(s, input); fields(s, d, ['format', 'version', 'id', 'revision', 'lengthUnit', 'nodes', 'parameters']);
  check(s, d.format === 'barocss-xy-affine-prism-feature-document' && d.version === 0 && d.lengthUnit === 'mm', 'VERSION', 'Exact version zero millimetre document required'); id(s, d.id); revision(s, d.revision);
  check(s, Array.isArray(d.nodes) && d.nodes.length === 5, 'INPUT', 'Exactly five fixed-role nodes required');
  const kinds = ['sketch', 'sketch', 'prism', 'prism', 'subtraction'];
  for (const [i, n] of d.nodes.entries()) {
    s.nodeId = n?.id ?? null; check(s, n !== null && typeof n === 'object' && n.kind === kinds[i], 'DEPENDENCY', 'Fixed sketch/sketch/prism/prism/subtraction role order required'); id(s, n.id);
    if (n.kind === 'sketch') { fields(s, n, ['id', 'kind', 'sourceId', 'revision', 'document']); id(s, n.sourceId); revision(s, n.revision); fields(s, n.document, ['format', 'version', 'profile', 'id', 'lengthUnit', 'points', 'segments', 'referenceLines', 'constraints']); id(s, n.document.id); check(s, Array.isArray(n.document.constraints) && n.document.constraints.length <= 32 && Array.isArray(n.document.segments) && n.document.segments.length <= 8, 'BUDGET', 'Bounded sketch constraints and segments required'); }
    else if (n.kind === 'prism') {
      fields(s, n, ['id', 'kind', 'sketchNodeId', 'options']); id(s, n.sketchNodeId);
      fields(s, n.options, ['orderedSegmentIds', 'heightMM', 'capChart', 'solidId', 'resultIdPrefix']); id(s, n.options.solidId); id(s, n.options.resultIdPrefix, 12);
    } else {
      fields(s, n, ['id', 'kind', 'parentPrismId', 'toolPrismId', 'operationId', 'first', 'second']); id(s, n.parentPrismId); id(s, n.toolPrismId); id(s, n.operationId);
      for (const role of ['first', 'second'] as const) { const c = n[role]; fields(s, c, ['reference', 'solidId', 'resultIdPrefix']); id(s, c.solidId); id(s, c.resultIdPrefix, 10); fields(s, c.reference, ['sourceId', 'sketchId', 'sourceRevision', 'segmentId']); id(s, c.reference.sourceId); id(s, c.reference.sketchId); id(s, c.reference.segmentId); revision(s, c.reference.sourceRevision); }
    }
  }
  const ids = d.nodes.map(n => n.id); check(s, new Set(ids).size === 5 && !ids.includes(d.id), 'IDENTITY', 'Distinct document and node identities required');
  // Bounded admission from the existing Boolean graph pattern, not a new general scheduler.
  const done = new Set<string>(), pending = new Set(ids);
  for (const n of d.nodes) for (const ref of dependencies(n)) { s.nodeId = n.id; check(s, ids.includes(ref), 'DEPENDENCY', 'Missing dependency: ' + ref); }
  while (pending.size) {
    const ready = d.nodes.find(n => pending.has(n.id) && dependencies(n).every(ref => done.has(ref)));
    check(s, ready !== undefined, 'DEPENDENCY', 'Cyclic dependencies refused'); done.add(ready.id); pending.delete(ready.id);
  }
  const [a, b, p, t, cut] = d.nodes;
  check(s, p.sketchNodeId === a.id && t.sketchNodeId === b.id && cut.parentPrismId === p.id && cut.toolPrismId === t.id, 'DEPENDENCY', 'Dependencies must select the exact fixed-role node and kind');
  check(s, a.sourceId !== b.sourceId && a.document.id !== b.document.id, 'IDENTITY', 'Distinct source/sketch contexts required');
  const native = [p.options.solidId, t.options.solidId, cut.operationId, cut.first.solidId, cut.second.solidId];
  check(s, new Set(native).size === native.length, 'IDENTITY', 'Distinct operation and Solid identities required');
  const prefixes = [p.options.resultIdPrefix, t.options.resultIdPrefix, cut.first.resultIdPrefix, cut.second.resultIdPrefix];
  check(s, new Set(prefixes).size === 4, 'IDENTITY', 'Distinct producer prefixes required');
  const contexts = [p, t].flatMap(n => [n.options.resultIdPrefix + '_b', n.options.resultIdPrefix + '_t', ...Array.from({ length: 8 }, (_, i) => n.options.resultIdPrefix + '_w_' + i)]).concat([cut.first, cut.second].flatMap(n => Array.from({ length: 12 }, (_, i) => n.resultIdPrefix + '_f' + i)));
  check(s, new Set(contexts).size === contexts.length, 'IDENTITY', 'Planned source namespaces collide');
  for (const c of [cut.first, cut.second]) { s.nodeId = cut.id; check(s, c.reference.sourceId === b.sourceId && c.reference.sketchId === b.document.id && c.reference.sourceRevision === b.revision, 'REFERENCE', 'Selected source context or revision is stale'); check(s, b.document.segments.some(seg => seg.id === c.reference.segmentId), 'REFERENCE', 'Selected original segment is missing'); }
  check(s, cut.first.reference.segmentId !== cut.second.reference.segmentId, 'REFERENCE', 'Distinct selected segments required');
  check(s, Array.isArray(d.parameters) && d.parameters.length <= 16, 'BUDGET', 'At most sixteen literal parameters required');
  const parameterIds = new Set<string>(), bindings = new Set<string>(); let count = 0;
  for (const parameter of d.parameters) {
    fields(s, parameter, ['id', 'unit', 'valueMM', 'bindings']); id(s, parameter.id); length(s, parameter.valueMM);
    check(s, parameter.unit === 'mm' && !parameterIds.has(parameter.id) && !ids.includes(parameter.id) && parameter.id !== d.id, 'PARAMETER', 'Unique literal-mm parameter required'); parameterIds.add(parameter.id);
    check(s, Array.isArray(parameter.bindings) && parameter.bindings.length > 0 && parameter.bindings.length <= 32, 'BUDGET', 'One to 32 parameter bindings required');
    for (const binding of parameter.bindings) {
      check(s, ++count <= 32, 'BUDGET', 'At most 32 total edit bindings'); fields(s, binding, ['sketchNodeId', 'constraintId', 'axis']); id(s, binding.constraintId);
      const sketch = [a, b].find(n => n.id === binding.sketchNodeId); s.nodeId = binding.sketchNodeId;
      check(s, sketch !== undefined && (binding.axis === 'x' || binding.axis === 'y'), 'PARAMETER', 'Binding must select a sketch coordinate');
      const matches = sketch.document.constraints.filter(c => c.id === binding.constraintId), constraint = matches[0];
      check(s, matches.length === 1 && constraint.kind === 'fixed' && Array.isArray(constraint.target) && constraint.target.length === 2, 'PARAMETER', 'Binding must select one original fixed constraint');
      const key = binding.sketchNodeId + '/' + binding.constraintId + '/' + binding.axis;
      check(s, !bindings.has(key) && Object.is(constraint.target[binding.axis === 'x' ? 0 : 1], parameter.valueMM), 'PARAMETER', 'Unique binding must match actual literal target bits'); bindings.add(key);
    }
  }
  s.nodeId = null; file(s, d); return d;
}
function add(s: State, work: Partial<XYAffinePrismFeatureWork>): void {
  for (const k of Object.keys(work) as (keyof XYAffinePrismFeatureWork)[]) s.work[k] += work[k]!;
  for (const k of Object.keys(PHASE_LIMITS) as (keyof XYAffinePrismFeatureWork)[]) check(s, s.work[k] <= PHASE_LIMITS[k], 'BUDGET', 'Phase work ceiling exceeded: ' + k);
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
function evaluate(s: State, input: XYAffinePrismFeatureDocumentV0, previous?: XYAffinePrismFeatureResult): { result: XYAffinePrismFeatureResult; actions: XYAffinePrismFeatureUpdate['transaction']['report']['actions'] } {
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
  const cold: State = { ...s, work: zero() };
  for (const sketch of sketches) { add(cold, { sketchBuilds: 1 }); sketchWork(cold, sketch); }
  for (const prism of prisms) { add(cold, { prismBuilds: 1 }); prismWork(cold, prism); }
  for (let i = 0; i < walls.length; i++) { add(cold, { wallResolutions: 1 }); prismWork(cold, prisms[1]); }
  add(cold, { subtractions: 1 }); slabWork(cold, subtraction!);
  const result: XYAffinePrismFeatureResult = { document, sketches, prisms, walls, subtraction: subtraction!, report: {
    schema: 'barocss-xy-affine-prism-feature-result', version: 0, nodeOrder: document.nodes.map(n => n.id), dependencies: document.nodes.map(n => ({ nodeId: n.id, dependsOn: dependencies(n) })), coldWork: cold.work,
    componentRoles: (['first', 'second'] as const).map(role => ({ role, solidId: cut[role].solidId, status: subtraction![role].outcome.kind })), authority: 'authored-sketches-literal-mm-bindings-and-fixed-feature-recipes', workScope: 'complete-cold-orchestration-including-provider-and-wall-lookup-reconstruction', persistentTopologyNamingCertified: false, editorFileUICertified: false } };
  s.ledger.copy(result, true, true, true); return { result, actions };
}
function rebuild(s: State, input: XYAffinePrismFeatureResult): XYAffinePrismFeatureResult {
  s.stage = 'prior-validation'; const old = own(s, input, true); fields(s, old, ['document', 'sketches', 'prisms', 'walls', 'subtraction', 'report']);
  const expected = evaluate(s, old.document).result; s.stage = 'owned'; s.nodeId = null;
  check(s, same(old, expected), 'OWNED', 'Complete retained document, geometry, references, proofs or work differ from cold rebuild'); return expected;
}
function edits(s: State, input: XYAffinePrismFeatureEdits, doc: XYAffinePrismFeatureDocumentV0): XYAffinePrismFeatureEdits {
  const e = own(s, input); fields(s, e, ['expectedRevision', 'revision', 'parameterEdits']); revision(s, e.expectedRevision); revision(s, e.revision);
  check(s, e.expectedRevision === doc.revision && e.revision === doc.revision + 1, 'REVISION', 'Expected current revision and exact +1 required');
  check(s, Array.isArray(e.parameterEdits) && e.parameterEdits.length <= 16, 'BUDGET', 'At most sixteen existing parameter setters required'); const seen = new Set<string>();
  for (const setter of e.parameterEdits) { fields(s, setter, ['parameterId', 'valueMM']); id(s, setter.parameterId); length(s, setter.valueMM); check(s, !seen.has(setter.parameterId) && doc.parameters.some(p => p.id === setter.parameterId), 'PARAMETER', 'One setter per existing parameter required'); seen.add(setter.parameterId); }
  return e;
}
function apply(s: State, previous: XYAffinePrismFeatureResult, input: XYAffinePrismFeatureEdits, validation: XYAffinePrismFeatureWork): XYAffinePrismFeatureUpdate {
  s.stage = 'update'; s.nodeId = null; s.work = zero(); const e = edits(s, input, previous.document), document = own(s, previous.document), changed = new Set<string>(); document.revision = e.revision;
  for (const setter of e.parameterEdits) {
    const parameter = document.parameters.find(p => p.id === setter.parameterId)!;
    if (Object.is(parameter.valueMM, setter.valueMM)) continue; parameter.valueMM = setter.valueMM;
    for (const binding of parameter.bindings) {
      const node = document.nodes.find(n => n.id === binding.sketchNodeId) as XYAffinePrismSketchNode, constraint = node.document.constraints.find(c => c.id === binding.constraintId)!;
      check(s, constraint.kind === 'fixed', 'PARAMETER', 'Fixed constraint binding required'); constraint.target[binding.axis === 'x' ? 0 : 1] = setter.valueMM; changed.add(node.id);
    }
  }
  for (const n of document.nodes.slice(0, 2) as XYAffinePrismSketchNode[]) if (changed.has(n.id)) { n.revision++; revision(s, n.revision); }
  const tool = document.nodes[1]; for (const c of [document.nodes[4].first, document.nodes[4].second]) c.reference.sourceRevision = tool.revision;
  const { result, actions } = evaluate(s, document, previous);
  return { result, transaction: { request: { previousDocument: previous.document, edits: e }, report: { previousRevision: previous.document.revision, revision: document.revision, noOp: changed.size === 0, actions, validation, candidate: { ...s.work }, atomic: true, workScope: 'one-prior-cold-validation-separated-from-actual-selective-candidate-work' } } };
}
/** Exactly the fixed authored sketch/prism/subtraction composition; no general graph scheduling. */
export function evaluateXYAffinePrismFeatureDocument(document: XYAffinePrismFeatureDocumentV0): XYAffinePrismFeatureResult {
  const s = state(); return wrap(s, () => own(s, evaluate(s, document).result, true));
}
/** Mandatory complete prior validation, then actual request-equality selective candidate work. */
export function updateXYAffinePrismFeatureDocument(previous: XYAffinePrismFeatureResult, input: XYAffinePrismFeatureEdits): XYAffinePrismFeatureUpdate {
  const s = state(); return wrap(s, () => { const request = own(s, { previous, edits: input }, true); const accepted = rebuild(s, request.previous), validation = { ...s.work }; return own(s, apply(s, accepted, request.edits, validation), true); });
}
export function validateXYAffinePrismFeatureDocument(input: XYAffinePrismFeatureResult): XYAffinePrismFeatureResult['report'] {
  const s = state(); return wrap(s, () => own(s, rebuild(s, input).report, true));
}
export function validateXYAffinePrismFeatureDocumentUpdate(input: XYAffinePrismFeatureUpdate): XYAffinePrismFeatureUpdate['transaction']['report'] {
  const s = state(); return wrap(s, () => { const old = own(s, input, true); fields(s, old, ['result', 'transaction']); fields(s, old.transaction, ['request', 'report']); fields(s, old.transaction.request, ['previousDocument', 'edits']);
    const previous = evaluate(s, old.transaction.request.previousDocument).result, validation = { ...s.work }, expected = apply(s, previous, old.transaction.request.edits, validation);
    s.stage = 'owned'; check(s, same(old, expected), 'OWNED', 'Whole transaction differs from authored prior replay'); return own(s, expected.transaction.report, true); });
}
/** Admit through real producers; persist only authored state with signed zero and one newline. */
export function serializeXYAffinePrismFeatureDocument(document: XYAffinePrismFeatureDocumentV0): string {
  const s = state(); return wrap(s, () => { const accepted = evaluate(s, document).result; s.stage = 'codec'; return file(s, accepted.document); }, 'CODEC');
}
/** Strict authored JSON grammar, followed by fresh native reconstruction. */
export function parseXYAffinePrismFeatureDocument(text: string): XYAffinePrismFeatureResult {
  const s = state(); s.stage = 'codec'; return wrap(s, () => { check(s, typeof text === 'string' && text.length <= FILE_LIMIT && cadDocumentOwnUtf8Bytes(text, 'JSON') <= FILE_LIMIT, 'CODEC', 'Bounded well-formed authored JSON required');
    const document = parseCadDocumentOwnJson(text) as XYAffinePrismFeatureDocumentV0; return own(s, evaluate(s, document).result, true); }, 'CODEC');
}
// Child snapshot ledgers remain unchanged; this whole public call uses one cumulative ledger.
export const XYAffinePrismFeatureDocumentLimits = Object.freeze({ authoredBytes: FILE_LIMIT, phaseWork: Object.freeze(PHASE_LIMITS), updateWork: Object.freeze(Object.fromEntries(Object.entries(PHASE_LIMITS).map(([k, v]) => [k, 2 * v])) as unknown as XYAffinePrismFeatureWork), snapshot: SLAB_LIMITS });

import { evaluateXYArcSketchDocument, updateXYArcSketchDocument } from './xy-arc-sketch-document.js';
import type { XYArcSketchDocumentV0, XYArcSketchDocumentEdit, XYArcSketchDocumentResult, XYArcSketchBindings } from './xy-arc-sketch-document.js';
import { evaluateXYCirclePrismDocument } from './xy-circle-prism-document.js';
import type { XYCirclePrismDocumentV0, XYCirclePrismDocumentResult, XYCirclePrismDocumentReport } from './xy-circle-prism-document.js';
import type { XYCirclePrismShellReport } from './xy-circle-prism-shell.js';
import { curveDecimal } from './curve-source.js';
import { copyCadData } from './data-copy.js';

export type SketchCircleLengthDefinition = { kind: 'literal'; valueMM: number } | { kind: 'offset'; parameterId: string; offsetMM: number };
export interface SketchCircleLengthParameter { id: string; type: 'length'; definition: SketchCircleLengthDefinition }
export interface SketchCircleGraphFeature { id: string; kind: 'xy-circle-extrude'; profileId: string; shellId: string; distanceParameterId: string; suppressed: boolean }
export interface SketchCircleFeatureGraphV0 {
  format: 'barocss-sketch-circle-feature-graph'; version: 0; id: string; lengthUnit: 'mm';
  sketch: XYArcSketchDocumentV0; parameters: SketchCircleLengthParameter[]; features: SketchCircleGraphFeature[];
}
export interface SketchCircleFeatureGraphEdits {
  parameterEdits?: { parameterId: string; definition: SketchCircleLengthDefinition }[];
  sketchEdits?: XYArcSketchDocumentEdit[]; featureEdits?: { featureId: string; suppressed: boolean }[];
}
export type SketchCircleFeatureOperation = { kind: 'upsert'; feature: SketchCircleGraphFeature } | { kind: 'remove'; featureId: string };
export interface SketchCircleFeatureLifecycleEdits {
  featureOperations: SketchCircleFeatureOperation[];
  parameterEdits?: SketchCircleFeatureGraphEdits['parameterEdits']; sketchEdits?: XYArcSketchDocumentEdit[];
}
export type SketchCircleParameterOperation = { kind: 'upsert'; parameter: SketchCircleLengthParameter } | { kind: 'remove'; parameterId: string };
export interface SketchCircleParameterLifecycleEdits {
  parameterOperations: SketchCircleParameterOperation[];
  featureOperations?: SketchCircleFeatureOperation[]; sketchEdits?: XYArcSketchDocumentEdit[];
}
export interface SketchCircleResolvedParameter { id: string; type: 'length'; valueMM: number; dependencyIds: string[]; order: number }
export interface SketchCircleFeatureBindings {
  kind: 'derived-one-circle-projection'; graphDocumentId: string; graphSketchId: string; featureId: string; profileId: string; shellId: string;
  heightParameterId: string; heightMM: number; profileBindings: XYArcSketchBindings; projectionBindings: XYCirclePrismDocumentReport['bindings'];
  projectionFormat: 'barocss-xy-circle-prism-feature'; geometryIds: XYCirclePrismShellReport['geometryIds']; domains: XYCirclePrismShellReport['domains']; faceIds: string[];
}
export interface SketchCircleEvaluatedFeature {
  featureId: string; profileId: string; shellId: string; distanceParameterId: string; status: 'active' | 'suppressed';
  evaluation: XYCirclePrismDocumentResult | null; bindings: SketchCircleFeatureBindings;
}
export interface SketchCircleFeatureGraphReport {
  kind: 'sketch-circle-feature-graph-evaluation'; formatVersion: 0; documentId: string; parameterOrder: string[];
  parameterDependencies: { parameterId: string; dependsOn: string }[]; featureDependencies: { featureId: string; profileId: string; distanceParameterId: string }[];
  featureStatus: { featureId: string; shellId: string; status: 'active' | 'suppressed'; native: XYCirclePrismShellReport | null }[]; activeShellIds: string[];
  wholeGraphCertified: false; candidateClosedShell: true; periodic: false; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { maximumParameters: 8; maximumFeatures: 4; authoredIdCharacters: 64; profileShellIdCharacters: 48; snapshotValues: 8192; snapshotDepth: 10;
    arrayElements: 64; recordFields: 12; stringCharacters: 128; maximumJSONBytes: 131072 };
}
export interface SketchCircleFeatureGraphResult {
  document: SketchCircleFeatureGraphV0; sketchEvaluation: XYArcSketchDocumentResult; parameters: SketchCircleResolvedParameter[];
  features: SketchCircleEvaluatedFeature[]; report: SketchCircleFeatureGraphReport;
}
function context(input: unknown): string {
  const ownId = (value: unknown): string => { if (value === null || typeof value !== 'object') return '?'; const d = Object.getOwnPropertyDescriptor(value, 'id'); return d && 'value' in d && typeof d.value === 'string' && d.value.length <= 64 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(d.value) ? d.value : '?'; };
  return 'Sketch circle feature graph #' + ownId(input);
}
function check(condition: boolean, label: string, path: string, detail: string): asserts condition { if (!condition) throw new Error((label + ': ' + path.slice(0, 256) + ': ' + detail).slice(0, 1024)); }
function guard<T>(label: string, work: () => T): T {
  try { return work(); } catch (error) { const message = error instanceof Error ? error.message : 'invalid document/geometry'; throw new Error((message.startsWith(label) ? message : label + ': ' + message).slice(0, 1024), { cause: error }); }
}
function snapshot(input: unknown, label: string, rootPath: string): unknown {
  let remaining = 8192;
  const copy = (value: unknown, depth: number, path: string): unknown => {
    check(--remaining >= 0 && depth <= 10, label, path, 'input exceeds8192 own values/depth10');
    if (typeof value === 'number') { check(Number.isFinite(value), label, path, 'finite data required'); return value; }
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') { check(value.length <= 128, label, path, 'string exceeds128'); return value; }
    check(value !== null && typeof value === 'object', label, path, 'plain numeric/string/boolean/record data required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, label, path, 'foreign prototype unsupported');
    const keys = Reflect.ownKeys(value);
    check(keys.length <= (array ? 65 : 12) && keys.every(key => typeof key === 'string' && key.length <= 128), label, path, 'bounded own fields required');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.every(key => typeof key === 'string' && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), label, path, 'getters, symbols or hidden fields unsupported');
    if (array) {
      const length = descriptors.length.value as number; check(Number.isInteger(length) && length >= 0 && length <= 64 && keys.length === length + 1, label, path, 'dense bounded arrays required');
      const output: unknown[] = [];
      for (let i = 0; i < length; i++) { check(Object.hasOwn(descriptors, String(i)), label, path, 'sparse/extra array field'); output.push(copy(descriptors[String(i)].value, depth + 1, path + '[' + i + ']')); }
      return output;
    }
    return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1, path + '.' + key)]));
  };
  return copy(input, 0, rootPath);
}
function record(value: unknown, fields: string[], label: string, path: string): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), label, path, 'own-data record required'); const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(key => Object.hasOwn(data, key)), label, path, 'exact fields required: ' + fields.join(',')); return data;
}
function identifier(value: unknown, label: string, path: string): string { check(typeof value === 'string' && value.length <= 64 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), label, path, 'ASCII ID1..64 required'); return value; }
function length(value: unknown, label: string, path: string): number {
  check(typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10000, label, path, 'finite fractional length within±10000mm required'); return value;
}
function definition(input: unknown, label: string, path: string): SketchCircleLengthDefinition {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), label, path, 'length definition record required');
  const kind = (input as Record<string, unknown>).kind;
  check(kind === 'literal' || kind === 'offset', label, path + '.kind', 'literal/offset length definition required');
  const data = record(input, kind === 'literal' ? ['kind', 'valueMM'] : ['kind', 'parameterId', 'offsetMM'], label, path);
  return kind === 'literal' ? { kind, valueMM: length(data.valueMM, label, path + '.valueMM') }
    : { kind, parameterId: identifier(data.parameterId, label, path + '.parameterId'), offsetMM: length(data.offsetMM, label, path + '.offsetMM') };
}
function admitParameter(input: unknown, label: string, path: string): SketchCircleLengthParameter {
  const p = record(input, ['id', 'type', 'definition'], label, path), pid = identifier(p.id, label, path + '.id');
  check(p.type === 'length', label + ' parameter #' + pid, path + '.type', 'length parameter required');
  return { id: pid, type: 'length', definition: definition(p.definition, label + ' parameter #' + pid, path + '.definition') };
}
function admitFeature(input: unknown, label: string, path: string): SketchCircleGraphFeature {
  const f = record(input, ['id', 'kind', 'profileId', 'shellId', 'distanceParameterId', 'suppressed'], label, path), fid = identifier(f.id, label, path + '.id'), owner = label + ' feature #' + fid;
  const profileId = identifier(f.profileId, owner, path + '.profileId'), shellId = identifier(f.shellId, owner, path + '.shellId');
  check(f.kind === 'xy-circle-extrude' && typeof f.suppressed === 'boolean' && profileId.length <= 48 && shellId.length <= 48, owner, path, 'circle extrusion/boolean suppression and used profile/shell IDs<=48 required');
  return { id: fid, kind: 'xy-circle-extrude', profileId, shellId, distanceParameterId: identifier(f.distanceParameterId, owner, path + '.distanceParameterId'), suppressed: f.suppressed };
}
function admit(input: unknown, label: string): SketchCircleFeatureGraphV0 {
  const data = record(snapshot(input, label, '$'), ['format', 'version', 'id', 'lengthUnit', 'sketch', 'parameters', 'features'], label, '$');
  check(data.format === 'barocss-sketch-circle-feature-graph' && data.version === 0 && data.lengthUnit === 'mm', label, '$.format/version/lengthUnit', 'circle feature graph0/mm required');
  const id = identifier(data.id, label, '$.id');
  check(Array.isArray(data.parameters) && data.parameters.length >= 1 && data.parameters.length <= 8, label, '$.parameters', '1..8 fractional typed length parameters required');
  const parameters = data.parameters.map((value, index): SketchCircleLengthParameter => {
    return admitParameter(value, label, '$.parameters[' + index + ']');
  });
  check(Array.isArray(data.features) && data.features.length >= 1 && data.features.length <= 4, label, '$.features', '1..4 original circle extrusion features required');
  const features = data.features.map((value, index): SketchCircleGraphFeature => {
    return admitFeature(value, label, '$.features[' + index + ']');
  });
  return { format: 'barocss-sketch-circle-feature-graph', version: 0, id, lengthUnit: 'mm', sketch: data.sketch as XYArcSketchDocumentV0, parameters, features };
}
function resolve(parameters: SketchCircleLengthParameter[], label: string): SketchCircleResolvedParameter[] {
  const byId = new Map(parameters.map(p => [p.id, p])), pending = new Set(parameters.map(p => p.id)), values = new Map<string, number>(), result: SketchCircleResolvedParameter[] = [];
  for (const p of parameters) if (p.definition.kind === 'offset') {
    check(byId.has(p.definition.parameterId), label + ' parameter #' + p.id, '$.parameters.definition.parameterId #' + p.definition.parameterId, 'missing length dependency');
    check(p.definition.parameterId !== p.id, label + ' parameter #' + p.id, '$.parameters.definition.parameterId', 'self dependency #' + p.id + ' -> #' + p.id);
  }
  while (pending.size) {
    // Choose the first authored currently ready node, including newly ready nodes.
    const p = parameters.find(p => pending.has(p.id) && (p.definition.kind === 'literal' || values.has(p.definition.parameterId)));
    if (!p) {
      const chain: string[] = []; let current = parameters.find(p => pending.has(p.id))!.id;
      while (!chain.includes(current)) { chain.push(current); const d = byId.get(current)!.definition; check(d.kind === 'offset', label, '$.parameters', 'unresolved dependency must be an offset'); current = d.parameterId; }
      const cycle = [...chain.slice(chain.indexOf(current)), current];
      check(false, label, '$.parameters', 'cyclic length dependency: ' + cycle.map(id => '#' + id).join(' -> '));
    }
    const d = p.definition, valueMM = d.kind === 'literal' ? d.valueMM : values.get(d.parameterId)! + d.offsetMM;
    length(valueMM, label + ' parameter #' + p.id, '$.parameters.resolvedValueMM');
    values.set(p.id, valueMM); pending.delete(p.id);
    result.push({ id: p.id, type: 'length', valueMM, dependencyIds: d.kind === 'offset' ? [d.parameterId] : [], order: result.length });
  }
  return result;
}
function sameData(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, i) => sameData(value, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
    return Object.keys(left).length === Object.keys(right).length && Object.keys(left).every(key => Object.hasOwn(right, key) && sameData(left[key], right[key]));
  }
  return Object.is(a, b);
}
function authoredRoles(document: SketchCircleFeatureGraphV0, label: string): Map<string, string> {
  const roles = new Map<string, string>();
  const add = (id: string, role: string): void => { identifier(id, label, '$.ids'); check(!roles.has(id), label, '$.ids #' + id, 'authored graph/sketch/profile/point/radius/parameter/feature/shell slots must be globally distinct'); roles.set(id, role); };
  add(document.id, 'graph'); add(document.sketch.id, 'sketch');
  for (const p of document.sketch.profiles) {
    add(p.id, 'source:' + p.id); add(p.centerId, 'center:' + p.id); add(p.radius.id, 'radius:' + p.id);
    if (p.kind === 'circle') add(p.seamId, 'seam:' + p.id); else p.endpointIds.forEach((id, i) => add(id, 'endpoint:' + p.id + ':' + i));
  }
  document.parameters.forEach(p => add(p.id, 'parameter:' + p.id));
  document.features.forEach(f => { add(f.id, 'feature:' + f.id); add(f.shellId, 'shell:' + f.id); });
  return roles;
}
function evaluate(document: SketchCircleFeatureGraphV0, label: string, nativeIdentities?: Map<string, string>): SketchCircleFeatureGraphResult {
  const sketchEvaluation = guard(label + ': $.sketch', () => evaluateXYArcSketchDocument(document.sketch)); document.sketch = sketchEvaluation.document;
  const authored = authoredRoles(document, label), parameters = resolve(document.parameters, label), values = new Map(parameters.map(p => [p.id, p.valueMM]));
  const nativeRoles = nativeIdentities ?? new Map<string, string>();
  const features = document.features.map((f): SketchCircleEvaluatedFeature => guard(label + ' feature #' + f.id + ': $.features', () => {
    const p = document.sketch.profiles.find(p => p.id === f.profileId), original = sketchEvaluation.profiles.find(p => p.profileId === f.profileId);
    check(p?.kind === 'circle' && !!original, label + ' feature #' + f.id, '$.features.profileId #' + f.profileId, 'existing original circle required; quarter profiles cannot drive extrusion');
    check(values.has(f.distanceParameterId), label + ' feature #' + f.id, '$.features.distanceParameterId #' + f.distanceParameterId, 'existing resolved height parameter required');
    const heightMM = values.get(f.distanceParameterId)!;
    check(heightMM >= .001 && heightMM <= 10000, label + ' feature #' + f.id, '$.features.distanceParameterId', 'resolved positive fractional height0.001..10000mm required');
    const projection: XYCirclePrismDocumentV0 = { format: 'barocss-xy-circle-prism-feature', version: 0, id: document.id, lengthUnit: 'mm',
      sketch: { ...copyCadData(document.sketch), profiles: [copyCadData(p)] },
      feature: { id: f.id, kind: 'xy-circle-extrude', profileId: f.profileId, shellId: f.shellId, height: { id: f.distanceParameterId, valueMM: heightMM } } };
    // Native599 admission also runs for suppressed features; no preview is called.
    const candidate = evaluateXYCirclePrismDocument(projection);
    check(sameData(original.evaluation, candidate.shell.profile), label + ' feature #' + f.id, '$.features.projection.profile', 'full original587 and actual599 projection source/Curve/domain/IDs must match');
    const bundle = candidate.shell.bundle;
    const add = (id: string, role: string): void => {
      const owner = authored.get(id), previous = nativeRoles.get(id);
      check(owner === undefined || owner === role, label + ' feature #' + f.id, '$.features.generatedIds #' + id, 'generated native identity collides with unrelated authored slot');
      check(previous === undefined || previous === role, label + ' feature #' + f.id, '$.features.generatedIds #' + id, 'generated native identity collides across distinct features/entities'); nativeRoles.set(id, role);
    };
    add(bundle.topology.id, 'shell:' + f.id); add(bundle.geometry.name, 'shell:' + f.id);
    for (const [i, object] of bundle.geometry.objects.entries()) add(object.id, i === 0 ? 'source:' + p.id : 'generated:' + f.id + ':object:' + object.id);
    for (const vertex of bundle.topology.vertices) add(vertex.id, 'generated:' + f.id + ':vertex:' + vertex.id);
    for (const edge of bundle.topology.edges) add(edge.id, 'generated:' + f.id + ':edge:' + edge.id);
    for (const face of bundle.topology.faces) add(face.id, 'generated:' + f.id + ':face:' + face.id);
    for (const loop of bundle.topology.loops) {
      add(loop.id, 'generated:' + f.id + ':loop:' + loop.id);
      for (const use of loop.uses) { add(use.id, 'generated:' + f.id + ':use:' + use.id); add(use.pcurve.curve.id, 'generated:' + f.id + ':pcurve:' + use.pcurve.curve.id); }
    }
    add(candidate.shell.baseFace.bundle.geometry.name, 'generated:' + f.id + ':face:' + bundle.topology.faces[0].id);
    // Source0's fixed container name "profile" stays local to each original Model.
    // Actual599 still applies its own per-feature authored/name collision gate.
    const bindings: SketchCircleFeatureBindings = { kind: 'derived-one-circle-projection', graphDocumentId: document.id, graphSketchId: document.sketch.id, featureId: f.id,
      profileId: p.id, shellId: f.shellId, heightParameterId: f.distanceParameterId, heightMM, profileBindings: copyCadData(original.bindings),
      projectionBindings: copyCadData(candidate.report.bindings), projectionFormat: projection.format, geometryIds: copyCadData(candidate.shell.report.geometryIds),
      domains: copyCadData(candidate.shell.report.domains), faceIds: bundle.topology.faces.map(face => face.id) };
    return { featureId: f.id, profileId: f.profileId, shellId: f.shellId, distanceParameterId: f.distanceParameterId,
      status: f.suppressed ? 'suppressed' : 'active', evaluation: f.suppressed ? null : candidate, bindings };
  }));
  const report: SketchCircleFeatureGraphReport = { kind: 'sketch-circle-feature-graph-evaluation', formatVersion: 0, documentId: document.id,
    parameterOrder: parameters.map(p => p.id), parameterDependencies: document.parameters.flatMap(p => p.definition.kind === 'offset' ? [{ parameterId: p.id, dependsOn: p.definition.parameterId }] : []),
    featureDependencies: document.features.map(f => ({ featureId: f.id, profileId: f.profileId, distanceParameterId: f.distanceParameterId })),
    featureStatus: features.map(f => ({ featureId: f.featureId, shellId: f.shellId, status: f.status, native: f.evaluation?.shell.report ?? null })),
    activeShellIds: features.filter(f => f.status === 'active').map(f => f.shellId), wholeGraphCertified: false, candidateClosedShell: true,
    periodic: false, geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    limits: { maximumParameters: 8, maximumFeatures: 4, authoredIdCharacters: 64, profileShellIdCharacters: 48, snapshotValues: 8192, snapshotDepth: 10, arrayElements: 64, recordFields: 12, stringCharacters: 128, maximumJSONBytes: 131072 } };
  return copyCadData({ document, sketchEvaluation, parameters, features, report });
}
export function evaluateSketchCircleFeatureGraph(document: SketchCircleFeatureGraphV0): SketchCircleFeatureGraphResult {
  const label = context(document); return guard(label, () => evaluate(admit(document, label), label));
}
function applyInputEdits(candidate: SketchCircleFeatureGraphV0, data: Record<string, unknown>, label: string): void {
  if (Object.hasOwn(data, 'parameterEdits')) {
    const targets = new Set<string>();
    for (const [index, input] of (data.parameterEdits as unknown[]).entries()) {
      const path = '$edits.parameterEdits[' + index + ']', e = record(input, ['parameterId', 'definition'], label, path), id = identifier(e.parameterId, label, path + '.parameterId');
      check(!targets.has(id), label + ' parameter #' + id, path, 'repeated parameter edit target'); targets.add(id);
      const p = candidate.parameters.find(p => p.id === id); check(!!p, label + ' parameter #' + id, path, 'existing parameter required'); p.definition = definition(e.definition, label + ' parameter #' + id, path + '.definition');
    }
  }
  if (Object.hasOwn(data, 'sketchEdits') && (data.sketchEdits as unknown[]).length) candidate.sketch = updateXYArcSketchDocument(candidate.sketch, data.sketchEdits as XYArcSketchDocumentEdit[]).document;
}
export function updateSketchCircleFeatureGraph(document: SketchCircleFeatureGraphV0, edits: SketchCircleFeatureGraphEdits): SketchCircleFeatureGraphResult {
  const label = context(document);
  return guard(label, () => {
    const candidate = admit(document, label), value = snapshot(edits, label, '$edits');
    check(value !== null && typeof value === 'object' && !Array.isArray(value), label, '$edits', 'edit record required');
    const data = value as Record<string, unknown>, keys = Object.keys(data);
    check(keys.length >= 1 && keys.length <= 3 && keys.every(key => ['parameterEdits', 'sketchEdits', 'featureEdits'].includes(key)), label, '$edits', 'exact optional parameter/sketch/feature arrays required');
    let count = 0;
    for (const key of keys) { check(Array.isArray(data[key]) && (data[key] as unknown[]).length <= (key === 'featureEdits' ? 4 : 8), label, '$edits.' + key, 'bounded edit array required'); count += (data[key] as unknown[]).length; }
    check(count > 0, label, '$edits', 'at least one actual edit required');
    applyInputEdits(candidate, data, label);
    if (Object.hasOwn(data, 'featureEdits')) {
      const targets = new Set<string>();
      for (const [index, input] of (data.featureEdits as unknown[]).entries()) {
        const path = '$edits.featureEdits[' + index + ']', e = record(input, ['featureId', 'suppressed'], label, path), id = identifier(e.featureId, label, path + '.featureId');
        check(!targets.has(id), label + ' feature #' + id, path, 'repeated feature edit target'); targets.add(id);
        const f = candidate.features.find(f => f.id === id); check(!!f && typeof e.suppressed === 'boolean', label + ' feature #' + id, path, 'existing feature and boolean suppression required'); f.suppressed = e.suppressed;
      }
    }
    return evaluate(admit(candidate, label), label);
  });
}
function applyFeatureOperations(candidate: SketchCircleFeatureGraphV0, operations: unknown[], startingFeatures: Map<string, SketchCircleGraphFeature>, reserved: Set<string>, label: string): void {
  const targets = new Set<string>();
  for (const [index, input] of operations.entries()) {
    const path = '$edits.featureOperations[' + index + ']';
    check(input !== null && typeof input === 'object' && !Array.isArray(input), label, path, 'feature operation record required');
    const kind = (input as Record<string, unknown>).kind;
    check(kind === 'upsert' || kind === 'remove', label, path + '.kind', 'upsert/remove required');
    const operation = record(input, kind === 'upsert' ? ['kind', 'feature'] : ['kind', 'featureId'], label, path);
    const next = kind === 'upsert' ? admitFeature(operation.feature, label, path + '.feature') : undefined;
    const id = next ? next.id : identifier(operation.featureId, label, path + '.featureId'), owner = label + ' feature #' + id;
    check(!targets.has(id), owner, path, 'target feature appears more than once in transaction'); targets.add(id);
    const previous = startingFeatures.get(id), slot = candidate.features.findIndex(f => f.id === id);
    if (next) {
      if (previous) {
        check(previous.kind === next.kind && previous.shellId === next.shellId && slot >= 0, owner, path + '.feature.kind/shellId', 'existing feature kind/shell identity and slot must remain'); candidate.features[slot] = next;
      } else {
        check(!reserved.has(next.id) && !reserved.has(next.shellId) && next.id !== next.shellId, owner, path + '.feature.id/shellId', 'new feature/shell identities must be fresh relative to starting/new authored/selectable native IDs');
        check(candidate.features.length < 8, owner, path, 'bounded working feature array cannot exceed8');
        reserved.add(next.id); reserved.add(next.shellId); candidate.features.push(next);
      }
    } else {
      check(!!previous && slot >= 0, owner, path + '.featureId', 'remove must resolve a starting feature'); candidate.features.splice(slot, 1);
    }
  }
}
function reserveSketchIdentities(candidate: SketchCircleFeatureGraphV0, startingAuthored: Map<string, string>, reserved: Set<string>, label: string): void {
  for (const [id, role] of authoredRoles(candidate, label)) {
    if (!['source:', 'center:', 'radius:', 'seam:', 'endpoint:'].some(prefix => role.startsWith(prefix))) continue;
    const originalRole = startingAuthored.get(id);
    check(originalRole === role || originalRole === undefined && !reserved.has(id), label, '$edits.sketchEdits.ids #' + id, 'new sketch identity cannot recycle starting/removed authored or selectable native identity or new feature/shell identity'); reserved.add(id);
  }
}
export function editSketchCircleFeatureGraphFeatures(document: SketchCircleFeatureGraphV0, edits: SketchCircleFeatureLifecycleEdits): SketchCircleFeatureGraphResult {
  const label = context(document);
  return guard(label, () => {
    const selectableNative = new Map<string, string>();
    // Suppressed candidates contribute actual native IDs too. Source0's fixed
    // per-Model container name is intentionally absent from this global pool.
    const candidate = evaluate(admit(document, label), label, selectableNative).document;
    const startingAuthored = authoredRoles(candidate, label), startingFeatures = new Map(candidate.features.map(f => [f.id, copyCadData(f)]));
    const reserved = new Set([...startingAuthored.keys(), ...selectableNative.keys()]);
    const value = snapshot(edits, label, '$edits');
    check(value !== null && typeof value === 'object' && !Array.isArray(value), label, '$edits', 'feature lifecycle edit record required');
    const data = value as Record<string, unknown>, keys = Object.keys(data);
    check(Object.hasOwn(data, 'featureOperations') && keys.length <= 3 && keys.every(key => ['featureOperations', 'parameterEdits', 'sketchEdits'].includes(key)), label, '$edits', 'required featureOperations and optional parameterEdits/sketchEdits only');
    check(Array.isArray(data.featureOperations) && data.featureOperations.length >= 1 && data.featureOperations.length <= 8, label, '$edits.featureOperations', 'ordered1..8 feature operations required');
    for (const key of ['parameterEdits', 'sketchEdits']) if (Object.hasOwn(data, key)) check(Array.isArray(data[key]) && (data[key] as unknown[]).length <= 8, label, '$edits.' + key, 'optional0..8 existing input edits required');
    applyFeatureOperations(candidate, data.featureOperations as unknown[], startingFeatures, reserved, label);
    applyInputEdits(candidate, data, label);
    reserveSketchIdentities(candidate, startingAuthored, reserved, label);
    // Only the complete final candidate owns1..4 count and reference admission.
    return evaluate(admit(candidate, label), label);
  });
}
export function editSketchCircleFeatureGraphParameters(document: SketchCircleFeatureGraphV0, edits: SketchCircleParameterLifecycleEdits): SketchCircleFeatureGraphResult {
  const label = context(document);
  return guard(label, () => {
    const selectableNative = new Map<string, string>();
    const candidate = evaluate(admit(document, label), label, selectableNative).document;
    const startingAuthored = authoredRoles(candidate, label), reserved = new Set([...startingAuthored.keys(), ...selectableNative.keys()]);
    const startingParameters = new Map(candidate.parameters.map(p => [p.id, copyCadData(p)]));
    const startingFeatures = new Map(candidate.features.map(f => [f.id, copyCadData(f)])), targets = new Set<string>();
    const value = snapshot(edits, label, '$edits');
    check(value !== null && typeof value === 'object' && !Array.isArray(value), label, '$edits', 'parameter lifecycle edit record required');
    const data = value as Record<string, unknown>, keys = Object.keys(data);
    check(Object.hasOwn(data, 'parameterOperations') && keys.length <= 3 && keys.every(key => ['parameterOperations', 'featureOperations', 'sketchEdits'].includes(key)), label, '$edits', 'required parameterOperations and optional featureOperations/sketchEdits only');
    for (const key of keys) check(Array.isArray(data[key]) && (data[key] as unknown[]).length >= 1 && (data[key] as unknown[]).length <= (key === 'parameterOperations' ? 16 : 8), label, '$edits.' + key, key === 'parameterOperations' ? 'ordered1..16 parameter operations required' : 'optional present1..8 operations required');
    for (const [index, input] of (data.parameterOperations as unknown[]).entries()) {
      const path = '$edits.parameterOperations[' + index + ']';
      check(input !== null && typeof input === 'object' && !Array.isArray(input), label, path, 'parameter operation record required');
      const kind = (input as Record<string, unknown>).kind;
      check(kind === 'upsert' || kind === 'remove', label, path + '.kind', 'upsert/remove parameter operation required');
      const operation = record(input, kind === 'upsert' ? ['kind', 'parameter'] : ['kind', 'parameterId'], label, path);
      const next = kind === 'upsert' ? admitParameter(operation.parameter, label, path + '.parameter') : undefined;
      const id = next ? next.id : identifier(operation.parameterId, label, path + '.parameterId'), owner = label + ' parameter #' + id;
      check(!targets.has(id), owner, path, 'target parameter appears more than once in transaction'); targets.add(id);
      const previous = startingParameters.get(id), slot = candidate.parameters.findIndex(p => p.id === id);
      if (next) {
        if (previous) {
          check(next.type === previous.type && slot >= 0, owner, path + '.parameter.type', 'existing parameter type/identity and slot must remain'); candidate.parameters[slot] = next;
        } else {
          check(!reserved.has(id), owner, path + '.parameter.id', 'new parameter identity must be fresh relative to starting/new authored/selectable native IDs');
          check(candidate.parameters.length < 16, owner, path, 'bounded working parameter array cannot exceed16');
          reserved.add(id); candidate.parameters.push(next);
        }
      } else {
        check(!!previous && slot >= 0, owner, path + '.parameterId', 'remove must resolve a starting parameter'); candidate.parameters.splice(slot, 1);
      }
    }
    if (Object.hasOwn(data, 'featureOperations')) applyFeatureOperations(candidate, data.featureOperations as unknown[], startingFeatures, reserved, label);
    applyInputEdits(candidate, data, label);
    reserveSketchIdentities(candidate, startingAuthored, reserved, label);
    // Count, references, forward dependencies and native validity belong to the
    // complete final candidate, after every explicit repair has been applied.
    return evaluate(admit(candidate, label), label);
  });
}
export function serializeSketchCircleFeatureGraph(document: SketchCircleFeatureGraphV0): string {
  const label = context(document);
  return guard(label, () => {
    const accepted = evaluate(admit(document, label), label).document;
    const encode = (value: unknown): string => typeof value === 'number' ? curveDecimal(value, label) : typeof value === 'string' || typeof value === 'boolean' ? JSON.stringify(value) : Array.isArray(value) ? '[' + value.map(encode).join(',') + ']' : '{' + Object.entries(value as Record<string, unknown>).map(([key, field]) => JSON.stringify(key) + ':' + encode(field)).join(',') + '}';
    const text = encode(accepted) + '\n'; check(text.length <= 131072, label, '$serialization', 'intent JSON exceeds128KiB'); return text;
  });
}

/** Admission scan only; JSON.parse remains the JSON syntax/value parser. */
function admitJSONText(text: string, label: string): void {
  const stack: { kind: '{' | '['; keys: Set<string>; count: number; nextValue: boolean }[] = [];
  let remaining = 8192;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]; if (c === ' ' || c === '\n' || c === '\r' || c === '\t') continue;
    const parent = stack.at(-1);
    if (parent?.kind === '[' && parent.nextValue && c !== ']' && c !== ',') { check(++parent.count <= 64, label, '$text[' + i + ']', 'JSON array exceeds64 elements'); parent.nextValue = false; }
    if (c === '"' || c === '{' || c === '[' || c === '-' || /[0-9tfn]/.test(c)) check(--remaining >= 0, label, '$text', 'JSON exceeds8192 lexical values/keys');
    if (c === '"') {
      let end = i + 1;
      for (; end < text.length; end++) { if (text[end] === '\\') end++; else if (text[end] === '"') break; }
      check(end < text.length && end - i <= 769, label, '$text[' + i + ']', 'unterminated/oversized JSON string');
      const value: unknown = JSON.parse(text.slice(i, end + 1)); check(typeof value === 'string' && value.length <= 128, label, '$text[' + i + ']', 'JSON string exceeds128 characters');
      let next = end + 1; while (next < text.length && /[ \n\r\t]/.test(text[next])) next++;
      if (text[next] === ':') {
        check(parent?.kind === '{', label, '$text[' + i + ']', 'JSON object key outside object');
        check(!parent.keys.has(value), label, '$text[' + i + ']', 'duplicate JSON field ' + value); parent.keys.add(value);
        check(parent.keys.size <= 12, label, '$text[' + i + ']', 'JSON object exceeds12 fields');
      }
      i = end; continue;
    }
    if (c === '{' || c === '[') { stack.push({ kind: c, keys: new Set(), count: 0, nextValue: true }); check(stack.length <= 10, label, '$text[' + i + ']', 'JSON nesting exceeds admitted depth10'); }
    else if (c === '}' || c === ']') { check(parent?.kind === (c === '}' ? '{' : '['), label, '$text[' + i + ']', 'unbalanced JSON container'); stack.pop(); }
    else if (c === ',' && parent?.kind === '[') parent.nextValue = true;
    else if (c === '-' || /[0-9tfn]/.test(c)) { while (i + 1 < text.length && !/[ \n\r\t,}\]]/.test(text[i + 1])) i++; }
  }
  check(stack.length === 0, label, '$text', 'unclosed JSON container');
}
export function parseSketchCircleFeatureGraph(text: string): SketchCircleFeatureGraphV0 {
  const label = 'Sketch circle feature graph parse';
  return guard(label, () => {
    check(typeof text === 'string' && text.length <= 131072, label, '$text', 'JSON text within128KiB UTF-8 required'); let bytes = 0;
    for (let i = 0; i < text.length; i++) { const code = text.charCodeAt(i), next = text.charCodeAt(i + 1); if (code < 128) bytes++; else if (code < 2048) bytes += 2; else if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { bytes += 4; i++; } else bytes += 3; check(bytes <= 131072, label, '$text', 'JSON exceeds128KiB UTF-8'); }
    admitJSONText(text, label); const data = JSON.parse(text); return evaluateSketchCircleFeatureGraph(data).document;
  });
}

import { evaluateXYSketchDocument, updateXYSketchDocument } from './xy-sketch-document.js';
import type { XYSketchDocumentV0, XYSketchDocumentEdit, XYSketchDocumentResult, XYSketchPointBinding } from './xy-sketch-document.js';
import { buildAxisRectangleExtrusion } from './axis-rectangle-extrusion.js';
import type { AxisRectangleExtrusionResult, AxisRectangleExtrusionConstruction } from './axis-rectangle-extrusion.js';
import { curveDecimal } from './curve-source.js';
import { copyCadData } from './data-copy.js';

export type SketchRectangleLengthDefinition = { kind: 'literal'; valueMM: number } | { kind: 'offset'; parameterId: string; offsetMM: number };
export interface SketchRectangleLengthParameter { id: string; type: 'length'; definition: SketchRectangleLengthDefinition }
export interface SketchRectangleGraphFeature { id: string; kind: 'axis-rectangle-extrude'; profileId: string; bodyId: string; distanceParameterId: string; suppressed: boolean }
export interface SketchRectangleFeatureGraphV0 {
  format: 'barocss-sketch-rectangle-feature-graph'; version: 0; id: string; lengthUnit: 'mm';
  sketch: XYSketchDocumentV0; parameters: SketchRectangleLengthParameter[]; features: SketchRectangleGraphFeature[];
}
export interface SketchRectangleFeatureGraphEdits {
  parameterEdits?: { parameterId: string; definition: SketchRectangleLengthDefinition }[];
  sketchEdits?: XYSketchDocumentEdit[]; featureEdits?: { featureId: string; suppressed: boolean }[];
}
export interface SketchRectangleResolvedParameter { id: string; type: 'length'; valueMM: number; dependencyIds: string[]; order: number }
export interface SketchRectangleFeatureBindings {
  sketchId: string; profileId: string; curveId: string; authoredPointIds: string[]; pointBindings: XYSketchPointBinding[];
  graphDistance: { parameterId: string; valueMM: number }; localParameterIds: AxisRectangleExtrusionConstruction['parameterIds'];
  bodyId: string; shellId: string; faceBindings: { shellFaceId: string; localFaceId: string; surfaceId: string }[];
}
export interface SketchRectangleEvaluatedFeature {
  featureId: string; profileId: string; bodyId: string; distanceParameterId: string; status: 'active' | 'suppressed';
  evaluation: AxisRectangleExtrusionResult | null; bindings: SketchRectangleFeatureBindings;
}
export interface SketchRectangleFeatureGraphReport {
  kind: 'sketch-rectangle-feature-graph-evaluation'; formatVersion: 0; documentId: string;
  parameterOrder: string[]; parameterDependencies: { parameterId: string; dependsOn: string }[];
  featureDependencies: { featureId: string; profileId: string; distanceParameterId: string }[];
  activeBodyIds: string[];
  featureStatus: { featureId: string; status: 'active' | 'suppressed'; bodyId: string; solidReport: AxisRectangleExtrusionResult['solidReport'] | null }[];
  limits: { maximumParameters: 8; maximumFeatures: 4; authoredIdCharacters: 64; snapshotValues: 8192; snapshotDepth: 10;
    arrayElements: 64; recordFields: 12; stringCharacters: 128; maximumJSONBytes: 131072 };
  wholeGraphCertified: false;
}
export interface SketchRectangleFeatureGraphResult {
  document: SketchRectangleFeatureGraphV0; sketchEvaluation: XYSketchDocumentResult;
  parameters: SketchRectangleResolvedParameter[]; features: SketchRectangleEvaluatedFeature[]; report: SketchRectangleFeatureGraphReport;
}
function context(input: unknown): string {
  const ownId = (value: unknown): string => { if (value === null || typeof value !== 'object') return '?'; const d = Object.getOwnPropertyDescriptor(value, 'id'); return d && 'value' in d && typeof d.value === 'string' && d.value.length <= 64 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(d.value) ? d.value : '?'; };
  return 'Sketch rectangle feature graph #' + ownId(input);
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
  check(typeof value === 'number' && Number.isInteger(value) && Math.abs(value) <= 10000, label, path, 'finite integer length within±10000mm required'); return value;
}
function definition(input: unknown, label: string, path: string): SketchRectangleLengthDefinition {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), label, path, 'length definition record required');
  const kind = (input as Record<string, unknown>).kind;
  check(kind === 'literal' || kind === 'offset', label, path + '.kind', 'literal/offset length definition required');
  const data = record(input, kind === 'literal' ? ['kind', 'valueMM'] : ['kind', 'parameterId', 'offsetMM'], label, path);
  return kind === 'literal' ? { kind, valueMM: length(data.valueMM, label, path + '.valueMM') }
    : { kind, parameterId: identifier(data.parameterId, label, path + '.parameterId'), offsetMM: length(data.offsetMM, label, path + '.offsetMM') };
}
function admit(input: unknown, label: string): SketchRectangleFeatureGraphV0 {
  const data = record(snapshot(input, label, '$'), ['format', 'version', 'id', 'lengthUnit', 'sketch', 'parameters', 'features'], label, '$');
  check(data.format === 'barocss-sketch-rectangle-feature-graph' && data.version === 0 && data.lengthUnit === 'mm', label, '$.format/version/lengthUnit', 'sketch rectangle graph0/mm required');
  const id = identifier(data.id, label, '$.id');
  check(Array.isArray(data.parameters) && data.parameters.length >= 1 && data.parameters.length <= 8, label, '$.parameters', '1..8 typed length parameters required');
  const parameters = data.parameters.map((value, index): SketchRectangleLengthParameter => {
    const path = '$.parameters[' + index + ']', p = record(value, ['id', 'type', 'definition'], label, path), pid = identifier(p.id, label, path + '.id');
    check(p.type === 'length', label + ' parameter #' + pid, path + '.type', 'length parameter required');
    return { id: pid, type: 'length', definition: definition(p.definition, label + ' parameter #' + pid, path + '.definition') };
  });
  check(Array.isArray(data.features) && data.features.length >= 1 && data.features.length <= 4, label, '$.features', '1..4 rectangle extrusion features required');
  const features = data.features.map((value, index): SketchRectangleGraphFeature => {
    const path = '$.features[' + index + ']', f = record(value, ['id', 'kind', 'profileId', 'bodyId', 'distanceParameterId', 'suppressed'], label, path), fid = identifier(f.id, label, path + '.id'), owner = label + ' feature #' + fid;
    check(f.kind === 'axis-rectangle-extrude' && typeof f.suppressed === 'boolean', owner, path + '.kind/suppressed', 'axis-rectangle-extrude and explicit boolean suppression required');
    return { id: fid, kind: 'axis-rectangle-extrude', profileId: identifier(f.profileId, owner, path + '.profileId'), bodyId: identifier(f.bodyId, owner, path + '.bodyId'), distanceParameterId: identifier(f.distanceParameterId, owner, path + '.distanceParameterId'), suppressed: f.suppressed };
  });
  return { format: 'barocss-sketch-rectangle-feature-graph', version: 0, id, lengthUnit: 'mm', sketch: data.sketch as XYSketchDocumentV0, parameters, features };
}
function resolve(parameters: SketchRectangleLengthParameter[], label: string): SketchRectangleResolvedParameter[] {
  const byId = new Map(parameters.map(p => [p.id, p])), pending = new Set(parameters.map(p => p.id)), values = new Map<string, number>(), result: SketchRectangleResolvedParameter[] = [];
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
function evaluate(document: SketchRectangleFeatureGraphV0, label: string): SketchRectangleFeatureGraphResult {
  const sketchEvaluation = guard(label + ': $.sketch', () => evaluateXYSketchDocument(document.sketch));
  document.sketch = sketchEvaluation.document;
  const authored = [document.id, document.sketch.id,
    ...document.sketch.profiles.flatMap(p => [p.id, ...(p.kind === 'rectangle' ? p.cornerIds : p.points.map(point => point.id))]),
    ...document.parameters.map(p => p.id), ...document.features.flatMap(f => [f.id, f.bodyId])];
  const seen = new Set<string>();
  for (const id of authored) { identifier(id, label, '$.ids'); check(!seen.has(id), label, '$.ids #' + id, 'all graph/sketch/profile/authored point/parameter/feature/body IDs must be globally distinct'); seen.add(id); }
  const parameters = resolve(document.parameters, label), values = new Map(parameters.map(p => [p.id, p.valueMM]));
  const features = document.features.map((f): SketchRectangleEvaluatedFeature => guard(label + ' feature #' + f.id + ': $.features', () => {
    const profile = document.sketch.profiles.find(p => p.id === f.profileId);
    check(profile?.kind === 'rectangle', label + ' feature #' + f.id, '$.features.profileId #' + f.profileId, 'existing rectangle sketch profile required');
    check(values.has(f.distanceParameterId), label + ' feature #' + f.id, '$.features.distanceParameterId #' + f.distanceParameterId, 'existing resolved length parameter required');
    const distance = values.get(f.distanceParameterId)!;
    check(Number.isInteger(distance) && distance >= 1 && distance <= 10000, label + ' feature #' + f.id, '$.features.distanceParameterId', 'resolved positive extrusion height1..10000mm required');
    // Reuse the original admission even for suppressed features, then discard
    // their candidate output. Suppression cannot hide invalid native inputs/IDs.
    const native = buildAxisRectangleExtrusion({ bodyId: f.bodyId, profile: { kind: 'rectangle', id: profile.id, origin: profile.originMM, width: profile.widthMM, height: profile.heightMM }, distance });
    const original = sketchEvaluation.profiles.find(p => p.profileId === profile.id)!;
    check(sameData(original.evaluation.curve, native.profile.curve), label + ' feature #' + f.id, '$.features.profileBinding', 'actual sketch source0 and source2 extrusion input Curves must retain identical native ID/coefficients/domain');
    const bindings: SketchRectangleFeatureBindings = { sketchId: document.sketch.id, profileId: profile.id, curveId: original.evaluation.curve.id,
      authoredPointIds: copyCadData(profile.cornerIds), pointBindings: copyCadData(original.pointBindings), graphDistance: { parameterId: f.distanceParameterId, valueMM: distance },
      localParameterIds: copyCadData(native.construction.parameterIds), bodyId: f.bodyId, shellId: native.shell.id,
      faceBindings: native.shell.faces.map(face => ({ shellFaceId: face.id, localFaceId: face.bundle.topology.face.id, surfaceId: face.bundle.topology.face.surfaceId })) };
    return { featureId: f.id, profileId: f.profileId, bodyId: f.bodyId, distanceParameterId: f.distanceParameterId,
      status: f.suppressed ? 'suppressed' : 'active', evaluation: f.suppressed ? null : native, bindings };
  }));
  const report: SketchRectangleFeatureGraphReport = { kind: 'sketch-rectangle-feature-graph-evaluation', formatVersion: 0, documentId: document.id,
    parameterOrder: parameters.map(p => p.id), parameterDependencies: document.parameters.flatMap(p => p.definition.kind === 'offset' ? [{ parameterId: p.id, dependsOn: p.definition.parameterId }] : []),
    featureDependencies: document.features.map(f => ({ featureId: f.id, profileId: f.profileId, distanceParameterId: f.distanceParameterId })),
    activeBodyIds: features.filter(f => f.status === 'active').map(f => f.bodyId),
    featureStatus: features.map(f => ({ featureId: f.featureId, status: f.status, bodyId: f.bodyId, solidReport: f.evaluation?.solidReport ?? null })),
    limits: { maximumParameters: 8, maximumFeatures: 4, authoredIdCharacters: 64, snapshotValues: 8192, snapshotDepth: 10, arrayElements: 64, recordFields: 12, stringCharacters: 128, maximumJSONBytes: 131072 }, wholeGraphCertified: false };
  return copyCadData({ document, sketchEvaluation, parameters, features, report });
}
export function evaluateSketchRectangleFeatureGraph(document: SketchRectangleFeatureGraphV0): SketchRectangleFeatureGraphResult {
  const label = context(document); return guard(label, () => evaluate(admit(document, label), label));
}
export function updateSketchRectangleFeatureGraph(document: SketchRectangleFeatureGraphV0, edits: SketchRectangleFeatureGraphEdits): SketchRectangleFeatureGraphResult {
  const label = context(document);
  return guard(label, () => {
    const candidate = admit(document, label), value = snapshot(edits, label, '$edits');
    check(value !== null && typeof value === 'object' && !Array.isArray(value), label, '$edits', 'edit record required');
    const data = value as Record<string, unknown>, keys = Object.keys(data);
    check(keys.length >= 1 && keys.length <= 3 && keys.every(key => ['parameterEdits', 'sketchEdits', 'featureEdits'].includes(key)), label, '$edits', 'at least one exact nonempty parameter/sketch/feature edit array required');
    for (const key of keys) check(Array.isArray(data[key]) && (data[key] as unknown[]).length >= 1 && (data[key] as unknown[]).length <= (key === 'featureEdits' ? 4 : 8), label, '$edits.' + key, 'nonempty bounded operation array required');
    if (Object.hasOwn(data, 'parameterEdits')) {
      const targets = new Set<string>();
      for (const [index, input] of (data.parameterEdits as unknown[]).entries()) {
        const path = '$edits.parameterEdits[' + index + ']', e = record(input, ['parameterId', 'definition'], label, path), id = identifier(e.parameterId, label, path + '.parameterId');
        check(!targets.has(id), label + ' parameter #' + id, path, 'repeated parameter edit target'); targets.add(id);
        const p = candidate.parameters.find(p => p.id === id); check(!!p, label + ' parameter #' + id, path, 'existing parameter edit target required');
        p.definition = definition(e.definition, label + ' parameter #' + id, path + '.definition');
      }
    }
    if (Object.hasOwn(data, 'sketchEdits')) candidate.sketch = guard(label + ': $edits.sketchEdits', () => updateXYSketchDocument(candidate.sketch, data.sketchEdits as XYSketchDocumentEdit[]).document);
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
export function serializeSketchRectangleFeatureGraph(document: SketchRectangleFeatureGraphV0): string {
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
export function parseSketchRectangleFeatureGraph(text: string): SketchRectangleFeatureGraphV0 {
  const label = 'Sketch rectangle feature graph parse';
  return guard(label, () => {
    check(typeof text === 'string' && text.length <= 131072, label, '$text', 'JSON text within128KiB UTF-8 required'); let bytes = 0;
    for (let i = 0; i < text.length; i++) { const code = text.charCodeAt(i), next = text.charCodeAt(i + 1); if (code < 128) bytes++; else if (code < 2048) bytes += 2; else if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { bytes += 4; i++; } else bytes += 3; check(bytes <= 131072, label, '$text', 'JSON exceeds128KiB UTF-8'); }
    admitJSONText(text, label); const data = JSON.parse(text); return evaluateSketchRectangleFeatureGraph(data).document;
  });
}

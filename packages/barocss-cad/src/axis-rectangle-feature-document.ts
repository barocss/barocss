import { buildAxisRectangleExtrusion } from './axis-rectangle-extrusion.js';
import type { AxisRectangleExtrusionResult } from './axis-rectangle-extrusion.js';
import { curveDecimal } from './nurbs/curves/curve-source.js';
import { copyCadData } from './data-copy.js';

type ParameterId = '_rect_ox' | '_rect_oy' | '_rect_w' | '_rect_h' | '_rect_d';
interface LengthParameter { id: ParameterId; type: 'length'; valueMM: number }
export interface AxisRectangleFeatureDocumentV0 {
  format: 'barocss-axis-rectangle-feature'; version: 0; id: string; lengthUnit: 'mm';
  parameters: [LengthParameter, LengthParameter, LengthParameter, LengthParameter, LengthParameter];
  profile: { id: string; kind: 'xy-rectangle'; originX: '_rect_ox'; originY: '_rect_oy'; width: '_rect_w'; height: '_rect_h' };
  feature: { id: string; kind: 'axis-rectangle-extrude'; profileId: string; bodyId: string; distance: '_rect_d' };
}
export interface AxisRectangleParameterEdit { parameterId: ParameterId; valueMM: number }
export interface AxisRectangleFeatureDocumentResult {
  document: AxisRectangleFeatureDocumentV0; evaluation: AxisRectangleExtrusionResult;
  bindings: { documentId: string; featureId: string; inputProfileId: string; outputBodyId: string;
    parameterIds: { originX: '_rect_ox'; originY: '_rect_oy'; width: '_rect_w'; height: '_rect_h'; distance: '_rect_d' } };
}
const parameterIds: ParameterId[] = ['_rect_ox', '_rect_oy', '_rect_w', '_rect_h', '_rect_d'];
const bindings = { originX: '_rect_ox', originY: '_rect_oy', width: '_rect_w', height: '_rect_h', distance: '_rect_d' } as const;

/** Read diagnostic identity from data descriptors only, without invoking getters. */
function context(input: unknown): string {
  const ownId = (value: unknown): string => {
    if (value === null || typeof value !== 'object') return '?';
    const descriptor = Object.getOwnPropertyDescriptor(value, 'id');
    return descriptor && 'value' in descriptor && typeof descriptor.value === 'string' && descriptor.value.length <= 128 ? descriptor.value : '?';
  };
  const feature = input !== null && typeof input === 'object' ? Object.getOwnPropertyDescriptor(input, 'feature') : undefined;
  return 'Axis rectangle feature document ' + ownId(input) + ', feature ' + ownId(feature && 'value' in feature ? feature.value : undefined);
}
function requireValue(condition: boolean, label: string, path: string, detail: string): asserts condition {
  if (!condition) throw new Error(label + ': ' + path + ': ' + detail);
}
/** Local admission budgets do not alter any parent builder/source limits. */
function snapshot(input: unknown, label: string, rootPath: string): unknown {
  let remaining = 512;
  const copy = (value: unknown, depth: number, path: string): unknown => {
    const check = (condition: boolean, detail: string) => requireValue(condition, label, path, detail);
    check(--remaining >= 0 && depth <= 4, 'input exceeds 512 own values/depth 4');
    if (typeof value === 'number') { check(Number.isFinite(value), 'finite numeric data required'); return value; }
    if (typeof value === 'string') { check(value.length <= 128, 'string exceeds 128 characters'); return value; }
    check(value !== null && typeof value === 'object', 'ordinary numeric/string/record data required');
    const object = value as object, array = Array.isArray(object), prototype = Object.getPrototypeOf(object);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, 'foreign prototype is unsupported');
    const keys = Reflect.ownKeys(object);
    check(keys.length <= (array ? 6 : 8), 'record exceeds 8 fields or array exceeds 5 elements');
    const descriptors = Object.getOwnPropertyDescriptors(object);
    check(keys.every(key => typeof key === 'string' && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), 'accessors, symbols and nonenumerable fields are unsupported');
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= 5 && keys.length === length + 1, 'ordinary dense arrays of at most 5 elements required');
      const output: unknown[] = [];
      for (let i = 0; i < length; i++) {
        check(Object.hasOwn(descriptors, String(i)), 'sparse/extra array fields are unsupported');
        output.push(copy(descriptors[String(i)].value, depth + 1, path + '[' + i + ']'));
      }
      return output;
    }
    return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1, path + '.' + key)]));
  };
  return copy(input, 0, rootPath);
}
function record(value: unknown, fields: string[], label: string, path: string): Record<string, unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), label, path, 'ordinary own-data record required');
  const data = value as Record<string, unknown>;
  requireValue(Object.keys(data).length === fields.length && fields.every(key => Object.hasOwn(data, key)), label, path, 'exact fields required: ' + fields.join(','));
  return data;
}
function identifier(value: unknown, bound: number, label: string, path: string): string {
  requireValue(typeof value === 'string' && value.length <= bound && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), label, path, 'ASCII identifier of length 1..' + bound + ' required');
  return value;
}
function validateFamily(document: AxisRectangleFeatureDocumentV0, label: string): void {
  const values = document.parameters.map(parameter => parameter.valueMM), [x, y, width, height, distance] = values;
  for (let i = 0; i < values.length; i++) {
    requireValue(Number.isInteger(values[i]) && (i < 2 ? Math.abs(values[i]) <= 10000 : values[i] >= 1 && values[i] <= 10000), label, '$.parameters[' + i + '] #' + parameterIds[i], 'integer origin within +/-10000 or dimension in 1..10000 mm required');
  }
  requireValue(Math.abs(x + width) <= 10000, label, '$.profile.originX/width #_rect_ox/#_rect_w', 'represented X corners exceed +/-10000 mm');
  requireValue(Math.abs(y + height) <= 10000 && distance <= 10000, label, '$.profile.originY/height #_rect_oy/#_rect_h', 'represented Y/Z corners exceed +/-10000 mm');
}
function admit(input: unknown, label: string): AxisRectangleFeatureDocumentV0 {
  const data = record(snapshot(input, label, '$'), ['format', 'version', 'id', 'lengthUnit', 'parameters', 'profile', 'feature'], label, '$');
  requireValue(data.format === 'barocss-axis-rectangle-feature' && data.version === 0 && data.lengthUnit === 'mm', label, '$.format/version/lengthUnit', 'feature document v0 and mm required');
  const id = identifier(data.id, 80, label, '$.id');
  requireValue(Array.isArray(data.parameters) && data.parameters.length === 5, label, '$.parameters', 'five canonical ordered length parameters required');
  const parameters = data.parameters.map((value, i) => {
    const path = '$.parameters[' + i + '] #' + parameterIds[i], p = record(value, ['id', 'type', 'valueMM'], label, path);
    requireValue(p.id === parameterIds[i] && p.type === 'length' && typeof p.valueMM === 'number', label, path, 'matching reserved ID, length type and numeric valueMM required');
    return { id: parameterIds[i], type: 'length' as const, valueMM: p.valueMM };
  }) as AxisRectangleFeatureDocumentV0['parameters'];
  const profile = record(data.profile, ['id', 'kind', 'originX', 'originY', 'width', 'height'], label, '$.profile');
  const feature = record(data.feature, ['id', 'kind', 'profileId', 'bodyId', 'distance'], label, '$.feature');
  const profileId = identifier(profile.id, 128, label, '$.profile.id'), featureId = identifier(feature.id, 80, label, '$.feature.id'), bodyId = identifier(feature.bodyId, 80, label, '$.feature.bodyId');
  requireValue(profile.kind === 'xy-rectangle' && feature.kind === 'axis-rectangle-extrude', label, '$.profile/feature.kind', 'supported rectangle/extrusion kinds required');
  for (const key of ['originX', 'originY', 'width', 'height'] as const) requireValue(profile[key] === bindings[key], label, '$.profile.' + key, 'reference must resolve #' + bindings[key]);
  requireValue(feature.profileId === profileId && feature.distance === bindings.distance, label, '$.feature.profileId/distance', 'reference must resolve profile #' + profileId + ' and parameter #' + bindings.distance);
  const faceNames = ['x_min', 'x_max', 'y_min', 'y_max', 'z_min', 'z_max'];
  const derived = [bodyId + '_shell', ...faceNames.flatMap(name => [bodyId + '_' + name + '_surface', bodyId + '_face_' + name, bodyId + '_' + name + '_local_face', bodyId + '_' + name + '_loop',
    ...[0, 1, 2, 3].flatMap(i => ['v', 'e', 'c'].map(kind => bodyId + '_' + name + '_' + kind + i))]),
    ...Array.from({ length: 8 }, (_, i) => bodyId + '_v' + i), ...Array.from({ length: 12 }, (_, i) => bodyId + '_e' + i)];
  const ids = [id, featureId, bodyId, profileId, ...parameterIds, ...derived];
  requireValue(derived.every(value => value.length <= 128) && new Set(ids).size === ids.length, label, '$.id/profile.id/feature.id/bodyId', 'document/feature/profile/body/reserved/derived IDs must be distinct and bounded');
  const document: AxisRectangleFeatureDocumentV0 = { format: 'barocss-axis-rectangle-feature', version: 0, id, lengthUnit: 'mm', parameters,
    profile: { id: profileId, kind: 'xy-rectangle', originX: bindings.originX, originY: bindings.originY, width: bindings.width, height: bindings.height },
    feature: { id: featureId, kind: 'axis-rectangle-extrude', profileId, bodyId, distance: bindings.distance } };
  validateFamily(document, label); return document;
}
function evaluate(document: AxisRectangleFeatureDocumentV0, label: string): AxisRectangleFeatureDocumentResult {
  validateFamily(document, label);
  const values = new Map(document.parameters.map(parameter => [parameter.id, parameter.valueMM]));
  const value = (id: ParameterId): number => values.get(id)!;
  let evaluation: AxisRectangleExtrusionResult;
  try { evaluation = buildAxisRectangleExtrusion({ bodyId: document.feature.bodyId,
    profile: { kind: 'rectangle', id: document.feature.profileId, origin: [value(document.profile.originX), value(document.profile.originY)], width: value(document.profile.width), height: value(document.profile.height) },
    distance: value(document.feature.distance) }); }
  catch (error) { throw new Error(label + ': $.feature: ' + (error instanceof Error ? error.message : 'native evaluation failed'), { cause: error }); }
  requireValue(evaluation.ir.parameters.length === 5 && evaluation.ir.parameters.every((parameter, i) => parameter.id === document.parameters[i].id && parameter.quantityKind === 'length' && parameter.unit === 'mm' && Object.is(parameter.value, document.parameters[i].valueMM)), label, '$.parameters', 'actual source2 IR parameter identity/value mismatch');
  const construction = evaluation.construction;
  requireValue(construction.inputCurveId === document.profile.id && construction.outputBodyId === document.feature.bodyId && Object.is(construction.distanceMM, value(document.feature.distance))
    && Object.entries(bindings).every(([key, id]) => construction.parameterIds[key as keyof typeof bindings] === id), label, '$.feature', 'actual native construction binding mismatch');
  return { document: copyCadData(document), evaluation: copyCadData(evaluation), bindings: { documentId: document.id, featureId: document.feature.id, inputProfileId: document.profile.id, outputBodyId: document.feature.bodyId, parameterIds: { ...bindings } } };
}

/** One actual source2/native reconstruction from bounded authoring intent. */
export function evaluateAxisRectangleFeatureDocument(document: AxisRectangleFeatureDocumentV0): AxisRectangleFeatureDocumentResult {
  const label = context(document); return evaluate(admit(document, label), label);
}
/** Apply every edit before evaluating the complete candidate once. */
export function editAxisRectangleFeatureDocument(document: AxisRectangleFeatureDocumentV0, edits: AxisRectangleParameterEdit[]): AxisRectangleFeatureDocumentResult {
  const label = context(document), candidate = admit(document, label), admitted = snapshot(edits, label, '$edits');
  requireValue(Array.isArray(admitted) && admitted.length >= 1 && admitted.length <= 5, label, '$edits', '1..5 own-data edits required');
  const seen = new Set<ParameterId>();
  for (let i = 0; i < admitted.length; i++) {
    const path = '$edits[' + i + ']', edit = record(admitted[i], ['parameterId', 'valueMM'], label, path);
    requireValue(typeof edit.parameterId === 'string' && parameterIds.includes(edit.parameterId as ParameterId), label, path + '.parameterId', 'unknown parameter reference ' + (typeof edit.parameterId === 'string' ? edit.parameterId : '(string required)'));
    const parameterId = edit.parameterId as ParameterId;
    requireValue(!seen.has(parameterId) && typeof edit.valueMM === 'number', label, path + ' #' + parameterId, 'duplicate parameter or nonnumeric valueMM');
    seen.add(parameterId); candidate.parameters.find(parameter => parameter.id === parameterId)!.valueMM = edit.valueMM;
  }
  return evaluate(candidate, label);
}
/** Persist only validated authoring data, with a lossless signed-zero number encoder. */
export function serializeAxisRectangleFeatureDocument(document: AxisRectangleFeatureDocumentV0): string {
  const label = context(document), accepted = evaluate(admit(document, label), label).document;
  const encode = (value: unknown): string => {
    if (typeof value === 'number') return curveDecimal(value, label);
    if (typeof value === 'string') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(encode).join(',') + ']';
    return '{' + Object.entries(value as Record<string, unknown>).map(([key, field]) => JSON.stringify(key) + ':' + encode(field)).join(',') + '}';
  };
  const json = encode(accepted) + '\n'; // The admitted schema/IDs and numeric encoding are ASCII.
  requireValue(json.length <= 8192, label, '$serialization', 'authoring JSON exceeds 8192 UTF-8 bytes');
  return json;
}

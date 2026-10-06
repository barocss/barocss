import { buildXYPolygonRegion } from './xy-polygon-region.js';
import type { XYPolygonRegionResult, XYPolygonRegionReport } from './xy-polygon-region.js';
import { buildXYPolygonPrismPreview } from './xy-polygon-prism-preview.js';
import type { XYPolygonPrismPreviewResult } from './xy-polygon-prism-preview.js';
import { curveDecimal } from './curve-source.js';
import { copyCadData } from './data-copy.js';
import type { XYPoint } from './xy-profile.js';
import type { Model } from './types.js';
import type { PreviewPacket } from './packet.js';

export interface XYPolygonPrismDocumentV0 {
  format: 'barocss-xy-polygon-prism-feature'; version: 0; id: string; lengthUnit: 'mm';
  profile: { id: string; kind: 'xy-polygon'; points: XYPoint[] };
  feature: { id: string; kind: 'xy-polygon-prism-preview'; profileId: string; bodyId: string; distanceMM: number };
}
export interface XYPolygonPrismDocumentOptions { revision: number }
export interface XYPolygonPrismDocumentUpdate { points?: XYPoint[]; distanceMM?: number }
export interface XYPolygonPrismDocumentEvaluation { source: string; sourceVersion: 0; model: Model; profile: XYPolygonRegionResult; region: XYPolygonRegionReport; prism: XYPolygonPrismPreviewResult; packet: PreviewPacket }
export interface XYPolygonPrismDocumentResult {
  document: XYPolygonPrismDocumentV0; evaluation: XYPolygonPrismDocumentEvaluation;
  bindings: { documentId: string; featureId: string; inputProfileId: string; outputBodyId: string; meshId: string };
}
function context(input: unknown): string {
  const ownId = (value: unknown): string => { if (value === null || typeof value !== 'object') return '?'; const d = Object.getOwnPropertyDescriptor(value, 'id'); return d && 'value' in d && typeof d.value === 'string' && d.value.length <= 80 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(d.value) ? d.value : '?'; };
  const feature = input !== null && typeof input === 'object' ? Object.getOwnPropertyDescriptor(input, 'feature') : undefined;
  return 'XY polygon prism document #' + ownId(input) + ', feature #' + ownId(feature && 'value' in feature ? feature.value : undefined);
}
function check(condition: boolean, label: string, path: string, detail: string): asserts condition { if (!condition) throw new Error((label + ': ' + path.slice(0, 256) + ': ' + detail).slice(0, 512)); }
function guard<T>(label: string, work: () => T): T {
  try { return work(); } catch (error) { const message = error instanceof Error ? error.message : 'invalid document/geometry'; throw new Error((message.startsWith(label) ? message : label + ': ' + message).slice(0, 512), { cause: error }); }
}
function snapshot(input: unknown, label: string, rootPath: string): unknown {
  let remaining = 4096;
  const copy = (value: unknown, depth: number, path: string): unknown => {
    check(--remaining >= 0 && depth <= 4, label, path, 'input exceeds4096 own values/depth4');
    if (typeof value === 'number') { check(Number.isFinite(value), label, path, 'finite data required'); return value; }
    if (typeof value === 'string') { check(value.length <= 128, label, path, 'string exceeds128'); return value; }
    check(value !== null && typeof value === 'object', label, path, 'plain numeric/string/record data required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, label, path, 'foreign prototype unsupported');
    const keys = Reflect.ownKeys(value);
    check(keys.length <= (array ? 71 : 8) && keys.every(key => typeof key === 'string' && key.length <= 128), label, path, 'bounded own fields required');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.every(key => typeof key === 'string' && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), label, path, 'getters, symbols or hidden fields unsupported');
    if (array) {
      const length = descriptors.length.value as number; check(Number.isInteger(length) && length >= 0 && length <= 70 && keys.length === length + 1, label, path, 'dense bounded arrays required');
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
function identifier(value: unknown, label: string, path: string): string { check(typeof value === 'string' && value.length <= 80 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), label, path, 'ASCII ID1..80 required'); return value; }
function admit(input: unknown, label: string): XYPolygonPrismDocumentV0 {
  const data = record(snapshot(input, label, '$'), ['format', 'version', 'id', 'lengthUnit', 'profile', 'feature'], label, '$');
  check(data.format === 'barocss-xy-polygon-prism-feature' && data.version === 0 && data.lengthUnit === 'mm', label, '$.format/version/lengthUnit', 'polygon prism feature document0/mm required');
  const id = identifier(data.id, label, '$.id'), p = record(data.profile, ['id', 'kind', 'points'], label, '$.profile'), f = record(data.feature, ['id', 'kind', 'profileId', 'bodyId', 'distanceMM'], label, '$.feature');
  const profileId = identifier(p.id, label, '$.profile.id'), featureId = identifier(f.id, label, '$.feature.id'), bodyId = identifier(f.bodyId, label, '$.feature.bodyId');
  check(p.kind === 'xy-polygon' && f.kind === 'xy-polygon-prism-preview' && f.profileId === profileId, label, '$.profile/feature', 'supported kinds and actual matching profile reference required');
  check(Array.isArray(p.points) && p.points.length >= 3 && p.points.length <= 63, label, '$.profile.points', '3..63 XY points required');
  const points = p.points.map((value, i): XYPoint => { check(Array.isArray(value) && value.length === 2 && value.every(n => typeof n === 'number' && Number.isInteger(n) && Math.abs(n) <= 10000), label, '$.profile.points[' + i + ']', 'integer XY tuple within±10000 required'); return [value[0], value[1]]; });
  check(typeof f.distanceMM === 'number' && Number.isInteger(f.distanceMM) && f.distanceMM >= 1 && f.distanceMM <= 10000, label, '$.feature.distanceMM', 'positive integer distance1..10000 required');
  const derived = [bodyId + '_preview', bodyId + '_cap_preview', bodyId + '_bottom_cap', bodyId + '_top_cap', ...points.map((_, i) => bodyId + '_side_' + i)], ids = [id, profileId, featureId, bodyId, ...derived];
  check(derived.every(value => value.length <= 128) && new Set(ids).size === ids.length, label, '$.id/profile/feature', 'document/feature/profile/body/derived IDs must be distinct');
  return { format: 'barocss-xy-polygon-prism-feature', version: 0, id, lengthUnit: 'mm', profile: { id: profileId, kind: 'xy-polygon', points }, feature: { id: featureId, kind: 'xy-polygon-prism-preview', profileId, bodyId, distanceMM: f.distanceMM } };
}
function revision(options: unknown, label: string): number { const data = record(snapshot(options, label, '$options'), ['revision'], label, '$options'); check(typeof data.revision === 'number' && Number.isInteger(data.revision) && data.revision >= 0 && data.revision <= 2147483647, label, '$options.revision', 'integer revision0..2147483647 required'); return data.revision; }
function evaluate(document: XYPolygonPrismDocumentV0, displayRevision: number, label: string): XYPolygonPrismDocumentResult {
  const profile = buildXYPolygonRegion({ id: document.feature.profileId, points: document.profile.points });
  const prism = buildXYPolygonPrismPreview({ bodyId: document.feature.bodyId, profile: profile.curve, distanceMM: document.feature.distanceMM, revision: displayRevision });
  check(prism.construction.inputCurveId === document.profile.id && prism.construction.outputBodyId === document.feature.bodyId && prism.construction.distanceMM === document.feature.distanceMM, label, '$.feature', 'actual profile/body/height construction binding mismatch');
  return copyCadData({ document, evaluation: { source: profile.source, sourceVersion: 0, model: profile.model, profile, region: prism.region, prism, packet: prism.packet },
    bindings: { documentId: document.id, featureId: document.feature.id, inputProfileId: document.profile.id, outputBodyId: document.feature.bodyId, meshId: prism.packet.surfaceId } });
}
export function evaluateXYPolygonPrismDocument(document: XYPolygonPrismDocumentV0, options: XYPolygonPrismDocumentOptions): XYPolygonPrismDocumentResult { const label = context(document); return guard(label, () => evaluate(admit(document, label), revision(options, label), label)); }
export function updateXYPolygonPrismDocument(document: XYPolygonPrismDocumentV0, edits: XYPolygonPrismDocumentUpdate, options: XYPolygonPrismDocumentOptions): XYPolygonPrismDocumentResult {
  const label = context(document);
  return guard(label, () => {
    const candidate = admit(document, label), value = snapshot(edits, label, '$edits');
    check(value !== null && typeof value === 'object' && !Array.isArray(value), label, '$edits', 'edit record required'); const data = value as Record<string, unknown>, keys = Object.keys(data);
    check(keys.length >= 1 && keys.length <= 2 && keys.every(key => key === 'points' || key === 'distanceMM'), label, '$edits', 'at least one exact points/distanceMM edit required');
    if (Object.hasOwn(data, 'points')) candidate.profile.points = data.points as XYPoint[];
    if (Object.hasOwn(data, 'distanceMM')) candidate.feature.distanceMM = data.distanceMM as number;
    return evaluate(admit(candidate, label), revision(options, label), label);
  });
}
export function serializeXYPolygonPrismDocument(document: XYPolygonPrismDocumentV0): string {
  const label = context(document);
  return guard(label, () => {
    const accepted = evaluate(admit(document, label), 0, label).document;
    const encode = (value: unknown): string => typeof value === 'number' ? curveDecimal(value, label) : typeof value === 'string' ? JSON.stringify(value) : Array.isArray(value) ? '[' + value.map(encode).join(',') + ']' : '{' + Object.entries(value as Record<string, unknown>).map(([key, field]) => JSON.stringify(key) + ':' + encode(field)).join(',') + '}';
    const text = encode(accepted) + '\n'; check(text.length <= 131072, label, '$serialization', 'intent JSON exceeds128KiB'); return text;
  });
}
export function parseXYPolygonPrismDocument(text: string): XYPolygonPrismDocumentV0 {
  const label = 'XY polygon prism document parse';
  return guard(label, () => {
    check(typeof text === 'string' && text.length <= 131072, label, '$text', 'JSON text within128KiB UTF-8 required'); let bytes = 0;
    for (let i = 0; i < text.length; i++) { const code = text.charCodeAt(i), next = text.charCodeAt(i + 1); if (code < 128) bytes++; else if (code < 2048) bytes += 2; else if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { bytes += 4; i++; } else bytes += 3; check(bytes <= 131072, label, '$text', 'JSON exceeds128KiB UTF-8'); }
    const data = JSON.parse(text); return evaluateXYPolygonPrismDocument(data, { revision: 0 }).document;
  });
}

import { buildXYPolygonRegion } from './xy-polygon-region.js';
import type { XYPolygonRegionResult } from './xy-polygon-region.js';
import { buildXYPolygonPlanarFaceWithHole } from './xy-polygon-planar-face-hole.js';
import type { XYPolygonPlanarFaceWithHoleResult } from './xy-polygon-planar-face-hole.js';
import { buildXYPolygonPrismShellWithHole } from './xy-polygon-prism-shell-hole.js';
import type { XYPolygonPrismShellWithHoleResult, XYPolygonPrismShellWithHoleReport } from './xy-polygon-prism-shell-hole.js';
import { tessellateXYPolygonPrismShellWithHole } from './xy-polygon-prism-shell-hole-preview.js';
import type { XYPolygonPrismHoleShellPreviewResult, XYPolygonPrismHoleShellPreviewReport } from './xy-polygon-prism-shell-hole-preview.js';
import { curveDecimal } from './curve-source.js';
import { copyCadData } from './data-copy.js';
import type { XYPoint } from './xy-profile.js';

export interface XYPolygonPrismHoleDocumentV0 {
  format: 'barocss-xy-polygon-prism-hole-feature'; version: 0; id: string; lengthUnit: 'mm';
  profiles: { outer: { id: string; kind: 'xy-polygon'; points: XYPoint[] }; hole: { id: string; kind: 'xy-polygon'; points: XYPoint[] } };
  feature: { id: string; kind: 'xy-polygon-prism-with-hole'; outerProfileId: string; holeProfileId: string; faceId: string; bodyId: string; distanceMM: number };
}
export interface XYPolygonPrismHoleDocumentOptions { revision: number }
export interface XYPolygonPrismHoleDocumentUpdate { outerPoints?: XYPoint[]; holePoints?: XYPoint[]; distanceMM?: number }
export interface XYPolygonPrismHoleDocumentEvaluation {
  profiles: { outer: XYPolygonRegionResult; hole: XYPolygonRegionResult };
  face: XYPolygonPlanarFaceWithHoleResult; shell: XYPolygonPrismShellWithHoleResult; preview: XYPolygonPrismHoleShellPreviewResult;
}
export interface XYPolygonPrismHoleDocumentReport {
  kind: 'xy-polygon-prism-hole-document-evaluation'; formatVersion: 0;
  documentId: string; featureId: string; sourceCurveIds: { outer: string; hole: string };
  faceId: string; bodyId: string; meshId: string; revision: number;
  nativeIncidence: XYPolygonPrismShellWithHoleReport; preview: XYPolygonPrismHoleShellPreviewReport;
  limits: { authoredIdCharacters: 64; combinedVertices: 12; snapshotValues: 1024; snapshotDepth: 6;
    arrayElements: 16; recordFields: 12; stringCharacters: 128; maximumJSONBytes: 131072 };
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
}
export interface XYPolygonPrismHoleDocumentResult {
  document: XYPolygonPrismHoleDocumentV0; evaluation: XYPolygonPrismHoleDocumentEvaluation; report: XYPolygonPrismHoleDocumentReport;
}
function context(input: unknown): string {
  const ownId = (value: unknown): string => { if (value === null || typeof value !== 'object') return '?'; const d = Object.getOwnPropertyDescriptor(value, 'id'); return d && 'value' in d && typeof d.value === 'string' && d.value.length <= 64 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(d.value) ? d.value : '?'; };
  const feature = input !== null && typeof input === 'object' ? Object.getOwnPropertyDescriptor(input, 'feature') : undefined;
  return 'XY polygon prism hole document #' + ownId(input) + ', feature #' + ownId(feature && 'value' in feature ? feature.value : undefined);
}
function check(condition: boolean, label: string, path: string, detail: string): asserts condition { if (!condition) throw new Error((label + ': ' + path.slice(0, 256) + ': ' + detail).slice(0, 512)); }
function guard<T>(label: string, work: () => T): T {
  try { return work(); } catch (error) { const message = error instanceof Error ? error.message : 'invalid document/geometry'; throw new Error((message.startsWith(label) ? message : label + ': ' + message).slice(0, 512), { cause: error }); }
}
function snapshot(input: unknown, label: string, rootPath: string): unknown {
  let remaining = 1024;
  const copy = (value: unknown, depth: number, path: string): unknown => {
    check(--remaining >= 0 && depth <= 6, label, path, 'input exceeds1024 own values/depth6');
    if (typeof value === 'number') { check(Number.isFinite(value), label, path, 'finite data required'); return value; }
    if (typeof value === 'string') { check(value.length <= 128, label, path, 'string exceeds128'); return value; }
    check(value !== null && typeof value === 'object', label, path, 'plain numeric/string/record data required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, label, path, 'foreign prototype unsupported');
    const keys = Reflect.ownKeys(value);
    check(keys.length <= (array ? 17 : 12) && keys.every(key => typeof key === 'string' && key.length <= 128), label, path, 'bounded own fields required');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.every(key => typeof key === 'string' && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), label, path, 'getters, symbols or hidden fields unsupported');
    if (array) {
      const length = descriptors.length.value as number; check(Number.isInteger(length) && length >= 0 && length <= 16 && keys.length === length + 1, label, path, 'dense bounded arrays required');
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
function profile(input: unknown, label: string, path: string): XYPolygonPrismHoleDocumentV0['profiles']['outer'] {
  const data = record(input, ['id', 'kind', 'points'], label, path), id = identifier(data.id, label, path + '.id');
  check(data.kind === 'xy-polygon', label, path + '.kind', 'xy-polygon required');
  check(Array.isArray(data.points) && data.points.length >= 3 && data.points.length <= 9, label, path + '.points', '3..9 authored vertices per loop within combined12 required');
  const points = data.points.map((value, i): XYPoint => {
    check(Array.isArray(value) && value.length === 2 && value.every(n => typeof n === 'number' && Number.isInteger(n) && Math.abs(n) <= 10000), label, path + '.points[' + i + ']', 'integer XY tuple within±10000 required');
    return [value[0], value[1]];
  });
  check(points[0].some((value, axis) => value !== points.at(-1)![axis]), label, path + '.points', 'authored closing vertex must not be repeated');
  return { id, kind: 'xy-polygon', points };
}
function admit(input: unknown, label: string): XYPolygonPrismHoleDocumentV0 {
  const data = record(snapshot(input, label, '$'), ['format', 'version', 'id', 'lengthUnit', 'profiles', 'feature'], label, '$');
  check(data.format === 'barocss-xy-polygon-prism-hole-feature' && data.version === 0 && data.lengthUnit === 'mm', label, '$.format/version/lengthUnit', 'one-hole polygon prism feature document0/mm required');
  const id = identifier(data.id, label, '$.id'), profiles = record(data.profiles, ['outer', 'hole'], label, '$.profiles');
  const outer = profile(profiles.outer, label, '$.profiles.outer'), hole = profile(profiles.hole, label, '$.profiles.hole');
  check(outer.points.length + hole.points.length <= 12, label, '$.profiles', 'combined authored vertices exceed12');
  const f = record(data.feature, ['id', 'kind', 'outerProfileId', 'holeProfileId', 'faceId', 'bodyId', 'distanceMM'], label, '$.feature');
  const featureId = identifier(f.id, label, '$.feature.id'), faceId = identifier(f.faceId, label, '$.feature.faceId'), bodyId = identifier(f.bodyId, label, '$.feature.bodyId');
  check(f.kind === 'xy-polygon-prism-with-hole' && f.outerProfileId === outer.id && f.holeProfileId === hole.id, label, '$.feature', 'supported kind and actual outer/hole references required');
  check(new Set([id, outer.id, hole.id, featureId, faceId, bodyId]).size === 6, label, '$.ids', 'six authored IDs must be distinct');
  check(typeof f.distanceMM === 'number' && Number.isInteger(f.distanceMM) && f.distanceMM >= 1 && f.distanceMM <= 10000, label, '$.feature.distanceMM', 'positive integer +Z height1..10000 required');
  return { format: 'barocss-xy-polygon-prism-hole-feature', version: 0, id, lengthUnit: 'mm', profiles: { outer, hole },
    feature: { id: featureId, kind: 'xy-polygon-prism-with-hole', outerProfileId: outer.id, holeProfileId: hole.id, faceId, bodyId, distanceMM: f.distanceMM } };
}
function revision(options: unknown, label: string): number {
  const data = record(snapshot(options, label, '$options'), ['revision'], label, '$options');
  check(typeof data.revision === 'number' && Number.isInteger(data.revision) && data.revision >= 0 && data.revision <= 2147483647, label, '$options.revision', 'integer revision0..2147483647 required');
  return data.revision;
}
function evaluate(document: XYPolygonPrismHoleDocumentV0, displayRevision: number, label: string): XYPolygonPrismHoleDocumentResult {
  const outer = buildXYPolygonRegion({ id: document.profiles.outer.id, points: document.profiles.outer.points });
  const hole = buildXYPolygonRegion({ id: document.profiles.hole.id, points: document.profiles.hole.points });
  const face = buildXYPolygonPlanarFaceWithHole(outer.curve, hole.curve, { faceId: document.feature.faceId });
  const shell = buildXYPolygonPrismShellWithHole(face.bundle, { bodyId: document.feature.bodyId, distanceMM: document.feature.distanceMM });
  const meshId = document.feature.bodyId + '_preview';
  const preview = tessellateXYPolygonPrismShellWithHole(shell.shell, { meshId, revision: displayRevision });
  check(shell.shell.construction.inputFaceId === document.feature.faceId && shell.shell.construction.sourceCurveIds.outer === document.feature.outerProfileId && shell.shell.construction.sourceCurveIds.hole === document.feature.holeProfileId && shell.shell.construction.outputBodyId === document.feature.bodyId && shell.shell.construction.distanceMM === document.feature.distanceMM, label, '$.feature', 'actual original profile/face/body/height construction binding mismatch');
  const report: XYPolygonPrismHoleDocumentReport = { kind: 'xy-polygon-prism-hole-document-evaluation', formatVersion: 0,
    documentId: document.id, featureId: document.feature.id, sourceCurveIds: { outer: outer.curve.id, hole: hole.curve.id },
    faceId: document.feature.faceId, bodyId: document.feature.bodyId, meshId, revision: displayRevision,
    nativeIncidence: shell.report, preview: preview.report,
    limits: { authoredIdCharacters: 64, combinedVertices: 12, snapshotValues: 1024, snapshotDepth: 6, arrayElements: 16, recordFields: 12, stringCharacters: 128, maximumJSONBytes: 131072 },
    geometricValidity: 'not-certified', topologyCertified: false, solid: false };
  return copyCadData({ document, evaluation: { profiles: { outer, hole }, face, shell, preview }, report });
}
/** Return only an owned whole native profiles→face→shell→world mesh evaluation. */
export function evaluateXYPolygonPrismHoleDocument(document: XYPolygonPrismHoleDocumentV0, options: XYPolygonPrismHoleDocumentOptions): XYPolygonPrismHoleDocumentResult {
  const label = context(document); return guard(label, () => evaluate(admit(document, label), revision(options, label), label));
}
export function updateXYPolygonPrismHoleDocument(document: XYPolygonPrismHoleDocumentV0, edits: XYPolygonPrismHoleDocumentUpdate, options: XYPolygonPrismHoleDocumentOptions): XYPolygonPrismHoleDocumentResult {
  const label = context(document);
  return guard(label, () => {
    const candidate = admit(document, label), value = snapshot(edits, label, '$edits');
    check(value !== null && typeof value === 'object' && !Array.isArray(value), label, '$edits', 'edit record required');
    const data = value as Record<string, unknown>, keys = Object.keys(data);
    check(keys.length >= 1 && keys.length <= 3 && keys.every(key => key === 'outerPoints' || key === 'holePoints' || key === 'distanceMM'), label, '$edits', 'at least one exact outerPoints/holePoints/distanceMM edit required');
    if (Object.hasOwn(data, 'outerPoints')) candidate.profiles.outer.points = data.outerPoints as XYPoint[];
    if (Object.hasOwn(data, 'holePoints')) candidate.profiles.hole.points = data.holePoints as XYPoint[];
    if (Object.hasOwn(data, 'distanceMM')) candidate.feature.distanceMM = data.distanceMM as number;
    return evaluate(admit(candidate, label), revision(options, label), label);
  });
}
export function serializeXYPolygonPrismHoleDocument(document: XYPolygonPrismHoleDocumentV0): string {
  const label = context(document);
  return guard(label, () => {
    const accepted = evaluate(admit(document, label), 0, label).document;
    const encode = (value: unknown): string => typeof value === 'number' ? curveDecimal(value, label) : typeof value === 'string' ? JSON.stringify(value) : Array.isArray(value) ? '[' + value.map(encode).join(',') + ']' : '{' + Object.entries(value as Record<string, unknown>).map(([key, field]) => JSON.stringify(key) + ':' + encode(field)).join(',') + '}';
    const text = encode(accepted) + '\n'; check(text.length <= 131072, label, '$serialization', 'intent JSON exceeds128KiB'); return text;
  });
}

/** Admission scan only; JSON.parse remains the JSON syntax/value parser. */
function admitJSONText(text: string, label: string): void {
  const stack: { kind: '{' | '['; keys: Set<string>; count: number; nextValue: boolean }[] = [];
  let remaining = 1024;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]; if (c === ' ' || c === '\n' || c === '\r' || c === '\t') continue;
    const parent = stack.at(-1);
    if (parent?.kind === '[' && parent.nextValue && c !== ']' && c !== ',') { check(++parent.count <= 16, label, '$text[' + i + ']', 'JSON array exceeds16 elements'); parent.nextValue = false; }
    if (c === '"' || c === '{' || c === '[' || c === '-' || /[0-9tfn]/.test(c)) check(--remaining >= 0, label, '$text', 'JSON exceeds1024 lexical values/keys');
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
    if (c === '{' || c === '[') { stack.push({ kind: c, keys: new Set(), count: 0, nextValue: true }); check(stack.length <= 6, label, '$text[' + i + ']', 'JSON nesting exceeds admitted depth6'); }
    else if (c === '}' || c === ']') { check(parent?.kind === (c === '}' ? '{' : '['), label, '$text[' + i + ']', 'unbalanced JSON container'); stack.pop(); }
    else if (c === ',' && parent?.kind === '[') parent.nextValue = true;
    else if (c === '-' || /[0-9tfn]/.test(c)) { while (i + 1 < text.length && !/[ \n\r\t,}\]]/.test(text[i + 1])) i++; }
  }
  check(stack.length === 0, label, '$text', 'unclosed JSON container');
}
export function parseXYPolygonPrismHoleDocument(text: string): XYPolygonPrismHoleDocumentV0 {
  const label = 'XY polygon prism hole document parse';
  return guard(label, () => {
    check(typeof text === 'string' && text.length <= 131072, label, '$text', 'JSON text within128KiB UTF-8 required'); let bytes = 0;
    for (let i = 0; i < text.length; i++) { const code = text.charCodeAt(i), next = text.charCodeAt(i + 1); if (code < 128) bytes++; else if (code < 2048) bytes += 2; else if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { bytes += 4; i++; } else bytes += 3; check(bytes <= 131072, label, '$text', 'JSON exceeds128KiB UTF-8'); }
    admitJSONText(text, label); const data = JSON.parse(text); return evaluateXYPolygonPrismHoleDocument(data, { revision: 0 }).document;
  });
}

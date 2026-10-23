import { buildXYProfile } from './xy-profile.js';
import type { XYPoint, XYProfileRequest, XYProfileResult } from './xy-profile.js';
import { curveDecimal } from '../nurbs/curves/curve-source.js';
import { copyCadData } from '../data-copy.js';

export interface XYSketchAuthoredPoint { id: string; xy: XYPoint }
export type XYSketchProfileIntent = { id: string; kind: 'line'; points: [XYSketchAuthoredPoint, XYSketchAuthoredPoint] }
  | { id: string; kind: 'polyline'; points: XYSketchAuthoredPoint[] }
  | { id: string; kind: 'rectangle'; originMM: XYPoint; widthMM: number; heightMM: number; cornerIds: [string, string, string, string] };
export interface XYSketchDocumentV0 {
  format: 'barocss-xy-sketch'; version: 0; id: string; lengthUnit: 'mm'; workplane: 'xy'; profiles: XYSketchProfileIntent[];
}
export type XYSketchDocumentEdit = { kind: 'upsert'; profile: XYSketchProfileIntent } | { kind: 'remove'; profileId: string };
export interface XYSketchPointBinding { pointId: string; curveId: string; poleIndex: number; parameter: number }
export interface XYSketchEvaluatedProfile { profileId: string; evaluation: XYProfileResult; pointBindings: XYSketchPointBinding[] }
export interface XYSketchDocumentReport {
  kind: 'xy-sketch-document-evaluation'; formatVersion: 0; documentId: string; workplane: 'xy';
  profileCount: number; authoredPointCount: number; profileIds: string[];
  limits: { authoredIdCharacters: 64; maximumProfiles: 8; maximumAuthoredPoints: 128; maximumEdits: 8;
    snapshotValues: 4096; snapshotDepth: 8; arrayElements: 64; recordFields: 12; stringCharacters: 128; maximumJSONBytes: 131072 };
  regionCertified: false; face: false; solid: false;
}
export interface XYSketchDocumentResult { document: XYSketchDocumentV0; profiles: XYSketchEvaluatedProfile[]; report: XYSketchDocumentReport }
function context(input: unknown): string {
  const ownId = (value: unknown): string => { if (value === null || typeof value !== 'object') return '?'; const d = Object.getOwnPropertyDescriptor(value, 'id'); return d && 'value' in d && typeof d.value === 'string' && d.value.length <= 64 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(d.value) ? d.value : '?'; };
  return 'XY sketch document #' + ownId(input);
}
function check(condition: boolean, label: string, path: string, detail: string): asserts condition { if (!condition) throw new Error((label + ': ' + path.slice(0, 256) + ': ' + detail).slice(0, 512)); }
function guard<T>(label: string, work: () => T): T {
  try { return work(); } catch (error) { const message = error instanceof Error ? error.message : 'invalid document/geometry'; throw new Error((message.startsWith(label) ? message : label + ': ' + message).slice(0, 512), { cause: error }); }
}
function snapshot(input: unknown, label: string, rootPath: string): unknown {
  let remaining = 4096;
  const copy = (value: unknown, depth: number, path: string): unknown => {
    check(--remaining >= 0 && depth <= 8, label, path, 'input exceeds4096 own values/depth8');
    if (typeof value === 'number') { check(Number.isFinite(value), label, path, 'finite data required'); return value; }
    if (typeof value === 'string') { check(value.length <= 128, label, path, 'string exceeds128'); return value; }
    check(value !== null && typeof value === 'object', label, path, 'plain numeric/string/record data required');
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
function xy(value: unknown, label: string, path: string): XYPoint {
  check(Array.isArray(value) && value.length === 2 && value.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 10000), label, path, 'finite XY tuple within±10000mm required');
  return [value[0], value[1]];
}
function profile(input: unknown, label: string, path: string): XYSketchProfileIntent {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), label, path, 'profile record required');
  const kind = (input as Record<string, unknown>).kind;
  check(kind === 'line' || kind === 'polyline' || kind === 'rectangle', label, path + '.kind', 'line/polyline/rectangle required');
  const data = record(input, kind === 'rectangle' ? ['id', 'kind', 'originMM', 'widthMM', 'heightMM', 'cornerIds'] : ['id', 'kind', 'points'], label, path);
  const id = identifier(data.id, label, path + '.id'), owner = label + ' profile #' + id;
  if (kind === 'rectangle') {
    const originMM = xy(data.originMM, owner, path + '.originMM');
    check(typeof data.widthMM === 'number' && data.widthMM >= .001 && data.widthMM <= 10000, owner, path + '.widthMM', 'rectangle width0.001..10000mm required');
    check(typeof data.heightMM === 'number' && data.heightMM >= .001 && data.heightMM <= 10000, owner, path + '.heightMM', 'rectangle height0.001..10000mm required');
    check(Array.isArray(data.cornerIds) && data.cornerIds.length === 4, owner, path + '.cornerIds', 'exactly four stable authored corner IDs required');
    const cornerIds = data.cornerIds.map((value, index) => identifier(value, owner, path + '.cornerIds[' + index + ']')) as [string, string, string, string];
    return { id, kind, originMM, widthMM: data.widthMM, heightMM: data.heightMM, cornerIds };
  }
  check(Array.isArray(data.points) && data.points.length >= 2 && data.points.length <= 64 && (kind !== 'line' || data.points.length === 2), owner, path + '.points', 'line2 or polyline2..64 authored points required');
  const points = data.points.map((value, index): XYSketchAuthoredPoint => {
    const pointPath = path + '.points[' + index + ']', point = record(value, ['id', 'xy'], owner, pointPath);
    return { id: identifier(point.id, owner, pointPath + '.id'), xy: xy(point.xy, owner, pointPath + '.xy') };
  });
  return kind === 'line' ? { id, kind, points: points as [XYSketchAuthoredPoint, XYSketchAuthoredPoint] } : { id, kind, points };
}
function authoredIds(p: XYSketchProfileIntent): string[] { return p.kind === 'rectangle' ? p.cornerIds : p.points.map(point => point.id); }
function admit(input: unknown, label: string): XYSketchDocumentV0 {
  const data = record(snapshot(input, label, '$'), ['format', 'version', 'id', 'lengthUnit', 'workplane', 'profiles'], label, '$');
  check(data.format === 'barocss-xy-sketch' && data.version === 0 && data.lengthUnit === 'mm' && data.workplane === 'xy', label, '$.format/version/lengthUnit/workplane', 'XY sketch0/mm/xy required');
  const id = identifier(data.id, label, '$.id');
  check(Array.isArray(data.profiles) && data.profiles.length <= 8, label, '$.profiles', 'ordered0..8 profiles required');
  const profiles = data.profiles.map((value, index) => profile(value, label, '$.profiles[' + index + ']'));
  const used = new Set([id]); let pointCount = 0;
  for (const p of profiles) {
    for (const value of [p.id, ...authoredIds(p)]) {
      check(!used.has(value), label + ' profile #' + p.id, '$.ids #' + value, 'document/profile/authored point/corner IDs must be globally distinct'); used.add(value);
    }
    pointCount += authoredIds(p).length;
  }
  check(pointCount <= 128, label, '$.profiles', 'combined authored point/corner count exceeds128');
  return { format: 'barocss-xy-sketch', version: 0, id, lengthUnit: 'mm', workplane: 'xy', profiles };
}
function evaluate(document: XYSketchDocumentV0, label: string): XYSketchDocumentResult {
  const profiles = document.profiles.map((p): XYSketchEvaluatedProfile => guard(label + ' profile #' + p.id + ': $.profiles.native', () => {
    const request: XYProfileRequest = p.kind === 'rectangle' ? { id: p.id, kind: p.kind, origin: p.originMM, width: p.widthMM, height: p.heightMM }
      : p.kind === 'line' ? { id: p.id, kind: p.kind, points: p.points.map(point => point.xy) as [XYPoint, XYPoint] }
        : { id: p.id, kind: p.kind, points: p.points.map(point => point.xy) };
    const evaluation = buildXYProfile(request), ids = authoredIds(p), native = evaluation.curve, domain = evaluation.report.parameterDomain;
    check(native.id === p.id && native.controlPoints.length === ids.length + (p.kind === 'rectangle' ? 1 : 0), label, '$.profiles #' + p.id, 'actual native Curve ID/pole count binding mismatch');
    const pointBindings = native.controlPoints.map((_, poleIndex): XYSketchPointBinding => {
      const parameter = native.knots[poleIndex + native.degree];
      check(Number.isFinite(parameter) && parameter >= domain.min && parameter <= domain.max, label, '$.profiles #' + p.id, 'actual native knot/report parameter binding mismatch');
      return { pointId: ids[poleIndex === ids.length ? 0 : poleIndex], curveId: native.id, poleIndex, parameter };
    });
    return { profileId: p.id, evaluation, pointBindings };
  }));
  const report: XYSketchDocumentReport = { kind: 'xy-sketch-document-evaluation', formatVersion: 0, documentId: document.id, workplane: 'xy',
    profileCount: profiles.length, authoredPointCount: document.profiles.reduce((count, p) => count + authoredIds(p).length, 0), profileIds: profiles.map(p => p.profileId),
    limits: { authoredIdCharacters: 64, maximumProfiles: 8, maximumAuthoredPoints: 128, maximumEdits: 8, snapshotValues: 4096, snapshotDepth: 8, arrayElements: 64, recordFields: 12, stringCharacters: 128, maximumJSONBytes: 131072 },
    regionCertified: false, face: false, solid: false };
  return copyCadData({ document, profiles, report });
}
/** Stable authored identities backed by actual original source0 profile compilation. */
export function evaluateXYSketchDocument(document: XYSketchDocumentV0): XYSketchDocumentResult {
  const label = context(document); return guard(label, () => evaluate(admit(document, label), label));
}
export function updateXYSketchDocument(document: XYSketchDocumentV0, edits: XYSketchDocumentEdit[]): XYSketchDocumentResult {
  const label = context(document);
  return guard(label, () => {
    const candidate = admit(document, label), data = snapshot(edits, label, '$edits');
    check(Array.isArray(data) && data.length >= 1 && data.length <= 8, label, '$edits', 'ordered1..8 operations required');
    const targets = new Set<string>();
    for (const [index, value] of data.entries()) {
      const path = '$edits[' + index + ']';
      check(value !== null && typeof value === 'object' && !Array.isArray(value), label, path, 'operation record required');
      const kind = (value as Record<string, unknown>).kind;
      check(kind === 'upsert' || kind === 'remove', label, path + '.kind', 'upsert/remove required');
      const operation = record(value, kind === 'upsert' ? ['kind', 'profile'] : ['kind', 'profileId'], label, path);
      const next = kind === 'upsert' ? profile(operation.profile, label, path + '.profile') : undefined;
      const id = next ? next.id : identifier(operation.profileId, label, path + '.profileId');
      check(!targets.has(id), label + ' profile #' + id, path, 'target profile appears more than once in batch'); targets.add(id);
      const existing = candidate.profiles.findIndex(p => p.id === id);
      if (next) {
        if (existing >= 0) {
          const previous = candidate.profiles[existing], before = authoredIds(previous), after = authoredIds(next);
          check(previous.kind === next.kind && before.length === after.length && before.every((value, i) => value === after[i]), label + ' profile #' + id, path + '.profile', 'existing kind/point count/point or corner IDs/order cannot change; remove then add a fresh-ID profile in a later transaction');
          candidate.profiles[existing] = next;
        } else candidate.profiles.push(next);
      } else {
        check(existing >= 0, label + ' profile #' + id, path + '.profileId', 'remove must resolve existing profile'); candidate.profiles.splice(existing, 1);
      }
    }
    return evaluate(admit(candidate, label), label);
  });
}
export function serializeXYSketchDocument(document: XYSketchDocumentV0): string {
  const label = context(document);
  return guard(label, () => {
    const accepted = evaluate(admit(document, label), label).document;
    const encode = (value: unknown): string => typeof value === 'number' ? curveDecimal(value, label) : typeof value === 'string' ? JSON.stringify(value) : Array.isArray(value) ? '[' + value.map(encode).join(',') + ']' : '{' + Object.entries(value as Record<string, unknown>).map(([key, field]) => JSON.stringify(key) + ':' + encode(field)).join(',') + '}';
    const text = encode(accepted) + '\n'; check(text.length <= 131072, label, '$serialization', 'intent JSON exceeds128KiB'); return text;
  });
}

/** Admission scan only; JSON.parse remains the JSON syntax/value parser. */
function admitJSONText(text: string, label: string): void {
  const stack: { kind: '{' | '['; keys: Set<string>; count: number; nextValue: boolean }[] = [];
  let remaining = 4096;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]; if (c === ' ' || c === '\n' || c === '\r' || c === '\t') continue;
    const parent = stack.at(-1);
    if (parent?.kind === '[' && parent.nextValue && c !== ']' && c !== ',') { check(++parent.count <= 64, label, '$text[' + i + ']', 'JSON array exceeds64 elements'); parent.nextValue = false; }
    if (c === '"' || c === '{' || c === '[' || c === '-' || /[0-9tfn]/.test(c)) check(--remaining >= 0, label, '$text', 'JSON exceeds4096 lexical values/keys');
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
    if (c === '{' || c === '[') { stack.push({ kind: c, keys: new Set(), count: 0, nextValue: true }); check(stack.length <= 8, label, '$text[' + i + ']', 'JSON nesting exceeds admitted depth8'); }
    else if (c === '}' || c === ']') { check(parent?.kind === (c === '}' ? '{' : '['), label, '$text[' + i + ']', 'unbalanced JSON container'); stack.pop(); }
    else if (c === ',' && parent?.kind === '[') parent.nextValue = true;
    else if (c === '-' || /[0-9tfn]/.test(c)) { while (i + 1 < text.length && !/[ \n\r\t,}\]]/.test(text[i + 1])) i++; }
  }
  check(stack.length === 0, label, '$text', 'unclosed JSON container');
}
export function parseXYSketchDocument(text: string): XYSketchDocumentV0 {
  const label = 'XY sketch document parse';
  return guard(label, () => {
    check(typeof text === 'string' && text.length <= 131072, label, '$text', 'JSON text within128KiB UTF-8 required'); let bytes = 0;
    for (let i = 0; i < text.length; i++) { const code = text.charCodeAt(i), next = text.charCodeAt(i + 1); if (code < 128) bytes++; else if (code < 2048) bytes += 2; else if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { bytes += 4; i++; } else bytes += 3; check(bytes <= 131072, label, '$text', 'JSON exceeds128KiB UTF-8'); }
    admitJSONText(text, label); const data = JSON.parse(text); return evaluateXYSketchDocument(data).document;
  });
}

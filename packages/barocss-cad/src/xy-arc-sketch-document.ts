import { buildXYArc } from './xy-arc.js';
import type { XYArcRequest, XYArcResult } from './xy-arc.js';
import { curveDomain } from './math.js';
import { curveDecimal } from './curve-source.js';
import { copyCadData } from './data-copy.js';
import type { XYPoint } from './xy-profile.js';
import type { Point } from './types.js';

export interface XYArcSketchRadius { id: string; valueMM: number }
export type XYArcSketchProfileIntent = { id: string; kind: 'circle'; centerId: string; centerMM: XYPoint; radius: XYArcSketchRadius; seamId: string }
  | { id: string; kind: 'quarter-arc'; centerId: string; centerMM: XYPoint; radius: XYArcSketchRadius; quadrant: 0 | 1 | 2 | 3; endpointIds: [string, string] };
export interface XYArcSketchDocumentV0 {
  format: 'barocss-xy-arc-sketch'; version: 0; id: string; lengthUnit: 'mm'; workplane: 'xy'; profiles: XYArcSketchProfileIntent[];
}
export type XYArcSketchDocumentEdit = { kind: 'upsert'; profile: XYArcSketchProfileIntent } | { kind: 'remove'; profileId: string };
export interface XYArcSketchCurvePointBinding { pointId: string; curveId: string; poleIndex: number; parameter: number; role: 'start' | 'end' | 'seam' }
export interface XYArcSketchBindings {
  curveId: string; nativeDomain: [number, number]; center: { pointId: string; pointMM: Point; role: 'center' };
  radius: { parameterId: string; valueMM: number }; curvePoints: XYArcSketchCurvePointBinding[];
}
export interface XYArcSketchEvaluatedProfile { profileId: string; evaluation: XYArcResult; bindings: XYArcSketchBindings }
export interface XYArcSketchDocumentReport {
  kind: 'xy-arc-sketch-document-evaluation'; formatVersion: 0; documentId: string; workplane: 'xy';
  profileCount: number; profileIds: string[];
  profileStates: { profileId: string; endpointClosed: boolean; periodic: false; nativeDomain: [number, number] }[];
  limits: { authoredIdCharacters: 64; maximumProfiles: 8; maximumEdits: 8; snapshotValues: 4096; snapshotDepth: 8;
    arrayElements: 64; recordFields: 12; stringCharacters: 128; maximumJSONBytes: 131072 };
  periodic: false; regionCertified: false; face: false; solid: false;
}
export interface XYArcSketchDocumentResult { document: XYArcSketchDocumentV0; profiles: XYArcSketchEvaluatedProfile[]; report: XYArcSketchDocumentReport }
function context(input: unknown): string {
  const ownId = (value: unknown): string => { if (value === null || typeof value !== 'object') return '?'; const d = Object.getOwnPropertyDescriptor(value, 'id'); return d && 'value' in d && typeof d.value === 'string' && d.value.length <= 64 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(d.value) ? d.value : '?'; };
  return 'XY arc sketch document #' + ownId(input);
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
function profile(input: unknown, label: string, path: string): XYArcSketchProfileIntent {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), label, path, 'arc profile record required');
  const kind = (input as Record<string, unknown>).kind;
  check(kind === 'circle' || kind === 'quarter-arc', label, path + '.kind', 'circle/quarter-arc required');
  const data = record(input, kind === 'circle' ? ['id', 'kind', 'centerId', 'centerMM', 'radius', 'seamId'] : ['id', 'kind', 'centerId', 'centerMM', 'radius', 'quadrant', 'endpointIds'], label, path);
  const id = identifier(data.id, label, path + '.id'), owner = label + ' profile #' + id;
  const centerId = identifier(data.centerId, owner, path + '.centerId'), centerMM = xy(data.centerMM, owner, path + '.centerMM');
  const r = record(data.radius, ['id', 'valueMM'], owner, path + '.radius'), radiusId = identifier(r.id, owner, path + '.radius.id');
  check(typeof r.valueMM === 'number' && r.valueMM >= .001 && r.valueMM <= 10000, owner, path + '.radius.valueMM', 'radius0.001..10000mm required');
  const radius: XYArcSketchRadius = { id: radiusId, valueMM: r.valueMM };
  if (kind === 'circle') return { id, kind, centerId, centerMM, radius, seamId: identifier(data.seamId, owner, path + '.seamId') };
  check(typeof data.quadrant === 'number' && Number.isInteger(data.quadrant) && data.quadrant >= 0 && data.quadrant <= 3, owner, path + '.quadrant', 'integer original CCW quadrant0..3 required');
  check(Array.isArray(data.endpointIds) && data.endpointIds.length === 2, owner, path + '.endpointIds', 'exactly two ordered authored start/end IDs required');
  const endpointIds = data.endpointIds.map((value, index) => identifier(value, owner, path + '.endpointIds[' + index + ']')) as [string, string];
  return { id, kind, centerId, centerMM, radius, quadrant: data.quadrant as 0 | 1 | 2 | 3, endpointIds };
}
function authoredIds(p: XYArcSketchProfileIntent): string[] { return [p.centerId, p.radius.id, ...(p.kind === 'circle' ? [p.seamId] : p.endpointIds)]; }
function admit(input: unknown, label: string): XYArcSketchDocumentV0 {
  const data = record(snapshot(input, label, '$'), ['format', 'version', 'id', 'lengthUnit', 'workplane', 'profiles'], label, '$');
  check(data.format === 'barocss-xy-arc-sketch' && data.version === 0 && data.lengthUnit === 'mm' && data.workplane === 'xy', label, '$.format/version/lengthUnit/workplane', 'XY arc sketch0/mm/xy required');
  const id = identifier(data.id, label, '$.id');
  check(Array.isArray(data.profiles) && data.profiles.length <= 8, label, '$.profiles', 'ordered0..8 circle/quarter-arc profiles required');
  const profiles = data.profiles.map((value, index) => profile(value, label, '$.profiles[' + index + ']')), used = new Set([id]);
  for (const p of profiles) for (const value of [p.id, ...authoredIds(p)]) {
    check(!used.has(value), label + ' profile #' + p.id, '$.ids #' + value, 'document/profile/center/radius/endpoint/seam IDs must be globally distinct'); used.add(value);
  }
  return { format: 'barocss-xy-arc-sketch', version: 0, id, lengthUnit: 'mm', workplane: 'xy', profiles };
}
function evaluate(document: XYArcSketchDocumentV0, label: string): XYArcSketchDocumentResult {
  const profiles = document.profiles.map((p): XYArcSketchEvaluatedProfile => guard(label + ' profile #' + p.id + ': $.profiles.native', () => {
    const request: XYArcRequest = p.kind === 'circle' ? { kind: p.kind, id: p.id, center: p.centerMM, radius: p.radius.valueMM }
      : { kind: p.kind, id: p.id, center: p.centerMM, radius: p.radius.valueMM, quadrant: p.quadrant };
    const evaluation = buildXYArc(request), curve = evaluation.curve, nativeDomain = curveDomain(curve), nativeReport = evaluation.report;
    check(curve.id === p.id && curve.controlPoints.length === (p.kind === 'circle' ? 9 : 3) && nativeDomain[0] === nativeReport.parameterDomain.min && nativeDomain[1] === nativeReport.parameterDomain.max && nativeReport.periodic === false, label, '$.profiles #' + p.id, 'actual original Curve/pole count/domain/nonperiodic report binding required');
    const curvePoints: XYArcSketchCurvePointBinding[] = p.kind === 'circle' ? [
      { pointId: p.seamId, curveId: curve.id, poleIndex: 0, parameter: nativeDomain[0], role: 'seam' },
      { pointId: p.seamId, curveId: curve.id, poleIndex: curve.controlPoints.length - 1, parameter: nativeDomain[1], role: 'seam' }
    ] : [
      { pointId: p.endpointIds[0], curveId: curve.id, poleIndex: 0, parameter: nativeDomain[0], role: 'start' },
      { pointId: p.endpointIds[1], curveId: curve.id, poleIndex: curve.controlPoints.length - 1, parameter: nativeDomain[1], role: 'end' }
    ];
    // Centre/radius are construction intent, never fabricated native poles/parameters.
    const bindings: XYArcSketchBindings = { curveId: curve.id, nativeDomain,
      center: { pointId: p.centerId, pointMM: [p.centerMM[0], p.centerMM[1], 0], role: 'center' },
      radius: { parameterId: p.radius.id, valueMM: p.radius.valueMM }, curvePoints };
    return { profileId: p.id, evaluation, bindings };
  }));
  const report: XYArcSketchDocumentReport = { kind: 'xy-arc-sketch-document-evaluation', formatVersion: 0, documentId: document.id, workplane: 'xy',
    profileCount: profiles.length, profileIds: profiles.map(p => p.profileId),
    profileStates: profiles.map(p => ({ profileId: p.profileId, endpointClosed: p.evaluation.report.endpointClosed, periodic: false, nativeDomain: p.bindings.nativeDomain })),
    limits: { authoredIdCharacters: 64, maximumProfiles: 8, maximumEdits: 8, snapshotValues: 4096, snapshotDepth: 8, arrayElements: 64, recordFields: 12, stringCharacters: 128, maximumJSONBytes: 131072 },
    periodic: false, regionCertified: false, face: false, solid: false };
  return copyCadData({ document, profiles, report });
}
export function evaluateXYArcSketchDocument(document: XYArcSketchDocumentV0): XYArcSketchDocumentResult {
  const label = context(document); return guard(label, () => evaluate(admit(document, label), label));
}
export function updateXYArcSketchDocument(document: XYArcSketchDocumentV0, edits: XYArcSketchDocumentEdit[]): XYArcSketchDocumentResult {
  const label = context(document);
  return guard(label, () => {
    const candidate = admit(document, label), data = snapshot(edits, label, '$edits');
    check(Array.isArray(data) && data.length >= 1 && data.length <= 8, label, '$edits', 'ordered1..8 arc operations required');
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
          check(previous.kind === next.kind && before.length === after.length && before.every((value, i) => value === after[i]), label + ' profile #' + id, path + '.profile', 'existing kind/center/radius/end-or-seam identities and order must remain; remove then later add fresh-ID authoring intent');
          candidate.profiles[existing] = next;
        } else candidate.profiles.push(next);
      } else {
        check(existing >= 0, label + ' profile #' + id, path + '.profileId', 'remove must resolve existing profile'); candidate.profiles.splice(existing, 1);
      }
    }
    return evaluate(admit(candidate, label), label);
  });
}
export function serializeXYArcSketchDocument(document: XYArcSketchDocumentV0): string {
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
export function parseXYArcSketchDocument(text: string): XYArcSketchDocumentV0 {
  const label = 'XY arc sketch document parse';
  return guard(label, () => {
    check(typeof text === 'string' && text.length <= 131072, label, '$text', 'JSON text within128KiB UTF-8 required'); let bytes = 0;
    for (let i = 0; i < text.length; i++) { const code = text.charCodeAt(i), next = text.charCodeAt(i + 1); if (code < 128) bytes++; else if (code < 2048) bytes += 2; else if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { bytes += 4; i++; } else bytes += 3; check(bytes <= 131072, label, '$text', 'JSON exceeds128KiB UTF-8'); }
    admitJSONText(text, label); const data = JSON.parse(text); return evaluateXYArcSketchDocument(data).document;
  });
}

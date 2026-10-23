import { buildZAxisRevolvedSurface } from './nurbs/surfaces/z-axis-revolved-surface.js';
import type { ZAxisRevolvedSurfaceResult, ZAxisRevolvedSurfaceReport } from './nurbs/surfaces/z-axis-revolved-surface.js';
import { curveDecimal } from './nurbs/curves/curve-source.js';
import { copyCadData } from './data-copy.js';
import type { Curve } from './types.js';

export interface ZAxisRevolveFeatureDocumentV0 {
  format: 'barocss-z-axis-revolve-feature'; version: 0; id: string; lengthUnit: 'mm'; meridian: Curve;
  feature: { id: string; kind: 'z-axis-revolve'; surfaceId: string };
}
export interface ZAxisRevolvePoleEdit { index: number; radiusMM?: number; zMM?: number; weight?: number }
export interface ZAxisRevolveFeatureDocumentEdits { poleEdits: ZAxisRevolvePoleEdit[] }
export interface ZAxisRevolveFeatureDocumentReport {
  kind: 'z-axis-revolve-document-evaluation'; formatVersion: 0; documentId: string;
  bindings: { documentId: string; featureId: string; meridianId: string; surfaceId: string; modelName: string; sourceVersion: 0;
    meridianDomain: [number, number]; surfaceDomains: ZAxisRevolvedSurfaceReport['domains']['surface'];
    poleRows: { meridianPoleIndex: number; surfaceRowIndex: number; angularPoleCount: 9 }[] };
  native: ZAxisRevolvedSurfaceReport; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { authoredIdCharacters: 48; snapshotValues: 4096; snapshotDepth: 8; arrayElements: 64; recordFields: 12; stringCharacters: 128; maximumJSONBytes: 131072 };
}
export interface ZAxisRevolveFeatureDocumentResult { document: ZAxisRevolveFeatureDocumentV0; native: ZAxisRevolvedSurfaceResult; report: ZAxisRevolveFeatureDocumentReport }
function context(input: unknown): string {
  const d = input !== null && typeof input === 'object' ? Object.getOwnPropertyDescriptor(input, 'id') : undefined;
  const id = d && 'value' in d && typeof d.value === 'string' && d.value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(d.value) ? d.value : '?';
  return 'Z-axis revolve document #' + id;
}
function check(condition: boolean, label: string, path: string, detail: string): asserts condition { if (!condition) throw new Error((label + ': ' + path.slice(0, 256) + ': ' + detail).slice(0, 1024)); }
function guard<T>(label: string, work: () => T): T {
  try { return work(); } catch (error) { const message = error instanceof Error ? error.message : 'invalid document/native geometry'; throw new Error((message.startsWith(label) ? message : label + ': ' + message).slice(0, 1024), { cause: error }); }
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
function identifier(value: unknown, label: string, path: string): string { check(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), label, path, 'ASCII ID1..48 required'); return value; }

function admit(input: unknown, label: string): ZAxisRevolveFeatureDocumentV0 {
  const data = record(snapshot(input, label, '$'), ['format', 'version', 'id', 'lengthUnit', 'meridian', 'feature'], label, '$');
  check(data.format === 'barocss-z-axis-revolve-feature' && data.version === 0 && data.lengthUnit === 'mm', label, '$.format/version/lengthUnit', 'distinct revolve feature0/mm required');
  const documentId = identifier(data.id, label, '$.id'), f = record(data.feature, ['id', 'kind', 'surfaceId'], label, '$.feature');
  check(f.kind === 'z-axis-revolve', label, '$.feature.kind', 'fixed global full-turn Z-revolve required');
  const featureId = identifier(f.id, label, '$.feature.id'), surfaceId = identifier(f.surfaceId, label, '$.feature.surfaceId');
  const m = record(data.meridian, ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights'], label, '$.meridian'), meridianId = identifier(m.id, label, '$.meridian.id');
  check(m.kind === 'curve' && typeof m.degree === 'number', label, '$.meridian.kind/degree', 'original numeric-degree Curve required');
  check(Array.isArray(m.knots) && m.knots.every(k => typeof k === 'number'), label, '$.meridian.knots', 'original numeric knot array required');
  check(Array.isArray(m.controlPoints) && m.controlPoints.length >= 2 && m.controlPoints.length <= 16 && m.controlPoints.every(p => Array.isArray(p) && p.length === 3 && p.every(n => typeof n === 'number')), label, '$.meridian.controlPoints', '2..16 original XYZ pole tuples required');
  check(Array.isArray(m.weights) && m.weights.length === m.controlPoints.length && m.weights.every(w => typeof w === 'number'), label, '$.meridian.weights', 'one original numeric weight per pole required');
  check(new Set([documentId, featureId, meridianId, surfaceId]).size === 4, label, '$.ids', 'document/feature/meridian/surface IDs must be distinct');
  return { format: 'barocss-z-axis-revolve-feature', version: 0, id: documentId, lengthUnit: 'mm',
    meridian: { kind: 'curve', id: meridianId, degree: m.degree, knots: m.knots, controlPoints: m.controlPoints, weights: m.weights } as Curve,
    feature: { id: featureId, kind: 'z-axis-revolve', surfaceId } };
}
function evaluate(document: ZAxisRevolveFeatureDocumentV0, label: string): ZAxisRevolveFeatureDocumentResult {
  const native = guard(label + ' feature #' + document.feature.id, () => buildZAxisRevolvedSurface(document.meridian, { surfaceId: document.feature.surfaceId }));
  document.meridian = copyCadData(native.meridian);
  return copyCadData({ document, native, report: { kind: 'z-axis-revolve-document-evaluation', formatVersion: 0, documentId: document.id,
    bindings: { documentId: document.id, featureId: document.feature.id, meridianId: document.meridian.id, surfaceId: native.surface.id,
      modelName: native.model.name, sourceVersion: native.sourceVersion, meridianDomain: native.report.domains.meridian, surfaceDomains: native.report.domains.surface,
      poleRows: document.meridian.controlPoints.map((_, index) => ({ meridianPoleIndex: index, surfaceRowIndex: index, angularPoleCount: 9 })) },
    native: native.report, geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    limits: { authoredIdCharacters: 48, snapshotValues: 4096, snapshotDepth: 8, arrayElements: 64, recordFields: 12, stringCharacters: 128, maximumJSONBytes: 131072 } } });
}
export function evaluateZAxisRevolveFeatureDocument(document: ZAxisRevolveFeatureDocumentV0): ZAxisRevolveFeatureDocumentResult {
  const label = context(document); return guard(label, () => evaluate(admit(document, label), label));
}
export function updateZAxisRevolveFeatureDocument(document: ZAxisRevolveFeatureDocumentV0, edits: ZAxisRevolveFeatureDocumentEdits): ZAxisRevolveFeatureDocumentResult {
  const label = context(document);
  return guard(label, () => {
    const candidate = admit(document, label), data = record(snapshot(edits, label, '$edits'), ['poleEdits'], label, '$edits');
    check(Array.isArray(data.poleEdits) && data.poleEdits.length >= 1 && data.poleEdits.length <= 16, label, '$edits.poleEdits', '1..16 pole edits required');
    const targets = new Set<number>();
    for (const [i, input] of data.poleEdits.entries()) {
      const path = '$edits.poleEdits[' + i + ']';
      check(input !== null && typeof input === 'object' && !Array.isArray(input), label, path, 'pole edit record required');
      const e = input as Record<string, unknown>, keys = Object.keys(e);
      check(Object.hasOwn(e, 'index') && keys.length >= 2 && keys.length <= 4 && keys.every(k => ['index', 'radiusMM', 'zMM', 'weight'].includes(k)), label, path, 'index and at least one radius/z/weight scalar only');
      check(typeof e.index === 'number' && Number.isInteger(e.index) && e.index >= 0 && e.index < candidate.meridian.controlPoints.length, label, path + '.index', 'existing pole index required');
      check(!targets.has(e.index), label, path + '.index', 'duplicate pole target'); targets.add(e.index);
      for (const key of ['radiusMM', 'zMM', 'weight']) if (Object.hasOwn(e, key)) check(typeof e[key] === 'number' && Number.isFinite(e[key]), label, path + '.' + key, 'finite scalar required');
      if (Object.hasOwn(e, 'radiusMM')) candidate.meridian.controlPoints[e.index][0] = e.radiusMM as number;
      if (Object.hasOwn(e, 'zMM')) candidate.meridian.controlPoints[e.index][2] = e.zMM as number;
      if (Object.hasOwn(e, 'weight')) candidate.meridian.weights[e.index] = e.weight as number;
    }
    // All original pole changes are present before the sole actual610 evaluation.
    return evaluate(candidate, label);
  });
}
export function serializeZAxisRevolveFeatureDocument(document: ZAxisRevolveFeatureDocumentV0): string {
  const label = context(document);
  return guard(label, () => {
    const accepted = evaluate(admit(document, label), label).document;
    const encode = (value: unknown): string => typeof value === 'number' ? curveDecimal(value, label) : typeof value === 'string' ? JSON.stringify(value) : Array.isArray(value) ? '[' + value.map(encode).join(',') + ']' : '{' + Object.entries(value as Record<string, unknown>).map(([key, field]) => JSON.stringify(key) + ':' + encode(field)).join(',') + '}';
    const text = encode(accepted) + '\n'; check(text.length <= 131072, label, '$serialization', 'authored JSON exceeds128KiB'); return text;
  });
}
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
export function parseZAxisRevolveFeatureDocument(text: string): ZAxisRevolveFeatureDocumentV0 {
  const label = 'Z-axis revolve document parse';
  return guard(label, () => {
    check(typeof text === 'string' && text.length <= 131072, label, '$text', 'JSON text within128KiB UTF-8 required'); let bytes = 0;
    for (let i = 0; i < text.length; i++) { const code = text.charCodeAt(i), next = text.charCodeAt(i + 1); if (code < 128) bytes++; else if (code < 2048) bytes += 2; else if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { bytes += 4; i++; } else bytes += 3; check(bytes <= 131072, label, '$text', 'JSON exceeds128KiB UTF-8'); }
    admitJSONText(text, label); return evaluateZAxisRevolveFeatureDocument(JSON.parse(text)).document;
  });
}

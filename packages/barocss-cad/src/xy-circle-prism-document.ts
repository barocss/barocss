import { evaluateXYArcSketchDocument, updateXYArcSketchDocument } from './xy-arc-sketch-document.js';
import type { XYArcSketchDocumentV0, XYArcSketchDocumentResult } from './xy-arc-sketch-document.js';
import { buildXYCirclePrismShell } from './xy-circle-prism-shell.js';
import type { XYCirclePrismShellResult, XYCirclePrismShellReport } from './xy-circle-prism-shell.js';
import { curveDecimal } from './nurbs/curves/curve-source.js';
import { copyCadData } from './data-copy.js';
import type { XYPoint } from './xy-profile.js';
import type { Point } from './types.js';
import { same as sameData } from './structural-equality.js';

export interface XYCirclePrismDocumentV0 {
  format: 'barocss-xy-circle-prism-feature'; version: 0; id: string; lengthUnit: 'mm'; sketch: XYArcSketchDocumentV0;
  feature: { id: string; kind: 'xy-circle-extrude'; profileId: string; shellId: string; height: { id: string; valueMM: number } };
}
export interface XYCirclePrismDocumentPatch { centreMM?: XYPoint; radiusMM?: number; heightMM?: number }
export interface XYCirclePrismDocumentReport {
  kind: 'xy-circle-prism-document-evaluation'; formatVersion: 0; documentId: string;
  bindings: { documentId: string; sketchId: string; featureId: string; profileId: string; shellId: string; centerId: string; radiusId: string; seamId: string; heightId: string;
    centerMM: XYPoint; radiusMM: number; heightMM: number; sourceCurveId: string };
  native: XYCirclePrismShellReport; boundsMM: { min: Point; max: Point }; domains: XYCirclePrismShellReport['domains']; referenceVolumeMM3: number;
  candidateClosedShell: true; periodic: false; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { authoredIdCharacters: 64; profileShellIdCharacters: 48; snapshotValues: 4096; snapshotDepth: 10; arrayElements: 64; recordFields: 12; stringCharacters: 128; maximumJSONBytes: 131072 };
}
export interface XYCirclePrismDocumentResult {
  document: XYCirclePrismDocumentV0; sketchEvaluation: XYArcSketchDocumentResult; shell: XYCirclePrismShellResult; report: XYCirclePrismDocumentReport;
}
function context(input: unknown): string {
  const ownId = (value: unknown): string => { if (value === null || typeof value !== 'object') return '?'; const d = Object.getOwnPropertyDescriptor(value, 'id'); return d && 'value' in d && typeof d.value === 'string' && d.value.length <= 64 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(d.value) ? d.value : '?'; };
  return 'XY circle prism document #' + ownId(input);
}
function check(condition: boolean, label: string, path: string, detail: string): asserts condition { if (!condition) throw new Error((label + ': ' + path.slice(0, 256) + ': ' + detail).slice(0, 512)); }
function guard<T>(label: string, work: () => T): T {
  try { return work(); } catch (error) { const message = error instanceof Error ? error.message : 'invalid document/geometry'; throw new Error((message.startsWith(label) ? message : label + ': ' + message).slice(0, 512), { cause: error }); }
}
function snapshot(input: unknown, label: string, rootPath: string): unknown {
  let remaining = 4096;
  const copy = (value: unknown, depth: number, path: string): unknown => {
    check(--remaining >= 0 && depth <= 10, label, path, 'input exceeds4096 own values/depth10');
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
function admit(input: unknown, label: string): XYCirclePrismDocumentV0 {
  const data = record(snapshot(input, label, '$'), ['format', 'version', 'id', 'lengthUnit', 'sketch', 'feature'], label, '$');
  check(data.format === 'barocss-xy-circle-prism-feature' && data.version === 0 && data.lengthUnit === 'mm', label, '$.format/version/lengthUnit', 'circle prism feature0/mm required');
  const id = identifier(data.id, label, '$.id'), f = record(data.feature, ['id', 'kind', 'profileId', 'shellId', 'height'], label, '$.feature');
  const featureId = identifier(f.id, label, '$.feature.id'), profileId = identifier(f.profileId, label, '$.feature.profileId'), shellId = identifier(f.shellId, label, '$.feature.shellId');
  check(f.kind === 'xy-circle-extrude' && profileId.length <= 48 && shellId.length <= 48, label + ' feature #' + featureId, '$.feature', 'circle extrusion kind/profile/shell IDs1..48 required');
  const h = record(f.height, ['id', 'valueMM'], label, '$.feature.height'), heightId = identifier(h.id, label, '$.feature.height.id');
  check(typeof h.valueMM === 'number' && h.valueMM >= .001 && h.valueMM <= 10000, label + ' feature #' + featureId, '$.feature.height.valueMM', 'finite positive height0.001..10000mm required');
  return { format: 'barocss-xy-circle-prism-feature', version: 0, id, lengthUnit: 'mm', sketch: data.sketch as XYArcSketchDocumentV0,
    feature: { id: featureId, kind: 'xy-circle-extrude', profileId, shellId, height: { id: heightId, valueMM: h.valueMM } } };
}
function nativeIds(data: unknown, result = new Set<string>()): Set<string> {
  if (Array.isArray(data)) for (const value of data) nativeIds(value, result);
  else if (data !== null && typeof data === 'object') for (const [key, value] of Object.entries(data)) {
    if ((key === 'id' || key === 'name') && typeof value === 'string') result.add(value); nativeIds(value, result);
  }
  return result;
}
function evaluate(document: XYCirclePrismDocumentV0, label: string): XYCirclePrismDocumentResult {
  const sketchEvaluation = guard(label + ': $.sketch', () => evaluateXYArcSketchDocument(document.sketch));
  document.sketch = sketchEvaluation.document;
  check(document.sketch.profiles.length === 1, label, '$.sketch.profiles', 'exactly one original circle required for this feature family');
  const p = document.sketch.profiles[0], f = document.feature;
  check(p.kind === 'circle' && p.id === f.profileId && p.id.length <= 48, label + ' feature #' + f.id, '$.feature.profileId', 'exact matching single-circle source reference1..48 required');
  const slots = [document.id, document.sketch.id, p.id, p.centerId, p.radius.id, p.seamId, f.id, f.shellId, f.height.id];
  check(new Set(slots).size === slots.length, label, '$.ids', 'distinct authored document/sketch/profile/center/radius/seam/feature/shell/height slots required');
  const shell = guard(label + ' feature #' + f.id + ': $.feature.native', () => buildXYCirclePrismShell({ kind: 'circle', id: p.id, center: p.centerMM, radius: p.radius.valueMM }, { shellId: f.shellId, heightMM: f.height.valueMM }));
  check(sameData(sketchEvaluation.profiles[0].evaluation, shell.profile), label, '$.feature.sourceBinding', 'actual587 original circle/source0 must equal actual595 input profile');
  const generated = nativeIds(shell.bundle);
  nativeIds(shell.baseFace.bundle, generated); generated.add(shell.profile.model.name);
  for (const id of slots) {
    // Profile and shell are intentional references to the same native identities.
    if (id === p.id || id === f.shellId) continue;
    check(!generated.has(id), label, '$.ids #' + id, 'distinct authored slot collides with generated native ID/Model name');
  }
  const report: XYCirclePrismDocumentReport = { kind: 'xy-circle-prism-document-evaluation', formatVersion: 0, documentId: document.id,
    bindings: { documentId: document.id, sketchId: document.sketch.id, featureId: f.id, profileId: p.id, shellId: f.shellId, centerId: p.centerId,
      radiusId: p.radius.id, seamId: p.seamId, heightId: f.height.id, centerMM: copyCadData(p.centerMM), radiusMM: p.radius.valueMM, heightMM: f.height.valueMM, sourceCurveId: shell.report.sourceCurveId },
    native: shell.report, boundsMM: shell.report.boundsMM, domains: shell.report.domains, referenceVolumeMM3: shell.report.referenceVolumeMM3,
    candidateClosedShell: true, periodic: false, geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    limits: { authoredIdCharacters: 64, profileShellIdCharacters: 48, snapshotValues: 4096, snapshotDepth: 10, arrayElements: 64, recordFields: 12, stringCharacters: 128, maximumJSONBytes: 131072 } };
  // Native intent never invokes mesh generation or Float32 display admission.
  return copyCadData({ document, sketchEvaluation, shell, report });
}
export function evaluateXYCirclePrismDocument(document: XYCirclePrismDocumentV0): XYCirclePrismDocumentResult {
  const label = context(document); return guard(label, () => evaluate(admit(document, label), label));
}
export function updateXYCirclePrismDocument(document: XYCirclePrismDocumentV0, patch: XYCirclePrismDocumentPatch): XYCirclePrismDocumentResult {
  const label = context(document);
  return guard(label, () => {
    const candidate = admit(document, label), value = snapshot(patch, label, '$patch');
    check(value !== null && typeof value === 'object' && !Array.isArray(value), label, '$patch', 'numeric patch record required');
    const data = value as Record<string, unknown>, keys = Object.keys(data);
    check(keys.length >= 1 && keys.length <= 3 && keys.every(key => ['centreMM', 'radiusMM', 'heightMM'].includes(key)), label, '$patch', 'one or more exact centreMM/radiusMM/heightMM fields required');
    const original = guard(label + ': $.sketch', () => evaluateXYArcSketchDocument(candidate.sketch));
    check(original.document.profiles.length === 1 && original.document.profiles[0].kind === 'circle' && original.document.profiles[0].id === candidate.feature.profileId, label, '$.feature.profileId', 'matching one-circle source required before numeric edits');
    const p = copyCadData(original.document.profiles[0]);
    if (Object.hasOwn(data, 'centreMM')) p.centerMM = xy(data.centreMM, label, '$patch.centreMM');
    if (Object.hasOwn(data, 'radiusMM')) {
      check(typeof data.radiusMM === 'number' && data.radiusMM >= .001 && data.radiusMM <= 10000, label, '$patch.radiusMM', 'finite radius0.001..10000mm required'); p.radius.valueMM = data.radiusMM;
    }
    candidate.sketch = updateXYArcSketchDocument(original.document, [{ kind: 'upsert', profile: p }]).document;
    if (Object.hasOwn(data, 'heightMM')) {
      check(typeof data.heightMM === 'number' && data.heightMM >= .001 && data.heightMM <= 10000, label, '$patch.heightMM', 'finite height0.001..10000mm required'); candidate.feature.height.valueMM = data.heightMM;
    }
    return evaluate(admit(candidate, label), label);
  });
}
export function serializeXYCirclePrismDocument(document: XYCirclePrismDocumentV0): string {
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
    if (c === '{' || c === '[') { stack.push({ kind: c, keys: new Set(), count: 0, nextValue: true }); check(stack.length <= 10, label, '$text[' + i + ']', 'JSON nesting exceeds admitted depth10'); }
    else if (c === '}' || c === ']') { check(parent?.kind === (c === '}' ? '{' : '['), label, '$text[' + i + ']', 'unbalanced JSON container'); stack.pop(); }
    else if (c === ',' && parent?.kind === '[') parent.nextValue = true;
    else if (c === '-' || /[0-9tfn]/.test(c)) { while (i + 1 < text.length && !/[ \n\r\t,}\]]/.test(text[i + 1])) i++; }
  }
  check(stack.length === 0, label, '$text', 'unclosed JSON container');
}
export function parseXYCirclePrismDocument(text: string): XYCirclePrismDocumentV0 {
  const label = 'XY circle prism document parse';
  return guard(label, () => {
    check(typeof text === 'string' && text.length <= 131072, label, '$text', 'JSON text within128KiB UTF-8 required'); let bytes = 0;
    for (let i = 0; i < text.length; i++) { const code = text.charCodeAt(i), next = text.charCodeAt(i + 1); if (code < 128) bytes++; else if (code < 2048) bytes += 2; else if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { bytes += 4; i++; } else bytes += 3; check(bytes <= 131072, label, '$text', 'JSON exceeds128KiB UTF-8'); }
    admitJSONText(text, label); const data = JSON.parse(text); return evaluateXYCirclePrismDocument(data).document;
  });
}

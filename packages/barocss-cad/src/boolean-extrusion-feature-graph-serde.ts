import { evaluateBooleanExtrusionFeatureGraph, BooleanExtrusionFeatureGraphError, BooleanExtrusionFeatureGraphDiagnosticCode } from './boolean-extrusion-feature-graph.js';
import type { BooleanExtrusionFeatureGraphV0, BooleanExtrusionFeatureGraphOptions, BooleanExtrusionFeatureGraphResult } from './boolean-extrusion-feature-graph.js';
import { parseCadDocumentOwnJson, cadDocumentOwnUtf8Bytes } from './cad-document.js';
import { curveDecimal } from './curve-source.js';

const CODE = BooleanExtrusionFeatureGraphDiagnosticCode, FILE_LIMIT = 1048576;
function envelope(text: unknown): asserts text is string {
  if (typeof text !== 'string') throw new BooleanExtrusionFeatureGraphError(CODE.JSON, 'authored JSON text required', { path: '$text' });
  if (text.length > FILE_LIMIT) throw new BooleanExtrusionFeatureGraphError(CODE.BUDGET, 'authored file code-unit limit exceeded', { path: '$text' });
  let bytes: number;
  try { bytes = cadDocumentOwnUtf8Bytes(text, 'JSON'); }
  catch (cause) { throw new BooleanExtrusionFeatureGraphError(CODE.JSON, 'original UTF8 file-envelope validation refused', { path: '$text', cause }); }
  if (bytes > FILE_LIMIT) throw new BooleanExtrusionFeatureGraphError(CODE.BUDGET, 'authored file UTF8 byte limit exceeded', { path: '$text' });
}
/** Serialize only admitted authored intent. Native evaluations and caller budgets are not wire fields. */
export function serializeBooleanExtrusionFeatureGraph(document: BooleanExtrusionFeatureGraphV0, options: BooleanExtrusionFeatureGraphOptions): string {
  const accepted = evaluateBooleanExtrusionFeatureGraph(document, options);
  const encode = (value: unknown): string => {
    if (typeof value === 'number') return curveDecimal(value, 'Boolean extrusion authored graph');
    if (Array.isArray(value)) return '[' + value.map(encode).join(',') + ']';
    if (value !== null && typeof value === 'object') return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + encode(child)).join(',') + '}';
    const text = JSON.stringify(value);
    if (text === undefined) throw new BooleanExtrusionFeatureGraphError(CODE.JSON, 'admitted authored value cannot be encoded', { path: '$document' });
    return text;
  };
  const text = encode(accepted.document) + '\n'; envelope(text); return text;
}
/** Original strict JSON grammar, followed by actual current graph admission and native reconstruction. */
export function parseBooleanExtrusionFeatureGraph(text: string, options: BooleanExtrusionFeatureGraphOptions): BooleanExtrusionFeatureGraphResult {
  envelope(text);
  let parsed: unknown;
  try { parsed = parseCadDocumentOwnJson(text); }
  catch (cause) { throw new BooleanExtrusionFeatureGraphError(CODE.JSON, 'original strict authored JSON grammar refused', { path: '$text', cause }); }
  return evaluateBooleanExtrusionFeatureGraph(parsed as BooleanExtrusionFeatureGraphV0, options);
}

import { evaluateBooleanExtrusionFeatureGraph, BooleanExtrusionFeatureGraphError, BooleanExtrusionFeatureGraphDiagnosticCode } from './boolean-extrusion-feature-graph.js';
import { parseCadDocumentOwnJson, cadDocumentOwnUtf8Bytes } from '../cad-document.js';
import { curveDecimal } from '../nurbs/curves/curve-source.js';
const CODE = BooleanExtrusionFeatureGraphDiagnosticCode, FILE_LIMIT = 1048576;
function envelope(text) {
    if (typeof text !== 'string')
        throw new BooleanExtrusionFeatureGraphError(CODE.JSON, 'authored JSON text required', { path: '$text' });
    if (text.length > FILE_LIMIT)
        throw new BooleanExtrusionFeatureGraphError(CODE.BUDGET, 'authored file code-unit limit exceeded', { path: '$text' });
    let bytes;
    try {
        bytes = cadDocumentOwnUtf8Bytes(text, 'JSON');
    }
    catch (cause) {
        throw new BooleanExtrusionFeatureGraphError(CODE.JSON, 'original UTF8 file-envelope validation refused', { path: '$text', cause });
    }
    if (bytes > FILE_LIMIT)
        throw new BooleanExtrusionFeatureGraphError(CODE.BUDGET, 'authored file UTF8 byte limit exceeded', { path: '$text' });
}
/** Serialize only admitted authored intent. Native evaluations and caller budgets are not wire fields. */
export function serializeBooleanExtrusionFeatureGraph(document, options) {
    const accepted = evaluateBooleanExtrusionFeatureGraph(document, options);
    const encode = (value) => {
        if (typeof value === 'number')
            return curveDecimal(value, 'Boolean extrusion authored graph');
        if (Array.isArray(value))
            return '[' + value.map(encode).join(',') + ']';
        if (value !== null && typeof value === 'object')
            return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + encode(child)).join(',') + '}';
        const text = JSON.stringify(value);
        if (text === undefined)
            throw new BooleanExtrusionFeatureGraphError(CODE.JSON, 'admitted authored value cannot be encoded', { path: '$document' });
        return text;
    };
    const text = encode(accepted.document) + '\n';
    envelope(text);
    return text;
}
/** Original strict JSON grammar, followed by actual current graph admission and native reconstruction. */
export function parseBooleanExtrusionFeatureGraph(text, options) {
    envelope(text);
    let parsed;
    try {
        parsed = parseCadDocumentOwnJson(text);
    }
    catch (cause) {
        throw new BooleanExtrusionFeatureGraphError(CODE.JSON, 'original strict authored JSON grammar refused', { path: '$text', cause });
    }
    return evaluateBooleanExtrusionFeatureGraph(parsed, options);
}

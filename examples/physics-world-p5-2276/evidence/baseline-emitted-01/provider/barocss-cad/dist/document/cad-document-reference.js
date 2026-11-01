import { createCadDocument, validateCadDocumentResult } from '../cad-document.js';
import { evaluateCurve, evaluateSurface, curveDomain, surfaceDomain } from '../core/math.js';
import { copyCadData } from '../data-copy.js';
import { same } from '../core/structural-equality.js';
import { KernelError } from '../core/barocss-error.js';
export const CadReferenceDiagnosticCode = Object.freeze({
    INPUT: 'INPUT', VERSION: 'VERSION', REFERENCE: 'REFERENCE', STALE: 'STALE', QUERY: 'QUERY', FRAME: 'FRAME',
    REPRESENTABILITY: 'REPRESENTABILITY', NATIVE: 'NATIVE', BINDING: 'BINDING', OWNED: 'OWNED',
});
export class CadReferenceError extends KernelError {
    code;
    constructor(code, detail, cause) {
        super(('CAD document reference: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
        this.name = 'CadReferenceError';
        this.code = code;
    }
}
const CODE = CadReferenceDiagnosticCode;
function check(condition, code, detail) {
    if (!condition)
        throw new CadReferenceError(code, detail);
}
function native(action, detail, code = CODE.NATIVE) {
    try {
        return action();
    }
    catch (cause) {
        if (cause instanceof CadReferenceError)
            throw cause;
        throw new CadReferenceError(code, detail + ': ' + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
    }
}
function snapshot(input, owned = false) {
    const code = owned ? CODE.OWNED : CODE.INPUT;
    let remaining = 262144;
    const ancestors = new Set();
    const copy = (value, depth) => {
        check(--remaining >= 0 && depth <= (owned ? 32 : 24), code, 'own-value/depth budget exceeded');
        if (value === null || typeof value === 'boolean')
            return value;
        if (typeof value === 'number') {
            check(Number.isFinite(value), code, 'finite own numbers required');
            return value;
        }
        if (typeof value === 'string') {
            check(value.length <= 262144, code, 'own string budget exceeded');
            return value;
        }
        check(typeof value === 'object', code, 'plain own data required');
        check(!ancestors.has(value), code, 'cyclic own data refused');
        const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
        check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'foreign own-data prototype refused');
        const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
        check(keys.length <= (array ? 4097 : 64), code, 'own field budget exceeded');
        check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
            && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getter/symbol/hidden own data refused');
        ancestors.add(value);
        let result;
        if (array) {
            const length = descriptors.length.value;
            check(Number.isInteger(length) && length >= 0 && length <= 4096 && keys.length === length + 1, code, 'dense bounded own arrays required');
            result = Array.from({ length }, (_, index) => {
                check(Object.hasOwn(descriptors, String(index)), code, 'sparse/extra own array field refused');
                return copy(descriptors[String(index)].value, depth + 1);
            });
        }
        else
            result = Object.fromEntries(keys.map(key => [key, copy(descriptors[key].value, depth + 1)]));
        ancestors.delete(value);
        return result;
    };
    return native(() => copy(input, 0), 'own data snapshot', code);
}
function record(value, fields, code = CODE.INPUT) {
    check(value !== null && typeof value === 'object' && !Array.isArray(value), code, 'own record required');
    const data = value;
    check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'exact fields required: ' + fields.join(','));
    return data;
}
function id(value, maximum = 48) {
    check(typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.REFERENCE, 'ASCII ID1..' + maximum + ' required');
    return value;
}
function revision(value) {
    check(typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2147483647 && !Object.is(value, -0), CODE.REFERENCE, 'unsigned revision0..2147483647 required; signed zero refused');
    return value;
}
function document(input) {
    const owned = snapshot(input);
    native(() => validateCadDocumentResult(owned), 'actual source-backed document validation', CODE.OWNED);
    return native(() => createCadDocument(owned.document), 'actual authoritative source0 document reconstruction');
}
function reference(input) {
    const r = record(snapshot(input), ['schema', 'version', 'documentId', 'documentRevision', 'bodyId', 'assetId',
        'assetRevision', 'geometryId', 'geometryKind', 'sourceVersion', 'sourceFrame', 'lengthUnit']);
    check(r.schema === 'barocss-cad-geometry-reference' && r.version === 0 && r.sourceVersion === 0, CODE.VERSION, 'native geometry reference0/source0 required');
    check(r.geometryKind === 'curve' || r.geometryKind === 'surface', CODE.REFERENCE, 'native Curve/Surface reference kind required');
    check(r.sourceFrame === 'authored-xyz-no-axis-conversion' && r.lengthUnit === 'mm', CODE.FRAME, 'reference must retain authored XYZ/mm source frame');
    return { schema: 'barocss-cad-geometry-reference', version: 0, documentId: id(r.documentId), documentRevision: revision(r.documentRevision),
        bodyId: id(r.bodyId), assetId: id(r.assetId), assetRevision: revision(r.assetRevision), geometryId: id(r.geometryId, 128),
        geometryKind: r.geometryKind, sourceVersion: 0, sourceFrame: 'authored-xyz-no-axis-conversion', lengthUnit: 'mm' };
}
function binding(doc, bodyId) {
    const body = doc.document.bodies.find(value => value.id === bodyId);
    check(body !== undefined, CODE.REFERENCE, 'body missing from actual document');
    const asset = doc.document.assets.find(value => value.id === body.assetId);
    const compiled = doc.compiledAssets.find(value => value.assetId === body.assetId);
    const geometry = compiled?.model.objects.find(value => value.id === body.geometryId);
    check(asset !== undefined && compiled !== undefined && geometry !== undefined, CODE.REFERENCE, 'qualified native asset/object missing from actual source-backed document');
    return { reference: { schema: 'barocss-cad-geometry-reference', version: 0, documentId: doc.document.documentId,
            documentRevision: doc.document.revision, bodyId: body.id, assetId: asset.id, assetRevision: asset.revision,
            geometryId: geometry.id, geometryKind: geometry.kind, sourceVersion: 0,
            sourceFrame: 'authored-xyz-no-axis-conversion', lengthUnit: 'mm' }, geometry, source: asset.source };
}
function resolve(doc, ref) {
    check(ref.documentId === doc.document.documentId, CODE.REFERENCE, 'foreign document reference');
    check(ref.documentRevision === doc.document.revision, CODE.STALE, 'document revision is stale');
    const current = binding(doc, ref.bodyId);
    check(ref.assetId === current.reference.assetId && ref.geometryId === current.reference.geometryId
        && ref.geometryKind === current.reference.geometryKind, CODE.REFERENCE, 'body/asset/geometry identity or kind does not match actual native binding');
    check(ref.assetRevision === current.reference.assetRevision, CODE.STALE, 'asset revision is stale');
    check(same(ref, current.reference), CODE.BINDING, 'complete native reference does not match actual source-backed binding');
    return current;
}
function limits() {
    return { maximumGeometryObjectsPerReference: 1, inputValues: 262144, inputDepth: 24, inputArrayElements: 4096,
        inputRecordFields: 64, snapshotValues: 262144, snapshotDepth: 32, arrayElements: 4096, recordFields: 64,
        sourceStringCharacters: 262144, authoredIdCharacters: 48, geometryIdCharacters: 128, maximumRevision: 2147483647 };
}
function report(ref, action, previous) {
    return { schema: 'barocss-cad-reference-report', version: 0, documentVersion: 1, referenceVersion: 0, operation: action,
        documentId: ref.documentId, documentRevision: ref.documentRevision, bodyId: ref.bodyId, assetId: ref.assetId,
        assetRevision: ref.assetRevision, geometryId: ref.geometryId, geometryKind: ref.geometryKind,
        sourceVersion: 0, sourceFrame: 'authored-xyz-no-axis-conversion', lengthUnit: 'mm',
        previousDocumentRevision: previous?.documentRevision ?? null, previousAssetRevision: previous?.assetRevision ?? null,
        geometryAuthority: 'actual-authored-source0-model', geometricValidity: 'not-certified', topologyCertified: false, solid: false,
        quality: { bindingSemantics: 'exact-document-and-asset-revisions', rebindSemantics: 'unchanged-complete-native-coefficients-only',
            querySemantics: 'original-native-closed-parameter-domain', topologyNamingCertified: false,
            manufacturingToleranceCertified: false, globalBinary64ErrorCertified: false, ownership: 'copied-cpu-data-gc-no-renderer-resources' }, limits: limits() };
}
/** Capture one actual document/body/asset/native geometry binding at its authored revisions. */
export function createCadGeometryReference(documentInput, input) {
    const doc = document(documentInput), o = record(snapshot(input), ['bodyId']);
    const current = binding(doc, id(o.bodyId));
    return snapshot({ ...current, report: report(current.reference, 'create') }, true);
}
/** Resolve exact native identity and document/asset revisions. No nearest or topology fallback exists. */
export function resolveCadGeometryReference(documentInput, referenceInput) {
    const doc = document(documentInput), ref = reference(referenceInput), current = resolve(doc, ref);
    return snapshot({ ...current, report: report(current.reference, 'resolve') }, true);
}
/** Explicit rebind requires the entire selected native object to remain bit-identical. */
export function rebindCadGeometryReference(previousDocument, currentDocument, previousReference) {
    const previousDoc = document(previousDocument), currentDoc = document(currentDocument), oldRef = reference(previousReference);
    const previous = resolve(previousDoc, oldRef);
    check(currentDoc.document.documentId === oldRef.documentId, CODE.STALE, 'rebind requires the same document identity');
    let current;
    try {
        current = binding(currentDoc, oldRef.bodyId);
    }
    catch (cause) {
        throw new CadReferenceError(CODE.STALE, 'previous body/native binding no longer exists', cause);
    }
    const newRef = current.reference;
    check(oldRef.bodyId === newRef.bodyId && oldRef.assetId === newRef.assetId && oldRef.geometryId === newRef.geometryId
        && oldRef.geometryKind === newRef.geometryKind && oldRef.sourceVersion === newRef.sourceVersion
        && oldRef.sourceFrame === newRef.sourceFrame && oldRef.lengthUnit === newRef.lengthUnit, CODE.STALE, 'rebind requires unchanged qualified geometry identity/kind/frame/units');
    check(same(previous.geometry, current.geometry), CODE.STALE, 'selected native coefficients/knots/weights/order/sign bits changed');
    return snapshot({ previousReference: previous.reference, reference: newRef, report: report(newRef, 'rebind', previous.reference) }, true);
}
function query(input, geometry) {
    const copied = snapshot(input);
    check(copied !== null && typeof copied === 'object' && !Array.isArray(copied), CODE.QUERY, 'native point query record required');
    const kind = copied.kind;
    check(kind === 'curve' || kind === 'surface', CODE.QUERY, 'native Curve/Surface query kind required');
    check(kind === geometry.kind, CODE.QUERY, 'query kind must match selected actual native geometry');
    if (kind === 'curve') {
        const q = record(copied, ['kind', 'parameter'], CODE.QUERY), domain = native(() => curveDomain(geometry), 'original Curve domain');
        check(typeof q.parameter === 'number' && Number.isFinite(q.parameter) && q.parameter >= domain[0] && q.parameter <= domain[1], CODE.QUERY, 'Curve query must use its original closed knot domain');
        return { kind: 'curve', parameter: q.parameter };
    }
    const q = record(copied, ['kind', 'u', 'v'], CODE.QUERY), domain = native(() => surfaceDomain(geometry), 'original Surface domain');
    check(typeof q.u === 'number' && Number.isFinite(q.u) && q.u >= domain.u[0] && q.u <= domain.u[1]
        && typeof q.v === 'number' && Number.isFinite(q.v) && q.v >= domain.v[0] && q.v <= domain.v[1], CODE.QUERY, 'Surface query must use its original closed U/V knot domains');
    return { kind: 'surface', u: q.u, v: q.v };
}
function nativePoint(doc, ref, input) {
    const current = resolve(doc, ref), q = query(input, current.geometry);
    const pointMM = native(() => q.kind === 'curve' ? evaluateCurve(current.geometry, q.parameter)
        : evaluateSurface(current.geometry, q.u, q.v), 'actual original native point evaluation');
    check(pointMM.every(Number.isFinite), CODE.NATIVE, 'native query point must be finite');
    return snapshot({ reference: current.reference, query: q, pointMM, report: report(current.reference, 'point-query') }, true);
}
/** Query the actual source-backed native object in authored XYZ/mm and original parameter units. */
export function queryCadDocumentPoint(documentInput, referenceInput, queryInput) {
    return nativePoint(document(documentInput), reference(referenceInput), queryInput);
}
function checkedPoint(doc, input) {
    const owned = snapshot(input, true);
    record(owned, ['reference', 'query', 'pointMM', 'report'], CODE.OWNED);
    let expected;
    try {
        expected = nativePoint(doc, reference(owned.reference), owned.query);
    }
    catch (cause) {
        throw new CadReferenceError(CODE.OWNED, 'owned native reference/query point rebuild refused', cause);
    }
    check(same(owned, expected), CODE.OWNED, 'owned native reference/query/point/report bits mismatch');
    return expected;
}
/** Rebuild every point and report field from the actual document source. */
export function validateCadDocumentPoint(documentInput, input) {
    return copyCadData(checkedPoint(document(documentInput), input).report);
}
function conversionOptions(input) {
    const o = record(snapshot(input), ['targetFrameId', 'axisMap', 'targetLengthUnit']);
    check(typeof o.targetFrameId === 'string' && o.targetFrameId.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(o.targetFrameId), CODE.FRAME, 'explicit ASCII target frame ID1..48 required');
    check(o.axisMap === 'identity' || o.axisMap === 'x-z-minus-y', CODE.FRAME, 'only explicit identity or (x,z,-y) axis mapping supported');
    check(o.targetLengthUnit === 'mm' || o.targetLengthUnit === 'm', CODE.FRAME, 'explicit target mm or m unit required');
    return { targetFrameId: o.targetFrameId, axisMap: o.axisMap, targetLengthUnit: o.targetLengthUnit };
}
function conversion(sourcePoint, options) {
    const mapped = options.axisMap === 'identity' ? copyCadData(sourcePoint.pointMM)
        : [sourcePoint.pointMM[0], sourcePoint.pointMM[2], -sourcePoint.pointMM[1]];
    const scale = options.targetLengthUnit === 'mm' ? 1 : .001;
    const convertedPoint = mapped.map(value => {
        const converted = value * scale;
        check(Number.isFinite(converted) && (value === 0 || converted !== 0), CODE.REPRESENTABILITY, 'derived axis/unit conversion overflow or nonzero product underflow');
        return converted;
    });
    const basisRows = options.axisMap === 'identity'
        ? [[1, 0, 0], [0, 1, 0], [0, 0, 1]] : [[1, 0, 0], [0, 0, 1], [0, -1, 0]];
    const conversionReport = {
        schema: 'barocss-cad-frame-conversion-report', version: 0, documentVersion: 1, referenceVersion: 0, sourceVersion: 0,
        inputFrame: { id: 'authored-xyz-no-axis-conversion', basis: 'xyz', handedness: 'right-handed', lengthUnit: 'mm' },
        outputFrame: { id: options.targetFrameId, basis: options.axisMap === 'identity' ? 'xyz' : 'x-z-minus-y',
            handedness: 'right-handed', lengthUnit: options.targetLengthUnit }, axisMap: options.axisMap, basisRows, scale,
        transformOrder: 'axis-map-then-mm-scale', role: 'derived-display-frame-mapping-not-native-source-edit',
        nativeSourcePreserved: true, nativeFrameUpCertified: false, geometricValidity: 'not-certified', topologyCertified: false, solid: false,
        quality: { mappingSemantics: 'explicit-known-axis-map-and-unit-scale', manufacturingToleranceCertified: false,
            globalBinary64ErrorCertified: false, ownership: 'copied-cpu-data-gc-no-renderer-resources' }, limits: limits()
    };
    return snapshot({ sourcePoint, options, convertedPoint, report: conversionReport }, true);
}
/** Apply a declared axis map, then a declared mm-to-target-unit scale, without editing native source. */
export function convertCadDocumentPoint(documentInput, pointInput, optionsInput) {
    return conversion(checkedPoint(document(documentInput), pointInput), conversionOptions(optionsInput));
}
/** Rebuild the validated native point and the complete declared mapping result. */
export function validateCadFrameConversion(documentInput, input) {
    const doc = document(documentInput), owned = snapshot(input, true);
    record(owned, ['sourcePoint', 'options', 'convertedPoint', 'report'], CODE.OWNED);
    let expected;
    try {
        expected = conversion(checkedPoint(doc, owned.sourcePoint), conversionOptions(owned.options));
    }
    catch (cause) {
        throw new CadReferenceError(CODE.OWNED, 'owned native point/frame mapping rebuild refused', cause);
    }
    check(same(owned, expected), CODE.OWNED, 'owned native point/options/axis map/unit scale/converted bits/report mismatch');
    return copyCadData(expected.report);
}

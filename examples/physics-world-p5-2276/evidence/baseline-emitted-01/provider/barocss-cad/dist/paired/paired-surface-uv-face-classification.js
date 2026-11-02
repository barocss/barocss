import { validatePairedSurfaceUVSplitFaces } from './paired-surface-uv-split-faces.js';
import { validatePairedSurfaceBUVSplitFaces } from './paired-surface-b-uv-split-faces.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import { classifyPairedSurfaceUVQueriesTrusted } from './paired-surface-uv-face-classification-internal.js';
import { same } from '../core/structural-equality.js';
import { KernelError } from '../core/barocss-error.js';
export const PairedSurfaceUVFaceClassificationDiagnosticCode = Object.freeze({
    INPUT: 'INPUT', IDENTITY: 'IDENTITY', PARENT: 'PARENT', BINDING: 'BINDING',
    DOMAIN: 'DOMAIN', BUDGET: 'BUDGET', FILE: 'FILE', OWNED: 'OWNED',
});
export class PairedSurfaceUVFaceClassificationError extends KernelError {
    code;
    context;
    constructor(code, detail, context, cause) {
        super(('Paired original UV Face classification: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
        this.name = 'PairedSurfaceUVFaceClassificationError';
        this.code = code;
        this.context = { ...context, directCounts: { ...context.directCounts } };
    }
}
const CODE = PairedSurfaceUVFaceClassificationDiagnosticCode;
const REQUEST_LIMIT = 8388608, RESULT_LIMIT = 16777216;
function context() {
    return { phase: 'input', assetIndex: null, queryIndex: null, directCounts: {
            parentValidationCount: 0, queryCount: 0, affineInversionCount: 0, quarticEvaluationCount: 0,
            signComparisonCount: 0, curveD0Count: 0, curveD1Count: 0, surfaceD0Count: 0,
            surfaceD1Count: 0, sourceCompilationCount: 0, rationalFloatConversionCount: 0,
        } };
}
function fail(state, code, detail, cause) {
    throw new PairedSurfaceUVFaceClassificationError(code, detail, state, cause);
}
function check(state, value, code, detail) {
    if (!value)
        fail(state, code, detail);
}
function record(state, value, fields, code = CODE.INPUT) {
    check(state, value !== null && typeof value === 'object' && !Array.isArray(value), code, 'An own record is required');
    const data = value;
    check(state, Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own fields are required');
    return data;
}
function snapshot(state, input, owned = false) {
    const code = owned ? CODE.OWNED : CODE.INPUT, budget = owned ? CODE.OWNED : CODE.BUDGET;
    let remaining = 4194304;
    const ancestors = new Set();
    const copy = (value, depth) => {
        check(state, --remaining >= 0 && depth <= 64, budget, 'Own value or depth cap exceeded');
        if (value === null || typeof value === 'boolean')
            return value;
        if (typeof value === 'number') {
            check(state, Number.isFinite(value), code, 'Finite own numbers are required');
            return value;
        }
        if (typeof value === 'string') {
            check(state, value.length <= 262144, budget, 'Own source string cap exceeded');
            return value;
        }
        check(state, typeof value === 'object' && !ancestors.has(value), code, 'Acyclic own data is required');
        const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
        check(state, array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'Plain own-data prototypes are required');
        const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
        check(state, keys.length <= (array ? 8193 : 64), budget, 'Own field cap exceeded');
        check(state, keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key] &&
            (array && key === 'length' || descriptors[key].enumerable)), code, 'Getters, symbols and hidden fields are refused');
        ancestors.add(value);
        let result;
        if (array) {
            const length = descriptors.length.value;
            check(state, Number.isInteger(length) && length >= 0 && length <= 8192, budget, 'Own array element cap exceeded');
            check(state, keys.length === length + 1, code, 'Dense arrays without extra fields are required');
            result = Array.from({ length }, (_, index) => {
                check(state, Object.hasOwn(descriptors, String(index)), code, 'Sparse arrays are refused');
                return copy(descriptors[String(index)].value, depth + 1);
            });
        }
        else
            result = Object.fromEntries(keys.map(key => [key, copy(descriptors[key].value, depth + 1)]));
        ancestors.delete(value);
        return result;
    };
    return copy(input, 0);
}
function id(state, value, maximum = 48) {
    check(state, typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'A bounded supported ASCII identity is required');
}
function json(state, input, limit, retain = false) {
    const previousPhase = state.phase;
    const previousAsset = state.assetIndex, previousQuery = state.queryIndex;
    state.phase = 'file';
    state.assetIndex = null;
    state.queryIndex = null;
    let utf16 = 0, utf8 = 0;
    const parts = [], encoder = new TextEncoder();
    const append = (text) => {
        utf16 += text.length;
        utf8 += encoder.encode(text).length;
        check(state, utf16 <= limit && utf8 <= limit, CODE.FILE, 'Complete JSON exceeds its full UTF16 or UTF8 envelope');
        if (retain)
            parts.push(text);
    };
    const visit = (value) => {
        if (value === null || typeof value === 'string' || typeof value === 'boolean')
            append(JSON.stringify(value));
        else if (typeof value === 'number') {
            check(state, Number.isFinite(value), CODE.FILE, 'Finite JSON numbers are required');
            append(Object.is(value, -0) ? '-0' : String(value));
        }
        else if (Array.isArray(value)) {
            append('[');
            value.forEach((item, index) => { if (index)
                append(','); visit(item); });
            append(']');
        }
        else {
            check(state, value !== null && typeof value === 'object', CODE.FILE, 'Complete own JSON data is required');
            append('{');
            Object.entries(value).forEach(([key, item], index) => { if (index)
                append(','); append(JSON.stringify(key)); append(':'); visit(item); });
            append('}');
        }
    };
    visit(input);
    append('\n');
    state.phase = previousPhase;
    state.assetIndex = previousAsset;
    state.queryIndex = previousQuery;
    return { text: retain ? parts.join('') : '', size: { utf16, utf8 } };
}
function delegated(state, code, detail, action) {
    try {
        return action();
    }
    catch (cause) {
        if (cause instanceof PairedSurfaceUVFaceClassificationError)
            throw cause;
        fail(state, code, detail, cause);
    }
}
function ownValues(state, input) {
    let count = 0;
    const visit = (value, depth) => {
        check(state, ++count <= 4194304 && depth <= 64, CODE.BUDGET, 'Complete retained own-value/depth budget exceeded');
        if (value !== null && typeof value === 'object')
            Object.values(value).forEach(item => visit(item, depth + 1));
    };
    visit(input, 0);
    return count;
}
function limits() {
    return { maximumParents: 2, maximumQueries: 16, queryCoordinateAbs: 10000,
        maximumCutDegree: 4, maximumFaces: 4, requestBytes: REQUEST_LIMIT,
        resultBytes: RESULT_LIMIT, ownValues: 4194304, ownDepth: 64,
        arrayElements: 8192, recordFields: 64, keyCharacters: 128, stringCharacters: 262144,
        identityCharacters: 48, rationalOperations: 200000, gcdSteps: 200000,
        rationalIntegerBits: 8192, fractionIntegerCharacters: 5000,
        maximumRationalFloatConversions: 0, maximumSettlePasses: 8 };
}
/** Exact membership in the two certified Face regions of each original UV window. */
export function classifyPairedSurfaceUVFaces(inputA, inputB, inputQueries, inputOptions) {
    const state = context();
    const data = record(state, snapshot(state, {
        a: inputA, b: inputB, queries: inputQueries, options: inputOptions,
    }), ['a', 'b', 'queries', 'options']);
    const settings = record(state, data.options, ['evaluationId', 'maximumQueries']);
    id(state, settings.evaluationId);
    check(state, settings.maximumQueries === 16, CODE.BUDGET, 'Complete fixed maximumQueries16 is required');
    check(state, Array.isArray(data.queries), CODE.INPUT, 'An own query array is required');
    check(state, data.queries.length <= 16, CODE.BUDGET, 'At most16 UV queries are supported');
    const queryIds = new Set();
    const queries = data.queries.map((value, index) => {
        state.queryIndex = index;
        state.assetIndex = null;
        const query = record(state, value, ['queryId', 'assetIndex', 'u', 'v']);
        id(state, query.queryId);
        check(state, !queryIds.has(query.queryId), CODE.IDENTITY, 'Query identities must be distinct within the batch');
        queryIds.add(query.queryId);
        check(state, query.assetIndex === 0 || query.assetIndex === 1, CODE.INPUT, 'Original A or B assetIndex0/1 is required');
        state.assetIndex = query.assetIndex;
        check(state, typeof query.u === 'number' && Number.isFinite(query.u) && Math.abs(query.u) <= 10000 &&
            typeof query.v === 'number' && Number.isFinite(query.v) && Math.abs(query.v) <= 10000, CODE.INPUT, 'Finite original native UV coordinates with absolute bound10000 are required');
        return { queryId: query.queryId, assetIndex: query.assetIndex, u: query.u, v: query.v };
    });
    const a = data.a;
    const b = data.b;
    const options = {
        evaluationId: settings.evaluationId, maximumQueries: 16,
    };
    const request = { a, b, queries, options };
    state.assetIndex = null;
    state.queryIndex = null;
    const requestSize = json(state, request, REQUEST_LIMIT).size;
    const classifications = [], queryProofs = [];
    let supports = null;
    const prefix = () => {
        const previousPhase = state.phase, previousAsset = state.assetIndex, previousQuery = state.queryIndex;
        state.phase = 'file';
        state.assetIndex = null;
        state.queryIndex = null;
        const retained = { request, classifications, supports, queryProofs };
        snapshot(state, retained);
        json(state, retained, RESULT_LIMIT);
        state.phase = previousPhase;
        state.assetIndex = previousAsset;
        state.queryIndex = previousQuery;
    };
    prefix();
    state.phase = 'parent';
    state.assetIndex = 0;
    state.directCounts.parentValidationCount++;
    delegated(state, CODE.PARENT, 'Complete original-A complementary Face validation refused', () => validatePairedSurfaceUVSplitFaces(a));
    prefix();
    state.phase = 'parent';
    state.assetIndex = 1;
    state.directCounts.parentValidationCount++;
    delegated(state, CODE.PARENT, 'Complete original-B complementary Face validation refused', () => validatePairedSurfaceBUVSplitFaces(b));
    prefix();
    state.phase = 'binding';
    state.assetIndex = null;
    check(state, same(a.request.section, b.request.section), CODE.BINDING, 'Both complementary Face results must retain the same complete exact paired section');
    const section = a.request.section;
    const sharedA = a.edges.find(edge => edge.role === 'sharedCut');
    const sharedB = b.edges.find(edge => edge.role === 'sharedCut');
    check(state, sharedA !== undefined && sharedB !== undefined &&
        same(sharedA.curve, section.world.curve) && same(sharedB.curve, section.world.curve) &&
        same(sharedA.pcurve.curve, section.pcurves.a.curve) &&
        same(sharedB.pcurve.curve, section.pcurves.b.curve), CODE.BINDING, 'Actual shared World and original A/B UV Curves must retain complete parent bits');
    for (const [assetIndex, parent] of [a, b].entries()) {
        state.assetIndex = assetIndex;
        const selection = section.report.selections[assetIndex];
        const asset = section.request.assets[assetIndex], original = section.originalModels[assetIndex];
        check(state, parent.report.support.sourceId === asset.sourceId &&
            parent.report.support.surfaceId === asset.surface.id &&
            parent.report.support.modelName === original.name &&
            parent.report.support.objectIndex === selection.objectIndex &&
            same(original.objects[selection.objectIndex], asset.surface) &&
            parent.faces[0].sourceId === asset.sourceId && parent.faces[1].sourceId === asset.sourceId &&
            parent.faces[0].surfaceId === asset.surface.id && parent.faces[1].surfaceId === asset.surface.id &&
            parent.faces[0].region === 'below-cut' && parent.faces[1].region === 'above-cut', CODE.BINDING, 'Actual source-qualified original selector and lower/upper Face references are required');
    }
    state.assetIndex = null;
    const counts = {
        parentValidationCount: state.directCounts.parentValidationCount,
        queryCount: 0, affineInversionCount: 0, quarticEvaluationCount: 0, signComparisonCount: 0,
        curveD0Count: 0, curveD1Count: 0, surfaceD0Count: 0, surfaceD1Count: 0,
        sourceCompilationCount: 0, rationalFloatConversionCount: 0,
    };
    state.directCounts = counts;
    const q = new SectionRationalContext((kind, detail) => fail(state, kind === 'BUDGET' ? CODE.BUDGET : CODE.DOMAIN, detail));
    prefix();
    let derived;
    try {
        derived = classifyPairedSurfaceUVQueriesTrusted(a, b, queries, q, counts, {
            beginQuery(assetIndex, queryIndex) {
                state.phase = 'query';
                state.assetIndex = assetIndex;
                state.queryIndex = queryIndex;
                prefix();
            },
            retainQuery(classification, proof) {
                classifications.push(classification);
                queryProofs.push(proof);
                prefix();
            },
            fail(code, detail, cause) { fail(state, CODE[code], detail, cause); },
        });
    }
    catch (cause) {
        if (cause instanceof PairedSurfaceUVFaceClassificationError)
            throw cause;
        fail(state, CODE.BINDING, 'Exact original UV Face predicate construction refused', cause);
    }
    supports = derived.supports;
    check(state, same(classifications, derived.classifications) && same(queryProofs, derived.queries) &&
        classifications.length === queries.length && queryProofs.length === queries.length, CODE.BINDING, 'Every completed actual query must retain its complete staged classification and exact witness');
    check(state, counts.parentValidationCount === 2 && counts.queryCount === queries.length &&
        counts.affineInversionCount <= counts.quarticEvaluationCount &&
        counts.quarticEvaluationCount <= counts.queryCount && counts.curveD0Count === 0 &&
        counts.curveD1Count === 0 && counts.surfaceD0Count === 0 && counts.surfaceD1Count === 0 &&
        counts.sourceCompilationCount === 0 && counts.rationalFloatConversionCount === 0 &&
        q.counts().floatConversions === 0, CODE.BINDING, 'Actual successful query/direct work schedule or zero native/conversion authority disagrees');
    prefix();
    state.phase = 'file';
    state.assetIndex = null;
    state.queryIndex = null;
    const proof = {
        schema: 'barocss-paired-surface-uv-face-classification-proof', version: 0,
        supports, sameCompletePairedParent: true, unchangedSharedWorldCurve: true,
        preservedOriginalParameterFrames: true, queries: queryProofs,
        authority: 'exact-stored-affine-u-quartic-v-on-certified-original-uv-face-windows',
    };
    const assetQueryCounts = [0, 0];
    const windowCounts = { outside: 0, interior: 0, boundary: 0 };
    const relationCounts = {
        below: 0, on: 0, above: 0, 'not-applicable': 0,
    };
    const faceCounts = supports.flatMap((support, assetIndex) => support.faceIds.map(faceId => ({ assetIndex: assetIndex, faceId, inside: 0, outside: 0, boundary: 0 })));
    for (const classification of classifications) {
        assetQueryCounts[classification.assetIndex]++;
        windowCounts[classification.window]++;
        relationCounts[classification.cutRelation]++;
        for (const face of classification.faces) {
            const count = faceCounts.find(value => value.assetIndex === classification.assetIndex && value.faceId === face.faceId);
            check(state, count !== undefined, CODE.BINDING, 'A classified Face must resolve to its actual source-qualified parent');
            count[face.classification]++;
        }
    }
    const report = {
        schema: 'barocss-paired-surface-uv-face-classification', version: 0, evaluationId: options.evaluationId,
        parentEvaluationIds: [a.report.evaluationId, b.report.evaluationId],
        pairedEvaluationId: section.report.evaluationId, queryCount: queries.length,
        assetQueryCounts, windowCounts, relationCounts, faceCounts,
        lengthUnit: 'dimensionless', parameterFrame: 'original-a-u-v-and-original-b-u-v',
        authority: 'exact-stored-affine-u-quartic-v-on-certified-original-uv-face-windows',
        directCounts: { ...counts }, inheritedCounts: { a: a.report.directCounts, b: b.report.directCounts },
        rationalCounts: q.counts(),
        numericPolicy: { input: 'exact-represented-original-native-uv', outsidePriority: true,
            boundary: 'exact-window-or-shared-cut-equality', uInversion: 'exact-positive-affine-original-ua-map',
            cutEvaluation: 'exact-stored-degree4-bernstein-de-casteljau', toleranceUsed: false,
            nativeD0EqualityAuthority: false, rootFindingUsed: false, pointProjectionPerformed: false,
            sourceIdentityRenaming: false, rootFloatConversion: false, snapPerformed: false },
        quality: { exactUVFaceMembershipCertified: true, fullParentsRetained: true, parentFlagsUnchanged: true,
            originalBitsPreserved: true, orientationIndependentMembership: true,
            worldPointMembershipCertified: false, occupied3DMaterialCertified: false, sewnManifold: false,
            wholeBodyTopologyCertified: false, solid: false, booleanCertified: false,
            worldSurfaceAreaComputed: false, globalBinary64EvaluationErrorCertified: false,
            manufacturingToleranceCertified: false, publication: false, ownership: 'independent-copied-cpu-data-gc' },
        fileSizes: { request: requestSize, result: { utf16: 0, utf8: 0 } }, ownValues: 0, limits: limits(),
        workScope: 'two-complete-parent-validations-and-new-exact-uv-predicates-with-inherited-work-separated',
        budgetFailure: 'atomic-no-partial-paired-face-classification',
    };
    const result = { request, classifications, proof, report };
    let settled = false;
    for (let pass = 0; pass < 8; pass++) {
        const count = ownValues(state, result), measured = json(state, result, RESULT_LIMIT).size;
        if (report.ownValues === count && same(report.fileSizes.result, measured)) {
            settled = true;
            break;
        }
        report.ownValues = count;
        report.fileSizes.result = measured;
    }
    check(state, settled && report.ownValues === ownValues(state, result) &&
        same(report.fileSizes.result, json(state, result, RESULT_LIMIT).size), CODE.FILE, 'Whole UV classification own/file measurements did not settle in8 passes');
    return snapshot(state, result);
}
/** Reconstruct the complete source-backed request once and return an independent Report. */
export function validatePairedSurfaceUVFaceClassification(input) {
    const state = context();
    state.phase = 'owned';
    try {
        const result = record(state, snapshot(state, input, true), ['request', 'classifications', 'proof', 'report'], CODE.OWNED);
        json(state, result, RESULT_LIMIT);
        const expected = classifyPairedSurfaceUVFaces(result.request.a, result.request.b, result.request.queries, result.request.options);
        state.directCounts = { ...expected.report.directCounts };
        check(state, same(result, expected), CODE.OWNED, 'Whole parents/queries/source bindings/exact predicates/classifications/work/file fields changed');
        return snapshot(state, expected.report, true);
    }
    catch (cause) {
        if (cause instanceof PairedSurfaceUVFaceClassificationError && cause.code === CODE.OWNED)
            throw cause;
        const failed = cause instanceof PairedSurfaceUVFaceClassificationError ? cause.context : state;
        throw new PairedSurfaceUVFaceClassificationError(CODE.OWNED, 'Whole exact UV Face classification reconstruction refused', { ...failed, phase: 'owned' }, cause);
    }
}

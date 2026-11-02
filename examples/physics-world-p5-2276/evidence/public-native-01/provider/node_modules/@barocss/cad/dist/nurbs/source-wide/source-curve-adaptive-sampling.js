import { compileCadModel } from '../../model-compiler.js';
import { validateCurve, curveDomain, evaluateCurve } from '../../core/math.js';
import { evaluateCurveD1 } from '../../core/derivatives.js';
import { extractCurveBezierSpanTrusted } from './curve-wide-adaptive-sampling.js';
import { finiteSegmentDistance } from '../curves/curve-adaptive-sampling.js';
import { splitBezierCurveTrusted } from '../curves/curve-bezier-subdivision-internal.js';
import { same } from '../../core/structural-equality.js';
import { KernelError } from '../../core/barocss-error.js';
export const SourceCurveAdaptiveSamplingDiagnosticCode = Object.freeze({
    INPUT: 'INPUT', SOURCE: 'SOURCE', REFERENCE: 'REFERENCE', IDENTITY: 'IDENTITY',
    SPAN: 'SPAN', REPRESENTABILITY: 'REPRESENTABILITY', BUDGET: 'BUDGET',
    NATIVE: 'NATIVE', BINDING: 'BINDING', FILE: 'FILE', OWNED: 'OWNED',
});
export class SourceCurveAdaptiveSamplingError extends KernelError {
    code;
    constructor(code, detail, cause) {
        super(('Source Curve adaptive sampling: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
        this.name = 'SourceCurveAdaptiveSamplingError';
        this.code = code;
    }
}
const CODE = SourceCurveAdaptiveSamplingDiagnosticCode;
const EPS = 64 * Number.EPSILON;
const OWN_LIMIT = 4194304, REQUEST_LIMIT = 1048576, RESULT_LIMIT = 16777216;
function check(condition, code, detail) {
    if (!condition)
        throw new SourceCurveAdaptiveSamplingError(code, detail);
}
function delegated(action, code, detail) {
    try {
        return action();
    }
    catch (cause) {
        if (cause instanceof SourceCurveAdaptiveSamplingError)
            throw cause;
        throw new SourceCurveAdaptiveSamplingError(code, detail, cause);
    }
}
function finite(value, detail, code = CODE.REPRESENTABILITY) {
    check(Number.isFinite(value), code, detail);
    return value;
}
/** Descriptor inspection never invokes authored getters. Counts every retained occurrence. */
function ownData(input, owned = false, copyData = true) {
    const code = owned ? CODE.OWNED : CODE.INPUT;
    const budget = owned ? CODE.OWNED : CODE.BUDGET;
    let count = 0;
    const ancestors = new Set();
    const visit = (value, depth) => {
        check(++count <= OWN_LIMIT && depth <= 64, budget, 'Own value or depth limit exceeded');
        if (value === null || typeof value === 'boolean')
            return value;
        if (typeof value === 'number') {
            check(Number.isFinite(value), code, 'Finite own numbers required');
            return value;
        }
        if (typeof value === 'string') {
            check(value.length <= 262144, budget, 'Own string limit exceeded');
            return value;
        }
        check(typeof value === 'object' && !ancestors.has(value), code, 'Acyclic plain own data required');
        const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
        check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'Foreign own-data prototype refused');
        const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
        check(keys.length <= (array ? 32769 : 64), budget, 'Own field limit exceeded');
        check(keys.every(key => typeof key === 'string' && key.length <= 128 &&
            'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable)), code, 'Getter, symbol or hidden own field refused');
        ancestors.add(value);
        let result;
        if (array) {
            const length = descriptors.length.value;
            check(Number.isInteger(length) && length >= 0 && length <= 32768, budget, 'Own array limit exceeded');
            check(keys.length === length + 1, code, 'Dense arrays without extra fields required');
            const output = [];
            for (let index = 0; index < length; index++) {
                check(Object.hasOwn(descriptors, String(index)), code, 'Sparse array refused');
                const item = visit(descriptors[String(index)].value, depth + 1);
                if (copyData)
                    output.push(item);
            }
            result = copyData ? output : value;
        }
        else {
            const output = {};
            for (const key of keys) {
                const item = visit(descriptors[key].value, depth + 1);
                if (copyData)
                    Object.defineProperty(output, key, { value: item, writable: true,
                        configurable: true, enumerable: true });
            }
            result = copyData ? output : value;
        }
        ancestors.delete(value);
        return result;
    };
    return { value: visit(input, 0), count };
}
function record(input, fields) {
    check(input !== null && typeof input === 'object' && !Array.isArray(input), CODE.INPUT, 'Own record required');
    const data = input;
    check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), CODE.INPUT, 'Exact fields required: ' + fields.join(','));
    return data;
}
function identifier(input) {
    check(typeof input === 'string' && input.length >= 1 && input.length <= 48 &&
        /^[A-Za-z_][A-Za-z0-9_-]*$/.test(input), CODE.IDENTITY, 'ASCII ID1..48 required');
    return input;
}
/** Measure compact native JSON preserving negative zero and one trailing newline. */
function fileSize(input, limit) {
    let utf16 = 0, utf8 = 0;
    const encoder = new TextEncoder();
    const append = (text) => {
        utf16 += text.length;
        utf8 += encoder.encode(text).length;
        check(utf16 <= limit && utf8 <= limit, CODE.FILE, 'Complete JSON file envelope exceeded');
    };
    const visit = (value) => {
        if (value === null || typeof value === 'string' || typeof value === 'boolean') {
            append(JSON.stringify(value));
        }
        else if (typeof value === 'number') {
            check(Number.isFinite(value), CODE.FILE, 'Finite JSON number required');
            append(Object.is(value, -0) ? '-0' : JSON.stringify(value));
        }
        else if (Array.isArray(value)) {
            append('[');
            value.forEach((item, index) => { if (index)
                append(','); visit(item); });
            append(']');
        }
        else {
            check(value !== null && typeof value === 'object', CODE.FILE, 'Own JSON record required');
            append('{');
            Object.entries(value).forEach(([key, item], index) => {
                if (index)
                    append(',');
                append(JSON.stringify(key));
                append(':');
                visit(item);
            });
            append('}');
        }
    };
    visit(input);
    append('\n');
    return { utf16, utf8 };
}
function distance(a, b) {
    return finite(Math.hypot(...a.map((value, index) => finite(value - b[index], 'Point/vector difference overflow', CODE.BINDING))), 'Point/vector norm overflow', CODE.BINDING);
}
function midpoint(domain) {
    const width = finite(domain[1] - domain[0], 'Interval width overflow');
    const half = finite(width * .5, 'Interval half-width overflow');
    check(width > 0 && half > 0, CODE.REPRESENTABILITY, 'Positive represented half-width required');
    const value = finite(domain[0] + half, 'Midpoint addition overflow');
    check(value > domain[0] && value < domain[1], CODE.REPRESENTABILITY, 'No strictly represented interior midpoint');
    return value;
}
function chordDistance(point, start, end) {
    return finite(delegated(() => finiteSegmentDistance(point, start, end), CODE.REPRESENTABILITY, 'Finite segment distance refused'), 'Finite chord distance overflow');
}
function limits() {
    return { sourceCharacters: 262144, sourceUTF8Bytes: 262144, modelObjects: 16,
        maximumDegree: 5, maximumOriginalPoles: 64, maximumOriginalKnots: 70,
        maximumOriginalSpans: 63, weightMinimum: 1e-6, weightMaximum: 1e6,
        coordinateAbsMM: 10000, minimumChordToleranceMM: 1e-7,
        maximumChordToleranceMM: 1000, maximumSegments: 4096, maximumPoints: 4097,
        maximumDepth: 16, maximumOperations: 4095, maximumLocalPoles: 6,
        maximumTemporaryPoles: 11, maximumTemporaryKnots: 17,
        maximumCurveD0Attempts: 45055, maximumCurveD1Attempts: 24576,
        requestBytes: 1048576, resultBytes: 16777216, ownValues: 4194304,
        ownDepth: 64, arrayElements: 32768, recordFields: 64, stringCharacters: 262144,
        authoredIdCharacters: 48, resultIdPrefixCharacters: 20 };
}
/** Sample one selected Curve while retaining the complete authored mixed Model. */
export function sampleSourceCurveAdaptive(input) {
    const data = record(ownData(input).value, ['source', 'sourceVersion', 'curveId', 'options']);
    check(typeof data.source === 'string', CODE.INPUT, 'Complete Source0 string required');
    check(data.sourceVersion === 0, CODE.INPUT, 'Literal Source0 required');
    const curveId = identifier(data.curveId);
    const o = record(data.options, ['chordToleranceMM', 'maxSegments', 'maxDepth', 'resultIdPrefix']);
    check(typeof o.chordToleranceMM === 'number' && Number.isFinite(o.chordToleranceMM) &&
        o.chordToleranceMM >= 1e-7 && o.chordToleranceMM <= 1000, CODE.INPUT, 'Chord tolerance1e-7..1000 required');
    check(typeof o.maxSegments === 'number' && Number.isInteger(o.maxSegments) &&
        o.maxSegments >= 1 && o.maxSegments <= 4096, CODE.BUDGET, 'Segments1..4096 required');
    check(typeof o.maxDepth === 'number' && Number.isInteger(o.maxDepth) &&
        o.maxDepth >= 0 && o.maxDepth <= 16, CODE.BUDGET, 'Depth0..16 required');
    const prefix = identifier(o.resultIdPrefix);
    check(prefix.length <= 20, CODE.IDENTITY, 'Result prefix1..20 required');
    const options = {
        chordToleranceMM: o.chordToleranceMM, maxSegments: o.maxSegments,
        maxDepth: o.maxDepth, resultIdPrefix: prefix,
    };
    const request = {
        source: data.source, sourceVersion: 0, curveId, options,
    };
    check(request.source.length <= 262144 && new TextEncoder().encode(request.source).length <= 262144, CODE.BUDGET, 'Complete Source0 exceeds unchanged source cap');
    const requestSize = fileSize(request, REQUEST_LIMIT);
    const counts = {
        originalSourceCompileCount: 0, extractionInvocationCount: 0,
        coefficientHelperInvocationCount: 0, subdivisionSourceCompileCount: 0,
        curveD0AttemptCount: 0, curveD1AttemptCount: 0,
        curveD1EvaluatedCount: 0, curveD1NativeRefusedCount: 0,
        visitedIntervalCount: 0, splitAttemptCount: 0,
        acceptedLeafCount: 0, outputPointCount: 0,
    };
    counts.originalSourceCompileCount++;
    const compiled = delegated(() => compileCadModel(request.source, { sourceVersion: 0 }), CODE.SOURCE, 'Complete original Source0 compilation failed');
    if (!compiled.ok)
        throw new SourceCurveAdaptiveSamplingError(CODE.SOURCE, 'Complete original Source0 compilation refused', compiled);
    const originalModel = compiled.model;
    check(originalModel.objects.length <= 16, CODE.BUDGET, 'Original Model16 cap exceeded');
    const objectIndex = originalModel.objects.findIndex(object => object.id === curveId);
    check(objectIndex >= 0 && originalModel.objects[objectIndex].kind === 'curve', CODE.REFERENCE, 'A selected original Curve object is required');
    const original = originalModel.objects[objectIndex];
    check(Number.isInteger(original.degree) && original.degree >= 1 && original.degree <= 5 &&
        original.controlPoints.length >= 2 && original.controlPoints.length <= 64 && original.knots.length <= 70, CODE.INPUT, 'Selected degree1..5 Curve64/70 profile required');
    check(original.controlPoints.every(point => point.length === 3 &&
        point.every(value => Number.isFinite(value) && Math.abs(value) <= 10000)) &&
        original.weights.every(weight => Number.isFinite(weight) && weight >= 1e-6 && weight <= 1e6), CODE.INPUT, 'Selected finite XYZ10000 and positive bounded weights required');
    delegated(() => validateCurve(original), CODE.NATIVE, 'Original native Curve admission failed');
    const domain = delegated(() => curveDomain(original), CODE.NATIVE, 'Original Curve domain failed');
    const knotSpans = [];
    for (let k = original.degree; k < original.controlPoints.length; k++) {
        if (original.knots[k] < original.knots[k + 1]) {
            check(finite(original.knots[k + 1] - original.knots[k], 'Original span width overflow') > 0, CODE.SPAN, 'Positive represented original span required');
            if (knotSpans.length) {
                const previous = knotSpans[knotSpans.length - 1];
                check(Object.is(original.knots[previous + 1], original.knots[k]), CODE.SPAN, 'Neighboring original span endpoint bits disagree');
            }
            knotSpans.push(k);
        }
    }
    const spanCount = knotSpans.length;
    check(spanCount >= 1 && spanCount <= 63, CODE.SPAN, 'Original nonzero spans1..63 required');
    check(options.maxSegments >= spanCount, CODE.BUDGET, 'Leaf budget below original span count');
    const splitCapacity = options.maxSegments - spanCount;
    const role = (suffix) => identifier(prefix + suffix);
    const generatedIds = [];
    for (let i = 0; i < spanCount; i++)
        generatedIds.push(role('_span_' + i));
    for (let k = 0; k < splitCapacity; k++)
        generatedIds.push(role('_split_' + k + '_lo'), role('_split_' + k + '_hi'), role('_split_' + k + '_model'));
    for (let j = 0; j < options.maxSegments; j++)
        generatedIds.push(role('_seg_' + j));
    for (let j = 0; j <= options.maxSegments; j++)
        generatedIds.push(role('_pt_' + j));
    const originalIds = new Set([originalModel.name, ...originalModel.objects.map(object => object.id)]);
    check(generatedIds.length <= 20479 && new Set(generatedIds).size === generatedIds.length &&
        generatedIds.every(value => !originalIds.has(value)), CODE.IDENTITY, 'Complete reserved-role inventory collides with original context or itself');
    const spans = [], operations = [], samples = [];
    const bindings = {
        original: { requestSourcePath: 'request.source', sourceVersion: 0,
            modelName: originalModel.name, objectIndex, curveId },
        extractions: [], subdivisions: [],
    };
    const prefixGuard = () => {
        const retained = { request, originalModel, curve: original, domain, samples, spans,
            operations, bindings, generatedIds, directCounts: counts };
        ownData(retained, false, false);
        fileSize(retained, RESULT_LIMIT);
    };
    const point = (curve, parameter) => {
        check(counts.curveD0AttemptCount < 45055, CODE.BUDGET, 'Root D0 attempt budget exhausted');
        counts.curveD0AttemptCount++;
        const value = delegated(() => evaluateCurve(curve, parameter), CODE.NATIVE, 'Actual Curve D0 evaluation failed');
        check(value.every(Number.isFinite), CODE.NATIVE, 'Finite native D0 required');
        return value;
    };
    const d1 = (curve, parameter) => {
        check(counts.curveD1AttemptCount < 24576, CODE.BUDGET, 'Root D1 attempt budget exhausted');
        counts.curveD1AttemptCount++;
        try {
            const value = evaluateCurveD1(curve, parameter);
            check(value.point.every(Number.isFinite) && value.derivative.every(Number.isFinite), CODE.NATIVE, 'Finite native D1 point and derivative required');
            counts.curveD1EvaluatedCount++;
            return { status: 'evaluated', value };
        }
        catch (cause) {
            if (cause instanceof Error &&
                cause.message === 'First derivative is not defined at an exact C0 interior knot') {
                counts.curveD1NativeRefusedCount++;
                return { status: 'native-refused', reason: cause.message };
            }
            if (cause instanceof SourceCurveAdaptiveSamplingError)
                throw cause;
            throw new SourceCurveAdaptiveSamplingError(CODE.NATIVE, 'Actual Curve D1 evaluation failed', cause);
        }
    };
    const leaves = [];
    let leafCapacity = spanCount;
    const visit = (localCurve, originalSpanIndex, depth, origin) => {
        prefixGuard();
        check(counts.visitedIntervalCount < 8191, CODE.BUDGET, 'Root interval visit budget exhausted');
        counts.visitedIntervalCount++;
        const interval = delegated(() => curveDomain(localCurve), CODE.NATIVE, 'Local Curve domain failed');
        check(localCurve.degree === original.degree && localCurve.controlPoints.length === original.degree + 1 &&
            localCurve.controlPoints.length <= 6 && localCurve.knots.length === 2 * (original.degree + 1), CODE.NATIVE, 'Actual local single-span Bezier required');
        check(localCurve.controlPoints.every(control => control.every(value => Number.isFinite(value) && Math.abs(value) <= 10000)) && localCurve.weights.every(weight => Number.isFinite(weight) && weight >= 1e-6 && weight <= 1e6), CODE.NATIVE, 'Actual local control/weight native profile required');
        const startMM = point(original, interval[0]), endMM = point(original, interval[1]);
        const controlPolygonBoundMM = finite(Math.max(...localCurve.controlPoints.map(control => chordDistance(control, startMM, endMM))), 'Control polygon bound overflow');
        const chordLength = distance(endMM, startMM);
        const scale = finite(Math.max(1, chordLength, ...localCurve.controlPoints.flatMap(control => control.map(Math.abs)), ...startMM.map(Math.abs), ...endMM.map(Math.abs)), 'Arithmetic scale overflow');
        const arithmeticUncertaintyMM = finite(EPS * scale, 'Arithmetic margin overflow');
        const gap = finite(options.chordToleranceMM - controlPolygonBoundMM, 'Criterion subtraction overflow');
        check(Math.abs(gap) > arithmeticUncertaintyMM, CODE.REPRESENTABILITY, 'Finite chord acceptance threshold unresolved');
        const acceptance = finite(controlPolygonBoundMM + arithmeticUncertaintyMM, 'Criterion addition overflow');
        if (acceptance <= options.chordToleranceMM) {
            check(leaves.length < options.maxSegments, CODE.BUDGET, 'Accepted leaf budget exhausted');
            const parameters = [interval[0], midpoint(interval), interval[1]];
            const observations = parameters.map((parameter) => {
                const originalPointMM = point(original, parameter), localPointMM = point(localCurve, parameter);
                const extractionDifferenceMM = distance(originalPointMM, localPointMM);
                check(extractionDifferenceMM <= 1e-7, CODE.BINDING, 'Original/local point residual exceeds1e-7mm');
                const originalD1 = d1(original, parameter), localD1 = d1(localCurve, parameter);
                let derivativeDifferenceMM = null;
                let relativeDerivativeDifference = null;
                if (originalD1.status === 'evaluated' && localD1.status === 'evaluated') {
                    derivativeDifferenceMM = distance(originalD1.value.derivative, localD1.value.derivative);
                    const originalNorm = finite(Math.hypot(...originalD1.value.derivative), 'Original derivative norm overflow', CODE.BINDING);
                    finite(Math.hypot(...localD1.value.derivative), 'Local derivative norm overflow', CODE.BINDING);
                    const denominator = finite(Math.max(1, originalNorm), 'Derivative scale overflow', CODE.BINDING);
                    relativeDerivativeDifference = finite(derivativeDifferenceMM / denominator, 'Relative derivative difference overflow', CODE.BINDING);
                    check(relativeDerivativeDifference <= 1e-7, CODE.BINDING, 'Original/local D1 relative residual exceeds1e-7');
                }
                return { parameter, originalPointMM, localPointMM, extractionDifferenceMM,
                    outputChordDistanceMM: chordDistance(originalPointMM, startMM, endMM),
                    originalD1, localD1, derivativeDifferenceMM, relativeDerivativeDifference };
            });
            const leaf = { id: role('_seg_' + leaves.length), originalSpanIndex, depth,
                domain: interval, localCurve, origin,
                finiteChord: { startMM, endMM, degenerate: startMM.every((value, axis) => value === endMM[axis]) },
                controlPolygonBoundMM, arithmeticUncertaintyMM, observations,
                maximumExtractionDifferenceMM: Math.max(...observations.map(value => value.extractionDifferenceMM)),
                maximumObservedOutputChordDistanceMM: Math.max(...observations.map(value => value.outputChordDistanceMM)),
                maximumRelativeDerivativeDifference: Math.max(0, ...observations.map(value => value.relativeDerivativeDifference ?? 0)) };
            leaves.push(leaf);
            spans[originalSpanIndex].leaves.push(leaf);
            counts.acceptedLeafCount++;
            prefixGuard();
            return;
        }
        check(depth < options.maxDepth, CODE.BUDGET, 'Adaptive maxDepth exhausted');
        check(leafCapacity < options.maxSegments && operations.length < splitCapacity && operations.length < 4095, CODE.BUDGET, 'Prospective leaf/split budget exhausted');
        const parameter = midpoint(interval), index = operations.length;
        prefixGuard();
        counts.splitAttemptCount++;
        const subdivision = delegated(() => splitBezierCurveTrusted(localCurve, parameter, role('_split_' + index + '_lo'), role('_split_' + index + '_hi'), role('_split_' + index + '_model')), CODE.NATIVE, 'Actual local trusted subdivision failed');
        check(subdivision.directCounts.coefficientHelperInvocationCount === 1 &&
            subdivision.directCounts.sourceCompileCount === 1, CODE.BINDING, 'Actual subdivision delegate counts disagree');
        counts.coefficientHelperInvocationCount += subdivision.directCounts.coefficientHelperInvocationCount;
        counts.subdivisionSourceCompileCount += subdivision.directCounts.sourceCompileCount;
        check(subdivision.coefficientResult.candidate.controlPoints.length === 2 * original.degree + 1 &&
            subdivision.coefficientResult.candidate.controlPoints.length <= 11 &&
            subdivision.coefficientResult.candidate.knots.length <= 17 &&
            subdivision.lower.controlPoints.length === original.degree + 1 &&
            subdivision.upper.controlPoints.length === original.degree + 1, CODE.BINDING, 'Actual subdivision dimensions disagree');
        operations.push({ index, purpose: 'adaptive-subdivision', originalSpanIndex,
            depth: depth + 1, inputOrigin: origin, subdivision });
        bindings.subdivisions.push({ operationIndex: index,
            sourcePath: 'operations[' + index + '].subdivision.source',
            modelPath: 'operations[' + index + '].subdivision.model',
            modelName: subdivision.model.name, lowerCurveId: subdivision.lower.id,
            upperCurveId: subdivision.upper.id });
        leafCapacity++;
        prefixGuard();
        visit(subdivision.lower, originalSpanIndex, depth + 1, { kind: 'split', operationIndex: index, side: 'lower' });
        visit(subdivision.upper, originalSpanIndex, depth + 1, { kind: 'split', operationIndex: index, side: 'upper' });
    };
    prefixGuard();
    for (const [index, knotSpanIndex] of knotSpans.entries()) {
        prefixGuard();
        counts.extractionInvocationCount++;
        let extraction;
        try {
            extraction = extractCurveBezierSpanTrusted(original, knotSpanIndex, index, role('_span_' + index));
        }
        catch (cause) {
            const inherited = cause instanceof Error && 'code' in cause ? cause.code : null;
            const code = typeof inherited === 'string' && Object.hasOwn(CODE, inherited)
                ? inherited : CODE.NATIVE;
            throw new SourceCurveAdaptiveSamplingError(code, 'Actual analytic span extraction failed', cause);
        }
        spans.push({ extraction, leaves: [] });
        bindings.extractions.push({ spanIndex: index,
            sourcePath: 'spans[' + index + '].extraction.nativeSpanSource',
            modelPath: 'spans[' + index + '].extraction.nativeSpanModel',
            modelName: extraction.nativeSpanModel.name, curveId: extraction.bezier.id });
        prefixGuard();
    }
    for (const span of spans)
        visit(span.extraction.bezier, span.extraction.index, 0, { kind: 'extraction', operationIndex: null, side: null });
    check(leaves.length === leafCapacity && operations.length === leaves.length - spanCount, CODE.BINDING, 'Actual adaptive forest leaf/split counts disagree');
    const parameters = [leaves[0].domain[0]];
    for (const [index, leaf] of leaves.entries()) {
        check(leaf.domain[0] < leaf.domain[1], CODE.SPAN, 'Positive accepted interval required');
        if (index)
            check(Object.is(leaves[index - 1].domain[1], leaf.domain[0]), CODE.SPAN, 'Accepted neighboring parameter bits disagree');
        parameters.push(leaf.domain[1]);
    }
    check(parameters.length <= 4097 && Object.is(parameters[0], domain[0]) &&
        Object.is(parameters[parameters.length - 1], domain[1]), CODE.BINDING, 'Original endpoint bits or final sample capacity changed');
    const originalGuardedParameters = [];
    for (const k of knotSpans.slice(1)) {
        const parameter = original.knots[k];
        if (original.knots.filter(value => value === parameter).length >= original.degree) {
            originalGuardedParameters.push(parameter);
        }
    }
    for (const [index, parameter] of parameters.entries()) {
        const pointMM = point(original, parameter);
        counts.outputPointCount++;
        const adjacent = leaves.filter(leaf => leaf.domain[0] === parameter || leaf.domain[1] === parameter);
        const originalSpanIndices = [];
        for (const leaf of adjacent)
            if (!originalSpanIndices.includes(leaf.originalSpanIndex)) {
                originalSpanIndices.push(leaf.originalSpanIndex);
            }
        samples.push({ id: role('_pt_' + index), parameter, pointMM,
            adjacentSegmentIds: adjacent.map(leaf => leaf.id), originalSpanIndices,
            atOriginalKnot: original.knots.some(value => value === parameter),
            originalD1Guarded: originalGuardedParameters.some(value => value === parameter) });
    }
    const leafCount = leaves.length, operationCount = operations.length;
    check(counts.originalSourceCompileCount === 1 && counts.extractionInvocationCount === spanCount &&
        counts.visitedIntervalCount === 2 * leafCount - spanCount && counts.splitAttemptCount === operationCount &&
        counts.coefficientHelperInvocationCount === operationCount &&
        counts.subdivisionSourceCompileCount === operationCount && counts.acceptedLeafCount === leafCount &&
        counts.outputPointCount === leafCount + 1 && counts.curveD0AttemptCount === 11 * leafCount - 2 * spanCount + 1 &&
        counts.curveD1AttemptCount === 6 * leafCount &&
        counts.curveD1EvaluatedCount + counts.curveD1NativeRefusedCount === counts.curveD1AttemptCount, CODE.BINDING, 'Actual successful sampling schedule counters disagree');
    prefixGuard();
    const report = {
        family: 'complete-source-adaptive-native-rational-curve-display-samples',
        sourceVersion: 0, curveId, degree: original.degree, lengthUnit: 'mm', domain,
        originalPoleCount: original.controlPoints.length, originalKnotCount: original.knots.length,
        originalSpanCount: spanCount, segmentCount: leafCount, pointCount: samples.length,
        operationCount, maximumDepthUsed: Math.max(...leaves.map(leaf => leaf.depth)),
        maximumControlPolygonBoundMM: Math.max(...leaves.map(leaf => leaf.controlPolygonBoundMM)),
        maximumArithmeticUncertaintyMM: Math.max(...leaves.map(leaf => leaf.arithmeticUncertaintyMM)),
        maximumExtractionDifferenceMM: Math.max(...leaves.map(leaf => leaf.maximumExtractionDifferenceMM)),
        maximumObservedOutputChordDistanceMM: Math.max(...leaves.map(leaf => leaf.maximumObservedOutputChordDistanceMM)),
        maximumRelativeDerivativeDifference: Math.max(...leaves.map(leaf => leaf.maximumRelativeDerivativeDifference)),
        maximumPartitionResidual: Math.max(...spans.map(span => span.extraction.maximumPartitionResidual)),
        originalGuardedParameters, bindings, generatedIds, directCounts: counts,
        delegatedReceipts: { extractionCount: spans.length, extractionSourceCompileReceiptCount: spans.length,
            coefficientResultCount: operations.length, subdivisionModelCount: operations.length },
        quality: { geometryAuthority: 'original-native-evaluateCurve',
            representation: 'sampled-display-points-not-native-edges-or-fit',
            criterion: 'finite-segment-control-hull-estimate-plus-arithmetic-margin',
            extraction: 'existing-local-cox-de-boor-to-bernstein',
            subdivision: 'existing-homogeneous-knot-insertion-and-indexed-children',
            geometricValidity: 'not-certified', localObservationsOnly: true,
            globalErrorCertified: false, globalBinary64ErrorCertified: false,
            manufacturingToleranceCertified: false, topologyCertified: false, solid: false,
            derivativeSemantics: 'original-native-c0-refusals-and-local-one-sided-d1',
            ownership: 'copied-cpu-data-gc-no-renderer-resources' },
        limits: limits(), fileSizes: { request: requestSize, result: { utf16: 0, utf8: 0 } }, ownValues: 0,
    };
    const result = {
        request, originalModel, curve: original, domain, samples, spans, operations, report,
    };
    let settled = false;
    for (let pass = 0; pass < 8; pass++) {
        const ownValues = ownData(result, false, false).count;
        const size = fileSize(result, RESULT_LIMIT);
        if (report.ownValues === ownValues && same(report.fileSizes.result, size)) {
            settled = true;
            break;
        }
        report.ownValues = ownValues;
        report.fileSizes.result = size;
    }
    check(settled, CODE.FILE, 'Complete result file/own measurements did not settle in8 passes');
    check(report.ownValues === ownData(result, false, false).count &&
        same(report.fileSizes.result, fileSize(result, RESULT_LIMIT)), CODE.FILE, 'Independent final complete result measurement disagrees');
    return ownData(result).value;
}
/** Reconstruct once from the full request and return an independent complete Report. */
export function validateSourceCurveAdaptive(input) {
    try {
        const result = ownData(input, true).value;
        const data = record(result, ['request', 'originalModel', 'curve', 'domain',
            'samples', 'spans', 'operations', 'report']);
        fileSize(result, RESULT_LIMIT);
        const expected = sampleSourceCurveAdaptive(data.request);
        check(same(result, expected), CODE.OWNED, 'Complete sampled result differs from independent reconstruction');
        return ownData(expected.report, true).value;
    }
    catch (cause) {
        if (cause instanceof SourceCurveAdaptiveSamplingError && cause.code === CODE.OWNED)
            throw cause;
        throw new SourceCurveAdaptiveSamplingError(CODE.OWNED, 'Whole sampled result ownership reconstruction refused', cause);
    }
}

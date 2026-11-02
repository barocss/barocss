import { CadNumericPolicy } from '../numeric-policy.js';
import { validateCurve, validateSurface, curveDomain, surfaceDomain, evaluateCurve, evaluateSurface } from '../core/math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from '../core/derivatives.js';
import { adopt } from '../intersect/own-plane-cylinder-intersection-internal.js';
import { copyCadData } from '../data-copy.js';
import { same } from '../core/structural-equality.js';
import { KernelError } from '../core/barocss-error.js';
export const AffineGeometryTransformDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', MATRIX: 'MATRIX', BUDGET: 'BUDGET',
    NATIVE: 'NATIVE', REPRESENTABILITY: 'REPRESENTABILITY', BINDING: 'BINDING', OWNED: 'OWNED' });
export class AffineGeometryTransformError extends KernelError {
    code;
    constructor(code, detail, cause) {
        super(('Affine native geometry transform: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
        this.name = 'AffineGeometryTransformError';
        this.code = code;
    }
}
const CODE = AffineGeometryTransformDiagnosticCode, TOLERANCE = CadNumericPolicy.linearTolerance;
function check(condition, code, detail, cause) {
    if (!condition)
        throw new AffineGeometryTransformError(code, detail, cause);
}
function native(action, detail, code = CODE.NATIVE) {
    try {
        return action();
    }
    catch (cause) {
        if (cause instanceof AffineGeometryTransformError)
            throw cause;
        throw new AffineGeometryTransformError(code, detail + ': ' + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
    }
}
function snapshot(input, owned = false) {
    const code = owned ? CODE.OWNED : CODE.INPUT;
    let remaining = owned ? 1048576 : 32768;
    const ancestors = new Set();
    const copy = (value, depth) => {
        check(--remaining >= 0 && depth <= (owned ? 40 : 8), code, 'own-value/depth budget exceeded');
        if (owned && (value === null || typeof value === 'boolean'))
            return value;
        if (typeof value === 'number') {
            check(Number.isFinite(value), code, 'finite own numbers required');
            return value;
        }
        if (typeof value === 'string') {
            check(value.length <= (owned ? 262144 : 128), code, 'own/source string budget exceeded');
            return value;
        }
        check(value !== null && typeof value === 'object', code, 'plain own data required');
        check(!ancestors.has(value), code, 'ancestor cycles refused');
        const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
        check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'foreign own-data prototype refused');
        check(keys.length <= (array ? (owned ? 8193 : 129) : (owned ? 64 : 16)) && keys.every(key => typeof key === 'string' && key.length <= 128
            && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getter/symbol/hidden/excess own fields refused');
        ancestors.add(value);
        try {
            if (array) {
                const n = descriptors.length.value;
                check(Number.isInteger(n) && n >= 0 && n <= (owned ? 8192 : 128) && keys.length === n + 1, code, 'dense bounded own array required');
                return Array.from({ length: n }, (_, i) => { check(Object.hasOwn(descriptors, String(i)), code, 'sparse/foreign own array field refused'); return copy(descriptors[String(i)].value, depth + 1); });
            }
            return Object.fromEntries(keys.map(key => [key, copy(descriptors[key].value, depth + 1)]));
        }
        finally {
            ancestors.delete(value);
        }
    };
    return copy(input, 0);
}
function record(input, fields, code = CODE.INPUT) {
    check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'own record required');
    const data = input;
    check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'exact fields required: ' + fields.join(','));
    return data;
}
function id(value) { check(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'ASCII ID1..48 required'); return value; }
function finite(value, code = CODE.REPRESENTABILITY) {
    check(Number.isFinite(value), code, 'finite arithmetic required');
    return value;
}
function product(a, b, code = CODE.REPRESENTABILITY) {
    const value = finite(a * b, code);
    check(a === 0 || b === 0 || value !== 0, code, 'nonzero product underflow');
    return value;
}
function addContribution(a, b) {
    const value = finite(a + b);
    check(b === 0 || value !== a, CODE.REPRESENTABILITY, 'nonzero affine contribution disappeared');
    check(a === 0 || b === 0 || value !== b, CODE.REPRESENTABILITY, 'prior nonzero affine contribution disappeared');
    return value;
}
function distance(a, b) { return finite(Math.hypot(...a.map((value, i) => finite(value - b[i])))); }
function relative(a, b) {
    const difference = distance(a, b), value = finite(difference / Math.max(1, finite(Math.hypot(...a)), finite(Math.hypot(...b))));
    check(difference === 0 || value !== 0, CODE.REPRESENTABILITY, 'nonzero local residual underflow');
    return value;
}
function cross(a, b) {
    return [finite(product(a[1], b[2]) - product(a[2], b[1])),
        finite(product(a[2], b[0]) - product(a[0], b[2])), finite(product(a[0], b[1]) - product(a[1], b[0]))];
}
function attempt(action, refused) {
    try {
        return { status: 'evaluated', value: action() };
    }
    catch (cause) {
        check(cause instanceof Error, CODE.NATIVE, 'actual native D1 refusal must carry an Error');
        refused(cause);
        return { status: 'native-refused', reason: cause.message.slice(0, 1024), nativeErrorName: cause.name.slice(0, 128) };
    }
}
export function mapPoint(matrix, point, translation) {
    const axes = [];
    const values = [0, 1, 2].map(axis => {
        const offset = axis * 4, row = [matrix[offset], matrix[offset + 1], matrix[offset + 2], translation ? matrix[offset + 3] : 0];
        const terms = [product(row[0], point[0]), product(row[1], point[1]), product(row[2], point[2]), row[3]];
        const copied = row[axis] === 1 && row.slice(0, 3).every((value, i) => i === axis || value === 0) && row[3] === 0;
        let value = point[axis];
        if (!copied) {
            value = 0;
            for (const term of terms)
                if (term !== 0)
                    value = addContribution(value, term);
        }
        axes.push({ axis, row, terms, value, policy: copied ? 'identity-axis-bit-copy' : 'guarded-affine-dot' });
        return value;
    });
    return { point: values, axes };
}
function schedule(knots, degree, count, maximum) {
    const domain = [knots[degree], knots[count]];
    check(domain[1] > domain[0] && Number.isFinite(domain[1] - domain[0]), CODE.INPUT, 'finite positive original domain required');
    const breaks = [domain[0]];
    for (const knot of knots)
        if (knot > domain[0] && knot < domain[1] && knot !== breaks[breaks.length - 1])
            breaks.push(knot);
    breaks.push(domain[1]);
    const values = [], gaps = [];
    for (let i = 0; i < breaks.length; i++) {
        values.push(breaks[i]);
        if (i + 1 === breaks.length)
            continue;
        const middle = finite(breaks[i] + finite(breaks[i + 1] - breaks[i]) / 2);
        if (middle > breaks[i] && middle < breaks[i + 1])
            values.push(middle);
        else
            gaps.push({ domain: [breaks[i], breaks[i + 1]], attemptedParameter: middle });
    }
    check(values.length <= maximum, CODE.BUDGET, 'complete original parameter sample capacity exceeded');
    return { values, gaps };
}
function admit(input) {
    const data = input;
    check(data && (data.kind === 'curve' || data.kind === 'surface'), CODE.INPUT, 'original native Curve/Surface required');
    const original = record(input, data.kind === 'curve' ? ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']
        : ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']);
    id(original.id);
    native(() => original.kind === 'curve' ? validateCurve(original) : validateSurface(original), 'actual original native positive clamped validation', CODE.INPUT);
    const poles = original.kind === 'curve' ? original.controlPoints : original.controlPoints.flat();
    check(poles.every(point => point.every(value => Math.abs(value) <= 10000)), CODE.INPUT, 'original native XYZ within10000mm required');
    const knots = original.kind === 'curve' ? original.knots : [...original.knotsU, ...original.knotsV];
    check(knots.every(value => Math.abs(value) <= 10000), CODE.INPUT, 'original native knots within10000 required');
    if (original.kind === 'curve')
        check(original.degree >= 1 && original.degree <= 5 && original.controlPoints.length >= 2 && original.controlPoints.length <= 64, CODE.INPUT, 'native degree1..5/poles2..64 Curve required');
    else
        check(original.degreeU >= 1 && original.degreeU <= 5 && original.degreeV >= 1 && original.degreeV <= 5
            && original.controlPoints.length >= 2 && original.controlPoints.length <= 16 && original.controlPoints[0].length >= 2 && original.controlPoints[0].length <= 16
            && poles.length <= 256, CODE.INPUT, 'native degree1..5/axes2..16 Surface required');
    return original;
}
/** Affine native coefficient copy in the unchanged original parameter basis. */
export function transformNativeGeometryAffine(originalInput, matrixInput, optionsInput) {
    const data = record(snapshot({ original: originalInput, matrix: matrixInput, options: optionsInput }), ['original', 'matrix', 'options']);
    const original = admit(data.original), optionData = record(data.options, ['geometryId', 'maximumObservations']);
    const geometryId = id(optionData.geometryId);
    check(geometryId !== original.id, CODE.IDENTITY, 'original and target IDs must differ');
    check(typeof optionData.maximumObservations === 'number' && Number.isInteger(optionData.maximumObservations) && optionData.maximumObservations >= 0 && optionData.maximumObservations <= 961, CODE.BUDGET, 'maximumObservations integer0..961 required');
    const options = { geometryId, maximumObservations: optionData.maximumObservations };
    check(Array.isArray(data.matrix) && data.matrix.length === 12 && data.matrix.every((value, i) => typeof value === 'number'
        && Number.isFinite(value) && Math.abs(value) <= (i % 4 === 3 ? 10000 : 1000)), CODE.MATRIX, 'finite row-major matrix12 with bounded linear/translation coefficients required');
    const matrix = data.matrix;
    const triple = (a, b, c) => product(product(a, b, CODE.MATRIX), c, CODE.MATRIX);
    const signedTripleTerms = [triple(matrix[0], matrix[5], matrix[10]), triple(matrix[1], matrix[6], matrix[8]),
        triple(matrix[2], matrix[4], matrix[9]), -triple(matrix[2], matrix[5], matrix[8]), -triple(matrix[1], matrix[4], matrix[10]), -triple(matrix[0], matrix[6], matrix[9])];
    let determinant = 0, absoluteTripleSum = 0;
    for (const term of signedTripleTerms) {
        determinant = finite(determinant + term, CODE.MATRIX);
        absoluteTripleSum = finite(absoluteTripleSum + Math.abs(term), CODE.MATRIX);
    }
    const determinantThreshold = product(128 * Number.EPSILON, absoluteTripleSum, CODE.MATRIX);
    check(absoluteTripleSum > 0 && Math.abs(determinant) > determinantThreshold, CODE.MATRIX, 'singular or cancellation-uncertain linear determinant refused');
    const emptySchedule = { values: [], gaps: [] };
    const curveSamples = original.kind === 'curve' ? schedule(original.knots, original.degree, original.controlPoints.length, 127) : emptySchedule;
    const uSamples = original.kind === 'surface' ? schedule(original.knotsU, original.degreeU, original.controlPoints.length, 31) : emptySchedule;
    const vSamples = original.kind === 'surface' ? schedule(original.knotsV, original.degreeV, original.controlPoints[0].length, 31) : emptySchedule;
    const observationCount = original.kind === 'curve' ? curveSamples.values.length : uSamples.values.length * vSamples.values.length;
    check(observationCount <= options.maximumObservations && observationCount <= 961, CODE.BUDGET, 'complete original parameter observations exceed caller budget before coefficient/source work');
    const coefficientMappings = [];
    const mapCoefficient = (point, controlPoint) => {
        const mapped = mapPoint(matrix, point, true);
        check(mapped.point.every(value => Math.abs(value) <= 10000), CODE.REPRESENTABILITY, 'generated native XYZ exceeds10000mm');
        coefficientMappings.push({ controlPoint, originalPoint: point, targetPoint: mapped.point, axes: mapped.axes });
        return mapped.point;
    };
    const geometry = copyCadData(original);
    geometry.id = geometryId;
    if (geometry.kind === 'curve' && original.kind === 'curve')
        geometry.controlPoints = original.controlPoints.map((point, i) => mapCoefficient(point, [i]));
    else if (geometry.kind === 'surface' && original.kind === 'surface')
        geometry.controlPoints = original.controlPoints.map((row, i) => row.map((point, j) => mapCoefficient(point, [i, j])));
    check(same({ ...original, id: geometryId, controlPoints: geometry.controlPoints }, geometry), CODE.BINDING, 'only native ID and control points may change');
    native(() => geometry.kind === 'curve' ? validateCurve(geometry) : validateSurface(geometry), 'actual transformed native validation');
    const expectedModel = { name: geometryId, version: 0, lengthUnit: 'mm', objects: [original, geometry] };
    const adopted = native(() => adopt(expectedModel), 'actual original+target Source0 serialization/compile binding');
    check(adopted.source.length <= 262144 && same(adopted.model, expectedModel), CODE.BINDING, 'bounded compiled original+target Model must preserve every coefficient bit');
    const observations = [];
    let originalD0EvaluationCount = 0, targetD0EvaluationCount = 0, originalD1AttemptCount = 0, targetD1AttemptCount = 0;
    let derivativeComparisonCount = 0, derivativeRefusalCount = 0, originalRefusalCount = 0, targetRefusalCount = 0;
    let maximumPointDifferenceMM = 0, maximumRelativeDerivativeDifference = null, maximumRelativeCrossDifference = null, degenerateCrossObservationCount = 0;
    const pointBinding = (sourcePoint, targetPoint) => {
        const expectedPointMM = mapPoint(matrix, sourcePoint, true).point, differenceMM = distance(expectedPointMM, targetPoint);
        check(differenceMM <= TOLERANCE, CODE.BINDING, 'actual native target point does not match affine original point');
        maximumPointDifferenceMM = Math.max(maximumPointDifferenceMM, differenceMM);
        return { originalPoint: sourcePoint, expectedPoint: expectedPointMM, actualPoint: targetPoint, difference: differenceMM };
    };
    const recordRelative = (actual, expected) => {
        const value = relative(actual, expected);
        check(value <= TOLERANCE, CODE.BINDING, 'actual native transformed derivative does not match linear original derivative');
        maximumRelativeDerivativeDifference = Math.max(maximumRelativeDerivativeDifference ?? 0, value);
        return value;
    };
    const matchStates = (source, target, sourceCause, targetCause) => {
        check(source.status === target.status, CODE.BINDING, 'original/target actual native D1 refusal asymmetry', sourceCause ?? targetCause);
        if (source.status === 'native-refused' && target.status === 'native-refused') {
            check(source.reason === target.reason && source.nativeErrorName === target.nativeErrorName, CODE.BINDING, 'original/target actual native D1 refusal states differ', sourceCause ?? targetCause);
            derivativeRefusalCount++;
        }
        else
            derivativeComparisonCount++;
    };
    if (original.kind === 'curve' && geometry.kind === 'curve')
        for (const parameter of curveSamples.values) {
            originalD0EvaluationCount++;
            const sourcePoint = native(() => evaluateCurve(original, parameter), 'actual original Curve point');
            targetD0EvaluationCount++;
            const targetPoint = native(() => evaluateCurve(geometry, parameter), 'actual target Curve point');
            let sourceCause, targetCause;
            originalD1AttemptCount++;
            const originalD1 = attempt(() => evaluateCurveD1(original, parameter), cause => { sourceCause = cause; originalRefusalCount++; });
            targetD1AttemptCount++;
            const targetD1 = attempt(() => evaluateCurveD1(geometry, parameter), cause => { targetCause = cause; targetRefusalCount++; });
            matchStates(originalD1, targetD1, sourceCause, targetCause);
            let expectedDerivativeMM = null, relativeDerivativeDifference = null;
            if (originalD1.status === 'evaluated' && targetD1.status === 'evaluated') {
                expectedDerivativeMM = mapPoint(matrix, originalD1.value.derivative, false).point;
                relativeDerivativeDifference = recordRelative(targetD1.value.derivative, expectedDerivativeMM);
            }
            observations.push({ kind: 'curve', parameter, ...pointBinding(sourcePoint, targetPoint), originalD1, targetD1, expectedDerivative: expectedDerivativeMM, relativeDerivativeDifference });
        }
    if (original.kind === 'surface' && geometry.kind === 'surface')
        for (const u of uSamples.values)
            for (const v of vSamples.values) {
                originalD0EvaluationCount++;
                const sourcePoint = native(() => evaluateSurface(original, u, v), 'actual original Surface point');
                targetD0EvaluationCount++;
                const targetPoint = native(() => evaluateSurface(geometry, u, v), 'actual target Surface point');
                let sourceCause, targetCause;
                originalD1AttemptCount++;
                const originalD1 = attempt(() => evaluateSurfaceD1(original, u, v), cause => { sourceCause = cause; originalRefusalCount++; });
                targetD1AttemptCount++;
                const targetD1 = attempt(() => evaluateSurfaceD1(geometry, u, v), cause => { targetCause = cause; targetRefusalCount++; });
                matchStates(originalD1, targetD1, sourceCause, targetCause);
                let expectedDuMM = null, expectedDvMM = null, relativeDuDifference = null, relativeDvDifference = null;
                let expectedCrossMM2 = null, actualCrossMM2 = null, relativeCrossDifference = null, crossDegenerate = null;
                if (originalD1.status === 'evaluated' && targetD1.status === 'evaluated') {
                    expectedDuMM = mapPoint(matrix, originalD1.value.du, false).point;
                    expectedDvMM = mapPoint(matrix, originalD1.value.dv, false).point;
                    relativeDuDifference = recordRelative(targetD1.value.du, expectedDuMM);
                    relativeDvDifference = recordRelative(targetD1.value.dv, expectedDvMM);
                    expectedCrossMM2 = cross(expectedDuMM, expectedDvMM);
                    actualCrossMM2 = cross(targetD1.value.du, targetD1.value.dv);
                    relativeCrossDifference = relative(actualCrossMM2, expectedCrossMM2);
                    check(relativeCrossDifference <= TOLERANCE, CODE.BINDING, 'actual transformed Surface local cross mismatch');
                    maximumRelativeCrossDifference = Math.max(maximumRelativeCrossDifference ?? 0, relativeCrossDifference);
                    crossDegenerate = Math.hypot(...actualCrossMM2) === 0 || Math.hypot(...expectedCrossMM2) === 0;
                    if (crossDegenerate)
                        degenerateCrossObservationCount++;
                }
                observations.push({ kind: 'surface', u, v, ...pointBinding(sourcePoint, targetPoint), originalD1, targetD1, expectedDu: expectedDuMM, expectedDv: expectedDvMM, relativeDuDifference, relativeDvDifference,
                    expectedCross: expectedCrossMM2, actualCross: actualCrossMM2, relativeCrossDifference, crossDegenerate });
            }
    const report = {
        schema: 'barocss-native-affine-geometry-transform', version: 0, originalId: original.id, geometryId, kind: original.kind, lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion',
        matrixRoles: { order: 'row-major-three-by-four-column-vector', linearUnit: 'dimensionless', translationUnit: 'mm' }, determinant, signedTripleTerms, absoluteTripleSum, determinantThreshold,
        handedness: determinant > 0 ? 'preserved' : 'reversed', domains: { curve: original.kind === 'curve' ? curveDomain(original) : null,
            u: original.kind === 'surface' ? surfaceDomain(original).u : null, v: original.kind === 'surface' ? surfaceDomain(original).v : null },
        samples: { curve: curveSamples.values, u: uSamples.values, v: vSamples.values }, unrepresentedMidpointIntervals: { curve: curveSamples.gaps, u: uSamples.gaps, v: vSamples.gaps },
        coefficientMappings, observationCount, observations, originalD0EvaluationCount, targetD0EvaluationCount, originalD1AttemptCount, targetD1AttemptCount,
        derivativeComparisonCount, derivativeRefusalCount, derivativeSourceRefusalCounts: { original: originalRefusalCount, target: targetRefusalCount },
        maximumPointDifference: maximumPointDifferenceMM, maximumRelativeDerivativeDifference, maximumRelativeCrossDifference, degenerateCrossObservationCount,
        geometricValidity: 'not-certified', topologyCertified: false, solid: false,
        quality: { authority: 'actual-native-control-coefficients-and-original-parameter-evaluators', basisWeightsAndParameterBitsPreserved: true,
            coefficientPolicy: 'guarded-affine-dot-with-unit-axis-zero-translation-bit-copy', parameterOrderPreserved: true,
            handednessMeaning: 'linear-map-parity-not-native-face-or-topology-orientation', nativeD1Refusals: 'actual-original-target-states-must-match-no-inferred-derivatives',
            crossMeaning: 'local-nonunit-derivative-cross-vectors-not-certified-normal-or-face-orientation', localObservationsOnly: true,
            workScope: 'actual-original-and-target-point-d1-observations-excludes-native-source-compiler-and-internal-validation', matrixInverseCertified: false, matrixConditionCertified: false,
            regularityCertified: false, topologyOrientationCertified: false, globalShapeErrorCertified: false, globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false,
            sourceObjectLimitUnchanged: 16, ownership: 'copied-cpu-data-gc-no-renderer-resources' }, budgetFailure: 'atomic-refusal-no-partial-transformed-native-geometry',
        limits: { maximumCurveDegree: 5, maximumCurvePoles: 64, maximumSurfaceAxisPoles: 16, maximumSurfacePoles: 256, maximumCurveSamples: 127, maximumSurfaceAxisSamples: 31,
            maximumObservations: 961, linearCoefficientAbs: 1000, translationAbs: 10000, coordinateAbs: 10000, parameterAbs: 10000, authoredIdCharacters: 48, pointComparison: 1e-7,
            relativeD1Comparison: 1e-7, determinantRelativeThreshold: 128 * Number.EPSILON, inputValues: 32768, inputDepth: 8, inputArrayElements: 128, inputRecordFields: 16, inputStringCharacters: 128,
            ownValues: 1048576, ownDepth: 40, arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144 }
    };
    check(observations.length === observationCount, CODE.BINDING, 'complete scheduled native observations required');
    return snapshot({ original, matrix, options, geometry, source: adopted.source, sourceVersion: 0, model: adopted.model, report }, true);
}
/** Rebuild every native coefficient, source binding and observation from copied owned inputs. */
export function validateAffineGeometryTransform(input) {
    const data = record(snapshot(input, true), ['original', 'matrix', 'options', 'geometry', 'source', 'sourceVersion', 'model', 'report'], CODE.OWNED);
    let rebuilt;
    try {
        rebuilt = transformNativeGeometryAffine(data.original, data.matrix, data.options);
    }
    catch (cause) {
        throw new AffineGeometryTransformError(CODE.OWNED, 'owned native affine rebuild refused', cause);
    }
    check(same(data, rebuilt), CODE.OWNED, 'whole owned native affine result differs from actual rebuild');
    return copyCadData(rebuilt.report);
}

import { CadNumericPolicy } from '../../numeric-policy.js';
import { validateSurface, surfaceDomain, evaluateSurface } from '../../core/math.js';
import { evaluateSurfaceD1 } from '../../core/derivatives.js';
import { reverseCurve, CurveReversalError } from '../curves/curve-reversal.js';
import { compileCadModel } from '../../model-compiler.js';
import { curveDecimal } from '../curves/curve-source.js';
import { copyCadData } from '../../data-copy.js';
import { same } from '../../core/structural-equality.js';
import { KernelError } from '../../core/barocss-error.js';
export const SurfaceAxisReversalDiagnosticCode = Object.freeze({
    INPUT: 'INPUT', AXIS: 'AXIS', IDENTITY: 'IDENTITY', DOMAIN: 'DOMAIN',
    REPRESENTABILITY: 'REPRESENTABILITY', NATIVE: 'NATIVE', BINDING: 'BINDING', OWNED: 'OWNED',
});
export class SurfaceAxisReversalError extends KernelError {
    code;
    constructor(code, detail, cause) {
        super(('Surface axis reversal: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
        this.name = 'SurfaceAxisReversalError';
        this.code = code;
    }
}
const POINT_TOLERANCE = CadNumericPolicy.linearTolerance;
const D1_TOLERANCE = CadNumericPolicy.relativeComparison;
const CODE = SurfaceAxisReversalDiagnosticCode;
function requireValue(condition, code, detail) {
    if (!condition)
        throw new SurfaceAxisReversalError(code, detail);
}
function finite(value, code, detail) {
    requireValue(Number.isFinite(value), code, detail);
    return value;
}
function snapshot(input, result = false, code = CODE.INPUT) {
    let remaining = result ? 262144 : 32768;
    const copy = (value, depth) => {
        requireValue(--remaining >= 0 && depth <= (result ? 32 : 8), code, 'own-value/depth budget exceeded');
        if (value === null && result)
            return null;
        if (typeof value === 'number') {
            requireValue(Number.isFinite(value), code, 'finite own numbers required');
            return value;
        }
        if (typeof value === 'string') {
            requireValue(value.length <= (result ? 262144 : 128), code, 'own string budget exceeded');
            return value;
        }
        if (typeof value === 'boolean' && result)
            return value;
        requireValue(value !== null && typeof value === 'object', code, 'plain own data required');
        const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
        requireValue(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'foreign own-data prototype refused');
        const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
        requireValue(keys.length <= (array ? (result ? 4097 : 65) : (result ? 64 : 16)), code, 'own field budget exceeded');
        requireValue(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
            && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getters, symbols and hidden fields refused');
        if (array) {
            const length = descriptors.length.value;
            requireValue(Number.isInteger(length) && length >= 0 && length <= (result ? 4096 : 64)
                && keys.length === length + 1, code, 'dense bounded own array required');
            return Array.from({ length }, (_, index) => {
                requireValue(Object.hasOwn(descriptors, String(index)), code, 'sparse or foreign array field refused');
                return copy(descriptors[String(index)].value, depth + 1);
            });
        }
        return Object.fromEntries(keys.map(key => [key, copy(descriptors[key].value, depth + 1)]));
    };
    return copy(input, 0);
}
function record(value, fields) {
    requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), CODE.INPUT, 'own record required');
    const data = value;
    requireValue(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), CODE.INPUT, 'exact fields required: ' + fields.join(','));
    return data;
}
function id(value) {
    requireValue(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'ASCII ID1..48 required');
    return value;
}
function native(operation, detail, code = CODE.NATIVE) {
    try {
        return operation();
    }
    catch (cause) {
        if (cause instanceof SurfaceAxisReversalError)
            throw cause;
        throw new SurfaceAxisReversalError(code, detail + ': '
            + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
    }
}
function d1(surface, u, v) {
    try {
        return { status: 'evaluated', value: evaluateSurfaceD1(surface, u, v) };
    }
    catch (cause) {
        return { status: 'native-refused', reason: (cause instanceof Error ? cause.message : 'native combined D1 refused').slice(0, 1024) };
    }
}
function point(surface, u, v) {
    const result = native(() => evaluateSurface(surface, u, v), 'native Surface point evaluation');
    requireValue(result.every(Number.isFinite), CODE.NATIVE, 'native Surface point must be finite');
    return result;
}
function distance(a, b) {
    return finite(Math.hypot(...a.map((value, index) => finite(value - b[index], CODE.BINDING, 'native binding subtraction overflow'))), CODE.BINDING, 'native binding norm overflow');
}
function grid(surface) {
    const u = surface.controlPoints.length, v = surface.controlPoints[0].length;
    return { u, v, total: u * v };
}
function sourceSurface(surface, name) {
    const decimal = (value) => native(() => curveDecimal(value, 'Surface axis reversal'), 'native source decimal');
    const list = (values) => '[' + values.map(decimal).join(',') + ']';
    const poles = (points) => '[' + points.map(list).join(',') + ']';
    const source = '@model ' + name + ' { version:0; length-unit:mm; @surface #' + surface.id
        + ' { type:nurbs; degree-u:' + decimal(surface.degreeU) + '; degree-v:' + decimal(surface.degreeV)
        + '; knots-u:' + list(surface.knotsU) + '; knots-v:' + list(surface.knotsV)
        + '; control-points:[' + surface.controlPoints.map(poles).join(',') + ']; weights:['
        + surface.weights.map(list).join(',') + ']; } }\n';
    requireValue(source.length <= 262144, CODE.NATIVE, 'native source byte budget exceeded');
    const compiled = native(() => compileCadModel(source, { sourceVersion: 0 }), 'native source0 compilation');
    if (!compiled.ok)
        throw new SurfaceAxisReversalError(CODE.NATIVE, 'actual Surface source0 must compile', compiled);
    requireValue(same(compiled.model, { name, version: 0, lengthUnit: 'mm', objects: [surface] }), CODE.NATIVE, 'actual native source must adopt complete grid/ID/domain/sign bits');
    return { surface: compiled.model.objects[0], source, model: compiled.model };
}
function otherParameters(knots, domain) {
    const breaks = [domain[0]];
    for (const knot of knots)
        if (knot > domain[0] && knot < domain[1] && !breaks.some(value => value === knot))
            breaks.push(knot);
    breaks.push(domain[1]);
    const values = [];
    for (let index = 0; index < breaks.length; index++) {
        values.push(breaks[index]);
        if (index + 1 === breaks.length)
            continue;
        const width = finite(breaks[index + 1] - breaks[index], CODE.REPRESENTABILITY, 'nonselected native span overflow');
        const midpoint = finite(breaks[index] + width / 2, CODE.REPRESENTABILITY, 'nonselected native midpoint overflow');
        requireValue(width > 0 && midpoint > breaks[index] && midpoint < breaks[index + 1], CODE.REPRESENTABILITY, 'nonselected midpoint not represented');
        values.push(midpoint);
    }
    return values;
}
/** Axis orientation comes from actual native Curve reversal; no second scalar reflection evaluator. */
export function reverseSurfaceAxis(surfaceInput, inputOptions) {
    const original = record(snapshot(surfaceInput), ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']);
    const data = record(snapshot(inputOptions), ['surfaceId', 'axis', 'resultIdPrefix']);
    id(original.id);
    const surfaceId = id(data.surfaceId);
    requireValue(data.axis === 'u' || data.axis === 'v', CODE.AXIS, 'selected axis must be u or v');
    const axis = data.axis, other = axis === 'u' ? 'v' : 'u';
    requireValue(original.kind === 'surface' && Number.isInteger(original.degreeU) && Number.isInteger(original.degreeV)
        && original.degreeU >= 1 && original.degreeU <= 3 && original.degreeV >= 1 && original.degreeV <= 3, CODE.INPUT, 'native U/V degrees1..3 Surface required');
    requireValue(Array.isArray(original.controlPoints) && original.controlPoints.length >= 2 && original.controlPoints.length <= 16
        && original.controlPoints.every(row => Array.isArray(row) && row.length >= 2 && row.length <= 16 && row.every(pole => Array.isArray(pole)
            && pole.length === 3 && pole.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10000))), CODE.INPUT, 'axes2..16 and authored XYZ within10000mm required');
    native(() => validateSurface(original), 'original positive open-clamped Surface admission', CODE.INPUT);
    const dimensions = grid(original), domain = surfaceDomain(original);
    requireValue(dimensions.total <= 256, CODE.INPUT, 'original total pole count exceeds256');
    for (const selected of ['u', 'v'])
        requireValue(Number.isFinite(domain[selected][1] - domain[selected][0])
            && domain[selected][0] < domain[selected][1], CODE.DOMAIN, 'finite positive U/V domain spans required');
    requireValue(typeof data.resultIdPrefix === 'string' && data.resultIdPrefix.length <= 20
        && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(data.resultIdPrefix), CODE.IDENTITY, 'ASCII result prefix1..20 required');
    const options = { surfaceId, axis, resultIdPrefix: data.resultIdPrefix };
    const roles = Array.from({ length: 16 }, (_, index) => [id(options.resultIdPrefix + '_s' + index + '_src'), id(options.resultIdPrefix + '_s' + index + '_rev')]);
    requireValue(new Set([original.id, surfaceId, ...roles.flat()]).size === 34, CODE.IDENTITY, 'original/output/32 coefficient-strip roles must differ');
    const selectedKnots = axis === 'u' ? original.knotsU : original.knotsV;
    const selectedDegree = axis === 'u' ? original.degreeU : original.degreeV;
    const otherKnots = other === 'u' ? original.knotsU : original.knotsV;
    const fixedParameters = otherParameters(otherKnots, domain[other]);
    const strips = [];
    const makeStrip = (fixed) => {
        const strip = { kind: 'curve', id: roles[fixed][0], degree: selectedDegree, knots: copyCadData(selectedKnots),
            controlPoints: Array.from({ length: dimensions[axis] }, (_, varying) => copyCadData(axis === 'u'
                ? original.controlPoints[varying][fixed] : original.controlPoints[fixed][varying])),
            weights: Array.from({ length: dimensions[axis] }, (_, varying) => axis === 'u' ? original.weights[varying][fixed] : original.weights[fixed][varying]) };
        try {
            return { fixedPoleIndex: fixed, result: reverseCurve(strip, { curveId: roles[fixed][1] }) };
        }
        catch (cause) {
            const code = cause instanceof CurveReversalError && cause.code === 'REPRESENTABILITY' ? CODE.REPRESENTABILITY : CODE.NATIVE;
            throw new SurfaceAxisReversalError(code, 'actual native coefficient-strip reversal refused', cause);
        }
    };
    const first = makeStrip(0);
    strips.push(first);
    const pairs = first.result.report.observations.map(value => ({ reversed: value.reversedParameter, original: value.originalParameter }));
    requireValue(pairs.length >= 2 && pairs.length * fixedParameters.length <= 128, CODE.REPRESENTABILITY, 'native parent/nonselected cartesian observation grid exceeds128');
    for (let fixed = 1; fixed < dimensions[other]; fixed++) {
        const strip = makeStrip(fixed);
        requireValue(same(strip.result.curve.knots, first.result.curve.knots), CODE.NATIVE, 'actual reversed selected knot bits must agree across every strip');
        strips.push(strip);
    }
    const surface = { kind: 'surface', id: surfaceId, degreeU: original.degreeU, degreeV: original.degreeV,
        knotsU: copyCadData(axis === 'u' ? first.result.curve.knots : original.knotsU),
        knotsV: copyCadData(axis === 'v' ? first.result.curve.knots : original.knotsV),
        controlPoints: Array.from({ length: dimensions.u }, (_, u) => Array.from({ length: dimensions.v }, (_, v) => copyCadData(axis === 'u'
            ? strips[v].result.curve.controlPoints[u] : strips[u].result.curve.controlPoints[v]))),
        weights: Array.from({ length: dimensions.u }, (_, u) => Array.from({ length: dimensions.v }, (_, v) => axis === 'u'
            ? strips[v].result.curve.weights[u] : strips[u].result.curve.weights[v])) };
    native(() => validateSurface(surface), 'assembled actual reversed Surface admission');
    requireValue(same(surfaceDomain(surface), domain), CODE.NATIVE, 'original U/V domain endpoint bits must remain');
    requireValue(same(other === 'u' ? surface.knotsU : surface.knotsV, otherKnots), CODE.NATIVE, 'nonselected knot bits must remain');
    const coefficients = [];
    for (let u = 0; u < dimensions.u; u++)
        for (let v = 0; v < dimensions.v; v++) {
            const originalUIndex = axis === 'u' ? dimensions.u - 1 - u : u, originalVIndex = axis === 'v' ? dimensions.v - 1 - v : v;
            requireValue(same(surface.controlPoints[u][v], original.controlPoints[originalUIndex][originalVIndex])
                && Object.is(surface.weights[u][v], original.weights[originalUIndex][originalVIndex]), CODE.NATIVE, 'reversed Surface coefficient/weight bits must be direct original copies');
            coefficients.push({ originalUIndex, originalVIndex, reversedUIndex: u, reversedVIndex: v, pointOrigin: 'original-bit-copy', weightOrigin: 'original-bit-copy' });
        }
    const coordinates = (selected, fixed) => axis === 'u' ? { u: selected, v: fixed } : { u: fixed, v: selected };
    const observations = [];
    for (const pair of pairs)
        for (const fixed of fixedParameters) {
            const output = coordinates(pair.reversed, fixed), mapped = coordinates(pair.original, fixed);
            const originalPointMM = point(original, mapped.u, mapped.v), reversedPointMM = point(surface, output.u, output.v);
            const pointDifferenceMM = distance(originalPointMM, reversedPointMM);
            requireValue(pointDifferenceMM <= POINT_TOLERANCE, CODE.BINDING, 'mapped original/reversed Surface point exceeds local policy');
            const originalD1 = d1(original, mapped.u, mapped.v), reversedD1 = d1(surface, output.u, output.v);
            let expectedDuMM = null, expectedDvMM = null, duDifferenceMM = null, dvDifferenceMM = null;
            if (originalD1.status === 'evaluated') {
                expectedDuMM = originalD1.value.du.map(value => axis === 'u' ? -value : value);
                expectedDvMM = originalD1.value.dv.map(value => axis === 'v' ? -value : value);
                if (reversedD1.status === 'evaluated') {
                    duDifferenceMM = distance(expectedDuMM, reversedD1.value.du);
                    dvDifferenceMM = distance(expectedDvMM, reversedD1.value.dv);
                    const scaleU = finite(Math.hypot(...originalD1.value.du), CODE.BINDING, 'native du magnitude overflow');
                    const scaleV = finite(Math.hypot(...originalD1.value.dv), CODE.BINDING, 'native dv magnitude overflow');
                    requireValue(duDifferenceMM <= D1_TOLERANCE * Math.max(1, scaleU) && dvDifferenceMM <= D1_TOLERANCE * Math.max(1, scaleV), CODE.BINDING, 'mapped Surface partial sign exceeds local policy');
                }
            }
            observations.push({ u: output.u, v: output.v, originalU: mapped.u, originalV: mapped.v, originalPoint: originalPointMM, reversedPoint: reversedPointMM, pointDifference: pointDifferenceMM,
                originalD1, reversedD1, expectedDu: expectedDuMM, expectedDv: expectedDvMM, duDifference: duDifferenceMM, dvDifference: dvDifferenceMM });
        }
    const guards = [];
    const addGuard = (guardAxis, authored, mapped, output) => {
        requireValue(guards.length < 256, CODE.REPRESENTABILITY, 'native authored/mapped/output guard record budget exceeded');
        guards.push({ axis: guardAxis, originalAuthoredU: authored.u, originalAuthoredV: authored.v, mappedOriginalU: mapped.u, mappedOriginalV: mapped.v,
            reversedU: output.u, reversedV: output.v, originalAtAuthoredKnot: d1(original, authored.u, authored.v),
            originalAtMappedParameters: d1(original, mapped.u, mapped.v), reversedAtReflectedParameters: d1(surface, output.u, output.v) });
    };
    for (const guard of first.result.report.guards) {
        const pair = pairs.find(value => value.reversed === guard.reversedParameter);
        requireValue(pair !== undefined, CODE.NATIVE, 'native Curve authored/reflected guard must have an actual mapped observation');
        for (const fixed of fixedParameters)
            addGuard(axis, coordinates(guard.originalParameter, fixed), coordinates(pair.original, fixed), coordinates(pair.reversed, fixed));
    }
    const otherDegree = other === 'u' ? original.degreeU : original.degreeV;
    for (const fixed of fixedParameters)
        if (fixed > domain[other][0] && fixed < domain[other][1]
            && otherKnots.filter(knot => knot === fixed).length >= otherDegree) {
            for (const pair of pairs)
                addGuard(other, coordinates(pair.original, fixed), coordinates(pair.original, fixed), coordinates(pair.reversed, fixed));
        }
    const originalFile = sourceSurface(original, 'surface_reverse_original'), file = sourceSurface(surface, surfaceId);
    const relative = (axisName, observation) => {
        const difference = axisName === 'u' ? observation.duDifference : observation.dvDifference;
        if (difference === null || observation.originalD1.status !== 'evaluated')
            return 0;
        return difference / Math.max(1, Math.hypot(...(axisName === 'u' ? observation.originalD1.value.du : observation.originalD1.value.dv)));
    };
    const provenance = { originalSurfaceId: original.id, outputSurfaceId: surfaceId, axis, domain,
        parameterMaps: { u: { orientation: axis === 'u' ? -1 : 1, d1Factor: axis === 'u' ? -1 : 1, formula: axis === 'u' ? 'u=a+(b-s)' : 'u=s', domain: domain.u },
            v: { orientation: axis === 'v' ? -1 : 1, d1Factor: axis === 'v' ? -1 : 1, formula: axis === 'v' ? 'v=a+(b-t)' : 'v=t', domain: domain.v } }, strips, coefficients };
    const result = copyCadData({ original: originalFile.surface, options, surface: file.surface, source: file.source, sourceVersion: 0,
        model: file.model, originalSource: originalFile.source, originalModel: originalFile.model, provenance, report: {
            family: 'own-native-surface-parameter-axis-reversal', dto: { schema: 'barocss-native-surface-axis-reversal', version: 0, lengthUnit: 'mm', frame: 'authored-xyz-no-axis-conversion', representation: 'native-surface-not-face-topology' },
            originalSurfaceId: original.id, surfaceId, axis, domain, grid: dimensions, stripCount: strips.length, observations, guards,
            maximumPointDifference: Math.max(...observations.map(value => value.pointDifference)),
            maximumRelativeDuDifference: Math.max(0, ...observations.map(value => relative('u', value))), maximumRelativeDvDifference: Math.max(0, ...observations.map(value => relative('v', value))),
            geometricValidity: 'not-certified', topologyCertified: false, solid: false,
            quality: { pointComparison: POINT_TOLERANCE, relativeD1Comparison: D1_TOLERANCE, localObservationsOnly: true, globalShapeErrorCertified: false, manufacturingToleranceCertified: false,
                coefficientAndWeightBitsPreserved: true, nonselectedKnotBitsPreserved: true, generatedInteriorKnotBitsCertified: false, doubleReversalBitsCertified: false,
                derivativeSemantics: 'authored-mapped-reflected-combined-d1-states-distinct-no-g1-g2-claim' },
            limits: { maximumDegree: 3, maximumAxisPoles: 16, maximumTotalPoles: 256, maximumStrips: 16, maximumObservations: 128, maximumGuardRecords: 256,
                inputValues: 32768, inputDepth: 8, inputArrayElements: 64, inputRecordFields: 16, snapshotValues: 262144, snapshotDepth: 32, arrayElements: 4096, recordFields: 64,
                sourceStringCharacters: 262144, authoredIdCharacters: 48, resultIdPrefixCharacters: 20 }
        } });
    return snapshot(result, true, CODE.OWNED);
}
/** Rebuild every actual native strip and mapped Surface observation; cached diagnostics are never authority. */
export function validateReversedSurfaceAxis(input) {
    const owned = snapshot(input, true, CODE.OWNED);
    requireValue(owned !== null && typeof owned === 'object' && !Array.isArray(owned), CODE.OWNED, 'owned reversed Surface required');
    let expected;
    try {
        expected = reverseSurfaceAxis(owned.original, owned.options);
    }
    catch (cause) {
        throw new SurfaceAxisReversalError(CODE.OWNED, 'owned original/options rebuild refused', cause);
    }
    requireValue(same(owned, expected), CODE.OWNED, 'owned original/source/strips/coefficient bits/parameter maps/Surface D1/guard report mismatch');
    return copyCadData(expected.report);
}

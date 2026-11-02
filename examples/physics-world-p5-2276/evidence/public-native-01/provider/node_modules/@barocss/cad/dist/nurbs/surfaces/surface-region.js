import { CadNumericPolicy } from '../../numeric-policy.js';
import { validateSurface, surfaceDomain, evaluateSurface } from '../../core/math.js';
import { evaluateSurfaceD1 } from '../../core/derivatives.js';
import { splitSurfaceAtParameter } from './surface-parameter-split.js';
import { compileCadModel } from '../../model-compiler.js';
import { curveDecimal } from '../curves/curve-source.js';
import { copyCadData } from '../../data-copy.js';
import { same } from '../../core/structural-equality.js';
import { KernelError } from '../../core/barocss-error.js';
export const SurfaceRegionDiagnosticCode = Object.freeze({
    INPUT: 'INPUT', INTERVAL: 'INTERVAL', IDENTITY: 'IDENTITY', REPRESENTABILITY: 'REPRESENTABILITY',
    NATIVE_CAPACITY: 'NATIVE_CAPACITY', NATIVE: 'NATIVE', BINDING: 'BINDING', OWNED: 'OWNED',
});
export class SurfaceRegionError extends KernelError {
    code;
    constructor(code, detail, cause) {
        super(('Surface region extraction: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
        this.name = 'SurfaceRegionError';
        this.code = code;
    }
}
const POINT_TOLERANCE = CadNumericPolicy.linearTolerance;
const D1_TOLERANCE = CadNumericPolicy.relativeComparison;
const CODE = SurfaceRegionDiagnosticCode;
function requireValue(condition, code, detail) {
    if (!condition)
        throw new SurfaceRegionError(code, detail);
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
        if (cause instanceof SurfaceRegionError)
            throw cause;
        throw new SurfaceRegionError(code, detail + ': '
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
    const decimal = (value) => native(() => curveDecimal(value, 'Surface region extraction'), 'native source decimal');
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
        throw new SurfaceRegionError(CODE.NATIVE, 'actual Surface source0 must compile', compiled);
    requireValue(same(compiled.model, { name, version: 0, lengthUnit: 'mm', objects: [surface] }), CODE.NATIVE, 'actual native source must adopt complete grid/ID/domain/sign bits');
    return { surface: compiled.model.objects[0], source, model: compiled.model };
}
function axisParameters(knots, interval) {
    const breaks = [interval[0]];
    for (const knot of knots)
        if (knot > interval[0] && knot < interval[1]
            && !breaks.some(value => value === knot))
            breaks.push(knot);
    breaks.push(interval[1]);
    const parameters = [];
    for (let index = 0; index < breaks.length; index++) {
        parameters.push(breaks[index]);
        if (index + 1 === breaks.length)
            continue;
        const width = finite(breaks[index + 1] - breaks[index], CODE.REPRESENTABILITY, 'retained native span overflow');
        requireValue(width > 0, CODE.REPRESENTABILITY, 'positive retained native span required');
        for (const fraction of [.25, .5, .75]) {
            const parameter = finite(breaks[index] + width * fraction, CODE.REPRESENTABILITY, 'observation parameter overflow');
            requireValue(parameter > breaks[index] && parameter < breaks[index + 1]
                && parameter > parameters[parameters.length - 1], CODE.REPRESENTABILITY, 'quarter/midpoint native observation parameter not represented');
            parameters.push(parameter);
        }
    }
    return parameters;
}
function observationGrid(surface, domain) {
    const u = axisParameters(surface.knotsU, domain.u), v = axisParameters(surface.knotsV, domain.v);
    requireValue(u.length * v.length <= 128, CODE.REPRESENTABILITY, 'retained knot/quarter cartesian point-D1 grid exceeds128 observations');
    return { u, v };
}
/** Original-parameter tensor region using at most four unchanged native622 split operations. */
export function extractSurfaceRegion(surfaceInput, inputOptions) {
    const surfaceData = snapshot(surfaceInput), optionData = snapshot(inputOptions);
    const original = record(surfaceData, ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']);
    const data = record(optionData, ['surfaceId', 'uInterval', 'vInterval', 'resultIdPrefix']);
    id(original.id);
    const surfaceId = id(data.surfaceId);
    requireValue(original.kind === 'surface' && Number.isInteger(original.degreeU) && Number.isInteger(original.degreeV)
        && original.degreeU >= 1 && original.degreeU <= 3 && original.degreeV >= 1 && original.degreeV <= 3, CODE.INPUT, 'native U/V degrees1..3 Surface required');
    requireValue(Array.isArray(original.controlPoints) && original.controlPoints.length >= 2
        && original.controlPoints.length <= 16 && original.controlPoints.every(row => Array.isArray(row)
        && row.length >= 2 && row.length <= 16 && row.every(value => Array.isArray(value)
        && value.length === 3 && value.every(component => typeof component === 'number'
        && Number.isFinite(component) && Math.abs(component) <= 10000))), CODE.INPUT, 'original grid axes2..16 with authored XYZ±10000mm required');
    native(() => validateSurface(original), 'original positive open-clamped native Surface admission', CODE.INPUT);
    requireValue(grid(original).total <= 256, CODE.INPUT, 'original native grid exceeds256 poles');
    const interval = (value) => {
        requireValue(Array.isArray(value) && value.length === 2 && value.every(number => typeof number === 'number'
            && Number.isFinite(number)), CODE.INTERVAL, 'finite increasing [start,end] interval required');
        return value;
    };
    requireValue(typeof data.resultIdPrefix === 'string' && data.resultIdPrefix.length <= 20
        && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(data.resultIdPrefix), CODE.IDENTITY, 'ASCII result prefix1..20 required');
    const options = {
        surfaceId, uInterval: interval(data.uInterval), vInterval: interval(data.vInterval), resultIdPrefix: data.resultIdPrefix,
    };
    const originalDomain = surfaceDomain(original), requestedDomain = {
        u: options.uInterval, v: options.vInterval,
    };
    for (const axis of ['u', 'v']) {
        requireValue(Number.isFinite(originalDomain[axis][1] - originalDomain[axis][0])
            && originalDomain[axis][1] > originalDomain[axis][0], CODE.REPRESENTABILITY, 'finite positive original ' + axis + ' domain span required');
        const requested = requestedDomain[axis], domain = originalDomain[axis];
        requireValue(requested[0] < requested[1] && requested[0] >= domain[0] && requested[1] <= domain[1], CODE.INTERVAL, 'ordered ' + axis + ' interval must be inside original closed domain; no sorting or clamping');
    }
    const boundaries = [];
    const effectiveDomain = { u: [0, 0], v: [0, 0] };
    for (const axis of ['u', 'v'])
        for (const index of [0, 1]) {
            const requested = requestedDomain[axis][index], endpoint = originalDomain[axis][index];
            const adoptedOriginalEndpointBits = requested === endpoint;
            const effective = adoptedOriginalEndpointBits ? endpoint : requested;
            effectiveDomain[axis][index] = effective;
            boundaries.push({ axis, boundary: index === 0 ? 'start' : 'end', requested, effective,
                origin: adoptedOriginalEndpointBits ? 'original-domain-endpoint' : 'interior-request', adoptedOriginalEndpointBits });
        }
    const helperIds = [0, 1, 2, 3].flatMap(index => [
        id(options.resultIdPrefix + '_cut_' + index + '_lo'), id(options.resultIdPrefix + '_cut_' + index + '_hi'),
    ]);
    requireValue(new Set([original.id, surfaceId, ...helperIds]).size === 10, CODE.IDENTITY, 'original/output/eight helper geometry identities must be distinct before native staging');
    // Reject unrepresentable retained spans and an oversized Cartesian grid before any native split.
    observationGrid(original, effectiveDomain);
    const operations = [];
    let retained = copyCadData(original);
    const cut = (axis, boundary, parameter) => {
        requireValue(operations.length < 4, CODE.NATIVE_CAPACITY, 'at mostfour actual native Surface splits allowed');
        const currentGrid = grid(retained), selectedCount = currentGrid[axis];
        const otherCount = currentGrid[axis === 'u' ? 'v' : 'u'];
        const degree = axis === 'u' ? retained.degreeU : retained.degreeV;
        const knots = axis === 'u' ? retained.knotsU : retained.knotsV;
        const multiplicity = knots.filter(knot => knot === parameter).length;
        const refinedSelectedCount = selectedCount + degree - multiplicity;
        requireValue(refinedSelectedCount <= 16 && refinedSelectedCount * otherCount <= 256, CODE.NATIVE_CAPACITY, 'actual selected count+degree−numeric multiplicity exceeds unchanged16-axis/256-grid capacity');
        const index = operations.length;
        const result = native(() => splitSurfaceAtParameter(retained, {
            axis, parameter, lowerSurfaceId: helperIds[2 * index], upperSurfaceId: helperIds[2 * index + 1],
        }), 'actual native Surface split');
        const refinedGrid = grid(result.refined);
        requireValue(refinedGrid.u <= 16 && refinedGrid.v <= 16 && refinedGrid.total <= 256, CODE.NATIVE_CAPACITY, 'actual refined Surface exceeds unchanged native temporary grid capacity');
        const retainedSide = boundary === 'start' ? 'upper' : 'lower';
        operations.push({ index, axis, boundary, retainedSide, result });
        retained = copyCadData(result[retainedSide]);
    };
    for (const axis of ['u', 'v']) {
        if (effectiveDomain[axis][0] > originalDomain[axis][0])
            cut(axis, 'start', effectiveDomain[axis][0]);
        if (effectiveDomain[axis][1] < originalDomain[axis][1])
            cut(axis, 'end', effectiveDomain[axis][1]);
    }
    retained.id = surfaceId;
    native(() => validateSurface(retained), 'retained native Surface admission');
    requireValue(same(surfaceDomain(retained), effectiveDomain), CODE.REPRESENTABILITY, 'native restriction must retain exact effective U/V endpoint bits without rebasing');
    const fullDomainCopy = same(originalDomain, effectiveDomain);
    if (fullDomainCopy)
        requireValue(operations.length === 0 && same(retained, { ...original, id: surfaceId }), CODE.NATIVE, 'full-domain extraction must copy all non-ID coefficient bits with zero operations');
    const parameters = observationGrid(retained, effectiveDomain), observations = [];
    for (const u of parameters.u)
        for (const v of parameters.v) {
            const originalPointMM = point(original, u, v), extractedPointMM = point(retained, u, v);
            const pointDifferenceMM = distance(originalPointMM, extractedPointMM);
            requireValue(pointDifferenceMM <= POINT_TOLERANCE, CODE.BINDING, 'original/extracted native Surface point observation exceeds local policy');
            const originalD1 = d1(original, u, v), extractedD1 = d1(retained, u, v);
            let duDifferenceMM = null, dvDifferenceMM = null;
            // A native combined D1 refusal has no returned du or dv. Do not synthesize an unaffected partial.
            if (originalD1.status === 'evaluated' && extractedD1.status === 'evaluated') {
                duDifferenceMM = distance(originalD1.value.du, extractedD1.value.du);
                dvDifferenceMM = distance(originalD1.value.dv, extractedD1.value.dv);
                const scaleU = finite(Math.hypot(...originalD1.value.du), CODE.BINDING, 'native du magnitude overflow');
                const scaleV = finite(Math.hypot(...originalD1.value.dv), CODE.BINDING, 'native dv magnitude overflow');
                requireValue(duDifferenceMM <= D1_TOLERANCE * Math.max(1, scaleU)
                    && dvDifferenceMM <= D1_TOLERANCE * Math.max(1, scaleV), CODE.BINDING, 'original/extracted native U/V partial observation exceeds local policy');
            }
            observations.push({ u, v, originalPoint: originalPointMM, extractedPoint: extractedPointMM, pointDifference: pointDifferenceMM,
                originalD1, extractedD1, duDifference: duDifferenceMM, dvDifference: dvDifferenceMM });
        }
    const guards = [];
    for (const observation of observations) {
        const originalGuardedAxes = [];
        for (const axis of ['u', 'v']) {
            const parameter = observation[axis], knots = axis === 'u' ? original.knotsU : original.knotsV;
            const degree = axis === 'u' ? original.degreeU : original.degreeV;
            if (parameter > originalDomain[axis][0] && parameter < originalDomain[axis][1]
                && knots.filter(knot => knot === parameter).length >= degree)
                originalGuardedAxes.push(axis);
        }
        if (!originalGuardedAxes.length)
            continue;
        const originalParameter = (axis) => {
            const knots = axis === 'u' ? original.knotsU : original.knotsV;
            const found = knots.find(knot => knot === observation[axis]);
            return found === undefined ? observation[axis] : found;
        };
        const originalU = originalParameter('u'), originalV = originalParameter('v');
        const location = (axis) => observation[axis] === effectiveDomain[axis][0] ? 'start-endpoint'
            : observation[axis] === effectiveDomain[axis][1] ? 'end-endpoint' : 'interior';
        guards.push({ originalU, originalV, extractedU: observation.u, extractedV: observation.v, originalGuardedAxes,
            outputLocation: { u: location('u'), v: location('v') },
            originalAtOriginalParameters: d1(original, originalU, originalV),
            extractedAtRetainedParameters: d1(retained, observation.u, observation.v) });
    }
    const originalFile = sourceSurface(original, 'surface_region_original'), file = sourceSurface(retained, surfaceId);
    const provenance = {
        originalSurfaceId: original.id, outputSurfaceId: surfaceId, originalDomain, requestedDomain, effectiveDomain,
        parameterMaps: { u: { kind: 'identity', formula: 'u=s', d1Factor: 1 }, v: { kind: 'identity', formula: 'v=t', d1Factor: 1 } },
        boundaries, fullDomainCopy, operations,
    };
    const relativeDifference = (axis, observation) => {
        const difference = axis === 'u' ? observation.duDifference : observation.dvDifference;
        if (difference === null || observation.originalD1.status !== 'evaluated')
            return 0;
        return difference / Math.max(1, Math.hypot(...(axis === 'u' ? observation.originalD1.value.du : observation.originalD1.value.dv)));
    };
    const result = copyCadData({
        original: originalFile.surface, options, surface: file.surface, source: file.source, sourceVersion: 0,
        model: file.model, originalSource: originalFile.source, originalModel: originalFile.model, provenance,
        report: {
            family: 'own-native-original-parameter-surface-region',
            dto: { schema: 'barocss-native-surface-region', version: 0, lengthUnit: 'mm', frame: 'authored-xyz-no-axis-conversion',
                representation: 'native-surface-not-face-topology' },
            originalSurfaceId: original.id, surfaceId, degrees: { u: original.degreeU, v: original.degreeV },
            grids: { original: grid(original), extracted: grid(retained) }, originalDomain, domain: effectiveDomain,
            operationCount: operations.length, uParameters: parameters.u, vParameters: parameters.v, observations, guards,
            maximumPointDifference: Math.max(...observations.map(observation => observation.pointDifference)),
            maximumRelativeDuDifference: Math.max(0, ...observations.map(observation => relativeDifference('u', observation))),
            maximumRelativeDvDifference: Math.max(0, ...observations.map(observation => relativeDifference('v', observation))),
            geometricValidity: 'not-certified', topologyCertified: false, solid: false,
            quality: { pointComparison: POINT_TOLERANCE, relativeD1Comparison: D1_TOLERANCE, localObservationsOnly: true,
                globalShapeErrorCertified: false, manufacturingToleranceCertified: false,
                derivativeSemantics: 'combined-native-d1-refusals-and-extracted-endpoints-distinct-no-unaffected-partial-or-g1-g2-claim' },
            limits: { maximumDegree: 3, maximumAxisPoles: 16, maximumTotalPoles: 256, maximumOperations: 4, maximumObservations: 128,
                inputValues: 32768, inputDepth: 8, inputArrayElements: 64, inputRecordFields: 16, snapshotValues: 262144, snapshotDepth: 32,
                arrayElements: 4096, recordFields: 64, sourceStringCharacters: 262144, authoredIdCharacters: 48, resultIdPrefixCharacters: 20 },
        },
    });
    return snapshot(result, true, CODE.OWNED);
}
/** Rebuild originals/options and complete genuine native Surface split/source/D1 lineage. */
export function validateExtractedSurfaceRegion(input) {
    const owned = snapshot(input, true, CODE.OWNED);
    requireValue(owned !== null && typeof owned === 'object' && !Array.isArray(owned), CODE.OWNED, 'owned extracted native Surface region required');
    let expected;
    try {
        expected = extractSurfaceRegion(owned.original, owned.options);
    }
    catch (cause) {
        throw new SurfaceRegionError(CODE.OWNED, 'owned original/options rebuild refused', cause);
    }
    requireValue(same(owned, expected), CODE.OWNED, 'owned original/source/region/bit-choice/native grid split/combined D1/identity/report mismatch');
    return copyCadData(expected.report);
}

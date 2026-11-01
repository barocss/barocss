import { resolveCadGeometryReference, CadReferenceError } from './cad-document-reference.js';
import { curveDomain, surfaceDomain } from '../core/math.js';
import { same } from '../core/structural-equality.js';
import { KernelError } from '../core/barocss-error.js';
export const CadDocumentBoundsDiagnosticCode = Object.freeze({
    INPUT: 'INPUT', REFERENCE: 'REFERENCE', STALE: 'STALE', NATIVE: 'NATIVE', BINDING: 'BINDING', OWNED: 'OWNED',
});
export class CadDocumentBoundsError extends KernelError {
    code;
    constructor(code, detail, cause) {
        super(('CAD document bounds: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
        this.name = 'CadDocumentBoundsError';
        this.code = code;
    }
}
const CODE = CadDocumentBoundsDiagnosticCode;
function check(condition, code, detail) {
    if (!condition)
        throw new CadDocumentBoundsError(code, detail);
}
function native(action, detail) {
    try {
        return action();
    }
    catch (cause) {
        if (cause instanceof CadDocumentBoundsError)
            throw cause;
        const code = cause instanceof CadReferenceError ? (cause.code === 'STALE' ? CODE.STALE : cause.code === 'INPUT' ? CODE.INPUT : CODE.REFERENCE) : CODE.NATIVE;
        throw new CadDocumentBoundsError(code, detail + ': ' + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
    }
}
function snapshot(input) {
    let remaining = 262144;
    const ancestors = new Set();
    const copy = (value, depth) => {
        check(--remaining >= 0 && depth <= 32, CODE.OWNED, 'owned value/depth budget exceeded');
        if (value === null || typeof value === 'boolean')
            return value;
        if (typeof value === 'number') {
            check(Number.isFinite(value), CODE.OWNED, 'finite owned numbers required');
            return value;
        }
        if (typeof value === 'string') {
            check(value.length <= 262144, CODE.OWNED, 'owned string budget exceeded');
            return value;
        }
        check(value !== null && typeof value === 'object' && !ancestors.has(value), CODE.OWNED, 'plain acyclic owned data required');
        const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
        check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, CODE.OWNED, 'foreign owned prototype refused');
        const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
        check(keys.length <= (array ? 4097 : 64), CODE.OWNED, 'owned field budget exceeded');
        check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
            && (array && key === 'length' || descriptors[key].enumerable)), CODE.OWNED, 'getters/symbols/hidden owned fields refused');
        ancestors.add(value);
        let result;
        if (array) {
            const length = descriptors.length.value;
            check(Number.isInteger(length) && length >= 0 && length <= 4096 && keys.length === length + 1, CODE.OWNED, 'dense bounded owned arrays required');
            result = Array.from({ length }, (_, index) => {
                check(Object.hasOwn(descriptors, String(index)), CODE.OWNED, 'sparse/extra owned array field refused');
                return copy(descriptors[String(index)].value, depth + 1);
            });
        }
        else
            result = Object.fromEntries(keys.map(key => [key, copy(descriptors[key].value, depth + 1)]));
        ancestors.delete(value);
        return result;
    };
    return native(() => copy(input, 0), 'owned snapshot');
}
/** Conservative positive native control-hull box at one exact document reference. */
export function queryCadDocumentBounds(document, reference) {
    const selected = native(() => resolveCadGeometryReference(document, reference), 'resolve original document geometry');
    const { geometry, source } = selected;
    const poles = geometry.kind === 'curve'
        ? geometry.controlPoints.map((pointMM, poleIndex) => ({ pointMM, poleIndex, uIndex: null, vIndex: null }))
        : geometry.controlPoints.flatMap((row, uIndex) => row.map((pointMM, vIndex) => ({ pointMM, poleIndex: null, uIndex, vIndex })));
    check(poles.length > 0 && poles.length <= (geometry.kind === 'curve' ? 64 : 256), CODE.BINDING, 'actual native pole capacity required');
    const min = [0, 1, 2].map(axis => Math.min(...poles.map(pole => pole.pointMM[axis])));
    const max = [0, 1, 2].map(axis => Math.max(...poles.map(pole => pole.pointMM[axis])));
    const extentMM = min.map((value, axis) => max[axis] - value);
    const boxCenterMM = min.map((value, axis) => value + extentMM[axis] / 2);
    check([...extentMM, ...boxCenterMM].every(Number.isFinite), CODE.NATIVE, 'finite derived box arithmetic required');
    const extrema = [];
    for (const axis of [0, 1, 2])
        for (const side of ['min', 'max']) {
            const valueMM = side === 'min' ? min[axis] : max[axis];
            const witness = poles.find(pole => Object.is(pole.pointMM[axis], valueMM));
            check(witness !== undefined, CODE.BINDING, 'extremum must bind to an exact original control coefficient');
            extrema.push({ axis, side, valueMM, ...witness });
        }
    const domains = geometry.kind === 'curve'
        ? { curve: native(() => curveDomain(geometry), 'original Curve domain'), surface: null }
        : { curve: null, surface: native(() => surfaceDomain(geometry), 'original Surface domains') };
    const report = {
        schema: 'barocss-cad-document-bounds', version: 0, reference: selected.reference,
        lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion', geometryAuthority: 'original-native-control-hull',
        geometryKind: geometry.kind, selectedGeometryCount: 1, controlPoleCount: poles.length, domains,
        quality: { boundsSemantics: 'conservative-control-hull-not-tight-geometry-extrema',
            containment: 'positive-rational-convex-hull-in-exact-arithmetic',
            witnessSemantics: 'first-object-is-coefficient-in-curve-or-row-major-order',
            zeroTies: 'negative-zero-min-positive-zero-max-when-both-present', derivedCentre: 'box-centre-not-centre-of-mass',
            globalBinary64ContainmentCertified: false, manufacturingToleranceCertified: false, topologyNamingCertified: false,
            ownership: 'copied-cpu-data-gc-no-renderer-resources' },
        geometricValidity: 'not-certified', topologyCertified: false, solid: false,
        limits: { maximumCurvePoles: 64, maximumSurfaceAxisPoles: 16, maximumSurfacePoles: 256, maximumDegree: 5,
            ownedValues: 262144, ownedDepth: 32, arrayElements: 4096, recordFields: 64, sourceStringCharacters: 262144 },
    };
    return snapshot({ reference: selected.reference, geometry, source, boundsMM: { min, max }, extentMM, boxCenterMM, extrema, report });
}
/** Re-resolve the supplied current document and rebuild every owned field. */
export function validateCadDocumentBounds(document, input) {
    const owned = snapshot(input);
    check(owned !== null && typeof owned === 'object' && !Array.isArray(owned)
        && Object.keys(owned).length === 8 && ['reference', 'geometry', 'source', 'boundsMM', 'extentMM', 'boxCenterMM', 'extrema', 'report']
        .every(key => Object.hasOwn(owned, key)), CODE.OWNED, 'exact owned bounds result fields required');
    const expected = queryCadDocumentBounds(document, owned.reference);
    check(same(owned, expected), CODE.OWNED, 'owned source/geometry/coefficient bounds/witness/reference/report mismatch');
    return snapshot(expected.report);
}

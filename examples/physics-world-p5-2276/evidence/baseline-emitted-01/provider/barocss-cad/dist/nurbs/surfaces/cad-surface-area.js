import { resolveCadGeometryReference, CadReferenceError } from '../../document/cad-document-reference.js';
import { validateSurface, surfaceDomain, evaluateSurface } from '../../core/math.js';
import { evaluateSurfaceD1 } from '../../core/derivatives.js';
import { same } from '../../core/structural-equality.js';
import { KernelError } from '../../core/barocss-error.js';
export const CadSurfaceAreaDiagnosticCode = Object.freeze({
    INPUT: 'INPUT', REFERENCE: 'REFERENCE', STALE: 'STALE', REGION: 'REGION', REPRESENTABILITY: 'REPRESENTABILITY',
    BUDGET: 'BUDGET', NATIVE: 'NATIVE', BINDING: 'BINDING', OWNED: 'OWNED',
});
export class CadSurfaceAreaError extends KernelError {
    code;
    constructor(code, detail, cause) {
        super(('CAD Surface area: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
        this.name = 'CadSurfaceAreaError';
        this.code = code;
    }
}
const CODE = CadSurfaceAreaDiagnosticCode, EPS = 64 * Number.EPSILON;
function check(condition, code, detail) {
    if (!condition)
        throw new CadSurfaceAreaError(code, detail);
}
function finite(value, detail, code = CODE.REPRESENTABILITY) {
    check(Number.isFinite(value), code, detail);
    return value;
}
function product(a, b) {
    const value = finite(a * b, 'derived metric/quadrature product overflow');
    check(a === 0 || b === 0 || value !== 0, CODE.REPRESENTABILITY, 'nonzero derived metric/quadrature product underflow');
    return value;
}
function cross(a, b) {
    return [finite(product(a[1], b[2]) - product(a[2], b[1]), 'cross X subtraction overflow'),
        finite(product(a[2], b[0]) - product(a[0], b[2]), 'cross Y subtraction overflow'),
        finite(product(a[0], b[1]) - product(a[1], b[0]), 'cross Z subtraction overflow')];
}
function norm(vector) { return finite(Math.hypot(...vector), 'derived metric norm overflow'); }
function delta(a, b) { return a.map((value, axis) => finite(value - b[axis], 'world-point subtraction overflow')); }
function native(action, detail, code = CODE.NATIVE) {
    try {
        return action();
    }
    catch (cause) {
        if (cause instanceof CadSurfaceAreaError)
            throw cause;
        const actualCode = cause instanceof CadReferenceError
            ? cause.code === 'STALE' ? CODE.STALE : cause.code === 'INPUT' ? CODE.INPUT : CODE.REFERENCE : code;
        throw new CadSurfaceAreaError(actualCode, detail + ': ' + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
    }
}
function snapshot(input, mode) {
    const options = mode === 'options', code = mode === 'owned' ? CODE.OWNED : CODE.INPUT;
    let remaining = options ? 32768 : 1048576;
    const depthLimit = options ? 8 : 32, arrayLimit = options ? 128 : 8192;
    const fieldLimit = options ? 16 : 64, stringLimit = options ? 128 : 262144;
    const ancestors = new Set();
    const copy = (value, depth) => {
        check(--remaining >= 0 && depth <= depthLimit, code, 'own-value/depth budget exceeded');
        if (value === null || typeof value === 'boolean')
            return value;
        if (typeof value === 'number') {
            check(Number.isFinite(value), code, 'finite own numbers required');
            return value;
        }
        if (typeof value === 'string') {
            check(value.length <= stringLimit, code, 'own string budget exceeded');
            return value;
        }
        check(typeof value === 'object', code, 'plain own data required');
        check(!ancestors.has(value), code, 'cyclic own data refused');
        const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
        check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'foreign own-data prototype refused');
        const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
        check(keys.length <= (array ? arrayLimit + 1 : fieldLimit), code, 'own field budget exceeded');
        check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
            && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getter/symbol/hidden own data refused');
        ancestors.add(value);
        let result;
        if (array) {
            const length = descriptors.length.value;
            check(Number.isInteger(length) && length >= 0 && length <= arrayLimit && keys.length === length + 1, code, 'dense bounded own arrays required');
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
function options(input, domains) {
    const o = record(snapshot(input, 'options'), ['region', 'absoluteToleranceMM2', 'relativeTolerance', 'maximumEvaluations', 'maximumSubdivisions', 'maximumDepth']);
    let region = null;
    if (o.region !== null) {
        const r = record(o.region, ['u', 'v'], CODE.REGION);
        for (const axis of ['u', 'v'])
            check(Array.isArray(r[axis]) && r[axis].length === 2
                && r[axis].every(value => typeof value === 'number' && Number.isFinite(value))
                && r[axis][0] < r[axis][1] && r[axis][0] >= domains[axis][0] && r[axis][1] <= domains[axis][1], CODE.REGION, 'finite increasing U/V region inside original domains required');
        const u = r.u, v = r.v;
        region = { u: [u[0], u[1]], v: [v[0], v[1]] };
    }
    check(typeof o.absoluteToleranceMM2 === 'number' && o.absoluteToleranceMM2 >= 1e-8 && o.absoluteToleranceMM2 <= 10, CODE.INPUT, 'absoluteToleranceMM2 1e-8..10 required');
    check(typeof o.relativeTolerance === 'number' && o.relativeTolerance >= 0 && o.relativeTolerance <= 1e-2, CODE.INPUT, 'relativeTolerance0..1e-2 required');
    check(typeof o.maximumEvaluations === 'number' && Number.isInteger(o.maximumEvaluations) && o.maximumEvaluations >= 33 && o.maximumEvaluations <= 65536, CODE.BUDGET, 'maximumEvaluations33..65536 required');
    check(typeof o.maximumSubdivisions === 'number' && Number.isInteger(o.maximumSubdivisions) && o.maximumSubdivisions >= 0 && o.maximumSubdivisions <= 128, CODE.BUDGET, 'maximumSubdivisions0..128 required');
    check(typeof o.maximumDepth === 'number' && Number.isInteger(o.maximumDepth) && o.maximumDepth >= 0 && o.maximumDepth <= 10, CODE.BUDGET, 'maximumDepth0..10 required');
    return { region, absoluteToleranceMM2: o.absoluteToleranceMM2, relativeTolerance: o.relativeTolerance,
        maximumEvaluations: o.maximumEvaluations, maximumSubdivisions: o.maximumSubdivisions, maximumDepth: o.maximumDepth };
}
function midpoint(domain) {
    const width = finite(domain[1] - domain[0], 'native parameter width overflow');
    check(width > 0, CODE.REPRESENTABILITY, 'positive represented native parameter span required');
    const value = finite(domain[0] + product(width, .5), 'native midpoint overflow');
    check(value > domain[0] && value < domain[1], CODE.REPRESENTABILITY, 'strict native midpoint not represented');
    return value;
}
function breaks(knots, domain) {
    const values = [domain[0]];
    for (const knot of knots)
        if (knot > domain[0] && knot < domain[1] && !values.some(value => value === knot))
            values.push(knot);
    values.push(domain[1]);
    return values;
}
/** Native parametric metric quadrature with independently recorded local triangle plausibility. */
export function queryCadDocumentSurfaceArea(documentInput, referenceInput, optionInput) {
    const document = snapshot(documentInput, 'input'), reference = snapshot(referenceInput, 'input');
    const selected = native(() => resolveCadGeometryReference(document, reference), 'resolve actual current native Surface');
    check(selected.geometry.kind === 'surface', CODE.REFERENCE, 'area requires selected native Surface geometry');
    const geometry = selected.geometry;
    native(() => validateSurface(geometry), 'actual original positive native Surface admission');
    check(geometry.degreeU >= 1 && geometry.degreeU <= 3 && geometry.degreeV >= 1 && geometry.degreeV <= 3
        && geometry.controlPoints.length <= 16 && geometry.controlPoints.every(row => row.length <= 16
        && row.every(point => point.every(value => Math.abs(value) <= 10000)))
        && geometry.knotsU.length <= 20 && geometry.knotsV.length <= 20, CODE.INPUT, 'native degree1..3 axes16/knots20 Surface XYZ±10000mm required');
    const originalDomains = surfaceDomain(geometry);
    for (const axis of ['u', 'v'])
        check(finite(originalDomains[axis][1] - originalDomains[axis][0], 'original domain width overflow') > 0, CODE.REPRESENTABILITY, 'finite positive original U/V domain widths required');
    const settings = options(optionInput, originalDomains), region = settings.region === null
        ? { u: [...originalDomains.u], v: [...originalDomains.v] } : { u: [...settings.region.u], v: [...settings.region.v] };
    for (const axis of ['u', 'v'])
        check(finite(region[axis][1] - region[axis][0], 'selected region width overflow') > 0, CODE.REPRESENTABILITY, 'finite positive selected U/V widths required');
    const originalBreaks = { u: breaks(geometry.knotsU, originalDomains.u), v: breaks(geometry.knotsV, originalDomains.v) };
    const initialBreaks = {
        u: [region.u[0], ...originalBreaks.u.filter(value => value > region.u[0] && value < region.u[1]), region.u[1]],
        v: [region.v[0], ...originalBreaks.v.filter(value => value > region.v[0] && value < region.v[1]), region.v[1]],
    };
    const representative = { u: midpoint([initialBreaks.u[0], initialBreaks.u[1]]), v: midpoint([initialBreaks.v[0], initialBreaks.v[1]]) };
    const guards = [];
    for (const axis of ['u', 'v']) {
        const knots = axis === 'u' ? geometry.knotsU : geometry.knotsV, degree = axis === 'u' ? geometry.degreeU : geometry.degreeV;
        for (const parameter of originalBreaks[axis].slice(1, -1)) {
            const multiplicity = knots.filter(knot => knot === parameter).length;
            if (parameter < region[axis][0] || parameter > region[axis][1] || multiplicity < degree)
                continue;
            check(guards.length < 128, CODE.BUDGET, 'actual original C0 guard budget exceeded');
            const probe = axis === 'u' ? { u: parameter, v: representative.v } : { u: representative.u, v: parameter };
            try {
                evaluateSurfaceD1(geometry, probe.u, probe.v);
                throw new CadSurfaceAreaError(CODE.BINDING, 'actual original Surface C0 guard unexpectedly admitted D1');
            }
            catch (cause) {
                if (cause instanceof CadSurfaceAreaError)
                    throw cause;
                if (!(cause instanceof Error && cause.message === 'First derivative is not defined at an exact C0 interior knot'))
                    throw new CadSurfaceAreaError(CODE.NATIVE, 'actual original Surface C0 refusal required', cause);
                guards.push({ axis, parameter, multiplicity, probe, status: 'native-refused', nativeErrorName: cause.name, nativeErrorCode: null, message: cause.message });
            }
        }
    }
    const g3 = Math.sqrt(3 / 5), outer = Math.sqrt(5 + 2 * Math.sqrt(10 / 7)) / 3, inner = Math.sqrt(5 - 2 * Math.sqrt(10 / 7)) / 3;
    const normalizedNodes = [-outer, -g3, -inner, 0, inner, g3, outer], G3Indices = [1, 3, 5], G5Indices = [0, 2, 3, 4, 6];
    const G3Weights = [5 / 9, 8 / 9, 5 / 9];
    const outerWeight = (322 - 13 * Math.sqrt(70)) / 900, innerWeight = (322 + 13 * Math.sqrt(70)) / 900;
    const G5Weights = [outerWeight, innerWeight, 128 / 225, innerWeight, outerWeight];
    let cellMeasurementCount = 0, evaluationCount = 0, pointEvaluationCount = 0;
    const measure = (region, depth, originalSpanIndices) => {
        const uMid = midpoint(region.u), vMid = midpoint(region.v);
        const halfU = product(region.u[1] - region.u[0], .5), halfV = product(region.v[1] - region.v[0], .5);
        const mapped = (domain, centre, half) => {
            const parameters = normalizedNodes.map(node => node === 0 ? centre : finite(centre + product(half, node), 'native Gauss node mapping overflow'));
            check(parameters.every((parameter, index) => parameter > domain[0] && parameter < domain[1]
                && (index === 0 || parameter > parameters[index - 1])), CODE.REPRESENTABILITY, 'seven distinct strict-interior values per native axis required');
            return parameters;
        };
        const U = mapped(region.u, uMid, halfU), V = mapped(region.v, vMid, halfV);
        check(evaluationCount + 33 <= settings.maximumEvaluations, CODE.BUDGET, 'actual tensor D1 evaluation budget exhausted');
        const cellIndex = cellMeasurementCount++, nodes = [], nodeByIndex = new Map();
        for (let i = 0; i < 7; i++)
            for (let j = 0; j < 7; j++) {
                if (!(G3Indices.includes(i) && G3Indices.includes(j) || G5Indices.includes(i) && G5Indices.includes(j)))
                    continue;
                evaluationCount++;
                const result = native(() => evaluateSurfaceD1(geometry, U[i], V[j]), 'actual strict-interior native Surface D1');
                check(result.point.every(Number.isFinite) && result.du.every(Number.isFinite) && result.dv.every(Number.isFinite), CODE.NATIVE, 'finite native point/Du/Dv required');
                const node = { uNodeIndex: i, vNodeIndex: j, u: U[i], v: V[j], pointMM: result.point, jacobian: norm(cross(result.du, result.dv)) };
                nodes.push(node);
                nodeByIndex.set(i * 7 + j, node);
            }
        check(nodes.length === 33, CODE.BINDING, 'actual tensor union must contain33 nodes');
        const weighted = (indices, weights) => {
            let sum = 0;
            for (let i = 0; i < indices.length; i++)
                for (let j = 0; j < indices.length; j++) {
                    const node = nodeByIndex.get(indices[i] * 7 + indices[j]);
                    check(node !== undefined, CODE.BINDING, 'actual measured tensor rule node missing');
                    sum = finite(sum + product(product(weights[i], weights[j]), node.jacobian), 'tensor quadrature sum overflow');
                }
            return sum;
        };
        const Q3 = product(product(weighted(G3Indices, G3Weights), halfU), halfV);
        const Q5 = product(product(weighted(G5Indices, G5Weights), halfU), halfV);
        const centre = nodeByIndex.get(3 * 7 + 3);
        check(centre !== undefined, CODE.BINDING, 'actual shared centre node missing');
        const sanityGrid = [], uGrid = [region.u[0], uMid, region.u[1]], vGrid = [region.v[0], vMid, region.v[1]];
        for (let i = 0; i < 3; i++)
            for (let j = 0; j < 3; j++) {
                let pointMM;
                if (i === 1 && j === 1)
                    pointMM = centre.pointMM;
                else {
                    pointEvaluationCount++;
                    pointMM = native(() => evaluateSurface(geometry, uGrid[i], vGrid[j]), 'actual native triangle-sanity grid point');
                    check(pointMM.every(Number.isFinite), CODE.NATIVE, 'finite actual grid point required');
                }
                sanityGrid.push({ u: uGrid[i], v: vGrid[j], pointMM });
            }
        const triangles = [];
        for (let i = 0; i < 2; i++)
            for (let j = 0; j < 2; j++) {
                const lowLow = i * 3 + j, highLow = (i + 1) * 3 + j, lowHigh = i * 3 + j + 1, highHigh = (i + 1) * 3 + j + 1;
                for (const pointIndices of [[lowLow, highLow, highHigh], [lowLow, highHigh, lowHigh]]) {
                    const [a, b, c] = pointIndices.map(index => sanityGrid[index].pointMM);
                    triangles.push({ pointIndices, areaMM2: product(.5, norm(cross(delta(b, a), delta(c, a)))) });
                }
            }
        const nativeTriangleAreaMM2 = triangles.reduce((sum, triangle) => finite(sum + triangle.areaMM2, 'native triangle sanity sum overflow'), 0);
        const gaussDifferenceMM2 = Math.abs(finite(Q5 - Q3, 'tensor rule difference overflow')), roundoffFloorMM2 = Q5 === 0 ? 0 : product(EPS, Math.abs(Q5));
        const triangleShortfallMM2 = Math.max(0, finite(nativeTriangleAreaMM2 - Q5, 'native triangle shortfall overflow'));
        return { cellIndex, region, depth, originalSpanIndices, Q3, Q5, gaussDifferenceMM2, roundoffFloorMM2, triangleShortfallMM2,
            nativeTriangleAreaMM2, errorEstimateMM2: Math.max(gaussDifferenceMM2, roundoffFloorMM2, triangleShortfallMM2), nodes, sanityGrid, triangles };
    };
    const cells = [];
    for (let i = 1; i < initialBreaks.u.length; i++)
        for (let j = 1; j < initialBreaks.v.length; j++) {
            const region = { u: [initialBreaks.u[i - 1], initialBreaks.u[i]], v: [initialBreaks.v[j - 1], initialBreaks.v[j]] };
            const indices = { u: -1, v: -1 };
            for (const axis of ['u', 'v'])
                indices[axis] = originalBreaks[axis].findIndex((low, index) => index + 1 < originalBreaks[axis].length
                    && region[axis][0] >= low && region[axis][1] <= originalBreaks[axis][index + 1]);
            check(indices.u >= 0 && indices.v >= 0, CODE.BINDING, 'initial cell must bind actual original U/V spans');
            check(cells.length < 225, CODE.BUDGET, 'initial native grid cell capacity exceeded');
            cells.push(measure(region, 0, indices));
        }
    const initialCellCount = cells.length, subdivisions = [];
    const aggregate = () => {
        const areaEstimateMM2 = cells.reduce((sum, cell) => finite(sum + cell.Q5, 'aggregate area estimate overflow'), 0);
        const errorEstimateMM2 = cells.reduce((sum, cell) => finite(sum + cell.errorEstimateMM2, 'aggregate cell estimator overflow'), 0);
        return { areaEstimateMM2, errorEstimateMM2,
            achievedToleranceMM2: Math.max(settings.absoluteToleranceMM2, product(settings.relativeTolerance, areaEstimateMM2)) };
    };
    let totals = aggregate();
    while (totals.errorEstimateMM2 > totals.achievedToleranceMM2) {
        let selectedIndex = 0;
        for (let i = 1; i < cells.length; i++)
            if (cells[i].errorEstimateMM2 > cells[selectedIndex].errorEstimateMM2)
                selectedIndex = i;
        const parent = cells[selectedIndex];
        check(subdivisions.length < settings.maximumSubdivisions && parent.depth < settings.maximumDepth, CODE.BUDGET, 'selected worst cell subdivision/depth budget exhausted');
        check(evaluationCount + 132 <= settings.maximumEvaluations, CODE.BUDGET, 'four child cells exceed remaining D1 evaluation budget');
        const middle = { u: midpoint(parent.region.u), v: midpoint(parent.region.v) };
        const children = [
            measure({ u: [parent.region.u[0], middle.u], v: [parent.region.v[0], middle.v] }, parent.depth + 1, parent.originalSpanIndices),
            measure({ u: [parent.region.u[0], middle.u], v: [middle.v, parent.region.v[1]] }, parent.depth + 1, parent.originalSpanIndices),
            measure({ u: [middle.u, parent.region.u[1]], v: [parent.region.v[0], middle.v] }, parent.depth + 1, parent.originalSpanIndices),
            measure({ u: [middle.u, parent.region.u[1]], v: [middle.v, parent.region.v[1]] }, parent.depth + 1, parent.originalSpanIndices),
        ];
        cells.splice(selectedIndex, 1, ...children);
        subdivisions.push({ index: subdivisions.length, parent, midpoint: middle, children,
            evaluationCountAfterSubdivision: evaluationCount, pointEvaluationCountAfterSubdivision: pointEvaluationCount });
        totals = aggregate();
    }
    check(evaluationCount === 33 * cellMeasurementCount && pointEvaluationCount === 8 * cellMeasurementCount
        && cellMeasurementCount <= 737, CODE.BINDING, 'actual native cell work counts differ from declared rule');
    const report = {
        schema: 'barocss-cad-surface-area', version: 0, reference: selected.reference, documentVersion: 1, sourceVersion: 0,
        lengthUnit: 'mm', areaUnit: 'mm2', sourceFrame: selected.reference.sourceFrame, originalDomains, requestedRegion: settings.region, region,
        originalBreaks, initialBreaks, initialCellCount, finalCellCount: cells.length, cellMeasurementCount, evaluationCount, pointEvaluationCount,
        guardEvaluationCount: guards.length, subdivisionCount: subdivisions.length, guards, subdivisions,
        areaEstimateMM2: totals.areaEstimateMM2, errorEstimateMM2: totals.errorEstimateMM2,
        requestedAbsoluteToleranceMM2: settings.absoluteToleranceMM2, requestedRelativeTolerance: settings.relativeTolerance,
        achievedToleranceMM2: totals.achievedToleranceMM2, criterion: 'aggregate-cell-estimator-not-certified-upper-bound', criterionSatisfied: true,
        rule: { family: 'own-closed-form-tensor-three-and-five-point-gauss-legendre', normalizedNodes, G3Weights, G5Weights,
            derivativeCallsPerCell: 33, pointCallsPerCell: 8, sharedCentreEvaluatedOnce: true, triangleDiagonal: 'low-low-to-high-high', gridOrder: 'u-major-v-major' },
        geometryAuthority: 'actual-original-source0-surface-and-native-d1', geometricValidity: 'not-certified', topologyCertified: false, solid: false,
        quality: { areaEstimate: 'five-by-five-rule-only-no-triangle-substitution', estimator: 'maximum-gauss-difference64-epsilon-floor-and-native-triangle-shortfall',
            nativeTriangleSanity: 'local-point-grid-plausibility-heuristic-not-certified-bound', parameterizedArea: 'counts-multiplicity-not-union-trim-or-brep-area',
            parameterScaling: 'original-u-v-half-widths-no-normalized-or-angular-fraction-inference', cellIdentity: 'measurement-order-id-including-discarded-parents',
            listOrder: 'initial-u-major-v-major-with-deterministic-local-child-replacement-not-global-lexicographic',
            knotGuards: 'genuine-native-c0-refusals-probed-with-other-axis-interior-midpoint', discardedParentWorkCounted: true, exactZeroJacobianSupported: true,
            globalErrorCertified: false, globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false, g1g2Certified: false,
            ownership: 'copied-cpu-data-gc-no-renderer-resources' }, budgetFailure: 'atomic-refusal-no-partial-result',
        limits: { maximumAxisDegree: 3, maximumAxisPoles: 16, maximumSurfacePoles: 256, maximumAxisKnots: 20,
            coordinateAbsMM: 10000, weightRange: [1e-6, 1e6], maximumEvaluations: 65536, maximumSubdivisions: 128, maximumDepth: 10,
            maximumInitialCells: 225, maximumMeasuredCells: 737, maximumGuardEvaluations: 128, maximumActualD1Evaluations: 24321, maximumActualD0Evaluations: 5896,
            ownedValues: 1048576, ownedDepth: 32, arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144,
            optionValues: 32768, optionDepth: 8, optionArrayElements: 128, optionRecordFields: 16, optionStringCharacters: 128 },
    };
    return snapshot({ reference: selected.reference, geometry, source: selected.source, options: settings, areaEstimateMM2: totals.areaEstimateMM2,
        errorEstimateMM2: totals.errorEstimateMM2, cells, report }, 'owned');
}
/** Re-resolve actual current source and reconstruct all metric nodes, sanity, work and trace fields. */
export function validateCadDocumentSurfaceArea(document, input) {
    const owned = snapshot(input, 'owned');
    record(owned, ['reference', 'geometry', 'source', 'options', 'areaEstimateMM2', 'errorEstimateMM2', 'cells', 'report'], CODE.OWNED);
    let expected;
    try {
        expected = queryCadDocumentSurfaceArea(document, owned.reference, owned.options);
    }
    catch (cause) {
        if (cause instanceof CadSurfaceAreaError && cause.code === 'STALE')
            throw cause;
        throw new CadSurfaceAreaError(CODE.OWNED, 'owned reference/options complete native area rebuild refused', cause);
    }
    check(same(owned, expected), CODE.OWNED, 'owned original/source/options/cells/Jacobian/grid/triangle/estimator/work/trace/report mismatch');
    return snapshot(expected.report, 'owned');
}

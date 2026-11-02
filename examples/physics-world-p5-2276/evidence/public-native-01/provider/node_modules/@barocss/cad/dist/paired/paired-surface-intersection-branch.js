import { CadNumericPolicy } from '../numeric-policy.js';
import { compileCadModel } from '../model-compiler.js';
import { validateSurface, surfaceDomain, evaluateSurface } from '../core/math.js';
import { evaluateSurfaceD1 } from '../core/derivatives.js';
import { same } from '../core/structural-equality.js';
import { KernelError } from '../core/barocss-error.js';
export const PairedSurfaceIntersectionBranchDiagnosticCode = Object.freeze({
    INPUT: 'INPUT', IDENTITY: 'IDENTITY', SOURCE: 'SOURCE', REFERENCE: 'REFERENCE', SUPPORT: 'SUPPORT',
    DOMAIN: 'DOMAIN', CONTINUITY: 'CONTINUITY', REGULARITY: 'REGULARITY', TANGENCY: 'TANGENCY',
    CHART: 'CHART', CONDITION: 'CONDITION', REPRESENTABILITY: 'REPRESENTABILITY', NATIVE: 'NATIVE',
    STAGNATION: 'STAGNATION', WORK: 'WORK', BUDGET: 'BUDGET', BINDING: 'BINDING', FILE: 'FILE', OWNED: 'OWNED',
}); // nineteen exact keys
export class PairedSurfaceIntersectionBranchError extends KernelError {
    code;
    context;
    constructor(code, detail, context, cause) {
        super(('Paired Surface intersection branch: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
        this.name = 'PairedSurfaceIntersectionBranchError';
        this.code = code;
        this.context = { ...context, directCounts: { ...context.directCounts } };
    }
}
const CODE = PairedSurfaceIntersectionBranchDiagnosticCode;
const TOLERANCE = CadNumericPolicy.linearTolerance;
function counts() {
    return { sourceCompilationCount: 0, selectedSurfaceValidationCount: 0, surfaceDomainCount: 0,
        stationStartCount: 0, stationCompletionCount: 0, correctionSolveCount: 0, acceptedCorrectionCount: 0,
        trialSlotCount: 0, domainRejectedTrialCount: 0, inDomainTrialCount: 0,
        rejectedDecreaseTrialCount: 0, acceptedTrialCount: 0, surfacePointEvaluationCount: 0,
        surfaceDerivativeAttemptCount: 0, finalPointPairCount: 0, chartFactorizationCount: 0,
        linearSolveCount: 0, tangentSolveCount: 0, curvePointEvaluationCount: 0,
        curveDerivativeAttemptCount: 0, secondDerivativeAttemptCount: 0, rationalOperationCount: 0,
        fittingCallCount: 0, sourceWriterCallCount: 0 };
}
function context() {
    return { phase: 'input', assetIndex: null, stationIndex: null, correctionIndex: null,
        trialIndex: null, directCounts: counts() };
}
function fail(state, code, detail, cause) {
    throw new PairedSurfaceIntersectionBranchError(code, detail, state, cause);
}
function check(state, condition, code, detail) {
    if (!condition)
        fail(state, code, detail);
}
function native(state, action, code, detail) {
    try {
        return action();
    }
    catch (cause) {
        if (cause instanceof PairedSurfaceIntersectionBranchError)
            throw cause;
        const actual = code === CODE.NATIVE && cause instanceof Error &&
            cause.message === 'First derivative is not defined at an exact C0 interior knot' ? CODE.CONTINUITY : code;
        fail(state, actual, detail, cause);
    }
}
function record(state, input, fields, code = CODE.INPUT) {
    check(state, input !== null && typeof input === 'object' && !Array.isArray(input), code, 'An own record is required');
    const data = input;
    check(state, Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own fields are required');
    return data;
}
function snapshot(state, input, owned = false) {
    const code = owned ? CODE.OWNED : CODE.INPUT, budget = owned ? CODE.OWNED : CODE.BUDGET;
    let remaining = 1048576;
    const ancestors = new Set();
    const copy = (value, depth) => {
        check(state, --remaining >= 0 && depth <= 64, budget, 'Own value or depth limit exceeded');
        if (value === null || typeof value === 'boolean')
            return value;
        if (typeof value === 'number') {
            check(state, Number.isFinite(value), code, 'Finite own numbers are required');
            return value;
        }
        if (typeof value === 'string') {
            check(state, value.length <= 262144, budget, 'Own string limit exceeded');
            return value;
        }
        check(state, typeof value === 'object' && !ancestors.has(value), code, 'Acyclic plain own data is required');
        const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
        check(state, array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'Plain own-data prototypes are required');
        const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
        check(state, keys.length <= (array ? 8193 : 64), budget, 'Own field limit exceeded');
        check(state, keys.every(key => typeof key === 'string' && key.length <= 128 &&
            'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable)), code, 'Getters, symbols and hidden fields are refused');
        ancestors.add(value);
        let result;
        if (array) {
            const length = descriptors.length.value;
            check(state, Number.isInteger(length) && length >= 0 && length <= 8192, budget, 'Own array element limit exceeded');
            check(state, keys.length === length + 1, code, 'Dense own arrays without extra fields are required');
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
function identifier(state, value) {
    check(state, typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'A supported ASCII identity of at most48 characters is required');
}
function tuple(state, value, length) {
    check(state, Array.isArray(value) && value.length === length && value.every(item => typeof item === 'number' && Number.isFinite(item)), CODE.INPUT, 'A fixed finite numeric tuple is required');
}
function sourceSize(state, source) {
    const size = { utf16: source.length, utf8: new TextEncoder().encode(source).length };
    check(state, size.utf16 <= 262144 && size.utf8 <= 262144, CODE.BUDGET, 'Each complete source must fit262144 UTF16 units and UTF8 bytes');
    return size;
}
function fileSize(state, input, limit = 4194304) {
    let utf16 = 0, utf8 = 0;
    const encoder = new TextEncoder();
    const append = (text) => {
        utf16 += text.length;
        utf8 += encoder.encode(text).length;
        check(state, utf16 <= limit && utf8 <= limit, CODE.FILE, 'Complete JSON exceeds its UTF16 or UTF8 envelope');
    };
    const visit = (value) => {
        if (value === null || typeof value === 'boolean' || typeof value === 'string')
            append(JSON.stringify(value));
        else if (typeof value === 'number') {
            check(state, Number.isFinite(value), CODE.FILE, 'Finite JSON numbers are required');
            append(Object.is(value, -0) ? '-0' : JSON.stringify(value));
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
function finite(state, value) {
    check(state, Number.isFinite(value), CODE.REPRESENTABILITY, 'Pure branch arithmetic must remain finite');
    return value;
}
function product(state, a, b) {
    const value = finite(state, a * b);
    check(state, a === 0 || b === 0 || value !== 0, CODE.REPRESENTABILITY, 'A nonzero product underflowed to zero');
    return value;
}
function quotient(state, a, b) {
    check(state, b !== 0, CODE.REPRESENTABILITY, 'A represented nonzero divisor is required');
    const value = finite(state, a / b);
    check(state, a === 0 || value !== 0, CODE.REPRESENTABILITY, 'A nonzero quotient underflowed to zero');
    return value;
}
function norm(state, point) {
    point.forEach(value => finite(state, value));
    const value = finite(state, Math.hypot(...point));
    check(state, point.every(component => component === 0) || value > 0, CODE.REPRESENTABILITY, 'A nonzero vector norm underflowed to zero');
    return value;
}
function difference(state, a, b) {
    return [finite(state, a[0] - b[0]), finite(state, a[1] - b[1]), finite(state, a[2] - b[2])];
}
function residual(state, a, b) {
    const vectorMM = difference(state, a, b);
    return { vectorMM, normMM: norm(state, vectorMM) };
}
function cross(state, a, b) {
    return [finite(state, product(state, a[1], b[2]) - product(state, a[2], b[1])),
        finite(state, product(state, a[2], b[0]) - product(state, a[0], b[2])),
        finite(state, product(state, a[0], b[1]) - product(state, a[1], b[0]))];
}
function normalEvidence(state, a, b) {
    state.phase = 'regularity';
    state.assetIndex = null;
    for (const partial of [a.du, a.dv, b.du, b.dv])
        norm(state, partial);
    const rawA = cross(state, a.du, a.dv), rawB = cross(state, b.du, b.dv);
    const normA = norm(state, rawA), normB = norm(state, rawB);
    check(state, normA > 0 && normB > 0, CODE.REGULARITY, 'Both actual native normals must be nonzero');
    const unitA = rawA.map(value => quotient(state, value, normA));
    const unitB = rawB.map(value => quotient(state, value, normB));
    const unitCross = cross(state, unitA, unitB), transverseMeasure = norm(state, unitCross);
    check(state, transverseMeasure >= 1e-6, CODE.TANGENCY, 'Measured transverse value is below the local numerical admission threshold; exact contact is not classified');
    return { rawA, rawB, normA, normB, unitA, unitB, unitCross, transverseMeasure };
}
/** A bounded factorization of the actual fixed-UA Jacobian, with no geometry construction. */
function factor(state, a, b, widths) {
    state.phase = 'chart';
    check(state, state.directCounts.chartFactorizationCount < 221, CODE.WORK, 'The hard chart-factor limit is exhausted');
    state.directCounts.chartFactorizationCount++;
    const jacobian = [0, 1, 2].map(row => [a.dv[row], -b.du[row], -b.dv[row]]);
    const scaledColumns = [0, 1, 2].map(column => jacobian.map(row => product(state, row[column], widths[column])));
    const scaledColumnNorms = scaledColumns.map(column => norm(state, column));
    check(state, scaledColumnNorms.every(value => value >= 1e-12 && value <= 1e12), CODE.CONDITION, 'Every domain-scaled native column norm must be in the declared range');
    const normalizedMatrix = jacobian.map((_, row) => scaledColumns.map((column, index) => quotient(state, column[row], scaledColumnNorms[index])));
    const upper = normalizedMatrix.map(row => row.slice());
    const lower = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], rowOrder = [0, 1, 2];
    const pivots = [], eliminations = [];
    for (let column = 0; column < 3; column++) {
        let selected = column;
        for (let row = column + 1; row < 3; row++)
            if (Math.abs(upper[row][column]) > Math.abs(upper[selected][column]))
                selected = row;
        const swappedCurrentRows = selected === column ? null : [column, selected];
        if (selected !== column) {
            [upper[column], upper[selected]] = [upper[selected], upper[column]];
            [rowOrder[column], rowOrder[selected]] = [rowOrder[selected], rowOrder[column]];
            for (let previous = 0; previous < column; previous++)
                [lower[column][previous], lower[selected][previous]] = [lower[selected][previous], lower[column][previous]];
        }
        const absolutePivot = finite(state, Math.abs(upper[column][column]));
        check(state, absolutePivot !== 0, CODE.CHART, 'The chosen fixed-UA chart has an actual zero pivot; no absence-of-intersection conclusion follows');
        check(state, absolutePivot >= 1e-10, CODE.CONDITION, 'The actual nonzero normalized pivot is below the declared threshold');
        pivots.push({ column: column, selectedCurrentRow: selected,
            pivotRowOriginalIndex: rowOrder[column], swappedCurrentRows,
            absolutePivot, rowOrder: [...rowOrder] });
        for (let row = column + 1; row < 3; row++) {
            const coefficient = quotient(state, upper[row][column], upper[column][column]);
            lower[row][column] = coefficient;
            eliminations.push({ column: column, row: row, factor: coefficient });
            upper[row][column] = 0;
            for (let next = column + 1; next < 3; next++)
                upper[row][next] = finite(state, upper[row][next] - product(state, coefficient, upper[column][next]));
        }
    }
    return { unknownOrder: ['vA', 'uB', 'vB'], jacobian, domainWidths: [...widths], scaledColumnNorms,
        normalizedMatrix, rowOrder, pivots: pivots, eliminations: eliminations,
        lowerTriangularMatrix: lower, upperTriangularMatrix: upper,
        minimumAbsolutePivot: Math.min(...pivots.map(pivot => pivot.absolutePivot)),
        method: 'domain-width-column-normalization-absolute-partial-row-pivot',
        tiePolicy: 'first-current-row-on-equal-absolute-score',
        recoveryAssociation: 'domain-width-times-normalized-solution-divided-by-scaled-column-norm' };
}
function solve(state, chart, rhsMM, role) {
    check(state, state.directCounts.linearSolveCount < 221, CODE.WORK, 'The hard linear-solve limit is exhausted');
    state.directCounts.linearSolveCount++;
    if (role === 'newton')
        state.directCounts.correctionSolveCount++;
    else
        state.directCounts.tangentSolveCount++;
    const permutedRHS = chart.rowOrder.map(index => rhsMM[index]);
    const forwardSubstitutionRHS = [0, 0, 0];
    for (let row = 0; row < 3; row++) {
        let value = finite(state, permutedRHS[row]);
        for (let column = 0; column < row; column++)
            value = finite(state, value - product(state, chart.lowerTriangularMatrix[row][column], forwardSubstitutionRHS[column]));
        forwardSubstitutionRHS[row] = value;
    }
    const normalizedSolution = [0, 0, 0];
    for (let row = 2; row >= 0; row--) {
        let value = forwardSubstitutionRHS[row];
        for (let column = row + 1; column < 3; column++)
            value = finite(state, value - product(state, chart.upperTriangularMatrix[row][column], normalizedSolution[column]));
        normalizedSolution[row] = quotient(state, value, chart.upperTriangularMatrix[row][row]);
    }
    const recoveredOriginalUnknowns = normalizedSolution.map((xi, column) => product(state, chart.domainWidths[column], quotient(state, xi, chart.scaledColumnNorms[column])));
    return { role, rhsMM: [...rhsMM], permutedRHS, forwardSubstitutionRHS, normalizedSolution, recoveredOriginalUnknowns };
}
function inDomain(value, domain) {
    return value >= domain[0] && value <= domain[1];
}
function partialChain(state, first, second, firstScale, secondScale) {
    return [0, 1, 2].map(axis => finite(state, product(state, first[axis], firstScale) + product(state, second[axis], secondScale)));
}
function relativeGap(state, a, b) {
    const aNorm = norm(state, a), bNorm = norm(state, b), differenceNorm = norm(state, difference(state, a, b));
    const scale = finite(state, Math.max(1, aNorm, bNorm));
    return quotient(state, differenceNorm, scale);
}
/** Trace a caller-seeded local branch in original parameters, without fitting or topology construction. */
export function tracePairedSurfaceIntersectionBranch(input) {
    const state = context();
    const data = record(state, snapshot(state, input), ['assets', 'seed', 'uAStations', 'options']);
    const settings = record(state, data.options, ['evaluationId', 'maximumStations', 'maximumCorrectionsPerStation',
        'maximumTrialsPerCorrection', 'maximumSurfacePointEvaluations', 'maximumSurfaceDerivativeAttempts']);
    identifier(state, settings.evaluationId);
    for (const [field, maximum] of [['maximumStations', 17], ['maximumCorrectionsPerStation', 12],
        ['maximumTrialsPerCorrection', 8], ['maximumSurfacePointEvaluations', 3298],
        ['maximumSurfaceDerivativeAttempts', 442]])
        check(state, typeof settings[field] === 'number' && Number.isInteger(settings[field]) &&
            settings[field] >= 0 && settings[field] <= maximum, CODE.BUDGET, 'Declared work budgets must be integers within hard limits');
    check(state, Array.isArray(data.assets) && data.assets.length === 2, CODE.INPUT, 'Two complete original source assets are required');
    for (const value of data.assets) {
        const asset = record(state, value, ['sourceId', 'source', 'surface']);
        identifier(state, asset.sourceId);
        check(state, typeof asset.source === 'string', CODE.INPUT, 'A complete original Source0 string is required');
        const surface = record(state, asset.surface, ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']);
        identifier(state, surface.id);
    }
    const request = data, options = request.options;
    check(state, request.assets[0].sourceId !== request.assets[1].sourceId, CODE.IDENTITY, 'The two original source namespaces must differ; selected object names may repeat across them');
    const seed = record(state, request.seed, ['uvA', 'uvB']);
    tuple(state, seed.uvA, 2);
    tuple(state, seed.uvB, 2);
    check(state, Array.isArray(request.uAStations) && request.uAStations.length >= 2 && request.uAStations.length <= 17 &&
        request.uAStations.every(value => typeof value === 'number' && Number.isFinite(value)), CODE.INPUT, 'Exactly2..17 finite original-UA stations are required');
    check(state, request.uAStations.every((value, index) => index === 0 || value > request.uAStations[index - 1]), CODE.INPUT, 'The original-UA schedule must be strictly increasing');
    state.phase = 'station';
    check(state, request.uAStations.length <= options.maximumStations, CODE.WORK, 'The declared station budget is insufficient');
    state.phase = 'seed';
    check(state, Object.is(request.seed.uvA[0], request.uAStations[0]), CODE.DOMAIN, 'The original seed UA bits must equal the first actual station');
    const sourceSizes = request.assets.map((asset, index) => {
        state.phase = 'source';
        state.assetIndex = index;
        return sourceSize(state, asset.source);
    });
    state.phase = 'file';
    state.assetIndex = null;
    const requestSize = fileSize(state, request, 2097152);
    const originalModels = [], observations = [];
    let current = null;
    const guard = () => {
        const phase = state.phase;
        state.phase = 'file';
        const completePrefix = { request, originalModels, observations, current, directCounts: state.directCounts };
        fileSize(state, completePrefix);
        snapshot(state, completePrefix);
        state.phase = phase;
    };
    for (let index = 0; index < 2; index++) {
        state.phase = 'source';
        state.assetIndex = index;
        guard();
        state.directCounts.sourceCompilationCount++;
        const compiled = native(state, () => compileCadModel(request.assets[index].source, { sourceVersion: 0 }), CODE.SOURCE, 'Actual complete original source compilation failed');
        if (!compiled.ok)
            fail(state, CODE.SOURCE, 'Actual complete original Source0 did not compile', compiled.diagnostics);
        originalModels.push(compiled.model);
        guard();
    }
    const objectIndices = [];
    for (let index = 0; index < 2; index++) {
        state.phase = 'reference';
        state.assetIndex = index;
        const asset = request.assets[index], model = originalModels[index];
        const matches = model.objects.map((object, objectIndex) => ({ object, objectIndex }))
            .filter(value => value.object.id === asset.surface.id);
        check(state, matches.length === 1 && matches[0].object.kind === 'surface', CODE.REFERENCE, 'The original source must uniquely select the actual native Surface');
        check(state, same(matches[0].object, asset.surface), CODE.BINDING, 'Every supplied selected Surface bit must bind to its complete original compiled object');
        objectIndices.push(matches[0].objectIndex);
    }
    const domains = [];
    for (let index = 0; index < 2; index++) {
        state.phase = 'support';
        state.assetIndex = index;
        const surface = request.assets[index].surface;
        guard();
        state.directCounts.selectedSurfaceValidationCount++;
        native(state, () => validateSurface(surface), CODE.NATIVE, 'Actual selected native Surface validation refused');
        guard();
        const countU = surface.controlPoints.length, countV = surface.controlPoints[0].length;
        check(state, surface.degreeU >= 1 && surface.degreeU <= 3 && surface.degreeV >= 1 && surface.degreeV <= 3 &&
            countU <= 8 && countV <= 8 && countU * countV <= 64 &&
            surface.controlPoints.every(row => row.every(point => point.every(value => Math.abs(value) <= 10000))) &&
            surface.weights.every(row => row.every(value => value >= 0.001 && value <= 1000)), CODE.SUPPORT, 'The selected native support exceeds the bounded degree, net, coordinate or weight profile');
        state.directCounts.surfaceDomainCount++;
        const domain = native(state, () => surfaceDomain(surface), CODE.NATIVE, 'Actual original native Surface domains refused');
        guard();
        for (const axis of [domain.u, domain.v]) {
            const width = finite(state, axis[1] - axis[0]);
            check(state, axis.every(value => Math.abs(value) <= 10000) && width >= 0.001 && width <= 10000, CODE.SUPPORT, 'Original domain endpoints and represented widths exceed the bounded profile');
        }
        domains.push(domain);
    }
    const a = request.assets[0].surface, b = request.assets[1].surface;
    state.phase = 'seed';
    state.assetIndex = null;
    check(state, inDomain(request.seed.uvA[0], domains[0].u) && inDomain(request.seed.uvA[1], domains[0].v) &&
        inDomain(request.seed.uvB[0], domains[1].u) && inDomain(request.seed.uvB[1], domains[1].v), CODE.DOMAIN, 'The caller seed must remain in both complete original domains');
    check(state, request.uAStations.every(value => inDomain(value, domains[0].u)), CODE.DOMAIN, 'Every requested original-UA station must remain in the original A domain');
    const widths = [finite(state, domains[0].v[1] - domains[0].v[0]),
        finite(state, domains[1].u[1] - domains[1].u[0]), finite(state, domains[1].v[1] - domains[1].v[0])];
    const nativeBudget = (derivative) => {
        check(state, state.directCounts.surfacePointEvaluationCount + state.directCounts.surfaceDerivativeAttemptCount < 3740, CODE.WORK, 'The hard total native-attempt limit is exhausted');
        check(state, derivative ? state.directCounts.surfaceDerivativeAttemptCount < options.maximumSurfaceDerivativeAttempts :
            state.directCounts.surfacePointEvaluationCount < options.maximumSurfacePointEvaluations, CODE.WORK, 'The caller native-attempt budget is exhausted before the next actual call');
    };
    const d1 = (index, uv) => {
        state.phase = 'd1';
        state.assetIndex = index;
        guard();
        nativeBudget(true);
        state.directCounts.surfaceDerivativeAttemptCount++;
        const value = native(state, () => evaluateSurfaceD1(index === 0 ? a : b, uv[0], uv[1]), CODE.NATIVE, 'Actual original native SurfaceD1 refused');
        check(state, current !== null, CODE.BINDING, 'Native history must belong to a current station');
        if (index === 0)
            current.d1A = value;
        else
            current.d1B = value;
        guard();
        return value;
    };
    const d0 = (index, uv, final) => {
        state.phase = final ? 'final-d0' : 'trial';
        state.assetIndex = index;
        guard();
        nativeBudget(false);
        if (index === 0) {
            if (final)
                state.directCounts.finalPointPairCount++;
            else
                state.directCounts.inDomainTrialCount++;
        }
        state.directCounts.surfacePointEvaluationCount++;
        const point = native(state, () => evaluateSurface(index === 0 ? a : b, uv[0], uv[1]), CODE.NATIVE, 'Actual original native SurfaceD0 refused');
        check(state, current !== null, CODE.BINDING, 'Native history must belong to a current station');
        if (final) {
            if (index === 0)
                current.pointA = point;
            else
                current.pointB = point;
        }
        else {
            const pending = current.pendingTrial;
            if (index === 0)
                pending.pointA = point;
            else
                pending.pointB = point;
        }
        guard();
        return point;
    };
    let z = [request.seed.uvA[1], request.seed.uvB[0], request.seed.uvB[1]];
    for (const [stationIndex, uA] of request.uAStations.entries()) {
        state.phase = 'station';
        state.assetIndex = null;
        state.stationIndex = stationIndex;
        state.correctionIndex = null;
        state.trialIndex = null;
        const startCounts = { ...state.directCounts };
        state.directCounts.stationStartCount++;
        const initialSeedZ = [...z], corrections = [];
        current = { index: stationIndex, uA, initialSeedZ, z: [...z], corrections,
            d1A: null, d1B: null, residual: null, normalEvidence: null, chart: null,
            pendingTrial: null, pointA: null, pointB: null, tangentSolve: null };
        guard();
        let acceptedCorrections = 0;
        for (;;) {
            state.correctionIndex = acceptedCorrections;
            state.trialIndex = null;
            const uvA = [uA, z[0]], uvB = [z[1], z[2]];
            current.z = [...z];
            current.d1A = null;
            current.d1B = null;
            current.residual = null;
            current.normalEvidence = null;
            current.chart = null;
            guard();
            const d1A = d1(0, uvA), d1B = d1(1, uvB);
            state.assetIndex = null;
            const currentResidual = residual(state, d1A.point, d1B.point);
            current.residual = currentResidual;
            guard();
            const normals = normalEvidence(state, d1A, d1B);
            current.normalEvidence = normals;
            guard();
            const chart = factor(state, d1A, d1B, widths);
            current.chart = chart;
            guard();
            if (currentResidual.normMM <= TOLERANCE) {
                state.trialIndex = null;
                const pointA = d0(0, uvA, true), pointB = d0(1, uvB, true);
                state.assetIndex = null;
                state.phase = 'final-d0';
                const finalResidual = residual(state, pointA, pointB);
                const d0ToD1PointGapMM = [residual(state, pointA, d1A.point).normMM,
                    residual(state, pointB, d1B.point).normMM];
                check(state, finalResidual.normMM <= TOLERANCE && d0ToD1PointGapMM.every(value => value <= TOLERANCE), CODE.BINDING, 'Actual final paired D0 and D0-to-D1 point gaps exceed the unchanged comparison');
                state.phase = 'tangent';
                const tangentSolve = solve(state, chart, d1A.du.map(value => -value), 'tangent');
                current.tangentSolve = tangentSolve;
                guard();
                const eta = tangentSolve.recoveredOriginalUnknowns;
                const tangentA = partialChain(state, d1A.du, d1A.dv, 1, eta[0]);
                const tangentB = partialChain(state, d1B.du, d1B.dv, eta[1], eta[2]);
                const relativeTangentGap = relativeGap(state, tangentA, tangentB);
                check(state, relativeTangentGap <= TOLERANCE, CODE.BINDING, 'Actual original-parameter tangent chains exceed the unchanged relative comparison');
                const work = {
                    correctionSolveCount: state.directCounts.correctionSolveCount - startCounts.correctionSolveCount,
                    acceptedCorrectionCount: state.directCounts.acceptedCorrectionCount - startCounts.acceptedCorrectionCount,
                    trialSlotCount: state.directCounts.trialSlotCount - startCounts.trialSlotCount,
                    domainRejectedTrialCount: state.directCounts.domainRejectedTrialCount - startCounts.domainRejectedTrialCount,
                    inDomainTrialCount: state.directCounts.inDomainTrialCount - startCounts.inDomainTrialCount,
                    surfacePointEvaluationCount: state.directCounts.surfacePointEvaluationCount - startCounts.surfacePointEvaluationCount,
                    surfaceDerivativeAttemptCount: state.directCounts.surfaceDerivativeAttemptCount - startCounts.surfaceDerivativeAttemptCount,
                    chartFactorizationCount: state.directCounts.chartFactorizationCount - startCounts.chartFactorizationCount,
                    linearSolveCount: state.directCounts.linearSolveCount - startCounts.linearSolveCount,
                };
                observations.push({ index: stationIndex, uA, initialSeedZ, uvA, uvB, pointA, pointB, d1A, d1B,
                    residual: finalResidual, d0ToD1PointGapMM, normalEvidence: normals, chart, tangentSolve,
                    originalParameterDerivative: [...eta], tangentA, tangentB, relativeTangentGap, corrections, work });
                state.directCounts.stationCompletionCount++;
                current = null;
                guard();
                break;
            }
            state.phase = 'newton';
            check(state, acceptedCorrections < options.maximumCorrectionsPerStation, CODE.WORK, 'The correction budget is exhausted before another Newton solve');
            const correctionSolve = solve(state, chart, currentResidual.vectorMM.map(value => -value), 'newton');
            const delta = correctionSolve.recoveredOriginalUnknowns;
            const fraction = Math.max(...delta.map((value, index) => Math.abs(quotient(state, value, widths[index]))));
            check(state, fraction > 0, CODE.STAGNATION, 'The unconverged Newton step has no represented nonzero component');
            const initialDamping = fraction <= 0.25 ? 1 : quotient(state, 0.25, fraction);
            const correction = { index: acceptedCorrections, uvA, uvB, d1A, d1B,
                residual: currentResidual, normalEvidence: normals, chart, solve: correctionSolve,
                undampedDelta: [...delta], initialDamping, trials: [], acceptedTrialIndex: -1 };
            corrections.push(correction);
            guard();
            check(state, options.maximumTrialsPerCorrection > 0, CODE.WORK, 'The declared zero trial budget is exhausted before a trial or native D0');
            let damping = initialDamping, accepted = false;
            for (let trialIndex = 0; trialIndex < options.maximumTrialsPerCorrection; trialIndex++) {
                state.phase = 'trial';
                state.assetIndex = null;
                state.trialIndex = trialIndex;
                state.directCounts.trialSlotCount++;
                const proposedZ = z.map((value, index) => finite(state, value + product(state, damping, delta[index])));
                const proposedA = [uA, proposedZ[0]], proposedB = [proposedZ[1], proposedZ[2]];
                const base = { index: trialIndex, damping, proposedZ, uvA: proposedA, uvB: proposedB };
                check(state, proposedZ.some((value, index) => !Object.is(value, z[index])), CODE.STAGNATION, 'The proposed original-parameter update changes no represented parameter bit');
                if (!inDomain(proposedZ[0], domains[0].v) || !inDomain(proposedZ[1], domains[1].u) || !inDomain(proposedZ[2], domains[1].v)) {
                    state.directCounts.domainRejectedTrialCount++;
                    correction.trials.push({ ...base, status: 'outside-domain', pointA: null, pointB: null, residual: null, armijoLimitMM: null });
                    guard();
                }
                else {
                    current.pendingTrial = { ...base, pointA: null, pointB: null };
                    guard();
                    const pointA = d0(0, proposedA, false), pointB = d0(1, proposedB, false);
                    state.assetIndex = null;
                    const trialResidual = residual(state, pointA, pointB);
                    const armijoLimitMM = product(state, finite(state, 1 - product(state, 0.0001, damping)), currentResidual.normMM);
                    accepted = trialResidual.normMM <= armijoLimitMM;
                    correction.trials.push({ ...base, status: accepted ? 'accepted' : 'rejected-decrease', pointA, pointB,
                        residual: trialResidual, armijoLimitMM });
                    current.pendingTrial = null;
                    if (accepted) {
                        correction.acceptedTrialIndex = trialIndex;
                        state.directCounts.acceptedTrialCount++;
                        state.directCounts.acceptedCorrectionCount++;
                        acceptedCorrections++;
                        z = [...proposedZ];
                    }
                    else
                        state.directCounts.rejectedDecreaseTrialCount++;
                    guard();
                    if (accepted)
                        break;
                }
                if (trialIndex + 1 < options.maximumTrialsPerCorrection)
                    damping = product(state, damping, 0.5);
            }
            check(state, accepted, correction.trials.every(trial => trial.status === 'outside-domain') ? CODE.DOMAIN : CODE.STAGNATION, 'All declared line-search trials escaped the original domains or failed the fixed decrease rule');
        }
    }
    state.phase = 'file';
    state.assetIndex = null;
    state.stationIndex = null;
    state.correctionIndex = null;
    state.trialIndex = null;
    check(state, observations.length === request.uAStations.length && originalModels.length === 2, CODE.BINDING, 'Every requested station and both complete original Models must remain retained');
    const report = {
        schema: 'barocss-seeded-paired-surface-intersection-branch', version: 0,
        evaluationId: options.evaluationId, lengthUnit: 'mm', parameterUnit: 'dimensionless',
        sourceFrame: 'authored-xyz-no-axis-conversion', parameterFrame: 'original-native-u-v-domains',
        selections: request.assets.map((asset, index) => ({ assetIndex: index, sourceId: asset.sourceId,
            modelName: originalModels[index].name, objectIndex: objectIndices[index], surfaceId: asset.surface.id,
            sourceField: 'request.assets.source', modelField: 'originalModels', sourceVersion: 0,
            degrees: [asset.surface.degreeU, asset.surface.degreeV],
            controlPointGrid: [asset.surface.controlPoints.length, asset.surface.controlPoints[0].length],
            domains: domains[index] })),
        stationCount: observations.length,
        maximumObservedPointGapMM: Math.max(...observations.map(value => value.residual.normMM)),
        maximumObservedD0ToD1PointGapMM: Math.max(...observations.flatMap(value => value.d0ToD1PointGapMM)),
        maximumObservedRelativeTangentGap: Math.max(...observations.map(value => value.relativeTangentGap)),
        minimumObservedTransverseMeasure: Math.min(...observations.map(value => value.normalEvidence.transverseMeasure)),
        minimumObservedAbsolutePivot: Math.min(...observations.map(value => value.chart.minimumAbsolutePivot)),
        directCounts: { ...state.directCounts }, sourceSizes,
        fileSizes: { request: requestSize, result: { utf16: 0, utf8: 0 } },
        numericPolicy: {
            corrector: 'fixed-original-uA-three-unknown-native-newton', unknownOrder: ['vA', 'uB', 'vB'],
            nextSeed: 'previous-converged-original-z-no-predictor', firstSeed: 'caller-uA-object-is-first-station',
            normAuthority: 'finite-native-components-and-finite-norms-before-division',
            pointComparisonMM: 1e-7, relativeTangentComparison: 1e-7, minimumTransverseMeasure: 1e-6,
            scaledColumnNormMinimumMM: 1e-12, scaledColumnNormMaximumMM: 1e12, minimumAbsolutePivot: 1e-10,
            maximumDomainFractionStep: 0.25, armijoCoefficient: 0.0001,
            damping: 'single-initial-domain-fraction-cap-then-half-per-trial', domain: 'original-domain-test-no-clamping',
            factorReuse: 'once-per-current-d1-pair-one-newton-or-final-tangent-solve',
            recoveryAssociation: 'domain-width-times-normalized-solution-divided-by-scaled-column-norm',
            finalPointCheck: 'always-one-new-native-d0-pair-even-if-trial-or-seed-cached',
            localAuthority: 'sampled-native-residual-and-measured-chart-transversality-only',
        },
        preservation: { completeOriginalSources: true, completeOriginalModelsAndSiblings: true,
            selectedSurfaceBits: true, sourceQualifiedOriginalIdentities: true, originalDomainBits: true,
            bothOriginalUVsAndNativePoints: true, nativeAnalyticDerivatives: true, noDomainNormalization: true,
            noFiniteDifferences: true, noClampingOrToleranceRelaxation: true, noSourceOrCurveConstruction: true },
        quality: { sampledSeededLocalBranch: true, geometricValidity: 'not-certified', exactTrimCurve: false,
            pairedPcurve: false, allBranches: false, branchIdentityBetweenStations: false, wholeSpanErrorCertified: false,
            globalBinary64ErrorCertified: false, turningSupported: false, contactClassifier: false,
            topologyCertified: false, closed: false, body: false, solid: false,
            manufacturingToleranceCertified: false, publication: false, ownedRebuild: true,
            ownership: 'independent-copied-cpu-data-gc' },
        limits: { maximumStations: 17, maximumCorrectionsPerStation: 12, maximumTrialsPerCorrection: 8,
            maximumSurfacePointEvaluations: 3298, maximumSurfaceDerivativeAttempts: 442,
            maximumNativeEvaluationAttempts: 3740, maximumChartFactorizations: 221, maximumLinearSolves: 221,
            minimumSelectedDegree: 1, maximumSelectedDegree: 3, maximumSelectedAxisPoles: 8, maximumSelectedPoles: 64,
            coordinateAbsMM: 10000, minimumWeight: 0.001, maximumWeight: 1000, parameterAbs: 10000,
            minimumDomainWidth: 0.001, maximumDomainWidth: 10000, maximumModelObjects: 16, identityCharacters: 48,
            sourceUTF16: 262144, sourceUTF8: 262144,
            maximumRequestUTF16: 2097152, maximumRequestUTF8: 2097152,
            maximumResultUTF16: 4194304, maximumResultUTF8: 4194304,
            ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64, keyCharacters: 128,
            stringCharacters: 262144, authoredParserDepth: 12, authoredParserValues: 65536,
            authoredParserRecordFields: 16, authoredParserStringCharacters: 262144 },
        workScope: 'actual-direct-native-attempts-and-root-factor-solves-compiler-descendants-excluded',
        budgetFailure: 'atomic-no-partial-accepted-paired-surface-branch',
    };
    const result = { request, originalModels: originalModels, observations, report };
    let settled = false;
    for (let pass = 0; pass < 8; pass++) {
        const size = fileSize(state, result);
        if (same(size, report.fileSizes.result)) {
            settled = true;
            break;
        }
        report.fileSizes.result = size;
    }
    check(state, settled && same(fileSize(state, result), report.fileSizes.result), CODE.FILE, 'Complete result file-size metadata must settle within eight passes');
    return snapshot(state, result);
}
/** Rebuild the complete owned branch once from the original request and compare every retained bit. */
export function validatePairedSurfaceIntersectionBranch(value) {
    const state = context();
    state.phase = 'owned';
    try {
        const owned = record(state, snapshot(state, value, true), ['request', 'originalModels', 'observations', 'report'], CODE.OWNED);
        fileSize(state, owned);
        const expected = tracePairedSurfaceIntersectionBranch(owned.request);
        state.directCounts = { ...expected.report.directCounts };
        check(state, same(owned, expected), CODE.OWNED, 'Whole owned Sources, Models, UVs, native observations, histories, counts or report differ from reconstruction');
        return snapshot(state, expected.report, true);
    }
    catch (cause) {
        if (cause instanceof PairedSurfaceIntersectionBranchError && cause.code === CODE.OWNED)
            throw cause;
        const failed = cause instanceof PairedSurfaceIntersectionBranchError ? cause.context : state;
        throw new PairedSurfaceIntersectionBranchError(CODE.OWNED, 'Whole owned reconstruction refused', { ...failed, phase: 'owned' }, cause);
    }
}

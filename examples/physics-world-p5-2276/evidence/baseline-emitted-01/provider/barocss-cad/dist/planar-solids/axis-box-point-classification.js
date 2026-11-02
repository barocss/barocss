import { validateAxisBoxSolidBoolean } from '../axis-box-boolean.js';
import { same } from '../core/structural-equality.js';
import { KernelError } from '../core/barocss-error.js';
import { EXACT_OWN_FIELDS_REQUIRED, FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, OWN_RECORD_REQUIRED, SPARSE_OWN_ARRAY_FIELDS_REFUSED, hasExactOwnFields, isOwnRecord, ownSnapshot } from '../core/own-data.js';
export const AxisBoxSolidBooleanPointDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', BOOLEAN: 'BOOLEAN', BINDING: 'BINDING', OWNED: 'OWNED' });
export class AxisBoxSolidBooleanPointError extends KernelError {
    code;
    constructor(code, detail, cause) {
        super(('Axis-box Solid point classification: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
        this.name = 'AxisBoxSolidBooleanPointError';
        this.code = code;
    }
}
const CODE = AxisBoxSolidBooleanPointDiagnosticCode;
function check(condition, code, detail) { if (!condition)
    throw new AxisBoxSolidBooleanPointError(code, detail); }
function record(input, fields, code = CODE.INPUT) { check(isOwnRecord(input), code, OWN_RECORD_REQUIRED); check(hasExactOwnFields(input, fields), code, EXACT_OWN_FIELDS_REQUIRED); return input; }
function id(input) { check(typeof input === 'string' && input.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(input), CODE.IDENTITY, 'ASCII ID1..48 is required'); return input; }
const OWN = { input: CODE.INPUT, owned: CODE.OWNED, budget: CODE.BUDGET, fail: (code, detail) => { throw new AxisBoxSolidBooleanPointError(code, detail); }, wrap: (code, detail, cause) => { throw new AxisBoxSolidBooleanPointError(code, detail, cause); }, isRefusal: e => e instanceof AxisBoxSolidBooleanPointError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, sparse: SPARSE_OWN_ARRAY_FIELDS_REFUSED };
function snapshot(input, owned = false) { return ownSnapshot(input, owned, OWN); }
function contexts(input) { const values = new Set(); const visit = (value, key = '') => { if (typeof value === 'string') {
    if (key === 'id' || key === 'name' || /Ids?$/.test(key) || key === 'resultIdPrefix')
        values.add(value);
}
else if (Array.isArray(value))
    value.forEach(item => visit(item, key));
else if (value && typeof value === 'object')
    for (const [field, item] of Object.entries(value))
        visit(item, field); }; visit(input); return values; }
function axisPosition(axis, coordinate, planes) {
    const count = planes.length - 1;
    if (coordinate < planes[0])
        return { axis, position: 'below-grid', planeIndex: null, incidentIndices: [-1] };
    if (coordinate > planes[count])
        return { axis, position: 'above-grid', planeIndex: null, incidentIndices: [count] };
    const plane = planes.findIndex(value => coordinate === value);
    if (plane >= 0)
        return { axis, position: 'grid-plane', planeIndex: plane, incidentIndices: [plane - 1, plane] };
    const interval = planes.findIndex((value, index) => index < count && coordinate > value && coordinate < planes[index + 1]);
    check(interval >= 0, CODE.BINDING, 'Every finite represented coordinate must have one exact grid position');
    return { axis, position: 'open-interval', planeIndex: null, incidentIndices: [interval] };
}
/** Classify the exact represented original XYZ point against the saved regularized integer cell material. */
export function classifyAxisBoxSolidBooleanPoints(booleanInput, queriesInput, optionsInput) {
    const input = record(snapshot({ boolean: booleanInput, queries: queriesInput, options: optionsInput }), ['boolean', 'queries', 'options']), settings = record(input.options, ['evaluationId', 'maximumQueries']);
    const options = { evaluationId: id(settings.evaluationId), maximumQueries: settings.maximumQueries };
    check(typeof settings.maximumQueries === 'number' && Number.isInteger(settings.maximumQueries) && settings.maximumQueries >= 1 && settings.maximumQueries <= 8, CODE.BUDGET, 'An integer maximumQueries1..8 is required');
    check(Array.isArray(input.queries) && input.queries.length >= 1, CODE.INPUT, 'At least one original World point query is required');
    check(input.queries.length <= options.maximumQueries, CODE.BUDGET, 'All queries must fit the declared hard maximum before parent validation');
    const reserved = contexts(input.boolean);
    check(!reserved.has(options.evaluationId), CODE.IDENTITY, 'Evaluation ID collides with a parent/source/generated context');
    reserved.add(options.evaluationId);
    const queries = input.queries.map(value => {
        const data = record(value, ['queryId', 'pointMM']), queryId = id(data.queryId);
        check(!reserved.has(queryId), CODE.IDENTITY, 'Every query ID must be unique against all original/generated contexts and other queries');
        reserved.add(queryId);
        check(Array.isArray(data.pointMM) && data.pointMM.length === 3 && data.pointMM.every(value => typeof value === 'number' && Number.isFinite(value)), CODE.INPUT, 'A dense three-number finite original XYZ/mm point is required');
        return { queryId, pointMM: data.pointMM };
    });
    const boolean = input.boolean;
    try {
        validateAxisBoxSolidBoolean(boolean);
    }
    catch (cause) {
        throw new AxisBoxSolidBooleanPointError(CODE.BOOLEAN, 'Actual whole1101 Boolean owned validation refused', cause);
    }
    const exterior = boolean.report.emptyRegions.filter(region => region.exterior);
    check(exterior.length === 1, CODE.BINDING, 'The actual parent must retain exactly one exterior empty-region identity');
    const exteriorId = exterior[0].id;
    const grid = [boolean.grid.x, boolean.grid.y, boolean.grid.z], axisNames = ['x', 'y', 'z'], byCell = new Map(boolean.cells.map(cell => [cell.index.join(':'), cell]));
    const classifications = [], proofs = [];
    let incidentCellCheckCount = 0, boundaryPanelTestCount = 0;
    for (const query of queries) {
        const axes = axisNames.map((axis, index) => axisPosition(axis, query.pointMM[index], grid[index])), incidentCells = [];
        for (const i of axes[0].incidentIndices)
            for (const j of axes[1].incidentIndices)
                for (const k of axes[2].incidentIndices) {
                    const index = [i, j, k], outOfGrid = index.some((value, axis) => value < 0 || value >= grid[axis].length - 1), cell = outOfGrid ? undefined : byCell.get(index.join(':'));
                    check(outOfGrid || cell !== undefined, CODE.BINDING, 'Every in-grid incident cell must exist in the complete validated parent');
                    incidentCellCheckCount++;
                    if (outOfGrid)
                        incidentCells.push({ index, outOfGrid: true, occupied: false, bodyId: null, emptyRegionId: exteriorId });
                    else {
                        check(cell !== undefined && (cell.occupied ? cell.bodyId !== null && cell.emptyRegionId === null : cell.bodyId === null && cell.emptyRegionId !== null), CODE.BINDING, 'Actual incident cell material/void associations must be complete');
                        incidentCells.push({ index, outOfGrid: false, occupied: cell.occupied, bodyId: cell.bodyId, emptyRegionId: cell.emptyRegionId });
                    }
                }
        check(incidentCells.length >= 1 && incidentCells.length <= 8, CODE.BINDING, 'Every finite point requires1..8 exact incident cells');
        const occupiedCount = incidentCells.filter(cell => cell.occupied).length, emptyCount = incidentCells.length - occupiedCount, status = occupiedCount === 0 ? 'outside' : emptyCount === 0 ? 'inside' : 'boundary';
        const bodyIds = [...new Set(incidentCells.flatMap(cell => cell.bodyId === null ? [] : [cell.bodyId]))], emptyRegionIds = [...new Set(incidentCells.flatMap(cell => cell.emptyRegionId === null ? [] : [cell.emptyRegionId]))], boundaryPanels = [];
        for (const panel of boolean.panels) {
            boundaryPanelTestCount++;
            const onPlane = query.pointMM[panel.axis] === grid[panel.axis][panel.planeIndex];
            const inTile = onPlane && query.pointMM.every((value, axis) => { const indices = panel.gridCorners.map(corner => corner[axis]); return value >= grid[axis][Math.min(...indices)] && value <= grid[axis][Math.max(...indices)]; });
            if (!inTile)
                continue;
            const shells = boolean.shells.filter(shell => shell.panelIds.includes(panel.id)), source = boolean.sources.find(source => source.sourceId === panel.sourceId), surface = panel.bundle.geometry.objects[0];
            check(shells.length === 1 && shells[0].bodyId === panel.bodyId && shells[0].emptyRegionId === panel.emptyRegionId && source !== undefined && source.panelId === panel.id && surface.kind === 'surface' && same(source.model, panel.bundle.geometry), CODE.BINDING, 'Every matched panel must retain its actual source/local Surface/Body/Shell/void qualification');
            boundaryPanels.push({ panelId: panel.id, sourceId: panel.sourceId, bodyId: panel.bodyId, shellId: shells[0].id, emptyRegionId: panel.emptyRegionId, shellRole: shells[0].role, localFaceId: panel.bundle.topology.face.id, surfaceId: surface.id });
        }
        check((status === 'boundary') === (boundaryPanels.length > 0), CODE.BINDING, 'Mixed incident material must agree exactly with actual native boundary tile membership');
        check(status === 'outside' ? bodyIds.length === 0 : bodyIds.length === 1, CODE.BINDING, 'A valid parent manifold point can belong to only one occupied material Body');
        check(bodyIds.every(id => boolean.bodies.some(body => body.id === id)) && emptyRegionIds.every(id => boolean.report.emptyRegions.some(region => region.id === id)) && boundaryPanels.every(panel => bodyIds.includes(panel.bodyId) && emptyRegionIds.includes(panel.emptyRegionId)), CODE.BINDING, 'Classifications must preserve all actual incident Body and empty-region references');
        check(!boolean.report.empty || status === 'outside', CODE.BINDING, 'Every query of the empty regularized Boolean must be outside');
        classifications.push({ queryId: query.queryId, status, bodyIds, emptyRegionIds, boundaryPanels });
        proofs.push({ queryId: query.queryId, axes, incidentCells, occupiedCount, emptyCount, panelTestCount: boolean.panels.length, matchedPanelIds: boundaryPanels.map(panel => panel.panelId) });
    }
    check(incidentCellCheckCount <= 64 && boundaryPanelTestCount <= 576, CODE.BUDGET, 'Complete actual point predicates exceeded their fixed maximum');
    const counts = { inside: 0, outside: 0, boundary: 0 };
    classifications.forEach(classification => counts[classification.status]++);
    const proof = { queries: proofs }, report = {
        schema: 'barocss-axis-box-solid-boolean-point-classification', version: 0, evaluationId: options.evaluationId, parentEvaluationId: boolean.options.evaluationId, operandSourceIds: [boolean.a.sourceId, boolean.b.sourceId], lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion',
        authority: 'saved-restricted-integer-cell-coefficient-model-material', queryCount: queries.length, counts, bodyIds: boolean.bodies.map(body => body.id), emptyRegionIds: boolean.report.emptyRegions.map(region => region.id), exteriorEmptyRegionId: exteriorId,
        directCounts: { booleanValidationCount: 1, curvePointEvaluationCount: 0, curveDerivativeEvaluationCount: 0, surfacePointEvaluationCount: 0, surfaceDerivativeEvaluationCount: 0, sourceCompilationCount: 0, incidentCellCheckCount, boundaryPanelTestCount },
        numericPolicy: { ordering: 'exact-finite-represented-point-versus-safe-integer-plane', material: 'all-occupied-inside-none-occupied-outside-mixed-boundary', exterior: 'actual-parent-exterior-empty-region-sentinel', panelMembership: 'exact-plane-equality-and-closed-integer-tile-extents', internalPlanes: 'cancelled-occupied-grid-interfaces-remain-inside', inputBitsPreserved: true, coordinateArithmeticPerformed: false, toleranceUsed: false, nativeD0EqualityAuthority: false, rayUsed: false, snapPerformed: false },
        quality: { restrictedPointMaterialCertified: true, arbitraryCurvedSolidCertified: false, pointProjectionPerformed: false, manufacturingToleranceCertified: false, globalBinary64EvaluationErrorCertified: false, rendererPickingCertified: false, parentProofUnchanged: true, ownership: 'independent-copied-cpu-data-gc' },
        limits: { maximumQueries: 8, maximumIncidentCellsPerQuery: 8, maximumIncidentCellChecks: 64, maximumPanelsPerQuery: 72, maximumBoundaryPanelTests: 576, finiteXYZRequired: true, coordinateMagnitudeCap: 'none', ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64, stringCharacters: 262144 }, workScope: 'direct-parent-owned-validation-and-new-integer-grid-predicates-parent-internal-work-excluded', budgetFailure: 'atomic-no-partial-point-classification',
    };
    return snapshot({ boolean, queries, options, classifications, proof, report }, true);
}
/** Rebuild all parent ownership and exact material/panel predicates, then compare every retained bit. */
export function validateAxisBoxSolidBooleanPointClassification(input) {
    const owned = record(snapshot(input, true), ['boolean', 'queries', 'options', 'classifications', 'proof', 'report'], CODE.OWNED);
    let expected;
    try {
        expected = classifyAxisBoxSolidBooleanPoints(owned.boolean, owned.queries, owned.options);
    }
    catch (cause) {
        throw new AxisBoxSolidBooleanPointError(CODE.OWNED, 'Whole owned exact World point classification reconstruction failed', cause);
    }
    check(same(owned, expected), CODE.OWNED, 'Owned parent/query bits/classifications/incident proof/source-qualified references/counters changed');
    return snapshot(expected.report, true);
}

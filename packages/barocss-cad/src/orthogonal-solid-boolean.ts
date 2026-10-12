import { buildAxisBoxSolidBoolean } from './axis-box-boolean.js';
import type { AxisBoxSolidBooleanAsset, AxisBoxSolidBooleanOptions, AxisBoxSolidBooleanResult } from './axis-box-boolean.js';
import type { AxisBoxSolidValidationReport } from './box-solid.js';
import type { Model } from './types.js';
import { OrthogonalSolidBooleanError, OrthogonalSolidBooleanDiagnosticCode, admitAsset, check, id, planOrthogonalSolid, record, same, snapshot } from './orthogonal-solid-boolean-internal.js';
import type { Core, PlannedSolid } from './orthogonal-solid-boolean-internal.js';
export { OrthogonalSolidBooleanError, OrthogonalSolidBooleanDiagnosticCode } from './orthogonal-solid-boolean-internal.js';

export type OrthogonalSolidBooleanOperand = { kind: 'axis-box'; result: AxisBoxSolidBooleanResult } | { kind: 'orthogonal'; result: OrthogonalSolidBooleanResult };
export interface OrthogonalSolidBooleanOptions {
  operation: AxisBoxSolidBooleanOptions['operation']; evaluationId: string; resultIdPrefix: string;
  maximumCells: 343; maximumPanels: 384; maximumNativeObservations: 5760;
}
type WorkCounts = { originalSourceCompilationCount: number; operandSolidValidationCount: number; faceBuildCount: number; outputSourceCompilationCount: number; curvePointEvaluationCount: number; curveDerivativeEvaluationCount: number; surfacePointEvaluationCount: number; surfaceDerivativeEvaluationCount: number; observationCount: number };
export interface OrthogonalSolidBooleanReport {
  schema: 'barocss-orthogonal-solid-boolean'; version: 0; evaluationId: string; operation: OrthogonalSolidBooleanOptions['operation']; operationCount: number; originalBoxCount: number;
  geometryFamily: 'exact-integer-orthogonal-cell-solid-v0'; lengthUnit: 'mm'; empty: boolean; solid: boolean;
  cellCount: number; occupiedCellCount: number; vertexCount: number; edgeCount: number; panelCount: number; shellCount: number; bodyCount: number; sourceCount: number;
  volumeMM3: number; areaMM2: number; eulerCharacteristic: number; emptyRegions: PlannedSolid['emptyRegions'];
  incidence: AxisBoxSolidBooleanResult['report']['incidence'];
  nativeWork: { stages: ({ evaluationId: string } & WorkCounts)[]; totals: WorkCounts; scope: 'all-chain-reconstruction-attempts-opaque-provider-internals-excluded'; retries: 0 };
  numericPolicy: AxisBoxSolidBooleanResult['report']['numericPolicy']; quality: AxisBoxSolidBooleanResult['report']['quality'];
  limits: { operations: 3; originalBoxes: 4; planesPerAxis: 8; cells: 343; candidatePanels: 2058; panels: 384; vertices: 512; edges: 768; nativeObservationRecordsPerCall: 5760; ownValues: 4194304; ownDepth: 64; retainedDataChargeBytes: 33554432; arrayElements: 8192; recordFields: 64; sourceStringCharacters: 262144 };
  retainedDataPolicy: 'occurrence-counted-null-boolean1-number8-string-utf16x2-container16-record-key-utf16x2-not-v8-heap';
  budgetFailure: 'atomic-no-partial-orthogonal-solid-boolean';
}
export interface OrthogonalSolidBooleanResult extends Core {
  left: OrthogonalSolidBooleanOperand; right: AxisBoxSolidBooleanAsset; options: OrthogonalSolidBooleanOptions;
  rightModel: Model; rightReport: AxisBoxSolidValidationReport; report: OrthogonalSolidBooleanReport;
}
const CODE = OrthogonalSolidBooleanDiagnosticCode;
const RESULT_FIELDS = ['left', 'right', 'options', 'rightModel', 'rightReport', 'grid', 'cells', 'vertices', 'edges', 'panels', 'shells', 'bodies', 'sources', 'observations', 'report'];
function settings(input: unknown): OrthogonalSolidBooleanOptions {
  const value = record(input, ['operation', 'evaluationId', 'resultIdPrefix', 'maximumCells', 'maximumPanels', 'maximumNativeObservations']);
  check(value.operation === 'union' || value.operation === 'intersection' || value.operation === 'difference', CODE.INPUT, 'An explicit Boolean operation is required');
  check(value.maximumCells === 343 && value.maximumPanels === 384 && value.maximumNativeObservations === 5760, CODE.BUDGET, 'Exact fixed343-cell/384-panel/5760-native-observation budgets are required');
  id(value.evaluationId); id(value.resultIdPrefix, 8);
  return value as unknown as OrthogonalSolidBooleanOptions;
}
function work(evaluationId: string, panels: number, originals: number) {
  return { evaluationId, originalSourceCompilationCount: originals, operandSolidValidationCount: originals, faceBuildCount: panels, outputSourceCompilationCount: panels, curvePointEvaluationCount: 12 * panels, curveDerivativeEvaluationCount: 12 * panels, surfacePointEvaluationCount: 3 * panels, surfaceDerivativeEvaluationCount: 3 * panels, observationCount: 15 * panels };
}
function totals(stages: ReturnType<typeof work>[]): WorkCounts {
  const result = work('', 0, 0); const { evaluationId: _id, ...counts } = result; void _id;
  for (const stage of stages) for (const key of Object.keys(counts) as (keyof WorkCounts)[]) counts[key] += stage[key];
  return counts;
}
function guarded<T>(action: () => T): T {
  try { return action(); } catch (cause) { if (cause instanceof OrthogonalSolidBooleanError) throw cause; throw new OrthogonalSolidBooleanError(CODE.NATIVE, 'Complete construction/reconstruction refused', cause); }
}

/** One bounded snapshot and a complete native-work preflight precede single-chain reconstruction. */
export function buildOrthogonalSolidBoolean(leftInput: OrthogonalSolidBooleanOperand, rightInput: AxisBoxSolidBooleanAsset, optionsInput: OrthogonalSolidBooleanOptions): OrthogonalSolidBooleanResult {
  return guarded(() => {
    const input = record(snapshot({ left: leftInput, right: rightInput, options: optionsInput }), ['left', 'right', 'options']);
    const options = settings(input.options);
    type Stage = { right: AxisBoxSolidBooleanAsset; options: OrthogonalSolidBooleanOptions; supplied: OrthogonalSolidBooleanResult | null; leftContext: OrthogonalSolidBooleanOperand };
    const stages: Stage[] = [{ right: input.right as AxisBoxSolidBooleanAsset, options, supplied: null, leftContext: input.left as OrthogonalSolidBooleanOperand }];
    let cursor = input.left as OrthogonalSolidBooleanOperand;
    while (true) {
      const tagged = record(cursor, ['kind', 'result']);
      check(tagged.kind === 'axis-box' || tagged.kind === 'orthogonal', CODE.INPUT, 'Left must tag a complete axis-box or orthogonal result');
      if (tagged.kind === 'axis-box') break;
      check(stages.length < 2, CODE.BUDGET, 'At most3 total operations including the original two-box operation are admitted');
      const supplied = record(tagged.result, RESULT_FIELDS) as unknown as OrthogonalSolidBooleanResult;
      stages.unshift({ right: supplied.right, options: settings(supplied.options), supplied, leftContext: supplied.left }); cursor = supplied.left;
    }
    check(cursor.kind === 'axis-box', CODE.INPUT, 'Original axis-box result root is required');
    const base = record(cursor.result, ['a', 'b', 'options', 'originalModels', 'operandReports', 'grid', 'cells', 'vertices', 'edges', 'panels', 'shells', 'bodies', 'sources', 'observations', 'report']) as unknown as AxisBoxSolidBooleanResult;
    const baseSettings = record(base.options, ['operation', 'evaluationId', 'resultIdPrefix', 'maximumCells', 'maximumPanels']);
    check(baseSettings.maximumCells === 27 && baseSettings.maximumPanels === 72, CODE.BUDGET, 'Original two-box fixed budgets must be retained');
    const originals = [base.a, base.b], operations = [base.options.operation];
    // This planner derives counts from the original dimensions/expression, never cached report counts.
    const plans = [planOrthogonalSolid(originals, operations, base.options)];
    const ledger = [work(base.options.evaluationId, plans[0].plans.length, 2)];
    for (const stage of stages) {
      originals.push(stage.right); operations.push(stage.options.operation);
      plans.push(planOrthogonalSolid([...originals], [...operations], stage.options, plans.at(-1), stage.leftContext));
      ledger.push(work(stage.options.evaluationId, plans.at(-1)!.plans.length, 1));
    }
    check(totals(ledger).observationCount <= options.maximumNativeObservations, CODE.BUDGET, 'Complete recursive native observation attempts exceed5760 before any native call');
    // Exactly one old reconstruction. Never call the old validator and then build it again.
    const rebuiltBase = buildAxisBoxSolidBoolean(base.a, base.b, base.options);
    check(rebuiltBase.panels.length === plans[0].plans.length && same(base, rebuiltBase), CODE.OWNED, 'Whole original two-box result differs from native reconstruction');
    let left: OrthogonalSolidBooleanOperand = { kind: 'axis-box', result: rebuiltBase };
    let current: OrthogonalSolidBooleanResult | undefined;
    for (const [index, stage] of stages.entries()) {
      const nativeRight = admitAsset(stage.right), plan = plans[index + 1];
      plan.verifyModelContext(nativeRight.model);
      const core = plan.materialize();
      check(core.observations.length === ledger[index + 1].observationCount, CODE.BINDING, 'Native work must equal complete preflight');
      const { panels, vertices, edges, cells, shells, bodies, sources } = core, empty = panels.length === 0;
      const report: OrthogonalSolidBooleanReport = {
        schema: 'barocss-orthogonal-solid-boolean', version: 0, evaluationId: stage.options.evaluationId, operation: stage.options.operation, operationCount: index + 2, originalBoxCount: index + 3,
        geometryFamily: 'exact-integer-orthogonal-cell-solid-v0', lengthUnit: 'mm', empty, solid: !empty,
        cellCount: cells.length, occupiedCellCount: cells.filter(cell => cell.occupied).length, vertexCount: vertices.length, edgeCount: edges.length, panelCount: panels.length, shellCount: shells.length, bodyCount: bodies.length, sourceCount: sources.length,
        volumeMM3: plan.volumeMM3, areaMM2: plan.areaMM2, eulerCharacteristic: vertices.length - edges.length + panels.length, emptyRegions: plan.emptyRegions,
        incidence: { allBoundaryTilesAccounted: true, internalFacesCancelled: true, everyEdgeTwoOppositeUses: true, orientedVertexLinksSingleCycles: true, cornerCount: 4 * panels.length, edgeUseCount: 4 * panels.length, panelEdgeEquation: true },
        nativeWork: { stages: ledger.slice(0, index + 2), totals: totals(ledger.slice(0, index + 2)), scope: 'all-chain-reconstruction-attempts-opaque-provider-internals-excluded', retries: 0 },
        numericPolicy: rebuiltBase.report.numericPolicy, quality: { ...rebuiltBase.report.quality, restrictedCellModelEmbeddingCertified: !empty, restrictedBoundaryManifoldCertified: !empty },
        limits: { operations: 3, originalBoxes: 4, planesPerAxis: 8, cells: 343, candidatePanels: 2058, panels: 384, vertices: 512, edges: 768, nativeObservationRecordsPerCall: 5760, ownValues: 4194304, ownDepth: 64, retainedDataChargeBytes: 33554432, arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144 },
        retainedDataPolicy: 'occurrence-counted-null-boolean1-number8-string-utf16x2-container16-record-key-utf16x2-not-v8-heap', budgetFailure: 'atomic-no-partial-orthogonal-solid-boolean',
      };
      current = snapshot({ left, right: stage.right, options: stage.options, rightModel: nativeRight.model, rightReport: nativeRight.report, ...core, report }, true) as OrthogonalSolidBooleanResult;
      if (stage.supplied) check(same(stage.supplied, current), CODE.OWNED, 'Whole retained composed parent differs from native reconstruction');
      left = { kind: 'orthogonal', result: current };
    }
    return current!;
  });
}

/** Cold reconstruction includes all original and composed native stages exactly once. */
export function validateOrthogonalSolidBoolean(input: OrthogonalSolidBooleanResult): OrthogonalSolidBooleanReport {
  return guarded(() => {
    const owned = record(snapshot(input, true), RESULT_FIELDS) as unknown as OrthogonalSolidBooleanResult;
    const expected = buildOrthogonalSolidBoolean(owned.left, owned.right, owned.options);
    check(same(owned, expected), CODE.OWNED, 'Owned geometry, sources, occupancy, incidence, lineage or cumulative native work changed');
    return snapshot(expected.report, true) as OrthogonalSolidBooleanReport;
  });
}

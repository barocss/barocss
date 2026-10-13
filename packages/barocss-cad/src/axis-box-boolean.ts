import { compileCadModel } from './model-compiler.js';
import { validateAxisBoxSolid } from './box-solid.js';
import type { AxisBoxSolidValidationReport } from './box-solid.js';
import type { AxisBoxShell } from './box-shell.js';
import { buildParametricFace } from './face.js';
import type { FaceBundle } from './face.js';
import { curveDecimal } from './curve-source.js';
import { evaluateCurve, evaluateSurface } from './math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from './derivatives.js';
import type { CurveD1Result, SurfaceD1Result } from './derivatives.js';
import type { Curve, Surface, Model, Point } from './types.js';

export const AxisBoxSolidBooleanDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', SOURCE: 'SOURCE', BINDING: 'BINDING', CONTACT: 'CONTACT', TOPOLOGY: 'TOPOLOGY', NATIVE: 'NATIVE', OWNED: 'OWNED' } as const);
export type AxisBoxSolidBooleanDiagnosticCode = typeof AxisBoxSolidBooleanDiagnosticCode[keyof typeof AxisBoxSolidBooleanDiagnosticCode];
export class AxisBoxSolidBooleanError extends Error {
  readonly code: AxisBoxSolidBooleanDiagnosticCode;
  constructor(code: AxisBoxSolidBooleanDiagnosticCode, detail: string, cause?: unknown) {
    super(('Axis-box Solid Boolean: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'AxisBoxSolidBooleanError'; this.code = code;
  }
}
export interface AxisBoxSolidBooleanAsset { sourceId: string; sourceVersion: 0; source: string; shell: AxisBoxShell }
export interface AxisBoxSolidBooleanOptions { operation: 'union' | 'intersection' | 'difference'; evaluationId: string; resultIdPrefix: string; maximumCells: number; maximumPanels: number }
type Index3 = [number, number, number];
type Four<T> = [T, T, T, T];
type Fraction = { numerator: string; denominator: string };
type Cell = { index: Index3; insideA: boolean; insideB: boolean; occupied: boolean; bodyId: string | null; emptyRegionId: string | null; volumeMM3: number };
type Arc = { panelId: string; cornerIndex: number; previousEdgeId: string; nextEdgeId: string };
type Vertex = { id: string; gridIndex: Index3; pointMM: Point; link: { edgeIds: string[]; arcs: Arc[]; degrees: { edgeId: string; incoming: number; outgoing: number; degree: number }[]; cycleEdgeIds: string[]; cycleArcIndices: number[] } };
type Reference = { sourceId: string; faceId: string; localEdgeId: string; curveId: string };
type Use = Reference & { sense: 'forward' | 'reverse' };
type Edge = { id: string; vertexIds: [string, string]; canonical: Reference; uses: [Use, Use] };
type Lineage = { operand: 'a' | 'b'; sourceId: string; shellId: string; globalFaceId: string; localFaceId: string; surfaceId: string; relativeOrientation: 1 | -1; uvCorners: Four<[Fraction, Fraction]> };
type Panel = { id: string; axis: 0 | 1 | 2; sign: -1 | 1; planeIndex: number; cellIndex: Index3; emptyCellIndex: Index3 | null; bodyId: string; emptyRegionId: string; gridCorners: Four<Index3>; vertexIds: Four<string>; edgeIds: Four<string>; sourceId: string; areaMM2: number; bundle: FaceBundle; lineage: Lineage[] };
type Shell = { id: string; bodyId: string; emptyRegionId: string; role: 'outer' | 'cavity'; panelIds: string[]; edgeIds: string[]; vertexIds: string[]; eulerCharacteristic: number; signedVolumeMM3: number; areaMM2: number };
type Body = { id: string; cellIndices: Index3[]; shellIds: string[]; volumeMM3: number; areaMM2: number; boundsMM: { min: Point; max: Point }; closed: true; solid: true; embeddedIntegerCellModelCertified: true };
type Source = { sourceId: string; panelId: string; source: string; sourceVersion: 0; model: Model };
type SurfaceObservation = { kind: 'surface'; panelId: string; uv: [number, number]; d0: Point; d1: SurfaceD1Result; expectedPointMM: Point; expectedDu: Point; expectedDv: Point; pointGapMM: number; derivativeGapMM: number };
type CurveObservation = { kind: 'curve'; panelId: string; localEdgeId: string; curveId: string; parameter: number; d0: Point; d1: CurveD1Result; expectedPointMM: Point; expectedDerivative: Point; pointGapMM: number; derivativeGapMM: number };
type Observation = SurfaceObservation | CurveObservation;
type OperandBinding = { sourceId: string; shellId: string; faces: { globalFaceId: string; localFaceId: string; surfaceId: string }[] };
export interface AxisBoxSolidBooleanReport {
  schema: 'barocss-axis-box-solid-boolean'; version: 0; evaluationId: string; operation: AxisBoxSolidBooleanOptions['operation']; geometryFamily: 'exact-integer-orthogonal-cell-solid-v0'; lengthUnit: 'mm';
  empty: boolean; solid: boolean; cellCount: number; occupiedCellCount: number; vertexCount: number; edgeCount: number; panelCount: number; shellCount: number; bodyCount: number; sourceCount: number;
  volumeMM3: number; areaMM2: number; eulerCharacteristic: number; operandBindings: [OperandBinding, OperandBinding];
  emptyRegions: { id: string; exterior: boolean; cellIndices: Index3[] }[];
  incidence: { allBoundaryTilesAccounted: true; internalFacesCancelled: true; everyEdgeTwoOppositeUses: true; orientedVertexLinksSingleCycles: true; cornerCount: number; edgeUseCount: number; panelEdgeEquation: true };
  directCounts: { originalSourceCompilationCount: 2; operandSolidValidationCount: 2; faceBuildCount: number; outputSourceCompilationCount: number; curvePointEvaluationCount: number; curveDerivativeEvaluationCount: number; surfacePointEvaluationCount: number; surfaceDerivativeEvaluationCount: number; observationCount: number };
  numericPolicy: { material: 'regularized-closure-of-occupied-open-integer-cells'; generatedZero: 'canonical-positive-zero-original-bits-retained'; identity: 'exact-original-coordinate-plane-grid-indices-no-tolerance-welding'; source: 'whole-original-models-and-per-panel-native-model5'; lineageUV: 'exact-reduced-integer-ratio-fractions'; volume: 'occupied-cell-volume-equals-sum-of-oriented-shell-volumes'; euler: 'diagnostic-no-sphere-or-single-shell-requirement'; pointComparisonMM: 1e-9; relativeDerivativeComparison: 1e-9 };
  quality: { restrictedCellModelEmbeddingCertified: boolean; restrictedBoundaryManifoldCertified: boolean; regularizedMaterialCertified: true; arbitraryCurvedSolidCertified: false; globalBinary64EvaluationErrorCertified: false; manufacturingToleranceCertified: false; nativePanelFaceSubsetSolidFalse: true; weldingPerformed: false; ownership: 'independent-copied-cpu-data-gc' };
  limits: { maximumCells: 27; maximumCandidatePanels: 162; maximumPanels: 72; maximumGridVertices: 64; maximumGridSegments: 144; maximumObservations: 1080; maximumOriginalModelObjects: 16; outputModelObjects: 5; volumeMM3: 2000000000000; areaMM2: 1200000000; ownValues: 1048576; ownDepth: 64; arrayElements: 8192; recordFields: 64; sourceStringCharacters: 262144 };
  workScope: 'direct-root-calls-inherited-provider-work-excluded'; budgetFailure: 'atomic-no-partial-solid-boolean';
}
export interface AxisBoxSolidBooleanResult { a: AxisBoxSolidBooleanAsset; b: AxisBoxSolidBooleanAsset; options: AxisBoxSolidBooleanOptions; originalModels: [Model, Model]; operandReports: [AxisBoxSolidValidationReport, AxisBoxSolidValidationReport]; grid: { x: number[]; y: number[]; z: number[] }; cells: Cell[]; vertices: Vertex[]; edges: Edge[]; panels: Panel[]; shells: Shell[]; bodies: Body[]; sources: Source[]; observations: Observation[]; report: AxisBoxSolidBooleanReport }

const CODE = AxisBoxSolidBooleanDiagnosticCode, CORNERS = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]];
function check(condition: boolean, code: AxisBoxSolidBooleanDiagnosticCode, detail: string): asserts condition { if (!condition) throw new AxisBoxSolidBooleanError(code, detail); }
function child<T>(action: () => T, code: AxisBoxSolidBooleanDiagnosticCode, detail: string): T { try { return action(); } catch (cause) { throw new AxisBoxSolidBooleanError(code, detail, cause); } }
function record(input: unknown, fields: string[], code: AxisBoxSolidBooleanDiagnosticCode = CODE.INPUT): Record<string, unknown> { check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'An own record is required'); const data = input as Record<string, unknown>; check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own fields are required'); return data; }
function id(input: unknown, maximum = 48): string { check(typeof input === 'string' && input.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(input), CODE.IDENTITY, 'A bounded ASCII ID is required'); return input; }
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT; let remaining = 1048576; const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 64, owned ? CODE.OWNED : CODE.BUDGET, 'Own value/depth budget exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'Finite own numeric data is required'); return value; }
    if (typeof value === 'string') { check(value.length <= 262144, owned ? CODE.OWNED : CODE.BUDGET, 'Own string budget exceeded'); return value; }
    check(typeof value === 'object' && !ancestors.has(value), code, 'Acyclic own data is required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'Plain own data is required');
    check(keys.length <= (array ? 8193 : 64) && keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'Bounded own fields without getters/symbols/hidden data are required');
    ancestors.add(value); let result: unknown;
    if (array) { const length = descriptors.length.value as number; check(Number.isInteger(length) && length >= 0 && length <= 8192 && keys.length === length + 1, code, 'Dense bounded own arrays are required'); result = Array.from({ length }, (_, index) => { check(Object.hasOwn(descriptors, String(index)), code, 'Sparse/extra own array fields are refused'); return copy(descriptors[String(index)].value, depth + 1); }); }
    else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value); return result;
  }; try { return copy(input, 0); } catch (cause) { if (cause instanceof AxisBoxSolidBooleanError) throw cause; throw new AxisBoxSolidBooleanError(code, 'Own snapshot failed', cause); }
}
function same(a: unknown, b: unknown): boolean { if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => same(value, b[index])); if (a && b && typeof a === 'object' && typeof b === 'object') { const x = a as Record<string, unknown>, y = b as Record<string, unknown>; return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(key => Object.hasOwn(y, key) && same(x[key], y[key])); } return Object.is(a, b); }
function integer(value: number): number { check(Number.isSafeInteger(value), CODE.BINDING, 'Exact safe integer arithmetic is required'); return value === 0 ? 0 : value; }
function pointDifference(a: Point, b: Point): number { const value = Math.hypot(...a.map((x, index) => x - b[index])); check(Number.isFinite(value), CODE.BINDING, 'Finite native point/derivative residual is required'); return value; }
function qualifiedContexts(input: unknown): Set<string> { const values = new Set<string>(); const visit = (value: unknown, key = '') => { if (typeof value === 'string') { if (key === 'id' || key === 'name' || /Ids?$/.test(key) || key === 'resultIdPrefix') values.add(value); } else if (Array.isArray(value)) value.forEach(item => visit(item, key)); else if (value && typeof value === 'object') for (const [field, item] of Object.entries(value)) visit(item, field); }; visit(input); return values; }

function operand(input: unknown): { asset: AxisBoxSolidBooleanAsset; model: Model; report: AxisBoxSolidValidationReport; binding: OperandBinding } {
  const data = record(input, ['sourceId', 'sourceVersion', 'source', 'shell']); id(data.sourceId); check(data.sourceVersion === 0 && typeof data.source === 'string', CODE.INPUT, 'An original whole Source0 asset is required');
  const compiled = child(() => compileCadModel(data.source as string, { sourceVersion: 0 }), CODE.SOURCE, 'Actual original Source0 compiler failed');
  if (!compiled.ok) throw new AxisBoxSolidBooleanError(CODE.SOURCE, 'Actual original whole Source0 compilation refused', compiled);
  const shell = record(data.shell, ['version', 'id', 'origin', 'sides', 'faces', 'vertices', 'edges']);
  check(Array.isArray(shell.faces) && shell.faces.length === 6, CODE.INPUT, 'Six actual original Box Faces are required');
  const faces = shell.faces.map(value => {
    const face = record(value, ['id', 'bundle']), bundle = record(face.bundle, ['geometry', 'topology']), geometry = record(bundle.geometry, ['name', 'version', 'lengthUnit', 'objects']);
    check(Array.isArray(geometry.objects) && geometry.objects.length === 5, CODE.INPUT, 'Each original Face must retain its Model5');
    const support = record(geometry.objects[0], ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']);
    const authored = compiled.model.objects.find(object => object.id === support.id);
    check(authored?.kind === 'surface' && support.kind === 'surface' && same(authored, support), CODE.BINDING, 'Original source-qualified Support Surface whole bits disagree with the actual source');
    const topology = record(bundle.topology, ['version', 'face', 'vertices', 'edges', 'loop']), local = record(topology.face, ['id', 'surfaceId', 'outerLoopId', 'orientation']);
    check(typeof face.id === 'string' && typeof local.id === 'string' && typeof support.id === 'string', CODE.INPUT, 'Original global/local/Surface qualifications are required');
    return { globalFaceId: face.id, localFaceId: local.id, surfaceId: support.id };
  });
  const asset = data as unknown as AxisBoxSolidBooleanAsset;
  const report = child(() => validateAxisBoxSolid(asset.shell), CODE.NATIVE, 'Actual unchanged integer AxisBoxSolid validation refused');
  return { asset, model: compiled.model, report, binding: { sourceId: asset.sourceId, shellId: asset.shell.id, faces } };
}
function ratio(numerator: number, denominator: number): Fraction {
  integer(numerator); check(Number.isSafeInteger(denominator) && denominator !== 0, CODE.BINDING, 'An exact nonzero integer UV denominator is required');
  if (denominator < 0) { numerator = -numerator; denominator = -denominator; }
  let a = Math.abs(numerator), b = denominator; while (b) { const remainder = a % b; a = b; b = remainder; }
  return { numerator: String(integer(numerator / a)), denominator: String(integer(denominator / a)) };
}
function panelLineage(plan: { axis: 0 | 1 | 2; sign: -1 | 1; points: Four<Point> }, operands: [{ asset: AxisBoxSolidBooleanAsset; binding: OperandBinding }, { asset: AxisBoxSolidBooleanAsset; binding: OperandBinding }]): Lineage[] {
  const result: Lineage[] = [];
  for (const [index, original] of operands.entries()) for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
    if (Math.floor(faceIndex / 2) !== plan.axis) continue;
    const surface = original.asset.shell.faces[faceIndex].bundle.geometry.objects[0] as Surface, origin = surface.controlPoints[0][0], du = surface.controlPoints[1][0].map((value, axis) => value - origin[axis]), dv = surface.controlPoints[0][1].map((value, axis) => value - origin[axis]);
    if (plan.points.some(point => point[plan.axis] !== origin[plan.axis])) continue;
    const axisU = du.findIndex(value => value !== 0), axisV = dv.findIndex(value => value !== 0);
    check(axisU >= 0 && axisV >= 0 && axisU !== axisV, CODE.BINDING, 'Actual parent canonical Face chart must retain two distinct signed axes');
    const bounds = [axisU, axisV].map(axis => [Math.min(...surface.controlPoints.flat().map(point => point[axis])), Math.max(...surface.controlPoints.flat().map(point => point[axis]))]);
    if (!plan.points.every(point => point[axisU] >= bounds[0][0] && point[axisU] <= bounds[0][1] && point[axisV] >= bounds[1][0] && point[axisV] <= bounds[1][1])) continue;
    const qualification = original.binding.faces[faceIndex];
    result.push({ operand: index === 0 ? 'a' : 'b', sourceId: original.asset.sourceId, shellId: original.asset.shell.id, ...qualification, relativeOrientation: plan.sign === (faceIndex % 2 ? 1 : -1) ? 1 : -1,
      uvCorners: plan.points.map(point => [ratio(point[axisU] - origin[axisU], du[axisU]), ratio(point[axisV] - origin[axisV], dv[axisV])]) as Four<[Fraction, Fraction]> });
  }
  check(result.length > 0, CODE.BINDING, 'Every complete output tile must have actual original min/max Support Face lineage'); return result;
}
function emitSource(bundle: FaceBundle, sourceId: string, panelId: string): Source {
  const decimal = (value: number) => curveDecimal(value, 'Axis-box Solid Boolean'), list = (values: number[]) => '[' + values.map(decimal).join(',') + ']', points = (values: Point[]) => '[' + values.map(list).join(',') + ']';
  const declarations = bundle.geometry.objects.map(object => object.kind === 'curve' ? '@curve #' + object.id + ' { type:nurbs; degree:' + decimal(object.degree) + '; knots:' + list(object.knots) + '; control-points:' + points(object.controlPoints) + '; weights:' + list(object.weights) + '; }'
    : '@surface #' + object.id + ' { type:nurbs; degree-u:' + decimal(object.degreeU) + '; degree-v:' + decimal(object.degreeV) + '; knots-u:' + list(object.knotsU) + '; knots-v:' + list(object.knotsV) + '; control-points:[' + object.controlPoints.map(points).join(',') + ']; weights:[' + object.weights.map(list).join(',') + ']; }');
  const source = '@model ' + bundle.geometry.name + ' { version:0; length-unit:mm; ' + declarations.join(' ') + ' }\n';
  check(source.length <= 262144, CODE.BUDGET, 'ASCII output source exceeds the compiler byte/code-unit limit');
  const compiled = child(() => compileCadModel(source, { sourceVersion: 0 }), CODE.NATIVE, 'Actual panel Model5 Source0 compiler failed');
  if (!compiled.ok) throw new AxisBoxSolidBooleanError(CODE.NATIVE, 'Actual panel Source0 compilation refused', compiled);
  check(same(compiled.model, bundle.geometry), CODE.BINDING, 'Actual panel source/model must retain every native child coefficient/order/name/ID bit');
  return { sourceId, panelId, source, sourceVersion: 0, model: compiled.model };
}

/** Regularized exact integer-cell Boolean; complete manifold planning precedes output native construction. */
export function buildAxisBoxSolidBoolean(aInput: AxisBoxSolidBooleanAsset, bInput: AxisBoxSolidBooleanAsset, optionsInput: AxisBoxSolidBooleanOptions): AxisBoxSolidBooleanResult {
  const input = record(snapshot({ a: aInput, b: bInput, options: optionsInput }), ['a', 'b', 'options']), settings = record(input.options, ['operation', 'evaluationId', 'resultIdPrefix', 'maximumCells', 'maximumPanels']);
  check(settings.operation === 'union' || settings.operation === 'intersection' || settings.operation === 'difference', CODE.INPUT, 'An explicit union/intersection/difference operation is required');
  const options: AxisBoxSolidBooleanOptions = { operation: settings.operation, evaluationId: id(settings.evaluationId), resultIdPrefix: id(settings.resultIdPrefix, 8), maximumCells: settings.maximumCells as number, maximumPanels: settings.maximumPanels as number };
  check(settings.maximumCells === 27 && settings.maximumPanels === 72, CODE.BUDGET, 'Exact complete fixed cell27/panel72 budgets are required before child calls');
  const aData = record(input.a, ['sourceId', 'sourceVersion', 'source', 'shell']), bData = record(input.b, ['sourceId', 'sourceVersion', 'source', 'shell']); id(aData.sourceId); id(bData.sourceId); check(aData.sourceId !== bData.sourceId, CODE.IDENTITY, 'Original source identities must differ');
  const left = operand(aData), right = operand(bData), a = left.asset, b = right.asset, operands: [typeof left, typeof right] = [left, right], originalModels: [Model, Model] = [left.model, right.model], operandReports: [AxisBoxSolidValidationReport, AxisBoxSolidValidationReport] = [left.report, right.report];
  const overlap = [0, 1, 2].map(axis => integer(Math.min(left.report.boundsMM.max[axis], right.report.boundsMM.max[axis]) - Math.max(left.report.boundsMM.min[axis], right.report.boundsMM.min[axis])));
  check(options.operation !== 'union' || overlap.some(length => length < 0) || overlap.filter(length => length === 0).length < 2,
    CODE.CONTACT, 'Union of edge/corner-only touching Box interiors is unsupported because its boundary is nonmanifold');
  const axes = [0, 1, 2].map(axis => [...new Set(operands.flatMap(operand => [integer(operand.report.boundsMM.min[axis]), integer(operand.report.boundsMM.max[axis])]))].sort((a, b) => a - b));
  const grid = { x: axes[0], y: axes[1], z: axes[2] }, shape = axes.map(values => values.length - 1), key = (index: Index3) => index.join(':'), coordinate = (index: Index3): Point => index.map((value, axis) => axes[axis][value]) as Point;
  const contexts = qualifiedContexts({ a, b, originalModels }); check(!contexts.has(options.evaluationId), CODE.IDENTITY, 'Evaluation ID collides with an original source/model/shell context'); contexts.add(options.evaluationId);
  const reserve = (suffix: string) => { const value = id(options.resultIdPrefix + suffix); check(!contexts.has(value), CODE.IDENTITY, 'Complete generated identities must be unique against all original and generated contexts'); contexts.add(value); return value; };
  const cells: Cell[] = [], byCell = new Map<string, Cell>();
  for (let i = 0; i < shape[0]; i++) for (let j = 0; j < shape[1]; j++) for (let k = 0; k < shape[2]; k++) {
    const index: Index3 = [i, j, k], inside = (operand: typeof left) => index.every((value, axis) => axes[axis][value] >= operand.report.boundsMM.min[axis] && axes[axis][value + 1] <= operand.report.boundsMM.max[axis]), insideA = inside(left), insideB = inside(right);
    const occupied = options.operation === 'union' ? insideA || insideB : options.operation === 'intersection' ? insideA && insideB : insideA && !insideB;
    const volumeMM3 = integer(index.reduce((volume, value, axis) => integer(volume * integer(axes[axis][value + 1] - axes[axis][value])), 1));
    const cell: Cell = { index, insideA, insideB, occupied, bodyId: null, emptyRegionId: null, volumeMM3 }; cells.push(cell); byCell.set(key(index), cell);
  }
  check(cells.length <= 27 && axes.every(values => values.length >= 2 && values.length <= 4), CODE.BUDGET, 'The original coordinate planes must fit the complete27-cell grid');
  const neighbor = (index: Index3, axis: number, direction: number): Cell | undefined => { const target = [...index] as Index3; target[axis] += direction; return byCell.get(key(target)); };
  const bodyGroups: { id: string; cells: Cell[] }[] = [], emptyGroups: AxisBoxSolidBooleanReport['emptyRegions'] = [], exteriorId = reserve('_void0');
  const flood = (seeds: Cell[], occupied: boolean, assign: (cell: Cell) => void, seen: Set<string>) => { const queue: Cell[] = []; for (const seed of seeds) if (!seen.has(key(seed.index))) { seen.add(key(seed.index)); queue.push(seed); }
    for (let cursor = 0; cursor < queue.length; cursor++) { const cell = queue[cursor]; assign(cell); for (let axis = 0; axis < 3; axis++) for (const direction of [-1, 1]) { const next = neighbor(cell.index, axis, direction); if (next && next.occupied === occupied && !seen.has(key(next.index))) { seen.add(key(next.index)); queue.push(next); } } } return queue; };
  const occupiedSeen = new Set<string>();
  for (const cell of cells) if (cell.occupied && !occupiedSeen.has(key(cell.index))) { const id = reserve('_body' + bodyGroups.length), members = flood([cell], true, cell => { cell.bodyId = id; }, occupiedSeen); bodyGroups.push({ id, cells: members }); }
  const emptySeen = new Set<string>(), exteriorSeeds = cells.filter(cell => !cell.occupied && cell.index.some((value, axis) => value === 0 || value === shape[axis] - 1));
  const exteriorCells = flood(exteriorSeeds, false, cell => { cell.emptyRegionId = exteriorId; }, emptySeen); emptyGroups.push({ id: exteriorId, exterior: true, cellIndices: exteriorCells.map(cell => cell.index) });
  for (const cell of cells) if (!cell.occupied && !emptySeen.has(key(cell.index))) { const id = reserve('_void' + emptyGroups.length), members = flood([cell], false, cell => { cell.emptyRegionId = id; }, emptySeen); emptyGroups.push({ id, exterior: false, cellIndices: members.map(cell => cell.index) }); }
  type Plan = Omit<Panel, 'bundle' | 'lineage'> & { points: Four<Point> };
  const plans: Plan[] = [], vertexInventory = new Map<string, { id: string; gridIndex: Index3; pointMM: Point }>(), edgeInventory = new Map<string, { id: string; vertexIds: [string, string]; uses: Use[] }>();
  const localIds: { surfaceId: string; loopId: string; vertexIds: Four<string>; edgeIds: Four<string>; curveIds: Four<string> }[] = [];
  const vertexAt = (index: Index3) => { const k = key(index); if (!vertexInventory.has(k)) vertexInventory.set(k, { id: reserve('_v' + vertexInventory.size), gridIndex: index, pointMM: coordinate(index) }); return vertexInventory.get(k)!; };
  for (const cell of cells) if (cell.occupied) for (let face = 0; face < 6; face++) {
    const axis = Math.floor(face / 2) as 0 | 1 | 2, sign: -1 | 1 = face % 2 ? 1 : -1, adjacent = neighbor(cell.index, axis, sign); if (adjacent?.occupied) continue;
    check(plans.length < 162, CODE.BUDGET, 'Pre-manifold candidate panel capacity exceeded'); const index = plans.length, panelId = reserve('_p' + index), sourceId = reserve('_s' + index);
    const corners = CORNERS[face].map(bits => cell.index.map((value, axis) => value + (bits >> axis & 1)) as Index3) as Four<Index3>, points = corners.map(coordinate) as Four<Point>, vertices = corners.map(vertexAt);
    const ids = { surfaceId: reserve('_sf' + index), loopId: reserve('_l' + index), vertexIds: [0, 1, 2, 3].map(i => reserve('_pv' + index + '_' + i)) as Four<string>, edgeIds: [0, 1, 2, 3].map(i => reserve('_pe' + index + '_' + i)) as Four<string>, curveIds: [0, 1, 2, 3].map(i => reserve('_pc' + index + '_' + i)) as Four<string> }; localIds.push(ids);
    const edgeIds = vertices.map((start, corner) => {
      const end = vertices[(corner + 1) % 4], first = key(start.gridIndex), second = key(end.gridIndex), forward = first < second, segmentKey = forward ? first + '/' + second : second + '/' + first;
      if (!edgeInventory.has(segmentKey)) edgeInventory.set(segmentKey, { id: reserve('_e' + edgeInventory.size), vertexIds: forward ? [start.id, end.id] : [end.id, start.id], uses: [] });
      const edge = edgeInventory.get(segmentKey)!; edge.uses.push({ sourceId, faceId: panelId, localEdgeId: ids.edgeIds[corner], curveId: ids.curveIds[corner], sense: forward ? 'forward' : 'reverse' }); return edge.id;
    }) as Four<string>;
    const areaMM2 = integer(points[1].reduce((length, value, axis) => length + Math.abs(value - points[0][axis]), 0) * points[3].reduce((length, value, axis) => length + Math.abs(value - points[0][axis]), 0));
    plans.push({ id: panelId, axis, sign, planeIndex: cell.index[axis] + (sign > 0 ? 1 : 0), cellIndex: cell.index, emptyCellIndex: adjacent ? adjacent.index : null, bodyId: cell.bodyId!, emptyRegionId: adjacent ? adjacent.emptyRegionId! : exteriorId, gridCorners: corners, points, vertexIds: vertices.map(vertex => vertex.id) as Four<string>, edgeIds, sourceId, areaMM2 });
  }
  const edges: Edge[] = [...edgeInventory.values()].map(edge => { const forward = edge.uses.filter(use => use.sense === 'forward'), reverse = edge.uses.filter(use => use.sense === 'reverse');
    check(edge.uses.length === 2 && forward.length === 1 && reverse.length === 1 && forward[0].faceId !== reverse[0].faceId, CODE.TOPOLOGY, 'Every exact boundary grid segment must have two distinct opposed panel uses; edge pinches are refused');
    const { sourceId, faceId, localEdgeId, curveId } = forward[0]; return { id: edge.id, vertexIds: edge.vertexIds, canonical: { sourceId, faceId, localEdgeId, curveId }, uses: [forward[0], reverse[0]] }; });
  check(edges.length <= 144 && vertexInventory.size <= 64 && 4 * plans.length === 2 * edges.length && plans.length <= 72, CODE.TOPOLOGY, 'Complete manifold panel-edge equation and grid capacities are required before native construction');
  const vertices: Vertex[] = [...vertexInventory.values()].map(vertex => {
    const edgeIds = edges.filter(edge => edge.vertexIds.includes(vertex.id)).map(edge => edge.id), arcs = plans.flatMap(plan => plan.vertexIds.flatMap((id, cornerIndex): Arc[] => id === vertex.id ? [{ panelId: plan.id, cornerIndex, previousEdgeId: plan.edgeIds[(cornerIndex + 3) % 4], nextEdgeId: plan.edgeIds[cornerIndex] }] : []));
    check(edgeIds.length >= 2 && arcs.every(arc => arc.previousEdgeId !== arc.nextEdgeId), CODE.TOPOLOGY, 'Every boundary vertex requires nondegenerate panel-corner link arcs');
    const degrees = edgeIds.map(edgeId => { const incoming = arcs.filter(arc => arc.nextEdgeId === edgeId).length, outgoing = arcs.filter(arc => arc.previousEdgeId === edgeId).length; check(incoming === 1 && outgoing === 1, CODE.TOPOLOGY, 'Every vertex-link node requires one incoming/one outgoing arc counting multiplicity'); return { edgeId, incoming, outgoing, degree: incoming + outgoing }; });
    const cycleEdgeIds: string[] = [], cycleArcIndices: number[] = [], seen = new Set<string>(); let current = edgeIds[0];
    for (let i = 0; i < edgeIds.length; i++) { check(!seen.has(current), CODE.TOPOLOGY, 'Boundary vertex has a pinched/disconnected link cycle'); seen.add(current); cycleEdgeIds.push(current); const arc = arcs.findIndex(value => value.previousEdgeId === current); check(arc >= 0, CODE.TOPOLOGY, 'Complete directed vertex-link continuation is required'); cycleArcIndices.push(arc); current = arcs[arc].nextEdgeId; }
    check(current === edgeIds[0] && seen.size === edgeIds.length && new Set(cycleArcIndices).size === arcs.length, CODE.TOPOLOGY, 'All vertex-link nodes and corners must form one connected oriented cycle'); return { ...vertex, link: { edgeIds, arcs, degrees, cycleEdgeIds, cycleArcIndices } };
  });
  check(vertices.reduce((count, vertex) => count + vertex.link.arcs.length, 0) === 4 * plans.length, CODE.TOPOLOGY, 'Every planned panel corner must occur in exactly one accounted vertex link');
  const byPanel = new Map(plans.map(plan => [plan.id, plan])), shellSeen = new Set<string>(), shells: Shell[] = [];
  for (const initial of plans) if (!shellSeen.has(initial.id)) {
    const queue = [initial]; shellSeen.add(initial.id);
    for (let cursor = 0; cursor < queue.length; cursor++) for (const edgeId of queue[cursor].edgeIds) {
      const edge = edges.find(edge => edge.id === edgeId)!;
      for (const use of edge.uses) if (!shellSeen.has(use.faceId)) { const next = byPanel.get(use.faceId); check(next !== undefined, CODE.TOPOLOGY, 'Every global use must retain one complete planned panel'); shellSeen.add(next.id); queue.push(next); }
    }
    const bodyIds = new Set(queue.map(plan => plan.bodyId)), emptyIds = new Set(queue.map(plan => plan.emptyRegionId));
    check(bodyIds.size === 1 && emptyIds.size === 1, CODE.TOPOLOGY, 'A connected boundary Shell must separate one material component from one empty component');
    const bodyId = queue[0].bodyId, emptyRegionId = queue[0].emptyRegionId, exterior = emptyGroups.find(region => region.id === emptyRegionId)?.exterior;
    check(exterior !== undefined, CODE.TOPOLOGY, 'Actual empty-component association is required');
    const signedNumerator = queue.reduce((sum, plan) => integer(sum + integer(plan.sign * axes[plan.axis][plan.planeIndex] * plan.areaMM2)), 0);
    check(signedNumerator % 3 === 0, CODE.TOPOLOGY, 'Oriented integer Shell volume must divide exactly by3'); const signedVolumeMM3 = integer(signedNumerator / 3);
    check(exterior ? signedVolumeMM3 > 0 : signedVolumeMM3 < 0, CODE.TOPOLOGY, 'Outer Shell volume must be positive and bounded cavity Shell volume negative');
    const edgeIds = [...new Set(queue.flatMap(plan => plan.edgeIds))], vertexIds = [...new Set(queue.flatMap(plan => plan.vertexIds))];
    shells.push({ id: reserve('_sh' + shells.length), bodyId, emptyRegionId, role: exterior ? 'outer' : 'cavity', panelIds: queue.map(plan => plan.id), edgeIds, vertexIds, eulerCharacteristic: vertexIds.length - edgeIds.length + queue.length, signedVolumeMM3,
      areaMM2: queue.reduce((sum, plan) => integer(sum + plan.areaMM2), 0) });
  }
  const bodies: Body[] = bodyGroups.map(group => {
    const associated = shells.filter(shell => shell.bodyId === group.id), volumeMM3 = group.cells.reduce((sum, cell) => integer(sum + cell.volumeMM3), 0);
    check(associated.length >= 1 && associated.filter(shell => shell.role === 'outer').length === 1 && associated.reduce((sum, shell) => integer(sum + shell.signedVolumeMM3), 0) === volumeMM3, CODE.TOPOLOGY, 'Each material Body must have one outer Shell and exact total signed Shell volume equal to its occupied-cell volume');
    const min = [0, 1, 2].map(axis => Math.min(...group.cells.map(cell => axes[axis][cell.index[axis]]))) as Point, max = [0, 1, 2].map(axis => Math.max(...group.cells.map(cell => axes[axis][cell.index[axis] + 1]))) as Point;
    return { id: group.id, cellIndices: group.cells.map(cell => cell.index), shellIds: associated.map(shell => shell.id), volumeMM3, areaMM2: associated.reduce((sum, shell) => integer(sum + shell.areaMM2), 0), boundsMM: { min, max }, closed: true, solid: true, embeddedIntegerCellModelCertified: true };
  });
  const volumeMM3 = bodies.reduce((sum, body) => integer(sum + body.volumeMM3), 0), areaMM2 = plans.reduce((sum, plan) => integer(sum + plan.areaMM2), 0);
  check(volumeMM3 >= 0 && volumeMM3 <= 2e12 && areaMM2 >= 0 && areaMM2 <= 1.2e9 && volumeMM3 === cells.filter(cell => cell.occupied).reduce((sum, cell) => integer(sum + cell.volumeMM3), 0)
    && areaMM2 === bodies.reduce((sum, body) => integer(sum + body.areaMM2), 0), CODE.BINDING, 'Whole exact occupied volume and emitted area must fit their complete limits and Body accounting');
  const lineages = plans.map(plan => panelLineage(plan, operands));
  // All occupancy, IDs, manifold links, Shell/body volumes and source lineage
  // are now complete. Only this phase invokes output native providers.
  const panels: Panel[] = [], sources: Source[] = [], observations: Observation[] = [];
  for (const [index, plan] of plans.entries()) {
    const ids = localIds[index], surface: Surface = { kind: 'surface', id: ids.surfaceId, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[plan.points[0], plan.points[3]], [plan.points[1], plan.points[2]]], weights: [[1, 1], [1, 1]] };
    const bundle = child(() => buildParametricFace(surface, { faceId: plan.id, loopId: ids.loopId, vertexIds: ids.vertexIds, edgeIds: ids.edgeIds, curveIds: ids.curveIds }), CODE.NATIVE, 'Actual native parametric panel Face construction failed');
    check(same(bundle.geometry.objects[0], surface) && bundle.topology.face.id === plan.id && bundle.topology.face.orientation === 'forward', CODE.BINDING, 'Actual native panel Support and outward local orientation must retain planned bits');
    for (let corner = 0; corner < 4; corner++) {
      const local = bundle.topology.edges[corner], curve = bundle.geometry.objects[corner + 1] as Curve, start = plan.points[corner], end = plan.points[(corner + 1) % 4];
      check(same(curve, { kind: 'curve', id: ids.curveIds[corner], degree: 1, knots: [0, 0, 1, 1], controlPoints: [start, end], weights: [1, 1] }) && same(bundle.topology.vertices[corner].point, start)
        && local.id === ids.edgeIds[corner] && local.curveId === curve.id && same(local.vertexIds, [ids.vertexIds[corner], ids.vertexIds[(corner + 1) % 4]]), CODE.BINDING, 'Every actual native panel boundary must equal its exact planned directed grid segment');
      const global = edges.find(edge => edge.id === plan.edgeIds[corner])!, use = global.uses.find(use => use.sourceId === plan.sourceId && use.faceId === plan.id);
      check(use !== undefined && use.localEdgeId === local.id && use.curveId === curve.id && same(use.sense === 'forward' ? global.vertexIds : [global.vertexIds[1], global.vertexIds[0]], [plan.vertexIds[corner], plan.vertexIds[(corner + 1) % 4]]), CODE.BINDING, 'Actual local Curve must bind the two opposed qualified global edge uses without welding');
    }
    const metadata = Object.fromEntries(Object.entries(plan).filter(([name]) => name !== 'points')); panels.push({ ...metadata, bundle, lineage: lineages[index] }); sources.push(emitSource(bundle, plan.sourceId, plan.id));
    const du = plan.points[1].map((value, axis) => integer(value - plan.points[0][axis])) as Point, dv = plan.points[3].map((value, axis) => integer(value - plan.points[0][axis])) as Point;
    const normal: Point = [integer(du[1] * dv[2] - du[2] * dv[1]), integer(du[2] * dv[0] - du[0] * dv[2]), integer(du[0] * dv[1] - du[1] * dv[0])];
    check(normal[plan.axis] === plan.sign * plan.areaMM2 && normal.every((value, axis) => axis === plan.axis || value === 0), CODE.BINDING, 'Planned exact rectangle cross product must point from material toward its empty neighbor');
    for (const t of [0, .5, 1]) {
      const values = child(() => ({ d0: evaluateSurface(surface, t, t), d1: evaluateSurfaceD1(surface, t, t) }), CODE.NATIVE, 'Actual native panel Surface observation failed'), expectedPointMM = plan.points[0].map((value, axis) => value + t * du[axis] + t * dv[axis]) as Point;
      const pointGapMM = Math.max(pointDifference(values.d0, expectedPointMM), pointDifference(values.d1.point, expectedPointMM)), derivativeGapMM = Math.max(pointDifference(values.d1.du, du), pointDifference(values.d1.dv, dv));
      check(pointGapMM <= 1e-9 && derivativeGapMM <= 1e-9 * Math.max(1, Math.hypot(...du), Math.hypot(...dv)), CODE.BINDING, 'Actual panel point/partials differ from the exact rectangle model');
      observations.push({ kind: 'surface', panelId: plan.id, uv: [t, t], ...values, expectedPointMM, expectedDu: du, expectedDv: dv, pointGapMM, derivativeGapMM });
    }
    for (let corner = 0; corner < 4; corner++) for (const parameter of [0, .5, 1]) {
      const curve = bundle.geometry.objects[corner + 1] as Curve, start = plan.points[corner], expectedDerivative = plan.points[(corner + 1) % 4].map((value, axis) => integer(value - start[axis])) as Point;
      const values = child(() => ({ d0: evaluateCurve(curve, parameter), d1: evaluateCurveD1(curve, parameter) }), CODE.NATIVE, 'Actual native panel Curve observation failed'), expectedPointMM = start.map((value, axis) => value + parameter * expectedDerivative[axis]) as Point;
      const pointGapMM = Math.max(pointDifference(values.d0, expectedPointMM), pointDifference(values.d1.point, expectedPointMM)), derivativeGapMM = pointDifference(values.d1.derivative, expectedDerivative);
      check(pointGapMM <= 1e-9 && derivativeGapMM <= 1e-9 * Math.max(1, Math.hypot(...expectedDerivative)), CODE.BINDING, 'Actual panel boundary point/derivative differs from its exact grid segment');
      observations.push({ kind: 'curve', panelId: plan.id, localEdgeId: ids.edgeIds[corner], curveId: curve.id, parameter, ...values, expectedPointMM, expectedDerivative, pointGapMM, derivativeGapMM });
    }
  }
  check(panels.length === plans.length && sources.length === plans.length && observations.length === 15 * plans.length && observations.length <= 1080, CODE.BINDING, 'Complete actual native panel/source/observation work must match its preflight');
  const empty = plans.length === 0; check(empty ? vertices.length === 0 && edges.length === 0 && shells.length === 0 && bodies.length === 0 && volumeMM3 === 0 && areaMM2 === 0 : bodies.length > 0 && volumeMM3 > 0, CODE.TOPOLOGY, 'Empty/nonempty regularized result semantics must be explicit');
  const report: AxisBoxSolidBooleanReport = {
    schema: 'barocss-axis-box-solid-boolean', version: 0, evaluationId: options.evaluationId, operation: options.operation, geometryFamily: 'exact-integer-orthogonal-cell-solid-v0', lengthUnit: 'mm', empty, solid: !empty, cellCount: cells.length, occupiedCellCount: cells.filter(cell => cell.occupied).length,
    vertexCount: vertices.length, edgeCount: edges.length, panelCount: panels.length, shellCount: shells.length, bodyCount: bodies.length, sourceCount: sources.length, volumeMM3, areaMM2, eulerCharacteristic: vertices.length - edges.length + panels.length, operandBindings: [left.binding, right.binding], emptyRegions: emptyGroups,
    incidence: { allBoundaryTilesAccounted: true, internalFacesCancelled: true, everyEdgeTwoOppositeUses: true, orientedVertexLinksSingleCycles: true, cornerCount: 4 * panels.length, edgeUseCount: 4 * panels.length, panelEdgeEquation: true },
    directCounts: { originalSourceCompilationCount: 2, operandSolidValidationCount: 2, faceBuildCount: panels.length, outputSourceCompilationCount: sources.length, curvePointEvaluationCount: 12 * panels.length, curveDerivativeEvaluationCount: 12 * panels.length, surfacePointEvaluationCount: 3 * panels.length, surfaceDerivativeEvaluationCount: 3 * panels.length, observationCount: observations.length },
    numericPolicy: { material: 'regularized-closure-of-occupied-open-integer-cells', generatedZero: 'canonical-positive-zero-original-bits-retained', identity: 'exact-original-coordinate-plane-grid-indices-no-tolerance-welding', source: 'whole-original-models-and-per-panel-native-model5', lineageUV: 'exact-reduced-integer-ratio-fractions', volume: 'occupied-cell-volume-equals-sum-of-oriented-shell-volumes', euler: 'diagnostic-no-sphere-or-single-shell-requirement', pointComparisonMM: 1e-9, relativeDerivativeComparison: 1e-9 },
    quality: { restrictedCellModelEmbeddingCertified: !empty, restrictedBoundaryManifoldCertified: !empty, regularizedMaterialCertified: true, arbitraryCurvedSolidCertified: false, globalBinary64EvaluationErrorCertified: false, manufacturingToleranceCertified: false, nativePanelFaceSubsetSolidFalse: true, weldingPerformed: false, ownership: 'independent-copied-cpu-data-gc' },
    limits: { maximumCells: 27, maximumCandidatePanels: 162, maximumPanels: 72, maximumGridVertices: 64, maximumGridSegments: 144, maximumObservations: 1080, maximumOriginalModelObjects: 16, outputModelObjects: 5, volumeMM3: 2000000000000, areaMM2: 1200000000, ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144 }, workScope: 'direct-root-calls-inherited-provider-work-excluded', budgetFailure: 'atomic-no-partial-solid-boolean',
  };
  return snapshot({ a, b, options, originalModels, operandReports, grid, cells, vertices, edges, panels, shells, bodies, sources, observations, report }, true) as AxisBoxSolidBooleanResult;
}

/** Rebuild both source-qualified original solids and every exact/native output witness before whole-result comparison. */
export function validateAxisBoxSolidBoolean(input: AxisBoxSolidBooleanResult): AxisBoxSolidBooleanReport {
  const owned = record(snapshot(input, true), ['a', 'b', 'options', 'originalModels', 'operandReports', 'grid', 'cells', 'vertices', 'edges', 'panels', 'shells', 'bodies', 'sources', 'observations', 'report'], CODE.OWNED) as unknown as AxisBoxSolidBooleanResult;
  let expected: AxisBoxSolidBooleanResult;
  try { expected = buildAxisBoxSolidBoolean(owned.a, owned.b, owned.options); } catch (cause) { throw new AxisBoxSolidBooleanError(CODE.OWNED, 'Whole owned exact integer-cell Boolean reconstruction failed', cause); }
  check(same(owned, expected), CODE.OWNED, 'Owned sources/operands/grid/occupancy/native panels/incidence/components/lineage/observations/counters changed'); return snapshot(expected.report, true) as AxisBoxSolidBooleanReport;
}

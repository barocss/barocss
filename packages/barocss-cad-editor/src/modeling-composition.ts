import type { AxisBoxSolidBooleanAsset, AxisBoxSolidBooleanResult, OrthogonalSolidBooleanResult, OwnNativeFaceMesh, OwnPlateHolePreviewContext, Surface } from '@barocss/cad';
import { modelingUnionPanelUV, preflightModelingUnion, projectModelingUnion, validateModelingUnion } from './modeling-union.js';
import type { ModelingUnionDisplayComponent, ModelingUnionPanel } from './modeling-union.js';

type Native = OrthogonalSolidBooleanResult;
type ParentNative = AxisBoxSolidBooleanResult;
type Point = [number, number, number];
type Query = ModelingUnionPanel['query'];
type Original = Omit<ModelingUnionDisplayComponent['lineage']['operands'][number], 'operand'>;
type ParentData = Omit<ModelingUnionDisplayComponent, 'mesh'>;
type BasePanel = Omit<ModelingUnionPanel, 'lineage'>;
type Geometry = Omit<ModelingUnionDisplayComponent['lineage'], 'operands' | 'panels'> & { panels: BasePanel[] };
type Qualification = ModelingUnionDisplayComponent['qualification'] | ModelingCompositionDisplayComponent['qualification'];
type Tessellator = Parameters<typeof projectModelingUnion>[3];
type Fraction = { numerator: string; denominator: string };
type UVCorners = Native['panels'][number]['parentPanels'][number]['uvCorners'];

export interface ModelingCompositionPanel extends BasePanel {
  lineage: Native['panels'][number]['lineage'];
  parentPanels: Native['panels'][number]['parentPanels'];
}
/** A one-level proof of the owned eight-node union, then third-box difference. */
export interface ModelingCompositionDisplayComponent {
  family: 'orthogonal-cell'; role: string; solidId: string; mesh: OwnNativeFaceMesh;
  qualification: Pick<Native['report'], 'schema' | 'version' | 'evaluationId' | 'operation' | 'operationCount' | 'originalBoxCount'
    | 'geometryFamily' | 'lengthUnit' | 'empty' | 'solid' | 'cellCount' | 'occupiedCellCount' | 'vertexCount' | 'edgeCount'
    | 'panelCount' | 'shellCount' | 'bodyCount' | 'sourceCount' | 'volumeMM3' | 'areaMM2' | 'incidence' | 'numericPolicy' | 'quality'>;
  lineage: Omit<Geometry, 'panels'> & {
    panels: ModelingCompositionPanel[];
    parent: { nodeIndex: 4; evaluationId: 'm4_union'; originalIndices: [0, 1]; component: ModelingUnionDisplayComponent };
    right: Original & { originalIndex: 2 };
  };
}

const BASE_QUALIFICATION = ['schema', 'version', 'operation', 'geometryFamily', 'lengthUnit', 'empty', 'solid', 'cellCount', 'occupiedCellCount',
  'vertexCount', 'edgeCount', 'panelCount', 'shellCount', 'bodyCount', 'sourceCount', 'volumeMM3', 'areaMM2', 'incidence', 'numericPolicy', 'quality'];
const PANEL_FIELDS = ['id', 'bodyId', 'shellId', 'axis', 'sign', 'vertexIds', 'edgeIds', 'query', 'topology'];
const QUALITY: ParentNative['report']['quality'] = { restrictedCellModelEmbeddingCertified: true, restrictedBoundaryManifoldCertified: true,
  regularizedMaterialCertified: true, arbitraryCurvedSolidCertified: false, globalBinary64EvaluationErrorCertified: false,
  manufacturingToleranceCertified: false, nativePanelFaceSubsetSolidFalse: true, weldingPerformed: false, ownership: 'independent-copied-cpu-data-gc' };
const NUMERIC_POLICY: ParentNative['report']['numericPolicy'] = { material: 'regularized-closure-of-occupied-open-integer-cells',
  generatedZero: 'canonical-positive-zero-original-bits-retained', identity: 'exact-original-coordinate-plane-grid-indices-no-tolerance-welding',
  source: 'whole-original-models-and-per-panel-native-model5', lineageUV: 'exact-reduced-integer-ratio-fractions',
  volume: 'occupied-cell-volume-equals-sum-of-oriented-shell-volumes', euler: 'diagnostic-no-sphere-or-single-shell-requirement',
  pointComparisonMM: 1e-9, relativeDerivativeComparison: 1e-9 };
function check(value: unknown, message: string): asserts value { if (!value) throw new Error('Composed orthogonal display: ' + message); }
function exact(value: object, fields: string[]): void {
  check(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === fields.length
    && fields.every(k => Object.hasOwn(value, k)), 'exact copied fields required: ' + fields.join(','));
}
/** Property order is immaterial; original numeric bits (including negative zero) are not. */
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => same(v, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
    return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => Object.hasOwn(y, k) && same(x[k], y[k]));
  }
  return Object.is(a, b);
}
function id(value: unknown): asserts value is string { check(typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_-]{0,127}$/.test(value), 'bounded native identity'); }
function token(value: unknown): void { check(typeof value === 'string' && /^[\x21-\x7e]{1,128}$/.test(value), 'bounded request identity'); }
function safe(value: number): number { check(Number.isSafeInteger(value), 'safe integer arithmetic required'); return value; }
function tuple(value: number[], length: number): void { check(Array.isArray(value) && value.length === length && value.every(Number.isSafeInteger), 'integer tuple required'); }
function unique(values: string[]): void { values.forEach(id); check(new Set(values).size === values.length, 'duplicate native identities'); }
function setEqual(a: string[], b: string[]): boolean { return same([...new Set(a)].sort(), [...new Set(b)].sort()); }
function query(value: Query): void {
  exact(value, ['sourceId', 'sourceVersion', 'modelId', 'surfaceId', 'faceId']);
  check(value.sourceVersion === 0, 'whole Source0 query required'); [value.sourceId, value.modelId, value.surfaceId, value.faceId].forEach(id);
}
function cross(u: number[], v: number[]): number[] {
  return [safe(safe(u[1] * v[2]) - safe(u[2] * v[1])), safe(safe(u[2] * v[0]) - safe(u[0] * v[2])), safe(safe(u[0] * v[1]) - safe(u[1] * v[0]))];
}
function vector(a: number[], b: number[]): number[] { return a.map((n, i) => safe(n - b[i])); }
function fraction(value: Fraction): [bigint, bigint] {
  exact(value, ['numerator', 'denominator']);
  check(/^(0|[1-9][0-9]{0,9})$/.test(value.numerator) && /^[1-9][0-9]{0,9}$/.test(value.denominator), 'bounded nonnegative exact UV ratio');
  const n = BigInt(value.numerator), d = BigInt(value.denominator); check(n <= d, 'UV ratio outside original support');
  let a = n, b = d; while (b) [a, b] = [b, a % b]; check(a === 1n, 'UV ratio must be reduced'); return [n, d];
}
function chartCorrespondence(uvCorners: UVCorners, chart: number[][], positions: number[][]): void {
  check(uvCorners.length === 4 && chart.length === 4 && positions.length === 4, 'four exact native chart corners');
  for (const [j, uv] of uvCorners.entries()) {
    check(uv.length === 2, 'native UV corner pair'); const [u, du] = fraction(uv[0]), [v, dv] = fraction(uv[1]);
    const weights = [(du - u) * (dv - v), u * (dv - v), u * v, (du - u) * v];
    for (let a = 0; a < 3; a++) check(chart.reduce((sum, point, k) => sum + BigInt(point[a]) * weights[k], 0n)
      === BigInt(positions[j][a]) * du * dv, 'exact native lineage UV/XYZ correspondence');
  }
}
function covers(axis: number, points: number[][], chart: number[][]): boolean {
  const min = [0, 1, 2].map(a => Math.min(...chart.map(p => p[a]))), max = [0, 1, 2].map(a => Math.max(...chart.map(p => p[a])));
  return min[axis] === max[axis] && points.every(p => p.every((n, a) => n >= min[a] && n <= max[a]));
}
function supportChart(surface: Surface): Point[] {
  const cp = surface.controlPoints; return [cp[0][0], cp[1][0], cp[1][1], cp[0][1]];
}
function validateSurface(surface: Surface): void {
  exact(surface, ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']); id(surface.id);
  check(surface.kind === 'surface' && surface.degreeU === 1 && surface.degreeV === 1 && same(surface.knotsU, [0, 0, 1, 1])
    && same(surface.knotsV, [0, 0, 1, 1]) && same(surface.weights, [[1, 1], [1, 1]])
    && surface.controlPoints.length === 2 && surface.controlPoints.every(row => row.length === 2), 'complete original bilinear support');
  surface.controlPoints.flat().forEach(p => tuple(p, 3));
}
function validateOriginal(original: Original, prefix: string): void {
  id(original.sourceId); id(original.shellId); tuple(original.origin, 3); tuple(original.sides, 3);
  check(original.sourceId === prefix + '_src' && original.shellId === prefix + '_shell' && original.faces.length === 6
    && original.origin[2] === 0 && original.sides[2] === 8
    && original.sides.every(v => v >= 1 && v <= 10000)
    && original.origin.every((n, a) => Math.abs(n) <= 10000 && Math.abs(safe(n + original.sides[a])) <= 10000), 'owned common-Z [0,8] original box');
  unique(original.faces.map(f => f.globalFaceId));
  for (const [index, face] of original.faces.entries()) {
    exact(face, ['globalFaceId', 'query', 'surface']); query(face.query); validateSurface(face.surface);
    check(face.globalFaceId === prefix + '_gf' + index && face.query.sourceId === original.sourceId && face.query.modelId === prefix + '_model'
      && face.query.surfaceId === prefix + '_s' + index && face.surface.id === face.query.surfaceId
      && face.query.faceId === prefix + '_f' + index, 'exact original global/local/source support binding');
    const chart = supportChart(face.surface), u = vector(chart[1], chart[0]), v = vector(chart[3], chart[0]), normal = cross(u, v);
    const axis = Math.floor(index / 2), sign = index % 2 ? 1 : -1;
    check(u.filter(n => n !== 0).length === 1 && v.filter(n => n !== 0).length === 1
      && normal.every((n, a) => a === axis ? n * sign > 0 : n === 0)
      && chart[2].every((n, a) => n === safe(safe(chart[0][a] + u[a]) + v[a]))
      && chart.every(p => p[axis] === safe(original.origin[axis] + (sign > 0 ? original.sides[axis] : 0))
        && p.every((n, a) => n === original.origin[a] || n === safe(original.origin[a] + original.sides[a]))), 'full outward rectangular original support');
  }
}
function originalData(asset: AxisBoxSolidBooleanAsset, model: ParentNative['originalModels'][number]): Original {
  check(asset.sourceVersion === 0 && model.version === 0 && model.lengthUnit === 'mm' && model.objects.length === 6
    && asset.shell.version === 0 && asset.shell.faces.length === 6, 'complete original Source0 support inventory');
  return { sourceId: asset.sourceId, shellId: asset.shell.id, origin: [...asset.shell.origin], sides: [...asset.shell.sides], faces: asset.shell.faces.map(face => {
    const topology = face.bundle.topology, surface = model.objects.find((o): o is Surface => o.kind === 'surface' && o.id === topology.face.surfaceId);
    check(surface && same(surface, face.bundle.geometry.objects[0]), 'original native support/model bit correspondence');
    modelingUnionPanelUV(topology);
    // Native endpoint evaluation may produce +0 from a retained original -0.
    // Compare geometric coordinates here without rewriting either representation;
    // the original Surface/model correspondence above remains bit-exact.
    const chart = supportChart(surface);
    check(topology.vertices.every((v, i) => v.point.every((n, a) => n === chart[i][a])), 'original support/local topology correspondence');
    return { globalFaceId: face.id, query: { sourceId: asset.sourceId, sourceVersion: 0, modelId: model.name,
      surfaceId: surface.id, faceId: topology.face.id }, surface: structuredClone(surface) };
  }) };
}
function qualification(native: ParentNative): ModelingUnionDisplayComponent['qualification'];
function qualification(native: Native): ModelingCompositionDisplayComponent['qualification'];
function qualification(native: ParentNative | Native): Qualification {
  const r = native.report;
  const base = { schema: r.schema, version: r.version, operation: r.operation, geometryFamily: r.geometryFamily, lengthUnit: r.lengthUnit,
    empty: r.empty, solid: r.solid, cellCount: r.cellCount, occupiedCellCount: r.occupiedCellCount, vertexCount: r.vertexCount,
    edgeCount: r.edgeCount, panelCount: r.panelCount, shellCount: r.shellCount, bodyCount: r.bodyCount, sourceCount: r.sourceCount,
    volumeMM3: r.volumeMM3, areaMM2: r.areaMM2, incidence: structuredClone(r.incidence), numericPolicy: structuredClone(r.numericPolicy), quality: structuredClone(r.quality) };
  return (r.schema === 'barocss-orthogonal-solid-boolean'
    ? { ...base, evaluationId: r.evaluationId, operationCount: r.operationCount, originalBoxCount: r.originalBoxCount } : base) as Qualification;
}
/** Read retained metadata only. No native construction, evaluation or fabricated sample arrays. */
function geometry(native: ParentNative | Native): Geometry {
  check(native.bodies.length === 1 && native.panels.length >= 1 && native.panels.length <= 64 && native.sources.length === native.panels.length
    && native.vertices.length <= 64 && native.edges.length <= 144 && native.cells.length <= 16, 'complete bounded retained native inventory');
  unique(native.sources.map(s => s.sourceId)); unique(native.sources.map(s => s.panelId));
  const panels = native.panels.map(panel => {
    const source = native.sources.find(s => s.sourceId === panel.sourceId), shell = native.shells.find(s => s.panelIds.includes(panel.id)), topology = panel.bundle.topology;
    check(source && source.panelId === panel.id && source.sourceVersion === 0 && same(source.model, panel.bundle.geometry)
      && source.model.version === 0 && source.model.lengthUnit === 'mm' && source.model.objects.length === 5 && shell?.bodyId === panel.bodyId,
    'complete native generated source/body/shell binding');
    const surface = source.model.objects.find((o): o is Surface => o.kind === 'surface' && o.id === topology.face.surfaceId);
    check(surface, 'actual native generated Surface'); validateSurface(surface); modelingUnionPanelUV(topology);
    const points = panel.vertexIds.map((key, i) => {
      const vertex = native.vertices.find(v => v.id === key);
      check(vertex && same(vertex.pointMM, topology.vertices[i].point), 'native local/global vertex identity'); return vertex.pointMM;
    });
    check(same(supportChart(surface), points), 'actual generated Surface/native corner bits');
    for (const [i, edge] of topology.edges.entries()) {
      const curve = source.model.objects.find(o => o.id === edge.curveId);
      check(curve && same(curve, { kind: 'curve', id: edge.curveId, degree: 1, knots: [0, 0, 1, 1],
        controlPoints: [points[i], points[(i + 1) % 4]], weights: [1, 1] }), 'full native generated boundary Curve');
    }
    return { id: panel.id, bodyId: panel.bodyId, shellId: shell.id, axis: panel.axis, sign: panel.sign,
      vertexIds: [...panel.vertexIds], edgeIds: [...panel.edgeIds], query: { sourceId: source.sourceId, sourceVersion: 0 as const,
        modelId: source.model.name, surfaceId: surface.id, faceId: topology.face.id }, topology: structuredClone(topology) };
  });
  return { body: structuredClone(native.bodies[0]), grid: structuredClone(native.grid), cells: structuredClone(native.cells), shells: structuredClone(native.shells),
    vertices: native.vertices.map(({ id, pointMM }) => ({ id, pointMM: [...pointMM] })), edges: structuredClone(native.edges), panels };
}
function parentData(native: ParentNative): ParentData {
  const l = geometry(native);
  const operands = (['a', 'b'] as const).map((operand, i) => ({ operand, ...originalData(native[operand], native.originalModels[i]) }));
  check(same(native.report.operandBindings, operands.map(o => ({ sourceId: o.sourceId, shellId: o.shellId,
    faces: o.faces.map(f => ({ globalFaceId: f.globalFaceId, localFaceId: f.query.faceId, surfaceId: f.query.surfaceId })) }))), 'parent original report bindings');
  return { family: 'orthogonal-cell', role: 'composition-parent', solidId: native.bodies[0].id, qualification: qualification(native),
    lineage: { ...l, panels: l.panels.map((p, i) => ({ ...p, lineage: structuredClone(native.panels[i].lineage) })), operands } };
}
/** Pure structural gate; output aliases and numeric driver names are deliberately unrestricted. */
export function isModelingCompositionGraph(authored: unknown): boolean {
  try {
    // Bounded descriptor-first copying keeps this unknown-input predicate free of getters.
    let remaining = 4096;
    const active = new Set<object>();
    const copy = (value: unknown, depth: number): unknown => {
      check(--remaining >= 0 && depth <= 12, 'authored graph budget');
      if (value === null || typeof value === 'boolean') return value;
      if (typeof value === 'number') { check(Number.isFinite(value), 'finite authored number'); return value; }
      if (typeof value === 'string') { check(value.length <= 128, 'bounded authored token'); return value; }
      check(typeof value === 'object' && !active.has(value), 'acyclic own authored data');
      const array = Array.isArray(value), proto = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
      check(array ? proto === Array.prototype : proto === Object.prototype || proto === null, 'plain authored data');
      check(keys.length <= 65 && keys.every(k => typeof k === 'string' && k.length <= 128 && 'value' in descriptors[k]
        && (array && k === 'length' || descriptors[k].enumerable)), 'own authored fields');
      active.add(value);
      try {
        if (array) { check(value.length <= 64 && keys.length === value.length + 1, 'dense bounded authored array');
          return Array.from({ length: value.length }, (_, i) => { check(Object.hasOwn(descriptors, String(i)), 'dense authored array'); return copy(descriptors[String(i)].value, depth + 1); }); }
        return Object.fromEntries((keys as string[]).map(k => [k, copy(descriptors[k].value, depth + 1)]));
      } finally { active.delete(value); }
    };
    const d = copy(authored, 0) as Record<string, unknown>;
    exact(d, ['format', 'schema', 'units', 'parameters', 'nodes', 'outputs']);
    check(d.format === 'barocss-cad-model' && d.schema === 1 && d.units === 'mm', 'primary authored document');
    const parameters = d.parameters as Record<string, number>;
    check(parameters && typeof parameters === 'object' && !Array.isArray(parameters) && Object.keys(parameters).length <= 16, 'authored parameter inventory');
    const name = (key: string) => /^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(key) && !['__proto__', 'prototype', 'constructor'].includes(key);
    check(Object.entries(parameters).every(([k, v]) => name(k) && typeof v === 'number' && Number.isFinite(v)), 'valid authored parameters');
    const dimension = (input: unknown): void => {
      let count = 0;
      const visit = (value: unknown, depth: number): void => {
        check(++count <= 32 && depth <= 6, 'bounded authored dimension');
        if (typeof value === 'number') { check(Number.isFinite(value), 'finite dimension'); return; }
        const e = value as Record<string, unknown>;
        check(e && typeof e === 'object' && !Array.isArray(e), 'authored dimension expression');
        if (Object.hasOwn(e, 'parameter')) { exact(e, ['parameter']); check(typeof e.parameter === 'string' && Object.hasOwn(parameters, e.parameter), 'known parameter'); return; }
        if (e.op === 'add') { exact(e, ['op', 'left', 'right']); visit(e.left, depth + 1); visit(e.right, depth + 1); return; }
        exact(e, ['op', 'value', 'factor']); check(e.op === 'scale' && typeof e.factor === 'number' && Number.isFinite(e.factor), 'dimension scale'); visit(e.value, depth + 1);
      };
      visit(input, 1);
    };
    const point = (value: unknown): void => { check(Array.isArray(value) && value.length === 2, 'authored rectangle point'); value.forEach(dimension); };
    const nodes = d.nodes as Record<string, unknown>[];
    check(Array.isArray(nodes) && nodes.length === 8, 'exact eight-node graph');
    for (const [sketch, extrusion] of [[0, 1], [2, 3], [5, 6]]) {
      const s = nodes[sketch], e = nodes[extrusion]; exact(s, ['kind', 'profile', 'min', 'max']); exact(e, ['kind', 'sketch', 'height']);
      check(s.kind === 'sketch' && s.profile === 'rectangle' && e.kind === 'extrude' && Object.is(e.sketch, sketch), 'direct distinct rectangular extrusions');
      point(s.min); point(s.max); dimension(e.height);
    }
    const ref = (value: unknown, index: number): void => { const r = value as Record<string, unknown>; exact(r, ['node', 'side']); check(r.node === index && r.side === 'solid', 'exact owned solid reference'); };
    exact(nodes[4], ['kind', 'left', 'right']); check(nodes[4].kind === 'union', 'node4 direct union'); ref(nodes[4].left, 1); ref(nodes[4].right, 3);
    exact(nodes[7], ['kind', 'parent', 'tool']); check(nodes[7].kind === 'difference', 'node7 composed difference'); ref(nodes[7].parent, 4); ref(nodes[7].tool, 6);
    const outputs = d.outputs as Record<string, Record<string, unknown>>;
    check(outputs && typeof outputs === 'object' && !Array.isArray(outputs) && Object.keys(outputs).length >= 1 && Object.keys(outputs).length <= 8, 'bounded named output inventory');
    for (const [key, output] of Object.entries(outputs)) { check(name(key) && output && [1, 3, 4, 6, 7].includes(output.node as number), 'output names a genuine chain result'); ref(output, output.node as number); }
    return true;
  } catch { return false; }
}

function inside(index: number[], grid: number[][], box: Original): boolean {
  return index.every((v, a) => grid[a][v] >= box.origin[a] && grid[a][v + 1] <= safe(box.origin[a] + box.sides[a]));
}
function incidence(panelCount: number): ParentNative['report']['incidence'] {
  return { allBoundaryTilesAccounted: true, internalFacesCancelled: true, everyEdgeTwoOppositeUses: true, orientedVertexLinksSingleCycles: true,
    cornerCount: panelCount * 4, edgeUseCount: panelCount * 4, panelEdgeEquation: true };
}
/** Integer receiving correspondence, not another native Boolean certification. */
function validateGeometry(q: Qualification, l: Geometry, solidId: string, prefix: 'm4' | 'm7'): Map<string, Point[]> {
  check(q.version === 0 && q.geometryFamily === 'exact-integer-orthogonal-cell-solid-v0' && q.lengthUnit === 'mm'
    && q.empty === false && q.solid === true && q.bodyCount === 1 && same(q.quality, QUALITY) && same(q.numericPolicy, NUMERIC_POLICY), 'copied restricted native qualification');
  check(l.panels.length >= 1 && l.panels.length <= 64 && q.panelCount === l.panels.length && q.sourceCount === l.panels.length
    && l.vertices.length <= 64 && q.vertexCount === l.vertices.length && l.edges.length <= 144 && q.edgeCount === l.edges.length
    && l.cells.length <= 16 && q.cellCount === l.cells.length && l.shells.length >= 1 && q.shellCount === l.shells.length, 'complete bounded display inventories');
  unique(l.panels.map(p => p.id)); unique(l.panels.map(p => p.query.sourceId)); unique(l.vertices.map(v => v.id)); unique(l.edges.map(e => e.id)); unique(l.shells.map(s => s.id));
  const body = l.body; exact(body, ['id', 'cellIndices', 'shellIds', 'volumeMM3', 'areaMM2', 'boundsMM', 'closed', 'solid', 'embeddedIntegerCellModelCertified']);
  check(body.id === solidId && solidId === prefix + '_body0' && body.closed === true && body.solid === true && body.embeddedIntegerCellModelCertified === true
    && safe(q.volumeMM3) > 0 && q.volumeMM3 <= 2e12 && body.volumeMM3 === q.volumeMM3 && body.areaMM2 === q.areaMM2, 'one positive native body');
  exact(l.grid, ['x', 'y', 'z']); const grid = [l.grid.x, l.grid.y, l.grid.z];
  grid.forEach((g, a) => check(g.length >= 2 && g.length <= (a === 2 ? 2 : prefix === 'm4' ? 4 : 5)
    && g.every((n, i) => Number.isSafeInteger(n) && Math.abs(n) <= 10000 && (n !== 0 || Object.is(n, 0)) && (i === 0 || n > g[i - 1])), 'bounded canonical integer grid'));
  check(same(l.grid.z, [0, 8]), 'only the common-Z [0,8] display profile');
  let volume = 0; const occupied: string[] = [], cells = new Map<string, Geometry['cells'][number]>();
  for (const cell of l.cells) {
    exact(cell, ['index', 'insideA', 'insideB', 'occupied', 'bodyId', 'emptyRegionId', 'volumeMM3']); tuple(cell.index, 3);
    const key = cell.index.join(','); check(cell.index.every((v, a) => v >= 0 && v + 1 < grid[a].length) && !cells.has(key), 'complete unique cell grid'); cells.set(key, cell);
    check(typeof cell.insideA === 'boolean' && typeof cell.insideB === 'boolean'
      && cell.occupied === (prefix === 'm4' ? cell.insideA || cell.insideB : cell.insideA && !cell.insideB), 'operation-specific exact occupancy');
    const size = cell.index.map((v, a) => safe(grid[a][v + 1] - grid[a][v])), value = safe(safe(size[0] * size[1]) * size[2]);
    check(value === cell.volumeMM3 && cell.bodyId === (cell.occupied ? body.id : null), 'exact cell volume/body');
    if (cell.occupied) { check(cell.emptyRegionId === null, 'material has no empty-region identity'); volume = safe(volume + value); occupied.push(key); }
    else { id(cell.emptyRegionId); check(cell.emptyRegionId === prefix + '_void0', 'common-height empty region is exterior'); }
  }
  check(cells.size === grid.reduce((n, g) => safe(n * (g.length - 1)), 1) && volume === q.volumeMM3 && q.occupiedCellCount === occupied.length
    && body.cellIndices.length === occupied.length && same(body.cellIndices.map(v => v.join(',')).sort(), [...occupied].sort()), 'complete cell inventory/volume conservation');
  const materialSeen = new Set<string>(), materialQueue = [occupied[0]];
  for (let i = 0; i < materialQueue.length; i++) {
    const key = materialQueue[i]; if (materialSeen.has(key)) continue; materialSeen.add(key);
    const cell = cells.get(key)!;
    for (let a = 0; a < 3; a++) for (const sign of [-1, 1]) { const next = [...cell.index]; next[a] += sign; const nextKey = next.join(',');
      if (cells.get(nextKey)?.occupied && !materialSeen.has(nextKey)) materialQueue.push(nextKey);
    }
  }
  check(materialSeen.size === occupied.length, 'one connected material component');
  check(same(body.shellIds, l.shells.map(s => s.id)) && l.shells.reduce((n, s) => safe(n + safe(s.signedVolumeMM3)), 0) === volume, 'oriented-shell volume conservation');
  for (const [index, v] of l.vertices.entries()) { exact(v, ['id', 'pointMM']); tuple(v.pointMM, 3);
    check(v.id === prefix + '_v' + index && v.pointMM.every((n, a) => grid[a].some(g => Object.is(g, n))), 'exact canonical grid vertex'); }
  const expectedTiles = new Set<string>();
  for (const cell of l.cells.filter(c => c.occupied)) for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    const adjacent = [...cell.index]; adjacent[axis] += sign;
    if (!cells.get(adjacent.join(','))?.occupied) expectedTiles.add(cell.index.join(',') + '/' + axis + '/' + sign);
  }
  const positions = new Map<string, Point[]>(), panelAreas = new Map<string, number>(), panelVolumes3 = new Map<string, number>();
  for (const [index, p] of l.panels.entries()) {
    query(p.query); modelingUnionPanelUV(p.topology);
    check(p.id === prefix + '_p' + index && p.query.sourceId === prefix + '_s' + index && p.query.surfaceId === prefix + '_sf' + index
      && p.query.modelId === 'parametric_face' && p.query.faceId === p.id && p.topology.face.id === p.id && p.topology.face.surfaceId === p.query.surfaceId
      && p.bodyId === body.id && l.shells.some(s => s.id === p.shellId && s.bodyId === p.bodyId && s.panelIds.includes(p.id)), 'owned panel/source/shell/face identity');
    check(p.topology.loop.id === prefix + '_l' + index
      && p.topology.vertices.every((v, j) => v.id === prefix + '_pv' + index + '_' + j)
      && p.topology.edges.every((e, j) => e.id === prefix + '_pe' + index + '_' + j && e.curveId === prefix + '_pc' + index + '_' + j), 'exact generated local topology identities');
    check([0, 1, 2].includes(p.axis) && [-1, 1].includes(p.sign) && p.vertexIds.length === 4 && p.edgeIds.length === 4, 'rectangular native panel cardinality');
    unique(p.vertexIds); unique(p.edgeIds);
    const points = p.vertexIds.map((key, i) => { const v = l.vertices.find(v => v.id === key); check(v && same(v.pointMM, p.topology.vertices[i].point), 'native local/global vertex binding'); return v.pointMM; });
    const u = vector(points[1], points[0]), v = vector(points[3], points[0]), normal = cross(u, v);
    check(u.filter(n => n !== 0).length === 1 && v.filter(n => n !== 0).length === 1
      && normal.every((n, a) => a === p.axis ? n * p.sign > 0 : n === 0)
      && points[2].every((n, a) => n === safe(safe(points[0][a] + u[a]) + v[a])), 'oriented complete rectangular grid panel');
    const min = [0, 1, 2].map(a => Math.min(...points.map(v => v[a]))), max = [0, 1, 2].map(a => Math.max(...points.map(v => v[a])));
    const cellIndex = min.map((n, a) => grid[a].indexOf(n) - (a === p.axis && p.sign > 0 ? 1 : 0));
    check(min[p.axis] === max[p.axis] && min.every((n, a) => a === p.axis || grid[a][cellIndex[a] + 1] === max[a]), 'one full native grid boundary tile');
    const tile = cellIndex.join(',') + '/' + p.axis + '/' + p.sign;
    check(expectedTiles.delete(tile), 'every panel must be a distinct actual occupied-material boundary');
    const area = Math.abs(normal[p.axis]); positions.set(p.id, points); panelAreas.set(p.id, area); panelVolumes3.set(p.id, safe(safe(points[0][p.axis] * area) * p.sign));
  }
  check(expectedTiles.size === 0, 'every occupied-material boundary tile must be retained');
  for (const [index, e] of l.edges.entries()) {
    exact(e, ['id', 'vertexIds', 'canonical', 'uses']); exact(e.canonical, ['sourceId', 'faceId', 'localEdgeId', 'curveId']);
    check(e.id === prefix + '_e' + index && e.vertexIds.length === 2 && e.vertexIds[0] !== e.vertexIds[1] && e.uses.length === 2 && e.uses[0].faceId !== e.uses[1].faceId
      && e.uses[0].sense !== e.uses[1].sense, 'two distinct opposite native edge uses');
    for (const use of e.uses) {
      exact(use, ['sourceId', 'faceId', 'localEdgeId', 'curveId', 'sense']);
      const panel = l.panels.find(p => p.id === use.faceId), i = panel?.topology.edges.findIndex(x => x.id === use.localEdgeId);
      check(panel && i !== undefined && i >= 0, 'native edge local use binding');
      const local = panel.topology.edges[i], ends = [panel.vertexIds[i], panel.vertexIds[(i + 1) % 4]];
      check(panel.query.sourceId === use.sourceId && panel.edgeIds[i] === e.id && local.curveId === use.curveId
        && (same(e.vertexIds, ends) ? use.sense === 'forward' : same(e.vertexIds, [...ends].reverse()) && use.sense === 'reverse'), 'complete edge source/vertices/sense');
    }
    check(e.uses.some(({ sense: _sense, ...use }) => same(use, e.canonical)), 'canonical native edge reference');
  }
  check(setEqual(l.vertices.map(v => v.id), l.panels.flatMap(p => p.vertexIds)) && setEqual(l.edges.map(e => e.id), l.panels.flatMap(p => p.edgeIds)), 'all global topology used');
  // Verify the copied manifold flags have an actual single oriented corner cycle at every vertex.
  for (const vertex of l.vertices) {
    const edges = l.edges.filter(e => e.vertexIds.includes(vertex.id)).map(e => e.id);
    const arcs = l.panels.flatMap(p => p.vertexIds.flatMap((key, i) => key === vertex.id ? [[p.edgeIds[(i + 3) % 4], p.edgeIds[i]]] : []));
    check(edges.length >= 2 && arcs.length === edges.length && edges.every(e => arcs.filter(a => a[0] === e).length === 1 && arcs.filter(a => a[1] === e).length === 1), 'complete directed vertex link');
    const seen = new Set<string>(); let current = edges[0];
    for (let i = 0; i < edges.length; i++) { check(!seen.has(current), 'pinched vertex link'); seen.add(current); current = arcs.find(a => a[0] === current)![1]; }
    check(current === edges[0] && seen.size === edges.length, 'one closed oriented vertex link cycle');
  }
  const all = l.shells.flatMap(s => s.panelIds); check(all.length === l.panels.length && new Set(all).size === all.length && setEqual(all, l.panels.map(p => p.id)), 'complete unique shell panel coverage');
  for (const [index, shell] of l.shells.entries()) {
    exact(shell, ['id', 'bodyId', 'emptyRegionId', 'role', 'panelIds', 'edgeIds', 'vertexIds', 'eulerCharacteristic', 'signedVolumeMM3', 'areaMM2']);
    unique(shell.panelIds); unique(shell.edgeIds); unique(shell.vertexIds);
    const panels = l.panels.filter(p => p.shellId === shell.id), area = shell.panelIds.reduce((n, key) => safe(n + panelAreas.get(key)!), 0), volume3 = shell.panelIds.reduce((n, key) => safe(n + panelVolumes3.get(key)!), 0);
    check(shell.id === prefix + '_sh' + index && shell.bodyId === body.id && shell.role === 'outer' && shell.emptyRegionId === prefix + '_void0' && setEqual(shell.panelIds, panels.map(p => p.id))
      && setEqual(shell.edgeIds, panels.flatMap(p => p.edgeIds)) && setEqual(shell.vertexIds, panels.flatMap(p => p.vertexIds))
      && shell.eulerCharacteristic === shell.vertexIds.length - shell.edgeIds.length + shell.panelIds.length
      && area === shell.areaMM2 && volume3 > 0 && volume3 % 3 === 0 && volume3 / 3 === shell.signedVolumeMM3, 'complete native shell geometry');
    const connected = new Set<string>(), queue = [panels[0].id];
    for (let i = 0; i < queue.length; i++) { const key = queue[i]; if (connected.has(key)) continue; connected.add(key);
      for (const edge of l.edges.filter(e => e.uses.some(u => u.faceId === key))) for (const use of edge.uses) {
        check(shell.panelIds.includes(use.faceId), 'edge cannot cross native shell ownership'); if (!connected.has(use.faceId)) queue.push(use.faceId);
      }
    }
    check(connected.size === panels.length, 'one connected panel graph per shell');
  }
  exact(body.boundsMM, ['min', 'max']); tuple(body.boundsMM.min, 3); tuple(body.boundsMM.max, 3);
  check(body.boundsMM.min.every((n, a) => n === Math.min(...l.vertices.map(v => v.pointMM[a])))
    && body.boundsMM.max.every((n, a) => n === Math.max(...l.vertices.map(v => v.pointMM[a])))
    && safe(q.areaMM2) > 0 && q.areaMM2 <= 1200000000 && l.shells.reduce((n, s) => safe(n + safe(s.areaMM2)), 0) === q.areaMM2
    && same(q.incidence, incidence(l.panels.length)), 'body bounds/area/incidence correspondence');
  return positions;
}
function validateOriginalLink(link: Omit<Native['panels'][number]['lineage'][number], 'originalIndex'>, original: Original, panel: BasePanel, points: Point[]): void {
  const face = original.faces.find(f => f.globalFaceId === link.globalFaceId);
  check(face && link.sourceId === original.sourceId && link.shellId === original.shellId && link.localFaceId === face.query.faceId
    && link.surfaceId === face.query.surfaceId && [-1, 1].includes(link.relativeOrientation), 'exact original lineage source qualification');
  const chart = supportChart(face.surface), normal = cross(vector(chart[1], chart[0]), vector(chart[3], chart[0]));
  check(covers(panel.axis, points, chart) && link.relativeOrientation === Math.sign(normal[panel.axis]) * panel.sign, 'original support relative orientation');
  chartCorrespondence(link.uvCorners, chart, points);
}
function validateParentData(parent: ParentData): void {
  exact(parent.qualification, BASE_QUALIFICATION); check(parent.family === 'orthogonal-cell' && parent.qualification.schema === 'barocss-axis-box-solid-boolean'
    && parent.qualification.operation === 'union', 'owned direct two-box union parent');
  const l = parent.lineage; exact(l, ['body', 'grid', 'cells', 'shells', 'vertices', 'edges', 'panels', 'operands']);
  const positions = validateGeometry(parent.qualification, l, parent.solidId, 'm4');
  check(l.operands.length === 2 && l.operands[0].operand === 'a' && l.operands[1].operand === 'b', 'original indices0/1 belong to parent operands a/b');
  l.operands.forEach((o, i) => { exact(o, ['operand', 'sourceId', 'shellId', 'origin', 'sides', 'faces']); validateOriginal(o, i === 0 ? 'm4a' : 'm4b'); });
  const grid = [l.grid.x, l.grid.y, l.grid.z];
  for (const cell of l.cells) check(cell.insideA === inside(cell.index, grid, l.operands[0]) && cell.insideB === inside(cell.index, grid, l.operands[1]), 'parent cells/original material correspondence');
  grid.forEach((g, a) => check(same(g, [...new Set(l.operands.flatMap(o => [o.origin[a] || 0, safe(o.origin[a] + o.sides[a])]))].sort((a, b) => a - b)), 'complete original parent plane grid'));
  for (const p of l.panels) {
    exact(p, [...PANEL_FIELDS, 'lineage']); const points = positions.get(p.id)!;
    check(p.lineage.length >= 1 && p.lineage.length <= 2, 'complete bounded parent contributors');
    const expected = l.operands.flatMap(o => o.faces.filter(f => covers(p.axis, points, supportChart(f.surface))).map(f => o.operand + '/' + f.globalFaceId));
    const actual = p.lineage.map(link => link.operand + '/' + link.globalFaceId);
    check(new Set(actual).size === actual.length && same([...actual].sort(), expected.sort()), 'complete original parent contributor set');
    for (const link of p.lineage) {
      exact(link, ['operand', 'sourceId', 'shellId', 'globalFaceId', 'localFaceId', 'surfaceId', 'relativeOrientation', 'uvCorners']);
      const original = l.operands.find(o => o.operand === link.operand); check(original, 'parent operand index'); validateOriginalLink(link, original, p, points);
    }
  }
}
function validateCompositionGeometry(q: ModelingCompositionDisplayComponent['qualification'], l: Geometry & { panels: ModelingCompositionPanel[] }, parent: ParentData, right: Original & { originalIndex: 2 }): void {
  exact(q, [...BASE_QUALIFICATION, 'evaluationId', 'operationCount', 'originalBoxCount']);
  check(q.schema === 'barocss-orthogonal-solid-boolean' && q.evaluationId === 'm7_difference' && q.operation === 'difference'
    && q.operationCount === 2 && q.originalBoxCount === 3, 'owned two-operation three-original composed difference');
  exact(right, ['originalIndex', 'sourceId', 'shellId', 'origin', 'sides', 'faces']); check(right.originalIndex === 2, 'new box is originalIndex2'); validateOriginal(right, 'm7c');
  const positions = validateGeometry(q, l, l.body.id, 'm7'), originals = [...parent.lineage.operands, right], grid = [l.grid.x, l.grid.y, l.grid.z], pg = [parent.lineage.grid.x, parent.lineage.grid.y, parent.lineage.grid.z];
  grid.forEach((g, a) => check(same(g, [...new Set(originals.flatMap(o => [o.origin[a] || 0, safe(o.origin[a] + o.sides[a])]))].sort((a, b) => a - b)), 'complete three-original plane grid'));
  for (const cell of l.cells) {
    const insideA = parent.lineage.cells.some(p => p.occupied && cell.index.every((v, a) => grid[a][v] >= pg[a][p.index[a]] && grid[a][v + 1] <= pg[a][p.index[a] + 1]));
    check(cell.insideA === insideA && cell.insideB === inside(cell.index, grid, right), 'insideA must be parent occupied material, insideB originalIndex2');
  }
  for (const p of l.panels) {
    exact(p, [...PANEL_FIELDS, 'lineage', 'parentPanels']); const points = positions.get(p.id)!;
    const parents = parent.lineage.panels.filter(previous => previous.axis === p.axis && covers(p.axis, points, previous.topology.vertices.map(v => v.point)));
    check(p.parentPanels.length <= 64 && new Set(p.parentPanels.map(link => link.panelId)).size === p.parentPanels.length
      && same(p.parentPanels.map(link => link.panelId).sort(), parents.map(previous => previous.id).sort()), 'all and only immediate covering parent panels');
    for (const link of p.parentPanels) {
      exact(link, ['evaluationId', 'panelId', 'sourceId', 'relativeOrientation', 'uvCorners']); const previous = parents.find(previous => previous.id === link.panelId);
      check(previous && link.evaluationId === 'm4_union' && link.sourceId === previous.query.sourceId
        && link.relativeOrientation === previous.sign * p.sign, 'exact immediate parent evaluation/source/sign');
      chartCorrespondence(link.uvCorners, previous.topology.vertices.map(v => v.point), points);
    }
    const inherited = new Set(parents.flatMap(previous => previous.lineage.map(link => (link.operand === 'a' ? 0 : 1) + '/' + link.sourceId + '/' + link.globalFaceId)));
    const expected = originals.flatMap((original, i) => original.faces.filter(f => covers(p.axis, points, supportChart(f.surface))
      && (i === 2 || inherited.has(i + '/' + original.sourceId + '/' + f.globalFaceId))).map(f => i + '/' + original.sourceId + '/' + f.globalFaceId));
    const actual = p.lineage.map(link => link.originalIndex + '/' + link.sourceId + '/' + link.globalFaceId);
    check(p.lineage.length >= 1 && p.lineage.length <= 3 && new Set(actual).size === actual.length && same([...actual].sort(), expected.sort()), 'complete inherited/new original contributor set; no resurrection');
    for (const link of p.lineage) {
      exact(link, ['originalIndex', 'sourceId', 'shellId', 'globalFaceId', 'localFaceId', 'surfaceId', 'relativeOrientation', 'uvCorners']);
      check(Number.isInteger(link.originalIndex) && link.originalIndex >= 0 && link.originalIndex <= 2, 'exact original index');
      validateOriginalLink(link, originals[link.originalIndex], p, points);
    }
  }
}
function compositionData(native: Native): { qualification: ModelingCompositionDisplayComponent['qualification']; geometry: Geometry & { panels: ModelingCompositionPanel[] }; parent: ParentData; right: Original & { originalIndex: 2 } } {
  check(native.left.kind === 'axis-box' && native.options.operation === 'difference' && native.options.evaluationId === 'm7_difference' && native.options.resultIdPrefix === 'm7'
    && native.left.result.options.operation === 'union' && native.left.result.options.evaluationId === 'm4_union' && native.left.result.report.evaluationId === 'm4_union'
    && native.left.result.options.resultIdPrefix === 'm4', 'exact authored node7 difference/node4 union ownership');
  preflightModelingUnion(native.left.result, 'union');
  const g = geometry(native), parent = parentData(native.left.result), right = { originalIndex: 2 as const, ...originalData(native.right, native.rightModel) };
  const result = { qualification: qualification(native), geometry: { ...g, panels: g.panels.map((p, i) => ({ ...p,
    lineage: structuredClone(native.panels[i].lineage), parentPanels: structuredClone(native.panels[i].parentPanels) })) }, parent, right };
  validateParentData(parent); validateCompositionGeometry(result.qualification, result.geometry, parent, right);
  return result;
}
/** Call for every retained output before any output is sampled. Never calls native Boolean validation. */
export function preflightModelingComposition(native: Native): void { compositionData(native); }
function validateContext(context: OwnPlateHolePreviewContext, bodyId: string): void {
  exact(context, ['documentId', 'bodyId', 'documentRevision', 'kernelResultRevision', 'topologyRevision', 'taskToken']);
  token(context.documentId); token(context.taskToken); id(context.bodyId);
  check(context.bodyId === bodyId && /^(0|[1-9][0-9]{0,15})$/.test(context.documentRevision) && Number.isSafeInteger(Number(context.documentRevision))
    && context.kernelResultRevision === context.documentRevision && context.topologyRevision === context.documentRevision, 'full native request/body/revision context');
}
function validateMesh(mesh: OwnNativeFaceMesh, l: Geometry, bodyId: string): void {
  exact(mesh, ['format', 'version', 'lengthUnit', 'nativeFrame', 'context', 'chunks']); validateContext(mesh.context, bodyId);
  check(mesh.format === 'barocss-native-face-mesh' && mesh.version === 0 && mesh.lengthUnit === 'mm' && mesh.nativeFrame === 'part-xyz'
    && mesh.chunks.length === l.panels.length, 'raw complete native mesh inventory');
  for (const [i, p] of l.panels.entries()) {
    const chunk = mesh.chunks[i]; exact(chunk, ['faceToken', 'nativeFaceId', 'faceOrientation', 'normalSource', 'positionsMM', 'normals', 'parametersUV', 'indices']);
    const points = p.topology.vertices.map(v => v.point), normals = Array.from({ length: 4 }, () => [0, 1, 2].map(a => a === p.axis ? p.sign : 0)).flat();
    check(chunk.faceToken === p.id && chunk.nativeFaceId === p.id && chunk.faceOrientation === 'forward' && chunk.normalSource === 'own-tessellation'
      && same(chunk.positionsMM, [0, 3, 1, 2].flatMap(j => points[j])) && same(chunk.parametersUV, modelingUnionPanelUV(p.topology))
      && same(chunk.indices, [0, 2, 1, 2, 3, 1]) && chunk.normals.length === 12 && chunk.normals.every((n, j) => n === normals[j]), 'raw native sample order/XYZ/UV/normal/winding');
  }
}
function validateParent(parent: ModelingUnionDisplayComponent): void {
  exact(parent, ['family', 'role', 'solidId', 'mesh', 'qualification', 'lineage']); token(parent.role);
  validateParentData(parent); validateMesh(parent.mesh, parent.lineage, parent.solidId);
  validateModelingUnion(parent);
}
/** Samples actual retained native Surfaces. A reused parent needs exact retained-data correspondence. */
export function projectModelingComposition(native: Native, role: string, context: OwnPlateHolePreviewContext, tessellate: Tessellator, parentComponent?: ModelingUnionDisplayComponent): ModelingCompositionDisplayComponent {
  const data = compositionData(native); token(role); validateContext(context, data.geometry.body.id);
  check(native.left.kind === 'axis-box', 'direct union parent required');
  const parentContext = { ...context, bodyId: data.parent.solidId };
  const parent = parentComponent ?? projectModelingUnion(native.left.result, 'composition-parent', parentContext, tessellate, 'union');
  validateParent(parent);
  check(same(parent.mesh.context, parentContext) && parent.family === data.parent.family && parent.solidId === data.parent.solidId
    && same(parent.qualification, data.parent.qualification) && same(parent.lineage, data.parent.lineage), 'reused parent must match actual full native proof/support/topology/context');
  const chunks: OwnNativeFaceMesh['chunks'] = [];
  for (const p of data.geometry.panels) {
    const source = native.sources.find(s => s.sourceId === p.query.sourceId)!;
    const surface = source.model.objects.find((o): o is Surface => o.kind === 'surface' && o.id === p.query.surfaceId)!;
    const packet = tessellate(surface, { countU: 2, countV: 2, revision: Number(context.documentRevision) }).packet;
    chunks.push({ faceToken: p.id, nativeFaceId: p.id, faceOrientation: 'forward', normalSource: 'own-tessellation',
      positionsMM: [...packet.positions], normals: [...packet.normals], parametersUV: [...packet.parameters], indices: [...packet.indices] });
  }
  const result: ModelingCompositionDisplayComponent = { family: 'orthogonal-cell', role, solidId: data.geometry.body.id,
    mesh: { format: 'barocss-native-face-mesh', version: 0, lengthUnit: 'mm', nativeFrame: 'part-xyz', context: structuredClone(context), chunks },
    qualification: data.qualification, lineage: { ...data.geometry, parent: { nodeIndex: 4, evaluationId: 'm4_union', originalIndices: [0, 1],
      component: { ...structuredClone(parent), role: 'composition-parent' } }, right: data.right } };
  validateModelingComposition(result); return result;
}
/** One nonrecursive, self-contained parent proof. Receiving scene authority is created elsewhere. */
export function validateModelingComposition(component: ModelingCompositionDisplayComponent): void {
  exact(component, ['family', 'role', 'solidId', 'mesh', 'qualification', 'lineage']); token(component.role);
  check(component.family === 'orthogonal-cell', 'orthogonal display family required');
  const l = component.lineage; exact(l, ['body', 'grid', 'cells', 'shells', 'vertices', 'edges', 'panels', 'parent', 'right']);
  exact(l.parent, ['nodeIndex', 'evaluationId', 'originalIndices', 'component']);
  check(l.parent.nodeIndex === 4 && l.parent.evaluationId === 'm4_union' && same(l.parent.originalIndices, [0, 1])
    && l.parent.component.role === 'composition-parent', 'exact internal authored parent proof');
  validateParent(l.parent.component);
  validateCompositionGeometry(component.qualification, l, l.parent.component, l.right);
  check(component.solidId === l.body.id, 'composed solid identity'); validateMesh(component.mesh, l, component.solidId);
  check(same(l.parent.component.mesh.context, { ...component.mesh.context, bodyId: l.parent.component.solidId }), 'embedded parent shares complete current request context');
}

import type { AxisBoxSolidBooleanResult, OwnNativeFaceMesh, OwnPlateHolePreviewContext, Surface } from '@barocss/cad';

type Native = AxisBoxSolidBooleanResult;
type Point = [number, number, number];
type Query = { sourceId: string; sourceVersion: 0; modelId: string; surfaceId: string; faceId: string };
export interface ModelingUnionPanel {
  id: string; bodyId: string; shellId: string; axis: 0 | 1 | 2; sign: -1 | 1;
  vertexIds: string[]; edgeIds: string[]; query: Query;
  topology: Native['panels'][number]['bundle']['topology'];
  lineage: Native['panels'][number]['lineage'];
}
export interface ModelingUnionDisplayComponent {
  family: 'orthogonal-cell'; role: string; solidId: string; mesh: OwnNativeFaceMesh;
  qualification: Pick<Native['report'], 'schema' | 'version' | 'operation' | 'geometryFamily' | 'lengthUnit' | 'empty' | 'solid'
    | 'cellCount' | 'occupiedCellCount' | 'vertexCount' | 'edgeCount' | 'panelCount' | 'shellCount' | 'bodyCount' | 'sourceCount'
    | 'volumeMM3' | 'areaMM2' | 'incidence' | 'numericPolicy' | 'quality'>;
  lineage: { body: Native['bodies'][number]; grid: Native['grid']; cells: Native['cells']; shells: Native['shells'];
    vertices: { id: string; pointMM: Point }[]; edges: Native['edges']; panels: ModelingUnionPanel[];
    operands: { operand: 'a' | 'b'; sourceId: string; shellId: string; origin: Point; sides: Point;
      faces: { globalFaceId: string; query: Query; surface: Surface }[] }[] };
}
type Tessellator = (surface: Surface, options: { countU: number; countV: number; revision: number }) => {
  packet: { positions: number[]; normals: number[]; parameters: number[]; indices: number[] } };
function check(value: unknown, message: string): asserts value { if (!value) throw new Error('Orthogonal display: ' + message); }
// Transport records have no insertion-order contract; arrays retain their native order.
// Inspect own data descriptors before reading values so accessors/symbols are never admitted.
function equal(a: unknown, b: unknown): boolean {
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') {
    return typeof a === typeof b && (typeof a === 'number' ? Number.isFinite(a) && a === b
      : (typeof a === 'string' || typeof a === 'boolean') && a === b);
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ad = Object.getOwnPropertyDescriptors(a), bd = Object.getOwnPropertyDescriptors(b);
  const ak = Reflect.ownKeys(ad), bk = Reflect.ownKeys(bd);
  if (ak.length !== bk.length || ak.some(k => typeof k !== 'string' || !Object.hasOwn(bd, k))) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length || ak.length !== a.length + 1
      || !ak.every(k => k === 'length' || (typeof k === 'string' && /^(0|[1-9][0-9]*)$/.test(k) && Number(k) < a.length))) return false;
  }
  return ak.every(k => {
    const x = ad[k as string], y = bd[k as string];
    return Object.hasOwn(x, 'value') && Object.hasOwn(y, 'value') && x.enumerable === y.enumerable
      && (k === 'length' && Array.isArray(a) ? x.value === y.value : x.enumerable === true && equal(x.value, y.value));
  });
}
function exact(value: object, fields: string[]): void {
  check(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === fields.length
    && fields.every(k => Object.hasOwn(value, k)), 'exact copied fields required: ' + fields.join(','));
}
function id(value: unknown): asserts value is string { check(typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_-]{0,127}$/.test(value), 'bounded native identity'); }
function safe(value: number): number { check(Number.isSafeInteger(value), 'safe integer arithmetic required'); return value; }
function tuple(v: number[], size: number): void { check(Array.isArray(v) && v.length === size && v.every(Number.isSafeInteger), 'integer tuple required'); }
function unique(values: string[]): void { values.forEach(id); check(new Set(values).size === values.length, 'duplicate native identities'); }
/** All outputs call this before any output tessellation, including hidden convex operands. */
export function preflightModelingUnion(native: Native, operation: 'union' | 'difference' = 'union'): void {
  check(native.panels.length >= 1 && native.panels.length <= 64, 'complete preview requires 1..64 panels; native limit72 is separate');
  check(['union', 'difference'].includes(operation) && native.report.operation === operation && native.report.bodyCount === 1 && native.bodies.length === 1
    && native.report.solid === true && native.report.empty === false, 'one positive-volume matching orthogonal body required');
  check(native.report.panelCount === native.panels.length && native.sources.length === native.panels.length
    && native.report.sourceCount === native.panels.length, 'complete native panel/source inventory');
  check(safe(native.report.volumeMM3) > 0 && native.report.volumeMM3 <= 2e12
    && native.bodies[0].volumeMM3 === native.report.volumeMM3, 'native integer volume correspondence');
}
/** Native local endpoints, never invented UV or an inferred source name. */
export function modelingUnionPanelUV(topology: ModelingUnionPanel['topology']): number[] {
  exact(topology, ['version', 'face', 'vertices', 'edges', 'loop']); check(topology.version === 0, 'native topology version');
  const { vertices, edges, loop, face } = topology;
  exact(face, ['id', 'surfaceId', 'outerLoopId', 'orientation']); [face.id, face.surfaceId, face.outerLoopId].forEach(id);
  exact(loop, ['id', 'uses']); unique(vertices.map(v => v.id)); unique(edges.map(e => e.id));
  for (const vertex of vertices) { exact(vertex, ['id', 'point']); tuple(vertex.point, 3); }
  for (const [i, edge] of edges.entries()) { exact(edge, ['id', 'curveId', 'vertexIds']); id(edge.curveId);
    check(equal(edge.vertexIds, [vertices[i].id, vertices[(i + 1) % 4].id]), 'original ordered native local edge endpoints'); }
  unique(loop.uses.map(u => u.edgeId));
  check(vertices.length === 4 && edges.length === 4 && loop.uses.length === 4 && face.outerLoopId === loop.id
    && face.orientation === 'forward', 'complete forward rectangular native face');
  const uv = new Map<string, number[]>();
  const corners = [[0, 0], [1, 0], [1, 1], [0, 1]], boundaries = ['v-min', 'u-max', 'v-max', 'u-min'];
  for (const [index, use] of loop.uses.entries()) {
    exact(use, ['edgeId', 'sense', 'boundary', 'pcurve']); exact(use.pcurve, ['domain', 'uv0', 'uv1']);
    const edge = edges[index]; check(use.edgeId === edge.id && use.sense === 'forward', 'original ordered directed pcurve edge required');
    check(equal(use.pcurve.domain, [0, 1]) && use.boundary === boundaries[index]
      && equal(use.pcurve.uv0, corners[index]) && equal(use.pcurve.uv1, corners[(index + 1) % 4]), 'complete native rectangular UV cycle');
    const axis = use.boundary.startsWith('u') ? 0 : 1, endpoint = use.boundary.endsWith('min') ? 0 : 1;
    check(use.pcurve.uv0[axis] === endpoint && use.pcurve.uv1[axis] === endpoint, 'native boundary label/UV correspondence');
    for (const [i, point] of [use.pcurve.uv0, use.pcurve.uv1].entries()) {
      tuple(point, 2); check(point.every(v => v === 0 || v === 1), 'native rectangular parameter endpoint');
      const key = edge.vertexIds[i], previous = uv.get(key); check(!previous || equal(previous, point), 'incident native UV endpoints disagree'); uv.set(key, point);
    }
  }
  check(uv.size === 4 && vertices.every(v => uv.has(v.id)), 'complete native vertex UV association');
  return [0, 3, 1, 2].flatMap(i => uv.get(vertices[i].id)!);
}
/** Worker-only raw surface sampling. No axis conversion and no Boolean revalidation here. */
export function projectModelingUnion(native: Native, role: string, context: OwnPlateHolePreviewContext, tessellate: Tessellator, operation: 'union' | 'difference' = 'union'): ModelingUnionDisplayComponent {
  preflightModelingUnion(native, operation);
  const panels: ModelingUnionPanel[] = [], chunks: OwnNativeFaceMesh['chunks'] = [];
  for (const panel of native.panels) {
    const source = native.sources.find(s => s.sourceId === panel.sourceId), shell = native.shells.find(s => s.panelIds.includes(panel.id));
    const topology = panel.bundle.topology;
    check(source && source.panelId === panel.id && source.sourceVersion === 0 && equal(source.model, panel.bundle.geometry)
      && source.model.objects.length === 5 && shell?.bodyId === panel.bodyId, 'native generated source/body/shell binding');
    const surface = source.model.objects.find((o): o is Surface => o.kind === 'surface' && o.id === topology.face.surfaceId);
    check(surface && surface.degreeU === 1 && surface.degreeV === 1 && topology.face.id === panel.id, 'actual generated panel Surface required');
    const parameters = modelingUnionPanelUV(topology), packet = tessellate(surface, { countU: 2, countV: 2, revision: Number(context.documentRevision) }).packet;
    check(packet.positions.length === 12 && packet.normals.length === 12 && equal(packet.parameters, parameters)
      && equal(packet.indices, [0, 2, 1, 2, 3, 1]), 'actual native 2x2 packet layout differs');
    for (const [i, index] of [0, 3, 1, 2].entries()) {
      const vertex = native.vertices.find(v => v.id === panel.vertexIds[index]);
      check(vertex && equal(vertex.pointMM, topology.vertices[index].point)
        && vertex.pointMM.every((v, a) => Object.is(v, packet.positions[i * 3 + a]))
        && [0, 1, 2].every(a => packet.normals[i * 3 + a] === (a === panel.axis ? panel.sign : 0)), 'actual sample/native corner or normal mismatch');
    }
    panels.push({ id: panel.id, bodyId: panel.bodyId, shellId: shell.id, axis: panel.axis, sign: panel.sign,
      vertexIds: [...panel.vertexIds], edgeIds: [...panel.edgeIds], query: { sourceId: source.sourceId, sourceVersion: 0,
        modelId: source.model.name, surfaceId: surface.id, faceId: topology.face.id }, topology: structuredClone(topology), lineage: structuredClone(panel.lineage) });
    chunks.push({ faceToken: panel.id, nativeFaceId: topology.face.id, faceOrientation: 'forward', normalSource: 'own-tessellation',
      positionsMM: [...packet.positions], normals: [...packet.normals], parametersUV: [...packet.parameters], indices: [...packet.indices] });
  }
  const r = native.report;
  const qualification: ModelingUnionDisplayComponent['qualification'] = { schema: r.schema, version: r.version, operation: r.operation, geometryFamily: r.geometryFamily,
    lengthUnit: r.lengthUnit, empty: r.empty, solid: r.solid, cellCount: r.cellCount, occupiedCellCount: r.occupiedCellCount, vertexCount: r.vertexCount,
    edgeCount: r.edgeCount, panelCount: r.panelCount, shellCount: r.shellCount, bodyCount: r.bodyCount, sourceCount: r.sourceCount,
    volumeMM3: r.volumeMM3, areaMM2: r.areaMM2, incidence: structuredClone(r.incidence), numericPolicy: structuredClone(r.numericPolicy), quality: structuredClone(r.quality) };
  return { family: 'orthogonal-cell', role, solidId: native.bodies[0].id,
    mesh: { format: 'barocss-native-face-mesh', version: 0, lengthUnit: 'mm', nativeFrame: 'part-xyz', context: structuredClone(context), chunks }, qualification,
    lineage: { body: structuredClone(native.bodies[0]), grid: structuredClone(native.grid), cells: structuredClone(native.cells), shells: structuredClone(native.shells),
      vertices: native.vertices.map(({ id, pointMM }) => ({ id, pointMM: [...pointMM] })), edges: structuredClone(native.edges), panels,
      operands: (['a', 'b'] as const).map((operand, i) => ({ operand, sourceId: native[operand].sourceId, shellId: native[operand].shell.id,
        origin: [...native[operand].shell.origin], sides: [...native[operand].shell.sides], faces: r.operandBindings[i].faces.map(f => {
          const surface = native.originalModels[i].objects.find((o): o is Surface => o.kind === 'surface' && o.id === f.surfaceId);
          check(surface, 'original operand surface binding');
          return { globalFaceId: f.globalFaceId, query: { sourceId: native[operand].sourceId, sourceVersion: 0, modelId: native.originalModels[i].name,
            surfaceId: f.surfaceId, faceId: f.localFaceId }, surface: structuredClone(surface) };
        }) })) } };
}
function query(q: Query): void { exact(q, ['sourceId', 'sourceVersion', 'modelId', 'surfaceId', 'faceId']); check(q.sourceVersion === 0, 'Source0 query required'); [q.sourceId, q.modelId, q.surfaceId, q.faceId].forEach(id); }
function fraction(f: { numerator: string; denominator: string }): [bigint, bigint] {
  exact(f, ['numerator', 'denominator']); check(/^(0|[1-9][0-9]{0,9})$/.test(f.numerator) && /^[1-9][0-9]{0,9}$/.test(f.denominator), 'bounded positive exact UV ratio');
  const n = BigInt(f.numerator), d = BigInt(f.denominator); check(n <= d, 'native UV ratio outside support');
  let a = n, b = d; while (b) [a, b] = [b, a % b]; check(a === 1n, 'native UV ratio must be reduced'); return [n, d];
}
/** Receiving structural correspondence only; copied native qualification is not recertified. */
export function validateModelingUnion(component: ModelingUnionDisplayComponent): void {
  exact(component, ['family', 'role', 'solidId', 'mesh', 'qualification', 'lineage']);
  const { qualification: q, lineage: l, mesh } = component;
  exact(q, ['schema', 'version', 'operation', 'geometryFamily', 'lengthUnit', 'empty', 'solid', 'cellCount', 'occupiedCellCount', 'vertexCount', 'edgeCount', 'panelCount', 'shellCount', 'bodyCount', 'sourceCount', 'volumeMM3', 'areaMM2', 'incidence', 'numericPolicy', 'quality']);
  check(q.schema === 'barocss-axis-box-solid-boolean' && q.version === 0 && ['union', 'difference'].includes(q.operation) && q.geometryFamily === 'exact-integer-orthogonal-cell-solid-v0'
    && q.lengthUnit === 'mm' && q.empty === false && q.solid === true && q.bodyCount === 1, 'restricted integer-cell qualification required');
  check(equal(q.quality, { restrictedCellModelEmbeddingCertified: true, restrictedBoundaryManifoldCertified: true, regularizedMaterialCertified: true,
    arbitraryCurvedSolidCertified: false, globalBinary64EvaluationErrorCertified: false, manufacturingToleranceCertified: false,
    nativePanelFaceSubsetSolidFalse: true, weldingPerformed: false, ownership: 'independent-copied-cpu-data-gc' }), 'copied restricted quality flags');
  check(equal(q.numericPolicy, { material: 'regularized-closure-of-occupied-open-integer-cells', generatedZero: 'canonical-positive-zero-original-bits-retained',
    identity: 'exact-original-coordinate-plane-grid-indices-no-tolerance-welding', source: 'whole-original-models-and-per-panel-native-model5',
    lineageUV: 'exact-reduced-integer-ratio-fractions', volume: 'occupied-cell-volume-equals-sum-of-oriented-shell-volumes',
    euler: 'diagnostic-no-sphere-or-single-shell-requirement', pointComparisonMM: 1e-9, relativeDerivativeComparison: 1e-9 }), 'native numeric policy');
  exact(l, ['body', 'grid', 'cells', 'shells', 'vertices', 'edges', 'panels', 'operands']);
  check(l.panels.length >= 1 && l.panels.length <= 64 && mesh.chunks.length === l.panels.length && q.panelCount === l.panels.length && q.sourceCount === l.panels.length
    && q.vertexCount === l.vertices.length && l.vertices.length <= 64 && q.edgeCount === l.edges.length && l.edges.length <= 144
    && q.shellCount === l.shells.length && q.cellCount === l.cells.length && l.cells.length <= 27, 'complete bounded native inventories');
  unique(l.panels.map(p => p.id)); unique(l.panels.map(p => p.query.sourceId)); unique(l.vertices.map(v => v.id)); unique(l.edges.map(e => e.id)); unique(l.shells.map(s => s.id));
  const body = l.body; exact(body, ['id', 'cellIndices', 'shellIds', 'volumeMM3', 'areaMM2', 'boundsMM', 'closed', 'solid', 'embeddedIntegerCellModelCertified']);
  check(body.id === component.solidId && body.closed === true && body.solid === true && body.embeddedIntegerCellModelCertified === true
    && safe(q.volumeMM3) > 0 && q.volumeMM3 <= 2e12 && body.volumeMM3 === q.volumeMM3 && body.areaMM2 === q.areaMM2, 'exact one-body volume/bounds identity');
  exact(l.grid, ['x', 'y', 'z']); const grid = [l.grid.x, l.grid.y, l.grid.z];
  grid.forEach(g => check(g.length >= 2 && g.length <= 4 && g.every((v, i) => Number.isSafeInteger(v) && Math.abs(v) <= 10000 && (i === 0 || v > g[i - 1])), 'native integer plane grid'));
  let volume = 0; const occupied: number[][] = [], cells = new Set<string>();
  for (const cell of l.cells) {
    exact(cell, ['index', 'insideA', 'insideB', 'occupied', 'bodyId', 'emptyRegionId', 'volumeMM3']); tuple(cell.index, 3);
    check(cell.index.every((v, a) => v >= 0 && v + 1 < grid[a].length) && !cells.has(cell.index.join(',')), 'complete unique cell grid'); cells.add(cell.index.join(','));
    check(typeof cell.insideA === 'boolean' && typeof cell.insideB === 'boolean' && cell.occupied === (q.operation === 'union' ? cell.insideA || cell.insideB : cell.insideA && !cell.insideB), 'operation-specific cell occupancy');
    const size = cell.index.map((v, a) => safe(grid[a][v + 1] - grid[a][v])); const value = safe(safe(size[0] * size[1]) * size[2]);
    check(value === cell.volumeMM3 && cell.bodyId === (cell.occupied ? body.id : null), 'native cell volume/body');
    if (cell.occupied) { volume = safe(volume + value); occupied.push(cell.index); }
  }
  check(cells.size === grid.reduce((n, g) => n * (g.length - 1), 1) && volume === q.volumeMM3 && q.occupiedCellCount === occupied.length
    && equal(body.cellIndices.map(v => v.join(',')).sort(), occupied.map(v => v.join(',')).sort()), 'occupied-cell volume conservation');
  check(equal(body.shellIds, l.shells.map(s => s.id)) && safe(l.shells.reduce((n, s) => safe(n + safe(s.signedVolumeMM3)), 0)) === volume, 'oriented-shell volume conservation');
  for (const v of l.vertices) { exact(v, ['id', 'pointMM']); tuple(v.pointMM, 3); check(v.pointMM.every((n, a) => grid[a].includes(n)), 'native grid vertex'); }
  check(l.operands.length === 2 && l.operands[0].operand === 'a' && l.operands[1].operand === 'b', 'both original operand bindings required');
  for (const operand of l.operands) {
    exact(operand, ['operand', 'sourceId', 'shellId', 'origin', 'sides', 'faces']); id(operand.sourceId); id(operand.shellId); tuple(operand.origin, 3); tuple(operand.sides, 3);
    check(operand.sides.every(v => v >= 1 && v <= 10000) && operand.origin.every((v, a) => Math.abs(v) <= 10000 && Math.abs(safe(v + operand.sides[a])) <= 10000) && operand.faces.length === 6, 'complete rectangular operand'); unique(operand.faces.map(f => f.globalFaceId));
    const planes = new Set<string>();
    for (const face of operand.faces) {
      exact(face, ['globalFaceId', 'query', 'surface']); query(face.query); check(face.query.sourceId === operand.sourceId && face.query.surfaceId === face.surface.id, 'operand original source query');
      const s = face.surface; exact(s, ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']);
      check(s.kind === 'surface' && s.degreeU === 1 && s.degreeV === 1 && equal(s.knotsU, [0, 0, 1, 1]) && equal(s.knotsV, [0, 0, 1, 1])
        && equal(s.weights, [[1, 1], [1, 1]]) && s.controlPoints.length === 2 && s.controlPoints.every(row => row.length === 2), 'native operand bilinear support');
      s.controlPoints.flat().forEach(p => { tuple(p, 3); check(p.every((n, a) => n === operand.origin[a] || n === operand.origin[a] + operand.sides[a]), 'original box support corner'); });
      const cp = s.controlPoints, u = cp[1][0].map((n, a) => n - cp[0][0][a]), v = cp[0][1].map((n, a) => n - cp[0][0][a]);
      const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], axis = normal.findIndex(n => n !== 0);
      check(axis >= 0 && normal.every((n, a) => a === axis || n === 0) && cp[1][1].every((n, a) => n === cp[0][0][a] + u[a] + v[a])
        && s.controlPoints.flat().every(p => p[axis] === operand.origin[axis] + (normal[axis] > 0 ? operand.sides[axis] : 0)), 'original outward box support orientation');
      check(!planes.has(axis + ':' + Math.sign(normal[axis])), 'unique original support plane'); planes.add(axis + ':' + Math.sign(normal[axis]));
    }
    check(planes.size === 6, 'all six source-qualified box support planes');
  }
  for (const cell of l.cells) for (const operand of l.operands) {
    const inside = cell.index.every((v, a) => grid[a][v] >= operand.origin[a] && grid[a][v + 1] <= safe(operand.origin[a] + operand.sides[a]));
    check((operand.operand === 'a' ? cell.insideA : cell.insideB) === inside, 'native cell/original operand occupancy');
  }
  const panelAreas = new Map<string, number>(), panelVolumes3 = new Map<string, number>();
  for (const [i, p] of l.panels.entries()) {
    exact(p, ['id', 'bodyId', 'shellId', 'axis', 'sign', 'vertexIds', 'edgeIds', 'query', 'topology', 'lineage']); query(p.query);
    check(p.bodyId === body.id && l.shells.some(s => s.id === p.shellId && s.bodyId === p.bodyId && s.panelIds.includes(p.id))
      && p.query.faceId === p.id && p.query.surfaceId === p.topology.face.surfaceId && p.topology.face.id === p.id, 'panel native source/shell/face binding');
    check([0, 1, 2].includes(p.axis) && [-1, 1].includes(p.sign) && p.vertexIds.length === 4 && p.edgeIds.length === 4, 'native panel cardinality');
    unique(p.vertexIds); unique(p.edgeIds);
    const positions = p.vertexIds.map((key, j) => { const v = l.vertices.find(v => v.id === key); check(v && equal(v.pointMM, p.topology.vertices[j].point), 'native panel vertex binding'); return v.pointMM; });
    const u = positions[1].map((n, a) => safe(n - positions[0][a])), v = positions[3].map((n, a) => safe(n - positions[0][a]));
    const cross = [safe(u[1] * v[2] - u[2] * v[1]), safe(u[2] * v[0] - u[0] * v[2]), safe(u[0] * v[1] - u[1] * v[0])];
    check(cross.every((n, a) => a === p.axis ? n * p.sign > 0 : n === 0)
      && positions[2].every((n, a) => n === safe(positions[0][a] + u[a] + v[a])), 'oriented complete integer rectangular panel');
    const area = Math.abs(cross[p.axis]); panelAreas.set(p.id, area); panelVolumes3.set(p.id, safe(safe(positions[0][p.axis] * area) * p.sign));
    const c = mesh.chunks[i]; check(c.faceToken === p.id && c.nativeFaceId === p.id && c.faceOrientation === 'forward' && c.normalSource === 'own-tessellation'
      && equal(c.positionsMM, [0, 3, 1, 2].flatMap(j => positions[j])) && equal(c.parametersUV, modelingUnionPanelUV(p.topology))
      && equal(c.indices, [0, 2, 1, 2, 3, 1]) && equal(c.normals, Array.from({ length: 4 }, () => [0, 1, 2].map(a => a === p.axis ? p.sign : 0)).flat()), 'raw native panel arrays/order/UV/winding');
    check(p.lineage.length >= 1 && p.lineage.length <= 2, 'complete contributing operand face lineage');
    unique(p.lineage.map(x => x.operand + '_' + x.globalFaceId));
    const contributors = l.operands.flatMap(o => o.faces.filter(f => {
      const points = f.surface.controlPoints.flat(), min = [0, 1, 2].map(a => Math.min(...points.map(v => v[a]))), max = [0, 1, 2].map(a => Math.max(...points.map(v => v[a])));
      return min[p.axis] === max[p.axis] && positions.every(v => v.every((n, a) => n >= min[a] && n <= max[a]));
    }).map(f => o.operand + '_' + f.globalFaceId));
    check(equal(contributors.sort(), p.lineage.map(x => x.operand + '_' + x.globalFaceId).sort()), 'every contributing operand face must remain');
    for (const link of p.lineage) {
      exact(link, ['operand', 'sourceId', 'shellId', 'globalFaceId', 'localFaceId', 'surfaceId', 'relativeOrientation', 'uvCorners']);
      const operand = l.operands.find(o => o.operand === link.operand), face = operand?.faces.find(f => f.globalFaceId === link.globalFaceId);
      check(operand && face && link.sourceId === operand.sourceId && link.shellId === operand.shellId && link.localFaceId === face.query.faceId
        && link.surfaceId === face.query.surfaceId && [-1, 1].includes(link.relativeOrientation) && link.uvCorners.length === 4, 'original operand lineage source query');
      const cp = face.surface.controlPoints, du = cp[1][0].map((v, a) => v - cp[0][0][a]), dv = cp[0][1].map((v, a) => v - cp[0][0][a]);
      const normal = [du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]];
      check(normal[p.axis] !== 0 && normal.every((n, a) => a === p.axis || n === 0)
        && link.relativeOrientation === Math.sign(normal[p.axis]) * p.sign, 'native operand relative orientation');
      for (const [j, uv] of link.uvCorners.entries()) {
        check(uv.length === 2, 'native UV corner pair'); const [u, du] = fraction(uv[0]), [v, dv] = fraction(uv[1]);
        const cp = face.surface.controlPoints, weights = [(du - u) * (dv - v), u * (dv - v), u * v, (du - u) * v];
        for (let a = 0; a < 3; a++) check([cp[0][0], cp[1][0], cp[1][1], cp[0][1]].reduce((sum, point, k) => sum + BigInt(point[a]) * weights[k], 0n)
          === BigInt(positions[j][a]) * du * dv, 'exact native lineage UV/XYZ correspondence');
      }
    }
  }
  for (const e of l.edges) {
    exact(e, ['id', 'vertexIds', 'canonical', 'uses']); exact(e.canonical, ['sourceId', 'faceId', 'localEdgeId', 'curveId']);
    check(e.vertexIds.length === 2 && e.vertexIds[0] !== e.vertexIds[1] && e.uses.length === 2 && e.uses[0].sense !== e.uses[1].sense, 'paired opposite native edge uses');
    for (const use of e.uses) {
      exact(use, ['sourceId', 'faceId', 'localEdgeId', 'curveId', 'sense']);
      const panel = l.panels.find(p => p.id === use.faceId), index = panel?.topology.edges.findIndex(x => x.id === use.localEdgeId);
      check(panel && index !== undefined && index >= 0, 'native edge use panel/local edge');
      const local = panel.topology.edges[index], endpoints = [panel.vertexIds[index], panel.vertexIds[(index + 1) % 4]];
      check(panel.query.sourceId === use.sourceId && panel.edgeIds[index] === e.id && local.curveId === use.curveId
        && (equal(e.vertexIds, endpoints) ? use.sense === 'forward' : equal(e.vertexIds, [...endpoints].reverse()) && use.sense === 'reverse'), 'complete native edge source/vertex/sense binding');
    }
    check(e.uses.some(({ sense: _sense, ...use }) => equal(use, e.canonical)), 'original canonical edge reference');
  }
  const setEqual = (a: string[], b: string[]) => equal([...new Set(a)].sort(), [...new Set(b)].sort());
  check(setEqual(l.vertices.map(v => v.id), l.panels.flatMap(p => p.vertexIds)) && setEqual(l.edges.map(e => e.id), l.panels.flatMap(p => p.edgeIds)), 'complete used global topology');
  const all = l.shells.flatMap(s => s.panelIds); check(all.length === l.panels.length && new Set(all).size === all.length && all.every(p => l.panels.some(x => x.id === p)), 'complete unique shell panel coverage');
  for (const shell of l.shells) {
    exact(shell, ['id', 'bodyId', 'emptyRegionId', 'role', 'panelIds', 'edgeIds', 'vertexIds', 'eulerCharacteristic', 'signedVolumeMM3', 'areaMM2']);
    const panels = l.panels.filter(p => p.shellId === shell.id), area = shell.panelIds.reduce((n, id) => safe(n + panelAreas.get(id)!), 0), volume3 = shell.panelIds.reduce((n, id) => safe(n + panelVolumes3.get(id)!), 0);
    check(shell.bodyId === body.id && ['outer', 'cavity'].includes(shell.role) && shell.panelIds.length === panels.length && setEqual(shell.panelIds, panels.map(p => p.id))
      && setEqual(shell.edgeIds, panels.flatMap(p => p.edgeIds)) && setEqual(shell.vertexIds, panels.flatMap(p => p.vertexIds))
      && shell.eulerCharacteristic === shell.vertexIds.length - shell.edgeIds.length + shell.panelIds.length
      && area === shell.areaMM2 && volume3 % 3 === 0 && volume3 / 3 === shell.signedVolumeMM3
      && (shell.role === 'outer' ? volume3 > 0 : volume3 < 0), 'complete copied shell geometry correspondence');
  }
  exact(body.boundsMM, ['min', 'max']); tuple(body.boundsMM.min, 3); tuple(body.boundsMM.max, 3);
  check(body.boundsMM.min.every((n, a) => n === Math.min(...l.vertices.map(v => v.pointMM[a])))
    && body.boundsMM.max.every((n, a) => n === Math.max(...l.vertices.map(v => v.pointMM[a])))
    && safe(q.areaMM2) > 0 && q.areaMM2 <= 1200000000 && l.shells.reduce((n, s) => safe(n + s.areaMM2), 0) === q.areaMM2, 'complete native body bounds/area');
  check(equal(q.incidence, { allBoundaryTilesAccounted: true, internalFacesCancelled: true, everyEdgeTwoOppositeUses: true, orientedVertexLinksSingleCycles: true,
    cornerCount: l.panels.length * 4, edgeUseCount: l.panels.length * 4, panelEdgeEquation: true }), 'native incidence qualification');
}

/** Neutral aliases; the original union names remain source-compatible. */
export type ModelingOrthogonalPanel = ModelingUnionPanel;
export type ModelingOrthogonalDisplayComponent = ModelingUnionDisplayComponent;

import { createNativeUVGraphPredicates } from './intersect/own-convex-planar-face-holes-preview.js';
import type { Point } from './types.js';
import type { CoplanarFaceBooleanResult } from './coplanar-face-boolean.js';
import type { CoplanarFaceBooleanMeshOptions, CoplanarFaceBooleanMeshVertex, CoplanarFaceBooleanMeshTriangulation,
  CoplanarFaceBooleanMeshEdgeUse, CoplanarFaceBooleanMeshDiagnosticCode } from './coplanar-face-boolean-mesh.js';

type Check = (condition: boolean, code: CoplanarFaceBooleanMeshDiagnosticCode, detail: string) => void;
type Native = <T>(action: () => T, detail: string, code?: CoplanarFaceBooleanMeshDiagnosticCode) => T;
export interface CoplanarMaterialGraphWork {
  candidatePairCount: number; predicateTestCount: number; triangleTestCount: number; vertexTripleTestCount: number; trianglePairTestCount: number;
}
/** INTERNAL: native vertices only; temporary numeric probes never become mesh or Surface-query vertices. */
export function triangulateCoplanarMaterial(region: CoplanarFaceBooleanResult, vertices: CoplanarFaceBooleanMeshVertex[],
  options: CoplanarFaceBooleanMeshOptions, role: (suffix: string) => string, check: Check, native: Native):
  { triangulation: CoplanarFaceBooleanMeshTriangulation; work: CoplanarMaterialGraphWork } {
  const work: CoplanarMaterialGraphWork = { candidatePairCount: 0, predicateTestCount: 0, triangleTestCount: 0, vertexTripleTestCount: 0, trianglePairTestCount: 0 };
  const finite = (value: number): number => { check(Number.isFinite(value), 'REPRESENTABILITY', 'finite material graph arithmetic required'); return value; };
  const product = (a: number, b: number): number => {
    const value = finite(a * b); check(a === 0 || b === 0 || value !== 0, 'REPRESENTABILITY', 'nonzero material graph product underflow'); return value;
  };
  const uv: Point[] = vertices.map(vertex => [vertex.uv[0], vertex.uv[1], 0]);
  const indexById = new Map(vertices.map(vertex => [vertex.nativeVertexId, vertex.index]));
  const key = (a: number, b: number): string => a < b ? a + ':' + b : b + ':' + a;
  const tick = (): void => {
    work.predicateTestCount++;
    check(work.predicateTestCount <= options.maximumPredicateTests && work.predicateTestCount <= 2000000, 'BUDGET', 'actual native determinant predicate budget exceeded');
  };
  const predicates = createNativeUVGraphPredicates(uv, (condition, detail) => check(condition, 'UNCERTAINTY', detail), 'Coplanar face Boolean mesh graph', tick);
  const orientation = (a: number, b: number, c: number): number => native(() => predicates.orientation(a, b, c), 'actual shared native UV orientation', 'UNCERTAINTY');
  const compatible = (a: number, b: number, c: number, d: number): boolean => native(() => predicates.compatibleSegments(a, b, c, d), 'actual shared native UV segment compatibility', 'UNCERTAINTY');
  const separated = (a: number[], b: number[]): boolean => native(() => predicates.separatedPolygons(a, b), 'actual shared native UV separating axes', 'UNCERTAINTY');
  const triangleTick = (pair: boolean): void => {
    work.triangleTestCount++; if (pair) work.trianglePairTestCount++; else work.vertexTripleTestCount++;
    check(work.triangleTestCount <= options.maximumTriangleTests && work.triangleTestCount <= 50000, 'BUDGET', 'actual enumerated vertex-triple/triangle-pair budget exceeded');
  };
  const loopIndices = new Map(region.loops.map(loop => [loop.id, loop.vertexIds.map(id => {
    const index = indexById.get(id); check(index !== undefined, 'INCIDENCE', 'actual selected loop vertex index required'); return index!;
  })]));
  const triangulation: CoplanarFaceBooleanMeshTriangulation = { method: 'maximal-visible-native-vertex-planar-graph',
    bridges: [], internalEdges: [], triangles: [], boundaryIncidence: [], components: [] };
  let diagonalCount = 0;
  for (const component of region.components) {
    const local = vertices.filter(vertex => vertex.componentId === component.id).map(vertex => vertex.index);
    check(local.length >= 3, 'INCIDENCE', 'nonempty native material component requires at least three vertices');
    const outer = loopIndices.get(component.outerLoopId), holes = component.holeLoopIds.map(id => loopIndices.get(id));
    check(outer !== undefined && holes.every(hole => hole !== undefined), 'INCIDENCE', 'actual component outer/hole loop indices required');
    const outerIndices = outer!, holeIndices = holes as number[][];
    const componentLoopIds = [component.outerLoopId, ...component.holeLoopIds];
    const boundary = region.loops.filter(loop => componentLoopIds.includes(loop.id)).flatMap(loop => loop.uses.map(use => {
      const from = indexById.get(use.vertexIds[0]), to = indexById.get(use.vertexIds[1]);
      const fragment = region.fragments.find(fragment => fragment.useId === use.id);
      check(from !== undefined && to !== undefined && fragment !== undefined, 'INCIDENCE', 'actual directed boundary fragment/index association required');
      return { loopId: loop.id, fragmentId: fragment!.id, edgeId: use.edgeId, useId: use.id, curveId: use.curveId, pair: [from!, to!] as [number, number] };
    }));
    type GraphEdge = { pair: [number, number]; boundary: boolean; bridge: boolean };
    const graph = new Map<string, GraphEdge>();
    const parents = vertices.map((_, index) => index);
    const find = (index: number): number => { while (parents[index] !== index) index = parents[index]; return index; };
    const join = (a: number, b: number): boolean => { const x = find(a), y = find(b); if (x === y) return false; parents[y] = x; return true; };
    for (const edge of boundary) {
      check(!graph.has(key(...edge.pair)), 'INCIDENCE', 'native directed boundary has a repeated indexed edge');
      graph.set(key(...edge.pair), { pair: edge.pair, boundary: true, bridge: false }); join(...edge.pair);
    }
    // A probe has no geometric identity, no output slot and no D1 query.
    const probe = <T>(point: Point, action: (index: number) => T): T => {
      const index = uv.length; uv.push(point); try { return action(index); } finally { uv.pop(); }
    };
    const winding = (point: number, polygon: number[]): { inside: boolean; boundary: boolean } => {
      let value = 0;
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length], o = orientation(a, b, point);
        if (o === 0 && predicates.onSegment(a, b, point)) return { inside: false, boundary: true };
        if (uv[a][1] <= uv[point][1] && uv[b][1] > uv[point][1] && o > 0) value++;
        else if (uv[a][1] > uv[point][1] && uv[b][1] <= uv[point][1] && o < 0) value--;
      }
      return { inside: value !== 0, boundary: false };
    };
    const material = (point: Point): boolean => probe(point, index => {
      const outerState = winding(index, outerIndices);
      if (!outerState.inside || outerState.boundary) return false;
      return holeIndices.every(hole => { const state = winding(index, hole); return !state.inside && !state.boundary; });
    });
    const midpoint = (a: number, b: number): Point => {
      const difference = uv[b].map((value, axis) => finite(value - uv[a][axis])) as Point;
      const point = uv[a].map((value, axis) => finite(value + product(.5, difference[axis]))) as Point;
      const axis = Math.abs(difference[0]) >= Math.abs(difference[1]) ? 0 : 1;
      check(point[axis] > Math.min(uv[a][axis], uv[b][axis]) && point[axis] < Math.max(uv[a][axis], uv[b][axis]),
        'REPRESENTABILITY', 'strict visible-segment midpoint is not represented'); return point;
    };
    const candidates: { pair: [number, number]; lengthSquared: number }[] = [];
    for (let i = 0; i < local.length; i++) for (let j = i + 1; j < local.length; j++) {
      const a = local[i], b = local[j]; if (graph.has(key(a, b))) continue;
      work.candidatePairCount++;
      check(work.candidatePairCount <= options.maximumCandidatePairs && work.candidatePairCount <= 2016, 'BUDGET', 'complete component candidate-pair budget exceeded');
      const dx = finite(uv[b][0] - uv[a][0]), dy = finite(uv[b][1] - uv[a][1]);
      const lengthSquared = finite(product(dx, dx) + product(dy, dy));
      check(lengthSquared > 0, 'REPRESENTABILITY', 'distinct actual native UV vertices have an unrepresented squared distance');
      candidates.push({ pair: [a, b], lengthSquared });
    }
    candidates.sort((a, b) => a.lengthSquared < b.lengthSquared ? -1 : a.lengthSquared > b.lengthSquared ? 1 : a.pair[0] - b.pair[0] || a.pair[1] - b.pair[1]);
    let bridgeCount = 0;
    for (const candidate of candidates) {
      const [a, b] = candidate.pair;
      if (boundary.some(edge => !compatible(a, b, ...edge.pair))) continue;
      if (local.some(index => index !== a && index !== b && orientation(a, b, index) === 0 && predicates.onSegment(a, b, index))) continue;
      if (!material(midpoint(a, b))) continue;
      if ([...graph.values()].some(edge => !compatible(a, b, ...edge.pair))) continue;
      const bridge = join(a, b); if (bridge) bridgeCount++;
      check(bridgeCount <= component.holeLoopIds.length && triangulation.bridges.length + bridgeCount <= 8, 'TRIANGULATION', 'material-loop connector count exceeded');
      graph.set(key(a, b), { pair: candidate.pair, boundary: false, bridge });
    }
    check(local.every(index => find(index) === find(local[0])), 'TRIANGULATION', 'visible material graph cannot connect every native loop');
    const componentTriangles: CoplanarFaceBooleanMeshTriangulation['triangles'] = [];
    for (let i = 0; i < local.length; i++) for (let j = i + 1; j < local.length; j++) for (let k = j + 1; k < local.length; k++) {
      triangleTick(false);
      const a = local[i], b = local[j], c = local[k];
      if (!graph.has(key(a, b)) || !graph.has(key(b, c)) || !graph.has(key(c, a))) continue;
      const o = orientation(a, b, c); if (o === 0) continue;
      const triangle: [number, number, number] = o > 0 ? [a, b, c] : [a, c, b];
      if (local.some(index => !triangle.includes(index) && triangle.every((from, edge) => orientation(from, triangle[(edge + 1) % 3], index) >= 0))) continue;
      const centroid = uv[a].map((value, axis) => finite(value + product(finite(uv[b][axis] - value), 1 / 3)
        + product(finite(uv[c][axis] - value), 1 / 3))) as Point;
      probe(centroid, index => check(triangle.every((from, edge) => orientation(from, triangle[(edge + 1) % 3], index) > 0),
        'REPRESENTABILITY', 'strict triangle centroid is not represented'));
      if (!material(centroid)) continue;
      if (holeIndices.some(hole => !separated(triangle, hole))) continue;
      const signedAreaUV = product(Math.abs(o), .5);
      check(signedAreaUV > 0, 'REPRESENTABILITY', 'positive native UV triangle area required');
      check(triangulation.triangles.length + componentTriangles.length < options.maximumTriangles
        && triangulation.triangles.length + componentTriangles.length < 80, 'BUDGET', 'actual triangle output capacity exceeded');
      componentTriangles.push({ id: role('_tri_' + (triangulation.triangles.length + componentTriangles.length)), componentId: component.id,
        vertexIndices: triangle, signedAreaUV, centroidUV: [centroid[0], centroid[1]], centroidInMaterial: true, areaMM2: 0 });
    }
    const expectedTriangleCount = local.length + 2 * holeIndices.length - 2;
    const expectedInternalEdgeCount = local.length + 3 * holeIndices.length - 3;
    check(componentTriangles.length === expectedTriangleCount, 'TRIANGULATION', 'native material component does not admit its exact Euler triangle count');
    const uses = new Map<string, CoplanarFaceBooleanMeshEdgeUse[]>();
    for (const triangle of componentTriangles) for (let edge = 0; edge < 3; edge++) {
      const from = triangle.vertexIndices[edge], to = triangle.vertexIndices[(edge + 1) % 3], edgeKey = key(from, to), list = uses.get(edgeKey) ?? [];
      list.push({ triangleId: triangle.id, from, to }); uses.set(edgeKey, list);
    }
    for (const edge of boundary) {
      const list = uses.get(key(...edge.pair));
      check(list !== undefined && list.length === 1 && list[0].from === edge.pair[0] && list[0].to === edge.pair[1],
        'INCIDENCE', 'every true native directed boundary must have exactly one matching triangle use');
      triangulation.boundaryIncidence.push({ componentId: component.id, loopId: edge.loopId, fragmentId: edge.fragmentId,
        edgeId: edge.edgeId, useId: edge.useId, curveId: edge.curveId, vertexIndices: edge.pair, uses: list! });
    }
    let internalEdgeCount = 0;
    for (const edge of graph.values()) if (!edge.boundary) {
      const list = uses.get(key(...edge.pair));
      check(list !== undefined && list.length === 2 && list[0].from === list[1].to && list[0].to === list[1].from,
        'INCIDENCE', 'every internal display edge must have exactly two opposite triangle uses');
      const id = edge.bridge ? role('_bridge_' + triangulation.bridges.length) : role('_diag_' + diagonalCount++);
      const kind = edge.bridge ? 'display-internal-bridge' : 'display-internal-diagonal';
      triangulation.internalEdges.push({ id, componentId: component.id, kind, vertexIndices: edge.pair, uses: list! }); internalEdgeCount++;
      if (edge.bridge) triangulation.bridges.push({ id, componentId: component.id, kind: 'display-internal-bridge', vertexIndices: edge.pair,
        nativeVertexIds: [vertices[edge.pair[0]].nativeVertexId, vertices[edge.pair[1]].nativeVertexId] });
    }
    check(uses.size === graph.size && internalEdgeCount === expectedInternalEdgeCount && bridgeCount === holeIndices.length,
      'INCIDENCE', 'complete component graph/triangle/internal-edge/bridge incidence mismatch');
    check(triangulation.internalEdges.length <= 88 && triangulation.bridges.length <= 8, 'BUDGET', 'total internal display edge/bridge capacity exceeded');
    const triangleAreaUV = componentTriangles.reduce((sum, triangle) => finite(sum + triangle.signedAreaUV), 0);
    const declaredUncertainty = componentLoopIds.reduce((sum, id) => {
      const loop = region.loops.find(loop => loop.id === id); check(loop !== undefined, 'INCIDENCE', 'actual component area uncertainty required');
      return finite(sum + loop!.areaUncertaintyUV);
    }, 0);
    const areaDifferenceUV = Math.abs(finite(component.areaUV - triangleAreaUV));
    const areaToleranceUV = Math.max(product(product(128, Number.EPSILON), finite(Math.abs(component.areaUV) + Math.abs(triangleAreaUV))), declaredUncertainty);
    check(areaDifferenceUV <= areaToleranceUV, 'COVERAGE', 'native outer-minus-holes area differs from all material triangles');
    triangulation.components.push({ componentId: component.id, outerLoopId: component.outerLoopId, holeLoopIds: component.holeLoopIds,
      vertexIndices: local, triangleIds: componentTriangles.map(triangle => triangle.id), expectedTriangleCount, expectedInternalEdgeCount,
      expectedBridgeCount: holeIndices.length, triangleCount: componentTriangles.length, internalEdgeCount, bridgeCount,
      materialAreaUV: component.areaUV, triangleAreaUV, areaDifferenceUV, areaToleranceUV,
      surfaceJacobianMM2: 0, materialAreaMM2: 0, triangleAreaMM2: 0, areaDifferenceMM2: 0 });
    triangulation.triangles.push(...componentTriangles);
  }
  for (let i = 0; i < triangulation.triangles.length; i++) for (let j = i + 1; j < triangulation.triangles.length; j++) {
    triangleTick(true);
    check(separated(triangulation.triangles[i].vertexIndices, triangulation.triangles[j].vertexIndices), 'COVERAGE', 'actual native material triangle interiors overlap or separation is unproved');
  }
  return { triangulation, work };
}

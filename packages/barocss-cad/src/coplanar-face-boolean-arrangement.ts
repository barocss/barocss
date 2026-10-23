import { directedUVDeterminant } from './intersect/own-affine-plane-loop-internal.js';
import type { AffineConvexLineLoopAdmission } from './intersect/own-affine-plane-loop-internal.js';
import { curveDomain, evaluateCurve, evaluateSurface } from './core/math.js';
import type { ConvexPlanarFaceResult } from './own-convex-planar-face.js';
import type { Curve, Surface, Point } from './types.js';
import type { CoplanarFaceBooleanOptions, CoplanarFaceBooleanContributor, CoplanarFaceBooleanEvent,
  CoplanarFaceBooleanResult, CoplanarFaceBooleanReport, CoplanarFaceBooleanDiagnosticCode } from './coplanar-face-boolean.js';

type Vertex = CoplanarFaceBooleanResult['vertices'][number];
type Check = (condition: boolean, code: CoplanarFaceBooleanDiagnosticCode, detail: string) => void;
type Native = <T>(action: () => T, detail: string, code?: CoplanarFaceBooleanDiagnosticCode) => T;
export interface BooleanFragmentPlan {
  arrangementIndex: number; selectedIndex: number; source: Curve; originalPcurve: Curve; contributor: CoplanarFaceBooleanContributor;
  interval: [number, number]; sense: 'forward' | 'reverse'; vertexIds: [string, string]; selectionIndex: number;
}
export interface BooleanLoopPlan { vertexIds: string[]; fragmentIndices: number[]; signedAreaUV: number; areaUncertaintyUV: number; role: 'outer' | 'hole'; componentIndex: number }
export interface BooleanArrangement {
  vertices: Vertex[]; events: CoplanarFaceBooleanEvent[]; fragments: BooleanFragmentPlan[]; loops: BooleanLoopPlan[];
  components: { outerLoopIndex: number; holeLoopIndices: number[]; areaUV: number }[];
  branch: CoplanarFaceBooleanReport['branch']; pairTests: CoplanarFaceBooleanReport['pairTests']; selections: CoplanarFaceBooleanReport['selections'];
  coincidentCounterparts: CoplanarFaceBooleanReport['coincidentCounterparts']; arrangementVertexCount: number; arrangementFragmentCount: number;
}

/** Bounded UV arrangement only. All Curve geometry staging remains in the public native leaf. */
export function buildCoplanarArrangement(faceA: ConvexPlanarFaceResult, faceB: ConvexPlanarFaceResult, support: Surface,
  admissions: [AffineConvexLineLoopAdmission, AffineConvexLineLoopAdmission], options: CoplanarFaceBooleanOptions,
  role: (suffix: string) => string, check: Check, native: Native): BooleanArrangement {
  const EPS = 64 * Number.EPSILON;
  const finite = (value: number): number => { check(Number.isFinite(value), 'REPRESENTABILITY', 'finite UV arrangement arithmetic required'); return value; };
  const product = (a: number, b: number): number => { const value = finite(a * b); check(a === 0 || b === 0 || value !== 0, 'REPRESENTABILITY', 'nonzero UV arrangement product underflow'); return value; };
  const delta = (a: Point, b: Point): Point => a.map((value, i) => finite(value - b[i])) as Point;
  const determinant = (a: Point, b: Point) => native(() => directedUVDeterminant(a, b), 'actual shared64-epsilon UV determinant', 'UNCERTAINTY');
  const distance = (a: Point, b: Point): number => finite(Math.hypot(...delta(a, b)));
  const exact = (a: Point, b: Point): boolean => a.every((value, i) => Object.is(value, b[i]));
  const faces = [faceA, faceB] as const, vertices: Vertex[] = [], events: CoplanarFaceBooleanEvent[] = [];
  type Cut = { fraction: number; parameter: number; margin: number; vertexId: string };
  type Edge = { curve: Curve; pcurve: Curve; contributor: CoplanarFaceBooleanContributor; domain: [number, number]; uv0: Point; uv1: Point;
    baseSense: 'forward' | 'reverse'; cuts: Cut[] };
  const edges: [Edge[], Edge[]] = [[], []];
  const parameter = (domain: [number, number], fraction: number): number => {
    if (fraction === 0) return domain[0]; if (fraction === 1) return domain[1];
    const value = finite(domain[0] + product(finite(domain[1] - domain[0]), fraction));
    check(value > domain[0] && value < domain[1], 'REPRESENTABILITY', 'proper original Line parameter rounded to endpoint'); return value;
  };
  const contributors: [CoplanarFaceBooleanContributor[], CoplanarFaceBooleanContributor[]] = [[], []];
  for (let operandIndex = 0; operandIndex < 2; operandIndex++) {
    const face = faces[operandIndex], operand = operandIndex === 0 ? 'a' : 'b';
    for (let i = 0; i < face.loop.edges.length; i++) {
      const curve = face.loop.edges[i], use = face.topology.loop.uses.find(use => use.curveId === curve.id);
      check(use !== undefined, 'BINDING', 'actual original Line/use qualifier required');
      contributors[operandIndex].push({ operand, faceId: face.options.faceId, evaluationId: face.options.evaluationId, supportId: face.plane.id,
        loopId: face.loop.id, useId: use!.id, edgeId: use!.edgeId, curveId: curve.id, pcurveId: use!.pcurveId, authoredEdgeIndex: i,
        originalUseSense: use!.sense, authoredLoopOrientation: admissions[operandIndex].orientation, originalFaceSense: face.options.orientation });
    }
    for (let i = 0; i < face.loop.edges.length; i++) {
      const curve = face.loop.edges[i], previousIndex = (i + face.loop.edges.length - 1) % face.loop.edges.length;
      const topological = face.topology.edges.find(edge => edge.curveId === curve.id), domain = curveDomain(curve);
      check(topological !== undefined, 'BINDING', 'actual original edge/vertex qualifier required');
      const originalVertex = face.topology.vertices.find(vertex => vertex.id === topological!.vertexIds[0]);
      check(originalVertex !== undefined, 'BINDING', 'actual original vertex coefficient required');
      vertices.push({ id: role('_v_' + operand + '_' + i), uv: admissions[operandIndex].verticesUV[i], pointMM: originalVertex!.point,
        contributors: [{ source: contributors[operandIndex][i], kind: 'original-vertex', originalVertexId: originalVertex!.id, parameter: domain[0], eventId: null },
          { source: contributors[operandIndex][previousIndex], kind: 'original-vertex', originalVertexId: originalVertex!.id,
            parameter: curveDomain(face.loop.edges[previousIndex])[1], eventId: null }] });
    }
    for (let i = 0; i < face.loop.edges.length; i++) {
      const curve = face.loop.edges[i], pcurve = face.pcurves.find(value => value.curveId === curve.id);
      check(pcurve !== undefined, 'BINDING', 'actual original dimensionless pcurve required');
      const domain = curveDomain(curve), next = (i + 1) % face.loop.edges.length;
      edges[operandIndex].push({ curve, pcurve: pcurve!.curve, contributor: contributors[operandIndex][i], domain,
        uv0: admissions[operandIndex].verticesUV[i], uv1: admissions[operandIndex].verticesUV[next],
        baseSense: admissions[operandIndex].orientation === 'ccw' ? 'forward' : 'reverse',
        cuts: [{ fraction: 0, parameter: domain[0], margin: 0, vertexId: role('_v_' + operand + '_' + i) },
          { fraction: 1, parameter: domain[1], margin: 0, vertexId: role('_v_' + operand + '_' + next) }] });
    }
  }
  let match: number[] | null = null;
  if (edges[0].length === edges[1].length) {
    const count = edges[0].length;
    for (let start = 0; start < count && match === null; start++) for (const direction of [1, -1]) {
      const mapping = Array.from({ length: count }, (_, i) => (start + direction * i + count * 2) % count);
      if (mapping.every((j, i) => exact(admissions[0].verticesUV[i], admissions[1].verticesUV[j]))) { match = mapping; break; }
    }
  }
  const coincidentCounterparts: BooleanArrangement['coincidentCounterparts'] = [];
  const pairTests: BooleanArrangement['pairTests'] = [];
  if (match !== null) {
    for (let i = 0; i < match.length; i++) {
      const j = match[i], next = match[(i + 1) % match.length];
      const edgeB = next === (j + 1) % match.length ? j : next;
      coincidentCounterparts.push({ vertexA: i, vertexB: j, edgeA: i, edgeB });
      const aVertex = vertices.find(vertex => vertex.id === role('_v_a_' + i))!, bVertex = vertices.find(vertex => vertex.id === role('_v_b_' + j))!;
      for (const contributor of bVertex.contributors) aVertex.contributors.push({ ...contributor, kind: 'coincident-counterpart' });
    }
  } else {
    check(edges[0].length * edges[1].length <= options.maximumPairTests, 'BUDGET', 'complete native UV edge-pair test budget exceeded');
    for (let i = 0; i < edges[0].length; i++) for (let j = 0; j < edges[1].length; j++) {
      const a = edges[0][i], b = edges[1][j], r = delta(a.uv1, a.uv0), s = delta(b.uv1, b.uv0), q = delta(b.uv0, a.uv0);
      const den = determinant(r, s);
      check(den.value === 0 || Math.abs(den.value) > den.threshold, 'UNCERTAINTY', 'nonzero edge-pair denominator is uncertain');
      if (den.value === 0) {
        const separation = determinant(r, q);
        check(separation.value === 0 || Math.abs(separation.value) > separation.threshold, 'UNCERTAINTY', 'parallel support separation is uncertain');
        if (separation.value === 0) {
          const axis = Math.abs(r[0]) >= Math.abs(r[1]) ? 0 : 1;
          const amin = Math.min(a.uv0[axis], a.uv1[axis]), amax = Math.max(a.uv0[axis], a.uv1[axis]);
          const bmin = Math.min(b.uv0[axis], b.uv1[axis]), bmax = Math.max(b.uv0[axis], b.uv1[axis]);
          const gap = finite(Math.max(bmin - amax, amin - bmax)), margin = finite(EPS * Math.max(1, Math.abs(amin) + Math.abs(amax) + Math.abs(bmin) + Math.abs(bmax)));
          check(gap > margin, 'CONTACT', 'collinear finite boundaries overlap/touch or are not strictly separated');
        }
        pairTests.push({ edgeA: i, edgeB: j, classification: 'parallel-separated', denominator: den.value,
          numeratorA: null, numeratorB: null, fractionA: null, fractionB: null }); continue;
      }
      const na = determinant(q, s), nb = determinant(q, r);
      check(na.value === 0 || Math.abs(na.value) > na.threshold, 'UNCERTAINTY', 'nonzero A root numerator is uncertain');
      check(nb.value === 0 || Math.abs(nb.value) > nb.threshold, 'UNCERTAINTY', 'nonzero B root numerator is uncertain');
      const fa = finite(na.value / den.value), fb = finite(nb.value / den.value);
      check((na.value === 0 || fa !== 0) && (nb.value === 0 || fb !== 0), 'REPRESENTABILITY', 'nonzero edge fraction underflow');
      const ma = finite((na.threshold + product(Math.abs(fa), den.threshold)) / Math.abs(den.value) + EPS * Math.max(1, Math.abs(fa)));
      const mb = finite((nb.threshold + product(Math.abs(fb), den.threshold)) / Math.abs(den.value) + EPS * Math.max(1, Math.abs(fb)));
      if (fa < -ma || fa > 1 + ma || fb < -mb || fb > 1 + mb) {
        pairTests.push({ edgeA: i, edgeB: j, classification: 'disjoint', denominator: den.value,
          numeratorA: na.value, numeratorB: nb.value, fractionA: fa, fractionB: fb }); continue;
      }
      check(fa !== 0 && fa !== 1 && fb !== 0 && fb !== 1, 'CONTACT', 'endpoint/vertex boundary contact refused');
      check(fa > ma && fa < 1 - ma && fb > mb && fb < 1 - mb, 'UNCERTAINTY', 'proper crossing is not safely interior');
      check(events.length < 64, 'BUDGET', 'proper crossing event capacity exceeded');
      const pa = parameter(a.domain, fa), pb = parameter(b.domain, fb);
      const uvA = a.uv0.map((value, axis) => finite(value + product(r[axis], fa))) as Point;
      const uvB = b.uv0.map((value, axis) => finite(value + product(s[axis], fb))) as Point;
      const nativeUvA = native(() => evaluateCurve(a.pcurve, pa), 'actual original A UV at crossing');
      const nativeUvB = native(() => evaluateCurve(b.pcurve, pb), 'actual original B UV at crossing');
      const pointA = native(() => evaluateCurve(a.curve, pa), 'actual original A Line crossing');
      const pointB = native(() => evaluateCurve(b.curve, pb), 'actual original B Line crossing');
      const pointMM = native(() => evaluateSurface(support, uvA[0], uvA[1]), 'actual shared support crossing vertex');
      check(distance(pointA, pointB) <= 1e-7 && distance(pointA, pointMM) <= 1e-7 && distance(pointB, pointMM) <= 1e-7,
        'BINDING', 'actual crossing Line/support discrepancy exceeds1e-7mm');
      const id = role('_ev_' + events.length), vertexId = role('_v_x_' + events.length);
      events.push({ id, vertexId, uv: uvA, pointMM,
        a: { contributor: a.contributor, fraction: fa, parameter: pa, uv: uvA, nativeUV: nativeUvA, pointMM: pointA },
        b: { contributor: b.contributor, fraction: fb, parameter: pb, uv: uvB, nativeUV: nativeUvB, pointMM: pointB },
        worldDifferenceMM: distance(pointA, pointB), uvDifference: distance(nativeUvA, nativeUvB),
        determinant: { denominator: den.value, numeratorA: na.value, numeratorB: nb.value, denominatorThreshold: den.threshold,
          numeratorAThreshold: na.threshold, numeratorBThreshold: nb.threshold, fractionMarginA: ma, fractionMarginB: mb } });
      vertices.push({ id: vertexId, uv: uvA, pointMM, contributors: [
        { source: a.contributor, kind: 'cross-event', originalVertexId: null, parameter: pa, eventId: id },
        { source: b.contributor, kind: 'cross-event', originalVertexId: null, parameter: pb, eventId: id }] });
      a.cuts.push({ fraction: fa, parameter: pa, margin: ma, vertexId }); b.cuts.push({ fraction: fb, parameter: pb, margin: mb, vertexId });
      pairTests.push({ edgeA: i, edgeB: j, classification: 'crossing', denominator: den.value,
        numeratorA: na.value, numeratorB: nb.value, fractionA: fa, fractionB: fb });
    }
  }
  const classify = (point: Point, operand: number): 'inside' | 'outside' => {
    const polygon = admissions[operand].verticesUV, sign = admissions[operand].orientation === 'ccw' ? 1 : -1;
    const values = polygon.map((vertex, i) => {
      const d = determinant(delta(polygon[(i + 1) % polygon.length], vertex), delta(point, vertex));
      check(d.value === 0 || Math.abs(d.value) > d.threshold, 'UNCERTAINTY', 'strict midpoint halfspace is uncertain'); return sign * d.value;
    });
    if (values.some(value => value < 0)) return 'outside';
    check(values.every(value => value > 0), 'CONTACT', 'midpoint lies on another finite polygon boundary'); return 'inside';
  };
  let arrangementFragmentCount = 0;
  for (const operand of edges) for (const edge of operand) {
    edge.cuts.sort((a, b) => a.fraction - b.fraction);
    for (let i = 1; i < edge.cuts.length; i++) {
      const lo = edge.cuts[i - 1], hi = edge.cuts[i];
      check(hi.fraction - lo.fraction > lo.margin + hi.margin + EPS, 'UNCERTAINTY', 'distinct edge cuts are not safely separated');
      check(hi.parameter > lo.parameter && Number.isFinite(hi.parameter - lo.parameter), 'REPRESENTABILITY', 'ordered native cut interval not represented');
      arrangementFragmentCount++;
    }
  }
  check(arrangementFragmentCount <= options.maximumFragments && arrangementFragmentCount <= 64, 'BUDGET', 'complete arrangement fragment budget exceeded before native staging');
  const selections: BooleanArrangement['selections'] = [], fragments: BooleanFragmentPlan[] = [];
  for (let operand = 0; operand < 2; operand++) for (const edge of edges[operand]) for (let i = 1; i < edge.cuts.length; i++) {
    const lo = edge.cuts[i - 1], hi = edge.cuts[i], middle = finite(lo.parameter + product(hi.parameter - lo.parameter, .5));
    check(middle > lo.parameter && middle < hi.parameter, 'REPRESENTABILITY', 'strict native fragment midpoint not represented');
    const midpointUV = native(() => evaluateCurve(edge.pcurve, middle), 'actual original UV fragment midpoint');
    const classification = match !== null ? 'coincident' : classify(midpointUV, 1 - operand);
    const selected = match !== null ? operand === 0 && options.operation !== 'difference'
      : options.operation === 'union' ? classification === 'outside' : options.operation === 'intersection' ? classification === 'inside'
        : operand === 0 ? classification === 'outside' : classification === 'inside';
    const sense = options.operation === 'difference' && operand === 1 ? edge.baseSense === 'forward' ? 'reverse' : 'forward' : edge.baseSense;
    const selectionIndex = selections.length, selectedIndex = fragments.length;
    selections.push({ arrangementIndex: selectionIndex, contributor: edge.contributor, interval: [lo.parameter, hi.parameter], midpoint: middle,
      midpointUV, classification, selected, sense, fragmentId: selected ? role('_f_' + selectedIndex) : null });
    if (selected) fragments.push({ arrangementIndex: selectionIndex, selectedIndex, source: edge.curve, originalPcurve: edge.pcurve,
      contributor: edge.contributor, interval: [lo.parameter, hi.parameter], sense,
      vertexIds: sense === 'forward' ? [lo.vertexId, hi.vertexId] : [hi.vertexId, lo.vertexId], selectionIndex });
  }
  const selectedVertexIds = new Set(fragments.flatMap(fragment => fragment.vertexIds)), selectedVertices = vertices.filter(vertex => selectedVertexIds.has(vertex.id));
  const outgoing = new Map<string, number>(), incoming = new Map<string, number>();
  for (const [index, fragment] of fragments.entries()) {
    check(!outgoing.has(fragment.vertexIds[0]) && !incoming.has(fragment.vertexIds[1]), 'INCIDENCE', 'selected directed vertex degree must be exactly one in/out');
    outgoing.set(fragment.vertexIds[0], index); incoming.set(fragment.vertexIds[1], index);
  }
  for (const id of selectedVertexIds) check(outgoing.has(id) && incoming.has(id), 'INCIDENCE', 'selected vertex has an open directed boundary');
  const used = new Set<number>(), loops: BooleanLoopPlan[] = [];
  for (let first = 0; first < fragments.length; first++) {
    if (used.has(first)) continue;
    check(loops.length < 16, 'BUDGET', 'selected loop capacity exceeded');
    const fragmentIndices: number[] = [], vertexIds: string[] = [], start = fragments[first].vertexIds[0];
    let current = first;
    for (;;) {
      check(!used.has(current), 'INCIDENCE', 'directed boundary repeats a fragment before closure'); used.add(current);
      const fragment = fragments[current]; fragmentIndices.push(current); vertexIds.push(fragment.vertexIds[0]);
      const nextVertex = fragment.vertexIds[1]; if (nextVertex === start) break;
      const next = outgoing.get(nextVertex); check(next !== undefined, 'INCIDENCE', 'directed next boundary fragment missing'); current = next!;
      check(fragmentIndices.length <= fragments.length, 'INCIDENCE', 'bounded directed loop walk exhausted');
    }
    check(vertexIds.length >= 3, 'INCIDENCE', 'at least three fragments per selected loop required');
    const polygon = vertexIds.map(id => selectedVertices.find(vertex => vertex.id === id)!.uv), origin = polygon[0];
    let twiceArea = 0, magnitude = 0, uncertainty = 0;
    for (let i = 1; i + 1 < polygon.length; i++) {
      const d = determinant(delta(polygon[i], origin), delta(polygon[i + 1], origin));
      twiceArea = finite(twiceArea + d.value); magnitude = finite(magnitude + Math.abs(d.value)); uncertainty = finite(uncertainty + d.threshold);
    }
    const margin = finite(uncertainty + product(EPS, magnitude));
    check(Math.abs(twiceArea) > margin, 'UNCERTAINTY', 'selected loop signed area is cancellation-uncertain');
    loops.push({ vertexIds, fragmentIndices, signedAreaUV: product(.5, twiceArea), areaUncertaintyUV: product(.5, margin),
      role: twiceArea > 0 ? 'outer' : 'hole', componentIndex: -1 });
  }
  const insideLoop = (point: Point, loop: BooleanLoopPlan): boolean => {
    const polygon = loop.vertexIds.map(id => selectedVertices.find(vertex => vertex.id === id)!.uv);
    let winding = 0;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length], d = determinant(delta(b, a), delta(point, a));
      check(d.value === 0 || Math.abs(d.value) > d.threshold, 'NESTING', 'native nesting orientation is uncertain');
      if (d.value === 0) check(!(point[0] >= Math.min(a[0], b[0]) && point[0] <= Math.max(a[0], b[0])
        && point[1] >= Math.min(a[1], b[1]) && point[1] <= Math.max(a[1], b[1])), 'NESTING', 'hole probe is on finite output boundary');
      if (a[1] <= point[1] && b[1] > point[1] && d.value > 0) winding++;
      else if (a[1] > point[1] && b[1] <= point[1] && d.value < 0) winding--;
    }
    return winding !== 0;
  };
  const components: BooleanArrangement['components'] = [];
  for (const [index, loop] of loops.entries()) if (loop.role === 'outer') {
    check(components.length < 8, 'BUDGET', 'outer component capacity exceeded'); loop.componentIndex = components.length;
    components.push({ outerLoopIndex: index, holeLoopIndices: [], areaUV: loop.signedAreaUV });
  }
  check(loops.filter(loop => loop.role === 'hole').length <= 8, 'BUDGET', 'hole capacity exceeded');
  for (const [index, loop] of loops.entries()) if (loop.role === 'hole') {
    const point = selectedVertices.find(vertex => vertex.id === loop.vertexIds[0])!.uv;
    const containing = components.map((component, i) => ({ component, i })).filter(value => insideLoop(point, loops[value.component.outerLoopIndex]));
    check(containing.length > 0, 'NESTING', 'hole has no strictly containing outer');
    containing.sort((a, b) => loops[a.component.outerLoopIndex].signedAreaUV - loops[b.component.outerLoopIndex].signedAreaUV);
    if (containing.length > 1) check(loops[containing[1].component.outerLoopIndex].signedAreaUV - loops[containing[0].component.outerLoopIndex].signedAreaUV
      > loops[containing[1].component.outerLoopIndex].areaUncertaintyUV + loops[containing[0].component.outerLoopIndex].areaUncertaintyUV,
    'NESTING', 'nearest containing outer area/order is ambiguous');
    const owner = containing[0]; loop.componentIndex = owner.i; owner.component.holeLoopIndices.push(index);
    owner.component.areaUV = finite(owner.component.areaUV + loop.signedAreaUV);
    check(owner.component.areaUV > 0, 'NESTING', 'component hole area does not leave a positive region');
  }
  return { vertices: selectedVertices, events, fragments, loops, components, branch: match === null ? 'proper-arrangement' : 'exact-full-coincidence',
    pairTests, selections, coincidentCounterparts, arrangementVertexCount: vertices.length, arrangementFragmentCount };
}

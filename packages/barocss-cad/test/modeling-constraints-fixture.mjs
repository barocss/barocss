import assert from 'node:assert/strict';
import { signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData } from './modeling-circle-fixture.mjs';
import { PRISM_COUNTS } from './modeling-offset-fixture.mjs';
import { prove as proveConvex } from './modeling-intersection-fixture.mjs';
export { signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData, PRISM_COUNTS };

// This is the frozen #1835 matrix, not instrumentation of hidden provider work.
// Importing this module performs no native construction or evaluation.
export const EXPECTED_CAMPAIGN = Object.freeze({ modelCalls: 8, sourceModelCalls: 6, coldModelCalls: 2,
  successfulPrisms: 6, nativeConflicts: 1, underconstraintRefusals: 1, tessellations: 1,
  massQueries: 0, cpuBufferPreparations: 0, standaloneValidators: 0,
  sourceDerived: { standaloneSolverAttempts: 8, standaloneSuccessfulSketchCompilations: 7,
    prismSketchReconstructionAttempts: 6, totalSolverAttempts: 14, successfulSketchCompilations: 13,
    prismFaces: 36, prismSourceCompilations: 78, prismBindingObservations: 864, prismD1: 2592,
    previewValidationRoots: 1, previewSourceCompilations: 6, previewBindingObservations: 72, previewD1: 216,
    returnedLedgerSourceCompilations: 84, returnedLedgerBindingObservations: 936, returnedLedgerD1: 2808,
    knownSourceCompilations: 91 }, fullTransitiveNativeCoverage: 'NOT_MEASURED' });
export const DEFAULTS = Object.freeze({ width: 32, height: 24, lockY: 0 });

export function constrainedPlate(cad, underconstrained = false) {
  const model = cad.model(), width = model.parameter('width', 32), height = model.parameter('height', 24), lockY = model.parameter('lockY', 0);
  const sketch = model.sketch.constrainedPolygon(s => {
    const a = s.point([-0, 0]), b = s.point([width, lockY]), c = s.point([width, height]), d = s.point([1, height]);
    s.fixed(a); if (!underconstrained) s.fixed(c);
    s.horizontal(a, b); s.vertical(b, c); s.horizontal(c, d); s.vertical(d, a);
    if (!underconstrained) s.fixed(b);
    return [a, b, c, d];
  });
  const part = sketch.extrude(8);
  return { model, sketch, part, build: () => model.build({ part }) };
}
export function clockwisePlate(cad) {
  const model = cad.model(), sketch = model.sketch.constrainedPolygon(s => {
    const a = s.point([-0, 0]), b = s.point([5, 1]), c = s.point([5, 3]), d = s.point([1, 3]);
    s.fixed(a); s.fixed(c); s.vertical(a, d); s.horizontal(d, c); s.vertical(c, b); s.horizontal(b, a);
    return [a, d, c, b];
  });
  const part = sketch.extrude(2, { from: -1 }); return { model, sketch, part, build: () => model.build({ part }) };
}
export function authoredDocument(parameters = DEFAULTS, mode = 'baseline') {
  const cw = mode === 'cw', under = mode === 'underconstrained', p = parameter => ({ parameter });
  const points = cw ? [[-0, 0], [1, 3], [5, 3], [5, 1]]
    : [[-0, 0], [p('width'), p('lockY')], [p('width'), p('height')], [1, p('height')]];
  const constraints = [{ kind: 'fixed', point: 0 }, ...(!under ? [{ kind: 'fixed', point: 2 }] : []),
    ...Array.from({ length: 4 }, (_, i) => ({ kind: (i % 2 === 0) !== cw ? 'horizontal' : 'vertical', points: [i, (i + 1) % 4] })),
    ...(!under && !cw ? [{ kind: 'fixed', point: 1 }] : [])];
  return { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: cw ? {} : { ...parameters }, nodes: [
    { kind: 'sketch', profile: 'constrained-polygon', points, constraints },
    { kind: 'extrude', sketch: 0, height: cw ? 2 : 8, ...(cw ? { from: -1 } : {}) },
  ], outputs: { part: { node: 1, side: 'solid' } } };
}

// Independent equality-graph oracle for this finite fixed/H/V family. Each
// coordinate is a graph vertex; H/V joins a pair, and fixed pins a component.
// Rank/redundancy follow component counts, without reproducing native Gaussian
// elimination or calling a solver. All fixture constants are exact integers.
export function equationOracle(document, solvedPoints) {
  const n = 2 * document.points.length, parent = Array.from({ length: n + 1 }, (_, i) => i), anchor = n;
  const root = i => { while (parent[i] !== i) i = parent[i]; return i; };
  const index = new Map(document.points.map((p, i) => [p.id, i * 2]));
  let rank = 0, equations = 0; const redundant = [];
  const join = (a, b) => { a = root(a); b = root(b); if (a === b) return false; parent[a] = b; rank++; return true; };
  for (const constraint of document.constraints) {
    const priorRank = rank;
    if (constraint.kind === 'fixed') {
      const i = index.get(constraint.pointId); assert.notEqual(i, undefined);
      for (let axis = 0; axis < 2; axis++) {
        const coordinate = i + axis; equations++; join(coordinate, anchor);
        if (solvedPoints) assert.ok(solvedPoints[i / 2].position[axis] === constraint.target[axis], 'fixed target equation');
      }
    } else {
      assert.ok(['horizontal', 'vertical'].includes(constraint.kind)); equations++;
      const segment = document.segments.find(s => s.id === constraint.segmentId); assert.ok(segment);
      const axis = constraint.kind === 'horizontal' ? 1 : 0, a = index.get(segment.startPointId), b = index.get(segment.endPointId);
      join(a + axis, b + axis);
      if (solvedPoints) assert.ok(solvedPoints[a / 2].position[axis] === solvedPoints[b / 2].position[axis], constraint.kind + ' equation');
    }
    if (rank === priorRank) redundant.push(constraint.id);
  }
  // Leftmost pivots leave the last XY coordinate in each unpinned equality
  // component free. Anchored components have no free coordinate.
  const freeByComponent = new Map();
  for (let i = 0; i < n; i++) if (root(i) !== root(anchor)) freeByComponent.set(root(i), i);
  const free = [...freeByComponent.values()].sort((a, b) => a - b), coordinate = i => ({ pointId: document.points[Math.floor(i / 2)].id, axis: i % 2 ? 'y' : 'x' });
  return { rank, equations, degreesOfFreedom: n - rank, redundant,
    freeCoordinates: free.map(coordinate), pivotCoordinates: Array.from({ length: n }, (_, i) => i).filter(i => !free.includes(i)).map(coordinate) };
}

function proveNativeDocument(document, parameters, mode) {
  const authored = authoredDocument(parameters, mode).nodes[0], resolve = v => typeof v === 'number' ? v : parameters[v.parameter];
  assert.equal(document.format, 'barocss-xy-affine-sketch'); assert.equal(document.version, 0);
  assert.equal(document.profile, 'exact-affine-binary64'); assert.equal(document.lengthUnit, 'mm');
  exactData(document.referenceLines, []); assert.equal(document.points.length, 4); assert.equal(document.segments.length, 4);
  assert.equal(document.id, 'm0_sk'); exactData(document.points.map(p => p.id), ['p0', 'p1', 'p2', 'p3']);
  exactData(document.segments.map(s => s.id), ['s0', 's1', 's2', 's3']);
  exactData(document.constraints.map(c => c.id), authored.constraints.map((_, i) => 'c' + i));
  const allIds = [document.id, ...document.points.map(p => p.id), ...document.segments.map(s => s.id), ...document.constraints.map(c => c.id)];
  assert.equal(new Set(allIds).size, allIds.length); assert.ok(allIds.every(id => /^[A-Za-z_][A-Za-z0-9_-]*$/.test(id)));
  exactData(document.points.map(p => p.position), authored.points.map(p => p.map(resolve)));
  for (const [i, segment] of document.segments.entries()) {
    assert.equal(segment.startPointId, document.points[i].id); assert.equal(segment.endPointId, document.points[(i + 1) % 4].id);
  }
  assert.equal(document.constraints.length, authored.constraints.length);
  for (const [i, constraint] of document.constraints.entries()) {
    const expected = authored.constraints[i]; assert.equal(constraint.kind, expected.kind);
    if (expected.kind === 'fixed') {
      exactData(Object.keys(constraint).sort(), ['id', 'kind', 'pointId', 'target']);
      assert.equal(constraint.pointId, document.points[expected.point].id); exactData(constraint.target, authored.points[expected.point].map(resolve));
    } else {
      exactData(Object.keys(constraint).sort(), ['id', 'kind', 'segmentId']);
      const segment = document.segments.find(s => s.id === constraint.segmentId); assert.ok(segment);
      exactData([segment.startPointId, segment.endPointId], expected.points.map(j => document.points[j].id));
    }
  }
  assert.ok(Object.is(document.points[0].position[0], -0), 'authored seed retains negative zero');
}
export function proveSketch(result, parameters = DEFAULTS, mode = 'baseline') {
  assert.equal(result.ok, true); exactData(Object.keys(result).sort(), ['document', 'ok', 'report', 'solution']);
  const { document, solution, report } = result; proveNativeDocument(document, parameters, mode);
  const cw = mode === 'cw', under = mode === 'underconstrained';
  const points = cw ? [[0, 0], [0, 3], [5, 3], [5, 0]] : [[0, 0], [parameters.width, 0], [parameters.width, parameters.height], [0, parameters.height]];
  exactData(solution.points, document.points.map((p, i) => ({ id: p.id, position: points[i] })));
  assert.ok(Object.is(solution.points[0].position[0], 0), 'exact rational pivot zero is positive zero');
  const oracle = equationOracle(document, solution.points);
  assert.equal(report.unknownCount, 8); assert.equal(report.rank, under ? 6 : 8);
  assert.equal(report.rank, oracle.rank); assert.equal(report.equationCount, oracle.equations);
  assert.equal(report.degreesOfFreedom, under ? 2 : 0); assert.equal(report.degreesOfFreedom, oracle.degreesOfFreedom);
  assert.equal(report.fullyConstrained, !under); exactData(report.redundantConstraintIds, oracle.redundant);
  exactData(report.redundantConstraintIds, mode === 'baseline' ? [document.constraints[6].id] : []);
  exactData(report.pivotCoordinates, oracle.pivotCoordinates); exactData(report.freeCoordinates, oracle.freeCoordinates);
  for (const coordinate of report.freeCoordinates) {
    const i = document.points.findIndex(p => p.id === coordinate.pointId), axis = coordinate.axis === 'x' ? 0 : 1;
    assert.ok(Object.is(solution.points[i].position[axis], document.points[i].position[axis]), 'actual free coordinates preserve authored seeds');
  }
  exactData(report.quality, { arithmetic: 'exact-represented-binary64-rationals', coordinateConversion: 'exact-or-refuse',
    freeVariables: 'authored-seeds-in-point-xy-order', pivotOrder: 'leftmost-in-authored-equation-order', redundancy: 'chronological-zero-rank-increase',
    conflictProvenance: 'chronological-nonminimal-contributing-union', referenceLines: 'immutable-authored-constants', sourceFrame: 'authored-xy-z-zero',
    directionUnit: 'dimensionless', ownership: 'copied-cpu-data-gc-no-renderer-resources', topologyCertified: false, solid: false, manufacturingToleranceCertified: false });
  assert.equal(solution.sourceVersion, 0); assert.equal(solution.ir.schemaVersion, 1); assert.equal(solution.model.objects.length, 4);
  assert.ok(solution.source.includes('@model ' + document.id));
  for (const [i, segment] of document.segments.entries()) {
    const curve = solution.model.objects[i]; exactData(curve, { kind: 'curve', id: segment.id, degree: 1,
      knots: [0, 0, 1, 1], controlPoints: [points[i], points[(i + 1) % 4]].map(p => [...p, 0]), weights: [1, 1] });
    assert.ok(solution.source.includes('@curve #' + segment.id));
  }
  assert.ok(report.rationalWork.operations > 0); assert.ok(report.rationalWork.operations <= report.limits.rationalOperations);
  assert.ok(report.rationalWork.gcdSteps <= report.limits.gcdSteps); assert.ok(report.rationalWork.maximumObservedBits <= report.limits.integerBits);
  deepFrozen(result);
  return { rank: report.rank, degreesOfFreedom: report.degreesOfFreedom, equationCount: report.equationCount,
    redundantConstraintIds: report.redundantConstraintIds, freeCoordinates: report.freeCoordinates, actualReport: report,
    independentEqualityGraphOracle: true, nativeSHA256: dataHash(result) };
}

export function work(snapshot, previous) {
  exactData(snapshot.recomputation, { reusedFeatures: [], evaluatedFeatures: [0, 1] });
  exactData(snapshot.features, [{ kind: 'sketch', index: 0, dependencies: [] }, { kind: 'extrude', index: 1, dependencies: [0] }]);
  exactData(Object.keys(snapshot).sort(), ['bodies', 'parameters', 'suppression', 'features', 'recomputation', 'evidence', 'withParameters', 'withSuppression', 'massProperties', 'save'].sort());
  if (previous) {
    for (const key of ['parameters', 'evidence', 'bodies']) assert.notEqual(snapshot[key], previous[key]);
    for (const i of [0, 1]) assert.notEqual(snapshot.evidence[i], previous.evidence[i]);
    assert.notEqual(snapshot.bodies.part.native, previous.bodies.part.native);
  }
  deepFrozen(snapshot);
}
export function hold(snapshot) {
  return { text: snapshot.save(), bodies: snapshot.bodies, evidence: snapshot.evidence, parameters: snapshot.parameters,
    suppression: snapshot.suppression, features: snapshot.features, recomputation: snapshot.recomputation, hash: dataHash(snapshotData(snapshot)) };
}
export function unchanged(snapshot, before) {
  assert.equal(snapshot.save(), before.text);
  for (const key of ['bodies', 'evidence', 'parameters', 'suppression', 'features', 'recomputation']) assert.equal(snapshot[key], before[key]);
  assert.equal(dataHash(snapshotData(snapshot)), before.hash); deepFrozen(snapshot);
}
export function proveSnapshot(snapshot, parameters = DEFAULTS, mode = 'baseline') {
  const cw = mode === 'cw', height = cw ? 2 : 8, from = cw ? -1 : 0, width = cw ? 5 : parameters.width, spanY = cw ? 3 : parameters.height;
  const volume = width * spanY * height, expected = authoredDocument(parameters, mode), { part } = snapshot.bodies;
  assert.equal(snapshot.save(), signedData(expected) + '\n'); assert.ok(snapshot.save().includes('[-0,0]'));
  exactData(snapshot.parameters, expected.parameters); exactData(snapshot.suppression, {}); exactData(Object.keys(snapshot.bodies), ['part']);
  assert.equal(snapshot.evidence.length, 2); assert.equal(snapshot.evidence[0].kind, 'sketch'); assert.equal(snapshot.evidence[1].kind, 'extrude');
  const sketch = snapshot.evidence[0].native, prism = snapshot.evidence[1].native, solid = part.native;
  assert.equal(part.family, 'convex-planar'); assert.equal(solid, prism.solid); exactData(prism.request.sketch, sketch);
  const sketchProof = proveSketch(sketch, parameters, mode); proveConvex(solid, volume, [6, 12, 8]);
  exactData(prism.report.childNativeWork, PRISM_COUNTS); exactData(prism.request.options.chartPolicy, { version: 1, kind: 'coordinate-span' });
  assert.equal(prism.report.profileOrientation, cw ? 'cw' : 'ccw'); assert.equal(prism.report.heightMM, height);
  assert.equal(prism.request.options.heightMM, height); assert.equal(prism.report.solid, true);
  for (const [object, field] of [[prism.request.options, 'fromMM'], [prism.report, 'fromMM'], [prism.lineage, 'sourceToBottomTranslationMM']]) {
    assert.equal(Object.hasOwn(object, field), cw); if (cw) exactData(object[field], field === 'sourceToBottomTranslationMM' ? [0, 0, -1] : -1);
  }
  const vertices = solid.graph.vertices, bounds = { min: [0, 1, 2].map(a => Math.min(...vertices.map(v => v.pointMM[a]))),
    max: [0, 1, 2].map(a => Math.max(...vertices.map(v => v.pointMM[a]))) };
  exactData(bounds, { min: [0, 0, from], max: [width, spanY, from + height] });
  assert.equal(solid.certificate.incidence.oppositeEdgeUses, true);
  const lineage = prism.lineage, assetFor = ref => {
    const asset = solid.request.assets.find(a => a.sourceId === ref.sourceId); assert.ok(asset);
    assert.equal(asset.face.options.faceId, ref.faceId); assert.equal(asset.face.plane.id, ref.surfaceId);
    exactData(asset.face.model.objects.find(o => o.id === ref.surfaceId), asset.face.plane);
    assert.ok(asset.face.source.includes('@surface #' + ref.surfaceId)); return asset.face;
  };
  assert.equal(lineage.sourceId, prism.request.options.sourceId); assert.equal(lineage.sketchId, sketch.document.id);
  assert.equal(lineage.sourceRevision, prism.request.options.sourceRevision);
  assert.equal(lineage.caps.length, 2); assert.equal(lineage.segments.length, 4); assert.equal(lineage.points.length, 4);
  exactData(lineage.caps.map(c => c.role).sort(), ['bottom', 'top']);
  for (const cap of lineage.caps) {
    assert.equal(cap.status, 'generated'); const face = assetFor(cap.target), z = cap.role === 'bottom' ? from : from + height;
    assert.equal(face.options.orientation, cap.role === 'bottom' ? 'reverse' : 'forward');
    assert.ok(face.plane.controlPoints.flat().every(p => p[2] === z));
    for (const original of sketch.solution.model.objects) {
      const curve = face.loop.edges.find(e => e.id === original.id); assert.ok(curve);
      exactData(curve.controlPoints, original.controlPoints.map(p => [p[0], p[1], z]));
    }
  }
  const edge = id => { const found = solid.graph.edges.find(e => e.id === id); assert.ok(found); assert.equal(found.uses.length, 2); return found; };
  const point = id => { const found = vertices.find(v => v.id === id); assert.ok(found); return found.pointMM; };
  for (const link of lineage.segments) {
    const segment = sketch.document.segments.find(s => s.id === link.segmentId); assert.ok(segment);
    assert.equal(link.startPointId, segment.startPointId); assert.equal(link.endPointId, segment.endPointId);
    assert.equal(link.status, 'preserved'); assert.equal(link.boundaryEdgeStatus, 'generated');
    const original = sketch.solution.model.objects.find(o => o.id === segment.id), wall = assetFor(link.wall);
    exactData(link.nativeParameterDomain, [0, 1]); exactData(wall.plane.knotsV, [0, 0, height, height]);
    exactData(wall.plane.controlPoints, original.controlPoints.map(p => [[p[0], p[1], from], [p[0], p[1], from + height]]));
    assert.equal(wall.options.orientation, cw ? 'reverse' : 'forward');
    for (const [edgeId, z] of [[link.bottomEdgeId, from], [link.topEdgeId, from + height]]) {
      const actual = edge(edgeId).vertexIds.map(point), expected = original.controlPoints.map(p => [p[0], p[1], z]);
      exactData(actual.map(signedData).sort(), expected.map(signedData).sort());
    }
  }
  for (const link of lineage.points) {
    assert.equal(link.status, 'generated'); const original = sketch.solution.points.find(p => p.id === link.pointId); assert.ok(original);
    exactData(point(link.bottomVertexId), [...original.position, from]); exactData(point(link.topVertexId), [...original.position, from + height]);
    exactData([...edge(link.verticalEdgeId).vertexIds].sort(), [link.bottomVertexId, link.topVertexId].sort());
  }
  const actualUses = solid.request.assets.flatMap(a => a.face.topology.loop.uses.map(u => a.sourceId + ':' + u.id));
  const pairedUses = solid.request.edgePairs.flatMap(p => [p.a, p.b].map(u => u.sourceId + ':' + u.useId));
  assert.equal(new Set(actualUses).size, 24); exactData(actualUses.sort(), pairedUses.sort()); deepFrozen(snapshot);
  return { volumeMM3: volume, boundsMM: bounds, orientation: cw ? 'cw' : 'ccw', sketch: sketchProof,
    childNativeWork: prism.report.childNativeWork, bodySHA256: dataHash(solid), evidenceSHA256: dataHash(snapshot.evidence),
    authoredSHA256: sha256(snapshot.save()), originalSegmentWallCapLineage: true, independentOrientedVolumeOracle: true, deepFrozenInActualProcess: true };
}

export function proveConflict(error, classes, baseline) {
  assert.ok(error instanceof classes.CadModelError); assert.equal(error.code, 'NATIVE'); assert.equal(error.operation, 'sketch');
  const cause = error.cause; assert.ok(cause instanceof classes.XYAffineSketchError); assert.equal(cause.code, 'CONFLICT');
  assert.equal(cause.path, '$.constraints[6]'); assert.equal(cause.coordinate, null); assert.equal(cause.exactFraction, null);
  const constraints = baseline.evidence[0].native.document.constraints;
  // y(a)=0, y(b)=y(a), then y(b)=1 is the actual conflicting component;
  // fixed(c), the width equality and the opposite boundary are unrelated.
  exactData(cause.constraintIds, [0, 2, 6].map(i => constraints[i].id));
  for (const key of ['document', 'solution', 'solid', 'bodies', 'evidence']) assert.equal(Object.hasOwn(cause, key), false);
  return { originalTypedCause: true, code: cause.code, path: cause.path, constraintIds: cause.constraintIds,
    noPartialNativeResult: true, independentConflictEquations: ['y(a)=0', 'y(b)=y(a)', 'y(b)=1'] };
}
export function proveUnderconstrained(error, CadModelError) {
  assert.ok(error instanceof CadModelError); assert.equal(error.code, 'CAPABILITY'); assert.equal(error.operation, 'sketch');
  assert.equal(error.cause instanceof Error, false); const proof = proveSketch(error.cause, DEFAULTS, 'underconstrained');
  for (const key of ['solid', 'bodies', 'evidence']) assert.equal(Object.hasOwn(error.cause, key), false);
  return { ...proof, completeActualSuccessRetained: true, explicitFacadeRefusal: true };
}

export function provePreview(result, solid) {
  // The native preview returns independent copied data, not a frozen snapshot.
  assert.notEqual(result.solid, solid); exactData(result.solid, solid);
  exactData(result.options, { maximumFanTriangles: 40 });
  const { mesh, report, boundaries, internalDiagonals } = result;
  assert.equal(report.schema, 'barocss-convex-planar-solid-mesh'); assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion');
  exactData([report.faceCount, report.vertexCount, report.triangleCount, report.boundaryUseCount, report.internalDiagonalCount], [6, 24, 12, 24, 6]);
  exactData([mesh.faces.length, mesh.vertices.length, mesh.positionsMM.length, mesh.normals.length, mesh.parametersUV.length, mesh.indices.length], [6, 24, 72, 72, 48, 36]);
  assert.equal(boundaries.length, 24); assert.equal(internalDiagonals.length, 6);
  exactData(report.directCounts, { parentValidationCount: 1, newGeometryEvaluationCount: 0, retries: 0 });
  assert.equal(report.parentNativeWork.sourceCompilationCount, 6); assert.equal(report.parentNativeWork.bindingObservationCount, 72);
  assert.equal(report.parentNativeWork.totalD1Count, 216); assert.equal(report.parentNativeWork.retries, 0);
  assert.equal(report.nativeAuthority, false); assert.equal(report.float32ProjectionCertified, false);
  const point = i => mesh.positionsMM.slice(i * 3, i * 3 + 3), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0); let sixVolume = 0;
  for (const [i, vertex] of mesh.vertices.entries()) {
    const face = solid.request.assets.find(a => a.sourceId === vertex.sourceId)?.face; assert.ok(face);
    assert.equal(face.options.faceId, vertex.faceId); assert.equal(face.plane.id, vertex.surfaceId);
    const use = face.topology.loop.uses.find(u => u.id === vertex.useId), native = face.topology.vertices.find(v => v.id === vertex.nativeVertexId);
    assert.ok(use && native); assert.equal(use.vertexIds[0], native.id); exactData(point(i), native.point);
    exactData(point(i), solid.graph.vertices.find(v => v.id === vertex.solidVertexId).pointMM);
    const binding = face.bindings.find(b => b.useId === use.id && b.parameter === use.interval[0]);
    exactData(mesh.normals.slice(i * 3, i * 3 + 3), binding.orientedFaceNormal);
    const curve = face.pcurves.find(p => p.id === use.pcurveId).curve;
    exactData(mesh.parametersUV.slice(i * 2, i * 2 + 2), curve.controlPoints[use.sense === 'forward' ? 0 : 1].slice(0, 2));
  }
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const indices = mesh.indices.slice(i, i + 3); assert.ok(indices.every(j => Number.isInteger(j) && j >= 0 && j < 24));
    const [a, b, c] = indices.map(point), normal = mesh.normals.slice(indices[0] * 3, indices[0] * 3 + 3);
    assert.ok(dot(cross(b.map((v, j) => v - a[j]), c.map((v, j) => v - a[j])), normal) > 0);
    sixVolume += dot(a, cross(b, c));
  }
  assert.equal(sixVolume, 6 * 6144);
  for (const boundary of boundaries) {
    assert.equal(boundary.role, 'native-boundary'); const edge = solid.graph.edges.find(e => e.id === boundary.solidEdgeId); assert.ok(edge);
    exactData([...edge.vertexIds].sort(), [...boundary.solidVertexIds].sort());
    exactData(boundary.vertexIndices.map(i => mesh.vertices[i].solidVertexId), boundary.solidVertexIds);
  }
  for (const diagonal of internalDiagonals) {
    assert.equal(diagonal.role, 'display-internal-not-brep-edge');
    const ids = diagonal.vertexIndices.map(i => mesh.vertices[i].solidVertexId).sort();
    assert.equal(solid.graph.edges.some(e => [...e.vertexIds].sort().join(':') === ids.join(':')), false);
  }
  return { faces: 6, vertices: 24, triangles: 12, outwardTriangleVolumeMM3: sixVolume / 6,
    parentNativeWork: report.parentNativeWork, previewSHA256: dataHash(result), basis: 'actual authored XYZ; no conversion' };
}

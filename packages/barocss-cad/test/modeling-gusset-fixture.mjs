import assert from 'node:assert/strict';
import { signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData, PRISM_COUNTS,
  hold, unchanged } from './modeling-constraints-fixture.mjs';
import { prove as proveConvex } from './modeling-intersection-fixture.mjs';
export { signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData, PRISM_COUNTS, hold, unchanged };

// The frozen #1862 matrix. These are reviewed call-site counts, not hidden
// provider instrumentation. Importing this fixture performs no native work.
export const EXPECTED_CAMPAIGN = Object.freeze({ modelCalls: 7, sourceModelCalls: 5, coldModelCalls: 2,
  successfulPrisms: 5, nativeConflicts: 1, representabilityRefusals: 1, tessellations: 1,
  massQueries: 0, cpuBufferPreparations: 0, standaloneValidators: 0,
  sourceDerived: { standaloneSolverAttempts: 7, standaloneSuccessfulSketchCompilations: 5,
    prismSketchReconstructionAttempts: 5, totalSolverAttempts: 12, successfulSketchCompilations: 10,
    prismFaces: 30, prismSourceCompilations: 65, prismBindingObservations: 720, prismD1: 2160,
    previewValidationRoots: 1, previewSourceCompilations: 6, previewBindingObservations: 72, previewD1: 216,
    returnedLedgerSourceCompilations: 71, returnedLedgerBindingObservations: 792, returnedLedgerD1: 2376,
    knownSourceCompilations: 76 }, fullTransitiveNativeCoverage: 'NOT_MEASURED' });
export const DEFAULTS = Object.freeze({ width: 40, height: 24 });

export function constrainedGusset(cad, conflict = false) {
  const model = cad.model(), width = model.parameter('width', 40), height = model.parameter('height', 24);
  const sketch = model.sketch.constrainedPolygon(s => {
    const a = s.point([-0, 0]), b = s.point([width, 0]), c = s.point([width, height]), d = s.point([1, height]);
    s.fixed(a); s.fixed(b); s.fixed(c); s.horizontal(c, d); s.parallelTo(d, a, [1, 3]);
    if (conflict) s.vertical(d, a);
    return [a, b, c, d];
  });
  const gusset = sketch.extrude(8);
  return { model, sketch, gusset, build: () => model.build({ gusset }) };
}
export function authoredDocument(parameters = DEFAULTS, conflict = false) {
  const p = parameter => ({ parameter });
  return { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { ...parameters }, nodes: [
    { kind: 'sketch', profile: 'constrained-polygon',
      points: [[-0, 0], [p('width'), 0], [p('width'), p('height')], [1, p('height')]],
      constraints: [{ kind: 'fixed', point: 0 }, { kind: 'fixed', point: 1 }, { kind: 'fixed', point: 2 },
        { kind: 'horizontal', points: [2, 3] }, { kind: 'parallel-to-direction', points: [3, 0], direction: [1, 3] },
        ...(conflict ? [{ kind: 'vertical', points: [3, 0] }] : [])] },
    { kind: 'extrude', sketch: 0, height: 8 },
  ], outputs: { gusset: { node: 1, side: 'solid' } } };
}

function proveNativeDocument(document, parameters) {
  const authored = authoredDocument(parameters).nodes[0], resolve = v => typeof v === 'number' ? v : parameters[v.parameter];
  const expected = { format: 'barocss-xy-affine-sketch', version: 0, profile: 'exact-affine-binary64', lengthUnit: 'mm', id: 'm0_sk',
    points: authored.points.map((position, i) => ({ id: 'p' + i, position: position.map(resolve) })),
    segments: authored.points.map((_, i) => ({ id: 's' + i, startPointId: 'p' + i, endPointId: 'p' + ((i + 1) % 4) })),
    referenceLines: [{ id: 'dir4', anchor: [0, 0], direction: [1, 3] }],
    constraints: [0, 1, 2].map(i => ({ id: 'c' + i, kind: 'fixed', pointId: 'p' + i, target: authored.points[i].map(resolve) })).concat([
      { id: 'c3', kind: 'horizontal', segmentId: 's2' },
      { id: 'c4', kind: 'segment-parallel-to-fixed-direction', segmentId: 's3', referenceLineId: 'dir4' },
    ]) };
  exactData(document, expected); assert.ok(Object.is(document.points[0].position[0], -0));
}
export function proveSketch(result, parameters = DEFAULTS) {
  assert.equal(result.ok, true); exactData(Object.keys(result).sort(), ['document', 'ok', 'report', 'solution']);
  const { document, solution, report } = result; proveNativeDocument(document, parameters);
  const points = [[0, 0], [parameters.width, 0], [parameters.width, parameters.height], [parameters.height / 3, parameters.height]];
  exactData(solution.points, document.points.map((p, i) => ({ id: p.id, position: points[i] })));
  assert.ok(Object.is(solution.points[0].position[0], 0));
  // Six independent fixed-coordinate equations, then D.y=C.y and
  // 3*(A.x-D.x)=(A.y-D.y): the last two pivots are nonzero (1 and 3).
  // Check equations directly on retained data without invoking another solver.
  for (let i = 0; i < 3; i++) exactData(solution.points[i].position, points[i]);
  assert.equal(solution.points[3].position[1], solution.points[2].position[1]);
  const [a, , , d] = solution.points.map(p => p.position);
  assert.equal(3 * (a[0] - d[0]), a[1] - d[1]); assert.notEqual(d[0], document.points[3].position[0]);
  exactData([report.unknownCount, report.rank, report.equationCount, report.degreesOfFreedom, report.fullyConstrained], [8, 8, 8, 0, true]);
  exactData(report.redundantConstraintIds, []); exactData(report.freeCoordinates, []);
  exactData(report.pivotCoordinates, document.points.flatMap(p => ['x', 'y'].map(axis => ({ pointId: p.id, axis }))));
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
    independentFixedAndDirectionEquations: true, nativeSHA256: dataHash(result) };
}

export function work(snapshot, previous) {
  exactData(snapshot.recomputation, { reusedFeatures: [], evaluatedFeatures: [0, 1] });
  exactData(snapshot.features, [{ kind: 'sketch', index: 0, dependencies: [] }, { kind: 'extrude', index: 1, dependencies: [0] }]);
  exactData(Object.keys(snapshot).sort(), ['bodies', 'parameters', 'suppression', 'features', 'recomputation', 'evidence', 'withParameters', 'withSuppression', 'massProperties', 'save'].sort());
  if (previous) {
    for (const key of ['parameters', 'evidence', 'bodies']) assert.notEqual(snapshot[key], previous[key]);
    for (const i of [0, 1]) assert.notEqual(snapshot.evidence[i], previous.evidence[i]);
    assert.notEqual(snapshot.bodies.gusset.native, previous.bodies.gusset.native);
  }
  deepFrozen(snapshot);
}
export function proveSnapshot(snapshot, parameters = DEFAULTS) {
  const height = 8, from = 0, width = parameters.width, spanY = parameters.height;
  const volume = (width * spanY - spanY * spanY / 6) * height, expected = authoredDocument(parameters), { gusset } = snapshot.bodies;
  assert.equal(snapshot.save(), signedData(expected) + '\n'); assert.ok(snapshot.save().includes('[-0,0]'));
  exactData(snapshot.parameters, expected.parameters); exactData(snapshot.suppression, {}); exactData(Object.keys(snapshot.bodies), ['gusset']);
  assert.equal(snapshot.evidence.length, 2); assert.equal(snapshot.evidence[0].kind, 'sketch'); assert.equal(snapshot.evidence[1].kind, 'extrude');
  const sketch = snapshot.evidence[0].native, prism = snapshot.evidence[1].native, solid = gusset.native;
  assert.equal(gusset.family, 'convex-planar'); assert.equal(solid, prism.solid); exactData(prism.request.sketch, sketch);
  const sketchProof = proveSketch(sketch, parameters); proveConvex(solid, volume, [6, 12, 8]);
  exactData(prism.report.childNativeWork, PRISM_COUNTS); exactData(prism.request.options.chartPolicy, { version: 1, kind: 'coordinate-span' });
  assert.equal(prism.report.profileOrientation, 'ccw'); assert.equal(prism.report.heightMM, height);
  assert.equal(prism.request.options.heightMM, height); assert.equal(prism.report.solid, true);
  for (const [object, field] of [[prism.request.options, 'fromMM'], [prism.report, 'fromMM'], [prism.lineage, 'sourceToBottomTranslationMM']]) {
    assert.equal(Object.hasOwn(object, field), false);
  }
  const vertices = solid.graph.vertices, bounds = { min: [0, 1, 2].map(a => Math.min(...vertices.map(v => v.pointMM[a]))),
    max: [0, 1, 2].map(a => Math.max(...vertices.map(v => v.pointMM[a]))) };
  exactData(bounds, { min: [0, 0, from], max: [width, spanY, from + height] });
  assert.ok(volume > 0); assert.equal(solid.certificate.incidence.oppositeEdgeUses, true);
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
    assert.equal(wall.options.orientation, 'forward');
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
  const slope = lineage.segments.find(link => link.segmentId === 's3'); assert.ok(slope);
  exactData(assetFor(slope.wall).plane.controlPoints, [[[spanY / 3, spanY, 0], [spanY / 3, spanY, 8]], [[0, 0, 0], [0, 0, 8]]]);
  const actualUses = solid.request.assets.flatMap(a => a.face.topology.loop.uses.map(u => a.sourceId + ':' + u.id));
  const pairedUses = solid.request.edgePairs.flatMap(p => [p.a, p.b].map(u => u.sourceId + ':' + u.useId));
  assert.equal(new Set(actualUses).size, 24); exactData(actualUses.sort(), pairedUses.sort()); deepFrozen(snapshot);
  return { volumeMM3: volume, boundsMM: bounds, orientation: 'ccw', sketch: sketchProof,
    childNativeWork: prism.report.childNativeWork, bodySHA256: dataHash(solid), evidenceSHA256: dataHash(snapshot.evidence),
    authoredSHA256: sha256(snapshot.save()), originalSegmentWallCapLineage: true, solvedSlopedWallProvenance: true, independentOrientedVolumeOracle: true, deepFrozenInActualProcess: true };
}

export function proveRefusal(error, classes, code) {
  assert.ok(error instanceof classes.CadModelError); assert.equal(error.code, 'NATIVE'); assert.equal(error.operation, 'sketch');
  const cause = error.cause; assert.ok(cause instanceof classes.XYAffineSketchError); assert.equal(cause.code, code);
  if (code === 'REPRESENTABILITY') {
    assert.equal(cause.path, '$.points[3].position[0]'); exactData(cause.coordinate, { pointId: 'p3', axis: 'x' });
    exactData(cause.exactFraction, { numerator: '1', denominator: '3' }); exactData(cause.constraintIds, []);
  } else {
    assert.equal(code, 'CONFLICT'); assert.equal(cause.path, '$.constraints[5]');
    assert.equal(cause.coordinate, null); assert.equal(cause.exactFraction, null);
    // Preserve the native chronological, nonminimal contributing union.
    // fixed(B) is unrelated; fixed(A), fixed(C), horizontal(C,D), the
    // direction equation and the new vertical(D,A) all contribute.
    exactData(cause.constraintIds, ['c0', 'c2', 'c3', 'c4', 'c5']);
  }
  for (const object of [error, cause]) for (const key of ['document', 'solution', 'solid', 'bodies', 'evidence']) assert.equal(Object.hasOwn(object, key), false);
  return { originalTypedCause: true, code: cause.code, path: cause.path, constraintIds: cause.constraintIds,
    coordinate: cause.coordinate, exactFraction: cause.exactFraction, noPartialNativeResult: true };
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
  assert.equal(sixVolume, 6 * 6912);
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

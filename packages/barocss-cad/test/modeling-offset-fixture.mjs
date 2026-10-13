import assert from 'node:assert/strict';
import { signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData } from './modeling-circle-fixture.mjs';
import { proveNative as proveBoxNative, work } from './modeling-box-cut-fixture.mjs';
import { prove as proveConvex } from './modeling-intersection-fixture.mjs';
export { signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData, work };

// Fixed source-derived call sites, never full-transitive instrumentation or a
// performance claim. The disconnected public refusal still spends its roots.
export const EXPECTED_CAMPAIGN = Object.freeze({ modelCalls: 8, sourceModelCalls: 6, coldModelCalls: 2,
  geometryEvaluatingAttempts: 7, prismValidators: 1, tessellations: 46, cpuBufferPreparations: 0,
  sourceDerived: { evaluatedPrismFeatures: 10, prismRootsIncludingValidator: 11, standaloneSketchRoots: 6,
    differenceRoots: 6, qualifiedBoxAdapters: 12, booleanPanels: 228, booleanObservations: 3420 },
  conservativeRootCeilings: { prismRoots: 11, differenceRoots: 6, cellsPerDifference: 27, panelsPerDifference: 72,
    boxAdapters: 12, facesPerAdapter: 6 }, fullTransitiveNativeCoverage: 'NOT_MEASURED' });
export const DEFAULTS = Object.freeze({ depth: 4, toolY: 8, toolSpanY: 8 });
export const CW_POINTS = Object.freeze([[-3, 2], [-3, 7], [-0, 7], [-0, 2]].map(Object.freeze));
export function topPocket(cad) {
  const model = cad.model(), depth = model.parameter('depth', 4), toolY = model.parameter('toolY', 8), toolSpanY = model.parameter('toolSpanY', 8);
  const plate = model.sketch.rectangle({ min: [-0, 0], max: [32, 24] }).extrude(8);
  const from = model.dimension.add(8, model.dimension.scale(depth, -1));
  const tool = model.sketch.rectangle({ min: [8, toolY], max: [24, model.dimension.add(toolY, toolSpanY)] }).extrude(depth, { from });
  const part = plate.cut(tool);
  return { model, plate, tool, part, build: () => model.build({ plate, tool, part }) };
}
export function authoredDocument(parameters = DEFAULTS) {
  const p = parameter => ({ parameter });
  return { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { ...parameters }, nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [-0, 0], max: [32, 24] }, { kind: 'extrude', sketch: 0, height: 8 },
    { kind: 'sketch', profile: 'rectangle', min: [8, p('toolY')], max: [24, { op: 'add', left: p('toolY'), right: p('toolSpanY') }] },
    { kind: 'extrude', sketch: 2, height: p('depth'), from: { op: 'add', left: 8, right: { op: 'scale', value: p('depth'), factor: -1 } } },
    { kind: 'difference', parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' } },
  ], outputs: { plate: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' }, part: { node: 4, side: 'solid' } } };
}
export function offsetPair(cad) {
  const model = cad.model(), sketch = model.sketch.polygon(CW_POINTS);
  const negative = sketch.extrude(3, { from: -2 }), signedZero = sketch.extrude(3, { from: -0 });
  return { model, negative, signedZero, build: () => model.build({ negative, signedZero }) };
}
export const nativeBodyHash = snapshot => dataHash(snapshot.bodies.part.native);
export const allBodiesHash = snapshot => dataHash(snapshot.bodies);
export const PRISM_COUNTS = Object.freeze({ sketchReconstructionCount: 1, initialFaceConstructionCount: 6,
  solidQualificationCount: 1, solidFaceReconstructionCount: 6, sourceCompilationCount: 13,
  bindingObservationCount: 144, totalD1Count: 432, retries: 0 });

// Independent retained-data arithmetic only: no geometry helper, compiler,
// classifier, native validator, constructor or tessellator is invoked here.
export function provePrism(result, from, height, volume, orientation = 'ccw') {
  const { request, report, lineage, solid } = result, sketch = request.sketch;
  exactData(request.options.chartPolicy, { version: 1, kind: 'coordinate-span' });
  assert.ok(Object.is(request.options.fromMM, from)); assert.ok(Object.is(report.fromMM, from));
  exactData(lineage.sourceToBottomTranslationMM, [0, 0, from]);
  assert.equal(report.heightMM, height); assert.equal(request.options.heightMM, height); assert.equal(report.profileOrientation, orientation);
  exactData(report.childNativeWork, PRISM_COUNTS); proveConvex(solid, volume, [6, 12, 8]);
  assert.equal(solid.certificate.incidence.oppositeEdgeUses, true);
  for (const curve of sketch.solution.model.objects) {
    assert.equal(curve.kind, 'curve'); assert.ok(curve.controlPoints.every(p => Object.is(p[2], 0)), 'original sketch coefficients stay at Z0');
  }
  assert.equal(lineage.sourceId, request.options.sourceId); assert.equal(lineage.sketchId, sketch.document.id);
  assert.equal(lineage.sourceRevision, request.options.sourceRevision);
  assert.equal(lineage.caps.length, 2); assert.equal(lineage.segments.length, 4); assert.equal(lineage.points.length, 4);
  const assetFor = reference => {
    const asset = solid.request.assets.find(a => a.sourceId === reference.sourceId); assert.ok(asset);
    assert.equal(asset.face.options.faceId, reference.faceId); assert.equal(asset.face.plane.id, reference.surfaceId);
    exactData(asset.face.model.objects.find(o => o.id === reference.surfaceId), asset.face.plane);
    assert.ok(asset.face.source.includes('@surface #' + reference.surfaceId)); return asset.face;
  };
  for (const cap of lineage.caps) {
    assert.equal(cap.status, 'generated'); const face = assetFor(cap.target), z = cap.role === 'bottom' ? from : from + height;
    assert.equal(face.options.orientation, cap.role === 'bottom' ? 'reverse' : 'forward');
    assert.ok(face.plane.controlPoints.flat().every(p => Object.is(p[2], z)));
    const c = face.plane.controlPoints; assert.ok(c[1][0][0] > c[0][0][0] && c[1][0][1] === c[0][0][1]);
    assert.ok(c[0][1][1] > c[0][0][1] && c[0][1][0] === c[0][0][0]);
    for (const curve of face.loop.edges) assert.ok(curve.controlPoints.every(p => Object.is(p[2], z)));
    if (Object.is(z, -0)) assert.ok(face.source.includes('-0'), 'compiled bottom Source0 retains signed zero');
  }
  const edge = id => { const e = solid.graph.edges.find(e => e.id === id); assert.ok(e); assert.equal(e.uses.length, 2); return e; };
  const vertices = e => e.vertexIds.map(id => solid.graph.vertices.find(v => v.id === id).pointMM);
  for (const link of lineage.segments) {
    const segment = sketch.document.segments.find(s => s.id === link.segmentId); assert.ok(segment);
    assert.equal(link.startPointId, segment.startPointId); assert.equal(link.endPointId, segment.endPointId);
    assert.equal(link.status, 'preserved'); assert.equal(link.boundaryEdgeStatus, 'generated');
    const original = sketch.solution.model.objects.find(o => o.id === segment.id), wall = assetFor(link.wall);
    exactData(link.nativeParameterDomain, [original.knots[1], original.knots[2]]);
    exactData(wall.plane.knotsV, [0, 0, height, height]);
    exactData(wall.plane.controlPoints, original.controlPoints.map(p => [[p[0], p[1], from], [p[0], p[1], from + height]]));
    assert.equal(wall.options.orientation, orientation === 'ccw' ? 'forward' : 'reverse');
    assert.ok(vertices(edge(link.bottomEdgeId)).every(p => p[2] === from));
    assert.ok(vertices(edge(link.topEdgeId)).every(p => p[2] === from + height));
  }
  for (const link of lineage.points) {
    assert.equal(link.status, 'generated'); const point = sketch.solution.points.find(p => p.id === link.pointId); assert.ok(point);
    const bottom = solid.graph.vertices.find(v => v.id === link.bottomVertexId), top = solid.graph.vertices.find(v => v.id === link.topVertexId);
    assert.ok(bottom && top);
    // Qualified graph coordinates are mathematical rationals; zero may be
    // canonicalized. Request/source/lineage coefficient bits above stay strict.
    assert.ok([0, 1].every(a => bottom.pointMM[a] === point.position[a] && top.pointMM[a] === point.position[a]));
    assert.ok(bottom.pointMM[2] === from); assert.ok(top.pointMM[2] === from + height);
    assert.deepEqual(new Set(edge(link.verticalEdgeId).vertexIds), new Set([bottom.id, top.id]));
  }
  const pairedUses = solid.request.edgePairs.flatMap(pair => [pair.a, pair.b].map(use => use.sourceId + ':' + use.useId));
  const actualUses = solid.request.assets.flatMap(a => a.face.topology.loop.uses.map(use => a.sourceId + ':' + use.id));
  assert.equal(new Set(pairedUses).size, 24); assert.deepEqual([...pairedUses].sort(), [...actualUses].sort());
  deepFrozen(result);
  return { fromMM: from, heightMM: height, volumeMM3: volume, childNativeWork: report.childNativeWork, nativeSHA256: dataHash(result) };
}
function proveUV(points, surface, uv) {
  assert.equal(uv.length, 4); const p = surface.controlPoints[0][0], pu = surface.controlPoints[1][0], pv = surface.controlPoints[0][1];
  for (let i = 0; i < 4; i++) {
    const [u, v] = uv[i], un = BigInt(u.numerator), ud = BigInt(u.denominator), vn = BigInt(v.numerator), vd = BigInt(v.denominator);
    assert.ok(ud > 0n && vd > 0n && un >= 0n && un <= ud && vn >= 0n && vn <= vd);
    for (let a = 0; a < 3; a++) assert.equal(BigInt(p[a]) * ud * vd + BigInt(pu[a] - p[a]) * un * vd
      + BigInt(pv[a] - p[a]) * vn * ud, BigInt(points[i][a]) * ud * vd);
  }
}
function normal(surface) {
  const p = surface.controlPoints[0][0], u = surface.controlPoints[1][0].map((v, i) => BigInt(v) - BigInt(p[i]));
  const v = surface.controlPoints[0][1].map((v, i) => BigInt(v) - BigInt(p[i]));
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
}
export function proveNative(native, volume, panels, bodies = 1) {
  const result = proveBoxNative(native, volume, panels, bodies); assert.equal(native.report.schema, 'barocss-axis-box-solid-boolean');
  let inwardToolLinks = 0;
  for (const panel of native.panels) {
    const points = panel.vertexIds.map(id => native.vertices.find(v => v.id === id).pointMM), n = normal(panel.bundle.geometry.objects[0]);
    assert.equal(n[panel.axis], BigInt(panel.sign) * BigInt(panel.areaMM2)); assert.ok(n.every((v, a) => a === panel.axis || v === 0n));
    const source = native.sources.find(s => s.sourceId === panel.sourceId); exactData(source.model, panel.bundle.geometry);
    assert.equal(Object.hasOwn(panel.bundle, 'solid'), false);
    for (const link of panel.lineage) {
      const face = native[link.operand].shell.faces.find(f => f.id === link.globalFaceId), surface = face.bundle.geometry.objects[0];
      proveUV(points, surface, link.uvCorners); const original = normal(surface);
      assert.ok(original[panel.axis] !== 0n); assert.equal(link.relativeOrientation, (original[panel.axis] > 0n ? 1 : -1) * panel.sign);
      if (link.operand === 'b') { assert.equal(link.relativeOrientation, -1); inwardToolLinks++; }
    }
  }
  assert.ok(inwardToolLinks > 0);
  return { ...result, inwardToolLinks, bodySHA256: dataHash(native) };
}
export function proveSnapshot(snapshot, volume, panels = 46) {
  const { plate, tool, part } = snapshot.bodies, p = snapshot.parameters, from = 8 - p.depth;
  assert.deepEqual(Object.keys(snapshot.bodies).sort(), ['part', 'plate', 'tool']); exactData(snapshot.parameters, { depth: p.depth, toolY: p.toolY, toolSpanY: p.toolSpanY });
  assert.equal(snapshot.save(), signedData(authoredDocument(p)) + '\n');
  assert.equal(plate.family, 'convex-planar'); assert.equal(tool.family, 'convex-planar'); assert.equal(part.family, 'orthogonal-cell');
  assert.equal(plate.native, snapshot.evidence[1].native.solid); assert.equal(tool.native, snapshot.evidence[3].native.solid);
  proveConvex(plate.native, 6144, [6, 12, 8]); const toolPrism = provePrism(snapshot.evidence[3].native, from, p.depth, 16 * p.toolSpanY * p.depth);
  exactData(snapshot.evidence[3].native.request.sketch, snapshot.evidence[2].native);
  for (const [data, field] of [[snapshot.evidence[1].native.request.options, 'fromMM'], [snapshot.evidence[1].native.report, 'fromMM'],
    [snapshot.evidence[1].native.lineage, 'sourceToBottomTranslationMM']]) assert.equal(Object.hasOwn(data, field), false);
  const evidence = snapshot.evidence[4], native = part.native;
  assert.equal(evidence.kind, 'difference'); assert.equal(evidence.parents[0], plate.native); assert.equal(evidence.parents[1], tool.native); assert.equal(evidence.native, native);
  exactData(native.a.shell.origin, [-0, 0, 0]); exactData(native.a.shell.sides, [32, 24, 8]);
  exactData(native.b.shell.origin, [8, p.toolY, from]); exactData(native.b.shell.sides, [16, p.toolSpanY, p.depth]);
  const originalFaces = [plate.native, tool.native].flatMap(n => n.graph.faces), ids = new Set(originalFaces.map(f => f.faceId)), sources = new Set(originalFaces.map(f => f.sourceId));
  assert.equal(ids.size, 12);
  for (const asset of [native.a, native.b]) { assert.equal(sources.has(asset.sourceId), false); for (const face of asset.shell.faces) { assert.equal(ids.has(face.id), false); assert.equal(ids.has(face.bundle.topology.face.id), false); } }
  const result = proveNative(native, volume, panels), directions = new Set(), coords = [native.grid.x, native.grid.y, native.grid.z];
  for (const cell of native.cells) assert.equal(cell.occupied, cell.insideA && !cell.insideB);
  for (const panel of native.panels) {
    const points = panel.vertexIds.map(id => native.vertices.find(v => v.id === id).pointMM), center = [0, 1, 2].map(a => points.reduce((sum, v) => sum + v[a], 0) / 4);
    const cell = native.cells.find(c => c.index.every((v, i) => v === panel.cellIndex[i])); assert.ok(cell.occupied);
    const cellCenter = cell.index.map((v, a) => (coords[a][v] + coords[a][v + 1]) / 2); assert.ok((center[panel.axis] - cellCenter[panel.axis]) * panel.sign > 0);
    if (panel.emptyCellIndex) assert.equal(native.cells.find(c => c.index.every((v, i) => v === panel.emptyCellIndex[i])).occupied, false);
    if (panel.lineage.some(l => l.operand === 'b')) {
      directions.add(panel.axis + ':' + panel.sign); const lo = [8, p.toolY, from][panel.axis], hi = [24, p.toolY + p.toolSpanY, 8][panel.axis];
      assert.ok(center[panel.axis] === lo || center[panel.axis] === hi); assert.equal(panel.sign, center[panel.axis] === lo ? 1 : -1);
      if (panel.axis === 2) { assert.equal(center[2], from); assert.equal(panel.sign, 1, 'pocket floor points up'); }
    }
    if (panel.axis === 2 && (center[2] === 8 || (from === 0 && center[2] === 0)))
      assert.equal(center[0] > 8 && center[0] < 24 && center[1] > p.toolY && center[1] < p.toolY + p.toolSpanY, false, 'opening has no covering tile');
  }
  assert.deepEqual([...directions].sort(), (from > 0 ? ['0:-1', '0:1', '1:-1', '1:1', '2:1'] : ['0:-1', '0:1', '1:-1', '1:1']).sort());
  const prismReports = snapshot.recomputation.evaluatedFeatures.filter(i => snapshot.evidence[i].kind === 'extrude').map(index => {
    const report = snapshot.evidence[index].native.report.childNativeWork; exactData(report, PRISM_COUNTS); return { index, report };
  });
  deepFrozen(snapshot); return { ...result, parameters: snapshot.parameters, features: snapshot.features, authoredSHA256: sha256(snapshot.save()),
    toolPrism, evaluatedPrismReports: prismReports, originalConvexParentIdentity: true, cavityFloorUpAndOpenTop: true };
}
export function proveOffsetPair(snapshot) {
  exactData(snapshot.recomputation, { reusedFeatures: [], evaluatedFeatures: [0, 1, 2] });
  exactData(snapshot.features.map(f => [f.kind, f.dependencies]), [['sketch', []], ['extrude', [0]], ['extrude', [0]]]);
  const d = JSON.parse(snapshot.save()); exactData(d.nodes, [{ kind: 'sketch', profile: 'polygon', points: CW_POINTS },
    { kind: 'extrude', sketch: 0, height: 3, from: -2 }, { kind: 'extrude', sketch: 0, height: 3, from: -0 }]);
  exactData(d.outputs, { negative: { node: 1, side: 'solid' }, signedZero: { node: 2, side: 'solid' } });
  const reports = [];
  for (const [name, index, from] of [['negative', 1, -2], ['signedZero', 2, -0]]) {
    assert.equal(snapshot.bodies[name].native, snapshot.evidence[index].native.solid);
    exactData(snapshot.evidence[index].native.request.sketch, snapshot.evidence[0].native);
    reports.push(provePrism(snapshot.evidence[index].native, from, 3, 45, 'cw'));
  }
  assert.ok(snapshot.save().includes('"from":-0')); deepFrozen(snapshot); return { reports, bodySHA256: allBodiesHash(snapshot) };
}
export function provePreview(native, panels) {
  assert.equal(panels.length, 46); let vertices = 0, triangles = 0;
  for (const [i, sample] of panels.entries()) {
    const panel = native.panels[i], surface = panel.bundle.geometry.objects[0], packet = sample.result.packet;
    assert.equal(sample.panelId, panel.id); assert.equal(sample.sourceId, panel.sourceId); assert.equal(sample.surfaceId, surface.id);
    exactData(sample.options, { countU: 2, countV: 2, revision: 0 });
    assert.equal(packet.positions.length, 12); assert.equal(packet.parameters.length, 8); assert.equal(packet.indices.length, 6);
    assert.equal(packet.surfaceId, surface.id); assert.equal(packet.revision, 0); assert.equal(packet.version, 0);
    assert.equal(packet.lengthUnit, 'mm'); assert.equal(packet.winding, 'ccw');
    exactData(packet.parameters, [0, 0, 0, 1, 1, 0, 1, 1]); exactData(packet.indices, [0, 2, 1, 2, 3, 1]);
    exactData(sample.result.report.grid, { countU: 2, countV: 2 }); assert.equal(sample.result.report.vertexCount, 4); assert.equal(sample.result.report.triangleCount, 2);
    const p = surface.controlPoints[0][0], pu = surface.controlPoints[1][0], pv = surface.controlPoints[0][1];
    for (let j = 0; j < 4; j++) for (let a = 0; a < 3; a++) {
      assert.equal(packet.positions[j * 3 + a], p[a] + (pu[a] - p[a]) * packet.parameters[j * 2] + (pv[a] - p[a]) * packet.parameters[j * 2 + 1]);
      assert.equal(packet.normals[j * 3 + a], a === panel.axis ? panel.sign : 0);
    }
    vertices += 4; triangles += 2;
  }
  assert.equal(vertices, 184); assert.equal(triangles, 92);
  return { panels: 46, vertices, triangles, basis: 'actual authored XYZ; no conversion', actualNativeTessellations: 46, booleanRevalidations: 0 };
}

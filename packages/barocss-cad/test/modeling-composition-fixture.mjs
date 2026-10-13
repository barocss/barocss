import assert from 'node:assert/strict';
import { signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData } from './modeling-circle-fixture.mjs';
export { signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData };
export const EXPECTED_CAMPAIGN = Object.freeze({ modelCalls: 8, sourceModelCalls: 6, coldModelCalls: 2, tessellations: 44,
  sourceDerived: { prismEvaluations: 12, boxAdapters: 13, directUnions: 3, composedCalls: 7, axisBoxRoots: 10,
    booleanPanels: 380, booleanObservations: 5700, knownCompilations: 588, knownFaceConstructions: 602 },
  fullTransitiveNativeCoverage: 'NOT_MEASURED' });
export const DEFAULTS = Object.freeze({ legWidth: 8, slotX: 16, slotY: 2, slotWidth: 8, slotSpanY: 4 });
export function bracketSlot(cad) {
  const model = cad.model();
  const legWidth = model.parameter('legWidth', 8), slotX = model.parameter('slotX', 16), slotY = model.parameter('slotY', 2);
  const slotWidth = model.parameter('slotWidth', 8), slotSpanY = model.parameter('slotSpanY', 4);
  const base = model.sketch.rectangle({ width: 32, height: 8 }).extrude(8);
  const leg = model.sketch.rectangle({ min: [-0, 0], max: [legWidth, 24] }).extrude(8);
  const bracket = base.union(leg);
  const tool = model.sketch.rectangle({ min: [slotX, slotY], max: [model.dimension.add(slotX, slotWidth), model.dimension.add(slotY, slotSpanY)] }).extrude(8);
  const slotted = bracket.cut(tool);
  return { model, base, leg, bracket, tool, slotted, build: () => model.build({ bracket, slotted }) };
}
export function authoredDocument(parameters = DEFAULTS) {
  const p = parameter => ({ parameter }), add = (a, b) => ({ op: 'add', left: p(a), right: p(b) });
  return { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { ...parameters }, nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [32, 8] }, { kind: 'extrude', sketch: 0, height: 8 },
    { kind: 'sketch', profile: 'rectangle', min: [-0, 0], max: [p('legWidth'), 24] }, { kind: 'extrude', sketch: 2, height: 8 },
    { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } },
    { kind: 'sketch', profile: 'rectangle', min: [p('slotX'), p('slotY')], max: [add('slotX', 'slotWidth'), add('slotY', 'slotSpanY')] },
    { kind: 'extrude', sketch: 5, height: 8 }, { kind: 'difference', parent: { node: 4, side: 'solid' }, tool: { node: 6, side: 'solid' } },
  ], outputs: { bracket: { node: 4, side: 'solid' }, slotted: { node: 7, side: 'solid' } } };
}
export const nativeBodyHash = snapshot => dataHash(snapshot.bodies.slotted.native);
export function work(snapshot, reused, evaluated, previous) {
  assert.deepEqual(snapshot.recomputation, { reusedFeatures: reused, evaluatedFeatures: evaluated });
  assert.deepEqual([...reused, ...evaluated], [0, 1, 2, 3, 4, 5, 6, 7]); deepFrozen(snapshot);
  assert.deepEqual(snapshot.features.map(f => [f.kind, f.dependencies]), [
    ['sketch', []], ['extrude', [0]], ['sketch', []], ['extrude', [2]], ['union', [1, 3]],
    ['sketch', []], ['extrude', [5]], ['difference', [4, 6]],
  ]);
  if (previous) {
    for (const i of reused) assert.equal(snapshot.evidence[i], previous.evidence[i]);
    for (const i of evaluated) assert.notEqual(snapshot.evidence[i], previous.evidence[i]);
    if (reused.includes(4)) assert.equal(snapshot.bodies.bracket, previous.bodies.bracket);
    if (reused.includes(7)) assert.equal(snapshot.bodies.slotted, previous.bodies.slotted);
  }
}
function proveUV(points, surface, uv) {
  assert.equal(uv.length, 4);
  const p = surface.controlPoints[0][0], pu = surface.controlPoints[1][0], pv = surface.controlPoints[0][1];
  for (let i = 0; i < 4; i++) {
    const [u, v] = uv[i], un = BigInt(u.numerator), ud = BigInt(u.denominator), vn = BigInt(v.numerator), vd = BigInt(v.denominator);
    assert.ok(ud > 0n && vd > 0n && un >= 0n && un <= ud && vn >= 0n && vn <= vd);
    for (let a = 0; a < 3; a++) assert.equal(BigInt(p[a]) * ud * vd + BigInt(pu[a] - p[a]) * un * vd
      + BigInt(pv[a] - p[a]) * vn * ud, BigInt(points[i][a]) * ud * vd);
  }
}
function supportNormal(surface) {
  const p = surface.controlPoints[0][0], u = surface.controlPoints[1][0].map((v, i) => BigInt(v) - BigInt(p[i]));
  const v = surface.controlPoints[0][1].map((v, i) => BigInt(v) - BigInt(p[i]));
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
}
export function proveNative(native, volume, panels, bodies = 1) {
  const r = native.report; assert.equal(r.schema, 'barocss-orthogonal-solid-boolean'); assert.equal(r.operation, 'difference');
  assert.equal(r.operationCount, 2); assert.equal(r.originalBoxCount, 3); assert.equal(native.left.kind, 'axis-box');
  assert.equal(r.geometryFamily, 'exact-integer-orthogonal-cell-solid-v0'); assert.equal(r.volumeMM3, volume);
  assert.equal(r.bodyCount, bodies); assert.equal(native.bodies.length, bodies); assert.equal(r.empty, bodies === 0); assert.equal(r.solid, bodies !== 0);
  assert.equal(native.bodies.reduce((n, b) => n + b.volumeMM3, 0), volume);
  assert.equal(native.cells.filter(c => c.occupied).reduce((n, c) => n + c.volumeMM3, 0), volume);
  assert.equal(native.shells.reduce((n, s) => n + s.signedVolumeMM3, 0), volume);
  assert.equal(r.panelCount, panels); assert.equal(native.panels.length, panels); assert.equal(native.sources.length, panels);
  assert.equal(r.incidence.everyEdgeTwoOppositeUses, true); assert.equal(r.incidence.orientedVertexLinksSingleCycles, true);
  assert.equal(r.quality.arbitraryCurvedSolidCertified, false); assert.equal(r.quality.weldingPerformed, false);
  assert.equal(r.quality.nativePanelFaceSubsetSolidFalse, true);
  const parent = native.left.result, originals = [parent.a, parent.b, native.right], models = [...parent.originalModels, native.rightModel];
  assert.equal(parent.report.operation, 'union'); assert.equal(parent.panels.length, 14);
  assert.equal(r.nativeWork.stages.length, 2); assert.deepEqual(r.nativeWork.stages.map(s => s.faceBuildCount), [14, panels]);
  assert.equal(r.nativeWork.totals.observationCount, 15 * (14 + panels));
  assert.equal(r.nativeWork.totals.outputSourceCompilationCount, 14 + panels);
  assert.equal(r.nativeWork.totals.originalSourceCompilationCount, 3); assert.equal(r.nativeWork.totals.operandSolidValidationCount, 3);
  assert.equal(native.observations.length, 15 * panels); assert.equal(r.nativeWork.scope, 'all-chain-reconstruction-attempts-opaque-provider-internals-excluded');
  for (const [i, original] of originals.entries()) {
    assert.equal(original.sourceVersion, 0); assert.equal(original.shell.faces.length, 6); assert.equal(models[i].objects.length, 6);
    for (const face of original.shell.faces) {
      const support = face.bundle.geometry.objects[0]; exactData(models[i].objects.find(o => o.id === support.id), support);
      assert.ok(original.source.includes('@surface #' + support.id));
    }
  }
  let inwardToolLineage = 0;
  for (const panel of native.panels) {
    const source = native.sources.find(s => s.sourceId === panel.sourceId), points = panel.vertexIds.map(id => native.vertices.find(v => v.id === id).pointMM);
    assert.ok(source); assert.equal(source.panelId, panel.id); exactData(source.model, panel.bundle.geometry);
    assert.equal(source.model.objects.length, 5); assert.equal(panel.bundle.topology.face.orientation, 'forward');
    // The retained FaceBundle has no promoted Solid flag; the unchanged native
    // Boolean report explicitly records its Face subset as solid:false.
    assert.equal(Object.hasOwn(panel.bundle, 'solid'), false);
    const generatedNormal = supportNormal(panel.bundle.geometry.objects[0]);
    assert.equal(generatedNormal[panel.axis], BigInt(panel.sign) * BigInt(panel.areaMM2));
    assert.ok(generatedNormal.every((value, axis) => axis === panel.axis || value === 0n));
    assert.ok(panel.lineage.length > 0);
    for (const link of panel.parentPanels) {
      assert.equal(link.evaluationId, parent.options.evaluationId);
      const p = parent.panels.find(p => p.id === link.panelId && p.sourceId === link.sourceId); assert.ok(p);
      assert.ok(link.relativeOrientation === 1 || link.relativeOrientation === -1); proveUV(points, p.bundle.geometry.objects[0], link.uvCorners);
    }
    for (const link of panel.lineage) {
      assert.ok(Number.isInteger(link.originalIndex) && link.originalIndex >= 0 && link.originalIndex < 3);
      const original = originals[link.originalIndex], face = original.shell.faces.find(f => f.id === link.globalFaceId); assert.ok(face);
      assert.equal(link.sourceId, original.sourceId); assert.equal(link.shellId, original.shell.id);
      assert.equal(link.localFaceId, face.bundle.topology.face.id); assert.equal(link.surfaceId, face.bundle.geometry.objects[0].id);
      proveUV(points, face.bundle.geometry.objects[0], link.uvCorners);
      const originalNormal = supportNormal(face.bundle.geometry.objects[0]);
      assert.ok(originalNormal[panel.axis] !== 0n && originalNormal.every((value, axis) => axis === panel.axis || value === 0n));
      assert.equal(link.relativeOrientation, (originalNormal[panel.axis] > 0n ? 1 : -1) * panel.sign);
      if (link.originalIndex === 2) { assert.equal(link.relativeOrientation, -1); inwardToolLineage++; }
      if (link.originalIndex < 2) assert.ok(panel.parentPanels.some(pp => {
        const p = parent.panels.find(p => p.id === pp.panelId && p.sourceId === pp.sourceId);
        return p.lineage.some(ancestor => ancestor.operand === (link.originalIndex === 0 ? 'a' : 'b')
          && ancestor.sourceId === link.sourceId && ancestor.globalFaceId === link.globalFaceId
          && pp.relativeOrientation * ancestor.relativeOrientation === link.relativeOrientation);
      }), 'discarded original provenance must never reappear without an immediate parent panel');
    }
  }
  if (panels > 0) assert.ok(inwardToolLineage > 0, 'difference must retain actual inward tool wall lineage');
  for (const edge of native.edges) { assert.equal(edge.uses.length, 2); assert.notEqual(edge.uses[0].sense, edge.uses[1].sense); }
  for (const vertex of native.vertices) assert.equal(new Set(vertex.link.cycleEdgeIds).size, vertex.link.edgeIds.length);
  return { volumeMM3: volume, panels, bodies, report: r, originalSourceHashes: originals.map(o => sha256(o.source)), inwardToolLineage, bodySHA256: dataHash(native) };
}
export function proveSnapshot(snapshot, volume, unionVolume) {
  assert.deepEqual(Object.keys(snapshot.bodies).sort(), ['bracket', 'slotted']);
  assert.equal(snapshot.bodies.bracket.family, 'orthogonal-cell'); assert.equal(snapshot.bodies.slotted.family, 'orthogonal-cell');
  const evidence = snapshot.evidence[7], parent = snapshot.evidence[4], native = snapshot.bodies.slotted.native;
  assert.equal(evidence.kind, 'difference'); assert.equal(evidence.composition, 'union-slot'); assert.equal(evidence.native, native);
  assert.equal(evidence.parent, parent.native); assert.equal(snapshot.bodies.bracket.native, parent.native);
  assert.equal(evidence.tool, snapshot.evidence[6].native.solid); assert.equal(Object.hasOwn(evidence, 'parents'), false);
  assert.equal(parent.native.report.volumeMM3, unionVolume); exactData(native.left.result, parent.native);
  assert.ok(parent.native.b.source.includes('-0')); assert.ok(Object.is(parent.native.b.shell.origin[0], -0));
  const authored = authoredDocument(snapshot.parameters);
  assert.equal(snapshot.save(), signedData(authored) + '\n');
  const result = proveNative(native, volume, 44); deepFrozen(snapshot);
  result.evaluatedPrismReports = snapshot.recomputation.evaluatedFeatures.filter(i => snapshot.evidence[i].kind === 'extrude')
    .map(i => ({ index: i, report: snapshot.evidence[i].native.report.childNativeWork }));
  for (const { report } of result.evaluatedPrismReports) assert.equal(report.sourceCompilationCount, 13);
  return result;
}
export function provePreview(native, panels) {
  assert.equal(panels.length, 44); let vertices = 0, triangles = 0;
  for (const [i, sample] of panels.entries()) {
    const panel = native.panels[i], source = native.sources.find(s => s.sourceId === panel.sourceId), surface = panel.bundle.geometry.objects[0], packet = sample.result.packet;
    assert.equal(sample.panelId, panel.id); assert.equal(sample.sourceId, source.sourceId); assert.equal(sample.surfaceId, surface.id);
    assert.deepEqual(sample.options, { countU: 2, countV: 2, revision: 0 });
    assert.equal(packet.positions.length, 12); assert.equal(packet.parameters.length, 8); assert.equal(packet.indices.length, 6);
    const p = surface.controlPoints[0][0], pu = surface.controlPoints[1][0], pv = surface.controlPoints[0][1];
    for (let j = 0; j < 4; j++) for (let a = 0; a < 3; a++) {
      assert.equal(packet.positions[j * 3 + a], p[a] + (pu[a] - p[a]) * packet.parameters[j * 2] + (pv[a] - p[a]) * packet.parameters[j * 2 + 1]);
      assert.equal(packet.normals[j * 3 + a], a === panel.axis ? panel.sign : 0);
    }
    vertices += 4; triangles += 2;
  }
  assert.equal(vertices, 176); assert.equal(triangles, 88);
  return { panels: 44, vertices, triangles, basis: 'actual authored XYZ; no conversion', actualNativeTessellations: 44, booleanRevalidations: 0 };
}

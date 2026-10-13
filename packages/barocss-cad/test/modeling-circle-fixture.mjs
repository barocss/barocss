import assert from 'node:assert/strict';
import { DIRECT_COUNTS, RESIDUAL, signedData, sha256, dataHash, clone, exactData, deepFrozen,
  derivativeNumerators, capResidual, provePreview } from './stored-circle-prism-solid-fixture.mjs';
export { RESIDUAL, signedData, sha256, dataHash, clone, exactData, deepFrozen, provePreview };

// These are reviewed source-derived counts for #1677's exact matrix, not runtime
// instrumentation, full-transitive coverage, or a speed/savings measurement.
export const EXPECTED_CAMPAIGN = Object.freeze({ modelCalls: 8, sourceModelCalls: 6, coldModelCalls: 2, previews: 1,
  standaloneSketchBuilds: 5, shellBuildAndQualifierAttempts: 7, successfulQualifications: 6, exactRefusals: 1,
  shellConstructionRoots: 15, knownSourceCompilations: 26,
  sourceDerivedDirectCallSiteAttempts: Object.freeze({ CurveD0: 2094, SurfaceD0: 766, CurveD1: 120, SurfaceD1: 309 }),
  fullTransitiveNativeCoverage: 'NOT_MEASURED' });
export const CASES = Object.freeze({
  initial: { parameters: { centerX: 2, centerY: -3, diameter: 8, height: 6 }, bounds: { min: [-2, -7, 0], max: [6, 1, 6] } },
  taller: { parameters: { centerX: 2, centerY: -3, diameter: 8, height: 9 }, bounds: { min: [-2, -7, 0], max: [6, 1, 9] } },
  narrower: { parameters: { centerX: 2, centerY: -3, diameter: 4, height: 9 }, bounds: { min: [0, -5, 0], max: [4, -1, 9] } },
  recovered: { parameters: { centerX: -0, centerY: .25, diameter: 1, height: 1.5 }, bounds: { min: [-.5, -.25, 0], max: [.5, .75, 1.5] } },
  coldEdited: { parameters: { centerX: -0, centerY: .25, diameter: 1, height: 3 }, bounds: { min: [-.5, -.25, 0], max: [.5, .75, 3] } },
});

export function roundPost(cad) {
  const model = cad.model();
  const cx = model.parameter('centerX', 2), cy = model.parameter('centerY', -3);
  const diameter = model.parameter('diameter', 8), height = model.parameter('height', 6);
  // Direct owned center parameters are intentional: adding zero changes -0.
  const post = model.sketch.circle({ center: [cx, cy], radius: model.dimension.scale(diameter, .5) }).extrude(height);
  return { model, post, build: () => model.build({ post }) };
}
export function authoredDocument(parameters) {
  return { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { ...parameters }, nodes: [
    { kind: 'sketch', profile: 'circle', center: [{ parameter: 'centerX' }, { parameter: 'centerY' }], radius: { op: 'scale', value: { parameter: 'diameter' }, factor: .5 } },
    { kind: 'extrude', sketch: 0, height: { parameter: 'height' } },
  ], outputs: { post: { node: 1, side: 'solid' } } };
}
export function snapshotData(snapshot) {
  return { text: snapshot.save(), parameters: snapshot.parameters, suppression: snapshot.suppression,
    features: snapshot.features, recomputation: snapshot.recomputation, evidence: snapshot.evidence, bodies: snapshot.bodies };
}
export const nativeBodyHash = snapshot => dataHash(snapshot.bodies.post.native);
export function errorData(error, ancestors = new Set()) {
  if (error === undefined) return null;
  if (error === null || typeof error === 'string' || typeof error === 'boolean') return error;
  if (typeof error === 'number') return Number.isFinite(error) ? error : String(error);
  if (typeof error !== 'object') return String(error);
  if (ancestors.has(error)) return '[Circular diagnostic reference]';
  ancestors.add(error);
  let result;
  if (Array.isArray(error)) result = error.map(value => errorData(value, ancestors));
  else {
    // Include non-enumerable Error message/stack/cause and provider diagnostics.
    // Assertion payloads may contain functions/BigInts/cycles; describe those
    // without losing the original native error or failing to write its receipt.
    const descriptors = Object.getOwnPropertyDescriptors(error);
    const keys = error instanceof Error ? Object.getOwnPropertyNames(error) : Object.keys(error);
    result = Object.fromEntries(keys.map(key => [key, Object.hasOwn(descriptors[key], 'value')
      ? errorData(descriptors[key].value, ancestors) : '[Accessor diagnostic field]']));
    if (error instanceof Error) result = { name: error.name, ...result, cause: errorData(error.cause, ancestors) };
  }
  ancestors.delete(error); return result;
}
export function work(snapshot, reused, evaluated, previous) {
  exactData(snapshot.recomputation, { reusedFeatures: reused, evaluatedFeatures: evaluated });
  exactData([...reused, ...evaluated], [0, 1]);
  exactData(snapshot.features, [{ kind: 'sketch', index: 0, dependencies: [] }, { kind: 'extrude', index: 1, dependencies: [0] }]);
  exactData(Object.keys(snapshot).sort(), ['bodies', 'parameters', 'suppression', 'features', 'recomputation', 'evidence', 'withParameters', 'withSuppression', 'massProperties', 'exportStl', 'save'].sort());
  deepFrozen(snapshot); // Includes every public data field, not just bodies.
  if (previous) {
    assert.notEqual(snapshot, previous); assert.notEqual(snapshot.parameters, previous.parameters);
    assert.notEqual(snapshot.evidence, previous.evidence);
    for (const index of reused) assert.equal(snapshot.evidence[index], previous.evidence[index]);
    for (const index of evaluated) assert.notEqual(snapshot.evidence[index], previous.evidence[index]);
    if (reused.includes(1)) {
      assert.equal(snapshot.bodies.post, previous.bodies.post);
      assert.equal(snapshot.bodies.post.native, previous.bodies.post.native);
    } else {
      assert.notEqual(snapshot.bodies.post, previous.bodies.post);
      assert.notEqual(snapshot.bodies.post.native, previous.bodies.post.native);
    }
  }
}
function cycleEquals(actual, expected) {
  const keys = actual.map(g => g.edgeId + ':' + g.endpointIndex), wanted = expected.map(g => g.edgeId + ':' + g.endpointIndex);
  assert.equal(keys.length, wanted.length);
  assert.ok(wanted.some((_, start) => keys.every((key, i) => key === wanted[(start + i) % wanted.length])), 'same oriented cycle, allowing rotation only');
}

// Independent data/bit/arithmetic checks only. No CAD construction, compilation,
// qualification, validation, curve/surface evaluation or tessellation occurs here.
export function provePost(snapshot, which) {
  const expected = CASES[which]; assert.ok(expected);
  exactData(Object.keys(snapshot.parameters), ['centerX', 'centerY', 'diameter', 'height']);
  exactData(snapshot.parameters, expected.parameters); exactData(snapshot.suppression, {});
  exactData(JSON.parse(snapshot.save()), authoredDocument(expected.parameters));
  const saved = snapshot.save(); assert.equal(saved.endsWith('\n'), true);
  exactData(Object.keys(snapshot.bodies), ['post']); assert.equal(snapshot.evidence.length, 2);
  for (const [index, kind] of ['sketch', 'extrude'].entries()) {
    exactData(Object.keys(snapshot.evidence[index]).sort(), ['kind', 'native', 'profile']);
    assert.equal(snapshot.evidence[index].kind, kind); assert.equal(snapshot.evidence[index].profile, 'circle');
  }
  const body = snapshot.bodies.post, result = body.native, sketch = snapshot.evidence[0].native;
  assert.equal(body.family, 'stored-rational-circle-prism'); assert.equal(result, snapshot.evidence[1].native);
  exactData(Object.keys(body).sort(), ['family', 'native']);
  exactData(Object.keys(result).sort(), ['certificate', 'parent', 'world']);
  exactData(Object.keys(result.world).sort(), ['model', 'source']);
  const parent = result.parent, { geometry, topology } = parent.bundle, certificate = result.certificate;
  const p = expected.parameters, center = [p.centerX, p.centerY], radius = p.diameter * .5;
  exactData(parent.bundle.construction.profile, { kind: 'circle', id: sketch.curve.id, center, radius });
  assert.equal(parent.bundle.construction.heightMM, p.height);
  exactData(sketch.report.centerMM, center); assert.equal(sketch.report.radiusMM, radius);
  assert.equal(sketch.report.kind, 'circle'); assert.equal(sketch.report.spanCount, 4);
  assert.equal(sketch.report.controlPointCount, 9); exactData(sketch.report.parameterDomain, { min: 0, max: 4 });
  assert.equal(sketch.report.endpointClosed, true);
  // Providers copy results; require complete numeric/source parity, not a false
  // identity claim between independently constructed provider objects.
  exactData(parent.profile, sketch, 'original evaluated circle profile');
  exactData(parent.baseFace.profile, sketch, 'base-face circle profile');
  assert.notEqual(parent.profile, sketch); assert.notEqual(parent.baseFace.profile, sketch);
  for (const profile of [sketch, parent.profile, parent.baseFace.profile]) {
    assert.equal(profile.sourceVersion, 0); assert.ok(profile.source.includes('@curve #' + profile.curve.id));
    exactData(profile.model.objects, [profile.curve]);
    for (const key of ['periodic', 'regionCertified', 'solid']) assert.equal(profile.report[key], false);
  }
  exactData(parent.report.centerMM, center); assert.equal(parent.report.radiusMM, radius); assert.equal(parent.report.heightMM, p.height);
  exactData(parent.report.boundsMM, expected.bounds);
  exactData(parent.report.baseFaceReport, parent.baseFace.report);
  for (const report of [parent.report, parent.baseFace.report]) {
    assert.equal(report.solid, false); assert.equal(report.topologyCertified, false); assert.equal(report.periodic, false);
    assert.equal(report.geometricValidity, 'not-certified'); assert.equal(report.incidenceValid, true);
  }
  assert.equal(parent.report.candidateClosedShell, true);
  exactData([topology.vertices.length, topology.edges.length, topology.loops.flatMap(l => l.uses).length, topology.faces.length, topology.loops.length], [2, 3, 6, 3, 3]);
  assert.equal(geometry.objects.length, 6);
  exactData(result.world.model, geometry, 'newly compiled whole-source model preserves every original coefficient bit');
  assert.notEqual(result.world.model, geometry); assert.notEqual(result.world.source, sketch.source);
  assert.ok(result.world.source.includes('@model ' + geometry.name));
  for (const object of geometry.objects) assert.ok(result.world.source.includes('@' + object.kind + ' #' + object.id));
  exactData(geometry.objects[0], sketch.curve);
  assert.equal(sketch.curve.degree, 2);
  exactData(sketch.curve.knots, [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4]);
  exactData(sketch.curve.weights, [1, Math.SQRT1_2, 1, Math.SQRT1_2, 1, Math.SQRT1_2, 1, Math.SQRT1_2, 1]);
  exactData(sketch.curve.controlPoints, [[radius, 0], [radius, radius], [0, radius], [-radius, radius], [-radius, 0],
    [-radius, -radius], [0, -radius], [radius, -radius], [radius, 0]].map(([x, y]) => [center[0] + x, center[1] + y, 0]));
  exactData(Object.keys(certificate).sort(), ['kind', 'version', 'lengthUnit', 'geometryAuthority', 'solid', 'topologyCertified', 'embeddedStoredGeometryCertified',
    'materialComponentCount', 'genus', 'faceCount', 'vertexCount', 'edgeCount', 'loopCount', 'edgeUseCount', 'eulerCharacteristic',
    'planarFaces', 'ringProof', 'wallProof', 'vertexLinks', 'faceAdjacency', 'arithmetic', 'directCounts'].sort());
  assert.equal(certificate.kind, 'restricted-stored-rational-circle-prism-solid'); assert.equal(certificate.version, 0); assert.equal(certificate.lengthUnit, 'mm');
  assert.equal(certificate.geometryAuthority, 'stored-coefficient-mathematical-model');
  for (const key of ['solid', 'topologyCertified', 'embeddedStoredGeometryCertified']) assert.equal(certificate[key], true);
  exactData([certificate.materialComponentCount, certificate.genus, certificate.vertexCount, certificate.edgeCount, certificate.edgeUseCount,
    certificate.faceCount, certificate.loopCount, certificate.eulerCharacteristic], [1, 0, 2, 3, 6, 3, 3, 2]);
  for (const key of ['volumeMM3', 'areaMM2', 'mass', 'massKG', 'referenceVolumeMM3']) assert.equal(Object.hasOwn(certificate, key), false);
  exactData(certificate.directCounts, DIRECT_COUNTS);
  exactData(Object.keys(certificate.arithmetic).sort(), ['floatConversions', 'floatSearchSteps', 'gcdSteps', 'maximumObservedBits', 'operations']);
  for (const count of Object.values(certificate.arithmetic)) assert.ok(Number.isSafeInteger(count) && count >= 0);
  assert.ok(certificate.arithmetic.operations > 0 && certificate.arithmetic.operations <= 200000);
  assert.ok(certificate.arithmetic.gcdSteps <= 200000 && certificate.arithmetic.maximumObservedBits <= 8192);
  assert.equal(certificate.arithmetic.floatConversions, 0); assert.equal(certificate.arithmetic.floatSearchSteps, 0);
  const [bottom, top, seam] = topology.edges, ring = geometry.objects[0];
  assert.equal(certificate.ringProof.bottomEdgeId, bottom.id); assert.equal(certificate.ringProof.topEdgeId, top.id);
  assert.equal(certificate.ringProof.storedMiddleWeight, Math.SQRT1_2); assert.equal(certificate.ringProof.quadrants.length, 4);
  for (const [index, proof] of certificate.ringProof.quadrants.entries()) {
    assert.equal(proof.index, index); const poles = ring.controlPoints.slice(index * 2, index * 2 + 3);
    exactData(proof.derivativeNumeratorsX, derivativeNumerators(poles, ring.weights[1], 0));
    exactData(proof.derivativeNumeratorsY, derivativeNumerators(poles, ring.weights[1], 1));
    for (const [fractions, sign] of [[proof.derivativeNumeratorsX, index < 2 ? -1n : 1n], [proof.derivativeNumeratorsY, index === 0 || index === 3 ? 1n : -1n]]) {
      assert.ok(fractions.every(f => BigInt(f.denominator) > 0n && BigInt(f.numerator) * sign >= 0n));
      assert.ok(BigInt(fractions[1].numerator) * sign > 0n);
    }
  }
  assert.equal(certificate.planarFaces.length, 2);
  for (const [index, proof] of certificate.planarFaces.entries()) {
    const face = topology.faces[index], loop = topology.loops.find(l => l.id === face.outerLoopId), use = loop.uses[0];
    exactData(proof, { faceId: face.id, useId: use.id, normalSign: index === 0 ? -1 : 1, poleCompositionCount: 9 });
    const plane = geometry.objects.find(o => o.id === face.surfaceId), edge = topology.edges.find(e => e.id === use.edgeId);
    const curve = geometry.objects.find(o => o.id === edge.curveId);
    for (let i = 0; i < 9; i++) for (const axis of [0, 1]) {
      const start = plane.controlPoints[0][0][axis], end = plane.controlPoints[axis === 0 ? 1 : 0][axis === 1 ? 1 : 0][axis];
      exactData(capResidual(start, end, use.pcurve.curve.controlPoints[i][axis], curve.controlPoints[i][axis]), { numerator: '0', denominator: '1' });
    }
  }
  exactData(certificate.wallProof, { faceId: topology.faces[2].id, seamEdgeId: seam.id, heightMM: p.height });
  const germ = (edge, endpointIndex) => ({ edgeId: edge.id, endpointIndex });
  const cycles = [[germ(bottom, 0), germ(bottom, 1), germ(seam, 0)], [germ(top, 1), germ(top, 0), germ(seam, 1)]];
  assert.equal(certificate.vertexLinks.length, 2);
  for (const [index, vertex] of topology.vertices.entries()) {
    const link = certificate.vertexLinks.find(l => l.vertexId === vertex.id); assert.ok(link);
    assert.equal(link.germs.length, 3); assert.equal(link.corners.length, 3); cycleEquals(link.cycle, cycles[index]);
    exactData(link.germs.map(signedData).sort(), cycles[index].map(signedData).sort());
    for (const g of link.germs) {
      assert.equal(link.corners.filter(c => signedData(c.from) === signedData(g)).length, 1);
      assert.equal(link.corners.filter(c => signedData(c.to) === signedData(g)).length, 1);
    }
    for (const corner of link.corners) {
      const loop = topology.loops.find(l => l.id === corner.loopId); assert.ok(loop); assert.equal(corner.faceId, loop.faceId);
      const incoming = loop.uses.findIndex(use => use.id === corner.incomingUseId); assert.ok(incoming >= 0);
      assert.equal(loop.uses[(incoming + 1) % loop.uses.length].id, corner.outgoingUseId);
    }
  }
  assert.equal(certificate.faceAdjacency.length, 3);
  for (const face of topology.faces) {
    const adjacent = new Set();
    for (const edge of topology.edges) {
      const owning = topology.loops.filter(l => l.uses.some(use => use.edgeId === edge.id)).map(l => l.faceId);
      if (owning.includes(face.id)) for (const id of owning) {
        if (id !== face.id || topology.loops.find(l => l.faceId === id).uses.filter(u => u.edgeId === edge.id).length === 2) adjacent.add(id);
      }
    }
    exactData([...certificate.faceAdjacency.find(f => f.faceId === face.id).adjacentFaceIds].sort(), [...adjacent].sort());
  }
  for (const edge of topology.edges) {
    const uses = topology.loops.flatMap(l => l.uses).filter(u => u.edgeId === edge.id);
    assert.equal(uses.length, 2); assert.notEqual(uses[0].sense, uses[1].sense);
  }
  if (Object.is(p.centerX, -0)) {
    for (const value of [snapshot.parameters.centerX, JSON.parse(saved).parameters.centerX, sketch.report.centerMM[0], parent.bundle.construction.profile.center[0], parent.report.centerMM[0]]) assert.ok(Object.is(value, -0));
    assert.ok(Object.is(sketch.curve.controlPoints[2][0], +0), 'native centerX+0 pole remains positive zero');
    assert.ok(saved.includes('"centerX":-0'));
  }
  deepFrozen(snapshot);
  return { boundsMM: parent.report.boundsMM, certificate, parentReport: parent.report,
    nativeBodySHA256: nativeBodyHash(snapshot), parentSHA256: dataHash(parent), profileSHA256: dataHash(sketch),
    profileSourceSHA256: sha256(sketch.source), worldSourceSHA256: sha256(result.world.source), saveSHA256: sha256(saved),
    referenceValuesAreNotCertifiedMass: true, completeOriginalProfileParity: true };
}

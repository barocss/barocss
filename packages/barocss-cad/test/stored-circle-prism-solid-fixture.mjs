import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// These helpers inspect data and do independent arithmetic. None invokes a CAD
// constructor, evaluator, compiler, qualifier, validator or tessellator.
export const CASES = Object.freeze({
  A: { center: [2, -3], radius: 4, heightMM: 6, bounds: { min: [-2, -7, 0], max: [6, 1, 6] } },
  B: { center: [-0, .25], radius: .5, heightMM: 1.5, bounds: { min: [-.5, -.25, 0], max: [.5, .75, 1.5] } },
  C: { center: [.2, .2], radius: .1, heightMM: .3 },
});
export const DIRECT_COUNTS = Object.freeze({ parentReconstructionCalls: 1, wholeModelCompilations: 1,
  capUseCount: 2, capPoleCompositions: 18, wallUseCount: 4, cornerCount: 6, germCount: 6 });
export const EXPECTED_CAMPAIGN = Object.freeze({ explicitParentBuilds: 3, qualificationOrValidationCalls: 6,
  previews: 1, explicitWallD1Attempts: 3, shellConstructionRoots: 10, knownSourceCompilations: 14,
  sourceDerivedDirectCallSiteAttempts: { CurveD0: 1464, SurfaceD0: 556, CurveD1: 80, SurfaceD1: 237 },
  fullTransitiveNativeCoverage: 'NOT_MEASURED' });
export const RESIDUAL = Object.freeze({ numerator: '1801439850948197', denominator: '649037107316853453566312041152512' });

export function signedData(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(signedData).join(',') + ']';
  assert.ok(value && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null));
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + signedData(value[key])).join(',') + '}';
}
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const dataHash = value => sha256(signedData(value));
export const clone = value => JSON.parse(signedData(value));
export function exactData(actual, expected, label = 'data') {
  // strict equality on primitive numbers in deepStrictEqual distinguishes -0.
  assert.deepStrictEqual(actual, expected, label);
  assert.equal(signedData(actual), signedData(expected), label + ' signed numeric parity');
}
export function deepFrozen(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value); assert.ok(Object.isFrozen(value), 'every result record and array must be frozen');
  for (const child of Object.values(value)) deepFrozen(child, seen);
}
export function errorData(error) {
  if (!(error instanceof Error)) {
    if (error === undefined) return null;
    if (error && typeof error === 'object') { try { return clone(error); } catch { return String(error); } }
    return error;
  }
  return { name: error.name, code: error.code ?? null, message: error.message, stack: error.stack ?? null,
    cause: errorData(error.cause) };
}
function gcd(a, b) { a = a < 0n ? -a : a; while (b) [a, b] = [b, a % b]; return a; }
function rat(n, d = 1n) { assert.notEqual(d, 0n); if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; }
export function binary64(value) {
  assert.ok(Number.isFinite(value));
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value, false);
  const bits = view.getBigUint64(0, false), exp = Number((bits >> 52n) & 2047n), frac = bits & ((1n << 52n) - 1n);
  const n = (bits >> 63n ? -1n : 1n) * (exp ? (1n << 52n) + frac : frac), power = exp ? exp - 1075 : -1074;
  return power < 0 ? rat(n, 1n << BigInt(-power)) : rat(n << BigInt(power));
}
const add = (a, b) => rat(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a, b) => rat(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a, b) => rat(a.n * b.n, a.d * b.d);
const textFraction = a => ({ numerator: a.n.toString(), denominator: a.d.toString() });
export const capResidual = (x0, x1, u, x) => textFraction(sub(add(binary64(x0), mul(sub(binary64(x1), binary64(x0)), binary64(u))), binary64(x)));
export function derivativeNumerators(points, weight, axis) {
  const [a, b, c] = points.map(point => binary64(point[axis])), twoW = mul(rat(2n), binary64(weight));
  return [mul(twoW, sub(b, a)), sub(c, a), mul(twoW, sub(c, b))].map(textFraction);
}
export function proveDecimalResidual(parent) {
  const chart = parent.bundle.geometry.objects[3], ring = parent.bundle.geometry.objects[0];
  const uv = parent.bundle.topology.loops[0].uses[0].pcurve.curve.controlPoints[2][0];
  const values = { x0: chart.controlPoints[0][0][0], x1: chart.controlPoints[1][0][0], u: uv, x: ring.controlPoints[2][0] };
  exactData(values, { x0: .1, x1: .30000000000000004, u: .49999999999999994, x: .2 });
  const residual = capResidual(values.x0, values.x1, values.u, values.x);
  exactData(residual, RESIDUAL); assert.notEqual(BigInt(residual.numerator), 0n);
  return { values, residual, nativeParentValid: true, exactCapCorrespondence: false };
}
export function proveParent(parent, which) {
  const expected = CASES[which], report = parent.report, topology = parent.bundle.topology;
  exactData(parent.bundle.construction.profile.center, expected.center);
  assert.equal(parent.bundle.construction.profile.radius, expected.radius);
  assert.equal(parent.bundle.construction.heightMM, expected.heightMM);
  exactData(report.centerMM, expected.center);
  for (const original of [report, parent.baseFace.report]) {
    assert.equal(original.solid, false); assert.equal(original.topologyCertified, false);
    assert.equal(original.periodic, false); assert.equal(original.geometricValidity, 'not-certified');
  }
  for (const profile of [parent.profile, parent.baseFace.profile]) {
    assert.equal(profile.report.solid, false); assert.equal(profile.report.regionCertified, false);
    assert.equal(profile.report.periodic, false); assert.equal(profile.sourceVersion, 0);
    assert.equal(typeof profile.source, 'string'); assert.ok(profile.source.length > 0);
  }
  assert.equal(report.candidateClosedShell, true); assert.equal(report.incidenceValid, true);
  assert.deepEqual([topology.vertices.length, topology.edges.length, topology.loops.flatMap(l => l.uses).length,
    topology.faces.length, topology.loops.length], [2, 3, 6, 3, 3]);
  assert.equal(parent.bundle.geometry.objects.length, 6);
  if (expected.bounds) exactData(report.boundsMM, expected.bounds);
  if (which === 'A') assert.equal(report.referenceVolumeMM3, 96 * Math.PI, 'reference value only, not certified volume');
  if (which === 'B') {
    assert.ok(Object.is(parent.bundle.construction.profile.center[0], -0));
    assert.ok(Object.is(parent.report.centerMM[0], -0));
    assert.ok(Object.is(parent.profile.report.centerMM[0], -0));
    assert.ok(Object.is(parent.profile.curve.controlPoints[2][0], +0), 'native centerX+0 is positive zero');
  }
  return { boundsMM: report.boundsMM, originalReport: report, referenceValuesAreNotCertifiedMass: true };
}
function rotatedCycle(actual, expected) {
  assert.equal(actual.length, expected.length);
  const keys = actual.map(g => g.edgeId + ':' + g.endpointIndex), wanted = expected.map(g => g.edgeId + ':' + g.endpointIndex);
  assert.ok(wanted.some((_, start) => keys.every((key, i) => key === wanted[(start + i) % wanted.length])), 'same oriented cycle, allowing rotation only');
}
export function proveQualification(result, parent, which, requireFrozen = true) {
  assert.deepEqual(Object.keys(result).sort(), ['certificate', 'parent', 'world']);
  assert.deepEqual(Object.keys(result.world).sort(), ['model', 'source']);
  exactData(result.parent, parent); assert.notEqual(result.parent, parent); assert.notEqual(result.parent.bundle, parent.bundle);
  proveParent(result.parent, which); if (requireFrozen) deepFrozen(result);
  exactData(result.world.model, parent.bundle.geometry, 'whole-source compiled native model');
  assert.notEqual(result.world.source, parent.profile.source);
  assert.ok(result.world.source.includes('@model ' + parent.bundle.geometry.name));
  for (const object of parent.bundle.geometry.objects) assert.ok(result.world.source.includes('@' + object.kind + ' #' + object.id));
  const c = result.certificate, topology = parent.bundle.topology;
  assert.deepEqual(Object.keys(c).sort(), ['kind', 'version', 'lengthUnit', 'geometryAuthority', 'solid', 'topologyCertified', 'embeddedStoredGeometryCertified',
    'materialComponentCount', 'genus', 'faceCount', 'vertexCount', 'edgeCount', 'loopCount', 'edgeUseCount', 'eulerCharacteristic',
    'planarFaces', 'ringProof', 'wallProof', 'vertexLinks', 'faceAdjacency', 'arithmetic', 'directCounts'].sort());
  assert.equal(c.kind, 'restricted-stored-rational-circle-prism-solid'); assert.equal(c.version, 0); assert.equal(c.lengthUnit, 'mm');
  assert.equal(c.geometryAuthority, 'stored-coefficient-mathematical-model');
  for (const field of ['solid', 'topologyCertified', 'embeddedStoredGeometryCertified']) assert.equal(c[field], true);
  assert.deepEqual([c.materialComponentCount, c.genus, c.vertexCount, c.edgeCount, c.edgeUseCount, c.faceCount, c.loopCount, c.eulerCharacteristic], [1, 0, 2, 3, 6, 3, 3, 2]);
  for (const field of ['volumeMM3', 'areaMM2', 'mass', 'massKG', 'referenceVolumeMM3']) assert.equal(Object.hasOwn(c, field), false);
  exactData(c.directCounts, DIRECT_COUNTS);
  assert.deepEqual(Object.keys(c.arithmetic).sort(), ['floatConversions', 'floatSearchSteps', 'gcdSteps', 'maximumObservedBits', 'operations']);
  for (const count of Object.values(c.arithmetic)) assert.ok(Number.isSafeInteger(count) && count >= 0);
  assert.ok(c.arithmetic.operations > 0 && c.arithmetic.operations <= 200000);
  assert.ok(c.arithmetic.gcdSteps <= 200000 && c.arithmetic.maximumObservedBits <= 8192);
  assert.equal(c.arithmetic.floatConversions, 0); assert.equal(c.arithmetic.floatSearchSteps, 0);
  const [bottom, top, seam] = topology.edges, ring = parent.bundle.geometry.objects[0];
  assert.equal(c.ringProof.bottomEdgeId, bottom.id); assert.equal(c.ringProof.topEdgeId, top.id);
  assert.equal(c.ringProof.storedMiddleWeight, Math.SQRT1_2); assert.equal(c.ringProof.quadrants.length, 4);
  for (const [index, q] of c.ringProof.quadrants.entries()) {
    assert.equal(q.index, index); const poles = ring.controlPoints.slice(index * 2, index * 2 + 3);
    exactData(q.derivativeNumeratorsX, derivativeNumerators(poles, ring.weights[1], 0));
    exactData(q.derivativeNumeratorsY, derivativeNumerators(poles, ring.weights[1], 1));
    for (const [fractions, sign] of [[q.derivativeNumeratorsX, index < 2 ? -1n : 1n], [q.derivativeNumeratorsY, index === 0 || index === 3 ? 1n : -1n]]) {
      assert.ok(fractions.every(f => BigInt(f.denominator) > 0n && BigInt(f.numerator) * sign >= 0n));
      assert.ok(BigInt(fractions[1].numerator) * sign > 0n);
    }
  }
  assert.equal(c.planarFaces.length, 2);
  for (const [i, proof] of c.planarFaces.entries()) {
    assert.equal(proof.faceId, topology.faces[i].id); assert.equal(proof.useId, topology.loops[i].uses[0].id);
    assert.equal(proof.normalSign, i === 0 ? -1 : 1); assert.equal(proof.poleCompositionCount, 9);
  }
  exactData(c.wallProof, { faceId: topology.faces[2].id, seamEdgeId: seam.id, heightMM: CASES[which].heightMM });
  const germ = (edge, endpointIndex) => ({ edgeId: edge.id, endpointIndex });
  const expectedCycles = [[germ(bottom, 0), germ(bottom, 1), germ(seam, 0)], [germ(top, 1), germ(top, 0), germ(seam, 1)]];
  assert.equal(c.vertexLinks.length, 2);
  for (const [i, vertex] of topology.vertices.entries()) {
    const link = c.vertexLinks.find(item => item.vertexId === vertex.id); assert.ok(link);
    assert.equal(link.germs.length, 3); assert.equal(link.corners.length, 3);
    rotatedCycle(link.cycle, expectedCycles[i]);
    assert.deepEqual(link.germs.map(g => signedData(g)).sort(), expectedCycles[i].map(g => signedData(g)).sort());
    for (const g of link.germs) {
      assert.equal(link.corners.filter(corner => signedData(corner.from) === signedData(g)).length, 1);
      assert.equal(link.corners.filter(corner => signedData(corner.to) === signedData(g)).length, 1);
    }
    for (const corner of link.corners) {
      const loop = topology.loops.find(l => l.id === corner.loopId); assert.ok(loop);
      assert.equal(corner.faceId, loop.faceId);
      const incoming = loop.uses.findIndex(u => u.id === corner.incomingUseId); assert.ok(incoming >= 0);
      assert.equal(loop.uses[(incoming + 1) % loop.uses.length].id, corner.outgoingUseId);
    }
  }
  assert.equal(c.faceAdjacency.length, 3);
  const reached = new Set(), pending = [topology.faces[0].id];
  while (pending.length) { const id = pending.pop(); if (reached.has(id)) continue; reached.add(id); const node = c.faceAdjacency.find(f => f.faceId === id); assert.ok(node); for (const next of node.adjacentFaceIds) { assert.ok(topology.faces.some(f => f.id === next)); pending.push(next); } }
  assert.equal(reached.size, 3);
  for (const face of topology.faces) {
    const adjacent = new Set();
    for (const edge of topology.edges) {
      const owningFaces = topology.loops.filter(l => l.uses.some(u => u.edgeId === edge.id)).map(l => l.faceId);
      if (owningFaces.includes(face.id)) for (const id of owningFaces) {
        if (id !== face.id || topology.loops.find(l => l.faceId === id).uses.filter(u => u.edgeId === edge.id).length === 2) adjacent.add(id);
      }
    }
    assert.deepEqual([...c.faceAdjacency.find(row => row.faceId === face.id).adjacentFaceIds].sort(), [...adjacent].sort());
  }
  for (const edge of topology.edges) {
    const uses = topology.loops.flatMap(l => l.uses).filter(u => u.edgeId === edge.id);
    assert.equal(uses.length, 2); assert.notEqual(uses[0].sense, uses[1].sense);
  }
  return { certificate: c, qualifiedDataSHA256: dataHash(result), originalParentSHA256: dataHash(parent),
    originalProfileSourceSHA256: sha256(parent.profile.source), worldSourceSHA256: sha256(result.world.source) };
}
export function provePreview(preview, parent) {
  const { packet, report, faceRanges, edgePaths, edgeProvenance } = preview;
  assert.equal(report.vertexCount, 98); assert.equal(report.triangleCount, 64); assert.equal(faceRanges.length, 3);
  assert.equal(packet.positions.length, 98 * 3); assert.equal(packet.normals.length, 98 * 3);
  assert.equal(packet.indices.length, 64 * 3); assert.equal(packet.parameters.length, 98 * 2);
  assert.deepEqual(edgePaths.map(path => path.points.length), [17, 17, 2]);
  exactData(report.native, parent.report);
  const sampledBounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let i = 0; i < packet.positions.length; i++) { const axis = i % 3, value = packet.positions[i]; assert.ok(Number.isFinite(value)); sampledBounds.min[axis] = Math.min(sampledBounds.min[axis], value); sampledBounds.max[axis] = Math.max(sampledBounds.max[axis], value); }
  exactData(packet.bounds, sampledBounds); exactData(report.boundsMM, sampledBounds);
  exactData(parent.report.boundsMM, CASES.A.bounds, 'stored parent bounds remain exact');
  const maximumSampledBoundsDifferenceMM = Math.max(...['min', 'max'].flatMap(side => sampledBounds[side].map((value, axis) => Math.abs(value - parent.report.boundsMM[side][axis]))));
  assert.equal(report.limits.evaluationComparisonMM, 1e-7);
  assert.ok(maximumSampledBoundsDifferenceMM <= report.limits.evaluationComparisonMM, 'sampled evaluator bounds use only the existing preview tolerance');
  for (const r of [report, report.native]) { assert.equal(r.solid, false); assert.equal(r.topologyCertified, false); assert.equal(r.periodic, false); assert.equal(r.candidateClosedShell, true); }
  assert.equal(packet.coordinateSystem, 'right-handed-z-up');
  for (const [i, range] of faceRanges.entries()) {
    assert.equal(range.faceId, parent.bundle.topology.faces[i].id);
    if (i < 2) {
      const offset = range.vertexRange[0]; exactData(packet.positions.slice(offset * 3, offset * 3 + 3), [2, -3, i * 6]);
      assert.equal(packet.normals[offset * 3 + 2], i === 0 ? -1 : 1, 'authored Z normals are not silently remapped to Y');
      assert.equal(range.capSampling.boundaryParameters.length, 16);
    } else assert.equal(range.wallPanels.length, 16);
  }
  assert.equal(edgeProvenance.length, 3);
  for (const [i, p] of edgeProvenance.entries()) {
    assert.equal(p.edgeId, parent.bundle.topology.edges[i].id); assert.equal(p.uses.length, 2);
    assert.notEqual(p.uses[0].sense, p.uses[1].sense);
    assert.equal(p.sampledParameters.length, i < 2 ? 17 : 2);
    for (const use of p.uses) { assert.equal(use.sampledUVs.length, p.sampledParameters.length); assert.ok(use.pcurve.curve.controlPoints.length > 0); }
  }
  return { report, packetSHA256: dataHash(packet), completePreviewSHA256: dataHash(preview), sampledBoundsMM: sampledBounds, exactParentBoundsMM: parent.report.boundsMM, maximumSampledBoundsDifferenceMM,
    observedBasis: 'Existing right-handed-z-up label; unchanged authored XYZ positions/normals. A later consumer must choose its basis policy explicitly.',
    meshIsSolidProof: false, rendererOrEditorExecuted: false };
}

// A manually assembled TYPE SHAPE, deliberately not a canonical native result.
// It is used only AFTER making an invalid own-data edit; never qualify it intact.
// No source parsing, geometric construction or native evaluation occurs here.
export function shapeOnlyResult() {
  const curve = id => ({ kind: 'curve', id, degree: 2, knots: [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4],
    controlPoints: Array.from({ length: 9 }, () => [-0, 0, 0]), weights: [1, Math.SQRT1_2, 1, Math.SQRT1_2, 1, Math.SQRT1_2, 1, Math.SQRT1_2, 1] });
  const surface = id => ({ kind: 'surface', id, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[0, 0, 0], [0, 1, 0]], [[1, 0, 0], [1, 1, 0]]], weights: [[1, 1], [1, 1]] });
  const model = objects => ({ name: 'shape_only', version: 0, lengthUnit: 'mm', objects });
  const construction = { kind: 'circle', id: 'shape_only_ring', center: [-0, .25], radius: .5 };
  const boundsMM = { min: [-.5, -.25, 0], max: [.5, .75, 0] }, domain = { u: [0, 1], v: [0, 1] };
  const flags = { periodic: false, geometricValidity: 'not-certified', topologyCertified: false, solid: false };
  const profile = { source: 'SHAPE_ONLY_NOT_COMPILED', sourceVersion: 0, model: model([curve('ring')]), curve: curve('ring'),
    report: { kind: 'circle', plane: 'xy', lengthUnit: 'mm', centerMM: [-0, .25], radiusMM: .5, startQuadrant: 0, spanCount: 4, controlPointCount: 9,
      parameterDomain: { min: 0, max: 4 }, endpointClosed: true, periodic: false, regionCertified: false, solid: false } };
  const pcurve = () => ({ coordinateSystem: 'uv', domain: [0, 4], curve: curve('uv') });
  const vertex = id => ({ id, point: [0, 0, 0] });
  const edge = (id, ids) => ({ id, curveId: 'ring', vertexIds: ids, sourceParameterRange: [0, 4] });
  const use = (id, edgeId, sense) => ({ id, edgeId, sense, pcurve: pcurve() });
  const baseReport = { trimFamily: 'xy-circle-planar-face-v0', sourceCurveId: 'ring', faceId: 'bottom', surfaceId: 'plane', outerLoopId: 'bottom_loop',
    edgeId: 'bottom_edge', pcurveId: 'uv', seamVertexId: 'bottom_vertex', nativeDomain: [0, 4], uvDomain: [0, 4], surfaceDomain: domain,
    centerMM: [-0, .25], radiusMM: .5, boundsMM, vertexCount: 1, edgeCount: 1, loopUseCount: 1, nativeObjectCount: 2, referenceDiskAreaMM2: 1, incidenceValid: true, ...flags,
    limits: { authoredIdCharacters: 64, derivedIdCharacters: 80, snapshotValues: 8192, snapshotDepth: 10, arrayElements: 64, recordFields: 12,
      stringCharacters: 128, evaluationComparisonMM: 1e-7, derivativeComparisonRelative: 1e-9, planeToleranceMM: 1e-7, boundaryToleranceMM: 1e-7 } };
  const baseFace = { profile: clone(profile), bundle: { construction: clone(construction), geometry: model([curve('ring'), surface('plane')]),
    topology: { version: 0, kind: 'xy-circle-planar-face', sourceCurveId: 'ring', face: { id: 'bottom', surfaceId: 'plane', outerLoopId: 'bottom_loop', orientation: 'forward' },
      vertices: [vertex('bottom_vertex')], edges: [edge('bottom_edge', ['bottom_vertex', 'bottom_vertex'])],
      loop: { id: 'bottom_loop', uses: [{ edgeId: 'bottom_edge', sense: 'forward', pcurve: pcurve() }] } } }, report: baseReport };
  const faces = ['bottom-cap', 'top-cap', 'wall'].map((role, i) => ({ id: ['bottom', 'top', 'wall'][i], surfaceId: ['plane', 'top_plane', 'wall_surface'][i],
    outerLoopId: ['bottom_loop', 'top_loop', 'wall_loop'][i], orientation: i ? 'forward' : 'reverse', role }));
  const loops = [{ id: 'bottom_loop', faceId: 'bottom', uses: [use('bottom_use', 'bottom_edge', 'reverse')] },
    { id: 'top_loop', faceId: 'top', uses: [use('top_use', 'top_edge', 'forward')] },
    { id: 'wall_loop', faceId: 'wall', uses: [use('wall_bottom', 'bottom_edge', 'forward'), use('wall_right', 'seam_edge', 'forward'), use('wall_top', 'top_edge', 'reverse'), use('wall_left', 'seam_edge', 'reverse')] }];
  const topology = { version: 0, kind: 'xy-circle-prism-shell', id: 'shell', sourceCurveId: 'ring', vertices: [vertex('bottom_vertex'), vertex('top_vertex')],
    edges: [edge('bottom_edge', ['bottom_vertex', 'bottom_vertex']), edge('top_edge', ['top_vertex', 'top_vertex']), edge('seam_edge', ['bottom_vertex', 'top_vertex'])], faces, loops };
  const geometry = model([curve('ring'), curve('top_ring'), curve('seam'), surface('plane'), surface('top_plane'), surface('wall_surface')]);
  const report = { trimFamily: 'xy-circle-prism-shell-v0', sourceCurveId: 'ring', shellId: 'shell', heightMM: 1.5, centerMM: [-0, .25], radiusMM: .5, baseFaceReport: clone(baseReport),
    geometryIds: { bottomCurveId: 'ring', topCurveId: 'top_ring', seamCurveId: 'seam', bottomSurfaceId: 'plane', topSurfaceId: 'top_plane', wallSurfaceId: 'wall_surface' },
    domains: { bottomCurve: [0, 4], topCurve: [0, 4], seamCurve: [0, 1], bottomSurface: clone(domain), topSurface: clone(domain), wallSurface: { u: [0, 4], v: [0, 1] } },
    vertexCount: 2, edgeCount: 3, edgeUseCount: 6, faceCount: 3, loopCount: 3, nativeObjectCount: 6, boundsMM: clone(boundsMM),
    edgeIncidence: topology.edges.map(e => ({ edgeId: e.id, uses: loops.flatMap(l => l.uses.filter(u => u.edgeId === e.id).map(u => ({ faceId: l.faceId, loopId: l.id, useId: u.id, sense: u.sense }))) })),
    loopObservations: loops.map(l => ({ loopId: l.id, faceId: l.faceId, useCount: l.uses.length, closed: true })),
    normalObservations: faces.flatMap((f, i) => Array.from({ length: i === 2 ? 4 : 1 }, () => ({ faceId: f.id, surfaceId: f.surfaceId, uv: [.5, .5], pointMM: [0, 0, 0], normal: [0, 0, 1] }))),
    referenceVolumeMM3: 1, referenceLateralAreaMM2: 1, referenceBoundaryAreaMM2: 1, incidenceValid: true, candidateClosedShell: true, ...flags,
    limits: { authoredIdCharacters: 48, derivedIdCharacters: 80, snapshotValues: 32768, snapshotDepth: 14, arrayElements: 128, recordFields: 24, stringCharacters: 128, evaluationComparisonMM: 1e-7 } };
  const germ = (edgeId, endpointIndex) => ({ edgeId, endpointIndex });
  const vertexLinks = topology.vertices.map((v, i) => { const ring = i ? 'top_edge' : 'bottom_edge', germs = [germ(ring, 0), germ(ring, 1), germ('seam_edge', i)];
    return { vertexId: v.id, germs, corners: germs.map((from, j) => ({ faceId: faces[i].id, loopId: loops[i].id, incomingUseId: loops[i].uses[0].id, outgoingUseId: loops[i].uses[0].id, from: clone(from), to: clone(germs[(j + 1) % 3]) })), cycle: clone(germs) }; });
  const fraction = () => ({ numerator: '0', denominator: '1' });
  const certificate = { kind: 'restricted-stored-rational-circle-prism-solid', version: 0, lengthUnit: 'mm', geometryAuthority: 'stored-coefficient-mathematical-model',
    solid: true, topologyCertified: true, embeddedStoredGeometryCertified: true, materialComponentCount: 1, genus: 0, faceCount: 3, vertexCount: 2, edgeCount: 3, loopCount: 3, edgeUseCount: 6, eulerCharacteristic: 2,
    planarFaces: faces.slice(0, 2).map((f, i) => ({ faceId: f.id, normalSign: i ? 1 : -1, useId: loops[i].uses[0].id, poleCompositionCount: 9 })),
    ringProof: { bottomEdgeId: 'bottom_edge', topEdgeId: 'top_edge', storedMiddleWeight: Math.SQRT1_2,
      quadrants: Array.from({ length: 4 }, (_, index) => ({ index, derivativeNumeratorsX: Array.from({ length: 3 }, fraction), derivativeNumeratorsY: Array.from({ length: 3 }, fraction) })) },
    wallProof: { faceId: 'wall', seamEdgeId: 'seam_edge', heightMM: 1.5 }, vertexLinks,
    faceAdjacency: faces.map(f => ({ faceId: f.id, adjacentFaceIds: faces.filter(a => a !== f).map(a => a.id) })),
    arithmetic: { operations: 1, gcdSteps: 0, floatSearchSteps: 0, floatConversions: 0, maximumObservedBits: 1 }, directCounts: { ...DIRECT_COUNTS } };
  return { parent: { profile, baseFace, bundle: { construction: { profile: construction, shellId: 'shell', heightMM: 1.5 }, geometry, topology }, report }, world: { source: 'SHAPE_ONLY_NOT_COMPILED', model: clone(geometry) }, certificate };
}

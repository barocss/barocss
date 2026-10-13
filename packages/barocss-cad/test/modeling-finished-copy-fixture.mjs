import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chamferPart } from './modeling-chamfer-chain-fixture.mjs';
import { prove as proveConvex } from './modeling-intersection-fixture.mjs';
import { binary64 } from './stored-circle-prism-solid-fixture.mjs';
import { signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData, hold, unchanged,
  emptyLedgers as translationLedgers, collectLedgers as collectTranslationLedgers } from './modeling-translation-fixture.mjs';
import { PRISM_COUNTS } from './modeling-offset-fixture.mjs';
export { signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData, hold, unchanged };

// #1919 is six public evaluations and two previews, not an extensible matrix.
// Source-derived call sites only: prism n=4 -> 2*(n+2)+1 compilations,
// 36*n bindings,108*n D1. Split F/U -> F+2*(F+6)+1 compilations,
// 3*(U+2*(U+24)) bindings and three D1 per binding. First F/U=6/24,
// second=7/30. Finished validation/qualification F/U=8/36 -> 8/108/324.
// These match unchanged #1625 receipts; no hidden provider instrumentation.
export const DEFAULTS = Object.freeze({ frontDistance: 1, backDistance: 2, backY: 24, spacing: 48 });
export const WIDER = Object.freeze({ ...DEFAULTS, spacing: 64 });
export const FINISHED = Object.freeze({ ...WIDER, backDistance: 3 });
export const RECOVERED = Object.freeze({ ...FINISHED, spacing: -48 });
export const EXPECTED_CAMPAIGN = Object.freeze({ modelCalls: 6, sourceModelCalls: 5, coldModelCalls: 1,
  successfulCopies: 5, successfulPrisms: 2, firstChamfers: 2, secondChamfers: 3, representabilityRefusals: 1,
  tessellations: 2, massQueries: 0, exports: 0, standaloneValidators: 0, cpuBufferPreparations: 0,
  sourceDerived: { prism: [2, 26, 288, 864], firstChamfer: [2, 62, 720, 2160], secondChamfer: [3, 102, 1242, 3726],
    parentValidation: [6, 48, 648, 1944], targetQualification: [5, 40, 540, 1620], previewValidation: [2, 16, 216, 648],
    initialTranslatedFaces: [40, 40, 540, 1620], standaloneSketchCompilations: 2,
    returnedLedgerSourceCompilations: 294, returnedLedgerBindingObservations: 3654, returnedLedgerD1: 10962,
    knownSourceCompilations: 336, combinedBindingObservations: 4194, knownD1: 12582 },
  tupleMeaning: 'count, source compilations, bindings, D1', fullTransitiveNativeCoverage: 'NOT_MEASURED' });
export function finishedPair(cad) {
  const chain = chamferPart(cad), spacing = chain.model.parameter('spacing', 48);
  const right = chain.part.translate([spacing, -0, 0]);
  return { ...chain, right, build: () => chain.model.build({ left: chain.part, right }) };
}
export function authoredDocument(parameters = DEFAULTS) {
  const p = parameter => ({ parameter });
  return { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { ...parameters }, nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [32, 24] }, { kind: 'extrude', sketch: 0, height: 8 },
    { kind: 'chamfer', parent: { node: 1, side: 'solid' }, edge: { parallelTo: 'x', at: { y: 0, z: 'max' } }, distance: p('frontDistance') },
    { kind: 'chamfer', parent: { node: 2, side: 'solid' }, edge: { parallelTo: 'x', at: { y: p('backY'), z: 'max' } }, distance: p('backDistance') },
    { kind: 'translate', parent: { node: 3, side: 'solid' }, offset: [p('spacing'), -0, 0] },
  ], outputs: { left: { node: 3, side: 'solid' }, right: { node: 4, side: 'solid' } } };
}
export function work(snapshot, reused, evaluated, previous) {
  exactData(snapshot.recomputation, { reusedFeatures: reused, evaluatedFeatures: evaluated });
  exactData([...reused, ...evaluated], [0, 1, 2, 3, 4]);
  exactData(snapshot.features, ['sketch', 'extrude', 'chamfer', 'chamfer', 'translate'].map((kind, index) =>
    ({ kind, index, dependencies: index ? [index - 1] : [] })));
  if (previous) {
    for (const key of ['parameters', 'evidence', 'bodies']) assert.notEqual(snapshot[key], previous[key]);
    for (const i of reused) assert.equal(snapshot.evidence[i], previous.evidence[i]);
    for (const i of evaluated) assert.notEqual(snapshot.evidence[i], previous.evidence[i]);
    const assertion = reused.includes(3) ? 'equal' : 'notEqual';
    assert[assertion](snapshot.bodies.left, previous.bodies.left); assert[assertion](snapshot.bodies.left.native, previous.bodies.left.native);
    assert.notEqual(snapshot.bodies.right, previous.bodies.right); assert.notEqual(snapshot.bodies.right.native, previous.bodies.right.native);
  }
  deepFrozen(snapshot);
}

// Independent represented-binary64 rational oracle. The old translation proof
// hardcodes the six-Face gusset, so it cannot certify this eight-Face rail.
const fraction = v => ({ n: BigInt(v.numerator), d: BigInt(v.denominator) });
const add = (a, b) => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
const mul = (a, b) => ({ n: a.n * b.n, d: a.d * b.d });
const equal = (a, b) => assert.equal(a.n * b.d, b.n * a.d);
const dot = (a, b) => a.reduce((sum, value, i) => add(sum, mul(value, b[i])), { n: 0n, d: 1n });
const sorted = values => values.map(signedData).sort();
const faceRef = a => ({ sourceId: a.sourceId, faceId: a.face.options.faceId, surfaceId: a.face.plane.id,
  loopId: a.face.loop.id, evaluationId: a.face.options.evaluationId });
const local = (face, field, id) => ({ sourceId: face.sourceId, faceId: face.faceId, [field]: id });
const faceAt = (solid, ref) => { const a = solid.request.assets.find(a => a.sourceId === ref.sourceId); assert.ok(a); assert.equal(a.face.options.faceId, ref.faceId); return a.face; };
function point(actual, original, offset) {
  exactData([actual.length, original.length], [3, 3]);
  for (let i = 0; i < 3; i++) {
    const expected = add(binary64(original[i]), binary64(offset[i])); equal(binary64(actual[i]), expected);
    assert.ok(Math.abs(actual[i]) <= 10000);
    if (offset[i] === 0) assert.ok(Object.is(actual[i], original[i]));
    else if (expected.n === 0n) assert.ok(Object.is(actual[i], 0));
  }
}
function completeSource(face) {
  assert.equal(face.sourceVersion, 0); exactData(face.model.objects, [face.plane, ...face.loop.edges]);
  assert.ok(face.source.includes('@model ' + face.options.evaluationId));
  for (const object of face.model.objects) {
    const marker = '@' + object.kind + ' #' + object.id + ' ', start = face.source.indexOf(marker); assert.ok(start >= 0);
    const text = face.source.slice(start, face.source.indexOf('}', start));
    const properties = object.kind === 'surface' ? ['degreeU', 'degreeV', 'knotsU', 'knotsV'] : ['degree', 'knots'];
    for (const property of [...properties, 'controlPoints', 'weights']) {
      const name = property.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
      const match = text.match(new RegExp('(?:^|[;{])\\s*' + name + '\\s*:\\s*([^;]+);')); assert.ok(match);
      exactData(JSON.parse(match[1]), object[property]);
    }
  }
}
function bijection(entries, a, b) {
  assert.equal(entries.length, a.length); assert.equal(a.length, b.length);
  exactData(sorted(entries.map(e => e.original)), sorted(a)); exactData(sorted(entries.map(e => e.translated)), sorted(b));
  assert.equal(new Set(entries.map(e => signedData(e.original))).size, entries.length);
  assert.equal(new Set(entries.map(e => signedData(e.translated))).size, entries.length);
  return new Map(entries.map(e => [signedData(e.original), e.translated]));
}
export function proveTranslation(native, original, offset) {
  exactData(native.request.parent, original); assert.notEqual(native.request.parent, original); exactData(native.request.offsetMM, offset);
  const parent = native.request.parent, target = native.solid, lineage = native.lineage, maps = {};
  assert.notEqual(target, original); assert.notEqual(target.request.options.solidId, original.request.options.solidId);
  exactData(target.certificate.volumeMM3, parent.certificate.volumeMM3);
  maps.faces = bijection(lineage.faces, parent.request.assets.map(faceRef), target.request.assets.map(faceRef));
  const inventories = [['curves', f => f.loop.edges, 'curveId'], ['uses', f => f.topology.loop.uses, 'useId'],
    ['pcurves', f => f.pcurves, 'pcurveId'], ['localEdges', f => f.topology.edges, 'edgeId'], ['localVertices', f => f.topology.vertices, 'vertexId']];
  for (const [name, field, id] of inventories) maps[name] = bijection(lineage[name], ...[parent, target].map(solid =>
    solid.request.assets.flatMap(a => field(a.face).map(item => local(faceRef(a), id, item.id)))));
  for (const [name, field] of [['edges', 'edgeId'], ['vertices', 'vertexId']]) maps[name] = bijection(lineage[name],
    ...[parent, target].map(solid => solid.graph[name].map(item => ({ [field]: item.id }))));
  exactData(['faces', 'curves', 'uses', 'pcurves', 'localEdges', 'localVertices', 'edges', 'vertices'].map(k => lineage[k].length), [8, 36, 36, 36, 36, 36, 18, 12]);
  const mapped = (kind, ref) => { const value = maps[kind].get(signedData(ref)); assert.ok(value); return value; };
  const id = (kind, ref, field, value) => mapped(kind, local(ref, field, value))[field];
  const globalId = (kind, field, value) => mapped(kind, { [field]: value })[field];
  const mappedUse = use => {
    const asset = parent.request.assets.find(a => a.sourceId === use.sourceId); assert.ok(asset);
    const next = mapped('uses', local(faceRef(asset), 'useId', use.useId)); return { sourceId: next.sourceId, useId: next.useId };
  };
  const namespaceIds = solid => [solid.request.options.solidId, solid.request.options.resultIdPrefix,
    ...solid.request.assets.flatMap(({ sourceId, face }) => [sourceId, face.plane.id, face.loop.id, face.options.faceId,
      face.options.evaluationId, face.options.resultIdPrefix, ...face.loop.edges.map(c => c.id), ...face.pcurves.map(p => p.id),
      ...face.topology.loop.uses.map(u => u.id), ...face.topology.edges.map(e => e.id), ...face.topology.vertices.map(v => v.id)])];
  const namespaces = new Set(namespaceIds(parent));
  assert.ok(namespaceIds(target).every(id => !namespaces.has(id)), 'complete target namespace is independent');
  for (const link of lineage.faces) {
    const before = faceAt(parent, link.original), after = faceAt(target, link.translated);
    for (const key of Object.keys(link.original)) assert.notEqual(link.original[key], link.translated[key]);
    completeSource(before); completeSource(after); exactData(after.options.orientation, before.options.orientation);
    for (const field of ['kind', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'weights']) exactData(after.plane[field], before.plane[field]);
    exactData(after.plane.controlPoints.map(r => r.length), before.plane.controlPoints.map(r => r.length));
    before.plane.controlPoints.forEach((row, i) => row.forEach((p, j) => point(after.plane.controlPoints[i][j], p, offset)));
    exactData(after.loop.edges.map(c => c.id), before.loop.edges.map(c => id('curves', link.original, 'curveId', c.id)));
    exactData(after.topology.loop.uses.map(u => u.id), before.topology.loop.uses.map(u => id('uses', link.original, 'useId', u.id)));
    const a = parent.supports.find(s => s.sourceId === link.original.sourceId), b = target.supports.find(s => s.sourceId === link.translated.sourceId); assert.ok(a && b);
    for (let i = 0; i < 3; i++) { equal(fraction(b.outwardNormal[i]), fraction(a.outwardNormal[i])); equal(fraction(b.originMM[i]), add(fraction(a.originMM[i]), binary64(offset[i]))); }
    equal(fraction(b.offset), add(fraction(a.offset), dot(a.outwardNormal.map(fraction), offset.map(binary64))));
  }
  for (const [kind, field, key] of inventories) for (const link of lineage[kind]) {
    const before = field(faceAt(parent, link.original)).find(item => item.id === link.original[key]);
    const after = field(faceAt(target, link.translated)).find(item => item.id === link.translated[key]); assert.ok(before && after); assert.notEqual(before.id, after.id);
    if (kind === 'curves') {
      for (const field of ['kind', 'degree', 'knots', 'weights']) exactData(after[field], before[field]);
      assert.equal(after.controlPoints.length, before.controlPoints.length); before.controlPoints.forEach((p, i) => point(after.controlPoints[i], p, offset));
    }
    if (kind === 'localVertices') point(after.point, before.point, offset);
    if (kind === 'uses') { exactData(after.interval, before.interval); assert.equal(after.sense, before.sense); }
    if (kind === 'pcurves') { exactData(after.domain, before.domain); for (const field of ['degree', 'knots', 'weights']) exactData(after.curve[field], before.curve[field]); }
    for (const [name, refField] of [['curves', 'curveId'], ['localEdges', 'edgeId'], ['pcurves', 'pcurveId']]) {
      if (Object.hasOwn(before, refField)) assert.equal(after[refField], id(name, link.original, refField, before[refField]));
    }
    if (before.vertexIds) exactData(after.vertexIds, before.vertexIds.map(value => id('localVertices', link.original, 'vertexId', value)));
  }
  exactData(target.request.edgePairs, parent.request.edgePairs.map(pair => ({ a: mappedUse(pair.a), b: mappedUse(pair.b) })));
  for (const link of lineage.edges) {
    const a = parent.graph.edges.find(e => e.id === link.original.edgeId), b = target.graph.edges.find(e => e.id === link.translated.edgeId); assert.ok(a && b);
    assert.notEqual(a.id, b.id); exactData(b.parameterMapAtoB, a.parameterMapAtoB); assert.equal(b.pairIndex, a.pairIndex);
    exactData(b.vertexIds, a.vertexIds.map(v => globalId('vertices', 'vertexId', v)));
    exactData(b.uses.map(u => ({ sourceId: u.sourceId, useId: u.use.id })), a.uses.map(u => mappedUse({ sourceId: u.sourceId, useId: u.use.id })));
  }
  for (const link of lineage.vertices) {
    const a = parent.graph.vertices.find(v => v.id === link.original.vertexId), b = target.graph.vertices.find(v => v.id === link.translated.vertexId); assert.ok(a && b);
    assert.notEqual(a.id, b.id); point(b.pointMM, a.pointMM, offset); exactData(sorted(b.members), sorted(a.members.map(m => mapped('localVertices', m))));
  }
  const mappedFace = f => { const a = parent.request.assets.find(a => a.sourceId === f.sourceId && a.face.options.faceId === f.faceId); assert.ok(a); return mapped('faces', faceRef(a)); };
  for (const a of parent.graph.faces) {
    const ref = mappedFace(a), b = target.graph.faces.find(f => f.sourceId === ref.sourceId && f.faceId === ref.faceId); assert.ok(b);
    assert.equal(b.surfaceId, ref.surfaceId); assert.equal(b.loopId, ref.loopId);
    exactData(b.vertexIds, a.vertexIds.map(v => globalId('vertices', 'vertexId', v))); exactData(b.edgeIds, a.edgeIds.map(e => globalId('edges', 'edgeId', e)));
  }
  assert.equal(target.graph.vertexLinks.length, parent.graph.vertexLinks.length);
  for (const a of parent.graph.vertexLinks) {
    const b = target.graph.vertexLinks.find(v => v.vertexId === globalId('vertices', 'vertexId', a.vertexId)); assert.ok(b);
    exactData(b.cycleEdgeIds, a.cycleEdgeIds.map(e => globalId('edges', 'edgeId', e)));
    exactData(b.arcs, a.arcs.map(arc => { const f = mappedFace(arc); return { sourceId: f.sourceId, faceId: f.faceId,
      fromEdgeId: globalId('edges', 'edgeId', arc.fromEdgeId), toEdgeId: globalId('edges', 'edgeId', arc.toEdgeId) }; }));
  }
  for (let i = 0; i < 3; i++) equal(fraction(target.certificate.strictInteriorMM[i]), add(fraction(parent.certificate.strictInteriorMM[i]), binary64(offset[i])));
  const r = native.report; exactData(r.parentValidation, parent.report); exactData(r.targetQualification, target.report);
  exactData(r.directCalls, { parentValidationCount: 1, initialFaceConstructionCount: 8, targetQualificationCount: 1, retries: 0 });
  for (const report of [r.parentValidation.childNativeWork, r.targetQualification.childNativeWork, r.initialFaceConstruction]) count(report, [8, 108, 324]);
  exactData([r.initialFaceConstruction.faceCount, r.initialFaceConstruction.curveD1Count, r.initialFaceConstruction.pcurveD1Count, r.initialFaceConstruction.surfaceD1Count], [8, 108, 108, 108]);
  assert.ok(r.exactWork.operations > 0 && r.exactWork.operations <= 200000); assert.ok(r.exactWork.maximumObservedBits <= 8192); deepFrozen(native);
  return { fullSourceAdoption: true, bijectiveLocalAndGlobalLineage: true, exactCoordinatesNormalsSupportsAndVolume: true,
    preservedDomainWeightAndZeroBits: true, regeneratedNativePcurves: true, lineageSHA256: dataHash(lineage), nativeSHA256: dataHash(native) };
}

export function proveSnapshot(snapshot, parameters = DEFAULTS) {
  assert.equal(snapshot.save(), signedData(authoredDocument(parameters)) + '\n'); exactData(snapshot.parameters, parameters);
  exactData(snapshot.suppression, {}); exactData(Object.keys(snapshot.bodies), ['left', 'right']);
  exactData(snapshot.evidence.map(e => e.kind), ['sketch', 'extrude', 'chamfer', 'chamfer', 'translate']);
  const [sketch, prism, first, second, translation] = snapshot.evidence.map(e => e.native), left = snapshot.bodies.left.native, right = snapshot.bodies.right.native;
  for (const body of Object.values(snapshot.bodies)) assert.equal(body.family, 'convex-planar');
  assert.equal(left, second.split.negative.solid); assert.equal(right, translation.solid); exactData(prism.request.sketch, sketch);
  exactData(prism.report.childNativeWork, PRISM_COUNTS); exactData(sketch.solution.points.map(p => p.position), [[0, 0], [32, 0], [32, 24], [0, 24]]);
  exactData(first.split.request.parent, prism.solid); exactData(second.split.request.parent, first.split.negative.solid);
  const removed = [16 * parameters.frontDistance ** 2, 16 * parameters.backDistance ** 2], volume = 6144 - removed[0] - removed[1];
  proveConvex(prism.solid, 6144, [6, 12, 8]);
  for (const [i, feature] of [first, second].entries()) {
    const parent = feature.split.request.parent, kept = feature.split.negative.solid;
    assert.equal(feature.request.selection.parentSolidId, parent.request.options.solidId);
    exactData(feature.metric.removedVolumeMM3, { numerator: String(removed[i]), denominator: '1' });
    assert.equal(feature.split.report.volumeMM3.conserved, true); proveConvex(feature.split.positive.solid, removed[i], [5, 9, 6]);
    proveConvex(kept, 6144 - removed.slice(0, i + 1).reduce((a, b) => a + b, 0), [7 + i, 15 + 3 * i, 10 + 2 * i]);
    const cap = feature.split.lineage.faces.filter(f => f.side === 'negative' && f.role === 'cap'); assert.equal(cap.length, 1);
    assert.equal(cap[0].key, feature.lineage.chamferFaceKey); assert.ok(cap[0].output); faceAt(kept, cap[0].output);
  }
  const frontCap = first.split.lineage.faces.find(f => f.side === 'negative' && f.role === 'cap').output;
  const retainedFront = second.split.lineage.faces.filter(f => f.side === 'negative' && f.parent?.sourceId === frontCap.sourceId && f.parent.faceId === frontCap.faceId);
  assert.equal(retainedFront.length, 1); assert.equal(retainedFront[0].role, 'retained'); assert.ok(retainedFront[0].output);
  const backCap = second.split.lineage.faces.find(f => f.side === 'negative' && f.role === 'cap').output;
  assert.notEqual(retainedFront[0].output.sourceId, backCap.sourceId);
  const capCopies = [retainedFront[0].output, backCap].map(cap => {
    faceAt(left, cap); const link = translation.lineage.faces.find(f => f.original.sourceId === cap.sourceId && f.original.faceId === cap.faceId); assert.ok(link);
    faceAt(right, link.translated); return { finished: cap, translated: link.translated };
  });
  proveConvex(left, volume, [8, 18, 12]); proveConvex(right, volume, [8, 18, 12]);
  const offset = [parameters.spacing, -0, 0], copy = proveTranslation(translation, left, offset); assert.ok(Object.is(translation.request.offsetMM[1], -0));
  const bounds = solid => ({ min: [0, 1, 2].map(i => Math.min(...solid.graph.vertices.map(v => v.pointMM[i]))), max: [0, 1, 2].map(i => Math.max(...solid.graph.vertices.map(v => v.pointMM[i]))) });
  const boundsMM = { left: bounds(left), right: bounds(right) };
  exactData(boundsMM, { left: { min: [0, 0, 0], max: [32, 24, 8] }, right: { min: [parameters.spacing, 0, 0], max: [32 + parameters.spacing, 24, 8] } });
  deepFrozen(snapshot);
  return { volumesMM3: { left: volume, right: volume }, boundsMM, removedMM3: removed, retainedBevelCaps: capCopies, translation: copy,
    authoredSHA256: sha256(snapshot.save()), bodiesSHA256: dataHash(snapshot.bodies), evidenceSHA256: dataHash(snapshot.evidence),
    snapshotSHA256: dataHash(snapshotData(snapshot)), deepFrozenInActualProcess: true };
}
export function proveRefusal(error, CadModelError, accepted) {
  assert.ok(error instanceof CadModelError); assert.equal(error.code, 'NATIVE'); assert.equal(error.operation, 'translate');
  const cause = error.cause; assert.ok(cause instanceof Error); assert.equal(cause.name, 'ModelingTranslationError');
  assert.equal(cause.code, 'REPRESENTABILITY'); assert.equal(cause.stage, 'stage-coefficients');
  assert.ok(cause.cause instanceof Error); assert.equal(cause.cause.name, 'ConvexPlanarSolidError');
  assert.equal(cause.cause.code, 'REPRESENTABILITY'); assert.match(cause.cause.message, /not exactly represented in binary64/);
  // Locate the first nonrepresentable coefficient in actual source order.
  let failed;
  for (const { sourceId, face } of accepted.bodies.left.native.request.assets) {
    const entries = face.plane.controlPoints.flatMap((row, i) => row.map((p, j) => [face.plane.id + '/' + i + '/' + j, p]))
      .concat(face.loop.edges.flatMap(c => c.controlPoints.map((p, i) => [c.id + '/' + i, p])));
    for (const [path, p] of entries) { const exact = add(binary64(p[0]), binary64(.1)), rounded = binary64(p[0] + .1);
      if (exact.n * rounded.d !== rounded.n * exact.d) { failed = sourceId + '/' + path + '/0'; break; } }
    if (failed) break;
  }
  assert.ok(failed); assert.equal(cause.entity, failed); exactData(cause.report.parentValidation, accepted.bodies.left.native.report);
  exactData(cause.report.directCalls, { parentValidationCount: 1, initialFaceConstructionCount: 0, targetQualificationCount: 0, retries: 0 });
  count(cause.report.parentValidation.childNativeWork, [8, 108, 324]); deepFrozen(cause.report);
  for (const value of [error, cause]) for (const key of ['solid', 'bodies', 'evidence', 'lineage']) assert.equal(Object.hasOwn(value, key), false);
  return { code: cause.code, stage: cause.stage, entity: cause.entity, actualParentValidation: cause.report.parentValidation,
    originalCauseRetained: true, independentExactRepresentabilityRefusal: true, noTargetFaceConstruction: true, noTargetQualification: true };
}

export function provePreview(result, solid) {
  assert.notEqual(result.solid, solid); exactData(result.solid, solid); exactData(result.options, { maximumFanTriangles: 40 });
  const { mesh, report, boundaries, internalDiagonals } = result;
  assert.equal(report.schema, 'barocss-convex-planar-solid-mesh'); assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion');
  exactData([report.faceCount, report.vertexCount, report.triangleCount, report.boundaryUseCount, report.internalDiagonalCount], [8, 36, 20, 36, 12]);
  exactData([mesh.faces.length, mesh.vertices.length, mesh.positionsMM.length, mesh.normals.length, mesh.parametersUV.length, mesh.indices.length], [8, 36, 108, 108, 72, 60]);
  exactData([boundaries.length, internalDiagonals.length], [36, 12]);
  exactData(report.directCounts, { parentValidationCount: 1, newGeometryEvaluationCount: 0, retries: 0 }); count(report.parentNativeWork, [8, 108, 324]);
  assert.equal(report.nativeAuthority, false); assert.equal(report.float32ProjectionCertified, false);
  const at = i => mesh.positionsMM.slice(i * 3, i * 3 + 3), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0); let sixVolume = 0;
  for (const [i, vertex] of mesh.vertices.entries()) {
    const face = faceAt(solid, vertex); assert.equal(face.plane.id, vertex.surfaceId);
    const use = face.topology.loop.uses.find(u => u.id === vertex.useId), native = face.topology.vertices.find(v => v.id === vertex.nativeVertexId); assert.ok(use && native);
    assert.equal(use.vertexIds[0], native.id); exactData(at(i), native.point);
    exactData(at(i), solid.graph.vertices.find(v => v.id === vertex.solidVertexId).pointMM);
    const binding = face.bindings.find(b => b.useId === use.id && b.parameter === use.interval[0]); assert.ok(binding);
    exactData(mesh.normals.slice(i * 3, i * 3 + 3), binding.orientedFaceNormal);
    const curve = face.pcurves.find(p => p.id === use.pcurveId).curve;
    exactData(mesh.parametersUV.slice(i * 2, i * 2 + 2), curve.controlPoints[use.sense === 'forward' ? 0 : 1].slice(0, 2));
  }
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const indices = mesh.indices.slice(i, i + 3); assert.ok(indices.every(j => Number.isInteger(j) && j >= 0 && j < 36));
    const [a, b, c] = indices.map(at), normal = mesh.normals.slice(indices[0] * 3, indices[0] * 3 + 3);
    assert.ok(dot(cross(b.map((v, j) => v - a[j]), c.map((v, j) => v - a[j])), normal) > 0); sixVolume += dot(a, cross(b, c));
  }
  equal({ n: BigInt(sixVolume), d: 6n }, fraction(solid.certificate.volumeMM3));
  for (const b of boundaries) {
    assert.equal(b.role, 'native-boundary'); const edge = solid.graph.edges.find(e => e.id === b.solidEdgeId); assert.ok(edge);
    exactData([...edge.vertexIds].sort(), [...b.solidVertexIds].sort()); exactData(b.vertexIndices.map(i => mesh.vertices[i].solidVertexId), b.solidVertexIds);
  }
  for (const d of internalDiagonals) {
    assert.equal(d.role, 'display-internal-not-brep-edge'); const ids = d.vertexIndices.map(i => mesh.vertices[i].solidVertexId).sort();
    assert.equal(solid.graph.edges.some(e => [...e.vertexIds].sort().join(':') === ids.join(':')), false);
  }
  return { faces: 8, vertices: 36, triangles: 20, outwardTriangleVolumeMM3: sixVolume / 6,
    parentNativeWork: report.parentNativeWork, previewSHA256: dataHash(result), basis: 'actual authored XYZ; no conversion' };
}

function count(report, expected, chamfer = false) {
  exactData(chamfer ? [report.totalSourceCompilations, report.bindingObservations, report.totalD1]
    : [report.sourceCompilationCount, report.bindingObservationCount, report.totalD1Count], expected);
  if (Object.hasOwn(report, 'retries')) assert.equal(report.retries, 0);
}
export const emptyLedgers = () => ({ ...translationLedgers(), firstChamfers: [], secondChamfers: [] });
export function collectLedgers(ledgers, snapshot, label) {
  collectTranslationLedgers(ledgers, snapshot, label);
  for (const index of snapshot.recomputation.evaluatedFeatures) if (snapshot.evidence[index].kind === 'chamfer') {
    assert.ok(index === 2 || index === 3);
    ledgers[index === 2 ? 'firstChamfers' : 'secondChamfers'].push({ label, index, report: snapshot.evidence[index].native.report.nativeWork });
  }
}
export function accounting(ledgers, expectedCounts) {
  const keys = ['sketches', 'prisms', 'firstChamfers', 'secondChamfers', 'parents', 'targets', 'initialFaces', 'previews'];
  exactData(keys.map(k => ledgers[k].length), expectedCounts);
  const expected = { prisms: [13, 144, 432], firstChamfers: [31, 360, 1080], secondChamfers: [34, 414, 1242],
    parents: [8, 108, 324], targets: [8, 108, 324], initialFaces: [8, 108, 324], previews: [8, 108, 324] };
  const totals = {};
  for (const [kind, numbers] of Object.entries(expected)) {
    const chamfer = kind.endsWith('Chamfers');
    for (const item of ledgers[kind]) count(item.report, numbers, chamfer);
    totals[kind] = numbers.map(n => n * ledgers[kind].length);
  }
  const returned = Object.entries(totals).filter(([kind]) => kind !== 'initialFaces').reduce((a, [, b]) => a.map((v, i) => v + b[i]), [0, 0, 0]);
  const known = returned.map((v, i) => v + totals.initialFaces[i] + (i === 0 ? ledgers.sketches.length : 0));
  return { returnedLedgerSourceCompilations: returned[0], returnedLedgerBindingObservations: returned[1], returnedLedgerD1: returned[2],
    knownSourceCompilations: known[0], combinedBindingObservations: known[1], knownD1: known[2],
    initialFaceConstructionCount: ledgers.initialFaces.length * 8, fullTransitiveNativeCoverage: 'NOT_MEASURED' };
}
export const EXPECTED_TOTALS = Object.freeze({ returnedLedgerSourceCompilations: 294, returnedLedgerBindingObservations: 3654, returnedLedgerD1: 10962,
  knownSourceCompilations: 336, combinedBindingObservations: 4194, knownD1: 12582, initialFaceConstructionCount: 40, fullTransitiveNativeCoverage: 'NOT_MEASURED' });

// Shared finite recorder for the two actual processes. Merely importing it does
// no CAD work or file writes. Raw results are persisted before any test oracle.
export function recorder(mode, entry, directory, source) {
  assert.equal(Number(process.versions.node.split('.')[0]), 22); assert.ok(process.execArgv.includes('--no-opt'));
  assert.match([...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' '), /--max[-_]old[-_]space[-_]size(?:=|\s+)1536(?:\s|$)/);
  assert.equal(process.argv.length, 2); assert.ok(mode === 'source' || mode === 'cold');
  mkdirSync(directory, { recursive: true });
  const started = performance.now(), receipt = resolve(directory, mode + '-flow.json');
  const flow = { status: 'running', issue: 1919, mode, processId: process.pid, processInstanceId: randomUUID(), nodeVersion: process.version,
    startedAt: new Date().toISOString(), groupStartedAtMS: source?.groupStartedAtMS ?? Date.now(), entrySHA256: sha256(readFileSync(entry)),
    modelCalls: 0, tessellations: 0, massQueries: 0, exports: 0, standaloneValidators: 0, cpuBufferPreparations: 0,
    stages: [], artifacts: {}, returnedLedgers: emptyLedgers(), nativeElapsedMS: 0, expectedWholeCampaign: EXPECTED_CAMPAIGN,
    timingScope: 'stage action plus artifact persistence; not isolated kernel timing', fullTransitiveNativeCoverage: 'NOT_MEASURED',
    sourceDerivedExpectedWorkIsNotInstrumented: true, limits: { heapMiB: 1536, freeDiskMiB: 500, processGroupSeconds: 600 },
    externalSerialProcessGroupTimeoutRequired: true };
  writeFileSync(receipt, signedData(flow) + '\n', { flag: 'wx' });
  const write = () => writeFileSync(receipt, signedData(flow) + '\n');
  const artifact = (filename, value, scope, raw = false) => {
    const bytes = raw ? value : signedData(value) + '\n'; assert.ok(Buffer.byteLength(bytes) <= 32 * 1024 * 1024);
    writeFileSync(resolve(directory, filename), bytes, { flag: 'wx' });
    flow.artifacts[filename] = { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes), scope }; write(); return bytes;
  };
  const budget = () => {
    const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
    assert.ok(Date.now() - flow.groupStartedAtMS < 600000 && flow.nativeElapsedMS + (source?.nativeElapsedMS ?? 0) < 600000);
  };
  const stage = (kind, label, action, filename) => {
    budget(); assert.ok(flow[kind] < (kind === 'modelCalls' ? mode === 'source' ? 5 : 1 : mode === 'source' ? 2 : 0));
    flow[kind]++; flow.pending = { kind, label }; write(); const begin = performance.now(); let outcome = 'threw', failure;
    try {
      let result;
      try { result = action(); outcome = 'returned'; }
      catch (error) { failure = errorData(error); artifact(filename + '.refusal.json', failure, 'original thrown error and complete cause before any refusal oracle'); throw error; }
      artifact(filename, kind === 'modelCalls' ? snapshotData(result) : result, 'actual complete result before fixture oracles');
      if (kind === 'modelCalls') collectLedgers(flow.returnedLedgers, result, label);
      else flow.returnedLedgers.previews.push({ label, report: result.report.parentNativeWork });
      return result;
    } finally {
      const elapsedMS = performance.now() - begin; flow.nativeElapsedMS += elapsedMS;
      flow.stages.push({ kind, label, outcome, elapsedMS, ...(failure ? { failure } : {}) }); flow.pending = null; write();
    }
  };
  const fail = error => { flow.status = 'failed'; flow.failure = errorData(error); flow.failedAt = new Date().toISOString(); write(); };
  const finish = () => { budget(); flow.status = 'passed'; flow.completedAt = new Date().toISOString(); flow.wallElapsedMS = performance.now() - started; write(); };
  return { flow, write, artifact, stage, fail, finish };
}

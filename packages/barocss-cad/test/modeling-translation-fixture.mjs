import assert from 'node:assert/strict';
import { constrainedGusset, authoredDocument as gussetDocument, proveSketch, provePreview,
  signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData, PRISM_COUNTS,
  hold, unchanged } from './modeling-gusset-fixture.mjs';
import { prove as proveConvex } from './modeling-intersection-fixture.mjs';
import { binary64 } from './stored-circle-prism-solid-fixture.mjs';
export { provePreview, signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData, hold, unchanged };

// Frozen #1880 matrix. Counts below are call-site expectations, never a claim
// of hidden/transitive instrumentation. Importing this fixture does no CAD work.
export const EXPECTED_CAMPAIGN = Object.freeze({ modelCalls: 7, sourceModelCalls: 5, coldModelCalls: 2,
  successfulCopies: 6, successfulPrisms: 3, representabilityRefusals: 1, tessellations: 2,
  massQueries: 0, cpuBufferPreparations: 0, standaloneValidators: 0,
  sourceDerived: { standaloneSuccessfulSketchCompilations: 3, totalSolverAttempts: 6,
    prismSourceCompilations: 39, prismBindingObservations: 432, prismD1: 1296,
    parentValidationCount: 7, parentSourceCompilations: 42, parentBindingObservations: 504, parentD1: 1512,
    targetQualificationCount: 6, targetSourceCompilations: 36, targetBindingObservations: 432, targetD1: 1296,
    previewValidationCount: 2, previewSourceCompilations: 12, previewBindingObservations: 144, previewD1: 432,
    initialFaceConstructionCount: 36, initialFaceSourceCompilations: 36, initialFaceBindingObservations: 432, initialFaceD1: 1296,
    returnedLedgerSourceCompilations: 129, returnedLedgerBindingObservations: 1512, returnedLedgerD1: 4536,
    knownSourceCompilations: 168, combinedBindingObservations: 1944, knownD1: 5832 },
  fullTransitiveNativeCoverage: 'NOT_MEASURED' });
export const DEFAULTS = Object.freeze({ width: 40, height: 24, spacing: 48, offsetY: -0, offsetZ: 0 });
export const WIDER = Object.freeze({ ...DEFAULTS, spacing: 64 });
export const RECOVERED = Object.freeze({ ...DEFAULTS, height: 12, spacing: -48, offsetY: -8, offsetZ: -4 });
export const ZERO = Object.freeze({ ...DEFAULTS, spacing: 0, offsetY: 0 });

export function translatedPair(cad) {
  const { model, sketch, gusset } = constrainedGusset(cad);
  const spacing = model.parameter('spacing', 48), offsetY = model.parameter('offsetY', -0), offsetZ = model.parameter('offsetZ', 0);
  const right = gusset.translate([spacing, offsetY, offsetZ]);
  return { model, sketch, gusset, right, build: () => model.build({ left: gusset, right }) };
}
export function authoredDocument(parameters = DEFAULTS) {
  const original = gussetDocument({ width: parameters.width, height: parameters.height });
  return { ...original, parameters: { ...parameters }, nodes: [...original.nodes,
    { kind: 'translate', parent: { node: 1, side: 'solid' }, offset: ['spacing', 'offsetY', 'offsetZ'].map(parameter => ({ parameter })) }],
  outputs: { left: { node: 1, side: 'solid' }, right: { node: 2, side: 'solid' } } };
}
export function work(snapshot, reused, evaluated, previous) {
  exactData(snapshot.recomputation, { reusedFeatures: reused, evaluatedFeatures: evaluated });
  exactData([...reused, ...evaluated].sort(), [0, 1, 2]);
  exactData(snapshot.features, [{ kind: 'sketch', index: 0, dependencies: [] },
    { kind: 'extrude', index: 1, dependencies: [0] }, { kind: 'translate', index: 2, dependencies: [1] }]);
  exactData(Object.keys(snapshot).sort(), ['bodies', 'parameters', 'suppression', 'features', 'recomputation', 'evidence',
    'withParameters', 'withSuppression', 'massProperties', 'exportStl', 'save'].sort());
  if (previous) {
    assert.notEqual(snapshot, previous); assert.notEqual(snapshot.parameters, previous.parameters); assert.notEqual(snapshot.evidence, previous.evidence);
    for (const index of reused) assert.equal(snapshot.evidence[index], previous.evidence[index]);
    for (const index of evaluated) assert.notEqual(snapshot.evidence[index], previous.evidence[index]);
    const equality = reused.includes(1) ? 'equal' : 'notEqual';
    assert[equality](snapshot.bodies.left, previous.bodies.left); assert[equality](snapshot.bodies.left.native, previous.bodies.left.native);
    assert.notEqual(snapshot.bodies.right, previous.bodies.right); assert.notEqual(snapshot.bodies.right.native, previous.bodies.right.native);
  }
  deepFrozen(snapshot);
}

// Independent represented-binary64 rational arithmetic, not production helpers.
const fraction = value => ({ n: BigInt(value.numerator), d: BigInt(value.denominator) });
const add = (a, b) => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
const mul = (a, b) => ({ n: a.n * b.n, d: a.d * b.d });
const equals = (a, b, label) => assert.equal(a.n * b.d, b.n * a.d, label);
const dot = (a, b) => a.reduce((sum, v, i) => add(sum, mul(v, b[i])), { n: 0n, d: 1n });
const key = value => signedData(value);
const sorted = values => values.map(key).sort();
const faceRef = asset => ({ sourceId: asset.sourceId, faceId: asset.face.options.faceId, surfaceId: asset.face.plane.id,
  loopId: asset.face.loop.id, evaluationId: asset.face.options.evaluationId });
const localRefs = (solid, field, idName) => solid.request.assets.flatMap(asset => field(asset.face).map(item =>
  ({ sourceId: asset.sourceId, faceId: asset.face.options.faceId, [idName]: item.id })));
function bijection(entries, original, translated, label) {
  assert.equal(entries.length, original.length, label + ' cardinality'); assert.equal(original.length, translated.length);
  exactData(sorted(entries.map(e => e.original)), sorted(original), label + ' complete original coverage');
  exactData(sorted(entries.map(e => e.translated)), sorted(translated), label + ' complete translated coverage');
  assert.equal(new Set(entries.map(e => key(e.original))).size, entries.length, label + ' original uniqueness');
  assert.equal(new Set(entries.map(e => key(e.translated))).size, entries.length, label + ' translated uniqueness');
  return new Map(entries.map(e => [key(e.original), e.translated]));
}
function translatedPoint(actual, original, offset, label) {
  assert.equal(actual.length, 3); assert.equal(original.length, 3);
  for (let axis = 0; axis < 3; axis++) {
    const expected = add(binary64(original[axis]), binary64(offset[axis]));
    equals(binary64(actual[axis]), expected, label + ' exact coordinate ' + axis);
    assert.ok(actual[axis] >= -10000 && actual[axis] <= 10000);
    if (offset[axis] === 0) assert.ok(Object.is(actual[axis], original[axis]), label + ' zero component bit copy');
    else if (expected.n === 0n) assert.ok(Object.is(actual[axis], 0), label + ' nonzero cancellation positive zero');
  }
}
function actualFace(solid, ref) {
  const asset = solid.request.assets.find(a => a.sourceId === ref.sourceId); assert.ok(asset);
  assert.equal(asset.face.options.faceId, ref.faceId); return asset.face;
}
function sourceObjects(face) {
  exactData(face.model.objects, [face.plane, ...face.loop.edges]);
  assert.ok(face.source.includes('@model ' + face.options.evaluationId));
  for (const object of face.model.objects) {
    const marker = '@' + object.kind + ' #' + object.id + ' ', start = face.source.indexOf(marker); assert.ok(start >= 0);
    const end = face.source.indexOf('}', start), source = face.source.slice(start, end);
    const field = name => {
      const match = source.match(new RegExp('(?:^|[;{])\\s*' + name + '\\s*:\\s*([^;]+);')); assert.ok(match, name);
      return JSON.parse(match[1]);
    };
    exactData(field('control-points'), object.controlPoints, 'actual Source0 coefficient bits');
    exactData(field('weights'), object.weights, 'actual Source0 weight bits');
    for (const [name, property] of object.kind === 'surface'
      ? [['degree-u', 'degreeU'], ['degree-v', 'degreeV'], ['knots-u', 'knotsU'], ['knots-v', 'knotsV']]
      : [['degree', 'degree'], ['knots', 'knots']]) exactData(field(name), object[property]);
  }
}
export function proveTranslation(native, original, offset) {
  exactData(native.request.parent, original); assert.notEqual(native.request.parent, original);
  exactData(native.request.offsetMM, offset); assert.equal(typeof native.request.prefix, 'string');
  const target = native.solid, lineage = native.lineage, parent = native.request.parent;
  assert.notEqual(target, original); assert.notEqual(target.request.options.solidId, original.request.options.solidId);
  exactData(target.certificate.volumeMM3, original.certificate.volumeMM3);
  const originals = new Set(parent.request.assets.map(a => a.sourceId));
  assert.ok(target.request.assets.every(a => !originals.has(a.sourceId)), 'all six target source namespaces are distinct from parent');
  const maps = {};
  maps.faces = bijection(lineage.faces, parent.request.assets.map(faceRef), target.request.assets.map(faceRef), 'faces');
  for (const [name, field, idName] of [
    ['curves', f => f.loop.edges, 'curveId'], ['uses', f => f.topology.loop.uses, 'useId'],
    ['pcurves', f => f.pcurves, 'pcurveId'], ['localEdges', f => f.topology.edges, 'edgeId'],
    ['localVertices', f => f.topology.vertices, 'vertexId'],
  ]) maps[name] = bijection(lineage[name], localRefs(parent, field, idName), localRefs(target, field, idName), name);
  maps.edges = bijection(lineage.edges, parent.graph.edges.map(e => ({ edgeId: e.id })), target.graph.edges.map(e => ({ edgeId: e.id })), 'solid edges');
  maps.vertices = bijection(lineage.vertices, parent.graph.vertices.map(v => ({ vertexId: v.id })), target.graph.vertices.map(v => ({ vertexId: v.id })), 'solid vertices');
  exactData([lineage.faces.length, lineage.curves.length, lineage.uses.length, lineage.pcurves.length,
    lineage.localEdges.length, lineage.localVertices.length, lineage.edges.length, lineage.vertices.length], [6, 24, 24, 24, 24, 24, 12, 8]);
  const mapped = (name, ref) => { const value = maps[name].get(key(ref)); assert.ok(value); return value; };
  const local = (ref, idName, id) => ({ sourceId: ref.sourceId, faceId: ref.faceId, [idName]: id });
  for (const link of lineage.faces) {
    const before = actualFace(parent, link.original), after = actualFace(target, link.translated);
    for (const idName of ['sourceId', 'faceId', 'surfaceId', 'loopId', 'evaluationId']) assert.notEqual(link.original[idName], link.translated[idName]);
    sourceObjects(before); sourceObjects(after);
    exactData(after.options.orientation, before.options.orientation);
    for (const property of ['kind', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'weights']) exactData(after.plane[property], before.plane[property]);
    exactData(after.plane.controlPoints.map(row => row.length), before.plane.controlPoints.map(row => row.length));
    for (const [i, row] of before.plane.controlPoints.entries()) for (const [j, point] of row.entries()) {
      translatedPoint(after.plane.controlPoints[i][j], point, offset, 'surface');
    }
    exactData(after.loop.edges.map(c => c.id), before.loop.edges.map(c => mapped('curves', local(link.original, 'curveId', c.id)).curveId));
    exactData(after.topology.loop.uses.map(u => u.id), before.topology.loop.uses.map(u => mapped('uses', local(link.original, 'useId', u.id)).useId));
    const supportBefore = parent.supports.find(s => s.sourceId === link.original.sourceId), supportAfter = target.supports.find(s => s.sourceId === link.translated.sourceId);
    assert.ok(supportBefore && supportAfter);
    for (let axis = 0; axis < 3; axis++) {
      equals(fraction(supportAfter.outwardNormal[axis]), fraction(supportBefore.outwardNormal[axis]), 'same exact outward normal');
      equals(fraction(supportAfter.originMM[axis]), add(fraction(supportBefore.originMM[axis]), binary64(offset[axis])), 'translated exact support origin');
    }
    equals(fraction(supportAfter.offset), add(fraction(supportBefore.offset), dot(supportBefore.outwardNormal.map(fraction), offset.map(binary64))), 'translated exact support offset');
  }
  for (const link of lineage.curves) {
    const before = actualFace(parent, link.original).loop.edges.find(c => c.id === link.original.curveId);
    const after = actualFace(target, link.translated).loop.edges.find(c => c.id === link.translated.curveId); assert.ok(before && after);
    assert.notEqual(before.id, after.id);
    for (const property of ['kind', 'degree', 'knots', 'weights']) exactData(after[property], before[property]);
    assert.equal(after.controlPoints.length, before.controlPoints.length);
    before.controlPoints.forEach((point, i) => translatedPoint(after.controlPoints[i], point, offset, 'curve'));
  }
  for (const link of lineage.uses) {
    const before = actualFace(parent, link.original).topology.loop.uses.find(u => u.id === link.original.useId);
    const after = actualFace(target, link.translated).topology.loop.uses.find(u => u.id === link.translated.useId); assert.ok(before && after);
    assert.notEqual(before.id, after.id); exactData(after.interval, before.interval); assert.equal(after.sense, before.sense);
    for (const [name, field] of [['curves', 'curveId'], ['localEdges', 'edgeId'], ['pcurves', 'pcurveId']]) {
      assert.equal(after[field], mapped(name, local(link.original, field, before[field]))[field]);
    }
    exactData(after.vertexIds, before.vertexIds.map(id => mapped('localVertices', local(link.original, 'vertexId', id)).vertexId));
  }
  for (const link of lineage.pcurves) {
    const before = actualFace(parent, link.original).pcurves.find(p => p.id === link.original.pcurveId);
    const after = actualFace(target, link.translated).pcurves.find(p => p.id === link.translated.pcurveId); assert.ok(before && after);
    exactData(after.domain, before.domain); assert.notEqual(after.id, before.id);
    for (const property of ['degree', 'knots', 'weights']) exactData(after.curve[property], before.curve[property]);
    assert.equal(after.curveId, mapped('curves', local(link.original, 'curveId', before.curveId)).curveId);
    assert.equal(after.edgeId, mapped('localEdges', local(link.original, 'edgeId', before.edgeId)).edgeId);
    // These are actual regenerated provider pcurves. No copied-UV-bit claim.
  }
  for (const link of lineage.localEdges) {
    const before = actualFace(parent, link.original).topology.edges.find(e => e.id === link.original.edgeId);
    const after = actualFace(target, link.translated).topology.edges.find(e => e.id === link.translated.edgeId); assert.ok(before && after);
    assert.equal(after.curveId, mapped('curves', local(link.original, 'curveId', before.curveId)).curveId);
    exactData(after.vertexIds, before.vertexIds.map(id => mapped('localVertices', local(link.original, 'vertexId', id)).vertexId));
  }
  for (const link of lineage.localVertices) {
    const before = actualFace(parent, link.original).topology.vertices.find(v => v.id === link.original.vertexId);
    const after = actualFace(target, link.translated).topology.vertices.find(v => v.id === link.translated.vertexId); assert.ok(before && after);
    translatedPoint(after.point, before.point, offset, 'local vertex');
  }
  const mappedUse = use => { const face = parent.request.assets.find(a => a.sourceId === use.sourceId); assert.ok(face);
    const ref = mapped('uses', { ...use, faceId: face.face.options.faceId }); return { sourceId: ref.sourceId, useId: ref.useId }; };
  exactData(target.request.edgePairs, parent.request.edgePairs.map(pair => ({ a: mappedUse(pair.a), b: mappedUse(pair.b) })));
  for (const link of lineage.edges) {
    const before = parent.graph.edges.find(e => e.id === link.original.edgeId), after = target.graph.edges.find(e => e.id === link.translated.edgeId); assert.ok(before && after);
    assert.notEqual(before.id, after.id); exactData(after.parameterMapAtoB, before.parameterMapAtoB); assert.equal(after.pairIndex, before.pairIndex);
    exactData(after.vertexIds, before.vertexIds.map(id => mapped('vertices', { vertexId: id }).vertexId));
    exactData(after.uses.map(u => ({ sourceId: u.sourceId, useId: u.use.id })), before.uses.map(u => mappedUse({ sourceId: u.sourceId, useId: u.use.id })));
  }
  for (const link of lineage.vertices) {
    const before = parent.graph.vertices.find(v => v.id === link.original.vertexId), after = target.graph.vertices.find(v => v.id === link.translated.vertexId); assert.ok(before && after);
    assert.notEqual(before.id, after.id); translatedPoint(after.pointMM, before.pointMM, offset, 'solid vertex');
    exactData(sorted(after.members), sorted(before.members.map(member => mapped('localVertices', member))));
  }
  const mappedFace = (sourceId, faceId) => {
    const asset = parent.request.assets.find(a => a.sourceId === sourceId && a.face.options.faceId === faceId); assert.ok(asset);
    return mapped('faces', faceRef(asset));
  };
  for (const before of parent.graph.faces) {
    const ref = mappedFace(before.sourceId, before.faceId);
    const after = target.graph.faces.find(f => f.sourceId === ref.sourceId && f.faceId === ref.faceId); assert.ok(after);
    assert.equal(after.surfaceId, ref.surfaceId); assert.equal(after.loopId, ref.loopId);
    exactData(after.vertexIds, before.vertexIds.map(id => mapped('vertices', { vertexId: id }).vertexId));
    exactData(after.edgeIds, before.edgeIds.map(id => mapped('edges', { edgeId: id }).edgeId));
  }
  assert.equal(target.graph.vertexLinks.length, parent.graph.vertexLinks.length);
  for (const before of parent.graph.vertexLinks) {
    const vertexId = mapped('vertices', { vertexId: before.vertexId }).vertexId;
    const after = target.graph.vertexLinks.find(link => link.vertexId === vertexId); assert.ok(after);
    exactData(after.cycleEdgeIds, before.cycleEdgeIds.map(id => mapped('edges', { edgeId: id }).edgeId));
    exactData(after.arcs, before.arcs.map(arc => {
      const ref = mappedFace(arc.sourceId, arc.faceId);
      return { sourceId: ref.sourceId, faceId: ref.faceId,
        fromEdgeId: mapped('edges', { edgeId: arc.fromEdgeId }).edgeId, toEdgeId: mapped('edges', { edgeId: arc.toEdgeId }).edgeId };
    }));
  }
  for (let axis = 0; axis < 3; axis++) equals(fraction(target.certificate.strictInteriorMM[axis]),
    add(fraction(parent.certificate.strictInteriorMM[axis]), binary64(offset[axis])), 'translated exact certified interior');
  const report = native.report;
  exactData(report.parentValidation, parent.report); exactData(report.targetQualification, target.report);
  exactData(report.directCalls, { parentValidationCount: 1, initialFaceConstructionCount: 6, targetQualificationCount: 1, retries: 0 });
  for (const nativeReport of [report.parentValidation, report.targetQualification]) {
    exactData([nativeReport.childNativeWork.sourceCompilationCount, nativeReport.childNativeWork.bindingObservationCount,
      nativeReport.childNativeWork.totalD1Count], [6, 72, 216]);
  }
  const initial = report.initialFaceConstruction;
  exactData([initial.faceCount, initial.sourceCompilationCount, initial.bindingObservationCount,
    initial.curveD1Count, initial.pcurveD1Count, initial.surfaceD1Count, initial.totalD1Count], [6, 6, 72, 72, 72, 72, 216]);
  assert.equal(initial.bindingObservationCount, target.request.assets.reduce((sum, asset) => sum + asset.face.bindings.length, 0));
  assert.ok(report.exactWork.operations > 0 && report.exactWork.operations <= 200000);
  assert.ok(report.exactWork.maximumObservedBits <= 8192); deepFrozen(native);
  return { independentExactCoordinateSums: true, preservedDomainAndWeightBits: true, completeBijectiveLineage: true,
    unchangedExactNormalsAndVolume: true, regeneratedNativeSourceAndPcurves: true, translatedNativeSHA256: dataHash(native), lineageSHA256: dataHash(lineage) };
}
export function proveSnapshot(snapshot, parameters = DEFAULTS) {
  assert.equal(snapshot.save(), signedData(authoredDocument(parameters)) + '\n');
  exactData(snapshot.parameters, parameters); exactData(snapshot.suppression, {}); exactData(Object.keys(snapshot.bodies), ['left', 'right']);
  exactData(snapshot.evidence.map(e => e.kind), ['sketch', 'extrude', 'translate']);
  exactData(Object.keys(snapshot.evidence[2]).sort(), ['kind', 'native']);
  const { left, right } = snapshot.bodies, sketch = snapshot.evidence[0].native, prism = snapshot.evidence[1].native, translation = snapshot.evidence[2].native;
  assert.equal(left.family, 'convex-planar'); assert.equal(right.family, 'convex-planar'); assert.equal(left.native, prism.solid); assert.equal(right.native, translation.solid);
  exactData(prism.request.sketch, sketch); exactData(prism.report.childNativeWork, PRISM_COUNTS);
  const sketchProof = proveSketch(sketch, { width: parameters.width, height: parameters.height });
  const volume = (parameters.width * parameters.height - parameters.height ** 2 / 6) * 8;
  proveConvex(left.native, volume, [6, 12, 8]); proveConvex(right.native, volume, [6, 12, 8]);
  const offset = [parameters.spacing, parameters.offsetY, parameters.offsetZ], translationProof = proveTranslation(translation, left.native, offset);
  const bounds = solid => ({ min: [0, 1, 2].map(a => Math.min(...solid.graph.vertices.map(v => v.pointMM[a]))),
    max: [0, 1, 2].map(a => Math.max(...solid.graph.vertices.map(v => v.pointMM[a]))) });
  const leftBounds = bounds(left.native), rightBounds = bounds(right.native);
  exactData(leftBounds, { min: [0, 0, 0], max: [parameters.width, parameters.height, 8] });
  exactData(rightBounds, { min: [parameters.spacing, parameters.offsetY === 0 ? 0 : parameters.offsetY, parameters.offsetZ],
    max: [parameters.width + parameters.spacing, parameters.height + parameters.offsetY, 8 + parameters.offsetZ] });
  deepFrozen(snapshot);
  return { volumesMM3: { left: volume, right: volume }, boundsMM: { left: leftBounds, right: rightBounds },
    sketch: sketchProof, translation: translationProof, authoredSHA256: sha256(snapshot.save()), bodiesSHA256: dataHash(snapshot.bodies),
    evidenceSHA256: dataHash(snapshot.evidence), snapshotSHA256: dataHash(snapshotData(snapshot)), deepFrozenInActualProcess: true };
}
export function proveRefusal(error, CadModelError, original) {
  assert.ok(error instanceof CadModelError); assert.equal(error.code, 'NATIVE'); assert.equal(error.operation, 'translate');
  const cause = error.cause; assert.ok(cause instanceof Error); assert.equal(cause.name, 'ModelingTranslationError');
  assert.equal(cause.code, 'REPRESENTABILITY'); assert.equal(cause.stage, 'stage-coefficients');
  const originalFace = original.bodies.left.native.request.assets[0];
  assert.equal(cause.entity, originalFace.sourceId + '/' + originalFace.face.plane.id + '/1/0/0');
  assert.ok(cause.cause instanceof Error); assert.equal(cause.cause.name, 'ConvexPlanarSolidError');
  assert.equal(cause.cause.code, 'REPRESENTABILITY'); assert.match(cause.cause.message, /not exactly represented in binary64/);
  exactData(cause.report.parentValidation, original.bodies.left.native.report);
  exactData(cause.report.directCalls, { parentValidationCount: 1, initialFaceConstructionCount: 0, targetQualificationCount: 0, retries: 0 });
  // Stored 40 + stored 0.1 is provably different from its rounded binary64 sum.
  const exact = add(binary64(40), binary64(.1)), rounded = binary64(40 + .1);
  assert.notEqual(exact.n * rounded.d, rounded.n * exact.d);
  for (const value of [error, cause]) for (const field of ['solid', 'bodies', 'evidence', 'lineage']) assert.equal(Object.hasOwn(value, field), false);
  return { code: cause.code, stage: cause.stage, entity: cause.entity, actualParentValidation: cause.report.parentValidation,
    noTargetFaceConstruction: true, noTargetQualification: true, originalCauseRetained: true, independentExactRepresentabilityRefusal: true };
}
export const emptyLedgers = () => ({ sketches: [], prisms: [], parents: [], targets: [], initialFaces: [], previews: [] });
export function collectLedgers(ledgers, snapshot, label) {
  for (const index of snapshot.recomputation.evaluatedFeatures) {
    const evidence = snapshot.evidence[index], entry = report => ({ label, index, report });
    if (evidence.kind === 'sketch') ledgers.sketches.push(entry(evidence.native.report));
    if (evidence.kind === 'extrude') ledgers.prisms.push(entry(evidence.native.report.childNativeWork));
    if (evidence.kind === 'translate') {
      ledgers.parents.push(entry(evidence.native.report.parentValidation.childNativeWork));
      ledgers.targets.push(entry(evidence.native.report.targetQualification.childNativeWork));
      ledgers.initialFaces.push(entry(evidence.native.report.initialFaceConstruction));
    }
  }
}
export function accounting(ledgers, expectedCounts) {
  const sum = (reports, field) => reports.reduce((n, entry) => n + entry.report[field], 0);
  exactData(['sketches', 'prisms', 'parents', 'targets', 'initialFaces', 'previews'].map(k => ledgers[k].length), expectedCounts);
  const returned = [...ledgers.prisms, ...ledgers.parents, ...ledgers.targets, ...ledgers.previews];
  const all = [...returned, ...ledgers.initialFaces];
  return { returnedLedgerSourceCompilations: sum(returned, 'sourceCompilationCount'), returnedLedgerBindingObservations: sum(returned, 'bindingObservationCount'),
    returnedLedgerD1: sum(returned, 'totalD1Count'), knownSourceCompilations: sum(all, 'sourceCompilationCount') + ledgers.sketches.length,
    combinedBindingObservations: sum(all, 'bindingObservationCount'), knownD1: sum(all, 'totalD1Count'),
    initialFaceConstructionCount: sum(ledgers.initialFaces, 'faceCount'), fullTransitiveNativeCoverage: 'NOT_MEASURED' };
}

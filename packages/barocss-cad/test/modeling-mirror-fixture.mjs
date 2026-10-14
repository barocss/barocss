import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chamferPart } from './modeling-chamfer-chain-fixture.mjs';
import { prove as proveConvex } from './modeling-intersection-fixture.mjs';
import { binary64 } from './stored-circle-prism-solid-fixture.mjs';
import { signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData, hold, unchanged } from './modeling-translation-fixture.mjs';
import { constrainedGusset, authoredDocument as gussetDocument, proveSketch } from './modeling-gusset-fixture.mjs';
import { PRISM_COUNTS } from './modeling-offset-fixture.mjs';
export { signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData, hold, unchanged };

// Frozen #1962 campaign: seven public evaluations and two previews only.
export const DEFAULTS = Object.freeze({ frontDistance: 1, backDistance: 2, backY: 24 });
export const EDITED = Object.freeze({ ...DEFAULTS, backDistance: 3 });
export const EXPECTED_CAMPAIGN = Object.freeze({ modelCalls: 7, sourceModelCalls: 6, coldModelCalls: 1,
  tessellations: 2, prisms: 4, firstChamfers: 2, secondChamfers: 4, parentValidations: 6,
  initialTargetFaces: 44, targetQualifications: 6, selectionRefusals: 1,
  massQueries: 0, exports: 0, cpuBufferPreparations: 0, standaloneValidators: 0,
  knownSourceCompilations: 402, combinedBindingObservations: 4896, knownD1: 14688,
  returnedLedgerSourceCompilations: 354, returnedLedgerBindingObservations: 4320, returnedLedgerD1: 12960,
  fullTransitiveNativeCoverage: 'NOT_MEASURED' });
export function mirroredRail(cad) {
  const chain = chamferPart(cad), mirrored = chain.part.mirror({ plane: 'xz' });
  return { ...chain, mirrored, build: () => chain.model.build({ original: chain.part, mirrored }) };
}
export function mirroredRectangle(cad) {
  const model = cad.model(), original = model.sketch.rectangle({ width: 32, height: 24 }).extrude(8, { from: 3 });
  const mirrored = original.mirror({ plane: 'xy' });
  return { build: () => model.build({ original, mirrored }) };
}
export function mirroredGusset(cad) {
  const chain = constrainedGusset(cad), mirrored = chain.gusset.mirror({ plane: 'yz' });
  return { ...chain, mirrored, build: () => chain.model.build({ original: chain.gusset, mirrored }) };
}
export function authoredDocument(parameters = DEFAULTS, variant = 'rail') {
  const p = parameter => ({ parameter });
  const original = variant === 'gusset' ? gussetDocument() :
    { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: variant === 'rail' ? { ...parameters } : {}, nodes: [
      { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [32, 24] }, { kind: 'extrude', sketch: 0, height: 8, ...(variant === 'rectangle' ? { from: 3 } : {}) },
      ...(variant === 'rail' ? [
        { kind: 'chamfer', parent: { node: 1, side: 'solid' }, edge: { parallelTo: 'x', at: { y: 0, z: 'max' } }, distance: p('frontDistance') },
        { kind: 'chamfer', parent: { node: 2, side: 'solid' }, edge: { parallelTo: 'x', at: { y: p('backY'), z: 'max' } }, distance: p('backDistance') },
      ] : []) ] };
  const parent = original.nodes.length - 1, plane = variant === 'rail' ? 'xz' : variant === 'rectangle' ? 'xy' : 'yz';
  return { ...original, nodes: [...original.nodes, { kind: 'mirror', parent: { node: parent, side: 'solid' }, plane }],
    outputs: { original: { node: parent, side: 'solid' }, mirrored: { node: parent + 1, side: 'solid' } } };
}
export function work(snapshot, reused, evaluated, previous) {
  exactData(snapshot.recomputation, { reusedFeatures: reused, evaluatedFeatures: evaluated });
  exactData([...reused, ...evaluated].sort(), snapshot.features.map((_, i) => i));
  const kinds = snapshot.features.length === 5 ? ['sketch', 'extrude', 'chamfer', 'chamfer', 'mirror'] : ['sketch', 'extrude', 'mirror'];
  exactData(snapshot.features, kinds.map((kind, index) => ({ kind, index, dependencies: index ? [index - 1] : [] })));
  if (previous) {
    for (const key of ['parameters', 'evidence', 'bodies']) assert.notEqual(snapshot[key], previous[key]);
    for (const i of reused) assert.equal(snapshot.evidence[i], previous.evidence[i]);
    for (const i of evaluated) assert.notEqual(snapshot.evidence[i], previous.evidence[i]);
    assert.notEqual(snapshot.bodies.original, previous.bodies.original); assert.notEqual(snapshot.bodies.mirrored, previous.bodies.mirrored);
  }
  deepFrozen(snapshot);
}
// Independent reflection and directed-cycle oracles; no production helper.
export const MAPS = Object.freeze({ xy: [1,2,-3], xz: [1,-2,3], yz: [-1,2,3] });
export const mappedPoint = (point, spec) => MAPS[spec.plane].map(component => component > 0 ? point[component - 1] : -point[-component - 1]);
export const reverseAnchoredCycle = values => [values[0], ...values.slice(1).reverse()];
const flipped = sense => sense === 'forward' ? 'reverse' : 'forward';
// Independent represented-binary64 rational oracle for each admitted campaign body.
const fraction = v => ({ n: BigInt(v.numerator), d: BigInt(v.denominator) });
const equal = (a, b) => assert.equal(a.n * b.d, b.n * a.d);
const sorted = values => values.map(signedData).sort();
const faceRef = a => ({ sourceId: a.sourceId, faceId: a.face.options.faceId, surfaceId: a.face.plane.id,
  loopId: a.face.loop.id, evaluationId: a.face.options.evaluationId });
const local = (face, field, id) => ({ sourceId: face.sourceId, faceId: face.faceId, [field]: id });
const faceAt = (solid, ref) => { const a = solid.request.assets.find(a => a.sourceId === ref.sourceId); assert.ok(a); assert.equal(a.face.options.faceId, ref.faceId); return a.face; };
function point(actual, original, spec, coefficients = true) {
  if (coefficients) exactData(actual, mappedPoint(original, spec));
  exactData([actual.length, original.length], [3,3]);
  actual.forEach((v, i) => { equal(binary64(v), binary64(mappedPoint(original, spec)[i])); assert.ok(Math.abs(v) <= 10000); });
}
function mirroredFraction(values, spec) {
  return MAPS[spec.plane].map(component => { const v = fraction(values[Math.abs(component)-1]); return component > 0 ? v : { n: -v.n, d: v.d }; });
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
  exactData(sorted(entries.map(e => e.original)), sorted(a)); exactData(sorted(entries.map(e => e.mirrored)), sorted(b));
  assert.equal(new Set(entries.map(e => signedData(e.original))).size, entries.length);
  assert.equal(new Set(entries.map(e => signedData(e.mirrored))).size, entries.length);
  return new Map(entries.map(e => [signedData(e.original), e.mirrored]));
}
export function proveMirror(native, original, spec) {
  exactData(native.request.parent, original); assert.notEqual(native.request.parent, original); exactData(native.request.spec, spec);
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
  const F = parent.request.assets.length, U = parent.request.assets.reduce((sum, a) => sum + a.face.topology.loop.uses.length, 0);
  exactData(['faces', 'curves', 'uses', 'pcurves', 'localEdges', 'localVertices', 'edges', 'vertices'].map(k => lineage[k].length), [F, U, U, U, U, U, parent.graph.edges.length, parent.graph.vertices.length]);
  const mapped = (kind, ref) => { const value = maps[kind].get(signedData(ref)); assert.ok(value); return value; };
  const id = (kind, ref, field, value) => mapped(kind, local(ref, field, value))[field];
  const globalId = (kind, field, value) => mapped(kind, { [field]: value })[field];
  const mappedUse = use => {
    const asset = parent.request.assets.find(a => a.sourceId === use.sourceId); assert.ok(asset);
    const next = mapped('uses', local(faceRef(asset), 'useId', use.useId)); return { sourceId: next.sourceId, useId: next.useId };
  };
  const namespaceIds = solid => [solid.request.options.solidId, solid.request.options.resultIdPrefix,
    ...solid.graph.edges.map(e => e.id), ...solid.graph.vertices.map(v => v.id),
    ...solid.request.assets.flatMap(({ sourceId, face }) => [sourceId, face.plane.id, face.loop.id, face.options.faceId,
      face.options.evaluationId, face.options.resultIdPrefix, ...face.loop.edges.map(c => c.id), ...face.pcurves.map(p => p.id),
      ...face.topology.loop.uses.map(u => u.id), ...face.topology.edges.map(e => e.id), ...face.topology.vertices.map(v => v.id)])];
  const namespaces = new Set(namespaceIds(parent)), targetIds = namespaceIds(target);
  assert.equal(new Set(targetIds).size, targetIds.length, 'all allocated target namespace identities are unique');
  assert.ok(targetIds.every(id => !namespaces.has(id)), 'complete target namespace is independent');
  for (const link of lineage.faces) {
    const before = faceAt(parent, link.original), after = faceAt(target, link.mirrored);
    for (const key of Object.keys(link.original)) assert.notEqual(link.original[key], link.mirrored[key]);
    completeSource(before); completeSource(after); exactData(after.options.orientation, flipped(before.options.orientation));
    exactData(after.topology.face.orientation, flipped(before.topology.face.orientation));
    assert.equal(after.bindings.length, before.bindings.length);
    for (const binding of before.bindings) {
      const mappedUseId = id('uses', link.original, 'useId', binding.useId);
      const matches = after.bindings.filter(next => next.useId === mappedUseId && next.parameter === binding.parameter);
      assert.equal(matches.length, 1); const next = matches[0];
      assert.equal(next.traversalSense, flipped(binding.traversalSense));
      const expected = mappedPoint(binding.orientedFaceNormal, spec);
      next.orientedFaceNormal.forEach((v, j) => equal(binary64(v), binary64(expected[j])));
      assert.ok(Number.isFinite(next.pointDifferenceMM) && next.pointDifferenceMM <= after.report.numericPolicy.pointBindingComparisonMM);
      assert.ok(Number.isFinite(next.tangentDifferenceMM));
      for (const field of ['orientedLineTangentMM','orientedSurfaceChainTangentMM']) { const tangent = mappedPoint(binding[field],spec).map(v=>-v); next[field].forEach((v,j)=>equal(binary64(v),binary64(tangent[j]))); }
      assert.equal(next.curveId, id('curves', link.original, 'curveId', binding.curveId));
      assert.equal(next.edgeId, id('localEdges', link.original, 'edgeId', binding.edgeId));
      assert.equal(next.pcurveId, id('pcurves', link.original, 'pcurveId', binding.pcurveId));
    }
    exactData(after.report.numericPolicy, before.report.numericPolicy);
    for (const field of ['kind', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'weights']) exactData(after.plane[field], before.plane[field]);
    exactData(after.plane.controlPoints.map(r => r.length), before.plane.controlPoints.map(r => r.length));
    before.plane.controlPoints.forEach((row, i) => row.forEach((p, j) => point(after.plane.controlPoints[i][j], p, spec)));
    exactData(after.loop.edges.map(c => c.id), before.loop.edges.map(c => id('curves', link.original, 'curveId', c.id)));
    exactData(after.topology.loop.uses.map(u => u.id), before.topology.loop.uses.map(u => id('uses', link.original, 'useId', u.id)).reverse());
    const a = parent.supports.find(s => s.sourceId === link.original.sourceId), b = target.supports.find(s => s.sourceId === link.mirrored.sourceId); assert.ok(a && b);
    for (let i = 0; i < 3; i++) { equal(fraction(b.outwardNormal[i]), mirroredFraction(a.outwardNormal, spec)[i]); equal(fraction(b.originMM[i]), mirroredFraction(a.originMM, spec)[i]); }
    equal(fraction(b.offset), fraction(a.offset));
  }
  for (const [kind, field, key] of inventories) for (const link of lineage[kind]) {
    const before = field(faceAt(parent, link.original)).find(item => item.id === link.original[key]);
    const after = field(faceAt(target, link.mirrored)).find(item => item.id === link.mirrored[key]); assert.ok(before && after); assert.notEqual(before.id, after.id);
    if (kind === 'curves') {
      for (const field of ['kind', 'degree', 'knots', 'weights']) exactData(after[field], before[field]);
      assert.ok(before.knots[before.degree] < before.knots[before.knots.length-before.degree-1]);
      exactData([after.knots[after.degree],after.knots[after.knots.length-after.degree-1]],[before.knots[before.degree],before.knots[before.knots.length-before.degree-1]]);
      assert.equal(after.controlPoints.length, before.controlPoints.length); before.controlPoints.forEach((p, i) => point(after.controlPoints[i], p, spec));
    }
    if (kind === 'localVertices') point(after.point, before.point, spec, false);
    if (kind === 'uses') { exactData(after.interval, [...before.interval].reverse()); assert.equal(after.sense, flipped(before.sense)); }
    if (kind === 'pcurves') { assert.ok(before.domain[0] < before.domain[1]); assert.ok(after.domain[0] < after.domain[1]); exactData(after.domain, before.domain); for (const field of ['degree', 'knots', 'weights']) exactData(after.curve[field], before.curve[field]); assert.notEqual(after.curve, before.curve); }
    for (const [name, refField] of [['curves', 'curveId'], ['localEdges', 'edgeId'], ['pcurves', 'pcurveId']]) {
      if (Object.hasOwn(before, refField)) assert.equal(after[refField], id(name, link.original, refField, before[refField]));
    }
    if (before.vertexIds) { const expected = before.vertexIds.map(value => id('localVertices', link.original, 'vertexId', value)); exactData(after.vertexIds, kind === 'uses' ? expected.reverse() : expected); }
  }
  exactData(target.request.edgePairs, parent.request.edgePairs.map(pair => ({ a: mappedUse(pair.a), b: mappedUse(pair.b) })));
  for (const link of lineage.edges) {
    const a = parent.graph.edges.find(e => e.id === link.original.edgeId), b = target.graph.edges.find(e => e.id === link.mirrored.edgeId); assert.ok(a && b);
    assert.notEqual(a.id, b.id); exactData(b.parameterMapAtoB, a.parameterMapAtoB); assert.equal(b.pairIndex, a.pairIndex);
    exactData(b.vertexIds, a.vertexIds.map(v => globalId('vertices', 'vertexId', v)).reverse());
    exactData(b.uses.map(u => ({ sourceId: u.sourceId, useId: u.use.id })), a.uses.map(u => mappedUse({ sourceId: u.sourceId, useId: u.use.id })));
  }
  for (const link of lineage.vertices) {
    const a = parent.graph.vertices.find(v => v.id === link.original.vertexId), b = target.graph.vertices.find(v => v.id === link.mirrored.vertexId); assert.ok(a && b);
    assert.notEqual(a.id, b.id); point(b.pointMM, a.pointMM, spec, false); exactData(sorted(b.members), sorted(a.members.map(m => mapped('localVertices', m))));
  }
  const mappedFace = f => { const a = parent.request.assets.find(a => a.sourceId === f.sourceId && a.face.options.faceId === f.faceId); assert.ok(a); return mapped('faces', faceRef(a)); };
  for (const a of parent.graph.faces) {
    const ref = mappedFace(a), b = target.graph.faces.find(f => f.sourceId === ref.sourceId && f.faceId === ref.faceId); assert.ok(b);
    assert.equal(b.surfaceId, ref.surfaceId); assert.equal(b.loopId, ref.loopId);
    exactData(b.vertexIds, reverseAnchoredCycle(a.vertexIds.map(v => globalId('vertices', 'vertexId', v)))); exactData(b.edgeIds, a.edgeIds.map(e => globalId('edges', 'edgeId', e)).reverse());
  }
  assert.equal(target.graph.vertexLinks.length, parent.graph.vertexLinks.length);
  for (const a of parent.graph.vertexLinks) {
    const b = target.graph.vertexLinks.find(v => v.vertexId === globalId('vertices', 'vertexId', a.vertexId)); assert.ok(b);
    exactData(b.cycleEdgeIds, reverseAnchoredCycle(a.cycleEdgeIds.map(e => globalId('edges', 'edgeId', e))));
    exactData(b.arcs, a.arcs.map(arc => { const f = mappedFace(arc); return { sourceId: f.sourceId, faceId: f.faceId,
      fromEdgeId: globalId('edges', 'edgeId', arc.toEdgeId), toEdgeId: globalId('edges', 'edgeId', arc.fromEdgeId) }; }));
  }
  for (let i = 0; i < 3; i++) equal(fraction(target.certificate.strictInteriorMM[i]), mirroredFraction(parent.certificate.strictInteriorMM, spec)[i]);
  const r = native.report; assert.equal(r.schema, 'barocss-modeling-mirror'); assert.equal(r.version,0); assert.equal(r.lengthUnit,'mm'); assert.equal(r.solid,true);
  assert.equal(r.determinant,-1); assert.equal(r.orientationFlipCount,F);
  exactData(r.preservation, Object.fromEntries(['completeParent','cardinalPlaneReflection','signedCoefficientBits','basisAndWeightBits','directedDomainBits','reversedDirectedTraversal','exactParameterMaps','bijectiveLineage','exactMirroredNormals','exactMirroredSupportsAndVertices','supportOffsetsUnchanged','exactVolumeUnchanged','independentSourceNamespaces'].map(key => [key,true])));
  exactData(r.limits,{faces:10,directedUses:48,pairs:24,vertices:16,coordinateAbsMM:10000,rationalOperations:200000,integerBits:8192});
  assert.equal(r.numericPolicy,'exact-rationals-of-stored-binary64-no-welding-no-tolerance-promotion'); assert.equal(r.validationScope,'whole-result-self-consistency-not-authenticity'); assert.equal(r.persistentNamingCertified,false);
  assert.equal(r.dataCharge,'unchanged-solid-snapshot-ledger-alias-occurrences-not-v8-heap');
  exactData(r.parentValidation, parent.report); exactData(r.targetQualification, target.report);
  exactData(r.directCalls, { parentValidationCount: 1, initialFaceConstructionCount: F, targetQualificationCount: 1, retries: 0 });
  for (const report of [r.parentValidation.childNativeWork, r.targetQualification.childNativeWork, r.initialFaceConstruction]) count(report, [F, 3 * U, 9 * U]);
  exactData([r.initialFaceConstruction.faceCount, r.initialFaceConstruction.curveD1Count, r.initialFaceConstruction.pcurveD1Count, r.initialFaceConstruction.surfaceD1Count], [F, 3 * U, 3 * U, 3 * U]);
  assert.ok(r.exactWork.operations > 0 && r.exactWork.operations <= 200000); assert.ok(r.exactWork.maximumObservedBits <= 8192); deepFrozen(native);
  return { fullSourceAdoption: true, bijectiveLocalAndGlobalLineage: true, exactCoordinatesNormalsSupportsAndVolume: true,
    preservedBasisWeightDomainAndSignedCoefficientBits: true, regeneratedNativePcurves: true, lineageSHA256: dataHash(lineage), nativeSHA256: dataHash(native) };
}

export function proveSnapshot(snapshot, parameters = DEFAULTS, variant = 'rail') {
  const document = authoredDocument(parameters, variant);
  assert.equal(snapshot.save(), signedData(document) + '\n'); exactData(snapshot.parameters, document.parameters);
  exactData(snapshot.suppression, {}); exactData(Object.keys(snapshot.bodies).sort(), ['mirrored', 'original']);
  exactData(snapshot.evidence.map(e => e.kind), document.nodes.map(n => n.kind));
  const mirror = snapshot.evidence.at(-1).native, original = snapshot.bodies.original.native, mirrored = snapshot.bodies.mirrored.native;
  for (const body of Object.values(snapshot.bodies)) assert.equal(body.family, 'convex-planar');
  const volume = variant === 'rail' ? 6144 - 16 * parameters.frontDistance ** 2 - 16 * parameters.backDistance ** 2 : variant === 'rectangle' ? 6144 : 6912;
  const sizes = variant === 'rail' ? [8,18,12] : [6,12,8];
  proveConvex(original, volume, sizes); proveConvex(mirrored, volume, sizes);
  assert.equal(mirrored, mirror.solid);
  const prism = snapshot.evidence[1].native; exactData(prism.report.childNativeWork, PRISM_COUNTS);
  exactData(prism.request.sketch, snapshot.evidence[0].native);
  const caps = [];
  if (variant === 'rail') {
    const [first, second] = snapshot.evidence.slice(2,4).map(e => e.native);
    exactData(first.split.request.parent, prism.solid); exactData(second.split.request.parent, first.split.negative.solid);
    assert.equal(original, second.split.negative.solid);
    for (const [i, feature] of [first,second].entries()) {
      const removed = 16 * [parameters.frontDistance, parameters.backDistance][i] ** 2;
      exactData(feature.metric.removedVolumeMM3, { numerator: String(removed), denominator: '1' });
      assert.equal(feature.split.report.volumeMM3.conserved, true);
      proveConvex(feature.split.positive.solid, removed, [5,9,6]);
      proveConvex(feature.split.negative.solid, i ? volume : 6144-removed, [7+i,15+3*i,10+2*i]);
    }
    const firstCap = first.split.lineage.faces.find(f => f.side === 'negative' && f.role === 'cap').output;
    const retained = second.split.lineage.faces.filter(f => f.side === 'negative' && f.parent?.sourceId === firstCap.sourceId && f.parent.faceId === firstCap.faceId);
    assert.equal(retained.length, 1); assert.equal(retained[0].role, 'retained');
    const back = second.split.lineage.faces.find(f => f.side === 'negative' && f.role === 'cap');
    assert.equal(back.key, second.lineage.chamferFaceKey);
    for (const cap of [retained[0].output,back.output]) {
      faceAt(original,cap); const mapping = mirror.lineage.faces.find(f => f.original.sourceId === cap.sourceId && f.original.faceId === cap.faceId);
      assert.ok(mapping); faceAt(mirrored,mapping.mirrored); caps.push({ parent:cap,mirrored:mapping.mirrored });
    }
    assert.notEqual(caps[0].parent.sourceId,caps[1].parent.sourceId);
  } else { assert.equal(original,prism.solid); if (variant === 'gusset') proveSketch(snapshot.evidence[0].native); }
  const spec = { plane: document.nodes.at(-1).plane };
  const mirrorProof = proveMirror(mirror,original,spec);
  const bounds = points => ({ min: [0,1,2].map(i => Math.min(...points.map(p => p[i]))), max: [0,1,2].map(i => Math.max(...points.map(p => p[i]))) });
  const expectedBounds = bounds(original.graph.vertices.map(v => mappedPoint(v.pointMM,spec)));
  const actualBounds = bounds(mirrored.graph.vertices.map(v => v.pointMM));
  if (variant === 'rectangle') { exactData(document.nodes[1].from,3); const originalBounds = bounds(original.graph.vertices.map(v => v.pointMM)); exactData([originalBounds.min[2],originalBounds.max[2]],[3,11]); exactData([expectedBounds.min[2],expectedBounds.max[2]],[-11,-3]); }
  for (const side of ['min','max']) for (let i=0;i<3;i++) equal(binary64(actualBounds[side][i]), binary64(expectedBounds[side][i]));
  deepFrozen(snapshot);
  return { volumesMM3: { original:volume,mirrored:volume }, boundsMM: { original:bounds(original.graph.vertices.map(v => v.pointMM)),mirrored:actualBounds }, independentlyMirroredParentBoundsMM:expectedBounds, caps,
    mirror: mirrorProof, authoredSHA256:sha256(snapshot.save()),bodiesSHA256:dataHash(snapshot.bodies),evidenceSHA256:dataHash(snapshot.evidence),snapshotSHA256:dataHash(snapshotData(snapshot)) };
}
export function proveRefusal(error, CadModelError) {
  assert.ok(error instanceof CadModelError); assert.equal(error.code,'SELECTION'); assert.equal(error.operation,'chamfer');
  assert.match(error.message,/matched 0/); assert.equal(error.cause,undefined);
  for (const key of ['solid','bodies','evidence','lineage']) assert.equal(Object.hasOwn(error,key),false);
  return { code:error.code, operation:error.operation, matched:0, noNewNativeGeometry:true };
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
export const emptyLedgers = () => ({ sketches:[],prisms:[],firstChamfers:[],secondChamfers:[],parents:[],targets:[],initialFaces:[],previews:[] });
export function collectLedgers(ledgers,snapshot,label) {
  for (const index of snapshot.recomputation.evaluatedFeatures) {
    const e=snapshot.evidence[index], entry=report=>({label,index,report});
    if(e.kind==='sketch')ledgers.sketches.push(entry(e.native.report));
    if(e.kind==='extrude')ledgers.prisms.push(entry(e.native.report.childNativeWork));
    if(e.kind==='chamfer')ledgers[index===2?'firstChamfers':'secondChamfers'].push(entry(e.native.report.nativeWork));
    if(e.kind==='mirror') { ledgers.parents.push(entry(e.native.report.parentValidation.childNativeWork)); ledgers.targets.push(entry(e.native.report.targetQualification.childNativeWork)); ledgers.initialFaces.push(entry(e.native.report.initialFaceConstruction)); }
  }
}
export function accounting(ledgers,counts) {
  exactData(Object.keys(ledgers).map(k=>ledgers[k].length),counts);
  const values=entries=>entries.reduce((sum,{report})=>sum.map((v,i)=>v+report[(Object.hasOwn(report,'totalSourceCompilations')?['totalSourceCompilations','bindingObservations','totalD1']:['sourceCompilationCount','bindingObservationCount','totalD1Count'])[i]]),[0,0,0]);
  const returned=values(Object.entries(ledgers).filter(([k])=>k!=='sketches'&&k!=='initialFaces').flatMap(([,v])=>v));
  const initial=values(ledgers.initialFaces),known=returned.map((v,i)=>v+initial[i]+(i===0?ledgers.sketches.length:0));
  return { returnedLedgerSourceCompilations:returned[0],returnedLedgerBindingObservations:returned[1],returnedLedgerD1:returned[2],knownSourceCompilations:known[0],combinedBindingObservations:known[1],knownD1:known[2],initialFaceConstructionCount:ledgers.initialFaces.reduce((sum,{report})=>sum+report.faceCount,0),fullTransitiveNativeCoverage:'NOT_MEASURED' };
}
export const EXPECTED_TOTALS=Object.freeze({returnedLedgerSourceCompilations:354,returnedLedgerBindingObservations:4320,returnedLedgerD1:12960,knownSourceCompilations:402,combinedBindingObservations:4896,knownD1:14688,initialFaceConstructionCount:44,fullTransitiveNativeCoverage:'NOT_MEASURED'});
// Shared finite recorder for the two actual processes. Merely importing it does
// no CAD work or file writes. Raw results are persisted before any test oracle.
export function recorder(mode, entry, directory, source) {
  assert.equal(Number(process.versions.node.split('.')[0]), 22); assert.ok(process.execArgv.includes('--no-opt'));
  assert.match([...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' '), /--max[-_]old[-_]space[-_]size(?:=|\s+)1536(?:\s|$)/);
  assert.equal(process.argv.length, 2); assert.ok(mode === 'source' || mode === 'cold');
  mkdirSync(directory, { recursive: true });
  const started = performance.now(), receipt = resolve(directory, mode + '-flow.json');
  const flow = { status: 'running', issue: 1962, mode, processId: process.pid, processInstanceId: randomUUID(), nodeVersion: process.version,
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
    budget(); assert.ok(flow[kind] < (kind === 'modelCalls' ? mode === 'source' ? 6 : 1 : mode === 'source' ? 2 : 0));
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

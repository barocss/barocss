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
import { proveTranslation, composeLineage } from './modeling-rotation-placement-fixture.mjs';
export { signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData, hold, unchanged };

// Frozen #2015: source7/cold1 public models and exactly two real previews.
export const DEFAULTS = Object.freeze({ frontDistance: 1, backDistance: 2, backY: 24, pivotY: 12 });
export const EDITED = Object.freeze({ ...DEFAULTS, pivotY: 20 });
export const EXPECTED_TOTALS = Object.freeze({ returnedLedgerSourceCompilations: 402, returnedLedgerBindingObservations: 4914,
  returnedLedgerD1: 14742, knownSourceCompilations: 467, combinedBindingObservations: 5706, knownD1: 17118,
  initialFaceConstructionCount: 60, fullTransitiveNativeCoverage: 'NOT_MEASURED' });
export const SOURCE_TOTALS = Object.freeze({ returnedLedgerSourceCompilations: 308, returnedLedgerBindingObservations: 3780,
  returnedLedgerD1: 11340, knownSourceCompilations: 364, combinedBindingObservations: 4464, knownD1: 13392,
  initialFaceConstructionCount: 52, fullTransitiveNativeCoverage: 'NOT_MEASURED' });
export const COLD_TOTALS = Object.freeze({ returnedLedgerSourceCompilations: 94, returnedLedgerBindingObservations: 1134,
  returnedLedgerD1: 3402, knownSourceCompilations: 103, combinedBindingObservations: 1242, knownD1: 3726,
  initialFaceConstructionCount: 8, fullTransitiveNativeCoverage: 'NOT_MEASURED' });
export const SOURCE_LEDGER_COUNTS = Object.freeze([4,4,2,2,8,7,7,2]);
export const COLD_LEDGER_COUNTS = Object.freeze([1,1,1,1,1,1,1,0]);
export const CAMPAIGN_LEDGER_COUNTS = Object.freeze([5,5,3,3,9,8,8,2]);
export const EXPECTED_CAMPAIGN = Object.freeze({ modelCalls: 8, sourceModelCalls: 7, coldModelCalls: 1, tessellations: 2,
  prisms: 5, sketches: 5, firstChamfers: 3, secondChamfers: 3, parentValidations: 9,
  initialTargetFaces: 60, targetQualifications: 8, acceptedRotations: 7, acceptedTranslations: 1, representabilityRefusals: 1,
  massQueries: 0, exports: 0, cpuBufferPreparations: 0, standaloneValidators: 0, ...EXPECTED_TOTALS });
export function pivotedRail(cad, placed = false) {
  const chain = chamferPart(cad), pivotY = chain.model.parameter('pivotY',12);
  const rotated = chain.part.rotate({ axis: 'x', angleDegrees: 90, pivot: [16,pivotY,4] });
  const placement = placed ? rotated.translate([40,16,0]) : undefined;
  return { ...chain, rotated, ...(placed ? { placed: placement } : {}),
    build: () => chain.model.build({ original: chain.part, rotated, ...(placed ? { placed: placement } : {}) }) };
}
export function pivotedRectangle(cad) {
  const model = cad.model(), original = model.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
  const rotated = original.rotate({ axis: 'y', angleDegrees: 180, pivot: [16,0,4] });
  return { model, original, rotated, build: () => model.build({ original, rotated }) };
}
export function pivotedGusset(cad) {
  const chain = constrainedGusset(cad), rotated = chain.gusset.rotate({ axis: 'z', angleDegrees: 270, pivot: [20,12,0] });
  return { ...chain, rotated, build: () => chain.model.build({ original: chain.gusset, rotated }) };
}
export function authoredDocument(parameters = DEFAULTS, variant = 'rail') {
  const p = parameter => ({ parameter }), rail = variant === 'rail' || variant === 'placed';
  const original = variant === 'gusset' ? gussetDocument() : {
    format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: rail ? { ...parameters } : {}, nodes: [
      { kind: 'sketch', profile: 'rectangle', min: [0,0], max: [32,24] }, { kind: 'extrude', sketch: 0, height: 8 },
      ...(rail ? [
        { kind: 'chamfer', parent: { node: 1, side: 'solid' }, edge: { parallelTo: 'x', at: { y: 0, z: 'max' } }, distance: p('frontDistance') },
        { kind: 'chamfer', parent: { node: 2, side: 'solid' }, edge: { parallelTo: 'x', at: { y: p('backY'), z: 'max' } }, distance: p('backDistance') },
      ] : []) ] };
  const parent = original.nodes.length-1, axis = rail ? 'x' : variant === 'rectangle' ? 'y' : 'z';
  const angleDegrees = rail ? 90 : variant === 'rectangle' ? 180 : 270;
  const pivot = rail ? [16,p('pivotY'),4] : variant === 'rectangle' ? [16,0,4] : [20,12,0];
  return { ...original, nodes: [...original.nodes, { kind: 'rotate', parent: { node: parent, side: 'solid' }, axis, angleDegrees, pivot },
    ...(variant === 'placed' ? [{ kind: 'translate', parent: { node: parent+1, side: 'solid' }, offset: [40,16,0] }] : [])],
    outputs: { original: { node: parent, side: 'solid' }, rotated: { node: parent+1, side: 'solid' },
      ...(variant === 'placed' ? { placed: { node: parent+2, side: 'solid' } } : {}) } };
}
export function work(snapshot, reused, evaluated, previous) {
  exactData(snapshot.recomputation, { reusedFeatures: reused, evaluatedFeatures: evaluated });
  exactData([...reused,...evaluated].sort(), snapshot.features.map((_,i) => i));
  const kinds = snapshot.features.length >= 5 ? ['sketch','extrude','chamfer','chamfer','rotate',
    ...(snapshot.features.length === 6 ? ['translate'] : [])] : ['sketch','extrude','rotate'];
  exactData(snapshot.features, kinds.map((kind,index) => ({ kind,index,dependencies:index ? [index-1] : [] })));
  if (previous) {
    for (const field of ['parameters','evidence','bodies']) assert.notEqual(snapshot[field], previous[field]);
    for (const i of reused) assert.equal(snapshot.evidence[i],previous.evidence[i]);
    for (const i of evaluated) assert.notEqual(snapshot.evidence[i],previous.evidence[i]);
    assert.equal(snapshot.bodies.original,previous.bodies.original); assert.notEqual(snapshot.bodies.rotated,previous.bodies.rotated);
  }
  deepFrozen(snapshot);
}
// Independent oracle table. No production map helper is used here.
export const MAPS = Object.freeze({ x: { 90: [1,-3,2], 180: [1,-2,-3], 270: [1,3,-2] },
  y: { 90: [3,2,-1], 180: [-1,2,-3], 270: [-3,2,1] }, z: { 90: [-2,1,3], 180: [-1,-2,3], 270: [2,-1,3] } });
export const mappedPoint = (point, spec) => MAPS[spec.axis][spec.degrees].map(component => component > 0 ? point[component - 1] : -point[-component - 1]);
// Independent represented-binary64 rational oracle for each admitted campaign body.
const fraction = v => ({ n: BigInt(v.numerator), d: BigInt(v.denominator) });
const add = (a,b) => ({ n:a.n*b.d+b.n*a.d, d:a.d*b.d });
const subtract = (a,b) => ({ n:a.n*b.d-b.n*a.d, d:a.d*b.d });
const multiply = (a,b) => ({ n:a.n*b.n, d:a.d*b.d });
const dot = (a,b) => a.reduce((sum,v,i) => add(sum,multiply(v,b[i])),{n:0n,d:1n});
export const pivotOffsets = (spec,pivot) => MAPS[spec.axis][spec.degrees].map((component,i) => subtract(binary64(pivot[i]),binary64(component>0?pivot[component-1]:-pivot[-component-1])));
const equal = (a, b) => assert.equal(a.n * b.d, b.n * a.d);
const sorted = values => values.map(signedData).sort();
const faceRef = a => ({ sourceId: a.sourceId, faceId: a.face.options.faceId, surfaceId: a.face.plane.id,
  loopId: a.face.loop.id, evaluationId: a.face.options.evaluationId });
const local = (face, field, id) => ({ sourceId: face.sourceId, faceId: face.faceId, [field]: id });
const faceAt = (solid, ref) => { const a = solid.request.assets.find(a => a.sourceId === ref.sourceId); assert.ok(a); assert.equal(a.face.options.faceId, ref.faceId); return a.face; };
function point(actual, original, spec, pivotMM, coefficients = true, extra = [0,0,0]) {
  const rotated = mappedPoint(original,spec), offsets = pivotOffsets(spec,pivotMM);
  exactData([actual.length,original.length],[3,3]);
  actual.forEach((value,i) => {
    const expected = add(add(binary64(rotated[i]),offsets[i]),binary64(extra[i]));
    equal(binary64(value),expected); assert.ok(Math.abs(value)<=10000);
    if (coefficients && extra[i] === 0) {
      if (offsets[i].n === 0n) assert.ok(Object.is(value,rotated[i]),'zero affine offset preserves signed coefficient bits');
      else if (expected.n === 0n) assert.ok(Object.is(value,0),'nonzero cancellation is positive zero');
    }
  });
}
function rotatedFraction(values, spec) {
  return MAPS[spec.axis][spec.degrees].map(component => { const v = fraction(values[Math.abs(component)-1]); return component > 0 ? v : { n: -v.n, d: v.d }; });
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
  exactData(sorted(entries.map(e => e.original)), sorted(a)); exactData(sorted(entries.map(e => e.rotated)), sorted(b));
  assert.equal(new Set(entries.map(e => signedData(e.original))).size, entries.length);
  assert.equal(new Set(entries.map(e => signedData(e.rotated))).size, entries.length);
  return new Map(entries.map(e => [signedData(e.original), e.rotated]));
}
export function provePivot(native, original, spec, pivotMM) {
  exactData(native.request.parent, original); assert.notEqual(native.request.parent, original); exactData(native.request.spec, spec); exactData(native.request.pivotMM,pivotMM);
  exactData(Object.keys(native.request),['parent','spec','prefix','pivotMM']); const offsets=pivotOffsets(spec,pivotMM);
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
    const before = faceAt(parent, link.original), after = faceAt(target, link.rotated);
    for (const key of Object.keys(link.original)) assert.notEqual(link.original[key], link.rotated[key]);
    completeSource(before); completeSource(after); exactData(after.options.orientation, before.options.orientation);
    assert.equal(after.bindings.length, before.bindings.length);
    before.bindings.forEach((binding, i) => {
      exactData(after.bindings[i].parameter, binding.parameter);
      for (const key of ['orientedFaceNormal', 'normal']) if (binding[key]) {
        const expected = mappedPoint(binding[key], spec);
        after.bindings[i][key].forEach((v, j) => assert.ok(v === expected[j], 'normal direction (native arithmetic may choose zero sign)'));
      }
    });
    for (const field of ['kind', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'weights']) exactData(after.plane[field], before.plane[field]);
    exactData(after.plane.controlPoints.map(r => r.length), before.plane.controlPoints.map(r => r.length));
    before.plane.controlPoints.forEach((row, i) => row.forEach((p, j) => point(after.plane.controlPoints[i][j], p, spec, pivotMM)));
    exactData(after.loop.edges.map(c => c.id), before.loop.edges.map(c => id('curves', link.original, 'curveId', c.id)));
    exactData(after.topology.loop.uses.map(u => u.id), before.topology.loop.uses.map(u => id('uses', link.original, 'useId', u.id)));
    const a = parent.supports.find(s => s.sourceId === link.original.sourceId), b = target.supports.find(s => s.sourceId === link.rotated.sourceId); assert.ok(a && b);
    for (let i = 0; i < 3; i++) { equal(fraction(b.outwardNormal[i]), rotatedFraction(a.outwardNormal, spec)[i]); equal(fraction(b.originMM[i]), add(rotatedFraction(a.originMM, spec)[i],offsets[i])); }
    equal(fraction(b.offset), add(fraction(a.offset),dot(rotatedFraction(a.outwardNormal,spec),offsets)));
  }
  for (const [kind, field, key] of inventories) for (const link of lineage[kind]) {
    const before = field(faceAt(parent, link.original)).find(item => item.id === link.original[key]);
    const after = field(faceAt(target, link.rotated)).find(item => item.id === link.rotated[key]); assert.ok(before && after); assert.notEqual(before.id, after.id);
    if (kind === 'curves') {
      for (const field of ['kind', 'degree', 'knots', 'weights']) exactData(after[field], before[field]);
      assert.equal(after.controlPoints.length, before.controlPoints.length); before.controlPoints.forEach((p, i) => point(after.controlPoints[i], p, spec, pivotMM));
    }
    if (kind === 'localVertices') point(after.point, before.point, spec, pivotMM, false);
    if (kind === 'uses') { exactData(after.interval, before.interval); assert.equal(after.sense, before.sense); }
    if (kind === 'pcurves') { exactData(after.domain, before.domain); for (const field of ['degree', 'knots', 'weights']) exactData(after.curve[field], before.curve[field]); assert.notEqual(after.curve, before.curve); }
    for (const [name, refField] of [['curves', 'curveId'], ['localEdges', 'edgeId'], ['pcurves', 'pcurveId']]) {
      if (Object.hasOwn(before, refField)) assert.equal(after[refField], id(name, link.original, refField, before[refField]));
    }
    if (before.vertexIds) exactData(after.vertexIds, before.vertexIds.map(value => id('localVertices', link.original, 'vertexId', value)));
  }
  exactData(target.request.edgePairs, parent.request.edgePairs.map(pair => ({ a: mappedUse(pair.a), b: mappedUse(pair.b) })));
  for (const link of lineage.edges) {
    const a = parent.graph.edges.find(e => e.id === link.original.edgeId), b = target.graph.edges.find(e => e.id === link.rotated.edgeId); assert.ok(a && b);
    assert.notEqual(a.id, b.id); exactData(b.parameterMapAtoB, a.parameterMapAtoB); assert.equal(b.pairIndex, a.pairIndex);
    exactData(b.vertexIds, a.vertexIds.map(v => globalId('vertices', 'vertexId', v)));
    exactData(b.uses.map(u => ({ sourceId: u.sourceId, useId: u.use.id })), a.uses.map(u => mappedUse({ sourceId: u.sourceId, useId: u.use.id })));
  }
  for (const link of lineage.vertices) {
    const a = parent.graph.vertices.find(v => v.id === link.original.vertexId), b = target.graph.vertices.find(v => v.id === link.rotated.vertexId); assert.ok(a && b);
    assert.notEqual(a.id, b.id); point(b.pointMM, a.pointMM, spec, pivotMM, false); exactData(sorted(b.members), sorted(a.members.map(m => mapped('localVertices', m))));
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
  for (let i = 0; i < 3; i++) equal(fraction(target.certificate.strictInteriorMM[i]), add(rotatedFraction(parent.certificate.strictInteriorMM, spec)[i],offsets[i]));
  const r = native.report;
  exactData(r.preservation,Object.fromEntries(['completeParent','canonicalSignedPermutation','exactPivotAffineCoefficients',
    'zeroOffsetSignedCoefficientBits','nonzeroCancellationPositiveZero','derivedVerticesExactRational','basisAndWeightBits',
    'directedDomainBits','exactParameterMaps','bijectiveLineage','exactRotatedNormals','exactRotatedSupportsAndVertices',
    'exactAffineSupportOffsets','exactVolumeUnchanged','independentSourceNamespaces'].map(key => [key,true])));
  assert.equal(Object.hasOwn(r.preservation,'supportOffsetsUnchanged'),false);
  assert.equal(Object.hasOwn(r.preservation,'signedCoefficientBits'),false);
  exactData([r.schema,r.version,r.lengthUnit,r.solid],['barocss-modeling-rotation',0,'mm',true]);
  assert.equal(r.numericPolicy,'exact-rationals-of-stored-binary64-no-welding-no-tolerance-promotion');
  assert.equal(r.validationScope,'whole-result-self-consistency-not-authenticity'); assert.equal(r.persistentNamingCertified,false);
  exactData(r.limits,{ faces:10,directedUses:48,pairs:24,vertices:16,coordinateAbsMM:10000,rationalOperations:200000,integerBits:8192 });
  assert.equal(r.dataCharge,'unchanged-solid-snapshot-ledger-alias-occurrences-not-v8-heap');
  exactData(r.parentValidation, parent.report); exactData(r.targetQualification, target.report);
  exactData(r.directCalls, { parentValidationCount: 1, initialFaceConstructionCount: F, targetQualificationCount: 1, retries: 0 });
  for (const report of [r.parentValidation.childNativeWork, r.targetQualification.childNativeWork, r.initialFaceConstruction]) count(report, [F, 3 * U, 9 * U]);
  exactData([r.initialFaceConstruction.faceCount, r.initialFaceConstruction.curveD1Count, r.initialFaceConstruction.pcurveD1Count, r.initialFaceConstruction.surfaceD1Count], [F, 3 * U, 3 * U, 3 * U]);
  assert.ok(r.exactWork.operations > 0 && r.exactWork.operations <= 200000); assert.ok(r.exactWork.maximumObservedBits <= 8192); deepFrozen(native);
  return { fullSourceAdoption: true, bijectiveLocalAndGlobalLineage: true, exactCoordinatesNormalsSupportsAndVolume: true,
    preservedBasisWeightDomainAndExactAffineCoefficients: true, signedZeroPolicy: 'stored coefficients only; derived vertices rational, sampled D1 self-consistency remains Native authority', regeneratedNativePcurves: true, lineageSHA256: dataHash(lineage), nativeSHA256: dataHash(native) };
}

export function proveSnapshot(snapshot, parameters = DEFAULTS, variant = 'rail') {
  const document = authoredDocument(parameters, variant);
  assert.equal(snapshot.save(), signedData(document) + '\n'); exactData(snapshot.parameters, document.parameters);
  exactData(snapshot.suppression, {}); exactData(Object.keys(snapshot.bodies), Object.keys(document.outputs));
  exactData(snapshot.evidence.map(e => e.kind), document.nodes.map(n => n.kind));
  const rail=variant==='rail'||variant==='placed', rotationIndex=rail?4:2;
  const rotation = snapshot.evidence[rotationIndex].native, flat = snapshot.bodies.original.native, upright = snapshot.bodies.rotated.native;
  for (const body of Object.values(snapshot.bodies)) assert.equal(body.family, 'convex-planar');
  const volume = rail ? 6144 - 16 * parameters.frontDistance ** 2 - 16 * parameters.backDistance ** 2 : variant === 'rectangle' ? 6144 : 6912;
  const sizes = rail ? [8,18,12] : [6,12,8];
  proveConvex(flat, volume, sizes); proveConvex(upright, volume, sizes);
  assert.equal(upright, rotation.solid);
  const prism = snapshot.evidence[1].native; exactData(prism.report.childNativeWork, PRISM_COUNTS);
  exactData(prism.request.sketch, snapshot.evidence[0].native);
  const caps = [];
  if (rail) {
    const [first, second] = snapshot.evidence.slice(2,4).map(e => e.native);
    exactData(first.split.request.parent, prism.solid); exactData(second.split.request.parent, first.split.negative.solid);
    assert.equal(flat, second.split.negative.solid);
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
      faceAt(flat,cap); const mapping = rotation.lineage.faces.find(f => f.original.sourceId === cap.sourceId && f.original.faceId === cap.faceId);
      assert.ok(mapping); faceAt(upright,mapping.rotated); caps.push({ parent:cap,rotated:mapping.rotated });
    }
    assert.notEqual(caps[0].parent.sourceId,caps[1].parent.sourceId);
  } else { assert.equal(flat,prism.solid); if (variant === 'gusset') proveSketch(snapshot.evidence[0].native); }
  const node=document.nodes[rotationIndex],spec={axis:node.axis,degrees:node.angleDegrees},pivotMM=rail?[16,parameters.pivotY,4]:variant==='rectangle'?[16,0,4]:[20,12,0];
  const rotationProof = provePivot(rotation,flat,spec,pivotMM);
  const bounds = points => ({ min: [0,1,2].map(i => Math.min(...points.map(p => p[i]))), max: [0,1,2].map(i => Math.max(...points.map(p => p[i]))) });
  const expectedBounds = bounds(flat.graph.vertices.map(v => mappedPoint(v.pointMM,spec).map((value,i) => {
    const result=value+pivotMM[i]-mappedPoint(pivotMM,spec)[i]; equal(binary64(result),add(binary64(value),pivotOffsets(spec,pivotMM)[i])); return result; }))); 
  const actualBounds = bounds(upright.graph.vertices.map(v => v.pointMM));
  for (const side of ['min','max']) for (let i=0;i<3;i++) equal(binary64(actualBounds[side][i]), binary64(expectedBounds[side][i]));
  const boundsMM={original:bounds(flat.graph.vertices.map(v=>v.pointMM)),rotated:actualBounds}; let placement;
  if (variant==='placed') {
    const translation=snapshot.evidence[5].native,placed=snapshot.bodies.placed.native;
    assert.equal(translation.solid,placed); proveConvex(placed,volume,sizes);
    const proof=proveTranslation(translation,upright,[40,16,0]),composed=composeLineage(rotation,translation);
    const seen=new Set();
    for(const [index,solid]of [flat,upright,placed].entries()) {
      const ids=[solid.request.options.solidId,solid.request.options.resultIdPrefix,
        ...solid.graph.edges.map(e=>e.id),...solid.graph.vertices.map(v=>v.id),
        ...solid.request.assets.flatMap(({sourceId,face})=>[sourceId,face.plane.id,face.loop.id,face.options.faceId,
          face.options.evaluationId,face.options.resultIdPrefix,...face.loop.edges.map(c=>c.id),...face.pcurves.map(p=>p.id),
          ...face.topology.loop.uses.map(u=>u.id),...face.topology.edges.map(e=>e.id),...face.topology.vertices.map(v=>v.id)])];
      if(index)assert.equal(new Set(ids).size,ids.length);
      assert.ok(ids.every(id=>!seen.has(id)),'complete original/rotated/placed namespaces are independent');ids.forEach(id=>seen.add(id));
    }
    for (const link of composed.faces) {
      const before=faceAt(flat,link.original),after=faceAt(placed,link.placed);
      before.plane.controlPoints.forEach((row,u)=>row.forEach((p,v)=>point(after.plane.controlPoints[u][v],p,spec,pivotMM,true,[40,16,0])));
      for (const curve of before.loop.edges) {
        const mapping=composed.curves.find(item=>item.original.sourceId===link.original.sourceId&&item.original.curveId===curve.id);assert.ok(mapping);
        const next=after.loop.edges.find(item=>item.id===mapping.placed.curveId);assert.ok(next);
        curve.controlPoints.forEach((p,i)=>point(next.controlPoints[i],p,spec,pivotMM,true,[40,16,0]));
      }
    }
    boundsMM.placed=bounds(placed.graph.vertices.map(v=>v.pointMM));
    for(const side of ['min','max'])for(let i=0;i<3;i++)equal(binary64(boundsMM.placed[side][i]),add(binary64(actualBounds[side][i]),binary64([40,16,0][i])));
    placement={translation:proof,composedEightClassLineage:true,composedLineageSHA256:dataHash(composed)};
  }
  deepFrozen(snapshot);
  return { volumesMM3:Object.fromEntries(Object.keys(snapshot.bodies).map(label=>[label,volume])), boundsMM, independentlyRotatedParentBoundsMM:expectedBounds, caps, ...(placement?{placement}:{}),
    rotation: rotationProof, authoredSHA256:sha256(snapshot.save()),bodiesSHA256:dataHash(snapshot.bodies),evidenceSHA256:dataHash(snapshot.evidence),snapshotSHA256:dataHash(snapshotData(snapshot)) };
}
export function proveRefusal(error,CadModelError,accepted) {
  assert.ok(error instanceof CadModelError);assert.equal(error.code,'NATIVE');assert.equal(error.operation,'rotate');
  const cause=error.cause;assert.ok(cause instanceof Error);assert.equal(cause.name,'ModelingRotationError');
  assert.equal(cause.code,'REPRESENTABILITY');assert.equal(cause.stage,'stage-coefficients');
  assert.ok(cause.cause instanceof Error);assert.equal(cause.cause.name,'ConvexPlanarSolidError');assert.equal(cause.cause.code,'REPRESENTABILITY');
  assert.match(cause.cause.message,/not exactly represented in binary64/);
  exactData(cause.report.directCalls,{parentValidationCount:1,initialFaceConstructionCount:0,targetQualificationCount:0,retries:0});
  count(cause.report.parentValidation.childNativeWork,[8,108,324]);assert.equal(cause.report.parentValidation.solid,true);
  const expected=add(binary64(.1),binary64(4)),rounded=binary64(.1+4);assert.notEqual(expected.n*rounded.d,rounded.n*expected.d);
  if(accepted) {
    const original=accepted.bodies.original.native;exactData(cause.report.parentValidation,original.report);
    let failed;
    scan: for(const {sourceId,face}of original.request.assets) {
      const poles=[...face.plane.controlPoints.flatMap((row,u)=>row.map((p,v)=>[sourceId+'/'+face.plane.id+'/'+u+'/'+v,p])),
        ...face.loop.edges.flatMap(curve=>curve.controlPoints.map((p,i)=>[sourceId+'/'+curve.id+'/'+i,p]))];
      for(const [path,p]of poles)for(let axis=0;axis<3;axis++) {
        const spec={axis:'x',degrees:90},value=mappedPoint(p,spec)[axis],exact=add(binary64(value),pivotOffsets(spec,[16,.1,4])[axis]);
        const pivot=[16,.1,4],candidate=binary64(value+pivot[axis]-mappedPoint(pivot,spec)[axis]);
        if(exact.n*candidate.d!==candidate.n*exact.d){failed=path+'/'+axis;break scan;}
      }
    }
    assert.ok(failed);assert.equal(cause.entity,failed);
  }
  for(const value of [error,cause])for(const key of ['solid','bodies','evidence','lineage'])assert.equal(Object.hasOwn(value,key),false);
  deepFrozen(cause.report);return {code:cause.code,stage:cause.stage,entity:cause.entity,actualParentValidation:cause.report.parentValidation,
    originalCauseRetained:true,independentExactRepresentabilityRefusal:true,noTargetFaceConstruction:true,noTargetQualification:true};
}
export function provePreview(result, solid) {
  const F = solid.request.assets.length, U = solid.request.assets.reduce((sum, a) => sum + a.face.topology.loop.uses.length, 0);
  assert.ok(F === 6 || F === 8); const T = U - 2 * F, D = U - 3 * F;
  exactData([F,U,T,D], F === 6 ? [6,24,12,6] : [8,36,20,12]);
  assert.notEqual(result.solid, solid); exactData(result.solid, solid); exactData(result.options, { maximumFanTriangles: 40 });
  const { mesh, report, boundaries, internalDiagonals } = result;
  assert.equal(report.schema, 'barocss-convex-planar-solid-mesh'); assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion');
  exactData([report.faceCount, report.vertexCount, report.triangleCount, report.boundaryUseCount, report.internalDiagonalCount], [F, U, T, U, D]);
  exactData([mesh.faces.length, mesh.vertices.length, mesh.positionsMM.length, mesh.normals.length, mesh.parametersUV.length, mesh.indices.length], [F, U, 3*U, 3*U, 2*U, 3*T]);
  exactData([boundaries.length, internalDiagonals.length], [U, D]);
  exactData(report.directCounts, { parentValidationCount: 1, newGeometryEvaluationCount: 0, retries: 0 }); count(report.parentNativeWork, [F, 3*U, 9*U]);
  assert.equal(report.nativeAuthority, false); assert.equal(report.float32ProjectionCertified, false);
  const at = i => mesh.positionsMM.slice(i * 3, i * 3 + 3), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0); let sixVolume = { n: 0n, d: 1n };
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
    const indices = mesh.indices.slice(i, i + 3); assert.ok(indices.every(j => Number.isInteger(j) && j >= 0 && j < U));
    const [a, b, c] = indices.map(at), normal = mesh.normals.slice(indices[0] * 3, indices[0] * 3 + 3);
    assert.ok(dot(cross(b.map((v, j) => v - a[j]), c.map((v, j) => v - a[j])), normal) > 0); const [ar,br,cr] = [a,b,c].map(point => point.map(binary64));
    const rationalCross = [subtract(multiply(br[1],cr[2]),multiply(br[2],cr[1])),subtract(multiply(br[2],cr[0]),multiply(br[0],cr[2])),subtract(multiply(br[0],cr[1]),multiply(br[1],cr[0]))];
    sixVolume = add(sixVolume, ar.reduce((sum,value,j)=>add(sum,multiply(value,rationalCross[j])),{n:0n,d:1n}));
  }
  equal({ n: sixVolume.n, d: sixVolume.d * 6n }, fraction(solid.certificate.volumeMM3));
  for (const b of boundaries) {
    assert.equal(b.role, 'native-boundary'); const edge = solid.graph.edges.find(e => e.id === b.solidEdgeId); assert.ok(edge);
    exactData([...edge.vertexIds].sort(), [...b.solidVertexIds].sort()); exactData(b.vertexIndices.map(i => mesh.vertices[i].solidVertexId), b.solidVertexIds);
  }
  for (const d of internalDiagonals) {
    assert.equal(d.role, 'display-internal-not-brep-edge'); const ids = d.vertexIndices.map(i => mesh.vertices[i].solidVertexId).sort();
    assert.equal(solid.graph.edges.some(e => [...e.vertexIds].sort().join(':') === ids.join(':')), false);
  }
  return { faces: F, vertices: U, triangles: T, outwardTriangleVolumeMM3: Number(sixVolume.n) / Number(sixVolume.d) / 6,
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
    if(e.kind==='rotate'||e.kind==='translate') { ledgers.parents.push(entry(e.native.report.parentValidation.childNativeWork)); ledgers.targets.push(entry(e.native.report.targetQualification.childNativeWork)); ledgers.initialFaces.push(entry(e.native.report.initialFaceConstruction)); }
  }
}
export function accounting(ledgers,counts) {
  exactData(Object.keys(ledgers).map(k=>ledgers[k].length),counts);
  const values=entries=>entries.reduce((sum,{report})=>sum.map((v,i)=>v+report[(Object.hasOwn(report,'totalSourceCompilations')?['totalSourceCompilations','bindingObservations','totalD1']:['sourceCompilationCount','bindingObservationCount','totalD1Count'])[i]]),[0,0,0]);
  const returned=values(Object.entries(ledgers).filter(([k])=>k!=='sketches'&&k!=='initialFaces').flatMap(([,v])=>v));
  const initial=values(ledgers.initialFaces),known=returned.map((v,i)=>v+initial[i]+(i===0?ledgers.sketches.length:0));
  return { returnedLedgerSourceCompilations:returned[0],returnedLedgerBindingObservations:returned[1],returnedLedgerD1:returned[2],knownSourceCompilations:known[0],combinedBindingObservations:known[1],knownD1:known[2],initialFaceConstructionCount:ledgers.initialFaces.reduce((sum,{report})=>sum+report.faceCount,0),fullTransitiveNativeCoverage:'NOT_MEASURED' };
}
// Shared finite recorder for the two actual processes. Merely importing it does
// no CAD work or file writes. Raw results are persisted before any test oracle.
export function recorder(mode, entry, directory, source) {
  assert.equal(Number(process.versions.node.split('.')[0]), 22); assert.ok(process.execArgv.includes('--no-opt'));
  assert.match([...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' '), /--max[-_]old[-_]space[-_]size(?:=|\s+)1536(?:\s|$)/);
  assert.equal(process.argv.length, 2); assert.ok(mode === 'source' || mode === 'cold');
  mkdirSync(directory, { recursive: true });
  const started = performance.now(), receipt = resolve(directory, mode + '-flow.json');
  const flow = { status: 'running', issue: 2015, mode, processId: process.pid, processInstanceId: randomUUID(), nodeVersion: process.version,
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
    budget(); assert.ok(flow[kind] < (kind === 'modelCalls' ? mode === 'source' ? 7 : 1 : mode === 'source' ? 2 : 0));
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

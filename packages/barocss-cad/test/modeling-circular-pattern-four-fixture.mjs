import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chamferPart } from './modeling-chamfer-chain-fixture.mjs';
import { prove as proveConvex } from './modeling-intersection-fixture.mjs';
import { binary64 } from './stored-circle-prism-solid-fixture.mjs';
import { proveSnapshot as proveThreeSnapshot } from './modeling-circular-pattern-fixture.mjs';
import { proveRotation, mappedPoint } from './modeling-rotation-fixture.mjs';
import { constrainedGusset, authoredDocument as gussetDocument, proveSketch } from './modeling-gusset-fixture.mjs';
import { PRISM_COUNTS } from './modeling-offset-fixture.mjs';
import { signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData, hold, unchanged,
  provePreview, proveRefusal, emptyLedgers, accounting } from './modeling-scale-fixture.mjs';
export { proveThreeSnapshot, signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData, hold, unchanged, provePreview, proveRefusal, emptyLedgers, accounting };

// Frozen #1986 campaign. Fixtures/oracles do not call geometry providers.
export const DEFAULTS = Object.freeze({ frontDistance: 1, backDistance: 2, backY: 24 });
export const EDITED = Object.freeze({ ...DEFAULTS, backDistance: 3 });
export const EXPECTED_TOTALS = Object.freeze({ returnedLedgerSourceCompilations: 692, returnedLedgerBindingObservations: 8658,
  returnedLedgerD1: 25974, knownSourceCompilations: 845, combinedBindingObservations: 10602, knownD1: 31806,
  initialFaceConstructionCount: 148, fullTransitiveNativeCoverage: 'NOT_MEASURED' });
export const EXPECTED_CAMPAIGN = Object.freeze({ modelCalls: 8, sourceModelCalls: 7, coldModelCalls: 1, tessellations: 2,
  prisms: 5, firstChamfers: 3, secondChamfers: 5, outerParentValidations: 7, childParentValidations: 20,
  parentValidations: 27, initialTargetFaces: 148, targetQualifications: 20, selectionRefusals: 1,
  massQueries: 0, exports: 0, cpuBufferPreparations: 0, standaloneValidators: 0, ...EXPECTED_TOTALS });
export function patternedRail(cad) {
  const chain = chamferPart(cad);
  const instances = chain.part.circularPattern({ axis: 'x', angleDegrees: 90, count: 4 });
  assert.equal(instances[0], chain.part);
  return { ...chain, instances, build: () => chain.model.build({ original: instances[0], instance1: instances[1], instance2: instances[2], instance3: instances[3] }) };
}
export function patternedRectangle(cad) {
  const model = cad.model(), original = model.sketch.rectangle({ width: 32, height: 24 }).extrude(8, { from: 3 });
  const instances = original.circularPattern({ axis: 'y', angleDegrees: -90, count: 4 }); assert.equal(instances[0], original);
  return { model, instances, build: () => model.build({ original: instances[0], instance1: instances[1], instance2: instances[2], instance3: instances[3] }) };
}
export function patternedGusset(cad) {
  const chain = constrainedGusset(cad), instances = chain.gusset.circularPattern({ axis: 'z', angleDegrees: 90, count: 4 });
  assert.equal(instances[0], chain.gusset);
  return { ...chain, instances, build: () => chain.model.build({ original: instances[0], instance1: instances[1], instance2: instances[2], instance3: instances[3] }) };
}
export function authoredDocument(parameters = DEFAULTS, variant = 'rail') {
  const p = parameter => ({ parameter });
  const original = variant === 'gusset' ? gussetDocument() : {
    format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: variant === 'rail' ? { ...parameters } : {},
    nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [32, 24] },
      { kind: 'extrude', sketch: 0, height: 8, ...(variant === 'rectangle' ? { from: 3 } : {}) },
      ...(variant === 'rail' ? [
        { kind: 'chamfer', parent: { node: 1, side: 'solid' }, edge: { parallelTo: 'x', at: { y: 0, z: 'max' } }, distance: p('frontDistance') },
        { kind: 'chamfer', parent: { node: 2, side: 'solid' }, edge: { parallelTo: 'x', at: { y: p('backY'), z: 'max' } }, distance: p('backDistance') },
      ] : [])] };
  const parent = original.nodes.length - 1, axis = variant === 'rail' ? 'x' : variant === 'rectangle' ? 'y' : 'z';
  const angleDegrees = variant === 'rectangle' ? -90 : 90;
  return { ...original, nodes: [...original.nodes, { kind: 'circular-pattern', parent: { node: parent, side: 'solid' }, axis, angleDegrees, count: 4 }],
    outputs: { original: { node: parent, side: 'solid' }, instance1: { node: parent + 1, side: 'instance1' }, instance2: { node: parent + 1, side: 'instance2' }, instance3: { node: parent + 1, side: 'instance3' } } };
}
export function work(snapshot, reused, evaluated, previous) {
  exactData(snapshot.recomputation, { reusedFeatures: reused, evaluatedFeatures: evaluated });
  exactData([...reused, ...evaluated].sort(), snapshot.features.map((_, i) => i));
  const kinds = snapshot.features.length === 5 ? ['sketch', 'extrude', 'chamfer', 'chamfer', 'circular-pattern'] : ['sketch', 'extrude', 'circular-pattern'];
  exactData(snapshot.features, kinds.map((kind, index) => ({ kind, index, dependencies: index ? [index - 1] : [] })));
  if (previous) {
    for (const field of ['parameters', 'evidence', 'bodies']) assert.notEqual(snapshot[field], previous[field]);
    for (const i of reused) assert.equal(snapshot.evidence[i], previous.evidence[i]);
    for (const i of evaluated) assert.notEqual(snapshot.evidence[i], previous.evidence[i]);
    for (const label of ['original', 'instance1', 'instance2', 'instance3']) assert.notEqual(snapshot.bodies[label], previous.bodies[label]);
  }
  deepFrozen(snapshot);
}
const equal = (a, b) => assert.equal(a.n * b.d, b.n * a.d);
const namespaceIds = solid => [solid.request.options.solidId, solid.request.options.resultIdPrefix,
  ...solid.graph.edges.map(edge => edge.id), ...solid.graph.vertices.map(vertex => vertex.id),
  ...solid.request.assets.flatMap(({ sourceId, face }) => [sourceId, face.plane.id, face.loop.id, face.options.faceId,
    face.options.evaluationId, face.options.resultIdPrefix, ...face.loop.edges.map(curve => curve.id), ...face.pcurves.map(curve => curve.id),
    ...face.topology.loop.uses.map(use => use.id), ...face.topology.edges.map(edge => edge.id), ...face.topology.vertices.map(vertex => vertex.id)])];
function faceAt(solid, reference) {
  const asset = solid.request.assets.find(asset => asset.sourceId === reference.sourceId && asset.face.options.faceId === reference.faceId);
  assert.ok(asset); return asset.face;
}
function knownWork(report, expected) { exactData([report.sourceCompilationCount, report.bindingObservationCount, report.totalD1Count], expected); if ('retries' in report) assert.equal(report.retries, 0); }
// The adopted rotation oracle proves exact coefficients and full lineage.
// It does not call geometry providers or claim cross-copy sampled D1 bits.
export function provePattern(native, original, spec) {
  exactData(native.request.parent, original); assert.notEqual(native.request.parent, original); exactData(native.request.spec, spec);
  assert.equal(native.copies.length, 3); assert.notEqual(native.copies[0], native.copies[1]);
  const F = original.request.assets.length, U = original.request.assets.reduce((sum, asset) => sum + asset.face.topology.loop.uses.length, 0);
  assert.ok(F === 6 || F === 8);
  const namespaces = new Set(namespaceIds(original)), proofs = [];
  for (const [i, child] of native.copies.entries()) {
    const childSpec = {axis: spec.axis, degrees: i === 1 ? 180 : i === 2 ? spec.angleDegrees === 90 ? 270 : 90 : spec.angleDegrees === 90 ? 90 : 270};
    exactData(child.request.prefix, native.request.prefix + '_i' + (i + 1));
    proofs.push(proveRotation(child, original, childSpec));
    const ids = [child.request.prefix, ...namespaceIds(child.solid)];
    assert.equal(new Set(ids).size, ids.length); assert.ok(ids.every(id => !namespaces.has(id)), 'all original and three-copy namespace classes are disjoint');
    ids.forEach(id => namespaces.add(id));
    // Match regenerated native observations by use lineage and original
    // parameter. Whole native qualification retains its unchanged point/D1
    // self-consistency policy; floating samples do not promise cross-copy bits.
    for (const mapping of child.lineage.faces) {
      const before = faceAt(original, mapping.original), after = faceAt(child.solid, mapping.rotated);
      for (const binding of before.bindings) {
        const use = child.lineage.uses.find(use => use.original.sourceId === mapping.original.sourceId && use.original.useId === binding.useId); assert.ok(use);
        const matches = after.bindings.filter(next => next.useId === use.rotated.useId && next.parameter === binding.parameter);
        assert.equal(matches.length, 1); const next = matches[0]; assert.equal(next.traversalSense, binding.traversalSense);
      }
    }
  }
  const report = native.report; exactData([report.schema, report.version, report.lengthUnit, report.count], ['barocss-modeling-circular-pattern', 0, 'mm', 4]);
  exactData(report.parentValidation, original.report); exactData(report.childReports, native.copies.map(copy => copy.report));
  exactData(report.directCalls, { parentValidationCount: 1, rotationCount: 3, retries: 0 });
  exactData(report.totalNativeCalls, { parentValidationCount: 4, initialFaceConstructionCount: 3 * F, targetQualificationCount: 3, retries: 0 });
  exactData(report.preflight, { copyCount: 3, faceCount: 3 * F, surfaceCoordinateCount: 36 * F, curveCoordinateCount: 18 * U });
  exactData(report.preservation, Object.fromEntries(['sameOriginalParent', 'allCopiesPreflighted', 'independentSourceNamespaces', 'completeQualifiedCopies', 'originalPreserved'].map(key => [key, true])));
  exactData(report.limits, { faces: 10, directedUses: 48, pairs: 24, vertices: 16, coordinateAbsMM: 10000, rationalOperations: 200000, integerBits: 8192,
    snapshotCumulativeBytes: 50331648, snapshotRetainedBytes: 33554432, snapshotResultBytes: 16777216 });
  assert.equal(report.numericPolicy, 'exact-rationals-of-stored-binary64-no-welding-no-tolerance-promotion');
  assert.equal(report.validationScope, 'whole-result-self-consistency-not-authenticity'); assert.equal(report.persistentNamingCertified, false);
  assert.equal(report.dataCharge, 'unchanged-solid-snapshot-ledger-alias-occurrences-not-v8-heap');
  exactData(report.exactWork, {operations:0,gcdSteps:0,floatSearchSteps:0,floatConversions:0,maximumObservedBits:0});
  exactData(report.childSpecs, [{axis:spec.axis,degrees:spec.angleDegrees===90?90:270},{axis:spec.axis,degrees:180},{axis:spec.axis,degrees:spec.angleDegrees===90?270:90}]);
  knownWork(report.parentValidation.childNativeWork, [F, 3 * U, 9 * U]); deepFrozen(native);
  return { sameOriginalParent: true, completeIndependentCopies: true, fullEightClassLineage: true, copies: proofs,
    sampledBindingScope: 'regenerated native self-consistency under unchanged whole qualification; no cross-copy D1 bit identity claim',
    nativeSHA256: dataHash(native) };
}
export function proveSnapshot(snapshot, parameters = DEFAULTS, variant = 'rail') {
  const document = authoredDocument(parameters, variant); assert.equal(snapshot.save(), signedData(document) + '\n');
  exactData(snapshot.parameters, document.parameters); exactData(snapshot.suppression, {});
  exactData(Object.keys(snapshot.bodies).sort(), ['instance1', 'instance2', 'instance3', 'original']);
  exactData(snapshot.evidence.map(evidence => evidence.kind), document.nodes.map(node => node.kind));
  const pattern = snapshot.evidence.at(-1).native, original = snapshot.bodies.original.native;
  const volume = variant === 'rail' ? 6144 - 16 * parameters.frontDistance ** 2 - 16 * parameters.backDistance ** 2 : variant === 'rectangle' ? 6144 : 6912;
  const sizes = variant === 'rail' ? [8, 18, 12] : [6, 12, 8];
  for (const [label, body] of Object.entries(snapshot.bodies)) { assert.equal(body.family, 'convex-planar'); proveConvex(body.native, volume, sizes); if (label !== 'original') assert.equal(body.native, pattern.copies[Number(label.slice('instance'.length))-1].solid); }
  const prism = snapshot.evidence[1].native; exactData(prism.report.childNativeWork, PRISM_COUNTS); exactData(prism.request.sketch, snapshot.evidence[0].native);
  const caps = [];
  if (variant === 'rail') {
    const [first, second] = snapshot.evidence.slice(2, 4).map(evidence => evidence.native);
    exactData(first.split.request.parent, prism.solid); exactData(second.split.request.parent, first.split.negative.solid); assert.equal(original, second.split.negative.solid);
    for (const [i, feature] of [first, second].entries()) {
      const removed = 16 * [parameters.frontDistance, parameters.backDistance][i] ** 2;
      exactData(feature.metric.removedVolumeMM3, { numerator: String(removed), denominator: '1' }); assert.equal(feature.split.report.volumeMM3.conserved, true);
      proveConvex(feature.split.positive.solid, removed, [5, 9, 6]); proveConvex(feature.split.negative.solid, i ? volume : 6144 - removed, [7 + i, 15 + 3 * i, 10 + 2 * i]);
    }
    const firstCap = first.split.lineage.faces.find(face => face.side === 'negative' && face.role === 'cap').output;
    const retained = second.split.lineage.faces.filter(face => face.side === 'negative' && face.parent?.sourceId === firstCap.sourceId && face.parent.faceId === firstCap.faceId);
    assert.equal(retained.length, 1); assert.equal(retained[0].role, 'retained');
    const back = second.split.lineage.faces.find(face => face.side === 'negative' && face.role === 'cap'); assert.equal(back.key, second.lineage.chamferFaceKey);
    for (const cap of [retained[0].output, back.output]) {
      faceAt(original, cap);
      const copies = pattern.copies.map(copy => { const mapping = copy.lineage.faces.find(face => face.original.sourceId === cap.sourceId && face.original.faceId === cap.faceId); assert.ok(mapping); faceAt(copy.solid, mapping.rotated); return mapping.rotated; });
      caps.push({ parent: cap, copies });
    }
    assert.notEqual(caps[0].parent.sourceId, caps[1].parent.sourceId);
  } else { assert.equal(original, prism.solid); if (variant === 'gusset') proveSketch(snapshot.evidence[0].native); }
  const node = document.nodes.at(-1), spec = {axis:node.axis,angleDegrees:node.angleDegrees,count:4};
  const proof = provePattern(pattern, original, spec);
  const bounds = points => ({ min: [0, 1, 2].map(i => Math.min(...points.map(point => point[i]))), max: [0, 1, 2].map(i => Math.max(...points.map(point => point[i]))) });
  const boundsMM = { original: bounds(original.graph.vertices.map(vertex => vertex.pointMM)) };
  for (const [i, copy] of pattern.copies.entries()) {
    const childSpec = {axis:spec.axis,degrees:i===1?180:i===2?spec.angleDegrees===90?270:90:spec.angleDegrees===90?90:270};
    const expected = bounds(original.graph.vertices.map(vertex => mappedPoint(vertex.pointMM,childSpec))), actual = bounds(copy.solid.graph.vertices.map(vertex => vertex.pointMM));
    for (const side of ['min', 'max']) for (let j = 0; j < 3; j++) equal(binary64(actual[side][j]), binary64(expected[side][j]));
    boundsMM['instance' + (i + 1)] = actual;
  }
  if (variant === 'rectangle') {
    assert.equal(document.nodes[1].from,3);
    const placedBounds={original:{min:[0,0,3],max:[32,24,11]},instance1:{min:[-11,0,0],max:[-3,24,32]},instance2:{min:[-32,0,-11],max:[0,24,-3]},instance3:{min:[3,0,-32],max:[11,24,0]}};
    for(const label of Object.keys(placedBounds))for(const side of ['min','max'])for(let j=0;j<3;j++)equal(binary64(boundsMM[label][side][j]),binary64(placedBounds[label][side][j]));
  }
  deepFrozen(snapshot);
  return { volumesMM3: { original: volume, instance1: volume, instance2: volume, instance3: volume }, boundsMM, caps, pattern: proof,
    authoredSHA256: sha256(snapshot.save()), bodiesSHA256: dataHash(snapshot.bodies), evidenceSHA256: dataHash(snapshot.evidence), snapshotSHA256: dataHash(snapshotData(snapshot)) };
}
export function collectLedgers(ledgers, snapshot, label) {
  for (const index of snapshot.recomputation.evaluatedFeatures) {
    const evidence = snapshot.evidence[index], entry = report => ({ label, index, report });
    if (evidence.kind === 'sketch') ledgers.sketches.push(entry(evidence.native.report));
    if (evidence.kind === 'extrude') ledgers.prisms.push(entry(evidence.native.report.childNativeWork));
    if (evidence.kind === 'chamfer') ledgers[index === 2 ? 'firstChamfers' : 'secondChamfers'].push(entry(evidence.native.report.nativeWork));
    if (evidence.kind === 'circular-pattern') {
      ledgers.parents.push(entry(evidence.native.report.parentValidation.childNativeWork));
      for (const copy of evidence.native.copies) {
        ledgers.parents.push(entry(copy.report.parentValidation.childNativeWork)); ledgers.targets.push(entry(copy.report.targetQualification.childNativeWork));
        ledgers.initialFaces.push(entry(copy.report.initialFaceConstruction));
      }
    }
  }
}
// Shared finite recorder for the two actual processes. Merely importing it does
// no CAD work or file writes. Raw results are persisted before any test oracle.
export function recorder(mode, entry, directory, source) {
  assert.equal(Number(process.versions.node.split('.')[0]), 22); assert.ok(process.execArgv.includes('--no-opt'));
  assert.match([...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' '), /--max[-_]old[-_]space[-_]size(?:=|\s+)1536(?:\s|$)/);
  assert.equal(process.argv.length, 2); assert.ok(mode === 'source' || mode === 'cold');
  mkdirSync(directory, { recursive: true });
  const started = performance.now(), receipt = resolve(directory, mode + '-flow.json');
  const flow = { status: 'running', issue: 1986, mode, processId: process.pid, processInstanceId: randomUUID(), nodeVersion: process.version,
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

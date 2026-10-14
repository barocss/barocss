import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chamferPart } from './modeling-chamfer-chain-fixture.mjs';
import { prove as proveConvex } from './modeling-intersection-fixture.mjs';
import { binary64 } from './stored-circle-prism-solid-fixture.mjs';
import { proveTranslation } from './modeling-rotation-placement-fixture.mjs';
import { proveSnapshot as proveLegacySnapshot } from './modeling-linear-pattern-fixture.mjs';
export { proveLegacySnapshot };
import { constrainedGusset, authoredDocument as gussetDocument, proveSketch } from './modeling-gusset-fixture.mjs';
import { PRISM_COUNTS } from './modeling-offset-fixture.mjs';
import { signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData, hold, unchanged,
  emptyLedgers, accounting } from './modeling-scale-fixture.mjs';
export { signedData, sha256, dataHash, exactData, deepFrozen, snapshotData, errorData, hold, unchanged, emptyLedgers, accounting };

// Frozen #2009: source7/cold2 public model calls and exactly two previews.
export const DEFAULTS = Object.freeze({ frontDistance: 1, backDistance: 2, backY: 24, spacing: 40 });
export const EDITED = Object.freeze({ ...DEFAULTS, spacing: 56 });
export const REFUSED = Object.freeze({ ...DEFAULTS, spacing: 3330 });
export const LEGACY = Object.freeze({ directory: '/Users/user/.barocss-ai/v3/evidence-cad-linear-pattern-part07/reviewed-continuation',
  textFile: 'initial.cad-model.json', textBytes: 802, textSHA256: 'b3375d7b912d0ecc1e1bdde63c83a800cefa6c178b825803ec434b90b24aa767',
  snapshotFile: '07-cold.snapshot.json', snapshotBytes: 1977170, snapshotSHA256: 'c6de9bca780d3b22ea13d5ef0fe63e6f77675902afa5b8b1e2e15554f861d061' });
export const EXPECTED_TOTALS = Object.freeze({ returnedLedgerSourceCompilations: 637, returnedLedgerBindingObservations: 7974,
  returnedLedgerD1: 23922, knownSourceCompilations: 785, combinedBindingObservations: 9846, knownD1: 29538,
  initialFaceConstructionCount: 142, fullTransitiveNativeCoverage: 'NOT_MEASURED' });
export const SOURCE_TOTALS = Object.freeze({ returnedLedgerSourceCompilations: 472, returnedLedgerBindingObservations: 5940,
  returnedLedgerD1: 17820, knownSourceCompilations: 588, combinedBindingObservations: 7416, knownD1: 22248,
  initialFaceConstructionCount: 112, fullTransitiveNativeCoverage: 'NOT_MEASURED' });
export const COLD_TOTALS = Object.freeze({ returnedLedgerSourceCompilations: 165, returnedLedgerBindingObservations: 2034,
  returnedLedgerD1: 6102, knownSourceCompilations: 197, combinedBindingObservations: 2430, knownD1: 7290,
  initialFaceConstructionCount: 30, fullTransitiveNativeCoverage: 'NOT_MEASURED' });
export const SOURCE_LEDGER_COUNTS = Object.freeze([4,4,2,2,22,15,15,2]);
export const COLD_LEDGER_COUNTS = Object.freeze([2,2,1,1,6,4,4,0]);
export const EXPECTED_CAMPAIGN = Object.freeze({ modelCalls: 9, sourceModelCalls: 7, coldModelCalls: 2, tessellations: 2,
  prisms: 6, sketches: 6, firstChamfers: 3, secondChamfers: 3, outerParentValidations: 9, childParentValidations: 19,
  parentValidations: 28, initialTargetFaces: 142, targetQualifications: 19, representabilityRefusals: 1,
  massQueries: 0, exports: 0, cpuBufferPreparations: 0, standaloneValidators: 0, ...EXPECTED_TOTALS });
export function patternedRail(cad) {
  const chain = chamferPart(cad), spacing = chain.model.parameter('spacing', 40);
  const instances = chain.part.linearPattern({ axis: 'x', spacing, count: 4 });
  assert.equal(instances[0], chain.part);
  return { ...chain, instances, build: () => chain.model.build({ original: instances[0], instance1: instances[1], instance2: instances[2], instance3: instances[3] }) };
}
export function patternedRectangle(cad) {
  const model = cad.model(), original = model.sketch.rectangle({ width: 32, height: 24 }).extrude(8, { from: 3 });
  const instances = original.linearPattern({ axis: 'z', spacing: 6000, count: 2 }); assert.equal(instances[0], original);
  return { model, instances, build: () => model.build({ original: instances[0], instance1: instances[1] }) };
}
export function patternedGusset(cad) {
  const chain = constrainedGusset(cad), instances = chain.gusset.linearPattern({ axis: 'y', spacing: 32, count: 4 });
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
  const parent = original.nodes.length - 1, axis = variant === 'rail' ? 'x' : variant === 'rectangle' ? 'z' : 'y';
  const spacing = variant === 'rail' ? p('spacing') : variant === 'rectangle' ? 6000 : 32;
  return { ...original, nodes: [...original.nodes, { kind: 'linear-pattern', parent: { node: parent, side: 'solid' }, axis, spacing, count: variant === 'rectangle' ? 2 : 4 }],
    outputs: { original: { node: parent, side: 'solid' }, instance1: { node: parent + 1, side: 'instance1' }, ...(variant === 'rectangle' ? {} : { instance2: { node: parent + 1, side: 'instance2' }, instance3: { node: parent + 1, side: 'instance3' } }) } };
}
export function work(snapshot, reused, evaluated, previous) {
  exactData(snapshot.recomputation, { reusedFeatures: reused, evaluatedFeatures: evaluated });
  exactData([...reused, ...evaluated].sort(), snapshot.features.map((_, i) => i));
  const kinds = snapshot.features.length === 5 ? ['sketch', 'extrude', 'chamfer', 'chamfer', 'linear-pattern'] : ['sketch', 'extrude', 'linear-pattern'];
  exactData(snapshot.features, kinds.map((kind, index) => ({ kind, index, dependencies: index ? [index - 1] : [] })));
  if (previous) {
    for (const field of ['parameters', 'evidence', 'bodies']) assert.notEqual(snapshot[field], previous[field]);
    for (const i of reused) assert.equal(snapshot.evidence[i], previous.evidence[i]);
    for (const i of evaluated) assert.notEqual(snapshot.evidence[i], previous.evidence[i]);
    assert.equal(snapshot.bodies.original, previous.bodies.original);
    for (const label of Object.keys(snapshot.bodies).filter(label => label !== 'original')) assert.notEqual(snapshot.bodies[label], previous.bodies[label]);
  }
  deepFrozen(snapshot);
}
const fraction = v => ({ n: BigInt(v.numerator), d: BigInt(v.denominator) });
const multiply = (a, b) => ({ n: a.n * b.n, d: a.d * b.d });
const subtract = (a, b) => ({ n: a.n * b.d - b.n * a.d, d: a.d * b.d });
const add = (a, b) => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
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
// Reuse the finished-placement oracle with dynamic six/eight Face inventories.
// It proves all eight lineage classes and stored coefficients, without provider calls.
export function provePattern(native, original, stepMM, count) {
  exactData(native.request.parent, original); assert.notEqual(native.request.parent, original); exactData(native.request.stepMM, stepMM);
  exactData(Object.keys(native.request), ['parent', 'stepMM', 'prefix', 'count']); assert.equal(native.request.count, count);
  assert.ok(count === 2 || count === 4); const C = count - 1; assert.equal(native.copies.length, C); assert.equal(new Set(native.copies).size, C);
  const F = original.request.assets.length, U = original.request.assets.reduce((sum, asset) => sum + asset.face.topology.loop.uses.length, 0);
  assert.ok(F === 6 || F === 8);
  const namespaces = new Set(namespaceIds(original)), proofs = [];
  for (const [i, child] of native.copies.entries()) {
    const offset = stepMM.map(value => value === 0 ? value : value * (i + 1));
    exactData(child.request.prefix, native.request.prefix + '_i' + (i + 1));
    proofs.push(proveTranslation(child, original, offset));
    const ids = [child.request.prefix, ...namespaceIds(child.solid)];
    assert.equal(new Set(ids).size, ids.length); assert.ok(ids.every(id => !namespaces.has(id)), 'all original and both-copy namespace classes are disjoint');
    ids.forEach(id => namespaces.add(id));
    // Match regenerated native observations by use lineage and original
    // parameter. Whole native qualification retains its unchanged point/D1
    // self-consistency policy; floating samples do not promise cross-copy bits.
    for (const mapping of child.lineage.faces) {
      const before = faceAt(original, mapping.original), after = faceAt(child.solid, mapping.translated);
      for (const binding of before.bindings) {
        const use = child.lineage.uses.find(use => use.original.sourceId === mapping.original.sourceId && use.original.useId === binding.useId); assert.ok(use);
        const matches = after.bindings.filter(next => next.useId === use.translated.useId && next.parameter === binding.parameter);
        assert.equal(matches.length, 1); const next = matches[0]; assert.equal(next.traversalSense, binding.traversalSense);
      }
    }
  }
  const report = native.report; exactData([report.schema, report.version, report.lengthUnit, report.count], ['barocss-modeling-linear-pattern', 0, 'mm', count]);
  exactData(report.parentValidation, original.report); exactData(report.childReports, native.copies.map(copy => copy.report));
  exactData(report.directCalls, { parentValidationCount: 1, translationCount: C, retries: 0 });
  exactData(report.totalNativeCalls, { parentValidationCount: count, initialFaceConstructionCount: C * F, targetQualificationCount: C, retries: 0 });
  exactData(report.preflight, { copyCount: C, faceCount: C * F, surfaceCoordinateCount: 12 * C * F, curveCoordinateCount: 6 * C * U });
  exactData(report.preservation, Object.fromEntries(['sameOriginalParent', 'allCopiesPreflighted', 'independentSourceNamespaces', 'completeQualifiedCopies', 'originalPreserved'].map(key => [key, true])));
  exactData(report.limits, { faces: 10, directedUses: 48, pairs: 24, vertices: 16, coordinateAbsMM: 10000, rationalOperations: 200000, integerBits: 8192,
    snapshotCumulativeBytes: 50331648, snapshotRetainedBytes: 33554432, snapshotResultBytes: 16777216 });
  assert.equal(report.numericPolicy, 'exact-rationals-of-stored-binary64-no-welding-no-tolerance-promotion');
  assert.equal(report.validationScope, 'whole-result-self-consistency-not-authenticity'); assert.equal(report.persistentNamingCertified, false);
  assert.equal(report.dataCharge, 'unchanged-solid-snapshot-ledger-alias-occurrences-not-v8-heap');
  assert.ok(report.exactWork.operations > 0 && report.exactWork.operations <= 200000); assert.ok(report.exactWork.maximumObservedBits <= 8192);
  knownWork(report.parentValidation.childNativeWork, [F, 3 * U, 9 * U]); deepFrozen(native);
  return { sameOriginalParent: true, completeIndependentCopies: true, fullEightClassLineage: true, copies: proofs,
    sampledBindingScope: 'regenerated native self-consistency under unchanged whole qualification; no cross-copy D1 bit identity claim',
    nativeSHA256: dataHash(native) };
}
export function proveSnapshot(snapshot, parameters = DEFAULTS, variant = 'rail') {
  const document = authoredDocument(parameters, variant); assert.equal(snapshot.save(), signedData(document) + '\n');
  exactData(snapshot.parameters, document.parameters); exactData(snapshot.suppression, {});
  exactData(Object.keys(snapshot.bodies).sort(), Object.keys(document.outputs).sort());
  exactData(snapshot.evidence.map(evidence => evidence.kind), document.nodes.map(node => node.kind));
  const pattern = snapshot.evidence.at(-1).native, original = snapshot.bodies.original.native;
  const volume = variant === 'rail' ? 6144 - 16 * parameters.frontDistance ** 2 - 16 * parameters.backDistance ** 2 : variant === 'rectangle' ? 6144 : 6912;
  const sizes = variant === 'rail' ? [8, 18, 12] : [6, 12, 8];
  for (const [label, body] of Object.entries(snapshot.bodies)) { assert.equal(body.family, 'convex-planar'); proveConvex(body.native, volume, sizes); if (label !== 'original') assert.equal(body.native, pattern.copies[Number(label.slice(8)) - 1].solid); }
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
      const copies = pattern.copies.map(copy => { const mapping = copy.lineage.faces.find(face => face.original.sourceId === cap.sourceId && face.original.faceId === cap.faceId); assert.ok(mapping); faceAt(copy.solid, mapping.translated); return mapping.translated; });
      caps.push({ parent: cap, copies });
    }
    assert.notEqual(caps[0].parent.sourceId, caps[1].parent.sourceId);
  } else { assert.equal(original, prism.solid); if (variant === 'gusset') proveSketch(snapshot.evidence[0].native); }
  const node = document.nodes.at(-1), spacing = variant === 'rail' ? parameters.spacing : node.spacing, axis = ['x', 'y', 'z'].indexOf(node.axis);
  const step = [0, 0, 0]; step[axis] = spacing; const proof = provePattern(pattern, original, step, node.count);
  const bounds = points => ({ min: [0, 1, 2].map(i => Math.min(...points.map(point => point[i]))), max: [0, 1, 2].map(i => Math.max(...points.map(point => point[i]))) });
  const boundsMM = { original: bounds(original.graph.vertices.map(vertex => vertex.pointMM)) };
  for (const [i, copy] of pattern.copies.entries()) {
    const offset = step.map(value => value * (i + 1));
    const shifted = original.graph.vertices.map(vertex => vertex.pointMM.map((value, j) => {
      const result = value + offset[j]; equal(binary64(result), add(binary64(value), binary64(offset[j]))); return result;
    }));
    const expected = bounds(shifted), actual = bounds(copy.solid.graph.vertices.map(vertex => vertex.pointMM));
    for (const side of ['min', 'max']) for (let j = 0; j < 3; j++) equal(binary64(actual[side][j]), binary64(expected[side][j]));
    boundsMM['instance' + (i + 1)] = actual;
  }
  if (variant === 'rectangle') { assert.equal(document.nodes[1].from, 3); exactData(['original', 'instance1'].map(label => [boundsMM[label].min[2], boundsMM[label].max[2]]), [[3, 11], [6003, 6011]]); }
  deepFrozen(snapshot);
  return { volumesMM3: Object.fromEntries(Object.keys(snapshot.bodies).map(label => [label, volume])), boundsMM, caps, pattern: proof,
    authoredSHA256: sha256(snapshot.save()), bodiesSHA256: dataHash(snapshot.bodies), evidenceSHA256: dataHash(snapshot.evidence), snapshotSHA256: dataHash(snapshotData(snapshot)) };
}
export function collectLedgers(ledgers, snapshot, label) {
  for (const index of snapshot.recomputation.evaluatedFeatures) {
    const evidence = snapshot.evidence[index], entry = report => ({ label, index, report });
    if (evidence.kind === 'sketch') ledgers.sketches.push(entry(evidence.native.report));
    if (evidence.kind === 'extrude') ledgers.prisms.push(entry(evidence.native.report.childNativeWork));
    if (evidence.kind === 'chamfer') ledgers[index === 2 ? 'firstChamfers' : 'secondChamfers'].push(entry(evidence.native.report.nativeWork));
    if (evidence.kind === 'linear-pattern') {
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
  const flow = { status: 'running', issue: 2009, mode, processId: process.pid, processInstanceId: randomUUID(), nodeVersion: process.version,
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
    budget(); assert.ok(flow[kind] < (kind === 'modelCalls' ? mode === 'source' ? 7 : 2 : mode === 'source' ? 2 : 0));
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

export function proveRefusal(error, CadModelError, accepted) {
  assert.ok(error instanceof CadModelError); assert.equal(error.code, 'NATIVE'); assert.equal(error.operation, 'linearPattern');
  const cause = error.cause; assert.ok(cause instanceof Error); assert.equal(cause.name, 'ModelingLinearPatternError');
  assert.equal(cause.code, 'REPRESENTABILITY'); assert.equal(cause.stage, 'stage-coefficients'); assert.match(cause.entity, /_i3\/.+\/0$/);
  assert.ok(cause.cause instanceof Error); assert.equal(cause.cause.name, 'ConvexPlanarSolidError'); assert.equal(cause.cause.code, 'REPRESENTABILITY');
  assert.match(cause.cause.message, /exactly represented within/);
  exactData(cause.report.directCalls, { parentValidationCount: 1, translationCount: 0, retries: 0 }); exactData(cause.report.completedChildReports, []);
  knownWork(cause.report.parentValidation.childNativeWork, [8,108,324]); assert.equal(cause.report.parentValidation.solid, true);
  assert.ok(3330 * 3 <= 10000 && 32 + 3330 * 3 > 10000);
  if (accepted) {
    const original = accepted.bodies.original.native, prefix = accepted.evidence.at(-1).native.request.prefix;
    exactData(cause.report.parentValidation, original.report);
    const poles = original.request.assets.flatMap(({sourceId,face}) => [
      ...face.plane.controlPoints.flatMap((row,u) => row.map((p,v) => [sourceId+'/'+face.plane.id+'/'+u+'/'+v,p])),
      ...face.loop.edges.flatMap(curve => curve.controlPoints.map((p,i) => [sourceId+'/'+curve.id+'/'+i,p]))]);
    for (const instance of [1,2]) for (const [,p] of poles) for (let axis=0;axis<3;axis++) {
      const offset = axis === 0 ? 3330*instance : 0, target = p[axis]+offset;
      assert.ok(Number.isFinite(target) && Math.abs(target)<=10000);
      equal(binary64(target), add(binary64(p[axis]), binary64(offset)));
    }
    const failed = poles.find(([,p]) => Math.abs(p[0]+9990)>10000); assert.ok(failed);
    assert.equal(cause.entity, prefix+'_i3/'+failed[0]+'/0'); assert.equal(failed[1][0]+9990,10022);
  }
  for (const value of [error, cause]) for (const key of ['solid','bodies','evidence','lineage','copies']) assert.equal(Object.hasOwn(value,key),false);
  deepFrozen(cause.report);
  return { code: cause.code, stage: cause.stage, entity: cause.entity, actualParentValidation: cause.report.parentValidation,
    thirdOnlyCoefficientOverflow: true, allOffsetsWithinBound: true, noChildTranslation: true,
    originalCauseRetained: true, noTargetFaceConstruction: true, noTargetQualification: true };
}

// Dynamic inventory adaptation of the unchanged scale-preview independent oracle.
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
  exactData(report.directCounts, { parentValidationCount: 1, newGeometryEvaluationCount: 0, retries: 0 }); knownWork(report.parentNativeWork, [F, 3*U, 9*U]);
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

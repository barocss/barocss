import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { CASES, EXPECTED_CAMPAIGN, RESIDUAL, signedData, sha256, dataHash, clone, exactData, deepFrozen, errorData,
  proveParent, proveQualification, proveDecimalResidual, provePreview, capResidual } from './stored-circle-prism-solid-fixture.mjs';

// #1655's source half is five admitted qualifier/validator calls, three explicit
// parent builds, one existing preview and three existing knot-D1 attempts.
// The sixth admitted call belongs ONLY to the separate emitted cold consumer.
// The root must run both processes in one <=600s serial process-group slot.
assert.equal(Number(process.versions.node.split('.')[0]), 22, 'the frozen native campaign requires Node22');
assert.ok(process.execArgv.includes('--no-opt'), 'the frozen native campaign requires --no-opt');
assert.match([...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' '), /--max[-_]old[-_]space[-_]size(?:=|\s+)1536(?:\s|$)/);
assert.ok(process.env.CAD_TEST_ENTRY, 'source half requires an explicit own-source public bundle');
const entry = resolve(process.env.CAD_TEST_ENTRY);
const continuing = process.argv[2] === '--continue-retained';
assert.equal(process.argv.length, continuing ? 3 : 2, 'only the explicit --continue-retained mode is supported');
const processMarker = Symbol.for('barocss.stored-circle-prism-solid.source-process');
assert.equal(globalThis[processMarker], undefined, 'one source campaign process only');
const processInstanceId = randomUUID(); globalThis[processMarker] = processInstanceId;
const originalReceiptPin = 'ff32a7388da44b8b90c3dfa4bf5e83b9e1383dd28763492874a9da41ed336dc6';
const directory = resolve(process.env.CAD_CIRCLE_EVIDENCE_DIR ?? process.env.CAD_MODEL_EVIDENCE_DIR ?? new URL('./stored-circle-prism-solid-evidence', import.meta.url).pathname);
mkdirSync(directory, { recursive: true });
const flowFile = resolve(directory, continuing ? 'source-continuation-flow.json' : 'source-flow.json'), started = performance.now();
const flow = { status: 'running', issue: 1655, processId: process.pid, processInstanceId, mode: continuing ? 'retained-artifact-continuation' : 'complete-source-campaign', nodeVersion: process.version, startedAt: new Date().toISOString(),
  entrySHA256: sha256(readFileSync(entry)), calls: { parentBuilds: 0, qualifiers: 0, validators: 0, previews: 0, wallD1Attempts: 0 },
  stages: [], artifacts: {}, transport: {}, expectedWholeCampaign: EXPECTED_CAMPAIGN,
  fullTransitiveNativeCoverage: 'NOT_MEASURED', sourceDerivedExpectedWorkIsNotInstrumented: true,
  externalSerialProcessGroupTimeoutRequired: true, nativeElapsedMS: 0,
  ...(continuing ? { originalSourceReceipt: { filename: 'source-flow.json', sha256: originalReceiptPin },
    continuationCalls: { wallD1Attempts: 0 }, continuationNativeElapsedMS: 0 } : {}) };
// Refuse an accidental repeated campaign. Prior successes and failures are immutable.
writeFileSync(flowFile, JSON.stringify(flow, null, 2) + '\n', { flag: 'wx' });
const write = () => writeFileSync(flowFile, JSON.stringify(flow, null, 2) + '\n');
const disk = () => { const d = statfsSync(directory); assert.ok(d.bavail * d.bsize >= 500 * 1024 * 1024, 'at least 500MiB free disk required'); };
const caps = { parentBuilds: 3, qualifiers: 4, validators: 1, previews: 1, wallD1Attempts: 3 };
function stage(kind, label, action) {
  disk(); assert.ok(flow.nativeElapsedMS < 600000, 'aggregate campaign cap reached; do not retry');
  assert.ok(flow.calls[kind] < caps[kind], 'frozen explicit call count exhausted');
  if (continuing) {
    assert.equal(kind, 'wallD1Attempts', 'continuation cannot admit constructors, qualifiers, validators or previews');
    assert.ok(flow.retainedArtifactPreflightPassed, 'all pure assertions must finish before remaining native calls');
    assert.ok(flow.continuationCalls.wallD1Attempts < 3); flow.continuationCalls.wallD1Attempts++;
  }
  flow.calls[kind]++; flow.pending = { kind, label }; write();
  const start = performance.now(); let outcome = 'threw', failure;
  try { const result = action(); outcome = 'returned'; return result; }
  catch (error) { failure = errorData(error); throw error; }
  finally { const elapsedMS = performance.now() - start; flow.nativeElapsedMS += elapsedMS; if (continuing) flow.continuationNativeElapsedMS += elapsedMS; flow.stages.push({ kind, label, outcome, elapsedMS, ...(failure ? { failure } : {}) }); flow.pending = null; write(); }
}
function artifact(filename, text, scope) {
  assert.ok(Buffer.byteLength(text) <= 3 * 1024 * 1024, 'bounded signed artifact required');
  writeFileSync(resolve(directory, filename), text, { flag: 'wx' });
  const receipt = { bytes: Buffer.byteLength(text), sha256: sha256(text), scope };
  flow.artifacts[filename] = receipt; write();
  if (process.env.CAD_MODEL_TRANSPORT_DIR) {
    const output = resolve(process.env.CAD_MODEL_TRANSPORT_DIR); mkdirSync(output, { recursive: true });
    // A configured transport retains exact native artifacts, never a placeholder mesh.
    if (output !== directory) writeFileSync(resolve(output, 'stored-circle-prism-solid-' + filename), text, { flag: 'wx' });
    const target = output === directory ? filename : 'stored-circle-prism-solid-' + filename;
    assert.equal(sha256(readFileSync(resolve(output, target))), receipt.sha256);
    flow.transport[filename] = { ...receipt, filename: target }; write();
  }
  return text;
}
const dataArtifact = (filename, data, scope) => artifact(filename, signedData(data) + '\n', scope);
const originalArtifact = (which, parent) => {
  dataArtifact(which + '.parent.json', parent, 'complete actual original native parent; signed binary64 data');
  artifact(which + '.profile.source0', parent.profile.source, 'unchanged original profile Source0, not whole-model source');
};
const qualifiedArtifact = (which, result) => {
  artifact(which + '.world.source0', result.world.source, 'new whole-model Source0 for the exact original six world objects');
  return dataArtifact(which + '.qualified.json', result, 'whole native qualification result; cold validation artifact, not public authored save format');
};
function refused(label, action, code, ErrorClass) {
  let caught;
  assert.throws(() => {
    const unexpected = action();
    dataArtifact(label + '.unexpected-result.json', unexpected, 'unexpected native return retained; campaign stops without a replacement case');
  }, error => { caught = error; assert.ok(error instanceof ErrorClass); assert.equal(error.code, code); return true; });
  return caught;
}
// Only the reviewed first failure may be continued. This branch replays signed
// data and independent arithmetic; it never reconstructs any spent native case.
async function continueRetained() {
  const originalFile = resolve(directory, 'source-flow.json'), originalBytes = readFileSync(originalFile);
  assert.equal(sha256(originalBytes), originalReceiptPin, 'immutable original failed receipt hash');
  const original = JSON.parse(originalBytes.toString('utf8'));
  assert.equal(original.status, 'failed'); assert.equal(original.issue, 1655);
  assert.deepEqual(original.calls, { parentBuilds: 3, qualifiers: 4, validators: 1, previews: 1, wallD1Attempts: 0 });
  assert.equal(original.failure.name, 'AssertionError'); assert.equal(original.failure.code, 'ERR_ASSERTION');
  assert.match(original.failure.stack, /provePreview/); assert.match(original.failure.message, /6\.000000000000001/);
  assert.deepEqual(original.stages.map(stage => [stage.kind, stage.outcome]), [
    ['parentBuilds', 'returned'], ['qualifiers', 'returned'], ['parentBuilds', 'returned'], ['qualifiers', 'returned'],
    ['parentBuilds', 'returned'], ['qualifiers', 'threw'], ['qualifiers', 'threw'], ['validators', 'threw'], ['previews', 'returned'],
  ]);
  assert.equal(flow.entrySHA256, original.entrySHA256, 'the original source entry must be unchanged');
  assert.ok(Number.isFinite(original.nativeElapsedMS) && original.nativeElapsedMS >= 0 && original.nativeElapsedMS < 600000);
  flow.calls = { ...original.calls }; flow.spentCallsFromOriginalReceipt = { ...original.calls };
  flow.originalNativeElapsedMS = original.nativeElapsedMS; flow.nativeElapsedMS = original.nativeElapsedMS;
  flow.originalFailure = original.failure; flow.artifacts = clone(original.artifacts); flow.transport = clone(original.transport);
  const names = ['A.parent.json', 'A.profile.source0', 'A.world.source0', 'A.qualified.json', 'A.preview.json',
    'B.parent.json', 'B.profile.source0', 'B.world.source0', 'B.qualified.json', 'C.parent.json', 'C.profile.source0'];
  assert.deepEqual(Object.keys(original.artifacts).sort(), [...names].sort());
  const retained = new Map();
  for (const filename of names) {
    const bytes = readFileSync(resolve(directory, filename)), receipt = original.artifacts[filename];
    assert.equal(bytes.length, receipt.bytes); assert.equal(sha256(bytes), receipt.sha256);
    retained.set(filename, bytes.toString('utf8'));
  }
  if (Object.keys(original.transport).length) assert.ok(process.env.CAD_MODEL_TRANSPORT_DIR, 'supply the original transport directory to hash-check its retained copies');
  const verifyImmutable = () => {
    assert.equal(sha256(readFileSync(originalFile)), originalReceiptPin);
    assert.equal(sha256(readFileSync(entry)), original.entrySHA256);
    for (const [filename, text] of retained) assert.equal(readFileSync(resolve(directory, filename), 'utf8'), text);
    for (const [filename, receipt] of Object.entries(original.transport)) {
      assert.ok(receipt.filename === filename || receipt.filename === 'stored-circle-prism-solid-' + filename);
      const bytes = readFileSync(resolve(process.env.CAD_MODEL_TRANSPORT_DIR, receipt.filename));
      assert.equal(bytes.length, receipt.bytes); assert.equal(sha256(bytes), original.artifacts[filename].sha256);
    }
  };
  verifyImmutable();
  const parse = filename => { const text = retained.get(filename), value = JSON.parse(text); assert.equal(signedData(value) + '\n', text); return value; };
  const parentA = parse('A.parent.json'), parentB = parse('B.parent.json'), parentC = parse('C.parent.json');
  const A = parse('A.qualified.json'), B = parse('B.qualified.json'), preview = parse('A.preview.json');
  for (const [which, parent] of [['A', parentA], ['B', parentB], ['C', parentC]]) {
    flow[which + 'Parent'] = proveParent(parent, which);
    assert.equal(parent.profile.source, retained.get(which + '.profile.source0'));
  }
  // Parsed artifacts remain caller-owned. Original A/B runtime freezing was
  // already asserted before the immutable preview failure; this is pure replay.
  flow.A = proveQualification(A, parentA, 'A', false); flow.B = proveQualification(B, parentB, 'B', false);
  exactData(flow.A, original.A); exactData(flow.B, original.B);
  assert.equal(A.world.source, retained.get('A.world.source0')); assert.equal(B.world.source, retained.get('B.world.source0'));
  flow.CExactWitness = proveDecimalResidual(parentC); exactData(flow.CExactWitness, original.CExactWitness);
  for (const [which, code, stageIndex] of [['C', 'GEOMETRY', 5], ['D', 'OWNED', 6], ['E', 'OWNED', 7]]) {
    const refusal = original[which + 'Refusal']; assert.equal(refusal.name, 'StoredCirclePrismSolidError'); assert.equal(refusal.code, code);
    exactData(refusal, original.stages[stageIndex].failure); flow[which + 'Refusal'] = refusal;
  }
  const cause = original.CRefusal.cause; exactData(cause.residual, RESIDUAL); assert.match(original.CRefusal.message, /cap.*composition/i);
  const cap = parentC.bundle.topology.faces.find(f => f.id === cause.faceId); assert.ok(cap && cap.role !== 'wall');
  const loop = parentC.bundle.topology.loops.find(l => l.id === cap.outerLoopId), use = loop.uses.find(u => u.id === cause.useId); assert.ok(use);
  assert.ok(Number.isInteger(cause.poleIndex) && cause.poleIndex >= 0 && cause.poleIndex < 9); assert.ok(cause.axis === 0 || cause.axis === 1);
  const chart = parentC.bundle.geometry.objects.find(o => o.id === cap.surfaceId), edge = parentC.bundle.topology.edges.find(e => e.id === use.edgeId);
  const curve = parentC.bundle.geometry.objects.find(o => o.id === edge.curveId), axis = cause.axis;
  exactData(capResidual(chart.controlPoints[0][0][axis], chart.controlPoints[axis === 0 ? 1 : 0][axis === 1 ? 1 : 0][axis],
    use.pcurve.curve.controlPoints[cause.poleIndex][axis], curve.controlPoints[cause.poleIndex][axis]), cause.residual);
  flow.preview = provePreview(preview, parentA);
  verifyImmutable(); flow.retainedArtifactPreflightPassed = true;
  flow.artifactReplayScope = 'Pure signed parent/proof/preview replay; no reconstructed geometry and no new whole-result freezing evidence';
  flow.originalRuntimeFreezeEvidence = 'Original A/B proveQualification completed its deepFrozen assertions before the preserved preview assertion failure'; write();

  // Only this native export is used in continuation, after every pure assertion.
  const { evaluateSurfaceD1 } = await import(pathToFileURL(entry).href);
  const wall = parentA.bundle.geometry.objects.find(o => o.id === parentA.report.geometryIds.wallSurfaceId), parentHash = dataHash(parentA);
  flow.wallD1Refusals = [];
  for (const u of [1, 2, 3]) {
    verifyImmutable(); let refusal;
    assert.throws(() => stage('wallD1Attempts', 'remaining unchanged wall knot D1 u=' + u, () => {
      const unexpected = evaluateSurfaceD1(wall, u, .5);
      dataArtifact('continuation-wall-D1-u' + u + '.unexpected-result.json', unexpected, 'unexpected remaining knot D1 return; preserve first failure without retries');
      return unexpected;
    }), error => { assert.ok(error instanceof Error); assert.equal(error.message, 'First derivative is not defined at an exact C0 interior knot'); refusal = errorData(error); return true; });
    flow.wallD1Refusals.push({ u, v: .5, refusal }); assert.equal(dataHash(parentA), parentHash); write();
  }
  verifyImmutable(); assert.deepEqual(flow.calls, caps); assert.deepEqual(flow.continuationCalls, { wallD1Attempts: 3 });
  assert.ok(flow.nativeElapsedMS < 600000); flow.originalReceiptAndArtifactsUnchanged = true;
  flow.knownSourceCompilationsExpectedInSourceHalf = 12; flow.awaitedColdValidationCalls = 1;
  flow.status = 'passed'; flow.elapsedMS = performance.now() - started; flow.finishedAt = new Date().toISOString(); write();
}
try {
  disk();
  if (continuing) await continueRetained();
  else {
  const api = await import(pathToFileURL(entry).href);
  const { buildXYCirclePrismShell, qualifyStoredCirclePrismSolid, validateStoredCirclePrismSolid,
    tessellateXYCirclePrismShell, evaluateSurfaceD1, StoredCirclePrismSolidError } = api;
  const build = which => { const f = CASES[which]; return stage('parentBuilds', which + ' original native parent', () =>
    buildXYCirclePrismShell({ kind: 'circle', id: 'solid1655_' + which + '_ring', center: [...f.center], radius: f.radius },
      { shellId: 'solid1655_' + which, height: f.height })); };

  const parentA = build('A'); originalArtifact('A', parentA); flow.AParent = proveParent(parentA, 'A'); write();
  const parentAHash = dataHash(parentA), inputA = clone(parentA), inputAText = signedData(inputA);
  const A = stage('qualifiers', 'A exact integer translated prism', () => qualifyStoredCirclePrismSolid(inputA));
  const aText = qualifiedArtifact('A', A), aHash = dataHash(A);
  flow.A = proveQualification(A, parentA, 'A'); assert.equal(signedData(inputA), inputAText); write();

  const parentB = build('B'); originalArtifact('B', parentB); flow.BParent = proveParent(parentB, 'B'); write();
  const parentBHash = dataHash(parentB), inputB = clone(parentB), inputBText = signedData(inputB);
  const B = stage('qualifiers', 'B signed-zero dyadic prism', () => qualifyStoredCirclePrismSolid(inputB));
  const bText = qualifiedArtifact('B', B), bHash = dataHash(B);
  flow.B = proveQualification(B, parentB, 'B'); assert.equal(signedData(inputB), inputBText); write();

  const parentC = build('C'); originalArtifact('C', parentC); flow.CParent = proveParent(parentC, 'C');
  const parentCHash = dataHash(parentC); flow.CExactWitness = proveDecimalResidual(parentC); write();
  const cError = refused('C', () => stage('qualifiers', 'C genuine represented cap-composition refusal', () => qualifyStoredCirclePrismSolid(parentC)), 'GEOMETRY', StoredCirclePrismSolidError);
  assert.match(cError.message, /cap.*composition/i); exactData(cError.cause.residual, RESIDUAL); deepFrozen(cError.cause);
  const cause = cError.cause, cap = parentC.bundle.topology.faces.find(f => f.id === cause.faceId);
  assert.ok(cap && cap.role !== 'wall');
  const loop = parentC.bundle.topology.loops.find(l => l.id === cap.outerLoopId), use = loop.uses.find(u => u.id === cause.useId);
  assert.ok(use); assert.ok(Number.isInteger(cause.poleIndex) && cause.poleIndex >= 0 && cause.poleIndex < 9);
  assert.ok(cause.axis === 0 || cause.axis === 1);
  const chart = parentC.bundle.geometry.objects.find(o => o.id === cap.surfaceId);
  const edge = parentC.bundle.topology.edges.find(e => e.id === use.edgeId), curve = parentC.bundle.geometry.objects.find(o => o.id === edge.curveId);
  const axis = cause.axis, origin = chart.controlPoints[0][0][axis], end = chart.controlPoints[axis === 0 ? 1 : 0][axis === 1 ? 1 : 0][axis];
  exactData(capResidual(origin, end, use.pcurve.curve.controlPoints[cause.poleIndex][axis], curve.controlPoints[cause.poleIndex][axis]), cause.residual);
  flow.CRefusal = errorData(cError); write();

  const changedParent = clone(parentA), wallLoop = changedParent.bundle.topology.loops.find(l => l.faceId === changedParent.bundle.topology.faces.find(f => f.role === 'wall').id);
  const right = wallLoop.uses.find(u => u.pcurve.curve.controlPoints.every(point => point[0] === 4));
  assert.ok(right); assert.equal(right.sense, 'forward'); right.sense = 'reverse';
  const changedParentText = signedData(changedParent);
  flow.DRefusal = errorData(refused('D', () => stage('qualifiers', 'D copied right-seam sense mismatch', () => qualifyStoredCirclePrismSolid(changedParent)), 'OWNED', StoredCirclePrismSolidError));
  assert.equal(signedData(changedParent), changedParentText); assert.equal(dataHash(parentA), parentAHash); assert.equal(dataHash(A), aHash); write();

  const changedResult = clone(A); changedResult.certificate.arithmetic.operations++;
  const changedResultText = signedData(changedResult);
  flow.ERefusal = errorData(refused('E', () => stage('validators', 'E supplied arithmetic counter mismatch', () => validateStoredCirclePrismSolid(changedResult)), 'OWNED', StoredCirclePrismSolidError));
  assert.equal(signedData(changedResult), changedResultText); assert.equal(dataHash(A), aHash); deepFrozen(A);
  assert.equal(readFileSync(resolve(directory, 'A.qualified.json'), 'utf8'), aText); write();

  const preview = stage('previews', 'A existing sampled preview k4', () => tessellateXYCirclePrismShell(parentA.bundle, { meshId: 'solid1655_A_preview_k4', revision: 0, segmentsPerQuarter: 4 }));
  dataArtifact('A.preview.json', preview, 'genuine existing native packet, face ranges, edge paths/provenance, UV samples and unqualified reports');
  flow.preview = provePreview(preview, parentA); write();
  const wall = parentA.bundle.geometry.objects.find(o => o.id === parentA.report.geometryIds.wallSurfaceId);
  flow.wallD1Refusals = [];
  for (const u of [1, 2, 3]) {
    let refusal;
    assert.throws(() => stage('wallD1Attempts', 'unchanged wall knot D1 u=' + u, () => {
      const unexpected = evaluateSurfaceD1(wall, u, .5);
      dataArtifact('wall-D1-u' + u + '.unexpected-result.json', unexpected, 'unexpected knot D1 return retained; no manufactured refusal or smoothing');
      return unexpected;
    }), error => {
      assert.ok(error instanceof Error); assert.equal(error.message, 'First derivative is not defined at an exact C0 interior knot'); refusal = errorData(error); return true;
    });
    flow.wallD1Refusals.push({ u, v: .5, refusal }); write();
  }

  // Caller edits are after all frozen geometry calls and cannot affect owned results.
  inputA.profile.source = 'caller changed its own source after qualification'; inputB.report.center[0] = 99;
  assert.equal(dataHash(A), aHash); assert.equal(dataHash(B), bHash); deepFrozen(A); deepFrozen(B);
  assert.throws(() => { A.certificate.arithmetic.operations++; }, TypeError);
  assert.throws(() => { A.parent.bundle.topology.loops[2].uses[1].sense = 'reverse'; }, TypeError);
  for (const [parent, hash] of [[parentA, parentAHash], [parentB, parentBHash], [parentC, parentCHash]]) assert.equal(dataHash(parent), hash);
  assert.equal(readFileSync(resolve(directory, 'A.qualified.json'), 'utf8'), aText);
  assert.equal(readFileSync(resolve(directory, 'B.qualified.json'), 'utf8'), bText);
  for (const [filename, receipt] of Object.entries(flow.artifacts)) assert.equal(sha256(readFileSync(resolve(directory, filename))), receipt.sha256);
  assert.deepEqual(flow.calls, caps); assert.ok(flow.nativeElapsedMS < 600000);
  flow.originalsUnchangedAfterRefusals = true; flow.deepFrozenOwnedResults = true; flow.callerMutationIndependent = true;
  flow.knownSourceCompilationsExpectedInSourceHalf = 12; flow.status = 'passed'; flow.awaitedColdValidationCalls = 1;
  flow.elapsedMS = performance.now() - started; flow.finishedAt = new Date().toISOString(); write();
  }
} catch (error) {
  flow.status = 'failed'; flow.failure = errorData(error); flow.elapsedMS = performance.now() - started;
  flow.additionalGeometryRequiresScopeAmendment = true; write(); throw error;
}

import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULTS, WIDER, FINISHED, RECOVERED, finishedPair, proveSnapshot, proveRefusal, provePreview, work,
  hold, unchanged, snapshotData, signedData, sha256, dataHash, exactData, accounting, recorder } from './modeling-finished-copy-fixture.mjs';

// Source half of the frozen #1919 campaign: exactly five evaluations and two
// genuine previews. A failed process is never restarted by this driver.
assert.ok(process.env.CAD_MODEL_TEST_MODULE); assert.ok(process.env.CAD_MODEL_EVIDENCE_DIR);
const entry = resolve(process.env.CAD_MODEL_TEST_MODULE), directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR);
const { flow, artifact, stage, fail, finish } = recorder('source', entry, directory);
try {
  const { cad, CadModelError, tessellateConvexPlanarSolid } = await import(pathToFileURL(entry).href);
  const baseline = stage('modelCalls', '1 finished front1/back2 rail at [48,-0,0]', finishedPair(cad).build, '01-baseline.snapshot.json');
  artifact('initial.cad-model.json', baseline.save(), 'actual signed-zero baseline save for emitted cold load', true);
  const held = [[baseline, hold(baseline)]]; work(baseline, [], [0, 1, 2, 3, 4]); flow.baseline = proveSnapshot(baseline, DEFAULTS);
  flow.baselineSnapshotSHA256 = dataHash(snapshotData(baseline)); flow.baselineBodiesSHA256 = dataHash(baseline.bodies); flow.baselineEvidenceSHA256 = dataHash(baseline.evidence);
  artifact('baseline.translation.json', baseline.evidence[4].native, 'complete finished parent, rebuilt target, full lineage and native reports');
  const previews = {
    left: stage('tessellations', 'baseline left genuine convex preview', () => tessellateConvexPlanarSolid(baseline.bodies.left.native, { maximumFanTriangles: 40 }), 'baseline-left.preview.json'),
    right: stage('tessellations', 'baseline right genuine convex preview', () => tessellateConvexPlanarSolid(baseline.bodies.right.native, { maximumFanTriangles: 40 }), 'baseline-right.preview.json'),
  };
  // Persist both complete actual packets before applying either mesh oracle.
  flow.previews = Object.fromEntries(Object.entries(previews).map(([name, preview]) => [name, provePreview(preview, baseline.bodies[name].native)]));
  const outputIdentities = Object.fromEntries(Object.entries(baseline.bodies).map(([name, body]) => [name,
    { family: body.family, solidId: body.native.request.options.solidId, sourceIds: body.native.request.assets.map(a => a.sourceId) }]));
  const transfer = artifact('baseline-transfer.json', { ...snapshotData(baseline), summary: flow.baseline, previews, outputIdentities,
    lineage: baseline.evidence[4].native.lineage, finishingLineage: baseline.evidence.slice(2, 4).map(e => ({ chamfer: e.native.lineage, split: e.native.split.lineage })),
    bodiesSHA256: flow.baselineBodiesSHA256, basis: 'authored XYZ; no coordinate conversion',
    scope: 'complete actual two-output native baseline and two genuine previews; zero-native editor reuse only, no UI/GPU acceptance' },
  'complete signed save, both native outputs, source identities, all finishing/copy lineage and both actual preview packets');
  if (process.env.CAD_MODEL_TRANSPORT_DIR) {
    const out = resolve(process.env.CAD_MODEL_TRANSPORT_DIR); mkdirSync(out, { recursive: true });
    const path = resolve(out, 'modeling-finished-copy-baseline-native.json'); writeFileSync(path, transfer, { flag: 'wx' });
    assert.equal(sha256(readFileSync(path)), sha256(transfer)); flow.transport = { path, bytes: Buffer.byteLength(transfer), sha256: sha256(transfer) };
  }
  const unchangedAll = () => held.forEach(([snapshot, before]) => unchanged(snapshot, before));
  const wider = stage('modelCalls', '2 spacing64 from accepted baseline', () => baseline.withParameters({ spacing: 64 }), '02-wider.snapshot.json');
  work(wider, [0, 1, 2, 3], [4], baseline); flow.wider = proveSnapshot(wider, WIDER); held.push([wider, hold(wider)]); unchangedAll();
  const finished = stage('modelCalls', '3 backDistance3 from accepted spacing64', () => wider.withParameters({ backDistance: 3 }), '03-finished.snapshot.json');
  work(finished, [0, 1, 2], [3, 4], wider); flow.finished = proveSnapshot(finished, FINISHED); held.push([finished, hold(finished)]); unchangedAll();
  artifact('accepted-finished.cad-model.json', finished.save(), 'actual accepted state before refused spacing edit', true);
  let refusal;
  try { stage('modelCalls', '4 spacing0.1 from accepted backDistance3', () => finished.withParameters({ spacing: .1 }), '04-representability.unexpected.snapshot.json'); }
  catch (error) { refusal = error; }
  flow.representability = proveRefusal(refusal, CadModelError, finished);
  flow.returnedLedgers.parents.push({ label: '4 actual refused copy parent validation', index: 4, report: refusal.cause.report.parentValidation.childNativeWork });
  unchangedAll(); artifact('after-rejection.accepted.snapshot.json', snapshotData(finished), 'actual accepted source/body/evidence retained after refusal');
  artifact('after-rejection.accepted.cad-model.json', finished.save(), 'actual unchanged save after refusal', true);
  const recovered = stage('modelCalls', '5 spacing-48 from same accepted backDistance3', () => finished.withParameters({ spacing: -48 }), '05-recovered.snapshot.json');
  work(recovered, [0, 1, 2, 3], [4], finished); flow.recovered = proveSnapshot(recovered, RECOVERED); unchangedAll();
  artifact('recovered.cad-model.json', recovered.save(), 'actual negative-offset recovery save', true);
  exactData([flow.modelCalls, flow.tessellations], [5, 2]); assert.equal(flow.stages.filter(s => s.outcome === 'threw').length, 1);
  exactData(flow.stages.map(s => s.kind), ['modelCalls', 'tessellations', 'tessellations', 'modelCalls', 'modelCalls', 'modelCalls', 'modelCalls']);
  flow.accounting = accounting(flow.returnedLedgers, [1, 1, 1, 2, 5, 4, 4, 2]);
  exactData(flow.accounting, { returnedLedgerSourceCompilations: 200, returnedLedgerBindingObservations: 2520, returnedLedgerD1: 7560,
    knownSourceCompilations: 233, combinedBindingObservations: 2952, knownD1: 8856, initialFaceConstructionCount: 32, fullTransitiveNativeCoverage: 'NOT_MEASURED' });
  exactData([flow.baseline, flow.wider, flow.finished, flow.recovered].map(s => s.volumesMM3),
    [{ left: 6064, right: 6064 }, { left: 6064, right: 6064 }, { left: 5984, right: 5984 }, { left: 5984, right: 5984 }]);
  finish(); console.log(signedData({ status: flow.status, modelCalls: flow.modelCalls, tessellations: flow.tessellations, accounting: flow.accounting }));
} catch (error) { fail(error); throw error; }

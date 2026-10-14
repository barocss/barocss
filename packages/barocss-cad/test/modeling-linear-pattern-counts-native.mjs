import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULTS, EDITED, patternedRail, patternedRectangle, patternedGusset, proveSnapshot, proveRefusal, provePreview, work,
  hold, unchanged, snapshotData, signedData, sha256, dataHash, exactData, accounting, recorder } from './modeling-linear-pattern-counts-fixture.mjs';
import { proveSnapshot as proveThree } from './modeling-linear-pattern-fixture.mjs';

// Frozen #2009: seven source evaluations and two actual previews. No retry.
assert.ok(process.env.CAD_MODEL_TEST_MODULE); assert.ok(process.env.CAD_MODEL_EVIDENCE_DIR);
const entry = resolve(process.env.CAD_MODEL_TEST_MODULE), directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR);
const { flow, artifact, stage, fail, finish } = recorder('source', entry, directory);
try {
  assert.ok(process.env.CAD_LINEAR_COUNTS_LEGACY_AUTHORED); assert.ok(process.env.CAD_LINEAR_COUNTS_LEGACY_SNAPSHOT);
  const legacyText = readFileSync(resolve(process.env.CAD_LINEAR_COUNTS_LEGACY_AUTHORED), 'utf8');
  const legacyBytes = readFileSync(resolve(process.env.CAD_LINEAR_COUNTS_LEGACY_SNAPSHOT));
  assert.equal(sha256(legacyText), 'b3375d7b912d0ecc1e1bdde63c83a800cefa6c178b825803ec434b90b24aa767');
  assert.equal(sha256(legacyBytes), 'c6de9bca780d3b22ea13d5ef0fe63e6f77675902afa5b8b1e2e15554f861d061');
  const legacySnapshot = JSON.parse(legacyBytes); assert.equal(legacySnapshot.text, legacyText);
  flow.legacyInputs = { authoredSHA256: sha256(legacyText), snapshotSHA256: sha256(legacyBytes),
    scope: 'authentic accepted #1973 reviewed continuation; preserve its original failed source fixture receipt' };
  const { cad, CadModelError, tessellateConvexPlanarSolid } = await import(pathToFileURL(entry).href);
  const baseline = stage('modelCalls', '1 finished rail count4 spacing40', patternedRail(cad).build, '01-baseline.snapshot.json');
  artifact('initial.cad-model.json', baseline.save(), 'actual count4 baseline authored cold input', true);
  const held = [[baseline, hold(baseline)]];
  work(baseline, [], [0, 1, 2, 3, 4]); flow.baseline = proveSnapshot(baseline, DEFAULTS);
  flow.baselineSnapshotSHA256 = dataHash(snapshotData(baseline));
  flow.baselineBodiesSHA256 = dataHash(baseline.bodies); flow.baselineEvidenceSHA256 = dataHash(baseline.evidence);
  artifact('baseline.pattern.json', baseline.evidence[4].native, 'complete original, three independent copies, eight-class lineage and reports');
  const farPreview = stage('tessellations', 'count4 third copy genuine20triangle preview',
    () => tessellateConvexPlanarSolid(baseline.bodies.instance3.native, { maximumFanTriangles: 40 }), 'baseline-instance3.preview.json');
  flow.farPreview = provePreview(farPreview, baseline.bodies.instance3.native);
  const unchangedAll = () => held.forEach(([snapshot, before]) => unchanged(snapshot, before));
  const edited = stage('modelCalls', '2 spacing56 reuse finished source prefix',
    () => baseline.withParameters({ spacing: 56 }), '02-edited.snapshot.json');
  work(edited, [0, 1, 2, 3], [4], baseline); flow.edited = proveSnapshot(edited, EDITED);
  held.push([edited, hold(edited)]); unchangedAll();
  artifact('accepted-edited.cad-model.json', edited.save(), 'accepted state before third-only coordinate refusal', true);
  let refusal;
  try {
    stage('modelCalls', '3 spacing3330 third-only pole10022 preflight refusal',
      () => edited.withParameters({ spacing: 3330 }), '03-third-overflow.unexpected.snapshot.json');
  } catch (error) { refusal = error; }
  flow.thirdOverflow = proveRefusal(refusal, CadModelError, edited);
  // This is the actual exposed parent validation, not an invented failed frame.
  flow.returnedLedgers.parents.push({ label: '3 refused pattern actual original qualification', index: 4,
    report: refusal.cause.report.parentValidation.childNativeWork });
  unchangedAll();
  artifact('after-rejection.accepted.snapshot.json', snapshotData(edited), 'accepted save, bodies and evidence retained after refusal');
  artifact('after-rejection.accepted.cad-model.json', edited.save(), 'preserved accepted save', true);
  const recovered = stage('modelCalls', '4 spacing40 recover accepted pattern',
    () => edited.withParameters({ spacing: 40 }), '04-recovered.snapshot.json');
  work(recovered, [0, 1, 2, 3], [4], edited); flow.recovered = proveSnapshot(recovered, DEFAULTS);
  exactData(recovered.bodies, baseline.bodies); exactData(recovered.evidence, baseline.evidence);
  assert.equal(recovered.save(), baseline.save()); unchangedAll();
  const rectangle = stage('modelCalls', '5 count2 rectanglefrom3 axisz spacing6000', patternedRectangle(cad).build, '05-rectangle.snapshot.json');
  work(rectangle, [], [0, 1, 2]); flow.rectangle = proveSnapshot(rectangle, {}, 'rectangle');
  flow.rectangleSnapshotSHA256 = dataHash(snapshotData(rectangle));
  artifact('rectangle.cad-model.json', rectangle.save(), 'actual count2 authored cold input', true);
  const rectanglePreview = stage('tessellations', 'count2 copy genuine12triangle preview',
    () => tessellateConvexPlanarSolid(rectangle.bodies.instance1.native, { maximumFanTriangles: 40 }), 'rectangle-instance1.preview.json');
  flow.rectanglePreview = provePreview(rectanglePreview, rectangle.bodies.instance1.native);
  const gusset = stage('modelCalls', '6 count4 constrained gusset axisy spacing32', patternedGusset(cad).build, '06-gusset.snapshot.json');
  work(gusset, [], [0, 1, 2]); flow.gusset = proveSnapshot(gusset, { width: 40, height: 24 }, 'gusset'); unchangedAll();
  const legacy = stage('modelCalls', '7 authentic accepted count3 baseline compatibility load',
    () => cad.load(legacyText), '07-legacy-three.snapshot.json');
  exactData(legacy.recomputation, { reusedFeatures: [], evaluatedFeatures: [0, 1, 2, 3, 4] });
  flow.compatibilityThree = proveThree(legacy); exactData(snapshotData(legacy), legacySnapshot);
  assert.equal(legacy.save(), legacyText); unchangedAll();
  exactData([flow.modelCalls, flow.tessellations], [7, 2]);
  assert.equal(flow.stages.filter(item => item.outcome === 'threw').length, 1);
  flow.accounting = accounting(flow.returnedLedgers, [4, 4, 2, 2, 22, 15, 15, 2]);
  exactData(flow.accounting, { returnedLedgerSourceCompilations: 472, returnedLedgerBindingObservations: 5940, returnedLedgerD1: 17820,
    knownSourceCompilations: 588, combinedBindingObservations: 7416, knownD1: 22248,
    initialFaceConstructionCount: 112, fullTransitiveNativeCoverage: 'NOT_MEASURED' });
  finish(); console.log(signedData({ status: flow.status, modelCalls: flow.modelCalls, tessellations: flow.tessellations, accounting: flow.accounting }));
} catch (error) { fail(error); throw error; }

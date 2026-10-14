import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULTS, EDITED, SOURCE_TOTALS, SOURCE_LEDGER_COUNTS, pivotedRail, pivotedRectangle, pivotedGusset,
  proveSnapshot, proveRefusal, provePreview, work, hold, unchanged, snapshotData, signedData, dataHash,
  exactData, accounting, recorder } from './modeling-rotation-pivot-fixture.mjs';

// Frozen #2015: source7 models, two genuine previews; no automatic retry.
assert.ok(process.env.CAD_MODEL_TEST_MODULE); assert.ok(process.env.CAD_MODEL_EVIDENCE_DIR);
const entry = resolve(process.env.CAD_MODEL_TEST_MODULE), directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR);
const { flow, artifact, stage, fail, finish } = recorder('source', entry, directory);
try {
  const { cad, CadModelError, tessellateConvexPlanarSolid } = await import(pathToFileURL(entry).href);
  const baseline = stage('modelCalls', '1 finished rail X90 pivot16/12/4', pivotedRail(cad).build, '01-baseline.snapshot.json');
  artifact('initial.cad-model.json', baseline.save(), 'actual original authored pivot input for fresh emitted rebuild', true);
  const held = [[baseline, hold(baseline)]];
  work(baseline, [], [0, 1, 2, 3, 4]); flow.baseline = proveSnapshot(baseline, DEFAULTS);
  flow.baselineSnapshotSHA256 = dataHash(snapshotData(baseline));
  flow.baselineBodiesSHA256 = dataHash(baseline.bodies); flow.baselineEvidenceSHA256 = dataHash(baseline.evidence);
  artifact('baseline.rotation.json', baseline.evidence[4].native, 'complete parent, exact pivot copy, eight-class lineage and reports');
  const railPreview = stage('tessellations', 'pivot rail genuine20triangle preview',
    () => tessellateConvexPlanarSolid(baseline.bodies.rotated.native, { maximumFanTriangles: 40 }), 'baseline-rotated.preview.json');
  flow.railPreview = provePreview(railPreview, baseline.bodies.rotated.native);
  const unchangedAll = () => held.forEach(([snapshot, before]) => unchanged(snapshot, before));
  const edited = stage('modelCalls', '2 pivotY20 preserves finished prefix0..3',
    () => baseline.withParameters({ pivotY: 20 }), '02-edited.snapshot.json');
  work(edited, [0, 1, 2, 3], [4], baseline); flow.edited = proveSnapshot(edited, EDITED);
  held.push([edited, hold(edited)]); unchangedAll();
  artifact('accepted-edited.cad-model.json', edited.save(), 'accepted save before exact representability refusal', true);
  let refusal;
  try {
    stage('modelCalls', '3 pivotY0.1 final coordinate representability refusal before target Face',
      () => edited.withParameters({ pivotY: 0.1 }), '03-unrepresentable.unexpected.snapshot.json');
  } catch (error) { refusal = error; }
  flow.representability = proveRefusal(refusal, CadModelError, edited);
  flow.returnedLedgers.parents.push({ label: '3 refused rotation actual parent qualification', index: 4,
    report: refusal.cause.report.parentValidation.childNativeWork });
  unchangedAll();
  artifact('after-rejection.accepted.snapshot.json', snapshotData(edited), 'accepted source, bodies and evidence retained');
  artifact('after-rejection.accepted.cad-model.json', edited.save(), 'preserved accepted save', true);
  const recovered = stage('modelCalls', '4 recover pivotY12 from accepted edit',
    () => edited.withParameters({ pivotY: 12 }), '04-recovered.snapshot.json');
  work(recovered, [0, 1, 2, 3], [4], edited); flow.recovered = proveSnapshot(recovered, DEFAULTS);
  exactData(recovered.bodies, baseline.bodies); exactData(recovered.evidence, baseline.evidence);
  assert.equal(recovered.save(), baseline.save()); unchangedAll();
  const rectangle = stage('modelCalls', '5 rectangle Y180 pivot16/0/4', pivotedRectangle(cad).build, '05-rectangle.snapshot.json');
  work(rectangle, [], [0, 1, 2]); flow.rectangle = proveSnapshot(rectangle, {}, 'rectangle');
  const rectanglePreview = stage('tessellations', 'pivot rectangle genuine12triangle preview',
    () => tessellateConvexPlanarSolid(rectangle.bodies.rotated.native, { maximumFanTriangles: 40 }), 'rectangle-rotated.preview.json');
  flow.rectanglePreview = provePreview(rectanglePreview, rectangle.bodies.rotated.native);
  const gusset = stage('modelCalls', '6 constrained gusset Z270 pivot20/12/0', pivotedGusset(cad).build, '06-gusset.snapshot.json');
  work(gusset, [], [0, 1, 2]); flow.gusset = proveSnapshot(gusset, { width: 40, height: 24 }, 'gusset');
  const placed = stage('modelCalls', '7 exact pivot rail followed by terminal placement40/16/0',
    pivotedRail(cad, true).build, '07-placed.snapshot.json');
  work(placed, [], [0, 1, 2, 3, 4, 5]); flow.placed = proveSnapshot(placed, DEFAULTS, 'placed'); unchangedAll();
  exactData([flow.modelCalls, flow.tessellations], [7, 2]);
  assert.equal(flow.stages.filter(item => item.outcome === 'threw').length, 1);
  flow.accounting = accounting(flow.returnedLedgers, SOURCE_LEDGER_COUNTS); exactData(flow.accounting, SOURCE_TOTALS);
  finish(); console.log(signedData({ status: flow.status, modelCalls: flow.modelCalls, tessellations: flow.tessellations, accounting: flow.accounting }));
} catch (error) { fail(error); throw error; }

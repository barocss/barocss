import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { translatedPair, thinPlate, provePair, proveThin, proveExport, proveCollapse, decodeBinaryStl,
  hold, unchanged, signedData, sha256, dataHash, exactData, snapshotData, errorData,
  checkProcess, recorder, accounting, SOURCE_ACCOUNTING } from './modeling-stl-fixture.mjs';

// Exactly two public model evaluations and three exports. Each export owns its
// one genuine tessellation; no separate validator, mass query or preview call.
checkProcess(); assert.equal(process.argv.length, 2);
assert.ok(process.env.CAD_MODEL_TEST_MODULE); assert.ok(process.env.CAD_MODEL_EVIDENCE_DIR);
const entry = resolve(process.env.CAD_MODEL_TEST_MODULE), directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR);
const { flow, artifact, stage, finish, fail, write } = recorder(directory, 'source', { entrySHA256: sha256(readFileSync(entry)) });
let pair, beforePair, left, right, leftBytes, rightBytes, thin, beforeThin;
function preserveAccepted(reason) {
  if (pair) {
    artifact('after-refusal.pair.snapshot.json', snapshotData(pair), reason + ': complete accepted pair');
    artifact('after-refusal.pair.cad-model.json', pair.save(), reason + ': actual authored save', true);
    if (beforePair) unchanged(pair, beforePair);
  }
  if (thin) {
    artifact('after-refusal.thin.snapshot.json', snapshotData(thin), reason + ': accepted thin native model');
    if (beforeThin) unchanged(thin, beforeThin);
  }
  for (const [name, result, original] of [['left', left, leftBytes], ['right', right, rightBytes]]) if (result) {
    artifact('after-refusal.' + name + '.export.json', result, reason + ': previous successful complete STL result');
    exactData(result.bytes, original); assert.equal(sha256(Buffer.from(result.bytes)), flow.artifacts['baseline-' + name + '.stl'].sha256);
  }
}
let preserved = false;
try {
  const { cad, CadModelError } = await import(pathToFileURL(entry).href);
  pair = stage('modelCalls', '1 exact #1880 gusset pair at [48,-0,0]', () => translatedPair(cad).build(), '01-baseline.snapshot.json');
  artifact('initial.cad-model.json', pair.save(), 'actual signed-zero authored baseline, only CAD input for cold load', true);
  beforePair = hold(pair);
  left = stage('exportCalls', '1 named left export with one inherent tessellation', () => pair.exportStl('left'), 'baseline-left.export.json', 'baseline-left.stl');
  leftBytes = [...left.bytes];
  right = stage('exportCalls', '2 named right export with one inherent tessellation', () => pair.exportStl('right'), 'baseline-right.export.json', 'baseline-right.stl');
  rightBytes = [...right.bytes];
  // Both actual packets and complete STL bytes precede every geometry oracle.
  flow.baseline = provePair(pair);
  const historicalBytes = readFileSync(new URL('./modeling-translation-evidence/01-baseline.snapshot.json', import.meta.url));
  const historical = JSON.parse(historicalBytes);
  exactData(snapshotData(pair), historical, 'complete unchanged adopted #1880 baseline authored/native data');
  flow.historicalParent = { issue: 1880, dependencyCommit: '31ad07d5234326bf68b937c070000e94d2c45501', snapshotSHA256: sha256(historicalBytes), exactParity: true };
  flow.exports = { left: proveExport(left, pair, 'left'), right: proveExport(right, pair, 'right') };
  assert.notDeepEqual(left.bytes, right.bytes, 'translated coordinates remain translated');
  assert.notEqual(left.bytes, right.bytes); assert.notEqual(left.details.native, right.details.native);
  unchanged(pair, beforePair);
  const leftDecoded = decodeBinaryStl(left.bytes), rightDecoded = decodeBinaryStl(right.bytes);
  for (const [i, facet] of leftDecoded.facets.entries()) {
    exactData(rightDecoded.facets[i].normal, facet.normal);
    exactData(rightDecoded.facets[i].points, facet.points.map(p => [p[0] + 48, p[1], p[2]]));
  }
  flow.baselineSnapshotSHA256 = dataHash(snapshotData(pair)); flow.baselineBodiesSHA256 = dataHash(pair.bodies);
  flow.baselineEvidenceSHA256 = dataHash(pair.evidence);
  artifact('baseline-transfer.json', { ...snapshotData(pair), summary: flow.baseline,
    exports: { left, right }, translationLineage: pair.evidence[2].native.lineage,
    outputIdentities: Object.fromEntries(Object.entries(pair.bodies).map(([name, body]) => [name,
      { family: body.family, solidId: body.native.request.options.solidId, sourceIds: body.native.request.assets.map(a => a.sourceId) }])),
    basis: 'authored XYZ; no axis conversion, recentering, scaling or welding',
    scope: 'actual CAD save, both owned native bodies, full source/mesh/encoding lineage and STL bytes; no editor or physical acceptance' },
  'retained complete actual pair, authored text, translation lineage and both successful binary STL exports for later consumers');

  thin = stage('modelCalls', '2 exact 2x2 affine prism, height1/4096, from9999', () => thinPlate(cad).build(), '02-thin.snapshot.json');
  artifact('thin.cad-model.json', thin.save(), 'actual authored accepted thin prism; never tuned after refusal', true);
  beforeThin = hold(thin);
  let refusal;
  try {
    stage('exportCalls', '3 genuine thin-prism Float32 facet COLLAPSE', () => thin.exportStl('thin'), 'thin.unexpected-export.json', 'thin.unexpected.stl');
  } catch (error) { refusal = error; }
  // First refusal/progress already persisted by stage, before any refusal check.
  preserved = true; preserveAccepted('state retained after first thin export outcome');
  if (refusal) { flow.originalEncodingFailure = errorData(refusal); write(); }
  flow.thin = proveThin(thin); flow.collapse = proveCollapse(refusal, CadModelError, thin);
  artifact('thin.completed-native-mesh.json', refusal.cause.progress.native, 'complete genuine mesh retained by the encoder refusal');
  artifact('thin.encoding-progress.json', refusal.cause.progress, 'original exact per-vertex loss and facet progress with null bytes');
  assert.equal(flow.modelCalls, 2); assert.equal(flow.exportCalls, 3); assert.equal(flow.tessellations, 3);
  assert.equal(flow.stages.filter(s => s.outcome === 'threw').length, 1);
  flow.accounting = accounting(flow.returnedLedgers, [2, 2, 1, 1, 1, 3]); exactData(flow.accounting, SOURCE_ACCOUNTING);
  flow.acceptedSnapshotsAndPreviousBytesPreserved = true; finish();
  console.log(signedData({ status: flow.status, modelCalls: flow.modelCalls, exportCalls: flow.exportCalls,
    tessellations: flow.tessellations, collapse: flow.collapse.code, accounting: flow.accounting, nativeElapsedMS: flow.nativeElapsedMS }));
} catch (error) {
  // Keep the original failure primary, even if a secondary preservation oracle
  // fails. No replacement specimen, retry, extra export or extra model follows.
  fail(error);
  if (!preserved) {
    try { preserveAccepted('state retained on first campaign failure'); }
    catch (preservationError) { flow.preservationFailure = errorData(preservationError); write(); }
  }
  throw error;
}

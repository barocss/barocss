import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULTS, EXPECTED_TOTALS, proveSnapshot, work, snapshotData, signedData, sha256, dataHash,
  exactData, emptyLedgers, accounting, recorder } from './modeling-mirror-fixture.mjs';

// The only emitted native call: original baseline cold-load in a fresh process.
// JSON replay supplies data comparisons, never frozen-object or identity claims.
assert.ok(process.env.CAD_MODEL_TEST_MODULE); assert.ok(process.env.CAD_MODEL_EVIDENCE_DIR);
const entry = resolve(process.env.CAD_MODEL_TEST_MODULE), directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR);
assert.equal(entry.endsWith('/dist/index.js'), true, 'Cold authority is the checked emitted public index');
const sourceBytes = readFileSync(resolve(directory, 'source-flow.json')), source = JSON.parse(sourceBytes);
assert.equal(source.status, 'passed'); assert.equal(source.issue, 1962); exactData([source.modelCalls, source.tessellations], [6, 2]);
const { flow, artifact, stage, fail, finish } = recorder('cold', entry, directory, source);
try {
  assert.notEqual(flow.processInstanceId, source.processInstanceId); assert.notEqual(flow.processId, source.processId);
  flow.sourceFlowSHA256 = sha256(sourceBytes);
  const saved = readFileSync(resolve(directory, 'initial.cad-model.json'), 'utf8');
  assert.equal(sha256(saved), source.artifacts['initial.cad-model.json'].sha256);
  const baselineBytes = readFileSync(resolve(directory, '01-baseline.snapshot.json'));
  assert.equal(sha256(baselineBytes), source.artifacts['01-baseline.snapshot.json'].sha256);
  const baseline = JSON.parse(baselineBytes); assert.equal(saved, baseline.text);
  const { cad } = await import(pathToFileURL(entry).href);
  const cold = stage('modelCalls', '7 fresh emitted original baseline cold load', () => cad.load(saved), '07-cold.snapshot.json');
  // This is a genuine new object graph: only this actual process proves freeze.
  work(cold, [], [0, 1, 2, 3, 4]); flow.baseline = proveSnapshot(cold, DEFAULTS);
  exactData(snapshotData(cold), baseline); assert.equal(cold.save(), saved);
  assert.equal(dataHash(snapshotData(cold)), source.baselineSnapshotSHA256);
  assert.equal(dataHash(cold.bodies), source.baselineBodiesSHA256); assert.equal(dataHash(cold.evidence), source.baselineEvidenceSHA256);
  flow.parity = { canonicalSave: true, parameters: true, bodies: true, evidence: true, fullBaselineSnapshot: true,
    parsedReplayScope: 'data equality only; no process identity or freeze claim', freshProcessFullRebuild: true };
  artifact('cold.cad-model.json', cold.save(), 'actual fresh emitted baseline save', true);
  exactData([flow.modelCalls, flow.tessellations], [1, 0]); assert.equal(flow.stages.length, 1); assert.equal(flow.stages[0].outcome, 'returned');
  flow.accounting = accounting(flow.returnedLedgers, [1, 1, 1, 1, 1, 1, 1, 0]);
  exactData(flow.accounting, { returnedLedgerSourceCompilations: 94, returnedLedgerBindingObservations: 1134, returnedLedgerD1: 3402,
    knownSourceCompilations: 103, combinedBindingObservations: 1242, knownD1: 3726, initialFaceConstructionCount: 8, fullTransitiveNativeCoverage: 'NOT_MEASURED' });
  const combined = emptyLedgers();
  for (const key of Object.keys(combined)) combined[key] = [...source.returnedLedgers[key], ...flow.returnedLedgers[key]];
  flow.campaignAccounting = accounting(combined, [4, 4, 2, 4, 6, 6, 6, 2]); exactData(flow.campaignAccounting, EXPECTED_TOTALS);
  flow.campaignModelCalls = source.modelCalls + flow.modelCalls; assert.equal(flow.campaignModelCalls, 7);
  flow.campaignTessellations = source.tessellations + flow.tessellations; assert.equal(flow.campaignTessellations, 2);
  finish(); console.log(signedData({ status: flow.status, modelCalls: flow.modelCalls, campaignModelCalls: flow.campaignModelCalls, accounting: flow.campaignAccounting }));
} catch (error) { fail(error); throw error; }

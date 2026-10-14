import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULTS, COLD_TOTALS, COLD_LEDGER_COUNTS, EXPECTED_TOTALS, CAMPAIGN_LEDGER_COUNTS,
  proveSnapshot, work, snapshotData, signedData, sha256, dataHash, exactData, emptyLedgers, accounting,
  recorder } from './modeling-rotation-pivot-fixture.mjs';

// Exactly one fresh emitted rebuild; parsed source packets prove data equality.
assert.ok(process.env.CAD_MODEL_TEST_MODULE); assert.ok(process.env.CAD_MODEL_EVIDENCE_DIR);
const entry = resolve(process.env.CAD_MODEL_TEST_MODULE), directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR);
assert.ok(entry.endsWith('/dist/index.js'));
const sourceBytes = readFileSync(resolve(directory, 'source-flow.json')), source = JSON.parse(sourceBytes);
assert.equal(source.status, 'passed'); assert.equal(source.issue, 2015); exactData([source.modelCalls, source.tessellations], [7, 2]);
const { flow, artifact, stage, fail, finish } = recorder('cold', entry, directory, source);
try {
  assert.notEqual(flow.processId, source.processId); assert.notEqual(flow.processInstanceId, source.processInstanceId);
  flow.sourceFlowSHA256 = sha256(sourceBytes);
  const saved = readFileSync(resolve(directory, 'initial.cad-model.json'), 'utf8');
  const baselineBytes = readFileSync(resolve(directory, '01-baseline.snapshot.json'));
  assert.equal(sha256(saved), source.artifacts['initial.cad-model.json'].sha256);
  assert.equal(sha256(baselineBytes), source.artifacts['01-baseline.snapshot.json'].sha256);
  const baseline = JSON.parse(baselineBytes); assert.equal(baseline.text, saved);
  const { cad } = await import(pathToFileURL(entry).href);
  const cold = stage('modelCalls', '8 fresh emitted original pivot rail cold load', () => cad.load(saved), '08-cold.snapshot.json');
  work(cold, [], [0, 1, 2, 3, 4]); flow.baseline = proveSnapshot(cold, DEFAULTS);
  exactData(snapshotData(cold), baseline); assert.equal(cold.save(), saved);
  assert.equal(dataHash(snapshotData(cold)), source.baselineSnapshotSHA256);
  assert.equal(dataHash(cold.bodies), source.baselineBodiesSHA256); assert.equal(dataHash(cold.evidence), source.baselineEvidenceSHA256);
  artifact('cold.cad-model.json', cold.save(), 'actual fresh emitted canonical save', true);
  flow.parity = { canonicalSave: true, parameters: true, bodies: true, evidence: true, fullSnapshot: true,
    freshProcessFullRebuild: true, parsedReplayScope: 'data equality only; no parsed-object identity or freeze claim' };
  exactData([flow.modelCalls, flow.tessellations], [1, 0]); assert.equal(flow.stages[0].outcome, 'returned');
  flow.accounting = accounting(flow.returnedLedgers, COLD_LEDGER_COUNTS); exactData(flow.accounting, COLD_TOTALS);
  const combined = emptyLedgers();
  for (const key of Object.keys(combined)) combined[key] = [...source.returnedLedgers[key], ...flow.returnedLedgers[key]];
  flow.campaignAccounting = accounting(combined, CAMPAIGN_LEDGER_COUNTS); exactData(flow.campaignAccounting, EXPECTED_TOTALS);
  flow.campaignModelCalls = source.modelCalls + flow.modelCalls; flow.campaignTessellations = source.tessellations + flow.tessellations;
  exactData([flow.campaignModelCalls, flow.campaignTessellations], [8, 2]);
  finish(); console.log(signedData({ status: flow.status, campaignModelCalls: 8, campaignTessellations: 2, accounting: flow.campaignAccounting }));
} catch (error) { fail(error); throw error; }

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULTS, EXPECTED_TOTALS, proveSnapshot, work, snapshotData, signedData, sha256, dataHash,
  exactData, emptyLedgers, accounting, recorder } from './modeling-linear-pattern-counts-fixture.mjs';

// Two fresh emitted rebuilds. Parsed source packets prove data equality only.
assert.ok(process.env.CAD_MODEL_TEST_MODULE); assert.ok(process.env.CAD_MODEL_EVIDENCE_DIR);
const entry = resolve(process.env.CAD_MODEL_TEST_MODULE), directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR);
assert.ok(entry.endsWith('/dist/index.js'));
const sourceBytes = readFileSync(resolve(directory, 'source-flow.json')), source = JSON.parse(sourceBytes);
assert.equal(source.status, 'passed'); assert.equal(source.issue, 2009);
exactData([source.modelCalls, source.tessellations], [7, 2]);
const { flow, artifact, stage, fail, finish } = recorder('cold', entry, directory, source);
try {
  assert.notEqual(flow.processId, source.processId); assert.notEqual(flow.processInstanceId, source.processInstanceId);
  flow.sourceFlowSHA256 = sha256(sourceBytes);
  const { cad } = await import(pathToFileURL(entry).href);
  const variants = [
    ['rail', 'initial.cad-model.json', '01-baseline.snapshot.json', '08-cold-rail.snapshot.json', DEFAULTS, [0, 1, 2, 3, 4], source.baselineSnapshotSHA256],
    ['rectangle', 'rectangle.cad-model.json', '05-rectangle.snapshot.json', '09-cold-rectangle.snapshot.json', {}, [0, 1, 2], source.rectangleSnapshotSHA256],
  ];
  flow.parity = {};
  for (const [variant, authoredName, rawName, coldName, parameters, features, snapshotSHA256] of variants) {
    const saved = readFileSync(resolve(directory, authoredName), 'utf8'), baselineBytes = readFileSync(resolve(directory, rawName));
    assert.equal(sha256(saved), source.artifacts[authoredName].sha256);
    assert.equal(sha256(baselineBytes), source.artifacts[rawName].sha256);
    const baseline = JSON.parse(baselineBytes); assert.equal(baseline.text, saved);
    const cold = stage('modelCalls', 'fresh emitted ' + variant + ' full cold rebuild', () => cad.load(saved), coldName);
    work(cold, [], features); flow[variant] = proveSnapshot(cold, parameters, variant);
    exactData(snapshotData(cold), baseline); assert.equal(cold.save(), saved);
    assert.equal(dataHash(snapshotData(cold)), snapshotSHA256);
    assert.equal(dataHash(cold.bodies), dataHash(baseline.bodies));
    assert.equal(dataHash(cold.evidence), dataHash(baseline.evidence));
    artifact('cold-' + variant + '.cad-model.json', cold.save(), 'actual fresh emitted save', true);
    flow.parity[variant] = { canonicalSave: true, parameters: true, bodies: true, evidence: true, fullSnapshot: true,
      freshProcessFullRebuild: true, parsedReplayScope: 'data equality only; no parsed-object identity, freeze or cache claim' };
  }
  exactData([flow.modelCalls, flow.tessellations], [2, 0]); assert.equal(flow.stages.length, 2);
  assert.ok(flow.stages.every(item => item.outcome === 'returned'));
  flow.accounting = accounting(flow.returnedLedgers, [2, 2, 1, 1, 6, 4, 4, 0]);
  exactData(flow.accounting, { returnedLedgerSourceCompilations: 165, returnedLedgerBindingObservations: 2034, returnedLedgerD1: 6102,
    knownSourceCompilations: 197, combinedBindingObservations: 2430, knownD1: 7290,
    initialFaceConstructionCount: 30, fullTransitiveNativeCoverage: 'NOT_MEASURED' });
  const combined = emptyLedgers();
  for (const key of Object.keys(combined)) combined[key] = [...source.returnedLedgers[key], ...flow.returnedLedgers[key]];
  flow.campaignAccounting = accounting(combined, [6, 6, 3, 3, 28, 19, 19, 2]);
  exactData(flow.campaignAccounting, EXPECTED_TOTALS);
  flow.campaignModelCalls = source.modelCalls + flow.modelCalls;
  flow.campaignTessellations = source.tessellations + flow.tessellations;
  exactData([flow.campaignModelCalls, flow.campaignTessellations], [9, 2]);
  finish(); console.log(signedData({ status: flow.status, campaignModelCalls: 9, campaignTessellations: 2, accounting: flow.campaignAccounting }));
} catch (error) { fail(error); throw error; }

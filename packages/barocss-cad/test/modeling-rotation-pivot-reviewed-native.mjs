import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULTS, EDITED, SOURCE_TOTALS, SOURCE_LEDGER_COUNTS, pivotedRail, proveSnapshot, provePivot, authoredDocument,
  work, signedData, sha256, exactData, accounting, emptyLedgers, recorder } from './modeling-rotation-pivot-reviewed-fixture.mjs';

// Reviewed continuation: exactly ONE unspent placement model; ZERO previews.
// Retained parsed packets prove data/math only, never original identity/freeze.
const entry = resolve(process.env.CAD_MODEL_TEST_MODULE), directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR);
const firstDirectory = resolve(process.env.CAD_PIVOT_FIRST_DIR);
const firstBytes = readFileSync(resolve(firstDirectory, 'source-flow.json')), first = JSON.parse(firstBytes);
assert.equal(first.issue, 2015); assert.equal(first.status, 'failed'); exactData([first.modelCalls, first.tessellations], [6, 2]);
assert.equal(first.failure.message, 'normal direction (native arithmetic may choose zero sign)');
const { flow, artifact, stage, fail, finish } = recorder('source', entry, directory, first);
try {
  flow.continuationLimits = { modelCalls: 1, tessellations: 0 }; flow.firstSourceFlowSHA256 = sha256(firstBytes);
  const retained = {};
  for (const [name, parameters, variant] of [
    ['01-baseline.snapshot.json', DEFAULTS, 'rail'], ['02-edited.snapshot.json', EDITED, 'rail'],
    ['04-recovered.snapshot.json', DEFAULTS, 'rail'], ['05-rectangle.snapshot.json', {}, 'rectangle'],
    ['06-gusset.snapshot.json', { width: 40, height: 24 }, 'gusset'],
  ]) {
    const bytes = readFileSync(resolve(firstDirectory, name)); assert.equal(sha256(bytes), first.artifacts[name].sha256);
    const raw = JSON.parse(bytes), index = variant === 'rail' ? 4 : 2, native = raw.evidence[index].native;
    const document = authoredDocument(parameters, variant); assert.equal(raw.text, signedData(document) + '\n');
    exactData(raw.parameters, parameters); exactData(raw.bodies.rotated.native, native.solid);
    const pivot = variant === 'rail' ? [16, parameters.pivotY, 4] : variant === 'rectangle' ? [16, 0, 4] : [20, 12, 0];
    retained[name] = provePivot(native, raw.bodies.original.native, native.request.spec, pivot, true);
  }
  flow.retainedData = { packets: retained, scope: 'exact retained data/math only; no new original object identity/freeze/cache proof' };
  const { cad } = await import(pathToFileURL(entry).href);
  assert.equal(flow.modelCalls, 0);
  const placed = stage('modelCalls', '7 only unspent pivot rail terminal placement40/16/0',
    pivotedRail(cad, true).build, '07-placed.snapshot.json');
  work(placed, [], [0, 1, 2, 3, 4, 5]); flow.placed = proveSnapshot(placed, DEFAULTS, 'placed');
  exactData([flow.modelCalls, flow.tessellations], [1, 0]);
  const combined = emptyLedgers();
  for (const key of Object.keys(combined)) combined[key] = [...first.returnedLedgers[key], ...flow.returnedLedgers[key]];
  flow.accounting = accounting(combined, SOURCE_LEDGER_COUNTS); exactData(flow.accounting, SOURCE_TOTALS);
  finish();
  const aggregate = { ...first, status: 'passed', kind: 'reviewed-retained-source-and-unspent-continuation',
    originalSourceStatus: first.status, originalFailure: first.failure, modelCalls: 7, tessellations: 2,
    nativeElapsedMS: first.nativeElapsedMS + flow.nativeElapsedMS, returnedLedgers: combined,
    accounting: flow.accounting, placed: flow.placed, retainedData: flow.retainedData,
    originalSourceFlowSHA256: sha256(firstBytes), continuationProcessId: flow.processId,
    scope: 'original first failure preserved; no spent provider calls repeated; old parsed data has no lifecycle proof' };
  artifact('reviewed-source-flow.json', aggregate, 'reviewed aggregate; original failed source-flow remains unchanged');
  console.log(signedData({ status: flow.status, newModelCalls: 1, newTessellations: 0, reviewedSourceModelCalls: 7, accounting: flow.accounting }));
} catch (error) { fail(error); throw error; }

// Verify the authoritative #457 research result. Does not generate browser evidence.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ARMS, REPEATS, VIEWPORTS } from './baseline.mjs';
import { CASES, PLANNED_CELLS, supportFor } from './cases.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const baselineBytes = fs.readFileSync(path.join(here, 'baseline.json'));
const baselineSha = sha(baselineBytes);
const baseline = JSON.parse(baselineBytes);
const evidence = process.env.RESULT_DIR || path.join(here, 'evidence', `primary-${baselineSha.slice(0, 12)}`);
const report = JSON.parse(fs.readFileSync(path.join(evidence, 'result.json')));
const smoke = JSON.parse(fs.readFileSync(path.join(here, 'evidence/baseline-smoke.json')));
assert.equal(report.kind, 'bounded-authored-json-render-styling-comparison');
assert.equal(report.baselineSha256, baselineSha);
assert.equal(smoke.baselineSha256, baselineSha);
assert.equal(report.caseCount, CASES.length);
assert.equal(report.plannedCells, PLANNED_CELLS);
assert.equal(report.measuredCells, PLANNED_CELLS);
assert.equal(report.rows.length, PLANNED_CELLS);
assert.equal(report.repeats, REPEATS);
assert.equal(report.serial, true);
assert.deepEqual(report.arms, ARMS);
assert.deepEqual(report.viewports, VIEWPORTS);
assert.equal(report.artifactHashes.adapterSourceSha256, sha(fs.readFileSync(path.join(here, 'browser-app.jsx'))));
assert.equal(report.artifactHashes.casesSourceSha256, sha(fs.readFileSync(path.join(here, 'cases.mjs'))));
assert.equal(report.artifactHashes.runnerSourceSha256, sha(fs.readFileSync(path.join(here, 'run.mjs'))));
assert.equal(baseline.inventory.utility.cssSha256, baseline.inventory.build.cssSha256);
assert.equal(smoke.rows.length, ARMS.length * Object.keys(VIEWPORTS).length);
for (const viewport of Object.keys(VIEWPORTS)) {
  const sameViewport = smoke.rows.filter((row) => row.viewport === viewport);
  const initial = sameViewport[0].computed;
  for (const row of sameViewport) {
    assert.equal(row.schemaValid, true);
    assert.deepEqual(row.errors, []);
    assert.deepEqual(row.computed, initial);
    assert.ok(fs.existsSync(path.join(here, 'evidence', row.screenshot)));
  }
}
const expected = new Map();
for (const editCase of CASES) for (const viewport of Object.keys(VIEWPORTS)) for (const arm of ARMS) for (let repeat = 0; repeat < REPEATS; repeat++) {
  const id = `${editCase.id}--${viewport}--${arm}--${repeat}`;
  expected.set(id, { editCase, viewport, arm, repeat });
}
assert.equal(expected.size, PLANNED_CELLS);
const seen = new Set();
const expectedObservedBuild = new Set();
for (const viewport of Object.keys(VIEWPORTS)) for (let repeat = 0; repeat < REPEATS; repeat++) expectedObservedBuild.add(`dashboard-one-column--${viewport}--build--${repeat}`);
for (const row of report.rows) {
  assert.ok(expected.has(row.id), `unexpected cell ${row.id}`);
  assert.ok(!seen.has(row.id), `duplicate cell ${row.id}`);
  seen.add(row.id);
  const { editCase, viewport, arm, repeat } = expected.get(row.id);
  assert.equal(row.caseId, editCase.id);
  assert.equal(row.scenario, editCase.scenario);
  assert.equal(row.kind, editCase.kind);
  assert.equal(row.viewport, viewport);
  assert.equal(row.arm, arm);
  assert.equal(row.repeat, repeat);
  assert.deepEqual(row.support, supportFor(editCase, arm));
  assert.equal(row.specValid, true, row.id);
  assert.deepEqual(row.validationErrors, [], row.id);
  assert.equal(row.domPass, true, row.id);
  assert.equal(row.inputValuePreserved, true, row.id);
  assert.equal(row.focusPreserved, true, row.id);
  assert.equal(row.actionPass, true, row.id);
  assert.equal(row.themeAdherence, true, row.id);
  assert.equal(row.hostStyleDelta, false, row.id);
  assert.deepEqual(row.errors, [], row.id);
  assert.equal(row.frames.length, 4, row.id);
  assert.ok(Number.isInteger(row.unmetFrames) && row.unmetFrames >= 0 && row.unmetFrames <= 4, row.id);
  assert.equal(row.computed.matches, row.observedStylePass, row.id);
  assert.equal(row.computed.themeAdherence, true, row.id);
  assert.ok(Number.isInteger(row.ruleCount) && row.ruleCount > 0, row.id);
  assert.ok(Number.isInteger(row.cssomBytes) && row.cssomBytes > 0, row.id);
  assert.ok(Number.isInteger(row.inlineStyleBytes) && row.inlineStyleBytes >= 0, row.id);
  assert.equal(row.frozenCssBytes, baseline.inventory[arm].cssBytes, row.id);
  assert.ok(Number.isInteger(row.generatedRuleCount) && row.generatedRuleCount >= 0, row.id);
  assert.ok(Number.isInteger(row.generatedRuleBytes) && row.generatedRuleBytes >= 0, row.id);
  assert.equal(row.ruleCount - row.beforeEditCss.ruleCount, row.generatedRuleCount, row.id);
  assert.equal(row.cssomBytes - row.beforeEditCss.cssomBytes, row.generatedRuleBytes, row.id);
  if (arm === 'utility') {
    assert.ok(row.generatedRuleCount > 0 && row.generatedRuleBytes > 0, row.id);
  } else {
    assert.equal(row.generatedRuleCount, 0, row.id);
    assert.equal(row.generatedRuleBytes, 0, row.id);
  }
  if (row.support.supported) {
    assert.equal(row.outcome, 'pass', row.id);
    assert.equal(row.observedStylePass, true, row.id);
    assert.equal(row.coincidentalComputedMatch, false, row.id);
  } else {
    assert.equal(row.outcome, 'unsupported', row.id);
    assert.equal(row.coincidentalComputedMatch, row.observedStylePass, row.id);
    assert.equal(row.observedStylePass, expectedObservedBuild.has(row.id), row.id);
  }
  assert.ok(row.screenshot?.startsWith('shots/'), row.id);
  assert.ok(fs.existsSync(path.join(evidence, row.screenshot)), row.id);
}
assert.equal(seen.size, PLANNED_CELLS);
const shotFiles = fs.readdirSync(path.join(evidence, 'shots')).filter((name) => name.endsWith('.png'));
assert.equal(shotFiles.length, PLANNED_CELLS);
const policyNames = ['url-string', 'wrong-type', 'nonfinite', 'below-range', 'above-range', 'unknown-field'];
assert.deepEqual(report.policyNegatives.map((item) => item.name), policyNames);
for (const negative of report.policyNegatives) {
  assert.equal(negative.rejected, true, negative.name);
  assert.equal(negative.unchanged, true, negative.name);
  assert.ok(negative.validationErrors.length > 0, negative.name);
  assert.deepEqual(negative.errors, [], negative.name);
}
for (const arm of ARMS) {
  const cells = report.rows.filter((row) => row.arm === arm);
  assert.equal(cells.length, CASES.length * Object.keys(VIEWPORTS).length * REPEATS);
  const summary = report.summary[arm];
  assert.equal(summary.planned, cells.length);
  assert.equal(summary.supported, cells.filter((row) => row.support.supported).length);
  assert.equal(summary.pass, cells.filter((row) => row.outcome === 'pass').length);
  assert.equal(summary.observedRequirementMatch, cells.filter((row) => row.observedStylePass).length);
  assert.equal(summary.unsupported, cells.filter((row) => row.outcome === 'unsupported').length);
  assert.equal(summary.failure, 0);
  assert.equal(summary.coincidentalComputedMatch, cells.filter((row) => row.coincidentalComputedMatch).length);
}
assert.equal(report.summary.build.coincidentalComputedMatch, expectedObservedBuild.size);
console.log(`Verified ${report.rows.length}/${PLANNED_CELLS} cells, ${shotFiles.length} screenshots, six policy negatives, eight equal baseline cells and all CSSOM deltas.`);

import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bundleMaterialBench } from './build-material-bench.mjs';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { result, provenance } = await bundleMaterialBench(app, 'node');
const output = resolve(app, 'docs/.vitepress/cache/material-bench-consumer.mjs');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, result.outputFiles[0].contents);
const { createMaterialBench, blendSource, invalidSource, correctedSource } = await import(pathToFileURL(output));
const model = createMaterialBench();
assert.equal(model.report().accepted, null);
assert.deepEqual(model.report().calls, { compile: 0, validate: 0, lower: 0 });
const first = model.compile();
assert.equal(first.accepted.source, blendSource);
assert.deepEqual(first.diagnostics, []);
assert.deepEqual(first.accepted.ownership, { compiledDeeplyFrozen: true, validatedDeeplyFrozen: true, freshValidation: true });
assert.deepEqual(first.accepted.compiled, first.accepted.validated);
assert.notEqual(first.accepted.compiled, first.accepted.validated);
assert.deepEqual(first.accepted.lowered.uniformLayout, [{ name: 'amount', type: 'float', min: 0, max: 1, default: 0, glslName: 'mat_u_0' }]);
assert.equal(first.accepted.lowered.uniformDeclarations, 'uniform float mat_u_0;');
assert.match(first.accepted.lowered.expression, /mat_u_0/);
for (const index of [1, 2, 3, 0]) model.selectStage(index);
assert.deepEqual(model.report().calls, first.calls);
assert.deepEqual(model.report().accepted, first.accepted);
model.setDraft(invalidSource);
assert.deepEqual(model.report().calls, first.calls);
const refused = model.compile();
assert.deepEqual(refused.accepted, first.accepted);
assert.equal(refused.diagnostics[0].code, 'SYNTAX');
assert.equal(invalidSource.slice(refused.diagnostics[0].start, refused.diagnostics[0].end), 'unknown');
assert.deepEqual(refused.calls, { compile: 2, validate: 1, lower: 1 });
// Detached reports are APP-owned copies, independent of the public frozen IR.
const leaked = model.report();
leaked.accepted.compiled.uniforms[0].default = 99;
leaked.accepted.lowered.expression = 'changed';
leaked.diagnostics[0].message = 'changed';
leaked.calls.compile = 99;
assert.deepEqual(model.report(), refused);
model.setDraft(correctedSource);
const corrected = model.compile();
assert.deepEqual(corrected.calls, { compile: 3, validate: 2, lower: 2 });
assert.deepEqual(corrected.diagnostics, []);
assert.equal(corrected.accepted.source, correctedSource);
assert.equal(corrected.accepted.validated.uniforms[0].default, .5);
assert.equal(corrected.accepted.lowered.uniformLayout[0].default, .5);
assert.equal(corrected.accepted.lowered.expression, first.accepted.lowered.expression);
assert.notDeepEqual(corrected.accepted, first.accepted);
assert.throws(() => model.selectStage(4), RangeError);
assert.throws(() => model.setDraft(null), TypeError);
assert.deepEqual(model.report(), corrected);
// Static source checks establish structure only, never browser interaction acceptance.
const component = await readFile(resolve(app, 'docs/.vitepress/components/MaterialBench.vue'), 'utf8');
for (const token of ['role="tablist"', 'role="tab"', 'role="tabpanel"', 'ArrowRight', 'ArrowLeft', 'Home:', 'End:', 'prefers-reduced-motion: reduce']) assert.ok(component.includes(token), token);
assert.ok(!component.includes('v-html'));
const evidence = {
  schemaVersion: 1, scope: 'Cloud Node22 public source CPU consumer, not browser/device acceptance', provenance,
  flow: { first, refused, corrected },
  checks: { stageSelectionMakesNoCalls: true, draftEditingMakesNoCalls: true, genuineDiagnosticOffsets: true, completeAcceptedRetention: true, appReportCopyIsolation: true, publicDeepFreezeAndFreshReconstruction: true, sourceAccessibilityHooksPresent: true },
  unrun: ['Browser navigation and editing', 'Genuine keyboard interaction', 'Reduced-motion observation', 'Screenshot', 'GLSL execution', 'GPU device'],
  internalDelegation: 'At the pinned source, explicit validation recompiles the source; lowering validates and recompiles again. Direct APP counters do not instrument those internal calls.'
};
const destination = resolve(app, 'evidence/material-bench-consumer.json');
await writeFile(destination, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, directAppCalls: corrected.calls, statistics: corrected.accepted.statistics, provenance, evidence: destination }));

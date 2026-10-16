import test from 'node:test';
import assert from 'node:assert/strict';
import { impactForPaths } from './cad-impact-map.mjs';

test('a specific modeling mapping lists its pages for review', () => {
  const result = impactForPaths(['packages/barocss-cad/src/modeling.ts']);
  assert.deepEqual(result.impacts[0].documentation, [
    'docs/packages/cad/modeling.md', 'docs/packages/cad/quickstart.md', 'docs/packages/cad/capabilities.md',
  ]);
  assert.equal(result.impacts[0].status, 'review-required-not-proven-stale');
  assert.equal(result.nativeExecuted, false);
  assert.equal(result.browserExecuted, false);
});
test('changes are sorted, deduplicated, and scoped to CAD-family paths', () => {
  const result = impactForPaths([
    'packages/barocss-cad/src/modeling.ts', 'packages/barocss-cad/src/modeling.ts',
    'packages/barocss-gpu/src/index.ts', 'packages/barocss-cad-interop/src/loader.ts',
  ]);
  assert.equal(result.changedPaths, 3);
  assert.equal(result.impacts.length, 2);
  assert.deepEqual(result.unmapped, []);
});
test('removed editor paths are outside the CAD-family scope', () => {
  assert.deepEqual(impactForPaths(['packages/barocss-cad-editor/src/index.ts', 'apps/cad-editor/src/app.tsx']).impacts, []);
});
test('new CAD path without map fails visibly instead of silently disappearing', () => {
  assert.deepEqual(impactForPaths(['packages/barocss-cad/src/new-native-family.ts']).unmapped,
    ['packages/barocss-cad/src/new-native-family.ts']);
});
test('app documentation paths are review targets and not execution evidence', () => {
  const result = impactForPaths(['apps/library-docs/docs/packages/cad/modeling.md']);
  assert.equal(result.impacts.length, 1);
  assert.equal(result.reviewed, false);
});
test('refuse invalid file paths', () => {
  for (const path of ['/absolute', '../escape', 'bad\\windows']) {
    assert.throws(() => impactForPaths([path]));
  }
});

test('native modeling and bounded feature edits flag capability coverage for review only', () => {
  for (const path of ['packages/barocss-cad/src/modeling.ts','packages/barocss-cad/src/feature-graph.ts','packages/barocss-cad/src/boolean-graph.ts']) {
    const report=impactForPaths([path]);
    assert.ok(report.impacts[0].documentation.includes('docs/packages/cad/capabilities.md'),path);
    assert.equal(report.reviewed,false);
    assert.equal(report.browserExecuted,false);
  }
});

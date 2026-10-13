// Read-only regression guard for the beginner round-post lesson. Not a native/browser test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const lesson = read('apps/library-docs/docs/packages/cad-editor/round-post.md');
const firstLesson = read('apps/library-docs/docs/packages/cad-editor/first-model.md');
const guide = read('apps/library-docs/docs/packages/cad-editor/guides.md');
const modelUI = read('packages/barocss-cad-editor/src/react/modeling-editor.tsx');
const route = read('apps/cad-editor/src/app.tsx');
const reference = read('apps/library-docs/docs/packages/cad/modeling.md');
const fileReader = read('packages/barocss-cad-editor/src/modeling-file.ts');

for (const label of [
  'Model a part', 'Modeling examples', 'Choose an example', 'Create a round post',
  'Replace accepted model and discard its history and pending dimensions',
  'Load example', 'Visible output body', 'Named dimensions', 'Diameter',
  'Extrusion height', 'Optional center coordinates', 'Apply dimensions',
  'Discard draft', 'Undo', 'Redo', 'Save or open a model',
  'Download model', 'Choose model file', 'Saved model data', 'Open saved model',
]) {
  assert.ok(modelUI.includes(label), `Source UI label no longer exists: ${label}`);
  assert.ok(lesson.includes(label), `Round-post lesson misses source UI label: ${label}`);
}
assert.ok(route.includes("location.hash === '#/model'"), 'Modeling host route changed');
assert.ok(modelUI.includes('<option value="round-post">Create a round post</option>'));
assert.ok(modelUI.includes("roundPostDrivers") && modelUI.includes("accepted.parameters"));
assert.ok(modelUI.includes("setConfirmed(false); // Consent granted while a read was pending"));
assert.ok(modelUI.includes("await s.open(source)"), 'Model file accepted only on explicit Open');
assert.ok(fileReader.includes('MAX_MODELING_FILE_BYTES = 262144'));
assert.ok(fileReader.includes("new TextDecoder('utf-8', { fatal: true })"));

for (const sourceFact of [
  '[-2,-7,0]..[6,1,6]', '[0,-5,0]..[4,-1,9]',
  '98 vertices, 64 triangles', 'Certified volume is unavailable',
]) {
  assert.ok(reference.includes(sourceFact), `Reference evidence missing or changed: ${sourceFact}`);
}
for (const claim of [
  '[-2,-7,0]', '[6,1,6]', '[0,-5,0]', '[4,-1,9]',
  'stored-rational-circle-prism', 'Certified volume unavailable',
  '98 vertices, 64 triangles', 'not a claim of an npm-published',
  'Not verified in this documentation change:', 'a valid parent for cut',
  '0.001..10,000 mm', 'UNRUN',
]) {
  // Browser evidence is explicitly NOT claimed, so check the actual words rather than numeric-only acceptance.
  if (claim === 'UNRUN') {
    assert.ok(lesson.includes('Not verified in this documentation change:'));
  } else {
    assert.ok(lesson.includes(claim), `Missing round-post boundary: ${claim}`);
  }
}
assert.ok(guide.includes('./round-post'), 'Round-post lesson missing from guide entry');
const overview = read('apps/library-docs/docs/packages/cad-editor/index.md');
const nav = read('apps/library-docs/docs/.vitepress/config.mts');
assert.ok(overview.includes('./round-post'), 'Round-post lesson missing from overview');
assert.ok(nav.includes("'round-post': 'Create a round post'"), 'Round-post sidebar label missing');
assert.ok(nav.includes("['first-model', 'round-post']"), 'Round-post sidebar route missing');
assert.ok(firstLesson.includes('](./round-post)'), 'First-model lesson lacks follow-up');
assert.ok(lesson.includes('](./first-model)'), 'Round-post lesson lacks back navigation');
console.log('CAD Editor round-post lesson: read-only UI/source/reference drift PASS (no native/browser execution)');

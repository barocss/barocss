// Read-only documentation/source contract check; not native geometry or browser acceptance.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const lesson = read('apps/library-docs/docs/packages/cad-editor/mounting-plate.md');
const reference = read('apps/library-docs/docs/packages/cad/modeling.md');
const ui = read('packages/barocss-cad-editor/src/react/modeling-editor.tsx');
const fileReader = read('packages/barocss-cad-editor/src/modeling-file.ts');
const navigation = read('apps/library-docs/docs/.vitepress/config.mts');
const overview = read('apps/library-docs/docs/packages/cad-editor/index.md');
const host = read('apps/cad-editor/src/app.tsx');
for (const label of ['Model a part','Modeling examples','Choose an example',
  'Mounting plate with a through-hole','Load example','Visible output body',
  'Named dimensions','Apply dimensions','Discard draft','Undo','Redo',
  'Save or open a model','Download model','Choose model file',
  'Saved model data','Open saved model','Accepted model']) {
  assert.ok(ui.includes(label), 'UI label drift: ' + label);
  assert.ok(lesson.includes(label), 'Lesson lacks UI label: ' + label);
}
assert.ok(host.includes("location.hash === '#/model'"));
assert.ok(ui.includes('<option value="mounting-plate">Mounting plate with a through-hole</option>'));
assert.ok(ui.includes("stored-rational-plate-hole"));
assert.ok(ui.includes("Certified volume unavailable"));
assert.ok(fileReader.includes('MAX_MODELING_FILE_BYTES = 262144'));
assert.ok(fileReader.includes("new TextDecoder('utf-8', { fatal: true })"));
for (const evidence of ['80 × 40 × 8 mm','25600 mm³','256 display vertices and 128 triangles',
  'genus-one boundary','radius:18.75','centerX:32.5']) {
  assert.ok(reference.includes(evidence), 'Provider-backed reference changed: ' + evidence);
}
for (const term of ['25,600 mm³','Certified volume unavailable','256 display vertices',
  '128 triangles','7 native faces','centerX: 32.5','radius','manual-browser-1803',
  'file selection is not model acceptance']) {
  assert.ok(lesson.toLowerCase().includes(term.toLowerCase()), 'Lesson missing: ' + term);
}
const editorPages = navigation.match(/p === 'cad-editor' \? \[([^\]]+)\]/)?.[1] ?? '';
for (const page of ['first-model', 'round-post', 'mounting-plate']) assert.ok(editorPages.includes("'" + page + "'"), 'Missing sidebar page: ' + page);
assert.ok(navigation.includes("'mounting-plate': 'Build a mounting plate'"));
assert.ok(overview.includes('./mounting-plate'));
console.log('Mounting plate documentation source/label drift PASS (read-only, no browser/native execution)');

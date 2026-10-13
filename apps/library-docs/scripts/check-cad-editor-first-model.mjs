// Read-only UI/documentation drift check; no CAD execution or browser claim.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const guide = read('apps/library-docs/docs/packages/cad-editor/first-model.md');
const modelUI = read('packages/barocss-cad-editor/src/react/modeling-editor.tsx');
const route = read('apps/cad-editor/src/app.tsx');
const modeling = read('apps/library-docs/docs/packages/cad/modeling.md');
const intro = read('apps/library-docs/docs/packages/cad-editor/index.md');
const quickstart = read('apps/library-docs/docs/packages/cad-editor/quickstart.md');
const navigation = read('apps/library-docs/docs/.vitepress/config.mts');

// Fail when a visible label, route, or tutorial claim drifts.
for (const label of [
  'Model a part', 'Modeling examples', 'Choose an example', 'Cut an underside pocket',
  'Replace accepted model and discard its history and pending dimensions',
  'Load example', 'Apply dimensions', 'Discard draft', 'Undo', 'Redo',
  'Named dimensions', 'Visible output body', 'Choose one output to inspect',
  'Output bodies', 'Save or open a model', 'Show saved model', 'Download model',
  'Saved model data', 'Open saved model', 'Cancel computation',
]) {
  assert.ok(modelUI.includes(label), `CAD Editor UI label changed: ${label}`);
  assert.ok(guide.includes(label), `First-model guide lacks label: ${label}`);
}
assert.ok(route.includes("location.hash === '#/model'"), 'Model route changed');
assert.ok(guide.includes('http://127.0.0.1:52010/#/model'));
for (const result of ['5632 mm³', '5120 mm³', 'generic Open', 'tool', 'part', 'plate']) {
  assert.ok(guide.includes(result), `Missing tutorial expectation: ${result}`);
}
for (const sourceFact of ['5632 mm³', '5120 mm³', 'Cut an underside pocket']) {
  assert.ok(modeling.includes(sourceFact), `Modeling reference changed: ${sourceFact}`);
}
for (const text of [
  'a published product', 'does not by itself prove', 'not a saved mesh',
  'neither a top-opening pocket', 'browser', 'UNRUN', 'persistent topological face ID',
]) {
  assert.ok(guide.toLowerCase().includes(text.toLowerCase()), `Missing evidence/limit boundary: ${text}`);
}
assert.ok(intro.includes('./first-model'), 'Missing overview gateway');
assert.ok(quickstart.includes('./first-model'), 'Missing developer-page gateway');
assert.ok(navigation.includes("'first-model': 'First model in the UI'"), 'Missing navigation title');
assert.ok(navigation.includes("p === 'cad-editor' ? ['first-model']"), 'Missing navigation route');
console.log('CAD Editor first-model UI labels, source fixture, route and navigation: static PASS (no native/browser execution)');

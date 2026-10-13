// Read-only UI + fixture drift guard. Does not run CAD/renderer or verify browser.
import './check-cad-editor-slotted-bracket.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = p => readFileSync(resolve(root,p),'utf8');
const page = read('apps/library-docs/docs/packages/cad-editor/l-bracket.md');
const model = read('apps/library-docs/docs/packages/cad/modeling.md');
const ui = read('packages/barocss-cad-editor/src/react/modeling-editor.tsx');
const route = read('apps/cad-editor/src/app.tsx');
const nav = read('apps/library-docs/docs/.vitepress/config.mts');
const entry = read('apps/library-docs/docs/packages/cad-editor/index.md');
const fileReader = read('packages/barocss-cad-editor/src/modeling-file.ts');
for (const label of ['Model a part','Accepted model','Modeling examples','Choose an example','Fuse an L-bracket','Load example','Replace accepted model and discard its history and pending dimensions','Named dimensions','Dimension changes pending','Apply dimensions','Discard draft','Undo','Redo','Visible output body','Choose one output to inspect','Save or open a model','Download model','Choose model file','Saved model data','Open saved model']) {
  assert.ok(ui.includes(label), 'Missing actual UI label: ' + label);
  assert.ok(page.includes(label), 'Manual UI label drift: ' + label);
}
assert.ok(ui.includes('<option value="union-bracket">Fuse an L-bracket</option>'));
assert.ok(route.includes("location.hash === '#/model'"));
assert.ok(fileReader.includes('MAX_MODELING_FILE_BYTES = 262144'));
for (const item of ['3072 mm³','3584 mm³','4608 mm³','legMinX:32','legMinX:40','14 generated panels','base, bracket, leg']) {
  assert.ok(model.includes(item), 'Actual fixture changed: ' + item);
}
for (const item of ['3072 mm³','3584 mm³','4608 mm³','legMinX:32','legMinX:40','CONTACT','orthogonal-cell','UNRUN','base,bracket,leg']) {
  assert.ok(page.includes(item), 'Manual missing source-backed boundary: ' + item);
}
const editorPages = nav.match(/p === 'cad-editor' \? \[([^\]]+)\]/)?.[1] ?? '';
for (const page of ['first-model', 'round-post', 'mounting-plate', 'l-bracket']) assert.ok(editorPages.includes("'" + page + "'"), 'Missing sidebar page: ' + page);
assert.ok(nav.includes("'l-bracket': 'Fuse an L-bracket'"));
assert.ok(entry.includes('./l-bracket'));
console.log('CAD Editor L-bracket documentation source drift PASS; no native/browser execution');

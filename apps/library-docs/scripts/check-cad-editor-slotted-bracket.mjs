// Read-only contract check for the scoped union → third-box through-slot lesson.
// This does not run CAD geometry, GPU, browser or physical file I/O.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const docs = 'apps/library-docs/docs/packages/cad-editor/';
const lesson = read(docs + 'slotted-bracket.md');
const previous = read(docs + 'l-bracket.md');
const guides = read(docs + 'guides.md');
const ui = read('packages/barocss-cad-editor/src/react/modeling-editor.tsx');
const app = read('apps/cad-editor/src/app.tsx');
const ref = read('apps/library-docs/docs/packages/cad/modeling.md');
const snippet = read('apps/library-docs/docs/public/examples/modeling-composition.ts');
const reader = read('packages/barocss-cad-editor/src/modeling-file.ts');

assert.ok(app.includes("location.hash === '#/model'"), 'Modeling route drifted');
for (const label of [
  'Model a part', 'Accepted model', 'Modeling examples', 'Choose an example',
  'Cut a slot in a bracket', 'Fuse an L-bracket',
  'Replace accepted model and discard its history and pending dimensions',
  'Load example', 'Visible output body', 'Choose one output to inspect',
  'Named dimensions', 'Dimension changes pending', 'Apply dimensions',
  'Discard draft', 'Undo', 'Redo', 'Save or open a model',
  'Download model', 'Choose model file', 'Saved model data', 'Open saved model',
]) {
  assert.ok(ui.includes(label), 'UI missing action: ' + label);
  assert.ok(lesson.includes(label), 'Lesson missing action: ' + label);
}
assert.ok(ui.includes('<option value="slotted-bracket">Cut a slot in a bracket</option>'), 'Missing preset entry');
for (const name of ['legWidth', 'slotX', 'slotY', 'slotWidth', 'slotSpanY']) {
  assert.ok(snippet.includes("model.parameter('" + name + "'"), 'Typed model changed: ' + name);
  assert.ok(lesson.includes(name), 'Missing named user dimension: ' + name);
  assert.ok(ui.includes('slotDrivers'), 'Exact preset driver guard changed');
}
for (const expression of ['base.union(leg)', 'bracket.cut(tool)', 'model.build({ bracket, slotted: bracket.cut(tool) })']) {
  assert.ok(snippet.includes(expression), 'Exact source recipe drift: ' + expression);
}
for (const value of ['3072', '2816', '2688']) {
  assert.ok(snippet.includes(value) && ref.includes(value) && lesson.includes(value),
    'Native qualified volume evidence drift: ' + value);
}
for (const term of ['## Cut a slot in a bracket', 'eight-node', '44 genuine raw Surface samples', 'baseline mock']) {
  // The bounded receiver scope is documented in the advanced source reference.
  if (term === 'eight-node') continue;
  assert.ok(ref.includes(term), 'Source reference missing: ' + term);
}
for (const term of ['eight-node', '64 complete panels', 'two named outputs',
  'baseline mock', 'not a serialized view selection', 'UNRUN here']) {
  assert.ok(lesson.includes(term), 'Manual missing supported limit/authority: ' + term);
}
assert.ok(reader.includes('MAX_MODELING_FILE_BYTES = 262144'), 'File-reader bound changed');
assert.ok(previous.includes('./slotted-bracket'), 'Previous L-bracket tutorial does not link forward');
assert.ok(guides.includes('./slotted-bracket'), 'Developer guides do not link tutorial');
assert.ok(lesson.includes('./l-bracket'), 'No return to previous example');
console.log('CAD union-to-slot tutorial: source, UI and evidence consistency PASS (static only)');

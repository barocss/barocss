// Read-only source/Manual drift guard for the two scoped chamfer-to-split UI recipes.
// Does not execute geometry, sample a display, test a browser, or inspect physical files.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const base = 'apps/library-docs/docs/packages/cad-editor/';
const lesson = read(base + 'beveled-parametric-split.md');
const trouble = read(base + 'troubleshooting.md');
const nav = read(base + 'reference.md');
const ui = read('packages/barocss-cad-editor/src/react/modeling-editor.tsx');
const engine = read('packages/barocss-cad-editor/src/modeling-engine.ts');
const app = read('apps/cad-editor/src/app.tsx');
const cad = read('apps/library-docs/docs/packages/cad/modeling.md');
const bevel = read('apps/library-docs/docs/public/examples/modeling-chamfer-split.ts');
const derived = read('apps/library-docs/docs/public/examples/modeling-dimensions.ts');
const reader = read('packages/barocss-cad-editor/src/modeling-file.ts');
const requireTerm = (content,term,description) => assert.ok(content.includes(term), description + ': ' + term);

requireTerm(app, "location.hash === '#/model'", 'Workspace route drift');
for (const label of [
  'Model a part', 'Accepted model', 'Modeling examples', 'Choose an example',
  'Split a beveled part', 'Keep a beveled split centered',
  'Split axis for the new example', 'X · negative / positive', 'Z · negative / positive',
  'Named dimensions', 'Dimension changes pending', 'Apply dimensions',
  'Discard draft', 'Undo', 'Redo', 'Visible output body',
  'Choose one output to inspect', 'Load example',
  'Replace accepted model and discard its history and pending dimensions',
  'Save or open a model', 'Download model', 'Choose model file',
  'Saved model data', 'Open saved model',
]) {
  requireTerm(ui, label, 'Actual UI label drift');
  requireTerm(lesson, label, 'Lesson/UI mismatch');
}
for (const preset of [
  '<option value="chamfer-split">Split a beveled part</option>',
  '<option value="derived-split">Keep a beveled split centered</option>',
]) requireTerm(ui, preset, 'Preset option drift');

for (const term of [
  'frontDistance · front bevel distance', 'backDistance · back bevel distance',
  'splitAt · selected-axis split coordinate',
  'width · rail X size', 'offset · X displacement from center',
]) requireTerm(ui, term, 'Preset-specific inspector label drift');
requireTerm(engine, "createCadEditorChamferSplitModel", 'Beveled source model missing');
requireTerm(engine, "createCadEditorDerivedSplitModel", 'Owned dimension source model missing');
requireTerm(ui, "example === 'chamfer-split'", 'Split preset qualification drift');
requireTerm(ui, "example === 'derived-split'", 'Derived split preset qualification drift');
for (const term of [
  "parameter('frontDistance', 1)", "parameter('backDistance', 2)",
  "parameter('splitAt', axis === 'z' ? 4 : 16)",
  'finished.split({ axis, at: splitAt })', 'negative: parts.negative',
  'positive: parts.positive',
]) requireTerm(bevel,term,'Beveled public example changed');
for (const term of [
  "parameter('width', 32)", "parameter('offset', 0)",
  'model.dimension.add(model.dimension.scale(width, 0.5), offset)',
  "finished.split({ axis: 'x', at })", 'negative: parts.negative',
  'positive: parts.positive',
]) requireTerm(derived,term,'Centered public example changed');

for (const v of [
  '3032 / 3032', '1516 / 4548', '1496 / 4488',
  '2992 / 2992', '3072 / 2992',
]) {
  requireTerm(cad,v,'Beveled native fixture evidence changed');
  requireTerm(lesson,v,'Beveled lesson result missing');
}
for (const v of [
  '3790 / 2274', '4548 / 3032', '3790 / 3790',
]) {
  requireTerm(cad,v,'Centered native fixture evidence changed');
  requireTerm(lesson,v,'Centered lesson result missing');
}
for (const term of [
  '## Split a finished beveled part',
  '## Keep a beveled split centered as width changes',
  '32 expression-tree nodes and depth6', '±10000 mm', 'UNRUN',
]) requireTerm(cad,term,'CAD modeling reference changed');
for (const term of [
  'width × 0.5 + offset', 'SELECTION / split',
  '32 expression nodes, depth 6', '±10,000 mm',
  'no editable `splitAt` field', 'mocked Worker', 'UNRUN',
]) requireTerm(lesson,term,'Native/refusal boundary missing from lesson');

requireTerm(reader,'MAX_MODELING_FILE_BYTES = 262144','File-stage size guard drift');
requireTerm(reader,"new TextDecoder('utf-8', { fatal: true })",'File-stage UTF-8 guard drift');
requireTerm(trouble,'./beveled-parametric-split','Troubleshooting gateway missing');
requireTerm(nav,'./beveled-parametric-split','Reference gateway missing');
requireTerm(lesson,'./troubleshooting','Recovery link missing');
requireTerm(lesson,'./reference','Reference link missing');
console.log('CAD beveled/direct-versus-centered split: UI/typed-source/evidence/link static PASS; native/browser/GPU/file UNRUN');

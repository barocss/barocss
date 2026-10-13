// Read-only documentation guard for two beginner CAD Editor exercises.
// No CAD geometry evaluation, browser automation, GPU evidence or file I/O to user models.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const directory = 'apps/library-docs/docs/packages/cad-editor/';
const top = read(directory + 'top-entry-pocket.md');
const constrained = read(directory + 'constrained-plate.md');
const course = read(directory + 'learning-path.md');
const matrix = read(directory + 'feature-coverage.md');
const introduction = read(directory + 'index.md');
const sidebar = read('apps/library-docs/docs/.vitepress/config.mts');
const ui = read('packages/barocss-cad-editor/src/react/modeling-editor.tsx');
const route = read('apps/cad-editor/src/app.tsx');
const source = read('apps/library-docs/docs/packages/cad/modeling.md');
const topSnippet = read('apps/library-docs/docs/public/examples/modeling-top-pocket.ts');
const constrainedSnippet = read('apps/library-docs/docs/public/examples/modeling-constrained-profile.ts');
const fileReader = read('packages/barocss-cad-editor/src/modeling-file.ts');

const check = (value, description) => assert.ok(value, description);
check(route.includes("location.hash === '#/model'"), 'Missing actual CAD modeling host route');
for (const [label, page] of [
  ['Cut a top-entry pocket', top],
  ['Resize a constrained plate', constrained],
  ['Pocket depth downward from top Z=8', top],
  ['Tool Y origin', top], ['Tool Y span', top],
  ['Profile X width', constrained], ['Profile Y height', constrained],
]) {
  check(ui.includes(label), 'Missing UI label: ' + label);
  check(page.includes(label), 'Lesson missing current UI label: ' + label);
}
for (const [preset, option] of [
  ['topPocketDrivers', '<option value="top-entry-pocket">Cut a top-entry pocket</option>'],
  ['constrainedPlateDrivers', '<option value="constrained-plate">Resize a constrained plate</option>'],
]) {
  check(ui.includes(preset), 'Missing exact recipe qualification: ' + preset);
  check(ui.includes(option), 'Missing actual picker entry: ' + option);
}
for (const page of [top, constrained]) {
  for (const label of ['Modeling examples', 'Choose an example', 'Replace accepted model and discard its history and pending dimensions',
    'Load example', 'Accepted model', 'Dimension changes pending', 'Apply dimensions', 'Discard draft',
    'Undo', 'Redo', 'Visible output body', 'Save or open a model', 'Download model',
    'Choose model file', 'Saved model data', 'Open saved model']) {
    check(ui.includes(label), 'UI no longer contains required label: ' + label);
    check(page.includes(label), 'Lesson missing actual UI action: ' + label);
  }
  check(page.includes('UNRUN'), 'An external browser/device gap must remain explicit');
}
check(topSnippet.includes('model.dimension.add(8, model.dimension.scale(depth, -1))'),
  'Top-pocket authoritative derived start expression changed');
check(topSnippet.includes('return model.build({ plate, tool, part })'),
  'Top-pocket output authorship changed');
for (const amount of ['5632', '5376', '5120']) {
  check(source.includes(amount) && top.includes(amount),
    'Top-entry verified native volume documentation drift: ' + amount);
}
check(source.includes('## Cut a top-entry pocket'), 'Native top-pocket reference section absent');
check(top.includes('no separate free-standing'), 'Derived Z origin must not be presented as an independent input');
check(top.includes('64-panel'), 'Derived display budget omitted');
check(constrainedSnippet.includes('model.sketch.constrainedPolygon'),
  'Constrained polygon authoring family changed');
check(constrainedSnippet.includes("model.parameter('lockY', 0)"),
  'Constrained fixed-value assumption changed');
check(ui.includes("constrainedPlateDrivers") && ui.includes("accepted.parameters.lockY === 0"),
  'Hidden consistency driver is no longer properly qualified');
for (const amount of ['6144', '7680', '4096']) {
  check(source.includes(amount) && constrained.includes(amount),
    'Constrained plate native volume documentation drift: ' + amount);
}
check(source.includes('## Resize a constrained plate'), 'Constrained native guide absent');
check(constrained.includes('not exposed as an editable UI control'),
  'Internal consistency parameter must not be advertised as a control');
check(constrained.includes('not as the engine\'s direct rectangle sketch'),
  'Constrained profile must remain distinct from rectangle-only Booleans');
check(fileReader.includes('MAX_MODELING_FILE_BYTES = 262144'), 'File stage byte limit changed');
check(fileReader.includes("new TextDecoder('utf-8', { fatal: true })"),
  'File UTF-8 safety contract changed');
for (const [slug, title] of [
  ['top-entry-pocket', 'Cut a top-entry pocket'],
  ['constrained-plate', 'Resize a constrained plate'],
]) {
  check(sidebar.includes("'" + slug + "'"), 'Missing VitePress sidebar link: ' + slug);
  check(sidebar.includes("'" + slug + "': '" + title + "'"),
    'Missing actual VitePress page label: ' + slug);
  check(course.includes('](./' + slug + ')'), 'Missing six-lesson course link: ' + slug);
  check(matrix.includes('](./' + slug + ')'), 'Missing scoped feature coverage link: ' + slug);
  check(introduction.includes('](./' + slug + ')'), 'Missing package entrypoint link: ' + slug);
}
check(top.includes('](./constrained-plate)'), 'Top-entry guide must link to constrained next lesson');
check(constrained.includes('](./top-entry-pocket)'), 'Constrained guide must link back to prior lesson');
check(course.includes('**6. Constrained plate**'), 'Course is missing the sixth lesson');
check(course.includes('**5. Top-entry pocket**'), 'Course is missing the fifth lesson');
console.log('CAD Editor lessons 5–6: source-backed UI/navigation/evidence checks PASS (static only)');

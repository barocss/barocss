// Static-only drift gate for two user-oriented CAD Editor lessons.
// It DOES NOT execute native modeling, render pixels or open OS files.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = name => readFileSync(resolve(root, name), 'utf8');
const dir = 'apps/library-docs/docs/packages/cad-editor/';
const chamfer = read(dir + 'two-chamfers.md');
const split = read(dir + 'split-part.md');
const index = read(dir + 'examples.md');
const ui = read('packages/barocss-cad-editor/src/react/modeling-editor.tsx');
const route = read('apps/cad-editor/src/app.tsx');
const cad = read('apps/library-docs/docs/packages/cad/modeling.md');
const chamferSource = read('apps/library-docs/docs/public/examples/modeling-chamfer-chain.ts');
const splitSource = read('apps/library-docs/docs/public/examples/modeling-split.ts');
const fileReader = read('packages/barocss-cad-editor/src/modeling-file.ts');
const check = (value, message) => assert.ok(value, message);

check(route.includes("location.hash === '#/model'"), 'Modeling route changed');
for (const [page, label] of [[chamfer, 'Two chamfers on a part'], [split, 'Split a part']]) {
  for (const word of ['Model a part','Accepted model','Modeling examples',
    'Choose an example','Load example','Replace accepted model and discard its history and pending dimensions',
    'Named dimensions','Dimension changes pending','Apply dimensions','Discard draft',
    'Undo','Redo','Visible output body','Save or open a model',
    'Download model','Choose model file','Saved model data','Open saved model']) {
    check(ui.includes(word), 'Actual UI label changed: '+word);
    check(page.includes(word), 'Lesson is missing actual UI label: '+word);
  }
  check(page.includes(label), 'Lesson has incorrect preset label: '+label);
  check(page.includes('UNRUN'), 'Lesson must retain actual browser evidence limitation');
  check(page.includes('mocked Worker') || page.includes('mocked Worker'.toLowerCase()),
    'Explicit mock/real native evidence boundary missing');
}
check(ui.includes('<option value="two-chamfer">Two chamfers on a part</option>'), 'Chamfer picker changed');
check(ui.includes('<option value="horizontal-split">Split a part</option>'), 'Split picker changed');
check(ui.includes('Z · lower / upper'), 'Z split choice changed');
check(ui.includes('backY · edge-selection Y coordinate'), 'Second edge coordinate UI changed');
check(ui.includes('frontDistance · front bevel distance'), 'Front chamfer UI changed');
check(ui.includes('backDistance · back bevel distance'), 'Back chamfer UI changed');
for (const driver of ["parameter('frontDistance', 1)","parameter('backDistance', 2)","parameter('backY', 24)"]) {
  check(chamferSource.includes(driver), 'Typed chamfer source changed: '+driver);
}
check(chamferSource.includes('front.chamfer(front.edges('), 'Second edge must belong to first chamfer result');
for (const volume of ['6144','6064','5984','5936']) {
  check(cad.includes(volume) && chamfer.includes(volume), 'Chamfer fixture number drifted: '+volume);
}
for (const term of ['SELECTION','NATIVE','METRIC','PARAMETER','backY=0','backY=1','backDistance=0']) {
  check(chamfer.includes(term), 'Chamfer refusal boundary missing: '+term);
}
for (const term of ["parameter('height', 8)","parameter('splitHeight', 2)","blank.split({ axis: 'z', at: splitHeight })","lower: halves.negative","upper: halves.positive"]) {
  check(splitSource.includes(term), 'Typed split source changed: '+term);
}
for (const volume of ['1792','5376','3584','7168']) {
  check(cad.includes(volume) && split.includes(volume), 'Split fixture number drifted: '+volume);
}
check(split.includes('0 < splitHeight < height'), 'Split empty-side refusal contract missing');
check(split.includes('X · negative / positive') && split.includes('Y · negative / positive'),
  'Axis picker distinction missing');
check(cad.includes('## Chamfer two owned edges in sequence'), 'Chamfer native reference disappeared');
check(cad.includes('## Split a part into lower and upper bodies'), 'Split native reference disappeared');
check(index.includes('./two-chamfers') && index.includes('./split-part'), 'CAD Editor example links not wired');
check(chamfer.includes('./split-part') && split.includes('./two-chamfers'), 'Forward/back learning route broken');
check(fileReader.includes('MAX_MODELING_FILE_BYTES = 262144'), 'File byte limit changed');
check(fileReader.includes("new TextDecoder('utf-8', { fatal: true })"), 'UTF-8 staging semantics changed');
console.log('CAD two-chamfer / split lessons source and UI drift checks: PASS (static only)');

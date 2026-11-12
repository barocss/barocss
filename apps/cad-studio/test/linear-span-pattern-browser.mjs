import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const creationMode = process.argv[3] === '--create';
const pins = [
  'apps/cad-studio/test/linear-span-pattern-browser.mjs',
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  'apps/cad-studio/src/ui/Hud.tsx',
  'apps/cad-studio/src/ui/LinearSpanSpacing.tsx',
  'packages/barocss-cad-model/src/app/commands.ts',
  'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad-model/src/engine/linearSpanPattern.ts',
  'packages/barocss-cad-model/src/engine/migrate.ts',
  'packages/barocss-cad-model/src/engine/part.ts',
  'packages/barocss-cad/src/part/part-transform.ts',
];
const f = await createFlow({
  name: 'linear-span-pattern', output: process.argv[2], envFrozen: creationMode ? 'D835_SOURCE_FROZEN' : 'D834_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: creationMode ? 'Author fixed span in the actual command, switch modes, and verify preview refusal and the accepted native result.'
    : 'Open and edit a fixed-span row, preserve its extent across Count and source width changes, and reopen the saved project.',
  limits: ['One moved 10 × 6 × 8 mm rectangular seed. X direction, numeric 90 mm span, disjoint solids.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const pitch = JSON.parse(process.argv[3]);
const node = doc.nodes[2], { span, ...metadata } = node;
const [body, ...extra] = evaluateCadPart(toPartDocument(doc)).outputs;
const controlDoc = { ...doc, nodes: [...doc.nodes.slice(0, 2), { ...metadata, kind: 'linear-pattern', spacing: pitch }] };
const [control] = evaluateCadPart(toPartDocument(controlDoc)).outputs;
assert.equal(extra.length, 0);
assert.deepEqual(body.brep, control.brep);
const { brep } = body;
const pieces = brep.bodies.map(piece => {
  const shells = brep.shells.filter(shell => shell.body === piece.id);
  assert.equal(shells.length, 1);
  const [shell] = shells;
  const faces = brep.faces.filter(face => shell.faces.includes(face.id));
  const loops = new Set(faces.flatMap(face => face.loops));
  const coedges = new Set(brep.loops.filter(loop => loops.has(loop.id)).flatMap(loop => loop.coedges));
  const edges = new Set(brep.coedges.filter(coedge => coedges.has(coedge.id)).map(coedge => coedge.edge));
  const vertices = new Set(brep.edges.filter(edge => edges.has(edge.id)).flatMap(edge => edge.vertices));
  return { kind: piece.kind, closed: shell.closed, names: faces.map(face => face.name),
    corners: brep.vertices.filter(vertex => vertices.has(vertex.id)).map(vertex => vertex.point) };
});
console.log(JSON.stringify({ id: body.id, valid: checkOutput(body).valid, mass: massPropertiesOf(body), pieces }));
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
  }),
});
const name = 'D834-fixed-span.bcad', project = 'D834 span ' + randomUUID();
const documentAt = (width, count) => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: { p: 90 },
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [30, 10], max: [30 + width, 16] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 8 },
    { id: 'n2', kind: 'linear-span-pattern', parent: { node: 1, side: 'solid' }, axis: 'x', span: 90, count },
  ],
  outputs: { b2: { node: 2, side: 'solid' } }, nextId: 3,
});
const button = (panel, name) => panel.getByRole('button', { name, exact: true });
const field = (panel, name) => panel.getByLabel(name, { exact: true });
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const near = (a, b) => Math.abs(a - b) < 1e-8;
const open = async (name, doc) => {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
};

async function verify(label, width, offsets, pitch) {
  const doc = documentAt(width, offsets.length);
  if (creationMode) {
    await f.ready();
    assert.deepEqual(await f.doc(), doc);
  } else await f.same(doc);
  const native = await f.inspect(label, doc, pitch);
  assert.ok(native.valid);
  assert.equal(native.id, 'n2');
  assert.equal(native.pieces.length, offsets.length);
  const pieces = native.pieces.sort((a, b) => Math.min(...a.corners.map(p => p[0])) - Math.min(...b.corners.map(p => p[0])));
  for (const [index, offset] of offsets.entries()) {
    const piece = pieces[index], x0 = 30 + offset;
    const corners = [x0, x0 + width].flatMap(x => [10, 16].flatMap(y => [0, 8].map(z => [x, y, z])));
    assert.equal(piece.kind, 'solid');
    assert.ok(piece.closed);
    assert.equal(piece.names.length, 6);
    assert.ok(piece.names.includes('n1.top' + (index === 0 ? '' : '@' + index)));
    assert.equal(piece.corners.length, 8);
    assert.ok(corners.every(corner => piece.corners.some(point => point.every((value, axis) => near(value, corner[axis])))));
  }
  const volume = offsets.length * width * 48, centroid = [75 + width / 2, 13, 4];
  const { fresh, massReady, bodies } = await f.bodies();
  assert.ok(fresh && massReady);
  assert.deepEqual(bodies.map(body => body.key), ['b2']);
  for (const result of [native.mass, bodies[0]]) {
    assert.ok(near(result.volume, volume));
    assert.ok(result.centroid.every((value, axis) => near(value, centroid[axis])));
  }
  f.report.observations.push({ label, count: offsets.length, pitch, offsets, width: width + 90, volume, centroid, corners: offsets.length * 8 });
}

async function attachProject() {
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await field(versions(), 'Project').waitFor();
}

async function createFixedSpan() {
  const recipe = documentAt(10, 4);
  const seed = { ...recipe, nodes: recipe.nodes.slice(0, 2), outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 };
  const hud = () => f.page.getByRole('dialog', { name: 'Linear pattern', exact: true });
  const value = name => field(hud(), name);
  const apply = () => button(hud(), 'Apply');
  const state = label => f.page.waitForFunction(label => document.querySelector('.hud .status')?.textContent.trim() === label, label);
  f.phase = 'start a new row in the default spacing mode';
  await f.newPage();
  await open('D835-seed.bcad', seed);
  await f.same(seed);
  await f.page.locator('.outliner .ol-row > button.ol').click();
  await clickModelCommand(f.page, 'Pattern', 'Linear pattern');
  assert.equal(await value('Distance mode').inputValue(), 'spacing');
  await value('Count').fill('4');
  await value('Spacing').fill('30');
  await state('preview');
  const accepted = await f.snapshot('before-mode-switch');

  f.phase = 'switch to span and back with the same preview placement';
  await value('Distance mode').selectOption('span');
  assert.equal(await value('Total span').inputValue(), '90');
  assert.equal(await value('Spacing').textContent(), '30 mm');
  await state('preview');
  await value('Distance mode').selectOption('spacing');
  assert.equal(await value('Spacing').inputValue(), '30');
  await state('preview');
  await value('Distance mode').selectOption('span');
  await value('Count').fill('6');
  assert.equal(await value('Total span').inputValue(), '90');
  assert.equal(await value('Spacing').textContent(), '18 mm');
  await state('preview');
  await value('Result').selectOption('separate');
  assert.equal(await value('Distance mode').count(), 0);
  assert.equal(await value('Spacing').inputValue(), '18');
  await state('preview');
  await value('Result').selectOption('one');
  assert.equal(await value('Distance mode').inputValue(), 'spacing');
  await value('Distance mode').selectOption('span');
  assert.equal(await value('Total span').inputValue(), '90');
  await state('preview');

  f.phase = 'retire the prior preview when count or span is invalid';
  for (const [name, bad, restored, reason] of [
    ['Count', '1', '6', /whole-number Count from 2 to 24/],
    ['Count', '25', '6', /whole-number Count from 2 to 24/],
    ['Total span', '0', '90', /Total span must be a finite positive distance/],
  ]) {
    await value(name).fill(bad);
    await state('refused');
    assert.match(await hud().locator('.hud-error').textContent(), reason);
    assert.ok(await apply().isDisabled());
    await value(name).press('Enter');
    const after = await f.snapshot('refused-' + name.replace(' ', '-') + '-' + bad);
    for (const key of ['doc', 'history', 'historyControls', 'dirty', 'selection']) assert.deepEqual(after[key], accepted[key], key);
    assert.deepEqual(after.bodies.bodies, accepted.bodies.bodies);
    assert.deepEqual(after.bodies.colored, []);
    await value(name).fill(restored);
    await state('preview');
  }
  f.phase = 'apply a new six-copy row at a fixed 90 mm span';
  await apply().click();
  await hud().waitFor({ state: 'hidden' });
  const expectedOffsets = [0, 18, 36, 54, 72, 90];
  await verify('authored-six', 10, expectedOffsets, 18);
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.snapshot('authored-six-framed');
  await f.undo();
  await f.same(seed);
  await f.redo();
  await verify('first-redo', 10, expectedOffsets, 18);
  assert.deepEqual(f.report.downloads, []);
}

await f.run(async () => {
  if (creationMode) { await createFixedSpan(); return; }
  const four = documentAt(10, 4), six = documentAt(10, 6), wider = documentAt(12, 6);
  const offsets4 = [0, 30, 60, 90], offsets6 = [0, 18, 36, 54, 72, 90], offsets5 = [0, 22.5, 45, 67.5, 90];
  f.phase = 'Open a fixed-span model and edit Count without changing span';
  await f.newPage();
  await open(name, four);
  await verify('opened-four', 10, offsets4, 30);
  await f.openFeatureEditor(2, 'fixed span');
  assert.equal(await field(f.editor(), 'Total span').inputValue(), '90');
  assert.equal(await field(f.editor(), 'Spacing').textContent(), '30 mm');
  assert.equal(await field(f.editor(), 'Total span parameter').count(), 0);
  assert.equal(await field(f.editor(), 'Count parameter').count(), 0);
  await field(f.editor(), 'Count').fill('6');
  assert.equal(await field(f.editor(), 'Spacing').textContent(), '18 mm');
  await f.applyEditor(four, 'count-six');
  await verify('count-six', 10, offsets6, 18);

  f.phase = 'reject an invalid edited count and a contradictory saved spacing';
  await f.openFeatureEditor(2, 'invalid count');
  const beforeEdit = await f.snapshot('accepted-before-count-refusal');
  await field(f.editor(), 'Count').fill('1');
  await button(f.editor(), 'Apply').click();
  const error = f.editor().locator('.hud-error');
  await error.waitFor();
  assert.match(await error.textContent(), /whole-number Count from 2 to 64/i);
  const afterEdit = await f.snapshot('refused-count');
  for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty', 'selection']) assert.deepEqual(afterEdit[key], beforeEdit[key], key);
  await f.closeEditor();
  const beforeOpen = await f.snapshot('accepted-before-file-refusal');
  const contradictory = { ...six, nodes: [...six.nodes.slice(0, 2), { ...six.nodes[2], spacing: 30 }] };
  await open('D834-contradictory.bcad', contradictory);
  await f.waitToast(/total span has an unknown field/i);
  const afterOpen = await f.snapshot('refused-file');
  for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty', 'selection']) assert.deepEqual(afterOpen[key], beforeOpen[key], key);
  await f.undo();
  await verify('first-undo', 10, offsets4, 30);
  await f.redo();
  await verify('first-redo', 10, offsets6, 18);

  f.phase = 'edit upstream width without moving the first or last origin';
  await f.openFeatureEditor(1, 'seed width');
  await field(f.editor(), 'Width').fill('12');
  await f.applyEditor(six, 'wider-seed');
  await verify('wider-seed', 12, offsets6, 18);
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.snapshot('wider-framed');

  f.phase = 'save and reopen the actual project then edit Count again';
  await attachProject();
  await button(f.page, 'Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    return Array.from(new Uint8Array(await (await directory.getFileHandle(name)).getFile().then(file => file.arrayBuffer())));
  }, [project, name]));
  assert.deepEqual(JSON.parse(bytes), wider);
  f.report.files.push({ name, bytes: bytes.length, sha256: sha256(bytes) });
  await button(versions(), 'Close project').click();
  await field(versions(), 'Project').waitFor({ state: 'hidden' });
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await attachProject();
  await button(versions(), 'Open ' + name).click();
  await verify('reopened-six', 12, offsets6, 18);
  await f.openFeatureEditor(2, 'reopened Count');
  await field(f.editor(), 'Count').fill('5');
  assert.equal(await field(f.editor(), 'Spacing').textContent(), '22.5 mm');
  await f.applyEditor(wider, 'reopened-count-five');
  await verify('reopened-count-five', 12, offsets5, 22.5);
  assert.deepEqual(f.report.downloads, []);
});

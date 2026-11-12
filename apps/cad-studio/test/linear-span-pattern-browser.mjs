import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const creationMode = process.argv[3] === '--create';
const conversionMode = process.argv[3] === '--convert';
const handleBaseline = process.argv[3] === '--handle-baseline';
const handleMode = handleBaseline || process.argv[3] === '--handles';
const lifecycleMode = process.argv[3] === '--lifecycle';
const pins = [
  'apps/cad-studio/test/linear-span-pattern-browser.mjs',
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  'apps/cad-studio/src/ui/Hud.tsx',
  'apps/cad-studio/src/ui/LinearSpanSpacing.tsx',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'packages/barocss-cad-model/src/app/commands.ts',
  'packages/barocss-cad-model/src/app/editCommand.ts',
  'packages/barocss-cad-model/src/app/linearSpanHandles.ts',
  'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad-model/src/engine/linearSpanPattern.ts',
  'packages/barocss-cad-model/src/engine/migrate.ts',
  'packages/barocss-cad-model/src/engine/part.ts',
  'packages/barocss-cad/src/part/part-transform.ts',
];
const f = await createFlow({
  name: 'linear-span-pattern', output: process.argv[2], envFrozen: lifecycleMode ? 'D839_SOURCE_FROZEN' : handleMode ? 'D837_SOURCE_FROZEN' : conversionMode ? 'D836_SOURCE_FROZEN' : creationMode ? 'D835_SOURCE_FROZEN' : 'D834_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: lifecycleMode ? 'Create one actual fixed-span pattern and retain its authority through History, project Save and fresh Open.'
    : handleMode ? 'Use the actual Count and Total span handles without changing the other input.'
    : conversionMode ? 'Switch the stored distance authority in history, retain native placement, and refuse implicit unbinding.'
    : creationMode ? 'Author fixed span in the actual command, switch modes, and verify preview refusal and the accepted native result.'
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
const decision = lifecycleMode ? 'D839' : 'D834';
const name = decision + '-fixed-span.bcad', project = decision + ' span ' + randomUUID();
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

async function verify(label, width, offsets, pitch, doc = documentAt(width, offsets.length)) {
  if (creationMode || conversionMode || handleMode || lifecycleMode) {
    assert.deepEqual(await f.doc(), doc);
    await f.ready();
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
  const distance = offsets.at(-1);
  const volume = offsets.length * width * 48, centroid = [30 + (distance + width) / 2, 13, 4];
  const { fresh, massReady, bodies } = await f.bodies();
  assert.ok(fresh && massReady);
  assert.deepEqual(bodies.map(body => body.key), ['b2']);
  for (const result of [native.mass, bodies[0]]) {
    assert.ok(near(result.volume, volume));
    assert.ok(result.centroid.every((value, axis) => near(value, centroid[axis])));
  }
  f.report.observations.push({ label, count: offsets.length, pitch, offsets, width: width + distance, volume, centroid, corners: offsets.length * 8 });
}

async function attachProject() {
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await field(versions(), 'Project').waitFor();
}

async function saveProjectAndReopen(accepted) {
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
  assert.deepEqual(JSON.parse(bytes), accepted);
  f.report.files.push({ name, bytes: bytes.length, sha256: sha256(bytes) });
  await button(versions(), 'Close project').click();
  await field(versions(), 'Project').waitFor({ state: 'hidden' });
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await attachProject();
  await button(versions(), 'Open ' + name).click();
  await f.same(accepted);
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

async function convertDistanceMode() {
  const four = documentAt(10, 4), six = documentAt(10, 6);
  const legacy = (doc, spacing) => {
    const { span, ...node } = doc.nodes[2];
    assert.equal(span, 90);
    return { ...doc, nodes: [...doc.nodes.slice(0, 2), { ...node, kind: 'linear-pattern', spacing }] };
  };
  const initial = legacy(four, 30), spacingSix = legacy(six, 18), spacingFive = legacy(documentAt(10, 5), 18);
  const offsets4 = [0, 30, 60, 90], offsets6 = [0, 18, 36, 54, 72, 90], offsets5 = [0, 18, 36, 54, 72];
  const input = name => field(f.editor(), name);
  const mode = () => input('Distance mode');
  const commitEdit = async label => {
    f.phase = 'apply ' + label;
    const accepted = await f.doc();
    await button(f.editor(), 'Apply').click();
    await f.changed(accepted);
    await f.editor().waitFor({ state: 'hidden' });
    await f.snapshot(label);
  };
  f.phase = 'convert a saved spacing row to Total span through History';
  await f.newPage();
  await open('D836-spacing.bcad', initial);
  await f.same(initial);
  await verify('legacy-four', 10, offsets4, 30, initial);
  await f.openFeatureEditor(2, 'legacy mode');
  assert.equal(await mode().inputValue(), 'spacing');
  await mode().selectOption('span');
  assert.equal(await input('Total span').inputValue(), '90');
  assert.equal(await input('Spacing').textContent(), '30 mm');
  await f.same(initial);
  await commitEdit('converted-to-span');
  await verify('converted-to-span', 10, offsets4, 30, four);
  await f.undo();
  await verify('undo-mode', 10, offsets4, 30, initial);
  await f.redo();
  await verify('redo-mode', 10, offsets4, 30, four);
  await f.openFeatureEditor(2, 'six fixed-span copies');
  await input('Count').fill('6');
  await commitEdit('count-six-in-span');
  await verify('count-six-in-span', 10, offsets6, 18, six);

  f.phase = 'switch back to spacing and keep the six-copy placement';
  await f.openFeatureEditor(2, 'fixed mode');
  assert.equal(await mode().inputValue(), 'span');
  await mode().selectOption('spacing');
  assert.equal(await input('Spacing').inputValue(), '18');
  assert.equal(await input('Total span').count(), 0);
  await commitEdit('converted-to-spacing');
  await verify('converted-to-spacing', 10, offsets6, 18, spacingSix);
  await f.openFeatureEditor(2, 'five fixed-spacing copies');
  await input('Count').fill('5');
  await commitEdit('count-five-in-spacing');
  await verify('count-five-in-spacing', 10, offsets5, 18, spacingFive);

  f.phase = 'refuse conversion of a parameter-bound legacy spacing';
  const bound = { ...legacy(four, { parameter: 'pitch' }), parameters: { pitch: 30 } };
  await open('D836-bound-spacing.bcad', bound);
  await f.same(bound);
  await f.openFeatureEditor(2, 'bound spacing');
  const before = await f.snapshot('bound-before');
  assert.equal(await input('Spacing parameter').inputValue(), 'pitch');
  await mode().selectOption('span');
  assert.equal(await mode().inputValue(), 'spacing');
  assert.equal(await input('Spacing parameter').inputValue(), 'pitch');
  assert.ok(await input('Spacing').isDisabled());
  await f.editor().getByRole('status').getByText('Unbind Spacing before switching to Total span.').waitFor();
  assert.ok(await button(f.editor(), 'Apply').isDisabled());
  await mode().press('Enter');
  const after = await f.snapshot('bound-conversion-refused');
  for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty', 'selection']) assert.deepEqual(after[key], before[key], key);
  await f.closeEditor();
  await f.undo();
  await verify('first-undo-after-bound-refusal', 10, offsets5, 18, spacingFive);
  await f.redo();
  await verify('first-redo-after-bound-refusal', 10, offsets4, 30, bound);
  assert.deepEqual(f.report.downloads, []);
}

async function dragSpanHandles() {
  const four = documentAt(10, 4), six = documentAt(10, 6);
  const seed = { ...four, nodes: four.nodes.slice(0, 2), outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 };
  const hud = () => f.page.locator('.hud');
  const handle = key => f.page.locator(`g.gizmo-handle[data-handle="${key}"]`);
  const preview = () => f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent.trim() === 'preview');
  const frame = async () => {
    await button(f.page, 'Top').click();
    const ortho = button(f.page, 'Ortho');
    if (await ortho.getAttribute('aria-pressed') !== 'true') await ortho.click();
    await f.frame([[20, 13], [235, 13]]);
  };
  const drag = async (key, label, move, before) => {
    const arrow = handle(key);
    await arrow.waitFor();
    const tip = await arrow.locator('polygon').evaluate((el, baseline) => {
      if (baseline) {
        const end = el.points.getItem(0).matrixTransform(el.getScreenCTM());
        return [end.x, end.y];
      }
      const rect = el.getBoundingClientRect();
      return [rect.x + rect.width / 2, rect.y + rect.height / 2];
    }, handleBaseline);
    const p0 = await f.screenOf([110, 13]), p1 = await f.screenOf([110 + move, 13]);
    const end = tip.map((x, i) => x + p1[i] - p0[i]);
    for (const point of [tip, end]) assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.vp-canvas'), point));
    await f.page.mouse.move(...tip);
    await arrow.locator('..').locator(`g.hot[data-handle="${key}"]`).waitFor();
    await f.page.mouse.down();
    let held;
    try {
      await f.page.mouse.move(...end, { steps: 24 });
      await preview();
      held = Number(await field(hud(), label).inputValue());
      assert.deepEqual(await f.doc(), before);
    } finally { await f.page.mouse.up(); }
    await preview();
    const released = Number(await field(hud(), label).inputValue());
    assert.deepEqual(await f.doc(), before);
    f.report.observations.push({ label: 'drag-' + key, moveMm: move, held, released, tip, end });
    return [held, released];
  };
  const apply = async label => {
    const before = await f.doc();
    await button(hud(), 'Apply').click();
    await hud().waitFor({ state: 'hidden' });
    await f.changed(before);
    await f.snapshot(label);
  };
  f.phase = 'drag creation Count by two initial 30 mm intervals';
  await f.newPage();
  await open('D837-seed.bcad', seed);
  await f.same(seed);
  await frame();
  await f.page.locator('.outliner .ol-row > button.ol').click();
  await clickModelCommand(f.page, 'Pattern', 'Linear pattern');
  await field(hud(), 'Count').fill('4');
  await field(hud(), 'Spacing').fill('30');
  await field(hud(), 'Distance mode').selectOption('span');
  await preview();
  const countDrag = await drag('count', 'Count', 60, seed);
  assert.equal(await field(hud(), 'Total span').inputValue(), '90');
  await f.snapshot('01-creation-count-release');
  if (handleBaseline) {
    await button(hud(), 'Cancel').click();
  } else {
    assert.deepEqual(countDrag, [6, 6]);
    assert.equal(await field(hud(), 'Spacing').textContent(), '18 mm');
    await apply('02-creation-count-applied');
    await verify('creation-count-applied', 10, [0, 18, 36, 54, 72, 90], 18, six);
  }

  f.phase = 'find the span handles for an accepted feature in History';
  await open('D837-accepted.bcad', six);
  await f.same(six);
  await frame();
  await f.openFeatureEditor(2, 'accepted fixed span');
  if (handleBaseline) {
    await f.snapshot('02-history-handles-missing');
    f.report.observations.push({ label: 'history-handles', span: await handle('span').count(), count: await handle('count').count() });
    assert.equal(await handle('span').count(), 1, 'accepted fixed span has no Total span handle');
    assert.deepEqual(countDrag, [6, 6]);
    return;
  }
  await handle('span').waitFor();
  await handle('count').waitFor();
  const widerSpan = { ...six, nodes: [...six.nodes.slice(0, 2), { ...six.nodes[2], span: 110 }] };
  f.phase = 'drag Total span from 90 to 110 mm while keeping Count 6';
  assert.deepEqual(await drag('span', 'Total span', 20, six), [110, 110]);
  assert.equal(await field(hud(), 'Count').inputValue(), '6');
  assert.equal(await field(hud(), 'Spacing').textContent(), '22 mm');
  await apply('03-history-span-applied');
  await verify('history-span-applied', 10, [0, 22, 44, 66, 88, 110], 22, widerSpan);

  f.phase = 'drag History Count from 6 to 5 while retaining 110 mm';
  await f.openFeatureEditor(2, 'accepted wider span');
  assert.deepEqual(await drag('count', 'Count', -22, widerSpan), [5, 5]);
  assert.equal(await field(hud(), 'Total span').inputValue(), '110');
  assert.equal(await field(hud(), 'Spacing').textContent(), '27.5 mm');
  await apply('04-history-count-applied');
  const five = { ...widerSpan, nodes: [...widerSpan.nodes.slice(0, 2), { ...widerSpan.nodes[2], count: 5 }] };
  await verify('history-count-applied', 10, [0, 27.5, 55, 82.5, 110], 27.5, five);
  await f.undo();
  await verify('first-undo', 10, [0, 22, 44, 66, 88, 110], 22, widerSpan);
  await f.redo();
  await verify('first-redo', 10, [0, 27.5, 55, 82.5, 110], 27.5, five);
  assert.deepEqual(f.report.downloads, []);
}

async function runCreatedLifecycle() {
  const four = documentAt(10, 4), six = documentAt(10, 6);
  const seed = { ...four, nodes: four.nodes.slice(0, 2), outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 };
  const offsets4 = [0, 30, 60, 90], offsets6 = [0, 18, 36, 54, 72, 90], offsets5 = [0, 22.5, 45, 67.5, 90];
  const hud = () => f.page.getByRole('dialog', { name: 'Linear pattern', exact: true });
  const editCount = async (value, pitch) => {
    await f.openFeatureEditor(2, 'Count ' + value);
    assert.equal(await field(f.editor(), 'Distance mode').inputValue(), 'span');
    assert.equal(await field(f.editor(), 'Total span').inputValue(), '90');
    await field(f.editor(), 'Count').fill(String(value));
    assert.equal(await field(f.editor(), 'Spacing').textContent(), pitch + ' mm');
    const before = await f.doc();
    await button(f.editor(), 'Apply').click();
    await f.changed(before);
    await f.editor().waitFor({ state: 'hidden' });
  };
  f.phase = 'create and apply a new fixed-span row in Studio';
  await f.newPage();
  await open(name, seed);
  await f.same(seed);
  await f.page.locator('.outliner .ol-row > button.ol').click();
  await clickModelCommand(f.page, 'Pattern', 'Linear pattern');
  await field(hud(), 'Count').fill('4');
  await field(hud(), 'Distance mode').selectOption('span');
  await field(hud(), 'Total span').fill('90');
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent.trim() === 'preview');
  await button(hud(), 'Apply').click();
  await hud().waitFor({ state: 'hidden' });
  await f.changed(seed);
  await verify('created-four', 10, offsets4, 30, four);
  await editCount(6, 18);
  await verify('edited-six', 10, offsets6, 18, six);
  await f.undo();
  await verify('first-undo', 10, offsets4, 30, four);
  await f.redo();
  await verify('first-redo', 10, offsets6, 18, six);

  f.phase = 'save the created feature, reopen it and edit Count again';
  const accepted = await f.doc();
  await saveProjectAndReopen(accepted);
  await verify('reopened-six', 10, offsets6, 18, six);
  await f.snapshot('01-reopened-six');
  await editCount(5, 22.5);
  await verify('post-open-count-five', 10, offsets5, 22.5);
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.snapshot('02-post-open-count-five');
  assert.deepEqual(f.report.downloads, []);
}

await f.run(async () => {
  if (lifecycleMode) { await runCreatedLifecycle(); return; }
  if (handleMode) { await dragSpanHandles(); return; }
  if (creationMode) { await createFixedSpan(); return; }
  if (conversionMode) { await convertDistanceMode(); return; }
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
  await saveProjectAndReopen(wider);
  await verify('reopened-six', 12, offsets6, 18);
  await f.openFeatureEditor(2, 'reopened Count');
  await field(f.editor(), 'Count').fill('5');
  assert.equal(await field(f.editor(), 'Spacing').textContent(), '22.5 mm');
  await f.applyEditor(wider, 'reopened-count-five');
  await verify('reopened-count-five', 12, offsets5, 22.5);
  assert.deepEqual(f.report.downloads, []);
});

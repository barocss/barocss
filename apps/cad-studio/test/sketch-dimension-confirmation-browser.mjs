// D717: confirm exact authored sketch dimensions in the real desktop Studio.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const width = 10.123456;
const editedWidth = 10.124567;
const radius = 10.123457;
const angle = 111.234567;
const pins = [
  'apps/cad-studio/test/sketch-dimension-confirmation-browser.mjs',
  'apps/cad-studio/src/ui/SketchMarks.tsx',
  'apps/cad-studio/src/viewport/sketchOverlay.tsx',
  'apps/cad-studio/src/viewport/studioSketchViewportActions.ts',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'packages/barocss-cad-model/src/sketch/rules.ts',
];
const f = await createFlow({
  name: 'sketch-dimension-confirmation', output, envFrozen: 'D717_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce rounding on unchanged inline Enter' : 'Keep authored constraints on unchanged inline Enter',
  limits: ['Closed planar outlines, attached circles, native extrusion and browser project Save.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { profileOf } from '@barocss/cad-model/sketch/loops';
import { dimensionValue } from '@barocss/cad-model/sketch/rules';

const { name, w, radius, angle } = JSON.parse(process.argv[3]);
const shape = { kind:'polygon',closed:true,points:[[0,0],[w,0],[w,6],[0,6]],
  bulges:[0,0,0,0],lengths:{0:w},hv:{h:[0,2],v:[1,3]},ids:['e0','e1','e2','e3'] };
if (name === 'arc') {
  shape.points = [[0,0],[40,0],[40,2*radius],[0,2*radius]];
  shape.bulges = [0,1,0,0];
  shape.lengths = {0:40};
  shape.radii = {1:radius};
  shape.hv = {h:[0,2],v:[3]};
}
if (name === 'angle') {
  // Include a sub-tolerance difference between measured geometry and the authored rule.
  const turn = (180 - angle + 1e-7) * Math.PI / 180;
  shape.points = [[0,0],[20,0],[20+12*Math.cos(turn),12*Math.sin(turn)]];
  shape.bulges = [0,0,0];
  shape.lengths = {0:20};
  shape.ids = ['e0','e1','e2'];
  shape.hv = {h:[0],v:[]};
  shape.rules = [{kind:'angle',a:0,b:1,value:angle}];
}
if (name === 'circle') {
  shape.points = [[0,0],[50,0],[50,34.25],[0,34.25]];
  shape.lengths = {0:50,1:34.25};
  shape.circles = [{c:[10.123456,9.123456],r:2.123456},{c:[28.246912,19.234567],r:3.234567}];
  shape.circleIds = ['e4','e5'];
  shape.rules = [{kind:'cedge',edge:0,circle:0,axis:1,value:9.123456},
    {kind:'cdx',a:0,circle:0,value:10.123456},{kind:'ccdx',a:0,b:1,value:18.123456}];
}
const profile = profileOf([shape]);
assert.ok('node' in profile, JSON.stringify(profile));
if (name === 'legacy') profile.node.outline.bulges = [0,0,0,0];
if (name === 'positional') delete profile.node.sideTags;
const doc = withNode(withNode(emptyDoc(), profile.node), {kind:'extrude',sketch:0,height:2});
const bytes = encodeStudioFile(doc);
const opened = await readStudioFile(bytes);
assert.ok(!('error' in opened), JSON.stringify(opened));
console.log(JSON.stringify({doc:opened.doc,bytes:Buffer.from(bytes).toString('base64'),
  measuredAngle:name === 'angle' ? dimensionValue(shape,'ang0_1') : undefined}));
`,
});

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };

  const button = name => f.page.getByRole('button', { name, exact: true });
  const historyTips = () => Promise.all(['Undo', 'Redo'].map(async name => ({
    disabled: await button(name).isDisabled(), tip: await button(name).getAttribute('data-tip'),
  })));
  const inline = () => f.page.locator('input.dim-edit');
  const chip = key => f.page.locator(`g.dim[data-dim="${key}"] .dim-text`);
  const open = async (path, doc) => {
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles(path);
    await f.same(doc);
  };
  const fixture = async (name, w = width) => {
    const record = await f.inspect(name, {}, { name, w, radius, angle });
    const path = join(output, name + '.bcad');
    await writeFile(path, Buffer.from(record.bytes, 'base64'));
    return { ...record, path };
  };
  const editSketch = async () => {
    await f.openFeatureEditor(1);
    await f.editor().getByRole('button', { name: 'Edit sketch', exact: true }).click();
    await f.sketchPanel().waitFor();
  };
  const editField = async (key, value, label) => {
    if (label) assert.equal(await chip(key).textContent(), label);
    await chip(key).dblclick();
    assert.equal(await inline().inputValue(), String(value), key);
  };
  const press = async key => {
    await inline().press(key);
    await inline().waitFor({ state: 'detached' });
  };
  const volume = (state, expected) => {
    assert.equal(state.bodies.bodies.length, 1);
    assert.ok(Math.abs(state.bodies.bodies[0].volume - expected) < 1e-8);
  };

  const authored = await fixture('authored');
  const replacement = baseline ? null : await fixture('replacement', editedWidth);
  await f.newPage();
  await open(authored.path, authored.doc);
  const initial = await f.snapshot('authored');
  const initialTips = await historyTips();
  volume(initial, width * 12);
  await editSketch();
  await editField('len0', baseline ? 10.12 : width, '10.12');
  await f.snapshot('inline-before');
  await press('Enter');
  assert.deepEqual((await f.snapshot('inline-confirmed')).doc, initial.doc);

  if (baseline) {
    const after = await f.finishSketch('finished');
    assert.equal(after.doc.nodes[0].outline.lengths[0], 10.12);
    f.report.observations.push({ authored: width, input: '10.12', actual: 10.12,
      volumeBefore: initial.bodies.bodies[0].volume, volumeAfter: after.bodies.bodies[0].volume });
    return;
  }

  f.phase = 'Repeat Enter, Escape, Tab and preserve history';
  await editField('len0', width, '10.12');
  await press('Enter');
  await editField('len0', width);
  await inline().fill('8.456789');
  await press('Escape');
  await editField('len0', width);
  await inline().fill('8.456789');
  await press('Tab');
  assert.deepEqual(await historyTips(), initialTips);
  const unchanged = await f.finishSketch('unchanged');
  assert.deepEqual(unchanged.doc, initial.doc);
  assert.deepEqual(unchanged.history, initial.history);
  assert.deepEqual(await historyTips(), initialTips);
  volume(unchanged, width * 12);

  f.phase = 'Refuse an invalid value and apply a real edit with the same compact label';
  await editSketch();
  await editField('len0', width);
  await inline().fill('');
  await press('Enter');
  assert.match(await f.sketchAlert(), /greater than 0/);
  await editField('len0', width, '10.12');
  await inline().fill(String(editedWidth));
  await press('Enter');
  await editField('len0', editedWidth, '10.12');
  await press('Escape');
  await f.page.keyboard.press('Meta+z');
  await editField('len0', width, '10.12');
  await press('Escape');
  await f.page.keyboard.press('Meta+Shift+z');
  await editField('len0', editedWidth, '10.12');
  await press('Escape');
  const changed = await f.finishSketch('changed');
  assert.equal(changed.doc.nodes[0].outline.lengths[0], editedWidth);
  volume(changed, editedWidth * 12);
  await f.undo();
  await f.same(initial.doc);
  await f.redo();
  await f.same(changed.doc);

  f.phase = 'Save the exact native value into a Studio browser project';
  const project = 'D717 Exact dimensions';
  await button('Project and versions').click();
  const panel = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await button('Save').click();
  await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText('authored.bcad', { exact: true }).waitFor();
  const bytes = Buffer.from(await f.page.evaluate(async projectName => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName);
    return [...new Uint8Array(await (await (await dir.getFileHandle('authored.bcad')).getFile()).arrayBuffer())];
  }, project));
  assert.deepEqual(JSON.parse(bytes.toString()), changed.doc);
  const savedPath = join(output, 'studio-saved.bcad');
  await writeFile(savedPath, bytes);
  f.report.observations.push({ nativeSha256: createHash('sha256').update(bytes).digest('hex'),
    authored: width, editedWidth, volumeBefore: initial.bodies.bodies[0].volume, volumeAfter: changed.bodies.bodies[0].volume });

  await f.newPage();
  await open(savedPath, changed.doc);
  volume(await f.snapshot('fresh-native-open'), editedWidth * 12);
  await editSketch();
  await editField('len0', editedWidth, '10.12');
  await inline().fill('8.456789');
  f.phase = 'Replace the document with an editor draft still active';
  await open(replacement.path, replacement.doc);
  await inline().waitFor({ state: 'detached' });
  await editSketch();
  await editField('len0', editedWidth, '10.12');
  await press('Enter');
  assert.deepEqual((await f.finishSketch('replacement')).doc, replacement.doc);

  for (const [name, dimensions, expectedVolume] of [
    ['legacy', [['len0', width, '10.12']], width * 12],
    ['arc', [['rad1', radius, 'R10.12'], ['len0', 40, '40']], 2 * (80 * radius + Math.PI * radius ** 2 / 2)],
    ['angle', [['ang0_1', angle, '111.23°']], 20 * 12 * Math.sin((180 - angle + 1e-7) * Math.PI / 180)],
    ['circle', [['len1', 34.25, '34.25'], ['cedge0_0', 9.123456], ['cdx0_0', 10.123456], ['ccdx0_1', 18.123456],
      ['cdia0', 4.246912, 'Ø4.25']], 2 * (50 * 34.25 - Math.PI * (2.123456 ** 2 + 3.234567 ** 2))],
  ]) {
    f.phase = `Verify exact ${name} confirmation`;
    const control = await fixture(name);
    await f.newPage();
    await open(control.path, control.doc);
    const before = await f.snapshot(name + '-before');
    const beforeTips = await historyTips();
    volume(before, expectedVolume);
    await editSketch();
    for (const [key, value, label] of dimensions) {
      await editField(key, value, label);
      await press('Enter');
    }
    if (name === 'angle') {
      await editField('ang0_1', angle, '111.23°');
      await inline().fill('180');
      await press('Enter');
      assert.match(await f.sketchAlert(), /between 0° and 180°/);
      await editField('ang0_1', angle);
      await press('Escape');
      assert.notEqual(control.measuredAngle, angle);
      f.report.observations.push({ authoredAngle: angle, measuredAngle: control.measuredAngle });
    }
    const after = await f.finishSketch(name + '-unchanged');
    assert.deepEqual(after.doc, before.doc);
    assert.deepEqual(after.history, before.history);
    assert.deepEqual(await historyTips(), beforeTips);
    volume(after, expectedVolume);
  }

  f.phase = 'Keep positional-side migration on legacy records';
  const positional = await fixture('positional');
  await f.newPage();
  await open(positional.path, positional.doc);
  await editSketch();
  await editField('len0', width, '10.12');
  await press('Enter');
  const migrated = await f.finishSketch('positional-migration');
  assert.equal(migrated.doc.nodes[0].outline.lengths[0], width);
  assert.equal(migrated.doc.nodes[0].sideTags.outer.length, 4);
  volume(migrated, width * 12);

  f.phase = 'Keep the reference-to-driving path and switch dimension keys';
  const reference = await fixture('reference');
  await f.newPage();
  await open(reference.path, reference.doc);
  await editSketch();
  const label = f.page.locator('g.dim:not(.driving) .dim-text').getByText('6', { exact: true });
  await label.first().dblclick();
  assert.equal(await inline().inputValue(), '6');
  assert.match(await inline().getAttribute('title'), /Enter adds it as a driving dimension/);
  await press('Enter');
  assert.equal(await f.page.locator('g.dim.driving .dim-text').getByText('6', { exact: true }).count(), 1);
  const driven = await f.finishSketch('reference-promoted');
  assert.equal(Object.values(driven.doc.nodes[0].outline.lengths).filter(value => value === 6).length, 1);
  volume(driven, width * 12);

  await editSketch();
  await f.tool('Dimension', 'd');
  await f.worldClick([0, 0]);
  await f.worldClick([width, 6]);
  assert.match(await inline().getAttribute('aria-label'), /^Distance/);
  await inline().fill('8.456789');
  await inline().press('h');
  assert.match(await inline().getAttribute('aria-label'), /^Horizontal distance/);
  assert.equal(await inline().inputValue(), String(width));
  await press('Escape');
  assert.deepEqual((await f.finishSketch('key-replacement')).doc, driven.doc);
});

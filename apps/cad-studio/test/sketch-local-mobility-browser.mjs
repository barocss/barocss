import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/constraintInspection.ts',
  'apps/cad-studio/src/ui/SketchMobility.tsx',
  'apps/cad-studio/src/ui/SketchPanel.tsx',
  'apps/cad-studio/src/ui/SketchMarks.tsx',
  'apps/cad-studio/src/ui/constraints.css',
  'apps/cad-studio/src/viewport/Viewport.tsx',
  'apps/cad-studio/src/viewport/sketchOverlay.tsx',
  'packages/barocss-cad-model/src/sketch/mobility.ts',
  'packages/barocss-cad-model/src/sketch/profile.ts',
  'packages/barocss-cad/src/sketch/xy-numerical-sketch.ts',
  'packages/barocss-cad/src/sketch/xy-numerical-sketch-mobility-internal.ts',
  'packages/barocss-cad/src/sketch/xy-numerical-sketch-solver-internal.ts',
];
const corners = [[0, 0], [40, 0], [40, 20], [0, 20]];
const f = await createFlow({
  name: 'sketch-local-mobility', output: process.argv[2], envFrozen: 'D871_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Inspect local first-order mobility of a straight outline without changing its geometry or history.',
  limits: ['One 40 × 20 mm anchored H/V rectangle, a translated same-ID outline and a compact circle control. Desktop Chrome WebGPU only.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { profileOf } from '@barocss/cad-model/sketch/loops';
const withExtrude = sketch => withNode(withNode(emptyDoc(), sketch), { kind: 'extrude', sketch: 0, height: 5 });
const input = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (input.corners) {
  const outline = profileOf([{ kind: 'polygon', closed: true, points: input.corners, hv: { h: [0, 2], v: [1, 3] } }]);
  assert.ok('node' in outline && outline.node.profile === 'polygon');
  const shifted = profileOf([{ kind: 'polygon', closed: true, points: input.corners.map(([x, y]) => [x + 60, y + 15]),
    hv: { h: [0, 2], v: [1, 3] }, lengths: { 0: 40 } }]);
  assert.ok('node' in shifted && shifted.node.profile === 'polygon');
  console.log(JSON.stringify({
    straight: withExtrude(outline.node),
    shifted: withExtrude(shifted.node),
    unsupported: withExtrude({ kind: 'sketch', profile: 'circle', center: [30, 20], radius: 10 }),
  }));
} else {
  const [output] = evaluateCadPart(toPartDocument(input)).outputs;
  const mass = massPropertiesOf(output);
  console.log(JSON.stringify({ id: output.id, valid: checkOutput(output).valid,
    corners: output.brep.vertices.map(vertex => vertex.point), volume: mass.volume, centre: mass.centroid }));
}
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    solver: document.querySelector('.sk-panel .solver')?.textContent ?? null,
    picked: document.querySelector('.sk-panel .cons-sel')?.textContent ?? null,
    mobility: [...document.querySelectorAll('.sk-mobility li')].map(row => row.getAttribute('aria-label')),
    inspected: [...document.querySelectorAll('.vp-overlay .inspected')].map(mark => mark.getAttribute('data-sketch-entity')),
  }),
});

const button = (scope, label) => scope.getByRole('button', { name: label, exact: true });
const mobility = () => f.sketchPanel().locator('details.sk-mobility');
const entity = (kind, n) => mobility().getByRole('listitem', { name: `Locally movable ${kind} ${n}`, exact: true });

async function expectMarks(...keys) {
  await f.page.waitForFunction(keys => JSON.stringify(
    [...document.querySelectorAll('.vp-overlay .inspected[data-sketch-entity]')].map(mark => mark.getAttribute('data-sketch-entity')),
  ) === JSON.stringify(keys), keys, { timeout: 5000 });
}

async function expectMobility(dof, points, edges) {
  await f.sketchPanel().getByText(new RegExp(`rank \\d+ · ${dof} DOF`)).waitFor();
  if (points.length === 0) await mobility().getByText('No locally movable points or edges.', { exact: true }).waitFor();
  else {
    await mobility().getByRole('list', { name: 'Locally movable geometry' }).waitFor();
    const rows = await mobility().getByRole('listitem').allTextContents();
    assert.deepEqual(rows, [...points.map(i => `Point ${i}`), ...edges.map(i => `Edge ${i}`)]);
  }
}

async function checkNative(label, doc) {
  const result = await f.inspect(label, doc);
  assert.equal(result.id, 'n1');
  assert.equal(result.valid, true);
  assert.ok(Math.abs(result.volume - 4000) <= 1e-8, result.volume);
  assert.equal(result.corners.length, 8);
  for (const [x, y] of corners) for (const z of [0, 5]) {
    assert.ok(result.corners.some(p => Math.hypot(p[0] - x, p[1] - y, p[2] - z) <= 1e-8));
  }
  const read = await f.bodies();
  assert.equal(read.fresh, true);
  assert.ok(Math.abs(read.bodies.find(body => body.key === 'b1').volume - 4000) <= 1e-8);
  f.report.observations.push({ label, ...result });
}

async function open(name, bytes) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: bytes });
  await f.same(JSON.parse(bytes));
}

async function edit() {
  await f.openFeatureEditor(1);
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
}

async function observe() {
  return f.page.evaluate(() => ({
    doc: JSON.stringify(window.__studioDoc),
    history: [...document.querySelectorAll('.history .hs')].map(row => row.getAttribute('aria-label')),
    picked: document.querySelector('.sk-panel .cons-sel')?.textContent,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    solver: document.querySelector('.sk-panel .solver')?.textContent,
    work: { ...window.__d871Activity },
  }));
}

async function save(doc) {
  const name = 'D871-mobility', file = name + '.bcad', project = 'D871 local mobility';
  await f.page.locator('.doc-tab input').fill(name);
  await button(f.page, 'Project and versions').click();
  const panel = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(panel, 'Project in this browser').click();
  await panel.getByLabel('Project', { exact: true }).waitFor();
  await button(f.page, 'Save').click();
  await panel.getByRole('list', { name: 'Project documents' }).getByText(file, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, file]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(project);
    return (await (await folder.getFileHandle(file)).getFile()).text();
  }, [project, file]));
  assert.deepEqual(JSON.parse(bytes), doc);
  f.report.observations.push({ label: 'project-save', bytes: bytes.length, sha256: sha256(bytes) });
  return bytes;
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(10000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    await context.addInitScript(() => {
      const activity = window.__d871Activity = { workerRequests: 0, fileWrites: 0 };
      const post = Worker.prototype.postMessage, write = FileSystemFileHandle.prototype.createWritable;
      Worker.prototype.postMessage = function (...args) { activity.workerRequests++; return Reflect.apply(post, this, args); };
      FileSystemFileHandle.prototype.createWritable = function (...args) { activity.fileWrites++; return Reflect.apply(write, this, args); };
    });
    return context;
  };

  const { straight, shifted, unsupported } = await f.inspect('fixture', { corners });
  await f.newPage();
  await open('D871-before.bcad', Buffer.from(JSON.stringify(straight)));
  await checkNative('native-before', straight);
  await edit();
  await f.tool('Select', 's');
  await f.frame(corners);
  await f.worldClick([0, 10]);
  assert.equal(await f.sketchPanel().locator('.cons-sel').textContent(), 'Picked edge 4');

  f.phase = 'keyboard-open read-only mobility and inspect the exact current point';
  const before = await observe();
  await mobility().locator('summary').focus();
  await f.page.keyboard.press('Enter');
  await expectMobility(2, [2, 3, 4], [1, 2, 3, 4]);
  await f.page.keyboard.press('Tab');
  assert.equal(await entity('point', 2).evaluate(row => row === document.activeElement), true);
  await expectMarks('point:1');
  const expected = await f.screenOf(corners[1]);
  const actual = await f.page.locator('.vp-overlay .inspected[data-sketch-entity="point:1"]').evaluate(mark => {
    const rect = mark.closest('svg').getBoundingClientRect();
    return [rect.left + mark.cx.baseVal.value, rect.top + mark.cy.baseVal.value];
  });
  assert.ok(Math.hypot(actual[0] - expected[0], actual[1] - expected[1]) < 0.02);
  assert.equal(await f.page.locator('.vp-overlay .on[data-sketch-entity="edge:3"]').count(), 1);
  await f.page.keyboard.press('Enter');
  await f.page.keyboard.press('Space');
  await expectMarks('point:1');
  await f.snapshot('01-two-dof-keyboard-focus');
  await f.page.keyboard.press('Escape');
  await expectMarks();
  assert.deepEqual(await observe(), before);
  await entity('point', 3).focus();
  await expectMarks('point:2');
  await f.page.keyboard.press('Meta+z');
  await expectMarks();
  await expectMobility(2, [2, 3, 4], [1, 2, 3, 4]);
  assert.deepEqual(await observe(), before);
  await entity('edge', 3).hover();
  await expectMarks('edge:2');
  await f.page.mouse.move(...await f.screenOf([20, 10]));
  await expectMarks();

  f.phase = 'switch inspection owners with an open inline dimension draft';
  await button(f.sketchPanel(), 'Dimension the selection').click();
  const draft = f.page.locator('.dim-edit');
  await draft.fill('19.8');
  await entity('edge', 3).focus();
  await expectMarks('edge:2');
  assert.equal(await draft.inputValue(), '19.8');
  const anchor = f.sketchPanel().getByRole('listitem').filter({ hasText: /Anchor.*point 1/i });
  await anchor.focus();
  await expectMarks('point:0');
  assert.equal(await draft.inputValue(), '19.8');
  await entity('point', 2).focus();
  await expectMarks('point:1');
  await f.page.keyboard.press('Escape');
  await expectMarks();
  assert.equal(await draft.inputValue(), '19.8');
  await draft.focus();
  await f.page.keyboard.press('Escape');
  await draft.waitFor({ state: 'hidden' });
  assert.deepEqual(await f.doc(), straight);
  await expectMobility(2, [2, 3, 4], [1, 2, 3, 4]);

  f.phase = 'add a width constraint and refuse a contradictory perpendicular constraint';
  const edgeLength = n => f.sketchPanel().getByRole('spinbutton', { name: `Edge ${n} length`, exact: true });
  assert.equal(await edgeLength(1).inputValue(), '40');
  await edgeLength(1).press('Enter');
  await expectMobility(1, [3, 4], [2, 3, 4]);
  await expectMarks();
  await f.snapshot('02-one-dof-fixed-length-top-edge-moves');
  await f.worldClick([20, 0]);
  await f.page.keyboard.down('Shift');
  await f.worldClick([20, 20]);
  await f.page.keyboard.up('Shift');
  await button(f.sketchPanel(), 'Perpendicular').click();
  const refused = await f.sketchAlert();
  assert.match(refused, /perpendicular/i);
  await expectMobility(1, [3, 4], [2, 3, 4]);
  await entity('edge', 3).hover();
  await expectMarks('edge:2');
  assert.equal(await f.sketchAlert(), refused);
  assert.deepEqual(await f.doc(), straight);
  await f.snapshot('03-refusal-keeps-the-current-mobility');

  f.phase = 'lock height and recompute on sketch Undo and Redo';
  assert.equal(await edgeLength(2).inputValue(), '20');
  await edgeLength(2).press('Enter');
  await expectMobility(0, [], []);
  await expectMarks();
  await f.page.evaluate(() => document.activeElement.blur());
  await f.page.keyboard.press('Meta+z');
  await expectMobility(1, [3, 4], [2, 3, 4]);
  await expectMarks();
  await f.page.keyboard.press('Meta+Shift+z');
  await expectMobility(0, [], []);
  await expectMarks();
  await f.snapshot('04-zero-dof-redo');

  f.phase = 'remove a dimension explicitly and edit a segment on the current outline';
  await button(f.sketchPanel(), 'Remove Length edge 2 = 20').click();
  await expectMobility(1, [3, 4], [2, 3, 4]);
  await entity('edge', 3).hover();
  await expectMarks('edge:2');
  await edgeLength(1).fill('42');
  await f.page.waitForFunction(() => document.querySelector('[aria-label="Point 2 X"]')?.value === '42');
  await expectMobility(1, [3, 4], [2, 3, 4]);
  await expectMarks();
  await f.page.evaluate(() => document.activeElement.blur());
  await f.page.keyboard.press('Meta+z');
  await f.page.waitForFunction(() => document.querySelector('[aria-label="Point 2 X"]')?.value === '40');
  await f.page.keyboard.press('Meta+z');
  await expectMobility(0, [], []);
  await expectMarks();
  const fixed = (await f.finishSketch('05-finished')).doc;
  assert.deepEqual(fixed.nodes[0].outline.lengths, { 0: 40, 1: 20 });
  assert.deepEqual(fixed.nodes[1], straight.nodes[1]);
  assert.deepEqual(fixed.nodes[0].sideTags, straight.nodes[0].sideTags);
  assert.ok(!JSON.stringify(fixed).toLowerCase().includes('mobility'));
  await checkNative('native-after', fixed);
  await f.undo();
  await f.same(straight);
  await f.redo();
  await f.same(fixed);

  f.phase = 'open exact project bytes in a fresh context and finish inspection without an edit';
  const bytes = await save(fixed);
  await f.newPage();
  await open('D871-mobility.bcad', bytes);
  await checkNative('native-fresh-open', fixed);
  await edit();
  await mobility().locator('summary').click();
  await expectMobility(0, [], []);
  const unchanged = (await f.finishSketch('06-read-only-fresh-open')).doc;
  assert.deepEqual(unchanged, fixed);

  f.phase = 'a same-ID document replacement cannot inherit the former highlight';
  await open('D871-straight-again.bcad', Buffer.from(JSON.stringify(straight)));
  await edit();
  await mobility().locator('summary').click();
  await expectMobility(2, [2, 3, 4], [1, 2, 3, 4]);
  const openButton = button(f.page, 'Open');
  await openButton.focus();
  await entity('edge', 3).hover();
  await expectMarks('edge:2');
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), f.page.keyboard.press('Space')]);
  await chooser.setFiles({ name: 'D871-shifted.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(shifted)) });
  await f.same(shifted);
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await expectMarks();
  assert.deepEqual(shifted.nodes.map(n => n.id), straight.nodes.map(n => n.id));
  await edit();
  await mobility().locator('summary').click();
  await expectMobility(1, [3, 4], [2, 3, 4]);
  await expectMarks();
  await entity('point', 3).focus();
  await expectMarks('point:2');
  const movedPoint = await f.screenOf([100, 35]);
  const projectedMark = await f.page.locator('.vp-overlay .inspected[data-sketch-entity="point:2"]').evaluate(mark => {
    const rect = mark.closest('svg').getBoundingClientRect();
    return [rect.left + mark.cx.baseVal.value, rect.top + mark.cy.baseVal.value];
  });
  assert.ok(Math.hypot(projectedMark[0] - movedPoint[0], projectedMark[1] - movedPoint[1]) < 0.02);
  await f.snapshot('07-same-index-moved-outline');
  await open('D871-unsupported.bcad', Buffer.from(JSON.stringify(unsupported)));
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await expectMarks();
  await edit();
  await mobility().locator('summary').click();
  await mobility().getByText('Mobility unavailable for this outline.', { exact: true }).waitFor();
  assert.equal(await mobility().getByRole('listitem').count(), 0);
  await expectMarks();
  await f.snapshot('08-circle-replacement-unavailable');
  assert.deepEqual(f.report.downloads, []);
});

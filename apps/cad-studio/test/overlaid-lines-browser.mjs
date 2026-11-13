import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFlow, sha256 } from './flow-helper.mjs';

const pickAtLabel = process.argv[3] === '--pick-at-label';
const chooseEdge = process.argv[3] === '--choose-edge';
const trimShared = process.argv[3] === '--trim-shared';
const storedIdMode = process.argv[3] === '--stored-ids';
const dragMode = process.argv[3] === '--spline-drag';
const pins = [
  'apps/cad-studio/test/overlaid-lines-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  ...(chooseEdge || trimShared ? ['apps/cad-studio/src/app/sketchControls.ts', 'apps/cad-studio/src/sketch/draftHistory.ts',
    'apps/cad-studio/src/sketch/useSketchActions.ts', 'packages/barocss-cad-model/src/sketch/types.ts'] : []),
  'apps/cad-studio/src/sketch/overlaidLines.ts',
  'apps/cad-studio/src/sketch/useOverlaidLines.ts',
  'apps/cad-studio/src/ui/OverlaidLinesControls.tsx',
  'apps/cad-studio/src/viewport/sketchOverlay.tsx',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'packages/barocss-cad-model/src/sketch/loops.ts',
];
const f = await createFlow({
  name: 'overlaid-lines', output: process.argv[2], envFrozen: trimShared ? 'D1131_SOURCE_FROZEN' : pickAtLabel ? 'D1095_SOURCE_FROZEN' : chooseEdge ? 'D1094_SOURCE_FROZEN' : dragMode ? 'D830_SOURCE_FROZEN' : storedIdMode ? 'D829_SOURCE_FROZEN' : 'D828_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: trimShared ? 'Verify shared-edge preview, first Finish refusal and draft Undo, then trim both occurrences.'
    : dragMode ? 'Retire the scan on spline pointer-down and prevent scans until release or cancellation.'
    : storedIdMode ? 'Keep a stored side ID distinct from a draft occurrence and retire the report through Undo and Redo.'
    : 'Locate the two exact source edges of adjacent rectangles without changing the sketch or history.',
  limits: ['Ordinary desktop rectangles and a closed spline. The diagnostic reads straight segments and does not determine profile validity.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const [body] = evaluateCadPart(toPartDocument(doc)).outputs;
console.log(JSON.stringify({ valid: checkOutput(body).valid, ...massPropertiesOf(body),
  names: body.brep.faces.map(face => face.name) }));
`,
});
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [{ kind: 'sketch', profile: 'rectangle', min: [30, 10], max: [36, 15], sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] }, id: 'n0' }],
  outputs: {}, nextId: 1,
};
const name = 'D828-control.bcad', project = 'D828 exact lines ' + randomUUID();
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const scan = () => f.page.getByRole('region', { name: 'Overlaid lines', exact: true });
const mark = () => f.page.locator('.vp-overlay .sk-overlaid-line');
const versionPanel = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const shapeGraphics = () => f.page.locator('.vp-overlay .sk-shape').evaluateAll(shapes => shapes.map(shape =>
  [shape.tagName, shape.getAttribute('points'), shape.getAttribute('d'), shape.getAttribute('class')]));
const controls = async () => ({
  undo: await button(f.page, 'Undo').isEnabled(), redo: await button(f.page, 'Redo').isEnabled(),
  selection: await f.page.evaluate(() => window.__studioSelection.selection),
  dirty: await f.page.getByLabel('Unsaved changes', { exact: true }).count(),
});

async function beginScan(checked, groups) {
  await button(scan(), 'Find overlaid lines').click();
  await scan().getByRole('status').getByText(new RegExp(`Checked ${checked} straight segments\\. Found ${groups} exact group`)).waitFor();
}

async function markPosition() {
  return mark().locator('line').evaluate(line => {
    const transform = line.getScreenCTM();
    return [[line.x1.baseVal.value, line.y1.baseVal.value], [line.x2.baseVal.value, line.y2.baseVal.value]].map(([x, y]) => {
      const point = new DOMPoint(x, y).matrixTransform(transform);
      return [point.x, point.y];
    });
  });
}

async function checkMark(shape, side, start, end) {
  await mark().waitFor();
  assert.equal(await mark().getAttribute('data-shape'), String(shape));
  assert.equal(await mark().getAttribute('data-side'), String(side));
  const shown = await markPosition();
  const expected = await Promise.all([start, end].map(point => f.screenOf(point)));
  shown.forEach(([x, y], index) => assert.ok(Math.hypot(x - expected[index][0], y - expected[index][1]) < 1, JSON.stringify(shown)));
  return shown;
}

async function openProject() {
  if (!(await versionPanel().isVisible())) await button(f.page, 'Project and versions').click();
  if (await versionPanel().getByLabel('Project', { exact: true }).isVisible()) return;
  await versionPanel().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versionPanel(), 'Project in this browser').click();
  await versionPanel().getByLabel('Project', { exact: true }).waitFor();
}

async function reopenRectangle() {
  await button(f.page.getByRole('group', { name: 'History', exact: true }), 'Sketch · rectangle').click();
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
}

async function checkStoredIds(empty) {
  f.phase = 'reopen a stored rectangle with a driving edge length and draw mixed draft geometry';
  const stored = structuredClone(source);
  stored.nodes[0].outline = { points: [[30, 10], [36, 10], [36, 15], [30, 15]], lengths: { 0: 6 }, hv: { h: [0, 2], v: [1, 3] } };
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: 'D829-stored-ids.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(stored)) });
  await f.same(stored);
  await reopenRectangle();
  const dimension = () => f.sketchPanel().getByLabel('Edge 1 length', { exact: true });
  assert.equal(await dimension().inputValue(), '6');
  assert.match(await dimension().getAttribute('class'), /\blocked\b/);
  await f.tool('Circle', 'c');
  await button(f.page, 'Construction').click();
  const start = [36, 10], end = [36, 15], corner = [42, 15];
  await f.frame([[30, 25], [34, 25], start, end, corner]);
  await f.worldClick([30, 25]);
  await f.worldClick([34, 25]);
  await f.tool('Rectangle', 'r');
  await button(f.page, 'Construction').click();
  await f.worldClick(start);
  await f.worldClick(corner);
  await f.tool('Select', 's');
  const state = await controls(), graphics = await shapeGraphics();
  assert.ok(graphics.length >= 3);

  f.phase = 'select the saved e2 and separate draft occurrence without modifying them';
  await beginScan(8, 1);
  await scan().getByRole('status').getByText(/Skipped 1 shape\./).waitFor();
  await button(scan(), 'Group 1 · 2 segments').click();
  const original = scan().getByRole('button', { name: /Shape 1 · segment 2 · ID e2.*\(36, 10\) → \(36, 15\)/ });
  await original.click();
  await checkMark(1, 2, start, end);
  assert.equal(await mark().getAttribute('data-id'), 'e2');
  const draft = scan().getByRole('button', { name: /Shape 3 · segment 4.*\(36, 15\) → \(36, 10\)/ });
  await draft.click();
  await checkMark(3, 4, end, start);
  assert.equal(await mark().getAttribute('data-id'), null);
  await f.same(stored);
  assert.deepEqual(await shapeGraphics(), graphics);
  assert.deepEqual(await controls(), state);
  await f.snapshot('01-mixed-stored-and-draft');

  f.phase = 'retire the draft scan on Undo and keep the restored sketch exact on Redo';
  await f.undo();
  await f.same(empty);
  await mark().waitFor({ state: 'hidden' });
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.redo();
  await f.same(stored);
  await reopenRectangle();
  assert.equal(await scan().getByRole('status').count(), 0);
  assert.equal(await mark().count(), 0);
  assert.equal(await dimension().inputValue(), '6');
  assert.match(await dimension().getAttribute('class'), /\blocked\b/);
  await beginScan(4, 0);
  await f.finishSketch('02-restored-exact-sketch');
  await f.same(stored);
  f.report.observations.push({ label: 'stored-draft-identity-and-history', storedId: 'e2', storedOccurrence: [1, 2],
    draftOccurrence: [3, 4], checked: 8, skippedShapes: 1, restoredChecked: 4, restoredGroups: 0, drivingLength: 6 });
  assert.deepEqual(f.report.downloads, []);
}

async function checkSplineDrag(empty) {
  const fit = [[30, 0], [15, 20], [-15, 20], [-30, 0], [-15, -20], [15, -20]];
  await f.tool('Spline', 'p');
  await f.frame(fit);
  for (const point of [...fit, fit[0]]) await f.worldClick(point);
  await f.tool('Select', 's');
  const handle = f.sketchPanel().getByLabel('Fit point 1 handle', { exact: true });
  const find = button(scan(), 'Find overlaid lines');
  const status = scan().getByRole('status');
  const group = button(scan(), 'Group 1 · 2 segments');
  const canvas = f.page.locator('canvas.vp-canvas');
  const forward = () => f.page.locator('.vp-overlay circle.sk-handle-end').nth(1).evaluate(circle => {
    const point = new DOMPoint(circle.cx.baseVal.value, circle.cy.baseVal.value).matrixTransform(circle.getScreenCTM());
    return [point.x, point.y];
  });
  const inputState = async () => ({ disabled: await find.isDisabled(), reports: await status.count(), marks: await mark().count() });
  const idle = { disabled: false, reports: 0, marks: 0 };
  const busy = { ...idle, disabled: true };
  const original = await handle.inputValue();
  const originalControls = await controls();
  assert.equal(original, '');

  f.phase = 'retire the highlighted report while a real spline handle is held';
  await beginScan(8, 1);
  await group.click();
  await mark().waitFor();
  await find.focus();
  const from = await forward();
  const target = await f.screenOf([35, 5 * Math.sqrt(3)]);
  await f.page.mouse.move(...from);
  await f.page.mouse.down();
  const armed = await inputState();
  await f.page.mouse.move(...target, { steps: 12 });
  assert.equal(await canvas.evaluate(el => el.style.cursor), 'grabbing');
  const dragging = await inputState();
  await f.snapshot('01-real-drag');
  assert.equal(await handle.inputValue(), original);
  await f.same(empty);
  await f.page.keyboard.press('Escape');
  await f.page.mouse.up();
  const canceled = await inputState();
  assert.equal(await handle.inputValue(), original);
  await f.same(empty);
  assert.deepEqual(await controls(), originalControls);

  f.phase = 'attempt to start a scan by keyboard before the drag threshold';
  if (await status.count()) await button(scan(), 'Close scan').click();
  await find.focus();
  await f.page.mouse.move(...await forward());
  await f.page.mouse.down();
  if (await find.isEnabled()) await find.focus();
  await f.page.keyboard.press('Enter');
  const attempted = await inputState();
  await f.page.mouse.up();
  const released = await inputState();
  f.report.observations.push({ label: 'spline-pointer-ownership', armed, dragging, canceled, attempted, released });
  assert.deepEqual(armed, busy, 'pointer-down must retire the report and disable scanning');
  assert.deepEqual(dragging, busy, 'the live drag must keep the scan disabled');
  assert.deepEqual(canceled, idle, 'Escape must restore scan access without restoring the report');
  assert.deepEqual(attempted, busy, 'a keyboard activation while armed must not start a scan');
  assert.deepEqual(released, idle, 'pointer-up before the drag threshold must restore scan access');

  f.phase = 'commit a valid handle drag and check its first sketch Undo and Redo';
  await beginScan(8, 1);
  await f.page.mouse.move(...await forward());
  await f.page.mouse.down();
  await f.page.mouse.move(...target, { steps: 12 });
  await f.page.mouse.up();
  const committed = await handle.inputValue();
  assert.ok(committed !== '' && Math.abs(Number(committed) - 60) <= 1, committed);
  assert.deepEqual(await inputState(), idle);
  await f.same(empty);
  await beginScan(8, 1);
  await f.page.keyboard.press('Meta+z');
  assert.equal(await handle.inputValue(), original);
  assert.deepEqual(await inputState(), idle);
  await f.page.keyboard.press('Meta+Shift+z');
  assert.equal(await handle.inputValue(), committed);
  await beginScan(8, 1);
  await group.click();
  await mark().waitFor();
  await f.snapshot('02-rescan-after-redo');
  await f.same(empty);
  f.report.observations.push({ label: 'spline-commit-history', original, committed, checked: 8, groups: 1 });
  assert.deepEqual(f.report.downloads, []);
}

await f.run(async () => {
  f.phase = 'draw two adjacent rectangles through the actual desktop sketch tool';
  await f.newPage();
  await button(f.page, 'New part').click();
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  const empty = await f.doc();
  if (chooseEdge || pickAtLabel || trimShared) await f.page.setViewportSize({ width: 1024, height: 800 });
  if (storedIdMode) { await checkStoredIds(empty); return; }
  await button(f.page.locator('.mode'), 'Sketch').click();
  await f.sketchPanel().waitFor();
  const A = [4, 6], B = [14, 6], C = [14, 16], D = [24, 16];
  await f.frame([A, B, C, D]);
  await f.worldClick(A);
  await f.worldClick(C);
  await f.worldClick(B);
  await f.worldClick(D);
  await f.tool('Select', 's');
  const original = await controls();
  const graphics = await shapeGraphics();
  assert.equal(graphics.length, 2);
  if (dragMode) { await checkSplineDrag(empty); return; }

  f.phase = 'scan and highlight the two original directions';
  await beginScan(8, 1);
  const group = button(scan(), 'Group 1 · 2 segments');
  await group.click();
  const first = scan().getByRole('button', { name: /Shape 1 · segment 2.*\(14, 6\) → \(14, 16\)/ });
  const second = scan().getByRole('button', { name: /Shape 2 · segment 4.*\(14, 16\) → \(14, 6\)/ });
  await first.click();
  const firstPixels = await checkMark(1, 2, B, C);
  await second.focus();
  await second.press('Enter');
  const reversePixels = await checkMark(2, 4, C, B);
  assert.deepEqual(reversePixels, [...firstPixels].reverse());
  await f.same(empty);
  assert.deepEqual(await shapeGraphics(), graphics);
  assert.deepEqual(await controls(), original);
  await f.snapshot('01-two-original-directions');

  if (trimShared) {
    const mid = [14, 11];
    const trim = f.page.locator('.vp-overlay polyline.sk-trim');
    const trimEnds = () => trim.evaluate(line => {
      const matrix = line.getScreenCTM();
      return Array.from(line.points, point => {
        const projected = new DOMPoint(point.x, point.y).matrixTransform(matrix);
        return [projected.x, projected.y];
      });
    });
    const hover = async (start, end) => {
      await f.page.mouse.move(...await f.screenOf([13, 10]));
      const point = await f.screenOf(mid);
      await f.page.mouse.move(...point);
      await trim.waitFor({ state: 'attached' });
      const actual = await trimEnds();
      const expected = await Promise.all([start, end].map(p => f.screenOf(p)));
      actual.forEach(([x, y], j) => assert.ok(Math.hypot(x - expected[j][0], y - expected[j][1]) < 1));
      return point;
    };
    f.phase = 'preview and trim the first shared edge occurrence';
    await f.tool('Trim', 't');
    await f.page.mouse.click(...await hover(B, C));
    const partial = await shapeGraphics();
    assert.equal(partial.filter(g => g[0] === 'polyline').length, 1);
    assert.deepEqual(partial.find(g => g[0] === 'polygon')?.[1], graphics[1][1]);
    await f.page.locator('.topbar button.finish').click();
    assert.match(await f.sketchAlert(), /open chain/i);
    await f.same(empty);
    await f.snapshot('02-first-trim-finish-refusal');

    f.phase = 'undo and redo the first exact Trim';
    await f.undo();
    assert.equal(await f.sketchAlert(), null);
    assert.deepEqual((await shapeGraphics()).map(g => g[1]).sort(), graphics.map(g => g[1]).sort());
    await f.redo();
    assert.deepEqual(await shapeGraphics(), partial);
    await f.same(empty);

    f.phase = 'trim the reverse occurrence, finish and extrude the merged rectangle';
    await f.page.mouse.click(...await hover(C, B));
    assert.equal((await shapeGraphics()).length, 1);
    const finished = (await f.finishSketch('03-merged-rectangle')).doc;
    await f.openExtrudeHud();
    const solid = (await f.applyExtrude({ distance: 2, previous: finished, label: '04-extrude-merged-rectangle' })).doc;
    const native = await f.inspect('native-merged-rectangle', solid);
    assert.equal(native.valid, true);
    assert.ok(Math.abs(native.volume - 400) < 1e-9);
    await f.undo();
    await f.same(finished);
    await f.redo();
    await f.same(solid);
    f.report.observations.push({ label: 'shared-trim', firstEnds: [B, C], secondEnds: [C, B], volumeMM3: native.volume });
    assert.deepEqual(f.report.downloads, []);
    return;
  }

  if (pickAtLabel) {
    const pixel = await f.screenOf([14, 11]);
    const hit = await f.page.evaluate(([x, y]) => {
      const node = document.elementFromPoint(x, y);
      return { tag: node?.tagName, label: node?.closest('g.dim')?.textContent ?? null };
    }, pixel);
    f.report.observations.push({ label: 'shared-midpoint', pixel, hit });
    f.phase = 'click the shared midpoint at the original zoom';
    await f.page.mouse.click(...pixel);
    await f.snapshot('02-click-shared-midpoint');
    assert.match(await f.sketchPanel().locator('.cons-sel').innerText(), /Picked edge 4/);
    await f.same(empty);
    const length = f.page.locator('.dim:not(.driving)').filter({ hasText: /^10$/ });
    const label = await length.evaluateAll(labels => labels.map(g => {
      const r = g.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }).find(at => document.elementFromPoint(at.x, at.y)?.closest('g.dim')?.textContent === '10'));
    assert.ok(label);
    await f.page.mouse.dblclick(label.x, label.y);
    const input = f.page.locator('.dim-editor input');
    await input.waitFor();
    assert.equal(await input.inputValue(), '10');
    await input.press('Escape');
    await input.waitFor({ state: 'hidden' });
    await f.same(empty);
    await f.snapshot('03-label-remains-editable');
    return;
  }

  if (chooseEdge) {
    await first.press('Enter');
    await checkMark(1, 2, B, C);
    f.phase = 'select the exact first outline edge from its diagnostic occurrence';
    const select = button(scan(), 'Select highlighted edge');
    assert.equal(await select.count(), 1);
    await select.press('Enter');
    await scan().getByRole('status').waitFor({ state: 'hidden' });
    await f.sketchPanel().locator('.cons-sel').getByText('edge 2', { exact: true }).waitFor();
    await f.same(empty);
    await button(f.sketchPanel(), 'Dimension the selection').click();
    const input = f.page.locator('.dim-editor input');
    await input.waitFor();
    assert.equal(await input.getAttribute('aria-label'), 'Length of edge 2');
    assert.equal(await input.inputValue(), '10');
    await f.snapshot('02-first-source-dimension');
    await input.fill('12');
    await input.press('Enter');
    await input.waitFor({ state: 'hidden' });
    assert.equal(await f.sketchAlert(), null);
    await f.same(empty);
    const changed = await shapeGraphics();
    assert.equal(changed.length, 2);
    assert.deepEqual(changed[0]?.slice(0, 3), graphics[1]?.slice(0, 3), 'the second rectangle remains exact');
    assert.notEqual(changed[1]?.[1], graphics[0]?.[1], 'the first rectangle changes');
    await f.undo();
    const restored = await shapeGraphics();
    assert.deepEqual(restored.map(g => g[1]), [graphics[1]?.[1], graphics[0]?.[1]]);
    await f.redo();
    assert.deepEqual(await shapeGraphics(), changed);
    await f.same(empty);
    await f.snapshot('03-first-source-redone');
    const finished = await f.finishSketch('04-original-profile-order');
    const sketch = finished.doc.nodes[0];
    assert.equal(sketch.kind, 'sketch');
    assert.deepEqual(sketch.min, [4, 6]);
    assert.deepEqual(sketch.max, [14, 18]);
    assert.deepEqual(sketch.regions?.[0].map(edge => edge.start), [[14, 6], [24, 6], [24, 16], [14, 16]]);
    return;
  }

  f.phase = 'keep the group under zoom and retire only the diagnostic on Escape';
  const view = await f.page.locator('canvas.vp-canvas').boundingBox();
  assert.ok(view);
  await f.page.mouse.move(view.x + view.width * 0.45, view.y + view.height * 0.45);
  await f.page.mouse.wheel(0, 350);
  await f.page.waitForFunction(old => {
    const line = document.querySelector('.sk-overlaid-line line');
    if (!line) return false;
    const p = new DOMPoint(line.x1.baseVal.value, line.y1.baseVal.value).matrixTransform(line.getScreenCTM());
    return Math.hypot(p.x - old[0], p.y - old[1]) > 1;
  }, reversePixels[0]);
  const zoomed = await checkMark(2, 4, C, B);
  assert.equal(await group.getAttribute('aria-pressed'), 'true');
  await second.press('Escape');
  await mark().waitFor({ state: 'hidden' });
  assert.ok(await f.sketchPanel().isVisible());
  assert.equal(await scan().getByRole('status').count(), 0);
  assert.deepEqual(await controls(), original);
  f.report.observations.push({ label: 'two-directions', checked: 8, groups: 1, firstPixels, reversePixels, zoomed });

  f.phase = 'clear the report when the plane changes or the document is replaced';
  await beginScan(8, 1);
  await group.click();
  await mark().waitFor();
  await f.sketchPanel().getByLabel('Plane offset', { exact: true }).fill('3');
  await mark().waitFor({ state: 'hidden' });
  assert.equal(await scan().getByRole('status').count(), 0);
  await beginScan(8, 1);
  await group.click();
  await mark().waitFor();
  const firstCorner = f.sketchPanel().getByLabel('Point 1 X', { exact: true });
  await firstCorner.fill('15');
  await mark().waitFor({ state: 'hidden' });
  assert.equal(await scan().getByRole('status').count(), 0);
  await beginScan(8, 0);
  await button(scan(), 'Close scan').click();
  assert.ok(await f.sketchPanel().isVisible());
  await firstCorner.fill('14');
  await beginScan(8, 1);
  await group.click();
  await mark().waitFor();
  f.report.observations.push({ label: 'scan-retired-on-edit', planeOffset: 3, groupsBefore: 1, groupsAfter: 0, groupsRestored: 1 });
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  await mark().waitFor({ state: 'hidden' });
  assert.equal(await scan().count(), 0);

  f.phase = 'scan and finish an unaffected control sketch';
  await reopenRectangle();
  await beginScan(4, 0);
  await f.finishSketch('02-control-finished');
  await f.same(source);
  await f.openExtrudeHud();
  const { doc } = await f.applyExtrude({ distance: 2, previous: source, label: '03-control-extrusion' });
  assert.deepEqual(doc.nodes[0], source.nodes[0]);
  const native = await f.inspect('control-volume', doc);
  assert.ok(native.valid);
  assert.ok(Math.abs(native.volume - 60) < 1e-8);
  assert.ok(Math.hypot(native.centroid[0] - 33, native.centroid[1] - 12.5, native.centroid[2] - 1) < 1e-8);
  for (const tag of ['e1', 'e2', 'e3', 'e4']) assert.ok(native.names.includes(`n1.side[${tag}]`));
  assert.ok(Math.abs((await f.bodies()).bodies[0].volume - 60) < 1e-8);
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(doc);

  f.phase = 'save and reopen the ordinary solid';
  await openProject();
  await button(f.page, 'Save').click();
  await versionPanel().getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    return Array.from(new Uint8Array(await (await (await directory.getFileHandle(name)).getFile()).arrayBuffer()));
  }, [project, name]));
  assert.deepEqual(JSON.parse(bytes), doc);
  await button(versionPanel(), 'Close project').click();
  await versionPanel().getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await openProject();
  await button(versionPanel(), 'Open ' + name).click();
  await f.same(doc);
  assert.equal(await mark().count(), 0);
  assert.equal(await scan().count(), 0);
  f.report.observations.push({ label: 'control-project', bytes: bytes.length, sha256: sha256(bytes), volume: native.volume, names: native.names });
  assert.deepEqual(f.report.downloads, []);
});

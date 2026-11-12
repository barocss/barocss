import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const name = 'constraint-inspection';
const project = 'D856 constraint inspection';
const pins = [
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/ConstraintTools.tsx',
  'apps/cad-studio/src/ui/SketchMarks.tsx',
  'apps/cad-studio/src/ui/constraints.css',
  'apps/cad-studio/src/viewport/sketchOverlay.tsx',
  'packages/barocss-cad-model/src/sketch/rules.ts',
  ...(!baseline ? ['apps/cad-studio/src/sketch/constraintInspection.ts'] : []),
];
const f = await createFlow({
  name, output, envFrozen: 'D856_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Current constraint rows do not identify geometry in the viewport' : 'Read-only constraint row inspection in desktop Studio',
  limits: ['Two straight XY outlines. The primary outline has Parallel, Equal length and Fixed rows. No mobile, glyph inspection, additional solver features or other browsers.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { profileOf } from '@barocss/cad-model/sketch/loops';
import { solveShape, type Polygon } from '@barocss/cad-model/sketch/rules';
const profile = (points: Polygon['points'], rules: Polygon['rules']) => {
  const shape: Polygon = { kind:'polygon', closed:true, points, hv:{h:[],v:[]}, rules };
  assert.ok(solveShape(shape).ok);
  const built = profileOf([shape]);
  assert.ok('node' in built);
  return built.node;
};
const primary = profile([[0,0],[30,0],[48,24],[18,24]], [
  {kind:'parallel',a:0,b:2}, {kind:'equal',a:0,b:1}, {kind:'fix',point:2,at:[48,24]},
]);
const alternate = profile([[0,0],[30,0],[48,24],[18,24]], [{kind:'fix',point:3,at:[18,24]}]);
console.log(JSON.stringify({ doc: withNode(withNode(emptyDoc(), primary), alternate) }));
`,
  snapshotExtra: () => ({
    picked: document.querySelector('.cons-sel')?.textContent ?? null,
    marks: [...document.querySelectorAll('.vp-overlay [data-sketch-entity]')].map(mark => ({
      entity: mark.getAttribute('data-sketch-entity'), class: mark.getAttribute('class'),
      points: mark.getAttribute('points'), centre: ['cx', 'cy'].map(key => mark.getAttribute(key)),
      dash: getComputedStyle(mark).strokeDasharray,
    })),
    row: document.querySelector('.cons-row.inspecting')?.textContent ?? null,
    focus: document.activeElement?.textContent ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  }),
});
const parallel = 'Parallel edge 1 ∥ edge 3';
const equal = 'Equal length edge 1 = edge 2';
const fixed = 'Fixed point 3';
const endpoints = [[[0, 0], [30, 0]], [[30, 0], [48, 24]], [[48, 24], [18, 24]], [[18, 24], [0, 0]]];
const button = (scope, label) => scope.getByRole('button', { name: label, exact: true });
const row = label => f.sketchPanel().getByRole('listitem').filter({ has: button(f.page, 'Remove ' + label) });
const remove = label => button(f.sketchPanel(), 'Remove ' + label);
const versions = () => f.page.getByLabel('Versions panel', { exact: true });

async function open(bytes, inspectFirst) {
  const control = button(f.page, 'Open');
  if (inspectFirst) {
    await control.focus();
    await inspectFirst();
  }
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'),
    inspectFirst ? f.page.keyboard.press('Space') : control.click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: bytes });
}
async function edit(index) {
  if (index < 2) {
    const history = f.page.getByRole('group', { name: 'History', exact: true });
    await button(history, 'Sketch · polygon').nth(index).click();
    await f.editor().waitFor();
  } else {
    await f.openFeatureEditor(index);
  }
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
}
async function cancel() {
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
}
async function marks(cls, expected) {
  const selector = `.vp-overlay .${cls}[data-sketch-entity]`;
  await f.page.waitForFunction(([selector, expected]) => JSON.stringify(
    [...document.querySelectorAll(selector)].map(mark => mark.getAttribute('data-sketch-entity')).sort(),
  ) === JSON.stringify(expected), [selector, [...expected].sort()], { timeout: 3000 });
}
async function geometry(expected) {
  await marks('inspected', expected);
  for (const entity of expected) {
    const mark = f.page.locator(`.vp-overlay .inspected[data-sketch-entity="${entity}"]`);
    const [kind, i] = entity.split(':');
    const points = kind === 'point' ? [endpoints[i][0]] : endpoints[i];
    const projected = await Promise.all(points.map(point => f.screenOf(point)));
    const actual = await mark.evaluate(mark => {
      const rect = mark.closest('svg').getBoundingClientRect();
      const points = mark instanceof SVGPolylineElement ? [mark.points.getItem(0), mark.points.getItem(mark.points.length - 1)]
        : [{ x: mark.cx.baseVal.value, y: mark.cy.baseVal.value }];
      return points.map(({ x, y }) => [x + rect.left, y + rect.top]);
    });
    for (const [j, point] of actual.entries()) assert.ok(Math.hypot(...point.map((value, axis) => value - projected[j][axis])) < 0.02, entity);
  }
}
async function save() {
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  await versions().waitFor();
  if (!(await versions().getByLabel('Project', { exact: true }).isVisible())) {
    await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await button(versions(), 'Project in this browser').click();
    await versions().getByLabel('Project', { exact: true }).waitFor();
  }
  await button(f.page, 'Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(name + '.bcad', { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    const file = await (await directory.getFileHandle(name)).getFile();
    return Array.from(new Uint8Array(await file.arrayBuffer()));
  }, [project, name + '.bcad']));
  assert.deepEqual(JSON.parse(bytes), await f.doc());
  f.report.files.push({ bytes: bytes.length, sha256: sha256(bytes) });
  await button(f.page, 'Project and versions').click();
  await versions().waitFor({ state: 'hidden' });
  return bytes;
}
async function observe() {
  return f.page.evaluate(() => ({
    doc: JSON.stringify(window.__studioDoc), appRenders: window.__studioRenders?.App,
    work: { ...window.__d856Activity },
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    picked: document.querySelector('.cons-sel')?.textContent,
    solver: document.querySelector('.sk-panel .solver')?.textContent,
    alert: document.querySelector('.sk-panel [role="alert"]')?.textContent ?? null,
    history: [...document.querySelectorAll('.history .hs')].map(row => row.getAttribute('aria-label')),
  }));
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(8000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    await context.addInitScript(() => {
      const activity = window.__d856Activity = { workerRequests: 0, fileWrites: 0, storageWrites: 0 };
      const post = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (...args) { activity.workerRequests++; return post.apply(this, args); };
      const write = FileSystemFileHandle.prototype.createWritable;
      FileSystemFileHandle.prototype.createWritable = function (...args) { activity.fileWrites++; return write.apply(this, args); };
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (...args) { activity.storageWrites++; return setItem.apply(this, args); };
    });
    return context;
  };
  const { doc: source } = await f.inspect('constrained-outline', {});
  const seed = Buffer.from(JSON.stringify(source));
  f.report.observations.push({ sourceSHA256: sha256(seed), area: 720, extrudeHeight: 8, volume: 5760 });
  await f.newPage();
  const page = f.page;
  f.phase = 'open the primary polygon and enter the actual sketch';
  await open(seed);
  await f.same(source);
  if (!baseline) await save();
  await edit(0);
  await f.tool('Select', 's');
  await f.frame([[9, 12], [15, 0], [33, 24], [39, 12]]);
  await f.worldClick([9, 12]);
  assert.equal(await f.sketchPanel().locator('.cons-sel').textContent(), 'Picked edge 4');
  const a = row(parallel), b = row(equal);
  f.phase = 'inspect the exact involved geometry with hover and keyboard focus';
  const before = await observe();
  await a.hover();
  if (baseline) {
    assert.equal(await page.locator('.vp-overlay .inspected').count(), 0);
    await f.snapshot('01-parent-row-hover-no-geometry');
    return;
  }
  await geometry(['edge:0', 'edge:2']);
  await f.snapshot('01-parallel-hover-edge-1-and-3');
  await remove(parallel).focus();
  await page.keyboard.press('Tab');
  assert.equal(await b.evaluate(element => element === document.activeElement), true);
  await geometry(['edge:0', 'edge:1']);
  await marks('on', ['edge:3']);
  await f.snapshot('02-equal-focus-and-original-selection');
  await page.mouse.move(...await f.screenOf([33, 24]));
  await geometry(['edge:0', 'edge:1']);
  await marks('hover', ['edge:2']);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  assert.equal(await b.evaluate(element => element === document.activeElement), true);
  assert.equal(await page.locator('.palette').count(), 0);
  await geometry(['edge:0', 'edge:1']);
  await page.keyboard.press('Escape');
  await marks('inspected', []);
  await marks('on', ['edge:3']);
  await page.waitForTimeout(1000);
  assert.deepEqual(await observe(), before);
  f.report.observations.push({ label: 'read-only-hover-and-focus', before, after: await observe() });
  await b.hover();
  await geometry(['edge:0', 'edge:1']);
  await page.mouse.move(...await f.screenOf([33, 24]));
  await marks('inspected', []);
  await row(fixed).focus();
  await geometry(['point:2']);
  await f.snapshot('03-fixed-point-3');
  await page.locator('.topbar button.finish').focus();
  await marks('inspected', []);

  f.phase = 'hover keeps a live dimension draft and a solver refusal';
  await button(f.sketchPanel(), 'Dimension the selection').click();
  const dimension = page.locator('.dim-edit');
  await dimension.fill('31.25');
  await a.hover();
  await geometry(['edge:0', 'edge:2']);
  assert.equal(await dimension.inputValue(), '31.25');
  await page.keyboard.down('Escape');
  await marks('inspected', []);
  assert.equal(await dimension.inputValue(), '31.25');
  await page.keyboard.down('Escape');
  assert.equal(await dimension.inputValue(), '31.25');
  await page.keyboard.up('Escape');
  await page.keyboard.press('Escape');
  await dimension.waitFor({ state: 'hidden' });
  await marks('inspected', []);
  await button(f.sketchPanel(), 'Dimension the selection').click();
  await dimension.fill('31.25');
  await a.focus();
  await geometry(['edge:0', 'edge:2']);
  assert.equal(await dimension.inputValue(), '31.25');
  await page.keyboard.press('Tab');
  assert.equal(await remove(parallel).evaluate(element => element === document.activeElement), true);
  assert.equal(await dimension.inputValue(), '31.25');
  await dimension.focus();
  await marks('inspected', []);
  assert.equal(await dimension.inputValue(), '31.25');
  await a.focus();
  await page.locator('.topbar button.finish').focus();
  await dimension.waitFor({ state: 'hidden' });
  await marks('inspected', []);
  await f.worldClick([15, 0]);
  await page.keyboard.down('Shift');
  await f.worldClick([33, 24]);
  await page.keyboard.up('Shift');
  await button(f.sketchPanel(), 'Perpendicular').click();
  const refusal = await f.sketchAlert();
  assert.match(refusal, /Perpendicular/);
  await a.hover();
  await geometry(['edge:0', 'edge:2']);
  assert.equal(await f.sketchAlert(), refusal);
  await f.snapshot('04-refusal-and-overlapping-marks');

  f.phase = 'explicit pointer and keyboard removal and exactly one sketch history entry';
  await remove(parallel).click();
  await marks('inspected', []);
  assert.equal(await a.count(), 0);
  assert.equal(await b.getAttribute('data-constraint-id'), 'rule:0');
  assert.deepEqual(await f.doc(), source);
  await page.keyboard.press('Meta+z');
  await a.waitFor();
  await marks('inspected', []);
  await page.keyboard.press('Meta+Shift+z');
  await a.waitFor({ state: 'detached' });
  await marks('inspected', []);
  await page.keyboard.press('Meta+z');
  await a.waitFor();
  for (const key of ['Enter', 'Space']) {
    await a.focus();
    await page.keyboard.press('Tab');
    assert.equal(await remove(parallel).evaluate(element => element === document.activeElement), true);
    if (key === 'Enter') {
      await page.keyboard.down(key);
      await a.waitFor({ state: 'detached' });
      await page.keyboard.down(key);
      await page.keyboard.up(key);
      assert.equal(await f.sketchPanel().isVisible(), true);
    } else {
      await page.keyboard.press(key);
      await a.waitFor({ state: 'detached' });
    }
    await marks('inspected', []);
    await page.keyboard.press('Meta+z');
    await a.waitFor();
    await marks('inspected', []);
  }
  await a.hover();
  await geometry(['edge:0', 'edge:2']);
  await page.keyboard.press('q');
  await marks('inspected', []);
  await f.tool('Select', 's');
  await a.focus();
  await geometry(['edge:0', 'edge:2']);
  await page.keyboard.press('Escape');
  await cancel();
  await f.same(source);
  await edit(1);
  assert.equal(await row('Fixed point 4').getAttribute('data-constraint-id'), 'rule:0');
  await marks('inspected', []);
  await row('Fixed point 4').hover();
  await geometry(['point:3']);
  await f.snapshot('05-other-sketch-same-rule-id');
  await page.keyboard.press('Escape');
  await cancel();
  await edit(0);
  await marks('inspected', []);

  f.phase = 'Finish then Extrude the primary profile and preserve its recipe';
  await page.locator('.topbar button.finish').focus();
  await a.hover();
  await geometry(['edge:0', 'edge:2']);
  await page.keyboard.press('Space');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.ready();
  const finished = await f.snapshot('06-finished');
  assert.deepEqual(finished.doc.nodes[0], source.nodes[0]);
  assert.deepEqual(finished.doc.nodes[1], source.nodes[1]);
  await marks('inspected', []);
  await button(page.getByRole('group', { name: 'History', exact: true }), 'Sketch · polygon').first().click();
  await f.closeEditor();
  await f.openExtrudeHud();
  const extruded = await f.applyExtrude({ distance: 8, previous: finished.doc, label: '07-primary' });
  assert.deepEqual(extruded.doc.nodes.slice(0, 2), source.nodes);
  assert.equal(extruded.doc.nodes[2].sketch, 0);
  assert.ok(Math.abs(extruded.bodies.bodies[0].volume - 5760) < 1e-7);
  const bytes = await save();
  await edit(2);
  await open(bytes, async () => {
    await a.hover();
    await geometry(['edge:0', 'edge:2']);
  });
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.same(extruded.doc);
  await marks('inspected', []);
  await f.snapshot('08-same-context-open-clears-inspection');
  await edit(2);
  await marks('inspected', []);
  await button(page, 'New part').focus();
  await a.hover();
  await geometry(['edge:0', 'edge:2']);
  await page.keyboard.press('Space');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await marks('inspected', []);
  await page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.snapshot('09-new-part-clears-inspection');
  await f.newPage();
  await open(bytes);
  await f.same(extruded.doc);
  await edit(2);
  await marks('inspected', []);
  await row(parallel).hover();
  await geometry(['edge:0', 'edge:2']);
  await f.snapshot('10-fresh-open-and-reedit');
  await f.page.keyboard.press('Escape');
  await cancel();
  await f.same(extruded.doc);
});

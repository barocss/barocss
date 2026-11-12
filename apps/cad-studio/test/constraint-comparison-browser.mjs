import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output] = process.argv.slice(2);
const name = 'constraint-comparison';
const project = 'D861 constraint comparison';
const pins = [
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/constraintInspection.ts',
  'apps/cad-studio/src/ui/ConstraintTools.tsx',
  'apps/cad-studio/src/ui/constraints.css',
  'apps/cad-studio/src/viewport/sketchOverlay.tsx',
  'packages/barocss-cad-model/src/sketch/rules.ts',
  'packages/barocss-cad-model/src/sketch/settle.ts',
];
const f = await createFlow({
  name, output, envFrozen: 'D861_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: 'Compare current straight-edge constraints before one explicit sketch edit',
  limits: ['One ordinary closed XY polygon, two straight edges, Parallel, Equal length and a refused Perpendicular.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { profileOf } from '@barocss/cad-model/sketch/loops';
import { applyConstraint, type Polygon } from '@barocss/cad-model/sketch/rules';
import { settleShape } from '@barocss/cad-model/sketch/settle';
const base: Polygon = { kind:'polygon', closed:true, points:[[0,0],[40,0],[36,21],[3,23]], hv:{h:[0],v:[]}, ids:['e1','e2','e3','e4'] };
const picks = [{kind:'edge',i:0},{kind:'edge',i:2}] as const;
const parallel = applyConstraint(base, picks, 'parallel');
assert.ok(parallel.ok);
const afterParallel = settleShape(parallel.shape, base);
assert.ok(!afterParallel.error && afterParallel.shape?.kind === 'polygon');
const equal = applyConstraint(afterParallel.shape, picks, 'equal');
assert.ok(equal.ok);
const afterEqual = settleShape(equal.shape, afterParallel.shape);
assert.ok(!afterEqual.error && afterEqual.shape?.kind === 'polygon');
const perpendicular = applyConstraint(afterParallel.shape, picks, 'perpendicular');
assert.ok(!perpendicular.ok);
const vertical = applyConstraint(afterParallel.shape, picks, 'vertical');
assert.ok(!vertical.ok && vertical.reason !== perpendicular.reason);
const built = profileOf([base]);
assert.ok('node' in built);
console.log(JSON.stringify({ doc:withNode(withNode(emptyDoc(),built.node),{kind:'extrude',sketch:0,height:8}),
  parallel:afterParallel.shape.points, equal:afterEqual.shape.points, refusal:perpendicular.reason, priorRefusal:vertical.reason }));
`,
  snapshotExtra: () => ({
    picked: document.querySelector('.cons-sel')?.textContent ?? null,
    solver: document.querySelector('.sk-panel .solver')?.textContent ?? null,
    preview: document.querySelector('.sk-constraint-comparison')?.getAttribute('points') ?? null,
    previewRefusal: document.querySelector('[aria-label="Constraint preview"]')?.textContent ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    rows: [...document.querySelectorAll('.cons-row .kv')].map(row => row.textContent),
  }),
});

const button = (scope, label) => scope.getByRole('button', { name: label, exact: true });
const tool = label => button(f.sketchPanel(), label);
const versions = () => f.page.getByLabel('Versions panel', { exact: true });
const overlay = () => f.page.locator('.sk-constraint-comparison');
const refusal = () => f.sketchPanel().getByRole('status', { name: 'Constraint preview', exact: true });
const pickedText = 'Picked edge 1, edge 3';
const near = (actual, expected, tolerance) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected}`);

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
async function edit() {
  await f.openFeatureEditor(1);
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Select', 's');
  await f.frame([[20, 0], [19.5, 22]]);
}
async function pick() {
  await f.worldClick([20, 0]);
  await f.page.keyboard.down('Shift');
  await f.worldClick([19.5, 22]);
  await f.page.keyboard.up('Shift');
  assert.equal(await f.sketchPanel().locator('.cons-sel').textContent(), pickedText);
}
async function matchPreview(points) {
  await overlay().waitFor();
  const actual = await overlay().evaluate(element => {
    const rect = element.closest('svg').getBoundingClientRect();
    return Array.from({ length: element.points.length }, (_, index) => {
      const p = element.points.getItem(index);
      return [p.x + rect.left, p.y + rect.top];
    });
  });
  const expected = await Promise.all(points.map(p => f.screenOf(p)));
  assert.equal(actual.length, expected.length);
  for (const [i, p] of actual.entries()) near(Math.hypot(p[0] - expected[i][0], p[1] - expected[i][1]), 0, 0.02);
}
async function observe() {
  return f.page.evaluate(() => ({
    doc: JSON.stringify(window.__studioDoc), appRenders: window.__studioRenders?.App, activity: { ...window.__d861Activity },
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    picked: document.querySelector('.cons-sel')?.textContent,
    fields: [...document.querySelectorAll('[aria-label="Outline points"] input')].map(input => input.value),
    solver: document.querySelector('.sk-panel .solver')?.textContent,
    alert: document.querySelector('.sk-panel [role="alert"]')?.textContent ?? null,
    history: [...document.querySelectorAll('.history .hs')].map(row => row.getAttribute('aria-label')),
  }));
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
    const folder = await projects.getDirectoryHandle(project);
    const file = await (await folder.getFileHandle(name)).getFile();
    return Array.from(new Uint8Array(await file.arrayBuffer()));
  }, [project, name + '.bcad']));
  assert.deepEqual(JSON.parse(bytes), await f.doc());
  f.report.files.push({ bytes: bytes.length, sha256: sha256(bytes) });
  await button(f.page, 'Project and versions').click();
  await versions().waitFor({ state: 'hidden' });
  return bytes;
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(8000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    await context.addInitScript(() => {
      const activity = window.__d861Activity = { workerRequests: 0, fileWrites: 0, storageWrites: 0 };
      const post = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (...args) { activity.workerRequests++; return post.apply(this, args); };
      const write = FileSystemFileHandle.prototype.createWritable;
      FileSystemFileHandle.prototype.createWritable = function (...args) { activity.fileWrites++; return write.apply(this, args); };
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (...args) { activity.storageWrites++; return setItem.apply(this, args); };
    });
    return context;
  };

  const fixture = await f.inspect('constraint-candidates', {});
  const source = fixture.doc, seed = Buffer.from(JSON.stringify(source));
  f.report.observations.push({ label: 'source-fixture', sha256: sha256(seed), ...fixture });
  await f.newPage();
  await open(seed);
  await f.same(source);
  await save();
  await edit();
  await pick();

  f.phase = 'compare Parallel with actual pointer and keyboard focus';
  const before = await observe();
  const started = performance.now();
  await tool('Parallel').hover();
  await matchPreview(fixture.parallel);
  f.report.observations.push({ label: 'pointer-to-compared-geometry-ms', elapsedMs: performance.now() - started });
  await f.snapshot('01-pointer-parallel-comparison');
  await f.page.mouse.move(...await f.screenOf([8, 8]));
  await overlay().waitFor({ state: 'hidden' });
  await tool('Perpendicular').focus();
  await f.page.keyboard.press('Shift+Tab');
  assert.equal(await tool('Parallel').evaluate(element => element === document.activeElement), true);
  await matchPreview(fixture.parallel);
  await f.snapshot('02-keyboard-parallel-comparison');
  await f.page.keyboard.press('Escape');
  await overlay().waitFor({ state: 'hidden' });
  for (const key of ['Meta+z', 'Meta+Shift+z']) {
    await f.page.mouse.move(...await f.screenOf([8, 8]));
    await tool('Parallel').hover();
    await matchPreview(fixture.parallel);
    await f.page.keyboard.press(key);
    await overlay().waitFor({ state: 'hidden' });
  }
  await f.page.waitForTimeout(1000);
  assert.deepEqual(await observe(), before);
  f.report.observations.push({ label: 'preview-only-invariants', before, after: await observe() });

  f.phase = 'comparison retains a dimension draft and retires on a geometry edit';
  await tool('Dimension the selection').click();
  const dimension = f.page.locator('.dim-edit');
  await dimension.fill('85.5');
  await tool('Parallel').hover();
  await matchPreview(fixture.parallel);
  await tool('Parallel').focus();
  await matchPreview(fixture.parallel);
  assert.equal(await dimension.inputValue(), '85.5');
  await f.page.keyboard.press('Escape');
  await overlay().waitFor({ state: 'hidden' });
  assert.equal(await dimension.inputValue(), '85.5');
  await dimension.focus();
  await f.page.keyboard.press('Escape');
  await dimension.waitFor({ state: 'hidden' });

  const point = f.sketchPanel().getByRole('spinbutton', { name: 'Point 3 X', exact: true });
  await point.focus();
  await f.page.mouse.move(...await f.screenOf([8, 8]));
  await tool('Parallel').hover();
  await matchPreview(fixture.parallel);
  await point.fill('37');
  assert.equal(await point.inputValue(), '37');
  await overlay().waitFor({ state: 'hidden' });
  await f.page.locator('.topbar button.finish').focus();
  await f.page.keyboard.press('Meta+z');
  assert.deepEqual((await observe()).fields, before.fields);
  await overlay().waitFor({ state: 'hidden' });
  await pick();

  f.phase = 'native Enter applies Parallel exactly once';
  await tool('Perpendicular').focus();
  await f.page.keyboard.press('Shift+Tab');
  await matchPreview(fixture.parallel);
  const parallelRow = () => tool('Remove Parallel edge 1 ∥ edge 3');
  await f.page.keyboard.down('Enter');
  await parallelRow().waitFor();
  await f.page.keyboard.down('Enter');
  await f.page.keyboard.up('Enter');
  assert.equal(await f.sketchPanel().isVisible(), true);
  await overlay().waitFor({ state: 'hidden' });
  const afterParallel = await observe();
  assert.deepEqual(await f.doc(), source);
  await f.page.keyboard.press('Meta+z');
  await parallelRow().waitFor({ state: 'detached' });
  assert.deepEqual((await observe()).fields, before.fields);
  await f.page.keyboard.press('Meta+Shift+z');
  await parallelRow().waitFor();
  assert.deepEqual((await observe()).fields, afterParallel.fields);
  await pick();

  f.phase = 'compare valid Equal, refused Perpendicular, then Equal again';
  await tool('Vertical').click();
  assert.equal(await f.sketchAlert(), fixture.priorRefusal);
  const beforeAlternating = await observe();
  await tool('Equal').hover();
  await matchPreview(fixture.equal);
  await tool('Perpendicular').hover();
  await refusal().waitFor();
  assert.equal(await refusal().textContent(), fixture.refusal);
  await overlay().waitFor({ state: 'hidden' });
  await f.snapshot('03-current-refused-comparison');
  await tool('Equal').hover();
  await matchPreview(fixture.equal);
  await refusal().waitFor({ state: 'hidden' });
  await f.page.keyboard.press('Escape');
  await overlay().waitFor({ state: 'hidden' });
  assert.deepEqual(await observe(), beforeAlternating);
  await tool('Perpendicular').click();
  assert.equal(await f.sketchAlert(), fixture.refusal);
  await tool('Equal').hover();
  await matchPreview(fixture.equal);
  await tool('Perpendicular').hover();
  await overlay().waitFor({ state: 'hidden' });
  await refusal().waitFor({ state: 'hidden' });
  assert.equal(await f.sketchAlert(), fixture.refusal);

  const equalRow = () => tool('Remove Equal length edge 1 = edge 3');
  await tool('Equal').click();
  await equalRow().waitFor();
  await f.page.keyboard.press('Meta+z');
  await equalRow().waitFor({ state: 'detached' });
  await parallelRow().waitFor();
  await pick();
  await tool('Equal').focus();
  await matchPreview(fixture.equal);
  await f.page.keyboard.press('Space');
  await equalRow().waitFor();
  await f.page.keyboard.press('Meta+z');
  await equalRow().waitFor({ state: 'detached' });
  await parallelRow().waitFor();

  f.phase = 'drop the comparison when the sketch tool and selection change';
  await pick();
  await tool('Equal').hover();
  await matchPreview(fixture.equal);
  await f.page.keyboard.press('q');
  await overlay().waitFor({ state: 'hidden' });
  await f.tool('Select', 's');
  await parallelRow().waitFor();
  await overlay().waitFor({ state: 'hidden' });
  await pick();

  f.phase = 'finish with comparison active and retain only the applied relation';
  await f.page.locator('.topbar button.finish').focus();
  await tool('Equal').hover();
  await matchPreview(fixture.equal);
  await f.page.keyboard.press('Space');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.ready();
  const accepted = await f.snapshot('04-finished-parallel-only');
  assert.deepEqual(accepted.doc.nodes[0].points, fixture.parallel);
  assert.deepEqual(accepted.doc.nodes[0].outline.rules, [{ kind: 'parallel', a: 0, b: 2 }]);
  assert.deepEqual(accepted.doc.nodes[0].sideTags, source.nodes[0].sideTags);
  assert.deepEqual(accepted.doc.nodes.slice(1), source.nodes.slice(1));
  assert.deepEqual(accepted.doc.outputs, source.outputs);
  const [a, b, c, d] = fixture.parallel;
  near(((b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0])) / (Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(d[0] - c[0], d[1] - c[1])), 0, 1e-9);
  const volume = 8 * (b[0] - a[0] + c[0] - d[0]) * (c[1] - a[1]) / 2;
  near(accepted.bodies.bodies[0].volume, volume, 1e-6);
  f.report.observations.push({ label: 'accepted-parallel', independentVolume: volume, nativeVolume: accepted.bodies.bodies[0].volume });

  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(accepted.doc);
  const bytes = await save();
  await f.newPage();
  await open(bytes);
  await f.same(accepted.doc);
  await edit();
  await parallelRow().waitFor();
  await overlay().waitFor({ state: 'hidden' });
  await pick();
  await open(bytes, async () => {
    await tool('Equal').hover();
    await matchPreview(fixture.equal);
  });
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await overlay().waitFor({ state: 'hidden' });
  await f.same(accepted.doc);
  await edit();
  await parallelRow().waitFor();
  await overlay().waitFor({ state: 'hidden' });
  await f.snapshot('05-reopened-without-comparison');
  await pick();
  await button(f.page, 'New part').focus();
  await tool('Equal').hover();
  await matchPreview(fixture.equal);
  await f.page.keyboard.press('Space');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await overlay().waitFor({ state: 'hidden' });
  await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.snapshot('06-new-part-without-comparison');
});

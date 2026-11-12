import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/constraint-list-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/constraintList.ts',
  'apps/cad-studio/src/sketch/constraintInspection.ts',
  'apps/cad-studio/src/ui/ConstraintList.tsx',
  'apps/cad-studio/src/ui/ConstraintTools.tsx',
  'apps/cad-studio/src/ui/SketchPanel.tsx',
  'packages/barocss-cad-model/src/sketch/rules.ts',
];
const f = await createFlow({
  name: 'constraint-list', output: process.argv[2], envFrozen: 'D880_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Filter the current sketch constraint list without changing geometry or row ownership.',
  limits: ['Desktop Studio with a straight rectangle, a separate straight ruled outline, and an ellipse.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { ellipseShape } from '@barocss/cad-model/sketch/ellipse';
import { profileOf } from '@barocss/cad-model/sketch/loops';
import { solveShape, type Polygon } from '@barocss/cad-model/sketch/rules';
const input = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (input.format) {
  const [body] = evaluateCadPart(toPartDocument(input)).outputs;
  const mass = massPropertiesOf(body);
  console.log(JSON.stringify({ valid: checkOutput(body).valid, id: body.id, volume: mass.volume, centroid: mass.centroid }));
} else {
  const sketch = (shape: Polygon) => {
    assert.ok(solveShape(shape).ok);
    const result = profileOf([shape]);
    assert.ok('node' in result);
    return result.node;
  };
  const rules = [
    { kind: 'parallel', a: 0, b: 2 }, { kind: 'equal', a: 0, b: 1 },
    { kind: 'fix', point: 2, at: [48, 24] }, { kind: 'dx', a: 0, b: 1, value: 30 },
  ] as Polygon['rules'];
  const mixed = sketch({ kind: 'polygon', closed: true, points: [[0,0],[30,0],[48,24],[18,24]], hv: { h: [], v: [] }, rules });
  const ellipse = profileOf([ellipseShape({ center: [60, 30], rx: 12, ry: 6, angle: 0 })]);
  assert.ok('node' in ellipse);
  const stock = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0,0], max: [40,20],
    sideTags: { outer: ['e1','e2','e3','e4'] } });
  const extruded = withNode(stock, { kind: 'extrude', sketch: 0, height: 2 });
  console.log(JSON.stringify(withNode(withNode(extruded, mixed), ellipse.node)));
}
`,
  snapshotExtra: () => ({
    picked: document.querySelector('.cons-sel')?.textContent ?? null,
    visibleRows: [...document.querySelectorAll('[aria-label="Constraints"] [data-constraint-id]')].map(row => row.getAttribute('data-constraint-id')),
    count: document.querySelector('[aria-label="Constraint count"]')?.textContent?.trim() ?? null,
    inspected: [...document.querySelectorAll('.vp-overlay .inspected')].map(mark => mark.getAttribute('data-sketch-entity')),
    solver: document.querySelector('.sk-panel .solver')?.textContent ?? null,
    kind: document.querySelector('[aria-label="Constraint kind"]')?.value ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    controls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
  }),
});
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const filters = () => f.sketchPanel().getByRole('group', { name: 'Constraint filters', exact: true });
const kind = () => filters().getByRole('combobox', { name: 'Constraint kind', exact: true });
const pickedOnly = () => filters().getByRole('checkbox', { name: 'Picked only', exact: true });
const list = () => f.sketchPanel().getByRole('list', { name: 'Constraints', exact: true });
const remove = label => button(list(), 'Remove ' + label);
const row = id => list().locator(`[data-constraint-id="${id}"]`);
const dimension = () => f.page.locator('input.dim-edit');
const rectIds = ['anchor', 'h:0', 'h:2', 'v:1', 'v:3'];
const mixedIds = ['anchor', 'rule:0', 'rule:1', 'rule:2', 'rule:3'];

async function show(expected, total) {
  const status = f.sketchPanel().getByRole('status', { name: 'Constraint count', exact: true });
  await status.getByText(`CONSTRAINTS · ${expected.length}/${total}`, { exact: true }).waitFor();
  assert.deepEqual(await list().locator('[data-constraint-id]').evaluateAll(rows => rows.map(row => row.dataset.constraintId)), expected);
}

async function open(doc, bytes = Buffer.from(JSON.stringify(doc)), name = 'D880-constraints.bcad') {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: bytes });
  await f.same(doc);
}

async function edit(node) {
  if (node === 1) {
    await f.openFeatureEditor(node);
  } else {
    const history = f.page.getByRole('group', { name: 'History', exact: true });
    await button(history, node === 2 ? 'Sketch · polygon' : 'Sketch · outline').first().click();
    await f.editor().waitFor();
  }
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
}

async function cancel() {
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.page.keyboard.press('Escape');
  if (await f.sketchPanel().isVisible()) await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
}

function retained(after, before) {
  for (const key of ['doc', 'bodies', 'selection', 'history', 'solver', 'dirty', 'controls', 'picked', 'sketchAlert']) assert.deepEqual(after[key], before[key], key);
}

async function native(label, doc) {
  const result = await f.inspect(label, doc);
  assert.equal(result.id, 'n1');
  assert.equal(result.valid, true);
  assert.ok(Math.abs(result.volume - 1600) < 1e-8);
  assert.ok(Math.hypot(result.centroid[0] - 20, result.centroid[1] - 10, result.centroid[2] - 1) < 1e-8);
  const [body] = (await f.bodies()).bodies;
  assert.equal(body.key, 'b1');
  assert.ok(Math.abs(body.volume - 1600) < 1e-8);
  f.report.observations.push({ label, ...result });
}

async function save(doc) {
  const file = 'D880-constraints.bcad', project = 'D880 constraint list';
  await button(f.page, 'Project and versions').click();
  const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions, 'Project in this browser').click();
  await versions.getByLabel('Project', { exact: true }).waitFor();
  await button(f.page, 'Save').click();
  await versions.getByRole('list', { name: 'Project documents' }).getByText(file, { exact: true }).waitFor();
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
      const activity = window.__d880Activity = { worker: 0, storage: 0 };
      const post = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (...args) { activity.worker++; return post.apply(this, args); };
      const store = Storage.prototype.setItem;
      Storage.prototype.setItem = function (...args) { activity.storage++; return store.apply(this, args); };
    });
    return context;
  };
  const source = await f.inspect('source', {});
  assert.deepEqual(source.nodes.map(node => node.id), ['n0', 'n1', 'n2', 'n3']);
  f.report.observations.push({ label: 'source', sha256: sha256(Buffer.from(JSON.stringify(source))) });
  await f.newPage();
  await open(source);
  await native('source-native', source);
  await edit(1);
  await f.frame([[0, 0], [40, 20], [20, 0], [20, 20]]);
  await show(rectIds, 5);
  assert.equal(await kind().inputValue(), '');
  assert.equal(await pickedOnly().isChecked(), false);
  assert.equal(await row('anchor').locator('button').isDisabled(), true);
  const before = await f.snapshot('01-rectangle-all');
  const beforeActivity = await f.page.evaluate(() => ({ ...window.__d880Activity }));

  f.phase = 'filter exact kinds without changing the rectangle or its history';
  await kind().focus();
  await f.page.keyboard.press('h');
  assert.equal(await kind().inputValue(), 'Horizontal');
  await show(['h:0', 'h:2'], 5);
  await f.page.keyboard.press('Enter');
  await f.page.keyboard.press('Escape');
  assert.equal(await f.sketchPanel().isVisible(), true);
  retained(await f.snapshot('02-horizontal-two-of-five'), before);
  assert.deepEqual(await f.page.evaluate(() => ({ ...window.__d880Activity })), beforeActivity);

  f.phase = 'combine the filters and distinguish a point from its same-index edge';
  await pickedOnly().focus();
  await f.page.keyboard.press('Space');
  await show([], 5);
  await f.sketchPanel().getByText('Pick geometry to filter.', { exact: true }).waitFor();
  await f.worldClick([20, 0]);
  await show(['h:0'], 5);
  await f.snapshot('03-horizontal-picked-edge');
  await f.worldClick([0, 0]);
  await show([], 5);
  await f.sketchPanel().getByText('No matching constraints.', { exact: true }).waitFor();
  await kind().selectOption('');
  await show(['anchor'], 5);
  assert.equal(await row('anchor').locator('button').isDisabled(), true);
  await f.snapshot('04-point-anchor-only');

  f.phase = 'retain a live dimension draft while filter controls own Enter, Escape and Undo';
  await pickedOnly().uncheck();
  await f.tool('Dimension', 'd');
  await f.worldClick([20, 0]);
  await dimension().fill('42');
  assert.equal(await dimension().inputValue(), '42', 'after typing');
  await kind().focus();
  assert.equal(await kind().evaluate(node => node === document.activeElement), true, 'filter focus');
  assert.equal(await dimension().inputValue(), '42', 'after moving focus');
  await kind().selectOption('Vertical');
  await show(['v:1', 'v:3'], 5);
  assert.equal(await dimension().inputValue(), '42', 'after filtering');
  await f.page.keyboard.press('Escape');
  assert.equal(await dimension().inputValue(), '42', 'after Escape in the filter');
  await f.page.keyboard.press('Meta+z');
  assert.equal(await dimension().inputValue(), '42', 'after Undo in the filter');
  await f.same(source);
  await f.snapshot('05-dimension-retained-in-filters');
  await dimension().press('Enter');
  await dimension().waitFor({ state: 'hidden' });
  await show(['v:1', 'v:3'], 6);
  await button(f.page, 'Undo').click();
  await show(['v:1', 'v:3'], 5);
  await button(f.page, 'Redo').click();
  await show(['v:1', 'v:3'], 6);
  await f.worldClick([20, 0]);
  await dimension().fill('0');
  await dimension().press('Enter');
  await f.sketchPanel().getByRole('alert').getByText(/greater than 0/).waitFor();
  await pickedOnly().check();
  await show([], 6);
  await f.sketchPanel().getByRole('alert').getByText(/greater than 0/).waitFor();
  await f.snapshot('05a-empty-list-keeps-dimension-refusal');

  await cancel();
  await f.same(source);

  f.phase = 'open a different outline and preserve two-edge inspection and selected membership';
  await edit(2);
  await f.frame([[0, 0], [48, 24], [15, 0], [33, 24]]);
  await show(mixedIds, 5);
  assert.equal(await kind().inputValue(), '');
  assert.equal(await pickedOnly().isChecked(), false);
  await row('rule:0').hover();
  await f.page.waitForFunction(() => document.querySelectorAll('.vp-overlay .inspected').length === 2);
  await kind().selectOption('Horizontal distance');
  await show(['rule:3'], 5);
  await f.page.waitForFunction(() => document.querySelectorAll('.vp-overlay .inspected').length === 0);
  await kind().selectOption('Parallel');
  await pickedOnly().check();
  await f.worldClick([33, 24]);
  await show(['rule:0'], 5);
  await f.page.keyboard.down('Shift');
  await f.worldClick([15, 0]);
  await f.page.keyboard.up('Shift');
  await show(['rule:0'], 5);
  await f.snapshot('06-parallel-matches-both-picked-edges');

  f.phase = 'remove current rule IDs under a filter and retain filters through local replay';
  await pickedOnly().uncheck();
  await kind().selectOption('Equal length');
  await show(['rule:1'], 5);
  await remove('Equal length edge 1 = edge 2').click();
  await show([], 4);
  assert.equal(await kind().inputValue(), 'Equal length');
  await kind().selectOption('Fixed');
  await show(['rule:1'], 4);
  await remove('Fixed point 3').click();
  await show([], 3);
  await button(f.page, 'Undo').click();
  await show(['rule:1'], 4);
  await button(f.page, 'Redo').click();
  await show([], 3);
  await button(f.page, 'Undo').click();
  await show(['rule:1'], 4);
  await f.same(source);
  await f.snapshot('07-shifted-rule-restored');
  const accepted = (await f.finishSketch('08-filtered-removal-accepted')).doc;
  assert.deepEqual(accepted.nodes[2].outline.rules, source.nodes[2].outline.rules.filter((_, i) => i !== 1));
  for (const i of [0, 1, 3]) assert.deepEqual(accepted.nodes[i], source.nodes[i]);
  await native('accepted-native', accepted);
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(accepted);
  const bytes = await save(accepted);
  await f.newPage();
  await open(accepted, bytes);
  await native('fresh-native', accepted);
  await edit(2);
  await show(['anchor', 'rule:0', 'rule:1', 'rule:2'], 4);
  assert.equal(await kind().inputValue(), '');
  assert.equal(await pickedOnly().isChecked(), false);
  await f.snapshot('09-fresh-open-default-filters');
  await cancel();

  f.phase = 'filter the existing read-only ellipse summary without expanding arcs';
  await edit(3);
  await show(['ellipse', 'anchor'], 2);
  await kind().selectOption('Ellipse');
  await show(['ellipse'], 2);
  assert.equal(await row('ellipse').getByRole('button').count(), 0);
  assert.match(await row('ellipse').textContent(), /192 tangent arcs/);
  await pickedOnly().check();
  await show([], 2);
  await f.snapshot('10-ellipse-picked-only-empty');
  const segments = accepted.nodes[3].segments;
  const chordLength = i => Math.hypot(...segments[i].start.map((v, axis) => v - segments[(i + 1) % segments.length].start[axis]));
  const arc = segments.reduce((longest, _, i) => chordLength(i) > chordLength(longest) ? i : longest, 0);
  const { center, start } = segments[arc], end = segments[(arc + 1) % segments.length].start;
  const bisector = center.map((v, axis) => (start[axis] + end[axis]) / 2 - v);
  const radius = Math.hypot(...start.map((v, axis) => v - center[axis]));
  const mid = center.map((v, axis) => v + bisector[axis] * radius / Math.hypot(...bisector));
  await f.frame([mid]);
  await f.page.mouse.move(...await f.screenOf(mid));
  await f.page.mouse.wheel(0, -1800);
  await f.page.waitForFunction(([a, b]) => {
    const p = window.__studioScreenOf([...a, 0]), q = window.__studioScreenOf([...b, 0]);
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 24;
  }, [start, end]);
  await f.worldClick(mid);
  await show(['ellipse'], 2);
  assert.equal(await f.sketchPanel().locator('.cons-sel').textContent(), 'Picked arc ' + (arc + 1));
  await f.snapshot('11-ellipse-summary-matches-a-picked-arc');

  await cancel();
  await f.same(accepted);
  assert.deepEqual(f.report.downloads, []);
});

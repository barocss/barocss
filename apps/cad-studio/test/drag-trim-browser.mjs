import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const railOnly = process.argv.includes('--rail');
const pins = [
  'apps/cad-studio/test/drag-trim-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/draftHistory.ts',
  'apps/cad-studio/src/sketch/dragTrimPlan.ts',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'apps/cad-studio/src/viewport/dragTrimStroke.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/viewport/sketchOverlay.tsx',
  'packages/barocss-cad-model/src/sketch/trim.ts',
];
const f = await createFlow({
  name: 'drag-trim', output: process.argv[2], envFrozen: 'D876_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Preview and atomically trim three straight intervals in one actual desktop pointer stroke.',
  limits: ['One closed straight main outline with separate visible construction targets and boundaries.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
import { toPartDocument } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const [output] = evaluateCadPart(toPartDocument(doc)).outputs;
console.log(JSON.stringify({ id: output.id, valid: checkOutput(output).valid,
  corners: output.brep.vertices.map(vertex => vertex.point), volume: massPropertiesOf(output).volume }));
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    controls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
    removed: [...document.querySelectorAll('.sk-drag-trim-interval')].map(line => line.getAttribute('points')),
  }),
});
const line = (a, b, id) => ({ kind: 'polygon', points: [a, b], closed: false, bulges: [0, 0], ids: ['e' + id, 'e' + (id + 1)], construction: true });
const vertical = (x, id) => line([x, -5], [x, 15], id);
const axes = [0, 10, 20];
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2,
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [34, 0], max: [54, 20], id: 'n0',
      sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] },
      construction: [...axes.map((x, i) => vertical(x, 2 * i + 5)), line([-2, 0], [29, 0], 11), line([-2, 10], [29, 10], 13)] },
    { kind: 'extrude', sketch: 0, height: 2, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } },
};
const crowded = structuredClone(source);
crowded.nodes[0].construction.push(vertical(25, 15));
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const brush = () => f.page.locator('.vp-overlay .sk-drag-trim');
const cuts = () => brush().locator('.sk-drag-trim-interval');
const ordinary = () => f.page.locator('.vp-overlay .sk-trim:not(.sk-drag-trim-interval)');

async function open(doc, name = 'D876-source.bcad', bytes = Buffer.from(JSON.stringify(doc))) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: bytes });
  await f.same(doc);
}

async function enterTrim() {
  await f.openFeatureEditor(1);
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Trim', 't');
  await f.frame([[-2, 5], [29, 5], [0, -4], [20, 14], [54, 20]]);
}

async function pixel(point) {
  const pos = await f.page.evaluate(point => {
    const p = window.__studioScreenOf([...point, 0]);
    return p && document.elementFromPoint(...p)?.closest('canvas.vp-canvas') ? p : null;
  }, point);
  assert.ok(pos, JSON.stringify(point));
  return pos;
}

async function settle() {
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
}

async function hover(point) {
  await f.page.mouse.move(...await pixel(point));
  await settle();
}

async function hold(from = [-2, 5], to = [22, 5], steps = 1) {
  await f.page.mouse.move(...await pixel(from));
  await f.page.mouse.down();
  await f.page.mouse.move(...await pixel(to), { steps });
  await brush().waitFor({ state: 'attached' });
}

async function lineEndpoints(locator, a, b) {
  await locator.waitFor({ state: 'attached' });
  const actual = await locator.evaluate(line => {
    const rect = line.closest('svg').getBoundingClientRect();
    return Array.from(line.points, q => [q.x + rect.left, q.y + rect.top]);
  });
  const expected = await Promise.all([a, b].map(point => f.screenOf(point)));
  assert.equal(actual.length, 2);
  assert.ok(actual.every(p => expected.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.02)), JSON.stringify({ actual, expected }));
}

async function verifyPreview() {
  assert.equal(await cuts().count(), 3);
  for (const [i, x] of axes.entries()) await lineEndpoints(cuts().nth(i), [x, 0], [x, 10]);
}

async function beforeCuts() {
  for (const x of axes) {
    await hover([x, 5]);
    await lineEndpoints(ordinary(), [x, 0], [x, 10]);
  }
}

async function afterCuts() {
  for (const x of axes) {
    await hover([x, 5]);
    await ordinary().waitFor({ state: 'detached' });
    await hover([x, -3]);
    await lineEndpoints(ordinary(), [x, -5], [x, 0]);
    await hover([x, 13]);
    await lineEndpoints(ordinary(), [x, 10], [x, 15]);
  }
}

async function railBoundary(before) {
  const page = f.page;
  const rail = page.getByRole('navigation', { name: 'Tools', exact: true });
  const lineButton = button(rail, 'Line');
  const railBox = await lineButton.boundingBox();
  const center = [railBox.x + railBox.width / 2, railBox.y + railBox.height / 2];
  const initial = await f.screenOf([0, 5]);
  const panFrom = await pixel([29, 5]);
  await page.mouse.move(...panFrom);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(panFrom[0] + center[0] - initial[0], panFrom[1] + center[1] - initial[1], { steps: 8 });
  await page.mouse.up({ button: 'middle' });
  await settle();
  const blocked = await f.screenOf([0, 5]);
  assert.ok(await page.evaluate(at => !!document.elementFromPoint(...at)?.closest('nav.toolbar'), blocked));

  f.phase = 'Cancel a captured Trim drag on the covered line';
  const start = await pixel([24, 5]), visible = await pixel([6, 5]);
  await page.mouse.move(...start);
  await page.mouse.down();
  await page.mouse.move(...visible);
  await brush().waitFor({ state: 'attached' });
  assert.equal(await cuts().count(), 2);
  await page.mouse.move(...blocked);
  await settle();
  const blockedPreview = await cuts().count();
  await f.snapshot('rail-held');
  await page.mouse.up();
  await brush().waitFor({ state: 'detached' });
  const released = await f.snapshot('rail-released');
  f.report.observations.push({ label: 'rail-capture', blockedPreview, controlsBefore: before.controls, controlsAfter: released.controls });
  await f.persist();
  assert.equal(blockedPreview, 0);
  unchanged(released, before, true);
  await f.frame([[-2, 5], [29, 5], [0, -4], [20, 14], [54, 20]]);
  await beforeCuts();
  await hold();
  await verifyPreview();
  await page.mouse.up();
  await afterCuts();
  await button(page, 'Undo').click();
  await beforeCuts();
  unchanged(await f.snapshot('rail-visible-retry'), before);
}

function unchanged(after, before, includeControls = false) {
  for (const key of ['doc', 'bodies', 'selection', 'history', 'dirty', ...(includeControls ? ['controls'] : [])]) {
    assert.deepEqual(after[key], before[key], key);
  }
}

async function native(label, doc) {
  const result = await f.inspect(label, doc);
  assert.equal(result.id, 'n1');
  assert.equal(result.valid, true);
  assert.ok(Math.abs(result.volume - 800) < 1e-8);
  assert.equal(result.corners.length, 8);
  for (const x of [34, 54]) for (const y of [0, 20]) for (const z of [0, 2]) {
    assert.ok(result.corners.some(q => Math.hypot(q[0] - x, q[1] - y, q[2] - z) < 1e-8));
  }
  f.report.observations.push({ label, ...result });
}

async function save(doc) {
  const name = 'D876-drag-trim', file = name + '.bcad', project = 'D876 drag Trim';
  await f.page.locator('.doc-tab input').fill(name);
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
      document.addEventListener('pointerdown', event => {
        if (event.isTrusted && event.target?.closest('canvas.vp-canvas')) window.__dragTrimPointer = event.pointerId;
      }, true);
    });
    return context;
  };
  await f.newPage();
  await open(source);
  await native('native-source', source);
  await enterTrim();
  await beforeCuts();
  const before = await f.snapshot('01-before-stroke');
  assert.deepEqual(before.controls, [true, true]);
  if (railOnly) {
    await railBoundary(before);
    assert.deepEqual(f.report.downloads, []);
    return;
  }

  f.phase = 'preview one sparse stroke and release it as one draft edit';
  await hold();
  await verifyPreview();
  unchanged(await f.snapshot('02-three-held-intervals'), before, true);
  await f.page.mouse.up();
  await brush().waitFor({ state: 'detached' });
  await afterCuts();
  const trimmed = await f.snapshot('03-three-cuts-one-step');
  unchanged(trimmed, before);
  assert.deepEqual(trimmed.controls, [false, true]);
  await button(f.page, 'Undo').click();
  await beforeCuts();
  const restored = await f.snapshot('04-one-undo-restores-all');
  unchanged(restored, before);
  assert.deepEqual(restored.controls, [true, false]);
  await f.page.keyboard.press('Meta+Shift+z');
  await afterCuts();
  await f.page.keyboard.press('Meta+z');
  await beforeCuts();

  f.phase = 'Escape and pointer cancellation discard the full preview and keep Redo';
  for (const reason of ['Escape', 'pointercancel']) {
    await hold([-2, 5], [20.2, 5], 20);
    await verifyPreview();
    if (reason === 'Escape') {
      await f.page.keyboard.down('Escape');
      await f.page.keyboard.down('Escape');
      await f.page.keyboard.up('Escape');
    } else {
      await f.page.evaluate(() => document.querySelector('canvas.vp-canvas').dispatchEvent(new PointerEvent('pointercancel', {
        bubbles: true, pointerId: window.__dragTrimPointer, pointerType: 'mouse',
      })));
    }
    await brush().waitFor({ state: 'detached' });
    await f.page.mouse.up();
    await f.sketchPanel().waitFor();
    await beforeCuts();
    unchanged(await f.snapshot(reason === 'Escape' ? '05-escaped' : '06-pointer-cancelled'), restored, true);
  }

  f.phase = 'a second pointer and camera motion retire their stroke before release';
  await hold([-2, 5], [20.2, 5]);
  await verifyPreview();
  await f.page.evaluate(() => {
    const canvas = document.querySelector('canvas.vp-canvas'), pointerId = window.__dragTrimPointer + 1;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId, button: 0, buttons: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId, button: 0, buttons: 0 }));
  });
  await brush().waitFor({ state: 'detached' });
  await f.page.mouse.up();
  await beforeCuts();
  unchanged(await f.snapshot('07-second-pointer-cancelled'), restored, true);
  await hold([-2, 5], [20.2, 5]);
  await verifyPreview();
  await f.page.mouse.wheel(0, 180);
  await brush().waitFor({ state: 'detached' });
  await f.page.mouse.up();
  await f.frame([[-2, 5], [22, 5], [54, 20]]);
  await beforeCuts();
  unchanged(await f.snapshot('08-camera-change-cancelled'), restored, true);

  f.phase = 'a same-sketch accepted document edit invalidates the held stroke';
  await hold([-2, 5], [20.2, 5]);
  await verifyPreview();
  const browser = f.page.getByRole('complementary', { name: 'Browser', exact: true });
  const hideBody = button(browser, 'Hide body');
  await hideBody.focus();
  await f.page.keyboard.press('Space');
  await f.page.waitForFunction(() => window.__studioDoc?.bodies?.b1?.hidden === true);
  await brush().waitFor({ state: 'detached' });
  await f.page.mouse.up();
  await beforeCuts();
  const editedLook = await f.snapshot('09-same-sketch-document-edit');
  assert.deepEqual(editedLook.doc.nodes, source.nodes);
  assert.deepEqual(editedLook.doc.outputs, source.outputs);
  assert.deepEqual(editedLook.controls, [true, true]);

  f.phase = 'a fourth crossing refuses the whole stroke';
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await open(crowded, 'D876-four-lines.bcad');
  await enterTrim();
  const crowdedBefore = await f.snapshot('10-four-lines');
  await hold([-2, 5], [27, 5]);
  await f.page.mouse.up();
  await f.waitToast(/Could not trim the stroke/i);
  await beforeCuts();
  await hover([25, 5]);
  await lineEndpoints(ordinary(), [25, 0], [25, 10]);
  unchanged(await f.snapshot('11-four-lines-refused'), crowdedBefore, true);
  await f.dismissToasts();
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });

  f.phase = 'Finish and reopen the construction cuts with the original native solid';
  await open(source);
  await enterTrim();
  await hold();
  await verifyPreview();
  await f.page.mouse.up();
  await afterCuts();
  const accepted = (await f.finishSketch('12-accepted-construction-cuts')).doc;
  assert.deepEqual(accepted.nodes[1], source.nodes[1]);
  assert.deepEqual(accepted.nodes[0].sideTags, source.nodes[0].sideTags);
  const guides = accepted.nodes[0].construction;
  assert.equal(guides.length, 8);
  for (const original of source.nodes[0].construction.slice(3)) {
    assert.deepEqual(guides.find(guide => guide.ids[0] === original.ids[0]), { ...original, pending: false });
  }
  assert.equal(new Set(guides.flatMap(guide => guide.ids)).size, 16);
  for (const [i, x] of axes.entries()) {
    const halves = guides.filter(guide => guide.points.every(point => point[0] === x))
      .sort((a, b) => a.points[0][1] - b.points[0][1]);
    assert.deepEqual(halves.map(guide => guide.points.map(point => point[1])), [[-5, 0], [10, 15]]);
    assert.deepEqual([halves[0].ids[0], halves[1].ids[1]], source.nodes[0].construction[i].ids);
  }
  await native('native-after-finish', accepted);
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(accepted);
  const bytes = await save(accepted);
  await f.newPage();
  await open(accepted, 'D876-drag-trim.bcad', bytes);
  await native('native-fresh-open', accepted);
  await enterTrim();
  await afterCuts();
  await f.snapshot('13-fresh-open-cuts');
  assert.deepEqual(f.report.downloads, []);
});

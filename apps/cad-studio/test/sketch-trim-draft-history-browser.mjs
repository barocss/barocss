import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const fixed = process.argv[3] === '--fixed';
const pins = [
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/app/sketchControls.ts',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/viewport/sketchOverlay.tsx',
  'packages/barocss-cad-model/src/sketch/history.ts',
  'packages/barocss-cad-model/src/sketch/trim.ts',
  ...(fixed ? ['apps/cad-studio/src/sketch/draftHistory.ts'] : []),
];
const f = await createFlow({
  name: 'sketch-trim-draft-history', output: process.argv[2], envFrozen: fixed ? 'D874_SOURCE_FROZEN' : 'D873_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: fixed ? 'Undo and Redo one click Trim before Finish' : 'Measure the click Trim draft and its current Undo boundary',
  limits: ['One 40 × 20 mm native rectangle with two straight construction boundaries. Actual desktop Studio.'],
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    controls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
    mark: document.querySelector('.vp-overlay .sk-trim')?.getAttribute('points') ?? null,
  }),
});
const boundary = (x, ids) => ({ kind: 'polygon', points: [[x, -5], [x, 5]], closed: false, bulges: [0, 0], ids, construction: true });
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2,
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20], id: 'n0',
      sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] }, construction: [boundary(10, ['e5', 'e6']), boundary(30, ['e7', 'e8'])] },
    { kind: 'extrude', sketch: 0, height: 2, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } },
};
const button = (scope, label) => scope.getByRole('button', { name: label, exact: true });
const cue = () => f.page.locator('.vp-overlay polyline.sk-trim');

async function open() {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  const bytes = Buffer.from(JSON.stringify(source));
  await chooser.setFiles({ name: 'D873-click-trim.bcad', mimeType: 'application/json', buffer: bytes });
  await f.same(source);
  f.report.observations.push({ label: 'fixture', bytes: bytes.length, sha256: sha256(bytes) });
}

async function hover(point) {
  const pixel = await f.page.evaluate(point => {
    const p = window.__studioScreenOf([...point, 0]);
    return p && document.elementFromPoint(...p)?.closest('.vp-canvas') ? p : null;
  }, point);
  assert.ok(pixel, JSON.stringify(point));
  await f.page.mouse.move(...pixel);
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
}

async function expectSegment(point, a, b) {
  await hover(point);
  await cue().waitFor({ state: 'attached' });
  const actual = await cue().evaluate(line => {
    const rect = line.closest('svg').getBoundingClientRect();
    return Array.from(line.points, q => [q.x + rect.left, q.y + rect.top]);
  });
  assert.equal(actual.length, 2);
  const expected = await Promise.all([a, b].map(point => f.screenOf(point)));
  assert.ok(actual.every(p => expected.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.02)), JSON.stringify({ actual, expected }));
  return actual;
}

async function expectGap() {
  await hover([20, 2]);
  await hover([20, 0]);
  await cue().waitFor({ state: 'detached' });
}

function unchanged(after, before) {
  for (const key of ['doc', 'bodies', 'selection', 'history', 'dirty']) assert.deepEqual(after[key], before[key], key);
  if (!fixed) assert.deepEqual(after.controls, before.controls);
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
    return context;
  };
  await f.newPage();
  await open();
  await f.openFeatureEditor(1);
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Trim', 't');
  await f.frame([[0, 0], [40, 0], [40, 20], [10, -5], [30, -5]]);

  f.phase = 'measure the bounded straight trim and its two untouched residual ends';
  const beforeSegment = await expectSegment([20, 0], [10, 0], [30, 0]);
  const before = await f.snapshot('01-original-trim-preview');
  if (fixed) assert.deepEqual(before.controls, [true, true]);
  assert.equal(before.bodies.fresh, true);
  assert.ok(Math.abs(before.bodies.bodies.find(body => body.key === 'b1').volume - 1600) < 1e-8);
  await f.page.mouse.down();
  await f.page.mouse.up();
  await expectGap();
  const cut = await f.snapshot('02-gap-after-one-click');
  unchanged(cut, before);
  if (fixed) assert.deepEqual(cut.controls, [false, true]);
  await expectSegment([5, 0], [0, 0], [10, 0]);
  await expectSegment([35, 0], [30, 0], [40, 0]);
  for (const x of [10, 30]) {
    await expectSegment([x, -3], [x, -5], [x, 0]);
    await expectSegment([x, 3], [x, 0], [x, 5]);
  }

  if (fixed) {
    f.phase = 'Undo a second Trim without restoring the first cut';
    await expectSegment([20, 20], [0, 20], [40, 20]);
    await f.page.mouse.down();
    await f.page.mouse.up();
    await hover([20, 20]);
    await cue().waitFor({ state: 'detached' });
    await button(f.page, 'Undo').click();
    await hover([20, 18]);
    await expectSegment([20, 20], [0, 20], [40, 20]);
    await expectGap();
    unchanged(await f.snapshot('03-only-second-cut-undone'), before);

    f.phase = 'Undo the first cut and keep Redo through an invalid Trim click';
    await f.page.keyboard.press('Meta+z');
    await hover([20, 2]);
    await expectSegment([20, 0], [10, 0], [30, 0]);
    const restored = await f.snapshot('04-first-cut-undone');
    unchanged(restored, before);
    assert.deepEqual(restored.controls, [true, false]);
    await hover([20, 4]);
    await f.page.mouse.down();
    await f.page.mouse.up();
    await f.waitToast(/Nothing to trim there/i);
    unchanged(await f.snapshot('05-invalid-trim-refused'), before);
    await f.dismissToasts();

    f.phase = 'Redo the first cut, refuse Finish and undo the gap again';
    await f.page.keyboard.press('Meta+Shift+z');
    await expectGap();
    await expectSegment([20, 20], [0, 20], [40, 20]);
    unchanged(await f.snapshot('06-first-cut-redone'), before);
    await f.page.locator('.topbar button.finish').click();
    await f.sketchPanel().getByRole('alert').getByText('Close or trim the open chain from (30, 0) to (10, 0) mm.', { exact: true }).waitFor();
    await f.page.keyboard.press('Meta+z');
    await f.sketchPanel().getByRole('alert').waitFor({ state: 'hidden' });
    await expectSegment([20, 0], [10, 0], [30, 0]);
    unchanged(await f.snapshot('07-restored-after-finish-refusal'), before);

    f.phase = 'consume two queued Undo events without reading an old draft';
    await button(f.page, 'Redo').click();
    await expectGap();
    await button(f.page, 'Redo').click();
    await hover([20, 20]);
    await cue().waitFor({ state: 'detached' });
    await f.page.evaluate(() => {
      for (let i = 0; i < 2; i++) window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'z', metaKey: true, bubbles: true, cancelable: true,
      }));
    });
    await expectSegment([20, 0], [10, 0], [30, 0]);
    await expectSegment([20, 20], [0, 20], [40, 20]);
    const queued = await f.snapshot('08-two-queued-undos');
    unchanged(queued, before);
    assert.deepEqual(queued.controls, [true, false]);
  } else {
    f.phase = 'apply the first sketch Undo after click Trim';
    await f.page.keyboard.press('Meta+z');
    await expectGap();
    unchanged(await f.snapshot('03-parent-undo-leaves-gap'), before);
    await f.page.keyboard.press('Meta+Shift+z');
    await expectGap();
    unchanged(await f.snapshot('04-parent-redo-has-no-step'), before);
    f.phase = 'refuse Finish of the remaining open outline';
    await f.page.locator('.topbar button.finish').click();
    await f.sketchPanel().getByRole('alert').getByText('Close or trim the open chain from (30, 0) to (10, 0) mm.', { exact: true }).waitFor();
    unchanged(await f.snapshot('05-open-profile-refused'), before);
  }

  f.phase = 'cancel the draft and reopen the original native outline';
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.same(source);
  await f.openFeatureEditor(1);
  await button(f.editor(), 'Edit sketch').click();
  await f.sketchPanel().waitFor();
  await f.tool('Trim', 't');
  await f.frame([[10, 0], [20, 0], [30, 0]]);
  await expectSegment([20, 0], [10, 0], [30, 0]);
  if (fixed) {
    await f.page.keyboard.press('Meta+Shift+z');
    await hover([20, 2]);
    await expectSegment([20, 0], [10, 0], [30, 0]);
  }
  await f.snapshot(fixed ? '09-original-profile-reopened' : '06-original-profile-reopened');
  f.report.observations.push({ label: 'trim-boundary', removedMm: [[10, 0], [30, 0]], originalLengthMm: 40,
    retainedLengthMm: 20, nativeVolumeMm3: 1600, originalPreviewCss: beforeSegment,
    draftUndo: fixed ? 'PASS' : 'FAIL' });
  assert.deepEqual(f.report.downloads, []);
});

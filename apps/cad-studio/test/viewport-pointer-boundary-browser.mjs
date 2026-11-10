// D555. Root runs under the heavy gate from apps/cad-studio.
// D555_SOURCE_FROZEN=1 PW_DIR=... CHROME=... node test/viewport-pointer-boundary-browser.mjs NEW_ABSOLUTE_OUTPUT
// D555_POINTER_TAIL=1 runs the window selection and feature handle cases only.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const repo = resolve(import.meta.dirname, '../../..');
const [output] = process.argv.slice(2);
const mode = process.env.D555_POINTER_TAIL ?? 'full';
const scope = {
  full: 'Wheel, middle pan, window selection, and one straight feature arrow.',
  1: 'Window selection and one straight feature arrow.',
  handle: 'One straight feature arrow. Wheel is used only for framing.',
};
assert.ok(Object.hasOwn(scope, mode));
assert.equal(process.env.D555_SOURCE_FROZEN, '1');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
await mkdir(output);

const fixture = 'apps/cad-studio/handover/notes/project-open-ownership-2026-10-29/consumers/final-first/project-to-B/normal-B-control-nativeA.bcad';
const fixtureBytes = await readFile(resolve(repo, fixture));
const fixtureHash = '7dddcf338c7594c8122c6d41c2fe6457cf937104f8b6b8a0217f5f1d26eb1604';
assert.equal(sha256(fixtureBytes), fixtureHash);
const original = JSON.parse(fixtureBytes);

const requiredFrozen = [
  'apps/cad-studio/test/viewport-pointer-boundary-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/Viewport.tsx',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/viewport/camera.ts',
  'apps/cad-studio/src/viewport/gizmo.ts',
];
const f = await createFlow({
  name: 'viewport-pointer-boundary', envFrozen: 'D555_SOURCE_FROZEN', output,
  qualification: 'D555 Studio viewport pointer lifecycle',
  initialFiles: [fixture, ...requiredFrozen, 'apps/cad-studio/test/flow-helper.mjs'],
  requiredFrozen,
  limits: [
    'One desktop WebGPU context. Public mouse, keyboard, and Studio controls. Development hooks only observe state.',
    `One retained box. ${scope[mode]}`,
  ],
});
f.report.mode = mode;

const canvas = () => f.page.locator('canvas.vp-canvas');
const button = name => f.page.getByRole('button', { name, exact: true });
const corners = [0, 10].flatMap(x => [0, 10].flatMap(y => [0, 10].map(z => [x, y, z])));
const camera = () => f.page.evaluate(points => ({
  eye: window.__studioEye(),
  center: window.__studioScreenOf([5, 5, 5]),
  corners: points.map(point => window.__studioScreenOf(point)),
}), corners);

function bounds(points) {
  const x = points.map(point => point[0]), y = points.map(point => point[1]);
  return { left: Math.min(...x), right: Math.max(...x), top: Math.min(...y), bottom: Math.max(...y) };
}

async function routeLocalOnly() {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.report.runtimeOwnership = { nodePID: process.pid, nodePPID: process.ppid, serverURL: origin };
  f.report.networkEvents = [];
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (request.resourceType() === 'font' || /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
          f.report.networkEvents.push({ url: url.href, action: 'FONT_FULFILLED_EMPTY' });
          await route.fulfill({ status: 200, contentType: request.resourceType() === 'font' ? 'font/woff2' : 'text/css', body: '' });
        } else if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) {
          f.report.networkEvents.push({ url: url.href, action: 'NONLOCAL_HTTP_ABORTED' });
          await route.abort();
        } else await route.continue();
      });
      return context;
    } catch (error) {
      await context.close();
      throw error;
    }
  };
}

async function frameIso() {
  await f.page.locator('.views button:text-is("Iso")').click();
  await f.page.keyboard.press('f');
  let previous, stable = 0;
  for (let i = 0; i < 50 && stable < 3; i++) {
    await f.page.waitForTimeout(50);
    const now = JSON.stringify(await camera());
    stable = now === previous ? stable + 1 : 0;
    previous = now;
  }
  assert.equal(stable, 3, 'frame reaches a stable camera pose');
}

async function canvasAt([x, y]) {
  return f.page.evaluate(([px, py]) => !!document.elementFromPoint(px, py)?.matches('canvas.vp-canvas'), [x, y]);
}

async function zoomAndPan() {
  f.phase = '02 wheel changes projected box span';
  const mouse = f.page.mouse;
  const before = await camera();
  assert.ok(await canvasAt(before.center));
  await mouse.move(...before.center);
  await mouse.wheel(0, -120);
  await f.page.waitForFunction(eye => window.__studioEye().some((value, i) => value !== eye[i]), before.eye);
  const zoomed = await camera();
  const a = bounds(before.corners), b = bounds(zoomed.corners);
  assert.ok(b.right - b.left > (a.right - a.left) * 1.1, 'wheel toward the box increases its projected width');
  assert.deepEqual(await f.doc(), original);
  f.report.observations.push({ label: 'wheel', before, zoomed });
  await f.snapshot('02-wheel');

  f.phase = '03 middle pan retains capture outside and ends on release';
  const box = await canvas().boundingBox();
  const start = [box.x + 45, box.y + box.height / 2];
  const inside = [box.x + 18, start[1]];
  const outside = [box.x - 18, start[1]];
  assert.ok(await canvasAt(start));
  assert.ok(await canvasAt(inside));
  assert.equal(await canvasAt(outside), false);

  await mouse.move(...start);
  await mouse.down({ button: 'middle' });
  await mouse.move(...inside, { steps: 3 });
  const pannedInside = await camera();
  assert.ok(pannedInside.center[0] < zoomed.center[0] - 10);
  await mouse.move(...outside, { steps: 4 });
  const pannedOutside = await camera();
  assert.ok(pannedOutside.center[0] < pannedInside.center[0] - 10, 'captured movement continues beyond the canvas');
  await mouse.up({ button: 'middle' });
  await mouse.move(...start);
  await mouse.move(start[0] + 60, start[1] + 20, { steps: 3 });
  assert.deepEqual(await camera(), pannedOutside, 'hover after release does not pan');
  assert.deepEqual(await f.doc(), original);
  f.report.observations.push({ label: 'middle-pan', start, inside, outside, pannedInside, pannedOutside });
  await f.snapshot('03-middle-pan');
}

async function frameClearOfPanels() {
  f.phase = '04 expose both framing endpoints';
  await frameIso();
  const mouse = f.page.mouse;
  const attempts = [];
  f.report.observations.push({ label: 'window-setup', attempts });
  const maxWheelSteps = 4;
  let pose = await camera(), endpoints;
  for (let step = 0; step <= maxWheelSteps; step++) {
    const { left, right, top, bottom } = bounds(pose.corners);
    const from = [left - 20, top - 20], to = [right + 20, bottom + 20];
    const fromOnCanvas = await canvasAt(from), toOnCanvas = await canvasAt(to);
    attempts.push({ step, from, to, fromOnCanvas, toOnCanvas });
    if (fromOnCanvas && toOnCanvas) {
      endpoints = { from, to };
      break;
    }
    if (step === maxWheelSteps) break;
    assert.ok(await canvasAt(pose.center), 'wheel setup has an exposed canvas center');
    await mouse.move(...pose.center);
    await mouse.wheel(0, 120);
    await f.page.waitForFunction(eye => window.__studioEye().some((value, i) => value !== eye[i]), pose.eye);
    pose = await camera();
  }
  assert.ok(endpoints, 'both endpoints of the enclosing window are on exposed canvas');
  return endpoints;
}

async function selectBox({ from, to }) {
  f.phase = '04 window selects the enclosed body on release';
  const mouse = f.page.mouse;
  const marquee = f.page.locator('.vp-overlay .marquee');
  await mouse.move(...from);
  await mouse.down();
  await mouse.move(...to, { steps: 10 });
  await marquee.waitFor({ state: 'attached' });
  assert.equal(await marquee.evaluate(el => el.classList.contains('crossing')), false);
  const held = await f.snapshot('04-window-held');
  assert.deepEqual(held.selection.selection.bodies, []);
  await mouse.up();
  await marquee.waitFor({ state: 'detached' });
  await f.page.waitForFunction(() => window.__studioSelection?.selection.bodies.length === 1);
  const released = await f.snapshot('05-window-released');
  assert.deepEqual(released.selection.selection.bodies, [0]);
  assert.deepEqual(released.selection.selection.faces, []);
  assert.deepEqual(released.selection.selection.edges, []);
  assert.equal(released.bodies.bodies[0]?.key, 'b1');
  assert.deepEqual(released.doc, original);
}

async function dragWidth() {
  await f.openFeatureEditor(1, 'box');
  f.phase = '06 drag and release the Width X feature handle';
  const arrow = f.page.locator('g.gizmo-handle[data-handle="w"]');
  await arrow.waitFor();
  const { root, head } = await arrow.evaluate(el => {
    const center = part => {
      const box = el.querySelector(part).getBoundingClientRect();
      return [box.x + box.width / 2, box.y + box.height / 2];
    };
    return { root: center('circle'), head: center('polygon') };
  });
  const dx = head[0] - root[0], dy = head[1] - root[1], length = Math.hypot(dx, dy);
  assert.ok(length > 10);
  const end = [head[0] + 40 * dx / length, head[1] + 40 * dy / length];
  assert.ok(await canvasAt(head));
  assert.ok(await canvasAt(end));
  const hud = f.page.locator('.hud');
  const width = hud.locator('.field').filter({ hasText: 'Width X' }).locator('input').first();
  assert.equal((await f.doc()).nodes[1].made.values.w, 10);
  await hud.waitFor({ state: 'hidden' });
  const mouse = f.page.mouse;
  await mouse.move(...head);
  await mouse.down();
  await mouse.move(...end, { steps: 10 });
  await width.waitFor({ timeout: 10000 });
  const heldWidth = Number(await width.inputValue());
  assert.ok(heldWidth > 10, 'outward drag increases Width X before release');
  assert.deepEqual(await f.doc(), original);
  await mouse.up();
  const valueBox = f.page.locator('.handle-value input');
  await valueBox.waitFor();
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent?.trim() === 'preview');
  assert.equal(Number(await valueBox.inputValue()), heldWidth);
  assert.equal(Number(await width.inputValue()), heldWidth);
  assert.deepEqual(await f.doc(), original);
  f.report.observations.push({ label: 'width-drag', root, head, end, heldWidth });
  await f.snapshot('06-width-released');

  f.phase = '07 apply the dragged width and undo';
  await hud.getByRole('button', { name: 'Apply', exact: true }).click();
  await f.changed(original);
  const applied = await f.snapshot('07-width-applied');
  assert.equal(applied.doc.nodes[1].made.values.w, heldWidth);
  assert.deepEqual(applied.doc.nodes[0].max, [heldWidth, 10]);
  assert.equal(applied.doc.nodes[1].height, 10);
  const volume = applied.bodies.bodies[0].volume;
  assert.ok(Math.abs(volume - heldWidth * 100) <= 1e-6, 'box volume agrees with the dragged width');
  await f.undo();
  await f.same(original);
  await f.snapshot('08-width-undone');
}

await f.run(async () => {
  assert.equal(f.report.sourceFrozen[fixture], fixtureHash);
  await routeLocalOnly();
  await f.newPage();
  f.phase = '01 public Open of retained box';
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(resolve(repo, fixture));
  await f.same(original);
  await frameIso();
  await f.snapshot('01-open-box');
  if (mode === 'full') await zoomAndPan();
  const endpoints = await frameClearOfPanels();
  if (mode !== 'handle') await selectBox(endpoints);
  await dragWidth();
  assert.deepEqual(f.report.downloads, []);
});

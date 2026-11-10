// D553. Root runs under the heavy gate from apps/cad-studio.
// D553_SOURCE_FROZEN=1 PW_DIR=... CHROME=... node test/viewport-interaction-boundary-browser.mjs NEW_ABSOLUTE_OUTPUT
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const repo = resolve(import.meta.dirname, '../../..');
const [output] = process.argv.slice(2);
assert.equal(process.env.D553_SOURCE_FROZEN, '1');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
await mkdir(output);

const fixture = 'apps/cad-studio/handover/notes/project-open-ownership-2026-10-29/consumers/final-first/project-to-B/normal-B-control-nativeA.bcad';
const fixtureBytes = await readFile(resolve(repo, fixture));
const fixtureHash = '7dddcf338c7594c8122c6d41c2fe6457cf937104f8b6b8a0217f5f1d26eb1604';
assert.equal(sha256(fixtureBytes), fixtureHash);
const original = JSON.parse(fixtureBytes);
const requiredFrozen = [
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/viewport/SceneViewport.tsx',
  'apps/cad-studio/src/viewport/Viewport.tsx', 'apps/cad-studio/src/viewport/useViewportPicking.ts',
];
const f = await createFlow({
  name: 'viewport-interaction-boundary', envFrozen: 'D553_SOURCE_FROZEN', output,
  qualification: 'D553 Studio viewport picking and sketch interaction boundary',
  initialFiles: [
    fixture, ...requiredFrozen, 'apps/cad-studio/test/flow-helper.mjs',
    'apps/cad-studio/src/ui/SketchMarks.tsx', 'apps/cad-studio/src/ui/ContextMenu.tsx',
    'packages/barocss-cad-model/src/sketch/rules.ts', 'packages/barocss-cad-model/src/sketch/loops.ts',
  ],
  requiredFrozen,
  snapshotExtra: () => ({
    contextTitle: document.querySelector('.ctx-menu .ctx-title')?.textContent ?? null,
    inlineEditor: document.querySelector('.dim-edit')?.getAttribute('aria-label') ?? null,
    panelLength: document.querySelector('#sk-len0')?.value ?? null,
  }),
  limits: [
    'One desktop WebGPU context. Input is public Studio UI. Development hooks only observe state.',
    'One retained box for whole-body and face context selection. One new outline for an inline driving length.',
    'No Print projection, renderer recovery, trim, band, chain, marquee, native Save/Open round trip, or broad sketch-solver claim.',
  ],
});

function button(name) {
  return f.page.getByRole('button', { name, exact: true });
}

async function canvasCenter() {
  const canvas = await f.page.locator('.vp-canvas').boundingBox();
  assert.ok(canvas, 'viewport canvas');
  return [canvas.x + canvas.width / 2, canvas.y + canvas.height / 2];
}

async function clickAt(x, y) {
  await f.page.mouse.move(x - 4, y);
  await f.page.mouse.move(x, y);
  await f.page.mouse.click(x, y);
}

async function routeLocalOnly() {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.report.runtimeOwnership = { nodePID: process.pid, nodePPID: process.ppid, serverURL: origin };
  f.report.networkEvents = [];
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block' });
    try {
      await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
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

await f.run(async () => {
  assert.equal(f.report.sourceFrozen[fixture], fixtureHash);
  await routeLocalOnly();
  await f.newPage();

  f.phase = '01 public Open of retained box';
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(resolve(repo, fixture));
  await f.same(original);
  await f.page.locator('.views button:text-is("Iso")').click();
  await f.page.keyboard.press('f');
  await f.snapshot('01-open-box');

  f.phase = '02 double-click body';
  const [bx, by] = await canvasCenter();
  await f.page.mouse.dblclick(bx, by);
  await f.page.waitForFunction(() => window.__studioSelection?.selection.bodies.length === 1);
  const body = await f.snapshot('02-double-click-body');
  assert.deepEqual(body.selection.selection.bodies, [0]);
  assert.deepEqual(body.selection.selection.faces, []);
  assert.deepEqual(body.selection.selection.edges, []);
  assert.equal(body.bodies.bodies[0]?.key, 'b1');
  assert.deepEqual(body.doc, original);

  f.phase = '03 right-click face context';
  await f.page.mouse.click(bx, by, { button: 'right' });
  await f.page.locator('.ctx-menu').waitFor();
  const menu = await f.snapshot('03-right-click-face');
  assert.equal(menu.contextTitle, 'FACE');
  assert.equal(menu.selection.selection.faces.length, 1);
  assert.equal(menu.selection.selection.faces[0].body, 0);
  assert.deepEqual(menu.selection.selection.bodies, []);
  assert.deepEqual(menu.selection.selection.edges, []);
  assert.deepEqual(menu.doc, original);
  await f.page.keyboard.press('Escape');
  await f.page.locator('.ctx-menu').waitFor({ state: 'hidden' });

  f.phase = '04 draw a closed outline with canvas input';
  await button('New part').click();
  await f.page.waitForFunction(() => window.__studioDoc?.nodes?.length === 0);
  const blank = await f.doc();
  await f.page.keyboard.press('s');
  await f.sketchPanel().waitFor();
  await f.page.keyboard.press('l');
  const [sx, sy] = await canvasCenter();
  for (const [x, y] of [[-150, -80], [150, -80], [130, 80], [-160, 90], [-150, -80]]) {
    await clickAt(sx + x, sy + y);
  }
  const polygon = f.page.locator('.vp-overlay polygon.sk-shape:not(.done)');
  await polygon.waitFor({ state: 'attached' });
  const outline = await f.snapshot('04-outline-before-dimension');
  assert.deepEqual(outline.doc, blank);

  f.phase = '05 pick the first edge and commit its inline length';
  const edge = await polygon.evaluate(el => {
    const bounds = el.closest('.vp-overlay').getBoundingClientRect();
    const a = el.points.getItem(0), b = el.points.getItem(1);
    return [bounds.left + (a.x + b.x) / 2, bounds.top + (a.y + b.y) / 2];
  });
  await f.page.keyboard.press('d');
  await clickAt(...edge);
  const input = f.page.locator('.dim-edit');
  await input.waitFor();
  const editor = await f.snapshot('05-inline-editor');
  assert.equal(editor.inlineEditor, 'Length of edge 1');
  assert.deepEqual(editor.doc, blank);
  await input.fill('60');
  await input.press('Enter');
  await input.waitFor({ state: 'hidden' });
  await f.page.waitForFunction(() => document.querySelector('#sk-len0')?.value === '60');
  const accepted = await f.snapshot('06-inline-length-accepted');
  assert.equal(accepted.panelLength, '60');
  assert.equal(accepted.sketchAlert, null);
  assert.deepEqual(accepted.doc, blank);

  const finished = await f.finishSketch('07-finished-sketch');
  assert.equal(finished.doc.nodes.length, 1);
  const sketch = finished.doc.nodes[0];
  assert.equal(sketch.kind, 'sketch');
  assert.equal(sketch.outline?.lengths?.[0], 60);
  const [a, b] = sketch.outline.points;
  const measuredMM = Math.hypot(b[0] - a[0], b[1] - a[1]);
  f.report.observations.push({ label: 'first-edge-length', authoredMM: 60, measuredMM, toleranceMM: 1e-6 });
  await f.persist();
  assert.ok(Math.abs(measuredMM - 60) <= 1e-6, 'stored outline agrees with the driving length');
});

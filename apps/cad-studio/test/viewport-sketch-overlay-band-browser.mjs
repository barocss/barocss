// D554. Root runs under the heavy gate from apps/cad-studio.
// D554_SOURCE_FROZEN=1 PW_DIR=... CHROME=... node test/viewport-sketch-overlay-band-browser.mjs NEW_ABSOLUTE_OUTPUT
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const repo = resolve(import.meta.dirname, '../../..');
const [output] = process.argv.slice(2);
assert.equal(process.env.D554_SOURCE_FROZEN, '1');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
await mkdir(output);

const requiredFrozen = [
  'apps/cad-studio/src/viewport/Viewport.tsx',
  'apps/cad-studio/src/ui/SketchPanel.tsx',
  'apps/cad-studio/src/app/bandControls.ts',
  'packages/barocss-cad-model/src/sketch/band.ts',
];
const f = await createFlow({
  name: 'viewport-sketch-overlay-band', envFrozen: 'D554_SOURCE_FROZEN', output,
  qualification: 'D554 Studio active-sketch Band overlay and live width redraw',
  initialFiles: [
    ...requiredFrozen, 'apps/cad-studio/test/flow-helper.mjs',
    'apps/cad-studio/src/App.tsx', 'packages/barocss-cad-model/src/app/profiles.ts',
    'packages/barocss-cad-model/src/sketch/loops.ts', 'packages/barocss-cad-model/src/sketch/select.ts',
  ],
  requiredFrozen,
  snapshotExtra: () => {
    const input = label => document.querySelector(`.sk-panel input[aria-label="${label}"]`)?.value ?? null;
    const sketchNumber = id => document.getElementById(id)?.value ?? null;
    return {
      circle: { x: sketchNumber('sk-cx'), y: sketchNumber('sk-cy'), diameter: sketchNumber('sk-diameter') },
      band: { offset: input('Band offset'), width: input('Band width') },
      overlay: {
        paths: [...document.querySelectorAll('svg.vp-overlay path.sk-band')].map(el => el.getAttribute('d')),
        picked: document.querySelectorAll('svg.vp-overlay polygon.sk-band-pick').length,
        construction: [...document.querySelectorAll('svg.vp-overlay polygon.sk-shape.construction')].map(el => el.getAttribute('points')),
      },
    };
  },
  limits: [
    'One desktop WebGPU context and one active XY sketch. Actual public controls and canvas clicks author two construction circles.',
    'Checks highlight counts and path changes after a live width edit and restore. SVG observations do not certify native geometry.',
    'The accepted document stays empty throughout. No Finish, extrusion, native Save/Open, renderer recovery or mobile coverage.',
  ],
});

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

async function activeSnapshot(label, empty) {
  const state = await f.snapshot(label);
  assert.deepEqual(state.doc, empty);
  assert.equal(state.selection.sketch, true);
  assert.equal(state.sketchAlert, null);
  assert.deepEqual(state.notices, []);
  return state;
}

function requireBand(state, width, construction) {
  assert.match(state.sketchPanel, /BAND\s*·\s*2 sources/);
  assert.deepEqual(state.band, { offset: '0', width: String(width) });
  assert.deepEqual(state.overlay.construction, construction);
  assert.equal(state.overlay.paths.length, 1);
  assert.match(state.overlay.paths[0], /^M.+ZM.+Z$/);
  return state.overlay.paths[0];
}

await f.run(async () => {
  await routeLocalOnly();
  await f.newPage();

  f.phase = 'start an empty XY sketch';
  await f.page.getByRole('button', { name: 'New part', exact: true }).click();
  await f.page.waitForFunction(() => window.__studioDoc?.nodes.length === 0);
  await f.ready();
  const empty = await f.doc();
  await f.command('Sketch');
  await f.sketchPanel().waitFor();
  await f.sketchPanel().getByLabel('Sketch plane', { exact: true }).selectOption('xy');

  f.phase = 'draw two construction circles';
  await f.tool('Construction', 'x');
  const construction = f.page.getByRole('button', { name: 'Construction', exact: true });
  assert.match(await construction.getAttribute('class'), /(?:^|\s)on(?:\s|$)/);
  await f.tool('Circle', 'c');
  await f.frame([[-20, 0], [0, 20], [0, -20], [70, 0], [60, 10], [60, -10]]);
  const clickPixels = [];
  for (const [label, centre, rim, diameter, count] of [
    ['01-circle-a', [0, 0], [20, 0], 40, 1],
    ['02-circle-b', [60, 0], [70, 0], 20, 2],
  ]) {
    clickPixels.push({ label, centre: await f.worldClick(centre), rim: await f.worldClick(rim) });
    await f.page.mouse.move(5, 5);
    const circle = await activeSnapshot(label, empty);
    assert.deepEqual(circle.circle, { x: String(centre[0]), y: String(centre[1]), diameter: String(diameter) });
    assert.equal(circle.overlay.construction.length, count);
    assert.deepEqual(circle.overlay.paths, []);
  }
  f.report.observations.push({ label: 'circle-click-pixels', clickPixels });

  f.phase = 'pick two Band sources';
  await f.tool('Band', 'm');
  const make = f.sketchPanel().getByRole('button', { name: 'Make band', exact: true });
  await make.waitFor();
  assert.equal(await make.isEnabled(), false);
  await f.worldClick([5, 5]);
  await f.worldClick([60, 5]);
  await f.page.mouse.move(5, 5);
  const picked = await activeSnapshot('03-band-picks', empty);
  assert.match(picked.sketchPanel, /2 shapes picked/);
  assert.equal(picked.overlay.picked, 2);
  assert.equal(picked.overlay.construction.length, 2);
  assert.deepEqual(picked.overlay.paths, []);

  f.phase = 'make and draw the width 3 band';
  const width = f.sketchPanel().getByLabel('Band width', { exact: true });
  await width.fill('3');
  await make.click();
  await f.sketchPanel().getByRole('group', { name: 'Band', exact: true }).waitFor();
  await f.page.locator('svg.vp-overlay path.sk-band').waitFor({ state: 'attached' });
  const made = await activeSnapshot('04-band-width-3', empty);
  const originalPath = requireBand(made, 3, picked.overlay.construction);

  f.phase = 'edit the live width to 5';
  await width.fill('5');
  await width.press('Enter');
  await f.page.waitForFunction(before => {
    const path = document.querySelector('svg.vp-overlay path.sk-band')?.getAttribute('d');
    return !!path && path !== before;
  }, originalPath, { timeout: 10000 });
  const wider = await activeSnapshot('05-band-width-5', empty);
  assert.notEqual(requireBand(wider, 5, picked.overlay.construction), originalPath);

  f.phase = 'restore the live width to 3';
  await width.fill('3');
  await width.press('Enter');
  await f.page.waitForFunction(before =>
    document.querySelector('svg.vp-overlay path.sk-band')?.getAttribute('d') === before,
  originalPath, { timeout: 10000 });
  const restored = await activeSnapshot('06-band-width-3-restored', empty);
  assert.equal(requireBand(restored, 3, picked.overlay.construction), originalPath);
});

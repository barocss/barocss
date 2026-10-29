// D332 actual public selection controls. Four profiles run serially, not one test per screenshot.
// PW_DIR=/absolute/playwright CHROME=/absolute/chrome node test/selection-visibility-browser.mjs /absolute/artifacts
// No application state setters or synthetic output hooks. __studioScreenOf only projects points for actual mouse input.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';

assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory are required');
const app = resolve(import.meta.dirname, '..'), output = resolve(process.argv[2]);
await mkdir(output, { recursive: true });
const profiles = [], errors = [], consoleErrors = [], changes = [];
const cleanup = { contexts: [], browsers: [], server: 'NOT_STARTED' };
const report = { status: 'RUNNING', expectedProfiles: 4, profiles, errors, consoleErrors, changes, cleanup,
  visibilityAcceptance: 'MANUAL_SCREENSHOT_REVIEW_REQUIRED', pixelContrast: 'NOT_AUTOMATED',
  scope: { basePointEdgeFaceBody: 'REQUIRED', directGeometry: 'NOT_RUN', instances: 'NOT_RUN', sketchCageEditors: 'NOT_RUN' } };
let phase = 'startup', server, browser, context, page, current;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function closeContext() {
  if (!context) return;
  await context.close(); cleanup.contexts.push({ profile: current?.id, status: 'CLOSED' }); context = null;
}
async function closeBrowser(backend) {
  if (!browser) return;
  await browser.close(); cleanup.browsers.push({ backend, status: 'CLOSED' }); browser = null;
}
async function snapshot(label) {
  await settle();
  const state = await page.evaluate(label => {
    const rootStyle = getComputedStyle(document.documentElement);
    const markers = [...document.querySelectorAll('.vp-overlay .vertex-mark')].map(element => {
      const style = getComputedStyle(element);
      return { class: element.getAttribute('class'), radius: element.getAttribute('r'), fill: style.fill, stroke: style.stroke, strokeWidth: style.strokeWidth };
    });
    return { label, backend: document.querySelector('.viewport')?.dataset.renderer, theme: document.documentElement.dataset.theme,
      selection: window.__studioSelection, bodyState: window.__studioBodies?.(), doc: window.__studioDoc,
      filter: document.querySelector('[aria-label="Selection filter"]')?.textContent,
      inspector: document.querySelector('[aria-label="Selection"]')?.textContent,
      themeTokens: Object.fromEntries(['--selection', '--selection-hover', '--selection-ring', '--selection-soft'].map(name => [name, rootStyle.getPropertyValue(name).trim()])),
      markers, selectedOutlinerRows: [...document.querySelectorAll('.outliner .ol.sel, .outliner .ol-row.sel')].map(element => {
        const style = getComputedStyle(element); return { text: element.textContent, color: style.color, background: style.backgroundColor };
      }) };
  }, label);
  current.states.push(state); await persist();
  await page.screenshot({ path: join(output, current.id, `${label}.png`) }); return state;
}
async function filter(wanted) {
  const button = page.getByRole('button', { name: 'Selection filter', exact: true });
  for (let index = 0; index < 4; index++) {
    if ((await button.innerText()).includes(wanted)) return;
    await button.click();
  }
  assert.fail(`Selection filter must reach ${wanted}`);
}
async function clear() {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const selection = window.__studioSelection?.selection;
    return selection && ['vertices', 'edges', 'faces', 'bodies'].every(key => !selection[key]?.length);
  });
  const canvas = await page.locator('canvas.vp-canvas').boundingBox();
  await page.mouse.move(canvas.x + 12, canvas.y + canvas.height - 12); await settle();
}
async function position(point, inset = 0) {
  const projected = await page.evaluate(point => window.__studioScreenOf(point), point);
  assert.ok(projected?.length === 2 && projected.every(Number.isFinite), 'actual camera must project the input point');
  if (!inset) return projected;
  const center = await page.evaluate(() => window.__studioScreenOf([32, 16, 8]));
  const length = Math.hypot(center[0] - projected[0], center[1] - projected[1]);
  return [projected[0] + (center[0] - projected[0]) / length * inset, projected[1] + (center[1] - projected[1]) / length * inset];
}
async function picked(kind, point, inset = 0) {
  await clear(); await filter(({ vertices: 'Pick all', edges: 'Edges', faces: 'Faces', bodies: 'Bodies' })[kind]);
  const [x, y] = await position(point, inset); await page.mouse.move(x, y); await page.mouse.click(x, y);
  await page.waitForFunction(kind => window.__studioSelection?.selection[kind]?.length === 1, kind, { timeout: 15000 });
  const state = await snapshot(`selected-${kind}`);
  for (const other of ['vertices', 'edges', 'faces', 'bodies']) if (other !== kind) assert.equal(state.selection.selection[other]?.length ?? 0, 0, `only ${kind} must be selected`);
  return state;
}
async function createBox() {
  await page.getByRole('button', { name: 'New part', exact: true }).click(); await page.keyboard.press('b');
  await page.waitForSelector('.hud');
  for (const [label, value] of [['Width X', '64'], ['Depth Y', '32'], ['Height Z', '8']]) {
    await page.getByRole('dialog', { name: 'Box', exact: true }).getByLabel(label, { exact: true }).fill(value);
  }
  await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
  await page.locator('.hud').getByRole('button', { name: 'Apply', exact: true }).click();
  await page.waitForFunction(() => {
    const nodes = window.__studioDoc?.nodes, state = window.__studioBodies?.(), body = state?.bodies[0];
    return nodes?.length === 2 && nodes[0].kind === 'sketch' && nodes[0].profile === 'rectangle' && JSON.stringify(nodes[0].min) === '[0,0]' && JSON.stringify(nodes[0].max) === '[64,32]' &&
      nodes[1].kind === 'extrude' && nodes[1].height === 8 && nodes[1].sketch === 0 && window.__studioFresh === true && state?.fresh && state.massReady === true && state.bodies.length === 1 &&
      Math.abs(body.volume - 16384) < 1e-8 && body.centroid?.every((value, axis) => Math.abs(value - [32, 16, 4][axis]) < 1e-8);
  }, null, { timeout: 30000 });
  await page.locator('.views').getByRole('button', { name: 'Top', exact: true }).click(); await page.keyboard.press('f');
  // The existing view animation has time to reach Top before the projection hook supplies pick coordinates.
  await page.waitForTimeout(500); await clear();
}
try {
  server = await createServer({ root: app, configFile: join(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' });
  cleanup.server = 'OPEN'; server.watcher.on('change', file => changes.push(file)); await server.listen();
  const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
  for (const backend of ['webgpu', 'webgl2']) {
    phase = `launch ${backend}`;
    browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: backend === 'webgl2'
      ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--enable-unsafe-webgpu'] });
    for (const theme of ['dark', 'light']) {
      current = { id: `${backend}-${theme}`, backend, theme, status: 'RUNNING', states: [] }; profiles.push(current);
      await mkdir(join(output, current.id), { recursive: true }); phase = `${current.id} startup`;
      context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }); page = await context.newPage();
      page.on('pageerror', error => errors.push({ profile: current.id, error: error.stack ?? String(error) }));
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push({ profile: current.id, error: message.text() }); });
      page.on('dialog', dialog => dialog.accept());
      await page.goto(server.resolvedUrls.local[0] + (backend === 'webgl2' ? '?renderer=webgl2' : ''));
      await page.waitForSelector(`.viewport[data-renderer="${backend}"]`, { timeout: 30000 });
      if (await page.evaluate(() => document.documentElement.dataset.theme) !== theme) await page.getByRole('button', { name: 'Toggle light or dark theme', exact: true }).click();
      await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
      phase = `${current.id} public box preview and Apply`; await createBox();
      const initial = await snapshot('baseline-clear'); assert.equal(initial.backend, backend); assert.equal(initial.theme, theme);
      phase = `${current.id} public point hover and selection`; await filter('Pick all');
      const [x, y] = await position([0, 0, 8], 1.5); await page.mouse.move(x, y);
      await page.waitForSelector('.vp-overlay .vertex-mark.hover');
      const hovered = await snapshot('hover-point'); assert.equal(hovered.markers.find(marker => marker.class.includes('hover'))?.radius, '4');
      assert.equal(hovered.selection.selection.vertices?.length ?? 0, 0);
      const point = await picked('vertices', [0, 0, 8], 1.5), selectedMarker = point.markers.find(marker => marker.class.includes('selected'));
      assert.equal(selectedMarker?.radius, '6'); assert.ok(selectedMarker.stroke !== selectedMarker.fill, 'selected point must retain a contrasting ring');
      phase = `${current.id} public edge and face selection`; await picked('edges', [32, 0, 8], 1.5);
      const face = await picked('faces', [32, 16, 8]);
      if (theme === 'dark') {
        phase = `${current.id} selected-face theme switch preserves selection`;
        const toggle = page.getByRole('button', { name: 'Toggle light or dark theme', exact: true });
        await toggle.click(); await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
        const lightFace = await snapshot('selected-face-flipped-light');
        assert.deepEqual(lightFace.selection.selection, face.selection.selection, 'public theme change must preserve the picked face');
        assert.deepEqual(lightFace.doc.nodes, face.doc.nodes); assert.deepEqual(lightFace.doc.parameters, face.doc.parameters);
        assert.notEqual(lightFace.themeTokens['--selection'], face.themeTokens['--selection']);
        await toggle.click(); await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
        const darkFace = await snapshot('selected-face-flipped-back-dark');
        assert.deepEqual(darkFace.selection.selection, face.selection.selection);
        assert.deepEqual(darkFace.themeTokens, face.themeTokens);
        current.themeSwitch = 'PUBLIC_SELECTED_FACE_PRESERVED_VISUAL_REVIEW_REQUIRED';
      }
      phase = `${current.id} public body selection`; const body = await picked('bodies', [32, 16, 8]); assert.ok(body.selectedOutlinerRows.length, 'selected body must also be named in the outliner');
      phase = `${current.id} clear selection`; await clear(); const cleared = await snapshot('cleared'); assert.equal(cleared.markers.filter(marker => marker.class.includes('selected')).length, 0);
      assert.deepEqual(cleared.doc.nodes, initial.doc.nodes); assert.deepEqual(cleared.doc.parameters, initial.doc.parameters);
      assert.equal(errors.filter(error => error.profile === current.id).length, 0, 'profile must have no page exceptions');
      current.status = 'PASS'; current.meaning = 'Public pick/clear behavior and captured visual evidence; manual contrast review remains required';
      await closeContext(); await persist();
    }
    await closeBrowser(backend); await persist();
  }
  assert.equal(changes.length, 0, 'source must remain frozen during the four profiles'); assert.equal(profiles.length, 4);
  assert.notEqual(profiles[0].states[0].themeTokens['--selection'], profiles[1].states[0].themeTokens['--selection'], 'theme controls must choose different selection palettes');
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.firstFailure = { phase, message: error.message, stack: error.stack };
  if (current) current.status = 'FAIL'; if (page && !page.isClosed()) await snapshot('failure').catch(() => {}); process.exitCode = 1;
} finally {
  for (const [kind, resource] of [['context', context], ['browser', browser], ['server', server]]) {
    if (!resource) continue;
    try {
      await resource.close();
      if (kind === 'context') cleanup.contexts.push({ profile: current?.id, status: 'CLOSED' });
      else if (kind === 'browser') cleanup.browsers.push({ backend: current?.backend, status: 'CLOSED' }); else cleanup.server = 'CLOSED';
    } catch (error) {
      report.status = 'FAIL'; cleanup[kind] = { status: 'CLOSE_FAILED', message: error.message }; process.exitCode = 1;
      report.firstFailure ??= { phase: `cleanup ${kind}`, message: error.message };
    }
  }
  await persist();
}
process.stdout.write(JSON.stringify({ status: report.status, profiles: profiles.map(profile => ({ id: profile.id, status: profile.status })), cleanup, output, firstFailure: report.firstFailure }, null, 2) + '\n');

import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(mode === '--baseline' || mode === '--fixed');
const pins = ['apps/cad-studio/src/viewport/Viewport.tsx', 'apps/cad-studio/src/viewport/camera.ts',
  'apps/cad-studio/src/viewport/modelFitArea.ts', 'apps/cad-studio/src/ui/ViewDisplayControls.tsx', 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/styles.css'];
const f = await createFlow({ name: 'model-work-area-fit', envFrozen: 'D668_SOURCE_FROZEN', output,
  initialFiles: pins, requiredFrozen: pins, qualification: 'Model Fit and workspace occlusion with desktop docks' });
const dims = [100, 45, 28];
const fractions = [0, 0.25, 0.5, 0.75, 1];
const samples = fractions.flatMap(x => fractions.flatMap(y => fractions
  .filter(z => [x, y, z].some(k => k === 0 || k === 1))
  .map(z => [x * dims[0], y * dims[1], z * dims[2]])));
const fit = () => f.page.getByTitle('Frame all (F)', { exact: true });
const views = () => f.page.getByRole('group', { name: 'Views', exact: true });
const history = () => f.page.locator('.history .hs').evaluateAll(items => items.map(item => item.getAttribute('aria-label')));
const settle = () => f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
const chatToggle = () => f.page.locator('.topbar').getByRole('button', { name: 'Chat', exact: true });

function measure(world) {
  const canvas = document.querySelector('.vp-canvas'), c = canvas.getBoundingClientRect();
  const rect = selector => {
    const e = document.querySelector(selector);
    if (!e?.getClientRects().length) return null;
    const { left, right, top, bottom } = e.getBoundingClientRect();
    return { left, right, top, bottom };
  };
  const panels = { toolbar: rect('nav.toolbar'), chat: rect('.chat-col'), dock: rect('.dock'), strip: rect('.dock-strip'),
    topbar: rect('.topbar'), cube: rect('.view-cube'), views: rect('.corner-right'), history: rect('.history') };
  const screen = world.map(point => {
    const [x, y, depth] = window.__studioProject(point);
    return { x: c.left + x, y: c.top + y, depth };
  });
  const bounds = { left: Math.min(...screen.map(p => p.x)), right: Math.max(...screen.map(p => p.x)),
    top: Math.min(...screen.map(p => p.y)), bottom: Math.max(...screen.map(p => p.y)) };
  const blocked = {};
  for (const p of screen) {
    const hit = document.elementFromPoint(p.x, p.y);
    if (hit === canvas) continue;
    const panel = hit?.closest('nav.toolbar,.chat-col,.dock,.dock-strip,.topbar,.view-cube,.corner-right,.history');
    const label = panel?.getAttribute('aria-label') || panel?.getAttribute('class') || 'outside canvas';
    blocked[label] = (blocked[label] ?? 0) + 1;
  }
  const available = {
    left: Math.max(c.left, panels.toolbar.right),
    right: Math.min(c.right, panels.dock?.left ?? c.right, panels.strip?.left ?? c.right),
    top: Math.max(c.top, panels.topbar?.bottom ?? c.top, panels.cube?.bottom ?? c.top),
    bottom: Math.min(c.bottom, panels.views?.top ?? c.bottom, panels.history?.top ?? c.bottom),
  };
  return { canvas: rect('.vp-canvas'), panels, available, bounds, blocked, samples: screen.length,
    finiteInClip: screen.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.depth) < 1) };
}

function assertFrame(state, label) {
  assert.equal(state.finiteInClip, true, label);
  assert.deepEqual(state.blocked, {}, label + ' projected samples');
  const { bounds, available } = state;
  const clearance = Math.min(bounds.left - available.left, available.right - bounds.right,
    bounds.top - available.top, available.bottom - bounds.bottom);
  assert.ok(clearance >= 10, label + ' work-area clearance: ' + clearance);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin, newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  let failures = 0, nativeBox;
  for (const [width, height] of [[1280, 720], [1024, 768]]) {
    const size = width + 'x' + height;
    await f.newPage();
    await f.page.setViewportSize({ width, height });
    f.phase = 'create a measured Box at ' + size;
    await f.page.getByRole('button', { name: 'New part', exact: true }).click();
    await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
    await f.ready();
    await f.page.keyboard.press('b');
    const hud = f.page.getByRole('dialog', { name: 'Box', exact: true });
    for (const [i, label] of ['Width X', 'Depth Y', 'Height Z'].entries())
      await hud.getByLabel(label, { exact: true }).fill(String(dims[i]));
    const before = await f.doc();
    await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
    await hud.getByRole('button', { name: 'Apply', exact: true }).click();
    await f.changed(before);
    const doc = await f.doc(), steps = await history(), bodies = (await f.bodies()).bodies;
    nativeBox = doc;
    assert.equal(bodies.length, 1);
    assert.equal(bodies[0].volume, dims.reduce((a, b) => a * b));
    for (const [layout, chatOpen] of [['closed', false], ['open', true], ['reclosed', false]]) {
      const chat = f.page.locator('.chat-col');
      if (await chat.evaluate(e => e.classList.contains('open')) !== chatOpen)
        await chatToggle().click();
      await f.page.locator(chatOpen ? '.chat-col.open' : '.chat-col:not(.open)').waitFor();
      for (const [view, ortho] of [['Iso', false], ['Front', true]]) {
        const label = [size, layout, view].join('-');
        f.phase = 'Frame all in ' + label;
        await views().getByRole('button', { name: view, exact: true }).click();
        const orthoToggle = views().getByRole('button', { name: 'Ortho', exact: true });
        if (await orthoToggle.evaluate(e => e.classList.contains('on')) !== ortho) await orthoToggle.click();
        await fit().click();
        await f.page.mouse.move(width - 1, height - 1);
        await settle();
        const state = await f.page.evaluate(measure, samples);
        const occluded = Object.keys(state.blocked).length > 0;
        if (occluded) failures++;
        f.report.observations.push({ size, layout, chatOpen, view, ortho, ...state });
        await f.persist();
        assert.equal(state.finiteInClip, true);
        if (mode === '--fixed') assertFrame(state, label);
        if (occluded || chatOpen) await f.snapshot(label);
      }
    }
    if (mode === '--fixed') {
      f.phase = 'pick the framed solid and use keyboard Fit at ' + size;
      const state = await f.page.evaluate(measure, samples);
      await f.page.mouse.click((state.bounds.left + state.bounds.right) / 2, (state.bounds.top + state.bounds.bottom) / 2);
      const pick = () => f.page.evaluate(() => window.__studioSelection.selection);
      const selection = await pick();
      assert.ok(selection.faces.length + selection.edges.length + selection.bodies.length > 0);
      await f.page.keyboard.press('f');
      await settle();
      const keyboard = await f.page.evaluate(measure, samples);
      assertFrame(keyboard, size + ' keyboard Fit selection');
      assert.deepEqual(await pick(), selection);
      f.report.observations.push({ size, method: 'keyboard', selection, ...keyboard });
      if (width === 1024) {
        f.phase = 'keyboard Fit with the chat dock and right dock sheet open';
        await chatToggle().click();
        await f.page.locator('.chat-col.open').waitFor();
        await f.page.getByRole('button', { name: 'Open the dock', exact: true }).click();
        await f.page.locator('.dock.sheet').waitFor();
        await f.page.keyboard.press('f');
        await settle();
        const sheet = await f.page.evaluate(measure, samples);
        assertFrame(sheet, '1024x768 right dock sheet');
        assert.deepEqual(await pick(), selection);
        f.report.observations.push({ size, method: 'keyboard', layout: 'open-right-sheet', ...sheet });
        await f.snapshot('1024x768-open-right-sheet');
        await f.page.getByRole('button', { name: 'Close the dock', exact: true }).click();
        await chatToggle().click();
      }
    }
    await f.same(doc);
    assert.deepEqual(await history(), steps);
  }
  if (mode === '--baseline') {
    assert.ok(failures > 0, 'at least one verified occlusion after Frame all');
  } else {
    f.phase = 'settled automatic fit after opening the native Box in a fresh Studio';
    await f.newPage();
    await f.page.setViewportSize({ width: 1280, height: 720 });
    await chatToggle().click();
    await f.page.locator('.chat-col.open').waitFor();
    await f.page.getByLabel('Model file', { exact: true }).setInputFiles({
      name: 'd668-box.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(nativeBox)),
    });
    await f.same(nativeBox);
    const automatic = await f.page.waitForFunction(world => {
      const canvas = document.querySelector('.vp-canvas'), c = canvas.getBoundingClientRect();
      const rail = document.querySelector('nav.toolbar').getBoundingClientRect();
      const [x, y] = window.__studioProject(world);
      return Math.abs(c.left + x - (rail.right + c.right) / 2) < 1 && c.top + y > 150;
    }, dims.map(d => d / 2));
    await automatic.dispose();
    const state = await f.page.evaluate(measure, samples);
    assertFrame(state, 'automatic native Open fit');
    f.report.observations.push({ size: '1280x720', method: 'native-open', chatOpen: true, ...state });
    await f.snapshot('1280x720-automatic-native-open');
  }
  assert.deepEqual(f.report.downloads, []);
});

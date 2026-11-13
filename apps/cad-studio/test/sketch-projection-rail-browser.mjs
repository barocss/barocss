import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const pins = [
  'apps/cad-studio/test/sketch-projection-rail-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/styles.css', 'apps/cad-studio/src/viewport/Viewport.tsx',
  'apps/cad-studio/src/app/sketchControls.ts', 'apps/cad-studio/src/viewport/modelFitArea.ts',
];
const f = await createFlow({
  name: 'sketch-projection-rail', output: process.argv[2], envFrozen: 'D1041_SOURCE_FROZEN',
  qualification: 'Select a projected corner in the desktop sketch without passing clicks through the tool rail.',
  limits: ['One native orthogonal pocket plate. Desktop viewport at 1024 × 900.'],
  initialFiles: pins, requiredFrozen: pins,
});
const solid = node => ({ node, side: 'solid' });
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', id: 'n0', profile: 'rectangle', min: [0,0], max: [120,30] },
    { kind: 'extrude', id: 'n1', sketch: 0, height: 8 },
    { kind: 'sketch', id: 'n2', profile: 'rectangle', min: [40,8], max: [72,22] },
    { kind: 'extrude', id: 'n3', sketch: 2, height: 5, from: 4 },
    { kind: 'difference', id: 'n4', parent: solid(1), tool: solid(3) },
  ],
  outputs: { b4: solid(4) }, nextId: 5,
};
const button = name => f.page.getByRole('button', { name, exact: true });
const select = () => f.page.getByRole('navigation', { name: 'Tools', exact: true }).getByRole('button', { name: 'Select', exact: true });

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, viewport: { width: 1024, height: 900 }, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'sketch-projection-rail.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  await button('Front').click();
  await f.page.locator('.outliner .ol-row > button.ol').first().click();
  await f.page.waitForFunction(() => window.__studioSelection?.selection.bodies[0] === 0);
  f.phase = 'Project from Front and select the original lower-left corner';
  await clickModelCommand(f.page, 'Create', 'Project to sketch');
  await f.sketchPanel().waitFor();
  await select().click();
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const point = await f.page.evaluate(() => {
    const p = window.__studioScreenOf([0,0,0]);
    const rail = document.querySelector('nav.toolbar').getBoundingClientRect();
    const canvas = document.querySelector('canvas.vp-canvas').getBoundingClientRect();
    const hit = document.elementFromPoint(...p);
    const marks = [...document.querySelectorAll('.vp-overlay .sk-end, .vp-overlay .sk-point')].map(mark => {
      const r = mark.getBoundingClientRect();
      return [(r.left + r.right) / 2, (r.top + r.bottom) / 2];
    });
    return { p, rail: rail.toJSON(), canvas: canvas.toJSON(), hit: hit?.tagName, insideRail: !!hit?.closest('nav.toolbar'),
      canvasHit: !!hit?.closest('canvas.vp-canvas'), closestMark: Math.min(...marks.map(q => Math.hypot(q[0] - p[0], q[1] - p[1]))) };
  });
  f.report.observations.push(point);
  await f.snapshot('projected-corner');
  assert.ok(point.closestMark < 1, 'the projected sketch has a marker at the world corner');
  await f.page.mouse.click(...point.p);
  assert.ok(point.canvasHit, 'the original corner must receive a canvas click');
  await f.page.locator('.vp-overlay .on[data-sketch-entity^="point:"]').waitFor({ timeout: 6000 });
  const picked = await f.page.locator('.vp-overlay .on[data-sketch-entity^="point:"]').getAttribute('data-sketch-entity');
  await f.page.mouse.click(point.canvas.width / 2, point.canvas.height * 0.32);
  assert.equal(await f.page.locator('.vp-overlay .on[data-sketch-entity]').count(), 0);
  const opposite = await f.page.evaluate(() => window.__studioScreenOf([120,30,0]));
  assert.ok(await f.page.evaluate(p => !!document.elementFromPoint(...p)?.closest('canvas.vp-canvas'), opposite));
  await f.snapshot('projected-corner-picked');

  f.phase = 'The rail does not pass a covered corner click to Sketch';
  const railPixel = point.rail.right - 2;
  const pan = [point.canvas.width / 2, point.p[1]];
  await f.page.mouse.move(...pan);
  await f.page.mouse.down({ button: 'middle' });
  await f.page.mouse.move(pan[0] + railPixel - point.p[0], pan[1], { steps: 8 });
  await f.page.mouse.up({ button: 'middle' });
  const covered = await f.page.evaluate(() => {
    const p = window.__studioScreenOf([0,0,0]);
    return { p, rail: !!document.elementFromPoint(...p)?.closest('nav.toolbar') };
  });
  assert.ok(covered.rail, 'pan puts the original corner under the rail');
  await f.page.mouse.click(...covered.p);
  assert.deepEqual(await f.page.locator('.vp-overlay .on[data-sketch-entity]').evaluateAll(marks => marks.map(mark => mark.getAttribute('data-sketch-entity'))), []);
  f.report.observations.push({ picked, opposite, covered });
  await f.snapshot('covered-corner-ignored');
  await f.same(source);
  assert.deepEqual(f.report.downloads, []);
});

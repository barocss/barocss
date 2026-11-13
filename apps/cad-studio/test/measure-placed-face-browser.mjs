import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const contextMenu = process.argv.includes('--context');
const pins = [
  'apps/cad-studio/test/measure-placed-face-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/useViewportPicking.ts', 'apps/cad-studio/src/ui/MeasurementInspector.tsx',
  'apps/cad-studio/src/ui/ViewContextMenu.tsx',
  ...(contextMenu ? ['apps/cad-studio/src/viewport/viewportPointerInput.ts', 'apps/cad-studio/src/viewport/Viewport.tsx'] : []),
];
const f = await createFlow({
  name: 'measure-placed-face', output: process.argv[2], envFrozen: contextMenu ? 'D1040_SOURCE_FROZEN' : 'D1036_SOURCE_FROZEN',
  qualification: contextMenu ? 'Measure from here starts at the accepted static placed face.' : 'Ordinary Measure reads accepted placed faces in world coordinates.',
  limits: ['A native base cap and one translated rectangular occurrence cap.'],
  initialFiles: pins, requiredFrozen: [...pins, 'apps/cad-studio/src/app/measureTargets.ts'],
  snapshotExtra: () => ({
    measure: document.querySelector('[aria-label="Measurement"]')?.textContent ?? null,
    overlay: window.__studioOverlayTexts?.()['measure:label'] ?? [],
  }),
});
const part = (w,d,h) => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0,0], max: [w,d], id: 'n0' }, { kind: 'extrude', sketch: 0, height: h, id: 'n1' }],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
});
const source = { ...part(40,30,10), instances: [
  { id: 'inst1', name: 'Witness plate', doc: part(30,12,6), position: [60,0,15], rotation: [0,0,0] },
] };
const button = name => f.page.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'Measurement', exact: true });
const metric = label => panel().locator('.kv').filter({ hasText: new RegExp('^' + label + '\\b') }).locator('b');

async function cap(side, world, mouseButton = 'left') {
  await button('View cube directions').click();
  await f.page.getByRole('menuitem', { name: side, exact: true }).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.page.locator('.view-cube .vc-label').getByText(side.toUpperCase(), { exact: true }).waitFor();
  await f.page.waitForFunction(side => {
    const eye = window.__studioEye?.();
    return eye && (side === 'Top' ? eye[2] > 21 : eye[2] < 0);
  }, side);
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const pixel = await f.page.evaluate(world => window.__studioScreenOf(world), world);
  assert.ok(await f.page.evaluate(([x,y]) => !!document.elementFromPoint(x,y)?.closest('canvas.vp-canvas'), pixel), pixel);
  await f.page.mouse.click(...pixel, { button: mouseButton });
}
async function readDistance(label, distance, normal) {
  await metric('Distance').getByText(distance + ' mm', { exact: true }).waitFor();
  assert.equal(await metric('Normal distance').innerText(), normal + ' mm');
  await f.page.waitForFunction(distance => window.__studioOverlayTexts?.()['measure:label']?.includes(distance + ' mm'), distance);
  await f.snapshot(label);
}
await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'measure-placed-face.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  if (contextMenu) {
    f.phase = 'Start Measure from the translated occurrence bottom context menu';
    await f.page.waitForFunction(() => window.__studioInstanceBounds?.()?.length === 1);
    await cap('Bottom', [70,6,15], 'right');
    const menu = f.page.getByRole('menu');
    await menu.waitFor();
    await f.snapshot('placed-context-menu');
    const action = menu.getByRole('menuitem', { name: /^Measure from here(?:$| )/ });
    assert.equal(await action.count(), 1, 'the accepted placed face must offer Measure from here');
    assert.equal(await menu.getByRole('menuitem', { name: /Delete|Hide body|Show only this/ }).count(), 0);
    await action.click();
    assert.equal(await metric('From').innerText(), 'Planar face');
    assert.equal(await metric('Body').innerText(), 'Witness plate (inst1/b1)');
    await cap('Top', [20,6,10]);
    await readDistance('placed-context-to-base', '20.62', '5');
    assert.deepEqual((await metric('ΔX ΔY ΔZ').innerText()).split(', ').map(Number), [-20,0,-5]);
    assert.equal(await button('Pin measurement').count(), 0);
    await f.same(source);

    f.phase = 'Explode suspends the placed context measurement and refuses a fresh placed start';
    await button('Explode').click();
    await panel().getByRole('status').getByText(/Witness plate.*unavailable/).waitFor();
    await f.page.waitForFunction(() => !window.__studioOverlayTexts?.()['measure:label']);
    await f.snapshot('placed-context-exploded');
    await button('Done measuring').click();
    const bottom = await f.page.evaluate(() => {
      const bounds = window.__studioInstanceBounds?.()[0];
      return bounds && [(bounds.min[0] + bounds.max[0]) / 2, (bounds.min[1] + bounds.max[1]) / 2, bounds.min[2]];
    });
    assert.ok(bottom && Math.abs(bottom[0] - 75) > 1, 'click the displaced occurrence itself');
    await cap('Bottom', bottom, 'right');
    await menu.waitFor();
    assert.equal(await action.count(), 0);
    await f.snapshot('placed-context-exploded-menu');
    await f.page.keyboard.press('Escape');
    for (let i = 0; i < 3; i++) await button('Explode').click();
    await cap('Bottom', [70,6,15], 'right');
    await action.click();
    assert.equal(await metric('Body').innerText(), 'Witness plate (inst1/b1)');
    await f.same(source);
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  await clickModelCommand(f.page, 'Inspect', 'Measure');
  await panel().waitFor();
  f.phase = 'Pick the base top and the translated occurrence bottom in Inspect Measure';
  await f.page.waitForFunction(() => window.__studioInstanceBounds?.()?.length === 1);
  await cap('Top', [20,6,10]);
  await panel().getByText('Planar face', { exact: true }).waitFor();
  await cap('Bottom', [70,6,15]);
  const measured = await panel().getByText('BETWEEN', { exact: true }).waitFor({ timeout: 6000 }).then(() => true, () => false);
  await f.snapshot('base-to-placed');
  assert.ok(measured, 'placed cap must become the To face');
  await readDistance('accepted-distance', '20.62', '5');
  assert.match(await panel().innerText(), /Witness plate/);
  assert.deepEqual((await metric('ΔX ΔY ΔZ').innerText()).split(', ').map(Number), [20,0,5]);
  await f.same(source);

  f.phase = 'An exploded occurrence cannot reuse its accepted placement measurement';
  const explode = button('Explode');
  await explode.click();
  await panel().getByRole('status').getByText(/Witness plate.*unavailable/).waitFor();
  await f.page.waitForFunction(() => !window.__studioOverlayTexts?.()['measure:label']);
  assert.equal(await metric('Distance').count(), 0);
  await f.snapshot('exploded-unavailable');
  for (let i = 0; i < 3; i++) await explode.click();
  await readDistance('accepted-placement-restored', '20.62', '5');
  await f.same(source);

  f.phase = 'Pick the placed bottom first and measure back to the base';
  await button('Done measuring').click();
  await clickModelCommand(f.page, 'Inspect', 'Measure');
  await cap('Bottom', [70,6,15]);
  await panel().getByText('Planar face', { exact: true }).waitFor();
  await cap('Top', [20,6,10]);
  await readDistance('placed-to-base', '20.62', '5');
  assert.deepEqual((await metric('ΔX ΔY ΔZ').innerText()).split(', ').map(Number), [-20,0,-5]);
  await f.same(source);

  assert.deepEqual(f.report.downloads, []);
});

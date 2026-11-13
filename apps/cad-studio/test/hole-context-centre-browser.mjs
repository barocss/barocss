import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/hole-context-centre-browser.mjs',
  'apps/cad-studio/src/viewport/useViewportPicking.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/viewport/Viewport.tsx',
  'apps/cad-studio/src/ui/ViewContextMenu.tsx',
  'packages/barocss-cad-model/src/app/commands.ts',
];
const f = await createFlow({
  name: 'hole-context-centre', output: process.argv[2], envFrozen: 'D1050_SOURCE_FROZEN',
  qualification: 'Hole started from a context menu uses the planar face and point at that menu.',
  limits: ['Desktop Top Ortho, planar Z faces on two disjoint rectangular extrusions.'],
  initialFiles: pins, requiredFrozen: pins,
});
const solid = node => ({ node, side: 'solid' });
const doc = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [60, 0], max: [100, 30] },
    { id: 'n3', kind: 'extrude', sketch: 2, height: 10 },
  ],
  outputs: { b1: solid(1), b3: solid(3) }, nextId: 4,
};
const button = name => f.page.getByRole('button', { name, exact: true });
const hole = () => f.page.getByRole('dialog', { name: 'Hole', exact: true });
const settle = () => f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
async function click(world, button) {
  const point = await f.page.evaluate(world => window.__studioScreenOf(world), world);
  assert.ok(await f.page.evaluate(point => !!document.elementFromPoint(...point)?.closest('canvas.vp-canvas'), point));
  await f.page.mouse.click(...point, { button });
  await settle();
}
async function centre() {
  return Promise.all(['X', 'Y'].map(async axis => Number(await hole().getByRole('spinbutton', { name: 'Centre ' + axis, exact: true }).inputValue())));
}
async function openContextHole(world) {
  await click(world, 'right');
  const menu = f.page.getByRole('menu', { name: 'FACE', exact: true });
  await menu.getByRole('menuitem', { name: /^Hole(?:$| )/ }).click();
  await hole().waitFor();
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, viewport: { width: 1440, height: 900 }, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'hole-context-centre.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
  await button('Top').click();
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await settle();
  const left = [9, 7, 10], same = [29, 21, 10], other = [77, 12, 10];
  f.phase = 'left-click Hole control';
  await click(left);
  await f.page.keyboard.press('h');
  await hole().waitFor();
  assert.deepEqual(await centre(), left.slice(0, 2));
  await hole().getByRole('button', { name: 'Cancel', exact: true }).click();
  await f.same(doc);

  f.phase = 'right-click Hole on the previously clicked body';
  await click(left);
  await openContextHole(same);
  const sameCentre = await centre();
  await f.snapshot('same-body');
  await hole().getByRole('button', { name: 'Cancel', exact: true }).click();
  await f.same(doc);

  f.phase = 'right-click Hole on the other body';
  await click(left);
  await openContextHole(other);
  const otherCentre = await centre();
  const cross = await f.snapshot('other-body');
  f.report.observations.push({ left: left.slice(0, 2), sameCentre, otherCentre });
  await f.persist();
  assert.deepEqual(sameCentre, same.slice(0, 2));
  assert.deepEqual(otherCentre, other.slice(0, 2));
  assert.deepEqual(cross.selection.selection.faces.map(item => item.body), [1]);
  await hole().getByRole('button', { name: 'Apply', exact: true }).click();
  await f.page.waitForFunction(() => window.__studioDoc?.nodes.at(-1)?.kind === 'hole');
  await f.ready();
  const applied = await f.snapshot('applied');
  assert.deepEqual(applied.doc.nodes.at(-1), { id: 'n4', kind: 'hole', parent: solid(3), face: 'n3.top', center: other.slice(0, 2), radius: 4 });
  const bodies = applied.bodies.bodies;
  assert.equal(bodies.length, 2);
  assert.ok(Math.abs(bodies[0].volume - 12000) < 1e-7);
  assert.ok(Math.abs(bodies[1].volume - (12000 - Math.PI * 4 ** 2 * 10)) < 1e-7);
  await f.undo();
  await f.same(doc);
  await f.redo();
  await f.same(applied.doc);
  assert.deepEqual(f.report.downloads, []);
});

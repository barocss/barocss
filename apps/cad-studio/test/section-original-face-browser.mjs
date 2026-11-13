import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/section-original-face-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/viewport/useViewportPicking.ts',
  'apps/cad-studio/src/ui/ViewContextMenu.tsx',
];
const f = await createFlow({
  name: 'section-original-face',
  output: process.argv[2],
  envFrozen: 'D1010_SOURCE_FROZEN',
  qualification: 'Use the original face on a settled Section and prevent feature actions on its generated cap.',
  limits: ['A settled desktop WebGPU exact section of two standalone rectangular bodies.'],
  initialFiles: pins,
  requiredFrozen: pins,
});
const doc = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 20] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 12 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [10, 30], max: [50, 50] },
    { id: 'n3', kind: 'extrude', sketch: 2, height: 12 },
  ],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } }, nextId: 4,
};
const button = name => f.page.getByRole('button', { name, exact: true });
const menu = () => f.page.locator('.ctx-menu');
const item = name => menu().getByRole('menuitem', { name, exact: true });
async function click(point, button = 'left') {
  const pixel = await f.page.evaluate(point => window.__studioScreenOf(point), point);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel));
  await f.page.mouse.click(...pixel, { button });
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
  await chooser.setFiles({ name: 'section-source.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
  await button('Section view').click();
  await button('Section across X').click();
  await f.page.waitForFunction(() => window.__studioSection()?.exact && window.__studioSection().sources.join() === 'b3');
  await button('View cube directions').click();
  await f.page.getByRole('menuitem', { name: 'Top left', exact: true }).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  const filter = button('Selection filter');
  for (let attempt = 0; attempt < 6 && !(await filter.innerText()).includes('Faces'); attempt++) await filter.click();
  assert.ok((await filter.innerText()).includes('Faces'));
  const top = [38, 40, 12], cap = [25, 43, 6];
  f.phase = 'right-click the generated Section cap';
  await click(cap);
  const capLeft = await f.snapshot('cap-left');
  assert.deepEqual(capLeft.selection.selection.faces, []);
  await click(cap, 'right');
  await menu().waitFor();
  await f.snapshot('cap-context');
  assert.equal(await menu().getAttribute('aria-label'), 'SECTION CAP');
  assert.equal(await menu().getByRole('menuitem', { name: /^Hole/ }).count(), 0);
  for (const name of ['Hide body', 'Measure from here']) assert.equal(await item(name).count(), 0);
  await f.page.keyboard.press('Escape');

  f.phase = 'left and right clicks on the retained top face';
  await click(top);
  const left = await f.snapshot('original-left-pick');
  assert.equal(left.selection.selection.faces[0]?.body, 1);
  await click(top, 'right');
  await menu().waitFor();
  const right = await f.snapshot('original-right-pick');
  assert.deepEqual(right.selection.selection.faces, left.selection.selection.faces);
  assert.equal(await item('Hide body').count(), 1);
  assert.equal(await menu().getByRole('menuitem', { name: /^Hole/ }).count(), 1);
  await item('Hide body').click();
  await f.page.waitForFunction(() => Object.values(window.__studioDoc.bodies ?? {}).some(look => look.hidden));
  const hidden = await f.snapshot('original-hidden');
  assert.equal(hidden.doc.bodies?.b3?.hidden, true);
  assert.equal(hidden.doc.bodies?.b1?.hidden, undefined);
  await f.undo();
  await f.same(doc);
  await f.page.waitForFunction(() => window.__studioSection()?.exact);
  await click(top, 'right');
  const hole = menu().getByRole('menuitem', { name: /^Hole/ });
  await hole.click();
  const hud = f.page.getByRole('dialog', { name: 'Hole', exact: true });
  await hud.getByRole('spinbutton', { name: 'Centre X', exact: true }).fill('38');
  await hud.getByRole('spinbutton', { name: 'Centre Y', exact: true }).fill('40');
  await hud.getByRole('spinbutton', { name: 'Diameter', exact: true }).fill('4');
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent.trim() === 'preview');
  await hud.getByRole('button', { name: 'Apply', exact: true }).click();
  await f.changed(doc);
  const drilled = await f.snapshot('original-hole-applied');
  const feature = drilled.doc.nodes.at(-1);
  assert.equal(feature.kind, 'hole');
  assert.deepEqual(feature.parent, { node: 3, side: 'solid' });
  assert.equal(feature.face, 'n3.top');
  assert.deepEqual(feature.center, [38, 40]);
  const untouched = drilled.bodies.bodies.find(body => body.key === 'b1');
  const finished = drilled.bodies.bodies.find(body => body.key === 'b4');
  assert.ok(Math.abs(untouched.volume - 4800) < 1e-7);
  assert.ok(Math.abs(finished.volume - (9600 - 48 * Math.PI)) < 1e-7);
  assert.deepEqual(f.report.downloads, []);
});

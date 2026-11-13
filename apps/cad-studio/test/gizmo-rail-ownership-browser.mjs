import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const pins = [
  'apps/cad-studio/test/gizmo-rail-ownership-browser.mjs',
  'apps/cad-studio/src/viewport/Viewport.tsx', 'apps/cad-studio/src/viewport/GizmoMarks.tsx',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts', 'apps/cad-studio/src/viewport/useCommandGizmos.ts',
  'apps/cad-studio/src/styles.css',
];
const f = await createFlow({
  name: 'gizmo-rail-ownership', output: process.argv[2], envFrozen: 'D1044_SOURCE_FROZEN',
  qualification: 'The desktop tool rail consumes its input and a visible Move gizmo edits the original body.',
  limits: ['900 × 760 desktop WebGPU. One native rectangular solid and its X move arrow.'],
  initialFiles: pins, requiredFrozen: pins,
});
const source = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0,0], max: [40,20], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 10, id: 'n1' }],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const settle = () => f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
const hud = () => f.page.getByRole('dialog', { name: 'Move', exact: true });
const deltaX = () => hud().getByLabel('ΔX', { exact: true });
async function arrow() {
  return f.page.locator('.gizmo-arrow[data-gizmo="moveX"] polygon').evaluate(node => {
    const svg = node.closest('svg').getBoundingClientRect(), head = node.points.getItem(0);
    const p = [svg.left + head.x - 4, svg.top + head.y];
    const rail = document.querySelector('nav.toolbar').getBoundingClientRect();
    const hit = document.elementFromPoint(...p);
    return { p, rail: rail.toJSON(), overRail: !!hit?.closest('nav.toolbar'), canvas: !!hit?.closest('canvas.vp-canvas') };
  });
}
async function movePointer(start, finish, mouseButton) {
  await f.page.mouse.move(...start);
  await f.page.mouse.down({ button: mouseButton });
  await f.page.mouse.move(...finish, { steps: 8 });
  await f.page.mouse.up({ button: mouseButton });
  await settle();
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, viewport: { width: 900, height: 760 }, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'gizmo-rail-ownership.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  await button('Front').click();
  await button('Ortho').click();
  await f.page.locator('.outliner .ol-row > button.ol').first().click();
  await clickModelCommand(f.page, 'Modify', 'Move');
  await hud().waitFor();
  const initial = await arrow();
  assert.ok(initial.canvas, JSON.stringify(initial));
  const baseline = await f.snapshot('move-draft-before');
  const start = [Math.min(initial.p[0], 530), initial.p[1]];
  const target = [initial.rail.right - 2, Math.min(initial.rail.bottom - 8, initial.rail.top + 40)];
  f.phase = 'Pan the actual Move X arrow beneath the rail and drag across it';
  await movePointer(start, [start[0] + target[0] - initial.p[0], start[1] + target[1] - initial.p[1]], 'middle');
  const covered = await arrow();
  assert.ok(covered.overRail, JSON.stringify(covered));
  await movePointer(covered.p, [covered.p[0] + 42, covered.p[1]], 'left');
  assert.equal(Number(await deltaX().inputValue()), 0);
  const afterCovered = await f.snapshot('covered-arrow-no-move');
  for (const key of ['doc', 'bodies', 'history']) assert.deepEqual(afterCovered[key], baseline[key]);
  await f.same(source);

  f.phase = 'Expose the same Move X arrow and apply a real drag';
  const panStart = [Math.max(covered.rail.right + 30, 210), Math.max(covered.rail.bottom + 70, 450)];
  await movePointer(panStart, [panStart[0] + initial.p[0] - covered.p[0], panStart[1] + initial.p[1] - covered.p[1]], 'middle');
  const visible = await arrow();
  assert.ok(visible.canvas, JSON.stringify(visible));
  await movePointer(visible.p, [visible.p[0] + 42, visible.p[1]], 'left');
  const delta = Number(await deltaX().inputValue());
  assert.ok(delta > 0);
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
  await button('Apply', hud()).click();
  await f.changed(source);
  const moved = await f.doc();
  assert.equal(moved.nodes.length, source.nodes.length + 1);
  assert.deepEqual(moved.nodes.at(-1).offset, [delta,0,0]);
  await f.snapshot('visible-arrow-applied');
  await f.undo(); await f.same(source);
  await f.redo(); await f.same(moved);
  f.report.observations.push({ initial, covered, visible, appliedDeltaMM: delta });
  assert.deepEqual(f.report.downloads, []);
});

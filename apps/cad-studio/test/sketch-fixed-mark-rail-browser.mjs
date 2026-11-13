import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/sketch-fixed-mark-rail-browser.mjs',
  'apps/cad-studio/src/viewport/Viewport.tsx', 'apps/cad-studio/src/viewport/sketchOverlay.tsx',
  'apps/cad-studio/src/ui/SketchMarks.tsx', 'apps/cad-studio/src/ui/sketchConstraintMarkLayout.ts',
];
const f = await createFlow({
  name: 'sketch-fixed-mark-rail', output: process.argv[2], envFrozen: 'D1042_SOURCE_FROZEN',
  qualification: 'Keep a Fixed mark visible beside its reachable Sketch corner at the desktop tool rail.',
  limits: ['One Fixed point on an edited polygon. Desktop viewport at 900 × 760.'],
  initialFiles: pins, requiredFrozen: pins,
  inspectorSource: `
import assert from 'node:assert/strict';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { profileOf } from '@barocss/cad-model/sketch/loops';
import { solveShape } from '@barocss/cad-model/sketch/rules';
const shape = { kind: 'polygon', closed: true, points: [[0,0],[80,0],[90,35],[0,35]],
  rules: [{ kind: 'fix', point: 0, at: [0,0] }] };
assert.ok(solveShape(shape).ok);
const built = profileOf([shape]);
assert.ok('node' in built);
console.log(JSON.stringify(withNode(emptyDoc(), built.node)));
`,
});
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const pointMark = () => f.page.locator('.vp-overlay .on[data-sketch-entity="point:0"]');
const fixedChip = () => f.page.locator('.vp-overlay .cons-glyph').filter({ has: f.page.locator('title').getByText('Point 1 fixed', { exact: true }) }).locator('.cons-chip');
async function inspect() {
  const chip = await fixedChip().boundingBox();
  assert.ok(chip);
  return f.page.evaluate(chip => {
    const p = window.__studioScreenOf([0,0,0]), rail = document.querySelector('nav.toolbar').getBoundingClientRect();
    const inside = ([x,y]) => !!document.elementFromPoint(x,y)?.closest('nav.toolbar');
    return { p, chip, rail: rail.toJSON(), pointCovered: inside(p), chipCovered: inside([chip.x + chip.width / 2,chip.y + chip.height / 2]),
      leader: [...document.querySelectorAll('.vp-overlay .cons-leader')].map(line => {
        const svg = line.closest('svg').getBoundingClientRect();
        return [Number(line.getAttribute('x1')) + svg.left, Number(line.getAttribute('y1')) + svg.top];
      }) };
  }, chip);
}
async function panTo(x) {
  const from = await f.page.evaluate(() => window.__studioScreenOf([0,0,0]));
  const p = [Math.max(from[0] + 40, 170), from[1]];
  await f.page.mouse.move(...p);
  await f.page.mouse.down({ button: 'middle' });
  await f.page.mouse.move(p[0] + x - from[0], p[1], { steps: 8 });
  await f.page.mouse.up({ button: 'middle' });
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
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
  const source = await f.inspect('fixed-source', {});
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'sketch-fixed-mark-rail.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  await button('Sketch · polygon', f.page.getByRole('group', { name: 'History', exact: true })).click();
  await button('Edit sketch', f.editor()).click();
  await f.sketchPanel().waitFor();
  await button('Remove Fixed point 1', f.sketchPanel()).waitFor();
  await fixedChip().waitFor();
  const initial = await inspect();

  f.phase = 'Keep the Fixed glyph and its point visible at the rail boundary';
  await panTo(initial.rail.right + 12);
  const edge = await inspect();
  f.report.observations.push(edge);
  await f.snapshot('fixed-mark-at-rail');
  assert.equal(edge.pointCovered, false);
  assert.ok(edge.chip.x >= edge.rail.right + 2, 'the Fixed glyph must clear the rail');
  assert.equal(edge.chipCovered, false);
  assert.ok(edge.leader.some(p => Math.hypot(p[0] - edge.p[0], p[1] - edge.p[1]) < 1));
  await f.page.mouse.click(...edge.p);
  await pointMark().waitFor();
  await f.snapshot('fixed-point-selected');
  await f.page.mouse.click(edge.p[0] + 80, edge.p[1] + 90);
  assert.equal(await pointMark().count(), 0);

  f.phase = 'A covered Fixed point stays unselected';
  await panTo(initial.rail.right - 2);
  const covered = await inspect();
  assert.equal(covered.pointCovered, true);
  await f.page.mouse.click(...covered.p);
  assert.equal(await pointMark().count(), 0);
  f.report.observations.push(covered);
  await f.snapshot('fixed-point-covered');
  await f.same(source);
  assert.deepEqual(f.report.downloads, []);
});

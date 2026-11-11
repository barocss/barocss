import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(mode === '--baseline' || mode === '--fixed');
const fixed = mode === '--fixed';
const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/styles.css',
  'apps/cad-studio/src/drawing/drawing.css', 'apps/cad-studio/src/ui/DrawingWorkspace.tsx',
  'apps/cad-studio/src/layout/ChatColumn.tsx', 'apps/cad-studio/test/flow-helper.mjs'];
const f = await createFlow({ name: 'drawing-toolbar-inset', envFrozen: 'D665_SOURCE_FROZEN', output,
  initialFiles: pins, requiredFrozen: pins, qualification: 'Drawing toolbar with collapsed chat at two desktop sizes' });
const toolbar = () => f.page.getByRole('navigation', { name: 'Drawing tools', exact: true });
const tool = name => toolbar().getByRole('button', { name, exact: true });
const sheet = () => f.page.getByLabel('Drawing sheet', { exact: true });
const sizes = [[1440, 900], [1280, 720]];

const readLayout = () => f.page.evaluate(() => {
  const rail = document.querySelector('.chat-col:not(.open)').getBoundingClientRect();
  const canvas = document.querySelector('.dw-canvas').getBoundingClientRect();
  const drawing = document.querySelector('.dw').getBoundingClientRect();
  const overlap = b => Math.max(0, Math.min(b.right, rail.right) - Math.max(b.left, rail.left));
  const buttons = [...document.querySelectorAll('.dw-tools button')].map(button => {
    const box = button.getBoundingClientRect(), icon = button.querySelector('.ui-icon')?.getBoundingClientRect();
    const inset = 2;
    const samples = [[box.left + inset, box.top + inset], [box.right - inset, box.bottom - inset],
      [box.left + box.width / 2, box.top + box.height / 2]];
    return { label: button.getAttribute('aria-label'), width: box.width, visibleWidth: box.width - overlap(box),
      iconWidth: icon?.width ?? 0, iconCovered: icon ? overlap(icon) : null, left: box.left, right: box.right, bottom: box.bottom,
      hits: samples.map(([x, y]) => button.contains(document.elementFromPoint(x, y))) };
  });
  return { railRight: rail.right, canvasLeft: canvas.left, drawingLeft: drawing.left, buttons };
});
async function clickView(view, u, v) {
  const pixel = await f.page.evaluate(([view, u, v]) => window.__studioDrawingAt(view, u, v), [view, u, v]);
  assert.ok(pixel && Number.isFinite(pixel.x) && Number.isFinite(pixel.y));
  await f.page.mouse.move(pixel.x, pixel.y);
  await f.page.mouse.click(pixel.x, pixel.y);
}
async function dimension(input) {
  const linear = tool('Linear dimension');
  if (input === 'pointer') await linear.click();
  else {
    await tool('Select').focus();
    await f.page.keyboard.press('Tab');
    assert.equal(await linear.evaluate(element => document.activeElement === element), true);
    await f.page.keyboard.press('Enter');
  }
  assert.match(await linear.getAttribute('class'), /(?:^|\s)on(?:\s|$)/);
  await clickView('front', 0, 0);
  await clickView('front', 64, 0);
  await clickView('front', 32, -12);
  await f.page.waitForFunction(() => window.__studioDrawing()?.dimensions.length === 1);
  const read = await f.page.evaluate(() => window.__studioDrawing().dimensions[0]);
  assert.equal(read.value, 64);
  const doc = await f.doc();
  assert.equal(doc.drawing.dimensions[0].kind, 'linear');
  assert.equal(doc.drawing.dimensions[0].view, 'front');
  return doc;
}
async function fit(input) {
  const initial = await sheet().getAttribute('viewBox'), box = await sheet().boundingBox();
  assert.ok(initial && box);
  await f.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await f.page.mouse.wheel(0, -600);
  await f.page.waitForFunction(initial => document.querySelector('svg[aria-label="Drawing sheet"]').getAttribute('viewBox') !== initial, initial);
  const fitSheet = tool('Fit sheet');
  if (input === 'pointer') await fitSheet.click();
  else { await fitSheet.focus(); await f.page.keyboard.press('Enter'); }
  await f.page.waitForFunction(initial => document.querySelector('svg[aria-label="Drawing sheet"]').getAttribute('viewBox') === initial, initial);
  return sheet().evaluate(svg => {
    const rect = svg.querySelector('.dw-sheet').getBoundingClientRect(), area = svg.getBoundingClientRect();
    const epsilon = 0.1;
    return rect.width > 0 && rect.height > 0 && rect.left >= area.left - epsilon && rect.top >= area.top - epsilon
      && rect.right <= area.right + epsilon && rect.bottom <= area.bottom + epsilon;
  });
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
  for (const [width, height] of sizes) {
    const size = width + 'x' + height;
    f.phase = 'Drawing toolbar at ' + size;
    await f.newPage();
    await f.page.setViewportSize({ width, height });
    await f.page.getByRole('group', { name: 'Mode', exact: true }).getByRole('button', { name: 'Drawing', exact: true }).click();
    await f.page.waitForFunction(() => window.__studioDrawing?.()?.hidden);
    await toolbar().waitFor();
    const layout = await readLayout();
    assert.equal(layout.buttons.length, 9);
    assert.equal(layout.railRight, 44);
    await f.snapshot(size + '-toolbar');
    if (!fixed) {
      for (const button of layout.buttons) {
        assert.equal(button.width, 34);
        assert.ok(button.visibleWidth > 0 && button.visibleWidth < button.width, button.label);
        assert.ok(button.iconCovered > 0, button.label);
      }
      f.report.observations.push({ size, covered: layout.buttons.length, visibleWidth: layout.buttons[0].visibleWidth });
      continue;
    }
    assert.equal(layout.drawingLeft, layout.railRight);
    for (const button of layout.buttons) {
      assert.equal(button.visibleWidth, button.width, button.label);
      assert.ok(button.iconWidth > 0, button.label);
      assert.equal(button.iconCovered, 0, button.label);
      assert.ok(button.left >= layout.railRight && button.right <= layout.canvasLeft && button.bottom <= height, button.label);
      assert.ok(button.hits.every(Boolean), button.label);
    }

    f.phase = 'place and fit a linear dimension at ' + size;
    const input = width === 1440 ? 'pointer' : 'keyboard', before = await f.doc();
    const placed = await dimension(input);
    const { drawing: _drawing, ...model } = placed, { drawing: _before, ...original } = before;
    assert.deepEqual(model, original);
    assert.equal(await fit(input), true);
    await f.same(placed);
    await f.snapshot(size + '-dimension-fit');
    f.report.observations.push({ size, fullyVisibleButtons: 9, visibleWidth: layout.buttons[0].visibleWidth,
      iconObstructions: 0, input, dimensionMm: 64, sheetFit: true });
  }
});

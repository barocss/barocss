import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(mode === '--baseline' || mode === '--fixed');
const pins = ['apps/cad-studio/src/viewport/ViewCube.tsx', 'apps/cad-studio/src/viewport/Viewport.tsx',
  'apps/cad-studio/src/components/ui/dropdown-menu.tsx', 'apps/cad-studio/src/styles.css'];
const f = await createFlow({ name: 'view-cube-keyboard', envFrozen: 'D671_SOURCE_FROZEN', output,
  initialFiles: pins, requiredFrozen: pins, qualification: 'Keyboard and pointer directions on the Studio ViewCube' });
const cube = () => f.page.locator('.view-cube');
const trigger = () => cube().getByRole('button', { name: 'View cube directions', exact: true });
const menu = () => f.page.getByRole('menu', { name: 'View cube directions', exact: true });
const selected = () => f.page.evaluate(() => window.__studioSelection.selection);
const eye = () => f.page.evaluate(() => window.__studioEye());
const history = () => f.page.locator('.history .hs').evaluateAll(items => items.map(item => item.getAttribute('aria-label')));
const focused = locator => locator.evaluate(element => document.activeElement === element);
const settled = () => f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));

function viewDirection() {
  const point = [16, 16, 8], epsilon = 0.01;
  const slopes = [0, 1, 2].map(axis => {
    const from = [...point], to = [...point];
    from[axis] -= epsilon;
    to[axis] += epsilon;
    return window.__studioProject(from)[2] - window.__studioProject(to)[2];
  });
  const norm = Math.hypot(...slopes);
  return slopes.map(slope => slope / norm);
}
async function waitDirection(from) {
  const target = from.map(value => value / Math.hypot(...from));
  const limit = 0.0003;
  for (let frame = 0; frame < 180; frame++) {
    const actual = await f.page.evaluate(viewDirection);
    if (actual.every((value, axis) => Math.abs(value - target[axis]) < limit)) {
      await settled();
      const stable = await f.page.evaluate(viewDirection);
      if (stable.every((value, axis) => Math.abs(value - target[axis]) < limit)) return stable;
    }
    await settled();
  }
  assert.fail('Camera did not reach ' + target + ', observed ' + await f.page.evaluate(viewDirection));
}
async function waitFocus(label) {
  await f.page.waitForFunction(name => document.activeElement?.textContent?.trim() === name, label, { timeout: 4000 });
}
async function assertMenuVisible() {
  const layout = await menu().evaluate(element => {
    const pane = element.getBoundingClientRect();
    const stage = element.closest('.stage').getBoundingClientRect();
    const viewBar = document.querySelector('.corner-right')?.getBoundingClientRect();
    const items = [...element.querySelectorAll('[role="menuitem"]')];
    return {
      fitsStage: pane.left >= stage.left && pane.right <= stage.right && pane.top >= stage.top && pane.bottom <= stage.bottom,
      aboveViewBar: !viewBar || pane.bottom <= viewBar.top,
      visibleItems: items.filter(item => {
        const rect = item.getBoundingClientRect();
        return item.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
      }).length,
    };
  });
  assert.deepEqual(layout, { fitsStage: true, aboveViewBar: true, visibleItems: 26 });
  return layout;
}

async function keyboardDirection(label, from) {
  await f.page.keyboard.press('ArrowDown');
  await menu().waitFor();
  await waitFocus('Top');
  const choices = await menu().getByRole('menuitem').allTextContents();
  const index = choices.findIndex(text => text.trim() === label);
  assert.ok(index >= 0, label);
  for (const next of choices.slice(1, index + 1)) {
    await f.page.keyboard.press('ArrowDown');
    await waitFocus(next.trim());
  }
  await f.page.keyboard.press('Enter');
  await menu().waitFor({ state: 'hidden' });
  const observed = await waitDirection(from);
  assert.equal(await focused(trigger()), true);
  f.report.observations.push({ action: 'keyboard', label, expected: from, observed });
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
  for (const [width, height] of [[1280, 720], [1024, 768]]) {
    const size = width + 'x' + height;
    await f.newPage();
    await f.page.setViewportSize({ width, height });
    f.phase = 'create and select a Box at ' + size;
    await f.page.getByRole('button', { name: 'New part', exact: true }).click();
    await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
    await f.ready();
    await f.page.keyboard.press('b');
    const hud = f.page.getByRole('dialog', { name: 'Box', exact: true });
    const beforeBox = await f.doc();
    await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
    await hud.getByRole('button', { name: 'Apply', exact: true }).click();
    await f.changed(beforeBox);
    await f.page.getByRole('complementary', { name: 'Browser', exact: true }).getByRole('button', { name: 'Box', exact: true }).click();
    const doc = await f.doc(), pick = await selected(), steps = await history();
    assert.deepEqual(pick.bodies, [0]);

    f.phase = 'reach the ViewCube from the top bar at ' + size;
    await f.page.locator('.topbar button:visible:enabled').last().focus();
    await f.page.keyboard.press('Tab');
    const tabReachedCube = await cube().evaluate(element => element.contains(document.activeElement));
    if (mode === '--baseline') {
      assert.equal(tabReachedCube, false);
      assert.equal(await trigger().count(), 0);
      await f.snapshot(size + '-baseline-tab-skips-cube');
      f.report.observations.push({ size, tabReachedCube: false, directionTriggerCount: 0 });
    } else {
      assert.equal(tabReachedCube, true);
      assert.equal(await focused(trigger()), true);
      assert.equal(await trigger().evaluate(element => element.matches(':focus-visible')), true);
      const beforeMenu = await eye();
      await f.page.keyboard.press('Space');
      await menu().waitFor();
      await waitFocus('Top');
      const groups = [['Faces', 6], ['Edges', 12], ['Corners', 8]];
      for (const [name, count] of groups) {
        assert.equal(await menu().getByRole('group', { name, exact: true }).getByRole('menuitem').count(), count);
      }
      const menuLayout = await assertMenuVisible();
      await f.page.keyboard.press('End');
      const last = menu().getByRole('menuitem').last();
      await waitFocus((await last.textContent()).trim());
      assert.equal(await last.evaluate(el => document.activeElement === el), true);
      await f.page.keyboard.press('Home');
      await waitFocus('Top');
      await f.snapshot(size + '-directions-menu');
      await f.page.keyboard.press('Escape');
      await menu().waitFor({ state: 'hidden' });
      assert.equal(await focused(trigger()), true);
      assert.deepEqual(await eye(), beforeMenu);
      assert.deepEqual(await selected(), pick);
      assert.equal(await f.page.getByRole('dialog', { name: 'Command palette', exact: true }).count(), 0);
      f.phase = 'select ViewCube directions from the keyboard at ' + size;
      const keyboardCases = width === 1280 ? [
        ['Top', [0, 0, 1]], ['Bottom', [0, 0, -1]], ['Front', [0, -1, 0]], ['Back', [0, 1, 0]],
        ['Right', [1, 0, 0]], ['Left', [-1, 0, 0]], ['Top front', [0, -1, 1]], ['Top front right', [1, -1, 1]],
      ] : [['Bottom', [0, 0, -1]], ['Left', [-1, 0, 0]]];
      for (const [label, from] of keyboardCases) await keyboardDirection(label, from);
      await f.snapshot(size + '-keyboard-direction');
      f.report.observations.push({ size, tabReachedCube, menuChoices: 26, escapeReturnedFocus: true, menuLayout });
      if (width === 1024) {
        f.phase = 'open and use the ViewCube menu with chat open at ' + size;
        const chat = f.page.locator('.topbar').getByRole('button', { name: 'Chat', exact: true });
        await chat.click();
        await f.page.locator('.chat-col.open').waitFor();
        await trigger().click();
        await menu().waitFor();
        const chatLayout = await assertMenuVisible();
        await f.snapshot(size + '-directions-with-chat');
        await menu().getByRole('menuitem', { name: 'Back', exact: true }).click();
        await menu().waitFor({ state: 'hidden' });
        await waitDirection([0, 1, 0]);
        await chat.click();
        await f.page.locator('.chat-col:not(.open)').waitFor();
        f.report.observations.push({ size, action: 'pointer menu', chatOpen: true, menuLayout: chatLayout });
      }
    }

    f.phase = 'select a face, corner and edge with the pointer at ' + size;
    await f.page.getByRole('group', { name: 'Views', exact: true }).getByRole('button', { name: 'Iso', exact: true }).click();
    for (const [id, from] of [['0-0', [0, -1, 0]], ['+-+', [1, -1, 1]], ['0-+', [0, -1, 1]]]) {
      await cube().locator('polygon[data-view="' + id + '"]').last().click();
      f.report.observations.push({ size, action: 'pointer', id, observed: await waitDirection(from) });
    }

    f.phase = 'drag to orbit without a click at ' + size;
    const beforeDrag = await eye(), dragFace = cube().locator('polygon.face[data-view="0-0"]');
    const rect = await dragFace.boundingBox();
    assert.ok(rect);
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    await f.page.mouse.move(x, y);
    await f.page.mouse.down();
    await f.page.mouse.move(x + 28, y + 16, { steps: 7 });
    await f.page.mouse.up();
    await settled();
    const afterDrag = await eye();
    assert.ok(Math.hypot(...afterDrag.map((value, axis) => value - beforeDrag[axis])) > 1);
    await f.page.waitForTimeout(300);
    assert.deepEqual(await eye(), afterDrag);
    await f.same(doc);
    assert.deepEqual(await selected(), pick);
    assert.deepEqual(await history(), steps);
    f.report.observations.push({ size, action: 'drag', beforeDrag, afterDrag, documentAndHistoryExact: true });
  }
  assert.deepEqual(f.report.downloads, []);
});

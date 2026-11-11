import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output] = process.argv.slice(2);
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'),
  'Give an absolute output directory outside the repository.');
const pins = [
  'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/app/modelRail.ts',
  'apps/cad-studio/src/ui/ModelTools.tsx', 'apps/cad-studio/src/ui/ToolButton.tsx',
  'apps/cad-studio/src/ui/useWorkspaceModeExit.tsx',
  'apps/cad-studio/src/ui/SelectionInspector.tsx', 'apps/cad-studio/src/ui/Palette.tsx',
  'apps/cad-studio/src/app/studioConstants.ts', 'apps/cad-studio/src/app/filletFamily.ts',
  'apps/cad-studio/src/sketch/useSketchActions.ts', 'apps/cad-studio/src/viewport/useViewportPicking.ts',
  'apps/cad-studio/src/styles.css', 'packages/barocss-cad-model/src/app/commands.ts',
  'packages/barocss-cad-model/src/app/profileCommands.ts',
];
const f = await createFlow({
  name: 'model-command-rail', envFrozen: 'D687_SOURCE_FROZEN', output,
  qualification: 'D687 desktop Model command rail in Chrome WebGPU',
  initialFiles: pins, requiredFrozen: pins,
  limits: [
    '1024×800 with Chat closed and 1280×800 with Chat open, using a new rectangle and one Extrude.',
    'The selection check uses explicit Top and Frame all. Automatic camera framing has a separate reproduction.',
    'Selection evidence covers one axis-aligned part. Screenshots accompany the pixel and DOM checks.',
  ],
});

const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const rail = () => f.page.getByRole('navigation', { name: 'Tools', exact: true });
const model = () => rail().getByRole('group', { name: 'Model commands', exact: true });
const named = name => button(model(), name);
const trigger = name => button(rail(), name);
const group = name => rail().getByRole('group', { name, exact: true });
const inspector = () => f.page.getByRole('complementary', { name: 'Selection', exact: true });
const hud = name => f.page.getByRole('dialog', { name, exact: true });
const preview = () => f.page.waitForFunction(
  () => document.querySelector('.hud .status')?.textContent?.trim() === 'preview', null, { timeout: 30000 });
const settle = () => f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
const sketchModeFocused = () => f.page.waitForFunction(() =>
  document.activeElement?.matches('[data-workspace-mode] button.sketching'), null, { timeout: 5000 });

const width = 40;
const depth = 24;
const height = 12;
const center = [width / 2, depth / 2, height];
const corner = [0, 0, height];
const edge = [width / 2, 0, height];
const cap = [[0, 0, height], [width, 0, height], [0, depth, height], [width, depth, height]];
const groups = [
  ['Shapes', ['Box', 'Cylinder']], ['Create', ['Revolve']], ['Modify', ['Chamfer', 'Fillet']],
  ['Pattern', ['Mirror']], ['Combine', ['Union']], ['Inspect', ['Measure', 'BOM', 'Rebuild', 'Variants']],
];

async function exposed(locator, label, visibleName) {
  await locator.waitFor();
  const evidence = await locator.evaluate((el, name) => {
    const bounds = el.getBoundingClientRect();
    const contains = (rect, x, y) => rect.left <= x && x <= rect.right && rect.top <= y && y <= rect.bottom;
    const centerHit = rect => el.contains(document.elementFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2));
    const inside = rect => contains(bounds, rect.left, rect.top) && contains(bounds, rect.right, rect.bottom)
      && rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
    let text = null;
    if (name) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.textContent.trim() !== name || node.parentElement.closest('svg')) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        const style = getComputedStyle(node.parentElement);
        const hits = [rect.left + 1, rect.right - 1].every(x =>
          el.contains(document.elementFromPoint(x, (rect.top + rect.bottom) / 2)));
        text = { width: rect.width, height: rect.height, inside: inside(rect), hits, visible: style.visibility === 'visible' };
        break;
      }
    }
    return { bounds: bounds.toJSON(), inside: inside(bounds), centerHit: centerHit(bounds), text,
      icon: !!el.querySelector('svg, .material-symbols, .icon') };
  }, visibleName ?? null);
  assert.ok(evidence.inside && evidence.centerHit, `${label} must be on screen and reachable: ${JSON.stringify(evidence)}`);
  if (visibleName) {
    const { text } = evidence;
    assert.ok(text?.width > 4 && text.height > 4 && text.inside && text.hits && text.visible && evidence.icon,
      `${label} must show its name and icon: ${JSON.stringify(evidence)}`);
  }
  return evidence;
}

async function point(world, inset = 0) {
  const hit = await f.page.evaluate(({ world, inset, center }) => {
    const projected = window.__studioScreenOf(world);
    if (!projected) return null;
    let [x, y] = projected;
    if (inset) {
      const [cx, cy] = window.__studioScreenOf(center);
      const distance = Math.hypot(cx - x, cy - y);
      x += (cx - x) / distance * inset;
      y += (cy - y) / distance * inset;
    }
    const element = document.elementFromPoint(x, y);
    return { x, y, canvas: element?.matches('.vp-canvas'), blocker: element?.closest('[aria-label]')?.getAttribute('aria-label') };
  }, { world, inset, center });
  assert.ok(hit?.canvas, `World point ${world} must be under the pointer: ${JSON.stringify(hit)}`);
  await f.page.mouse.click(hit.x, hit.y);
  return hit;
}

async function blankPoint() {
  const blank = await f.page.evaluate(cap => {
    const canvas = document.querySelector('.vp-canvas');
    const rect = canvas.getBoundingClientRect();
    const points = cap.map(point => window.__studioScreenOf(point));
    const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
    const left = Math.min(...xs) - 16, right = Math.max(...xs) + 16;
    const top = Math.min(...ys) - 16, bottom = Math.max(...ys) + 16;
    for (let y = rect.top + 24; y < rect.bottom - 24; y += 24) {
      for (let x = rect.left + 24; x < rect.right - 24; x += 24) {
        if ((x < left || x > right || y < top || y > bottom) && document.elementFromPoint(x, y) === canvas)
          return { x, y };
      }
    }
    return null;
  }, cap);
  assert.ok(blank, 'Find a canvas point outside the projected solid.');
  return blank;
}

async function expectSelection(kind) {
  const categories = ['faces', 'edges', 'vertices', 'bodies', 'sketches'];
  await f.page.waitForFunction(({ categories, kind }) => {
    const selection = window.__studioSelection?.selection;
    return selection && categories.every(key => (selection[key]?.length ?? 0) === Number(key === kind));
  }, { categories, kind }, { timeout: 5000 });
  return f.page.evaluate(() => window.__studioSelection.selection);
}

async function contextCommands(expected) {
  for (const name of ['Hole', 'Fillet']) {
    if (name === expected) await exposed(named(name), name, name);
    else assert.equal(await named(name).count(), 0, `${name} must be absent from Model commands`);
  }
}

async function pixelsAt(points, blank) {
  await f.page.mouse.move(blank.x, blank.y);
  await settle();
  const pixels = await f.page.evaluate(points => window.__studioPixels(points), points);
  assert.ok(pixels?.length === points.length && pixels.every(pixel => pixel.length === 3));
  return pixels;
}

function changedPixels(before, after, label) {
  const delta = before.map((pixel, i) => pixel.reduce((sum, value, channel) => sum + Math.abs(value - after[i][channel]), 0));
  assert.ok(delta.some(value => value >= 12), `${label} highlight changes rendered pixels: ${delta}`);
  return delta;
}

async function openGroup(name, key) {
  await exposed(trigger(name), name);
  if (key) await trigger(name).press(key);
  else await trigger(name).click();
  await group(name).waitFor();
  for (const [candidate] of groups)
    assert.equal(await trigger(candidate).getAttribute('aria-expanded'), String(candidate === name), candidate);
}

async function keyboardCommand(query, id) {
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.page.keyboard.press('Space');
  const palette = hud('Command palette');
  await palette.waitFor();
  await f.page.keyboard.type(query);
  const row = palette.locator(`[cmdk-item][data-value="${id}"][aria-selected="true"]`);
  await row.waitFor();
  await f.page.keyboard.press('Enter');
  await palette.waitFor({ state: 'hidden' });
}

async function recheckBoxReach() {
  f.phase = 'Sketch, Top, New part and Box without framing the Box';
  await f.newPage();
  await f.page.setViewportSize({ width: 1440, height: 900 });
  const newPart = button(f.page.locator('.topbar'), 'New part');
  await newPart.click();
  await f.page.waitForFunction(() => window.__studioDoc?.nodes.length === 0);
  await f.ready();
  await named('Sketch').click();
  await f.sketchPanel().waitFor();
  await f.frame([[0, 0], [20, 12]]);
  await point([0, 0, 0]);
  await point([20, 12, 0]);
  await f.finishSketch('box-reach-prior-sketch');
  await button(f.page.getByRole('group', { name: 'Views', exact: true }), 'Top').click();
  await f.page.waitForTimeout(500);
  await newPart.click();
  await f.page.waitForFunction(() => window.__studioDoc?.nodes.length === 0);
  await f.ready();
  const empty = await f.doc();
  await f.page.keyboard.press('b');
  await preview();
  await button(hud('Box'), 'Apply').click();
  await f.changed(empty);
  assert.equal((await f.bodies()).bodies[0].volume, 32 * 32 * 16);
  const targets = [[32, 0, 16], [0, 0, 16]];
  const sample = () => f.page.evaluate(targets => targets.map(world => {
    const xy = window.__studioScreenOf(world);
    const hit = xy && document.elementFromPoint(...xy);
    return { world, xy, canvas: !!hit?.matches('.vp-canvas'),
      hit: hit?.closest('[aria-label]')?.getAttribute('aria-label') ?? hit?.tagName ?? null };
  }), targets);
  const before = await sample();
  await f.snapshot('box-reach-before-frame-all');
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.page.waitForTimeout(500);
  const after = await sample();
  assert.ok(after.every(row => row.canvas), JSON.stringify(after));
  await f.page.mouse.click(...after[0].xy);
  await f.page.keyboard.down('Shift');
  try { await f.page.mouse.click(...after[1].xy); }
  finally { await f.page.keyboard.up('Shift'); }
  await f.page.waitForFunction(() => window.__studioSelection?.selection.vertices?.length === 2, null, { timeout: 5000 });
  const picked = await f.page.evaluate(() => window.__studioSelection.selection.vertices.map(row => row.at));
  assert.deepEqual(picked, targets);
  f.report.observations.push({ label: 'box-vertex-reach', before, after, picked,
    beforeFrame: before.every(row => row.canvas) ? 'PASS' : 'FAIL', afterFrame: 'PASS' });
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };

  for (const [viewportWidth, chatOpen] of [[1024, false], [1280, true]]) {
    const label = `${viewportWidth}x800-chat-${chatOpen ? 'open' : 'closed'}`;
    f.phase = `${label}: new part and named buttons`;
    await f.newPage();
    await f.page.setViewportSize({ width: viewportWidth, height: 800 });
    const chat = f.page.locator('.chat-col');
    if (await chat.evaluate(el => el.classList.contains('open')) !== chatOpen)
      await button(f.page.locator('.topbar'), 'Chat').click();
    await f.page.locator(chatOpen ? '.chat-col.open' : '.chat-col:not(.open)').waitFor({ state: 'attached' });
    const newPart = button(f.page, 'New part');
    if (await newPart.count() === 0 || !await newPart.isVisible()) {
      await button(f.page, 'More tools').click();
    }
    await newPart.click();
    await f.page.waitForFunction(() => window.__studioDoc?.nodes.length === 0);
    await f.ready();
    await settle();
    const sketchButton = await exposed(named('Sketch'), 'Sketch', 'Sketch');
    const extrudeButton = await exposed(named('Extrude'), 'Extrude', 'Extrude');
    await contextCommands(null);
    await f.snapshot(`${label}-new-part`);

    f.phase = `${label}: named Sketch, rectangle, and Finish`;
    await named('Sketch').press('Enter');
    await f.sketchPanel().waitFor();
    await sketchModeFocused();
    await button(rail(), 'Rectangle').click();
    await f.frame([[0, 0], [width, depth]]);
    await point([0, 0, 0]);
    await point([width, depth, 0]);
    await f.sketchPanel().locator('#sk-width').waitFor();
    assert.equal(Number(await f.sketchPanel().locator('#sk-width').inputValue()), width);
    assert.equal(Number(await f.sketchPanel().locator('#sk-height').inputValue()), depth);
    await f.finishSketch(`${label}-finished-sketch`);
    const modelMode = button(f.page.getByRole('group', { name: 'Mode', exact: true }), 'Model');
    assert.match(await modelMode.getAttribute('class'), /\bon\b/);
    assert.deepEqual((await expectSelection('sketches')).sketches, [0]);
    await f.page.locator('.vp-overlay .profile.picked[data-profile="0"]').waitFor();
    const sketch = await f.doc();
    assert.deepEqual(sketch.nodes.map(node => node.kind), ['sketch']);

    f.phase = `${label}: named Extrude preview and one body`;
    await named('Extrude').click();
    const distance = hud('Extrude').getByLabel('Distance', { exact: true });
    await distance.fill(String(height));
    await preview();
    await named('Sketch').click();
    const exit = hud('Discard feature changes?');
    await exit.waitFor();
    await f.page.keyboard.press('Escape');
    await exit.waitFor({ state: 'hidden' });
    await f.page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Distance');
    assert.equal(await distance.inputValue(), String(height));
    await f.same(sketch);
    assert.equal((await f.bodies()).bodies.length, 0, 'Extrude preview must not commit a body.');
    assert.match(await f.page.locator('.corner-left').innerText(), /1 solid\b/);
    await f.snapshot(`${label}-extrude-preview`);
    await button(hud('Extrude'), 'Apply').click();
    await hud('Extrude').waitFor({ state: 'hidden' });
    await f.changed(sketch);
    const solid = await f.doc();
    assert.deepEqual(solid.nodes.map(node => node.kind), ['sketch', 'extrude']);
    assert.equal(solid.nodes[1].sketch, 0);
    assert.equal(solid.nodes[1].height, height);
    const { bodies } = await f.bodies();
    assert.equal(bodies.length, 1);
    assert.ok(Math.abs(bodies[0].volume - width * depth * height) < 1e-7);

    f.phase = `${label}: group navigation and reach`;
    for (const [name, items] of groups) {
      await openGroup(name, name === 'Shapes' ? 'Space' : name === 'Create' ? 'Enter' : undefined);
      for (const item of items) {
        const tool = button(group(name), item);
        await tool.scrollIntoViewIfNeeded();
        await exposed(tool, `${name} → ${item}`);
        if (name === 'Shapes') assert.equal(await tool.getAttribute('draggable'), 'true', item);
      }
    }
    await trigger('Inspect').click();
    assert.equal(await trigger('Inspect').getAttribute('aria-expanded'), 'false');

    f.phase = `${label}: real Pick all face, edge, vertex, blank`;
    await button(f.page.getByRole('group', { name: 'Views', exact: true }), 'Top').click();
    await f.page.getByTitle('Frame all (F)', { exact: true }).click();
    await settle();
    assert.match(await button(f.page, 'Selection filter').innerText(), /Pick all/);
    const blank = await blankPoint();
    await f.page.mouse.click(blank.x, blank.y);
    await expectSelection(null);
    const samples = [center, [width * 0.4, 0, height], edge, [width * 0.6, 0, height]];
    const baseline = await pixelsAt(samples, blank);

    const faceClick = await point(center);
    const face = (await expectSelection('faces')).faces[0];
    assert.equal(face.body, 0);
    assert.match(await inspector().innerText(), /SELECTION · FACE\s+Type\s+Planar/);
    await contextCommands('Hole');
    const faceDelta = changedPixels(baseline.slice(0, 1), (await pixelsAt(samples, blank)).slice(0, 1), 'Face');
    await f.snapshot(`${label}-selected-face`);

    await named('Hole').click();
    await hud('Hole').waitFor();
    await button(hud('Hole'), 'Cancel').click();
    await hud('Hole').waitFor({ state: 'hidden' });
    await f.same(solid);

    const edgeClick = await point(edge, 1.5);
    assert.equal((await expectSelection('edges')).edges[0].body, 0);
    assert.match(await inspector().innerText(), /SELECTION · EDGE/);
    await contextCommands('Fillet');
    const edgeDelta = changedPixels(baseline.slice(1), (await pixelsAt(samples, blank)).slice(1), 'Edge');
    await f.snapshot(`${label}-selected-edge`);
    await named('Fillet').click();
    await hud('Fillet').waitFor();
    assert.equal(await hud('Fillet').getByLabel('Fillet type', { exact: true }).inputValue(), 'edge');
    await button(hud('Fillet'), 'Cancel').click();
    await hud('Fillet').waitFor({ state: 'hidden' });

    const vertexClick = await point(corner, 1.5);
    assert.deepEqual((await expectSelection('vertices')).vertices, [{ body: 0, at: corner }]);
    assert.match(await inspector().innerText(), /SELECTION · POINT/);
    await contextCommands(null);
    await f.page.locator('.vp-overlay .vertex-mark.selected').waitFor();
    await f.snapshot(`${label}-selected-vertex`);
    await f.page.mouse.click(blank.x, blank.y);
    await expectSelection(null);
    await contextCommands(null);
    assert.doesNotMatch(await inspector().innerText(), /SELECTION · (FACE|EDGE|POINT)/);
    assert.equal(await f.page.locator('.vp-overlay .vertex-mark.selected').count(), 0);
    await f.snapshot(`${label}-selection-cleared`);

    f.phase = `${label}: grouped face-perimeter Fillet`;
    await point(center);
    assert.deepEqual((await expectSelection('faces')).faces, [face]);
    await openGroup('Modify');
    await button(group('Modify'), 'Fillet').press('Enter');
    await hud('Fillet').waitFor();
    assert.equal(await hud('Fillet').getByLabel('Fillet type', { exact: true }).inputValue(), 'edge');
    await hud('Fillet').getByLabel('Radius', { exact: true }).fill('1');
    await preview();
    await button(hud('Fillet'), 'Apply').click();
    await f.changed(solid);
    const fillet = (await f.doc()).nodes.at(-1);
    assert.equal(fillet.kind, 'fillet');
    assert.equal(new Set(fillet.edges).size, 4);
    assert.ok(fillet.edges.every(name => name.split('|').some(face => /\.top$/.test(face))));
    await f.undo();
    await f.same(solid);

    f.phase = `${label}: Space search and keyboard command launch`;
    await point(center);
    assert.deepEqual((await expectSelection('faces')).faces, [face]);
    await keyboardCommand('Fillet', 'fillet');
    await hud('Fillet').waitFor();
    assert.equal(await hud('Fillet').getByLabel('Fillet type', { exact: true }).inputValue(), 'edge');
    await hud('Fillet').getByLabel('Radius', { exact: true }).fill('1');
    await preview();
    await button(hud('Fillet'), 'Cancel').click();
    await hud('Fillet').waitFor({ state: 'hidden' });
    await keyboardCommand('Face fillet', 'face-fillet');
    await hud('Fillet').waitFor();
    assert.equal(await hud('Fillet').getByLabel('Fillet type', { exact: true }).inputValue(), 'face');
    await button(hud('Fillet'), 'Cancel').click();
    await hud('Fillet').waitFor({ state: 'hidden' });
    await keyboardCommand('Measure', 'measure');
    await f.page.waitForFunction(() => window.__studioSelection?.measure === true);
    await f.page.keyboard.press('Escape');
    await f.page.waitForFunction(() => window.__studioSelection?.measure === false);
    await f.same(solid);
    assert.equal(await chat.evaluate(el => el.classList.contains('open')), chatOpen);

    f.phase = `${label}: named Sketch discard restores focus to the visible mode control`;
    await openGroup('Shapes');
    await button(group('Shapes'), 'Box').click();
    await hud('Box').getByLabel('Width X', { exact: true }).fill('36');
    await named('Sketch').press('Enter');
    await button(hud('Discard feature changes?'), 'Discard changes').press('Enter');
    await f.sketchPanel().waitFor();
    await sketchModeFocused();
    await hud('Box').waitFor({ state: 'hidden' });
    await f.same(solid);
    f.report.observations.push({ label, sketchButton, extrudeButton, volume: bodies[0].volume,
      faceClick, edgeClick, vertexClick, blank, faceDelta, edgeDelta, perimeterEdges: fillet.edges, sketchDiscardFocus: true });
    await f.persist();
  }
  await recheckBoxReach();
  assert.deepEqual(f.report.downloads, []);
});

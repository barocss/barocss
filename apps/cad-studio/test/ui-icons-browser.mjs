// D415: generic SVGs in real Studio, with every external font request locally blocked.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const gallery = resolve(process.argv[3] ?? ''), output = resolve(process.argv[2] ?? ''); assert.ok(process.argv[2] && process.argv[3]);
await mkdir(output, { recursive: true });
const fixture = JSON.parse(await readFile(join(import.meta.dirname, 'fixtures/bracket.bcad'), 'utf8'));
fixture.parameters.IconSizeControl = 1;
const native = join(output, 'icon-controls.bcad'); await writeFile(native, JSON.stringify(fixture));
const registry = JSON.parse(await readFile(join(gallery, 'registry.json'), 'utf8'));
const metadata = JSON.parse(await readFile(join(gallery, 'producer-inputs.json'), 'utf8'));
const f = await createFlow({
  name: 'ui-icons', envFrozen: 'UI_ICONS_SOURCE_FROZEN', output, qualification: 'D415_LUCIDE_UI_ICONS',
  initialFiles: ['apps/cad-studio/test/ui-icons-browser.mjs', 'apps/cad-studio/test/ui-icon-gallery.mjs', 'apps/cad-studio/test/fixtures/bracket.bcad', native],
  extraFrozen: Object.keys(metadata.inputs).filter(path => path !== 'apps/cad-studio/ui-icon-gallery.tsx'),
  requiredFrozen: ['apps/cad-studio/src/ui/atoms.tsx', 'apps/cad-studio/src/ui/uiIcons.ts', 'apps/cad-studio/src/ui/cadIcons.tsx'],
  limits: [
    '88 semantic generic glyph names and30 traced dynamic source expressions; fullgallery reviewed at20/48px, not universal user-recognition certification.',
    'Actual main buttons, keyboard palette, history menu, parameter panel, drawing tools and Chat-open only; no model Apply, outbound Save/export/download or paid chat.',
    'IBM typography stylesheet remains configured but is locally fulfilled empty in this run; no font asset reaches a remote host. CAD100 source/render/size controls are separate tests/provenance.',
  ],
});
const fonts = { ibmStylesheets: 0, materialRequests: [], assets: 0 }, states = [];
async function noMissing(label) {
  const state = await f.page.evaluate(() => ({
    missing: [...document.querySelectorAll('[data-ui-icon-missing]')].map(e => e.getAttribute('data-ui-icon-missing')),
    fontSpans: document.querySelectorAll('.ms').length,
    materialLinks: [...document.querySelectorAll('link')].map(e => e.href).filter(href => /material/i.test(href)),
    generic: [...document.querySelectorAll('svg[data-ui-icon]')].filter(svg => svg.getBoundingClientRect().width > 0).map(svg => ({ name: svg.getAttribute('data-ui-icon'), width: svg.getBoundingClientRect().width, height: svg.getBoundingClientRect().height, small: svg.classList.contains('sm'), shadcnButton: !!svg.closest('[data-slot=button]'), hidden: svg.getAttribute('aria-hidden'), text: svg.textContent })),
  }));
  assert.deepEqual(state.missing, [], label); assert.equal(state.fontSpans, 0, label); assert.deepEqual(state.materialLinks, [], label);
  assert.ok(state.generic.length > 0, label);
  assert.ok(state.generic.every(icon => icon.width === (icon.small ? 16 : 19) && icon.height === icon.width && icon.hidden === 'true' && icon.text === ''), label);
  states.push({ label, genericIcons: state.generic });
}
async function uiIcon(button, name) {
  assert.equal(await button.locator('svg[data-ui-icon="' + name + '"]').count(), 1, name);
  assert.equal(await button.locator('[data-ui-icon-missing],.ms').count(), 0, name);
}
await f.run(async () => {
  const original = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async (...args) => {
    const context = await original(...args);
    await context.route('https://fonts.googleapis.com/**', route => {
      if (/material/i.test(route.request().url())) fonts.materialRequests.push(route.request().url()); else fonts.ibmStylesheets++;
      return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    });
    await context.route('https://fonts.gstatic.com/**', route => { fonts.assets++; return route.fulfill({ status: 204, body: '' }); });
    return context;
  };
  try { await f.newPage(); } finally { f.browser.newContext = original; }
  f.phase = 'Open native model and inspect main SVG buttons';
  await f.openFile(native, 2); await f.ready();
  await f.page.waitForFunction(() => window.__studioDoc?.nodes?.[0]?.max?.[0] === 30 && window.__studioDoc.nodes[1]?.height === 6);
  const originalDoc = await f.doc();
  for (const [label, name] of [['Chat', 'chat'], ['Undo', 'undo'], ['Redo', 'redo'], ['Parameters', 'function'], ['Open', 'folder_open'], ['Save', 'save']]) {
    await uiIcon(f.page.getByRole('button', { name: label, exact: true }).first(), name);
  }
  const box = f.page.getByRole('button', { name: 'Box', exact: true });
  assert.equal(await box.locator('svg.cad-icon').count(), 1, 'existing CAD renderer remains in toolbar');
  await noMissing('main'); await f.snapshot('01-main-svg-controls');

  f.phase = 'keyboard command palette and existing CAD command';
  await f.page.keyboard.press('Space');
  const palette = f.page.getByRole('dialog', { name: 'Command palette', exact: true }); await palette.waitFor();
  await uiIcon(palette.locator('.palette-input'), 'search');
  await palette.getByRole('combobox').fill('Box');
  const item = palette.locator('.pl-item').filter({ has: f.page.locator('.pl-label', { hasText: /^Box$/ }) }).first();
  assert.equal(await item.locator('svg.cad-icon').count(), 1);
  await palette.getByRole('combobox').press('ArrowDown'); await palette.getByRole('combobox').press('ArrowUp');
  await noMissing('palette'); await f.snapshot('02-keyboard-palette');
  await f.page.keyboard.press('Escape'); await palette.waitFor({ state: 'hidden' }); await f.same(originalDoc);

  f.phase = 'parameters button, Escape-safe close and history menu';
  await f.page.getByRole('button', { name: 'Parameters', exact: true }).click();
  const parameters = f.page.getByRole('complementary', { name: 'Parameters panel', exact: true }); await parameters.waitFor();
  await uiIcon(parameters.getByRole('button', { name: 'Close parameters', exact: true }), 'close');
  const smallButton = parameters.getByRole('button', { name: 'Delete IconSizeControl', exact: true });
  assert.equal(await smallButton.getAttribute('data-slot'), 'button');
  assert.equal(await smallButton.locator('svg').evaluate(svg => svg.getBoundingClientRect().width), 16);
  await noMissing('parameters'); await parameters.getByRole('button', { name: 'Close parameters', exact: true }).click();
  await f.page.locator('.history .hs[data-node-index="1"]').click({ button: 'right' });
  const edit = f.page.getByRole('menuitem', { name: 'Edit', exact: true }); await edit.waitFor();
  assert.equal(await edit.locator('svg.cad-icon').count(), 1); await noMissing('history-menu'); await f.snapshot('03-history-menu');
  await f.page.keyboard.press('Escape'); await f.same(originalDoc);

  f.phase = 'existing shadcn Finish button retains normal19px SVG';
  await f.page.click('.mode button:text-is("Sketch")'); await f.sketchPanel().waitFor();
  const finish = f.page.getByRole('button', { name: /^Finish sketch/ });
  assert.equal(await finish.getAttribute('data-slot'), 'button');
  assert.equal(await finish.locator('svg[data-ui-icon="check"]').evaluate(svg => svg.getBoundingClientRect().width), 19);
  await noMissing('sketch-button');
  await f.page.keyboard.press('Escape'); await f.sketchPanel().waitFor({ state: 'hidden' }); await f.same(originalDoc);

  f.phase = 'Drawing tools use semantic bundled SVGs';
  await f.page.click('.mode button:text-is("Drawing")');
  await f.page.waitForSelector('svg[aria-label="Drawing sheet"]');
  for (const [label, name] of [['Linear dimension', 'straighten'], ['Diameter', 'radio_button_unchecked'], ['Angle', 'architecture'], ['Note', 'sticky_note_2']]) {
    await uiIcon(f.page.getByRole('button', { name: label, exact: true }), name);
  }
  await noMissing('drawing'); await f.snapshot('04-drawing-svg-tools');
  await f.page.click('.mode button:text-is("Model")'); await f.same(originalDoc);

  f.phase = 'Chat panel opens and closes without a turn';
  await f.page.getByRole('button', { name: 'Chat', exact: true }).first().click();
  const chat = f.page.getByRole('complementary', { name: 'Chat', exact: true }); await chat.waitFor();
  assert.equal(await chat.getByLabel('Chat message', { exact: true }).inputValue(), '');
  await uiIcon(chat.getByRole('button', { name: 'Close chat', exact: true }), 'close');
  await uiIcon(chat.getByRole('button', { name: 'Attach image', exact: true }), 'image');
  await noMissing('chat-open'); await f.snapshot('05-chat-open');
  await chat.getByRole('button', { name: 'Close chat', exact: true }).click(); await chat.waitFor({ state: 'hidden' });
  await f.same(originalDoc);
  assert.deepEqual(fonts.materialRequests, []); assert.equal(fonts.assets, 0); assert.ok(fonts.ibmStylesheets >= 1);
  assert.deepEqual(f.report.downloads, []);
  f.report.observations.push({ genericNames: registry.names.length, states, documentUnchanged: true, cadToolbarControl: true, fonts, chatTurn: 'NOT_RUN', applySaveAndOutboundFiles: 'NOT_RUN' });
});

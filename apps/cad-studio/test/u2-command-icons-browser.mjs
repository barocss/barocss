// D410 U2: actual command-icon routing and a20/48px visual contact sheet, no command Apply/download.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';
const contact = resolve(process.argv[3] ?? ''); assert.ok(process.argv[3], 'contact producer output directory required');
const metadata = JSON.parse(await readFile(join(contact, 'producer-inputs.json'), 'utf8'));
const f = await createFlow({ name: 'u2-command-icons', envFrozen: 'U2_COMMAND_ICONS_SOURCE_FROZEN', output: process.argv[2], qualification: 'D410_U2_COMMAND_ICONS',
  initialFiles: ['apps/cad-studio/test/u2-command-icons-browser.mjs', 'apps/cad-studio/test/u2-icon-contact-sheet.mjs', 'apps/cad-studio/test/fixtures/bracket.bcad', join(contact, 'contact-sheet.html')],
  extraFrozen: Object.keys(metadata.inputs).filter(p => p !== 'apps/cad-studio/u2-icon-contact-sheet.tsx'),
  requiredFrozen: ['apps/cad-studio/src/ui/cadIcons.tsx', 'apps/cad-studio/src/ui/commandIcons.ts', 'apps/cad-studio/src/ui/Palette.tsx', 'apps/cad-studio/src/ui/FeatureHistoryMenu.tsx'],
  limits: ['Five U2 drawn command icons only; U1 redraws, U3 generic UI migration and U4 Fillet remain separate.', 'Real command palette checks four IDs; generic Edit is an actual feature-history menu action because it is not a static palette command.', 'Toolbar mappings are checked where currently visible. HUD/context/help forwarding is source- and focused-test coverage unless separately exercised.', 'Visual20px/48px legibility is for root review; SVG structure checks alone do not certify recognizability.', 'No Apply, Save, export, downloads, external fonts/fixtures or paid calls.'] });
// Geometry signature verifies a live mapped SVG matches its registry rendering, without mirroring paths in tests.
const signature = svg => [...svg.querySelectorAll('path,circle,rect,polygon,polyline,ellipse,line')].map(e => [e.tagName, ...['d','cx','cy','r','x','y','width','height','points','x1','y1','x2','y2','transform'].map(n => e.getAttribute(n))]);
let expected; const fontRoutes = { stylesheets: 0, assets: 0 };
async function checkIcon(locator, id) {
  assert.equal(await locator.locator('svg.cad-icon').count(), 1, id + ' has one drawn SVG'); assert.equal(await locator.locator('.ms').count(), 0, id + ' has no icon-font fallback');
  const actual = await locator.locator('svg.cad-icon').evaluate(signature); assert.deepEqual(actual, expected[id], id + ' routes to its exact registered geometry');
}
await f.run(async () => {
  f.phase = 'contact sheet20px and48px';
  // The existing U3 font stylesheet is intentionally absent in this test; U2 SVGs must still render.
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async (...args) => { const context = await newContext(...args); await context.route('https://fonts.googleapis.com/**', route => { fontRoutes.stylesheets++; return route.fulfill({ status: 200, contentType: 'text/css', body: '' }); }); await context.route('https://fonts.gstatic.com/**', route => { fontRoutes.assets++; return route.fulfill({ status: 204, body: '' }); }); return context; };
  try { await f.newPage(); } finally { f.browser.newContext = newContext; }
  const sheetPage = await f.context.newPage();
  try {
    await sheetPage.setViewportSize({ width: 1100, height: 450 }); await sheetPage.setContent(await readFile(join(contact, 'contact-sheet.html'), 'utf8'));
    expected = {}; for (const id of ['sketch3d','cylindrical-wrap','edit','text','text-relief']) expected[id] = await sheetPage.locator('.dark [data-command="' + id + '"] svg').first().evaluate(signature);
    const sizes = await sheetPage.locator('svg').evaluateAll(nodes => nodes.map(svg => ({ width: svg.getBoundingClientRect().width, height: svg.getBoundingClientRect().height, fontText: svg.querySelectorAll('text,image').length })));
    assert.equal(sizes.length, 20); assert.ok(sizes.every(s => (s.width === 20 || s.width === 48) && s.width === s.height && !s.fontText)); assert.equal(new Set(Object.values(expected).map(v => JSON.stringify(v))).size, 5);
    await sheetPage.screenshot({ path: join(f.output, '00-contact-sheet-20-48.png'), fullPage: true }); f.report.observations.push({ label: 'contact-sheet', sizes, visibleLabels: ['3D sketch','Cylindrical wrap','Edit','Text','Text relief'], backgrounds: { dark: '#242529', light: '#ffffff' } });
  } finally { await sheetPage.close(); }
  f.phase = 'real Studio command mappings'; await f.openFile(join(f.app, 'test/fixtures/bracket.bcad'), 2); const original = await f.doc();
  for (const [id, label] of [['sketch3d','3D sketch'],['cylindrical-wrap','Cylindrical wrap'],['text','Text'],['text-relief','Text relief']]) {
    await f.page.keyboard.press('Space'); const palette = f.page.getByRole('dialog', { name: 'Command palette', exact: true }); await palette.waitFor();
    await palette.locator('input').fill(label); const item = palette.locator('.pl-item').filter({ has: f.page.locator('.pl-label', { hasText: new RegExp('^' + label + '$') }) }).first(); await item.waitFor();
    await checkIcon(item, id); await f.snapshot('palette-' + id); await f.page.keyboard.press('Escape'); await palette.waitFor({ state: 'hidden' });
    const toolbar = f.page.getByRole('button', { name: label, exact: true }); if (await toolbar.count() === 1 && await toolbar.isVisible()) { await checkIcon(toolbar, id); f.report.observations.push({ label: 'toolbar', id, accessibleLabel: label, size: await toolbar.locator('svg').evaluate(e => e.getBoundingClientRect().width) }); }
  }
  f.phase = 'actual Edit history action'; await f.page.locator('.history .hs[data-node-index="1"]').click({ button: 'right' });
  const edit = f.page.getByRole('menuitem', { name: 'Edit', exact: true }); await edit.waitFor(); await checkIcon(edit, 'edit'); await f.snapshot('history-edit'); await f.page.keyboard.press('Escape');
  // Existing command control remains drawn and keeps its accessible label; no action is executed.
  const existing = f.page.getByRole('button', { name: 'Box', exact: true }).first(); await existing.waitFor(); assert.equal(await existing.locator('svg.cad-icon').count(), 1);
  await f.same(original); assert.deepEqual(f.report.downloads, []); assert.ok(fontRoutes.stylesheets >= 1); assert.equal(fontRoutes.assets, 0, 'empty stylesheet must request no font assets'); f.report.observations.push({ fontRoutes, externalFontDownloads: 0 }); f.report.observations.push({ labelsAndDocumentUnchanged: true, existingBoxControl: 'PASS', commandApply: 'NOT_RUN', outboundFiles: 'NOT_RUN' });
});

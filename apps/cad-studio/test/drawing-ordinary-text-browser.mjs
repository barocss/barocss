// D409: actual ordinary ASME sheet text height, no outbound file action.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';
const input = resolve(process.argv[3] ?? ''); assert.ok(process.argv[3], 'producer output directory required');
const metadata = JSON.parse(await readFile(join(input, 'producer-inputs.json'), 'utf8'));
const f = await createFlow({ name: 'drawing-ordinary-text', envFrozen: 'DRAWING_ORDINARY_TEXT_SOURCE_FROZEN', output: process.argv[2], qualification: 'D409_ASME_ORDINARY_TEXT_HEIGHT',
  initialFiles: ['apps/cad-studio/test/drawing-ordinary-text-browser.mjs', 'apps/cad-studio/test/drawing-ordinary-text-producer.mjs', 'packages/barocss-cad-model/test/drawing-ordinary-text-fixture.ts', join(input, 'asme.bcad')],
  extraFrozen: Object.keys(metadata.inputs).filter(p => p !== 'drawing-ordinary-text-producer.ts'),
  requiredFrozen: ['packages/barocss-cad-model/src/drawing/sheet.ts', 'packages/barocss-cad-model/src/drawing/table.ts', 'packages/barocss-cad-model/src/drawing/welds.ts'],
  limits: ['Recorded3mm product requirement for ordinary ASME view labels, stacked deviations, table and weld lettering; broad ASME standards certification is NOT_RUN.', 'One mitred L-frame with one stacked tolerance and one table/weld; section/detail/cross-sheet and split-block paths are unit-tested, not actual-browser acceptance.', 'Title-block small labels, ST/modifier internal glyphs and3D annotations retain their previous scope.', 'No Save, export, downloads, external fixtures or paid live calls.'] });
const SHEET = 'svg[aria-label="Drawing sheet"]'; let model;
async function unchangedModel() { const { drawing: _drawing, ...rest } = await f.doc(); void _drawing; assert.deepEqual(rest, model); }
async function read(label, standard) {
  await f.page.waitForFunction(s => window.__studioDoc.drawing?.standard === s && !!window.__studioDrawing?.() && [...document.querySelectorAll('svg[aria-label="Drawing sheet"] g.label text')].every(t => Number(t.getAttribute('font-size')) === (s === 'asme' ? 3 : 2.5)), standard, { timeout: 60000 });
  const state = await f.page.evaluate(() => { const svg = document.querySelector('svg[aria-label="Drawing sheet"]'); return { svg: svg.outerHTML, groups: [...svg.querySelectorAll('g.label,g.dimension,g.table,g.weld')].map(g => ({ role: g.getAttribute('class'), id: g.getAttribute('data-dim'), texts: [...g.querySelectorAll('text')].map(t => { const b = t.getBBox(); return { text: t.textContent, height: Number(t.getAttribute('font-size')), x: b.x, y: b.y, width: b.width, boundHeight: b.height }; }) })), drawing: window.__studioDrawing() }; });
  for (const role of ['label', 'dimension', 'table', 'weld']) { const groups = state.groups.filter(g => g.role.split(' ')[0] === role); assert.ok(groups.length, role); const sizes = groups.flatMap(g => g.texts.map(t => t.height)); assert.ok(sizes.every(h => h >= (standard === 'asme' ? 3 : 2.5)), role + ' text sizes'); if (role !== 'dimension') assert.ok(sizes.every(h => h === (standard === 'asme' ? 3 : 2.5))); }
  const dimension = state.groups.find(g => g.id === 'width' && g.role.startsWith('dimension')); assert.equal(dimension.texts.length, 3); if (standard === 'asme') { const upper = dimension.texts[1], lower = dimension.texts[2]; assert.ok(upper.y + upper.boundHeight <= lower.y, 'actual SVG deviation glyph bounds remain separate'); }
  await writeFile(join(f.output, label + '.svg'), state.svg); await writeFile(join(f.output, label + '-sheet.json'), JSON.stringify(state, null, 2)); await unchangedModel(); f.report.observations.push({ label, standard, groups: state.groups, numericText: dimension.texts.map(t => t.text) }); return state;
}
await f.run(async () => {
  await f.newPage(); f.phase = 'Open authored frame and ASME drawing'; await f.openFile(join(input, 'asme.bcad'), 1); const original = await f.doc(), { drawing: _drawing, ...rest } = original; void _drawing; model = rest;
  await f.page.click('.mode button:text-is("Drawing")'); await f.page.waitForSelector(SHEET); await f.page.waitForFunction(() => window.__studioDrawing?.().dimensions.length === 1, null, { timeout: 60000 });
  const asme = await read('01-asme-ordinary', 'asme'); await f.snapshot('01-asme-ordinary');
  f.phase = 'ISO and Undo/Redo'; await f.page.getByLabel('Drawing standard', { exact: true }).selectOption('iso'); await f.page.waitForFunction(() => window.__studioDoc.drawing.standard === 'iso'); const isoDoc = await f.doc(), iso = await read('02-iso-preserved', 'iso');
  const numeric = s => s.groups.find(g => g.id === 'width' && g.role.startsWith('dimension')).texts.map(t => t.text); assert.deepEqual(numeric(iso), numeric(asme));
  await f.undo(); await f.same(original); await read('03-undo-asme', 'asme'); await f.redo(); await f.same(isoDoc); await read('04-redo-iso', 'iso'); await f.snapshot('04-redo-iso');
  assert.deepEqual(f.report.downloads, []); f.report.observations.push({ documentGeometryUnchanged: true, toleranceNumbersUnchanged: true, undoRedo: 'PASS', outboundSaveExport: 'NOT_RUN' });
});

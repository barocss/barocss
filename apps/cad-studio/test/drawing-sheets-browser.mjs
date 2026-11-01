// Roadmap 11 ④ (CG5 DR-8): a drawing set of two sheets in the actual Studio. Fixture test/fixtures/bracket.bcad (a 30 x 12 x 6 box, no drawing).
// Real clicks: the Mode button (Drawing), Auto-dimension, the sheet tabs' Add sheet (+), the Sheets panel's "Move Top view to sheet" (Sheet 2), the tabs, Export SVG on each sheet,
// Export PDF; Undo / Redo; Save, a fresh Open.
// The independent Python oracle (python3 -I, zero product imports) reads the exported files: sheet 1's SVG has the front view and no top view, its title block says 1 OF 2 and it lists
// both sheets (the sheet index); sheet 2's SVG has the top view only, says 2 OF 2, and its dimensions are the top view's; the PDF has exactly two pages, each with an A4 media box
// (842 x 595 pt, either way round). The model never changes.
// Root must freeze all sources first. Run from apps/cad-studio:
//   DRAWING_SHEETS_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/drawing-sheets-browser.mjs /absolute/artifacts
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const oracleSource = String.raw`"""A two-sheet drawing set: the top view on sheet 2, title blocks n OF 2, a two-page A4 PDF. Product imports: zero."""
import json, re, sys
import xml.etree.ElementTree as ET
d = json.load(sys.stdin); NS = '{http://www.w3.org/2000/svg}'
def read(svg):
    root = ET.fromstring(svg.encode('utf-8'))
    views = sorted({g.get('data-view') for g in root.iter(NS + 'g') if g.get('class') == 'view' and g.get('data-view')})
    dimviews = sorted({g.get('data-view') for g in root.iter(NS + 'g') if g.get('class') == 'dimension'})
    texts = [t.text or '' for t in root.iter(NS + 'text')]
    return views, dimviews, texts
v1, dv1, t1 = read(d['sheet1']); v2, dv2, t2 = read(d['sheet2'])
assert 'front' in v1 and 'top' not in v1, ('sheet 1 views', v1)
assert v2 == ['top'], ('sheet 2 holds the top view only', v2)
assert 'top' not in dv1 and set(dv2) <= {'top'} and dv2, ('dimensions follow their view', dv1, dv2)
assert any('1 OF 2' in t for t in t1), ('sheet 1 title block', [t for t in t1 if 'OF' in t])
assert any('2 OF 2' in t for t in t2), ('sheet 2 title block', [t for t in t2 if 'OF' in t])
idx = [t for t in t1 if 'Sheet 1' in t or 'Sheet 2' in t]
assert any('Sheet 1' in t for t in idx) and any('Sheet 2' in t for t in idx), ('the sheet index on sheet 1 names both sheets', idx)
pdf = d['pdf']
pages = re.findall(r'/Type\s*/Page(?!s)', pdf); assert len(pages) == 2, ('two PDF pages', len(pages))
boxes = [tuple(round(float(x)) for x in m) for m in re.findall(r'/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]', pdf)]
assert len(boxes) >= 2 and all(sorted(b) == [595, 842] for b in boxes[:2]), ('A4 media boxes', boxes)
print(json.dumps({'status': 'PASS', 'productImports': 0, 'sheet1Views': v1, 'sheet2Views': v2, 'pdfPages': len(pages), 'boxes': boxes}))
`;

const SHEET = 'svg[aria-label="Drawing sheet"]';
const f = await createFlow({ name: 'drawing-sheets', envFrozen: 'DRAWING_SHEETS_SOURCE_FROZEN', output: process.argv[2], qualification: 'DRAWING_SHEETS_CG5_DR8', oracleSource,
  limits: ['Two A4 sheets of a 30 x 12 x 6 box (the top view moved); details/sections across sheets are unit-tested.', 'The PDF is checked for its page count and media boxes; its drawing is judged from the SVG of each sheet.'],
  initialFiles: ['apps/cad-studio/test/drawing-sheets-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/test/fixtures/bracket.bcad', 'apps/cad-studio/src/ui/drawing/SheetSet.tsx',
    'packages/barocss-cad-model/src/drawing/sheets.ts', 'packages/barocss-cad-model/src/drawing/sheetSet.ts', 'packages/barocss-cad-model/src/io/pdf.ts'],
  requiredFrozen: ['packages/barocss-cad-model/src/drawing/sheetSet.ts'] });

await f.run(async () => {
  const fixture = resolve(f.app, 'test/fixtures/bracket.bcad');
  const sheetReady = () => f.page.waitForFunction(() => !!window.__studioDrawing?.() && !!document.querySelector('svg[aria-label="Drawing sheet"]'), null, { timeout: 60000 });
  const enterDrawing = async () => { if (!(await f.page.locator(SHEET).count())) await f.page.click('.mode button:text-is("Drawing")'); await sheetReady(); };
  const download = async (name, label, ext) => {
    const [dl] = await Promise.all([f.page.waitForEvent('download', { timeout: 30000 }), f.page.getByRole('button', { name, exact: true }).click()]);
    const file = join(f.output, `${label}.${ext}`); await dl.saveAs(file); return readFile(file, ext === 'pdf' ? 'latin1' : 'utf8');
  };
  const edit = async act => { const before = await f.doc(); await act(); await f.changed(before); await sheetReady(); return f.doc(); };
  const tab = name => f.page.getByRole('tablist', { name: 'Sheets', exact: true }).getByRole('tab').filter({ hasText: name }).first();

  await f.newPage(); f.phase = 'open, drawing, auto-dimension'; await f.openFile(fixture, 2); await enterDrawing(); const original = await f.doc();
  await edit(() => f.page.getByRole('button', { name: 'Auto-dimension', exact: true }).click());

  f.phase = 'add sheet 2, move the top view'; const twoSheets = await edit(() => f.page.getByRole('button', { name: 'Add sheet', exact: true }).click());
  assert.equal(twoSheets.drawing.sheets?.length, 1, 'one sheet after the first');
  const panel = f.page.locator('details[aria-label="Sheets"]'); if (!(await panel.evaluate(e => e.open))) await panel.locator('summary').first().click();
  const moved = await edit(() => f.page.getByLabel('Move Top view to sheet', { exact: true }).selectOption('2'));
  assert.deepEqual(moved.drawing.sheets[0].views, ['top']); assert.deepEqual(moved.nodes, original.nodes, 'the model never changes'); await f.snapshot('02-sheet2');
  const sheet2 = await download('Export SVG', '02-sheet2', 'svg');

  f.phase = 'sheet 1'; await tab('Sheet 1').click(); await sheetReady(); await f.snapshot('03-sheet1'); const sheet1 = await download('Export SVG', '03-sheet1', 'svg');
  f.phase = 'pdf'; const pdf = await download('Export PDF', '04-set', 'pdf');
  f.phase = 'undo, redo'; await f.undo(); await f.same(twoSheets); await f.redo(); await f.same(moved);
  f.phase = 'save, fresh open'; const saved = await f.save('drawing-sheets'); assert.deepEqual(saved.doc, moved);
  await f.freshOpen(saved.file, moved, '05-fresh-open');
  await f.runOracle({ sheet1, sheet2, pdf }, '05-sheets');
});

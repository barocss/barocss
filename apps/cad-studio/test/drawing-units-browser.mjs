// Roadmap 11 ③b (CG5 DR-7): inch display and dual dimensions in the actual Studio. Fixture test/fixtures/bracket.bcad (a 30 x 12 x 6 box, no drawing).
// Real clicks and keys: the Mode button (Drawing), Auto-dimension, the sheet settings' Drawing units (inch), Dual units, Details → Decimals in inch (2, Enter / blur); Undo / Redo; Save, a fresh Open;
// Export SVG after each step. The model stays in mm: the document's model nodes never change.
// The independent Python oracle (python3 -I, zero product imports) converts by its own arithmetic (mm / 25.4, no leading zero, zeros kept to the precision) and reads the exported sheets:
// inch — the dimension texts are 1.181, .472, .236 and the UNITS cell reads inch; dual — 1.181 [30], .472 [12], .236 [6] and UNITS inch [mm]; two inch decimals — 1.18 [30], .47 [12], .24 [6].
// Root must freeze all sources first. Run from apps/cad-studio:
//   DRAWING_UNITS_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/drawing-units-browser.mjs /absolute/artifacts
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const oracleSource = String.raw`"""Dimension texts and the UNITS cell under inch, dual and two inch decimals. Product imports: zero."""
import json, sys
import xml.etree.ElementTree as ET
d = json.load(sys.stdin); NS = '{http://www.w3.org/2000/svg}'
def inch(mm, places):
    s = f'{mm / 25.4:.{places}f}'
    return s[1:] if s.startswith('0.') else s
def dims(svg):
    root = ET.fromstring(svg.encode('utf-8'))
    out = []
    for g in root.iter(NS + 'g'):
        if g.get('class') == 'dimension': out.append(' '.join(t.text for t in g.iter(NS + 'text') if t.text))
    return sorted(out), [t.text for t in root.iter(NS + 'text') if t.text]
lengths = d['lengths']
for key, places, dual, units in (('inch', 3, False, 'inch'), ('dual', 3, True, 'inch [mm]'), ('two', 2, True, 'inch [mm]')):
    got, texts = dims(d[key])
    want = sorted(f'{inch(v, places)} [{v:g}]' if dual else inch(v, places) for v in lengths)
    assert got == want, (key, got, want)
    assert units in texts, (key, 'the UNITS cell', units)
mm_dims, mm_texts = dims(d['mm'])
assert mm_dims == sorted(f'{v:g}' for v in lengths), ('mm as before', mm_dims)
print(json.dumps({'status': 'PASS', 'productImports': 0, 'lengths': lengths, 'inch': dims(d['inch'])[0], 'dual': dims(d['dual'])[0], 'two': dims(d['two'])[0]}))
`;

const SHEET = 'svg[aria-label="Drawing sheet"]';
const f = await createFlow({ name: 'drawing-units', envFrozen: 'DRAWING_UNITS_SOURCE_FROZEN', output: process.argv[2], qualification: 'DRAWING_UNITS_CG5_DR7', oracleSource,
  limits: ['Three auto dimensions of a 30 x 12 x 6 box (no tolerances); tolerance, GD&T and target conversions are unit-tested.', 'No standard set (the inch rule is the same under ISO and ASME); no PDF / DXF output here.'],
  initialFiles: ['apps/cad-studio/test/drawing-units-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/test/fixtures/bracket.bcad', 'apps/cad-studio/src/ui/drawing/SheetSettings.tsx',
    'packages/barocss-cad-model/src/drawing/standard.ts', 'packages/barocss-cad-model/src/drawing/sheet.ts'],
  requiredFrozen: ['packages/barocss-cad-model/src/drawing/standard.ts'] });

await f.run(async () => {
  const fixture = resolve(f.app, 'test/fixtures/bracket.bcad');
  const sheetReady = () => f.page.waitForFunction(() => !!window.__studioDrawing?.() && !!document.querySelector('svg[aria-label="Drawing sheet"]'), null, { timeout: 60000 });
  const enterDrawing = async () => { if (!(await f.page.locator(SHEET).count())) await f.page.click('.mode button:text-is("Drawing")'); await sheetReady(); };
  const exportSvg = async label => {
    const [download] = await Promise.all([f.page.waitForEvent('download', { timeout: 30000 }), f.page.getByRole('button', { name: 'Export SVG', exact: true }).click()]);
    const file = join(f.output, `${label}.svg`); await download.saveAs(file); return readFile(file, 'utf8');
  };
  const edit = async act => { const before = await f.doc(); await act(); await f.changed(before); await sheetReady(); return f.doc(); };

  await f.newPage(); f.phase = 'open, drawing, auto-dimension'; await f.openFile(fixture, 2); await enterDrawing();
  const dimmed = await edit(() => f.page.getByRole('button', { name: 'Auto-dimension', exact: true }).click());
  f.report.observations.push({ dimensions: dimmed.drawing.dimensions }); assert.equal(dimmed.drawing.dimensions.length, 3, 'width, depth and height of the box');
  const mm = await exportSvg('01-mm');

  f.phase = 'inch'; const inchDoc = await edit(() => f.page.getByLabel('Drawing units', { exact: true }).selectOption('inch'));
  assert.equal(inchDoc.drawing.units, 'inch'); assert.deepEqual(inchDoc.nodes, dimmed.nodes, 'the model stays in mm'); const inch = await exportSvg('02-inch'); await f.snapshot('02-inch');
  f.phase = 'dual'; const dualDoc = await edit(() => f.page.getByLabel('Dual units', { exact: true }).check()); const dual = await exportSvg('03-dual');
  f.phase = 'undo, redo'; await f.undo(); await f.same(inchDoc); await f.redo(); await f.same(dualDoc);
  f.phase = 'two inch decimals'; const details = f.page.locator('details').filter({ has: f.page.getByLabel('Decimals in inch', { exact: true }) }).first();
  if (!(await details.evaluate(e => e.open))) await details.locator('summary').first().click();
  const box = f.page.getByLabel('Decimals in inch', { exact: true }); const twoDoc = await edit(async () => { await box.fill('2'); await box.press('Enter'); await box.blur(); });
  const two = await exportSvg('04-two-decimals'); await f.snapshot('04-two-decimals');
  f.phase = 'save, fresh open'; const saved = await f.save('drawing-units'); assert.deepEqual(saved.doc, twoDoc);
  await f.freshOpen(saved.file, twoDoc, '05-fresh-open');
  await f.runOracle({ mm, inch, dual, two, lengths: [30, 12, 6] }, '05-units');
});

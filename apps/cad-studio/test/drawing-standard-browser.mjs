// Roadmap 11 ③a (CG5 DR-7): the ISO / ASME drawing standard setting in the actual Studio. Fixture test/fixtures/bracket.bcad (a 30 x 12 x 6 box, no drawing).
// Real clicks: the Mode button (Drawing), Auto-dimension, the sheet settings' Standard select (ASME, then ISO, then Not set), Undo / Redo, Save, a fresh Open, Export SVG after each step.
// The independent Python oracle (python3 -I, zero product imports) reads the exported sheets: with no standard the sheet is byte-identical before and after the round trip through ASME and ISO;
// ASME — dimension text 3 mm high and never rotated, arrowheads 3 long and 1 wide (3:1); ISO — dimension text 3.5 mm high, at least one dimension text turned with its (vertical) line,
// arrowheads 3 long and 0.8 wide (15°); each standard's projection symbol (two concentric circles, radii R and R/2) is sized by its lettering (R = 3 ASME, 3.5 ISO).
// Root must freeze all sources first. Run from apps/cad-studio:
//   DRAWING_STANDARD_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/drawing-standard-browser.mjs /absolute/artifacts
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const oracleSource = String.raw`"""Exported sheets under no standard, ASME and ISO. Product imports: zero."""
import json, math, re, sys
import xml.etree.ElementTree as ET
d = json.load(sys.stdin); NS = '{http://www.w3.org/2000/svg}'
nums = lambda s: [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?(?:[eE]-?\d+)?', s or '')]
# (The title follows the file name, which Save changed from bracket to drawing-standard: compared with that one word put back.)
assert d['none'] == d['noneAgain'].replace('drawing-standard</', 'bracket</'), 'no standard: the sheet is byte-identical after the round trip through ASME and ISO'
def read(svg):
    root = ET.fromstring(svg.encode('utf-8'))
    dims = [g for g in root.iter(NS + 'g') if g.get('class') == 'dimension']
    texts = [t for g in dims for t in g.iter(NS + 'text')]
    heads = []
    for g in dims:
        for e in list(g.iter(NS + 'polygon')) + [p for p in g.iter(NS + 'path') if (p.get('fill') or '') not in ('', 'none')]:
            p = nums(e.get('points') if e.tag == NS + 'polygon' else e.get('d')); pts = [(p[i], p[i + 1]) for i in range(0, len(p) - 1, 2)][:3]
            if len(pts) == 3:
                tip, b1, b2 = pts; base = ((b1[0] + b2[0]) / 2, (b1[1] + b2[1]) / 2)
                heads.append((round(math.dist(tip, base), 3), round(math.dist(b1, b2), 3)))
    # The projection symbol's end view: two concentric whole circles (two half arcs each), radii R and R/2.
    circles = []
    for p in root.iter(NS + 'path'):
        dd = p.get('d') or ''
        if dd.count('A') == 2 and (p.get('fill') or 'none') in ('none', ''):
            v = nums(dd); circles.append((round(v[0] - v[2], 4), round(v[1], 4), v[2]))
    pairs = [(a[2], b[2]) for a in circles for b in circles if a[:2] == b[:2] and abs(a[2] - 2 * b[2]) <= 1e-6]
    return dims, texts, heads, pairs
nd, nt, nh, na = read(d['none']); ad, at, ah, aa = read(d['asme']); idd, it, ih, ia = read(d['iso'])
assert ad and idd and len(ad) == len(idd) == len(nd), ('the same dimensions under each standard', len(nd), len(ad), len(idd))
assert all(t.get('font-size') == '3' for t in at), ('ASME text 3 mm', sorted({t.get('font-size') for t in at}))
assert all(t.get('font-size') == '3.5' for t in it), ('ISO text 3.5 mm', sorted({t.get('font-size') for t in it}))
rot = lambda t: bool(t.get('transform') or t.get('rotate'))
assert not any(rot(t) for t in at), 'ASME dimension text is never turned (unidirectional)'
assert any(rot(t) for t in it), 'ISO turns the text of a vertical dimension (aligned)'
assert ah and all(abs(L - 3) <= 1e-3 and abs(W - 1.0) <= 1e-3 for L, W in ah), ('ASME arrowheads 3 x 1', sorted(set(ah)))
assert ih and all(abs(L - 3) <= 1e-3 and abs(W - 0.8) <= 1e-3 for L, W in ih), ('ISO arrowheads 3 x 0.8', sorted(set(ih)))
assert aa and all(abs(R - 3) <= 1e-6 for R, _ in aa), ('ASME projection symbol sized by its 3 mm lettering', aa)
assert ia and all(abs(R - 3.5) <= 1e-6 for R, _ in ia), ('ISO projection symbol sized by its 3.5 mm lettering', ia)
print(json.dumps({'status': 'PASS', 'productImports': 0, 'dimensions': len(ad), 'asmeHeads': sorted(set(ah)), 'isoHeads': sorted(set(ih)), 'circles': [na, aa, ia]}))
`;

const SHEET = 'svg[aria-label="Drawing sheet"]';
const f = await createFlow({ name: 'drawing-standard', envFrozen: 'DRAWING_STANDARD_SOURCE_FROZEN', output: process.argv[2], qualification: 'DRAWING_STANDARD_CG5_DR7', oracleSource,
  limits: ['A 30 x 12 x 6 box with auto dimensions; the look of each standard is judged by the root from zoomed renders.', 'Metric only (inch and dual dimensions are 11 ③b); no PDF / DXF output here.'],
  initialFiles: ['apps/cad-studio/test/drawing-standard-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/test/fixtures/bracket.bcad', 'apps/cad-studio/src/ui/drawing/SheetSettings.tsx',
    'packages/barocss-cad-model/src/drawing/standard.ts', 'packages/barocss-cad-model/src/drawing/sheet.ts'],
  requiredFrozen: ['packages/barocss-cad-model/src/drawing/standard.ts', 'packages/barocss-cad-model/src/drawing/sheet.ts'] });

await f.run(async () => {
  const fixture = resolve(f.app, 'test/fixtures/bracket.bcad');
  const sheetReady = () => f.page.waitForFunction(() => !!window.__studioDrawing?.() && !!document.querySelector('svg[aria-label="Drawing sheet"]'), null, { timeout: 60000 });
  const enterDrawing = async () => { if (!(await f.page.locator(SHEET).count())) await f.page.click('.mode button:text-is("Drawing")'); await sheetReady(); };
  const exportSvg = async label => {
    const [download] = await Promise.all([f.page.waitForEvent('download', { timeout: 30000 }), f.page.getByRole('button', { name: 'Export SVG', exact: true }).click()]);
    const file = join(f.output, `${label}.svg`); await download.saveAs(file); return readFile(file, 'utf8');
  };
  const standard = async value => { const before = await f.doc(); await f.page.getByLabel('Drawing standard', { exact: true }).selectOption(value); await f.changed(before); await sheetReady(); return f.doc(); };

  await f.newPage(); f.phase = 'open, drawing, auto-dimension'; await f.openFile(fixture, 2); await enterDrawing();
  const plain = await f.doc(); await f.page.getByRole('button', { name: 'Auto-dimension', exact: true }).click(); await f.changed(plain); await sheetReady();
  const dimensioned = await f.doc(); assert.ok(dimensioned.drawing?.dimensions?.length, 'auto dimensions'); const none = await exportSvg('01-none'); await f.snapshot('01-none');

  f.phase = 'ASME'; const asmeDoc = await standard('asme'); assert.equal(asmeDoc.drawing.standard, 'asme'); const asme = await exportSvg('02-asme'); await f.snapshot('02-asme');
  f.phase = 'undo, redo'; await f.undo(); await f.same(dimensioned); await f.redo(); await f.same(asmeDoc);
  f.phase = 'save, fresh open'; const saved = await f.save('drawing-standard'); assert.deepEqual(saved.doc, asmeDoc);
  await f.freshOpen(saved.file, asmeDoc, '03-fresh-open'); await enterDrawing();
  f.phase = 'ISO'; const isoDoc = await standard('iso'); assert.equal(isoDoc.drawing.standard, 'iso'); const iso = await exportSvg('04-iso'); await f.snapshot('04-iso');
  f.phase = 'not set'; const back = await standard(''); assert.equal(back.drawing.standard, undefined, 'Not set clears the field'); const noneAgain = await exportSvg('05-none-again');
  await f.runOracle({ none, asme, iso, noneAgain }, '05-standards');
});

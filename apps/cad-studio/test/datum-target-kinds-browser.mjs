// Roadmap 11 ② (CG5 DR-6): line and area datum targets in the actual Studio. Fixture test/fixtures/bracket.bcad (a 30 x 12 x 6 box, no drawing); the Drawing workspace is entered with the Mode button.
// Real clicks and keys: Datum targets → Kind Area, shape Circle, Ø 4, Add, click the centre in the front view, click where the symbol goes; Kind Line, Add, click the two ends of the front view's top edge,
// click where the symbol goes; Undo / Redo; Save, a fresh Open; Export SVG.
// The independent Python oracle (python3 -I, zero product imports) reads the saved targets (an area circle Ø4 at the clicked centre, a line between the clicked ends) and the exported SVG's target groups:
// the area's outline and the target line are dashed (phantom), every hatch line of the area lies inside its circle, the line target is a phantom line without X marks (ASME), each symbol is a circle with a
// horizontal split line through its centre, the area symbol carries "Ø4" above the split and its label below, the line symbol its label only.
// Root must freeze all sources first. Run from apps/cad-studio:
//   DATUM_TARGET_KINDS_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/datum-target-kinds-browser.mjs /absolute/artifacts
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const oracleSource = String.raw`"""An area (circle) and a line datum target, saved and drawn. Product imports: zero."""
import json, math, re, sys
import xml.etree.ElementTree as ET
d = json.load(sys.stdin); svg = d['svg']; targets = d['targets']
near = lambda a, b, tol=0.25: abs(a[0] - b[0]) <= tol and abs(a[1] - b[1]) <= tol
area = [t for t in targets if t.get('kind') == 'area']; line = [t for t in targets if t.get('kind') == 'line']
assert len(area) == 1 and len(line) == 1 and len(targets) == 2, targets
a, l = area[0], line[0]
assert a['view'] == 'front' and a['area']['shape'] == 'circle' and a['area']['d'] == 4 and near(a['area']['at'], d['areaAt']), a
assert l['view'] == 'front' and near(l['line']['from'], d['lineFrom']) and near(l['line']['to'], d['lineTo']), l
labels = {t['letter'] + str(t['number']) for t in targets}; assert len(labels) == 2, labels
NS = '{http://www.w3.org/2000/svg}'; root = ET.fromstring(svg.encode('utf-8'))
nums = lambda s: [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?(?:[eE]-?\d+)?', s)]
groups = {g.get('data-datum-target'): g for g in root.iter(NS + 'g') if g.get('data-datum-target')}
assert set(groups) == {a['id'], l['id']}, sorted(groups)
def parts(g):
    lines = [[float(e.get(k)) for k in ('x1', 'y1', 'x2', 'y2')] + [e.get('stroke-dasharray')] for e in g.iter(NS + 'line')]
    paths = [(nums(e.get('d')), e.get('stroke-dasharray'), e.get('d')) for e in g.iter(NS + 'path')]
    polys = [(nums(e.get('points')), e.get('stroke-dasharray')) for e in g.iter(NS + 'polyline')]
    texts = [(t.text, float(t.get('x')), float(t.get('y'))) for t in g.iter(NS + 'text')]
    return lines, paths, polys, texts
def symbol(paths, lines, texts, label, upper):
    # The symbol: a solid circle (two half arcs) with a horizontal split line through its centre; the label under the split, the size above it.
    solid = [p for p in paths if not p[1]]
    for p, _, raw in solid:
        if raw.count('A') < 2: continue
        x0, y0 = p[0], p[1]; r = p[2]; cx, cy = x0 - r, y0  # a whole circle is two half arcs starting at its right-most point
        split = [s for s in lines if not s[4] and abs(s[1] - s[3]) < 1e-6 and abs(s[1] - cy) <= 0.05 and abs((s[0] + s[2]) / 2 - cx) <= 0.05 and abs(abs(s[2] - s[0]) - 2 * r) <= 0.05]
        if not split: continue
        lab = [t for t in texts if t[0] == label]; assert lab and lab[0][2] > cy and abs(lab[0][1] - cx) <= 0.05, ('label under the split', label, lab, (cx, cy))
        if upper:
            up = [t for t in texts if t[0] == upper]; assert up and up[0][2] < cy + 1e-6 and abs(up[0][1] - cx) <= 0.05, ('size above the split', upper, up, (cx, cy))
        else: assert all(t[0] == label for t in texts), ('a line target symbol has its label only', texts)
        return (cx, cy, r)
    raise AssertionError(('no split symbol circle', label))
al, ap, apo, at = parts(groups[a['id']]); ll, lp, lpo, lt = parts(groups[l['id']])
alabel, llabel = a['letter'] + str(a['number']), l['letter'] + str(l['number'])
sa = symbol(ap, al, at, alabel, 'Ø4'); sl = symbol(lp, ll, lt, llabel, None)
# The area outline: dashed arcs; its centre and radius from the arc numbers; every hatch line inside it.
dashed = [p for p in ap if p[1]]; assert dashed, 'a phantom (dashed) area outline'
p = dashed[0][0]; r = p[2]; cx, cy = p[0] - r, p[1]
hatch = [s for s in al if not s[4] and abs(abs(s[2] - s[0]) - abs(s[3] - s[1])) <= 1e-3 and abs(s[2] - s[0]) > 1e-6]
assert len(hatch) >= 2, ('45 degree hatch lines', len(hatch))
for s in hatch:
    for x, y in ((s[0], s[1]), (s[2], s[3])): assert math.hypot(x - cx, y - cy) <= r + 1e-3, ('hatch inside the area', s, (cx, cy, r))
# The line target (ASME Y14.5): a phantom line in the direct view, no X marks (an X is a point target's).
phantom = [s for s in ll if s[4]] + [(q[0][0], q[0][1], q[0][-2], q[0][-1], q[1]) for q in lpo if q[1]]
assert len(phantom) >= 1, ('a phantom target line', ll)
seg = phantom[0]; ends = [(seg[0], seg[1]), (seg[2], seg[3])]
xs = [s for s in ll if not s[4] and abs(abs(s[2] - s[0]) - abs(s[3] - s[1])) <= 1e-3 and 0.5 < abs(s[2] - s[0]) < 5]
for e in ends:
    at_end = [s for s in xs if abs((s[0] + s[2]) / 2 - e[0]) <= 0.05 and abs((s[1] + s[3]) / 2 - e[1]) <= 0.05]
    assert not at_end, ('no X marks on a target line', e, at_end)
print(json.dumps({'status': 'PASS', 'productImports': 0, 'areaSymbol': sa, 'lineSymbol': sl, 'areaCircle': [cx, cy, r], 'hatch': len(hatch), 'lineEnds': ends}))
`;

const VIEW = 'front', SHEET = 'svg[aria-label="Drawing sheet"]', AREA_AT = [15, 3], LINE_FROM = [0, 6], LINE_TO = [30, 6];
const f = await createFlow({ name: 'datum-target-kinds', envFrozen: 'DATUM_TARGET_KINDS_SOURCE_FROZEN', output: process.argv[2], qualification: 'DATUM_TARGET_KINDS_CG5_DR6', oracleSource,
  limits: ['One circular area and one line target in the front view of a 30 x 12 x 6 box; the look is judged by the root from a zoomed render of the exported SVG.', 'Rectangle areas and moveable point targets are covered by unit tests only; no PDF / DXF output here.'],
  initialFiles: ['apps/cad-studio/test/datum-target-kinds-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/test/fixtures/bracket.bcad', 'apps/cad-studio/src/ui/drawing/DatumTargetsEditor.tsx',
    'apps/cad-studio/src/ui/DrawingWorkspace.tsx', 'packages/barocss-cad-model/src/drawing/datumTargets.ts', 'packages/barocss-cad-model/src/drawing/sheet.ts'],
  requiredFrozen: ['packages/barocss-cad-model/src/drawing/datumTargets.ts', 'packages/barocss-cad-model/src/drawing/sheet.ts'] });

await f.run(async () => {
  const fixture = resolve(f.app, 'test/fixtures/bracket.bcad');
  const targets = doc => doc.drawing?.datumTargets ?? [];
  const sheetReady = () => f.page.waitForFunction(() => !!window.__studioDrawing?.() && !!document.querySelector('svg[aria-label="Drawing sheet"]'), null, { timeout: 60000 });
  const enterDrawing = async () => { if (!(await f.page.locator(SHEET).count())) await f.page.click('.mode button:text-is("Drawing")'); await sheetReady(); };
  const box = () => f.page.locator('details[aria-label="Datum targets"]');
  const hint = re => f.page.waitForFunction(r => new RegExp(r).test(document.querySelector('.dw-hint')?.textContent ?? ''), re, { timeout: 15000 });
  const clickView = async ([u, v]) => {
    const px = await f.page.evaluate(([view, u, v]) => window.__studioDrawingAt?.(view, u, v), [VIEW, u, v]); assert.ok(px && Number.isFinite(px.x), 'pixel of the view point');
    assert.ok(await f.page.evaluate(p => !!document.elementFromPoint(p.x, p.y)?.closest('svg[aria-label="Drawing sheet"]'), px), 'the view point is on the sheet');
    await f.page.mouse.click(px.x, px.y); await f.page.waitForTimeout(250);
  };
  const exportSvg = async label => {
    const [download] = await Promise.all([f.page.waitForEvent('download', { timeout: 30000 }), f.page.getByRole('button', { name: 'Export SVG', exact: true }).click()]);
    const file = join(f.output, `${label}.svg`); await download.saveAs(file); return readFile(file, 'utf8');
  };

  await f.newPage(); f.phase = 'open, drawing'; await f.openFile(fixture, 2); await enterDrawing(); await f.snapshot('01-drawing');
  if (!(await box().evaluate(e => e.open))) await box().locator('summary').click();

  f.phase = 'area target'; await box().getByLabel('Datum target kind', { exact: true }).selectOption('area');
  await box().getByLabel('Datum target area shape', { exact: true }).selectOption('circle');
  await box().getByLabel('Datum target area diameter', { exact: true }).fill('4');
  await box().getByRole('button', { name: 'Add datum target', exact: true }).click(); await hint('centre|center');
  await clickView(AREA_AT); await hint('symbol');
  const before = await f.doc(); await clickView([-10, 10]); await f.changed(before);
  const one = await f.doc(); assert.equal(targets(one).length, 1); await f.snapshot('02-area');

  f.phase = 'line target'; await box().getByLabel('Datum target kind', { exact: true }).selectOption('line');
  await box().getByRole('button', { name: 'Add datum target', exact: true }).click(); await hint('end|line');
  await clickView(LINE_FROM); await hint('other end'); await clickView(LINE_TO); await hint('symbol');
  await clickView([40, 14]); await f.changed(one);
  const two = await f.doc(); assert.equal(targets(two).length, 2); await f.snapshot('03-line');

  f.phase = 'undo, redo'; await f.undo(); await f.same(one); await f.redo(); await f.same(two);
  f.phase = 'save, fresh open'; const saved = await f.save('datum-target-kinds'); assert.deepEqual(saved.doc, two);
  await f.freshOpen(saved.file, two, '04-fresh-open'); await enterDrawing(); await f.snapshot('05-drawing-reopened');
  f.phase = 'export SVG'; const svg = await exportSvg('05-sheet');
  await f.runOracle({ svg, targets: targets(await f.doc()), areaAt: AREA_AT, lineFrom: LINE_FROM, lineTo: LINE_TO }, '05-svg');
});

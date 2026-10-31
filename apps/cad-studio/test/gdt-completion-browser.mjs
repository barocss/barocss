// Roadmap 11 ① (CG5 DR-6): GD&T completion in the actual Studio. Fixture test/fixtures/bracket.bcad (a 30 x 12 x 6 box, no drawing); the Drawing workspace is entered with the Mode button.
// Real clicks and keys: Add standalone frame in the right view; the frame's row in "Standalone geometric controls"; the editor's characteristic select (profile of a surface), datums "A" (Enter),
// All around, Add stacked frame + its tolerance 0.05 (Enter), Details → Statistical tolerance (ST); then a rule-breaking change (flatness keeps datum A → refused, nothing changes);
// Undo / Redo of the ST change; Save, a fresh Open; Export SVG.
// The independent Python oracle (python3 -I, zero product imports) reads the saved frame (profile-surface, datums [A], around all-around, statistical, stacked {0.05, [A]}) and the exported SVG's
// frame group: two frame borders, the second directly below the first and as tall; a 7-point closed hexagon with the text ST inside the first frame; a ring left of the first frame (all around);
// DATUM_UNDEFINED reported for A (no datum feature symbol on the sheet), no FRAME_RULE.
// Root must freeze all sources first. Run from apps/cad-studio:
//   GDT_COMPLETION_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/gdt-completion-browser.mjs /absolute/artifacts
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const oracleSource = String.raw`"""A profile frame with all around, ST and a stacked frame, in the saved document and the exported SVG. Product imports: zero."""
import json, re, sys
import xml.etree.ElementTree as ET
d = json.load(sys.stdin); svg = d['svg']; fr = d['frame']; issues = d['issues']
assert fr['characteristic'] == 'profile-surface' and fr['datums'] == ['A'], fr
assert fr.get('around') == 'all-around' and fr.get('statistical') is True, fr
assert fr.get('stacked', {}).get('value') == 0.05 and fr['stacked'].get('datums') == ['A'], fr.get('stacked')
assert 'composite' not in fr, 'stacked and composite are exclusive'
codes = [i['code'] for i in issues]
assert 'DATUM_UNDEFINED' in codes, ('datum A has no feature symbol on the sheet', codes)
assert 'FRAME_RULE' not in codes, ('the frame follows the rules', issues)
NS = '{http://www.w3.org/2000/svg}'; root = ET.fromstring(svg.encode('utf-8'))
nums = lambda s: [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?(?:[eE]-?\d+)?', s)]
g = [g for g in root.iter(NS + 'g') if g.get('data-standalone-frame') == d['id']]; assert len(g) == 1, len(g); g = g[0]
polys = []
for e in g.iter(NS + 'polyline'):
    p = nums(e.get('points')); polys.append([(p[i], p[i + 1]) for i in range(0, len(p), 2)])
borders = [p for p in polys if len(p) == 5 and p[0] == p[4]]
hexes = [p for p in polys if len(p) == 7]
assert len(borders) == 2, ('two frame borders (the frame and the stacked frame)', [len(p) for p in polys])
box = lambda p: (min(x for x, _ in p), min(y for _, y in p), max(x for x, _ in p), max(y for _, y in p))
(a0, b0, a1, b1), (c0, e0, c1, e1) = sorted((box(p) for p in borders), key=lambda b: b[1])
assert abs(a0 - c0) <= 1e-3, ('the stacked frame starts at the same left edge', a0, c0)
assert abs(e0 - b1) <= 1e-3, ('the stacked frame sits directly below', b1, e0)
assert abs((b1 - b0) - (e1 - e0)) <= 1e-3 and abs((b1 - b0) - 6) <= 1e-3, ('both 6 paper mm high', b1 - b0, e1 - e0)
assert len(hexes) == 1, ('one ST hexagon', len(hexes)); hx = box(hexes[0])
assert a0 < hx[0] and hx[2] <= a1 + 1e-3 and b0 <= hx[1] and hx[3] <= b1 + 1e-3, ('the hexagon inside the first frame', hx, (a0, b0, a1, b1))
texts = [(t.text, float(t.get('x')), float(t.get('y'))) for t in g.iter(NS + 'text')]
st = [t for t in texts if t[0] == 'ST']; assert len(st) == 1 and hx[0] < st[0][1] < hx[2], ('ST inside the hexagon', st, hx)
assert sum(1 for t in texts if t[0] == 'A') == 2, ('datum A in both frames', texts)
rings = [nums(e.get('d')) for e in g.iter(NS + 'path')]
left = [r for r in rings if r and max(r[0::2][:1] + [r[0]]) < a0]
assert left, ('a ring left of the frame (all around)', rings[:3], a0)
print(json.dumps({'status': 'PASS', 'productImports': 0, 'frame': [a0, b0, a1, b1], 'stacked': [c0, e0, c1, e1], 'hexagon': hx, 'texts': [t[0] for t in texts]}))
`;

const VIEW = 'right', FRAME = 'frame-1', SHEET = 'svg[aria-label="Drawing sheet"]';
const f = await createFlow({ name: 'gdt-completion', envFrozen: 'GDT_COMPLETION_SOURCE_FROZEN', output: process.argv[2], qualification: 'GDT_COMPLETION_CG5_DR6', oracleSource,
  limits: ['One standalone profile frame in the right view of a 30 x 12 x 6 box; the symbols are checked by SVG geometry, their look by the root from screenshots.', 'No PDF / DXF output; the chat path is not run.'],
  initialFiles: ['apps/cad-studio/test/gdt-completion-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/test/fixtures/bracket.bcad', 'apps/cad-studio/src/ui/drawing/FrameEditor.tsx',
    'packages/barocss-cad-model/src/drawing/controls.ts', 'packages/barocss-cad-model/src/drawing/sheet.ts', 'packages/barocss-cad-model/src/drawing/issues.ts'],
  requiredFrozen: ['packages/barocss-cad-model/src/drawing/controls.ts', 'packages/barocss-cad-model/src/drawing/sheet.ts'] });

await f.run(async () => {
  const fixture = resolve(f.app, 'test/fixtures/bracket.bcad');
  const frameOf = doc => (doc.drawing?.frames ?? []).find(x => x.id === FRAME);
  const sheetReady = () => f.page.waitForFunction(() => !!window.__studioDrawing?.() && !!document.querySelector('svg[aria-label="Drawing sheet"]'), null, { timeout: 60000 });
  const enterDrawing = async () => { if (!(await f.page.locator(SHEET).count())) await f.page.click('.mode button:text-is("Drawing")'); await sheetReady(); };
  const issues = () => f.page.evaluate(() => [...document.querySelectorAll('[aria-label="Drawing issues"] .dw-issue')].map(r => ({ code: r.title, text: r.textContent })));
  const editor = () => f.page.getByRole('region', { name: 'Geometric control editor', exact: true }).or(f.page.locator('section[aria-label="Geometric control editor"]')).first();
  const openEditor = async () => { if (await f.page.locator('section[aria-label="Geometric control editor"]').count()) return;
    await f.page.locator('[aria-label="Standalone geometric controls"] button').filter({ hasText: /^Frame 1/ }).first().click(); await editor().waitFor(); };
  const edit = async act => { const before = await f.doc(); await act(); await f.changed(before); return f.doc(); };
  const commit = async (label, value) => { const box = editor().getByLabel(label, { exact: true }); await box.fill(value); await box.press('Enter'); };
  const exportSvg = async label => {
    const [download] = await Promise.all([f.page.waitForEvent('download', { timeout: 30000 }), f.page.getByRole('button', { name: 'Export SVG', exact: true }).click()]);
    const file = join(f.output, `${label}.svg`); await download.saveAs(file); return readFile(file, 'utf8');
  };

  await f.newPage(); f.phase = 'open, drawing'; await f.openFile(fixture, 2); await enterDrawing(); await f.snapshot('01-drawing');

  f.phase = 'add a standalone frame'; await f.page.getByLabel('Standalone frame view', { exact: true }).selectOption(VIEW);
  await f.page.getByRole('button', { name: 'Add standalone frame', exact: true }).click();
  await f.page.waitForFunction(() => /Click where the standalone frame goes/.test(document.querySelector('.dw-hint')?.textContent ?? ''), null, { timeout: 15000 });
  const px = await f.page.evaluate(([view]) => window.__studioDrawingAt?.(view, 2, 8), [VIEW]); assert.ok(px && Number.isFinite(px.x), 'pixel of the view point');
  const before = await f.doc(); await f.page.mouse.click(px.x, px.y); await f.changed(before); assert.ok(frameOf(await f.doc()), 'the frame is added');

  f.phase = 'profile, all around, stacked, ST'; await openEditor();
  await edit(() => editor().getByLabel('Geometric characteristic', { exact: true }).selectOption('profile-surface'));
  await edit(() => commit('Geometric datums', 'A'));
  assert.equal(await editor().getByLabel('Spherical tolerance zone', { exact: true }).count(), 0, 'no spherical zone for a profile');
  await edit(() => editor().getByLabel('Profile all around or all over', { exact: true }).selectOption('all-around'));
  await edit(() => editor().getByRole('button', { name: 'Add stacked frame', exact: true }).click());
  await edit(() => commit('Stacked frame tolerance', '0.05'));
  assert.equal(await editor().getByLabel('Statistical tolerance (ST)', { exact: true }).isVisible(), false, 'ST is under the closed Details');
  await editor().locator('details[aria-label="Frame options details"] > summary').click();
  const beforeSt = await f.doc(); const done = await edit(() => editor().getByLabel('Statistical tolerance (ST)', { exact: true }).check()); await f.snapshot('02-profile-frame');

  f.phase = 'a rule-breaking change is refused'; await f.dismissToasts();
  await editor().getByLabel('Geometric characteristic', { exact: true }).selectOption('flatness');
  // (The drawing workspace says why in its hint bar, not as a toast.)
  await f.page.waitForFunction(() => /before changing the characteristic|datum|cannot|can’t/i.test(document.querySelector('.dw-hint')?.textContent ?? ''), null, { timeout: 15000 });
  f.report.observations.push({ refused: await f.page.locator('.dw-hint').first().textContent() }); await f.same(done);
  assert.equal(await editor().getByLabel('Geometric characteristic', { exact: true }).inputValue(), 'profile-surface', 'the old characteristic is kept');
  // (A semantic rule: a profile tolerance takes no material modifier.)
  const hint = async () => (await f.page.locator('.dw-hint').first().textContent()) ?? '';
  const was = await hint(); await editor().getByLabel('Material modifier', { exact: true }).selectOption('maximum');
  await f.page.waitForFunction(w => (document.querySelector('.dw-hint')?.textContent ?? '') !== w, was, { timeout: 15000 });
  const rule = await hint(); f.report.observations.push({ ruleRefused: rule }); assert.match(rule, /profile/i); await f.same(done);

  f.phase = 'undo, redo'; await f.undo(); await f.same(beforeSt); await f.redo(); await f.same(done);
  f.phase = 'save, fresh open'; const saved = await f.save('gdt-completion'); assert.deepEqual(saved.doc, done);
  await f.freshOpen(saved.file, done, '03-fresh-open'); await enterDrawing(); await f.snapshot('04-drawing-reopened');

  f.phase = 'export SVG'; const svg = await exportSvg('04-sheet'); const doc = await f.doc();
  await f.runOracle({ svg, id: FRAME, frame: frameOf(doc), issues: await issues() }, '04-svg');
});

// Roadmap row 01 (CG5 DR-6a) qualification: a standalone geometric tolerance frame keeps its view, its view-mm position and its paper-mm symbol through the real Studio UI.
// Fixture: test/fixtures/bracket.bcad (a 30 x 12 x 6 box, no drawing). The Drawing workspace is entered with the Mode button. The frame goes in the RIGHT view (the one view that can be hidden: the front and top views are always shown).
// Steps: (1) Add standalone frame in the right view, click at a known view-mm point (readonly hook __studioDrawingAt gives the pixel), the document gains one frame {id, view, place, no dim}; (2) edit characteristic then tolerance, only those fields change;
// (3) Move frame, only place changes; (4) hide the right view (checkbox) -> VIEW_NEEDED warning naming the standalone frame, the frame group leaves the sheet, the frame is kept; show it again; (5) Save, New part, Open the saved file -> the frame is identical;
// (6) Export SVG, an independent Python oracle (python3 -I, zero product imports) reads the SVG and compares the frame's border corner and symbol text with the right view's own drawn lines (origin and scale taken from the lines of a 12 x 6 box view)
// plus the saved place; (7) Remove frame -> gone, Undo -> identical, export again and re-check.
// Root must freeze all sources first. Run from apps/cad-studio:
//   STANDALONE_FRAME_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/standalone-frame-browser.mjs /absolute/artifacts
// Plumbing is in ./flow-helper.mjs. Not confirmed statically: the right view's projection axes (right = +y, up = +z, min 0), the Mode button / Add / Move / Remove button accessible names after shadcn rendering, the issue row text,
// that New part and Open keep or leave the Drawing mode (the driver re-enters it when the sheet is gone), the Undo button count (the helper falls back to Meta+z).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const oracleSource = String.raw`"""Independent check of a standalone geometric control frame in an exported sheet SVG. Product imports: zero."""
import json, math, re, sys
import xml.etree.ElementTree as ET

data = json.load(sys.stdin)
svg = data['svg']; frame = data['frame']; exp = data['expect']
NS = '{http://www.w3.org/2000/svg}'
root = ET.fromstring(svg.encode('utf-8'))
nums = lambda s: [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?(?:[eE]-?\d+)?', s)]

# The saved frame: standalone (no dim), the view, a finite dense place[2], only supported keys.
allowed = {'id', 'view', 'place', 'dim', 'characteristic', 'value', 'datums', 'diameter', 'material', 'datumModifiers', 'projected', 'freeState', 'tangentPlane', 'composite'}
assert set(frame) <= allowed, ('keys', sorted(set(frame) - allowed))
assert 'dim' not in frame, 'standalone frame has no dim'
assert frame['id'] == exp['id'] and frame['view'] == exp['view'], (frame['id'], frame['view'])
place = frame['place']; assert isinstance(place, list) and len(place) == 2 and all(isinstance(v, (int, float)) and math.isfinite(v) for v in place), place

# The view's own drawn lines give its origin and scale: a 12 x 6 box view spans [0, 12] x [0, 6] model mm, y up (sheet y down).
view_lines = []
for g in root.iter(NS + 'g'):
    if g.get('class') == 'view' and g.get('data-view') == exp['view']:
        for e in g.iter(NS + 'line'):
            view_lines.append([float(e.get(k)) for k in ('x1', 'y1', 'x2', 'y2')])
assert view_lines, ('no lines drawn for the view', exp['view'])
xs = [v for l in view_lines for v in (l[0], l[2])]; ys = [v for l in view_lines for v in (l[1], l[3])]
minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
sx = (maxx - minx) / exp['viewWidth']; sy = (maxy - miny) / exp['viewHeight']
assert abs(sx - sy) <= 2e-3 * sx, ('one scale on both axes', sx, sy)
scale = sx
assert abs(scale - exp['reportedScale']) <= 2e-3 * scale, ('scale against the hook', scale, exp['reportedScale'])
origin = (minx, maxy)

# The frame group: exactly one, standalone identity, no dimension / datum-target identity.
groups = [g for g in root.iter(NS + 'g') if g.get('data-standalone-frame') == exp['id']]
assert len(groups) == 1, ('one frame group', len(groups))
g = groups[0]; assert g.get('class') == 'control' and g.get('data-view') == exp['view'], (g.get('class'), g.get('data-view'))
assert g.get('data-dim') is None and g.get('data-datum-target') is None
border = next((e for e in g.iter(NS + 'polyline')), None); assert border is not None, 'frame border'
pts = nums(border.get('points')); pts = [(pts[i], pts[i + 1]) for i in range(0, len(pts), 2)]
assert len(pts) == 5 and pts[0] == pts[4], pts
want = (origin[0] + scale * place[0], origin[1] - scale * place[1])
assert abs(pts[0][0] - want[0]) <= 5e-3 and abs(pts[0][1] - want[1]) <= 5e-3, ('border top-left against view origin + scale * place', pts[0], want)
x0, y0 = pts[0]; x1 = max(p[0] for p in pts); y1 = max(p[1] for p in pts)
assert abs((y1 - y0) - 6) <= 1e-3, ('the frame stays 6 paper mm high', y1 - y0)
assert (x1 - x0) >= 7 + 6, ('symbol cell 7 plus a value cell', x1 - x0)
texts = [(t.text, float(t.get('x')), float(t.get('y')), t.get('text-anchor')) for t in g.iter(NS + 'text')]
assert [t[0] for t in texts] == [exp['symbolText']], ('the symbol text', texts)
text, tx, ty, anchor = texts[0]
assert x0 + 7 < tx < x1 and abs(ty - (y0 + 4.5)) <= 1e-3 and anchor == 'middle', ('text inside the value cell', texts[0], (x0, y0, x1, y1))
print(json.dumps({'status': 'PASS', 'scale': scale, 'origin': origin, 'place': place, 'borderTopLeft': [x0, y0], 'expectedTopLeft': list(want), 'width': x1 - x0, 'text': texts[0]}, indent=2))
`;

const VIEW = 'right', FRAME = 'frame-1';
const f = await createFlow({ name: 'standalone-frame', envFrozen: 'STANDALONE_FRAME_SOURCE_FROZEN', output: process.argv[2], qualification: 'STANDALONE_GEOMETRIC_FRAME_CG5_DR6A', oracleSource,
  snapshotExtra: () => ({
    frameGroups: [...document.querySelectorAll('svg[aria-label="Drawing sheet"] [data-standalone-frame]')].map(g => ({ id: g.getAttribute('data-standalone-frame'), view: g.getAttribute('data-view'), texts: [...g.querySelectorAll('text')].map(t => t.textContent) })),
    drawingHook: window.__studioDrawing?.() ?? null,
    issueRows: [...document.querySelectorAll('[aria-label="Drawing issues"] .dw-issue')].map(r => ({ code: r.title, text: r.textContent })),
    framesPanel: document.querySelector('[aria-label="Standalone geometric controls"]')?.textContent ?? null }),
  initialFiles: ['apps/cad-studio/test/standalone-frame-browser.mjs', 'apps/cad-studio/test/fixtures/bracket.bcad', 'apps/cad-studio/src/ui/DrawingWorkspace.tsx', 'apps/cad-studio/src/ui/drawing/StandaloneFramesEditor.tsx', 'apps/cad-studio/src/ui/drawing/FrameEditor.tsx',
    'packages/barocss-cad-model/src/drawing/controls.ts', 'packages/barocss-cad-model/src/drawing/sheet.ts', 'packages/barocss-cad-model/src/drawing/issues.ts', 'packages/barocss-cad-model/src/io/svg.ts'],
  requiredFrozen: ['apps/cad-studio/src/ui/DrawingWorkspace.tsx', 'packages/barocss-cad-model/src/drawing/controls.ts'],
  limits: ['A frame without datums only: DATUM_UNDEFINED and datum rendering are not run here.', 'Only the right view of a 30 x 12 x 6 box (projection axes right = +y, up = +z assumed by the oracle); section and detail views are not run.', 'View-mm tolerance 0.2 mm; paper-mm positions to 5e-3 mm (the SVG writes 1e-4 mm).',
    'Selection of the frame by clicking its symbol on the sheet and dragging it are not run; Move uses the Move frame control.', 'No PDF / DXF output and no live AI.'] });

const SHEET = 'svg[aria-label="Drawing sheet"]', PLACE = [2, 8], MOVED = [6, 8.5], TOL = 0.2;
await f.run(async () => {
  const fixture = resolve(f.app, 'test/fixtures/bracket.bcad');
  const frames = doc => doc.drawing?.frames ?? [];
  const rest = doc => { const d = { ...(doc.drawing ?? {}) }; delete d.frames; return d; };
  const groupCount = () => f.page.locator(`${SHEET} [data-standalone-frame="${FRAME}"]`).count();
  const issues = () => f.page.evaluate(() => [...document.querySelectorAll('[aria-label="Drawing issues"] .dw-issue')].map(r => ({ code: r.title, text: r.textContent })));
  const near = (a, b, why) => { assert.ok(Math.abs(a[0] - b[0]) <= TOL && Math.abs(a[1] - b[1]) <= TOL, `${why}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`); };
  const sheetReady = () => f.page.waitForFunction(() => { const d = window.__studioDrawing?.(); return !!d && Array.isArray(d.dimensions) && !!document.querySelector('svg[aria-label="Drawing sheet"]'); }, null, { timeout: 60000 });
  const enterDrawing = async () => { if (!(await f.page.locator(SHEET).count())) await f.page.click('.mode button:text-is("Drawing")'); await sheetReady(); };
  const placingHint = () => f.page.waitForFunction(() => /Click where the standalone frame goes/.test(document.querySelector('.dw-hint')?.textContent ?? ''), null, { timeout: 15000 });
  // A real click at a view-mm point of the view, through the readonly pixel hook; asserts the pixel is over the sheet.
  const clickView = async ([u, v]) => {
    const px = await f.page.evaluate(([view, u, v]) => window.__studioDrawingAt?.(view, u, v), [VIEW, u, v]); assert.ok(px && Number.isFinite(px.x), 'pixel of the view point');
    assert.ok(await f.page.evaluate(p => !!document.elementFromPoint(p.x, p.y)?.closest('svg[aria-label="Drawing sheet"]'), px), 'the view point is on the sheet, not under a panel');
    await f.page.mouse.click(px.x, px.y); await f.page.waitForTimeout(200); return px;
  };
  // Wait until the document's frames satisfy a page-side predicate (source text of an arrow function of the frames array).
  const waitFrames = source => f.page.waitForFunction(`(${source})(window.__studioDoc?.drawing?.frames ?? [])`, null, { timeout: 30000 });
  const exportSvg = async label => {
    const [download] = await Promise.all([f.page.waitForEvent('download', { timeout: 30000 }), f.page.getByRole('button', { name: 'Export SVG', exact: true }).click()]);
    const file = join(f.output, `${label}.svg`); await download.saveAs(file); const text = await readFile(file, 'utf8'); f.report.files.push({ file, bytes: text.length }); return text;
  };
  const oracle = async (label, svg, doc, symbolText) => {
    const hook = await f.page.evaluate(() => ({ scale: window.__studioDrawing().scale }));
    const frame = frames(doc).find(x => x.id === FRAME); assert.ok(frame, 'the saved frame');
    return f.runOracle({ svg, frame, expect: { id: FRAME, view: VIEW, symbolText, viewWidth: 12, viewHeight: 6, reportedScale: hook.scale } }, label);
  };

  // 0. Open the fixture, enter the Drawing workspace.
  await f.newPage(); f.phase = 'open fixture'; await f.openFile(fixture, 2); await f.page.click('.mode button:text-is("Drawing")'); await sheetReady();
  const s00 = await f.snapshot('00-drawing'); assert.deepEqual(frames(s00.doc), [], 'no frames yet'); assert.equal(await groupCount(), 0);
  assert.equal(await f.page.locator('[aria-label="Standalone geometric controls"]').count(), 1, 'the standalone controls section');
  const docBase = s00.doc;

  // 1. Add standalone frame in the right view at a known view-mm point.
  f.phase = 'add standalone frame';
  await f.page.getByLabel('Standalone frame view', { exact: true }).selectOption(VIEW);
  await f.page.getByRole('button', { name: 'Add standalone frame', exact: true }).click(); await placingHint();
  const px1 = await clickView(PLACE);
  await waitFrames('fr => fr.length === 1'); await f.ready();
  const s01 = await f.snapshot('01-added'), frame1 = frames(s01.doc)[0];
  f.report.observations.push({ label: 'add-click', pixel: px1, place: PLACE, frame: frame1 });
  assert.equal(frames(s01.doc).length, 1); assert.equal(frame1.id, FRAME); assert.equal(frame1.view, VIEW); assert.equal(Object.hasOwn(frame1, 'dim'), false, 'standalone: no dim');
  near(frame1.place, PLACE, 'view-mm place consistent with the click'); assert.deepEqual({ ...frame1, place: null }, { id: FRAME, view: VIEW, place: null, characteristic: 'position', value: 0.1, datums: [] });
  assert.deepEqual(s01.doc.nodes, docBase.nodes); assert.deepEqual(s01.doc.parameters, docBase.parameters);
  assert.equal(await groupCount(), 1, 'the frame is drawn on the sheet'); assert.deepEqual(s01.frameGroups[0].texts, ['Ø0.1']);
  const codes01 = (await issues()).map(x => x.code); assert.ok(!codes01.includes('FRAME_VIEW_MISSING') && !codes01.includes('DATUM_UNDEFINED'), `no frame diagnostics: ${codes01}`);
  f.report.observations.push({ label: 'issues-after-add', issues: await issues() });

  // 2. Edit the content: characteristic, then tolerance. The frame is selected after placing; only those fields change.
  f.phase = 'edit characteristic'; await f.page.getByLabel('Geometric characteristic', { exact: true }).selectOption('flatness');
  await waitFrames("fr => fr.length === 1 && fr[0].characteristic === 'flatness'"); await f.ready();
  const s02 = await f.snapshot('02-characteristic'); assert.deepEqual(frames(s02.doc)[0], { ...frame1, characteristic: 'flatness' }); assert.deepEqual(rest(s02.doc), rest(s01.doc));
  f.phase = 'edit tolerance'; const tol = f.page.getByLabel('Geometric tolerance', { exact: true }); await tol.fill('0.25'); await tol.press('Enter');
  await waitFrames('fr => fr.length === 1 && fr[0].value === 0.25'); await f.ready();
  const s03 = await f.snapshot('03-tolerance'), frame3 = frames(s03.doc)[0]; assert.deepEqual(frame3, { ...frame1, characteristic: 'flatness', value: 0.25 }); assert.deepEqual(rest(s03.doc), rest(s01.doc));
  assert.deepEqual(s03.doc.nodes, docBase.nodes); assert.deepEqual(s03.frameGroups[0].texts, ['0.25'], 'the sheet shows the new symbol text');

  // 3. Move: Move frame, then click a new point; only place changes.
  f.phase = 'move frame'; await f.page.getByRole('button', { name: 'Move standalone frame 1', exact: true }).click(); await placingHint();
  const px3 = await clickView(MOVED); await f.page.waitForFunction(old => JSON.stringify(window.__studioDoc?.drawing?.frames?.[0]?.place) !== old, JSON.stringify(frame3.place), { timeout: 30000 }); await f.ready();
  const s04 = await f.snapshot('04-moved'), frame4 = frames(s04.doc)[0]; f.report.observations.push({ label: 'move-click', pixel: px3, place: MOVED, frame: frame4 });
  assert.equal(frames(s04.doc).length, 1); near(frame4.place, MOVED, 'moved place consistent with the click'); assert.deepEqual({ ...frame4, place: null }, { ...frame3, place: null }, 'only place changes'); assert.deepEqual(rest(s04.doc), rest(s03.doc));

  // 4. Hide the view -> VIEW_NEEDED naming the standalone frame, frame kept, group gone; show it again.
  f.phase = 'hide view'; await f.page.locator('input[aria-label="Right view"]').uncheck();
  await f.page.waitForFunction(() => window.__studioDoc?.drawing?.views && !window.__studioDoc.drawing.views.includes('right'), null, { timeout: 30000 });
  await f.page.waitForFunction(() => window.__studioDrawing?.()?.issues.some(i => i.code === 'VIEW_NEEDED' && i.severity === 'warning'), null, { timeout: 30000 });
  const s05 = await f.snapshot('05-view-hidden'); assert.deepEqual(frames(s05.doc), [frame4], 'the frame is kept, not retargeted');
  const needed = s05.issueRows.filter(x => x.code === 'VIEW_NEEDED' && /standalone flatness frame is in .*not shown/i.test(x.text)); assert.equal(needed.length, 1, `VIEW_NEEDED names the standalone frame: ${JSON.stringify(s05.issueRows)}`);
  assert.equal(await groupCount(), 0, 'a frame in a hidden view is not drawn'); assert.ok(!s05.issueRows.some(x => x.code === 'FRAME_VIEW_MISSING'));
  assert.equal(await f.page.getByRole('button', { name: 'Move standalone frame 1', exact: true }).isDisabled(), true, 'Move is disabled while the view is hidden');
  assert.match(s05.framesPanel ?? '', /The frame view is not shown/);
  f.phase = 'show view'; await f.page.locator('input[aria-label="Right view"]').check();
  await f.page.waitForFunction(() => !window.__studioDoc?.drawing?.views || window.__studioDoc.drawing.views.includes('right'), null, { timeout: 30000 });
  await f.page.waitForSelector(`${SHEET} [data-standalone-frame="${FRAME}"]`, { timeout: 30000 });
  const s06 = await f.snapshot('06-view-shown'); assert.deepEqual(frames(s06.doc), [frame4]); assert.deepEqual(rest(s06.doc), rest(s04.doc), 'showing the view restores the drawing settings');
  assert.ok(!s06.issueRows.some(x => x.code === 'VIEW_NEEDED' && /standalone/.test(x.text)), 'the standalone VIEW_NEEDED is gone');

  // 5. Save, New part, Open the saved file in the same page.
  const saved = await f.save('standalone-frame'); assert.deepEqual(frames(saved.doc), [frame4]);
  f.phase = 'New part'; await f.page.click('[aria-label="New part"]'); await f.page.waitForFunction(() => !(window.__studioDoc?.drawing?.frames?.length) && window.__studioDoc?.nodes?.length === 0, null, { timeout: 30000 }); await f.ready();
  const s07 = await f.snapshot('07-new'); assert.deepEqual(frames(s07.doc), [], 'New leaves no frame'); assert.equal(await groupCount(), 0);
  f.phase = 'Open saved'; await f.page.setInputFiles('input[aria-label="Model file"]', saved.file);
  await f.page.waitForFunction(() => window.__studioDoc?.nodes?.length === 2 && window.__studioDoc?.drawing?.frames?.length === 1, null, { timeout: 60000 }); await f.ready(); await enterDrawing();
  await f.page.waitForSelector(`${SHEET} [data-standalone-frame="${FRAME}"]`, { timeout: 30000 });
  const s08 = await f.snapshot('08-opened'); assert.deepEqual(frames(s08.doc), [frame4], 'identical id, view, place and content after Open'); assert.deepEqual(s08.doc.nodes, saved.doc.nodes); assert.deepEqual(s08.doc.drawing, saved.doc.drawing);
  assert.deepEqual(s08.frameGroups, [{ id: FRAME, view: VIEW, texts: ['0.25'] }]);
  await f.page.getByRole('button', { name: /^Frame 1 · /u }).click(); assert.equal(await f.page.getByLabel('Geometric tolerance', { exact: true }).inputValue(), '0.25', 'the reopened frame edits with its values');

  // 6. SVG export, oracle on the saved document.
  f.phase = 'SVG export'; const svg08 = await exportSvg('08-opened'); assert.ok(svg08.includes(`data-standalone-frame="${FRAME}"`), 'the SVG carries the frame group');
  const o08 = await oracle('08', svg08, saved.doc, '0.25');

  // 7. Delete the frame, Undo restores it identically.
  f.phase = 'delete frame'; const beforeDelete = await f.doc(); await f.page.getByRole('button', { name: 'Remove standalone frame 1', exact: true }).click();
  await f.page.waitForFunction(() => !(window.__studioDoc?.drawing?.frames?.length), null, { timeout: 30000 }); await f.ready();
  const s09 = await f.snapshot('09-deleted'); assert.deepEqual(frames(s09.doc), []); assert.equal(await groupCount(), 0); assert.deepEqual(s09.doc.nodes, beforeDelete.nodes); assert.deepEqual(rest(s09.doc), rest(beforeDelete));
  f.phase = 'undo delete'; await f.undo(); await f.same(beforeDelete); await f.page.waitForSelector(`${SHEET} [data-standalone-frame="${FRAME}"]`, { timeout: 30000 });
  const s10 = await f.snapshot('10-undo'); assert.deepEqual(frames(s10.doc), [frame4], 'Undo restores the frame identically'); assert.deepEqual(s10.frameGroups, [{ id: FRAME, view: VIEW, texts: ['0.25'] }]);
  const svg10 = await exportSvg('10-undo'); const o10 = await oracle('10', svg10, s10.doc, '0.25');
  assert.deepEqual(o10.borderTopLeft, o08.borderTopLeft, 'the paper-mm symbol position is the same after Undo');
  assert.deepEqual((await f.toasts()).filter(x => /error|refused|invalid/i.test(x)), [], 'no error toast');
});

// Roadmap 20 ④ ⑥: after a dimension handle is let go, a small labelled value box beside it (the reference CAD's way): typing a value and Enter sets it and applies the
// command, Esc cancels it, and the box and the HUD edit the same value. Fixture apps/cad-studio/test/fixtures/drag-preview-timing.bcad: a 60 x 40 x 20 box (Box, so w / d / h
// arrows) with two through holes R5 and two top-edge fillets R3 along the width. Real pointer drags on the width arrow (g.gizmo-handle[data-handle="w"]), real keys.
// The independent Python oracle (python3 -I, zero product imports) checks the stored width and the Studio volume: w x 40 x 20 - 2 pi 5^2 20 - 2 (1 - pi/4) 3^2 w.
// Root must freeze all sources first. Run from apps/cad-studio:
//   HANDLE_VALUE_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/handle-value-browser.mjs /absolute/artifacts
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const oracleSource = String.raw`"""Box with two through holes and two width-long top fillets: stored width and volume in closed form. Product imports: zero."""
import json, math, sys
data = json.load(sys.stdin); doc = data['doc']; want = data['width']; volume = data['volume']
nodes = doc['nodes']; assert len(nodes) == 5, len(nodes)
sk, ex, h1, h2, fl = nodes
assert sk['kind'] == 'sketch' and sk['min'] == [0, 0] and sk['max'] == [want, 40], ('sketch rectangle', sk)
assert ex['kind'] == 'extrude' and ex['height'] == 20 and ex['made']['values']['w'] == want, ('box made values', ex)
assert h1['kind'] == 'hole' and h2['kind'] == 'hole' and h1['radius'] == 5 and h2['radius'] == 5, (h1, h2)
assert fl['kind'] == 'fillet' and fl['radius'] == 3 and sorted(fl['edges']) == ['n1.side0|n1.top', 'n1.side2|n1.top'], fl
expected = want * 40 * 20 - 2 * math.pi * 25 * 20 - 2 * (1 - math.pi / 4) * 9 * want
rel = abs(expected - volume) / expected
assert rel <= 1e-6, ('volume', expected, volume, rel)
print(json.dumps({'status': 'PASS', 'productImports': 0, 'width': want, 'expectedVolume': expected, 'studioVolume': volume, 'relativeDifference': rel}))
`;
const fixture = join(import.meta.dirname, 'fixtures', 'drag-preview-timing.bcad');
const f = await createFlow({ name: 'handle-value', envFrozen: 'HANDLE_VALUE_SOURCE_FROZEN', output: process.argv[2], qualification: 'HANDLE_VALUE_BOX', oracleSource,
  limits: ['One part and one handle kind (a straight arrow); a puck (two values) offers no box.', 'Headless Chrome at 1440 x 1000; the box position is read from the DOM.'],
  initialFiles: ['apps/cad-studio/test/handle-value-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/test/fixtures/drag-preview-timing.bcad', 'apps/cad-studio/src/viewport/HandleValueBox.tsx', 'apps/cad-studio/src/viewport/Viewport.tsx',
    'apps/cad-studio/src/viewport/useCommandGizmos.ts', 'apps/cad-studio/src/viewport/gizmo.ts', 'apps/cad-studio/src/App.tsx'],
  requiredFrozen: ['apps/cad-studio/src/viewport/HandleValueBox.tsx'] });

const box = () => f.page.locator('.handle-value');
const boxInput = () => box().locator('input');
const hudWidth = () => f.page.locator('.hud .field').filter({ hasText: 'Width X' }).locator('input').first();
const volume = async () => (await f.bodies()).bodies[0]?.volume;
const widthOf = doc => doc.nodes[1].made.values.w;
async function dragOut(px) {
  await f.page.locator('g.gizmo-handle[data-handle="w"]').waitFor({ timeout: 30000 });
  const at = await f.page.evaluate(() => { const r = document.querySelector('g.gizmo-handle[data-handle="w"] polygon').getBoundingClientRect(), c = document.querySelector('g.gizmo-handle[data-handle="w"] circle').getBoundingClientRect();
    return { head: [r.left + r.width / 2, r.top + r.height / 2], root: [c.left + c.width / 2, c.top + c.height / 2] }; });
  const len = Math.hypot(at.head[0] - at.root[0], at.head[1] - at.root[1]), u = [(at.head[0] - at.root[0]) / len, (at.head[1] - at.root[1]) / len];
  await f.page.mouse.move(at.head[0], at.head[1]); await f.page.mouse.down();
  for (let i = 1; i <= px / 4; i++) { await f.page.mouse.move(at.head[0] + u[0] * 4 * i, at.head[1] + u[1] * 4 * i); await new Promise(r => setTimeout(r, 16)); }
  await f.page.mouse.up();
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent?.trim() === 'preview', null, { timeout: 15000 });
  return at;
}
/** The box beside the handle: visible, near the arrow, its value the HUD's, its hint shown. */
async function boxShown(label) {
  await box().waitFor({ timeout: 10000 });
  const read = await f.page.evaluate(() => { const b = document.querySelector('.handle-value'), r = b.getBoundingClientRect(), tip = document.querySelector('g.gizmo-handle[data-handle="w"] polygon').getBoundingClientRect(), vp = document.querySelector('.viewport').getBoundingClientRect();
    return { text: b.textContent, value: b.querySelector('input').value, box: [r.left, r.top, r.width, r.height], tip: [tip.left + tip.width / 2, tip.top + tip.height / 2], inside: r.left >= vp.left && r.right <= vp.right && r.top >= vp.top && r.bottom <= vp.bottom }; });
  const hud = await hudWidth().inputValue();
  f.report.observations.push({ label, ...read, hud });
  assert.equal(read.value, hud, `${label}: the box shows the HUD's value`);
  assert.match(read.text, /Width X/); assert.match(read.text, /Enter applies · Esc cancels/);
  assert.ok(read.inside, `${label}: the box is inside the viewport`);
  // (Beside the tip: its nearest edge within 40 px of it, on whichever side the viewport leaves room.)
  const dx = Math.max(read.box[0] - read.tip[0], 0, read.tip[0] - read.box[0] - read.box[2]), dy = Math.max(read.box[1] - read.tip[1], 0, read.tip[1] - read.box[1] - read.box[3]);
  assert.ok(Math.hypot(dx, dy) < 40, `${label}: the box is beside the arrow tip ${JSON.stringify(read)}`);
  return read;
}

await f.run(async () => {
  await f.newPage(); await f.openFile(fixture, 5);
  const original = await f.doc(); await f.snapshot('01-opened');
  assert.equal(await box().count(), 0, 'no box before a handle is dragged');

  // 1. Drag, let go: the box. Type 72, Enter: set and applied (the App's Enter waits for the preview of 72).
  f.phase = 'drag and type 72'; await f.openFeatureEditor(1, 'box'); await dragOut(40);
  await boxShown('after-drag-1'); await f.snapshot('02-box-after-drag');
  await boxInput().click(); await boxInput().fill('72'); await f.snapshot('03-typed-72');
  await f.page.keyboard.press('Enter'); await f.changed(original);
  const applied = await f.doc(); assert.equal(widthOf(applied), 72); await f.closeEditor(); await f.ready();
  assert.equal(await box().count(), 0, 'the box leaves with the applied command');
  const v72 = await volume(); await f.runOracle({ doc: applied, width: 72, volume: v72 }, '04-applied-72'); await f.snapshot('04-applied-72');
  await f.undo(); await f.same(original); await f.redo(); await f.same(applied);

  // 2. Drag, let go, Esc in the box: cancelled, the document unchanged.
  f.phase = 'drag and Esc'; await f.openFeatureEditor(1, 'box'); await dragOut(32); await boxShown('after-drag-2');
  await boxInput().click(); await f.page.keyboard.press('Escape');
  await box().waitFor({ state: 'hidden', timeout: 10000 }); await f.closeEditor(); await f.same(applied); await f.snapshot('05-escaped');

  // 3. Drag, let go, type 65 in the HUD: the box follows (one value); Apply in the HUD applies 65.
  f.phase = 'drag and HUD 65'; await f.openFeatureEditor(1, 'box'); await dragOut(32); await boxShown('after-drag-3');
  await hudWidth().fill('65'); await f.page.waitForFunction(() => document.querySelector('.handle-value input')?.value === '65', null, { timeout: 10000 });
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent?.trim() === 'preview', null, { timeout: 15000 });
  await boxShown('hud-65'); await f.snapshot('06-hud-65');
  await f.page.locator('.hud').getByRole('button', { name: 'Apply', exact: true }).click(); await f.changed(applied);
  const at65 = await f.doc(); assert.equal(widthOf(at65), 65); await f.closeEditor(); await f.ready();
  await f.runOracle({ doc: at65, width: 65, volume: await volume() }, '07-applied-65');

  // Save and a fresh Open keep it.
  const saved = await f.save('handle-value'); assert.deepEqual(saved.doc, at65);
  await f.freshOpen(saved.file, at65, '08-fresh-open');
  await f.runOracle({ doc: at65, width: 65, volume: await volume() }, '08-fresh-open');
});

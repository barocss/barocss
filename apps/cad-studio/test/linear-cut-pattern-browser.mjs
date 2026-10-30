// Roadmap row 03 (CG2) qualification: the linear cut pattern repeats only the ORIGINAL cut tool through the real Studio UI.
// Fixture: test/fixtures/linear-cut-pattern.bcad (the model test's seed: a 60 x 30 x 10 block, one 4 x 4 x 10 through cut at x 8..12, y 8..12; volume 17840).
// Steps: (1) Open the fixture, select the body, open the 'Linear cut pattern' command; (2) invalid values are refused (status 'refused', text shown, Apply disabled, document unchanged, Cancel);
// (3) valid Direction x, Spacing 16, Count 3 -> preview -> Apply: ONE new 'linear-feature-pattern' node, original nodes unchanged (no stock copies), volume 17520, Selection bounds still 60 x 30 x 10;
// (4) Undo -> the pre-pattern document, Redo -> the pattern; (5) Save, fresh context Open -> identical document and volume; (6) feature editor Count 2 -> 17680, back to 3 -> 17520.
// An independent Python oracle (python3 -I, zero product imports) recomputes block - count * cut from the saved document's numbers (and checks the cuts are disjoint and inside the block) and compares with the Studio volume to 1e-6 relative.
// Root must freeze all sources first. Run from apps/cad-studio:
//   LINEAR_CUT_PATTERN_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/linear-cut-pattern-browser.mjs /absolute/artifacts
// Plumbing is in ./flow-helper.mjs. Not confirmed statically: the HUD dialog name 'Linear cut pattern' and its labels (Direction, Spacing, Count), the HUD refusal text, whether the number fields clamp a typed 1 / 0 / 65 (the driver tries
// several invalid values), the Selection panel 'Bounds' text, the outliner row selector, the palette ranking of the typed command name, and the Count field label in the feature editor.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const oracleSource = String.raw`"""Independent check of a linear cut pattern from the saved document. Product imports: zero."""
import json, sys
data = json.load(sys.stdin)
doc = data['doc']; studio = data['studioVolume']; count = data['expectCount']
nodes = doc['nodes']
pattern = [n for n in nodes if n['kind'] == 'linear-feature-pattern']
assert len(pattern) == 1, ('one pattern node', len(pattern))
p = pattern[0]
assert p['count'] == count and p['axis'] == 'x' and p['spacing'] == 16, p
assert nodes[-1] is p or nodes[-1] == p, 'the pattern is the last node'
# Block: nodes[0] rectangle sketch + nodes[1] extrude. Cut: nodes[2] sketch + nodes[3] extrude, moved by nodes[4] translate.
b, be = nodes[0], nodes[1]; c, ce, tr = nodes[2], nodes[3], nodes[4]
assert b['profile'] == 'rectangle' and c['profile'] == 'rectangle' and tr['kind'] == 'translate' and nodes[5]['kind'] == 'difference'
off = tr['offset']; assert all(isinstance(v, (int, float)) for v in off), off
bw, bd, bh = b['max'][0] - b['min'][0], b['max'][1] - b['min'][1], be['height']
cw, cd, ch = c['max'][0] - c['min'][0], c['max'][1] - c['min'][1], ce['height']
cx0 = c['min'][0] + off[0]; cy0 = c['min'][1] + off[1]
assert (bw, bd, bh) == (60, 30, 10) and (cw, cd, ch) == (4, 4, 10), ((bw, bd, bh), (cw, cd, ch))
sp = p['spacing']; assert sp >= cw, 'cuts are disjoint'
for k in range(count):
    x0 = cx0 + k * sp
    assert b['min'][0] <= x0 and x0 + cw <= b['max'][0], ('cut inside the block in x', k, x0)
assert b['min'][1] <= cy0 and cy0 + cd <= b['max'][1] and ch >= bh, 'through cut inside in y'
volume = bw * bd * bh - count * cw * cd * bh
assert abs(volume - studio) <= 1e-6 * volume, ('studio volume', volume, studio)
print(json.dumps({'status': 'PASS', 'volume': volume, 'studio': studio, 'count': count}, indent=2))
`;

const HUD_NAME = 'Linear cut pattern', KIND = 'linear-feature-pattern';
const f = await createFlow({ name: 'linear-cut-pattern', envFrozen: 'LINEAR_CUT_PATTERN_SOURCE_FROZEN', output: process.argv[2], qualification: 'LINEAR_CUT_PATTERN_CG2_ROW03', oracleSource,
  snapshotExtra: () => ({ selectionText: document.querySelector('[aria-label="Selection"]')?.textContent ?? null, hudStatus: document.querySelector('.hud .status')?.textContent ?? null }),
  initialFiles: ['apps/cad-studio/test/linear-cut-pattern-browser.mjs', 'apps/cad-studio/test/fixtures/linear-cut-pattern.bcad', 'packages/barocss-cad-model/src/app/commands.ts', 'packages/barocss-cad-model/src/app/editFields.ts',
    'packages/barocss-cad-model/src/chat/features.ts', 'packages/barocss-cad-model/src/engine/doc.ts'],
  requiredFrozen: ['packages/barocss-cad-model/src/app/commands.ts'],
  limits: ['One linear cut pattern on a 60 x 30 x 10 block along x only; y / z directions and other pattern kinds are not run.', 'Bounds are the Selection panel extents, not an independent B-rep topology oracle.',
    'Volume is the Studio mass read; the oracle recomputes it from the saved numbers (disjoint through cuts inside the block).', 'No live AI, no rendering matrix, no release acceptance.'] });

const fixture = resolve(import.meta.dirname, 'fixtures/linear-cut-pattern.bcad');
const hud = () => f.page.getByRole('dialog', { name: HUD_NAME, exact: true });
const volumeOf = async () => { const s = await f.bodies(); assert.equal(s.bodies.length, 1, 'one body'); return s.bodies[0].volume; };
const waitVolume = async expected => { await f.page.waitForFunction(v => { const s = window.__studioBodies?.(); return window.__studioFresh === true && s?.fresh && s.massReady && s.bodies.length === 1 && Math.abs(s.bodies[0].volume - v) <= 1e-6 * v; }, expected, { timeout: 60000 }); await f.ready(); };
const boundsText = () => f.page.evaluate(() => (document.querySelector('[aria-label="Selection"]')?.textContent ?? '').match(/Bounds\s*([\d.]+\s*×\s*[\d.]+\s*×\s*[\d.]+)/)?.[1]?.replace(/\s+/g, '') ?? null);
async function selectBody() {
  await f.ready(); const body = f.page.locator('.outliner .ol:not(.ol-step)').first();
  if (!(await f.page.evaluate(() => window.__studioSelection?.selection.bodies.length === 1))) await body.click();
  await f.page.waitForFunction(() => window.__studioSelection?.selection.bodies.length === 1);
  await f.page.waitForFunction(() => /Bounds\s*60\s*×\s*30\s*×\s*10/.test(document.querySelector('[aria-label="Selection"]')?.textContent ?? ''));
}
async function openCommand() { await selectBody(); await f.command(HUD_NAME); await hud().waitFor(); await f.page.waitForFunction(() => /preview|refused/.test(document.querySelector('.hud .status')?.textContent ?? ''), null, { timeout: 30000 }); }
const status = () => f.page.evaluate(() => document.querySelector('.hud .status')?.textContent ?? null);
const setField = (label, value) => hud().getByLabel(label, { exact: true }).fill(String(value));
async function setValid(spacing, count) {
  await hud().getByLabel('Direction', { exact: true }).selectOption('x'); await setField('Spacing', spacing); await setField('Count', count);
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 30000 });
}

await f.run(async () => {
  f.phase = 'public Open fixture'; await f.newPage(); await f.openFile(fixture, 6); await waitVolume(17840); await selectBody();
  const initial = await f.snapshot('01-open'); assert.equal(initial.doc.nodes.at(-1).kind, 'difference'); assert.equal(await boundsText(), '60×30×10');
  const nodesBefore = initial.doc.nodes, kindsBefore = nodesBefore.map(n => n.kind);

  f.phase = 'invalid values refused, nothing added'; await openCommand();
  const invalids = [['Count', '1', /whole number from 2 to 64/], ['Spacing', '0', /Spacing must be positive/], ['Count', '65', /whole number from 2 to 64/], ['Spacing', '-5', /Spacing must be positive/]];
  let refusedWith = null;
  for (const [label, value, expression] of invalids) {
    await setValid(16, 3); await setField(label, value);
    const refused = await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'refused', null, { timeout: 4000 }).then(() => true, () => false);
    f.report.observations.push({ label: 'invalid-try', field: label, value, refused, status: await status() });
    if (!refused) continue;
    const state = await f.snapshot('02-refused'); assert.deepEqual(state.doc, initial.doc, 'a refused preview adds nothing'); assert.match(state.hud, expression, 'the refusal text is shown');
    assert.equal(await hud().getByRole('button', { name: 'Apply', exact: true }).isDisabled(), true); assert.equal(state.bodies.bodies.length, 1); assert.ok(Math.abs(state.bodies.bodies[0].volume - 17840) <= 1e-6 * 17840);
    refusedWith = { label, value }; break;
  }
  assert.ok(refusedWith, 'at least one invalid value is refused with its text'); f.report.observations.push({ label: 'refused-with', ...refusedWith });
  await hud().getByRole('button', { name: 'Cancel', exact: true }).click(); await hud().waitFor({ state: 'hidden' }); await f.ready();
  assert.deepEqual((await f.snapshot('02b-cancelled')).doc, initial.doc);

  f.phase = 'valid preview then Apply'; await openCommand(); await setValid(16, 3);
  const shown = await f.snapshot('03-preview'); assert.deepEqual(shown.doc, initial.doc, 'a preview leaves the accepted document unchanged');
  await hud().getByRole('button', { name: 'Apply', exact: true }).click(); await hud().waitFor({ state: 'hidden' }); await f.changed(initial.doc); await waitVolume(17520);
  await selectBody(); const applied = await f.snapshot('04-applied'); const nodes = applied.doc.nodes, pattern = nodes.at(-1);
  assert.equal(pattern.kind, KIND); assert.deepEqual(pattern.parent, { node: nodesBefore.length - 1, side: 'solid' });
  assert.equal(pattern.axis, 'x'); assert.equal(pattern.spacing, 16); assert.equal(pattern.count, 3);
  assert.equal(nodes.length, nodesBefore.length + 1, 'exactly one new node'); assert.equal(nodes.filter(n => n.kind === KIND).length, 1);
  assert.deepEqual(nodes.slice(0, -1), nodesBefore, 'the original block and cut nodes are unchanged (no stock copies)');
  assert.deepEqual(nodes.slice(0, -1).map(n => n.kind), kindsBefore); assert.equal(nodes.filter(n => n.kind === 'difference').length, 1); assert.equal(nodes.filter(n => n.kind === 'extrude').length, 2);
  assert.deepEqual(applied.doc.parameters, initial.doc.parameters); assert.equal(await boundsText(), '60×30×10', 'the outline is unchanged');
  await f.runOracle({ doc: applied.doc, studioVolume: await volumeOf(), expectCount: 3 }, '04');

  f.phase = 'Undo and Redo'; await f.undo(); await f.same(initial.doc); await waitVolume(17840); await f.snapshot('05-undo');
  await f.redo(); await f.same(applied.doc); await waitVolume(17520); await f.snapshot('06-redo');

  f.phase = 'Save and fresh Open'; const saved = await f.save('accepted'); assert.deepEqual(saved.doc, applied.doc);
  await f.freshOpen(saved.file, applied.doc, '07-fresh-open'); await waitVolume(17520); await selectBody(); assert.equal(await boundsText(), '60×30×10');
  await f.runOracle({ doc: await f.doc(), studioVolume: await volumeOf(), expectCount: 3 }, '07');

  f.phase = 'feature editor count 2 then 3'; const index = applied.doc.nodes.length - 1;
  for (const [count, volume, label] of [[2, 60 * 30 * 10 - 2 * 160, '08-count-2'], [3, 60 * 30 * 10 - 3 * 160, '09-count-3']]) {
    const before = await f.doc(); await f.openFeatureEditor(index, label);
    const field = f.editor().getByLabel('Count', { exact: true }); assert.equal(await field.inputValue(), String(before.nodes[index].count)); await field.fill(String(count));
    const state = await f.applyEditor(before, label); await waitVolume(volume);
    const node = state.doc.nodes[index]; assert.equal(node.count, count); assert.equal(node.id, before.nodes[index].id); assert.deepEqual(state.doc.nodes.slice(0, index), before.nodes.slice(0, index));
    const { count: oldCount, ...oldRest } = before.nodes[index], { count: newCount, ...newRest } = node; assert.notEqual(oldCount, newCount); assert.deepEqual(newRest, oldRest);
    await f.runOracle({ doc: state.doc, studioVolume: await volumeOf(), expectCount: count }, label.slice(0, 2));
  }
  assert.deepEqual(await f.doc(), applied.doc, 'back to count 3 equals the accepted pattern document');
});

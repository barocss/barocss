// Roadmap 10 ⑥ (#2251): assembly instruction steps in the actual Studio. Fixture apps/cad-studio/test/fixtures/assembly-steps.bcad: a base plate and four occurrences of three
// definitions — Block 1 and Block 2 (one "block"), Post, Cap (resting on the post). Real clicks and keys: the palette "Assembly steps"; the outliner rows; New step from selection,
// Add selected parts to this step, the step name box (Enter), Step explode, Capture view; Prev / Next / a step row / Go to its step; the Instance panel's Remove (refused);
// Undo / Redo, Save, a fresh Open, Close steps.
// Checks: three steps (Blocks: Block 1 + Block 2; Post; Cap) built through the panel; Prev / Next / a direct jump give the same step (position and parts); Go to its step from
// Block 2 lands on step 1; removing Post, which a step names, is refused in words and changes nothing. The independent Python oracle (python3 -I, zero product imports) reads the
// stored steps and checks the steps are presentation only: every instance (placement, definition) and the base part are as opened. What the view hides, highlights and
// explodes is judged by the root from the screenshots.
// Root must freeze all sources first. Run from apps/cad-studio:
//   ASSEMBLY_STEPS_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/assembly-steps-browser.mjs /absolute/artifacts
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const oracleSource = String.raw`"""Three instruction steps over four occurrences, presentation only. Product imports: zero."""
import json, sys
d = json.load(sys.stdin); doc = d['doc']; original = d['original']; want = d['want']
steps = doc.get('assemblySteps') or []
assert [s['name'] for s in steps] == [w['name'] for w in want], [s['name'] for s in steps]
for s, w in zip(steps, want):
    assert s['add'] == w['add'], (s['name'], s['add'], w['add'])
    assert (s.get('explode') or 0) == w['explode'], (s['name'], s.get('explode'))
    if w['view']:
        v = s['view']; assert all(len(v[k]) == 3 and all(isinstance(x, (int, float)) for x in v[k]) for k in ('eye', 'target', 'up')), v
        assert v['eye'] != v['target'], v
    else: assert 'view' not in s, (s['name'], s.get('view'))
ids = [p for s in steps for p in s['add']]; assert len(ids) == len(set(ids)), ('a part in one step only', ids)
assert doc['instances'] == original['instances'], 'steps never move, re-define or re-order a part'
assert doc['nodes'] == original['nodes'] and doc.get('mates') == original.get('mates'), 'the base part and mates untouched'
print(json.dumps({'status': 'PASS', 'productImports': 0, 'steps': [[s['name'], s['add']] for s in steps]}))
`;
const fixture = join(import.meta.dirname, 'fixtures', 'assembly-steps.bcad');
const f = await createFlow({ name: 'assembly-steps', envFrozen: 'ASSEMBLY_STEPS_SOURCE_FROZEN', output: process.argv[2], qualification: 'ASSEMBLY_STEPS', oracleSource,
  limits: ['Hidden / highlighted / exploded parts and the recommended view are judged from screenshots by the root (no pixel oracle).', 'Top-level occurrences only; no chat tool (budget full).'],
  initialFiles: ['apps/cad-studio/test/assembly-steps-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/test/fixtures/assembly-steps.bcad', 'apps/cad-studio/src/ui/AssemblyStepsPanel.tsx',
    'apps/cad-studio/src/app/assemblySteps.ts', 'packages/barocss-cad-model/src/assembly/steps.ts'],
  requiredFrozen: ['packages/barocss-cad-model/src/assembly/steps.ts'] });

const panel = () => f.page.getByRole('complementary', { name: 'Assembly steps panel', exact: true });
const button = name => panel().getByRole('button', { name, exact: true });
const pick = async name => { await f.page.locator('.ol.instance:not(.nested)').filter({ hasText: name }).first().click(); await f.page.getByRole('complementary', { name: 'Instance', exact: true }).waitFor(); };
const shown = async () => ({ position: (await panel().getByRole('status', { name: 'Step position', exact: true }).textContent()).trim(),
  parts: await panel().getByRole('group', { name: 'Parts of this step', exact: true }).locator('[data-part]').evaluateAll(n => n.map(x => x.getAttribute('data-part'))) });
const gizmos = () => f.page.locator('g.gizmo-arrow, g.gizmo-handle').count();
// (The button's text holds its icon name too: read the label without the icon.)
const explodeLabel = () => f.page.getByRole('button', { name: 'Explode', exact: true }).evaluate(b => [...b.childNodes].filter(n => !(n.nodeType === 1 && n.classList.contains('ms'))).map(n => n.textContent).join('').trim());
async function edit(act) { const before = await f.doc(); await act(); await f.changed(before); return f.doc(); }
const want = (explode, view) => [{ name: 'Blocks', add: ['b1', 'b2'], explode: 0, view: false }, { name: 'Post', add: ['post'], explode: 0, view }, { name: 'Cap', add: ['cap'], explode, view: false }];

await f.run(async () => {
  await f.newPage(); await f.openFile(fixture, 2); const original = await f.doc(); await f.snapshot('01-opened');

  assert.equal(await explodeLabel(), 'Explode', 'explode off before the steps');
  f.phase = 'build three steps'; await f.command('Assembly steps'); await panel().waitFor();
  await pick('Block 1'); await edit(() => button('New step from selection').click());
  const name = panel().getByLabel('Step name', { exact: true }); await name.fill('Blocks'); await edit(() => name.press('Enter'));
  await pick('Block 2'); await edit(() => button('Add selected parts to this step').click());
  assert.deepEqual(await shown(), { position: 'Step 1 of 1', parts: ['b1', 'b2'] });
  await pick('Post'); await edit(() => button('New step from selection').click());
  await name.fill('Post'); await edit(() => name.press('Enter'));
  await edit(() => button('Capture view').click());
  await pick('Cap'); await edit(() => button('New step from selection').click());
  await name.fill('Cap'); await edit(() => name.press('Enter'));
  const flat = await f.doc(); await f.runOracle({ doc: flat, original, want: want(0, true) }, '02-three-steps');
  const exploded = await edit(() => panel().getByLabel('Step explode', { exact: true }).selectOption('1'));
  await f.runOracle({ doc: exploded, original, want: want(1, true) }, '03-cap-exploded'); await f.ready(); await f.snapshot('03-step3-cap-exploded');

  f.phase = 'navigate'; const seen = {};
  await button('Previous step').click(); seen.prev2 = await shown(); await f.snapshot('04-step2');
  await button('Previous step').click(); seen.prev1 = await shown(); await f.snapshot('05-step1');
  // (Cap, still selected, waits at step 1: hidden, so no gizmo and no outline for it.)
  assert.equal(await gizmos(), 0, 'no gizmo for a hidden waiting part');
  await button('Next step').click(); seen.next2 = await shown();
  await button('Go to step 3: Cap').click(); seen.jump3 = await shown();
  // (Step 3 is exploded, and an exploded view shows no gizmo at all: only the explode label is checked here.)
  assert.equal(await explodeLabel(), 'Explode ×1', 'the step explode is shown');
  await button('Go to step 2: Post').click(); seen.jump2 = await shown();
  await pick('Cap'); assert.equal(await gizmos(), 0, 'Cap waits at step 2: no gizmo'); await pick('Post'); assert.ok(await gizmos() > 0, 'Post shown at step 2: its gizmo is there');
  f.report.observations.push({ seen });
  assert.deepEqual(seen.prev2, { position: 'Step 2 of 3', parts: ['post'] }); assert.deepEqual(seen.prev1, { position: 'Step 1 of 3', parts: ['b1', 'b2'] });
  assert.deepEqual(seen.next2, seen.prev2, 'Next and Prev reach the same step 2'); assert.deepEqual(seen.jump2, seen.prev2, 'a direct jump reaches the same step 2');
  assert.deepEqual(seen.jump3, { position: 'Step 3 of 3', parts: ['cap'] });
  await f.same(exploded); // (navigating is the session's: the document never changes)

  f.phase = 'go to its step'; await pick('Block 2'); await button('Go to its step').click();
  assert.deepEqual(await shown(), { position: 'Step 1 of 3', parts: ['b1', 'b2'] });

  f.phase = 'remove refused'; await pick('Post');
  await f.page.getByRole('complementary', { name: 'Instance', exact: true }).getByRole('button', { name: 'Remove', exact: true }).click();
  const notice = await f.waitToast(/step/i); f.report.observations.push({ removeRefused: notice }); await f.same(exploded); await f.dismissToasts();

  f.phase = 'undo, redo'; await f.undo(); await f.same(flat); await f.redo(); await f.same(exploded);
  f.phase = 'save, fresh open'; const saved = await f.save('assembly-steps'); assert.deepEqual(saved.doc, exploded);
  await f.freshOpen(saved.file, exploded, '06-fresh-open'); await f.runOracle({ doc: await f.doc(), original, want: want(1, true) }, '06-fresh-open');

  f.phase = 'close steps'; await f.command('Assembly steps'); await panel().waitFor(); await f.ready(); await f.snapshot('07-reopened');
  await button('Close steps').click(); await panel().waitFor({ state: 'hidden' }); await f.ready(); await f.snapshot('08-closed-all-parts');
  assert.equal(await explodeLabel(), 'Explode', 'closing the steps puts the explode back'); await f.same(exploded);
});

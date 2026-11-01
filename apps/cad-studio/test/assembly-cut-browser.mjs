// Roadmap 10 ⑤ (#2180): a cut across placed parts in assembly context, in the actual Studio. Fixture apps/cad-studio/test/fixtures/assembly-cut.bcad: a base plate and two
// occurrences of one definition "plate" (60 x 40 x 5): Plate 1 at the origin, Plate 2 turned 90° about Z at (50, -10, 5), lying on Plate 1 so that the point (30, 20) is over both.
// Real clicks and keys: the outliner rows, the command palette "Assembly cut", the HUD's radius and centre boxes, Add selected, Cut; the Browser's cut row (edit), a part chip's ×,
// Apply; Undo / Redo, Save, a fresh Open; the cut row's delete.
// The independent Python oracle (python3 -I, zero product imports) checks the stored cut and, from a product read of each occurrence's placed document (the bundled inspector:
// placedDoc + evaluateDoc volumes), the volumes by independent arithmetic: 60·40·5 = 12000 whole, 12000 − π·4²·5 with the Ø8 hole; the definition is never changed.
// Root must freeze all sources first. Run from apps/cad-studio:
//   ASSEMBLY_CUT_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/assembly-cut-browser.mjs /absolute/artifacts
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createFlow } from './flow-helper.mjs';

const oracleSource = String.raw`"""Plates cut by the assembly's Ø8 hole through (30, 20): volumes by arithmetic. Product imports: zero."""
import json, math, sys
d = json.load(sys.stdin); doc = d['doc']; vol = d['volumes']; cut = set(d['cut']); original = d['original']
whole, holed = 60 * 40 * 5, 60 * 40 * 5 - math.pi * 4 * 4 * 5
for k in ('p1', 'p2'):
    want = holed if k in cut else whole
    assert abs(vol[k] - want) <= 1e-6 * whole, (k, vol[k], want)
cuts = doc.get('assemblyCuts') or []
if cut:
    assert len(cuts) == 1, cuts
    c = cuts[0]
    assert c['profile'] == {'kind': 'circle', 'radius': 4}, c['profile']
    assert c['at'] == [30, 20, 10] and c['dir'] == [0, 0, -1] and c['depth'] == 'through', c
    assert sorted(c['targets']) == sorted(cut), (c['targets'], cut)
else: assert not cuts, cuts
was = {i['id']: i for i in original['instances']}
for i in doc['instances']:
    assert i['doc'] == was[i['id']]['doc'], (i['id'], 'the definition never changes')
    assert i['position'] == was[i['id']]['position'] and i['rotation'] == was[i['id']]['rotation'], (i['id'], 'placement kept')
assert doc['nodes'] == original['nodes'], 'the base part untouched'
print(json.dumps({'status': 'PASS', 'productImports': 0, 'cut': sorted(cut), 'volumes': vol, 'holed': holed}))
`;
const fixture = join(import.meta.dirname, 'fixtures', 'assembly-cut.bcad');
const f = await createFlow({ name: 'assembly-cut', envFrozen: 'ASSEMBLY_CUT_SOURCE_FROZEN', output: process.argv[2], qualification: 'ASSEMBLY_CUT', oracleSource,
  inspectorSource: `import {readFileSync} from 'node:fs';import {placedDoc} from '../../packages/barocss-cad-model/src/engine/doc.ts';import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8'));const out:any={};for(const i of doc.instances){const r:any=evaluateDoc(placedDoc(i,doc),1);if(!r.ok)throw new Error(JSON.stringify(r.error));out[i.id]=r.bodies.reduce((t:number,b:any)=>t+(b.volume??0),0);}console.log(JSON.stringify(out));`,
  limits: ['One circular through cut on two occurrences of one definition (one turned 90°); volumes are a product read (placedDoc + evaluateDoc) checked by independent arithmetic; the viewport is judged from screenshots.'],
  initialFiles: ['apps/cad-studio/test/assembly-cut-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/test/fixtures/assembly-cut.bcad', 'apps/cad-studio/src/ui/AssemblyCutHud.tsx',
    'apps/cad-studio/src/app/assemblyCutDraft.ts', 'packages/barocss-cad-model/src/assembly/cuts.ts', 'packages/barocss-cad-model/src/engine/assemblyCut.ts', 'packages/barocss-cad-model/src/engine/doc.ts'],
  requiredFrozen: ['packages/barocss-cad-model/src/engine/assemblyCut.ts'] });

const hud = () => f.page.getByRole('complementary', { name: 'Assembly cut', exact: true });
const pick = async name => { await f.page.locator('.ol.instance:not(.nested)').filter({ hasText: name }).first().click(); await f.page.getByRole('complementary', { name: 'Instance', exact: true }).waitFor(); };
const chips = () => hud().getByRole('group', { name: 'Parts to cut', exact: true }).locator('[data-target]').evaluateAll(n => n.map(x => x.getAttribute('data-target')));
async function check(label, original, cut) {
  const doc = await f.doc(), file = join(f.output, `${label}-doc.bcad`); await writeFile(file, JSON.stringify(doc));
  const run = spawnSync(process.execPath, [f.inspector, file], { encoding: 'utf8', maxBuffer: 1 << 24 }); assert.equal(run.status, 0, run.stderr);
  await f.runOracle({ doc, original, volumes: JSON.parse(run.stdout), cut }, label); return doc;
}

await f.run(async () => {
  await f.newPage(); await f.openFile(fixture, 2); const original = await f.doc(); await f.snapshot('01-opened'); await check('01-opened', original, []);

  f.phase = 'new cut on both plates'; await pick('Plate 1');
  await f.command('Assembly cut'); await hud().waitFor();
  assert.deepEqual(await chips(), ['p1'], 'the selected part is the first target');
  await hud().getByLabel('Radius mm', { exact: true }).fill('4');
  await hud().getByLabel('Centre X', { exact: true }).fill('30'); await hud().getByLabel('Centre Y', { exact: true }).fill('20'); await hud().getByLabel('Centre Z', { exact: true }).fill('10');
  assert.equal(await hud().getByLabel('Cut direction', { exact: true }).inputValue(), '-Z'); assert.ok(await hud().getByLabel('Through', { exact: true }).isChecked());
  await pick('Plate 2'); await hud().getByRole('button', { name: 'Add selected', exact: true }).click();
  assert.deepEqual(await chips(), ['p1', 'p2'], 'Plate 2 added'); await f.ready(); await f.snapshot('02-preview');
  await f.same(original); // (nothing applied while previewing)
  await hud().getByRole('button', { name: 'Cut', exact: true }).click(); await f.changed(original); await hud().waitFor({ state: 'hidden' }); await f.ready();
  const both = await check('03-both-cut', original, ['p1', 'p2']); await f.snapshot('03-both-cut');
  // (Nothing selected, so no gizmo stands over the hole: the root reads the hole through both plates from this one.)
  await f.page.keyboard.press('Escape'); await f.page.waitForTimeout(300); await f.snapshot('03b-both-cut-clear');

  f.phase = 'edit: Plate 2 only'; await f.page.locator('button[aria-label^="Edit cut"]').first().click(); await hud().waitFor();
  await hud().getByRole('button', { name: 'Do not cut Plate 1', exact: true }).click(); assert.deepEqual(await chips(), ['p2']);
  await hud().getByRole('button', { name: 'Apply', exact: true }).click(); await f.changed(both); await hud().waitFor({ state: 'hidden' }); await f.ready();
  const one = await check('04-plate2-only', original, ['p2']); await f.snapshot('04-plate2-only');

  f.phase = 'undo, redo'; await f.undo(); await f.same(both); await f.redo(); await f.same(one);
  f.phase = 'save, fresh open'; const saved = await f.save('assembly-cut'); assert.deepEqual(saved.doc, one);
  await f.freshOpen(saved.file, one, '05-fresh-open'); await check('05-fresh-open', original, ['p2']);

  f.phase = 'delete the cut'; await f.page.locator('button[aria-label^="Delete cut"]').first().click(); await f.changed(one); await f.ready();
  await check('06-deleted', original, []); await f.snapshot('06-deleted');
});

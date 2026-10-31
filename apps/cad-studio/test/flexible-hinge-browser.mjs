// Roadmap 10 ④ (RS7.4): a flexible sub-assembly occurrence keeps its own joint state, in the actual Studio. Fixture apps/cad-studio/test/fixtures/flexible-hinge.bcad: a base
// plate and two occurrences of one hinge sub-assembly (definition "hinge": a 100 x 40 x 10 plate with a Ø10 hole at (20, 20) and a 60 x 20 x 5 lid whose hole is concentric with it
// and whose bottom sits on the plate's top — one turning joint base~lid about Z through (20, 20)). Real clicks and keys: the outliner row of Hinge 2, the panel's Joint base~lid box
// (90, Enter), Undo / Redo, Save, a fresh Open, Reset.
// The independent Python oracle (python3 -I, zero product imports) checks the stored joints (90° stored as π/2 on Hinge 2 only) and, from a product read of each occurrence's posed
// sub-assembly (the bundled inspector: bodyDocOf), that Hinge 2's lid is the saved lid turned 90° about Z through (20, 20) and Hinge 1's lid is unmoved.
// Root must freeze all sources first. Run from apps/cad-studio:
//   FLEX_HINGE_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/flexible-hinge-browser.mjs /absolute/artifacts
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createFlow } from './flow-helper.mjs';

const oracleSource = String.raw`"""Two hinge occurrences: Hinge 2 turned 90 degrees, Hinge 1 as saved. Product imports: zero."""
import json, math, sys
d = json.load(sys.stdin); doc = d['doc']; posed = d['posed']; want = d['degrees']
inst = {i['id']: i for i in doc['instances']}
j1, j2 = inst['sub1'].get('joints'), inst['sub2'].get('joints')
if want == 0: assert not j2 or abs(j2.get('base~lid', 0)) < 1e-12, ('Hinge 2 at the saved pose', j2)
else: assert abs(j2['base~lid'] - math.radians(want)) < 1e-12, ('Hinge 2 stored in radians', j2)
assert not j1, ('Hinge 1 keeps no joints', j1)
saved = next(i for i in inst['sub2']['doc']['instances'] if i['id'] == 'lid')
c, s = math.cos(math.radians(want)), math.sin(math.radians(want))
px, py = saved['position'][0] - 20, saved['position'][1] - 20
expect = [20 + c * px - s * py, 20 + s * px + c * py, saved['position'][2]]
lid2, lid1 = posed['sub2'], posed['sub1']
assert max(abs(lid2['position'][k] - expect[k]) for k in range(3)) <= 1e-6, ('Hinge 2 lid', lid2['position'], expect)
assert abs(((lid2['rotation'][2] - want + 180) % 360) - 180) <= 1e-6 and abs(lid2['rotation'][0]) <= 1e-9 and abs(lid2['rotation'][1]) <= 1e-9, ('Hinge 2 lid turn', lid2['rotation'])
assert lid1['position'] == saved['position'] and lid1['rotation'] == saved['rotation'], ('Hinge 1 lid as saved', lid1)
print(json.dumps({'status': 'PASS', 'productImports': 0, 'degrees': want, 'lid2': lid2, 'expected': expect}))
`;
const fixture = join(import.meta.dirname, 'fixtures', 'flexible-hinge.bcad');
const f = await createFlow({ name: 'flex-hinge', envFrozen: 'FLEX_HINGE_SOURCE_FROZEN', output: process.argv[2], qualification: 'FLEXIBLE_SUBASSEMBLY', oracleSource,
  limits: ['One revolute joint in one sub-assembly level; the posed lid placement is a product read (bodyDocOf) checked against independent rotation arithmetic; the viewport is judged from screenshots.'],
  inspectorSource: `import {readFileSync} from 'node:fs';import {bodyDocOf} from '../../packages/barocss-cad-model/src/assembly/flexible.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8'));const out:any={};for(const i of doc.instances){const l=bodyDocOf(i).instances.find((x:any)=>x.id==='lid');out[i.id]={position:l.position,rotation:l.rotation};}console.log(JSON.stringify(out));`,
  initialFiles: ['apps/cad-studio/test/flexible-hinge-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/test/fixtures/flexible-hinge.bcad', 'apps/cad-studio/src/ui/InstanceJoints.tsx',
    'packages/barocss-cad-model/src/assembly/flexible.ts', 'packages/barocss-cad-model/src/engine/doc.ts'],
  requiredFrozen: ['packages/barocss-cad-model/src/assembly/flexible.ts'] });

async function check(label, degrees) {
  const doc = await f.doc(), file = join(f.output, `${label}-doc.bcad`); await writeFile(file, JSON.stringify(doc));
  const run = spawnSync(process.execPath, [f.inspector, file], { encoding: 'utf8' }); assert.equal(run.status, 0, run.stderr);
  await f.runOracle({ doc, posed: JSON.parse(run.stdout), degrees }, label); return doc;
}
const pick = async name => { await f.page.locator('.ol.instance:not(.nested)').filter({ hasText: name }).first().click(); await f.page.getByRole('complementary', { name: 'Instance', exact: true }).waitFor(); };

await f.run(async () => {
  await f.newPage(); await f.openFile(fixture, 2); const original = await f.doc(); await f.snapshot('01-opened'); await check('01-opened', 0);

  f.phase = 'Hinge 2 to 90 degrees'; await pick('Hinge 2');
  const group = f.page.getByRole('group', { name: 'Instance joints', exact: true }); await group.waitFor();
  const box = group.getByLabel('Joint base~lid'); await box.fill('90'); await box.press('Enter');
  await f.changed(original); const turned = await check('02-hinge2-90', 90); await f.snapshot('02-hinge2-90');

  f.phase = 'undo, redo'; await f.undo(); await f.same(original); await f.redo(); await f.same(turned);
  f.phase = 'save, fresh open'; const saved = await f.save('flex-hinge'); assert.deepEqual(saved.doc, turned);
  await f.freshOpen(saved.file, turned, '03-fresh-open'); await check('03-fresh-open', 90);

  f.phase = 'reset'; await pick('Hinge 2');
  await f.page.getByRole('group', { name: 'Instance joints', exact: true }).getByRole('button', { name: 'Reset', exact: true }).click();
  await f.changed(turned); await check('04-reset', 0); await f.snapshot('04-reset');
});

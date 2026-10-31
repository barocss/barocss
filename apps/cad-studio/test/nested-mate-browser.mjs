// Roadmap 10 ②a (#2180): a mate to a part inside a sub-assembly keeps pointing at that part when the sub-assembly changes. Fixture apps/cad-studio/test/fixtures/nested-mate.bcad:
// a base plate; "Sub" (sub1, grounded, shared definition subdef Rev A) holding Block A (p1, 10 mm cube at 0) and Block B (p2, 10 mm cube at X 20); "Pin" (4 x 4 x 20) free.
// In the actual Studio: Mates › Add mate, Block B's top face inside Sub (the face that stays), then Pin's bottom (the part that moves) — the dev hook __studioPickInstanceFace clicks a
// placed face by its folded name, which the driver works out with the product's flatFaceOf (a product read: what is checked is the stored mate and the geometry). Then Sub's
// New revision… with nested-mate-rev-b.bcad (Block A gains a hole, so Block B's folded names move; Block B rises 5 mm) and Accept: Pin must follow Block B to z 15.
// The independent Python oracle (python3 -I, zero product imports) computes Block B's top from the stored sub-assembly and checks Pin's bottom on it and the mate's stored path.
// Root must freeze all sources first. Run from apps/cad-studio:
//   NESTED_MATE_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/nested-mate-browser.mjs /absolute/artifacts
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createFlow } from './flow-helper.mjs';

const oracleSource = String.raw`"""Pin's bottom on Block B's top inside Sub, from the stored document alone (translations only; no rotations in this fixture). Product imports: zero."""
import json, sys
d = json.load(sys.stdin)['doc']
inst = {i['id']: i for i in d['instances']}
sub, pin = inst['sub1'], inst['pin']
assert sub['rotation'] == [0, 0, 0] and pin['rotation'] == [0, 0, 0]
b = next(i for i in sub['doc']['instances'] if i['id'] == 'p2')
assert b['rotation'] == [0, 0, 0]
height = b['doc']['nodes'][1]['height']
top = sub['position'][2] + b['position'][2] + height
mates = d.get('mates', [])
assert len(mates) == 1, mates
m = mates[0]
assert m['kind'] == 'coincident' and m['a'] == {'part': 'sub1/p2', 'face': 'n1.top'} and m['b']['part'] == 'pin' and m['b']['face'] == 'n1.bottom', ('stored mate', m)
assert abs(pin['position'][2] - top) <= 1e-9, ('Pin bottom on Block B top', pin['position'][2], top)
print(json.dumps({'status': 'PASS', 'productImports': 0, 'blockBTop': top, 'pinBottom': pin['position'][2]}))
`;
const fixture = join(import.meta.dirname, 'fixtures', 'nested-mate.bcad'), revB = join(import.meta.dirname, 'fixtures', 'nested-mate-rev-b.bcad');
const f = await createFlow({ name: 'nested-mate', envFrozen: 'NESTED_MATE_SOURCE_FROZEN', output: process.argv[2], qualification: 'NESTED_MATE_REFERENCE', oracleSource,
  limits: ['The face is clicked through the dev hook by its folded name (canvas clicks are not reproducible); the folded name comes from the product\'s flatFaceOf.', 'Translations only (no rotated parts).'],
  initialFiles: ['apps/cad-studio/test/nested-mate-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/test/fixtures/nested-mate.bcad', 'apps/cad-studio/test/fixtures/nested-mate-rev-b.bcad',
    'apps/cad-studio/src/assembly/useAssembly.ts', 'packages/barocss-cad-model/src/engine/occurrences.ts', 'packages/barocss-cad-model/src/engine/flatten.ts'],
  requiredFrozen: ['packages/barocss-cad-model/src/engine/occurrences.ts'] });

// The folded name of Block B's top inside Sub, before and after the revision (product read through a small bundle).
async function foldedNames() {
  const src = `import {readFileSync} from 'node:fs';import {flatFaceOf} from '${resolve(f.repo, 'packages/barocss-cad-model/src/engine/occurrences.ts')}';
const a=JSON.parse(readFileSync(process.argv[2],'utf8')),b=JSON.parse(readFileSync(process.argv[3],'utf8')),sub=a.instances.find(i=>i.id==='sub1').doc;
console.log(JSON.stringify({before:flatFaceOf(sub,['p2'],'n1.top'),after:flatFaceOf(b,['p2'],'n1.top')}));`;
  const out = join(f.output, 'folded-names.mjs');
  await build({ stdin: { contents: src, resolveDir: f.app, sourcefile: 'folded-names.ts', loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: out, logLevel: 'error' });
  const run = spawnSync(process.execPath, [out, fixture, revB], { encoding: 'utf8' }); assert.equal(run.status, 0, run.stderr); return JSON.parse(run.stdout);
}

await f.run(async () => {
  const names = await foldedNames(); f.report.observations.push({ foldedNames: names });
  assert.notEqual(names.before, names.after, 'the revision moves Block B\'s folded name (the old positional reference would break)');
  await f.newPage(); await f.openFile(fixture, 2); const original = await f.doc(); await f.snapshot('01-opened');

  f.phase = 'mate to a part inside the sub-assembly';
  await f.page.locator('.ol.instance').nth(1).click();
  await f.page.locator('[aria-label="Mates"] button:text-is("Add mate")').click();
  await f.page.waitForFunction(() => typeof window.__studioPickInstanceFace === 'function');
  assert.ok(await f.page.evaluate(n => window.__studioPickInstanceFace('sub1', n), names.before), 'Block B top picked');
  assert.ok(await f.page.evaluate(() => window.__studioPickInstanceFace('pin', 'n1.bottom')), 'Pin bottom picked');
  await f.page.waitForFunction(() => window.__studioDoc.mates?.length === 1, null, { timeout: 30000 }); await f.ready();
  const mated = await f.doc(); await f.snapshot('02-mated');
  assert.deepEqual(mated.mates[0].a, { part: 'sub1/p2', face: 'n1.top' }, 'kept by the path and Block B\'s own face name');
  await f.runOracle({ doc: mated }, '02-mated'); assert.equal(mated.instances.find(i => i.id === 'pin').position[2], 10);

  f.phase = 'new revision of Sub';
  await f.page.locator('.ol.instance').filter({ hasText: 'Sub' }).first().click();
  await f.page.setInputFiles('input[aria-label="New revision file"]', revB);
  await f.page.getByRole('button', { name: /^Accept Rev/ }).click();
  await f.page.waitForFunction(() => window.__studioDoc.instances.find(i => i.id === 'pin').position[2] === 15, null, { timeout: 30000 }); await f.ready();
  const after = await f.doc(); await f.snapshot('03-revision-accepted');
  assert.deepEqual(after.mates[0].a, { part: 'sub1/p2', face: 'n1.top' }, 'the mate is not re-aimed');
  await f.runOracle({ doc: after }, '03-revision-accepted');
  assert.equal(await f.page.locator('[aria-label="Mates"] [role="alert"]').count(), 0, 'no mate problem shown');

  f.phase = 'undo, redo, save, fresh open';
  // (Offering the revision and accepting it are two steps.)
  await f.undo(); await f.undo(); await f.same(mated); await f.redo(); await f.redo(); await f.same(after);
  const saved = await f.save('nested-mate'); await f.freshOpen(saved.file, after, '04-fresh-open'); await f.runOracle({ doc: after }, '04-fresh-open');
  assert.notDeepEqual(original, after);
});

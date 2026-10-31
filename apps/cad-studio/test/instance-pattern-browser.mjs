// Roadmap 10 ③ (#2180, RS7.4): a part instance repeated along a line and about an axis, in the actual Studio. Fixture apps/cad-studio/test/fixtures/instance-pattern.bcad:
// a 160 x 60 x 4 base plate and one 10 mm cube instance "Cube" at the origin. Real clicks and keys in the outliner, the instance panel, the BOM panel and the toolbar.
// Steps: Pattern… linear 4 x 25 mm along X; an occurrence's panel (no placement boxes) and Skip; Restore; count 5; the seed moved by its X box carries every occurrence;
// Undo / Redo; Remove of the seed refused; skip again, Save and a fresh Open keep the skip; the BOM shows the cube's occurrences; the linear pattern deleted and a circular one
// (4 x 90° about Z through the origin, the seed moved to X 50) made. The independent Python oracle (python3 -I, zero product imports) recomputes every occurrence's placement
// from the stored pattern and the seed and checks ids, names, the shared part id and the driven flag.
// Root must freeze all sources first. Run from apps/cad-studio:
//   INSTANCE_PATTERN_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/instance-pattern-browser.mjs /absolute/artifacts
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const oracleSource = String.raw`"""Instance pattern placements, independent of the product: occurrence k of a linear pattern is the seed moved k * spacing along unit(dir); of a circular
pattern the seed's placement turned k * angle about the axis through origin (rotation matrix from the X-then-Y-then-Z degrees convention, back to those angles)."""
import json, math, sys
data = json.load(sys.stdin); doc = data['doc']
insts = doc.get('instances', []); pats = doc.get('instancePatterns', [])
assert len(pats) == data['patterns'], ('pattern count', len(pats))
def rx(a): c, s = math.cos(a), math.sin(a); return [[1,0,0],[0,c,-s],[0,s,c]]
def ry(a): c, s = math.cos(a), math.sin(a); return [[c,0,s],[0,1,0],[-s,0,c]]
def rz(a): c, s = math.cos(a), math.sin(a); return [[c,-s,0],[s,c,0],[0,0,1]]
def mul(a, b): return [[sum(a[i][k]*b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
def app(m, v): return [sum(m[i][k]*v[k] for k in range(3)) for i in range(3)]
def euler(r): return mul(rz(math.radians(r[2])), mul(ry(math.radians(r[1])), rx(math.radians(r[0]))))
def about(axis, a):
    n = math.sqrt(sum(x*x for x in axis)); x, y, z = (v / n for v in axis); c, s, t = math.cos(a), math.sin(a), 1 - math.cos(a)
    return [[t*x*x+c, t*x*y-s*z, t*x*z+s*y], [t*x*y+s*z, t*y*y+c, t*y*z-s*x], [t*x*z-s*y, t*y*z+s*x, t*z*z+c]]
checked = 0
for p in pats:
    seed = next(i for i in insts if i['id'] == p['seed'])
    assert seed.get('part') and seed['part'].get('id'), ('seed has a shared definition', seed)
    occ = [i for i in insts if i.get('pattern', {}).get('id') == p['id']]
    want = [k for k in range(1, p['count']) if k not in p.get('skip', [])]
    assert sorted(i['pattern']['k'] for i in occ) == want, ('occurrences', [i['pattern']['k'] for i in occ], want)
    for i in occ:
        k = i['pattern']['k']
        assert i['id'] == p['id'] + '-' + str(k), i['id']
        assert i.get('grounded') is True and i['part'] == seed['part'] and i['doc'] == seed['doc'], ('driven, shared definition', i['id'])
        if p['kind'] == 'linear':
            n = math.sqrt(sum(x*x for x in p['dir'])); u = [x / n for x in p['dir']]
            pos = [seed['position'][j] + k * p['spacing'] * u[j] for j in range(3)]; m = euler(seed['rotation'])
        else:
            R = about(p['axis'], math.radians(k * p['angle'])); o = p['origin']
            pos = [app(R, [seed['position'][j] - o[j] for j in range(3)])[j] + o[j] for j in range(3)]; m = mul(R, euler(seed['rotation']))
        assert max(abs(pos[j] - i['position'][j]) for j in range(3)) <= 1e-6, ('position', i['id'], pos, i['position'])
        got = euler(i['rotation'])
        assert max(abs(got[a][b] - m[a][b]) for a in range(3) for b in range(3)) <= 1e-9, ('rotation', i['id'], i['rotation'])
        checked += 1
assert checked == data['occurrences'], ('occurrences checked', checked, data['occurrences'])
print(json.dumps({'status': 'PASS', 'productImports': 0, 'patterns': len(pats), 'occurrencesChecked': checked}))
`;
const fixture = join(import.meta.dirname, 'fixtures', 'instance-pattern.bcad'), mated = join(import.meta.dirname, 'fixtures', 'instance-pattern-mated.bcad');
const f = await createFlow({ name: 'instance-pattern', envFrozen: 'INSTANCE_PATTERN_SOURCE_FROZEN', output: process.argv[2], qualification: 'INSTANCE_PATTERN', oracleSource,
  limits: ['One seed part (a cube) on a base plate; circular axis X/Y/Z through the origin only (the UI); patterns of patterns and edge/datum axes are not offered.',
    'The BOM check counts the panel\'s lines for the cube; drawing, STEP and 3MF consistency are the model tests\' (instance-patterns.test.ts).'],
  initialFiles: ['apps/cad-studio/test/instance-pattern-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/test/fixtures/instance-pattern.bcad', 'apps/cad-studio/src/ui/InstancePattern.tsx', 'apps/cad-studio/src/ui/InstancePanel.tsx',
    'apps/cad-studio/src/App.tsx', 'packages/barocss-cad-model/src/assembly/patterns.ts'],
  requiredFrozen: ['packages/barocss-cad-model/src/assembly/patterns.ts'] });

const panel = () => f.page.getByRole('complementary', { name: 'Instance', exact: true });
// (An outliner row's text is its icon's name, then the instance's name: "widgetsCube 3".)
const pick = async name => {
  const at = await f.page.evaluate(n => [...document.querySelectorAll('.ol.instance')].findIndex(r => new RegExp(`^${n}(?!\\s*\\d)`).test((r.textContent ?? '').replace(/^widgets/, '').trim())), name);
  assert.ok(at >= 0, `outliner row ${name}`); await f.page.locator('.ol.instance').nth(at).click(); await panel().waitFor();
};
const occurrences = d => (d.instances ?? []).filter(i => i.pattern).length;
async function check(label, patterns, count) {
  const d = await f.doc(); assert.equal(occurrences(d), count, `${label}: ${occurrences(d)} occurrences`);
  await f.runOracle({ doc: d, patterns, occurrences: count }, label); return d;
}
async function changedTo(previous, label) { await f.changed(previous); await f.ready(); return f.snapshot(label); }

await f.run(async () => {
  await f.newPage(); await f.openFile(fixture, 2); const original = await f.doc(); await f.snapshot('01-opened');

  f.phase = 'linear pattern'; await pick('Cube');
  await panel().getByRole('button', { name: 'Pattern…', exact: true }).click();
  const form = () => panel().getByRole('group', { name: 'Instance pattern' });
  await form().getByLabel('Pattern count').fill('4'); await form().getByLabel('Pattern spacing').fill('25'); await form().getByLabel('Pattern axis').selectOption('X');
  await form().getByRole('button', { name: 'Make pattern', exact: true }).click(); await changedTo(original, '02-linear-4');
  const linear = await check('02-linear-4', 1, 3);

  f.phase = 'occurrence panel and skip'; await pick('Cube 3');
  assert.equal(await panel().getByLabel('Instance X').count(), 0, 'an occurrence has no placement boxes');
  assert.match(await panel().getByRole('status', { name: 'Pattern occurrence' }).textContent(), /pat1 · 3 of 4/);
  await f.snapshot('03-occurrence-panel');
  await panel().getByRole('button', { name: 'Skip', exact: true }).click(); await changedTo(linear, '04-skipped');
  const skipped = await check('04-skipped', 1, 2); assert.deepEqual(skipped.instancePatterns[0].skip, [2]);

  f.phase = 'restore and count 5'; await pick('Cube');
  await form().getByRole('button', { name: 'Restore', exact: true }).click(); await changedTo(skipped, '05-restored'); await check('05-restored', 1, 3);
  const restored = await f.doc();
  await form().getByLabel('Pattern count').fill('5'); await form().getByRole('button', { name: 'Apply', exact: true }).click(); await changedTo(restored, '06-count-5');
  const five = await check('06-count-5', 1, 4);

  // (Position X: rotation X has the same label, after it.)
  f.phase = 'seed moved'; const x = panel().getByLabel('Instance X').first(); await x.fill('10'); await x.press('Enter'); await changedTo(five, '07-seed-moved');
  const moved = await check('07-seed-moved', 1, 4); assert.deepEqual(moved.instances.find(i => i.id === 'pat1-4').position, [110, 0, 0]);
  await f.undo(); await f.same(five); await f.redo(); await f.same(moved);

  f.phase = 'seed removal refused'; await pick('Cube'); await panel().getByRole('button', { name: 'Remove', exact: true }).click();
  await f.waitToast(/seed of pattern pat1/); await f.snapshot('08-seed-removal-refused'); await f.same(moved); await f.dismissToasts();

  f.phase = 'skip, save, fresh open'; await pick('Cube 2'); await panel().getByRole('button', { name: 'Skip', exact: true }).click(); await changedTo(moved, '09-skip-1');
  const beforeSave = await check('09-skip-1', 1, 3); assert.deepEqual(beforeSave.instancePatterns[0].skip, [1]);
  const saved = await f.save('instance-pattern'); await f.freshOpen(saved.file, beforeSave, '10-fresh-open'); await check('10-fresh-open', 1, 3);

  f.phase = 'BOM'; await f.page.locator('nav.toolbar button[aria-label="BOM"]').click(); await f.page.getByRole('complementary', { name: 'BOM panel' }).waitFor();
  await f.page.locator('[aria-label="BOM lines"] tr[aria-label^="BOM line"]').first().waitFor({ timeout: 60000 });
  const bom = await f.page.evaluate(() => [...document.querySelectorAll('[aria-label="BOM lines"] tr[aria-label^="BOM line"]')].map(r => [...r.querySelectorAll('td')].map(td => td.textContent.trim())));
  f.report.observations.push({ bom }); await f.snapshot('11-bom');
  const cubeQty = bom.filter(r => /Cube/.test(r[1] ?? '')).reduce((n, r) => n + Number(r[2] || 0), 0);
  assert.equal(cubeQty, 4, `the BOM counts the seed and its 3 kept occurrences: ${JSON.stringify(bom)}`);
  await f.page.getByRole('button', { name: 'Close BOM', exact: true }).click();

  f.phase = 'circular'; await pick('Cube'); const withLinear = await f.doc();
  await form().getByRole('button', { name: 'Delete pattern', exact: true }).click(); await changedTo(withLinear, '12-deleted'); await check('12-deleted', 0, 0);
  const plain = await f.doc(); const x2 = panel().getByLabel('Instance X').first(); await x2.fill('50'); await x2.press('Enter'); await changedTo(plain, '13-seed-at-50');
  const at50 = await f.doc();
  await panel().getByRole('button', { name: 'Pattern…', exact: true }).click(); await form().getByLabel('Pattern kind').selectOption('circular');
  await form().getByLabel('Pattern count').fill('4'); await form().getByLabel('Pattern angle').fill('90'); await form().getByLabel('Pattern axis').selectOption('Z');
  await form().getByRole('button', { name: 'Make pattern', exact: true }).click(); await changedTo(at50, '14-circular');
  const circ = await check('14-circular', 1, 3); assert.deepEqual(circ.instances.find(i => i.id === 'pat1-2').position.map(v => Math.round(v * 1e6) / 1e6), [-50, 0, 0]);

  // A mated seed (its bottom on the plate's top, z 4): typing Z 60 is undone by the Studio's re-solve, and the occurrences follow the seed back (audit 1 #3).
  f.phase = 'mated seed'; await f.newPage(); await f.openFile(mated, 2); const m0 = await f.doc();
  await pick('Cube'); await panel().getByRole('button', { name: 'Pattern…', exact: true }).click();
  await form().getByLabel('Pattern count').fill('3'); await form().getByLabel('Pattern spacing').fill('30'); await form().getByLabel('Pattern axis').selectOption('X');
  await form().getByRole('button', { name: 'Make pattern', exact: true }).click(); await changedTo(m0, '15-mated-pattern'); const mp = await check('15-mated-pattern', 1, 2);
  // (The re-solve puts the seed back at once, so the document may end as it was: the commit is shown by two Undos reaching the pattern-less file.)
  const z = panel().getByLabel('Instance Z').first(); await z.fill('60'); await z.press('Enter'); await new Promise(r => setTimeout(r, 1500));
  await f.page.waitForFunction(() => window.__studioDoc.instances.every(i => Math.abs(i.position[2] - 4) < 1e-6), null, { timeout: 30000 });
  await f.ready(); await f.snapshot('16-mated-resolved'); await check('16-mated-resolved', 1, 2);
  await f.undo(); await f.undo(); await f.same(m0);
});

// Roadmap 10 ① (#2233): instance looks in the actual Studio. Fixture apps/cad-studio/test/fixtures/instance-looks.bcad: a base plate and two occurrences (Cube 1, Cube 2) of one
// definition "cube" (a 20 mm cube whose definition colours it #d9534f). Real clicks: the outliner rows, the Appearance (this occurrence) swatches, material select and Reset; the
// Instance panel's New revision… (instance-looks-rev-b.bcad: the cube gains a hole) and Accept; the rail's BOM button; Undo / Redo, Save, a fresh Open.
// Checks: both cubes show the definition's red (screenshots for the root); Cube 2 overridden blue and steel is marked "this occurrence" and Cube 1 stays the definition's; the BOM has
// two cube lines with masses by independent arithmetic (aluminium 2.70, steel 7.85 g/cm³; the hole after the revision); accepting the revision keeps Cube 2's override; Reset of the
// colour field restores the definition's red for Cube 2 only. The independent Python oracle (python3 -I, zero product imports) reads the stored looks and the BOM lines.
// Root must freeze all sources first. Run from apps/cad-studio:
//   INSTANCE_LOOKS_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/instance-looks-browser.mjs /absolute/artifacts
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const oracleSource = String.raw`"""Two cube occurrences, one overridden blue and steel. Product imports: zero."""
import json, math, sys
d = json.load(sys.stdin); doc = d['doc']; rows = d['bom']; hole = d['hole']
inst = {i['id']: i for i in doc['instances']}
assert not inst['c1'].get('looks'), ('Cube 1 keeps the definition', inst['c1'].get('looks'))
looks = inst['c2']['looks']; key = next(iter(looks))
assert looks[key].get('material') == 'steel', looks
if d['blue']: assert looks[key].get('color') == '#4a90d9', looks
else: assert 'color' not in looks[key], ('colour reset', looks)
vol = 20 * 20 * 20 - (math.pi * 4 * 4 * 20 if hole else 0)
al, st = vol * 2.70e-3, vol * 7.85e-3
assert any(abs(float(r['mass']) - al) <= 0.05 for r in rows), ('an aluminium cube line', al, rows)
assert any(abs(float(r['mass']) - st) <= 0.05 for r in rows), ('a steel cube line', st, rows)
print(json.dumps({'status': 'PASS', 'productImports': 0, 'aluminium': al, 'steel': st, 'hole': hole}))
`;
const fixture = join(import.meta.dirname, 'fixtures', 'instance-looks.bcad'), revB = join(import.meta.dirname, 'fixtures', 'instance-looks-rev-b.bcad');
const f = await createFlow({ name: 'instance-looks', envFrozen: 'INSTANCE_LOOKS_SOURCE_FROZEN', output: process.argv[2], qualification: 'INSTANCE_LOOKS', oracleSource,
  inspectorSource: `import {readFileSync} from 'node:fs';import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';import {bomViewOf,deriveBom} from '../../packages/barocss-cad-model/src/bom/core.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8'));console.log(JSON.stringify(deriveBom(bomViewOf(doc,(d:any)=>evaluateDoc(d,0) as any))));`,
  limits: ['Colours on screen are judged from screenshots by the root (WebGPU); WebGL2 is not run.', 'BOM masses read from the panel (rounded to its display).'],
  initialFiles: ['apps/cad-studio/test/instance-looks-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/test/fixtures/instance-looks.bcad', 'apps/cad-studio/test/fixtures/instance-looks-rev-b.bcad',
    'apps/cad-studio/src/ui/InstanceLooks.tsx', 'packages/barocss-cad-model/src/assembly/looks.ts'],
  requiredFrozen: ['packages/barocss-cad-model/src/assembly/looks.ts'] });

const panel = () => f.page.getByRole('complementary', { name: 'Instance', exact: true });
const looksGroup = () => panel().getByRole('group', { name: 'Appearance (this occurrence)', exact: true });
const pick = async name => { await f.page.locator('.ol.instance:not(.nested)').filter({ hasText: name }).first().click(); await panel().waitFor(); };
async function bomRows() {
  await f.page.locator('nav.toolbar button[aria-label="BOM"]').click();
  await f.page.locator('[aria-label="BOM lines"] tr[aria-label^="BOM line"]').first().waitFor({ timeout: 60000 });
  await f.page.waitForTimeout(500);
  const rows = await f.page.evaluate(() => {
    const view = [...document.querySelectorAll('[aria-label="BOM lines"] tr[aria-label^="BOM line"]')].map(r => [...r.querySelectorAll('td')].map(c => c.textContent.trim()));
    return view.map(c => ({ item: c[1], qty: c[2] }));
  });
  await f.page.getByRole('button', { name: 'Close BOM', exact: true }).click();
  return rows;
}
// (The panel does not show masses per line: the BOM masses come from a product read of the document — the oracle checks them by density.)
async function bomMasses(label, doc) {
  const { writeFile } = await import('node:fs/promises'), { spawnSync } = await import('node:child_process'), file = join(f.output, `${label}-doc.bcad`);
  await writeFile(file, JSON.stringify(doc)); const run = spawnSync(process.execPath, [f.inspector, file], { encoding: 'utf8', maxBuffer: 1 << 24 }); assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout).lines.map(l => ({ item: l.item, qty: String(l.qty), mass: String(l.mass) }));
}

await f.run(async () => {
  await f.newPage(); await f.openFile(fixture, 2); const original = await f.doc(); await f.snapshot('01-inherited-red');

  f.phase = 'override Cube 2'; await pick('Cube 2');
  await looksGroup().waitFor(); await f.snapshot('02-cube2-panel');
  await looksGroup().getByRole('button', { name: /Colour #4a90d9$/ }).first().click(); await f.changed(original);
  const blue = await f.doc();
  await looksGroup().getByLabel(/Material$/).first().selectOption('steel'); await f.changed(blue);
  const both = await f.doc(); await f.snapshot('03-cube2-blue-steel');
  // (Compact view since the owner's feedback: no provenance text by default; an overridden field carries a dot marker and a Reset icon.)
  const marks = await looksGroup().evaluate(g => ({ text: g.textContent, markers: [...g.querySelectorAll('[data-overridden="true"]')].map(m => m.getAttribute('aria-label')),
    details: g.querySelector('[aria-expanded]')?.getAttribute('aria-expanded') ?? null }));
  f.report.observations.push({ marks });
  // (The section's own title reads "Appearance (this occurrence)": only the per-field source lines are checked.)
  assert.doesNotMatch(marks.text.replace(/^APPEARANCE \(THIS OCCURRENCE\)/i, ''), /from the definition|this occurrence/i, 'no provenance text in the default view');
  assert.equal(marks.markers.length, 2, `colour and material marked as overridden: ${JSON.stringify(marks.markers)}`);
  assert.equal(marks.details, 'false', 'Details closed by default');
  await f.runOracle({ doc: both, bom: await bomMasses('03', both), hole: false, blue: true }, '03-override');
  f.report.observations.push({ bomPanel: await bomRows() });

  f.phase = 'undo, redo'; await f.undo(); await f.same(blue); await f.redo(); await f.same(both);

  f.phase = 'new revision keeps the override'; await pick('Cube 1');
  await f.page.setInputFiles('input[aria-label="New revision file"]', revB);
  await f.page.getByRole('button', { name: /^Accept Rev/ }).click(); await f.changed(both); await f.ready();
  const revised = await f.doc(); await f.snapshot('04-revision-accepted');
  assert.ok(revised.instances.every(i => i.part.rev === 'B'), 'both occurrences on Rev B');
  await f.runOracle({ doc: revised, bom: await bomMasses('04', revised), hole: true, blue: true }, '04-revision');

  f.phase = 'save, fresh open'; const saved = await f.save('instance-looks'); assert.deepEqual(saved.doc, revised);
  await f.freshOpen(saved.file, revised, '05-fresh-open');

  f.phase = 'reset the colour'; await pick('Cube 2');
  await looksGroup().getByRole('button', { name: /^Reset .*colour/i }).first().click(); await f.changed(revised);
  const reset = await f.doc(); await f.snapshot('06-colour-reset');
  await f.runOracle({ doc: reset, bom: await bomMasses('06', reset), hole: true, blue: false }, '06-reset');
});

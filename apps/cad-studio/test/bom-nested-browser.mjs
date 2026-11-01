// Roadmap 10 ②b (#2180): the BOM descends into sub-assemblies, in the actual Studio. Fixture apps/cad-studio/test/fixtures/nested-mate.bcad: a 70 x 60 x 4 base plate,
// "Sub" (a sub-assembly of two 10 mm cubes, Block A and Block B) and "Pin" (4 x 4 x 20). Before ②b the BOM gave Sub a mass of 0 and no lines for its blocks.
// Real clicks: the rail's BOM button, the BOM panel's lines and totals read from the DOM; then Save, a fresh Open and the BOM again.
// The independent Python oracle (python3 -I, zero product imports) computes every volume from the stored document and the default material's density (aluminium 6061,
// 2.70 g/cm³) and checks the panel's lines (Sub's rolled-up mass, Block lines under Sub with quantity 2, Pin, the plate) and the total (each body once).
// Root must freeze all sources first. Run from apps/cad-studio:
//   BOM_NESTED_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/bom-nested-browser.mjs /absolute/artifacts
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const oracleSource = String.raw`"""BOM of a plate, a two-cube sub-assembly and a pin, from the stored document and aluminium's density. Product imports: zero."""
import json, sys
data = json.load(sys.stdin); doc = data['doc']; panel = data['panel']; view = data['view']
RHO = 2.70e-3  # g/mm³, aluminium 6061 (the Studio's default material)
def box_volume(d):
    n = d['nodes']; sk, ex = n[0], n[1]
    assert sk['profile'] == 'rectangle' and ex['kind'] == 'extrude'
    return abs((sk['max'][0] - sk['min'][0]) * (sk['max'][1] - sk['min'][1]) * ex['height'])
inst = {i['id']: i for i in doc['instances']}
sub = inst['sub1']['doc']; blocks = [i for i in sub['instances'] if not i.get('hidden')]
sub_mass = sum(box_volume(b['doc']) for b in blocks) * RHO
pin_mass = box_volume(inst['pin']['doc']) * RHO
plate_mass = box_volume(doc) * RHO
lines = {l['item']: l for l in view['lines']}
assert abs(lines['Sub']['mass'] - sub_mass) <= 1e-6 * sub_mass, ('Sub rolled-up mass', lines['Sub']['mass'], sub_mass)
assert lines['Sub'].get('assembly') is True
kids = [l for l in view['lines'] if l.get('parent') == 'sub1']
assert len(kids) == 1 and kids[0]['qty'] == 2 and kids[0]['level'] == 1 and sorted(kids[0]['parts']) == ['sub1/p1', 'sub1/p2'], ('Block lines under Sub', kids)
assert abs(lines['Pin']['mass'] - pin_mass) <= 1e-6 * pin_mass
total = sub_mass + pin_mass + plate_mass
assert abs(view['totalMass'] - total) <= 1e-6 * total, ('total counts each body once', view['totalMass'], total)
# The panel shows the same lines: Sub, then its child row indented and naming Sub, Pin and the plate; the child's quantity 2.
rows = panel['rows']
names = [r['item'] for r in rows]
i = next(k for k, r in enumerate(rows) if r['item'].split(' · ')[0] == 'Sub')  # (the assembly line reads 'Sub · assembly')
child = rows[i + 1]
assert 'Sub ›' in child['item'] and child['qty'] == '2' and child['indent'] > rows[i]['indent'], ('panel child row', rows[i], child)
print(json.dumps({'status': 'PASS', 'productImports': 0, 'subMass': sub_mass, 'pinMass': pin_mass, 'plateMass': plate_mass, 'total': total, 'rows': names}))
`;
const fixture = join(import.meta.dirname, 'fixtures', 'nested-mate.bcad');
const f = await createFlow({ name: 'bom-nested', envFrozen: 'BOM_NESTED_SOURCE_FROZEN', output: process.argv[2], qualification: 'BOM_NESTED', oracleSource,
  limits: ['One sub-assembly with two equal blocks (default material); bought elements, patterns and deeper nesting are the model tests\' (bom-nested.test.ts).',
    'The BOM view (lines, totalMass) is read through a bundled product read of the saved document; the panel rows from the DOM.'],
  inspectorSource: `import {readFileSync} from 'node:fs';import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';import {bomViewOf,deriveBom} from '../../packages/barocss-cad-model/src/bom/core.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8'));const b=deriveBom(bomViewOf(doc,(d:any)=>evaluateDoc(d,0) as any));console.log(JSON.stringify(b));`,
  initialFiles: ['apps/cad-studio/test/bom-nested-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/test/fixtures/nested-mate.bcad', 'apps/cad-studio/src/ui/BomPanel.tsx', 'packages/barocss-cad-model/src/bom/core.ts', 'packages/barocss-cad-model/src/bom/bom.ts'],
  requiredFrozen: ['packages/barocss-cad-model/src/bom/core.ts'] });

const panelRows = () => f.page.evaluate(() => [...document.querySelectorAll('[aria-label="BOM lines"] tr[aria-label^="BOM line"]')].map(r => {
  const c = [...r.querySelectorAll('td')]; return { item: c[1]?.textContent.trim() ?? '', qty: c[2]?.textContent.trim() ?? '', indent: parseFloat(getComputedStyle(c[1]).paddingLeft) || 0 };
}));
async function bom(label) {
  f.phase = `BOM ${label}`;
  await f.page.locator('nav.toolbar button[aria-label="BOM"]').click();
  await f.page.locator('[aria-label="BOM lines"] tr[aria-label^="BOM line"]').first().waitFor({ timeout: 60000 });
  const rows = await panelRows(), totals = await f.page.locator('[aria-label="BOM totals"]').textContent();
  f.report.observations.push({ label, rows, totals }); await f.snapshot(`${label}-bom`);
  const accepted = await f.doc(), file = join(f.output, `${label}-doc.bcad`);
  await (await import('node:fs/promises')).writeFile(file, JSON.stringify(accepted));
  const { spawnSync } = await import('node:child_process'), run = spawnSync(process.execPath, [f.inspector, file], { encoding: 'utf8', maxBuffer: 1 << 24 });
  assert.equal(run.status, 0, run.stderr); const view = JSON.parse(run.stdout);
  await f.runOracle({ doc: accepted, view, panel: { rows, totals } }, label);
  await f.page.getByRole('button', { name: 'Close BOM', exact: true }).click();
  return accepted;
}

await f.run(async () => {
  await f.newPage(); await f.openFile(fixture, 2);
  const opened = await bom('01-opened');
  const saved = await f.save('bom-nested'); assert.deepEqual(saved.doc, opened);
  await f.freshOpen(saved.file, opened, '02-fresh-open'); await bom('02-fresh-open');
});

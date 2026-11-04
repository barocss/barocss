// D526/P0-R06 bounded Studio consumer. Invalid public-API densities are covered by direct controlled tests, not fake UI.
// D526_SOURCE_FROZEN=1 node test/public-density-material-browser.mjs /ABS/NEW/OUTPUT
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const output = process.argv[2]; assert.ok(output && isAbsolute(output));
assert.ok(relative(resolve(import.meta.dirname, '../../..'), resolve(output)).startsWith('../'));
await mkdir(output);
const oracleSource = String.raw`import json, math, sys
d=json.load(sys.stdin); s=d['state']; rho=d['density']/1000
# Literal public Box dimensions, independent of product geometry/material helpers.
L,W,H=20,10,10; volume=L*W*H; mass=volume*rho
expectedI=[mass*(W*W+H*H)/12,mass*(L*L+H*H)/12,mass*(L*L+W*W)/12]
def nums(text):
 import re
 return [float(v.replace(',','')) for v in re.findall(r'[-+]?\d[\d,]*(?:\.\d+)?(?:[eE][-+]?\d+)?',text)]
assert s['material']['label']==d['label']
assert abs(nums(s['mass'])[0]-mass)<=0.05000001, (s['mass'],mass)
assert abs(nums(s['volume'])[0]-volume)<1e-8
centroid=nums(s['centroid'])
assert centroid==[10,5,5],centroid
got=nums(s['inertia'])
assert len(got)==3 and all(math.isfinite(v) for v in got)
assert all(abs(got[k]-expectedI[k])<=0.50000001 for k in range(3)),(got,expectedI)
if d.get('bom') is not None:
 totals=d['bom']['bomTotals']; quantities=nums(totals)
 assert quantities[0]==1 and abs(quantities[-1]-mass)<=0.05000001,totals
 assert len(d['bom']['bomRows'])==1
print(json.dumps({'status':'PASS','productImports':0,'literalDimensions':[L,W,H],'densityGPerCm3':d['density'],'densityGPerMm3':rho,
 'expectedMassG':mass,'expectedCentralInertiaGmm2':expectedI,'displayTolerance':{'massG':0.05,'inertiaGmm2':0.5},'bomChecked':d.get('bom') is not None}))
`;
async function snapshotExtra() {
  const field = label => {
    const row = [...document.querySelectorAll('.kv')].find(row => row.firstChild?.textContent?.trim() === label);
    return row?.querySelector('b')?.textContent ?? null;
  };
  const material = document.querySelector('select[aria-label="Material"]');
  return { material: material ? { value: material.value, label: material.selectedOptions[0]?.textContent ?? null } : null,
    mass: field('Mass'), volume: field('Volume'), centroid: field('Centre of mass'),
    inertia: document.querySelector('[aria-label="Moments of inertia"] b')?.textContent ?? null,
    inertiaAbout: document.querySelector('select[aria-label="Inertia about"]')?.value ?? null,
    bomTotals: document.querySelector('[aria-label="BOM totals"]')?.textContent ?? null,
    bomRows: [...document.querySelectorAll('[aria-label="BOM lines"] [aria-label^="BOM line "]')].map(row => [...row.querySelectorAll('td')].map(td => td.textContent)),
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]') };
}
const f = await createFlow({ name: 'public-density-material', envFrozen: 'D526_SOURCE_FROZEN', output, oracleSource, snapshotExtra,
  qualification: 'D526/P0-R06 finite catalog material Studio consumer regression; not invalid-density API acceptance',
  initialFiles: ['apps/cad-studio/test/public-density-material-browser.mjs'],
  requiredFrozen: ['apps/cad-studio/src/ui/SelectionInspector.tsx', 'apps/cad-studio/src/ui/BomPanel.tsx'],
  extraFrozen: ['packages/barocss-cad-model/src/library/builtin/materials.json', 'packages/barocss-cad-model/src/app/mass.ts', 'packages/barocss-cad-model/src/bom/bom.ts'],
  limits: ['Desktop 1440x900 only; root must review screenshots.', 'Only existing valid Aluminium 6061 and Steel (mild) catalog inputs, 2.7 and 7.85 g/cm3.',
    'The catalog UI cannot enter arbitrary density. Invalid/nonfinite/overflow density public API behavior is NOT_TESTED by this GUI driver.',
    'Body mass/inertia UI and BOM consumer bypass the repaired public facade; this is a bounded regression smoke.',
    'BOM UI exposes root quantity and total mass, not a material column. Selected-body UI exposes material.',
    'Independent literal box and density arithmetic checks displayed quantities at declared display precision; no new general native mass/B-rep certificate.'],
});
const labels = new Set();
const capture = async label => { assert.ok(!labels.has(label)); labels.add(label); return f.snapshot(label); };
const selectBody = async () => {
  await f.page.locator('.outliner .ol', { hasText: 'Box' }).first().click();
  await f.page.getByLabel('Moments of inertia', { exact: true }).waitFor();
  await f.page.getByLabel('Inertia about', { exact: true }).selectOption('centre');
};
const withBom = async label => {
  await f.page.locator('nav.toolbar button[aria-label="BOM"]').click();
  await f.page.getByRole('complementary', { name: 'BOM panel', exact: true }).waitFor();
  await f.page.getByLabel('BOM totals', { exact: true }).waitFor({ timeout: 30000 });
  const state = await capture(label);
  await f.page.getByRole('button', { name: 'Close BOM', exact: true }).click(); return state;
};
await f.run(async () => {
  await f.newPage(); await f.page.setViewportSize({ width: 1440, height: 900 });
  f.phase = 'public native box with literal dimensions 20x10x10';
  await f.page.getByRole('button', { name: 'New part', exact: true }).click(); await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.page.keyboard.press('b'); const hud = f.page.getByRole('dialog', { name: 'Box', exact: true }); await hud.waitFor();
  for (const [label, value] of [['Width X', '20'], ['Depth Y', '10'], ['Height Z', '10']]) await hud.getByLabel(label, { exact: true }).fill(value);
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
  await hud.getByRole('button', { name: 'Apply', exact: true }).click(); await f.ready(); await selectBody();
  await capture('00-native-box-material-controls');
  f.phase = 'public Aluminium 6061 material and independent body/BOM arithmetic';
  await f.page.getByLabel('Material', { exact: true }).selectOption({ label: 'Aluminium 6061' }); await f.ready();
  const aluminium = await capture('01-aluminium-body'); assert.equal(aluminium.inertiaAbout, 'centre');
  const aluminiumBom = await withBom('02-aluminium-bom');
  await f.runOracle({ state: aluminium, bom: aluminiumBom, density: 2.7, label: 'Aluminium 6061' }, '02-aluminium-consumer');

  f.phase = 'public Steel material and independent body/BOM arithmetic';
  await selectBody(); await f.page.getByLabel('Material', { exact: true }).selectOption({ label: 'Steel (mild)' }); await f.ready();
  const steel = await capture('03-steel-body'); const steelBom = await withBom('04-steel-bom');
  await f.runOracle({ state: steel, bom: steelBom, density: 7.85, label: 'Steel (mild)' }, '04-steel-consumer');
  assert.notDeepEqual(steel.doc, aluminium.doc, 'Body material is stored in the accepted document');

  f.phase = 'public material Undo/Redo';
  await f.undo(); await f.same(aluminium.doc); await selectBody();
  const undone = await capture('05-undo-aluminium'); await f.runOracle({ state: undone, density: 2.7, label: 'Aluminium 6061' }, '05-undo-aluminium');
  await f.redo(); await f.same(steel.doc); await selectBody();
  const redone = await capture('06-redo-steel'); await f.runOracle({ state: redone, density: 7.85, label: 'Steel (mild)' }, '06-redo-steel');

  f.phase = 'public Save and fresh own-file Open keep finite Steel material';
  const saved = await f.save('07-steel-native-box'); assert.deepEqual(saved.doc, steel.doc);
  await f.newPage(); await f.page.setViewportSize({ width: 1440, height: 900 });
  await f.openFile(saved.file, saved.doc.nodes.length); await f.same(saved.doc); await selectBody();
  const reopened = await capture('08-fresh-own-open-steel-body'); const reopenedBom = await withBom('09-fresh-own-open-steel-bom');
  await f.runOracle({ state: reopened, bom: reopenedBom, density: 7.85, label: 'Steel (mild)' }, '09-fresh-own-open-consumer');
});

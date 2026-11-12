// D762/B05-06: actual pattern material, skipped occurrence and BOM mass.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const fixture = join(import.meta.dirname, 'fixtures', 'instance-pattern.bcad');
const pins = [
  'apps/cad-studio/test/static-assembly-pattern-bom-browser.mjs', 'apps/cad-studio/test/fixtures/instance-pattern.bcad',
  'apps/cad-studio/test/model-rail-helper.mjs', 'apps/cad-studio/src/ui/InstancePattern.tsx',
  'apps/cad-studio/src/ui/InstanceLooks.tsx', 'apps/cad-studio/src/ui/BomPanel.tsx',
  'packages/barocss-cad-model/src/bom/bom.ts', 'packages/barocss-cad-model/src/bom/core.ts',
  'packages/barocss-cad-model/src/assembly/patterns.ts',
];

const f = await createFlow({
  name: 'static-assembly-pattern-bom', envFrozen: 'D762_SOURCE_FROZEN', output: process.argv[2],
  qualification: 'B05-06 material propagation, skip and exact BOM totals',
  initialFiles: pins, requiredFrozen: pins,
  limits: ['One 160 × 60 × 4 mm plate and one four-copy linear pattern of 10 mm cubes. Densities are the existing library values.'],
  inspectorSource: String.raw`
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bomPanelDataOf } from '@barocss/cad-model/bom/bom';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';

const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
function volume(doc) {
  const evaluated = evaluateDoc(doc, 0);
  if (!evaluated.ok) assert.fail(JSON.stringify(evaluated.error));
  assert.equal(evaluated.bodies.length, 1);
  return evaluated.bodies[0].volume;
}
const { view, bom } = bomPanelDataOf(doc, d => evaluateDoc(d, 0), 'instance-pattern');
console.log(JSON.stringify({ view, bom, baseVolume: volume(doc), cubeVolume: volume(doc.instances[0].doc) }));
`,
  oracleSource: String.raw`
import json, math, re, sys
x = json.load(sys.stdin)
d, n = x["doc"], x["native"]
steel, skipped = x["steel"], x["skipped"]
p, = d["instancePatterns"]
assert (p["kind"], p["seed"], p["count"], p["spacing"], p["dir"]) == ("linear", "cube", 4, 25, [1,0,0])
assert p.get("skip", []) == ([2] if skipped else [])
indices = [k for k in range(4) if not skipped or k != 2]
ids = ["cube" if k == 0 else p["id"]+"-"+str(k) for k in indices]
assert [i["id"] for i in d["instances"]] == ids
for i, k in zip(d["instances"], indices):
    assert i["position"] == [k*25, 0, 0]
    assert i["looks"]["b1"]["material"] == "steel" if steel else not i.get("looks")
assert math.isclose(n["baseVolume"], 38400, rel_tol=1e-9)
assert math.isclose(n["cubeVolume"], 1000, rel_tol=1e-9)
base_mass, unit_mass = 38400*0.0027, 1000*(0.00785 if steel else 0.0027)
total_mass = base_mass + unit_mass*len(ids)
assert abs(n["view"]["base"]["mass"] - base_mass) <= 1e-9
assert [row["id"] for row in n["view"]["parts"]] == ids
for row in n["view"]["parts"]:
    assert abs(row["mass"] - unit_mass) <= 1e-9
    if steel: assert row["material"] == "steel"
cube, = [row for row in n["bom"]["lines"] if row["item"] == "Cube"]
assert cube["parts"] == ids and cube["qty"] == len(ids)
assert abs(cube["mass"] - unit_mass*len(ids)) <= 1e-9
assert n["bom"]["totalQty"] == len(ids)
assert abs(n["bom"]["totalMass"] - total_mass) <= 1e-9
assert [(r[1], int(r[2])) for r in x["rows"] if r[1] == "Cube"] == [("Cube", len(ids))]
assert [(r[1], int(r[2])) for r in x["rows"] if r[1] == "b1"] == [("b1", 1)]
match = re.match(r"^(\d+) parts? · 0 bought elements · ([\d.]+) g", x["total"])
assert match and int(match[1]) == len(ids)
assert abs(float(match[2]) - round(total_mass, 1)) <= 1e-9
print(json.dumps({"status":"PASS", "quantity":len(ids), "totalMass":round(total_mass, 6), "uiMass":float(match[2]), "ids":ids}))
`,
  snapshotExtra: () => ({
    bomTotal: document.querySelector('[aria-label="BOM totals"]')?.textContent ?? null,
    bomRows: [...document.querySelectorAll('[aria-label="BOM lines"] tr[aria-label^="BOM line"]')].map(row =>
      [...row.querySelectorAll('td')].map(cell => cell.textContent.trim())),
  }),
});

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  await f.newPage();
  const page = f.page, button = name => page.getByRole('button', { name, exact: true });
  const instance = page.getByRole('complementary', { name: 'Instance', exact: true });
  const pattern = instance.getByRole('group', { name: 'Instance pattern' });
  const material = instance.getByLabel('Material', { exact: true });
  const pick = async (name) => {
    await page.locator('.ol.instance').filter({ hasText: new RegExp('^' + name + '$') }).click();
    await instance.getByLabel('Instance Name').waitFor();
    assert.equal(await instance.getByLabel('Instance Name').inputValue(), name);
  };
  const binding = async (label, steel, skipped) => {
    await clickModelCommand(page, 'Inspect', 'BOM');
    await page.getByLabel('BOM totals', { exact: true }).waitFor();
    const state = await f.snapshot(label);
    const native = await f.inspect(label, state.doc);
    await f.runOracle({ doc: state.doc, native, total: state.bomTotal, rows: state.bomRows, steel, skipped }, label);
    await button('Close BOM').click();
    return state.doc;
  };

  f.phase = 'Open the plate and make the four-copy pattern';
  await f.openFile(fixture, 2);
  await page.waitForFunction(() => window.__studioDoc.instances?.[0]?.id === 'cube');
  f.report.observations.push({ sourceSHA256: sha256(await readFile(fixture)) });
  await pick('Cube');
  await instance.getByRole('button', { name: 'Pattern…', exact: true }).click();
  await pattern.getByLabel('Pattern count').fill('4');
  await pattern.getByLabel('Pattern spacing').fill('25');
  await pattern.getByLabel('Pattern axis').selectOption('X');
  await pattern.getByRole('button', { name: 'Make pattern', exact: true }).click();
  await page.waitForFunction(() => window.__studioDoc.instances?.length === 4);
  const aluminium = await binding('four-inherited-cubes', false, false);

  f.phase = 'Change the seed material and skip one driven copy';
  await pick('Cube');
  await material.selectOption('steel');
  await f.changed(aluminium);
  const steel = await binding('four-steel-cubes', true, false);
  await pick('Cube 3');
  assert.equal(await material.isDisabled(), true);
  assert.equal(await material.inputValue(), 'steel');
  await instance.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.waitForFunction(() => window.__studioDoc.instances?.length === 3);
  const skipped = await binding('skip-one-steel-cube', true, true);

  f.phase = 'Undo and Redo the skip and the material';
  await button('Undo').click();
  await f.same(steel);
  await binding('undo-skip', true, false);
  await button('Undo').click();
  await f.same(aluminium);
  await binding('undo-material', false, false);
  await button('Redo').click();
  await f.same(steel);
  await binding('redo-material', true, false);
  await button('Redo').click();
  await f.same(skipped);
  await binding('redo-skip', true, true);

  f.phase = 'Save, close and reopen the native project';
  const project = 'D762 pattern BOM', file = 'instance-pattern.bcad';
  const versions = page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const attach = async () => {
    if (!(await versions.isVisible())) await button('Project and versions').click();
    await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await versions.getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await versions.getByLabel('Project', { exact: true }).waitFor();
  };
  await attach();
  await button('Save').click();
  await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  const saved = await page.evaluate(async ([project, file]) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    return (await (await dir.getFileHandle(file)).getFile()).text();
  }, [project, file]);
  assert.deepEqual(JSON.parse(saved), skipped);
  f.report.files.push({ name: file, sha256: sha256(saved) });
  await versions.getByRole('button', { name: 'Close project', exact: true }).click();
  await versions.getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await page.reload();
  await f.ready();
  await attach();
  await versions.getByRole('button', { name: 'Open ' + file, exact: true }).click();
  await f.same(skipped);
  await binding('fresh-open-skip-and-steel', true, true);

  f.phase = 'Reset material and restore the skipped copy after Open';
  await pick('Cube');
  await instance.getByRole('button', { name: 'Reset material to the definition', exact: true }).click();
  await f.changed(skipped);
  const reset = await binding('reset-three-cubes', false, true);
  await pick('Cube');
  await pattern.getByRole('button', { name: 'Restore', exact: true }).click();
  await f.changed(reset);
  assert.deepEqual(await binding('restore-four-cubes', false, false), aluminium);
  assert.deepEqual(f.report.downloads, []);
});

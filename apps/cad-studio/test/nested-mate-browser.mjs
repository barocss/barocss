// D761/B05-05: keep a nested face reference through a sub-assembly revision.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const fixture = join(import.meta.dirname, 'fixtures', 'nested-mate.bcad');
const revision = join(import.meta.dirname, 'fixtures', 'nested-mate-rev-b.bcad');
const pins = [
  'apps/cad-studio/test/nested-mate-browser.mjs', 'apps/cad-studio/test/fixtures/nested-mate.bcad',
  'apps/cad-studio/test/fixtures/nested-mate-rev-b.bcad',
  'apps/cad-studio/src/ui/NestedPartPanel.tsx', 'apps/cad-studio/src/ui/OutlinerInstances.tsx',
  'apps/cad-studio/src/assembly/useAssembly.ts', 'apps/cad-studio/src/assembly/nestedSelection.ts',
  'packages/barocss-cad-model/src/engine/occurrences.ts', 'packages/barocss-cad-model/src/engine/flatten.ts',
];

const f = await createFlow({
  name: 'nested-mate', envFrozen: 'NESTED_MATE_SOURCE_FROZEN', output: process.argv[2],
  qualification: 'B05-05 nested occurrence, mate and sub-assembly revision',
  initialFiles: pins, requiredFrozen: pins,
  limits: ['One translated sub-assembly. Native faces are supplied to the real Studio picker through its existing dev hook. Nested row selection and revision actions use public controls.'],
  inspectorSource: String.raw`
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { flatFaceOf } from '@barocss/cad-model/engine/occurrences';

const root = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const sub = root.instances.find(i => i.id === 'sub1');
const block = sub.doc.instances.find(i => i.id === 'p2');
const pin = root.instances.find(i => i.id === 'pin');
function face(doc, name) {
  const r = evaluateDoc(doc, 0);
  if (!r.ok) assert.fail(JSON.stringify(r.error));
  assert.equal(r.bodies.length, 1);
  return { plane: r.faceTable[name], volume: r.bodies[0].volume };
}
console.log(JSON.stringify({
  folded: flatFaceOf(sub.doc, ['p2'], 'n1.top'),
  block: face(block.doc, 'n1.top'), pin: face(pin.doc, 'n1.bottom'),
}));
`,
  oracleSource: String.raw`
import json, math, sys
x = json.load(sys.stdin)
doc, native = x["doc"], x["native"]
sub, pin = (next(i for i in doc["instances"] if i["id"] == key) for key in ("sub1", "pin"))
block = next(i for i in sub["doc"]["instances"] if i["id"] == "p2")
assert sub["part"]["rev"] == x["revision"]
assert sub["rotation"] == block["rotation"] == pin["rotation"] == [0, 0, 0]
assert block["position"] == [20, 0, x["z"]]
mate, = doc["mates"]
assert mate["kind"] == "coincident"
assert (mate["a"]["part"], mate["a"]["face"]) == ("sub1/p2", "n1.top")
assert (mate["b"]["part"], mate["b"]["face"]) == ("pin", "n1.bottom")
top, bottom = native["block"]["plane"], native["pin"]["plane"]
assert top["kind"] == bottom["kind"] == "plane"
assert top["normal"] == [0,0,1] and bottom["normal"] == [0,0,-1]
assert math.isclose(native["block"]["volume"], 1000, rel_tol=1e-9)
assert math.isclose(native["pin"]["volume"], 320, rel_tol=1e-9)
world_top = sub["position"][2] + block["position"][2] + top["point"][2]
world_bottom = pin["position"][2] + bottom["point"][2]
assert abs(world_top - x["z"] - 10) <= 1e-9
assert abs(world_bottom - world_top) <= 1e-9
display_pin = next(b for b in x["bounds"] if b["id"] == "pin")
assert abs(display_pin["min"][2] - world_bottom) <= 1e-9
assert abs(display_pin["max"][2] - world_bottom - 20) <= 1e-9
assert native["folded"] == x["folded"]
print(json.dumps({"status":"PASS","path":"sub1/p2","face":"n1.top","pinZ":world_bottom,"revision":x["revision"],"folded":native["folded"]}))
`,
  snapshotExtra: () => ({
    bounds: window.__studioInstanceBounds?.() ?? [],
    nested: document.querySelector('[aria-label="Nested part"]')?.textContent ?? null,
  }),
});

await f.run(async () => {
  const bytes = await readFile(fixture), updated = await readFile(revision);
  const original = JSON.parse(bytes);
  const next = structuredClone(original);
  next.instances.find(i => i.id === 'sub1').doc = JSON.parse(updated);
  const a = await f.inspect('fixture-A', original);
  const b = await f.inspect('fixture-B', next);
  assert.ok(a.folded && b.folded);
  assert.notEqual(a.folded, b.folded);
  f.report.observations.push({ sourceA: sha256(bytes), sourceB: sha256(updated), foldedA: a.folded, foldedB: b.folded });

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
  const host = page.locator('.ol.instance:not(.nested)').filter({ hasText: 'Sub' });
  const pin = page.locator('.ol.instance:not(.nested)').filter({ hasText: 'Pin' });
  const panel = page.getByRole('complementary', { name: 'Nested part', exact: true });
  const instance = page.getByRole('complementary', { name: 'Instance', exact: true });
  const waiting = instance.getByRole('status', { name: 'Revision waiting', exact: true });
  const row = page.locator('.ol.instance.nested[data-path="sub1/p2"]');
  const selectBlock = async z => {
    if (!(await row.count())) await button('Show the parts of Sub').click();
    await row.click();
    assert.equal(await panel.getByTestId('nested-path').innerText(), 'sub1/p2');
    await panel.getByText('Sub › Block B', { exact: true }).waitFor();
    await panel.getByText('1000 mm³', { exact: true }).waitFor();
    await panel.getByText('20, 0, ' + z, { exact: true }).waitFor();
  };
  const binding = async (label, revision, z, folded) => {
    await page.waitForFunction(z => window.__studioInstanceBounds?.().find(i => i.id === 'pin')?.min?.[2] === z + 10, z);
    await selectBlock(z);
    const state = await f.snapshot(label);
    const native = await f.inspect(label, state.doc);
    await f.runOracle({ doc: state.doc, bounds: state.bounds, native, revision, z, folded }, label);
    return state.doc;
  };

  f.phase = 'Open and mate the exact nested face';
  await f.openFile(fixture, 2);
  await page.waitForFunction(() => window.__studioDoc.instances?.length === 2);
  await selectBlock(0);
  await f.snapshot('nested-selection-A');
  await pin.click();
  await page.getByRole('complementary', { name: 'Mates', exact: true }).getByRole('button', { name: 'Add mate', exact: true }).click();
  assert.ok(await page.evaluate(name => window.__studioPickInstanceFace('sub1', name), a.folded));
  assert.ok(await page.evaluate(() => window.__studioPickInstanceFace('pin', 'n1.bottom')));
  await page.waitForFunction(() => window.__studioDoc.mates?.length === 1);
  const mated = await binding('mate-A', 'A', 0, a.folded);
  const offer = async () => {
    await host.click();
    await instance.getByLabel('New revision file', { exact: true }).setInputFiles(revision);
    await waiting.getByRole('button', { name: 'Accept Rev B', exact: true }).waitFor();
  };

  f.phase = 'Keep A, then offer and accept B';
  await offer();
  await waiting.getByRole('button', { name: 'Keep Rev A', exact: true }).click();
  await waiting.waitFor({ state: 'hidden' });
  const kept = await binding('keep-A', 'A', 0, a.folded);
  assert.deepEqual(kept.instances, mated.instances);
  assert.deepEqual(kept.mates, mated.mates);
  assert.equal(kept.pendingParts, undefined);
  await offer();
  const offered = await binding('B-waits-A-stays', 'A', 0, a.folded);
  assert.equal(offered.pendingParts.subdef.rev, 'B');
  await host.click();
  await waiting.getByRole('button', { name: 'Accept Rev B', exact: true }).click();
  await page.waitForFunction(() => window.__studioDoc.instances?.find(i => i.id === 'sub1')?.part?.rev === 'B');
  const accepted = await binding('accept-B', 'B', 5, b.folded);
  assert.deepEqual(accepted.mates, mated.mates);
  assert.equal(accepted.pendingParts, undefined);

  f.phase = 'Undo and Redo the nested revision';
  await button('Undo').click();
  await f.same(offered);
  await binding('first-undo-keeps-A', 'A', 0, a.folded);
  await button('Redo').click();
  await f.same(accepted);
  await binding('redo-accepts-B', 'B', 5, b.folded);

  f.phase = 'Save, close and reopen the native project';
  const file = 'nested-mate.bcad', project = 'D761 nested mate';
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
  assert.deepEqual(JSON.parse(saved), accepted);
  f.report.files.push({ name: file, sha256: sha256(saved) });
  await versions.getByRole('button', { name: 'Close project', exact: true }).click();
  await versions.getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await page.reload();
  await f.ready();
  await attach();
  await versions.getByRole('button', { name: 'Open ' + file, exact: true }).click();
  await f.same(accepted);
  await binding('fresh-open-B', 'B', 5, b.folded);
  assert.deepEqual(f.report.downloads, []);
});

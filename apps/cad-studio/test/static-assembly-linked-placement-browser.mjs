// D758/D759: two translated copies of a shared linked definition, with an optional three-plane mate chain.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const planar = mode === '--planar';
const fixture = 'apps/cad-studio/test/fixtures/bracket.bcad';
const pins = [
  'apps/cad-studio/test/static-assembly-linked-placement-browser.mjs', fixture,
  'apps/cad-studio/src/assembly/useAssembly.ts', 'apps/cad-studio/src/ui/InstancePanel.tsx',
  ...(planar ? ['apps/cad-studio/src/ui/MatePanel.tsx', 'packages/barocss-cad-model/src/assembly/mates.ts'] : []),
  'apps/cad-studio/src/storage/VersionsPanel.tsx', 'packages/barocss-cad-model/src/assembly/definitions.ts',
];
const inspectorSource = String.raw`
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const native = doc.instances.map(instance => {
  const result = evaluateDoc(instance.doc, 0);
  if (!result.ok) assert.fail(JSON.stringify(result.error));
  assert.equal(result.bodies.length, 1);
  return { id: instance.id, volume: result.bodies[0].volume, centroid: result.bodies[0].centroid };
});
console.log(JSON.stringify(native));
`;
const f = await createFlow({
  name: 'static-assembly-linked-placement', envFrozen: planar ? 'D759_SOURCE_FROZEN' : 'D758_SOURCE_FROZEN', output,
  qualification: 'Repeated linked definitions follow accepted revisions while each occurrence retains its placement',
  initialFiles: pins, requiredFrozen: pins, inspectorSource,
  limits: ['Two translated copies of an ordinary 30 × 12 mm box with depth 6 or 8 mm. Native and viewport evidence have separate numeric authorities.'],
  snapshotExtra: () => ({
    bounds: window.__studioInstanceBounds?.() ?? [],
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    panel: document.querySelector('[aria-label="Instance"]')?.textContent ?? null,
    freedom: document.querySelector('[aria-label="Freedom"]')?.textContent ?? null,
    mateRefusal: document.querySelector('[aria-label="Mate refused"]')?.textContent ?? null,
    historyActions: ['Undo', 'Redo'].map(label => document.querySelector('button[aria-label="' + label + '"]')?.disabled),
  }),
  oracleSource: String.raw`
import json, math, sys
x = json.load(sys.stdin)
instances = x["document"]["instances"]
bounds = {r["id"]: r for r in x["bounds"]}
native = {r["id"]: r for r in x["native"]}
expected = x["expected"]
assert len(instances) == len(bounds) == len(native) == len(expected) == 2
def near(a, b):
    return len(a) == len(b) and all(abs(v - w) <= 1e-9 for v, w in zip(a, b))
for i, e in zip(instances, expected, strict=True):
    h, p, ident = e["height"], e["position"], e["id"]
    assert i["id"] == ident and i["position"] == p and i["rotation"] == [0, 0, 0]
    assert i["doc"]["nodes"][1]["height"] == h
    assert math.isclose(native[ident]["volume"], 360*h, rel_tol=1e-9)
    assert near(native[ident]["centroid"], [15, 6, h/2]), native[ident]
    assert near(bounds[ident]["min"], p), bounds[ident]
    assert near(bounds[ident]["max"], [p[0]+30, p[1]+12, p[2]+h]), bounds[ident]
planes = x.get("planes")
if planes is not None:
    assert len(x["document"]["mates"]) == len(planes)
    assert instances[0]["grounded"]
    for mate, (stays, moves) in zip(x["document"]["mates"], planes, strict=True):
        assert mate["kind"] == "coincident", mate
        assert mate["a"] == {"part": instances[0]["id"], "face": stays}, mate
        assert mate["b"] == {"part": instances[1]["id"], "face": moves}, mate
    p, q = (r["position"] for r in instances)
    assert abs(q[2] - p[2] - expected[0]["height"]) <= 1e-9
    if len(planes) >= 2:
        assert abs(q[1] - p[1]) <= 1e-9
    if len(planes) == 3:
        assert abs(q[0] - p[0]) <= 1e-9
print(json.dumps({"status": "PASS", "ids": list(native), "volumes": [b["volume"] for b in native.values()]}))
`,
});

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  await f.newPage();
  const page = f.page, button = name => page.getByRole('button', { name, exact: true });
  const versions = page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const panel = page.getByRole('complementary', { name: 'Instance', exact: true });
  const rows = page.locator('.ol.instance:not(.nested)');
  const project = 'D758 linked static assembly', partFile = 'bracket.bcad', assemblyFile = 'linked-assembly.bcad';
  const projectButton = name => versions.getByRole('button', { name, exact: true });
  const attach = async () => {
    if (!(await versions.isVisible())) await button('Project and versions').click();
    await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await projectButton('Project in this browser').click();
    await versions.getByLabel('Project', { exact: true }).waitFor();
  };
  const save = async (file, label, expected) => {
    await button('Save').click();
    await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
    await page.locator('[aria-label="Unsaved changes"]').waitFor({ state: 'hidden' });
    const saved = await page.evaluate(async ([project, file]) => {
      const root = await navigator.storage.getDirectory();
      const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
      return (await (await dir.getFileHandle(file)).getFile()).text();
    }, [project, file]);
    assert.deepEqual(JSON.parse(saved), expected);
    f.report.files.push({ label, name: file, sha256: sha256(saved) });
  };
  const currentInstances = count => page.waitForFunction(count => window.__studioDoc?.instances?.length === count, count);
  const select = async (index, name) => {
    await rows.nth(index).click();
    await page.waitForFunction(name => document.querySelector('[aria-label="Instance Name"]')?.value === name, name);
  };
  const binding = async (label, ids, positions, height, planes) => {
    const expected = ids.map((id, i) => ({ id, position: positions[i], height }));
    await page.waitForFunction(items => items.every(({ id, position, height }) => {
      const b = window.__studioInstanceBounds?.()?.find(row => row.id === id);
      return b?.min?.every((v, k) => Math.abs(v - position[k]) <= 1e-9)
        && b.max?.every((v, k) => Math.abs(v - position[k] - [30, 12, height][k]) <= 1e-9);
    }), expected);
    const state = await f.snapshot(label);
    const native = await f.inspect(label, state.doc);
    await f.runOracle({ document: state.doc, bounds: state.bounds, native, expected, planes }, label);
    return state;
  };

  f.phase = 'Open the ordinary part and create an owned project source';
  const bytes = await readFile(fixture);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: partFile, mimeType: 'application/json', buffer: bytes });
  await page.waitForFunction(() => window.__studioDoc?.nodes?.length === 2 && window.__studioDoc.nodes[1].height === 6);
  await f.ready();
  const part = await f.doc();
  f.report.observations.push({ sourceSHA256: sha256(bytes) });
  await attach();
  await save(partFile, 'source-A', part);

  f.phase = 'Insert the linked source and duplicate its occurrence';
  await button('New part').click();
  await page.waitForFunction(() => window.__studioDoc?.nodes?.length === 0);
  await page.locator('.doc-tab input').fill('linked-assembly');
  await projectButton('Insert ' + partFile).click();
  await currentInstances(1);
  await f.ready();
  const inserted = (await f.doc()).instances[0];
  assert.equal(inserted.part.source, './' + partFile);
  await select(0, inserted.name);
  await panel.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await currentInstances(2);
  const paired = await f.doc(), ids = paired.instances.map(i => i.id);
  assert.notEqual(ids[0], ids[1]);
  assert.deepEqual(paired.instances[0].part, paired.instances[1].part);
  assert.deepEqual(paired.instances.map(i => i.doc), [inserted.doc, inserted.doc]);

  f.phase = 'Move the second occurrence and retain the first and both definitions';
  await select(1, paired.instances[1].name);
  const x = panel.getByRole('spinbutton', { name: 'Instance X', exact: true }).first();
  await x.fill('75');
  await x.press('Enter');
  await page.waitForFunction(() => window.__studioDoc.instances[1].position[0] === 75);
  let positions = [inserted.position, [75, ...paired.instances[1].position.slice(1)]];
  let placed = await binding('separate-placement-shared-definition', ids, positions, 6);
  assert.deepEqual(placed.doc.instances[0], paired.instances[0]);
  assert.deepEqual(placed.doc.instances[1].doc, paired.instances[1].doc);
  assert.match(placed.panel, /Rev A · shared by 2/);
  const planes = [['n1.top', 'n1.bottom'], ['origin:xz', 'origin:xz'], ['origin:yz', 'origin:yz']];
  const mates = page.getByRole('complementary', { name: 'Mates', exact: true });
  const freedom = mates.getByLabel('Freedom', { exact: true });
  if (planar) {
    f.phase = 'Ground the first instance and add three Coincident planes';
    await select(0, inserted.name);
    await panel.getByRole('button', { name: 'Fix in place', exact: true }).click();
    await page.waitForFunction(() => window.__studioDoc.instances[0].grounded);
    const start = async kind => {
      await mates.getByRole('button', { name: 'Add mate', exact: true }).click();
      await mates.getByLabel('Mate type', { exact: true }).selectOption(kind);
      await mates.getByLabel('Mate flip', { exact: true }).setChecked(false);
    };
    const pick = async (part, face) => {
      if (face.startsWith('origin:')) {
        await mates.getByLabel('Plane of', { exact: true }).selectOption(part);
        await mates.getByRole('button', { name: 'Pick ' + face.slice(7).toUpperCase() + ' plane', exact: true }).click();
      } else {
        await mates.getByLabel('Reference part', { exact: true }).selectOption(part);
        await mates.getByLabel('Reference geometry', { exact: true }).selectOption(face);
        await mates.getByRole('button', { name: 'Pick mate reference', exact: true }).click();
      }
    };
    const targets = [[75, 20, 6], [75, 0, 6], [20, 0, 6]];
    const expectedFreedom = ['free: 2 slides · 1 turn', 'free: 1 slide', 'fully placed by its mates'];
    for (const [index, [stays, moves]] of planes.entries()) {
      await start('coincident');
      await pick(ids[0], stays);
      await pick(ids[1], moves);
      await page.waitForFunction(n => window.__studioDoc.mates?.length === n, index + 1);
      await select(1, paired.instances[1].name);
      await freedom.getByText(expectedFreedom[index], { exact: true }).waitFor();
      positions = [inserted.position, targets[index]];
      placed = await binding('coincident-planes-' + (index + 1), ids, positions, 6, planes.slice(0, index + 1));
      assert.ok(placed.freedom.endsWith(expectedFreedom[index]));
    }

    f.phase = 'Refuse an incompatible 3 mm distance and keep the accepted constraints';
    await start('distance');
    const distance = mates.getByLabel('Mate distance', { exact: true });
    await distance.fill('3');
    await distance.press('Enter');
    await pick(ids[0], planes[0][0]);
    await pick(ids[1], planes[0][1]);
    await mates.getByRole('status', { name: 'Mate refused', exact: true }).waitFor();
    const refused = await f.snapshot('conflicting-distance-refused');
    assert.match(refused.mateRefusal, /3 mm|3mm/);
    assert.deepEqual(refused.doc, placed.doc);
    assert.deepEqual(refused.historyActions, placed.historyActions);
    assert.equal(refused.dirty, placed.dirty);
    await mates.getByRole('button', { name: 'Cancel', exact: true }).click();
    await f.same(placed.doc);
    await freedom.getByText('fully placed by its mates', { exact: true }).waitFor();
  }
  await save(assemblyFile, 'assembly-A', placed.doc);

  f.phase = 'Edit the actual source to depth 8 and keep revision A until explicit acceptance';
  await projectButton('Open ' + partFile).click();
  await f.same(part);
  await f.openFeatureEditor(1, 'linked source');
  await f.editor().getByRole('spinbutton', { name: 'Distance', exact: true }).fill('8');
  const updated = await f.applyEditor(part, 'source-edited-to-8');
  assert.equal(updated.doc.nodes[1].height, 8);
  await save(partFile, 'source-B', updated.doc);
  await projectButton('Open ' + assemblyFile).click();
  await page.waitForFunction(() => Object.values(window.__studioDoc?.pendingParts ?? {}).some(p => p.rev === 'B'));
  await f.ready();
  await select(1, paired.instances[1].name);
  const waiting = panel.getByRole('status', { name: 'Revision waiting', exact: true });
  await waiting.waitFor();
  assert.match(await waiting.innerText(), /all 2 instances/);
  const pending = await binding('revision-B-waits-both-A-stay', ids, positions, 6, planar ? planes : undefined);
  assert.deepEqual(pending.doc.instances, placed.doc.instances);

  f.phase = 'Accept revision B for both occurrences and keep each position';
  await waiting.getByRole('button', { name: 'Accept Rev B', exact: true }).click();
  await page.waitForFunction(() => window.__studioDoc?.instances?.every(i => i.part?.rev === 'B'));
  const revised = planar ? [positions[0], [positions[1][0], positions[1][1], 8]] : positions;
  const accepted = await binding('revision-B-both-current', ids, revised, 8, planar ? planes : undefined);
  if (planar) {
    assert.ok(accepted.freedom.endsWith('fully placed by its mates'));
    assert.deepEqual(accepted.doc.mates, placed.doc.mates);
  }
  assert.match(accepted.panel, /Rev B · shared by 2/);
  for (const instance of accepted.doc.instances) {
    assert.deepEqual(instance.part, { ...inserted.part, rev: 'B' });
    assert.deepEqual(instance.doc.nodes, updated.doc.nodes);
  }
  await button('Undo').click();
  await f.same(pending.doc);
  await binding('undo-restores-A-with-B-waiting', ids, positions, 6, planar ? planes : undefined);
  await button('Redo').click();
  await f.same(accepted.doc);
  await save(assemblyFile, 'assembly-B', accepted.doc);

  f.phase = 'Reopen revision B in a fresh page and re-edit the second position';
  await projectButton('Close project').click();
  await versions.getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await page.reload();
  await f.ready();
  await attach();
  await projectButton('Open ' + assemblyFile).click();
  await f.same(accepted.doc);
  await select(1, paired.instances[1].name);
  if (planar) await freedom.getByText('fully placed by its mates', { exact: true }).waitFor();
  await binding('fresh-open-B', ids, revised, 8, planar ? planes : undefined);
  if (planar) {
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  await x.fill('90');
  await x.press('Enter');
  await page.waitForFunction(() => window.__studioDoc.instances[1].position[0] === 90);
  const post = await binding('reopened-second-move-retains-B', ids, [positions[0], [90, ...positions[1].slice(1)]], 8);
  assert.deepEqual(post.doc.instances[0], accepted.doc.instances[0]);
  assert.deepEqual(post.doc.instances[1].doc, accepted.doc.instances[1].doc);
  assert.deepEqual(f.report.downloads, []);
});

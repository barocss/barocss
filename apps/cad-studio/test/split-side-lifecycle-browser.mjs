import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const output = process.argv[2], repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
await mkdir(output);
const antecedent = 'apps/cad-studio/test/fixtures/linear-cut-pattern.bcad';
const stock = JSON.parse(await readFile(resolve(repo, antecedent), 'utf8'));
stock.nodes = stock.nodes.slice(0, 2);
stock.outputs = { b1: { node: 1, side: 'solid' } };
stock.nextId = 2;
const name = 'split-side-stock', file = join(output, name + '.bcad');
await writeFile(file, JSON.stringify(stock));

function expected(at, moved) {
  const doc = structuredClone(stock);
  doc.nodes.push({ kind: 'split', parent: { node: 1, side: 'solid' }, axis: 'x', at, id: 'n2' });
  doc.outputs = { b2_negative: { node: 2, side: 'negative' }, b2_positive: { node: 2, side: 'positive' } };
  doc.nextId = 3;
  if (moved) {
    doc.nodes.push({ kind: 'translate', parent: { node: 2, side: 'positive' }, offset: [0, 40, 0], id: 'n3' });
    delete doc.outputs.b2_positive;
    doc.outputs.b3 = { node: 3, side: 'solid' };
    doc.nextId = 4;
  }
  return doc;
}

const pins = [antecedent, 'apps/cad-studio/test/split-side-lifecycle-browser.mjs',
  'apps/cad-studio/test/model-rail-helper.mjs', 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/app/commands.ts', 'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad-model/src/engine/doc.ts', 'packages/barocss-cad-model/src/engine/part.ts',
  'packages/barocss-cad/src/part/part-model.ts'];
const f = await createFlow({
  name: 'split-side-lifecycle', envFrozen: 'D788_SOURCE_FROZEN', output,
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Author Split and Move in Studio and verify the exact side ownership after edits and project Open.',
  limits: ['One box with a strictly interior X plane, one positive-side Y translation and one tangent-plane refusal.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument, bodyKeyOf } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (process.argv[3]) {
  try {
    evaluateCadPart(toPartDocument(doc));
    console.log(JSON.stringify({ accepted: true }));
  } catch (error) {
    console.log(JSON.stringify({ code: error.code, feature: error.feature, message: error.message }));
  }
  process.exit(0);
}
const { outputs } = evaluateCadPart(toPartDocument(doc));
console.log(JSON.stringify(outputs.map(body => {
  const { volume, centroid, method } = massPropertiesOf(body);
  return { id: body.id, key: bodyKeyOf(body.id, doc.nodes), volume, centroid, method, check: checkOutput(body),
    vertices: body.brep.vertices.map(vertex => vertex.point),
    closed: body.brep.shells.map(shell => shell.closed),
    faces: body.brep.faces.map(face => ({ name: face.name, geometry: faceGeometry(face) })) };
})));
`,
  oracleSource: String.raw`
import itertools
import json
import math
import sys

data = json.load(sys.stdin)
cut, moved = data["cut"], data["moved"]
assert cut in (24, 30, 36)
native = {body["id"]: body for body in data["native"]}
studio = {body["key"]: body for body in data["studio"]}
dy = 40 if moved else 0
boxes = [("n2/0", "b2_negative", (0,0,0), (cut,30,10)),
         ("n3" if moved else "n2/1", "b3" if moved else "b2_positive", (cut,dy,0), (60,dy+30,10))]
assert set(native) == {row[0] for row in boxes} and set(studio) == {row[1] for row in boxes}

def close(actual, expected):
    assert math.isfinite(actual) and abs(actual - expected) < 1e-8, (actual, expected)

def vec(actual, expected):
    for a,b in zip(actual, expected, strict=True):
        close(a,b)

total = 0
for id, key, lo, hi in boxes:
    body = native[id]
    assert body["key"] == key and body["check"]["valid"] and body["closed"] == [True]
    counts = body["check"]["counts"]
    assert [counts[k] for k in ("bodies","shells","faces","vertices")] == [1,1,6,8]
    assert body["method"] in ("closed-form", "planar-exact")
    corners = sorted(itertools.product(*zip(lo,hi,strict=True)))
    for got,want in zip(sorted(body["vertices"]), corners, strict=True):
        vec(got,want)
    assert all(face["geometry"]["kind"] == "plane" for face in body["faces"])
    for axis,(a,b) in enumerate(zip(lo,hi,strict=True)):
        for pos,sign in ((a,-1),(b,1)):
            normal = [sign if k == axis else 0 for k in range(3)]
            planes = [face["geometry"] for face in body["faces"]
                      if all(abs(x-y) < 1e-8 for x,y in zip(face["geometry"]["n"],normal,strict=True))]
            assert len(planes) == 1
            close(planes[0]["o"][axis],pos)
    volume = math.prod(b-a for a,b in zip(lo,hi,strict=True))
    centre = [(a+b)/2 for a,b in zip(lo,hi,strict=True)]
    total += volume
    for result in (body,studio[key]):
        close(result["volume"],volume)
        vec(result["centroid"],centre)
assert total == 18000
print(json.dumps({"status": "PASS", "cutMm": cut, "positiveMovedMm": dy, "totalVolumeMm3": total,
                  "nativeOutputIds": [row[0] for row in boxes], "studioBodyKeys": [row[1] for row in boxes]}))
`,
});
const button = (parent, label) => parent.getByRole('button', { name: label, exact: true });
async function observe(label, cut, moved = true) {
  f.phase = label;
  await f.same(expected(cut, moved));
  const state = await f.snapshot(label);
  const native = await f.inspect(label + '-native', state.doc);
  await f.runOracle({ cut, moved, native, studio: state.bodies.bodies }, label);
  return state;
}
async function preview(label, field, value) {
  const hud = f.page.getByRole('dialog', { name: label, exact: true });
  await hud.getByLabel(field, { exact: true }).fill(String(value));
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent?.trim() === 'preview');
  await button(hud, 'Apply').click();
  await hud.waitFor({ state: 'hidden' });
}
async function selectBody(point, key) {
  await f.page.keyboard.press('Escape');
  const projected = await f.page.evaluate(point => window.__studioScreenOf(point), point);
  assert.ok(projected?.length === 2 && projected.every(Number.isFinite));
  await f.page.mouse.click(...projected);
  await f.page.waitForFunction(() => window.__studioSelection?.selection.bodies.length === 1);
  const picked = await f.page.evaluate(() => window.__studioSelection.selection.bodies[0]);
  assert.equal((await f.bodies()).bodies[picked].key, key);
}
const cutField = () => f.editor().getByRole('spinbutton', { name: 'At', exact: true });
async function editCut(before, at) {
  await f.openFeatureEditor(2, 'Split plane');
  assert.equal(Number(await cutField().inputValue()), before);
  await cutField().fill(String(at));
  await button(f.editor(), 'Apply').click();
  await f.same(expected(at, true));
  await f.closeEditor();
}
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const project = 'D788 Split sides ' + randomUUID();
async function openProject() {
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await versions().getByLabel('Project', { exact: true }).waitFor();
}

await f.run(async () => {
  await f.newPage();
  await f.openFile(file, 2);
  await f.same(stock);
  f.phase = 'author the interior X Split';
  await f.page.locator('.views').getByRole('button', { name: 'Top', exact: true }).click();
  await f.page.keyboard.press('f');
  const filter = f.page.getByRole('button', { name: 'Selection filter', exact: true });
  for (let attempt = 0; attempt < 4 && !(await filter.innerText()).includes('Bodies'); attempt++) await filter.click();
  assert.ok((await filter.innerText()).includes('Bodies'));
  await selectBody([30, 15, 10], 'b1');
  await clickModelCommand(f.page, 'Modify', 'Split');
  await preview('Split', 'At', 24);
  await observe('01-two-authored-sides', 24, false);

  f.phase = 'select and move the positive side only';
  await selectBody([42, 15, 10], 'b2_positive');
  await f.page.keyboard.press('g');
  await preview('Move', 'ΔY', 40);
  await observe('02-positive-side-moved', 24);

  await editCut(24, 30);
  const accepted = await observe('03-edited-split-retains-move', 30);
  await f.openFeatureEditor(2, 'non-crossing Split refusal');
  f.phase = 'refuse a plane tangent to the stock';
  await cutField().fill('60');
  await button(f.editor(), 'Apply').click();
  const refusal = f.editor().locator('.hud-error');
  await refusal.getByText('Kernel detail', { exact: true }).click();
  await refusal.getByText(/split plane x = 60 does not cross the target/i).waitFor();
  const invalid = await f.inspect('04-tangent-native', expected(60, true), 'refusal');
  assert.deepEqual([invalid.code, invalid.feature], ['SELECTION', 'n2']);
  await f.same(accepted.doc);
  const refused = await f.snapshot('04-tangent-refused');
  assert.deepEqual(refused.bodies.bodies, accepted.bodies.bodies);
  assert.deepEqual(refused.history, accepted.history);
  await f.closeEditor();
  f.report.observations.push({ refusal: invalid });

  await f.undo();
  await observe('05-first-undo', 24);
  await f.redo();
  await observe('06-first-redo', 30);

  f.phase = 'save both outputs and their authored source in the project';
  await openProject();
  assert.equal(await f.page.locator('.doc-tab input').inputValue(), name);
  await button(f.page, 'Save').click();
  const path = name + '.bcad';
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(path, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, path]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    return Array.from(new Uint8Array(await (await (await directory.getFileHandle(path)).getFile()).arrayBuffer()));
  }, [project, path]));
  assert.deepEqual(JSON.parse(bytes), accepted.doc);
  await writeFile(join(output, 'split-sides-project-save.bcad'), bytes);

  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  assert.notDeepEqual(await f.doc(), accepted.doc);
  await openProject();
  await button(versions(), 'Open ' + path).click();
  await observe('07-project-open', 30);
  await editCut(30, 36);
  await observe('08-post-open-split-edit', 36);
  f.report.observations.push({ savedBytes: bytes.length, savedSHA256: sha256(bytes), finalCutMm: 36 });
  assert.deepEqual(f.report.downloads, []);
});

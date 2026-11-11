import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { builderFiles, cases } from './b03-depth-category-oracles.mjs';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2];
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'), 'Use an external evidence directory');
const { seedText, seedBytes, seedSHA256 } = cases.counterbore;
assert.equal(Buffer.byteLength(seedText), seedBytes);
assert.equal(sha256(seedText), seedSHA256);
const original = JSON.parse(seedText);

const oracleSource = String.raw`
import json
import math
import re
import sys
import xml.etree.ElementTree as ET

data = json.load(sys.stdin)
root = ET.fromstring(data['svg'])
ns = '{http://www.w3.org/2000/svg}'
assert root.tag == ns + 'svg'
assert (root.get('width'), root.get('height'), root.get('viewBox')) == ('297mm', '210mm', '0 0 297 210')
index, depth = data['index'], data['depth']
texts = [e.text or '' for e in root.iter(ns + 'text')]
assert f'{index} OF 2 A4' in texts, texts
groups = list(root.iter(ns + 'g'))
views = [g.get('data-view') for g in groups if g.get('class') == 'view']
callouts = [' '.join(t.split()) for t in texts if 'CBORE' in t]
if index == 1:
    assert 'front' in views and 'top' not in views, views
    assert not callouts, callouts
    result = dict(status='PASS', sheet=index, views=views, callouts=callouts)
else:
    assert views == ['top'], views
    expected = f'Ø4 THRU CBORE Ø8 × {depth} DEEP'
    assert callouts == [expected], callouts
    assert '1:1' in texts and 'mm' in texts, texts
    owner, = [g for g in groups if g.get('class') == 'dimension' and any(
        ' '.join((t.text or '').split()) == expected for t in g.iter(ns + 'text')
    )]
    assert owner.get('data-view') == 'top' and owner.get('data-dim'), owner.attrib
    top, = [g for g in groups if g.get('class') == 'view']
    radii = {tuple(map(float, pair)) for p in top.findall(ns + 'path')
             for pair in re.findall(r'A([0-9.]+) ([0-9.]+) ', p.get('d', ''))}
    assert radii == {(2, 2), (4, 4)}, radii
    segments = top.findall(ns + 'line')
    xs = [float(s.get(k)) for s in segments for k in ('x1', 'x2')]
    ys = [float(s.get(k)) for s in segments for k in ('y1', 'y2')]
    assert math.isclose(max(xs) - min(xs), 80, abs_tol=0.0001, rel_tol=0)
    assert math.isclose(max(ys) - min(ys), 40, abs_tol=0.0001, rel_tol=0)
    result = dict(status='PASS', sheet=index, views=views, callouts=callouts,
                  id=owner.get('data-dim'), paperRadiiMm=sorted(radii))
print(json.dumps(result))
`;

const f = await createFlow({
  name: 'two-sheet-counterbore-svg',
  envFrozen: 'D675_SOURCE_FROZEN',
  qualification: 'D675 current-sheet SVG with one depth-edited counterbore callout',
  output,
  oracleSource,
  initialFiles: [
    'apps/cad-studio/test/two-sheet-counterbore-svg-browser.mjs', ...builderFiles,
    'packages/barocss-cad-model/src/drawing/sheets.ts', 'packages/barocss-cad-model/src/drawing/sheet.ts',
    'packages/barocss-cad-model/src/drawing/dimensions.ts', 'packages/barocss-cad-model/src/io/svg.ts',
    'packages/barocss-cad-model/src/app/editFields.ts',
  ],
  limits: ['Two A4 sheets, millimetres, one Top-view counterbore, one depth edit.'],
});

async function captureSheet(index, depth) {
  const label = `depth-${depth}-sheet-${index}`;
  f.phase = label;
  const tabs = f.page.getByRole('tablist', { name: 'Sheets', exact: true });
  await tabs.getByRole('tab', { name: `Sheet ${index}`, exact: true }).click();
  const sheet = f.page.getByLabel('Drawing sheet', { exact: true });
  await sheet.getByText(`${index} OF 2 A4`, { exact: true }).waitFor();
  const state = await f.snapshot(label);
  assert.equal(state.doc.nodes[3].depth, depth);
  assert.equal(state.bodies.bodies.length, 1);
  assert.ok(state.bodies.fresh && state.bodies.massReady);
  const [body] = state.bodies.bodies;
  const block = 80 * 40 * 12;
  const pilot = Math.PI * 2 ** 2 * 12;
  const recess = Math.PI * (4 ** 2 - 2 ** 2) * depth;
  const expectedVolume = block - pilot - recess;
  const expectedZ = ((block - pilot) * 6 - recess * (12 - depth / 2)) / expectedVolume;
  assert.equal(body.key, 'b3');
  assert.ok(Math.abs(body.volume - expectedVolume) < 1e-8, body.volume);
  [20, 0, expectedZ].forEach((value, k) => assert.ok(Math.abs(body.centroid[k] - value) < 1e-9));

  const [download] = await Promise.all([
    f.page.waitForEvent('download', { timeout: 30000 }),
    f.page.getByRole('button', { name: 'Export SVG', exact: true }).click(),
  ]);
  const filename = await f.page.locator('.doc-tab input').inputValue();
  assert.equal(download.suggestedFilename(), `${filename}-sheet-${index}.svg`);
  const file = join(output, `${label}.svg`);
  await download.saveAs(file);
  const bytes = await readFile(file);
  const result = await f.runOracle({ svg: bytes.toString('utf8'), index, depth }, label);
  f.report.files.push({ label, bytes: bytes.length, sha256: sha256(bytes), result });
  await f.persist();
  return result;
}

await f.run(async () => {
  const seed = join(output, 'counterbore.bcad');
  await writeFile(seed, seedText);
  f.report.seedSHA256 = seedSHA256;
  await f.newPage();
  await f.page.setViewportSize({ width: 1440, height: 900 });
  f.phase = 'Open exact counterbore seed';
  await f.openFile(seed, 4);
  assert.deepEqual(await f.doc(), original);
  const drawing = f.page.getByRole('button', { name: 'Drawing', exact: true });
  await drawing.click();

  f.phase = 'Auto-dimension and prepare Top sheet';
  await f.page.getByRole('button', { name: 'Auto-dimension', exact: true }).click();
  await f.changed(original);
  const add = f.page.getByRole('tablist', { name: 'Sheets', exact: true })
    .getByRole('button', { name: 'Add sheet', exact: true });
  await add.click();
  const panel = f.page.locator('details[aria-label="Sheets"]');
  if (!(await panel.evaluate(element => element.open))) await panel.locator('summary').click();
  await panel.getByLabel('Move Top view to sheet', { exact: true }).selectOption('2');
  const settings = f.page.getByRole('complementary', { name: 'Drawing settings', exact: true });
  await settings.getByLabel('Scale', { exact: true }).selectOption('1');
  await f.page.waitForFunction(() => {
    const sheet = window.__studioDoc?.drawing?.sheets?.[0];
    return sheet?.scale === 1 && sheet.views.includes('top');
  });
  const before = await f.doc();
  await captureSheet(1, 4);
  const initial = await captureSheet(2, 4);

  f.phase = 'edit counterbore depth 4 to 2';
  await f.page.getByRole('button', { name: 'Model', exact: true }).click();
  await f.openFeatureEditor(3, 'counterbore');
  const depth = f.editor().getByLabel('Depth', { exact: true });
  assert.equal(await depth.inputValue(), '4');
  await depth.fill('2');
  await f.applyEditor(before, 'depth-edited');
  const after = await f.doc();
  const nodes = structuredClone(before.nodes);
  nodes[3].depth = 2;
  assert.deepEqual(after.nodes, nodes);
  assert.deepEqual(after.outputs, before.outputs);
  await drawing.click();
  await captureSheet(1, 2);
  const edited = await captureSheet(2, 2);
  assert.equal(edited.id, initial.id);
  assert.equal(f.report.downloads.length, 4);
  f.phase = 'complete';
});

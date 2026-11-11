import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const oracleSource = String.raw`
import json
import math
import re
import sys
import xml.etree.ElementTree as ET

data = json.load(sys.stdin)
sheet = ET.fromstring(data['svg'])
ns = '{http://www.w3.org/2000/svg}'
assert sheet.tag == ns + 'svg'
assert (sheet.get('width'), sheet.get('height'), sheet.get('viewBox')) == ('297mm', '210mm', '0 0 297 210')
groups = sheet.findall('.//' + ns + 'g')
views = [g.get('data-view') for g in groups if g.get('class') == 'view']
notes = [g for g in groups if g.get('class') == 'note']
labels = [t for t in sheet.iter(ns + 'text') if t.text == 'D674 LEADER']
index = data['index']
owner = data['owner']
expected_views = (['front', 'top'] if owner == 1 else ['front']) if index == 1 else (['top'] if owner == 2 else [])
assert sorted(views) == sorted(expected_views), views
assert len(labels) == len(notes) == int(index == owner), (index, owner, views, len(notes), len(labels))

def near(actual, expected):
    assert math.isclose(actual, expected, abs_tol=0.0001, rel_tol=0), (actual, expected)

def line(element):
    return tuple(tuple(float(element.get(axis + suffix)) for axis in ('x', 'y')) for suffix in ('1', '2'))

result = dict(status='PASS', sheet=index, views=views, noteCount=len(notes))
if index == owner:
    top, = [g for g in groups if g.get('class') == 'view' and g.get('data-view') == 'top']
    outline = [line(e) for e in top.findall(ns + 'line') if not e.get('stroke-dasharray')]
    assert outline, list(top)
    xs, ys = zip(*(p for segment in outline for p in segment))
    left, right, upper, lower = min(xs), max(xs), min(ys), max(ys)
    scale = {1: 2, 2: 5}[index]
    near(right - left, 30 * scale)
    near(lower - upper, 12 * scale)
    # The authored point is 10 mm from the left and 3 mm above the bottom of the Top rectangle.
    tip = (left + 10 * scale, lower - 3 * scale)
    note, = notes
    text, = note.findall(ns + 'text')
    assert text is labels[0]
    near(float(text.get('font-size')), 3.5)
    shoulder, leader = map(line, note.findall(ns + 'line'))
    near(shoulder[0][1], shoulder[1][1])
    near(abs(shoulder[0][0] - shoulder[1][0]), 3)
    assert shoulder[1] == leader[0], (shoulder, leader)
    path, = note.findall(ns + 'path')
    assert path.get('fill') == '#000'
    shape = re.fullmatch(r'M([^LZ]+)L([^LZ]+)L([^LZ]+)Z', path.get('d'))
    assert shape, path.attrib
    arrow = [tuple(map(float, pair.split())) for pair in shape.groups()]
    for point in (leader[1], arrow[0]):
        for actual, expected in zip(point, tip):
            near(actual, expected)
    assert math.dist(arrow[1], arrow[2]) > 1
    assert all(math.dist(tip, p) > 1 for p in arrow[1:])
    result.update(outlineMm=[right - left, lower - upper], arrowTipMm=arrow[0])
print(json.dumps(result))
`;

const output = process.argv[2];
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'), 'Use an external evidence directory');
const fixture = 'apps/cad-studio/test/fixtures/bracket.bcad';
const note = { id: 'n674', text: 'D674 LEADER', at: [20, 20], leader: { view: 'top', at: [10, 3] } };
const model = JSON.parse(await readFile(resolve(repo, fixture), 'utf8'));
const seed = {
  ...model,
  drawing: {
    sheet: 'A4', scope: { kind: 'part' }, scale: 2, projection: 'third', hidden: false, centers: false,
    dimensions: [], views: ['front', 'top'],
    sheets: [{ id: 'S2', name: 'Sheet 2', size: 'A4', scale: 5, views: ['top'] }],
    notes: [note],
  },
};

const f = await createFlow({
  name: 'two-sheet-leader-svg',
  envFrozen: 'D674_SOURCE_FROZEN',
  qualification: 'D674 current-sheet SVG after moving an existing Top-view leader',
  output,
  oracleSource,
  initialFiles: [
    'apps/cad-studio/test/two-sheet-leader-svg-browser.mjs', fixture,
    'packages/barocss-cad-model/src/drawing/sheets.ts', 'packages/barocss-cad-model/src/drawing/views.ts',
    'packages/barocss-cad-model/src/drawing/sheet.ts', 'packages/barocss-cad-model/src/io/svg.ts',
  ],
  limits: ['Fresh authored seed, two A4 sheets, plain mm, one rectangular solid and one Top-view leader.'],
});

function checkBody(worker) {
  assert.equal(worker.fresh, true);
  assert.equal(worker.massReady, true);
  assert.equal(worker.bodies.length, 1);
  const [body] = worker.bodies;
  assert.equal(body.key, 'b1');
  assert.ok(Math.abs(body.volume - 30 * 12 * 6) < 1e-8, body.volume);
  [15, 6, 3].forEach((expected, axis) => assert.ok(Math.abs(body.centroid[axis] - expected) < 1e-8));
}

async function captureSheet(label, index, owner, exportFile) {
  f.phase = label;
  const tab = f.page.getByRole('tablist', { name: 'Sheets', exact: true })
    .getByRole('tab', { name: `Sheet ${index}`, exact: true });
  await tab.click();
  const sheet = f.page.getByLabel('Drawing sheet', { exact: true });
  await sheet.getByText(`${index} OF 2 A4`, { exact: true }).waitFor();
  const state = await f.snapshot(label, () => {
    const svg = document.querySelector('svg[aria-label="Drawing sheet"]');
    return {
      topCount: svg.querySelectorAll('g.view[data-view="top"]').length,
      noteCount: svg.querySelectorAll('g.note[data-dim="n674"]').length,
    };
  });
  assert.equal(state.topCount, Number(index === owner));
  assert.equal(state.noteCount, Number(index === owner));
  checkBody(state.bodies);
  if (!exportFile) return;

  const [download] = await Promise.all([
    f.page.waitForEvent('download', { timeout: 30000 }),
    f.page.getByRole('button', { name: 'Export SVG', exact: true }).click(),
  ]);
  const filename = await f.page.locator('.doc-tab input').inputValue();
  assert.equal(download.suggestedFilename(), `${filename}-sheet-${index}.svg`);
  const file = join(output, `${label}.svg`);
  await download.saveAs(file);
  const bytes = await readFile(file);
  const result = await f.runOracle({ svg: bytes.toString('utf8'), index, owner }, label, { expectedStatus: 'PASS' });
  f.report.files.push({ label, bytes: bytes.length, sha256: sha256(bytes), result });
  await f.persist();
}

await f.run(async () => {
  const seedFile = join(output, 'leader-two-sheets.bcad');
  const seedBytes = JSON.stringify(seed);
  await writeFile(seedFile, seedBytes);
  f.report.seedSHA256 = sha256(seedBytes);
  await f.newPage();
  await f.page.setViewportSize({ width: 1440, height: 900 });
  f.phase = 'open seeded drawing';
  await f.openFile(seedFile, 2);
  const before = await f.doc();
  assert.deepEqual(before.drawing, seed.drawing);
  await f.page.getByRole('button', { name: 'Drawing', exact: true }).click();

  await captureSheet('before-sheet-1', 1, 2, true);
  await captureSheet('before-sheet-2', 2, 2, true);
  f.phase = 'move Top to sheet 1';
  const panel = f.page.locator('details[aria-label="Sheets"]');
  if (!(await panel.evaluate(element => element.open))) await panel.locator('summary').click();
  await panel.getByLabel('Move Top view to sheet', { exact: true }).selectOption('1');
  await f.changed(before);
  const moved = await f.doc();
  const expected = structuredClone(before);
  expected.drawing.sheets[0].views = [];
  assert.deepEqual(moved, expected);

  await captureSheet('moved-sheet-1', 1, 1, true);
  await captureSheet('moved-sheet-2', 2, 1, true);
  f.phase = 'first Undo';
  await f.undo();
  await f.same(before);
  await captureSheet('undo-sheet-1', 1, 2, false);
  await captureSheet('undo-sheet-2', 2, 2, false);
  f.phase = 'first Redo';
  await f.redo();
  await f.same(moved);
  await captureSheet('redo-sheet-1', 1, 1, false);
  await captureSheet('redo-sheet-2', 2, 1, false);
  assert.equal(f.report.downloads.length, 4);
  f.phase = 'complete';
});

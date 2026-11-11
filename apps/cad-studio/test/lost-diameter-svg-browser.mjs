import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2];
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'), 'Use an external evidence directory');
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [-20, -20], max: [60, 20], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 10, id: 'n1' },
    {
      kind: 'hole', parent: { node: 1, side: 'solid' }, face: 'n1.top',
      center: [28, 0], radius: 2, pattern: { count: 4, about: [20, 0] }, id: 'n2',
    },
  ],
  outputs: { b2: { node: 2, side: 'solid' } }, nextId: 3,
  drawing: {
    sheet: 'A4', scope: { kind: 'part' }, scale: 1, projection: 'third',
    hidden: false, centers: false, dimensions: [], views: ['front', 'top'],
  },
};

const oracleSource = String.raw`
import json
import math
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict

data = json.load(sys.stdin)
root = ET.fromstring(data['svg'])
ns = '{http://www.w3.org/2000/svg}'
assert root.tag == ns + 'svg'
assert (root.get('width'), root.get('height'), root.get('viewBox')) == ('297mm', '210mm', '0 0 297 210')
texts = [e.text or '' for e in root.iter(ns + 'text')]
source, = [t for t in texts if t.startswith('SRC ')]
assert re.fullmatch(r'SRC [0-9a-f]{16}', source), source
assert 'mm' in texts and '1:1' in texts, texts
groups = list(root.iter(ns + 'g'))
views = [g for g in groups if g.get('class') == 'view']
top, = [g for g in views if g.get('data-view') == 'top']
segments = top.findall(ns + 'line')
xs = [float(s.get(k)) for s in segments for k in ('x1', 'x2')]
ys = [float(s.get(k)) for s in segments for k in ('y1', 'y2')]
assert math.isclose(max(xs) - min(xs), 80, abs_tol=0.0001, rel_tol=0)
assert math.isclose(max(ys) - min(ys), 40, abs_tol=0.0001, rel_tol=0)
arcs = [p.get('d', '') for p in top.findall(ns + 'path') if 'A' in p.get('d', '')]
groups_by_id = {g.get('data-dim'): g for g in groups if g.get('class') == 'dimension'}
for dimension_id in data['controls']:
    assert dimension_id in groups_by_id, (dimension_id, list(groups_by_id))
target = data['target']
labels = [' '.join(t.split()) for t in texts if 'THRU' in t]
if data['active']:
    assert len(arcs) == 8, arcs
    num = r'(-?[0-9]+(?:\.[0-9]+)?)'
    pattern = rf'M{num} {num}A{num} {num} {num} 0 ([01]) {num} {num}'
    circles = defaultdict(list)
    for arc in arcs:
        parsed = re.fullmatch(pattern, arc)
        assert parsed, arc
        x0, y0, rx, ry, rotation, sweep, x1, y1 = map(float, parsed.groups())
        assert rx == ry == 2 and rotation == 0 and y0 == y1 and abs(x1 - x0) == 4, arc
        center = ((x0 + x1) / 2, y0)
        circles[center].append((x0, x1, sweep))
    expected_centers = {(min(xs) + 40 + dx, min(ys) + 20 + dy)
                        for dx, dy in ((8, 0), (-8, 0), (0, 8), (0, -8))}
    assert len(circles) == 4 and set(circles) == expected_centers, circles
    for pieces in circles.values():
        (start, end, sweep), opposite = pieces
        assert opposite == (end, start, sweep), pieces
    assert groups_by_id[target].get('data-view') == 'top'
    label, = groups_by_id[target].iter(ns + 'text')
    assert ' '.join((label.text or '').split()) == '4× Ø4 THRU', label.text
    assert labels == ['4× Ø4 THRU'], labels
else:
    assert not arcs, arcs
    assert target not in groups_by_id and not labels, (list(groups_by_id), labels)
print(json.dumps(dict(status='PASS', source=source, borePaths=len(arcs), dimensionPresent=target in groups_by_id)))
`;

const f = await createFlow({
  name: 'lost-diameter-svg',
  envFrozen: 'D676_SOURCE_FROZEN',
  qualification: 'D676 current SVG after public Hole suppression and first Undo',
  output,
  oracleSource,
  initialFiles: [
    'apps/cad-studio/test/lost-diameter-svg-browser.mjs',
    'packages/barocss-cad-model/src/drawing/sheet.ts', 'packages/barocss-cad-model/src/io/svg.ts',
    'packages/barocss-cad-model/src/drawing/dimensions.ts', 'packages/barocss-cad-model/src/drawing/issues.ts',
  ],
  limits: ['A fresh 80 × 40 × 10 mm part, four nominal Ø4 bores, one A4 sheet at 1:1.'],
});

const model = () => f.page.getByRole('button', { name: 'Model', exact: true }).click();
async function drawing() {
  await f.page.getByRole('button', { name: 'Drawing', exact: true }).click();
  await f.page.getByLabel('Drawing sheet', { exact: true }).locator('g.view[data-view="top"]').waitFor();
}

async function exportState(label, dimension, controls, active) {
  f.phase = label;
  await f.ready();
  const state = await f.snapshot(label, () => ({ drawingSummary: window.__studioDrawing?.() }));
  assert.equal(Boolean(state.doc.nodes[2].suppressed), !active);
  assert.equal(state.bodies.bodies.length, 1);
  const [body] = state.bodies.bodies;
  const volume = 80 * 40 * 10 - (active ? 4 * Math.PI * 2 ** 2 * 10 : 0);
  assert.ok(Math.abs(body.volume - volume) < 1e-8, body.volume);
  [20, 0, 5].forEach((expected, k) => assert.ok(Math.abs(body.centroid[k] - expected) < 1e-9));
  const stored = state.doc.drawing.dimensions.find(d => d.id === dimension.id);
  assert.equal(stored.edge, dimension.edge);
  assert.deepEqual(stored.near, dimension.near);
  assert.deepEqual(stored.place, dimension.place);
  const observed = state.drawingSummary.dimensions.find(d => d.id === dimension.id);
  assert.ok(observed, 'The authored dimension remains in the drawing summary');
  if (active) {
    assert.ok(Math.abs(observed.value - 4) < 1e-9, observed.value);
    assert.equal(observed.text.replace(/\s+/g, ' '), '4× Ø4 THRU');
  } else {
    assert.ok(observed.lost);
    assert.ok(state.drawingSummary.issues.some(issue => issue.code === 'DIMENSION_LOST'));
  }

  const [download] = await Promise.all([
    f.page.waitForEvent('download', { timeout: 30000 }),
    f.page.getByRole('button', { name: 'Export SVG', exact: true }).click(),
  ]);
  const filename = await f.page.locator('.doc-tab input').inputValue();
  assert.equal(download.suggestedFilename(), `${filename}.svg`);
  const file = join(output, `${label}.svg`);
  await download.saveAs(file);
  const bytes = await readFile(file);
  const result = await f.runOracle({ svg: bytes.toString('utf8'), target: dimension.id, controls, active }, label);
  f.report.files.push({ label, bytes: bytes.length, sha256: sha256(bytes), result });
  await f.persist();
  return result;
}

await f.run(async () => {
  const path = join(output, 'diameter-loss.bcad');
  const bytes = JSON.stringify(seed);
  await writeFile(path, bytes);
  f.report.seedSHA256 = sha256(bytes);
  await f.newPage();
  await f.page.setViewportSize({ width: 1440, height: 900 });
  f.phase = 'open and Auto-dimension';
  await f.openFile(path, 3);
  const opened = await f.doc();
  await drawing();
  await f.page.getByRole('button', { name: 'Auto-dimension', exact: true }).click();
  await f.changed(opened);
  const before = await f.doc();
  const dimensions = before.drawing.dimensions;
  const diameter = dimensions.filter(d => d.kind === 'diameter' && d.view === 'top');
  assert.equal(diameter.length, 1);
  const [dimension] = diameter;
  const controls = dimensions.filter(d => d.kind === 'linear' && d.view === 'front').map(d => d.id);
  assert.ok(controls.length > 0);
  const active = await exportState('01-active', dimension, controls, true);

  f.phase = 'public Hole suppression';
  await model();
  await f.page.locator('.history .hs[data-node-index="2"]').click({ button: 'right' });
  await f.page.getByRole('menuitem', { name: 'Suppress', exact: true }).click();
  await f.changed(before);
  await drawing();
  const lost = await exportState('02-lost', dimension, controls, false);
  assert.notEqual(lost.source, active.source);

  f.phase = 'first Undo';
  await model();
  await f.undo();
  await f.same(before);
  await drawing();
  const restored = await exportState('03-restored', dimension, controls, true);
  assert.deepEqual(restored, active);
  assert.equal(f.report.downloads.length, 3);
  f.phase = 'complete';
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const baseline = process.argv.includes('--baseline');
const pins = [
  'apps/cad-studio/test/three-mf-solid-pieces-browser.mjs',
  'apps/cad-studio/src/files/useModelExports.ts',
  'packages/barocss-cad-model/src/print/export3mf.ts',
  'packages/barocss-cad-model/src/print/threemf.ts',
];
const oracleSource = String.raw`import json, sys, zipfile, xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from itertools import pairwise

data = json.load(sys.stdin)
with zipfile.ZipFile(data['file']) as archive:
    assert archive.testzip() is None
    model = ET.fromstring(archive.read('3D/3dmodel.model'))
ns = {'m': 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'}
assert model.get('unit') == 'millimeter'
objects = model.findall('m:resources/m:object', ns)
items = model.findall('m:build/m:item', ns)
assert len(objects) == len(items) == data['objects']
assert sorted(i.get('objectid') for i in items) == sorted(o.get('id') for o in objects)
assert all(i.get('transform') is None for i in items)
components = []
triangle_count = 0
for obj in objects:
    vertices = [tuple(float(v.get(a)) for a in ('x', 'y', 'z')) for v in obj.findall('m:mesh/m:vertices/m:vertex', ns)]
    triangles = [tuple(int(t.get(k)) for k in ('v1', 'v2', 'v3')) for t in obj.findall('m:mesh/m:triangles/m:triangle', ns)]
    triangle_count += len(triangles)
    sharing = defaultdict(list)
    edges = Counter()
    for i, triangle in enumerate(triangles):
        assert len(set(triangle)) == 3 and all(0 <= v < len(vertices) for v in triangle)
        for a, b in pairwise((*triangle, triangle[0])):
            edges[a, b] += 1
            sharing[tuple(sorted((a, b)))].append(i)
    assert all(n == 1 and edges[b, a] == 1 for (a, b), n in edges.items())
    neighbors = defaultdict(set)
    for a, b in sharing.values():
        neighbors[a].add(b)
        neighbors[b].add(a)
    todo = set(range(len(triangles)))
    while todo:
        stack = [todo.pop()]
        indices = []
        while stack:
            i = stack.pop()
            indices.append(i)
            added = todo.intersection(neighbors[i])
            todo.difference_update(added)
            stack.extend(added)
        points = {vertices[j] for i in indices for j in triangles[i]}
        signed_size = 0
        for i in indices:
            a, b, c = (vertices[j] for j in triangles[i])
            signed_size += sum(a[k] * (b[(k+1)%3] * c[(k+2)%3] - b[(k+2)%3] * c[(k+1)%3]) for k in range(3))
        components.append({'min': [min(p[k] for p in points) for k in range(3)], 'max': [max(p[k] for p in points) for k in range(3)],
                           'volume': signed_size / 6, 'triangles': len(indices)})
components.sort(key=lambda component: component['min'])
assert len(components) == len(data['expected'])
for actual, expected in zip(components, data['expected']):
    assert [actual['min'], actual['max']] == expected[:2] and abs(actual['volume'] - expected[2]) < 1e-7, (actual, expected)
print(json.dumps({'status': 'PASS', 'objects': len(objects), 'items': len(items), 'triangles': triangle_count, 'components': components}))
`;
const f = await createFlow({
  name: 'three-mf-solid-pieces', output: process.argv[2], envFrozen: 'D1156_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins, oracleSource,
  qualification: 'Report separate solid pieces while preserving the 3MF mesh objects.',
  limits: ['Desktop Chrome and three exact upright rectangular Join cases with face contact, edge contact and a 2 mm gap.',
    'Local Python ZIP/XML checks mesh closure, millimetres, bounds, components and oriented volume without product imports.'],
});
const ref = node => ({ node, side: 'solid' });
const seed = x => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 5,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 5 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [x, 0], max: [x + 10, 10], on: ref(1),
      plane: { origin: [0, 0, 5], normal: [0, 0, 1], xAxis: [1, 0, 0] } },
    { id: 'n3', kind: 'extrude', sketch: 2, height: 5 },
    { id: 'n4', kind: 'union', left: ref(1), right: ref(3) },
  ],
  outputs: { b4: ref(4) },
});
const button = name => f.page.getByRole('button', { name, exact: true });
const original = '3MF written: 1 body, 24 triangles';
const corrected = '3MF written: 1 object, 24 triangles';
const hint = '1 3MF object contains 2 separate solid pieces.';

await f.run(async () => {
  await f.newPage();
  for (const [label, x, objects] of [['face-contact', 0, 1], ['edge-contact', 10, 2], ['separated', 12, 1]]) {
    f.phase = 'Open and export ' + label;
    const source = seed(x);
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: `D1156-${label}.bcad`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
    await f.same(source);
    await f.dismissToasts();
    const [download] = await Promise.all([f.page.waitForEvent('download'), button('Export 3MF').click()]);
    assert.match(download.suggestedFilename(), /\.3mf$/);
    const file = join(f.output, label + '.3mf');
    await download.saveAs(file);
    f.report.files.push({ label, file, sha256: sha256(await readFile(file)) });
    const notice = await f.waitToast(/3MF written:/);
    await f.snapshot(label + '-exported');
    await f.same(source);
    const expected = x === 0 ? [[[0, 0, 0], [10, 10, 10], 1000]] : [
      [[0, 0, 0], [10, 10, 5], 500], [[x, 0, 5], [x + 10, 10, 10], 500],
    ];
    const oracle = await f.runOracle({ file, objects, expected }, label);
    f.report.observations.push({ label, notice, oracle });
    if (x !== 12) {
      assert.ok(notice.includes(x === 0 ? '3MF written: 1 body,' : '3MF written: 2 bodies, 24 triangles'));
      assert.ok(!notice.includes('separate solid pieces'));
    } else if (baseline) {
      assert.ok(notice.includes(original));
      assert.ok(!notice.includes(hint));
      assert.fail('The export notice calls two separate solid pieces one body');
    } else {
      assert.ok(notice.includes(corrected), notice);
      assert.ok(notice.includes(hint), notice);
    }
  }
});

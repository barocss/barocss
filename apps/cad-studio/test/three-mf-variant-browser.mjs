import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';
import { installD523PlacedReplyScheduler } from './placed-worker-reply-scheduler.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(mode === undefined || mode === '--loss-report');
const lossReport = mode === '--loss-report';
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'), 'Use an external evidence directory');

function box(width, depth, height, body, parameters = {}) {
  return {
    format: 'barocss-cad-model', schema: 3, units: 'mm', parameters,
    nodes: [
      { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [width, depth], id: 'n0' },
      { kind: 'extrude', sketch: 0, height, id: 'n1' },
    ],
    outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2, bodies: { b1: body },
  };
}

const part = box(30, 12, { parameter: 'Height' }, { name: 'Base plate', color: '#357ac4', material: 'al6061' }, { Height: 6 });
const master = {
  ...part,
  instances: [
    {
      id: 'cap', name: 'Cap', doc: box(4, 3, 4, { name: 'Block', color: '#ffffff', material: 'pla' }),
      position: [10, 2, 8], rotation: [0, 0, 0], looks: { b1: { color: '#d08036', material: 'steel' } },
    },
    {
      id: 'hidden', name: 'Hidden decoy', doc: box(2, 2, 2, { name: 'Decoy' }),
      position: [100, 100, 100], rotation: [0, 0, 0], hidden: true,
    },
  ],
  mates: [{ id: 'm1', kind: 'distance', distance: 2, a: { part: 'base', face: 'n1.top' }, b: { part: 'cap', face: 'n1.bottom' } }],
  variability: {
    version: 1,
    inputs: [
      { name: 'height', type: 'number', unit: 'mm', min: 1, max: 20, default: 6,
        bindings: [{ to: 'parameter', part: 'base', parameter: 'Height' }] },
      { name: 'gap', type: 'number', unit: 'mm', min: 0, max: 10, default: 2,
        bindings: [{ to: 'mate', mate: 'm1', field: 'distance' }] },
    ],
    variants: [{ name: 'Tall', values: { height: 9, gap: 5 } }],
  },
};

const oracleSource = String.raw`
from collections import Counter
from itertools import product
import hashlib
import json
import math
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

d = json.load(sys.stdin)
with zipfile.ZipFile(d['file']) as z:
    assert z.testzip() is None
    assert sorted(z.namelist()) == ['3D/3dmodel.model', '[Content_Types].xml', '_rels/.rels']
    xml = z.read('3D/3dmodel.model')
    root = ET.fromstring(xml)
    volatile = '{http://schemas.microsoft.com/3dmanufacturing/production/2015/06}UUID'
    content = {
        entry: hashlib.sha256(z.read(entry)).hexdigest()
        for entry in ('[Content_Types].xml', '_rels/.rels')
    }
    content['3D/3dmodel.model'] = hashlib.sha256(ET.canonicalize(xml, exclude_attrs={volatile}).encode()).hexdigest()

ns = {'c': 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'}
assert root.tag == '{' + ns['c'] + '}model' and root.get('unit') == 'millimeter'
def tag(name):
    return '{' + ns['c'] + '}' + name

assert Counter(x.tag for x in root) == {tag('metadata'): 3, tag('resources'): 1, tag('build'): 1}
metadata = {m.get('name'): m.text for m in root.findall('c:metadata', ns)}
assert metadata == {'Title': d['stem'], 'Application': 'BaroCSS Studio', 'barocss:SourceRevision': metadata['barocss:SourceRevision']}
source = metadata['barocss:SourceRevision']
assert re.fullmatch('[0-9a-f]{16}', source)
bases = {b.get('id'): b.findall('c:base', ns) for b in root.findall('c:resources/c:basematerials', ns)}
objects = root.findall('c:resources/c:object', ns)
items = root.findall('c:build/c:item', ns)
assert len(objects) == len(items) == d['count']
assert Counter(x.tag for x in root.find('c:resources', ns)) == {tag('basematerials'): 1, tag('object'): d['count']}
assert Counter(i.get('objectid') for i in items) == Counter(o.get('id') for o in objects)
assert all(item.get('transform') is None for item in items)

h = d['height']
expected = {'Base plate': ((0, 0, 0), (30, 12, h), 'Aluminium 6061', '#357AC4')}
if d['count'] == 2:
    z = h + d['gap']
    expected['Cap / Block'] = ((10, 2, z), (14, 5, z + 4), 'Steel (mild)', '#D08036')
assert {o.get('name') for o in objects} == expected.keys()
parts = {}
for o in objects:
    name = o.get('name')
    lo, hi, label, color = expected[name]
    assert o.get('type') == 'model' and [x.tag for x in o] == [tag('mesh')]
    material = bases[o.get('pid')][int(o.get('pindex'))]
    assert material.get('name') == label and material.get('displaycolor').upper() in (color, color + 'FF')
    vs = [tuple(float(v.get(a)) for a in ('x', 'y', 'z')) for v in o.findall('c:mesh/c:vertices/c:vertex', ns)]
    corners = list(product(*zip(lo, hi)))
    assert len(vs) == 8
    assert all(math.dist(p, q) <= 1e-6 for p, q in zip(sorted(vs), corners)), (name, vs, corners)
    triangles = o.findall('c:mesh/c:triangles/c:triangle', ns)
    assert len(triangles) == 12
    edges = Counter()
    terms = []
    for t in triangles:
        assert t.get('pid') is None
        a, b, c = (int(t.get(k)) for k in ('v1', 'v2', 'v3'))
        assert len({a, b, c}) == 3 and all(0 <= i < len(vs) for i in (a, b, c))
        edges.update(((a, b), (b, c), (c, a)))
        u, v, w = (tuple(value - origin for value, origin in zip(vs[i], lo)) for i in (a, b, c))
        cross = (v[1]*w[2] - v[2]*w[1], v[2]*w[0] - v[0]*w[2], v[0]*w[1] - v[1]*w[0])
        terms.append(math.fsum(a*b for a, b in zip(u, cross)) / 6)
    assert len(edges) == 36 and all(n == edges[b, a] == 1 for (a, b), n in edges.items())
    volume = math.fsum(terms)
    assert math.isclose(volume, math.prod(b-a for a, b in zip(lo, hi)), rel_tol=0, abs_tol=1e-6), (name, volume)
    parts[name] = dict(min=lo, max=hi, volume=volume, vertices=len(vs), triangles=len(triangles), material=label, color=color)

print(json.dumps(dict(status='PASS', unit=root.get('unit'), source=source, buildItems=len(items), parts=parts, content=content)))
`;

const f = await createFlow({
  name: 'three-mf-shown-variant', envFrozen: lossReport ? 'D690_SOURCE_FROZEN' : 'D688_SOURCE_FROZEN', output, oracleSource,
  qualification: lossReport ? 'D690 desktop 3MF loss disclosure for the shown assembly and standalone part'
    : 'D688 desktop 3MF from the shown assembly variant and refusal during pending placement',
  initialFiles: ['apps/cad-studio/test/model-rail-helper.mjs', 'apps/cad-studio/test/placed-worker-reply-scheduler.mjs'],
  requiredFrozen: ['apps/cad-studio/src/files/useModelExports.ts'],
  extraFrozen: ['packages/barocss-cad-model/src/print/export3mf.ts', 'packages/barocss-cad-model/src/print/threemf.ts',
    'packages/barocss-cad-model/src/assembly/variability.ts', 'packages/barocss-cad-model/src/library/builtin/materials.json'],
  snapshotExtra: () => ({ scheduler: window.__d523Placed.snapshot(), exportCount: window.__d688Exports.length }),
  limits: ['Two axis-aligned prismatic meshes, one hidden occurrence, one distance mate and one named variant.',
    'Real Export captured at the local Blob boundary. Python standard library reads the resulting package. No slicer run.'],
});

function captureThreeMf() {
  const create = URL.createObjectURL;
  const click = HTMLAnchorElement.prototype.click;
  const blobs = new Map();
  window.__d688Exports = [];
  URL.createObjectURL = function (blob) {
    const url = create.call(this, blob);
    if (blob.type === 'model/3mf') blobs.set(url, blob);
    return url;
  };
  HTMLAnchorElement.prototype.click = function () {
    const blob = blobs.get(this.href);
    if (!blob || !this.download.endsWith('.3mf')) return click.call(this);
    blobs.delete(this.href);
    const name = this.download;
    window.__d688Exports.push(blob.arrayBuffer().then(bytes => ({ name, bytes: Array.from(new Uint8Array(bytes)) })));
  };
}

const button = name => f.page.getByRole('button', { name, exact: true });
const variants = () => f.page.getByRole('complementary', { name: 'Variants panel', exact: true });
const exportCount = () => f.page.evaluate(() => window.__d688Exports.length);

async function exportShown(label, height, gap, index, authored, stem = 'three-mf-variant') {
  f.phase = label;
  const count = authored.instances ? 2 : 1;
  await f.ready();
  assert.deepEqual(await f.doc(), authored);
  assert.equal(await exportCount(), index);
  await button('Export 3MF').click();
  const notice = await f.waitToast(/3MF written|Not written yet|Could not write 3MF/);
  const summary = count === 2 ? '2 bodies, 24 triangles' : '1 body, 12 triangles';
  assert.match(notice, new RegExp(`3MF written: ${summary}.*As modelled.*on-screen mesh, in millimetres, with materials and colours`));
  assert.equal(await exportCount(), index + 1);
  const exported = await f.page.evaluate(i => window.__d688Exports[i], index);
  assert.equal(exported.name, `${stem}.3mf`);
  const bytes = Buffer.from(exported.bytes);
  const file = join(output, `${label}.3mf`);
  await writeFile(file, bytes, { flag: 'wx' });
  const result = await f.runOracle({ file, stem, count, height, gap }, label);
  f.report.observations.push({ label, notice, bytes: bytes.length, sha256: sha256(bytes), result });
  await f.snapshot(label);
  assert.deepEqual(await f.doc(), authored);
  await f.dismissToasts();
  return result;
}

async function openFixture(doc, stem) {
  const seed = Buffer.from(JSON.stringify(doc));
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: `${stem}.bcad`, mimeType: 'application/json', buffer: seed });
  await f.same(doc);
  return sha256(seed);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
      await context.addInitScript(installD523PlacedReplyScheduler);
      await context.addInitScript(captureThreeMf);
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
        return url.origin === origin ? route.continue() : route.abort();
      });
      return context;
    } catch (error) {
      await context.close();
      throw error;
    }
  };

  await f.newPage();
  await f.page.setViewportSize({ width: 1440, height: 900 });
  f.phase = 'Open assembly fixture';
  f.report.seedSHA256 = await openFixture(master, 'three-mf-variant');
  await clickModelCommand(f.page, 'Inspect', 'Variants');
  await variants().waitFor();

  const initial = await exportShown('01-master', 6, 2, 0, master);

  f.phase = 'Show Tall; hold its original native placement reply';
  await f.page.evaluate(() => window.__d523Placed.arm({ onlyPlaced: true }));
  await variants().getByRole('button', { name: 'Show Tall', exact: true }).click();
  await variants().getByLabel('Variant shown', { exact: true }).getByText('Tall', { exact: true }).waitFor();
  await f.page.waitForFunction(() => {
    const s = window.__d523Placed.snapshot();
    return s.claimed && s.events.some(e => e.kind === 'native-event-held' && e.id === s.claimed.id && e.resultOK === true);
  }, null, { timeout: 15000 });
  const held = await f.page.evaluate(() => window.__d523Placed.snapshot().claimed);
  [10, 2, 14].forEach((value, i) => assert.ok(Math.abs(held.place.t[i] - value) <= 1e-6, held.place.t));
  const tallDoc = { ...master, variability: { ...master.variability, active: 'Tall' } };
  assert.deepEqual(await f.doc(), tallDoc);

  f.phase = 'Refuse 3MF while Tall placement is pending';
  await f.ready();
  assert.ok(Math.abs((await f.bodies()).bodies[0].volume - 3240) <= 1e-6);
  await button('Export 3MF').click();
  const notice = await f.waitToast(/Not written yet|3MF written|Could not write 3MF/);
  assert.match(notice, /Not written yet.*every visible placed part must be up to date/);
  assert.equal(await exportCount(), 1);
  assert.deepEqual(await f.doc(), tallDoc);
  f.report.observations.push({ label: '02-pending-refusal', notice, held });
  await f.snapshot('02-pending-refusal');
  await f.dismissToasts();

  await f.page.evaluate(() => window.__d523Placed.release());
  await f.page.waitForFunction(({ id, key }) => window.__d523Placed.snapshot().events.some(e =>
    e.kind === 'client-callback-reached' && e.delivery === 'held-original-event' && e.id === id && e.key === key), held);
  const tall = await exportShown('03-tall', 9, 5, 1, tallDoc);
  assert.notEqual(tall.source, initial.source);
  const restoreStart = await f.page.evaluate(() => window.__d523Placed.snapshot().events.length);
  await variants().getByRole('button', { name: 'Show the master', exact: true }).click();
  await variants().getByLabel('Variant shown', { exact: true }).waitFor({ state: 'detached' });
  await f.page.waitForFunction(since => {
    const events = window.__d523Placed.snapshot().events.slice(since);
    return events.some(e => e.kind === 'submit' && e.type === 'placed' && Math.abs(e.place.t[2] - 8) <= 1e-6
      && events.some(reply => reply.kind === 'client-callback-reached' && reply.id === e.id && reply.key === e.key));
  }, restoreStart);
  const restored = await exportShown('04-restored', 6, 2, 2, master);
  assert.deepEqual(restored, initial);
  if (lossReport) {
    await f.newPage();
    await f.page.setViewportSize({ width: 1440, height: 900 });
    f.phase = 'Open standalone part in a fresh context';
    f.report.partSeedSHA256 = await openFixture(part, 'three-mf-part');
    const standalone = await exportShown('05-standalone-part', 6, 0, 0, part, 'three-mf-part');
    assert.deepEqual(standalone.parts['Base plate'], initial.parts['Base plate']);
    f.phase = 'Check 3MF loss disclosure against the independently read files';
    const nativeLoss = /Editable features, parameters and history are omitted/;
    const assemblyLoss = /Assembly hierarchy, mates and variant definitions are omitted/;
    const notices = f.report.observations.filter(o => o.result);
    assert.deepEqual(notices.map(o => [o.label, nativeLoss.test(o.notice), assemblyLoss.test(o.notice)]), [
      ['01-master', true, true],
      ['03-tall', true, true],
      ['04-restored', true, true],
      ['05-standalone-part', true, false],
    ]);
    assert.doesNotMatch(notice, nativeLoss);
  }
  assert.deepEqual(f.report.downloads, []);
  f.phase = 'complete';
});

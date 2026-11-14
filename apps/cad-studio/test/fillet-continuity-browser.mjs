import assert from 'node:assert/strict';
import { relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const output = process.argv[2];
assert.ok(output && relative(resolve(import.meta.dirname, '../../..'), resolve(output)).startsWith('../'));
const driver = 'apps/cad-studio/test/fillet-continuity-browser.mjs';
const baseline = process.argv.includes('--baseline');
const baselineNativeSHA256 = '12ff52104e6d5ff5b4235b3e5a267aaf168a563285aed2b132137e9d9030fc2f';
const f = await createFlow({
  name: 'fillet-continuity', output, envFrozen: 'D1259_SOURCE_FROZEN',
  initialFiles: [driver], requiredFrozen: [driver, 'packages/barocss-cad/src/brep/edge-continuity.ts'],
  qualification: 'Inspect both tangent interfaces of an authored constant-radius box fillet in Studio.',
  limits: ['One 30 × 12 × 20 mm native box, one straight Fillet R2, two straight plane–cylinder interfaces.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { partBreps } from '@barocss/cad-model/engine/evaluate';
import { readEdgeContinuity } from '@barocss/cad-model/engine/edgeContinuity';
import { digestOf } from '@barocss/cad-model/util/digest';
import { brepMassProperties, faceGeometry, checkBrep } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const [{ key, brep }] = partBreps(doc);
const sourceBefore = digestOf(brep);
const list = readEdgeContinuity(doc, key, {kind:'list'});
assert.ok('edges' in list);
const blend = brep.faces.find(face => face.name === 'n2.face');
assert.ok(blend);
const records = list.edges.filter(row => row.faces.includes('n2.face')).map(row => {
  const edge = brep.edges.find(edge => edge.id === row.id)!;
  const uses = brep.coedges.filter(use => use.edge === row.id);
  return { ...row, vertices: edge.vertices.map(id => brep.vertices.find(vertex => vertex.id === id)!.point),
    storedBindings: uses.filter(use => use.pcurve).length,
    read: readEdgeContinuity(doc, key, {kind:'measure', edgeId:row.id}) };
});
assert.equal(digestOf(brep), sourceBefore);
console.log(JSON.stringify({ sourceSHA256: sourceBefore, check: checkBrep(brep, {strict:true}),
  volume: brepMassProperties(brep, 1).volume, geometry: faceGeometry(blend), records }));
`,
  oracleSource: `
import json, math, sys
d = json.load(sys.stdin)
native = d['native']
assert native['check']['valid'], native['check']
absolute_angle_tolerance = 1e-7
expected_volume = 30 * (12 * 20 - (4 - math.pi))
assert abs(native['volume'] - expected_volume) <= 1e-7
assert abs(d['studioVolume'] - expected_volume) <= 1e-7
geom = native['geometry']
assert geom['kind'] == 'cylinder' and abs(geom['r'] - 2) <= 1e-8
assert abs(abs(geom['a'][0]) - 1) <= 1e-8 and all(abs(geom['a'][i]) <= 1e-8 for i in (1,2))
assert abs(geom['c'][1] - 2) <= 1e-8 and abs(geom['c'][2] - 18) <= 1e-8
positions = {'n1.side0': (0,18), 'n1.top': (2,20)}
normals = {'n1.side0': (0,-1,0), 'n1.top': (0,0,1)}
angles = {}
for row in native['records']:
    name = next(f for f in row['faces'] if f != 'n2.face')
    if name not in positions: continue
    y,z = positions[name]
    assert sorted(v[0] for v in row['vertices']) == [0,30]
    assert all(abs(v[1]-y) <= 1e-8 and abs(v[2]-z) <= 1e-8 for v in row['vertices'])
    normal = (0,(y-2)/2,(z-18)/2)
    expect = math.degrees(math.acos(sum(a*b for a,b in zip(normals[name],normal))))
    angles[name] = expect
    read = row['read']['measurement']
    assert row['storedBindings'] == 0
    assert read['status'] == 'measured', row
    assert read['sampleCount'] == len(read['samples']) == 8
    assert all(abs(s['angleDegrees'] - expect) <= absolute_angle_tolerance for s in read['samples'])
    assert all(abs(a - expect) <= absolute_angle_tolerance for a in d['studio'][name])
assert angles == {'n1.side0':0,'n1.top':0}, angles
print(json.dumps({'status':'PASS','radiusMM':2,'axis':[1,0,0], 'expectedVolumeMM3':expected_volume,'anglesDegrees':angles}))
`,
});
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 12] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 20 },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const button = (name, within = f.page) => within.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('region', { name: 'Edge continuity', exact: true });
const edges = () => panel().getByRole('combobox', { name: 'Native shared edge', exact: true });
const result = () => panel().getByRole('status', { name: 'Edge continuity result', exact: true });
const value = () => result().locator('[data-continuity-angle]');

async function camera(view) {
  await button(view, f.page.locator('.views')).click();
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
}
async function filter(name) {
  const trigger = button('Selection filter');
  for (let i = 0; i < 6 && !(await trigger.innerText()).includes(name); i++) await trigger.click();
  assert.ok((await trigger.innerText()).includes(name));
}
async function pick(point) {
  const pixel = await f.page.evaluate(p => window.__studioScreenOf(p), point);
  assert.ok(pixel && await f.page.evaluate(p => document.elementFromPoint(...p)?.matches('canvas.vp-canvas'), pixel));
  await f.page.mouse.click(...pixel);
}
async function measure(row) {
  await edges().selectOption(row.id);
  assert.equal(await value().count(), 0);
  await button('Measure continuity', panel()).click();
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  f.phase = 'Open a box and author one straight R2 fillet through the Studio command';
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'box-continuity.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  await camera('Top');
  await filter('Edges');
  await pick([15, 0, 20]);
  await f.page.waitForFunction(() => window.__studioSelection?.selection.edges.length === 1);
  await f.command('Fillet');
  const hud = f.page.getByRole('dialog', { name: 'Fillet', exact: true });
  const radius = hud.getByLabel('Radius', { exact: true });
  await radius.fill('2');
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent.trim() === 'preview');
  await button('Apply', hud).click();
  await f.changed(source);
  const accepted = await f.doc();
  const node = accepted.nodes.at(-1);
  assert.equal(node.kind, 'fillet');
  assert.equal(node.radius, 2);
  assert.deepEqual(node.edges, ['n1.side0|n1.top']);
  const native = await f.inspect('native-fillet', accepted);
  assert.equal(native.sourceSHA256, baselineNativeSHA256, 'native B-rep matches the pre-change authorized fixture');
  assert.deepEqual(native.check.counts, { bodies: 1, shells: 1, faces: 7, loops: 7, coedges: 30, edges: 15, vertices: 10 });
  assert.equal(native.records.length, 4);
  const interfaces = native.records.filter(row => row.faces.includes('n1.side0') || row.faces.includes('n1.top'));
  assert.equal(interfaces.length, 2);
  const ends = native.records.filter(row => !interfaces.includes(row));
  assert.equal(ends.length, 2);

  f.phase = 'Inspect both native plane–cylinder interfaces from the body';
  await camera('Iso');
  await filter('Bodies');
  await pick([15, 6, 20]);
  await button('Inspect native joints', panel()).click();
  const studio = {};
  for (const row of interfaces) {
    const other = row.faces.find(name => name !== 'n2.face');
    await measure(row);
    if (baseline) {
      assert.equal(row.read.measurement.reason, 'missing-pcurve');
      await result().getByText(/no native parameter curve/i).waitFor();
      assert.equal(await value().count(), 0);
    } else {
      await value().waitFor();
      assert.match(await result().innerText(), /Native samples\s+8/);
      studio[other] = (await value().textContent()).replace('°', '').split('–').map(Number);
    }
    await f.snapshot('joint-' + other);
  }
  if (!baseline) {
    await f.runOracle({ native, studio, studioVolume: (await f.bodies()).bodies[0].volume }, 'actual-fillet');
    f.phase = 'Refuse the curved fillet end without a native parameter curve';
    for (const row of ends) {
      assert.equal(row.read.measurement.reason, 'missing-pcurve');
      await measure(row);
      await result().getByText(/no native parameter curve/i).waitFor();
      assert.equal(await value().count(), 0);
    }
    await f.snapshot('unsupported-end');

    f.phase = 'Undo and Redo restore each part and clear the inspection';
    await f.undo();
    await f.same(source);
    assert.equal(await value().count(), 0);
    await f.redo();
    await f.same(accepted);
    assert.equal(await value().count(), 0);
  }
  await f.same(accepted);
  f.report.observations.push({ label: 'fillet', sourceSHA256: native.sourceSHA256, recordCount: native.records.length, volume: native.volume,
    topology: native.check.counts, originalDocumentRetained: true, baselineRefusals: baseline ? interfaces.length : 0, studio });
  assert.deepEqual(f.report.downloads, []);
});

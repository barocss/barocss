import assert from 'node:assert/strict';
import { relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const output = process.argv[2];
assert.ok(output && relative(resolve(import.meta.dirname, '../../..'), resolve(output)).startsWith('../'));
const driver = 'apps/cad-studio/test/edge-continuity-browser.mjs';
const f = await createFlow({
  name: 'edge-continuity', output, envFrozen: 'D1258_SOURCE_FROZEN',
  initialFiles: [driver],
  requiredFrozen: [driver, 'apps/cad-studio/src/ui/EdgeContinuity.tsx', 'packages/barocss-cad-model/src/engine/edgeContinuity.ts'],
  qualification: 'Measure native normal angles at a perpendicular rim and a tangent shared edge using the Studio worker.',
  limits: ['One authored capsule extrusion, one sharp planar rim, one tangent plane–cylinder strut. Read-only in Model view.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { partBreps } from '@barocss/cad-model/engine/evaluate';
import { readEdgeContinuity } from '@barocss/cad-model/engine/edgeContinuity';
import { checkBrep } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const [{ key, brep }] = partBreps(doc);
const result = readEdgeContinuity(doc, key, {kind:'list'});
if (!('edges' in result)) throw new Error('No native joints');
let matches = result.edges.filter(edge => ['n1.side0|n1.top','n1.side0|n1.side1'].includes(edge.name));
console.log(JSON.stringify({
  validity: checkBrep(brep,{strict:true}).valid,
  records: matches.map(edge => ({ ...edge, result: readEdgeContinuity(doc,key,{kind:'measure',edgeId:edge.id}).measurement }))
}));
`,
  oracleSource: `
import json, math, sys
d = json.load(sys.stdin)
def angle(a,b):
    return math.degrees(math.acos(sum(x*y for x,y in zip(a,b))))
n0 = [0,-1,0]
n_cap = [0,0,1]
n_cylinder = [0,-4/math.hypot(0,-4),0]
expected = {'n1.side0|n1.top': angle(n0,n_cap), 'n1.side0|n1.side1': angle(n0,n_cylinder)}
assert d['native']['validity']
assert len(d['native']['records']) == 2
for r in d['native']['records']:
    samples = r['result']['samples']
    want = expected[r['name']]
    assert len(samples) == 8
    assert all(abs(q['angleDegrees'] - want) <= 1e-7 for q in samples)
    assert abs(r['result']['minimumAngleDegrees'] - want) <= 1e-7
    assert abs(r['result']['maximumAngleDegrees'] - want) <= 1e-7
    assert all(abs(q - want) <= 1e-7 for q in d['studio'][r['name']])
print(json.dumps({'status':'PASS','anglesDegrees':expected, 'samplesPerEdge':8}))
`,
});
const sharp = 'n1.side0|n1.top', tangent = 'n1.side0|n1.side1';
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'loop', segments: [
      { kind: 'line', start: [0, -4] },
      { kind: 'arc', start: [20, -4], center: [20, 0], direction: 'ccw' },
      { kind: 'line', start: [20, 4] },
      { kind: 'arc', start: [0, 4], center: [0, 0], direction: 'ccw' },
    ] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 6 },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const button = (name, within = f.page) => within.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('region', { name: 'Edge continuity', exact: true });
const edges = () => panel().getByRole('combobox', { name: 'Native shared edge', exact: true });
const result = () => panel().getByRole('status', { name: 'Edge continuity result', exact: true });

async function selectFilter(name) {
  const filter = button('Selection filter');
  for (let i = 0; i < 6 && !(await filter.innerText()).includes(name); i++) await filter.click();
  assert.ok((await filter.innerText()).includes(name));
}
async function clickWorld(point) {
  const pixel = await f.page.evaluate(p => window.__studioScreenOf(p), point);
  assert.ok(pixel && await f.page.evaluate(p => document.elementFromPoint(...p)?.matches('canvas.vp-canvas'), pixel));
  await f.page.mouse.click(...pixel);
}
async function open(doc, name) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
  await button('Top', f.page.locator('.views')).click();
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
}
async function readAngle() {
  const value = result().locator('[data-continuity-angle]');
  await value.waitFor();
  const text = await value.textContent();
  assert.ok(text.endsWith('°'));
  assert.match(await result().innerText(), /Native samples\s+8/);
  return text.slice(0, -1).split('–').map(Number);
}

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
  f.phase = 'Pick the perpendicular rim in the viewport and inspect its native edge';
  await open(source, 'capsule-edge-inspection.bcad');
  const native = await f.inspect('native', source);
  const ids = Object.fromEntries(native.records.map(edge => [edge.name, edge.id]));
  await selectFilter('Edges');
  await clickWorld([10, -4, 6]);
  await f.page.waitForFunction(() => window.__studioSelection?.selection.edges.length === 1);
  await button('Inspect edge continuity', panel()).click();
  const measured = { [sharp]: await readAngle() };
  assert.equal(await edges().inputValue(), ids[sharp]);
  await f.snapshot('01-sharp-rim');

  f.phase = 'Inspect the tangent joint from the selected body and verify it is not the old rim reading';
  await selectFilter('Bodies');
  await clickWorld([10, 0, 6]);
  await f.page.waitForFunction(() => window.__studioSelection?.selection.bodies.length === 1);
  await button('Inspect native joints', panel()).click();
  await edges().selectOption(ids[tangent]);
  await button('Measure continuity', panel()).click();
  measured[tangent] = await readAngle();
  await f.snapshot('02-tangent-joint');
  assert.equal(await edges().inputValue(), ids[tangent]);
  await f.runOracle({ native, studio: measured }, 'independent-angles');

  f.phase = 'Changing the native edge removes the previous result before measuring';
  await edges().selectOption(ids[sharp]);
  assert.equal(await result().locator('[data-continuity-angle]').count(), 0);
  await button('Measure continuity', panel()).click();
  assert.deepEqual(await readAngle(), measured[sharp]);

  f.phase = 'Replace the document with reused native IDs and check result ownership';
  const taller = structuredClone(source);
  taller.nodes[1].height = 8;
  await open(taller, 'taller-capsule.bcad');
  assert.equal(await panel().count(), 0);
  await selectFilter('Bodies');
  await clickWorld([10, 0, 8]);
  await button('Inspect native joints', panel()).waitFor();
  assert.equal(await result().locator('[data-continuity-angle]').count(), 0);
  await f.same(taller);
  assert.equal(await f.page.getByLabel('Unsaved changes', { exact: true }).count(), 0);
  assert.deepEqual(f.report.downloads, []);
  await f.snapshot('03-new-document');
  f.report.observations.push({ label: 'angles', measured, bothDocumentsUnchanged: true });
});

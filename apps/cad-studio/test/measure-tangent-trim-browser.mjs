import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const pins = [
  'apps/cad-studio/test/measure-tangent-trim-browser.mjs',
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/app/measureProvenance.ts',
  'apps/cad-studio/src/ui/MeasurementInspector.tsx', 'packages/barocss-cad-model/src/engine/mesh.ts',
];
const f = await createFlow({
  name: 'measure-tangent-trim', output: process.argv[2], envFrozen: 'D1039_SOURCE_FROZEN',
  qualification: 'A planar face with a tangent curved trim reports the sampled distance as an approximation.',
  limits: ['Two opposing planar caps after tangent R1 rim fillets.'],
  initialFiles: pins, requiredFrozen: pins,
  snapshotExtra: () => ({ overlay: window.__studioOverlayTexts?.()['measure:label'] ?? [] }),
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkOutput, evaluateCadPart } from '@barocss/cad';
import { measureBetween } from '@barocss/cad-model/app/measure';
import { bodyMesh } from '@barocss/cad-model/engine/mesh';
import { toPartDocument } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const outputs = evaluateCadPart(toPartDocument(doc)).outputs;
const caps = ['n1.top', 'n3.bottom'].map((name, i) => {
  const output = outputs.find(o => o.feature === 'n' + (4 + i));
  const brep = output.brep;
  const nativeFace = brep.faces.find(face => face.name === name);
  const loops = new Set(brep.loops.filter(loop => loop.face === nativeFace.id).map(loop => loop.id));
  const ids = new Set(brep.coedges.filter(edge => loops.has(edge.loop)).map(edge => edge.edge));
  const trims = brep.edges.filter(edge => ids.has(edge.id)).map(edge => edge.curve.degree);
  return { brep, name, trims, valid: checkOutput(output).valid };
});
const results = [4,8,16].map(quality => {
  const [a,b] = caps.map(cap => {
    const mesh = bodyMesh(cap.brep, 1, quality);
    const face = mesh.faces.find(face => face.name === cap.name);
    return { mesh, face, edges: mesh.edges.filter(edge => edge.faces.includes(face.index)).length };
  });
  const result = measureBetween(a.mesh, { body: 0, face: a.face.index }, b.mesh, { body: 1, face: b.face.index });
  return { quality, distance: result.distance, normal: result.normalDistance, edges: [a.edges,b.edges],
    kinds: [a.face.kind,b.face.kind], curvedBoundaries: [a.face.curvedBoundary ?? false,b.face.curvedBoundary ?? false] };
});
console.log(JSON.stringify({ caps: caps.map(({name,trims,valid}) => ({name,trims,valid})), results }));
`,
});
const center = [9 * Math.cos(Math.PI / 32), 9 * Math.sin(Math.PI / 32)];
const source = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'circle', center: [0,0], radius: 6, id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 10, id: 'n1' },
    { kind: 'sketch', profile: 'circle', center, radius: 4, id: 'n2' },
    { kind: 'extrude', sketch: 2, from: 15, height: 10, id: 'n3' },
    { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n1.side0#2|n1.top'], radius: 1, id: 'n4' },
    { kind: 'fillet', parent: { node: 3, side: 'solid' }, edges: ['n3.bottom|n3.side0#2'], radius: 1, id: 'n5' },
  ],
  outputs: { b4: { node: 4, side: 'solid' }, b5: { node: 5, side: 'solid' } }, nextId: 6,
};
const button = name => f.page.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'Measurement', exact: true });
const metric = label => panel().locator('.kv').filter({ hasText: new RegExp('^' + label + '\\b') }).locator('b');

async function cap(side, world) {
  await button('View cube directions').click();
  await f.page.getByRole('menuitem', { name: side, exact: true }).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.page.waitForFunction(side => {
    const eye = window.__studioEye?.();
    return eye && (side === 'Top' ? eye[2] > 25 : eye[2] < 0);
  }, side);
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const pixel = await f.page.evaluate(world => window.__studioScreenOf(world), world);
  assert.ok(await f.page.evaluate(([x,y]) => !!document.elementFromPoint(x,y)?.closest('canvas.vp-canvas'), pixel), pixel);
  await f.page.mouse.click(...pixel);
}

await f.run(async () => {
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
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'measure-tangent-trim.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  const proof = await f.inspect('native-tangent-caps', await f.doc());
  const analyticDistance = Math.hypot(9 - (6 - 1) - (4 - 1), 15 - 10);
  assert.deepEqual(proof.caps.map(cap => [cap.valid, cap.trims]), [[true,[2,2]], [true,[2,2]]]);
  for (const result of proof.results) {
    assert.deepEqual(result.edges, [0,0]);
    assert.deepEqual(result.kinds, ['plane','plane']);
    assert.ok(Math.abs(result.normal - 5) < 1e-9);
  }
  assert.ok(proof.results[0].distance > proof.results[1].distance);
  assert.ok(proof.results[1].distance - analyticDistance > 0.007);
  assert.ok(Math.abs(proof.results[2].distance - analyticDistance) < 1e-6);

  f.phase = 'Measure the two planar caps across their hidden tangent trims';
  await clickModelCommand(f.page, 'Inspect', 'Measure');
  await cap('Top', [0,0,10]);
  await panel().getByText('Planar face', { exact: true }).waitFor();
  await cap('Bottom', [...center,15]);
  await panel().getByText('BETWEEN', { exact: true }).waitFor();
  const displayed = await metric('Distance').innerText();
  const normal = await metric('Normal distance').innerText();
  const state = await f.snapshot('planar-caps-with-tangent-trims');
  f.report.observations.push({ displayed, normal, analyticDistance, overlay: state.overlay, ...proof });
  await f.persist();
  assert.equal(normal, '5 mm');
  assert.equal(displayed, '5.11 mm (mesh approximation)');
  assert.deepEqual(state.overlay, ['≈5.11 mm']);
  for (const result of proof.results) assert.deepEqual(result.curvedBoundaries, [true,true]);
  await f.same(source);
  assert.deepEqual(f.report.downloads, []);
});

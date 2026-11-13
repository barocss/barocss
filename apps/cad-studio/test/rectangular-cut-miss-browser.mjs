import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/rectangular-cut-miss-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/app/rectangularCutEdit.ts',
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad/src/part/part-transform.ts',
];
const f = await createFlow({
  name: 'rectangular-cut-miss', output: process.argv[2], envFrozen: 'D1021_SOURCE_FROZEN',
  qualification: 'Preserve a six-pocket rectangular cut when the edited cutter misses the stock.',
  limits: ['One 3 × 2 X/Y rectangular CUT on upright plain rectangular stock with a direct rectangular extruded cutter.'],
  snapshotExtra: () => ({
    undoRedo: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`)?.disabled),
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  }),
  initialFiles: pins, requiredFrozen: pins,
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const [body] = evaluateCadPart(toPartDocument(doc)).outputs;
const pocketFloors = body.brep.faces.filter(face => face.name?.startsWith('n3.bottom')).map(face => faceGeometry(face));
console.log(JSON.stringify({ valid: checkOutput(body).valid, volume: massPropertiesOf(body).volume, pocketFloors }));
`,
});
const ref = node => ({ node, side: 'solid' });
const doc = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 10, id: 'n1', made: { command: 'box', values: { w: 60, d: 40, h: 10, x: 0, y: 0, z: 0 } } },
    { kind: 'sketch', profile: 'rectangle', min: [8, 8], max: [12, 10], id: 'n2' },
    { kind: 'extrude', sketch: 2, height: 6, id: 'n3', from: 4 },
    { kind: 'difference', parent: ref(1), tool: ref(3), id: 'n4' },
    { kind: 'rectangular-feature-pattern', parent: ref(4), axis: 'x', spacing: 16, count: 3, axis2: 'y', spacing2: 16, count2: 2, id: 'n5' },
  ],
  outputs: { b5: ref(5) }, nextId: 6,
};
const button = name => f.page.getByRole('button', { name, exact: true });
async function open(name, model) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(model)) });
  await f.same(model);
}
async function verify(label, model, baseZ, pockets) {
  const native = await f.inspect(label, model);
  f.report.observations.push({ label, native });
  await f.persist();
  assert.equal(native.valid, true);
  assert.equal(native.pocketFloors.length, pockets);
  for (const floor of native.pocketFloors) {
    assert.equal(floor.kind, 'plane');
    assert.equal(floor.o[2], baseZ);
  }
  assert.ok(Math.abs(native.volume - (24000 - pockets * 8 * (10 - baseZ))) < 1e-7);
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
  await open('rectangular-cut-pockets', doc);
  await verify('six-initial', doc, 4, 6);
  await f.openFeatureEditor(3, 'Cutter Extrude');
  const startZ = f.editor().getByRole('spinbutton', { name: 'Start Z', exact: true });
  const apply = f.editor().getByRole('button', { name: 'Apply', exact: true });
  const before = await f.snapshot('six-pockets-before');
  f.phase = 'refuse lifting all cutters above the plate';
  await startZ.fill('12');
  await apply.click();
  await f.page.waitForFunction(() => {
    const message = document.querySelector('.node-editor .hud-error');
    return !!message || window.__studioDoc?.nodes[3]?.from === 12;
  });
  const refused = await f.snapshot('cutter-miss-attempt');
  if (refused.doc.nodes[3].from === 12) {
    await verify('accepted-no-pocket', refused.doc, 12, 0);
    assert.fail('Studio silently accepted a cutter edit that removed all six pockets.');
  }
  assert.match(await f.editor().locator('.hud-error').innerText(), /removes no material|misses the stock/i);
  for (const key of ['doc', 'bodies', 'history', 'undoRedo', 'dirty', 'selection']) assert.deepEqual(refused[key], before[key], key);
  assert.equal(await startZ.inputValue(), '12');
  assert.match(await f.editor().locator('.hud-error').innerText(), /n5/);
  await startZ.fill('10');
  await apply.click();
  await f.editor().getByText('removes no material', { exact: false }).waitFor();
  const touching = await f.snapshot('cutter-touches-stock');
  for (const key of ['doc', 'bodies', 'history', 'undoRedo', 'dirty', 'selection']) assert.deepEqual(touching[key], before[key], key);

  f.phase = 'recover with the same cutter and keep a valid partial-depth cut';
  await startZ.fill('6');
  const recovered = await f.applyEditor(doc, 'six-shallower-pockets');
  assert.equal(recovered.doc.nodes[3].from, 6);
  await verify('six-recovered', recovered.doc, 6, 6);
  await f.undo();
  await f.same(doc);
  await f.redo();
  await f.same(recovered.doc);
  await f.snapshot('six-shallower-redone');

  const withToolX = (min, max) => ({ ...doc, nodes: doc.nodes.map((node, i) => i === 2
    ? { ...node, min: [min, 8], max: [max, 10] } : node) });
  f.phase = 'retain cuts made only by later copies';
  const partial = withToolX(-10, -6);
  await open('partially-cut', partial);
  await verify('four-existing-pockets', partial, 4, 4);
  await f.openFeatureEditor(3, 'Cutter Extrude');
  await startZ.fill('12');
  await apply.click();
  await f.editor().getByText('removes no material', { exact: false }).waitFor();
  const partialRefusal = await f.snapshot('four-pockets-preserved');
  assert.deepEqual(partialRefusal.doc, partial);
  await startZ.fill('9');
  const shallowPartial = await f.applyEditor(partial, 'four-shallow-pockets');
  await verify('four-shallow-native', shallowPartial.doc, 9, 4);

  f.phase = 'keep a historical no-material recipe editable';
  const noOp = withToolX(-100, -96);
  await open('legacy-miss', noOp);
  await verify('legacy-miss-before', noOp, 4, 0);
  await f.openFeatureEditor(3, 'Cutter Extrude');
  await startZ.fill('12');
  const noOpEdited = await f.applyEditor(noOp, 'legacy-miss-edited');
  assert.equal(noOpEdited.doc.nodes[3].from, 12);
  await verify('legacy-miss-after', noOpEdited.doc, 12, 0);

  f.phase = 'leave a legacy large-span no-material pattern editable';
  const outside = withToolX(59.9999995, 64);
  const wide = { ...outside, nodes: outside.nodes.map((node, i) => i === 5
    ? { ...node, spacing: 10000, count: 64, count2: 1 } : node) };
  await open('legacy-wide-miss', wide);
  await verify('legacy-wide-before', wide, 4, 0);
  await f.openFeatureEditor(3, 'Cutter Extrude');
  await startZ.fill('12');
  const wideEdited = await f.applyEditor(wide, 'legacy-wide-miss-edited');
  assert.equal(wideEdited.doc.nodes[3].from, 12);
  await verify('legacy-wide-after', wideEdited.doc, 12, 0);

  f.phase = 'leave a legacy sub-roundoff corner contact editable';
  const corner = { ...doc, nodes: doc.nodes.map((node, i) => i === 0 ? { ...node, min: [4940, 4960], max: [5000, 5000] }
    : i === 2 ? { ...node, min: [4999.99999, 4999.99999], max: [5004, 5002] } : node) };
  await open('legacy-corner-miss', corner);
  await verify('legacy-corner-before', corner, 4, 0);
  await f.openFeatureEditor(3, 'Cutter Extrude');
  await startZ.fill('12');
  const cornerEdited = await f.applyEditor(corner, 'legacy-corner-miss-edited');
  assert.equal(cornerEdited.doc.nodes[3].from, 12);
  await verify('legacy-corner-after', cornerEdited.doc, 12, 0);
  assert.deepEqual(f.report.downloads, []);
});

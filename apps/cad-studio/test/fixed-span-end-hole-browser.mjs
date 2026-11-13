import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/fixed-span-end-hole-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/app/patternHoleSpacing.ts',
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad-model/src/engine/part.ts',
  'packages/barocss-cad/src/part/part-model.ts',
];
const f = await createFlow({
  name: 'fixed-span-end-hole', output: process.argv[2], envFrozen: 'D1020_SOURCE_FROZEN',
  qualification: 'Keep the physical end of a Fixed span pattern as the referenced Hole face while Count changes.',
  limits: ['One-body X Linear pattern with three separate rectangular pieces and a legacy terminal simple through Hole.'],
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
const walls = body.brep.faces.filter(face => face.name?.startsWith('n3.')).map(faceGeometry);
const tops = body.brep.faces.filter(face => /^n1\\.top(?:@\\d+)?$/.test(face.name ?? ''))
  .map(face => [face.name, face.loops.length]).sort(([a], [b]) => a.localeCompare(b));
console.log(JSON.stringify({ valid: checkOutput(body).valid, volume: massPropertiesOf(body).volume, walls, tops }));
`,
});
const ref = node => ({ node, side: 'solid' });
const doc = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [50, 10], max: [54, 16] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 8 },
    { kind: 'linear-span-pattern', parent: ref(1), axis: 'x', span: 32, count: 3, id: 'n2' },
    { kind: 'hole', parent: ref(2), radius: 1, center: [84, 13], face: 'n1.top@2', id: 'n3' },
  ],
  outputs: { b3: ref(3) }, nextId: 4,
};
const button = name => f.page.getByRole('button', { name, exact: true });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} versus ${expected}`);

async function open(name, model) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(model)) });
  await f.same(model);
}

async function verify(label, model, count) {
  const native = await f.inspect(label, model);
  f.report.observations.push({ label, native });
  await f.persist();
  assert.equal(native.valid, true);
  const tops = Array.from({ length: count }, (_, i) => [i ? 'n1.top@' + i : 'n1.top', i === count - 1 ? 2 : 1]);
  assert.deepEqual(native.tops, tops);
  assert.equal(native.walls.length, 2);
  for (const wall of native.walls) {
    assert.equal(wall.kind, 'cylinder');
    near(wall.c[0], 84);
    near(wall.c[1], 13);
    near(wall.r, 1);
  }
  near(native.volume, count * 4 * 6 * 8 - 8 * Math.PI);
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
  await open('pattern-hole-legacy', doc);
  await verify('initial-fixed-span-native', doc, 3);
  const count = () => f.editor().getByRole('spinbutton', { name: 'Count', exact: true });
  const apply = () => f.editor().getByRole('button', { name: 'Apply', exact: true });
  const atCount = n => ({ ...doc, nodes: doc.nodes.map((node, i) => i === 2 ? { ...node, count: n }
    : i === 3 ? { ...node, face: 'n1.top@' + (n - 1) } : node) });

  f.phase = 'change Count from three to four without changing the physical end';
  await f.openFeatureEditor(2, 'Fixed span Linear pattern');
  await count().fill('4');
  const four = await f.applyEditor(doc, 'four-copies');
  assert.deepEqual(four.doc, atCount(4), 'the selected face must be the last copy after the count edit');
  await verify('four-native', four.doc, 4);

  f.phase = 'reduce to two copies and keep the same physical end';
  await f.openFeatureEditor(2, 'Fixed span Linear pattern');
  await count().fill('2');
  const two = await f.applyEditor(four.doc, 'two-copies');
  assert.deepEqual(two.doc, atCount(2));
  await verify('two-native', two.doc, 2);
  await f.undo();
  await f.same(four.doc);
  await f.redo();
  await f.same(two.doc);
  await f.snapshot('two-redone');

  f.phase = 'refuse an interior copy whose physical position changes';
  const interior = { ...doc, nodes: [...doc.nodes.slice(0, 3), { ...doc.nodes[3], center: [68, 13], face: 'n1.top@1' }] };
  await open('fixed-span-interior', interior);
  await f.openFeatureEditor(2, 'Fixed span Linear pattern');
  const before = await f.snapshot('interior-before');
  await count().fill('4');
  await apply().click();
  const error = f.editor().locator('.hud-error');
  await error.waitFor();
  assert.match(await error.innerText(), /copy 2.*Hole Ø2/s);
  const refused = await f.snapshot('interior-refused');
  for (const key of ['doc', 'bodies', 'history', 'undoRedo', 'dirty', 'selection']) assert.deepEqual(refused[key], before[key], key);
  await f.closeEditor();

  f.phase = 'refuse a distance mode and Count change in the same edit';
  const spacingDoc = { ...doc, nodes: doc.nodes.map((node, i) => i === 2
    ? { kind: 'linear-pattern', parent: ref(1), axis: 'x', spacing: 16, count: 3, id: 'n2' } : node) };
  await open('spacing-to-span', spacingDoc);
  await f.openFeatureEditor(2, 'Linear pattern');
  await f.editor().getByLabel('Distance mode', { exact: true }).selectOption('span');
  await count().fill('4');
  await apply().click();
  await f.editor().getByText('Apply the distance mode change first', { exact: false }).waitFor();
  const mixed = await f.snapshot('mixed-mode-count-refused');
  assert.deepEqual(mixed.doc, spacingDoc);
  await f.closeEditor();

  f.phase = 'keep the authored bore centre when the derived end differs by one ULP';
  const rounded = { ...doc, nodes: [
    { ...doc.nodes[0], min: [-20, 10], max: [-16.5, 16] },
    doc.nodes[1], { ...doc.nodes[2], span: 20.02 }, { ...doc.nodes[3], center: [1.77, 13] },
  ] };
  await open('fixed-span-rounded', rounded);
  await f.openFeatureEditor(2, 'Fixed span Linear pattern');
  await count().fill('6');
  const six = await f.applyEditor(rounded, 'six-copies-rounded');
  assert.deepEqual(six.doc.nodes[3], { ...rounded.nodes[3], face: 'n1.top@5' });
  const native = await f.inspect('six-native', six.doc);
  assert.equal(native.valid, true);
  assert.equal(native.tops.length, 6);
  assert.deepEqual(native.tops.filter(([, loops]) => loops === 2), [['n1.top@5', 2]]);
  assert.equal(native.walls.length, 2);
  for (const wall of native.walls) near(wall.c[0], 1.77);
  near(native.volume, 6 * 3.5 * 6 * 8 - 8 * Math.PI);
  assert.deepEqual(f.report.downloads, []);
});

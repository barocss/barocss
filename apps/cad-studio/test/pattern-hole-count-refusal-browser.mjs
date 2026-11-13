import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/pattern-hole-count-refusal-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/app/patternHoleSpacing.ts',
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad-model/src/engine/part.ts',
  'packages/barocss-cad/src/part/part-model.ts',
];
const f = await createFlow({
  name: 'pattern-hole-count-refusal', output: process.argv[2], envFrozen: 'D1019_SOURCE_FROZEN',
  qualification: 'Name the retired copy and dependent Hole in a rejected Linear Pattern Count edit.',
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
    { kind: 'linear-pattern', parent: ref(1), axis: 'x', spacing: 16, count: 3, id: 'n2' },
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
  const tops = [['n1.top', 1], ['n1.top@1', 1], ['n1.top@2', 2]];
  if (count === 4) tops.push(['n1.top@3', 1]);
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
  await verify('legacy-count-three', doc, 3);
  await f.openFeatureEditor(2, 'Linear pattern');
  const count = f.editor().getByRole('spinbutton', { name: 'Count', exact: true });
  const apply = f.editor().getByRole('button', { name: 'Apply', exact: true });
  const before = await f.snapshot('before-count-edit');

  f.phase = 'refuse removal of the copy that owns the Hole';
  await count.fill('2');
  await apply.click();
  const error = f.editor().locator('.hud-error');
  await error.waitFor();
  const refused = await f.snapshot('count-two-refused');
  assert.match(await error.innerText(), /Count 2 removes copy 3/);
  assert.match(await error.innerText(), /Hole Ø2 \(n3\).*n1\.top@2/s);
  assert.match(await error.innerText(), /Keep at least 3 copies/);
  assert.equal(await count.inputValue(), '2');
  for (const key of ['doc', 'bodies', 'history', 'undoRedo', 'dirty', 'selection']) assert.deepEqual(refused[key], before[key], key);

  f.phase = 'recover in the same editor and verify exact history';
  await count.fill('4');
  const restored = await f.applyEditor(doc, 'count-four-accepted');
  const expected = { ...doc, nodes: doc.nodes.map((node, i) => i === 2 ? { ...node, count: 4 } : node) };
  assert.deepEqual(restored.doc, expected);
  await verify('count-four-native', expected, 4);
  await f.undo();
  await f.same(doc);
  await f.redo();
  await f.same(expected);
  await f.snapshot('count-four-redone');
  assert.deepEqual(f.report.downloads, []);
});

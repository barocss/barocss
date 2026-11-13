import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/fixed-span-hole-suppression-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/state/useFeatureHistory.ts',
  'apps/cad-studio/src/ui/FeatureHistoryMenu.tsx',
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad-model/src/engine/part.ts',
  'packages/barocss-cad/src/part/part-model.ts',
];
const f = await createFlow({
  name: 'fixed-span-hole-suppression', output: process.argv[2], envFrozen: 'D1022_SOURCE_FROZEN',
  qualification: 'Preserve geometry and explain the suppression order of a Fixed span pattern and its dependent Hole.',
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

async function verify(label, model, count, cut = true) {
  const native = await f.inspect(label, model);
  f.report.observations.push({ label, native });
  await f.persist();
  assert.equal(native.valid, true);
  const tops = Array.from({ length: count }, (_, i) => [i ? 'n1.top@' + i : 'n1.top', cut && i === count - 1 ? 2 : 1]);
  assert.deepEqual(native.tops, tops);
  assert.equal(native.walls.length, cut ? 2 : 0);
  for (const wall of native.walls) {
    assert.equal(wall.kind, 'cylinder');
    near(wall.c[0], 84);
    near(wall.c[1], 13);
    near(wall.r, 1);
  }
  near(native.volume, count * 4 * 6 * 8 - (cut ? 8 * Math.PI : 0));
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
  await verify('initial-cut', doc, 3);
  async function toggle(index, action) {
    await f.page.locator(`.history .hs[data-node-index="${index}"]`).click({ button: 'right' });
    await f.page.getByRole('menuitem', { name: action, exact: true }).click();
  }
  const stable = ['doc', 'bodies', 'history', 'undoRedo', 'dirty', 'selection'];
  f.phase = 'refuse suppression of the pattern before its dependent Hole';
  const before = await f.snapshot('before-suppress');
  await toggle(2, 'Suppress');
  const suppressError = await f.waitToast(/Cannot suppress Pattern/);
  assert.match(suppressError, /Suppress Hole Ø2 \(n3\) before suppressing Pattern ×3 · span 32 \(n2\)/i);
  const refused = await f.snapshot('pattern-suppress-refused');
  for (const key of stable) assert.deepEqual(refused[key], before[key], key);
  await f.dismissToasts();

  f.phase = 'suppress Hole first and then the pattern';
  const mark = (model, index) => ({ ...model, nodes: model.nodes.map((node, i) => i === index ? { ...node, suppressed: true } : node) });
  const holeOff = mark(doc, 3), bothOff = mark(holeOff, 2);
  await toggle(3, 'Suppress');
  await f.same(holeOff);
  await verify('hole-off-native', holeOff, 3, false);
  await toggle(2, 'Suppress');
  await f.same(bothOff);
  await verify('both-off-native', bothOff, 1, false);
  const suppressed = await f.snapshot('both-suppressed');

  f.phase = 'refuse restoring Hole while its pattern is suppressed';
  await toggle(3, 'Unsuppress');
  const restoreError = await f.waitToast(/Cannot unsuppress Hole/);
  assert.match(restoreError, /Unsuppress Pattern ×3 · span 32 \(n2\) before unsuppressing Hole Ø2 \(n3\)/i);
  const restoreRefused = await f.snapshot('hole-restore-refused');
  for (const key of stable) assert.deepEqual(restoreRefused[key], suppressed[key], key);
  await f.dismissToasts();

  f.phase = 'restore pattern then Hole and verify Undo and Redo';
  await toggle(2, 'Unsuppress');
  await f.changed(bothOff);
  assert.deepEqual(await f.doc(), holeOff);
  await toggle(3, 'Unsuppress');
  await f.changed(holeOff);
  assert.deepEqual(await f.doc(), doc);
  await verify('restored-cut', doc, 3);
  await f.snapshot('restored');
  await f.undo();
  await f.same(holeOff);
  await f.redo();
  await f.same(doc);
  await f.snapshot('restore-redone');
  assert.deepEqual(f.report.downloads, []);
});

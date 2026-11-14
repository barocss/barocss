import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/engine/part.ts'];
const f = await createFlow({
  name: 'sweep-history-inputs', output: process.argv[2], envFrozen: 'D1169_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Read the committed Sweep profile and copied endpoints in History after the source curve changes.',
  limits: ['Desktop WebGPU. A standalone straight Sweep, circular profile, and an independently editable direct curve.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const out = evaluateCadPart(toPartDocument(doc)).outputs.find(body => body.id === 'n2');
const points = out.brep.vertices.map(vertex => vertex.point), bounds = [0,1,2].map(k => [Math.min(...points.map(p => p[k])), Math.max(...points.map(p => p[k]))]);
console.log(JSON.stringify({ valid: checkOutput(out).valid, count: out.bodyCount, bounds }));
`,
});
const rail = [[30, 0, 0], [30, 0, 22]], different = [[45, 0, 0], [45, 0, 55]];
const source = (points) => `@model railB { version: 0; length-unit: mm; @curve #rail { type: nurbs; degree: 1; knots: [0,0,1,1]; control-points: [${points.map(p => '[' + p.join(',') + ']').join(',')}]; weights: [1,1]; } }`;
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 3 },
    { id: 'n1', kind: 'sketch', profile: 'circle', center: [50, 0], radius: 6 },
  ],
  outputs: {},
  direct: {
    sources: { rb: source(rail) },
    objects: [{ id: 'path-b', name: 'Rail B', source: 'rb', geometry: 'rail' }],
  },
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
async function open(doc, name) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: `${name}.bcad`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
}
async function verify(expected, label) {
  await f.openFeatureEditor(2, label);
  const editor = f.editor();
  assert.equal(await editor.getByText('Sketch 1 · Ø6 mm', { exact: true }).count(), 1, 'History does not identify the applied circular profile and diameter');
  await editor.getByText('Rail B · Copied', { exact: true }).waitFor();
  await editor.getByText('30, 0, 0 mm', { exact: true }).waitFor();
  await editor.getByText('30, 0, 22 mm', { exact: true }).waitFor();
  await f.same(expected);
  const state = await f.snapshot(label);
  const native = await f.inspect(label, state.doc);
  f.report.observations.push({ label, history: state.editor, native });
  assert.ok(native.valid && native.count === 1);
  for (const [axis, range] of [[0, [27, 33]], [1, [-3, 3]], [2, [0, 22]]]) {
    assert.ok(native.bounds[axis].every((v, i) => Math.abs(v - range[i]) < 1e-7), JSON.stringify(native));
  }
  await f.closeEditor();
}

await f.run(async () => {
  await f.newPage();
  await open(seed, 'D1169-sweep-history');
  await button('Sketch 1').click();
  await button('Rail B').click();
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.command('Sweep');
  const hud = f.page.getByRole('dialog', { name: 'Sweep', exact: true });
  await hud.locator('.status').filter({ hasText: /^preview$/ }).waitFor();
  await hud.getByText('Sketch 1', { exact: true }).waitFor();
  await hud.getByText('Rail B · Faceted', { exact: true }).waitFor();
  await button('Apply', hud).click();
  await f.changed(seed);
  const accepted = await f.doc();
  assert.deepEqual(accepted.nodes[2].path.controlPoints, rail);
  assert.equal(accepted.nodes[2].sketch, 0);
  await verify(accepted, 'history-after-apply');
  await f.undo();
  await f.same(seed);
  await f.redo();
  await f.same(accepted);
  await verify(accepted, 'history-after-redo');
  const changed = { ...accepted, direct: { ...seed.direct, sources: { rb: source(different) },
    objects: [{ ...seed.direct.objects[0], name: 'Renamed original rail' }] } };
  await open(changed, 'D1169-independent-source-change');
  await button('Renamed original rail').waitFor();
  await verify(changed, 'history-uses-saved-copy');
  const saved = await f.save('sweep-history-inputs');
  const reopened = await f.freshOpen(saved.file, changed, 'sweep-history-reopened');
  await verify(reopened.doc, 'history-after-fresh-open');
});

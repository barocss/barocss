import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFlow, sha256 } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/feature-order-project-browser.mjs',
  'apps/cad-studio/src/ui/FeatureHistoryBar.tsx',
  'apps/cad-studio/src/ui/FeatureHistoryMenu.tsx',
  'apps/cad-studio/src/state/useFeatureHistory.ts',
  'packages/barocss-cad-model/src/chat/features.ts',
];
const f = await createFlow({
  name: 'feature-order-project', output: process.argv[2], envFrozen: 'D808_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Move an independent solid, refuse a dependent move, and edit the reordered source after project Open.',
  limits: ['One rectangular through-drilled plate and one separate extruded cylinder.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(evaluateCadPart(toPartDocument(doc)).outputs.map(body => ({
  id: body.id, valid: checkOutput(body).valid, ...massPropertiesOf(body),
}))));
`,
});
const ref = node => ({ node, side: 'solid' });
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 20] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 8 },
    { id: 'n2', kind: 'sketch', profile: 'circle', center: [50, 10], radius: 5 },
    { id: 'n3', kind: 'extrude', sketch: 2, height: 6 },
    { id: 'n4', kind: 'hole', parent: ref(1), center: [15, 10], radius: 2, face: 'n1.top' },
  ],
  outputs: { b3: ref(3), b4: ref(4) }, nextId: 5,
};
const [plateSketch, plate, cylinderSketch, cylinder, hole] = source.nodes;
const reordered = {
  ...source,
  nodes: [cylinderSketch, { ...cylinder, sketch: 0 }, plateSketch, { ...plate, sketch: 2 }, { ...hole, parent: ref(3) }],
  outputs: { b3: ref(1), b4: ref(4) },
};
const documentName = 'D808-order.bcad', projectName = 'D808 feature order ' + randomUUID();
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
async function openProject() {
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  if (await versions().getByLabel('Project', { exact: true }).isVisible()) return;
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(projectName);
  await button(versions(), 'Project in this browser').click();
  await versions().getByLabel('Project', { exact: true }).waitFor();
}
async function moveEarlier(index) {
  await f.page.locator(`.history .hs[data-node-index="${index}"]`).click({ button: 'right' });
  await f.page.getByRole('menuitem', { name: 'Move earlier', exact: true }).click();
}
async function verifySolids(label, expected, depth) {
  const state = await f.snapshot(label);
  assert.deepEqual(state.doc, expected);
  assert.equal(state.bodies.fresh, true);
  assert.equal(state.bodies.massReady, true);
  const native = await f.inspect(label, state.doc);
  assert.equal(native.length, 2);
  assert.equal(state.bodies.bodies.length, 2);
  const facts = [
    { id: 'n3', key: 'b3', volume: Math.PI * 25 * 6, centroid: [50, 10, 3] },
    { id: 'n4', key: 'b4', volume: (600 - 4 * Math.PI) * depth, centroid: [15, 10, depth / 2] },
  ];
  for (const { id, key, volume, centroid } of facts) {
    const solid = native.find(body => body.id === id);
    const worker = state.bodies.bodies.find(body => body.key === key);
    assert.equal(solid?.valid, true, id);
    for (const data of [solid, worker]) {
      assert.ok(data, key);
      assert.ok(Math.abs(data.volume - volume) <= 1e-5, JSON.stringify(data));
      assert.ok(Math.hypot(...data.centroid.map((value, axis) => value - centroid[axis])) <= 1e-6, JSON.stringify(data));
    }
  }
  f.report.observations.push({ label, order: state.doc.nodes.map(node => node.id), native });
}

await f.run(async () => {
  f.phase = 'open two independent extrusions and a dependent Hole';
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: documentName, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  await verifySolids('01-source', source, 8);

  f.phase = 'move the cylinder before the plate';
  await moveEarlier(3);
  await f.page.waitForFunction(() => window.__studioDoc.nodes[0]?.id === 'n2', null, { timeout: 15000 });
  await f.ready();
  await verifySolids('02-reordered', reordered, 8);

  f.phase = 'refuse a Hole ahead of its plate and keep the first history step';
  await moveEarlier(4);
  const refusal = await f.waitToast(/Cannot move Hole.*built on the step before it/s);
  await f.same(reordered);
  await f.snapshot('03-dependent-move-refused');
  f.report.observations.push({ label: 'dependent-move-refused', refusal });
  await f.dismissToasts();
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(reordered);

  f.phase = 'save and reopen the exact reordered project';
  await openProject();
  await button(f.page, 'Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(documentName, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, name]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    return Array.from(new Uint8Array(await (await (await directory.getFileHandle(name)).getFile()).arrayBuffer()));
  }, [projectName, documentName]));
  assert.deepEqual(JSON.parse(bytes), reordered);
  await button(versions(), 'Close project').click();
  await versions().getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await openProject();
  await button(versions(), 'Open ' + documentName).click();
  await f.same(reordered);
  f.report.observations.push({ label: 'project-readback', bytes: bytes.length, sha256: sha256(bytes) });
  await verifySolids('04-reopened', reordered, 8);

  f.phase = 'edit the plate after Open and recalculate its Hole only';
  await f.openFeatureEditor(3, 'reordered plate');
  const height = f.editor().getByLabel('Distance', { exact: true });
  assert.equal(await height.inputValue(), '8');
  await height.fill('10');
  await f.applyEditor(reordered, 'reordered plate height 10');
  const edited = { ...reordered, nodes: reordered.nodes.map(node => node.id === 'n1' ? { ...node, height: 10 } : node) };
  await verifySolids('05-reopened-source-edit', edited, 10);
  assert.deepEqual(f.report.downloads, []);
});

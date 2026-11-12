import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/extrude-legacy-modes-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/Hud.tsx',
  'packages/barocss-cad-model/src/app/profileCommands.ts',
  'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad/src/features/drafted-extrusion.ts',
];
const f = await createFlow({
  name: 'extrude-legacy-modes', output: process.argv[2], envFrozen: 'D847_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Verify original fixed Distance, draft, named height and local start, then face-start Join/New and Cut Through all.',
  limits: ['Desktop WebGPU. Rectangular profiles and one rectangular through-window.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const part = toPartDocument(doc), result = evaluateCadPart(part);
console.log(JSON.stringify({
  features: part.features,
  outputs: result.outputs.map(output => ({
    id: output.id, valid: checkOutput(output).valid, count: output.bodyCount, mass: massPropertiesOf(output),
    corners: output.brep.vertices.map(vertex => vertex.point),
  })),
}));
`,
});
const base = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 20] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const draftedSeed = {
  ...base, parameters: { Height: 15 },
  nodes: [...base.nodes, { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [25, 0], max: [35, 10] }], nextId: 3,
};
const button = (panel, name) => panel.getByRole('button', { name, exact: true });
const field = (panel, name) => panel.getByLabel(name, { exact: true });
const status = () => f.hud().locator('.status').filter({ hasText: /^preview$/ }).waitFor();
const near = (a, b) => Math.abs(a - b) < 1e-7;
const initialBody = { id: 'n1', volume: 4000, centroid: [10, 10, 5], bounds: [[0, 0, 0], [20, 20, 10]] };

async function open(name, doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
}

async function verify(label, expected) {
  await f.ready();
  const doc = await f.doc(), native = await f.inspect(label, doc), { fresh, massReady, bodies } = await f.bodies();
  assert.ok(fresh && massReady);
  assert.equal(native.outputs.length, expected.length);
  assert.equal(bodies.length, expected.length);
  for (const item of expected) {
    const output = native.outputs.find(output => output.id === item.id);
    assert.ok(output?.valid && output.count === 1);
    const bounds = [Math.min, Math.max].map(extreme => [0, 1, 2].map(axis => extreme(...output.corners.map(point => point[axis]))));
    assert.ok(bounds.every((point, j) => point.every((value, i) => near(value, item.bounds[j][i]))));
    const shown = bodies.find(body => body.key === 'b' + item.id.slice(1));
    for (const mass of [output.mass, shown]) {
      assert.ok(near(mass.volume, item.volume), JSON.stringify({ actual: mass.volume, expected: item.volume }));
      assert.ok(mass.centroid.every((value, i) => near(value, item.centroid[i])));
    }
  }
  f.report.observations.push({ label, expected, native: native.outputs.map(output => ({ id: output.id, corners: output.corners.length })) });
  return { doc, native };
}

function draftedBody(height, start) {
  const tangent = Math.tan(5 * Math.PI / 180);
  const volume = 100 * height - 20 * tangent * height ** 2 + 4 * tangent ** 2 * height ** 3 / 3;
  const moment = 50 * height ** 2 - 40 * tangent * height ** 3 / 3 + tangent ** 2 * height ** 4;
  return { id: 'n3', volume, centroid: [30, 5, start + moment / volume], bounds: [[25, 0, start], [35, 10, start + height]] };
}

async function clickWorld(point) {
  const pixel = await f.page.evaluate(point => {
    const xy = window.__studioScreenOf(point);
    return xy && document.elementFromPoint(...xy)?.closest('.vp-canvas') ? xy : null;
  }, point);
  assert.ok(pixel);
  await f.page.mouse.click(...pixel);
}

async function topFace() {
  await button(f.page, 'View cube directions').click();
  await f.page.getByRole('menuitem', { name: 'Top', exact: true }).click();
  await f.page.waitForFunction(() => {
    const labels = [...document.querySelectorAll('.view-cube .vc-label')];
    return labels.length === 1 && labels[0].textContent === 'TOP';
  });
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await clickWorld([14, 12, 10]);
  await f.page.waitForFunction(() => window.__studioSelection?.selection?.faces?.length === 1);
}

async function applyHud(before) {
  await status();
  await button(f.hud(), 'Apply').click();
  await f.changed(before);
  await f.hud().waitFor({ state: 'hidden' });
}

await f.run(async () => {
  await f.newPage();
  f.phase = 'regular distance and draft with another solid present';
  await open('D847-distance.bcad', draftedSeed);
  await button(f.page.getByRole('group', { name: 'History', exact: true }), 'Sketch · rectangle').click();
  await f.editor().waitFor();
  await f.closeEditor();
  await f.openExtrudeHud();
  const hud = f.hud();
  assert.equal(await field(hud, 'Depth').inputValue(), 'distance');
  assert.equal(await field(hud, 'Distance').inputValue(), '8');
  await field(hud, 'Distance').fill('12');
  await field(hud, 'Draft').fill('5');
  await applyHud(draftedSeed);
  const draft = await verify('legacy-fixed-draft', [initialBody, draftedBody(12, 0)]);
  assert.deepEqual(draft.doc.nodes[3], { id: 'n3', kind: 'extrude', sketch: 2, height: 12, draft: 5 });

  f.phase = 'bind the ordinary Distance to a named parameter and move Start Z';
  await f.openFeatureEditor(3, 'ordinary Distance');
  const editor = f.editor();
  await field(editor, 'Distance parameter').selectOption('Height');
  assert.equal(await field(editor, 'Distance').inputValue(), '15');
  await field(editor, 'Start Z').fill('3');
  await button(editor, 'Apply').click();
  await f.changed(draft.doc);
  await editor.waitFor({ state: 'hidden' });
  const named = await verify('legacy-named-distance-start', [initialBody, draftedBody(15, 3)]);
  assert.deepEqual(named.doc.nodes[3], { id: 'n3', kind: 'extrude', sketch: 2, height: { parameter: 'Height' }, draft: 5, from: 3 });
  await f.snapshot('01-named-distance');
  await f.undo();
  assert.deepEqual(await f.doc(), draft.doc);
  await f.redo();
  assert.deepEqual(await f.doc(), named.doc);

  f.phase = 'join an ordinary extrusion from the actual top face';
  await open('D847-face-start.bcad', base);
  await topFace();
  await f.openExtrudeHud();
  assert.equal(await field(hud, 'Operation').inputValue(), 'join');
  assert.equal(await field(hud, 'Depth').count(), 0);
  await field(hud, 'Distance').fill('4');
  await applyHud(base);
  const joined = await verify('legacy-face-join', [{ id: 'n4', volume: 5600, centroid: [10, 10, 7], bounds: [[0, 0, 0], [20, 20, 14]] }]);
  assert.equal(joined.doc.nodes[4].kind, 'union');
  assert.deepEqual(joined.doc.nodes[2].on, { node: 1, side: 'solid' });
  await f.undo();
  await f.same(base);

  f.phase = 'make a new body from the actual top face';
  await topFace();
  await f.openExtrudeHud();
  await field(hud, 'Operation').selectOption('new');
  await field(hud, 'Distance').fill('4');
  await applyHud(base);
  const separated = await verify('legacy-face-new', [initialBody, { id: 'n3', volume: 1600, centroid: [10, 10, 12], bounds: [[0, 0, 10], [20, 20, 14]] }]);
  assert.equal(separated.doc.nodes.length, 4);
  assert.equal(separated.doc.nodes[3].kind, 'extrude');
  await f.undo();
  await f.same(base);

  f.phase = 'draw a face-start profile and use Cut Through all';
  await topFace();
  const edit = f.page.getByRole('dialog', { name: /^Edit Extrude/ });
  if (await edit.isVisible()) await button(edit, 'Cancel').click();
  await button(f.page.getByRole('navigation', { name: 'Tools', exact: true }), 'Sketch').click();
  const sketch = f.sketchPanel();
  await sketch.waitFor();
  await clickWorld([4, 6, 10]);
  await clickWorld([10, 14, 10]);
  await f.page.locator('.topbar button.finish').click();
  await f.changed(base);
  await sketch.waitFor({ state: 'hidden' });
  const drawn = await f.doc();
  assert.deepEqual(drawn.nodes[2].on, { node: 1, side: 'solid' });
  await f.openExtrudeHud();
  await field(hud, 'Operation').selectOption('cut');
  const depth = field(hud, 'Depth');
  assert.deepEqual(await depth.locator('option').allTextContents(), ['Distance', 'Through all']);
  await depth.selectOption('through');
  assert.equal(await field(hud, 'Distance').count(), 0);
  await applyHud(drawn);
  const cut = await verify('legacy-cut-through', [{ id: 'n4', volume: 3520, centroid: [(40000 - 480 * 7) / 3520, 10, 5], bounds: [[0, 0, 0], [20, 20, 10]] }]);
  assert.equal(cut.doc.nodes[4].kind, 'difference');
  assert.equal(cut.doc.nodes[3].height, 11);
  assert.equal(cut.doc.nodes[3].from, -11);
  await f.page.getByRole('button', { name: 'Iso', exact: true }).click();
  await f.snapshot('02-through-all');
  await f.undo();
  assert.deepEqual(await f.doc(), drawn);
  await f.redo();
  assert.deepEqual(await f.doc(), cut.doc);
  assert.deepEqual(f.report.downloads, []);
});

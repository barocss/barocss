import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = ['apps/cad-studio/test/extrude-cut-workplanes-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/NodeEditor.tsx', 'packages/barocss-cad-model/src/app/profileCommands.ts',
  'packages/barocss-cad-model/src/app/editFields.ts', 'packages/barocss-cad/src/part/part-profile-solid.ts'];
const f = await createFlow({
  name: 'extrude-cut-workplanes', output: process.argv[2], envFrozen: 'D1159_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Distance edits follow the local face normal on a side and an oblique work plane.',
  limits: ['Desktop Chrome, a side Cut and two Cuts on one oblique rectangular stock.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { frame, depth, rectangle } = JSON.parse(process.argv[3]);
const { origin, normal, xAxis, yAxis } = frame;
const [output] = evaluateCadPart(toPartDocument(doc)).outputs;
const dot = (p, q) => p.reduce((sum, x, i) => sum + x * q[i], 0);
const delta = p => p.map((v, i) => v - origin[i]);
const points = output.brep.vertices.map(v => [dot(delta(v.point), xAxis), dot(delta(v.point), yAxis), dot(delta(v.point), normal)]);
const floors = output.brep.faces.flatMap(face => {
  const g = faceGeometry(face);
  return g.kind === 'plane' && dot(g.n, normal) > 1 - 1e-8 ? [{ name: face.name, level: dot(delta(g.o), normal) }] : [];
});
const rings = [0, -depth].map(level => points.filter(p => Math.abs(p[2] - level) < 1e-7
  && p[0] >= rectangle[0][0] - 1e-7 && p[0] <= rectangle[1][0] + 1e-7
  && p[1] >= rectangle[0][1] - 1e-7 && p[1] <= rectangle[1][1] + 1e-7));
console.log(JSON.stringify({ valid: checkOutput(output).valid, pieces: output.bodyCount, volume: massPropertiesOf(output).volume,
  floors, rings }));
`,
});
const root = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2,
  outputs: { b1: { node: 1, side: 'solid' } },
};
const rectangle = () => ({ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] });
const s = 0.5, c = Math.sqrt(3) / 2;
const tilted = { origin: [0, 0, 0], normal: [0, -s, c], xAxis: [1, 0, 0] };
const baseFixtures = [
  { label: 'right', view: 'Right', seed: { ...root, nodes: [rectangle(), { id: 'n1', kind: 'extrude', sketch: 0, height: 10 }] },
    frame: { origin: [40, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0], yAxis: [0, 0, 1] }, box: [[11, 3], [19, 7]], planeLabel: /X 40 · on face/ },
  { label: 'tilted', view: 'Top', seed: { ...root, nodes: [{ ...rectangle(), plane: tilted }, { id: 'n1', kind: 'extrude', sketch: 0, height: 10, from: -10 }] },
    frame: { ...tilted, yAxis: [0, c, s] }, box: [[14, 11], [26, 19]], planeLabel: /30° tilted plane · on face/ },
];
const fixtures = [...baseFixtures, { ...baseFixtures[1], label: 'tilted-draft', draft: 10 }];
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const field = (name, scope) => scope.getByLabel(name, { exact: true });
const near = (a, b) => Math.abs(a - b) < 1e-7;
const at = ({ origin, xAxis, yAxis }, [u, v]) => origin.map((n, axis) => n + u * xAxis[axis] + v * yAxis[axis]);
const click = async p => {
  const pixel = await f.screenOf(p);
  assert.ok(pixel?.length === 2);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.vp-canvas'), pixel));
  await f.page.mouse.click(...pixel);
};

async function verify(label, fixture, doc, depth) {
  const { box, frame, draft = 0 } = fixture;
  const slope = Math.tan(draft * Math.PI / 180), width = box[1][0] - box[0][0], height = box[1][1] - box[0][1];
  const volume = 12000 - (width * height * depth - (width + height) * slope * depth ** 2 + (4 / 3) * slope ** 2 * depth ** 3);
  const native = await f.inspect(label, doc, { frame, depth, rectangle: box });
  const current = (await f.bodies()).bodies;
  f.report.observations.push({ label, depth, draft, expectedVolume: volume, native });
  assert.ok(native.valid && native.pieces === 1 && near(native.volume, volume), JSON.stringify(native));
  assert.equal(current.length, 1);
  assert.ok(near(current[0].volume, native.volume));
  assert.ok(native.floors.some(face => near(face.level, -depth)), JSON.stringify(native));
  for (const [index, ring] of native.rings.entries()) {
    const inset = index * depth * slope;
    assert.equal(ring.length, 4, JSON.stringify(native));
    for (const u of [box[0][0] + inset, box[1][0] - inset]) for (const v of [box[0][1] + inset, box[1][1] - inset]) {
      assert.ok(ring.some(p => near(p[0], u) && near(p[1], v)), JSON.stringify(ring));
    }
  }
}

await f.run(async () => {
  for (const fixture of fixtures) {
    const { label, seed, view, frame, box } = fixture;
    await f.newPage();
    f.phase = label + ' face and Cut';
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: `D1159-${label}.bcad`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
    await f.same(seed);
    await button(view, f.page.locator('.views')).click();
    await f.page.getByTitle('Frame all (F)', { exact: true }).click();
    await click(at(frame, box[0].map((v, k) => (v + box[1][k]) / 2)));
    await f.page.waitForFunction(() => window.__studioSelection.selection.faces.length === 1);
    await button('Sketch', f.page.locator('.mode')).click();
    await f.sketchPanel().waitFor();
    assert.match(await f.sketchPanel().locator('.card-title').first().innerText(), fixture.planeLabel);
    for (const p of box) await click(at(frame, p));
    const sketch = await f.finishSketch(label + '-sketch');
    assert.deepEqual(sketch.doc.nodes[2].on, { node: 1, side: 'solid' });
    for (const key of ['origin', 'normal', 'xAxis']) {
      assert.ok(sketch.doc.nodes[2].plane[key].every((n, i) => near(n, frame[key][i])), JSON.stringify(sketch.doc.nodes[2]));
    }
    await f.openExtrudeHud();
    const hud = f.hud();
    await field('Operation', hud).selectOption('cut');
    await field('Distance', hud).fill('2');
    if (fixture.draft) await field('Draft', hud).fill(String(fixture.draft));
    await hud.locator('.status').filter({ hasText: /^preview$/ }).waitFor();
    await button('Apply', hud).click();
    await f.changed(sketch.doc);
    await hud.waitFor({ state: 'hidden' });
    const before = await f.snapshot(label + '-cut-depth-2');
    await verify(label + '-depth-2', fixture, before.doc, 2);
    await f.openFeatureEditor(3, label + ' Cut Distance');
    const distance = field('Distance', f.editor());
    assert.equal(await distance.inputValue(), '2');
    await distance.fill('4');
    const after = await f.applyEditor(before.doc, label + '-cut-depth-4');
    await verify(label + '-depth-4', fixture, after.doc, 4);
    assert.deepEqual(after.doc.nodes[2], before.doc.nodes[2]);
    assert.deepEqual(after.doc.nodes[4], before.doc.nodes[4]);
    await f.undo();
    await f.same(before.doc);
    await f.redo();
    await f.same(after.doc);
    const saved = await f.save(label + '-cut');
    const reopened = await f.freshOpen(saved.file, after.doc, label + '-cut-reopened');
    await verify(label + '-reopened', fixture, reopened.doc, 4);
  }
});

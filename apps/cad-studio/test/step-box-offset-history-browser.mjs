import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/files/importedFile.ts',
  'apps/cad-studio/src/ui/NodeEditor.tsx', 'packages/barocss-cad-model/src/app/offsetFaceEdit.ts',
  'packages/barocss-cad-model/src/app/nativeOffsetFace.ts'];
const f = await createFlow({
  name: 'step-box-offset-history', output: process.argv[2], envFrozen: 'D1174_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Offset the top face of an imported STEP box and edit the signed distance in History.',
  limits: ['One locally generated native STEP box in millimetres. Desktop Studio Open, viewport face pick and native Save/Open.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, evaluateCadPart, exportStep, massPropertiesOf } from '@barocss/cad';
import { partSnapshot } from '@barocss/cad-model/engine/part';
if (process.argv[3] === '"step"') {
  const { outputs: [{ brep }] } = evaluateCadPart({
    format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
      { id: 'sketch', kind: 'sketch', profile: 'rectangle', min: [4, -3], max: [24, 7] },
      { id: 'box', kind: 'extrude', sketch: 'sketch', from: 6, height: 5 },
    ],
  });
  console.log(JSON.stringify(exportStep(brep, { timestamp: '2026-11-14T00:00:00Z' })));
} else {
  const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const { outputs: [body], outputs } = partSnapshot(doc);
  const { brep } = body, mass = massPropertiesOf(body);
  const loops = new Map(brep.loops.map(loop => [loop.id, loop]));
  const uses = new Map(brep.coedges.map(use => [use.id, use]));
  const edges = new Map(brep.edges.map(edge => [edge.id, edge]));
  const vertices = new Map(brep.vertices.map(vertex => [vertex.id, vertex.point]));
  const faces = brep.faces.map(face => ({
    name: face.name,
    points: face.loops.flatMap(loopId => loops.get(loopId).coedges.map(useId => {
      const use = uses.get(useId), edge = edges.get(use.edge);
      return vertices.get(edge.vertices[use.sense === 'forward' ? 0 : 1]);
    })),
  }));
  console.log(JSON.stringify({ outputCount: outputs.length, solidCount: body.bodyCount,
    valid: checkBrep(brep, { strict: true }).valid,
    volume: mass.volume, centroid: mass.centroid, faces, vertices: [...vertices.values()] }));
}
`,
});

const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const status = (hud, meaning) => hud.locator('.status').filter({ hasText: new RegExp('^' + meaning + '$') }).waitFor();
const near = (actual, expected) => Math.abs(actual - expected) <= 1e-7;

async function verify(label, doc, distance) {
  const native = await f.inspect(label, doc);
  const low = [4, -3, 6], high = [24, 7, 11 + distance];
  const volume = 20 * 10 * (5 + distance), centroid = [14, 2, (6 + high[2]) / 2];
  assert.equal(native.outputCount, 1);
  assert.equal(native.solidCount, 1);
  assert.equal(native.valid, true);
  assert.ok(near(native.volume, volume), JSON.stringify(native));
  assert.ok(native.centroid.every((value, axis) => near(value, centroid[axis])));
  for (const [axis, min] of low.entries()) {
    const coords = native.vertices.map(point => point[axis]);
    assert.ok(near(Math.min(...coords), min));
    assert.ok(near(Math.max(...coords), high[axis]));
  }
  for (const face of native.faces) {
    assert.ok(low.some((min, axis) => [min, high[axis]].some(level =>
      face.points.every(point => near(point[axis], level)))), JSON.stringify(face));
  }
  for (const z of [6, high[2]]) {
    const caps = native.faces.filter(face => face.points.every(point => near(point[2], z)));
    assert.equal(caps.length, 1);
    assert.equal(caps[0].points.length, 4);
    for (const x of [4, 24]) for (const y of [-3, 7]) {
      assert.ok(caps[0].points.some(point => near(point[0], x) && near(point[1], y)));
    }
  }
  const top = native.faces.find(face => face.points.every(point => near(point[2], high[2])));
  f.report.observations.push({ label, distance, bounds: [low, high],
    volume: native.volume, expectedVolume: volume, centroid: native.centroid, top: top.name });
  return top.name;
}

async function editOffset(index, distance) {
  await f.openFeatureEditor(index, 'original Offset');
  await button('Edit offset', f.editor()).click();
  const hud = f.page.getByRole('dialog', { name: 'Edit Offset face', exact: true });
  await status(hud, 'preview');
  const field = hud.getByLabel('Offset', { exact: true });
  assert.equal(await field.inputValue(), String(distance));
  return { hud, field };
}

await f.run(async () => {
  const step = await f.inspect('step-fixture', {}, 'step');
  f.report.observations.push({ label: 'step-source', hash: sha256(step) });
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D1174-offset-box.step', mimeType: 'application/step', buffer: Buffer.from(step) });
  await f.waitToast(/STEP opened.*1 solid.*millimetres/);
  await f.ready();
  const source = await f.doc();
  assert.equal(source.nodes.length, 1);
  assert.equal(source.nodes[0].kind, 'import');
  assert.equal(source.nodes[0].step, step);
  const faceName = await verify('opened-step', source, 0);

  f.phase = 'Pick the exact top of the imported solid and apply an inward Offset';
  await button('View cube directions', f.page.getByRole('group', { name: 'View cube' })).click();
  await f.page.getByRole('menuitem', { name: 'Top', exact: true }).click();
  await f.page.waitForFunction(() => document.querySelector('.view-cube .vc-label')?.textContent === 'TOP');
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  const pixel = await f.page.evaluate(() => window.__studioScreenOf([14, 2, 11]));
  assert.ok(pixel?.length === 2);
  await f.page.mouse.click(...pixel);
  await f.page.waitForFunction(() => window.__studioSelection.selection.faces.length === 1);
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.command('Offset face');
  const creation = f.page.getByRole('dialog', { name: 'Offset face', exact: true });
  await creation.getByLabel('Offset', { exact: true }).fill('-2');
  await status(creation, 'preview');
  await f.same(source);
  await button('Apply', creation).click();
  await f.changed(source);
  const inward = (await f.snapshot('imported-offset-inward')).doc;
  const terminal = inward.nodes.length - 1;
  assert.equal(terminal, 3);
  assert.deepEqual(inward.nodes[terminal].made.values, { d: -2, face: faceName });
  await verify('imported-offset-inward', inward, -2);

  const { hud, field } = await editOffset(terminal, -2);
  await field.fill('-5');
  await status(hud, 'refused');
  assert.equal(await button('Apply', hud).isEnabled(), false);
  await f.same(inward);
  await f.snapshot('imported-offset-thickness-refused');
  await field.fill('3');
  await status(hud, 'preview');
  await f.same(inward);
  await f.snapshot('imported-offset-outward-preview');
  await button('Apply', hud).click();
  await f.changed(inward);
  const outward = (await f.snapshot('imported-offset-outward')).doc;
  assert.deepEqual(outward.nodes[terminal].made.values, { d: 3, face: faceName });
  assert.deepEqual(outward.nodes[0], source.nodes[0]);
  assert.deepEqual(outward.nodes.map(node => node.id), inward.nodes.map(node => node.id));
  assert.deepEqual(outward.outputs, inward.outputs);
  await verify('imported-offset-outward', outward, 3);

  await f.undo();
  await f.same(inward);
  await verify('imported-offset-undo', await f.doc(), -2);
  await f.redo();
  await f.same(outward);
  const saved = await f.save('step-box-offset-history');
  const reopened = await f.freshOpen(saved.file, outward, 'imported-offset-reopened');
  await verify('imported-offset-reopened', reopened.doc, 3);
  const savedEdit = await editOffset(terminal, 3);
  await button('Cancel', savedEdit.hud).click();
  await f.same(outward);
});

import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv.includes('--baseline');
const fixedFallback = process.argv.includes('--fixed-fallback');
const pins = ['apps/cad-studio/test/extrude-through-all-history-browser.mjs', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/app/profileCommands.ts', 'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad-model/src/engine/doc.ts', 'packages/barocss-cad-model/src/engine/part.ts'];
if (!baseline) pins.push('packages/barocss-cad-model/src/engine/throughCut.ts', 'packages/barocss-cad-model/src/engine/migrate.ts');
const f = await createFlow({
  name: 'extrude-through-all-history', output: process.argv[2], envFrozen: 'D1152_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'A Through all cut follows the stock down while its sketch stays at Z=10.',
  limits: ['One upright rectangular stock and a rectangular cut with zero draft.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8')), part = toPartDocument(doc);
const [body] = evaluateCadPart(part).outputs;
const planes = body.brep.faces.flatMap(face => {
  const g = faceGeometry(face);
  return g.kind === 'plane' && Math.abs(g.n[2]) > 0.999999 ? [{ z: g.o[2], normal: g.n[2], loops: face.loops.length }] : [];
});
console.log(JSON.stringify({ valid: checkOutput(body).valid, count: body.bodyCount, volume: massPropertiesOf(body).volume,
  planes, tool: part.features.find(feature => feature.id === 'n3') }));
`,
});
const ref = node => ({ node, side: 'solid' });
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 3,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: fixedFallback ? 14 : 10 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [12, 10], max: [20, 18], on: ref(1),
      plane: { origin: [0, 0, 10], normal: [0, 0, 1], xAxis: [1, 0, 0] } },
  ],
  outputs: { b1: ref(1) },
};
const button = name => f.page.getByRole('button', { name, exact: true });
const field = (panel, name) => panel.getByLabel(name, { exact: true });
const near = (value, expected) => Math.abs(value - expected) < 1e-7;

async function inspect(label, expected, bottom) {
  const doc = await f.doc(), result = await f.inspect(label, doc), shown = (await f.bodies()).bodies;
  f.report.observations.push({ label, expected, bottom, result, savedTool: doc.nodes[3], stock: doc.nodes[1] });
  await f.snapshot(label);
  assert.ok(result.valid && result.count === 1 && shown.length === 1);
  assert.ok(near(shown[0].volume, result.volume));
  assert.ok(result.planes.some(plane => plane.normal < 0 && near(plane.z, bottom)));
  return { doc, result };
}

await f.run(async () => {
  await f.newPage();
  f.phase = 'apply Through all from the actual Extrude panel';
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D1152-stock.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  await f.page.getByRole('group', { name: 'History', exact: true }).getByRole('button', { name: 'Sketch · rectangle', exact: true }).click();
  await f.editor().waitFor();
  await f.closeEditor();
  await f.openExtrudeHud();
  const hud = f.hud();
  await field(hud, 'Operation').selectOption('cut');
  await field(hud, 'Depth').selectOption('through');
  if (fixedFallback) await hud.getByText('Fixed at this depth after Apply', { exact: true }).waitFor();
  await hud.locator('.status').filter({ hasText: /^preview$/ }).waitFor();
  await hud.getByRole('button', { name: 'Apply', exact: true }).click();
  await f.changed(source);
  await hud.waitFor({ state: 'hidden' });
  const first = await inspect('through-10', 11360 + (fixedFallback ? 4 * 1200 : 0), 0);
  assert.ok(near(first.result.volume, 11360 + (fixedFallback ? 4 * 1200 : 0)));
  assert.equal(first.result.planes.filter(plane => plane.normal < 0 && near(plane.z, 0))[0].loops, 2);
  if (fixedFallback) {
    assert.equal(first.doc.nodes[3].cutDepth, undefined);
    assert.equal(first.result.tool.height, 11);
    return;
  }
  const saved = await f.save('through-10-saved');
  await f.freshOpen(saved.file, first.doc, 'reopen-through');
  if (!baseline) {
    assert.equal(first.doc.nodes[3].cutDepth, 'through');
    await f.openFeatureEditor(3, 'saved Through all');
    await f.editor().getByText('Through all', { exact: true }).waitFor();
    assert.equal(await field(f.editor(), 'Distance').count(), 0);
    assert.equal(await field(f.editor(), 'Start Z').count(), 0);
    await f.closeEditor();
  }
  f.phase = 'extend the stock 4 mm away from the fixed opening';
  await f.openFeatureEditor(1, 'original stock');
  await field(f.editor(), 'Distance').fill('14');
  await field(f.editor(), 'Start Z').fill('-4');
  await f.applyEditor(first.doc, 'grow-stock');
  const grown = await inspect('through-14', (1200 - 64) * 14, -4);
  assert.deepEqual(grown.doc.nodes[2], first.doc.nodes[2]);
  assert.deepEqual(grown.doc.nodes[4], first.doc.nodes[4]);
  const floor = grown.result.planes.find(plane => plane.normal > 0 && near(plane.z, -1));
  if (baseline) {
    assert.equal(grown.result.tool.height, 11);
    assert.equal(grown.result.tool.from, -11);
    assert.ok(near(grown.result.volume, 16096));
    assert.ok(floor && floor.loops === 1);
    assert.fail('Through all was saved as an 11 mm fixed tool and left a 3 mm floor after the stock grew');
  }
  assert.equal(grown.result.tool.height, 15);
  assert.equal(grown.result.tool.from, -15);
  assert.ok(!floor && near(grown.result.volume, 15904));
  assert.equal(grown.result.planes.filter(plane => plane.normal < 0 && near(plane.z, -4))[0].loops, 2);
  assert.deepEqual(grown.doc.nodes[3], first.doc.nodes[3]);
  await f.undo();
  await f.same(first.doc);
  await f.redo();
  await f.same(grown.doc);
  const savedGrown = await f.save('through-14-saved');
  await f.freshOpen(savedGrown.file, grown.doc, 'reopen-grown');
  const reopened = await inspect('through-14-reopened', 15904, -4);
  assert.deepEqual(reopened.result, grown.result);
});

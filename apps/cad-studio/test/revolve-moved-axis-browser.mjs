import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv.includes('--baseline');
const pins = ['apps/cad-studio/src/App.tsx', 'packages/barocss-cad-model/src/app/profileCommands.ts',
  'packages/barocss-cad-model/src/engine/revolveAxis.ts'];
const f = await createFlow({
  name: 'revolve-moved-axis', output: process.argv[2], envFrozen: 'D1165_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'A linked Revolve follows an earlier stock Move when its displacement changes in History.',
  limits: ['Desktop WebGPU. One literal Move of native rectangular stock, one XY sketch, full-turn New body.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8')), part = toPartDocument(doc);
const result = evaluateCadPart(part), stock = result.outputs.find(body => ['n2', 'n5'].includes(body.id)), rotor = result.outputs.find(body => body.id === 'n4');
const cylinders = rotor.brep.faces.map(faceGeometry).filter(g => g.kind === 'cylinder');
console.log(JSON.stringify({ stockValid: checkOutput(stock).valid, stockId: stock.id, stockVolume: massPropertiesOf(stock).volume,
  stockMinY: Math.min(...stock.brep.vertices.map(v => v.point[1])), valid: checkOutput(rotor).valid, volume: massPropertiesOf(rotor).volume,
  count: rotor.bodyCount, axis: part.features.find(feature => feature.id === 'n4').axis, cylinders }));
`,
});
const ref = node => ({ node, side: 'solid' });
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 4,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 20 },
    { id: 'n2', kind: 'translate', parent: ref(1), offset: [0, 2, 0] },
    { id: 'n3', kind: 'sketch', profile: 'rectangle', min: [10, 6], max: [20, 9],
      plane: { origin: [0, 0, 20], normal: [0, 0, 1], xAxis: [1, 0, 0] } },
  ],
  outputs: { b2: ref(2) },
  bodies: { b2: { name: 'Moved stock' } },
};
const link = side => ({ version: 1, sourceFeature: 'n2', edge: `n1.side${side}|n1.top`, side });
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const field = (name, scope = f.editor()) => scope.getByLabel(name, { exact: true });
const near = (a, b) => Math.abs(a - b) < 1e-7;
const preview = hud => hud.locator('.status').filter({ hasText: /^preview$/ }).waitFor();
async function verify(label, doc, axisY, stockY, r0, r1) {
  const native = await f.inspect(label, doc), expected = 10 * Math.PI * (r1 ** 2 - r0 ** 2);
  f.report.observations.push({ label, axisY: native.axis.origin[1], stockY: native.stockMinY, stockId: native.stockId, volume: native.volume, expected, stockVolume: native.stockVolume });
  assert.ok(native.stockValid && near(native.stockVolume, 16000) && near(native.stockMinY, stockY), JSON.stringify(native));
  assert.ok(native.valid && native.count === 1 && near(native.volume, expected), JSON.stringify(native));
  assert.ok(near(native.axis.origin[1], axisY) && near(Math.abs(native.axis.direction[0]), 1) && near(native.axis.direction[1], 0));
  for (const r of [r0, r1]) assert.ok(native.cylinders.some(c => near(c.r, r) && near(c.c[1], axisY) && near(c.c[2], 20)));
}
async function top() {
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await button('Top', f.page.locator('.views')).click();
  await f.page.waitForFunction(() => document.querySelector('.view-cube .vc-label')?.textContent === 'TOP');
}
async function pick(y) {
  const hit = await f.page.evaluate(y => {
    const point = [30, y, 20], edge = window.__studioEdgeAt(point, 4), pixel = window.__studioScreenOf(point);
    return edge && window.__studioSection().shownKeys[edge.body] === 'b2' && document.elementFromPoint(...pixel)?.closest('.vp-canvas') ? { edge, pixel } : null;
  }, y);
  assert.ok(hit?.edge.segments.length, `original moved stock edge at Y${y}`);
  assert.ok(hit.edge.segments.some(s => near(s[1], y) && near(s[4], y) && near(s[2], 20) && near(s[5], 20) && near(Math.abs(s[3] - s[0]), 40)));
  await f.page.mouse.click(...hit.pixel);
}
await f.run(async () => {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D1165-moved-stock.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  await f.page.getByRole('group', { name: 'History', exact: true }).getByRole('button', { name: 'Sketch · rectangle', exact: true }).click();
  await f.editor().waitFor();
  await f.closeEditor();
  await f.command('Revolve');
  const hud = f.page.getByRole('dialog', { name: 'Revolve', exact: true });
  await preview(hud);
  await top();
  f.phase = 'pick the earlier Move output';
  await pick(22);
  await hud.getByText(baseline ? 'edge n1.side2|n1.top · fixed' : 'edge n1.side2|n1.top · linked', { exact: true }).waitFor();
  await preview(hud);
  await button('Apply', hud).click();
  await f.changed(seed);
  const before = await f.snapshot('axis-y22');
  await verify('axis-y22', before.doc, 22, 2, 13, 16);
  assert.deepEqual(before.doc.nodes[4].axisRef, baseline ? undefined : link(2));
  await f.openFeatureEditor(2, 'edit the earlier Move from Y2 to Y6');
  await field('ΔY').fill('6');
  const moved = await f.applyEditor(before.doc, 'earlier-move-y6');
  assert.deepEqual(moved.doc.nodes[4], before.doc.nodes[4]);
  if (baseline) {
    await verify('fixed-axis-y22', moved.doc, 22, 6, 13, 16);
    assert.fail('Move shifts the stock edge to Y26 while Revolve stays fixed at Y22');
  }
  await verify('axis-y26', moved.doc, 26, 6, 17, 20);
  await f.openFeatureEditor(2, 'refuse a Move that takes the axis out of plane');
  await field('ΔZ').fill('4');
  await button('Apply', f.editor()).click();
  const error = f.editor().locator('.hud-error');
  await error.locator('summary').click();
  await error.getByText(/source edge must remain in the sketch plane/i).waitFor();
  await f.same(moved.doc);
  await f.snapshot('off-plane-move-refused');
  await f.closeEditor();
  await f.undo();
  await f.same(before.doc);
  await f.redo();
  await f.same(moved.doc);
  await f.openFeatureEditor(4, 'replace an axis on the earlier Move output');
  await button('Replace axis', f.editor()).click();
  const edit = f.page.getByRole('dialog', { name: 'Replace axis', exact: true });
  await edit.locator('.status').filter({ hasText: /^pick edge$/ }).waitFor();
  await top();
  await pick(6);
  await preview(edit);
  await edit.getByText('Linked edge n1.side0|n1.top', { exact: true }).waitFor();
  await button('Cancel', edit).click();
  await f.same(moved.doc);
  await f.snapshot('moved-axis-replacement-cancelled');

  // The current stock stays the later Move's target. Revolve still reads its earlier source.
  f.phase = 'append a later Move to the stock';
  const body = f.page.locator('button.ol').filter({ hasText: /^Extrude 20/ });
  await body.click();
  assert.deepEqual(await f.page.evaluate(() => window.__studioSelection.selection.bodies.map(index => window.__studioSection().shownKeys[index])), ['b2']);
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.page.keyboard.press('g');
  const move = f.page.getByRole('dialog', { name: 'Move', exact: true });
  await field('ΔY', move).fill('7');
  await preview(move);
  await button('Apply', move).click();
  await f.changed(moved.doc);
  const later = await f.snapshot('later-move-keeps-order');
  assert.deepEqual(later.doc.nodes[4], moved.doc.nodes[4]);
  assert.deepEqual(later.doc.nodes[5].offset, [0, 7, 0]);
  await verify('later-move-keeps-order', later.doc, 26, 13, 17, 20);
  const saved = await f.save('revolve-moved-axis');
  const reopened = await f.freshOpen(saved.file, later.doc, 'moved-axis-reopened');
  await verify('reopened-axis-y26', reopened.doc, 26, 13, 17, 20);
});

import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv.includes('--baseline');
const pins = ['apps/cad-studio/test/revolve-linked-axis-browser.mjs', 'apps/cad-studio/src/ui/NodeEditor.tsx', 'apps/cad-studio/src/app/revolveAxisPick.ts',
  'packages/barocss-cad-model/src/app/profileCommands.ts', 'packages/barocss-cad-model/src/engine/part.ts',
  ...(!baseline ? ['packages/barocss-cad-model/src/engine/revolveAxis.ts'] : [])];
const f = await createFlow({
  name: 'revolve-linked-axis', output: process.argv[2], envFrozen: 'D1163_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Resolve a linked native Revolve axis after a source edit and preserve a fixed legacy axis.',
  limits: ['Desktop Chrome. One named X-parallel edge of a rectangular extrusion, one XY sketch, full-turn New body.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8')), part = toPartDocument(doc);
const out = evaluateCadPart(part).outputs.find(body => body.id === 'n3');
const cylinders = out.brep.faces.map(faceGeometry).filter(g => g.kind === 'cylinder');
console.log(JSON.stringify({ valid: checkOutput(out).valid, volume: massPropertiesOf(out).volume, count: out.bodyCount,
  axis: part.features.find(feature => feature.id === 'n3').axis, cylinders }));
`,
});
const ref = node => ({ node, side: 'solid' });
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 3,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 20 },
    { id: 'n2', kind: 'sketch', profile: 'rectangle', min: [10, 6], max: [20, 9],
      plane: { origin: [0, 0, 20], normal: [0, 0, 1], xAxis: [1, 0, 0] } },
  ],
  outputs: { b1: ref(1) },
  bodies: { b1: { name: 'Axis stock' } },
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const field = (name, scope = f.editor()) => scope.getByLabel(name, { exact: true });
const near = (a, b) => Math.abs(a - b) < 1e-7;
async function verify(label, doc, y, r0, r1) {
  const native = await f.inspect(label, doc);
  f.report.observations.push({ label, axisY: y, volume: native.volume, expected: 10 * Math.PI * (r1 ** 2 - r0 ** 2), native });
  assert.ok(native.valid && native.count === 1 && near(native.volume, 10 * Math.PI * (r1 ** 2 - r0 ** 2)), JSON.stringify(native));
  assert.ok(near(native.axis.origin[1], y) && near(Math.abs(native.axis.direction[0]), 1) && near(native.axis.direction[1], 0));
  for (const r of [r0, r1]) assert.ok(native.cylinders.some(c => near(c.r, r) && near(c.c[1], y) && near(c.c[2], 20) && near(Math.abs(c.a[0]), 1)));
}

async function open(doc, title) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: `${title}.bcad`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
}

await f.run(async () => {
  await f.newPage();
  await open(seed, 'D1163-revolve');
  await f.page.getByRole('group', { name: 'History', exact: true }).getByRole('button', { name: 'Sketch · rectangle', exact: true }).click();
  await f.editor().waitFor();
  await f.closeEditor();
  await f.command('Revolve');
  const hud = f.page.getByRole('dialog', { name: 'Revolve', exact: true });
  const preview = () => hud.locator('.status').filter({ hasText: /^preview$/ }).waitFor();
  await preview();
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await button('Top', f.page.locator('.views')).click();
  await f.page.waitForFunction(() => document.querySelector('.view-cube .vc-label')?.textContent === 'TOP');
  const hit = await f.page.evaluate(() => {
    const world = [30, 20, 20], edge = window.__studioEdgeAt(world, 4), pixel = window.__studioScreenOf(world);
    return edge && window.__studioSection().shownKeys[edge.body] === 'b1' && document.elementFromPoint(...pixel)?.closest('.vp-canvas') ? { edge, pixel } : null;
  });
  assert.ok(hit?.edge.segments.length);
  await f.page.mouse.click(...hit.pixel);
  await hud.getByText(/edge n1\.side2\|n1\.top/).waitFor();
  await preview();
  await button('Apply', hud).click();
  await f.changed(seed);
  const before = await f.snapshot('original-native-axis');
  await verify('original-result', before.doc, 20, 11, 14);
  if (!baseline) assert.deepEqual(before.doc.nodes[3].axisRef, { version: 1, sourceFeature: 'n1', edge: 'n1.side2|n1.top', side: 2 });
  await f.openFeatureEditor(1, 'move the native stock axis sideways');
  await field('Depth').fill('24');
  const moved = await f.applyEditor(before.doc, 'stock-y24');
  assert.deepEqual(moved.doc.nodes[3], before.doc.nodes[3]);
  if (baseline) {
    await verify('unchanged-fixed-axis', moved.doc, 20, 11, 14);
    assert.fail('The picked edge moves to Y24 while Revolve stays at Y20');
  }
  await verify('linked-axis-y24', moved.doc, 24, 15, 18);
  await f.openFeatureEditor(3, 'read linked-axis mode');
  await f.editor().getByText('Linked edge n1.side2|n1.top', { exact: true }).waitFor();
  await f.closeEditor();
  await f.openFeatureEditor(1, 'try to move the source axis out of the sketch plane');
  await field('Distance').fill('24');
  await button('Apply', f.editor()).click();
  const status = f.editor().locator('.hud-error');
  await status.waitFor();
  await status.locator('summary').click();
  await status.getByText(/edge must remain in the sketch plane/i).waitFor();
  await f.same(moved.doc);
  await f.snapshot('off-plane-refused');
  await f.closeEditor();
  await f.undo();
  await f.same(before.doc);
  await f.redo();
  await f.same(moved.doc);
  const saved = await f.save('revolve-linked-axis');
  const reopened = await f.freshOpen(saved.file, moved.doc, 'linked-reopened');
  await verify('reopened-y24', reopened.doc, 24, 15, 18);
  const fixed = structuredClone(moved.doc);
  delete fixed.nodes[3].axisRef;
  await open(fixed, 'D1163-fixed-axis');
  await verify('fixed-legacy-y20', fixed, 20, 11, 14);
  await f.openFeatureEditor(3, 'read fixed-axis mode');
  await f.editor().getByText('Fixed edge', { exact: true }).waitFor();
  await f.snapshot('fixed-legacy');
});

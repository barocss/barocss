import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const lower = process.argv.includes('--lower');
const cap = lower ? 'n1.bottom' : 'n1.top';
const pins = [
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  'apps/cad-studio/src/files/documentFile.ts',
  'packages/barocss-cad-model/src/app/nativeOffsetFace.ts',
  'packages/barocss-cad-model/src/app/offsetFaceEdit.ts',
  'packages/barocss-cad-model/src/app/profileCommands.ts',
  'packages/barocss-cad-model/src/engine/part.ts',
  'packages/barocss-cad-model/src/engine/migrate.ts',
  'packages/barocss-cad/src/features/drafted-cap-offset.ts',
];
const f = await createFlow({
  name: 'offset-drafted-cap', output: process.argv[2], envFrozen: lower ? 'D1255_SOURCE_FROZEN' : 'D1254_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Move a tapered cap and retain its wall planes, references, History and native file.',
  limits: ['One authored rectangular Draft Extrude and one straight rectangular legacy control. Desktop Chrome WebGPU.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, faceGeometry, massPropertiesOf } from '@barocss/cad';
import { partSnapshot } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { outputs } = partSnapshot(doc), body = outputs[0], brep = body.brep;
console.log(JSON.stringify({
  outputs: outputs.length, count: body.bodyCount, check: checkBrep(brep, { strict: true }),
  volume: massPropertiesOf(body).volume, point: brep.vertices.map(v => v.point),
  faces: brep.faces.map(face => ({ name: face.name, geometry: faceGeometry(face) })),
  edgeNames: brep.edges.map(edge => edge.name).sort(),
}));
`,
});
const width = 20, depth = 10, height = 12, degrees = 15;
const slope = Math.tan(degrees * Math.PI / 180);
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [{ kind: 'sketch', id: 'n0', profile: 'rectangle', min: [0, 0], max: [width, depth] },
    { kind: 'extrude', id: 'n1', sketch: 0, height, draft: degrees }],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const hud = name => f.page.getByRole('dialog', { name, exact: true });
const offsetField = panel => panel.getByLabel('Offset', { exact: true });
const status = (panel, state) => panel.locator('.status').filter({ hasText: new RegExp('^' + state + '$') }).waitFor();
const near = (actual, expected, bound = 1e-8) => Math.abs(actual - expected) < bound;
const samePoint = (actual, expected) => actual.every((value, i) => near(value, expected[i]));

async function open(doc, label) {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: label + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
}

async function pickCap(bottom = false) {
  if (bottom) {
    await button('View cube directions').click();
    await f.page.getByRole('menuitem', { name: 'Bottom', exact: true }).click();
  } else {
    await button('Top', f.page.locator('.views')).click();
  }
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  const filter = button('Selection filter');
  for (let i = 0; i < 5 && !(await filter.innerText()).includes('Faces'); i++) await filter.click();
  assert.match(await filter.innerText(), /Faces/);
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const pixel = await f.page.evaluate(point => window.__studioScreenOf(point), [width / 2, depth / 2, bottom ? 0 : height]);
  assert.ok(await f.page.evaluate(pixel => document.elementFromPoint(...pixel)?.matches('canvas.vp-canvas'), pixel), pixel);
  await f.page.mouse.click(...pixel);
  await f.page.waitForFunction(() => window.__studioSelection.selection.faces.length === 1);
}

function sectionVolume(z) {
  return width * depth * z - (width + depth) * slope * z ** 2 + 4 / 3 * slope ** 2 * z ** 3;
}
async function native(label, doc, distance, original) {
  const start = lower ? -distance : 0, end = lower ? height : height + distance;
  const moved = lower ? start : end;
  const read = await f.inspect(label, doc), volume = sectionVolume(end) - sectionVolume(start);
  assert.equal(read.outputs, 1);
  assert.equal(read.count, 1);
  assert.ok(read.check.valid, read.check.issues.join('\n'));
  assert.deepEqual(read.check.counts, { bodies: 1, shells: 1, faces: 6, loops: 6, coedges: 24, edges: 12, vertices: 8 });
  assert.ok(near(read.volume, volume, 1e-7), JSON.stringify({ label, volume, actual: read.volume }));
  const worker = (await f.bodies()).bodies;
  assert.equal(worker.length, 1);
  assert.ok(near(worker[0].volume, volume, 1e-7));
  for (const level of [start, end]) {
    const lo = level * slope;
    for (const x of [lo, width - lo]) for (const y of [lo, depth - lo])
      assert.ok(read.point.some(point => samePoint(point, [x, y, level])), JSON.stringify({ label, point: [x, y, level] }));
  }
  if (original) {
    assert.deepEqual(read.edgeNames, original.edgeNames);
    assert.deepEqual(read.faces.map(face => face.name).sort(), original.faces.map(face => face.name).sort());
    for (const { name, geometry } of read.faces) {
      assert.equal(geometry.kind, 'plane');
      const before = original.faces.find(face => face.name === name).geometry;
      assert.ok(samePoint(geometry.n, before.n), JSON.stringify({ label, name, geometry, before }));
      if (name !== cap)
        assert.ok(near(geometry.o.reduce((d, v, i) => d + geometry.n[i] * (v - before.o[i]), 0), 0));
      else assert.ok(near(geometry.o[2], moved));
    }
  }
  f.report.observations.push({ label, start, end, expected: volume, native: read.volume, studio: worker[0].volume,
    sourceFaceNames: read.faces.map(face => face.name), maximumEdgeSurfaceGap: read.check.maximumEdgeSurfaceGap });
  return read;
}

async function edit(index) {
  await f.openFeatureEditor(index, 'offset cap');
  await button('Edit offset', f.editor()).click();
  const panel = hud('Edit Offset face');
  await status(panel, 'preview');
  return panel;
}

await f.run(async () => {
  f.phase = `Open tapered rectangular stock and pick its ${lower ? 'lower' : 'upper'} cap`;
  await open(seed, 'tapered-box');
  const original = await native('source-shape', seed, 0);
  await pickCap(lower);
  if (lower) await button('Iso', f.page.locator('.views')).click();
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.command('Offset face');
  const panel = hud('Offset face');
  await status(panel, 'preview');
  if (lower) {
    const handle = f.page.locator('g.gizmo-handle[data-handle="d"]');
    const head = await handle.locator('polygon').evaluate(polygon => {
      const box = polygon.getBoundingClientRect();
      return [box.x + box.width / 2, box.y + box.height / 2];
    });
    const [from, to] = await f.page.evaluate(() => [
      window.__studioScreenOf([10, 5, 0]), window.__studioScreenOf([10, 5, -1]),
    ]);
    const delta = to.map((value, i) => value - from[i]);
    assert.ok(Math.hypot(...delta) > 8);
    await f.page.mouse.move(...head);
    await f.page.mouse.down();
    await f.page.mouse.move(...head.map((value, i) => value + delta[i]), { steps: 6 });
    await f.page.mouse.up();
    assert.equal(await offsetField(panel).inputValue(), '3');
    await status(panel, 'preview');
    await f.same(seed);
    f.report.observations.push({ label: 'lower-cap-drag', startDistance: 2, endDistance: 3, dragCssPx: delta });
  }
  await offsetField(panel).fill('2');
  await status(panel, 'preview');
  await f.same(seed);
  await f.snapshot('taper-outward-preview');
  await button('Apply', panel).click();
  await f.changed(seed);
  const outward = await f.doc(), index = seed.nodes.length, node = outward.nodes[index];
  assert.equal(outward.nodes.length, index + 1);
  assert.deepEqual(outward.nodes.slice(0, index), seed.nodes);
  assert.equal(node.kind, 'offset-face');
  assert.deepEqual(node.faces, [cap]);
  assert.deepEqual(node.parent, { node: 1, side: 'solid' });
  assert.equal(node.distance, 2);
  assert.ok(node.sigs?.[cap]);
  await button('Iso', f.page.locator('.views')).click();
  await f.snapshot('taper-outward-applied');
  await native('outward-shape', outward, 2, original);

  f.phase = 'Refuse a collapse in History, then move the same cap inwards';
  const history = await edit(index);
  assert.equal(await offsetField(history).inputValue(), '2');
  const collapse = lower ? -height : 8;
  await offsetField(history).fill(String(collapse));
  await status(history, 'refused');
  assert.equal(await button('Apply', history).isDisabled(), true);
  await history.getByText('Kernel detail', { exact: true }).click();
  assert.match(await history.innerText(), /collapse|closes|cross|span/i);
  await f.same(outward);
  await f.snapshot('taper-collapse-refused');
  await offsetField(history).fill('-2');
  await status(history, 'preview');
  await button('Apply', history).click();
  await f.changed(outward);
  const inward = (await f.snapshot('taper-inward-applied')).doc;
  assert.deepEqual(inward.nodes[index], { ...node, distance: -2 });
  assert.deepEqual(inward.nodes.slice(0, index), seed.nodes);
  await native('inward-shape', inward, -2, original);
  await f.undo();
  await f.same(outward);
  await f.redo();
  await f.same(inward);
  const file = await f.save('offset-drafted-cap');
  await f.freshOpen(file.file, inward, 'taper-file-opened');
  await native('reopened-shape', inward, -2, original);
  const reopened = await edit(index);
  assert.equal(await offsetField(reopened).inputValue(), '-2');
  await button('Cancel', reopened).click();
  await f.same(inward);

  f.phase = 'Refuse an invalid signed native file before replacing the current part';
  const impossible = { ...inward, nodes: inward.nodes.map((feature, i) => i === index ? { ...feature, distance: collapse } : feature) };
  const [invalid] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await invalid.setFiles({ name: 'invalid-taper.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(impossible)) });
  await f.waitToast(/Offset face:.*close a wall.*Your part is unchanged/i);
  await f.same(inward);
  await f.snapshot('invalid-file-retains-part');
  await f.dismissToasts();

  f.phase = 'Verify the straight-right-prism route still creates the existing recipe';
  const { draft: _draft, ...extrude } = seed.nodes[1];
  const straight = { ...seed, nodes: [seed.nodes[0], extrude] };
  await open(straight, 'straight-box');
  await pickCap();
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.command('Offset face');
  const legacyPanel = hud('Offset face');
  await offsetField(legacyPanel).fill('2');
  await status(legacyPanel, 'preview');
  await button('Apply', legacyPanel).click();
  await f.changed(straight);
  const legacy = (await f.snapshot('legacy-offset-applied')).doc;
  assert.deepEqual(legacy.nodes.slice(index).map(node => node.kind), ['sketch', 'extrude', 'union']);
  assert.equal(legacy.nodes.at(-1).made.command, 'offset-face');
  assert.ok(near((await f.bodies()).bodies[0].volume, width * depth * (height + 2)));
});

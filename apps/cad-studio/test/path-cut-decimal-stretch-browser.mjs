import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = ['apps/cad-studio/src/app/directCurveCandidate.ts', 'packages/barocss-cad-model/src/engine/direct.ts',
  'packages/barocss-cad-model/src/engine/curveFeaturePattern.ts', 'packages/barocss-cad/src/features/curve-cut-pattern.ts'];
const baseline = process.argv.includes('--baseline');
const f = await createFlow({
  name: 'path-cut-decimal-stretch', output: process.argv[2], envFrozen: 'D1196_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'A sufficient, exactly straight linked path keeps the same Cut Pattern after decimal Stretch.',
  limits: ['One two-span axis-aligned path. Desktop WebGPU.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, massPropertiesOf } from '@barocss/cad';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { geometryOf, importSource, emptyDirect } from '@barocss/cad-model/engine/direct';
import { partSnapshot } from '@barocss/cad-model/engine/part';
const ref = node => ({ node, side: 'solid' });
if (process.argv[3] === '"seed"') {
  let doc = emptyDoc();
  const box = (min, max) => {
    const sketch = doc.nodes.length;
    doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min, max });
    doc = withNode(doc, { kind: 'extrude', sketch, height: 10 });
  };
  box([0, 0], [60, 40]);
  box([8, 8], [12, 10]);
  doc = withNode(doc, { kind: 'difference', parent: ref(1), tool: ref(3) });
  const source = '@model sketch {version: 0; length-unit: mm; @curve #c1 {type: nurbs; degree: 2; knots: [0,0,0,1,1,2,2,2]; control-points: [[0,0,0],[8,0,0],[16,0,0],[16,8,0],[16,16,0]]; weights: [1,1,1,1,1];}}';
  doc = { ...doc, direct: importSource(emptyDirect(), source, 'Sketch curve 1') };
  console.log(JSON.stringify(withNode(doc, { kind: 'curve-feature-pattern', parent: ref(4), path: { objectId: 'obj_1' }, spacing: 8, count: 5 })));
} else {
  const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const curve = geometryOf(doc.direct, doc.direct.objects[0]);
  console.log(JSON.stringify({ curve, outputs: partSnapshot(doc).outputs.map(output => ({
    valid: checkBrep(output.brep, { strict: true }).valid,
    volume: massPropertiesOf(output).volume, centroid: massPropertiesOf(output).centroid,
    walls: output.brep.faces.filter(face => /^n3[.]side[0-3](@[1-4])?$/.test(face.name))
      .map(face => ({ name: face.name, points: face.surface.controlPoints.flat() })),
  })) }));
}
`,
});
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} vs ${expected}`);
async function open(doc) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'linked-path.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
}
async function stretch(factors) {
  await f.page.locator('.outliner .ol.direct').filter({ hasText: 'Sketch curve 1' }).click();
  const direct = f.page.getByRole('complementary', { name: 'Direct geometry', exact: true });
  for (const [index, factor] of factors.entries()) {
    await direct.getByLabel('× ' + 'XYZ'[index], { exact: true }).fill(String(factor));
  }
  await button('Stretch', direct).click();
}
async function check(label, doc, cuts) {
  const { curve, outputs } = await f.inspect(label, doc);
  assert.equal(outputs.length, 1);
  const body = outputs[0], volume = 23600;
  assert.equal(body.valid, true);
  near(body.volume, volume);
  const centroid = [30, 20, 5].map((center, axis) => (24000 * center
    - 80 * cuts.reduce((sum, [x, y]) => sum + [x + 2, y + 1, 5][axis], 0)) / volume);
  body.centroid.forEach((value, axis) => near(value, centroid[axis]));
  assert.equal(body.walls.length, 20);
  assert.equal(new Set(body.walls.map(wall => wall.name)).size, 20);
  body.walls.forEach(wall => {
    const [, side, copy] = /^n3[.]side([0-3])(?:@([1-4]))?$/.exec(wall.name);
    const [x, y] = cuts[Number(copy ?? 0)];
    for (const point of wall.points) near(point[[1, 0, 1, 0][Number(side)]], [y, x + 4, y + 2, x][Number(side)]);
  });
  f.report.observations.push({ label, volume, centroid, controlPoints: curve.controlPoints, degree: curve.degree, wallCount: body.walls.length });
}
const initial = [[8, 8], [16, 8], [24, 8], [24, 16], [24, 24]];
const expandedCuts = [[8, 8], [16, 8], [24, 8], [32, 8], [40, 8]];
const decimalCuts = [[8, 8], [16, 8], [24, 8], [32, 8], [33.6, 14.4]];

await f.run(async () => {
  const seed = await f.inspect('seed', {}, 'seed');
  await f.newPage();
  await open(seed);
  await check('initial', seed, initial);
  f.phase = 'Stretch by 2 in X';
  await stretch([2, 1, 1]);
  await f.changed(seed);
  const expanded = (await f.snapshot('expanded-48-mm')).doc;
  assert.deepEqual(expanded.nodes, seed.nodes);
  await check('expanded', expanded, expandedCuts);

  f.phase = 'Refuse true 12 mm short path';
  await stretch([0.25, 0.25, 1]);
  await f.waitToast(/exceeds.*path length/i);
  await f.same(expanded);
  await f.snapshot('short-path-refused');
  await f.dismissToasts();

  f.phase = 'Stretch 0.8 in X to 41.6 mm';
  await stretch([0.8, 1, 1]);
  if (baseline) {
    await f.waitToast(/exact endpoint midpoint/i);
    await f.same(expanded);
    await f.snapshot('decimal-stretch-refused');
    throw new Error('41.6 mm path refused for midpoint despite 32 mm required travel.');
  }

  await f.changed(expanded);
  const decimal = (await f.snapshot('decimal-path-accepted')).doc;
  assert.deepEqual(decimal.nodes, seed.nodes);
  assert.equal(decimal.direct.objects[0].id, seed.direct.objects[0].id);
  await check('decimal', decimal, decimalCuts);
  await f.undo();
  await f.same(expanded);
  await f.undo();
  await f.same(seed);
  await f.redo();
  await f.same(expanded);
  await f.redo();
  await f.same(decimal);

  await f.newPage();
  await open(decimal);
  await check('reopened', decimal, decimalCuts);
  await f.openFeatureEditor(5);
  assert.equal(await f.editor().getByLabel('Path', { exact: true }).inputValue(), seed.direct.objects[0].id);
  assert.equal(await f.editor().getByLabel('Spacing', { exact: true }).inputValue(), '8');
  assert.equal(await f.editor().getByLabel('Count', { exact: true }).inputValue(), '5');
  await f.snapshot('reopened-history');
});

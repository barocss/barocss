import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/app/commands.ts',
  'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad-model/src/engine/part.ts',
  'packages/barocss-cad/src/features/drafted-extrusion.ts',
  'packages/barocss-cad/src/features/drafted-half-disk.ts',
  'packages/barocss-cad/src/part/part-profile-solid.ts',
];
const f = await createFlow({
  name: 'half-disk-draft-extrude', output: process.argv[2], envFrozen: 'D1253_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Create an inward half-disk Draft Extrude, edit its angle, reject collapse and reopen the native file.',
  limits: ['One prepared XY sketch, one radius-10 semicircle and its diameter, positive distance and inward Draft.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, curveDomain, evaluateCurve, evaluateSurface, faceGeometry, massPropertiesOf, surfaceDomain } from '@barocss/cad';
import { partSnapshot } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { outputs } = partSnapshot(doc);
const body = outputs[0], brep = body.brep, mass = massPropertiesOf(body);
const seams = brep.edges.filter(e => e.curve.degree === 2).map(edge => {
  const curve = edge.curve, [a,b] = curveDomain(curve);
  return { name: edge.name, points: Array.from({ length: 9 }, (_, i) => evaluateCurve(curve, a + i / 8 * (b - a))) };
}).filter(edge => Math.abs(edge.points.at(-1)[2] - edge.points[0][2]) > 1);
const curvedSupports = brep.faces.filter(face => faceGeometry(face).kind !== 'plane').map(face => {
  const surface = face.surface, { u, v } = surfaceDomain(surface);
  return [0.2, 0.5, 0.8].flatMap(a => [0.2, 0.5, 0.8].map(b =>
    evaluateSurface(surface, u[0] + a * (u[1] - u[0]), v[0] + b * (v[1] - v[0]))));
});
console.log(JSON.stringify({ outputs: outputs.length, check: checkBrep(brep, { strict: true }), seams,
  kinds: brep.faces.map(face => faceGeometry(face).kind), curvedSupports, mass }));
`,
});
const radius = 10, height = 10;
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 1,
  nodes: [{ id: 'n0', kind: 'sketch', profile: 'loop', segments: [
    { kind: 'line', start: [-radius, 0] },
    { kind: 'arc', start: [radius, 0], center: [0, 0], direction: 'ccw' },
  ] }], outputs: {},
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const field = (name, scope) => scope.getByLabel(name, { exact: true });
const tolerance = 1e-7;
const near = (a, b, tol = tolerance) => Number.isFinite(a) && Math.abs(a - b) <= tol;

function integral(slope, intervals) {
  const area = z => {
    const d = z * slope, r = radius - d;
    return r * r * Math.acos(d / r) - d * Math.sqrt(r * r - d * d);
  };
  const step = height / intervals;
  let sum = area(0) + area(height);
  for (let i = 1; i < intervals; i++) sum += (i % 2 === 0 ? 2 : 4) * area(i * step);
  return step / 3 * sum;
}

async function check(label, doc, angle) {
  const read = await f.inspect(label, doc);
  const slope = Math.tan(angle * Math.PI / 180), volume = integral(slope, 4096);
  assert.ok(near(volume, integral(slope, 2048), 1e-9));
  assert.equal(read.outputs, 1);
  assert.equal(read.check.valid, true, read.check.issues.join('\n'));
  assert.deepEqual(read.check.counts, { bodies: 1, shells: 1, faces: 5, loops: 5, coedges: 18, edges: 9, vertices: 6 });
  assert.equal(read.check.topology[0].genus, 0);
  assert.equal(read.kinds.filter(kind => kind === 'plane').length, 3);
  assert.equal(read.curvedSupports.length, 2);
  for (const support of read.curvedSupports) for (const [x, y, z] of support)
    assert.ok(near(Math.hypot(x, y), radius - z * slope));
  assert.equal(read.seams.length, 2);
  assert.notEqual(Math.sign(read.seams[0].points[0][0]), Math.sign(read.seams[1].points[0][0]));
  for (const seam of read.seams) {
    for (const [x, y, z] of seam.points) {
      assert.ok(near(y, z * slope) && near(Math.hypot(x, y), radius - z * slope), JSON.stringify({ label, seam }));
    }
    assert.deepEqual(seam.points.map(point => Math.sign(point[0])), Array(seam.points.length).fill(Math.sign(seam.points[0][0])));
    assert.ok([0, height].every(z => seam.points.some(point => near(point[2], z))));
  }
  assert.equal(read.mass.method, 'quadrature');
  assert.ok(near(read.mass.volume, volume), JSON.stringify({ label, actual: read.mass.volume, volume }));
  const worker = (await f.bodies()).bodies;
  assert.equal(worker.length, 1);
  assert.ok(near(worker[0].volume, volume), JSON.stringify({ label, workerVolume: worker[0].volume, volume }));
  f.report.observations.push({ label, angle, volume, nativeVolume: read.mass.volume, workerVolume: worker[0].volume,
    method: read.mass.method, seams: read.seams, counts: read.check.counts, gap: read.check.maximumEdgeSurfaceGap });
}

await f.run(async () => {
  await f.newPage();
  f.phase = 'Open the editable XY half-disk sketch and start Extrude';
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'half-disk-sketch.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  const browser = f.page.getByRole('complementary', { name: 'Browser', exact: true });
  await button('Sketch 1', browser).click();
  await f.openExtrudeHud();
  const hud = f.hud(), draft = field('Draft', hud);
  await field('Distance', hud).fill(String(height));
  await draft.fill('35');
  await hud.getByText('The draft is too steep for this height', { exact: true }).waitFor();
  assert.equal(await button('Apply', hud).isEnabled(), false);
  await f.same(seed);
  await f.snapshot('half-disk-collapse-refused');
  await draft.fill('10');
  await hud.locator('.status').filter({ hasText: /^preview$/ }).waitFor();
  await f.same(seed);
  await f.snapshot('half-disk-preview');
  await button('Apply', hud).click();
  await f.changed(seed);
  const created = (await f.snapshot('half-disk-extruded')).doc;
  assert.deepEqual(created.nodes[0], seed.nodes[0]);
  assert.equal(created.nodes.length, 2);
  assert.equal(created.nodes[1].kind, 'extrude');
  assert.equal(created.nodes[1].height, height);
  assert.equal(created.nodes[1].draft, 10);
  await check('initial-native', created, 10);

  const editor = f.editor();
  await f.openFeatureEditor(1, 'drafted half-disk Extrude');
  await field('Draft', editor).fill('14');
  const changed = (await f.applyEditor(created, 'half-disk-edited')).doc;
  assert.deepEqual(changed.nodes[1], { ...created.nodes[1], draft: 14 });
  await check('edited-native', changed, 14);
  await f.undo();
  await f.same(created);
  await f.redo();
  await f.same(changed);
  const saved = await f.save('half-disk-draft-extrude');
  const reopened = await f.freshOpen(saved.file, changed, 'half-disk-reopened');
  await check('reopened-native', reopened.doc, 14);
  await f.openFeatureEditor(1, 'reopened drafted half-disk Extrude');
  assert.equal(await field('Draft', f.editor()).inputValue(), '14');
  await f.closeEditor();
  await f.same(changed);
});

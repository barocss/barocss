import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/app/commands.ts', 'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad/src/part/part-model.ts'];
const f = await createFlow({
  name: 'oblique-split-history', output: process.argv[2], envFrozen: 'D1177_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Check both oblique Split caps and native volumes through desktop History.',
  limits: ['One box, normal [1,1,0], non-tangent interior cap initially crossing both Y ends.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, faceGeometry, massPropertiesOf } from '@barocss/cad';
import { bodyKeyOf, partSnapshot } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { outputs } = partSnapshot(doc);
console.log(JSON.stringify(outputs.map(body => {
  const { brep } = body, mass = massPropertiesOf(body);
  const loops = new Map(brep.loops.map(loop => [loop.id, loop]));
  const coedges = new Map(brep.coedges.map(use => [use.id, use]));
  const edges = new Map(brep.edges.map(edge => [edge.id, edge]));
  const points = new Map(brep.vertices.map(vertex => [vertex.id, vertex.point]));
  return { key: bodyKeyOf(body.id, doc.nodes), solids: body.bodyCount,
    valid: checkBrep(brep, { strict: true }).valid, volume: mass.volume,
    caps: brep.faces.filter(face => face.name?.startsWith('n2.cut.')).map(face => ({
      name: face.name, geometry: faceGeometry(face),
      points: face.loops.flatMap(loop => loops.get(loop).coedges.map(id => {
        const use = coedges.get(id);
        return points.get(edges.get(use.edge).vertices[use.sense === 'forward' ? 0 : 1]);
      })),
    })),
    vertices: [...points.values()] };
})));
`,
});
const ref = node => ({ node, side: 'solid' });
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
  ],
  outputs: { b1: ref(1) }, nextId: 2,
};
const button = (name, parent = f.page) => parent.getByRole('button', { name, exact: true });
const field = (name, parent = f.editor()) => parent.getByLabel(name, { exact: true });
const near = (actual, expected, tolerance = 1e-7) => Math.abs(actual - expected) <= tolerance;

async function verifyHandle(at) {
  const handle = f.page.locator('g.gizmo-handle[data-handle="at"]');
  await handle.waitFor();
  const [root, tip] = await handle.evaluate(group => {
    const circle = group.querySelector('circle'), rect = circle.getBoundingClientRect();
    const polygon = group.querySelector('polygon');
    const tip = polygon.points.getItem(0).matrixTransform(polygon.getScreenCTM());
    return [[rect.x + rect.width / 2, rect.y + rect.height / 2], [tip.x, tip.y]];
  });
  const [expected, forward] = await f.page.evaluate(at => {
    const d = (at - 30) / 2;
    return [[20 + d, 10 + d, 5], [21 + d, 11 + d, 5]].map(point => window.__studioScreenOf(point));
  }, at);
  const dx = tip[0] - root[0], dy = tip[1] - root[1], fx = forward[0] - expected[0], fy = forward[1] - expected[1];
  f.report.observations.push({ label: 'angled-history-handle', at, root, tip, expected, forward });
  assert.ok(Math.hypot(root[0] - expected[0], root[1] - expected[1]) < 2, 'History handle must start on X+Y=' + at);
  assert.ok((dx * fx + dy * fy) / (Math.hypot(dx, dy) * Math.hypot(fx, fy)) > 0.99, 'History handle must follow the plane normal');
}

async function verify(label, doc, at) {
  const outputs = await f.inspect(label, doc);
  assert.deepEqual(outputs.map(out => out.key).sort(), ['b2_negative', 'b2_positive']);
  const ring = [0, 20].flatMap(y => [0, 10].map(z => [at - y, y, z]));
  for (const output of outputs) {
    const lower = output.key === 'b2_negative', expected = lower ? 200 * (at - 10) : 200 * (50 - at);
    assert.ok(output.valid && output.solids === 1 && near(output.volume, expected, 1e-6), JSON.stringify(output));
    assert.equal(output.caps.length, 1);
    const [cap] = output.caps;
    assert.equal(cap.name, lower ? 'n2.cut.top' : 'n2.cut.bottom');
    assert.equal(cap.geometry.kind, 'plane');
    assert.ok(near(cap.geometry.n[0], (lower ? 1 : -1) * Math.SQRT1_2));
    assert.ok(near(cap.geometry.n[1], (lower ? 1 : -1) * Math.SQRT1_2));
    assert.ok(near(cap.geometry.n[2], 0));
    assert.ok(near(cap.geometry.o[0] + cap.geometry.o[1], at));
    assert.equal(cap.points.length, 4);
    for (const corner of ring) assert.ok(cap.points.some(point => point.every((value, axis) => near(value, corner[axis]))));
    assert.ok(output.vertices.every(([x, y]) => lower ? x + y <= at + 1e-7 : x + y >= at - 1e-7));
  }
  f.report.observations.push({ label, at, outputs: outputs.map(({ key, volume, caps }) => ({ key, volume, caps })) });
}

await f.run(async () => {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D1177-angled-split.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
  await f.same(seed);
  const pixel = await f.page.evaluate(() => window.__studioScreenOf([20, 10, 10]));
  await f.page.mouse.click(...pixel);
  await f.page.waitForFunction(() => window.__studioSelection.selection.faces.length === 1);
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.command('Split');
  const hud = f.page.getByRole('dialog', { name: 'Split', exact: true });
  if (process.argv[3] === '--cardinal') {
    await field('At', hud).fill('16');
    await hud.locator('.status').filter({ hasText: /^preview$/ }).waitFor();
    await button('Apply', hud).click();
    await f.changed(seed);
    const accepted = await f.snapshot('cardinal-split');
    await f.openFeatureEditor(2, 'cardinal control');
    assert.equal(await field('Normal').inputValue(), 'x');
    await field('At').fill('22');
    const revised = await f.applyEditor(accepted.doc, 'cardinal-history-edit');
    for (const [state, cut] of [[accepted, 16], [revised, 22]]) {
      assert.equal(state.doc.nodes[2].normal, undefined);
      const outputs = await f.inspect(state.label, state.doc);
      assert.equal(outputs.length, 2);
      for (const output of outputs) {
        const negative = output.key === 'b2_negative';
        assert.ok(output.valid && output.solids === 1);
        assert.ok(near(output.volume, 200 * (negative ? cut : 40 - cut)));
        assert.equal(output.caps.length, 1);
        assert.ok(output.caps[0].points.every(point => near(point[0], cut)));
      }
      f.report.observations.push({ label: state.label, cut, volumes: outputs.map(output => output.volume) });
    }
    return;
  }
  await field('Normal', hud).selectOption('n');
  assert.equal(await field('At', hud).inputValue(), '30');
  await hud.locator('.status').filter({ hasText: /^preview$/ }).waitFor();
  assert.match(await hud.innerText(), /X\+Y = 30/);
  await f.same(seed);
  await f.snapshot('angled-split-preview');
  await button('Apply', hud).click();
  await f.changed(seed);
  const initial = (await f.snapshot('angled-split')).doc;
  const node = initial.nodes[2];
  assert.deepEqual(node.normal, [1, 1, 0]);
  assert.equal(node.at, 30);
  await verify('angled-split', initial, 30);
  await f.openFeatureEditor(2, 'oblique split');
  const components = await Promise.all(['X', 'Y', 'Z'].map(axis => field('Normal ' + axis).inputValue()));
  assert.deepEqual(components, ['1', '1', '0']);
  assert.equal(await field('At').inputValue(), '30');
  await verifyHandle(30);
  await f.snapshot('angled-history-handle');
  await field('At').fill('34');
  const revised = (await f.applyEditor(initial, 'angled-split-edit')).doc;
  assert.deepEqual(revised, { ...initial, nodes: [...initial.nodes.slice(0, 2), { ...node, at: 34 }] });
  await verify('angled-split-edit', revised, 34);
  await f.undo();
  await f.same(initial);
  await verify('angled-split-undo', await f.doc(), 30);
  await f.redo();
  await f.same(revised);
  const saved = await f.save('oblique-split-history');
  const reopened = await f.freshOpen(saved.file, revised, 'oblique-split-reopened');
  await verify('oblique-split-reopened', reopened.doc, 34);
  await f.openFeatureEditor(2, 'reopened oblique split');
  assert.equal(await field('At').inputValue(), '34');
  await verifyHandle(34);
  await field('At').fill('60');
  await button('Apply', f.editor()).click();
  const error = f.editor().locator('.hud-error');
  await error.getByText('Kernel detail', { exact: true }).click();
  await error.getByText(/split plane does not cross the target/i).waitFor();
  await f.same(revised);
  await f.snapshot('angled-split-tangent-refused');
  await field('Normal X').fill('2');
  await field('Normal Y').fill('2');
  await field('At').fill('68');
  const scaled = (await f.applyEditor(revised, 'angled-split-scaled-equivalent')).doc;
  assert.deepEqual(scaled, { ...revised, nodes: [...revised.nodes.slice(0, 2), { ...node, normal: [2, 2, 0], at: 68 }] });
  await verify('angled-split-scaled-equivalent', scaled, 34);
  await f.openFeatureEditor(2, 'equivalent normal scale');
  await verifyHandle(34);
});

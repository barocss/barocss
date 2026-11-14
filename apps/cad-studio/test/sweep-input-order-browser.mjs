import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const baseline = process.argv.includes('--baseline');
const pins = ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/viewport/useViewportPicking.ts',
  'packages/barocss-cad-model/src/app/profileCommands.ts'];
const f = await createFlow({
  name: 'sweep-input-order', output: process.argv[2], envFrozen: 'D1167_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Select an earlier Sweep profile and a direct path in either Browser order.',
  limits: ['Desktop WebGPU. Two circular profiles, two straight direct curves, creation and replay.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8')), part = toPartDocument(doc);
const out = evaluateCadPart(part).outputs.find(body => body.id === 'n2');
const points = out.brep.vertices.map(vertex => vertex.point);
const rings = [0, 32].map(z => points.filter(p => Math.abs(p[2] - z) < 1e-7).map(([x,y]) => Math.hypot(x, y)));
console.log(JSON.stringify({ valid: checkOutput(out).valid, count: out.bodyCount, z: [Math.min(...points.map(p => p[2])), Math.max(...points.map(p => p[2]))],
  rings: rings.map(r => ({ count: r.length, min: Math.min(...r), max: Math.max(...r) })) }));
`,
});
const curveA = [[0, 0, 0], [0, 0, 32]];
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 3 },
    { id: 'n1', kind: 'sketch', profile: 'circle', center: [30, 0], radius: 6 },
  ],
  outputs: {},
  direct: {
    sources: {
      ra: '@model railA { version: 0; length-unit: mm; @curve #a { type: nurbs; degree: 1; knots: [0,0,1,1]; control-points: [[0,0,0],[0,0,32]]; weights: [1,1]; } }',
      rb: '@model railB { version: 0; length-unit: mm; @curve #b { type: nurbs; degree: 1; knots: [0,0,1,1]; control-points: [[30,0,0],[30,0,22]]; weights: [1,1]; } }',
    },
    objects: [{ id: 'path-a', name: 'Rail A', source: 'ra', geometry: 'a' }, { id: 'path-b', name: 'Rail B', source: 'rb', geometry: 'b' }],
  },
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const profile = () => button('Sketch 1');
const rail = () => button('Rail A');
const near = (a, b) => Math.abs(a - b) < 1e-7;
const readSelection = () => f.page.evaluate(() => ({
  sketches: window.__studioSelection.selection.sketches ?? [],
  paths: [...document.querySelectorAll('.ol.direct.sel')].map(el => el.textContent.trim()),
}));

async function verify(label, doc) {
  const node = doc.nodes[2], native = await f.inspect(label, doc);
  f.report.observations.push({ label, sketch: node.sketch, name: node.name, points: node.path.controlPoints, native });
  assert.equal(node.kind, 'sweep-curve');
  assert.equal(node.sketch, 0);
  assert.equal(node.name, 'Rail A');
  assert.deepEqual(node.path.controlPoints, curveA);
  assert.ok(native.valid && native.count === 1 && near(native.z[0], 0) && near(native.z[1], 32), JSON.stringify(native));
  for (const ring of native.rings) assert.ok(ring.count >= 8 && near(ring.min, 3) && near(ring.max, 3), JSON.stringify(ring));
}
await f.run(async () => {
  let accepted;
  for (const profileFirst of [true, false]) {
    await f.newPage();
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: 'D1167-sweep-inputs.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
    await f.same(seed);
    assert.deepEqual(JSON.parse(await f.page.evaluate(() => JSON.stringify(window.__studioDoc.direct.objects.map(o => o.id)))), ['path-a', 'path-b']);
    const label = profileFirst ? 'profile-first' : 'path-first';
    f.phase = `select Sweep inputs ${label}`;
    await (profileFirst ? profile() : rail()).click();
    await (profileFirst ? rail() : profile()).click();
    const picked = await readSelection();
    f.report.observations.push({ label, picked });
    if (baseline) {
      await f.snapshot(`baseline-${label}`);
      continue;
    }
    assert.deepEqual(picked, { sketches: [0], paths: ['Rail A'] });
    await f.page.evaluate(() => document.activeElement?.blur());
    await f.command('Sweep');
    const hud = f.page.getByRole('dialog', { name: 'Sweep', exact: true });
    await hud.locator('.status').filter({ hasText: /^preview$/ }).waitFor();
    await hud.locator('.hud-step').filter({ hasText: 'Profile' }).getByText('Sketch 1', { exact: true }).waitFor();
    await hud.locator('.hud-step').filter({ hasText: 'Path' }).getByText(/Rail A/).waitFor();
    await f.same(seed);
    await f.snapshot(`sweep-preview-${label}`);
    await button('Apply', hud).click();
    await f.changed(seed);
    const applied = await f.snapshot(`sweep-applied-${label}`);
    await verify(`sweep-${label}`, applied.doc);
    if (accepted) assert.deepEqual(applied.doc, accepted);
    accepted = applied.doc;
    await f.undo();
    await f.same(seed);
    await f.redo();
    await f.same(accepted);
  }
  if (baseline) {
    assert.deepEqual(f.report.observations.filter(o => o.picked).map(o => o.picked), [
      { sketches: [], paths: ['Rail A'] }, { sketches: [0], paths: [] },
    ]);
    assert.fail('Browser clears the earlier Sweep input in either selection order');
  }
  const saved = await f.save('sweep-input-order');
  const reopened = await f.freshOpen(saved.file, accepted, 'sweep-reopened');
  await verify('sweep-reopened-native', reopened.doc);
});

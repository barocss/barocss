// D524/P0-R04. Observe real native mesh inputs, geometry construction and vertex/index writeBuffer calls.
// Root runs desktop Studio with frozen writers: D524_SOURCE_FROZEN=1 node test/mesh-reuse-current-studio-browser.mjs /ABS/NEW/OUT
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';
import { installD524MeshObserver } from './readonlymeshobserver.mjs';

const output = process.argv[2]; assert.ok(output && isAbsolute(output));
assert.ok(relative(resolve(import.meta.dirname, '../../..'), resolve(output)).startsWith('../'));
await mkdir(output);
const f = await createFlow({ name: 'mesh-reuse-current-studio', envFrozen: 'D524_SOURCE_FROZEN', output,
  qualification: 'D524/P0-R04 native edit and selection smoke; sampled-signature reachability observation',
  initialFiles: ['apps/cad-studio/test/mesh-reuse-current-studio-browser.mjs', 'apps/cad-studio/test/readonlymeshobserver.mjs'],
  requiredFrozen: ['apps/cad-studio/src/viewport/gpuRenderer.ts', 'apps/cad-studio/src/App.tsx'],
  extraFrozen: ['packages/barocss-gpu/src/viewer/scene.ts', 'packages/barocss-gpu/src/viewer/viewer.ts'],
  snapshotExtra: () => ({ meshObservation: window.__d524Mesh?.snapshot() ?? null,
    selectedOutliner: [...document.querySelectorAll('.outliner .ol.sel, .outliner .ol-row.sel')].map(row => row.textContent) }),
  limits: ['Desktop WebGPU 1440x900 only. Root must view screenshots.', 'One native box extrude edit Distance 8 to 12 plus body/face/edge selection, Undo/Redo and clear.',
    'No fabricated geometry, forced signature collision or synthetic product action.', 'Collision reachability is observational: no matching signature with changed full mesh means NOT_REPRODUCED_IN_THIS_FLOW, not proof of safety.',
    'Prepared geometry and native vertex/index writeBuffer calls are observed; GPU memory readback and independent physical accuracy are NOT_RUN.',
    'Instance pose/curved-edge fixture breadth is NOT_RUN; straight native edge selection is captured.'],
});
const labels = new Set();
const capture = async label => { assert.ok(!labels.has(label)); labels.add(label); return f.snapshot(label); };
const latestBody = state => state.meshObservation.calls.findLast(call => call.input.length === 1);
const filter = async wanted => {
  const button = f.page.getByRole('button', { name: 'Selection filter', exact: true });
  for (let i = 0; i < 4; i++) { if ((await button.innerText()).includes(wanted)) return; await button.click(); }
  assert.fail(`Selection filter ${wanted}`);
};
const clear = async () => {
  await f.page.keyboard.press('Escape');
  await f.page.waitForFunction(() => { const s = window.__studioSelection?.selection; return s && ['vertices', 'edges', 'faces', 'bodies'].every(key => !s[key]?.length); });
};
const pick = async (kind, point, label) => {
  await clear(); await filter({ bodies: 'Bodies', faces: 'Faces', edges: 'Edges' }[kind]);
  const xy = await f.page.evaluate(point => window.__studioScreenOf(point), point); assert.ok(xy?.length === 2);
  await f.page.mouse.move(xy[0], xy[1]); await f.page.mouse.click(xy[0], xy[1]);
  await f.page.waitForFunction(kind => window.__studioSelection?.selection[kind]?.length === 1, kind, { timeout: 15000 });
  const state = await capture(label); assert.equal(state.selection.selection[kind].length, 1); return state;
};
await f.run(async () => {
  await f.newPage(); await f.page.setViewportSize({ width: 1440, height: 900 });
  await f.page.evaluate(installD524MeshObserver);
  try {
    f.phase = 'public native box 64x32x8 after observer installation';
    await f.page.getByRole('button', { name: 'New part', exact: true }).click(); await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
    await f.page.keyboard.press('b'); const hud = f.page.getByRole('dialog', { name: 'Box', exact: true }); await hud.waitFor();
    for (const [label, value] of [['Width X', '64'], ['Depth Y', '32'], ['Height Z', '8']]) await hud.getByLabel(label, { exact: true }).fill(value);
    await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
    await hud.getByRole('button', { name: 'Apply', exact: true }).click(); await f.ready();
    await f.page.locator('.views').getByRole('button', { name: 'Top', exact: true }).click(); await f.page.keyboard.press('f'); await f.page.waitForTimeout(500); await clear();
    const initial = await capture('01-native-box-initial'); const before = latestBody(initial);
    assert.ok(before?.input[0].positions.values.length); assert.ok(initial.meshObservation.geometries.length);
    assert.ok(initial.meshObservation.uploadCount > 0, 'Actual geometry vertex/index uploads must be observed');

    f.phase = 'public native extrude Distance 8 to 12';
    await f.openFeatureEditor(1, 'native box extrude');
    const distance = f.editor().getByLabel('Distance', { exact: true }); assert.equal(Number(await distance.inputValue()), 8);
    await distance.fill('12'); const originalDoc = await f.doc(); await f.applyEditor(originalDoc, '02-edited-distance-12');
    const edited = await capture('03-edited-current-mesh'); const after = latestBody(edited);
    assert.equal(after.input[0].key, before.input[0].key, 'Native edit preserves the body key');
    assert.notDeepEqual(after.input[0].positions, before.input[0].positions);
    assert.notEqual(after.after[0].surface.id, before.after[0].surface.id, 'Changed native box must receive current geometry');
    assert.equal(after.input[0].bounds.max[2], 12);
    assert.equal(after.after[0].surface.data.bounds.max[2], 12);
    await pick('bodies', [32, 16, 12], '04-selected-current-body');
    await pick('faces', [32, 16, 12], '05-selected-current-face');
    await pick('edges', [32, 0, 12], '06-selected-current-edge');

    f.phase = 'public Undo and Redo retain current native geometry';
    await clear(); await f.undo(); await f.same(originalDoc);
    const undone = await capture('07-undo-native-mesh'); assert.deepEqual(latestBody(undone).input[0], before.input[0]);
    await f.redo(); await f.same(edited.doc);
    const redone = await capture('08-redo-native-mesh'); assert.deepEqual(latestBody(redone).input[0], after.input[0]);
    await clear(); const final = await capture('09-cleared-current-native-mesh');
    assert.equal(final.meshObservation.current[0].surface.data.bounds.max[2], 12);
    const pairs = [];
    const calls = final.meshObservation.calls.filter(call => call.input.length === 1);
    for (let i = 0; i < calls.length; i++) for (let j = i + 1; j < calls.length; j++) {
      if (calls[i].legacySignatures[0] === calls[j].legacySignatures[0] && JSON.stringify(calls[i].input[0]) !== JSON.stringify(calls[j].input[0])) pairs.push([calls[i].sequence, calls[j].sequence]);
    }
    f.report.reachability = { result: pairs.length ? 'CHANGED_FULL_MESH_WITH_EQUAL_LEGACY_SIGNATURE_OBSERVED' : 'NOT_REPRODUCED_IN_THIS_FLOW', pairs,
      interpretation: 'Observation only; controlled regression tests must cover omitted buffers and near-position collisions.' };
    await f.persist();
  } finally { await f.page.evaluate(() => window.__d524Mesh?.restore()); }
});

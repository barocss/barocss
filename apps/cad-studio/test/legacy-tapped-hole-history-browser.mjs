import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const fixture = 'packages/barocss-cad-model/test/fixtures/o7-legacy/tapped-holes-milled.bcad';
const pins = [fixture, 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'apps/cad-studio/src/ui/HoleHistoryInputs.tsx',
  'packages/barocss-cad-model/src/app/editFields.ts', 'packages/barocss-cad-model/src/app/threads.ts',
  'packages/barocss-cad-model/src/app/editCommand.ts', 'packages/barocss-cad-model/src/app/holeEntry.ts'];
const f = await createFlow({
  name: 'legacy-tapped-hole-history', output: process.argv[2], envFrozen: 'D1176_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Review and edit the placement of a saved cosmetic tapped Hole without loading a catalog.',
  limits: ['One existing legacy authored file with three cosmetic tapped Holes. One blind Z bore is moved and deepened.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, faceGeometry, massPropertiesOf } from '@barocss/cad';
import { partSnapshot } from '@barocss/cad-model/engine/part';
import { bodyMesh } from '@barocss/cad-model/engine/mesh';
import { threadsOf, threadLines } from '@barocss/cad-model/app/threads';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { outputs: [out], outputs } = partSnapshot(doc);
const { brep } = out, saved = threadsOf(doc.nodes, {}), thread = saved.get('n2');
const walls = brep.faces.flatMap(face => {
  if (!face.name?.startsWith('n2.')) return [];
  const geometry = faceGeometry(face), surface = face.surface;
  if (geometry.kind !== 'cylinder' || surface.kind !== 'surface') return [];
  const ends = surface.controlPoints.flat().map(point => point[2]);
  return [{ geometry, ends: [Math.min(...ends), Math.max(...ends)] }];
});
const lines = threadLines(new Map([['n2', thread]]), bodyMesh(brep, 0));
console.log(JSON.stringify({ outputCount: outputs.length, solids: out.bodyCount,
  valid: checkBrep(brep, { strict: true }).valid, threads: [...saved.keys()], thread, ringSegments: lines.length / 6,
  volume: massPropertiesOf(out).volume, walls }));
`,
});
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });

async function verify(label, doc, x, y, depth) {
  const native = await f.inspect(label, doc);
  const expectedVolume = 60 * 40 * 20 - Math.PI * (2.5 ** 2 * depth + 1.25 ** 2 * 20 + 4.25 ** 2 * 15);
  const near = (actual, expected) => Math.abs(actual - expected) <= 1e-7;
  assert.equal(native.outputCount, 1);
  assert.equal(native.solids, 1);
  assert.equal(native.valid, true);
  assert.ok(near(native.volume, expectedVolume), JSON.stringify(native));
  assert.deepEqual(native.threads, ['n2', 'n3', 'n4']);
  assert.deepEqual(native.thread, { d: 6, pitch: 1, radius: 2.5, internal: true });
  assert.ok(native.ringSegments > 0, 'Saved cosmetic designation produces viewport ring geometry');
  assert.ok(native.walls.length > 0);
  for (const { geometry, ends } of native.walls) {
    assert.ok(near(geometry.c[0], x) && near(geometry.c[1], y) && near(geometry.r, 2.5));
    assert.ok(near(Math.abs(geometry.a[2]), 1));
    assert.ok(near(ends[0], 20 - depth) && near(ends[1], 20), JSON.stringify({ geometry, ends }));
  }
  f.report.observations.push({ label, expectedVolume, ...native });
}

await f.run(async () => {
  const path = resolve(import.meta.dirname, '../../..', fixture);
  const bytes = await readFile(path);
  f.report.observations.push({ label: 'legacy-source', hash: sha256(bytes) });
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'tapped-holes-milled.bcad', mimeType: 'application/json', buffer: bytes });
  await f.page.waitForFunction(() => window.__studioDoc?.nodes[2]?.thread === 'M6×1');
  await f.ready();
  const doc = await f.doc();
  assert.equal(doc.fastenerSizes, undefined);
  assert.equal(doc.nodes[2].face, 'n1.top');
  await f.openFeatureEditor(2, 'saved tapped hole');
  await f.snapshot('legacy-hole-history');
  const entry = f.editor().getByRole('group', { name: 'Hole placement', exact: true });
  assert.equal(await entry.count(), 1, 'History does not identify the saved entry face or cosmetic thread');
  assert.match(await entry.innerText(), /Entry face\s+n1\.top\s+Drill direction\s+−Z\s+Ends\s+To a depth\s+Thread\s+M6×1 · Cosmetic/);
  await verify('original-hole', doc, 15, 20, 12);
  const centre = f.editor().getByRole('spinbutton', { name: 'Centre X', exact: true });
  const depth = f.editor().getByRole('spinbutton', { name: 'Depth', exact: true });
  assert.equal(await centre.inputValue(), '15');
  assert.equal(await depth.inputValue(), '12');
  await centre.fill('17');
  await depth.fill('9');
  await f.same(doc);
  const changed = (await f.applyEditor(doc, 'legacy-hole-edited')).doc;
  assert.deepEqual(changed, { ...doc, nodes: doc.nodes.map((node, index) =>
    index === 2 ? { ...node, center: [17, 20], depth: 9 } : node) });
  await verify('legacy-hole-edited', changed, 17, 20, 9);
  await f.undo();
  await f.same(doc);
  await f.redo();
  await f.same(changed);
  const saved = await f.save('legacy-tapped-hole-history');
  const reopened = await f.freshOpen(saved.file, changed, 'legacy-hole-reopened');
  await verify('legacy-hole-reopened', reopened.doc, 17, 20, 9);
  await f.openFeatureEditor(3, 'saved through hole');
  await f.snapshot('legacy-through-hole-history');
  assert.match(await f.editor().getByRole('group', { name: 'Hole placement', exact: true }).innerText(),
    /Entry face\s+n1\.top\s+Drill direction\s+−Z\s+Ends\s+Through\s+Thread\s+M3×0\.5 · Cosmetic/);

  const underside = {
    ...doc, nextId: 3,
    nodes: [...doc.nodes.slice(0, 2), { ...doc.nodes[2], face: 'n1.bottom' }],
    outputs: { b2: { node: 2, side: 'solid' } },
  };
  const [legacyChooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await legacyChooser.setFiles({ name: 'legacy-underside.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(underside)) });
  await f.page.waitForFunction(() => window.__studioDoc?.nodes[2]?.face === 'n1.bottom');
  await f.ready();
  await f.openFeatureEditor(2, 'saved named underside with no explicit side');
  const bottom = f.editor().getByRole('group', { name: 'Hole placement', exact: true });
  assert.match(await bottom.innerText(), /Entry face\s+n1\.bottom\s+Drill direction\s+\+Z/);
  const depthHandle = f.page.locator('g.gizmo-handle[data-handle="depth"]');
  await depthHandle.waitFor();
  const [root, tip] = await depthHandle.evaluate(group => ['circle', 'polygon'].map(selector => {
    const rect = group.querySelector(selector).getBoundingClientRect();
    return [rect.x + rect.width / 2, rect.y + rect.height / 2];
  }));
  const expectedRoot = await f.page.evaluate(() => window.__studioScreenOf([15, 20, 12]));
  const above = await f.page.evaluate(() => window.__studioScreenOf([15, 20, 13]));
  assert.ok(Math.hypot(root[0] - expectedRoot[0], root[1] - expectedRoot[1]) < 2);
  assert.ok((tip[0] - root[0]) * (above[0] - expectedRoot[0]) + (tip[1] - root[1]) * (above[1] - expectedRoot[1]) > 0,
    'Viewport depth arrow must point along +Z for the named underside');
  f.report.observations.push({ label: 'underside-depth-handle', root, tip, expectedRoot, projectedPositiveZ: above });
  await f.snapshot('legacy-underside-direction');
});

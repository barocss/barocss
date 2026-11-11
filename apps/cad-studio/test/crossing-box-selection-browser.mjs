// D719: real orthographic crossing drags on native parts without enclosed vertices.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/crossing-box-selection-browser.mjs',
  'apps/cad-studio/src/viewport/Viewport.tsx',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  ...(baseline ? [] : ['apps/cad-studio/src/viewport/boxSelectionCrossing.ts']),
];
const f = await createFlow({
  name: 'crossing-box-selection', output, envFrozen: 'D719_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce a crossing box that misses the vertex samples' : 'Select intersecting visible Model triangles',
  limits: ['Desktop orthographic Model with ordinary visible top-level bodies.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
const profiles = {
  plate: { min:[-45,-5], max:[5,5], height:4 },
  block: { min:[17,-4], max:[29,4], height:3 },
  ring: { min:[-16,19], max:[16,43], height:2,
    holes:[[{kind:'line',start:[-6,26]},{kind:'line',start:[6,26]},
      {kind:'line',start:[6,36]},{kind:'line',start:[-6,36]}]] },
};
const doc = JSON.parse(process.argv[3]).reduce((doc,name) => {
  const {height,...profile} = profiles[name], sketch = doc.nodes.length;
  return withNode(withNode(doc,{kind:'sketch',profile:'rectangle',...profile}),{kind:'extrude',sketch,height});
},emptyDoc());
const built = evaluateDoc(doc, 1);
assert.ok(built.ok, JSON.stringify(built));
console.log(JSON.stringify({doc,meshes:built.bodies.map(({key,mesh}) => ({
  key, positions:[...mesh.positions], indices:[...mesh.indices],
}))}));
`,
});

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  await f.newPage();
  let page = f.page, mouse = page.mouse;
  const button = name => page.getByRole('button', { name, exact: true });
  const ortho = () => page.locator('.views').getByRole('button', { name: 'Ortho', exact: true });
  const top = () => page.locator('.views').getByRole('button', { name: 'Top', exact: true });
  const marquee = () => page.locator('.vp-overlay .marquee');
  const project = points => page.evaluate(points => points.map(point => window.__studioScreenOf(point)), points);
  const boxOf = points => {
    assert.ok(points.every(point => point?.every(Number.isFinite)));
    return [[Math.min(...points.map(point => point[0])), Math.min(...points.map(point => point[1]))],
      [Math.max(...points.map(point => point[0])), Math.max(...points.map(point => point[1]))]];
  };
  const rect = async (lo, hi) => boxOf(await project([[...lo, 0], [...hi, 0]]));
  const open = async (file, doc) => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles(file);
    await f.same(doc);
    if (await ortho().getAttribute('aria-pressed') !== 'true') await ortho().click();
    await top().click();
    await page.waitForFunction(() => {
      const a = window.__studioScreenOf([0, 0, 0]), b = window.__studioScreenOf([0, 0, 100]);
      return a && b && Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.5;
    });
    await f.ready();
  };
  const drag = async (label, box, expected, { crossing = true, additive = false } = {}) => {
    f.phase = label;
    const before = { doc: await f.doc(), bodies: await f.bodies(),
      history: await page.locator('.history .hs').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))) };
    const [a, b] = crossing ? [box[1], box[0]] : box;
    for (const point of [a, b]) {
      assert.ok(await page.evaluate(([x,y]) => document.elementFromPoint(x,y)?.matches('canvas.vp-canvas'), point), JSON.stringify(point));
    }
    if (additive) await page.keyboard.down('Shift');
    await mouse.move(...a);
    await mouse.down();
    await mouse.move(...b, { steps: 10 });
    await marquee().waitFor({ state: 'attached' });
    assert.equal(await marquee().evaluate(element => element.classList.contains('crossing')), crossing);
    await mouse.up();
    if (additive) await page.keyboard.up('Shift');
    await marquee().waitFor({ state: 'detached' });
    const after = await f.snapshot(label);
    assert.deepEqual(after.selection.selection.bodies, expected);
    assert.deepEqual(after.selection.selection.faces, []);
    assert.deepEqual(after.selection.selection.edges, []);
    for (const field of ['doc', 'bodies', 'history']) assert.deepEqual(after[field], before[field], field);
  };

  const authored = await f.inspect('parts', {}, ['plate', 'block', 'ring']);
  const file = join(output, 'parts.bcad');
  await writeFile(file, JSON.stringify(authored.doc));
  await open(file, authored.doc);
  const initial = await f.snapshot('opened');
  assert.deepEqual(initial.bodies.bodies.map(body => body.key), authored.meshes.map(mesh => mesh.key));
  assert.deepEqual(initial.bodies.bodies.map(body => Math.round(body.volume)), [2000, 288, 1296]);
  assert.equal(await ortho().getAttribute('aria-pressed'), 'true');
  const edgeBox = await rect([-25, 3], [-16, 7]);
  const faceBox = await rect([-25, -2], [-16, 2]);
  const plate = authored.meshes[0];
  const vertices = await project(Array.from({ length: plate.positions.length / 3 }, (_, i) => plate.positions.slice(i * 3, i * 3 + 3)));
  const inside = ([[lx, ly], [hx, hy]]) => vertices.filter(([x, y]) => x >= lx && x <= hx && y >= ly && y <= hy).length;
  assert.equal(inside(edgeBox), 0);
  assert.equal(inside(faceBox), 0);
  f.report.observations.push({ key: plate.key, cameraEye: await page.evaluate(() => window.__studioEye()),
    meshVertices: vertices.length, meshTriangles: plate.indices.length / 3, edgeBox, faceBox, verticesInside: 0 });

  await drag('silhouette-crossing', edgeBox, baseline ? [] : [0]);
  await drag('face-interior-crossing', faceBox, baseline ? [] : [0]);
  await drag('corner-control', await rect([-49, 2], [-42, 8]), [0]);
  await drag('empty-hole-control', await rect([-4, 28], [4, 34]), []);
  if (baseline) return;

  const empty = await rect([9, 6], [15, 12]);
  await drag('outside-control', empty, []);
  await drag('window-partial-control', edgeBox, [], { crossing: false });
  await drag('window-contained-control', await rect([-49, -9], [9, 9]), [0], { crossing: false });
  await drag('other-body', await rect([19, -2], [27, 2]), [1]);
  await drag('shift-additive', edgeBox, [1, 0], { additive: true });
  await drag('empty-replacement', empty, []);

  const first = () => page.locator('.ol-row').filter({ has: page.locator('button.ol-eye') }).first();
  await first().getByRole('button', { name: 'Hide body', exact: true }).click();
  await first().getByRole('button', { name: 'Show body', exact: true }).waitFor();
  await f.ready();
  await drag('hidden-edge', edgeBox, []);
  await first().getByRole('button', { name: 'Show body', exact: true }).click();
  await first().getByRole('button', { name: 'Hide body', exact: true }).waitFor();
  await f.ready();
  await drag('shown-edge', edgeBox, [0]);

  await drag('clear-before-face-click', empty, []);
  f.phase = 'Check the existing Faces click filter';
  await button('Selection filter').click();
  assert.match(await button('Selection filter').textContent(), /Faces/);
  const [face] = await project([[-21, 0, 4]]);
  await mouse.click(...face);
  const clicked = await f.snapshot('face-click-filter');
  assert.equal(clicked.selection.selection.faces[0].body, 0);
  assert.deepEqual(clicked.selection.selection.bodies, []);
  await drag('crossing-keeps-body-selection-with-face-filter', edgeBox, [0]);

  f.phase = 'Cancel a native command without applying a crossing to its preview';
  await f.command('Box');
  const hud = page.getByRole('dialog', { name: 'Box', exact: true });
  await hud.waitFor();
  const before = await f.snapshot('command-open');
  await drag('command-crossing', await rect([-29, 2], [-18, 7]), before.selection.selection.bodies);
  await hud.getByRole('button', { name: 'Cancel', exact: true }).click();
  await hud.waitFor({ state: 'hidden' });
  await f.ready();
  await drag('after-command-cancel', edgeBox, [0]);

  f.phase = 'Save the native part and reopen it in a fresh desktop context';
  const accepted = await f.doc();
  const projectName = 'D719 Crossing boxes';
  await button('Project and versions').click();
  const panel = page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(projectName);
  await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await button('Save').click();
  await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText('parts.bcad', { exact: true }).waitFor();
  const bytes = Buffer.from(await page.evaluate(async name => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(name);
    return [...new Uint8Array(await (await (await dir.getFileHandle('parts.bcad')).getFile()).arrayBuffer())];
  }, projectName));
  assert.deepEqual(JSON.parse(bytes.toString()), accepted);
  const savedFile = join(output, 'studio-saved.bcad');
  await writeFile(savedFile, bytes);
  f.report.observations.push({ nativeSha256: createHash('sha256').update(bytes).digest('hex') });
  await f.newPage();
  page = f.page;
  mouse = page.mouse;
  await open(savedFile, accepted);
  await drag('reopened-edge', await rect([-25, 3], [-16, 7]), [0]);

  f.phase = 'Replace the document and use the current body order';
  const reordered = await f.inspect('reordered', {}, ['ring', 'block', 'plate']);
  const otherFile = join(output, 'reordered.bcad');
  await writeFile(otherFile, JSON.stringify(reordered.doc));
  await open(otherFile, reordered.doc);
  const replacement = await f.snapshot('replacement-opened');
  assert.deepEqual(replacement.bodies.bodies.map(body => body.key), reordered.meshes.map(mesh => mesh.key));
  assert.deepEqual(replacement.bodies.bodies.map(body => Math.round(body.volume)), [1296, 288, 2000]);
  await drag('replacement-edge', await rect([-25, 3], [-16, 7]), [2]);
});

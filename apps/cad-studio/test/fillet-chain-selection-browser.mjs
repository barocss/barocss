import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const removeEdge = process.argv[3] === '--remove';
const varying = process.argv[3] === '--varying';
const preserveEdges = process.argv[3] === '--preserve-edges';
const showScope = preserveEdges || varying || removeEdge || process.argv[3] === '--scope';
const scopeMutation = process.env.D1183_MUTATION;
const pins = [
  'apps/cad-studio/test/fillet-chain-selection-browser.mjs',
  'apps/cad-studio/test/model-rail-helper.mjs',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'apps/cad-studio/src/viewport/useViewportPicking.ts',
  'packages/barocss-cad-model/src/app/edgeChain.ts',
  'packages/barocss-cad-model/src/app/commands.ts',
  'packages/barocss-cad/src/blend/edge-finish.ts',
  ...(showScope ? [
    'apps/cad-studio/src/app/commandState.ts', 'apps/cad-studio/src/engine/engine.worker.ts',
    'apps/cad-studio/src/state/useCommandPreview.ts', 'apps/cad-studio/src/ui/Hud.tsx',
    'packages/barocss-cad-model/src/engine/evaluate.ts',
    'packages/barocss-cad/src/part/part-finish.ts', 'packages/barocss-cad/src/part/part-model.ts',
    'packages/barocss-cad/src/part/part-types.ts',
  ] : []),
  ...((removeEdge || preserveEdges) ? ['apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/FilletPickedEdges.tsx'] : []),
];
const f = await createFlow({
  name: 'fillet-chain-selection', output: process.argv[2], envFrozen: preserveEdges ? 'D1188_SOURCE_FROZEN' : varying ? 'D1187_SOURCE_FROZEN' : removeEdge ? 'D1185_SOURCE_FROZEN' : showScope ? 'D1183_SOURCE_FROZEN' : 'D901_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: preserveEdges ? 'Preserve Edge Fillet picks on a face miss and verify three picked and one added.'
    : varying ? 'Report the native scope and endpoint radii of one open variable fillet.'
    : removeEdge ? 'Remove an authored original edge while the preview has rounded it away.'
    : 'Compare stored targets and native geometry after single-edge and tangent-chain Fillet picks.',
  limits: ['Desktop WebGPU, stadium and rectangular prism controls.',
    'The two straight rims and two semicircular rims may have distinct native member and display-edge counts.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkBrep, faceGeometry, massPropertiesOf, revolutionOf } from '@barocss/cad';
import { emptyDoc, rectanglePart, withNode } from '@barocss/cad-model/engine/doc';
import { bodyMesh } from '@barocss/cad-model/engine/mesh';
import { partSnapshot } from '@barocss/cad-model/engine/part';
if (process.argv[3] === '"seed"') {
  const sketch = withNode(emptyDoc(), { kind: 'sketch', profile: 'loop', sideTags: { outer: ['e1','e2','e3','e4'] },
    segments: [
      { kind: 'line', start: [0,-4] },
      { kind: 'arc', start: [20,-4], center: [20,0], direction: 'ccw' },
      { kind: 'line', start: [20,4] },
      { kind: 'arc', start: [0,4], center: [0,0], direction: 'ccw' },
    ],
  });
  console.log(JSON.stringify(withNode(sketch, { kind: 'extrude', sketch: 0, height: 6 })));
  process.exit(0);
}
if (process.argv[3] === '"box"') {
  console.log(JSON.stringify(rectanglePart(40, 30, 10)));
  process.exit(0);
}
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { outputs } = partSnapshot(doc);
assert.equal(outputs.length, 1);
const [output] = outputs, { brep } = output;
const check = checkBrep(brep, { strict: true });
assert.ok(check.valid, JSON.stringify(check.issues));
assert.deepEqual(brep.bodies.map(body => body.kind), ['solid']);
assert.equal(brep.shells.length, 1);
assert.ok(brep.shells[0].closed);
const mesh = bodyMesh(brep, 0);
console.log(JSON.stringify({
  mass: massPropertiesOf(output),
  reportEdges: output.fillet?.flatMap(report => report.edges),
  vertices: brep.vertices.map(vertex => vertex.point),
  faces: brep.faces.map(face => ({
    name: face.name, geometry: faceGeometry(face),
    ...(face.name?.startsWith('n2.face') && face.surface.kind === 'surface' ? { revolution: revolutionOf(face.surface, 100) } : {}),
  })),
  edges: brep.edges.map(edge => edge.name),
  displayEdges: mesh.edges.map(({ index, a, b, names, straight }) => ({ index, a, b, names, straight })),
}));
`,
});

const filename = 'D901-fillet-chain.bcad', projectName = 'D901 native fillet';
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const near = (actual, expected, tolerance) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected}`);
const area = 160 + 16 * Math.PI, perimeter = 40 + 8 * Math.PI;
// Unit square minus its quarter disk, in inward distance d and depth t below the top.
const cornerArea = 1 - Math.PI / 4, firstMoment = 5 / 6 - Math.PI / 4, mixedMoment = 19 / 24 - Math.PI / 4;
const removed = perimeter * cornerArea - 2 * Math.PI * firstMoment;
const removedMoment = 6 * removed - (perimeter * firstMoment - 2 * Math.PI * mixedMoment);
const volume = 6 * area - removed, centroidZ = (18 * area - removedMoment) / volume;

async function open(doc, bytes = Buffer.from(JSON.stringify(doc))) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name: filename, mimeType: 'application/json', buffer: bytes });
  await f.same(doc);
}

async function save(doc) {
  await button(f.page, 'Project and versions').click();
  const panel = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(projectName);
  await button(panel, 'Project in this browser').click();
  await panel.getByLabel('Project', { exact: true }).waitFor();
  await button(f.page, 'Save').click();
  await panel.getByRole('list', { name: 'Project documents' }).getByText(filename, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
  const bytes = Buffer.from(await f.page.evaluate(async ([project, file]) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(project);
    return (await (await folder.getFileHandle(file)).getFile()).text();
  }, [projectName, filename]));
  assert.deepEqual(JSON.parse(bytes), doc);
  f.report.files.push({ bytes: bytes.length, sha256: sha256(bytes) });
  return bytes;
}

async function selectRim(chain, edges, seedIndex, world = [10, -4, 6]) {
  const views = f.page.getByRole('group', { name: 'Views', exact: true });
  await button(views, 'Iso').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  const filter = button(f.page, 'Selection filter');
  for (let attempt = 0; attempt < 4 && !(await filter.innerText()).trim().endsWith('Edges'); attempt++) await filter.click();
  assert.match((await filter.innerText()).trim(), /Edges$/);
  const pixel = await f.page.evaluate(world => {
    const at = window.__studioScreenOf(world);
    return at && document.elementFromPoint(...at)?.closest('canvas.vp-canvas') ? at : null;
  }, world);
  assert.ok(pixel);
  if (chain) await f.page.mouse.dblclick(...pixel);
  else await f.page.mouse.click(...pixel);
  const indices = chain ? edges.map(edge => edge.index) : [seedIndex];
  await f.page.waitForFunction(wanted => {
    const s = window.__studioSelection?.selection;
    return s?.edges.length === wanted.length && !s.faces.length && !s.bodies.length
      && s.edges.every(e => e.body === 0 && wanted.includes(e.edge));
  }, indices, { timeout: 5000 });
  return { world, pixel, indices };
}

async function validate(label, doc, seed, wanted) {
  await f.same(doc);
  assert.deepEqual(doc.nodes.slice(0, 2), seed.nodes);
  const node = doc.nodes[2];
  assert.equal(node.kind, 'fillet');
  assert.equal(node.radius, 1);
  assert.deepEqual(node.parent, { node: 1, side: 'solid' });
  assert.deepEqual([...node.edges].sort(), [...wanted].sort());
  assert.deepEqual(doc.outputs, { b2: { node: 2, side: 'solid' } });
  const native = await f.inspect(`${label}-native`, doc);
  near(native.mass.volume, volume, 1e-7);
  near(native.mass.centroid[0], 10, 1e-8);
  near(native.mass.centroid[1], 0, 1e-8);
  near(native.mass.centroid[2], centroidZ, 1e-8);
  const fillets = native.faces.filter(face => /^n2\.face(?:#\d+)?$/.test(face.name));
  assert.ok(fillets.length >= 4);
  const axis = fillets.filter(face => face.geometry.kind === 'cylinder' && Math.abs(face.geometry.a[0]) > 0.999999);
  assert.equal(axis.length, 2);
  axis.forEach(face => {
    near(face.geometry.r, 1, 1e-8);
    near(Math.abs(face.geometry.c[1]), 3, 1e-8);
    near(face.geometry.c[2], 5, 1e-8);
  });
  assert.ok(axis[0].geometry.c[1] * axis[1].geometry.c[1] < 0);
  const ends = fillets.filter(face => face.geometry.kind === 'other');
  assert.equal(ends.length, 2);
  const positions = [];
  for (const { revolution } of ends) {
    assert.equal(revolution?.profile.kind, 'arc');
    near(Math.abs(revolution.a[2]), 1, 1e-8);
    near(revolution.c[1], 0, 1e-8);
    near(revolution.profile.c[0], 3, 1e-8);
    near(revolution.profile.r, 1, 1e-8);
    positions.push(revolution.c[0]);
  }
  positions.sort((a, b) => a - b);
  near(positions[0], 0, 1e-8);
  near(positions[1], 20, 1e-8);
  assert.ok(!native.edges.some(name => wanted.includes(name)), 'The authored sharp edge names are consumed.');
  const [worker] = (await f.bodies()).bodies;
  near(worker.volume, native.mass.volume, 1e-7);
  f.report.observations.push({ label, storedEdges: node.edges, generatedFaces: fillets.map(face => face.name),
    nativeVolumeMm3: native.mass.volume, workerVolumeMm3: worker.volume, expectedVolumeMm3: volume,
    nativeCentroidMm: native.mass.centroid, expectedCentroidMm: [10, 0, centroidZ], nativeFaceNames: native.faces.map(face => face.name) });
  return native;
}

async function checkScope(hud, picked, added, constant = true) {
  const scope = hud.getByRole('group', { name: 'Fillet scope', exact: true });
  assert.equal(await scope.count(), 1, 'The preview did not distinguish picked edges from native tangent targets');
  for (const [label, names] of [['Picked native edges', picked], ['Tangent edges added', added]]) {
    const field = scope.locator('.field').filter({ hasText: label }).locator('span[title]');
    assert.equal(await field.innerText(), String(names.length));
    assert.deepEqual((await field.getAttribute('title')).split('\n').filter(Boolean).sort(), [...names].sort());
  }
  if (constant) assert.match(await scope.innerText(), /Radius\s+1 mm/);
}

async function checkRemoval(seed, stock, top, seedEdge, topNames) {
  const bottom = stock.displayEdges.filter(edge => edge.names.some(name => name.split('|').includes('n1.bottom')));
  assert.equal(bottom.length, 4);
  const straight = bottom.find(edge => edge.straight && [edge.a, edge.b].every(point => point[1] === -4));
  assert.ok(straight);
  const bottomNames = bottom.flatMap(edge => edge.names);
  const pickedNames = [...topNames, ...straight.names];
  const bottomAdded = bottomNames.filter(name => !straight.names.includes(name));
  await selectRim(true, top, seedEdge.index);
  await clickModelCommand(f.page, 'Modify', 'Fillet');
  const hud = f.page.getByRole('dialog', { name: 'Fillet', exact: true });
  await hud.getByLabel('Radius', { exact: true }).fill('1');
  await hud.locator('.status.ok').waitFor();
  await checkScope(hud, topNames, []);

  f.phase = 'Add the bottom rim with a real Shift-click';
  const pixel = await f.page.evaluate(() => window.__studioScreenOf([10, -4, 0]));
  assert.ok(pixel?.length === 2);
  await f.page.keyboard.down('Shift');
  try { await f.page.mouse.click(...pixel); } finally { await f.page.keyboard.up('Shift'); }
  await f.page.waitForFunction(index => {
    const selection = window.__studioSelection.selection;
    return selection.edges.length === 5 && selection.edges.some(edge => edge.body === 0 && edge.edge === index);
  }, straight.index);
  await hud.locator('.status.ok').waitFor();
  await checkScope(hud, pickedNames, bottomAdded);
  await f.same(seed);
  await f.snapshot('two-rim-preview');

  if (preserveEdges) {
    f.phase = 'Shift-click a face miss in Edges mode with two rims in preview';
    const facePoint = await f.page.evaluate(() => window.__studioScreenOf([10, -4, 1]));
    assert.ok(facePoint?.length === 2);
    const selectionBefore = (await f.snapshot('edge-filter-before')).selection.selection;
    await f.page.keyboard.down('Shift');
    try { await f.page.mouse.click(...facePoint); } finally { await f.page.keyboard.up('Shift'); }
    const state = await f.snapshot('edge-filter-after');
    assert.deepEqual(state.selection.selection, selectionBefore, 'The face miss replaced the original edges');
    await hud.locator('.status.ok').waitFor();
    await checkScope(hud, pickedNames, bottomAdded);
    await f.same(seed);
  }

  f.phase = 'Remove the original bottom selection from its live preview';
  const disclosure = hud.getByText('Edit picked edges', { exact: true });
  assert.equal(await disclosure.count(), 1, 'The preview does not offer removal of the original edges');
  await disclosure.click();
  const remove = button(hud, 'Remove ' + straight.names.join(', '));
  await remove.focus();
  await remove.press('Enter');
  await hud.locator('.status.ok').waitFor();
  await checkScope(hud, topNames, []);
  await f.same(seed);
  await f.snapshot('top-only-preview');
  let authored = topNames;
  if (preserveEdges) {
    f.phase = 'Remove one picked top edge and verify its native continuation';
    authored = topNames.filter(name => !seedEdge.names.includes(name));
    await button(hud, 'Remove ' + seedEdge.names.join(', ')).click();
    await hud.locator('.status.ok').waitFor();
    await checkScope(hud, authored, seedEdge.names);
    await f.same(seed);
    await f.snapshot('three-picked-one-added-preview');
  }
  await button(hud, 'Apply').click();
  await f.changed(seed);
  const accepted = (await f.snapshot('top-only-applied')).doc;
  const current = await validate('top-only', accepted, seed, authored);
  assert.ok(bottomNames.every(name => current.edges.includes(name)), 'The untouched bottom rim keeps its original names');
  await f.undo();
  await f.same(seed);
  await f.redo();
  await f.same(accepted);
  const bytes = await save(accepted);
  await f.newPage();
  await open(accepted, bytes);
  await validate('top-only-reopened', accepted, seed, authored);
  await f.snapshot('top-only-reopened');
}

async function checkVarying(seed, top, seedEdge) {
  f.phase = 'Refuse unequal variable radii on the full closed rim';
  await selectRim(true, top, seedEdge.index);
  await clickModelCommand(f.page, 'Modify', 'Fillet');
  let hud = f.page.getByRole('dialog', { name: 'Fillet', exact: true });
  await hud.getByLabel('Fillet radius mode', { exact: true }).selectOption('varying');
  await hud.getByLabel('Radius', { exact: true }).fill('1');
  await hud.getByLabel('End radius (0: same)', { exact: true }).fill('3');
  await hud.locator('.status.error').waitFor();
  assert.match(await hud.getByRole('status').innerText(), /one open chain/i);
  assert.equal(await button(hud, 'Apply').isEnabled(), false);
  await f.same(seed);
  await f.snapshot('closed-rim-refused');
  await button(hud, 'Cancel').click();

  f.phase = 'Preview R1 to R3 on the original straight edge';
  const box = await f.inspect('box-seed', {}, 'box');
  const stock = await f.inspect('box-stock-native', box);
  const edge = stock.displayEdges.find(edge => edge.names.includes('n1.side0|n1.top'));
  assert.ok(edge);
  await f.newPage();
  if (scopeMutation) await f.page.evaluate(() => {
    // Mutate the evaluated box reply, after the closed-rim control.
    window.__d1187CorruptTargets = true;
  });
  await open(box);
  await selectRim(false, [edge], edge.index, [20, 0, 10]);
  await clickModelCommand(f.page, 'Modify', 'Fillet');
  hud = f.page.getByRole('dialog', { name: 'Fillet', exact: true });
  await hud.getByLabel('Fillet radius mode', { exact: true }).selectOption('varying');
  await hud.getByLabel('Radius', { exact: true }).fill('1');
  await hud.getByLabel('End radius (0: same)', { exact: true }).fill('3');
  await hud.locator('.status.ok').waitFor();
  await f.same(box);
  await f.snapshot('varying-open-preview');
  await checkScope(hud, edge.names, [], false);
  const scope = hud.getByRole('group', { name: 'Fillet scope' });
  assert.match(await scope.innerText(), /Picked start radius\s+1 mm/);
  assert.match(await scope.innerText(), /Picked end radius\s+3 mm/);
  await button(hud, 'Apply').click();
  await f.changed(box);
  const next = (await f.snapshot('varying-open-applied')).doc;
  const node = next.nodes.at(-1);
  assert.equal(node.kind, 'fillet');
  assert.deepEqual(node.edges, edge.names);
  assert.deepEqual(node.radii, [
    { at: [0, 0, 10], radius: 1, atEnd: true },
    { at: [40, 0, 10], radius: 3, atEnd: true },
  ]);
  async function verify(label) {
    const native = await f.inspect(label, next);
    const expected = 12000 - (1 - Math.PI / 4) * 40 * 13 / 3;
    near(native.mass.volume, expected, 1e-7);
    assert.deepEqual(native.reportEdges, edge.names);
    const contacts = [[0, 0, 9], [0, 1, 10], [40, 0, 7], [40, 3, 10]];
    for (const contact of contacts)
      assert.ok(native.vertices.some(point => point.every((coordinate, axis) => Math.abs(coordinate - contact[axis]) < 1e-7)));
    f.report.observations.push({ label, expected, volume: native.mass.volume, edge: edge.names, contacts });
  }
  await verify('varying-native');
  await f.undo();
  await f.same(box);
  await f.redo();
  await f.same(next);
  const bytes = await save(next);
  await f.newPage();
  await open(next, bytes);
  await verify('varying-reopened-native');
  await f.snapshot('varying-reopened');
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(scopeMutation ? 30000 : 10000);
    if (scopeMutation) await context.addInitScript(targetCount => {
      const descriptor = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage');
      Object.defineProperty(Worker.prototype, 'onmessage', {
        ...descriptor,
        set(listener) {
          descriptor.set.call(this, listener && (event => {
            for (const body of event.data?.result?.bodies ?? []) {
              if ((targetCount !== 1 || window.__d1187CorruptTargets) && body.filletTargets?.length === targetCount)
                body.filletTargets = body.filletTargets.map((name, index) => index === Math.min(1, targetCount - 1) ? 'unrelated.native.edge' : name);
            }
            listener.call(this, event);
          }));
        },
      });
    }, varying ? 1 : 4);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  const seed = await f.inspect('seed', {}, 'seed');
  const stock = await f.inspect('stock-native', seed);
  near(stock.mass.volume, 6 * area, 1e-7);
  const top = stock.displayEdges.filter(e => [e.a, e.b].every(p => p[2] === 6)
    && e.names.some(name => name.split('|').includes('n1.top')));
  assert.equal(top.length, 4);
  const edge = top.find(e => e.straight && [e.a, e.b].every(p => p[1] === -4));
  assert.ok(edge);
  assert.deepEqual(edge.names, ['n1.side[e1]|n1.top']);
  const names = top.flatMap(e => e.names);
  assert.ok(names.every(name => stock.edges.includes(name)));

  await f.newPage();
  await open(seed);
  if (varying) { await checkVarying(seed, top, edge); return; }
  if (removeEdge || preserveEdges) { await checkRemoval(seed, stock, top, edge, names); return; }
  const result = [];
  for (const chain of [false, true]) {
    const label = chain ? 'tangent-chain' : 'single-edge', selected = chain ? names : edge.names;
    f.phase = `select ${label} with a real pointer`;
    const pick = await selectRim(chain, top, edge.index);
    f.report.observations.push({ label, ...pick, selected });
    await f.snapshot(`${label}-selected`);
    await clickModelCommand(f.page, 'Modify', 'Fillet');
    const hud = f.page.getByRole('dialog', { name: 'Fillet', exact: true });
    await hud.getByLabel('Radius', { exact: true }).fill('1');
    await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 60000 });
    await f.same(seed);
    await f.snapshot(`${label}-preview`);
    if (showScope) await checkScope(hud, selected, names.filter(name => !selected.includes(name)));
    await button(hud, 'Apply').click();
    await hud.waitFor({ state: 'hidden' });
    await f.changed(seed);
    const doc = (await f.snapshot(`${label}-applied`)).doc;
    const native = await validate(label, doc, seed, selected);
    result.push({ doc, native });
    await f.undo();
    await f.same(seed);
    await f.redo();
    await f.same(doc);
    await f.undo();
    await f.same(seed);
  }
  assert.equal(result[0].doc.nodes[2].edges.length, 1);
  assert.equal(result[1].doc.nodes[2].edges.length, names.length);
  near(result[0].native.mass.volume, result[1].native.mass.volume, 1e-7);
  const byName = faces => [...faces].sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(byName(result[0].native.faces), byName(result[1].native.faces));
  await f.redo();
  await f.same(result[1].doc);
  const bytes = await save(result[1].doc);
  await f.newPage();
  await open(result[1].doc, bytes);
  await validate('tangent-chain-fresh-open', result[1].doc, seed, names);
  await f.snapshot('tangent-chain-fresh-open');
});

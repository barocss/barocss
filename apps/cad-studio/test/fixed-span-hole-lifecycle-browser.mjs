import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/fixed-span-hole-lifecycle-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/app/patternHoleSpacing.ts',
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad-model/src/engine/part.ts',
  'packages/barocss-cad/src/part/part-model.ts',
];
const f = await createFlow({
  name: 'fixed-span-hole-lifecycle', output: process.argv[2], envFrozen: 'D1023_SOURCE_FROZEN',
  qualification: 'Preview and apply a real end Hole, then verify its Fixed span retarget through Save and fresh Open.',
  limits: ['One-body X Linear pattern with three separate rectangular pieces and a legacy terminal simple through Hole.'],
  snapshotExtra: () => ({
    undoRedo: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`)?.disabled),
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    shown: window.__studioSection(),
  }),
  initialFiles: pins, requiredFrozen: pins,
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const [body] = evaluateCadPart(toPartDocument(doc)).outputs;
const walls = body.brep.faces.filter(face => face.name?.startsWith('n3.')).map(faceGeometry);
const tops = body.brep.faces.filter(face => /^n1\\.top(?:@\\d+)?$/.test(face.name ?? ''))
  .map(face => [face.name, face.loops.length]).sort(([a], [b]) => a.localeCompare(b));
console.log(JSON.stringify({ valid: checkOutput(body).valid, volume: massPropertiesOf(body).volume, walls, tops }));
`,
});
const ref = node => ({ node, side: 'solid' });
const doc = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [50, 10], max: [54, 16] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 8 },
    { kind: 'linear-span-pattern', parent: ref(1), axis: 'x', span: 32, count: 3, id: 'n2' },
    { kind: 'hole', parent: ref(2), radius: 1, center: [84, 13], face: 'n1.top@2', id: 'n3' },
  ],
  outputs: { b3: ref(3) }, nextId: 4,
};
const button = name => f.page.getByRole('button', { name, exact: true });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} versus ${expected}`);

async function open(name, model) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(model)) });
  await f.same(model);
}

async function verify(label, model, count) {
  const native = await f.inspect(label, model);
  f.report.observations.push({ label, native });
  await f.persist();
  assert.equal(native.valid, true);
  const tops = Array.from({ length: count }, (_, i) => [i ? 'n1.top@' + i : 'n1.top', i === count - 1 ? 2 : 1]);
  assert.deepEqual(native.tops, tops);
  assert.equal(native.walls.length, 2);
  for (const wall of native.walls) {
    assert.equal(wall.kind, 'cylinder');
    near(wall.c[0], 84);
    near(wall.c[1], 13);
    near(wall.r, 1);
  }
  near(native.volume, count * 4 * 6 * 8 - 8 * Math.PI);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  await f.newPage();
  const stock = { ...doc, nodes: doc.nodes.slice(0, 3), outputs: { b2: ref(2) }, nextId: 3 };
  await open('fixed-span-end', stock);
  const views = f.page.locator('.views');
  await views.getByRole('button', { name: 'Top', exact: true }).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  const filter = button('Selection filter');
  for (let attempt = 0; attempt < 6 && !(await filter.innerText()).includes('Faces'); attempt++) await filter.click();
  assert.ok((await filter.innerText()).includes('Faces'));
  const point = [84, 13, 8];
  const coords = await f.page.evaluate(point => window.__studioScreenOf(point), point);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), coords));
  await f.page.mouse.click(...coords);
  await f.page.keyboard.press('h');
  const hole = f.page.getByRole('dialog', { name: 'Hole', exact: true });
  await hole.waitFor();
  const spin = name => hole.getByRole('spinbutton', { name, exact: true });
  await spin('Centre X').fill('84');
  await spin('Centre Y').fill('13');
  await spin('Diameter').fill('2');

  f.phase = 'verify the pending Hole preview before applying';
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent.trim() === 'preview'
    && window.__studioSection()?.shownKeys.includes('b3'));
  const preview = await f.snapshot('hole-preview');
  assert.deepEqual(preview.doc, stock);
  assert.deepEqual(preview.shown.shownKeys, ['b3']);
  const expectedVolume = 576 - 8 * Math.PI;
  // The viewer preview uses tessellated volume. Exact native volume is checked after Apply.
  assert.ok(Math.abs(preview.shown.shownVolume - expectedVolume) < 0.2);

  f.phase = 'apply and retarget the end through Count';
  await hole.getByRole('button', { name: 'Apply', exact: true }).click();
  await f.changed(stock);
  const created = await f.snapshot('hole-applied');
  assert.equal(created.doc.nodes[3].face, 'n1.top@2');
  assert.deepEqual(created.doc.nodes[3].center, [84, 13]);
  await verify('three-native', created.doc, 3);
  await f.openFeatureEditor(2, 'Fixed span Linear pattern');
  await f.editor().getByRole('spinbutton', { name: 'Count', exact: true }).fill('4');
  const retargeted = await f.applyEditor(created.doc, 'four-retargeted');
  assert.deepEqual(retargeted.doc.nodes[3], { ...created.doc.nodes[3], face: 'n1.top@3' });
  await verify('four-native', retargeted.doc, 4);
  await f.undo();
  await f.same(created.doc);
  await f.redo();
  await f.same(retargeted.doc);

  f.phase = 'save and reopen the retargeted part from the browser project';
  const projectName = 'D1023 Fixed span', file = 'fixed-span-end.bcad';
  const project = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  async function connectProject() {
    await button('Project and versions').click();
    await project.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(projectName);
    await project.getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await project.getByLabel('Project', { exact: true }).waitFor();
  }
  await connectProject();
  await button('Save').click();
  await project.getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  const saved = await f.page.evaluate(async ([name, file]) => {
    const root = await navigator.storage.getDirectory();
    const folder = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(name);
    return JSON.parse(await (await (await folder.getFileHandle(file)).getFile()).text());
  }, [projectName, file]);
  assert.deepEqual(saved, retargeted.doc);
  await project.getByRole('button', { name: 'Close project', exact: true }).click();
  await project.getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await f.page.reload();
  await f.ready();
  await connectProject();
  await project.getByRole('button', { name: 'Open ' + file, exact: true }).click();
  await f.same(retargeted.doc);
  const reopened = await f.snapshot('four-reopened');
  assert.equal(reopened.dirty, false);
  await verify('reopened-native', reopened.doc, 4);
  assert.deepEqual(f.report.downloads, []);
});

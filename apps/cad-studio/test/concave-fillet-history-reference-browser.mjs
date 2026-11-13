import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/concave-fillet-history-reference-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/state/useHeldFinishEdge.ts',
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  'apps/cad-studio/src/viewport/ViewCube.tsx',
  'packages/barocss-cad-model/src/engine/references.ts',
];
const f = await createFlow({
  name: 'concave-fillet-history-reference', output: process.argv[2], envFrozen: 'D1003_SOURCE_FROZEN',
  qualification: 'Replace one missing Fillet edge with the picked concave corner in desktop Studio History.',
  limits: ['One terminal constant-radius Fillet on one planar L-shaped extrusion.'],
  initialFiles: pins, requiredFrozen: pins,
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const outputs = evaluateCadPart(toPartDocument(doc)).outputs;
if (outputs.length !== 1) throw Error('Expected one output');
const [body] = outputs;
console.log(JSON.stringify({ valid: checkOutput(body).valid, ...massPropertiesOf(body),
  faces: body.brep.faces.map(face => ({ name: face.name, ...faceGeometry(face) })) }));
`,
});
const oldEdge = 'n1.side6|n1.side7';
const corner = 'n1.side2|n1.side3';
const ref = node => ({ node, side: 'solid' });
const oldProfile = [[0, 20], [0, 4], [2, 2], [4, 2], [6, 0], [18, 0], [20, 2], [20, 20]];
const profile = [[0, 0], [20, 0], [20, 5], [5, 5], [5, 20], [0, 20]];
const model = points => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'polygon', points },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 3 },
    { id: 'n2', kind: 'fillet', parent: ref(1), edges: [oldEdge], radius: 2,
      sigs: { [oldEdge]: { k: 'line', p: [20, 20, 1.5], d: [0, 0, 1], s: 3 } } },
  ],
  outputs: { b2: ref(2) }, nextId: 3,
});
const button = (name, parent = f.page) => parent.getByRole('button', { name, exact: true });
const refs = () => f.page.getByRole('region', { name: 'References', exact: true });
const pick = async () => {
  const pixel = await f.page.evaluate(point => window.__studioScreenOf(point), [5, 5, 1.5]);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel));
  await f.page.mouse.click(...pixel);
  await f.editor().getByText(corner, { exact: true }).waitFor();
};
const initialVolume = 3 * (20 * 5 + 15 * 5);
const repairedVolume = initialVolume + 3 * (4 - Math.PI);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, actual + ' vs ' + expected);
async function open(name, doc) {
  f.phase = 'Open ' + name;
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.page.waitForFunction(name => document.querySelector('.doc-tab input')?.value === name, name);
  await f.ready();
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
  const old = model(oldProfile);
  await open('original-edge', old);
  await f.same(old);
  assert.equal(await refs().count(), 0);
  assert.ok((await f.inspect('original-native', old)).valid);

  await open('lost-edge', model(profile));
  await refs().waitFor();
  assert.match(await refs().textContent(), /0 matched again.*1 need a choice.*Feature held/);
  await refs().locator('summary').click();
  const choices = await refs().locator('details').textContent();
  assert.ok(choices.includes(oldEdge));
  assert.ok(choices.includes('Candidate 1: n1.side1|n1.side2'));
  assert.ok(choices.includes('Candidate 2: n1.side3|n1.side4'));
  const before = await f.snapshot('held-concave-stock');
  assert.deepEqual(before.doc.nodes[2].edges, [oldEdge]);
  assert.equal(before.doc.nodes[2].suppressed, true);
  near(before.bodies.bodies[0].volume, initialVolume);

  f.phase = 'stage the right-angle inner edge from the real viewport';
  await button('View cube directions').click();
  await f.page.getByRole('menuitem', { name: 'Back right', exact: true }).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.openFeatureEditor(2, 'held Fillet');
  await button('Replace edge', f.editor()).click();
  await pick();
  await f.same(before.doc);
  await f.snapshot('staged-concave-edge');
  await button('Cancel edge replacement', f.editor()).click();
  await f.same(before.doc);
  await button('Replace edge', f.editor()).click();
  await pick();
  await button('Apply edge replacement', f.editor()).click();
  await refs().waitFor({ state: 'hidden' });
  await f.ready();
  const accepted = await f.snapshot('applied-concave-fillet');
  const feature = accepted.doc.nodes[2];
  assert.equal(feature.id, 'n2');
  assert.equal(feature.radius, 2);
  assert.deepEqual(feature.edges, [corner]);
  assert.deepEqual(feature.sigs[corner].p, [5, 5, 1.5]);
  assert.equal(feature.suppressed, undefined);
  assert.equal(feature.held, undefined);
  near(accepted.bodies.bodies[0].volume, repairedVolume);
  const native = await f.inspect('concave-native', accepted.doc);
  assert.ok(native.valid);
  near(native.volume, repairedVolume);
  const cylinder = native.faces.find(face => face.name === 'n2.face');
  assert.equal(cylinder.kind, 'cylinder');
  near(cylinder.r, 2);
  near(cylinder.c[0], 7);
  near(cylinder.c[1], 7);
  near(Math.abs(cylinder.a[2]), 1);

  await f.undo();
  await f.same(before.doc);
  assert.equal(await refs().locator('details').textContent(), choices);
  assert.deepEqual((await f.bodies()).bodies, before.bodies.bodies);
  await f.redo();
  await f.same(accepted.doc);
  assert.equal(await refs().count(), 0);
  assert.deepEqual((await f.bodies()).bodies, accepted.bodies.bodies);
  f.phase = 'save and reopen the History replacement';
  const projectName = 'D1003 confirmed Fillet';
  const fileName = 'lost-edge.bcad';
  const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const openProject = async () => {
    await button('Project and versions').click();
    await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(projectName);
    await button('Project in this browser', versions).click();
    await versions.getByLabel('Project', { exact: true }).waitFor();
  };
  await openProject();
  await button('Save').click();
  await versions.locator('li[data-active="true"]').filter({ hasText: fileName }).waitFor();
  const saved = await f.page.evaluate(async ({ projectName, fileName }) => {
    const projects = await (await navigator.storage.getDirectory()).getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(projectName);
    return (await (await folder.getFileHandle(fileName)).getFile()).text();
  }, { projectName, fileName });
  assert.deepEqual(JSON.parse(saved), accepted.doc);
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await openProject();
  await button('Open ' + fileName, versions).click();
  await f.same(accepted.doc);
  assert.equal(await refs().count(), 0);
  near((await f.snapshot('confirmed-concave-reopen')).bodies.bodies[0].volume, repairedVolume);
  assert.deepEqual(f.report.downloads, []);
});

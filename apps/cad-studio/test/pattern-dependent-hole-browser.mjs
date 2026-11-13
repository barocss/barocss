import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/pattern-dependent-hole-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/app/patternHoleSpacing.ts',
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/app/editFields.ts',
  'packages/barocss-cad-model/src/engine/part.ts',
  'packages/barocss-cad/src/part/part-model.ts',
];
const f = await createFlow({
  name: 'pattern-dependent-hole', output: process.argv[2], envFrozen: 'D1018_SOURCE_FROZEN',
  qualification: 'Preserve the selected third linear-pattern top face and its local through-hole coordinates during a Spacing edit.',
  limits: ['One-body X Linear pattern with three separate rectangular pieces and a legacy terminal simple through Hole.'],
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
    { kind: 'linear-pattern', parent: ref(1), axis: 'x', spacing: 16, count: 3, id: 'n2' },
    { kind: 'hole', parent: ref(2), radius: 1, center: [84, 13], face: 'n1.top@2', id: 'n3' },
  ],
  outputs: { b3: ref(3) }, nextId: 4,
};
const atSpacing = (model, spacing, x) => ({ ...model, nodes: model.nodes.map((node, i) => i === 2 ? { ...node, spacing } : i === 3 ? { ...node, center: [x, 13] } : node) });
const button = name => f.page.getByRole('button', { name, exact: true });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} versus ${expected}`);

async function open(name, model) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(model)) });
  await f.same(model);
}

async function verify(label, model, x) {
  const native = await f.inspect(label, model);
  f.report.observations.push({ label, native });
  await f.persist();
  assert.equal(native.valid, true);
  assert.deepEqual(native.tops, [['n1.top', 1], ['n1.top@1', 1], ['n1.top@2', 2]]);
  assert.equal(native.walls.length, 2);
  for (const wall of native.walls) {
    assert.equal(wall.kind, 'cylinder');
    near(wall.c[0], x);
    near(wall.c[1], 13);
    near(wall.r, 1);
  }
  near(native.volume, 3 * 4 * 6 * 8 - 8 * Math.PI);
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
  await open('pattern-hole-legacy', doc);
  await verify('legacy-native', doc, 84);
  await f.snapshot('legacy-open');
  const spacing = () => f.editor().getByRole('spinbutton', { name: 'Spacing', exact: true });
  const apply = f.editor().getByRole('button', { name: 'Apply', exact: true });
  async function edit(previous, pitch, label) {
    await f.openFeatureEditor(2, 'Linear pattern');
    await spacing().fill(String(pitch));
    return f.applyEditor(previous, label);
  }
  const moved = await edit(doc, 16.25, 'spacing-edited');
  assert.equal(moved.doc.nodes[2].spacing, 16.25);
  assert.equal(moved.doc.nodes[3].face, 'n1.top@2');
  f.phase = 'verify the hole centre on the translated third copy';
  await verify('moved-native', moved.doc, 84.5);

  await f.undo();
  await f.same(doc);
  await f.redo();
  await f.same(moved.doc);
  await verify('redo-native', moved.doc, 84.5);
  await f.snapshot('spacing-redone');

  for (const [pitch, x] of [[16.5, 85], [32, 116]]) {
    const previous = await f.doc();
    const accepted = await edit(previous, pitch, 'spacing-' + pitch);
    if (pitch === 32) {
      await f.page.locator('.views').getByRole('button', { name: 'Top', exact: true }).click();
      await f.page.getByTitle('Frame all (F)', { exact: true }).click();
      await f.snapshot('wide-bore-framed');
    }
    assert.deepEqual(accepted.doc, atSpacing(doc, pitch, x));
    await verify('spacing-native-' + pitch, accepted.doc, x);
  }
  const wide = atSpacing(doc, 32, 116);

  f.phase = 'refuse spacing that merges the numbered copies';
  await f.openFeatureEditor(2, 'Linear pattern');
  await spacing().fill('4');
  await apply.click();
  await f.editor().getByText('Keep a gap between pattern copies', { exact: false }).waitFor();
  const refused = await f.snapshot('touching-copies-refused');
  assert.deepEqual(refused.doc, wide);
  await f.closeEditor();

  f.phase = 'save the translated bore to the browser project and reopen it';
  const projectName = 'D1018 Pattern Hole', file = 'pattern-hole-legacy.bcad';
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
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(name);
    return JSON.parse(await (await (await dir.getFileHandle(file)).getFile()).text());
  }, [projectName, file]);
  assert.deepEqual(saved, wide);
  await project.getByRole('button', { name: 'Close project', exact: true }).click();
  await project.getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await f.page.reload();
  await f.ready();
  await connectProject();
  await project.getByRole('button', { name: 'Open ' + file, exact: true }).click();
  await f.same(wide);
  await verify('reopened-native', wide, 116);
  await f.snapshot('reopened');

  f.phase = 'refuse a legacy bore that already cuts a different copy';
  const legacyWrong = atSpacing(doc, 32, 84);
  await open('legacy-wrong-copy', legacyWrong);
  await f.openFeatureEditor(2, 'Linear pattern');
  await spacing().fill('24');
  await apply.click();
  await f.editor().getByText('The existing Hole crosses or touches the selected copy boundary', { exact: false }).waitFor();
  const legacyRefused = await f.snapshot('wrong-copy-preserved');
  assert.deepEqual(legacyRefused.doc, legacyWrong);
  await f.closeEditor();

  f.phase = 'refuse expansion beyond the modelling coordinate range';
  const nearBoundary = {
    ...doc, nodes: [
      { ...doc.nodes[0], min: [-4000, 10], max: [-3996, 16] },
      doc.nodes[1], { ...doc.nodes[2], spacing: 6000 },
      { ...doc.nodes[3], face: 'n1.top@1', center: [2001.00000012, 13] },
    ],
  };
  await open('legacy-near-boundary', nearBoundary);
  await f.openFeatureEditor(2, 'Linear pattern');
  await spacing().fill('9010');
  await apply.click();
  await f.editor().getByText('Keep all pattern copies within the modelling coordinate range', { exact: false }).waitFor();
  const rangeRefused = await f.snapshot('coordinate-range-refused');
  assert.deepEqual(rangeRefused.doc, nearBoundary);
  await f.closeEditor();

  f.phase = 'refuse a near-tangent legacy bore before cutter rounding can change it';
  const nearTangent = {
    ...doc, nodes: [
      { ...doc.nodes[0], min: [1, 10], max: [5, 16] },
      doc.nodes[1], doc.nodes[2],
      { ...doc.nodes[3], center: [35, 11.00000009999981], radius: 0.9999999999998 },
    ],
  };
  await open('legacy-near-tangent', nearTangent);
  await f.openFeatureEditor(2, 'Linear pattern');
  await spacing().fill('2000');
  await apply.click();
  await f.editor().getByText('The existing Hole crosses or touches the selected copy boundary', { exact: false }).waitFor();
  const tangentRefused = await f.snapshot('near-tangent-refused');
  assert.deepEqual(tangentRefused.doc, nearTangent);
  assert.deepEqual(f.report.downloads, []);
});

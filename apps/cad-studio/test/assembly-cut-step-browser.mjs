import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const fixture = 'apps/cad-studio/test/fixtures/assembly-cut.bcad';
const pins = [
  fixture, 'apps/cad-studio/test/assembly-cut-step-browser.mjs',
  'apps/cad-studio/src/engine/stepMetadata.ts', 'apps/cad-studio/src/engine/client.ts', 'apps/cad-studio/src/engine/engine.worker.ts',
  'apps/cad-studio/src/files/useModelExports.ts', 'apps/cad-studio/src/files/stepExportPreparation.ts', 'apps/cad-studio/src/files/StepExportPanel.tsx',
  'packages/barocss-cad-model/src/engine/wireDoc.ts', 'packages/barocss-cad-model/src/engine/evaluate.ts',
];
const f = await createFlow({
  name: 'assembly-cut-step', output: process.argv[2], envFrozen: 'D1026_SOURCE_FROZEN',
  qualification: 'STEP carries only applied Assembly Cut geometry from the current Studio document.',
  limits: ['Two placed 60 × 40 × 5 mm plates, one rotated a quarter turn, with one applied Ø8 through cut, an unapplied Ø12 edit and an independent base body.'],
  initialFiles: pins, requiredFrozen: pins,
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { splitBodies } from '../../packages/barocss-cad/src/part/part-model';
import { importStep, checkBrep, brepMassProperties, faceGeometry } from '@barocss/cad';
const { step } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const imported = importStep(step);
console.log(JSON.stringify(splitBodies(imported).map(brep => ({
  valid: checkBrep(brep, { strict: true }).valid, volume: brepMassProperties(brep, 1).volume,
  z: [Math.min(...brep.vertices.map(v => v.point[2])), Math.max(...brep.vertices.map(v => v.point[2]))],
  innerLoops: brep.faces.filter(face => faceGeometry(face).kind === 'plane').reduce((sum, face) => sum + face.loops.length - 1, 0),
  cylinders: brep.faces.map(faceGeometry).filter(face => face.kind === 'cylinder'),
})).sort((a, b) => a.z[0] - b.z[0])));
`,
});
const button = (name, within = f.page) => within.getByRole('button', { name, exact: true });
const hud = () => f.page.getByRole('complementary', { name: 'Assembly cut', exact: true });
const pick = name => f.page.locator('.ol.instance:not(.nested)').filter({ hasText: name }).first().click();

async function exportStep(label, expected) {
  const panel = f.page.getByRole('region', { name: 'STEP export', exact: true });
  await button('Export STEP').click();
  await panel.getByText('STEP AP214 · B-rep geometry · mm', { exact: true }).waitFor();
  const state = await f.snapshot(label);
  assert.deepEqual(state.doc, expected);
  const index = await f.page.evaluate(() => window.__stepCaptures.length);
  await button('Export', panel).click();
  await f.page.waitForFunction(index => window.__stepCaptures.length === index + 1, index);
  const step = await f.page.evaluate(index => window.__stepCaptures[index].text(), index);
  const result = await f.inspect(label + '-reader', { step });
  f.report.observations.push({ label, sha256: sha256(step), result });
  await f.persist();
  return result;
}

function verify(result, applied) {
  assert.equal(result.length, 3);
  for (const [index, body] of result.entries()) {
    assert.equal(body.valid, true);
    assert.deepEqual(body.z, [[-4, 0], [0, 5], [5, 10]][index]);
    const expected = index === 0 ? 28800 : 12000 - (applied ? 80 * Math.PI : 0);
    assert.ok(Math.abs(body.volume - expected) < 1e-6, JSON.stringify({ index, actual: body.volume, expected }));
    assert.equal(body.innerLoops, index > 0 && applied ? 2 : 0);
    assert.equal(body.cylinders.length, index > 0 && applied ? 2 : 0);
    for (const face of body.cylinders) {
      assert.ok(Math.abs(face.r - 4) < 1e-7);
      assert.ok(Math.hypot(face.c[0] - 30, face.c[1] - 20) < 1e-7);
      assert.ok(Math.abs(Math.abs(face.a[2]) - 1) < 1e-9);
      assert.equal(face.out, -1);
    }
  }
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
    await context.addInitScript(() => {
      window.__stepCaptures = [];
      const create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click, blobs = new Map();
      URL.createObjectURL = function (blob) {
        const url = create.call(this, blob);
        if (blob.type === 'model/step') blobs.set(url, blob);
        return url;
      };
      HTMLAnchorElement.prototype.click = function () {
        const blob = blobs.get(this.href);
        if (!blob || !this.download.endsWith('.step')) return click.call(this);
        blobs.delete(this.href);
        window.__stepCaptures.push(blob);
      };
    });
    return context;
  };
  await f.newPage();
  const doc = JSON.parse(await readFile(join(f.repo, fixture), 'utf8'));
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'assembly-cut-output.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
  await f.page.waitForFunction(() => window.__studioInstanceBounds?.()?.length === 2);
  await button('Top', f.page.locator('.views')).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  async function createDraft() {
    await pick('Plate 1');
    await clickModelCommand(f.page, 'Modify', 'Assembly cut');
    await hud().waitFor();
    await hud().getByLabel('Radius mm', { exact: true }).fill('4');
    for (const [axis, value] of [['X', '30'], ['Y', '20'], ['Z', '10']]) {
      await hud().getByLabel('Centre ' + axis, { exact: true }).fill(value);
    }
    await pick('Plate 2');
    await button('Add selected', hud()).click();
    await button('Cut', hud()).waitFor();
  }
  const waitPreview = async (x, expected) => {
    await f.page.waitForFunction(([x, expected]) => window.__studioInstanceBounds?.()?.length === 2 &&
      !!window.__studioInstanceAt?.([x, 20, 10]) === expected, [x, expected]);
  };

  f.phase = 'export the stock plates and then an unapplied creation draft';
  verify(await exportStep('stock-step', doc), false);
  await createDraft();
  await waitPreview(30, false);
  verify(await exportStep('draft-step', doc), false);
  await button('Cut', hud()).click();
  await f.changed(doc);

  f.phase = 'export the applied Ø8 Assembly Cut';
  const applied = await f.doc();
  assert.equal(applied.assemblyCuts[0].profile.radius, 4);
  verify(await exportStep('applied-step', applied), true);
  f.phase = 'export Ø8 STEP while a visible Ø12 edit is pending';
  await waitPreview(35, true);
  await f.page.locator('button[aria-label^="Edit cut"]').first().click();
  const radius = hud().getByLabel('Radius mm', { exact: true });
  await radius.fill('6');
  await waitPreview(35, false);
  verify(await exportStep('edit-draft-step', applied), true);
  assert.equal(await radius.inputValue(), '6');
  await waitPreview(35, false);
  await button('Cancel', hud()).click();
  await waitPreview(35, true);
  verify(await exportStep('edit-cancelled-step', applied), true);

  f.phase = 'export after Undo and Redo';
  await f.undo();
  await f.same(doc);
  await waitPreview(30, true);
  verify(await exportStep('undo-step', doc), false);
  await f.redo();
  await f.same(applied);
  await waitPreview(30, false);
  verify(await exportStep('redo-step', applied), true);

  f.phase = 'reopen the saved applied cut and export again';
  const projectName = 'D1026 Assembly Cut', file = 'assembly-cut-output.bcad';
  const project = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  async function connectProject() {
    await button('Project and versions').click();
    await project.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(projectName);
    await button('Project in this browser', project).click();
    await project.getByLabel('Project', { exact: true }).waitFor();
  }
  await connectProject();
  await button('Save').click();
  await project.getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  await button('Close project', project).click();
  await project.getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await f.page.reload();
  await f.ready();
  await connectProject();
  await button('Open ' + file, project).click();
  await f.same(applied);
  verify(await exportStep('reopened-step', applied), true);
  assert.deepEqual(f.report.downloads, []);
});

// D727: independently authored cavity STEP through the real desktop Studio worker.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';
import { stepCavityFixture } from '../../../packages/barocss-cad/test/step-cavity-fixture.mjs';
import { inspectPlanarCavity } from '../../../packages/barocss-cad/test/step-cavity-oracle.mjs';

const [output, mode, legacyDirectory] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/step-cavity-orientation-browser.mjs',
  'apps/cad-studio/src/files/importedFile.ts',
  'apps/cad-studio/src/files/documentFile.ts',
  'apps/cad-studio/src/files/useStudioDocumentFiles.ts',
  'apps/cad-studio/src/storage/useProject.ts',
  'packages/barocss-cad/test/step-cavity-fixture.mjs',
  'packages/barocss-cad/test/step-cavity-oracle.mjs',
  'packages/barocss-cad/src/io/step-import.ts',
  'packages/barocss-cad/src/io/step.ts',
];
const f = await createFlow({
  name: 'step-cavity-orientation', output, envFrozen: 'D727_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce cavity import and export orientation errors independently' : 'Check analytic cavity orientation at the Studio boundaries',
  limits: ['Self-authored planar boxes. The Studio export probe observes the actual prepared STEP bytes without a browser download.'],
  inspectorSource: `
import { brepMassProperties, checkBrep, faceGeometry, importStep } from '@barocss/cad';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
const { step, name } = JSON.parse(process.argv[3]);
if (!step) {
  const sketch = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] });
  const box = withNode(sketch, { kind: 'extrude', sketch: 0, height: 10 });
  console.log(JSON.stringify(withNode(box, { kind: 'shell', parent: { node: 1, side: 'solid' }, thickness: 4, open: [] })));
} else {
  const doc = withNode(emptyDoc(), { kind: 'import', name, step });
  try {
    const brep = importStep(step);
    const mass = brepMassProperties(brep, 1);
    console.log(JSON.stringify({ doc, volume: mass.volume, centroid: mass.centroid, valid: checkBrep(brep, { strict:true }).valid,
      shells: brep.bodies[0].shells.map(id => brep.faces.filter(face => face.shell === id).map(face => ({
        name: face.name, normal: faceGeometry(face).n,
      }))) }));
  } catch (error) { console.log(JSON.stringify({ doc, code: error.code, message: error.message })); }
}
`,
});
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, JSON.stringify({ actual, expected }));

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
    await context.addInitScript(() => {
      const NativeWorker = window.Worker;
      const exports = window.__d727Exports = [];
      window.Worker = class extends NativeWorker {
        set onmessage(listener) {
          super.onmessage = listener ? event => {
            if (typeof event.data?.step?.text === 'string') exports.push(event.data.step.text);
            listener.call(this, event);
          } : null;
        }
        get onmessage() { return super.onmessage; }
      };
    });
    return context;
  };
  await f.newPage();
  let page = f.page;
  const button = name => page.getByRole('button', { name, exact: true });
  const open = async path => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles(path);
  };
  const write = async (file, bytes) => {
    const path = join(output, file);
    await writeFile(path, bytes);
    return path;
  };
  const opened = async step => {
    await f.waitToast(/STEP opened.*1 solid/);
    await page.waitForFunction(expected => window.__studioDoc.nodes[0]?.step === expected, step);
    await f.ready();
  };
  const preview = async () => {
    const previous = await page.evaluate(() => window.__d727Exports.length);
    await button('Export STEP').click();
    const panel = page.getByLabel('STEP export', { exact: true });
    await panel.getByLabel('STEP loss report', { exact: true }).waitFor();
    assert.equal(await panel.getByRole('button', { name: 'Export', exact: true }).isEnabled(), true);
    await page.waitForFunction(n => window.__d727Exports.length > n, previous);
    const bytes = await page.evaluate(n => window.__d727Exports[n], previous);
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
    return bytes;
  };

  f.phase = 'Open an independently authored STEP with one centred cavity';
  const centered = stepCavityFixture();
  const [oracle] = inspectPlanarCavity(centered.text);
  near(oracle.voids[0].base.volume, 8);
  near(oracle.voids[0].effective.volume, -8);
  near(oracle.volume, 992);
  const native = await f.inspect('centered-native', {}, { step: centered.text, name: 'centered' });
  assert.equal(native.valid, true);
  near(native.volume, baseline ? 1008 : 992);
  const bottom = native.shells[1].find(face => face.name === 'void-1-bottom');
  assert.deepEqual(bottom.normal.map(value => value || 0), [0, 0, baseline ? -1 : 1]);
  await open(await write('centered.step', centered.text));
  await opened(centered.text);
  const accepted = await f.snapshot('independent-centered-open');
  near(accepted.bodies.bodies[0].volume, baseline ? 1008 : 992);
  f.report.observations.push({ independentInput: sha256(centered.text), expected: 992, workerVolume: accepted.bodies.bodies[0].volume, native });
  await f.dismissToasts();

  f.phase = 'Prepare STEP from an independently modelled native hollow box';
  const design = await f.inspect('native-design', {}, {});
  await open(await write('native-design.bcad', JSON.stringify(design)));
  await f.same(design);
  const ready = await f.snapshot('native-cavity');
  near(ready.bodies.bodies[0].volume, 992);
  const generated = await preview();
  const [external] = inspectPlanarCavity(generated);
  near(external.voids[0].base.volume, baseline ? -8 : 8);
  near(external.voids[0].effective.volume, baseline ? 8 : -8);
  near(external.volume, baseline ? 1008 : 992);
  const emitted = await write(baseline ? 'legacy-writer.step' : 'verified-writer.step', generated);
  f.report.observations.push({ writerSha256: sha256(generated), independentWriter: external });
  const reopened = await f.inspect('prepared-reopen', {}, { step: generated, name: 'prepared' });
  near(reopened.volume, 992);
  if (baseline) {
    await write('legacy-import.bcad', JSON.stringify(reopened.doc));
    await open(emitted);
    await opened(generated);
    const cancelling = await f.snapshot('parent-self-round-trip');
    near(cancelling.bodies.bodies[0].volume, 992);
    return;
  }

  f.phase = 'Open the corrected Studio output and check a real section';
  await open(emitted);
  await opened(generated);
  await f.dismissToasts();
  await button('Section view').click();
  await page.getByRole('radiogroup', { name: 'Section mode', exact: true }).waitFor();
  await page.waitForFunction(() => {
    const section = window.__studioSection();
    return section.exact && Math.abs(section.volume - 496) < 1e-7;
  });
  await f.snapshot('corrected-step-section', () => ({ section: window.__studioSection() }));
  await button('Section view').click();

  f.phase = 'Verify asymmetric cavity mass, centroid and reference source';
  const offCenter = stepCavityFixture([[[2, 2, 2], [4, 4, 4]]]);
  const path = await write('off-center.step', offCenter.text);
  await open(path);
  await opened(offCenter.text);
  const beforeReference = await f.doc();
  await page.getByLabel('Add reference', { exact: true }).setInputFiles(path);
  await page.getByRole('listitem', { name: 'Reference ref1', exact: true }).getByText(/12 faces/).waitFor();
  const withReference = await f.doc();
  await f.undo();
  await f.same(beforeReference);
  await f.redo();
  await f.same(withReference);
  await page.getByRole('listitem', { name: 'Reference ref1', exact: true }).getByText(/12 faces/).waitFor();
  await page.locator('.ol-row').filter({ has: page.locator('button.ol-eye') }).locator('button.ol').first().click();
  const off = await f.snapshot('asymmetric-accepted-and-referenced');
  near(off.bodies.bodies[0].volume, 992);
  for (const coordinate of off.bodies.bodies[0].centroid) near(coordinate, 4976 / 992);
  assert.equal(off.doc.references.references[0].source.step, offCenter.text);
  assert.deepEqual(off.selection.selection.bodies, [0]);
  await f.dismissToasts();

  f.phase = 'Refuse an invalid void wrapper and preserve the accepted part';
  const bad = centered.text.replace("ORIENTED_CLOSED_SHELL('',*," + centered.inner[0] + ',.F.)', "ORIENTED_CLOSED_SHELL('',*," + centered.inner[0] + ',.T.)');
  assert.notEqual(bad, centered.text);
  await open(await write('wrong-void-wrapper.step', bad));
  await f.waitToast(/Could not open this file.*(ORIENTED_CLOSED_SHELL|void.*orientation)/i);
  const refused = await f.snapshot('bad-wrapper-refused');
  assert.deepEqual(refused.doc, off.doc);
  assert.deepEqual(refused.history, off.history);
  await f.dismissToasts();
  await page.getByLabel('Add reference', { exact: true }).setInputFiles(join(output, 'wrong-void-wrapper.step'));
  await f.waitToast(/Reference not changed.*ORIENTED_CLOSED_SHELL/i);
  assert.deepEqual(await f.doc(), off.doc);
  await f.dismissToasts();

  f.phase = 'Verify stored parent bytes are refused without replacing the accepted model';
  assert.ok(legacyDirectory, 'the parent browser run must supply exact legacy bytes');
  for (const file of ['legacy-writer.step', 'legacy-import.bcad']) {
    const bytes = await readFile(join(legacyDirectory, file));
    await open(await write(file, bytes));
    await f.waitToast(/Could not open this file.*(void|cavity).*orientation/i);
    const refused = await f.snapshot(file + '-refused');
    assert.deepEqual(refused.doc, off.doc);
    assert.deepEqual(refused.history, off.history);
    assert.deepEqual(refused.bodies.bodies, off.bodies.bodies);
    assert.deepEqual(refused.selection.selection, off.selection.selection);
    f.report.observations.push({ legacy: file, sha256: sha256(bytes) });
    await f.dismissToasts();
  }
  const legacy = await readFile(join(legacyDirectory, 'legacy-writer.step'), 'utf8');
  const legacyReference = { ...design, references: { version: 1, references: [{
    ...off.doc.references.references[0], name: 'Legacy reference', source: { step: legacy },
  }], datums: [], keepouts: [] } };
  await open(await write('legacy-reference.bcad', JSON.stringify(legacyReference)));
  await f.waitToast(/Could not open this file.*Legacy reference.*void.*orientation/i);
  await f.same(off.doc);
  await f.dismissToasts();

  f.phase = 'Reject an existing project file before switching the active document';
  const project = 'D727 STEP cavities';
  await page.evaluate(async ({ project, bytes }) => {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects', { create: true });
    const dir = await projects.getDirectoryHandle(project, { create: true });
    const writer = await (await dir.getFileHandle('legacy-project.bcad', { create: true })).createWritable();
    await writer.write(bytes);
    await writer.close();
  }, { project, bytes: JSON.stringify(legacyReference) });
  await button('Project and versions').click();
  const panel = page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await panel.getByRole('button', { name: 'Open legacy-project.bcad', exact: true }).click();
  await f.waitToast(/Could not open legacy-project.bcad.*Legacy reference.*void.*orientation/i);
  const stored = await f.snapshot('legacy-project-open-refused');
  assert.deepEqual(stored.doc, off.doc);
  assert.deepEqual(stored.history, off.history);
  assert.deepEqual(stored.selection.selection, off.selection.selection);
  assert.equal(await panel.locator('[aria-label="Project documents"] [data-active="true"]').count(), 0);
  await f.dismissToasts();

  f.phase = 'Save and reopen the corrected cavity and reference with exact source bytes';
  await button('Save').click();
  await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText('off-center.bcad', { exact: true }).waitFor();
  const saved = await page.evaluate(async projectName => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName);
    return (await (await dir.getFileHandle('off-center.bcad')).getFile()).text();
  }, project);
  assert.deepEqual(JSON.parse(saved), off.doc);
  const savedPath = await write('saved-cavity.bcad', saved);
  await f.newPage();
  page = f.page;
  await open(savedPath);
  await f.same(off.doc);
  await page.getByRole('listitem', { name: 'Reference ref1', exact: true }).getByText(/12 faces/).waitFor();
  const fresh = await f.snapshot('fresh-cavity-and-reference');
  near(fresh.bodies.bodies[0].volume, 992);
  assert.equal(fresh.doc.nodes[0].step, offCenter.text);
  assert.equal(fresh.doc.references.references[0].source.step, offCenter.text);
  f.report.observations.push({ savedSHA256: sha256(saved) });
  assert.deepEqual(f.report.downloads, []);
});

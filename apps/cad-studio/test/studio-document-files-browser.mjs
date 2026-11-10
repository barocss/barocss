// Run under the heavy gate from apps/cad-studio with D557_SOURCE_FROZEN=1.
import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const output = process.argv[2];
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));

const requiredFrozen = [
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/files/useStudioDocumentFiles.ts',
  'apps/cad-studio/src/files/documentFile.ts',
  'apps/cad-studio/src/files/importedFile.ts',
  'apps/cad-studio/src/storage/useProject.ts',
  'apps/cad-studio/test/reference-open-fixture.ts',
  'apps/cad-studio/test/studio-document-files-browser.mjs',
];
const f = await createFlow({
  name: 'studio-document-files', envFrozen: 'D557_SOURCE_FROZEN', output,
  qualification: 'D557 native Open and reference hold, import Cancel, and browser-project Save',
  initialFiles: requiredFrozen, requiredFrozen,
  inspectorSource: `import { referenceOpenFixtures } from './test/reference-open-fixture';
console.log(JSON.stringify(referenceOpenFixtures().lost));`,
  limits: [
    'One desktop WebGPU context. Public file chooser, dialog and project controls.',
    'One retained signed fixture and one cancel-only mesh import. Save targets browser project storage.',
  ],
});

const button = name => f.page.getByRole('button', { name, exact: true });
const dirty = () => f.page.locator('[aria-label="Unsaved changes"]');
const payload = (name, type, bytes) => ({ name, mimeType: type, buffer: Buffer.from(bytes) });

async function chooseFile(file) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(file);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.report.runtimeOwnership = { nodePID: process.pid, nodePPID: process.ppid, serverURL: origin };
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
      await context.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
        if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) return route.abort();
        return route.continue();
      });
      return context;
    } catch (error) {
      await context.close();
      throw error;
    }
  };

  f.phase = '01 native Open and verified held reference';
  const lost = await f.inspect('lost-reference-input', {});
  await f.newPage();
  await f.ready();
  await chooseFile(payload('Reference-held.bcad', 'application/json', JSON.stringify(lost)));
  await f.page.waitForFunction(() => window.__studioDoc?.nodes[4]?.held && window.__studioDoc.nodes[4].suppressed);
  await f.ready();
  const held = await f.snapshot('01-native-open');
  assert.equal(held.doc.nodes[4].suppressed, true);
  for (const side of ['a', 'b']) assert.deepEqual(held.doc.nodes[4][side].edges, lost.nodes[4][side].edges);
  assert.equal(held.bodies.bodies.length, 2);
  assert.match(await f.page.getByRole('region', { name: 'References', exact: true }).innerText(), /Feature held/);
  assert.equal(await dirty().isVisible(), true);

  f.phase = '02 reject malformed native input';
  await chooseFile(payload('Broken.bcad', 'application/json', '{'));
  await f.waitToast(/Could not open this file/);
  await f.same(held.doc);
  assert.equal(await dirty().isVisible(), true);
  await f.snapshot('02-malformed-refused');

  f.phase = '03 enter and cancel a mesh import';
  const triangle = [
    'solid witness', 'facet normal 0 0 1', 'outer loop', 'vertex 0 0 0', 'vertex 1 0 0',
    'vertex 0 1 0', 'endloop', 'endfacet', 'endsolid witness', '',
  ].join('\n');
  await chooseFile(payload('Triangle.stl', 'model/stl', triangle));
  const units = f.page.getByRole('dialog', { name: 'Mesh units', exact: true });
  await units.waitFor();
  await f.snapshot('03-mesh-units');
  await units.getByRole('button', { name: 'Cancel', exact: true }).click();
  await units.waitFor({ state: 'hidden' });
  await f.same(held.doc);
  assert.equal(await dirty().isVisible(), true);
  await f.snapshot('04-mesh-cancelled');

  f.phase = '04 save the exact document to the browser project';
  const projectName = 'D557-file-actions';
  await button('Project and versions').click();
  await f.page.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(projectName);
  await button('Project in this browser').click();
  await f.page.getByLabel('Project', { exact: true }).waitFor();
  await button('Save').click();
  await dirty().waitFor({ state: 'hidden' });
  const saved = await f.page.evaluate(async name => {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects');
    const project = await projects.getDirectoryHandle(name);
    const file = await (await project.getFileHandle('Reference-held.bcad')).getFile();
    return JSON.parse(await file.text());
  }, projectName);
  assert.deepEqual(saved, held.doc);
  await f.same(held.doc);
  await f.snapshot('05-project-saved');
  assert.deepEqual(f.report.downloads, []);
});

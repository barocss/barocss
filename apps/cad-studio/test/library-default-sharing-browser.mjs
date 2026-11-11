// D726: desktop Library panel and the real loopback team library endpoint.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createFlow, sha256 } from './flow-helper.mjs';

const [arg, mode] = process.argv.slice(2);
const output = resolve(arg), baseline = mode === '--baseline';
const repo = resolve(import.meta.dirname, '../../..');
const serverFile = join(output, 'chat-server.mjs');
const team = join(output, 'team');
const bundled = await build({
  entryPoints: ['apps/cad-studio/server/chatServer.ts'], absWorkingDir: repo, outfile: serverFile,
  bundle: true, platform: 'node', format: 'esm', target: 'node22', metafile: true, write: false,
});
const pins = [
  'apps/cad-studio/test/library-default-sharing-browser.mjs',
  'apps/cad-studio/src/ui/LibraryPanel.tsx',
  'apps/cad-studio/server/chatServer.ts',
  'packages/barocss-cad-model/src/library/sharing.ts',
  'packages/barocss-cad-model/src/library/libraries.ts',
];
const f = await createFlow({
  name: 'library-default-sharing', output, envFrozen: 'D726_SOURCE_FROZEN',
  initialFiles: [...pins, ...Object.keys(bundled.metafile.inputs)], requiredFrozen: pins,
  qualification: baseline ? 'Reproduce an invalid default sharing through Studio' : 'Validate default and named library configurations before sharing',
  limits: ['Locally authored libraries and a throwaway loopback team store. The driver makes no provider calls.'],
  inspectorSource: `
import { instantiateLibraryPart, loadCadLibrary } from '@barocss/cad';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { readFileSync } from 'node:fs';
const { library } = JSON.parse(process.argv[3]);
if (library) {
  const lib = loadCadLibrary(library);
  const read = (options) => {
    try {
      const x = instantiateLibraryPart(lib, 'spacer', options);
      return x.features.find(feature => feature.kind === 'extrude').height;
    } catch (error) { return { code: error.code, message: error.message }; }
  };
  console.log(JSON.stringify({ default: read({}), h8: read({ variant: 'h8' }), h12: read({ variant: 'h12' }) }));
} else {
  const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const result = evaluatePart(doc.instances?.[0]?.doc ?? doc, 1);
  if (!result.ok) throw new Error(result.error.detail);
  console.log(JSON.stringify(result.bodies.map(body => ({ volume: body.volume, bounds: body.mesh.bounds }))));
}
`,
});
await writeFile(serverFile, bundled.outputFiles[0].contents);
await mkdir(team);
const { createChatServer } = await import(pathToFileURL(serverFile).href);
const manifest = (id, h) => ({
  format: 'barocss-cad-library', version: 1, id, name: id, libraryVersion: '1.0.0', units: 'mm', license: 'CC0-1.0',
  parts: [{
    id: 'spacer', name: 'Spacer',
    parameters: { h: { value: h, min: 1, unit: 'mm', source: 'D726 test fixture' } },
    variants: [{ id: 'h8', values: { h: 8 } }, { id: 'h12', values: { h: 12 } }],
    recipe: [
      { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [2, 3] },
      { id: 'body', kind: 'extrude', sketch: 's', height: { expr: 'h' } },
    ],
    outputs: ['body'],
  }],
});
const good = manifest('d726-good', 8), bad = manifest('d726-bad', 0);
const payload = (name, value) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
const server = createServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const previousPort = process.env.CAD_STUDIO_CHAT_PORT;
process.env.CAD_STUDIO_CHAT_PORT = String(server.address().port);

try {
  await f.run(async () => {
    const origin = new URL(f.server.resolvedUrls.local[0]).origin;
    const handler = createChatServer({ mcpScript: 'unused', claude: join(output, 'no-provider'), workDir: join(output, 'chat-work'), teamLibraries: team, origins: [origin] });
    const libraryRequests = [];
    server.on('request', (request, response) => {
      if (request.url === '/api/chat/libraries') response.on('finish', () => libraryRequests.push({ method: request.method, status: response.statusCode }));
      void handler(request, response);
    });
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
    const badConfig = await f.inspect('bad-config', {}, { library: bad });
    assert.equal(badConfig.default.code, 'PARAMETER');
    assert.match(badConfig.default.message, /h.*0.*1/);
    assert.deepEqual([badConfig.h8, badConfig.h12], [8, 12]);

    await f.newPage();
    let page = f.page;
    const button = name => page.getByRole('button', { name, exact: true });
    const row = id => page.getByLabel('Library ' + id, { exact: true });
    const add = library => page.getByLabel('Library file', { exact: true }).setInputFiles(payload(library.id + '.json', library));
    const check = async id => JSON.parse(await readFile(join(team, id + '.check.json'), 'utf8'));
    const openLibrary = () => button('Library').click();
    const closeLibrary = () => button('Close library').click();
    const afterPost = async id => {
      const [response] = await Promise.all([
        page.waitForResponse(r => new URL(r.url()).pathname === '/api/chat/libraries' && r.request().method() === 'POST'),
        button('Share ' + id).click(),
      ]);
      assert.equal(response.status(), 200);
      await row(id).getByRole('button', { name: 'Share ' + id, exact: true }).waitFor({ state: 'hidden' });
    };
    const names = async () => (await readdir(team)).sort();

    f.phase = 'Share a valid library to the real team endpoint';
    await button('New part').click();
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
    await f.ready();
    await openLibrary();
    await add(good);
    await afterPost(good.id);
    const validCheck = await check(good.id);
    assert.deepEqual([validCheck.ok, validCheck.built, validCheck.fits], [true, baseline ? 2 : 3, 0]);
    const teamFiles = await names();
    const goodFiles = Object.fromEntries(await Promise.all(teamFiles.map(async name => [name, await readFile(join(team, name), 'utf8')])));
    const unchanged = await f.snapshot('valid-team-library');

    f.phase = 'Share a library with valid named variants and an invalid default';
    await add(bad);
    await row(bad.id).getByRole('button', { name: 'Share ' + bad.id, exact: true }).waitFor();
    assert.equal(await row(bad.id).getByLabel('Variant of spacer', { exact: true }).inputValue(), 'h8');
    if (baseline) {
      await afterPost(bad.id);
      const wrong = await check(bad.id);
      assert.deepEqual([wrong.ok, wrong.built, wrong.fits], [true, 2, 0]);
      assert.equal((await names()).length, 4);
      f.report.observations.push({ badConfig, validCheck, wronglyShared: wrong, requests: libraryRequests });
      await f.snapshot('parent-invalid-default-shared');
      return;
    }

    const posts = () => libraryRequests.filter(request => request.method === 'POST').length;
    const before = posts();
    await button('Share ' + bad.id).click();
    await f.waitToast(/Not shared.*spacer \(default\).*h.*0.*1/);
    const rejected = await f.snapshot('invalid-default-refused');
    assert.deepEqual(rejected.doc, unchanged.doc);
    assert.deepEqual(rejected.history, unchanged.history);
    assert.deepEqual(await names(), teamFiles);
    assert.equal(posts(), before);

    f.phase = 'Confirm the server independently refuses replacement and preserves both files';
    const serverReply = await fetch(origin + '/api/chat/libraries', {
      method: 'POST', headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ library: { ...bad, id: good.id } }),
    });
    assert.equal(serverReply.status, 422);
    const rejectedCheck = await serverReply.json();
    assert.match(rejectedCheck.error, /spacer \(default\)/);
    assert.equal(rejectedCheck.check.built, 2);
    assert.deepEqual(await names(), teamFiles);
    for (const name of teamFiles) assert.equal(await readFile(join(team, name), 'utf8'), goodFiles[name]);
    f.report.observations.push({ badConfig, validCheck, rejectedCheck, requests: libraryRequests });
    await f.dismissToasts();

    f.phase = 'Insert the still-available named variant and place another from the valid library';
    await row(bad.id).getByRole('button', { name: 'Insert spacer', exact: true }).click();
    await f.changed(rejected.doc);
    const inserted = await f.snapshot('named-h8-inserted');
    assert.deepEqual([inserted.doc.nodes[0].library.library, inserted.doc.nodes[0].library.variant, inserted.doc.nodes[0].library.values.h], [bad.id, 'h8', 8]);
    assert.ok(Math.abs(inserted.bodies.bodies[0].volume - 48) < 1e-8);
    await f.undo();
    await f.same(rejected.doc);
    await f.redo();
    await f.same(inserted.doc);

    await row(good.id).getByLabel('Variant of spacer', { exact: true }).selectOption('h12');
    await row(good.id).getByRole('button', { name: 'Place spacer', exact: true }).click();
    await f.changed(inserted.doc);
    const placed = await f.snapshot('named-h12-placed');
    assert.deepEqual([placed.doc.instances[0].doc.nodes[0].library.library, placed.doc.instances[0].doc.nodes[0].library.variant, placed.doc.instances[0].doc.nodes[0].library.values.h], [good.id, 'h12', 12]);
    const readPlaced = async (label, doc) => {
      await page.waitForFunction(() => window.__studioInstanceBounds?.().some(bounds => bounds.id === 'p1' && bounds.min && bounds.max));
      const actual = await page.evaluate(() => window.__studioInstanceBounds().find(bounds => bounds.id === 'p1'));
      assert.deepEqual([actual.min, actual.max], [[0, 0, 0], [2, 3, 12]]);
      const [body] = await f.inspect(label, doc, {});
      assert.ok(Math.abs(body.volume - 72) < 1e-8);
      assert.deepEqual(body.bounds, { min: [0, 0, 0], max: [2, 3, 12] });
      return body;
    };
    await readPlaced('placed-physical', placed.doc);
    await f.undo();
    await f.same(inserted.doc);
    await f.redo();
    await f.same(placed.doc);

    f.phase = 'Save and reopen the placed variant without relying on the picker';
    await closeLibrary();
    await page.locator('.doc-tab input').fill('library-default-study');
    const project = 'D726 library sharing', savedName = 'library-default-study.bcad';
    await button('Project and versions').click();
    const panel = page.getByRole('complementary', { name: 'Versions panel', exact: true });
    await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await button('Save').click();
    await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText(savedName, { exact: true }).waitFor();
    const native = await page.evaluate(async ({ project, savedName }) => {
      const root = await navigator.storage.getDirectory();
      const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
      return (await (await dir.getFileHandle(savedName)).getFile()).text();
    }, { project, savedName });
    assert.deepEqual(JSON.parse(native), placed.doc);
    const file = join(output, savedName);
    await writeFile(file, native);
    await f.newPage();
    page = f.page;
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles(file);
    await f.same(placed.doc);
    await readPlaced('reopened-physical', placed.doc);
    await f.snapshot('fresh-open-named-variants');
    assert.deepEqual(f.report.downloads, []);
    f.report.observations.push({ nativeSHA256: sha256(native) });
  });
} finally {
  await new Promise((done, fail) => server.close(error => error ? fail(error) : done()));
  if (previousPort === undefined) delete process.env.CAD_STUDIO_CHAT_PORT;
  else process.env.CAD_STUDIO_CHAT_PORT = previousPort;
}

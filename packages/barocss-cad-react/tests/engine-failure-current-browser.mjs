// D528/R08. Root runs serially with all source writers frozen. No paid model, dependency install, remote call or download.
// D528_SOURCE_FROZEN=1 node packages/barocss-cad-react/tests/engine-failure-current-browser.mjs /ABS/NEW/OUT --expect=repro|fixed
import assert from 'node:assert/strict';
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {isAbsolute, join, relative, resolve} from 'node:path';
import {createServer as createHttpServer} from 'node:http';
import {build} from '../../../node_modules/vite/dist/node/index.js';
import {createFlow} from '../../../apps/cad-studio/test/flow-helper.mjs';
import {installD528NativeWorkerObserver} from './native-worker-failure-observer.mjs';

const repo = resolve(import.meta.dirname, '../../..'), output = process.argv[2];
const expectation = process.argv.find(arg => arg.startsWith('--expect='))?.split('=')[1] ?? 'fixed';
assert.ok(['repro', 'fixed'].includes(expectation)); assert.ok(output && isAbsolute(output));
assert.ok(relative(repo, resolve(output)).startsWith('../')); await mkdir(output);
const frozen = ['pnpm-lock.yaml'];
for (const name of ['barocss-cad', 'barocss-cad-model', 'barocss-cad-react', 'barocss-viewer', 'barocss-gpu']) {
  const directory = `packages/${name}/src`;
  for (const file of await readdir(join(repo, directory), {recursive: true})) if (/\.(ts|tsx|js|css|json)$/.test(file)) frozen.push(`${directory}/${file}`);
}
for (const file of await readdir(join(repo, 'packages/barocss-cad-react/examples'), {recursive: true})) if (/\.(ts|tsx|css)$/.test(file)) frozen.push(`packages/barocss-cad-react/examples/${file}`);
const ownFiles = ['engine-failure-current-browser.mjs', 'engine-failure-studio-fixture.tsx', 'native-worker-failure-observer.mjs'].map(file => `packages/barocss-cad-react/tests/${file}`);
const f = await createFlow({name: 'engine-failure-current', envFrozen: 'D528_SOURCE_FROZEN', output,
  qualification: `D528/R08 ${expectation === 'repro' ? 'settled native Worker failure baseline reproduction' : 'settled failure, caller-owned Retry, unchanged declaration and returned Doc Studio Open'}`,
  initialFiles: ownFiles, extraFrozen: frozen,
  requiredFrozen: ['packages/barocss-cad-react/src/model-host.ts', 'packages/barocss-cad-react/src/adapter.ts', 'packages/barocss-cad-react/examples/ProfileApp.tsx', 'apps/cad-studio/src/engine/client.ts'],
  limits: ['Desktop 1440x900 only; root must view original screenshots.', 'One canonical segmented Profile radius 6 then nondefault 8, actual EngineClient and existing Viewer facade.',
    'Fault is an explicit malformed protocol request to the owned real Worker, not an organic runtime failure.', 'No fake error callbacks, status, engine results, renderer or document actions.',
    'Old visible frame is retained but stale after failure; it has no current evaluation authority.', 'Retry false/throw, startup, unmount races and public API breadth require controlled tests.',
    'Returned Doc Open is a current consumer smoke; no new physical oracle or general CAD readiness claim.'],
});
f.report.expectation = expectation;
let packageServer;
const labels = new Set();
const raw = async label => {
  assert.ok(!labels.has(label)); labels.add(label);
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const state = await f.page.evaluate(label => ({label, observation: window.d528Profiles.read(), worker: window.__d528Worker.snapshot(),
    statusText: document.querySelector('[aria-label="Model status"]')?.textContent, alerts: [...document.querySelectorAll('[role="alert"]')].map(node => node.textContent),
    radius: document.querySelector('input[aria-label="Profile Radius"]')?.value, dom: document.body.innerText}), label);
  f.report.states.push(state); await writeFile(join(output, `${label}.json`), JSON.stringify(state, null, 2));
  await f.page.screenshot({path: join(output, `${label}.png`)}); await f.persist(); return state;
};
const ready = async radius => {
  await f.page.waitForFunction(radius => {
    const host = window.d528Profiles.read().host;
    return host?.status === 'ready' && host.native?.deferred === false && host.adapter?.freshNative && host.viewer?.frameOwner?.evaluationRevision === host.nativeOwner?.evaluationRevision
      && host.viewer?.pixels?.nonBackgroundPixels > 100 && document.querySelector('input[aria-label="Profile Radius"]')?.value === String(radius);
  }, radius, {timeout: 90000});
  await f.page.getByRole('status', {name: 'Model status', exact: true}).filter({hasText: 'Ready'}).waitFor();
};
await f.run(async () => {
  try {
    const packageRoot = join(repo, 'packages/barocss-cad-react/tests');
    const staticRoot = join(output, 'package-static');
    // Production bundling preserves real product/Worker imports while removing Vite's dev-only WebSocket client.
    await build({configFile: false, root: packageRoot, cacheDir: join(output, 'package-vite-cache'),
      plugins: [{name: 'd528-existing-installed-workspace', async resolveId(id, importer) {
        if (id === '@barocss/viewer') return join(repo, 'packages/barocss-viewer/src/index.ts');
        if (id.startsWith('@barocss/cad-model/')) return join(repo, `packages/barocss-cad-model/src/${id.slice('@barocss/cad-model/'.length)}.ts`);
        if (importer && /^(react(?:-dom)?(?:\/|$)|@barocss\/)/.test(id)) return this.resolve(id, join(repo, 'apps/cad-studio/src/main.tsx'), {skipSelf: true});
      }}], resolve: {alias: [{find: /^@\//, replacement: join(repo, 'apps/cad-studio/src/')}], dedupe: ['react', 'react-dom']},
      worker: {format: 'es', rolldownOptions: {output: {entryFileNames: 'assets/engine.worker-[hash].js'}}},
      build: {outDir: staticRoot, emptyOutDir: false, manifest: true, minify: false, sourcemap: true,
        rolldownOptions: {input: join(packageRoot, 'engine-failure-studio-fixture.tsx')}}});
    const manifest = JSON.parse(await readFile(join(staticRoot, '.vite/manifest.json'), 'utf8'));
    const entry = Object.values(manifest).find(entry => entry.isEntry); assert.ok(entry?.file);
    const html = `<div id="root"></div>${(entry.css ?? []).map(file => `<link rel="stylesheet" href="/${file}">`).join('')}<script type="module" src="/${entry.file}"></script>`;
    f.report.packageRuntime = {mode: 'Vite production bundle, original fixture/product/Worker source', minify: false, staticRoot, entry,
      devWebSocketClient: 'ABSENT_BY_PRODUCTION_BUILD', consoleErrorHandling: 'All unknown errors still fail; no dev client stub or console suppression'};
    const httpServer = createHttpServer((request, response) => {
      void (async () => {
        const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
        if (pathname === '/__d528') { response.setHeader('content-type', 'text/html'); response.end(html); return; }
        if (pathname === '/favicon.ico') { response.statusCode = 204; response.end(); return; }
        const file = resolve(staticRoot, `.${pathname}`);
        if (!file.startsWith(`${staticRoot}/`)) { response.statusCode = 403; response.end(); return; }
        const bytes = await readFile(file);
        response.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') || file.endsWith('.map') ? 'application/json' : 'application/octet-stream');
        response.end(bytes);
      })().catch(error => { response.statusCode = error.code === 'ENOENT' ? 404 : 500; response.end(String(error)); });
    });
    packageServer = {close: () => new Promise((resolve, reject) => httpServer.close(error => error ? reject(error) : resolve()))};
    await new Promise((resolve, reject) => { httpServer.once('error', reject); httpServer.listen(0, '127.0.0.1', resolve); });
    await f.newPage(); await f.page.setViewportSize({width: 1440, height: 900});
    await f.context.addInitScript(installD528NativeWorkerObserver);
    const url = `http://127.0.0.1:${httpServer.address().port}/`;
    f.phase = 'canonical existing ProfileApp radius6 then public nondefault radius8';
    await f.page.goto(`${url}__d528`); await ready(6); const initial = await raw('01-radius6-ready');
    await f.page.getByRole('spinbutton', {name: 'Profile Radius', exact: true}).fill('8'); await ready(8);
    const before = await raw('02-radius8-ready-before-native-fault');
    assert.notEqual(before.observation.host.documentJSON, initial.observation.host.documentJSON);
    assert.ok(before.observation.host.requests > initial.observation.host.requests);
    assert.equal(before.observation.host.adapter.phase, 'evaluated');

    f.phase = 'one invalid wire message to settled owned native Worker';
    await f.page.evaluate(() => window.__d528Worker.injectInvalidWire());
    await f.page.waitForFunction(() => window.d528Profiles.read().host?.adapter?.phase === 'failed', null, {timeout: 15000});
    await f.page.waitForFunction(() => window.__d528Worker.snapshot().events.some(event => event.kind === 'native-error-event' && event.message.includes('-52500001')));
    if (expectation === 'repro') await f.page.getByRole('status', {name: 'Model status', exact: true}).filter({hasText: 'Updating'}).waitFor();
    else await f.page.getByRole('status', {name: 'Model status', exact: true}).filter({hasText: 'Error'}).waitFor();
    const failed = await raw('03-settled-native-worker-failure'); const host = failed.observation.host;
    assert.equal(host.requests, before.observation.host.requests, 'No model submission is required to reveal settled failure');
    assert.equal(host.documentJSON, before.observation.host.documentJSON); assert.equal(host.adapter.freshNative, false);
    assert.equal(host.native, null); assert.equal(host.viewer.pixels.sha256, before.observation.host.viewer.pixels.sha256);
    assert.equal(failed.observation.failures.length, 1); assert.equal(failed.observation.retries.length, 0);
    f.report.retainedFrame = {visible: true, authority: 'STALE_PRE_FAILURE_FRAME_ONLY'};
    const expectedErrors = f.report.errors.filter(message => message.includes('engine worker: node -52500001 was never sent'));
    f.report.expectedNativeProtocolErrors = expectedErrors; f.report.errors = f.report.errors.filter(message => !expectedErrors.includes(message));
    const expectedConsole = f.report.consoleErrors.filter(message => message.includes('engine worker: node -52500001 was never sent'));
    f.report.expectedNativeProtocolConsoleErrors = expectedConsole; f.report.consoleErrors = f.report.consoleErrors.filter(message => !expectedConsole.includes(message));
    if (expectation === 'repro') {
      assert.equal(host.status, 'pending'); assert.equal(host.error, null); assert.equal(failed.statusText, 'Updating');
      f.report.observations.push({label: 'BASELINE_REPRODUCED_PRODUCT_FAIL', settledFailureFeedback: 'FAIL'}); return;
    }
    assert.equal(host.status, 'failed'); assert.match(host.error, /engine|worker/i); assert.ok(failed.alerts.some(text => /engine|worker/i.test(text)));
    f.phase = 'private example Retry invokes caller-owned restart and same-declaration rerender';
    await f.page.getByRole('button', {name: 'Retry', exact: true}).click(); await ready(8);
    const recovered = await raw('04-retry-nondefault-radius8-ready');
    assert.equal(recovered.observation.retries.length, 1); assert.equal(recovered.observation.retries[0].result, true);
    assert.equal(recovered.observation.host.documentJSON, before.observation.host.documentJSON);
    assert.ok(recovered.observation.host.requests > before.observation.host.requests);
    assert.ok(recovered.worker.workers.filter(worker => worker.relevant).length >= 2);
    assert.equal(recovered.observation.host.viewer.facade, '@barocss/viewer');
    assert.equal(recovered.observation.host.viewer.pixels.sha256, before.observation.host.viewer.pixels.sha256, 'Unchanged declaration returns the same bounded actual frame');
    const returnedDoc = JSON.parse(recovered.observation.host.documentJSON), file = join(output, 'returned-recovered-radius8.bcad');
    await writeFile(file, JSON.stringify(returnedDoc));
    f.phase = 'public Studio Open and Frame of actual recovered returned document';
    await f.newPage(); await f.page.setViewportSize({width: 1440, height: 900});
    await f.openFile(file, returnedDoc.nodes.length); await f.same(returnedDoc); await f.snapshot('05-returned-doc-studio-open');
    await f.page.locator('button[title="Frame all (F)"]').click(); await f.ready(); const studio = await f.snapshot('06-returned-doc-studio-frame');
    assert.equal(studio.bodies.bodies.length, 1); assert.equal(studio.bodies.massReady, true);
    assert.deepEqual(studio.doc, returnedDoc); f.report.returnedStudioConsumer = {exactDoc: true, bodyCount: 1, physicalAuthority: 'No new physical certificate'};
    assert.deepEqual(f.report.downloads, []);
  } catch (error) {
    if (f.page && !f.page.isClosed() && await f.page.evaluate(() => !!window.d528Profiles)) await raw('failure-package-current');
    throw error;
  } finally {
    if (packageServer) { await packageServer.close(); f.report.cleanup.push('OWN_PACKAGE_STATIC_HTTP_CLOSED'); }
  }
});

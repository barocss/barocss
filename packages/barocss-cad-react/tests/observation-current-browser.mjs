// D529/R09. Deliberate consumer mutation of returned public observations; no internal state or geometry injection.
// D529_SOURCE_FROZEN=1 node packages/barocss-cad-react/tests/observation-current-browser.mjs /ABS/NEW/OUT --expect=repro|fixed
import assert from 'node:assert/strict';
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {isAbsolute, join, relative, resolve} from 'node:path';
import {createServer as createHttpServer} from 'node:http';
import {build} from '../../../node_modules/vite/dist/node/index.js';
import {createFlow} from '../../../apps/cad-studio/test/flow-helper.mjs';

import {propsOracle, qualifyProfileProps} from './profile-props-roundtrip.mjs';

const propsRoundtrip = process.argv.includes('--props-roundtrip');
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
const f = await createFlow({name: 'observation-current', envFrozen: propsRoundtrip ? 'D775_SOURCE_FROZEN' : 'D529_SOURCE_FROZEN', output,
  qualification: propsRoundtrip ? 'B10-06 current React props, Viewer frames and returned Doc edit' : `D529/R09 ${expectation === 'repro' ? 'public observation alias baseline reproduction' : 'public owned observation isolation and subsequent native declaration/Studio consumer'}`,
  initialFiles: ['packages/barocss-cad-react/tests/observation-current-browser.mjs', 'packages/barocss-cad-react/tests/observation-studio-fixture.tsx', 'packages/barocss-cad-react/tests/profile-props-roundtrip.mjs'], extraFrozen: frozen,
  requiredFrozen: ['packages/barocss-cad-react/src/model-host.ts', 'packages/barocss-cad-react/src/adapter.ts', 'packages/barocss-cad-react/src/viewer.ts'],
  oracleSource: propsRoundtrip ? propsOracle : undefined,
  limits: propsRoundtrip ? ['One ProfileApp with a rectangular outer loop and circular void. Exact A/B/A Viewer frames and an extrusion edit in desktop Studio.'] :
    ['Desktop 1440x900 only; root must view original screenshots.', 'Actual EngineClient, existing Viewer and ProfileApp radius6 then8; only public read() result fields are deliberately mutated.',
    'Deliberate consumer observation mutation is not an organic user bug or a claim that GPU pixels changed.', 'Existing shared immutable Owner identities are checked/frozen, never mutated.',
    'Fixed tail public radius10 reaches a true current native frame, followed by returned Doc Studio Open/Frame.', 'No numerical/physical certificate, renderer replacement, Save/export, Worker fault or download.'],
});
f.report.expectation = expectation; let packageServer;
const labels = new Set();
const raw = async label => {
  assert.ok(!labels.has(label)); labels.add(label);
  await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const state = await f.page.evaluate(label => ({label, observation: window.d529Profiles.read(), statusText: document.querySelector('[aria-label="Model status"]')?.textContent,
    radius: document.querySelector('input[aria-label="Profile Radius"]')?.value, dom: document.body.innerText}), label);
  f.report.states.push(state); await writeFile(join(output, `${label}.json`), JSON.stringify(state, null, 2));
  await f.page.screenshot({path: join(output, `${label}.png`)}); await f.persist(); return state;
};
const ready = async (radius, previous = -1) => {
  await f.page.waitForFunction(([radius, previous]) => {
    const host = window.d529Profiles.read().host;
    return host?.status === 'ready' && host.native?.deferred === false && host.adapter?.freshNative
      && host.viewer?.frameOwner?.evaluationRevision === host.nativeOwner?.evaluationRevision && host.viewer?.pixels?.nonBackgroundPixels > 100
      && host.nativeOwner?.evaluationRevision > previous
      && document.querySelector('input[aria-label="Profile Radius"]')?.value === String(radius);
  }, [radius, previous], {timeout: 90000});
  await f.page.getByRole('status', {name: 'Model status', exact: true}).filter({hasText: 'Ready'}).waitFor();
};
const value = (host, field) => ({
  document: host.documentJSON, 'submitted-list': host.submitted.length, 'submitted-entry': host.submitted[0].fingerprint,
  'native-centroid': host.native.centroid[0], 'native-bounds-min': host.native.bounds.min[0], 'native-bounds-max': host.native.bounds.max[0],
  'adapter-phase': host.adapter.phase, 'adapter-fresh': host.adapter.freshNative, 'viewer-pixels': host.viewer.pixels.sha256,
})[field];
await f.run(async () => {
  try {
    const packageRoot = join(repo, 'packages/barocss-cad-react/tests'), staticRoot = join(output, 'package-static');
    await build({configFile: false, root: packageRoot, cacheDir: join(output, 'package-vite-cache'),
      plugins: [{name: 'd529-existing-installed-workspace', async resolveId(id, importer) {
        if (id === '@barocss/viewer') return join(repo, 'packages/barocss-viewer/src/index.ts');
        if (id.startsWith('@barocss/cad-model/')) return join(repo, `packages/barocss-cad-model/src/${id.slice('@barocss/cad-model/'.length)}.ts`);
        if (importer && /^(react(?:-dom)?(?:\/|$)|@barocss\/)/.test(id)) return this.resolve(id, join(repo, 'apps/cad-studio/src/main.tsx'), {skipSelf: true});
      }}], resolve: {alias: [{find: /^@\//, replacement: join(repo, 'apps/cad-studio/src/')}], dedupe: ['react', 'react-dom']},
      worker: {format: 'es', rolldownOptions: {output: {entryFileNames: 'assets/engine.worker-[hash].js'}}},
      build: {outDir: staticRoot, emptyOutDir: false, manifest: true, minify: false, sourcemap: true, rolldownOptions: {input: join(packageRoot, 'observation-studio-fixture.tsx')}}});
    const manifest = JSON.parse(await readFile(join(staticRoot, '.vite/manifest.json'), 'utf8')), entry = Object.values(manifest).find(entry => entry.isEntry); assert.ok(entry?.file);
    const html = `<div id="root"></div>${(entry.css ?? []).map(file => `<link rel="stylesheet" href="/${file}">`).join('')}<script type="module" src="/${entry.file}"></script>`;
    f.report.packageRuntime = {mode: 'Actual Vite production bundle and owned static HTTP; no HMR client', entry, staticRoot};
    const httpServer = createHttpServer((request, response) => {
      void (async () => {
        const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
        if (pathname === '/__d529') { response.setHeader('content-type', 'text/html'); response.end(html); return; }
        if (pathname === '/favicon.ico') { response.statusCode = 204; response.end(); return; }
        const file = resolve(staticRoot, `.${pathname}`); if (!file.startsWith(`${staticRoot}/`)) { response.statusCode = 403; response.end(); return; }
        response.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') || file.endsWith('.map') ? 'application/json' : 'application/octet-stream');
        response.end(await readFile(file));
      })().catch(error => { response.statusCode = error.code === 'ENOENT' ? 404 : 500; response.end(String(error)); });
    });
    packageServer = {close: () => new Promise((resolve, reject) => httpServer.close(error => error ? reject(error) : resolve()))};
    await new Promise((resolve, reject) => { httpServer.once('error', reject); httpServer.listen(0, '127.0.0.1', resolve); });
    const packageOrigin = 'http://127.0.0.1:' + httpServer.address().port;
    const studioOrigin = new URL(f.server.resolvedUrls.local[0]).origin;
    const newContext = f.browser.newContext.bind(f.browser);
    f.browser.newContext = async options => {
      const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
        return [packageOrigin, studioOrigin].includes(url.origin) ? route.continue() : route.abort();
      });
      return context;
    };
    await f.newPage(); await f.page.setViewportSize({width: 1440, height: 900});
    const workers = [];
    f.page.on('worker', worker => workers.push(worker.url()));
    await f.page.goto(packageOrigin + '/__d529');
    if (propsRoundtrip) { await qualifyProfileProps(f, ready, raw, workers); return; }
    f.phase = 'actual existing ProfileApp radius6 then public nondefault radius8';
    await ready(6); await raw('01-radius6-ready');
    await f.page.getByRole('spinbutton', {name: 'Profile Radius', exact: true}).fill('8'); await ready(8);
    const before = await raw('02-radius8-accepted-before-consumer-mutations');
    const accepted = JSON.parse(before.observation.host.documentJSON);
    await writeFile(join(output, 'accepted-radius8-BEFORE-mutations.bcad'), JSON.stringify(accepted));
    assert.ok(before.observation.ownerFacts.nativeOwnerFrozen && before.observation.ownerFacts.nativeOwnerShared);
    assert.ok(before.observation.ownerFacts.renderedOwnerFrozen && before.observation.ownerFacts.renderedOwnerShared);
    f.phase = 'separate deliberate mutations of fresh original PUBLIC host.read results';
    const fields = ['document', 'submitted-list', 'submitted-entry', 'native-centroid', 'native-bounds-min', 'native-bounds-max', 'adapter-phase', 'adapter-fresh', 'viewer-pixels'];
    const traces = [];
    for (const field of fields) {
      const trace = await f.page.evaluate(field => window.d529Profiles.mutateRead(field), field); traces.push(trace);
      await writeFile(join(output, `mutation-${field}.json`), JSON.stringify(trace, null, 2));
      assert.equal(trace.after.fingerprint, trace.before.fingerprint, 'Observation consumer must not submit a new model fingerprint');
      assert.equal(trace.after.requests, trace.before.requests, 'Observation mutation must not trigger an engine request');
      if (expectation === 'repro') assert.notDeepEqual(value(trace.after, field), value(trace.before, field), `${field}: baseline alias must actually corrupt a subsequent public observation`);
      else assert.deepEqual(value(trace.after, field), value(trace.before, field), `${field}: returned owned fields must be isolated`);
      assert.ok(trace.ownerFacts.nativeOwnerFrozen && trace.ownerFacts.nativeOwnerShared);
    }
    const after = await raw('03-after-deliberate-consumer-observation-mutations');
    f.report.mutationEvidence = {classification: 'DELIBERATE_CONSUMER_OBSERVATION_MUTATION', fields, traceCount: traces.length,
      result: expectation === 'repro' ? 'BASELINE_REPRODUCED_PRODUCT_FAIL' : 'OWNED_FIELDS_ISOLATED'};
    if (expectation === 'repro') {
      assert.notEqual(after.observation.host.documentJSON, before.observation.host.documentJSON);
      assert.equal(after.observation.host.fingerprint, before.observation.host.fingerprint); return;
    }
    assert.equal(after.observation.host.documentJSON, before.observation.host.documentJSON);
    assert.equal(after.observation.host.status, 'ready'); assert.deepEqual(after.observation.host.native, before.observation.host.native);
    assert.deepEqual(after.observation.host.viewer, before.observation.host.viewer);

    f.phase = 'public radius10 edit reaches a new real native frame after isolated observations';
    await f.page.getByRole('spinbutton', {name: 'Profile Radius', exact: true}).fill('10'); await ready(10);
    const current = await raw('04-radius10-current-native-frame');
    assert.ok(current.observation.host.requests > before.observation.host.requests);
    assert.notEqual(current.observation.host.documentJSON, before.observation.host.documentJSON);
    assert.notEqual(current.observation.host.viewer.pixels.sha256, before.observation.host.viewer.pixels.sha256);
    const returnedDoc = JSON.parse(current.observation.host.documentJSON), file = join(output, 'returned-current-radius10.bcad');
    await writeFile(file, JSON.stringify(returnedDoc));
    f.phase = 'fresh public Studio Open and Frame of actual returned radius10 Doc';
    await f.newPage(); await f.page.setViewportSize({width: 1440, height: 900});
    await f.openFile(file, returnedDoc.nodes.length); await f.same(returnedDoc); await f.snapshot('05-returned-doc-studio-open');
    await f.page.locator('button[title="Frame all (F)"]').click(); await f.ready(); const studio = await f.snapshot('06-returned-doc-studio-frame');
    assert.deepEqual(studio.doc, returnedDoc); assert.equal(studio.bodies.bodies.length, 1); assert.equal(studio.bodies.massReady, true);
    assert.deepEqual(f.report.downloads, []);
  } catch (error) {
    if (f.page && !f.page.isClosed() && await f.page.evaluate(() => !!window.d529Profiles)) await raw('failure-package-current');
    throw error;
  } finally { if (packageServer) { await packageServer.close(); f.report.cleanup.push('OWN_PACKAGE_STATIC_HTTP_CLOSED'); } }
});

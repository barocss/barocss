// One bounded authored/offline API + browser receipt. No model dispatch or source fallback.
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, symlinkSync, rmSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createAppServer } from './serve.mjs';
import { REQUEST_CONTRACT, SCREEN_DECLARATIONS, requestScreen } from './scenario.mjs';
import * as source from '../../packages/barocss-render/src/contract.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const packageRoot = path.join(repo, 'packages/barocss-render');
const manifest = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
const compiledEntry = path.resolve(packageRoot, manifest.exports['.'].import);
const compiled = await import(compiledEntry);
const deps = createRequire(path.join(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const peers = createRequire(path.join(process.env.REACT_ROOT ?? repo, 'package.json'));
const pw = createRequire(process.env.PW_DIR ? path.join(process.env.PW_DIR, 'package.json') : import.meta.url);
const { build } = deps('esbuild');
const { chromium } = pw('playwright-core');
assert.equal(peers('react/package.json').version, '19.2.3');
assert.equal(peers('react-dom/package.json').version, '19.2.3');
const scratch = mkdtempSync(path.join(os.tmpdir(), 'render-definition-flow-'));
const errors = [], external = [], observations = [];
let browser, profileServer, app;
const ready = (page, revision) => page.waitForFunction((wanted) => {
  const status = document.querySelector('[data-phase]');
  return status?.dataset.phase === 'ready' && Number(status.dataset.revision) === wanted;
}, revision);
const response = (request, spec = requestScreen(request.target, request.input)) => ({
  sessionId: request.sessionId, revision: request.revision, requestId: request.requestId, specJson: JSON.stringify(spec),
});

try {
  // Source/API evidence is recorded separately from browser evidence below.
  const definition = compiled.getRenderSpecDefinition(REQUEST_CONTRACT);
  assert.deepEqual(definition, source.getRenderSpecDefinition(REQUEST_CONTRACT));
  assert.deepEqual(JSON.parse(JSON.stringify(definition)), definition);
  for (const key of Object.keys(definition)) assert.deepEqual(SCREEN_DECLARATIONS[key], definition[key]);
  assert.deepEqual(compiled.getRenderSpecDefinition().permissions, { textBindings: ['/name'], actions: ['save'] });
  assert.throws(() => compiled.getRenderSpecDefinition({ textBindings: ['/name'], actions: ['save', 'save'] }),
    { name: 'TypeError', message: /contract.actions.1/ });
  assert.throws(() => compiled.getRenderSpecDefinition({ textBindings: ['/constructor'], actions: [] }), /contract.textBindings.0/);
  const input = { draft: { name: 'Ada', topic: 'Coffee' } };
  const form = requestScreen('form', input);
  assert(compiled.validateSpec(form, REQUEST_CONTRACT).ok);
  const rejected = [
    ['props.on', 'elements.review.props.on', (screen) => { screen.elements.review.props.on = screen.elements.review.on; delete screen.elements.review.on; }],
    ['unknown component', 'elements.name.type', (screen) => { screen.elements.name.type = 'Script'; }],
    ['unknown action', 'elements.review.on', (screen) => { screen.elements.review.on.press.action = 'execute'; }],
    ['unknown style', 'elements.layout.props.columns', (screen) => { screen.elements.layout.props.columns = 'custom'; }],
    ['missing prop', 'elements.name.props.label', (screen) => { delete screen.elements.name.props.label; }],
    ['cycle', 'elements.card.children.4', (screen) => { screen.elements.card.children.push('layout'); }],
  ];
  for (const [name, errorPath, change] of rejected) {
    const candidate = structuredClone(form); change(candidate);
    const result = compiled.validateSpec(candidate, REQUEST_CONTRACT);
    assert(!result.ok, name); assert(result.errors.some((error) => error.path === errorPath), name);
    assert.deepEqual(result, source.validateSpec(candidate, REQUEST_CONTRACT));
  }
  for (const columns of definition.components.Layout.props.columns) for (const gap of definition.components.Layout.props.gap) {
    const candidate = structuredClone(form); Object.assign(candidate.elements.layout.props, { columns, gap });
    assert(compiled.validateSpec(candidate, REQUEST_CONTRACT).ok);
    assert.equal(compiled.classesFor(candidate.elements.layout), `${definition.styleClasses.Layout[columns]} ${definition.styleClasses.Layout[gap]}`);
  }
  for (const padding of definition.components.Card.props.padding) for (const tone of definition.components.Card.props.tone) {
    const candidate = structuredClone(form); Object.assign(candidate.elements.card.props, { padding, tone });
    assert(compiled.validateSpec(candidate, REQUEST_CONTRACT).ok);
    assert.equal(compiled.classesFor(candidate.elements.card), `rounded-xl ${definition.styleClasses.Card[padding]} ${definition.styleClasses.Card[tone]}`);
  }
  const deniedRegistry = { Layout: () => null, Card: () => null, Text: () => null, Input: () => null, Button: () => null };
  const inheritedActions = Object.create({ review: () => {} });
  assert.throws(() => peers('react-dom/server').renderToString(peers('react').createElement(compiled.Renderer, {
    spec: form, contract: REQUEST_CONTRACT, components: deniedRegistry, state: input, setState() {}, actions: inheritedActions,
  })), /Missing registered action: review/);
  definition.components.Layout.props.columns.push('custom');
  definition.components.Input.props.value.$bindState.push('/secret');
  definition.components.Button.on.press.action.push('execute');
  definition.permissions.actions.push('execute'); definition.styleClasses.Card.light = 'injected';
  definition.limits.nodes[1] = 999; definition.graph.acyclic = false;
  assert.deepEqual(compiled.getRenderSpecDefinition(REQUEST_CONTRACT), source.getRenderSpecDefinition(REQUEST_CONTRACT));
  const undeclaredBinding = structuredClone(form); undeclaredBinding.elements.name.props.value.$bindState = '/secret';
  assert(!compiled.validateSpec(undeclaredBinding, REQUEST_CONTRACT).ok);
  assert.equal(compiled.classesFor(form.elements.card), 'rounded-xl p-5.5 bg-white text-slate-900');
  for (const [, , change] of rejected) {
    const candidate = structuredClone(form); change(candidate); assert(!compiled.validateSpec(candidate, REQUEST_CONTRACT).ok);
  }
  // Narrow declaration consumer, part of this same receipt; no broad consumer/packed suite.
  mkdirSync(path.join(scratch, 'node_modules/@barocss'), { recursive: true });
  symlinkSync(packageRoot, path.join(scratch, 'node_modules/@barocss/render'), 'dir');
  writeFileSync(path.join(scratch, 'package.json'), JSON.stringify({ type: 'module' }));
  writeFileSync(path.join(scratch, 'definition.ts'), `
import { getRenderSpecDefinition } from '@barocss/render';
import type { RenderSpecDefinition } from '@barocss/render';
const legacy: RenderSpecDefinition = getRenderSpecDefinition();
legacy.components.Input.props.value.$bindState.push('/name');
// @ts-expect-error the default metadata does not grant a different binding
legacy.permissions.textBindings.push('/secret');
const configured = getRenderSpecDefinition({ textBindings: ['/draft/name'] as const, actions: ['review'] as const });
configured.components.Button.on.press.action.push('review');
// @ts-expect-error configured permissions do not include save
configured.permissions.actions.push('save');
// @ts-expect-error fixed style choices cannot add arbitrary CSS
configured.components.Layout.props.columns.push('custom');
const format: 1 = configured.definitionVersion;
void format;
`);
  execFileSync(process.execPath, [deps.resolve('typescript/bin/tsc'), '--noEmit', '--strict', '--target', 'ES2022',
    '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--types', 'react',
    '--typeRoots', path.dirname(path.dirname(deps.resolve('@types/react/package.json'))),
    path.join(scratch, 'definition.ts')], { stdio: 'inherit' });
  const sourceGraph = await build({ entryPoints: [path.join(packageRoot, 'src/index.jsx')], bundle: true,
    write: false, metafile: true, format: 'esm', platform: 'neutral', jsx: 'automatic', external: ['react', 'react/*'] });
  assert(Object.keys(sourceGraph.metafile.inputs).some((name) => name.endsWith('src/definition.mjs')));
  observations.push({ kind: 'source/API', compiledEntry, descriptorVersion: 1, rejected: rejected.map(([name]) => name),
    detachedMutation: 'retained validation and CSS', declarations: 'passed' });

  // Default real ProfileForm host: registered save confirms the typed host snapshot.
  const entry = path.join(scratch, 'profile.jsx');
  writeFileSync(entry, `import React from 'react'; import { createRoot } from 'react-dom/client';
import { ProfileForm } from ${JSON.stringify(path.join(packageRoot, 'examples/profile-form.tsx'))};
window.SAVED = []; createRoot(document.getElementById('app')).render(<ProfileForm onSave={value => window.SAVED.push(value)} />);`);
  const profileBundle = await build({ entryPoints: [entry], bundle: true, write: false, metafile: true,
    format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'actual-built-root', setup(plugin) {
      plugin.onResolve({ filter: /^@barocss\/render$/ }, () => ({ path: compiledEntry }));
      plugin.onResolve({ filter: /^react(?:-dom)?(?:\/.*)?$/ }, (args) => ({ path: peers.resolve(args.path) }));
    } }] });
  const compiledInputs = Object.keys(profileBundle.metafile.inputs).map((name) => realpathSync(path.resolve(name)));
  assert(compiledInputs.includes(realpathSync(compiledEntry)));
  assert(!compiledInputs.some((name) => name.startsWith(path.join(packageRoot, 'src') + path.sep)));
  profileServer = http.createServer((request, result) => {
    if (request.url === '/app.js') { result.setHeader('content-type', 'text/javascript'); result.end(profileBundle.outputFiles[0].contents); }
    else { result.setHeader('content-type', 'text/html'); result.end('<!doctype html><div id="app"></div><script src="/app.js"></script>'); }
  });
  await new Promise((resolve) => profileServer.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${profileServer.address().port}`);
  await page.getByLabel('Name', { exact: true }).fill('Alice 민지');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  assert.equal(await page.getByLabel('Saved name', { exact: true }).textContent(), 'Name: Alice 민지');
  assert.deepEqual(await page.evaluate(() => window.SAVED), [{ name: 'Alice 민지' }]);
  observations.push({ kind: 'browser/default', input: 'Alice 민지', confirmation: 'Name: Alice 민지', publicCompiledGraph: true });

  // Existing server/session/browser host, with authored complete-screen responses.
  let variant = 'valid', formCount = 0, releaseLate, lateRequest;
  app = await createAppServer({ mode: 'injected-test', generate(request) {
    const screen = requestScreen(request.target, request.input);
    if (variant === 'late') { lateRequest = request; return new Promise((resolve) => { releaseLate = resolve; }); }
    if (variant === 'truncated') return { ...response(request), specJson: '{"root":' };
    if (variant === 'props.on') { screen.elements.confirm.props.on = screen.elements.confirm.on; delete screen.elements.confirm.on; }
    if (variant === 'component') screen.elements.heading.type = 'Script';
    if (variant === 'action') screen.elements.confirm.on.press.action = 'execute';
    if (request.target === 'form' && ++formCount > 1) {
      screen.elements.name.props.label = 'Your name'; screen.elements.topic.props.label = 'Your topic';
      screen.elements.layout.props.columns = 'responsive'; screen.elements.layout.props.gap = 'fractional';
    }
    return response(request, screen);
  } });
  page.on('request', (request) => { if (new URL(request.url()).origin !== app.url) external.push(request.url()); });
  await page.addInitScript(() => { window.CSP_EVENTS = []; document.addEventListener('securitypolicyviolation', (event) => window.CSP_EVENTS.push(event.violatedDirective)); });
  await page.goto(app.url);
  await page.locator('[data-phase="idle"]').waitFor();
  assert.match(await page.locator('#mode').textContent(), /injected-test.*no model/);
  await page.getByRole('button', { name: 'Generate', exact: true }).click(); await ready(page, 1);
  const name = page.getByLabel('Request name', { exact: true }), topic = page.getByLabel('Request topic', { exact: true });
  await name.fill('Alice 민지'); await topic.fill('Tea 차');
  await page.getByRole('button', { name: 'review', exact: true }).click(); await ready(page, 2);
  await page.getByRole('button', { name: 'edit', exact: true }).click(); await ready(page, 3);
  assert.equal(await name.inputValue(), 'Alice 민지'); assert.equal(await topic.inputValue(), 'Tea 차');
  assert.match(await name.locator('..').textContent(), /Your name/);
  assert.equal(await page.locator('[data-node-id="layout"]').evaluate((element) => getComputedStyle(element).display), 'grid');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-node-id="layout"]')).gap === '10px');
  const retained = app.session.snapshot();
  let expectedRevision = retained.revision;
  for (const failure of ['props.on', 'component', 'action', 'truncated']) {
    variant = failure;
    await page.getByRole('button', { name: 'review', exact: true }).click();
    await page.waitForFunction((revision) => {
      const status = document.querySelector('[data-phase]');
      return status?.dataset.phase === 'failed' && Number(status.dataset.revision) === revision;
    }, ++expectedRevision);
    assert.deepEqual(app.session.snapshot().spec, retained.spec);
    assert.deepEqual(app.session.snapshot().input, retained.input);
    assert.equal(await name.inputValue(), 'Alice 민지'); assert.equal(await topic.inputValue(), 'Tea 차');
    assert.equal(await page.getByRole('alert').textContent(), failure === 'truncated' ? 'Generated screen is not JSON' : 'Invalid generated screen');
  }
  variant = 'late';
  await page.getByRole('button', { name: 'review', exact: true }).click();
  await page.locator('[data-phase="action-pending"]').waitFor();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('[data-phase="cancelled"]').waitFor();
  const cancelled = app.session.snapshot();
  assert.deepEqual(cancelled.spec, retained.spec); assert.deepEqual(cancelled.input, retained.input);
  releaseLate(response(lateRequest));
  // Settle the authored promise independently: cancel deliberately clears session.pending.
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(app.session.snapshot(), cancelled);
  const { token } = await (await fetch(`${app.url}/api/session`)).json();
  const stale = await fetch(`${app.url}/api/action`, { method: 'POST', headers: {
    origin: app.url, 'content-type': 'application/json', 'x-session-token': token,
  }, body: JSON.stringify({ sessionId: lateRequest.sessionId, revision: lateRequest.revision, action: 'review' }) });
  assert.equal(stale.status, 409); assert.deepEqual(app.session.snapshot(), cancelled);
  variant = 'valid';
  await page.getByRole('button', { name: 'review', exact: true }).click(); await ready(page, cancelled.revision + 1);
  await page.getByRole('button', { name: 'confirm', exact: true }).click(); await ready(page, cancelled.revision + 2);
  assert.equal(await page.locator('[data-node-id="name-summary"]').textContent(), 'name: Alice 민지');
  assert.equal(await page.locator('[data-node-id="topic-summary"]').textContent(), 'topic: Tea 차');
  assert.equal(app.session.snapshot().stage, 'confirmed');
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  assert.deepEqual(await page.evaluate(() => window.CSP_EVENTS), []);
  observations.push({ kind: 'browser/configured', mode: 'authored/offline injected-test', modelCalls: 0,
    acceptedDisplays: app.session.snapshot().displays, completeScreenLabelLayoutChange: true,
    retention: 'host values across review/edit and rejected updates; inputs remount after review',
    refusal: ['props.on', 'unknown component', 'unknown action', 'truncated JSON', 'cancelled late response', 'stale revision'],
    cspViolations: [], pageErrors: [] });
  console.log(JSON.stringify({ result: 'render definition flow passed', node: process.version,
    browser: browser.version(), observations }, null, 2));
} finally {
  if (browser) await browser.close();
  if (app) await app.close();
  if (profileServer) { profileServer.closeAllConnections(); await new Promise((resolve) => profileServer.close(resolve)); }
  rmSync(scratch, { recursive: true, force: true });
}

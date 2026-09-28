import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createComparisonServer } from './serve.mjs';
import { INITIAL, editedSpec } from './fixture.mjs';

const fromPW = createRequire(path.join(process.env.PW_DIR ?? '/missing', 'package.json'));
const { chromium } = fromPW('playwright-core');
const chrome = process.env.CHROME ?? chromium.executablePath();
const versionAt = (root, name) => JSON.parse(fs.readFileSync(path.join(root, 'node_modules', name, 'package.json'))).version;
const viewports = { desktop: { width: 1200, height: 800 }, narrow: { width: 390, height: 800 } };
const resultDir = process.env.RESULT_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'barocss-render-459-'));

function styleSnapshot() {
  const layout = document.querySelector('[data-node-id="layout"]');
  const card = document.querySelector('[data-node-id="card"]');
  const input = document.querySelector('[data-node-id="name"] input');
  const layoutStyle = getComputedStyle(layout);
  const cardStyle = getComputedStyle(card);
  return {
    columns: layoutStyle.gridTemplateColumns.trim().split(/\s+/).length,
    gapPx: parseFloat(layoutStyle.gap), paddingPx: parseFloat(cardStyle.paddingTop),
    background: cardStyle.backgroundColor, textColor: cardStyle.color,
    value: input.value, focused: document.activeElement === input,
    ids: [...document.querySelectorAll('[data-node-id]')].map((element) => element.dataset.nodeId),
    actions: window.COMPARE.actions(), state: window.COMPARE.state(),
  };
}

test('both local arms preserve input, focus, actions and BaroCSS styles through the same edit', async () => {
  assert(fs.existsSync(chrome), `Missing approved local Chromium: ${chrome}`);
  fs.mkdirSync(resultDir, { recursive: true });
  const { server, url } = await createComparisonServer();
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const baroBundle = fs.readFileSync(path.join(process.env.REPO_DEPS_ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'));
  const report = { kind: 'authored-local-renderer-comparison', source: 'authored', url: 'loopback-only', rows: [], negatives: [],
    versions: { node: process.version, chromium: browser.version(), playwrightCore: fromPW('playwright-core/package.json').version,
      jsonRenderCore: versionAt(process.env.JR_ROOT, '@json-render/core'), jsonRenderReact: versionAt(process.env.JR_ROOT, '@json-render/react'),
      react: versionAt(process.env.JR_ROOT, 'react'), reactDom: versionAt(process.env.JR_ROOT, 'react-dom'),
      zod: versionAt(process.env.JR_ROOT, 'zod'), esbuild: versionAt(process.env.REPO_DEPS_ROOT, 'esbuild'),
      barocssKit: JSON.parse(fs.readFileSync(path.join(process.env.REPO_DEPS_ROOT, 'packages/barocss/package.json'))).version,
      barocssBrowser: JSON.parse(fs.readFileSync(path.join(process.env.REPO_DEPS_ROOT, 'packages/barocss-browser/package.json'))).version,
      privateRenderer: JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../../packages/barocss-render/package.json'))).version,
      barocssBundleSha256: createHash('sha256').update(baroBundle).digest('hex') } };
  try {
    for (const arm of ['prototype', 'json-render']) {
      const page = await browser.newPage({ viewport: viewports.desktop });
      const requests = [], pageErrors = [];
      page.on('request', (request) => { if (!request.url().startsWith(url)) requests.push(request.url()); });
      page.on('pageerror', (error) => pageErrors.push(error.message));
      try {
        await page.goto(`${url}/arm?arm=${arm}`, { waitUntil: 'load' });
        const field = page.locator('[data-node-id="name"] input');
        await field.waitFor();
        const initial = await page.evaluate(styleSnapshot);
        assert.equal(initial.paddingPx, 14);
        assert.equal(initial.gapPx, 10);
        assert.equal(initial.columns, 2);
        assert.equal(initial.background, 'rgb(255, 255, 255)');
        await page.screenshot({ path: path.join(resultDir, `${arm}-initial.png`) });
        await field.fill('Bea');
        await field.focus();
        const result = await page.evaluate((spec) => window.COMPARE.update(spec), editedSpec());
        assert.deepEqual(result, { ok: true, errors: [] });
        const edited = await page.evaluate(styleSnapshot);
        assert.equal(edited.value, 'Bea');
        assert.equal(edited.state.name, 'Bea');
        assert.equal(edited.focused, true);
        assert.equal(edited.paddingPx, 22);
        assert.equal(edited.gapPx, 14);
        assert.equal(edited.columns, 2);
        assert.equal(edited.background, 'oklch(0.208 0.042 265.755)');
        assert.equal(edited.textColor, 'rgb(255, 255, 255)');
        assert.deepEqual(edited.ids, ['layout', 'card', 'heading', 'help', 'name', 'save']);
        await page.screenshot({ path: path.join(resultDir, `${arm}-edited.png`) });
        const beforeInvalid = await page.evaluate(() => ({ html: document.getElementById('out').innerHTML,
          spec: window.COMPARE.currentSpec(), state: window.COMPARE.state() }));
        for (const [name, edit, expected] of [
          ['component', (s) => { s.elements.help.type = 'Script'; }, 'elements.help.type'],
          ['prop', (s) => { s.elements.card.props.className = 'fixed'; }, 'elements.card.props.className'],
          ['style', (s) => { s.elements.card.props.padding = 'url(https://example.test)'; }, 'elements.card.props.padding'],
          ['action', (s) => { s.elements.save.on.press.action = 'fetch'; }, 'elements.save.on'],
        ]) {
          const bad = editedSpec(); edit(bad);
          const rejected = await page.evaluate((spec) => window.COMPARE.update(spec), bad);
          assert.equal(rejected.ok, false);
          assert(rejected.errors.some((error) => error.path === expected));
          const after = await page.evaluate(() => ({ html: document.getElementById('out').innerHTML,
            spec: window.COMPARE.currentSpec(), state: window.COMPARE.state() }));
          assert.deepEqual(after, beforeInvalid);
          report.negatives.push({ arm, name, path: expected, lastValidUnchanged: true });
        }
        await page.setViewportSize(viewports.narrow);
        const narrow = await page.evaluate(styleSnapshot);
        assert.equal(narrow.columns, 1);
        assert.equal(narrow.value, 'Bea');
        await page.screenshot({ path: path.join(resultDir, `${arm}-narrow.png`) });
        await page.locator('[data-node-id="save"]').click();
        const action = await page.evaluate(() => window.COMPARE.actions());
        assert.deepEqual(action, [{ name: 'save', value: 'Bea' }]);
        assert.deepEqual(requests, []);
        assert.deepEqual(pageErrors, []);
        report.rows.push({ arm, initial, edited, narrow, action, externalRequests: requests, pageErrors,
          screenshots: [`${arm}-initial.png`, `${arm}-edited.png`, `${arm}-narrow.png`] });
      } finally { await page.close(); }
    }
    assert.deepEqual(report.rows[0].edited, report.rows[1].edited);
    report.visualParity = Object.fromEntries(['initial', 'edited', 'narrow'].map((stage) => {
      const same = fs.readFileSync(path.join(resultDir, `prototype-${stage}.png`))
        .equals(fs.readFileSync(path.join(resultDir, `json-render-${stage}.png`)));
      assert.equal(same, true, `Screenshot differs at ${stage}`);
      return [stage, same];
    }));
    const dashboard = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const dashboardRequests = [], dashboardErrors = [];
    dashboard.on('request', (request) => { if (!request.url().startsWith(url)) dashboardRequests.push(request.url()); });
    dashboard.on('pageerror', (error) => dashboardErrors.push(error.message));
    try {
      await dashboard.goto(url, { waitUntil: 'load' });
      await dashboard.frameLocator('#prototype').locator('input').waitFor();
      await dashboard.frameLocator('#official').locator('input').waitFor();
      await dashboard.locator('#edit').click();
      for (const frameId of ['#prototype', '#official']) {
        const padding = await dashboard.frameLocator(frameId).locator('[data-node-id="card"]').evaluate(
          (node) => parseFloat(getComputedStyle(node).paddingTop));
        assert.equal(padding, 22, `${frameId}: ${await dashboard.locator('#errors').textContent()}`);
      }
      const bad = editedSpec(); bad.elements.card.props.padding = 'raw-css';
      await dashboard.locator('#spec').fill(JSON.stringify(bad));
      await dashboard.locator('#apply').click();
      assert.match(await dashboard.locator('#errors').textContent(), /elements\.card\.props\.padding/);
      for (const frameId of ['#prototype', '#official']) {
        const padding = await dashboard.frameLocator(frameId).locator('[data-node-id="card"]').evaluate(
          (node) => parseFloat(getComputedStyle(node).paddingTop));
        assert.equal(padding, 22);
      }
      report.dashboard = { authoredEditApplied: true, invalidPathShown: true, lastValidBothArms: true };
      await dashboard.screenshot({ path: path.join(resultDir, 'comparison.png'), fullPage: true });
      assert.deepEqual(dashboardRequests, []);
      assert.deepEqual(dashboardErrors, []);
    } finally { await dashboard.close(); }
    fs.writeFileSync(path.join(resultDir, 'result.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(`Browser evidence: ${resultDir}`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('synthetic saved-output envelope is replayed only after strict validation', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'barocss-render-capture-'));
  const capturePath = path.join(temp, 'capture.json');
  try {
    fs.writeFileSync(capturePath, JSON.stringify({ specJson: JSON.stringify(INITIAL), cannotExpress: false }));
    const { server, url, hasCapture } = await createComparisonServer({ capturePath });
    try {
      assert.equal(hasCapture, true);
      const response = await fetch(`${url}/capture.json`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), INITIAL);
      const browser = await chromium.launch({ executablePath: chrome, headless: true });
      try {
        const page = await browser.newPage();
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        await page.goto(url, { waitUntil: 'load' });
        await page.locator('#capture:visible').waitFor();
        await page.locator('#capture').click();
        await page.locator('#edit').click();
        await page.locator('#capture').click();
        assert.deepEqual(JSON.parse(await page.locator('#spec').inputValue()), INITIAL);
        assert.equal(await page.locator('#errors').textContent(), 'Both screens updated.');
        for (const frameId of ['#prototype', '#official']) {
          const spec = await page.frameLocator(frameId).locator('body').evaluate(() => window.COMPARE.currentSpec());
          assert.deepEqual(spec, INITIAL);
          const padding = await page.frameLocator(frameId).locator('[data-node-id="card"]').evaluate(
            (node) => parseFloat(getComputedStyle(node).paddingTop));
          assert.equal(padding, 14);
        }
        assert.deepEqual(pageErrors, []);
      } finally { await browser.close(); }
      const blocked = await new Promise((resolve, reject) => {
        http.get({ host: '127.0.0.1', port: Number(new URL(url).port), path: '/capture.json',
          headers: { host: 'untrusted.example' } }, (reply) => { reply.resume(); reply.on('end', () => resolve(reply.statusCode)); })
          .on('error', reject);
      });
      assert.equal(blocked, 403);
    } finally { await new Promise((resolve) => server.close(resolve)); }
    const bad = structuredClone(INITIAL);
    bad.elements.heading.props.html = '<script>bad</script>';
    fs.writeFileSync(capturePath, JSON.stringify({ specJson: JSON.stringify(bad), cannotExpress: false }));
    await assert.rejects(() => createComparisonServer({ capturePath }), /elements\.heading\.props\.html/);
    fs.writeFileSync(capturePath, JSON.stringify({ specJson: JSON.stringify(INITIAL), cannotExpress: true }));
    await assert.rejects(() => createComparisonServer({ capturePath }), /cannot be expressed/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

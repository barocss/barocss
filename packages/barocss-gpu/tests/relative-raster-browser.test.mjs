// Public Viewer + actual WebGPU smoke/coordinate checks. Native Studio acceptance has a separate frozen oracle/driver.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const cad = fileURLToPath(new URL('../../barocss-cad/dist/', import.meta.url));
const fixture = fileURLToPath(new URL('./fixtures/relative-raster-browser.html', import.meta.url));
function pointChecks(result) {
  assert.ok(result.cpu, 'public CPU query still sees the retained world surface');
  assert.ok(result.coverage > 1000, `real surface contrast ${result.coverage}`);
  assert.equal(result.restoreDifference, 0, 'same public state restores the same actual frame');
  assert.equal(result.worldUnchanged, true); assert.equal(result.grid, true);
  assert.equal(result.ao.radius, 1); assert.equal(result.ao.strength, .9);
  const b = result.budget;
  assert.ok(b.cssBound < .01, `derived uploaded projection bound ${b.cssBound}`);
  assert.ok(b.pointBound < b.pointCeiling, `derived plane point bound ${b.pointBound} must itself fit ${b.pointCeiling}`);
  assert.ok(b.error <= b.pointBound, `physical point error ${b.error} > ${b.pointBound}`);
  assert.ok(b.depthError <= b.depthBound, `depth error ${b.depthError} > ${b.depthBound}`);
  assert.ok(b.decodeError <= 2 ** -31, 'hardware point decodes the actual packed frame and restores origin once');
  assert.ok([42, 43].includes(result.face)); assert.ok(result.triangle === 0 || result.triangle === 1);
  assert.deepEqual(result.packet, result.expectedPacket, 'passive numeric position bytes retain every represented source offset');
  assert.ok(result.packet[3] - result.packet[0] > .0019, 'genuine represented span reaches the GPU position upload');
}

test('relative raster public WebGPU renders, picks, updates all supported primitive uploads and recovers', { timeout: 180000 }, async t => {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR required'); return; }
  const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
  const evidence = process.env.GPU_RELATIVE_EVIDENCE_DIR;
  if (evidence) await mkdir(evidence, { recursive: false });
  const server = createServer(async (req, res) => {
    try {
      if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end(await readFile(fixture)); return; }
      if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
      const base = req.url.startsWith('/cad/') ? cad : root, url = base === cad ? req.url.slice(4) : req.url;
      const target = resolve(base, '.' + url);
      if (!target.startsWith(base) || !target.endsWith('.js')) { res.writeHead(404); res.end(); return; }
      res.setHeader('Content-Type', 'text/javascript'); res.end(await readFile(target));
    } catch { res.writeHead(404); res.end(); }
  });
  let browser, page, completed = false, cleanup = null;
  const errors = [], results = {};
  try {
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
    page = await browser.newPage({ viewport: { width: 640, height: 480 } });
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => !!window.relativeRasterBrowser);
    results.adapter = await page.evaluate(async () => { const a = await navigator.gpu?.requestAdapter(); return a ? { vendor: a.info?.vendor, architecture: a.info?.architecture } : null; });
    assert.ok(results.adapter, 'a real WebGPU adapter is required for this qualification');
    results.perspective = await page.evaluate(() => window.relativeRasterBrowser.start());
    pointChecks(results.perspective);
    if (evidence) await page.locator('canvas').screenshot({ path: join(evidence, 'far-perspective.png') });
    results.orthographic = await page.evaluate(() => window.relativeRasterBrowser.projection('orthographic'));
    pointChecks(results.orthographic);
    if (evidence) await page.locator('canvas').screenshot({ path: join(evidence, 'far-orthographic.png') });
    results.updates = await page.evaluate(() => window.relativeRasterBrowser.updates());
    assert.ok(results.updates.linePixels > 30); assert.ok(results.updates.pointPixels > 4); assert.ok(results.updates.contourPixels > 20); assert.ok(results.updates.changedPixels > 30);
    assert.equal(results.updates.contourSetterCode, 'GEOMETRY_INVALID', 'existing contour color refusal remains');
    assert.ok(results.updates.linePacket[3] - results.updates.linePacket[0] > .0027);
    assert.equal(results.updates.pointPacket[0], 0, 'single-point source localization keeps its placement in the object packet');
    assert.equal(results.updates.contourPacket.length, 36);
    results.fallback = await page.evaluate(() => window.relativeRasterBrowser.fallback());
    assert.equal(results.fallback.legacyReturnedNull, true, 'whole legacy scalar profile retains its declared far precision limit');
    assert.equal(results.fallback.restoredHit, true); assert.ok(results.fallback.contrast > 1000); assert.equal(results.fallback.frameBytes, 2368);
    results.recovery = await page.evaluate(() => window.relativeRasterBrowser.recover());
    assert.equal(results.recovery.supported, true, 'only this viewer owned device is destroyed'); assert.equal(results.recovery.changedDevice, true);
    assert.ok(results.recovery.budget.pointBound < results.recovery.budget.pointCeiling);
    assert.ok(results.recovery.budget.error <= results.recovery.budget.pointBound);
    assert.ok(results.recovery.packet[3] - results.recovery.packet[0] > .0019);
    results.ordinary = await page.evaluate(() => window.relativeRasterBrowser.ordinary());
    assert.equal(results.ordinary.hit, true); assert.ok(results.ordinary.color[1] > results.ordinary.color[0] + 80);
    assert.deepEqual(results.ordinary.frameTail, new Array(12).fill(0));
    if (evidence) await page.locator('canvas').screenshot({ path: join(evidence, 'ordinary.png') });
    assert.deepEqual(errors, []); completed = true;
  } finally {
    if (page && !page.isClosed()) {
      try { cleanup = await page.evaluate(() => window.relativeRasterBrowser?.finish()); } catch (error) { cleanup = { error: String(error) }; }
    }
    await browser?.close(); await new Promise(done => server.close(done));
    if (evidence) await writeFile(join(evidence, 'receipt.json'), JSON.stringify({ completed, results, errors, cleanup, resourcesClosed: true }, null, 2));
  }
  assert.deepEqual(cleanup, { disposed: true, restored: true });
  t.diagnostic(JSON.stringify({ completed, adapter: results.adapter, perspective: results.perspective.budget, orthographic: results.orthographic.budget, updates: { linePixels: results.updates.linePixels, pointPixels: results.updates.pointPixels, contourPixels: results.updates.contourPixels }, recovery: results.recovery.changedDevice, resourcesClosed: true }));
});

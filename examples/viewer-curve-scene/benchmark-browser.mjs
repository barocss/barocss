import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

assert(process.env.PW_DIR && process.env.CHROME && process.env.VIEWER_CURVE_EVIDENCE,
  'Set PW_DIR, CHROME and VIEWER_CURVE_EVIDENCE');
const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
const dir = resolve(process.env.VIEWER_CURVE_EVIDENCE);
const port = 52922;
await mkdir(dir, { recursive: true });
const server = spawn(process.execPath, ['examples/viewer-curve-scene/server.mjs'], {
  cwd: resolve(import.meta.dirname, '../..'),
  env: { ...process.env, VIEWER_CURVE_PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
server.stdout.on('data', data => { logs += data.toString(); });
server.stderr.on('data', data => { logs += data.toString(); });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (server.exitCode !== null) throw new Error('Curve server exited: ' + logs);
    try {
      const response = await fetch('http://127.0.0.1:' + port);
      if (response.ok) { ready = true; break; }
    } catch { /* Allow server startup. */ }
    await delay(200);
  }
  assert(ready, 'Curve server did not start: ' + logs);
  browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true,
    args: ['--enable-unsafe-webgpu'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('http://127.0.0.1:' + port);
  await page.waitForFunction(() => window.viewerCurveDemo?.viewer?.getState().status === 'ready');
  const reports = [];
  for (const scene of ['mixed', 'curves-only', 'wide-64']) {
    await page.evaluate(sceneName => window.viewerCurveDemo.load(sceneName), scene);
    const result = await page.evaluate(() => ({
      report: window.viewerCurveDemo.benchmarkCurvePicking({ repetitions: 5, columns: 8, rows: 6 }),
      state: window.viewerCurveDemo.viewer.getState(),
    }));
    assert.equal(result.report.pointsPerScan, 48);
    assert.equal(result.report.repetitions, 5);
    assert.equal(result.report.timingsMs.length, 5);
    assert(result.report.timingsMs.every(time => Number.isFinite(time) && time >= 0));
    assert(result.state.status === 'ready');
    reports.push({ scene, report: result.report, curveCount: result.state.curves.length,
      camera: result.state.camera, curveSampleVersion: result.state.curveSampleVersion });
  }
  assert.deepEqual(pageErrors, [], 'Unhandled browser errors');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  await writeFile(join(dir, 'curve-picking.json'),
    JSON.stringify({ head, browser: 'Chromium WebGPU', viewport: [1280, 800],
      dpr: 1, reports, pageErrors, disclaimer:
      'Current-build timing and repeatability only; not an A/B improvement or hardware-GPU measurement' },
    null, 2) + '\n');
  console.log('Curve pick browser timing and repeatability completed for', reports.map(r => r.scene).join(', '));
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}

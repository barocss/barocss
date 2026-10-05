import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { startServer } from '../../../examples/gpu-scene/server.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fixtures = {
  sphere: '@scene sphereOnly { version: 0; background: #102030; sphere #orb; } sphere { color: #ff0000; radius: 1; }',
  box: '@scene boxOnly { version: 0; background: #102030; box #block; } box { color: #00ff00; size: 2 2 2; }',
  combined: '@scene combined { version: 0; background: #102030; sphere #orb; box #block; } sphere { color: #ff0000; radius: 0.8; translate: -1 0 0; } box { color: #00ff00; size: 1.2 1.2 1.2; translate: 1 0 0; }',
  empty: '@scene empty { version: 0; background: #102030; }',
};

function masks(bytes, width, height) {
  const pixel = (x, y) => bytes.slice((y * width + x) * 4, (y * width + x) * 4 + 4);
  const background = pixel(2, 2);
  const delta = (a, b) => Math.max(...a.slice(0, 3).map((value, index) => Math.abs(value - b[index])));
  let foreground = 0, interior = 0, border = 0, borderChanged = 0;
  let foregroundX = 0, redPixels = 0, greenPixels = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const changed = delta(pixel(x, y), background) > 12;
    if (changed) { foreground++; foregroundX += x; const rgb = pixel(x, y); if (rgb[0] > rgb[1] + 30) redPixels++; if (rgb[1] > rgb[0] + 30) greenPixels++; }
    if (x > width * .35 && x < width * .65 && y > height * .35 && y < height * .65 && changed) interior++;
    if (x < width * .05 || x >= width * .95 || y < height * .05 || y >= height * .95) { border++; if (changed) borderChanged++; }
  }
  return { background, center: pixel(Math.floor(width / 2), Math.floor(height / 2)), foreground,
    foregroundRatio: foreground / (width * height), interior, borderChanged, border,
    redPixels, greenPixels, centroidX: foreground ? foregroundX / foreground : null };
}

test('installed Chrome renders real WebGL2 frames and preserves accepted lifecycle state', { timeout: 120_000 }, async () => {
  assert(process.env.CHROME, 'CHROME must name the installed browser; automatic download is forbidden');
  assert(process.env.PW_DIR, 'PW_DIR must name the installed Playwright runtime');
  await access(process.env.CHROME);
  const require = createRequire(path.join(process.env.PW_DIR, 'package.json'));
  const { chromium } = require('playwright');
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  const evidence = process.env.BAROCSS_GPU_EVIDENCE_DIR ?? `/Users/user/.barocss-ai/v3/gpu-499-${sha.slice(0, 8)}`;
  await mkdir(evidence, { recursive: true });
  const running = await startServer();
  let browser;
  const pageErrors = [], unexpectedRequests = [];
  const retained = [];
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true,
      args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const allowed = new Set(['/', '/app.js', '/gpu.js']);
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== running.url || !allowed.has(url.pathname) || url.search) {
        unexpectedRequests.push(url.href); return route.abort();
      }
      return route.continue();
    });
    await page.goto(running.url);
    await page.waitForFunction(() => document.querySelector('#status').textContent === 'Scene accepted.');
    await page.evaluate(async () => {
      const api = await import('/gpu.js');
      const canvas = document.createElement('canvas');
      canvas.id = 'test-canvas'; canvas.width = 256; canvas.height = 192;
      document.body.append(canvas);
      window.gpuTest = { api, canvas, renderer: null };
    });
    const details = await page.evaluate(() => {
      const gl = window.gpuTest.canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true });
      if (!gl) throw new Error('Actual WebGL2 context unavailable');
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return { version: gl.getParameter(gl.VERSION), shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER),
        unmaskedVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
        unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null };
    });
    async function capture(name, source) {
      const frame = await page.evaluate((text) => {
        const state = window.gpuTest;
        if (state.renderer) {
          const result = state.renderer.update(text);
          if (!result.ok) throw result.error;
        } else state.renderer = state.api.mountScene(state.canvas, text);
        const bytes = Array.from(state.renderer.readPixels());
        return { scene: state.renderer.scene, shaders: state.renderer.shaders, bytes,
          width: state.canvas.width, height: state.canvas.height, actualBuffer: [state.canvas.getContext('webgl2').drawingBufferWidth, state.canvas.getContext('webgl2').drawingBufferHeight] };
      }, source);
      assert.equal(frame.bytes.length, frame.width * frame.height * 4);
      assert.deepEqual(frame.actualBuffer, [frame.width, frame.height]);
      const mask = masks(frame.bytes, frame.width, frame.height);
      assert.deepEqual(mask.background, [16, 32, 48, 255]);
      const filenames = [`${name}.scene.css`, `${name}.scene.json`, `${name}.vert.glsl`, `${name}.frag.glsl`, `${name}.png`];
      const contents = [source, JSON.stringify(frame.scene, null, 2), frame.shaders.vertex, frame.shaders.fragment];
      for (let i = 0; i < contents.length; i++) await writeFile(path.join(evidence, filenames[i]), contents[i]);
      await page.locator('#test-canvas').screenshot({ path: path.join(evidence, filenames[4]) });
      const hashes = {};
      for (const name of filenames) hashes[name] = digest(await readFile(path.join(evidence, name)));
      const result = { fixture: name, taskCommit: sha, integrationCommit: process.env.BAROCSS_GPU_INTEGRATION_SHA ?? null,
        browser: browser.version(), executable: process.env.CHROME, webgl: details,
        backend: 'explicit ANGLE SwiftShader software WebGL2', physicalGpuEvidence: false, performanceEvidence: false,
        buffer: [frame.width, frame.height], masks: mask, readbackHash: digest(Uint8Array.from(frame.bytes)), hashes,
        limits: { sourceBytes: 65536, objects: 32, rules: 128, declarations: 512 },
        checks: { actualReadPixels: true, webgl2: true, pageErrors: [...pageErrors], unexpectedRequests: [...unexpectedRequests] } };
      await writeFile(path.join(evidence, `${name}.json`), JSON.stringify(result, null, 2));
      retained.push(result);
      return { ...frame, mask, hash: result.readbackHash };
    }
    const sphere = await capture('sphere', fixtures.sphere);
    assert(sphere.mask.foregroundRatio > .03 && sphere.mask.foregroundRatio < .5);
    assert(sphere.mask.interior > 100 && sphere.mask.borderChanged === 0);
    assert(sphere.mask.center[0] > sphere.mask.center[1] + 30, 'Sphere center must be red');
    const box = await capture('box', fixtures.box);
    assert(box.mask.foregroundRatio > .04 && box.mask.foregroundRatio < .6);
    assert(box.mask.interior > 100 && box.mask.borderChanged === 0);
    assert(box.mask.center[1] > box.mask.center[0] + 30, 'Box center must be green');
    const combined = await capture('combined', fixtures.combined);
    assert(combined.mask.foregroundRatio > .03 && combined.mask.foregroundRatio < .6);
    assert.equal(combined.mask.borderChanged, 0);
    assert(combined.mask.redPixels > 100 && combined.mask.greenPixels > 100, 'Both combined shapes must be visible');
    const empty = await capture('empty', fixtures.empty);
    assert.equal(empty.mask.foreground, 0, 'Empty scene must be uniform background');
    assert.equal(empty.mask.background[3], 255);
    const colored = await capture('color-update', fixtures.sphere.replace('#ff0000', '#00ff00'));
    assert.notEqual(colored.hash, sphere.hash);
    assert(colored.mask.center[1] > colored.mask.center[0] + 30);
    const moved = await capture('translation-update', fixtures.sphere.replace('radius: 1;', 'radius: 1; translate: 1 0 0;'));
    assert.notEqual(moved.hash, sphere.hash);
    assert(moved.mask.centroidX > sphere.mask.centroidX + 15);
    const preserved = await page.evaluate(() => {
      const { renderer } = window.gpuTest;
      const before = Array.from(renderer.readPixels());
      const beforeScene = JSON.stringify(renderer.scene);
      const result = renderer.update('@scene invalid { version: 0; sphere #orb; } sphere { radius: -1; }');
      return { ok: result.ok, message: String(result.error), sceneRetained: beforeScene === JSON.stringify(renderer.scene),
        pixelsRetained: JSON.stringify(before) === JSON.stringify(Array.from(renderer.readPixels())) };
    });
    assert.equal(preserved.ok, false); assert(preserved.message.length > 0);
    assert(preserved.sceneRetained && preserved.pixelsRetained);
    const rejectedGpuUpdates = await page.evaluate(() => {
      const { renderer, canvas } = window.gpuTest;
      const gl = canvas.getContext('webgl2');
      const before = JSON.stringify(Array.from(renderer.readPixels()));
      const source = '@scene rejected { version: 0; sphere #orb; }';
      const originalSource = gl.shaderSource.bind(gl);
      gl.shaderSource = (shader, text) => originalSource(shader, text + '\ninvalid shader tokens');
      const compile = renderer.update(source);
      gl.shaderSource = originalSource;
      const afterCompile = JSON.stringify(Array.from(renderer.readPixels()));
      const originalParameter = gl.getProgramParameter.bind(gl);
      // Fault injection only for the link rejection branch; functional frames above use real GL statuses.
      gl.getProgramParameter = (program, pname) => pname === gl.LINK_STATUS ? false : originalParameter(program, pname);
      const link = renderer.update(source);
      gl.getProgramParameter = originalParameter;
      return { faultInjection: { compile: 'invalid tokens appended by shaderSource interceptor', link: 'LINK_STATUS forced false after real link' }, compileRejected: !compile.ok, linkRejected: !link.ok,
        compileMessage: String(compile.error), linkMessage: String(link.error),
        compilePixelsRetained: before === afterCompile,
        linkPixelsRetained: before === JSON.stringify(Array.from(renderer.readPixels())) };
    });
    assert(rejectedGpuUpdates.compileRejected && rejectedGpuUpdates.linkRejected);
    assert(rejectedGpuUpdates.compilePixelsRetained && rejectedGpuUpdates.linkPixelsRetained);
    const missingContext = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.getContext = () => null;
      try { window.gpuTest.api.mountScene(canvas, '@scene absent { version: 0; }'); return false; }
      catch { return true; }
    });
    assert(missingContext, 'Missing WebGL2 must fail explicitly');
    await page.evaluate(() => window.gpuTest.renderer.resize(320, 240));
    const resized = await capture('resize', fixtures.sphere);
    assert.deepEqual([resized.width, resized.height], [320, 240]);
    assert(resized.mask.foregroundRatio > .03);
    await page.evaluate(() => {
      const gl = window.gpuTest.canvas.getContext('webgl2');
      window.gpuTest.foreignBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, window.gpuTest.foreignBuffer);
      window.gpuTest.ownedProgram = gl.getParameter(gl.CURRENT_PROGRAM);
      window.gpuTest.ownedVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
      const deleted = [];
      for (const name of ['deleteBuffer', 'deleteShader', 'deleteProgram']) {
        const original = gl[name].bind(gl);
        gl[name] = (resource) => { deleted.push({ name, foreign: resource === window.gpuTest.foreignBuffer }); original(resource); };
      }
      window.gpuTest.deleted = deleted;
    });
    const disposed = await page.evaluate(() => {
      const { renderer, canvas } = window.gpuTest;
      renderer.dispose(); renderer.dispose();
      const failures = {};
      for (const [name, operation] of Object.entries({ readPixels: () => renderer.readPixels(),
        resize: () => renderer.resize(10, 10) })) {
        try { operation(); failures[name] = false; } catch { failures[name] = true; }
      }
      const gl = canvas.getContext('webgl2');
      return { ownedProgramReleased: !gl.isProgram(window.gpuTest.ownedProgram),
        ownedVaoReleased: !gl.isVertexArray(window.gpuTest.ownedVao),
        foreignBufferRetained: gl.isBuffer(window.gpuTest.foreignBuffer),
        failures, deleted: window.gpuTest.deleted, canvasRetained: canvas.isConnected, updateRejected: !renderer.update('@scene empty { version: 0; }').ok };
    });
    assert.deepEqual(disposed.failures, { readPixels: true, resize: true });
    assert(disposed.canvasRetained && disposed.updateRejected);
    assert(disposed.ownedProgramReleased && disposed.ownedVaoReleased && disposed.foreignBufferRetained);
    assert(disposed.deleted.some((entry) => entry.name === 'deleteProgram'));
    assert(disposed.deleted.every((entry) => !entry.foreign), 'Dispose must preserve host GL resources');
    const contextLoss = await page.evaluate(async () => {
      const { api } = window.gpuTest;
      const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
      const renderer = api.mountScene(canvas, '@scene loss { version: 0; }');
      const gl = canvas.getContext('webgl2');
      const extension = gl.getExtension('WEBGL_lose_context');
      if (!extension) throw new Error('Context loss control requires WEBGL_lose_context');
      const lost = new Promise((resolve) => canvas.addEventListener('webglcontextlost', resolve, { once: true }));
      extension.loseContext(); await lost;
      const result = renderer.update('@scene loss { version: 0; }');
      let readRejected = false, resizeRejected = false;
      try { renderer.readPixels(); } catch { readRejected = true; }
      try { renderer.resize(16, 16); } catch { resizeRejected = true; }
      renderer.dispose();
      return { updateRejected: !result.ok, readRejected, resizeRejected };
    });
    assert(contextLoss.updateRejected && contextLoss.readRejected && contextLoss.resizeRejected);
    assert.deepEqual(pageErrors, []); assert.deepEqual(unexpectedRequests, []);
    await writeFile(path.join(evidence, 'index.json'), JSON.stringify({ taskCommit: sha,
      integrationCommit: process.env.BAROCSS_GPU_INTEGRATION_SHA ?? null, browser: browser.version(), webgl: details,
      backend: 'software SwiftShader; functional evidence only', frames: retained,
      assertions: { sphere: true, box: true, combined: true, empty: true, colorUpdate: true, translationUpdate: true,
        invalidPreserved: preserved, rejectedGpuUpdates, missingContext, contextLoss, resize: true, disposal: disposed }, pageErrors, unexpectedRequests }, null, 2));
    console.log(`GPU browser evidence: ${evidence}`);
  } finally {
    if (browser) await browser.close();
    await running.close();
  }
});

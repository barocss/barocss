import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { startServer } from './server.mjs';

assert(process.env.PW_DIR && process.env.CHROME && process.env.BAROCSS_POLYGON_EVIDENCE);
const output = process.env.BAROCSS_POLYGON_EVIDENCE;
await mkdir(output, { recursive: true });
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
const server = await startServer();
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } }), errors = [], records = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.url + '/#sphere');
  await page.waitForFunction(() => window.examplePreview?.snapshot());
  const snapshot = () => page.evaluate(() => window.examplePreview.snapshot());
  const pixelHash = () => page.evaluate(async () => {
    const bytes = await crypto.subtle.digest('SHA-256', window.examplePreview.readPixels());
    return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  });
  const sphere = await snapshot(); assert.equal(sphere.id, 'sphere');
  assert.equal(sphere.scene.objects[0].kind, 'sphere');
  await page.screenshot({ path: path.join(output, 'sphere.png') });
  for (const id of ['cad-triangle-region', 'cad-l-region', 'cad-triangle-prism', 'cad-l-prism']) {
    await page.selectOption('#example', id);
    const state = await snapshot(); assert.equal(state.id, id);
    assert.equal(await page.locator('select').count(), 1);
    assert.equal(await page.locator('button,input,textarea,aside').count(), 0);
    assert(await page.locator('#error').isHidden());
    const native = state.native;
    assert.equal(native.authoring.sourceVersion, 0);
    assert.equal(native.authoring.region.solid, false);
    if (id === 'cad-l-region') {
      assert.equal(state.packet.positions.length / 3, 6); assert.equal(state.packet.indices.length / 3, 4);
      assert.equal(native.authoring.region.areaMM2, 7);
    }
    if (id === 'cad-l-prism') {
      assert.equal(state.packet.positions.length / 3, 36); assert.equal(state.packet.indices.length / 3, 20);
      assert.equal(native.preview.report.volumeMM3, 42); assert.equal(native.preview.report.areaMM2, 110);
      assert.deepEqual(state.packet.bounds, { min: [0, 0, 0], max: [4, 4, 6] });
      assert.equal(native.preview.report.topologyCertified, false);
    }
    const beforeHash = await pixelHash();
    await page.mouse.move(400, 300); await page.mouse.down(); await page.mouse.move(450, 330, { steps: 3 }); await page.mouse.up();
    const rotated = await snapshot(); assert.deepEqual(rotated.packet, state.packet); assert.deepEqual(rotated.native, native);
    assert.notEqual(await pixelHash(), beforeHash);
    await page.screenshot({ path: path.join(output, id + '.png') });
    if (id.startsWith('cad-l-')) {
      const gap = await page.evaluate(() => {
        const r = window.examplePreview.renderer, options = { ...r.options, camera: { ...r.options.camera, eye: [0, 0, 6], target: [0, 0, 0], up: [0, 1, 0] } };
        const result = r.update(r.packet, options); if (!result.ok) throw result.error;
        const c = document.getElementById('preview'), pixels = r.readPixels();
        const center = (Math.floor(c.height / 2) * c.width + Math.floor(c.width / 2)) * 4;
        return { center: Array.from(pixels.slice(center, center + 4)), background: Array.from(pixels.slice(0, 4)) };
      });
      assert.deepEqual(gap.center, gap.background, 'Actual concave missing quadrant must remain empty');
      await page.screenshot({ path: path.join(output, id + '-top.png') });
      state.missingQuadrantEmpty = true;
    }
    records.push(state);
  }
  await page.goto(server.url + '/workspace.html#box');
  await page.waitForFunction(() => window.boxWorkspace?.snapshot());
  assert.equal(await page.locator('#body-shape').inputValue(), 'workspace-box');
  await page.selectOption('#body-shape', 'sphere');
  await page.waitForURL(server.url + '/#sphere');
  await page.waitForFunction(() => window.examplePreview?.snapshot()?.id === 'sphere');
  assert.deepEqual(errors, []);
  const backend = await page.evaluate(() => {
    const gl = document.getElementById('preview').getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { version: gl.getParameter(gl.VERSION), renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
  });
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  await writeFile(path.join(output, 'index.json'), JSON.stringify({ head, backend, sphere, records,
    rootMinimal: true, workspaceShapeNavigation: true, nativePreservedOnOrbit: true, broaderValidation: 'deferred', errors }, null, 2) + '\n');
  console.log('Shapes rendered: GPU Sphere; actual native triangle/L regions and capped prisms; concave gap empty; orbit and workspace navigation passed.');
} finally { await browser.close(); await server.close(); }

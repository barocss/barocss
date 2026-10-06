import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { startServer } from './server.mjs';

assert(process.env.PW_DIR && process.env.CHROME && process.env.BAROCSS_MODEL_EVIDENCE);
const output = process.env.BAROCSS_MODEL_EVIDENCE;
await mkdir(output, { recursive: true });
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
const server = await startServer();
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 720 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.url);
  await page.waitForFunction(() => window.examplePreview?.snapshot());
  assert.equal(await page.locator('select').count(), 1);
  assert.equal(await page.locator('button,input,textarea').count(), 0);
  await page.selectOption('#example', 'workspace-box');
  await page.waitForURL(server.url + '/workspace.html#box');
  await page.waitForFunction(() => window.boxWorkspace?.snapshot());
  const state = () => page.evaluate(() => window.boxWorkspace.snapshot());
  const initial = await state();
  assert.equal(initial.evaluation.solidReport.volumeMM3, 24000);
  assert.equal(initial.evaluation.solidReport.areaMM2, 5200);
  assert.equal(initial.packet.positions.length, 72);
  assert.equal(initial.packet.indices.length, 36);
  assert.equal(initial.lineage.faces.length, 6);
  const pixelHash = () => page.evaluate(async () => {
    const digest = await crypto.subtle.digest('SHA-256', window.boxWorkspace.readPixels());
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  });
  const beforePixels = await pixelHash();
  await page.fill('#body-width', '45'); await page.click('#body-update');
  const updated = await state();
  assert.equal(updated.evaluation.solidReport.volumeMM3, 27000);
  assert.equal(updated.evaluation.solidReport.areaMM2, 5700);
  assert.notEqual(await pixelHash(), beforePixels);
  const downloadPromise = page.waitForEvent('download');
  await page.click('#body-save');
  const download = await downloadPromise, file = path.join(output, 'box.feature.json');
  await download.saveAs(file);
  const saved = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(saved.format, 'barocss-axis-rectangle-feature');
  assert.equal(saved.parameters.find(p => p.id === '_rect_w').valueMM, 45);
  assert(!Object.hasOwn(saved, 'model') && !Object.hasOwn(saved, 'packet') && !Object.hasOwn(saved, 'source'));
  await page.fill('#body-width', '60'); await page.click('#body-update');
  assert.equal((await state()).evaluation.solidReport.volumeMM3, 36000);
  await page.setInputFiles('#body-open', file);
  await page.waitForFunction(() => window.boxWorkspace.snapshot().evaluation.solidReport.volumeMM3 === 27000);
  const reopened = await state(); assert.deepEqual(reopened.document, saved);
  await page.fill('#body-width', '50'); await page.click('#body-update');
  const edited = await state();
  assert.equal(edited.evaluation.solidReport.volumeMM3, 30000);
  assert.equal(edited.evaluation.solidReport.areaMM2, 6200);
  const acceptedPixels = await pixelHash();
  await page.fill('#body-width', '0'); await page.click('#body-update');
  assert.deepEqual(await state(), edited);
  assert.equal(await pixelHash(), acceptedPixels);
  assert.match(await page.locator('#body-status').innerText(), /Cannot apply/);
  await page.click('#body-discard');
  const box = await page.locator('#body-preview').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 3 }); await page.mouse.up();
  const rotated = await state();
  assert.deepEqual(rotated.document, edited.document);
  assert.deepEqual(rotated.packet, edited.packet);
  assert(rotated.options.camera.eye[1] > edited.options.camera.eye[1]);
  assert.notEqual(await pixelHash(), acceptedPixels);
  let edgeEvidence;
  if (process.argv.includes('--edges')) {
    assert.equal(rotated.edgeOverlay.paths.length, 12);
    assert.equal(new Set(rotated.edgeOverlay.paths.map(p => p.id)).size, 12);
    assert(rotated.edgeOverlay.paths.every(p => p.points.length === 2));
    assert.equal(rotated.edgeLineage.paths.length, 12);
    const onHash = await pixelHash(), documentBefore = rotated.document, revisionBefore = rotated.revision;
    await page.uncheck('#body-edges');
    const off = await state();
    assert.equal(off.edgeOverlay, null);
    assert.deepEqual(off.document, documentBefore);
    assert.equal(off.revision, revisionBefore);
    assert.notEqual(await pixelHash(), onHash);
    await page.check('#body-edges');
    assert.equal(await pixelHash(), onHash);
    const beforeStale = await state(), beforeStaleHash = await pixelHash();
    const stale = await page.evaluate(() => {
      const r = window.boxWorkspace.renderer, overlay = r.edgeOverlay;
      overlay.packet.parameters[0] += .125; // same IDs/revision; valid but different packet data
      const result = r.setEdgeOverlay(overlay);
      return { ok: result.ok, error: result.error?.message };
    });
    assert.equal(stale.ok, false);
    assert.match(stale.error, /complete accepted mesh/);
    assert.deepEqual(await state(), beforeStale);
    assert.equal(await pixelHash(), beforeStaleHash);
    const occlusion = await page.evaluate(async () => {
      const gpu = await import('/gpu.js'), r = window.boxWorkspace.renderer;
      const options = { ...r.options, camera: { ...r.options.camera, eye: [0, 0, 6], target: [0, 0, 0], up: [0, 1, 0] } };
      const update = r.update(r.packet, options);
      if (!update.ok) throw update.error;
      const overlay = r.edgeOverlay, packet = r.packet, canvas = document.getElementById('body-preview');
      const zMin = packet.bounds.min[2], back = overlay.paths.find(path => path.points.every(point => point[2] === zMin) && path.points.every(point => point[1] === packet.bounds.min[1]));
      if (!back) throw Error('Actual rear native edge was not found');
      const midpoint = back.points[0].map((value, i) => (value + back.points[1][i]) / 2);
      const world = [...midpoint.map((value, i) => value * options.mmToSceneUnit + options.translate[i]), 1];
      const camera = gpu.prepareCamera(options.camera, canvas.width / canvas.height);
      const multiply = (matrix, vector) => [0, 1, 2, 3].map(row => vector.reduce((sum, value, col) => sum + matrix[col * 4 + row] * value, 0));
      const clip = multiply(camera.projection, multiply(camera.view, world));
      const x = Math.floor((clip[0] / clip[3] + 1) * canvas.width / 2), y = Math.floor((clip[1] / clip[3] + 1) * canvas.height / 2);
      const patch = bytes => {
        const values = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const offset = ((y + dy) * canvas.width + x + dx) * 4;
          values.push(...bytes.slice(offset, offset + 4));
        }
        return values;
      };
      const on = patch(r.readPixels());
      const removed = r.setEdgeOverlay(null); if (!removed.ok) throw removed.error;
      const off = patch(r.readPixels());
      const restored = r.setEdgeOverlay(overlay); if (!restored.ok) throw restored.error;
      return { edgeId: back.id, midpoint, pixel: [x, y], on, off, paths: overlay.paths.length };
    });
    assert.deepEqual(occlusion.on, occlusion.off, 'Rear native edge must be hidden by the front face');
    assert(occlusion.on[0] > 40, 'Rear-edge sample must show shaded fill');
    edgeEvidence = { paths: 12, noTriangulationDiagonals: true, toggleRetainedNative: true,
      staleSameIdentityPacketRejected: stale, rearEdgeOccluded: occlusion };
    await page.screenshot({ path: path.join(output, 'box-front-edges.png') });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(output, 'box-workspace.png') });
  await page.click('a[href="#surface"]');
  await page.locator('#primitive-create').waitFor({ state: 'visible' });
  assert(await page.locator('#primitive-create').isVisible());
  assert(await page.locator('#project-save').isVisible());
  assert(await page.evaluate(() => Boolean(window.cadPreview.snapshot()?.packet)));
  if (process.argv.includes('--edges')) {
    await page.check('#surface-edges');
    const surface = await page.evaluate(() => window.cadPreview.snapshot());
    assert.equal(surface.edgeLineage.paths.length, 4);
    assert.equal(await page.evaluate(() => window.cadPreview.renderer.edgeOverlay.paths.length), 4);
    edgeEvidence.surfaceNaturalBoundaries = surface.edgeLineage;
    await page.uncheck('#surface-edges');
  }
  await page.click('a[href="#box"]');
  await page.locator('#body-update').waitFor({ state: 'visible' });
  assert.deepEqual((await state()).document, edited.document);
  assert.deepEqual(errors, []);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  await writeFile(path.join(output, 'index.json'), JSON.stringify({ head, initial, updated, reopened, edited, rotated,
    source: 'Actual public native document evaluation and compiled Surface tessellation',
    actualDownload: download.suggestedFilename(), invalidWidthRetained: true, orbitRetainedNative: true,
    rootMinimal: true, legacyWorkspaceAccessible: true, edgeEvidence, broaderValidation: 'deferred', errors }, null, 2) + '\n');
  console.log('Box prototype passed: Create40×30×20 → Update45 → Save/Open → Edit50; invalid width retained; actual pixels/orbit; legacy tools accessible.');
} finally { await browser.close(); await server.close(); }

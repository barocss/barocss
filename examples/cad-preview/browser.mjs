import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { startServer } from './server.mjs';
import { fixtures, controlPointEdit, weightEdit, singularSource } from './fixtures.mjs';
import { readbackPng } from './png.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
function mask(bytes, width, height) {
  const background = bytes.slice(0, 4);
  let foreground = 0, sumX = 0, sumY = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4;
    if ([0, 1, 2].some(i => Math.abs(bytes[offset + i] - background[i]) > 12)) {
      foreground++; sumX += x; sumY += y;
    }
  }
  return { background, foreground, ratio: foreground / (width * height),
    x: foreground ? sumX / foreground : null, y: foreground ? sumY / foreground : null };
}

assert(process.env.CHROME, 'Installed CHROME is required');
assert(process.env.PW_DIR, 'Installed PW_DIR is required');
await access(process.env.CHROME);
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
const taskCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
const integrationCommit = process.env.BAROCSS_CAD_PREVIEW_INTEGRATION_SHA ?? null;
const evidence = process.env.BAROCSS_CAD_PREVIEW_BROWSER_EVIDENCE ?? `/Users/user/.barocss-ai/v3/cad-preview-504-${taskCommit.slice(0, 8)}`;
await mkdir(evidence, { recursive: true });
const server = await startServer(0);
let browser;
const errors = [], requests = [], cspViolations = [], frames = [], failures = [];
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true,
    args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const allowed = new Set(['/', '/index.html', '/app.mjs', '/pipeline.mjs', '/fixtures.mjs', '/style.css', '/cad.js', '/gpu.js', '/types.js', '/math.js', '/parser.js', '/iges.js', '/packet.js', '/preview.js']);
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== server.url || !allowed.has(url.pathname) || url.search) {
      requests.push(url.href); return route.abort();
    }
    return route.continue();
  });
  await page.addInitScript(() => {
    window.previewProbe = { resources: [], contexts: [], violations: [], compile: [], link: [], drawCalls: 0 };
    document.addEventListener('securitypolicyviolation', event => window.previewProbe.violations.push({
      directive: event.violatedDirective, blocked: event.blockedURI }));
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const gl = original.apply(this, args);
      if (args[0] !== 'webgl2' || !gl || window.previewProbe.contexts.includes(gl)) return gl;
      window.previewProbe.contexts.push(gl);
      const compile = gl.compileShader.bind(gl), link = gl.linkProgram.bind(gl), draw = gl.drawElements.bind(gl);
      gl.compileShader = shader => { compile(shader); window.previewProbe.compile.push(gl.getShaderParameter(shader, gl.COMPILE_STATUS)); };
      gl.linkProgram = program => { link(program); window.previewProbe.link.push(gl.getProgramParameter(program, gl.LINK_STATUS)); };
      gl.drawElements = (...params) => { draw(...params); window.previewProbe.drawCalls++; };
      for (const kind of ['Buffer', 'Shader', 'Program', 'VertexArray', 'Framebuffer', 'Renderbuffer', 'Texture']) {
        const method = `create${kind}`, create = gl[method].bind(gl);
        gl[method] = (...params) => {
          const resource = create(...params);
          if (resource) window.previewProbe.resources.push({ kind, resource, gl });
          return resource;
        };
      }
      return gl;
    };
  });
  const response = await page.goto(server.url);
  const csp = response.headers()['content-security-policy'];
  assert(csp && csp.includes("default-src 'none'") && !csp.includes('unsafe-inline') && !csp.includes('unsafe-eval'), 'Strict CSP required');
  await page.waitForFunction(() => window.cadPreview?.snapshot()?.packet);
  const backend = await page.evaluate(() => {
    const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2');
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    window.originalPreviewRenderer = window.cadPreview.renderer;
    return { version: gl.getParameter(gl.VERSION), renderer: gl.getParameter(gl.RENDERER),
      unmaskedRenderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null };
  });
  assert(/SwiftShader/i.test(backend.unmaskedRenderer ?? ''), 'Named software backend required');
  const cylinder = fixtures.find(fixture => fixture.id === 'cylinder') ?? fixtures[0];
  const settings = fixture => ({ surfaceId: fixture.id, countU: fixture.countU, countV: fixture.countV, options: fixture.options });
  async function apply(source, candidateSettings) {
    const result = await page.evaluate(async ({ source, settings }) => window.cadPreview.apply(source, settings), { source, settings: candidateSettings });
    assert(result.ok, result.error ?? 'Candidate was rejected');
  }
  async function capture(name) {
    const frame = await page.evaluate(async () => {
      const host = window.cadPreview, snapshot = host.snapshot();
      const cad = await import('/cad.js'), gpu = await import('/gpu.js');
      const { validatePreviewPacket: validateCadPacket } = cad, { validatePreviewPacket: validateGpuPacket } = gpu;
      const model = cad.parseModel(snapshot.source);
      const surface = model.objects.find(object => object.id === snapshot.packet.surfaceId);
      const generated = cad.tessellateSurface(surface, { ...snapshot.report.grid, revision: snapshot.revision });
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      validateCadPacket(generated.packet); validateGpuPacket(generated.packet);
      const gl = document.querySelector('canvas').getContext('webgl2');
      return { snapshot, shaders: host.shaders(), bytes: Array.from(host.readPixels()),
        width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, glError: gl.getError(),
        compile: [...window.previewProbe.compile], link: [...window.previewProbe.link], drawCalls: window.previewProbe.drawCalls,
        sourceReplayed: same(model, snapshot.model), packetReplayed: same(generated.packet, snapshot.packet),
        reportReplayed: same(generated.report, snapshot.report), sameRenderer: host.renderer === window.originalPreviewRenderer,
        rendererPacket: host.renderer.packet, rendererOptions: host.renderer.options, rendererRevision: host.renderer.revision };
    });
    assert(frame.sourceReplayed && frame.packetReplayed && frame.reportReplayed, 'Native source must reconstruct the accepted CAD packet/report');
    assert(frame.sameRenderer, 'Updates must reuse the mounted renderer');
    assert.deepEqual(frame.rendererPacket, frame.snapshot.packet);
    assert.deepEqual(frame.rendererOptions, frame.snapshot.options);
    assert.equal(frame.rendererRevision, frame.snapshot.revision);
    assert(frame.compile.length > 0 && frame.compile.every(Boolean)); assert(frame.link.length > 0 && frame.link.every(Boolean)); assert(frame.drawCalls > 0);
    assert.equal(frame.glError, 0); assert.equal(frame.bytes.length, frame.width * frame.height * 4);
    assert.equal(frame.snapshot.report.certified, false);
    const files = {
      [`${name}.source.css`]: frame.snapshot.source,
      [`${name}.model.json`]: json(frame.snapshot.model),
      [`${name}.packet.json`]: json(frame.snapshot.packet),
      [`${name}.report.json`]: json(frame.snapshot.report),
      [`${name}.display.json`]: json({ options: frame.snapshot.options, revision: frame.snapshot.revision,
        canonicalLengthUnit: 'mm', displayTransform: 'explicit uniform scale and translation; no GPU rotation' }),
      [`${name}.iges.json`]: json(frame.snapshot.iges),
      [`${name}.vert.glsl`]: frame.shaders.vertex,
      [`${name}.frag.glsl`]: frame.shaders.fragment,
      [`${name}.png`]: readbackPng(frame.bytes, frame.width, frame.height),
    };
    if (typeof frame.snapshot.iges?.iges === 'string') files[`${name}.igs`] = frame.snapshot.iges.iges;
    const hashes = {};
    for (const [filename, content] of Object.entries(files)) {
      await writeFile(path.join(evidence, filename), content); hashes[filename] = hash(content);
    }
    const record = { name, taskCommit, integrationCommit, browser: browser.version(), backend,
      physicalGpuEvidence: false, performanceEvidence: false, actualReadPixels: true,
      sourceReplayed: true, packetReplayed: true, reportReplayed: true, sameRenderer: true,
      revision: frame.snapshot.revision, buffer: [frame.width, frame.height], masks: mask(frame.bytes, frame.width, frame.height),
      readbackHash: hash(Uint8Array.from(frame.bytes)), hashes, sampledDeviationMM: frame.snapshot.report.maxSampledDeviationMM,
      certified: false, glError: frame.glError, compileStatuses: frame.compile, linkStatuses: frame.link, drawCalls: frame.drawCalls };
    await writeFile(path.join(evidence, `${name}.json`), json(record)); frames.push(record);
    return { ...frame, ...record };
  }
  // Exercise actual source editor controls before using the inspection API.
  await page.click('#control-edit');
  const uiControlSource = await page.locator('#source').inputValue();
  assert.equal(uiControlSource, controlPointEdit(cylinder.source));
  assert.equal(await page.evaluate(() => window.cadPreview.snapshot().source), uiControlSource);
  await page.selectOption('#fixture', 'cylinder');
  const downloadEvent = page.waitForEvent('download');
  const acceptedIges = await page.evaluate(() => window.cadPreview.snapshot().iges.iges);
  await page.click('#export');
  const download = await downloadEvent;
  const downloadedIges = await readFile(await download.path(), 'utf8');
  assert.equal(downloadedIges, acceptedIges, 'UI download must use the accepted native NURBS IGES');
  await writeFile(path.join(evidence, 'ui-native-export.igs'), downloadedIges);
  const ui = { sourceControls: true, nativeDownloadHash: hash(downloadedIges), nativeDownloadMatchedAccepted: true };
  await page.click('#weight-edit');
  assert.equal(await page.evaluate(() => window.cadPreview.snapshot().source), weightEdit(cylinder.source));
  await page.selectOption('#fixture', 'cylinder');
  await page.click('#fine');
  assert.equal(await page.evaluate(() => window.cadPreview.snapshot().report.vertexCount), 33 * 17);
  await page.locator('#source').fill('invalid source');
  const uiBefore = await page.evaluate(() => JSON.stringify(window.cadPreview.snapshot()));
  await page.click('#apply');
  assert.equal(await page.evaluate(() => JSON.stringify(window.cadPreview.snapshot())), uiBefore);
  await apply(cylinder.source, settings(cylinder));
  const initial = await capture('cylinder'); assert(initial.masks.foreground > 100);
  await apply(controlPointEdit(cylinder.source), settings(cylinder));
  const movedPoint = await capture('control-point-edit');
  assert.notDeepEqual(movedPoint.snapshot.model.objects, initial.snapshot.model.objects);
  assert.notDeepEqual(movedPoint.snapshot.packet.positions, initial.snapshot.packet.positions);
  assert.notEqual(movedPoint.readbackHash, initial.readbackHash);
  assert.deepEqual(initial.snapshot.packet.positions.slice((cylinder.countV - 1) * 3, cylinder.countV * 3), [10, 30, 0]);
  assert.deepEqual(movedPoint.snapshot.packet.positions.slice((cylinder.countV - 1) * 3, cylinder.countV * 3), [16, 30, 4]);
  await apply(weightEdit(cylinder.source), settings(cylinder));
  const weightedPoint = await capture('rational-weight-edit');
  assert.notDeepEqual(weightedPoint.snapshot.packet.positions, initial.snapshot.packet.positions);
  assert.notEqual(weightedPoint.readbackHash, initial.readbackHash);
  const midpoint = ((cylinder.countU - 1) / 2 * cylinder.countV + (cylinder.countV - 1) / 2) * 3;
  assert(Math.abs(initial.snapshot.packet.positions[midpoint] - Math.sqrt(50)) < 1e-10);
  assert(Math.abs(weightedPoint.snapshot.packet.positions[midpoint] - 35 / 6) < 1e-10);
  assert.deepEqual(weightedPoint.snapshot.packet.positions.slice(0, 3), initial.snapshot.packet.positions.slice(0, 3));
  await apply(cylinder.source, { ...settings(cylinder), countU: 33, countV: 17 });
  const density = await capture('grid-density');
  assert.equal(density.snapshot.report.vertexCount, 33 * 17);
  assert(density.sampledDeviationMM < initial.sampledDeviationMM, 'Finer cylinder grid must reduce the measured finite-probe deviation');
  await apply(cylinder.source, { ...settings(cylinder), options: { ...cylinder.options, mmToSceneUnit: cylinder.options.mmToSceneUnit * .5 } });
  const scale = await capture('explicit-scale'); assert(scale.masks.foreground < initial.masks.foreground);
  await apply(cylinder.source, { ...settings(cylinder), options: { ...cylinder.options,
    translate: cylinder.options.translate.map((value, axis) => value + (axis === 0 ? .5 : 0)) } });
  const translation = await capture('explicit-translation'); assert(translation.masks.x > initial.masks.x + 5);
  for (const fixture of fixtures.filter(fixture => fixture !== cylinder)) {
    await apply(fixture.source, settings(fixture)); const frame = await capture(fixture.id);
    if (fixture.id === 'flat_patch') {
      assert.deepEqual(frame.snapshot.packet.positions, [1,2,2,2,9,2,7,3,2,8,10,2]);
      assert.deepEqual(frame.snapshot.packet.parameters, [-2,4,-2,6,3,4,3,6]);
      assert.deepEqual(frame.snapshot.packet.indices, [0,2,1,2,3,1]);
    }
    assert(frame.masks.foreground > 20, `${fixture.id} must show actual geometry`);
  }
  await apply(cylinder.source, settings(cylinder));
  const deterministic = await capture('deterministic-replay');
  const comparable = packet => { const copy = structuredClone(packet); delete copy.revision; return copy; };
  assert.deepEqual(comparable(deterministic.snapshot.packet), comparable(initial.snapshot.packet));
  assert.deepEqual(deterministic.snapshot.model, initial.snapshot.model);
  assert.equal(deterministic.readbackHash, initial.readbackHash);
  assert(deterministic.revision > initial.revision);
  async function reject(name, source, candidateSettings, injection = null) {
    const result = await page.evaluate(async ({ source, settings, injection }) => {
      const host = window.cadPreview, renderer = host.renderer;
      const before = JSON.stringify({ snapshot: host.snapshot(), pixels: Array.from(host.readPixels()) });
      const original = renderer.update.bind(renderer);
      const gl = document.querySelector('canvas').getContext('webgl2');
      const originalDraw = gl.drawElements.bind(gl);
      if (injection === 'renderer') renderer.update = () => ({ ok: false, error: new Error('Injected renderer rejection') });
      if (injection === 'packet') renderer.update = (packet, options) => original({ ...packet, lengthUnit: 'cm' }, options);
      if (injection === 'draw') gl.drawElements = (...args) => originalDraw(0xdead, ...args.slice(1));
      let response;
      try { response = await host.apply(source, settings); }
      finally { renderer.update = original; gl.drawElements = originalDraw; }
      return { rejected: !response.ok, error: String(response.error),
        retained: before === JSON.stringify({ snapshot: host.snapshot(), pixels: Array.from(host.readPixels()) }), status: host.status };
    }, { source, settings: candidateSettings, injection });
    assert(result.rejected && result.retained, `${name}: ${json(result)}`);
    failures.push({ name, ...result });
  }
  await reject('parser', 'invalid source', settings(cylinder));
  await reject('singular-surface', singularSource(cylinder.source), settings(cylinder));
  await reject('scale', cylinder.source, { ...settings(cylinder), options: { ...cylinder.options, mmToSceneUnit: 0 } });
  await reject('grid-bound', cylinder.source, { ...settings(cylinder), countU: 65 });
  await reject('surface-selection', cylinder.source, { ...settings(cylinder), surfaceId: 'absent' });
  await reject('packet', cylinder.source, settings(cylinder), 'packet');
  await reject('renderer', cylinder.source, settings(cylinder), 'renderer');
  await reject('draw-gl-error', cylinder.source, settings(cylinder), 'draw');
  await apply(cylinder.source, { ...settings(cylinder), countU: 64, countV: 64 });
  const boundary = await capture('boundary-grid'); assert.equal(boundary.snapshot.report.vertexCount, 4096);
  const repeated = await page.evaluate(async ({ source, settings }) => {
    const host = window.cadPreview, live = () => window.previewProbe.resources.filter(({ kind, resource, gl }) => gl[`is${kind}`](resource)).length;
    const before = live();
    for (let i = 0; i < 12; i++) { const response = await host.apply(source, settings); if (!response.ok) throw Error(response.error); }
    return { count: 12, before, after: live(), sameRenderer: host.renderer === window.originalPreviewRenderer };
  }, { source: cylinder.source, settings: settings(cylinder) });
  assert(repeated.sameRenderer); assert.equal(repeated.before, repeated.after, 'Repeated updates must not retain obsolete GL resources');
  await page.evaluate(() => window.cadPreview.resize(320, 240));
  const resized = await capture('resize'); assert.deepEqual(resized.buffer, [320, 240]);
  const lifecycle = await page.evaluate(() => {
    const host = window.cadPreview, gl = document.querySelector('canvas').getContext('webgl2');
    const owned = window.previewProbe.resources.filter(item => item.gl === gl);
    const foreign = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, foreign); gl.bufferData(gl.ARRAY_BUFFER, 16, gl.STATIC_DRAW);
    gl.canvas.dispatchEvent(new PageTransitionEvent('pagehide'));
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
    host.dispose(); host.dispose();
    let readRejected = false; try { host.readPixels(); } catch { readRejected = true; }
    return { ownedCount: owned.length, ownedReleased: owned.every(({ kind, resource }) => !gl[`is${kind}`](resource)),
      foreignRetained: gl.isBuffer(foreign), readRejected, pagehideExercised: true, violations: window.previewProbe.violations };
  });
  assert(lifecycle.ownedCount > 0 && lifecycle.ownedReleased && lifecycle.foreignRetained && lifecycle.readRejected);
  cspViolations.push(...lifecycle.violations);
  await page.reload(); await page.waitForFunction(() => window.cadPreview?.snapshot()?.packet);
  const navigation = await page.evaluate(() => ({ accepted: Boolean(window.cadPreview.snapshot().packet),
    contextCount: window.previewProbe.contexts.length }));
  assert(navigation.accepted); assert.equal(navigation.contextCount, 1);
  const contextLoss = await page.evaluate(async () => {
    const host = window.cadPreview, gl = document.querySelector('canvas').getContext('webgl2');
    const extension = gl.getExtension('WEBGL_lose_context'); if (!extension) throw Error('Context loss extension required');
    const lost = new Promise(resolve => gl.canvas.addEventListener('webglcontextlost', resolve, { once: true }));
    extension.loseContext(); await lost;
    let readRejected = false; try { host.readPixels(); } catch { readRejected = true; }
    const snapshot = host.snapshot();
    const response = await host.apply(snapshot.source, { surfaceId: snapshot.packet.surfaceId, ...snapshot.report.grid, options: snapshot.options });
    const result = { readRejected, updateRejected: !response.ok, status: host.status, violations: window.previewProbe.violations };
    host.dispose(); return result;
  });
  assert(contextLoss.readRejected && contextLoss.updateRejected && /unavailable|lost/i.test(contextLoss.status));
  cspViolations.push(...contextLoss.violations);
  assert.deepEqual(errors, []); assert.deepEqual(requests, []); assert.deepEqual(cspViolations, []);
  const result = { taskCommit, integrationCommit, backend, backendDescription: 'ANGLE SwiftShader software WebGL2; functional composition only',
    packageArtifacts: { cad: hash(await readFile(path.join(repo, 'packages/barocss-cad/dist/index.js'))),
      gpu: hash(await readFile(path.join(repo, 'packages/barocss-gpu/dist/index.js'))) },
    frames, failures, repeated, lifecycle, navigation, contextLoss, ui, errors, requests, cspViolations, csp,
    deterministicFields: ['source', 'model', 'packet except host-issued revision', 'report', 'IGES', 'display options'],
    environmentFields: ['taskCommit', 'integrationCommit', 'browser', 'backend', 'evidence path'],
    limitations: ['Finite sampled deviation is not a global bound', 'Software rendering is not physical GPU performance',
      'This composition does not add IGES exchange certification; the independent OCP gate remains required'] };
  await writeFile(path.join(evidence, 'index.json'), json(result));
  const gallery = '<!doctype html><html lang="en"><meta charset="utf-8"><title>CAD to GPU retained evidence</title><h1>CAD to GPU retained evidence</h1><p>Actual framebuffer readbacks. ANGLE SwiftShader software WebGL2. Finite sampled distance is not a global bound.</p>' + frames.map(frame => `<section><h2>${frame.name}</h2><img src="${frame.name}.png" alt="${frame.name} actual readback"><p>Revision ${frame.revision}; sampled distance ${frame.sampledDeviationMM} mm. <a href="${frame.name}.source.css">Source</a> <a href="${frame.name}.model.json">Native model</a> <a href="${frame.name}.packet.json">Packet</a> <a href="${frame.name}.report.json">Report</a> <a href="${frame.name}.igs">IGES</a></p></section>`).join('') + '<p><a href="index.json">SHA manifest and controls</a></p></html>';
  await writeFile(path.join(evidence, 'gallery.html'), gallery);
  console.log(`CAD preview browser evidence: ${evidence}; ${frames.length} actual framebuffer states; ${failures.length} rejection controls`);
} finally {
  if (browser) await browser.close();
  await server.close();
}

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile, access, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { startServer } from './server.mjs';
import { fixtures, controlPointEdit, weightEdit, singularSource, constructionFixtures, vectorEdit, constructionWeightEdit } from './fixtures.mjs';
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
assert(process.env.BAROCSS_CAD_PREVIEW_BROWSER_EVIDENCE, 'A unique BAROCSS_CAD_PREVIEW_BROWSER_EVIDENCE directory is required');
const evidence = process.env.BAROCSS_CAD_PREVIEW_BROWSER_EVIDENCE;
await mkdir(evidence, { recursive: true });
const server = await startServer(0);
let browser;
const errors = [], requests = [], cspViolations = [], frames = [], failures = [], constructionFrames = [], constructionFailures = [];
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true,
    args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const allowed = new Set(['/derivatives.js', '/extrusion.js', '/compiler.js', '/', '/index.html', '/app.mjs', '/pipeline.mjs', '/fixtures.mjs', '/style.css', '/cad.js', '/gpu.js', '/types.js', '/math.js', '/parser.js', '/iges.js', '/packet.js', '/preview.js']);
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== server.url || !allowed.has(url.pathname) || url.search) {
      requests.push(url.href); return route.abort();
    }
    return route.continue();
  });
  await page.addInitScript(() => {
    window.previewProbe = { uniforms: [], resources: [], contexts: [], violations: [], compile: [], link: [], drawCalls: 0 };
    document.addEventListener('securitypolicyviolation', event => window.previewProbe.violations.push({
      directive: event.violatedDirective, blocked: event.blockedURI }));
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const gl = original.apply(this, args);
      if (args[0] !== 'webgl2' || !gl || window.previewProbe.contexts.includes(gl)) return gl;
      window.previewProbe.contexts.push(gl);
      const location = gl.getUniformLocation.bind(gl), names = new Map();
      gl.getUniformLocation = (program, name) => { const loc = location(program, name); if (loc) names.set(loc, name); return loc; };
      const matrix = gl.uniformMatrix4fv.bind(gl);
      gl.uniformMatrix4fv = (loc, transpose, value) => {
        window.previewProbe.uniforms.push({ name: names.get(loc), transpose, value: Array.from(value) });
        return matrix(loc, transpose, value);
      };
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
      const compiled = snapshot.sourceVersion === 1 ? cad.compileConstruction(snapshot.source) : null;
      const model = compiled ? compiled.model : cad.parseModel(snapshot.source);
      const surface = model.objects.find(object => object.id === snapshot.packet.surfaceId);
      const generated = cad.tessellateSurface(surface, { ...snapshot.report.grid, revision: snapshot.revision });
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      validateCadPacket(generated.packet); validateGpuPacket(generated.packet);
      const gl = document.querySelector('canvas').getContext('webgl2');
      return { snapshot, uniforms: structuredClone(window.previewProbe.uniforms), shaders: host.shaders(), bytes: Array.from(host.readPixels()),
        width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, glError: gl.getError(),
        compile: [...window.previewProbe.compile], link: [...window.previewProbe.link], drawCalls: window.previewProbe.drawCalls,
        sourceReplayed: same(model, snapshot.model), constructionsReplayed: !compiled || same(compiled.constructions, snapshot.constructions),
        selectedConstructionReplayed: !compiled || same(compiled.constructions.find(feature => feature.outputId === snapshot.packet.surfaceId), snapshot.selectedConstruction),
        exportReplayed: same(cad.exportIGES(model, [surface.id]), snapshot.iges), packetReplayed: same(generated.packet, snapshot.packet),
        reportReplayed: same(generated.report, snapshot.report), sameRenderer: host.renderer === window.originalPreviewRenderer,
        rendererPacket: host.renderer.packet, rendererOptions: host.renderer.options, rendererRevision: host.renderer.revision };
    });
    assert(frame.sourceReplayed && frame.constructionsReplayed && frame.selectedConstructionReplayed && frame.exportReplayed && frame.packetReplayed && frame.reportReplayed, 'Native source must reconstruct the accepted CAD packet/report');
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
      [`${name}.display.json`]: json({ options: frame.snapshot.options, revision: frame.snapshot.revision, viewRevision: frame.snapshot.viewRevision, uniforms: frame.uniforms,
        canonicalLengthUnit: 'mm', displayTransform: 'explicit uniform scale and translation; no GPU rotation' }),
      [`${name}.iges.json`]: json(frame.snapshot.iges),
      [`${name}.vert.glsl`]: frame.shaders.vertex,
      [`${name}.frag.glsl`]: frame.shaders.fragment,
      [`${name}.png`]: readbackPng(frame.bytes, frame.width, frame.height),
    };
    if (typeof frame.snapshot.iges?.iges === 'string') files[`${name}.igs`] = frame.snapshot.iges.iges;
    if (frame.snapshot.sourceVersion === 1) {
      files[`${name}.constructions.json`] = json(frame.snapshot.constructions);
      files[`${name}.selected-construction.json`] = json(frame.snapshot.selectedConstruction);
      const downloadEvent = page.waitForEvent('download');
      await page.click('#export');
      const download = await downloadEvent;
      const bytes = await readFile(await download.path(), 'utf8');
      assert.equal(bytes, frame.snapshot.iges.iges, 'Constructed download must match this exact accepted native export');
      files[`${name}.downloaded.igs`] = bytes;
    }
    const hashes = {};
    for (const [filename, content] of Object.entries(files)) {
      await writeFile(path.join(evidence, filename), content); hashes[filename] = hash(content);
    }
    const record = { name, taskCommit, integrationCommit, browser: browser.version(), backend,
      physicalGpuEvidence: false, performanceEvidence: false, actualReadPixels: true,
      sourceVersion: frame.snapshot.sourceVersion ?? 0, constructionsReplayed: frame.constructionsReplayed,
      selectedConstructionReplayed: frame.selectedConstructionReplayed, exportReplayed: frame.exportReplayed, downloadedMatchedAccepted: frame.snapshot.sourceVersion === 1,
      sourceReplayed: true, packetReplayed: true, reportReplayed: true, sameRenderer: true,
      revision: frame.snapshot.revision, viewRevision: frame.snapshot.viewRevision, uniforms: frame.uniforms, buffer: [frame.width, frame.height], masks: mask(frame.bytes, frame.width, frame.height),
      readbackHash: hash(Uint8Array.from(frame.bytes)), hashes, sampledDeviationMM: frame.snapshot.report.maxSampledDeviationMM,
      certified: false, glError: frame.glError, compileStatuses: frame.compile, linkStatuses: frame.link, drawCalls: frame.drawCalls };
    await writeFile(path.join(evidence, `${name}.json`), json(record)); (frame.snapshot.sourceVersion === 1 ? constructionFrames : frames).push(record);
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
  // These views consume the same accepted CAD-generated packet without a source action.
  const optics = eye => ({ eye, target: [0,0,0], up: [0,1,0], fovYDegrees: 45, near: .01, far: 100 });
  const views = [];
  for (const [name, eye] of [['front',[0,0,6]],['side',[6,0,0]],['oblique',[4,3,6]]]) {
    await page.click(`#camera-${name}`);
    const frame = await capture(`camera-${name}`); views.push(frame);
    assert.deepEqual(frame.snapshot.options.camera.eye, eye);
    assert(frame.masks.foreground > 20);
    assert.equal(frame.revision, deterministic.revision);
    for (const key of ['source','model','packet','report','iges']) assert.deepEqual(frame.snapshot[key], deterministic.snapshot[key], `Camera must preserve ${key}`);
  }
  assert.equal(new Set(views.map(view => view.viewRevision)).size, 3);
  assert.equal(new Set(views.map(view => view.readbackHash)).size, 3);
  for (const key of ['source.css','model.json','packet.json','report.json','iges.json'])
    assert.equal(new Set(views.map(view => view.hashes[`camera-${view.name.slice(7)}.${key}`])).size, 1, `${key} lineage must be identical across views`);
  await page.click('#camera-reset');
  const resetView = await capture('camera-reset');
  assert.equal(Object.hasOwn(resetView.snapshot.options, 'camera'), false);
  assert.equal(resetView.readbackHash, deterministic.readbackHash);
  assert.equal(resetView.revision, deterministic.revision);
  const opticsBefore = await page.evaluate(() => JSON.stringify({snapshot:window.cadPreview.snapshot(),pixels:Array.from(window.cadPreview.readPixels())}));
  await page.locator('#camera-fov').fill('9'); await page.click('#camera-apply');
  assert.equal(await page.evaluate(() => JSON.stringify({snapshot:window.cadPreview.snapshot(),pixels:Array.from(window.cadPreview.readPixels())})), opticsBefore);
  await page.locator('#camera-fov').fill('45');
  await page.click('#camera-apply');
  assert.equal(await page.evaluate(() => window.cadPreview.snapshot().revision), deterministic.revision);
  await page.click('#camera-reset');
  const cameraFailures = [];
  for (const [name, changes, injection] of [ ['eye-target',{eye:[0,0,0]}], ['up-parallel',{up:[0,0,1]}], ['near',{near:0}],
    ['far',{far:10001}], ['fov',{fovYDegrees:9}], ['matrix-gl-error',{},'uniform'], ['draw-gl-error',{},'draw'] ]) {
    const result = await page.evaluate(({camera,injection}) => {
      const host = window.cadPreview, gl = document.querySelector('canvas').getContext('webgl2');
      const snapshot = () => JSON.stringify({accepted:host.snapshot(),pixels:Array.from(host.readPixels())});
      const before = snapshot(), matrix = gl.uniformMatrix4fv.bind(gl), draw = gl.drawElements.bind(gl);
      if (injection === 'uniform') gl.uniformMatrix4fv = (loc,_transpose,value) => matrix(loc,false,new Float32Array(15));
      if (injection === 'draw') gl.drawElements = (...args) => draw(0xdead,...args.slice(1));
      let response; try { response = host.setCamera(camera); } finally { gl.uniformMatrix4fv = matrix; gl.drawElements = draw; }
      return {rejected:!response.ok,error:String(response.error),retained:snapshot()===before};
    }, {camera:{...optics([0,0,6]),...changes},injection});
    assert(result.rejected && result.retained, `${name}: ${json(result)}`); cameraFailures.push({name,...result});
  }
  const cameraLineage = {sameGeometryRevision:deterministic.revision,viewRevisions:views.map(view=>view.viewRevision),
    nativeIdentityAcrossViews:true,distinctActualPixels:true,resetDefault:true,failures:cameraFailures};
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
    (candidateSettings.sourceVersion === 1 || name.startsWith('construction-') ? constructionFailures : failures).push({ name, ...result });
  }
  await reject('parser', 'invalid source', settings(cylinder));
  await reject('singular-surface', singularSource(cylinder.source), settings(cylinder));
  await reject('scale', cylinder.source, { ...settings(cylinder), options: { ...cylinder.options, mmToSceneUnit: 0 } });
  await reject('grid-bound', cylinder.source, { ...settings(cylinder), countU: 65 });
  await reject('surface-selection', cylinder.source, { ...settings(cylinder), surfaceId: 'absent' });
  await reject('packet', cylinder.source, settings(cylinder), 'packet');
  await reject('renderer', cylinder.source, settings(cylinder), 'renderer');
  await reject('draw-gl-error', cylinder.source, settings(cylinder), 'draw');
  // Explicit v1 UI selection reaches the actual built compiler and selected native output.
  const constructed = constructionFixtures.find(value => value.id === 'wall');
  const asymmetric = constructionFixtures.find(value => value.id === 'oblique_wall');
  const constructionSettings = fixture => ({ ...settings(fixture), sourceVersion: 1 });
  await page.selectOption('#fixture', constructed.id);
  assert.equal(await page.locator('#source-version').inputValue(), '1');
  const versionBefore = await page.evaluate(() => JSON.stringify({ accepted: window.cadPreview.snapshot(), pixels: Array.from(window.cadPreview.readPixels()) }));
  await page.selectOption('#source-version', '0');
  assert.equal(await page.evaluate(() => JSON.stringify({ accepted: window.cadPreview.snapshot(), pixels: Array.from(window.cadPreview.readPixels()) })), versionBefore, 'Version choice alone cannot adopt geometry');
  assert.equal(await page.locator('#source-version').inputValue(), '1', 'Rejected UI version/source choice must restore the accepted version');
  const constructedInitial = await capture('construction-cylinder');
  assert.equal(constructedInitial.snapshot.sourceVersion, 1);
  assert.equal(constructedInitial.snapshot.model.version, 0);
  assert.equal(constructedInitial.snapshot.packet.surfaceId, 'wall');
  assert(constructedInitial.masks.foreground > 20);
  await page.click('#vector-edit');
  assert.equal(await page.locator('#source').inputValue(), vectorEdit(constructed.source));
  const editedVector = await capture('construction-vector-edit');
  assert.notDeepEqual(editedVector.snapshot.packet.bounds, constructedInitial.snapshot.packet.bounds);
  assert.notEqual(editedVector.readbackHash, constructedInitial.readbackHash);
  await page.selectOption('#fixture', constructed.id);
  await page.click('#weight-edit');
  assert.equal(await page.locator('#source').inputValue(), constructionWeightEdit(constructed.source));
  const editedWeight = await capture('construction-weight-edit');
  assert.notDeepEqual(editedWeight.snapshot.packet.positions, constructedInitial.snapshot.packet.positions);
  assert.notEqual(editedWeight.readbackHash, constructedInitial.readbackHash);
  for (const frame of [editedVector, editedWeight]) {
    assert.equal(frame.snapshot.selectedConstruction.outputId, constructedInitial.snapshot.selectedConstruction.outputId);
    assert.equal(frame.snapshot.selectedConstruction.inputId, constructedInitial.snapshot.selectedConstruction.inputId);
    assert.equal(frame.snapshot.selectedConstruction.operation, constructedInitial.snapshot.selectedConstruction.operation);
  }
  await page.selectOption('#fixture', asymmetric.id);
  const obliqueConstruction = await capture('construction-asymmetric');
  assert(obliqueConstruction.masks.foreground > 20);
  const constructionViews = [];
  for (const name of ['front', 'side', 'oblique']) {
    await page.click(`#camera-${name}`);
    const frame = await capture(`construction-camera-${name}`); constructionViews.push(frame);
    assert.equal(frame.revision, obliqueConstruction.revision);
    for (const key of ['source', 'sourceVersion', 'constructions', 'selectedConstruction', 'model', 'packet', 'report', 'iges'])
      assert.deepEqual(frame.snapshot[key], obliqueConstruction.snapshot[key], `Constructed camera must preserve ${key}`);
  }
  assert.equal(new Set(constructionViews.map(frame => frame.viewRevision)).size, 3);
  assert.equal(new Set(constructionViews.map(frame => frame.readbackHash)).size, 3);
  for (const suffix of ['source.css', 'constructions.json', 'selected-construction.json', 'model.json', 'packet.json', 'report.json', 'iges.json', 'igs', 'downloaded.igs'])
    assert.equal(new Set(constructionViews.map(frame => frame.hashes[`${frame.name}.${suffix}`])).size, 1, `${suffix} must remain identical across construction views`);
  const constructionViewFailures = [];
  for (const injection of ['invalid-camera', 'uniform', 'draw']) {
    const result = await page.evaluate(injection => {
      const host = window.cadPreview, gl = document.querySelector('canvas').getContext('webgl2');
      const snapshot = () => JSON.stringify({ accepted: host.snapshot(), pixels: Array.from(host.readPixels()) });
      const before = snapshot(), matrix = gl.uniformMatrix4fv.bind(gl), draw = gl.drawElements.bind(gl);
      if (injection === 'uniform') gl.uniformMatrix4fv = (loc, _transpose) => matrix(loc, false, new Float32Array(15));
      if (injection === 'draw') gl.drawElements = (...args) => draw(0xdead, ...args.slice(1));
      const camera = structuredClone(host.snapshot().options.camera);
      if (injection === 'invalid-camera') camera.near = 0;
      let response; try { response = host.setCamera(camera); } finally { gl.uniformMatrix4fv = matrix; gl.drawElements = draw; }
      return { rejected: !response.ok, retained: snapshot() === before, error: String(response.error) };
    }, injection);
    assert(result.rejected && result.retained, `Constructed view ${injection}: ${json(result)}`);
    constructionViewFailures.push({ injection, ...result });
  }
  await page.selectOption('#fixture', constructed.id);
  await page.click('#camera-side');
  const keptCamera = await page.evaluate(() => window.cadPreview.snapshot().options.camera);
  await page.click('#vector-edit');
  assert.deepEqual(await page.evaluate(() => window.cadPreview.snapshot().options.camera), keptCamera, 'Construction source edit must retain selected camera');
  await reject('construction-version-v0', constructed.source, { ...constructionSettings(constructed), sourceVersion: 0 });
  await reject('construction-version-unsupported', constructed.source, { ...constructionSettings(constructed), sourceVersion: 2 });
  await reject('construction-version-v1-legacy', cylinder.source, constructionSettings(constructed));
  await reject('construction-reference', constructed.source.replace(/curve: [^;]+;/, 'curve: #missing;'), constructionSettings(constructed));
  await reject('construction-operation', constructed.source.replace('@extrude', '@revolve'), constructionSettings(constructed));
  await reject('construction-field', constructed.source.replace('vector:', 'unexpected: 1; vector:'), constructionSettings(constructed));
  await reject('construction-duplicate-id', constructed.source.replace('@extrude #wall', '@extrude #arc'), constructionSettings(constructed));
  await reject('construction-missing-id', constructed.source.replace('@extrude #wall', '@extrude'), constructionSettings(constructed));
  await reject('construction-singular-preview', constructed.source.replace('[0,10,0]', '[10,0,0]').replace('weights: [1,0.7071067811865476,1]', 'weights: [1,1,1]'), constructionSettings(constructed));
  await reject('construction-singular', constructed.source.replace('[0,0,30]', '[0,0,0]'), constructionSettings(constructed));
  await reject('construction-surface-selection', constructed.source, { ...constructionSettings(constructed), surfaceId: 'arc' });
  await reject('construction-renderer', constructed.source, constructionSettings(constructed), 'renderer');
  await reject('construction-draw-gl-error', constructed.source, constructionSettings(constructed), 'draw');
  const constructedRepeated = await page.evaluate(async ({ sources, settings }) => {
    const host = window.cadPreview, live = () => window.previewProbe.resources.filter(({ kind, resource, gl }) => gl[`is${kind}`](resource)).length;
    const before = live();
    for (let i = 0; i < 12; i++) { const response = await host.apply(sources[i % sources.length], settings); if (!response.ok) throw Error(response.error); }
    return { count: 12, before, after: live(), sameRenderer: host.renderer === window.originalPreviewRenderer };
  }, { sources: [constructed.source, vectorEdit(constructed.source), constructionWeightEdit(constructed.source)], settings: constructionSettings(constructed) });
  assert(constructedRepeated.sameRenderer); assert.equal(constructedRepeated.before, constructedRepeated.after);
  const constructionLineage = { nativeIdentityAcrossViews: true, distinctActualPixels: true, cameraNativeHashesPreserved: true, viewFailures: constructionViewFailures,
    sourceEditPreservedCamera: true, viewRevisions: constructionViews.map(frame => frame.viewRevision), repeated: constructedRepeated };
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
  async function disposeCheck() { return page.evaluate(() => {
    const host = window.cadPreview, gl = document.querySelector('canvas').getContext('webgl2');
    const owned = window.previewProbe.resources.filter(item => item.gl === gl);
    const foreign = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, foreign); gl.bufferData(gl.ARRAY_BUFFER, 16, gl.STATIC_DRAW);
    gl.canvas.dispatchEvent(new PageTransitionEvent('pagehide'));
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
    host.dispose(); host.dispose();
    let readRejected = false; try { host.readPixels(); } catch { readRejected = true; }
    return { ownedCount: owned.length, ownedReleased: owned.every(({ kind, resource }) => !gl[`is${kind}`](resource)),
      foreignRetained: gl.isBuffer(foreign), readRejected, pagehideExercised: true, violations: window.previewProbe.violations };
  }); }
  const lifecycle = await disposeCheck();
  assert(lifecycle.ownedCount > 0 && lifecycle.ownedReleased && lifecycle.foreignRetained && lifecycle.readRejected);
  cspViolations.push(...lifecycle.violations);
  await page.reload(); await page.waitForFunction(() => window.cadPreview?.snapshot()?.packet);
  const navigation = await page.evaluate(() => ({ accepted: Boolean(window.cadPreview.snapshot().packet),
    contextCount: window.previewProbe.contexts.length }));
  assert(navigation.accepted); assert.equal(navigation.contextCount, 1);
  await apply(asymmetric.source, constructionSettings(asymmetric));
  const constructionLifecycle = await disposeCheck();
  assert(constructionLifecycle.ownedCount > 0 && constructionLifecycle.ownedReleased && constructionLifecycle.foreignRetained && constructionLifecycle.readRejected);
  cspViolations.push(...constructionLifecycle.violations);
  await page.reload(); await page.waitForFunction(() => window.cadPreview?.snapshot()?.packet);
  async function loseContextCheck() { return page.evaluate(async () => {
    const host = window.cadPreview, gl = document.querySelector('canvas').getContext('webgl2');
    const extension = gl.getExtension('WEBGL_lose_context'); if (!extension) throw Error('Context loss extension required');
    const lost = new Promise(resolve => gl.canvas.addEventListener('webglcontextlost', resolve, { once: true }));
    extension.loseContext(); await lost;
    let readRejected = false; try { host.readPixels(); } catch { readRejected = true; }
    const snapshot = host.snapshot();
    const response = await host.apply(snapshot.source, { surfaceId: snapshot.packet.surfaceId, sourceVersion: snapshot.sourceVersion ?? 0, ...snapshot.report.grid, options: snapshot.options });
    const result = { readRejected, updateRejected: !response.ok, status: host.status, violations: window.previewProbe.violations };
    host.dispose(); return result;
  }); }
  const contextLoss = await loseContextCheck();
  assert(contextLoss.readRejected && contextLoss.updateRejected && /unavailable|lost/i.test(contextLoss.status));
  cspViolations.push(...contextLoss.violations);
  await page.reload(); await page.waitForFunction(() => window.cadPreview?.snapshot()?.packet);
  await apply(asymmetric.source, constructionSettings(asymmetric));
  const constructionContextLoss = await loseContextCheck();
  assert(constructionContextLoss.readRejected && constructionContextLoss.updateRejected && /unavailable|lost/i.test(constructionContextLoss.status));
  cspViolations.push(...constructionContextLoss.violations);
  assert.deepEqual(errors, []); assert.deepEqual(requests, []); assert.deepEqual(cspViolations, []);
  const packageModules = {};
  for (const packageName of ['barocss-cad', 'barocss-gpu']) {
    const dir = path.join(repo, 'packages', packageName, 'dist');
    for (const filename of (await readdir(dir)).filter(name => name.endsWith('.js')).sort()) {
      const relative = `packages/${packageName}/dist/${filename}`; packageModules[relative] = hash(await readFile(path.join(repo, relative)));
    }
  }
  const sourceModules = {};
  const exampleFiles = execFileSync('git', ['ls-files', 'examples/cad-preview'], { cwd: repo, encoding: 'utf8' }).trim().split('\n');
  for (const relative of exampleFiles) sourceModules[relative] = hash(await readFile(path.join(repo, relative)));
  const result = { taskCommit, integrationCommit, backend, packageModules, sourceModules, backendDescription: 'ANGLE SwiftShader software WebGL2; functional composition only',
    packageArtifacts: { cad: hash(await readFile(path.join(repo, 'packages/barocss-cad/dist/index.js'))),
      gpu: hash(await readFile(path.join(repo, 'packages/barocss-gpu/dist/index.js'))) },
    frames, constructionFrames, constructionFailures, constructionLineage, failures, cameraLineage, repeated, lifecycle, constructionLifecycle, navigation, contextLoss, constructionContextLoss, ui, errors, requests, cspViolations, csp,
    deterministicFields: ['source', 'model', 'packet except host-issued revision', 'report', 'IGES', 'display options'],
    environmentFields: ['taskCommit', 'integrationCommit', 'browser', 'backend', 'evidence path'],
    limitations: ['Finite sampled deviation is not a global bound', 'Surfaces remain open; no solid, topology, STEP, or manufacturing claim', 'Software rendering is not physical GPU performance',
      'This composition does not add IGES exchange certification; the independent OCP gate remains required'] };
  await writeFile(path.join(evidence, 'index.json'), json(result));
  const gallery = '<!doctype html><html lang="en"><meta charset="utf-8"><title>CAD to GPU retained evidence</title><h1>CAD to GPU retained evidence</h1><p>Actual framebuffer readbacks. ANGLE SwiftShader software WebGL2. Finite sampled distance is not a global bound. Surfaces remain open; no solid, topology, STEP, or manufacturing claim.</p>' + [...frames, ...constructionFrames].map(frame => `<section><h2>${frame.name}</h2><img src="${frame.name}.png" alt="${frame.name} actual readback"><p>Revision ${frame.revision}; sampled distance ${frame.sampledDeviationMM} mm. <a href="${frame.name}.source.css">Source</a> <a href="${frame.name}.model.json">Native model</a> ${frame.sourceVersion === 1 ? `<a href="${frame.name}.constructions.json">Construction history</a> <a href="${frame.name}.selected-construction.json">Selected feature</a> <a href="${frame.name}.downloaded.igs">Actual download</a>` : ''} <a href="${frame.name}.display.json">Camera and view</a> <a href="${frame.name}.packet.json">Packet</a> <a href="${frame.name}.report.json">Report</a> <a href="${frame.name}.igs">IGES</a></p></section>`).join('') + '<p><a href="index.json">SHA manifest and controls</a></p></html>';
  await writeFile(path.join(evidence, 'gallery.html'), gallery);
  console.log(`CAD preview browser evidence: ${evidence}; ${frames.length + constructionFrames.length} actual framebuffer states; ${failures.length} legacy and ${constructionFailures.length} construction rejection controls`);
} finally {
  if (browser) await browser.close();
  await server.close();
}

import { runSource2Browser } from './source2-browser.mjs';
import { runBoxBrowser } from './box-browser.mjs';
import { runHistoryBrowser } from './history-browser.mjs';
import { runProjectBrowser } from './project-browser.mjs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile, access, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { startServer } from './server.mjs';
import { fixtures, controlPointEdit, weightEdit, singularSource, constructionFixtures, vectorEdit, constructionWeightEdit, objectFixtures, parameterFixture } from './fixtures.mjs';
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
const errors = [], requests = [], cspViolations = [], frames = [], failures = [], constructionFrames = [], constructionFailures = [], objectFrames = [], objectFailures = [], parameterFrames = [], parameterFailures = [], primitiveFrames = [];
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true,
    args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const cadModuleRequests = new Set();
  page.on('request', request => cadModuleRequests.add(new URL(request.url()).pathname));
  const allowed = new Set(['/screen-ray.mjs', '/cutout-workspace.mjs', '/native-topology-preview.mjs', '/xy-polygon-prism-shell-hole-ray-query.js', '/xy-polygon-prism-hole-document.js', '/xy-polygon-prism-shell-hole-preview.js', '/xy-polygon-prism-shell-hole.js', '/xy-polygon-planar-face-hole-preview.js', '/xy-polygon-planar-face-hole.js', '/xy-polygon-prism-ray-query.js', '/xy-polygon-prism-shell-preview.js', '/xy-polygon-prism-shell.js', '/xy-polygon-planar-face.js', '/polygon-workspace.mjs', '/xy-polygon-prism-document.js', '/xy-polygon-prism-preview.js', '/xy-polygon-preview.js', '/cad-edge-overlay.mjs', '/xy-polygon-region.js', '/body-workspace.mjs', '/body-workspace.css', '/xy-linear-sketch.js', '/axis-rectangle-feature-document.js', '/axis-rectangle-extrusion.js', '/curve-source.js', '/xy-arc.js', '/xy-profile.js', '/workspace.html','/expression-parser.js', '/parameter-semantics.js', '/data-copy.js', '/model-compiler.js', '/source-ast.js', '/semantic-model.js', '/lower-model.js', '/construction-types.js', '/extrusion-validation.js', '/box-preview.mjs', '/box-solid.js', '/history.mjs', '/box-shell.js', '/project.mjs', '/orthogonal-adjacency.js', '/primitives.mjs', '/adjacency.js', '/orbit.mjs', '/face.js', '/parameters.mjs', '/boundary.js', '/inspector.mjs', '/derivatives.js', '/extrusion.js', '/', '/index.html', '/app.mjs', '/pipeline.mjs', '/fixtures.mjs', '/style.css', '/cad.js', '/gpu.js', '/types.js', '/math.js', '/iges.js', '/packet.js', '/preview.js']);
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
  const response = await page.goto(server.url+'/workspace.html');
  const csp = response.headers()['content-security-policy'];
  assert(csp && csp.includes("default-src 'none'") && !csp.includes('unsafe-inline') && !csp.includes('unsafe-eval'), 'Strict CSP required');
  await page.waitForFunction(() => window.cadPreview?.snapshot()?.packet);
  assert.ok(cadModuleRequests.has('/xy-profile.js'), 'CAD index must load exact native profile module');
  assert.ok(cadModuleRequests.has('/curve-source.js'), 'CAD profile and arc must load exact source adoption module');
  assert.ok(cadModuleRequests.has('/xy-arc.js'), 'CAD index must load exact native arc module');
  assert.ok(cadModuleRequests.has('/axis-rectangle-extrusion.js'), 'CAD index must load exact native rectangle extrusion module');
  assert.ok(cadModuleRequests.has('/box-solid.js'), 'CAD index must load the exact box-solid module');
  assert.ok(cadModuleRequests.has('/box-shell.js'), 'CAD index must load the exact box-shell module');
  assert.ok(cadModuleRequests.has('/orthogonal-adjacency.js'), 'CAD index must load the exact orthogonal adjacency module');
  assert.ok(cadModuleRequests.has('/adjacency.js'), 'CAD index must load the exact adjacency module');
  assert.ok(cadModuleRequests.has('/face.js'), 'CAD index must load the exact face module');
  assert.ok(cadModuleRequests.has('/derivatives.js'), 'Face dependency must use the existing derivatives route');
  assert.ok(cadModuleRequests.has('/boundary.js'), 'CAD index must load the exact boundary module');
  assert.ok(cadModuleRequests.has('/math.js'), 'Boundary dependency must use the existing static math route');
  const backend = await page.evaluate(() => {
    const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2');
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    window.originalPreviewRenderer = window.cadPreview.renderer;
    return { version: gl.getParameter(gl.VERSION), renderer: gl.getParameter(gl.RENDERER),
      unmaskedRenderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null };
  });
  assert(/SwiftShader/i.test(backend.unmaskedRenderer ?? ''), 'Named software backend required');
  // UI screenshots are separate from GPU readback and exchange artifacts.
  const baselineDir=process.env.BAROCSS_CAD_PREVIEW_BASELINE_UI??'/Users/user/.barocss-ai/v3/ui-513-baseline';
  const baselineIndexBytes=await readFile(path.join(baselineDir,'index.json'));
  const baselineUI=JSON.parse(baselineIndexBytes);
  assert.equal(baselineUI.head,'3b5e3acbf9fdb902d2d1381809e7e4edebd2a203');
  const originalNativeBytes=await readFile(process.env.BAROCSS_CAD_PREVIEW_BASELINE_NATIVE??'/Users/user/.barocss-ai/v3/ui-513-native-baseline/model.json');
  const originalNative=JSON.parse(originalNativeBytes);
  const originalNativeHash=hash(JSON.stringify(originalNative));
  const {spans:removedSourceMetadata,...originalPhysicalModel}=originalNative;
  assert(removedSourceMetadata);
  await writeFile(path.join(evidence,'ui-original-native.json'),originalNativeBytes);
  for(const name of ['model-compiler','source-ast','semantic-model','lower-model','extrusion-validation','expression-parser','parameter-semantics','data-copy'])assert(cadModuleRequests.has('/'+name+'.js'));
  for(const name of ['parser','compiler','legacy-diagnostics'])assert(!cadModuleRequests.has('/'+name+'.js'));
  const uiScreens=[];
  for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844]]){
    await page.setViewportSize({width,height});
    const layout=await page.evaluate(()=>{const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};const labels=[...document.querySelectorAll('input,select,textarea')].every(control=>control.labels.length>0);const ids=[...document.querySelectorAll('[id]')].map(el=>el.id);return{overflow:document.documentElement.scrollWidth>innerWidth,viewport:rect('preview'),objects:rect('objects'),download:rect('export'),camera:rect('camera-front'),sourceCollapsed:!document.getElementById('source-panel').open,diagnosticsCollapsed:!document.getElementById('diagnostics-panel').open,allControlsLabelled:labels,uniqueIds:ids.length===new Set(ids).size,heading:document.getElementById('scene-title').textContent};});
    assert.equal(layout.overflow,false);assert(layout.allControlsLabelled&&layout.uniqueIds);assert(layout.sourceCollapsed&&layout.diagnosticsCollapsed);
    assert(layout.viewport.width>=300&&layout.viewport.height>=220&&layout.viewport.right<=width+1&&layout.viewport.bottom<=height);
    if(name==='desktop'){assert(layout.objects.right<=width&&layout.camera.bottom<=height&&layout.download.bottom<=height);}
    const native=await page.evaluate(()=>({snapshot:window.cadPreview.snapshot(),bytes:Array.from(window.cadPreview.readPixels())}));
    const before=baselineUI.records.find(record=>record.name===name);assert(before);assert.equal(hash(native.snapshot.source),before.sourceHash);assert.equal(originalNativeHash,before.nativeHash);assert.deepEqual(native.snapshot.model,originalPhysicalModel);assert.equal(hash(Uint8Array.from(native.bytes)),before.readbackHash,'Layout must preserve the baseline framebuffer');
    const filename=`${name}-after.ui.png`;await page.screenshot({path:path.join(evidence,filename),fullPage:true,animations:'disabled'});
    const baselineBytes=await readFile(path.join(baselineDir,before.filename));assert.equal(hash(baselineBytes),before.sha256);const baselineFile=`${name}-before.ui.png`;await writeFile(path.join(evidence,baselineFile),baselineBytes);
    uiScreens.push({name,viewport:{width,height},baselineHead:baselineUI.head,head:taskCommit,backend,layout,before:{file:baselineFile,sha256:before.sha256},after:{file:filename,sha256:hash(await readFile(path.join(evidence,filename)))},sourceHash:before.sourceHash,originalNativeHash:before.nativeHash,nativeHash:hash(JSON.stringify(native.snapshot.model)),nativeComparison:'same physical model; former spans field moved to AST/IR',readbackHash:before.readbackHash});
  }
  await page.setViewportSize({width:1440,height:900});
  const sourceSummary=page.locator('#source-panel > summary');await sourceSummary.focus();await sourceSummary.press('Enter');assert.equal(await page.locator('#source-panel').getAttribute('open'),'');
  await sourceSummary.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'source-version');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'surface');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'source');
  const acceptedUI=await page.evaluate(()=>({snapshot:window.cadPreview.snapshot(),pixels:Array.from(window.cadPreview.readPixels()),title:document.getElementById('scene-title').textContent}));
  await page.fill('#source','invalid pending source');await page.click('#apply');
  const rejectedUI=await page.evaluate(()=>({snapshot:window.cadPreview.snapshot(),pixels:Array.from(window.cadPreview.readPixels()),title:document.getElementById('scene-title').textContent,pending:document.getElementById('editor-state').textContent,invalid:document.getElementById('source').getAttribute('aria-invalid')}));
  assert.deepEqual(rejectedUI.snapshot,acceptedUI.snapshot);assert.deepEqual(rejectedUI.pixels,acceptedUI.pixels);assert.equal(rejectedUI.title,acceptedUI.title);assert(/Pending/.test(rejectedUI.pending));assert.equal(rejectedUI.invalid,'true');
  await page.click('#discard-source');assert.equal(await page.locator('#source').inputValue(),acceptedUI.snapshot.source);
  await page.selectOption('#fixture','wall');
  await page.click('[data-object-id="arc"] [data-action="inspect"]');
  const focus=await page.evaluate(()=>({action:document.activeElement.dataset.action,id:document.activeElement.closest('[data-object-id]')?.dataset.objectId,properties:document.getElementById('properties').textContent,context:document.getElementById('inspected-context').textContent,history:document.getElementById('creation-history').textContent}));
  assert.equal(focus.action,'inspect');assert.equal(focus.id,'arc');assert(/arc/.test(focus.context)&&/wall/.test(focus.context));assert(/Degree/.test(focus.properties)&&/Original domains/.test(focus.properties)&&/Weight range/.test(focus.properties));assert(/extrude/.test(focus.history));
  await page.locator('#diagnostics-panel > summary').focus();await page.locator('#diagnostics-panel > summary').press('Enter');assert.equal(await page.locator('#diagnostics-panel').getAttribute('open'),'');
  await page.screenshot({path:path.join(evidence,'desktop-construction.ui.png'),fullPage:true,animations:'disabled'});
  const constructionScreen={file:'desktop-construction.ui.png',sha256:hash(await readFile(path.join(evidence,'desktop-construction.ui.png'))),head:taskCommit,viewport:{width:1440,height:900},inspectedId:'arc',displayedId:'wall',backend};
  const cameraSummary=page.locator('#camera-panel > summary');await cameraSummary.focus();await cameraSummary.press('Enter');await cameraSummary.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'camera-eye');await cameraSummary.focus();await cameraSummary.press('Enter');
  const uiWorkspace={constructionScreen,screens:uiScreens,baselineIndexHash:hash(baselineIndexBytes),keyboardSourceAndDiagnostics:true,focusRestoredAfterInspection:true,acceptedLabelRetainedOnInvalidSource:true,controlsLabelled:true,noHorizontalOverflow:true};
  await writeFile(path.join(evidence,'ui-workspace.json'),json(uiWorkspace));
  const orbitBefore=await page.evaluate(()=>({snapshot:window.cadPreview.snapshot(),bytes:Array.from(window.cadPreview.readPixels()),inspectedId:window.cadPreview.inspectedId}));
  await page.locator('#preview').scrollIntoViewIfNeeded();
  const dragBox=await page.locator('#preview').boundingBox();assert(dragBox);
  const center={x:dragBox.x+dragBox.width/2,y:dragBox.y+dragBox.height/2};
  await page.mouse.move(center.x,center.y);await page.mouse.down();await page.mouse.move(center.x+90,center.y+45,{steps:6});await page.mouse.up();
  const orbitAfter=await page.evaluate(()=>({snapshot:window.cadPreview.snapshot(),bytes:Array.from(window.cadPreview.readPixels()),inspectedId:window.cadPreview.inspectedId,dragging:document.getElementById('preview').classList.contains('is-dragging')}));
  for(const key of ['source','model','packet','report','iges','revision','constructions','selectedConstruction'])assert.deepEqual(orbitAfter.snapshot[key],orbitBefore.snapshot[key]);
  assert.equal(orbitAfter.inspectedId,orbitBefore.inspectedId);assert(orbitAfter.snapshot.viewRevision>orbitBefore.snapshot.viewRevision);assert.notDeepEqual(orbitAfter.bytes,orbitBefore.bytes);assert.equal(orbitAfter.dragging,false);assert(orbitAfter.snapshot.options.camera.eye[1]>orbitBefore.snapshot.options.camera.eye[1], 'Downward drag must use the corrected vertical direction');
  for(const key of ['target','up','fovYDegrees','near','far'])assert.deepEqual(orbitAfter.snapshot.options.camera[key],orbitBefore.snapshot.options.camera[key]);
  const radius=c=>Math.hypot(...c.eye.map((v,i)=>v-c.target[i]));assert(Math.abs(radius(orbitAfter.snapshot.options.camera)-radius(orbitBefore.snapshot.options.camera))<1e-9);
  await page.mouse.move(center.x+130,center.y+70);assert.equal(await page.evaluate(()=>window.cadPreview.snapshot().viewRevision),orbitAfter.snapshot.viewRevision);
  await page.mouse.move(center.x,center.y);await page.mouse.down();await page.mouse.move(dragBox.x+dragBox.width+25,center.y,{steps:3});await page.mouse.up();assert.equal(await page.locator('#preview').evaluate(el=>el.classList.contains('is-dragging')),false);
  const capturedView=await page.evaluate(()=>window.cadPreview.snapshot().viewRevision);
  await page.mouse.move(center.x,center.y);await page.mouse.down();await page.locator('#preview').dispatchEvent('pointercancel',{pointerId:1,pointerType:'mouse'});await page.mouse.move(center.x+60,center.y);await page.mouse.up();assert.equal(await page.evaluate(()=>window.cadPreview.snapshot().viewRevision),capturedView);
  const orbitEvidence={head:taskCommit,actualMouseDrag:true,actualReadPixelsChanged:true,nativeIdentityPreserved:true,modelRevision:orbitAfter.snapshot.revision,beforeViewRevision:orbitBefore.snapshot.viewRevision,afterViewRevision:orbitAfter.snapshot.viewRevision,beforeCamera:orbitBefore.snapshot.options.camera,afterCamera:orbitAfter.snapshot.options.camera,pointerCaptureOutside:true,cancelRetained:true,releaseStopped:true};
  await writeFile(path.join(evidence,'mouse-orbit.json'),json(orbitEvidence));
  await writeFile(path.join(evidence,'mouse-orbit-before.png'),readbackPng(orbitBefore.bytes,512,384));await writeFile(path.join(evidence,'mouse-orbit-after.png'),readbackPng(orbitAfter.bytes,512,384));

  // Restore the original consumer fixture; open advanced controls through real summaries.
  await page.setViewportSize({width:1280,height:720});await page.reload();await page.waitForFunction(()=>window.cadPreview?.snapshot()?.packet);
  await page.evaluate(()=>window.originalPreviewRenderer=window.cadPreview.renderer);
  for(const id of ['source-panel','display-panel','camera-panel','inspection-raw','diagnostics-panel'])await page.locator(`#${id} > summary`).click();

  const cylinder = fixtures.find(fixture => fixture.id === 'cylinder') ?? fixtures[0];
  const settings = fixture => ({ surfaceId: fixture.id, countU: fixture.countU, countV: fixture.countV, options: fixture.options });
  async function apply(source, candidateSettings) {
    const result = await page.evaluate(async ({ source, settings }) => window.cadPreview.apply(source, settings), { source, settings: candidateSettings });
    assert(result.ok, result.error ?? 'Candidate was rejected');
  }
  async function capture(name, objectFixture = null, parameterRequest = null, primitiveRequest = null) {
    const frame = await page.evaluate(async () => {
      const host = window.cadPreview, snapshot = host.snapshot();
      const cad = await import('/cad.js'), gpu = await import('/gpu.js');
      const { validatePreviewPacket: validateCadPacket } = cad, { validatePreviewPacket: validateGpuPacket } = gpu;
      const compiled = cad.compileCadModel(snapshot.source, {sourceVersion:snapshot.sourceVersion??0});
      if(!compiled.ok)throw new Error(JSON.stringify(compiled.diagnostics));
      const model = compiled.model;
      const surface = model.objects.find(object => object.id === snapshot.packet.surfaceId);
      const generated = cad.tessellateSurface(surface, { ...snapshot.report.grid, revision: snapshot.revision });
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      validateCadPacket(generated.packet); validateGpuPacket(generated.packet);
      const gl = document.querySelector('canvas').getContext('webgl2');
      return { snapshot, compiler:{ast:compiled.ast,ir:compiled.ir,diagnostics:compiled.diagnostics}, inspectedId: host.inspectedId ?? null, objects: host.objects?.() ?? null, inspection: host.inspection?.() ?? null, uniforms: structuredClone(window.previewProbe.uniforms), shaders: host.shaders(), bytes: Array.from(host.readPixels()),
        width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, glError: gl.getError(),
        compile: [...window.previewProbe.compile], link: [...window.previewProbe.link], drawCalls: window.previewProbe.drawCalls,
        sourceReplayed: same(model, snapshot.model), constructionsReplayed: snapshot.sourceVersion !== 1 || same(compiled.constructions, snapshot.constructions),
        selectedConstructionReplayed: snapshot.sourceVersion !== 1 || same(compiled.constructions.find(feature => feature.outputId === snapshot.packet.surfaceId), snapshot.selectedConstruction),
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
      [`${name}.ast.json`]: json(frame.compiler.ast),
      [`${name}.ir.json`]: json(frame.compiler.ir),
      [`${name}.diagnostics.json`]: json(frame.compiler.diagnostics),
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
    }
    if (frame.snapshot.sourceVersion === 1 || objectFixture) {
      const downloadEvent = page.waitForEvent('download');
      await page.click('#export');
      const download = await downloadEvent;
      const bytes = await readFile(await download.path(), 'utf8');
      assert.equal(bytes, frame.snapshot.iges.iges, 'Constructed download must match this exact accepted native export');
      files[`${name}.downloaded.igs`] = bytes;
    }
    if (objectFixture) {
      files[`${name}.objects.json`] = json(frame.objects);
      files[`${name}.inspection.json`] = json(frame.inspection);
    }
    if(parameterRequest) files[`${name}.parameters.json`]=json({requested:parameterRequest,selectedConstruction:frame.snapshot.selectedConstruction});
    if(primitiveRequest) files[`${name}.primitive.json`]=json({requested:primitiveRequest,surfaceId:frame.snapshot.packet.surfaceId,source:frame.snapshot.source});
    const hashes = {};
    for (const [filename, content] of Object.entries(files)) {
      await writeFile(path.join(evidence, filename), content); hashes[filename] = hash(content);
    }
    const record = { name, taskCommit, integrationCommit, browser: browser.version(), backend,
      physicalGpuEvidence: false, performanceEvidence: false, actualReadPixels: true,
      primitiveRequest, parameterRequest, fixtureId: objectFixture?.selectorId ?? null, displayedId: frame.snapshot.packet.surfaceId, inspectedId: frame.inspectedId, objectSummaries: objectFixture ? frame.objects : null,
      sourceVersion: frame.snapshot.sourceVersion ?? 0, constructionsReplayed: frame.constructionsReplayed,
      selectedConstructionReplayed: frame.selectedConstructionReplayed, exportReplayed: frame.exportReplayed, downloadedMatchedAccepted: frame.snapshot.sourceVersion === 1 || Boolean(objectFixture),
      sourceReplayed: true, packetReplayed: true, reportReplayed: true, sameRenderer: true,
      revision: frame.snapshot.revision, viewRevision: frame.snapshot.viewRevision, uniforms: frame.uniforms, buffer: [frame.width, frame.height], masks: mask(frame.bytes, frame.width, frame.height),
      readbackHash: hash(Uint8Array.from(frame.bytes)), hashes, sampledDeviationMM: frame.snapshot.report.maxSampledDeviationMM,
      certified: false, glError: frame.glError, compileStatuses: frame.compile, linkStatuses: frame.link, drawCalls: frame.drawCalls };
    await writeFile(path.join(evidence, `${name}.json`), json(record)); (primitiveRequest ? primitiveFrames : parameterRequest ? parameterFrames : objectFixture ? objectFrames : frame.snapshot.sourceVersion === 1 ? constructionFrames : frames).push(record);
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
  // Selection consumes accepted source, version, options and grid, never pending inputs.
  const objectControls = [];
  const state = () => page.evaluate(() => JSON.stringify({ snapshot: window.cadPreview.snapshot(),
    objects: window.cadPreview.objects(), inspection: window.cadPreview.inspection(),
    inspectedId: window.cadPreview.inspectedId, pixels: Array.from(window.cadPreview.readPixels()) }));
  for (const fixture of objectFixtures) {
    await page.selectOption('#fixture', fixture.selectorId);
    assert.equal(await page.locator('#objects [data-object-id]').count(), 4);
    const rows = await page.locator('#objects [data-object-id]').evaluateAll(nodes => nodes.map(node => ({id:node.dataset.objectId,text:node.textContent,show:!!node.querySelector('[data-action="show"]')})));
    assert.deepEqual(new Set(rows.map(row => row.id)), new Set(['arc','polyline','wall','oblique_wall']));
    assert(rows.filter(row => row.show).every(row => ['wall','oblique_wall'].includes(row.id)));
    assert.equal(rows.filter(row => row.show).length, 2);
    const initialObject = await capture(`${fixture.selectorId}-wall`, fixture);
    assert.equal(initialObject.displayedId, 'wall'); assert(initialObject.masks.foreground > 20);
    assert.equal(initialObject.inspectedId,'wall'); assert.equal(initialObject.inspection.id,'wall');
    assert.equal(initialObject.inspection.displayedSurfaceId,'wall');
    assert.deepEqual(initialObject.inspection.displayedSampledMeshBoundsMM,initialObject.snapshot.packet.bounds);
    assert.equal(initialObject.inspection.nativeSource,fixture.sourceVersion===1?'construction-v1':'native-v0');
    if(fixture.sourceVersion===1) assert.deepEqual(initialObject.inspection.construction,initialObject.snapshot.selectedConstruction);
    const acceptedBeforeInspect = await page.evaluate(() => JSON.stringify({ snapshot:window.cadPreview.snapshot(),pixels:Array.from(window.cadPreview.readPixels()) }));
    await page.locator('[data-object-id="arc"] [data-action="inspect"]').click();
    assert.equal(await page.evaluate(() => window.cadPreview.inspectedId), 'arc');
    assert.equal(await page.evaluate(() => JSON.stringify({ snapshot:window.cadPreview.snapshot(),pixels:Array.from(window.cadPreview.readPixels()) })), acceptedBeforeInspect);
    assert.equal(await page.locator('[data-object-id="arc"] [data-action="show"]').count(), 0);
    const inspectionText = await page.locator('#inspection').innerText();
    assert.match(inspectionText, /control.point bounds/i); assert.match(inspectionText, /sampled preview.mesh bounds/i); assert.match(inspectionText, /mm/i);
    const inspectedCurve=await page.evaluate(()=>window.cadPreview.inspection());
    assert.deepEqual(inspectedCurve.degrees,{curve:2}); assert.deepEqual(inspectedCurve.originalDomains,{curve:[0,1]});
    assert.deepEqual(inspectedCurve.knotCounts,{curve:6}); assert.equal(inspectedCurve.poleCounts.total,3);
    assert.deepEqual(inspectedCurve.weightRange,[0.7071067811865476,1]);
    assert.deepEqual(inspectedCurve.controlPointBoundsMM,{min:[0,0,0],max:[10,10,0]});
    // Every pending editor field deliberately disagrees with the accepted snapshot.
    await page.locator('#source').fill('invalid pending source');
    await page.locator('#surface').fill('missing_pending_id');
    await page.locator('#count-u').fill('65'); await page.locator('#count-v').fill('1');
    await page.locator('#scale').fill('0'); await page.locator('#translate').fill('999,999,999');
    await page.locator('#source-version').selectOption(fixture.sourceVersion === 1 ? '0' : '1');
    await page.locator('[data-object-id="oblique_wall"] [data-action="show"]').click();
    const secondObject = await capture(`${fixture.selectorId}-oblique_wall`, fixture);
    assert.equal(secondObject.displayedId, 'oblique_wall'); assert(secondObject.masks.foreground > 20);
    for (const key of ['source','model','constructions']) assert.deepEqual(secondObject.snapshot[key], initialObject.snapshot[key]);
    assert.deepEqual(secondObject.snapshot.options, initialObject.snapshot.options);
    assert.deepEqual(secondObject.snapshot.report.grid, initialObject.snapshot.report.grid);
    assert.equal(secondObject.sourceVersion, initialObject.sourceVersion);
    assert.equal(secondObject.revision, initialObject.revision + 1); assert.equal(secondObject.viewRevision, initialObject.viewRevision + 1);
    assert.notEqual(secondObject.readbackHash, initialObject.readbackHash);
    await page.locator('[data-object-id="wall"] [data-action="show"]').click();
    const returnedObject = await capture(`${fixture.selectorId}-wall-replay`, fixture);
    assert.deepEqual(comparable(returnedObject.snapshot.packet), comparable(initialObject.snapshot.packet));
    assert.deepEqual(returnedObject.snapshot.iges, initialObject.snapshot.iges);
    assert.equal(returnedObject.readbackHash, initialObject.readbackHash);
    assert.equal(returnedObject.revision, secondObject.revision + 1);
    for (const [name, id, injection] of [['unknown','absent'],['curve','arc'],['foreign-payload',{id:'oblique_wall'}],['mutated-payload',['oblique_wall']],['renderer','oblique_wall','renderer']]) {
      const before = await state();
      const result = await page.evaluate(({id,injection}) => {
        const host=window.cadPreview, update=host.renderer.update.bind(host.renderer);
        if(injection==='renderer') host.renderer.update=()=>({ok:false,error:Error('Injected selection renderer failure')});
        try { const result=host.showSurface(id); return {rejected:!result.ok,error:String(result.error)}; }
        finally {host.renderer.update=update;}
      }, {id,injection});
      assert(result.rejected, `${name} selection must fail`); assert.equal(await state(), before);
      objectFailures.push({fixtureId:fixture.selectorId,name,...result,retained:true});
    }
    const beforeUnknown = await state();
    const unknown = await page.evaluate(()=>window.cadPreview.inspectObject('absent'));
    assert.equal(unknown.ok,false); assert.equal(await state(),beforeUnknown);
    // Safe identifiers are native data, displayed as text; bounded rows cannot execute markup.
    const safeSource = fixture.source.replaceAll('#arc', '#arc_script');
    await apply(safeSource,{...settings(fixture),sourceVersion:fixture.sourceVersion ?? 0});
    assert.equal(await page.locator('#objects [data-object-id]').count(),4);
    assert.equal(await page.locator('[data-object-id="arc_script"]').count(),1);
    assert.equal(await page.locator('#objects script, #inspection script').count(),0);
    // A successful source addition/removal reconciles the current inspection.
    const curveBlock = /@curve #polyline\s*\{[^}]*\}/.exec(safeSource)?.[0];
    assert(curveBlock,'Multi-object fixture must expose its bounded native curve record');
    const addedSource=safeSource.replace(/\}\s*$/, `${curveBlock.replace('#polyline','#added_curve')}\n}`);
    await apply(addedSource,{...settings(fixture),sourceVersion:fixture.sourceVersion ?? 0});
    assert.equal(await page.locator('#objects [data-object-id]').count(),5);
    assert((await page.evaluate(()=>window.cadPreview.inspectObject('added_curve'))).ok);
    await apply(safeSource,{...settings(fixture),sourceVersion:fixture.sourceVersion ?? 0});
    assert.equal(await page.locator('#objects [data-object-id]').count(),4);
    assert.notEqual(await page.evaluate(()=>window.cadPreview.inspectedId),'added_curve');
    const atLimit=safeSource.replace(/\}\s*$/,Array.from({length:12},(_,i)=>curveBlock.replace('#polyline',`#bounded_curve_${i}`)).join('\n')+'\n}');
    await apply(atLimit,{...settings(fixture),sourceVersion:fixture.sourceVersion ?? 0});
    assert.equal(await page.locator('#objects [data-object-id]').count(),16);
    const limitBefore=await state();
    const overLimit=atLimit.replace(/\}\s*$/,curveBlock.replace('#polyline','#overflow_curve')+'\n}');
    const rejectedLimit=await page.evaluate(({source,settings})=>window.cadPreview.apply(source,settings),{source:overLimit,settings:{...settings(fixture),sourceVersion:fixture.sourceVersion ?? 0}});
    assert.equal(rejectedLimit.ok,false); assert.equal(await state(),limitBefore);
    await apply(fixture.source,{...settings(fixture),sourceVersion:fixture.sourceVersion ?? 0});
    assert.equal(await page.evaluate(()=>window.cadPreview.snapshot().packet.surfaceId),'wall');
    const mixed = await page.evaluate(({source,settings})=> {
      const host=window.cadPreview,live=()=>window.previewProbe.resources.filter(({kind,resource,gl})=>gl[`is${kind}`](resource)).length;
      const before=live();
      for(let i=0;i<12;i++) {
        const result=i%3===0 ? host.apply(source,settings) : i%3===1 ? host.showSurface(i%2?'oblique_wall':'wall') : host.setCamera(host.snapshot().options.camera);
        if(!result.ok) throw Error(result.error);
        const inspected=host.inspectObject(i%2?'arc':'polyline'); if(!inspected.ok) throw Error(inspected.error);
      }
      return {count:12,before,after:live(),sameRenderer:host.renderer===window.originalPreviewRenderer};
    },{source:fixture.source,settings:{...settings(fixture),sourceVersion:fixture.sourceVersion ?? 0}});
    assert(mixed.sameRenderer); assert.equal(mixed.before,mixed.after);
    objectControls.push({fixtureId:fixture.selectorId,rows,pendingIgnored:true,curveInspectPreservedNativeAndPixels:true,
      sourceAddRemoveReconciled:true,safeText:true,maximumRows:16,overflowRejected:true,mixed,inspectionText});
  }
  const objectLineage={controls:objectControls,actualSelectedDownloads:objectFrames.length,
    curveInspectionNoGeometryAdoption:true,acceptedSourceSelection:true};
  // Enter real typed numbers; canonical CSS is adopted only after a successful GPU candidate.
  await page.selectOption('#fixture','wall');
  const beforeParameter=JSON.parse(await state());
  assert.equal(await page.locator('#parameter-apply').isEnabled(),true);
  await page.click('[data-object-id="arc"] [data-action="inspect"]');
  assert.equal((await page.evaluate(()=>window.cadPreview.parameterState())).surfaceId,'wall');
  await page.fill('#parameter-weight-index','1');await page.locator('#parameter-weight-index').dispatchEvent('change');
  await page.fill('#parameter-vector-z','40');await page.click('#parameter-apply');
  const typedVector=await capture('typed-vector',null,{vector:[0,0,40],weight:{index:1,value:Math.SQRT1_2}});
  assert.deepEqual(typedVector.snapshot.selectedConstruction.vector,[0,0,40]);
  assert.notDeepEqual(typedVector.snapshot.packet.bounds,beforeParameter.snapshot.packet.bounds);
  assert.equal(await page.locator('#source').inputValue(),typedVector.snapshot.source);
  assert.deepEqual(typedVector.snapshot.options,beforeParameter.snapshot.options);
  await page.fill('#parameter-weight-value','0.2');await page.click('#parameter-apply');
  const typedWeight=await capture('typed-weight',null,{vector:[0,0,40],weight:{index:1,value:0.2}});
  assert.equal(typedWeight.snapshot.model.objects.find(o=>o.id==='arc').weights[1],0.2);
  assert.notEqual(typedWeight.readbackHash,typedVector.readbackHash);assert.notEqual(typedWeight.snapshot.iges.iges,typedVector.snapshot.iges.iges);
  assert.deepEqual(typedWeight.snapshot.options,typedVector.snapshot.options);
  const goodParameterState=await state(),pending=typedWeight.snapshot.source+'\n/* unsubmitted edit */';
  await page.fill('#source',pending);await page.fill('#parameter-vector-z','50');await page.click('#parameter-apply');
  assert.deepEqual(await state(),goodParameterState);assert.equal(await page.locator('#source').inputValue(),pending);
  await page.click('#discard-source');assert.equal(await page.locator('#source').inputValue(),typedWeight.snapshot.source);
  await page.fill('#parameter-weight-value','');await page.click('#parameter-apply');assert.deepEqual(await state(),goodParameterState);await page.fill('#parameter-weight-value','0.2');
  for(const request of [{vector:[0,0,0]},{vector:[-10,10,0]},{weight:{index:-1,value:1}},{weight:{index:1,value:0}},{foreign:1},{vector:['1',0,30]}]) {
    const before=await state();const result=await page.evaluate(request=>{const host=window.cadPreview;return host.applyParameters(request,host.snapshot().source);},request);
    assert.equal(result.ok,false);assert.deepEqual(await state(),before);parameterFailures.push({request,rejected:true,retained:true,error:result.error});
  }
  const failedDraw=await page.evaluate(()=>{const host=window.cadPreview,before=JSON.stringify(host.snapshot()),pixels=Array.from(host.readPixels()),gl=document.querySelector('canvas').getContext('webgl2'),draw=gl.drawElements.bind(gl);gl.drawElements=()=>draw(0xdead,3,gl.UNSIGNED_SHORT,0);const result=host.applyParameters({vector:[0,0,45]},host.snapshot().source);gl.drawElements=draw;return{ok:result.ok,error:result.error,retained:before===JSON.stringify(host.snapshot())&&JSON.stringify(pixels)===JSON.stringify(Array.from(host.readPixels()))};});
  assert.equal(failedDraw.ok,false);assert(failedDraw.retained);parameterFailures.push({name:'draw-gl-error',...failedDraw});
  await page.selectOption('#fixture',parameterFixture.selectorId);
  const sharedBefore=await page.evaluate(()=>window.cadPreview.snapshot());
  await page.fill('#parameter-weight-index','1');await page.locator('#parameter-weight-index').dispatchEvent('change');await page.fill('#parameter-weight-value','0.2');await page.click('#parameter-apply');
  const sharedAfter=await page.evaluate(()=>window.cadPreview.snapshot());
  assert.deepEqual(sharedAfter.model.objects.map(o=>o.id),sharedBefore.model.objects.map(o=>o.id));
  assert.deepEqual(sharedAfter.model.objects.find(o=>o.id==='unused'),sharedBefore.model.objects.find(o=>o.id==='unused'));
  for(const id of ['wall','second_wall'])assert.notDeepEqual(sharedAfter.model.objects.find(o=>o.id===id).weights,sharedBefore.model.objects.find(o=>o.id===id).weights);
  assert.deepEqual(sharedAfter.constructions.map(f=>({inputId:f.inputId,outputId:f.outputId,vector:f.vector})),sharedBefore.constructions.map(f=>({inputId:f.inputId,outputId:f.outputId,vector:f.vector})));
  await writeFile(path.join(evidence,'shared-parameters.json'),json({before:sharedBefore,after:sharedAfter,requested:{weight:{index:1,value:0.2}}}));
  const parameterMixed=await page.evaluate(()=>{const host=window.cadPreview,live=()=>window.previewProbe.resources.filter(({kind,resource,gl})=>gl[`is${kind}`](resource)).length,before=live(),renderer=host.renderer;for(let i=0;i<12;i++){const r=host.applyParameters({weight:{index:1,value:i%2?0.2:Math.SQRT1_2}},host.snapshot().source);if(!r.ok)throw Error(r.error);if(!host.showSurface(i%2?'wall':'second_wall').ok)throw Error('Selection failed');if(!host.setCamera({eye:[4,3,6],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.01,far:100}).ok)throw Error('View failed');}return{count:12,before,after:live(),sameRenderer:renderer===host.renderer};});
  assert(parameterMixed.sameRenderer&&parameterMixed.before===parameterMixed.after);
  const parameterLineage={typedActions:2,pendingSourcePreserved:true,sharedInputPropagation:true,unrelatedSemanticFieldsPreserved:true,mixed:parameterMixed};

  const primitiveControls=[];
  for(const kind of ['sheet','quarter-wall']){
    await page.locator('#primitive-kind').selectOption(kind);await page.fill('#primitive-size','100');await page.fill('#primitive-height','100');
    await page.click('#primitive-create');const created=await capture(`create-${kind}`,null,null,{kind,size:100,height:100});
    assert.equal(await page.locator('#source').inputValue(),created.snapshot.source);assert.equal(created.snapshot.packet.surfaceId,'surface');assert.equal(created.snapshot.options.mmToSceneUnit,.01);
    const size=kind==='sheet'?128.5:42.375,height=76.625;
    await page.fill('#primitive-size',String(size));await page.fill('#primitive-height',String(height));await page.click('#primitive-update');const edited=await capture(`update-${kind}`,null,null,{kind,size,height});
    assert.notEqual(created.readbackHash,edited.readbackHash);assert.notEqual(created.snapshot.iges.iges,edited.snapshot.iges.iges);assert.deepEqual(edited.snapshot.options.camera,created.snapshot.options.camera);
    await page.fill('#primitive-height','125.25');await page.click('#primitive-update');await capture(`height-${kind}`,null,null,{kind,size,height:125.25});
    const owner=await page.evaluate(()=>window.cadPreview.primitiveState());assert.equal(owner.height,125.25);
    const before=await state();await page.fill('#source',owner.source+' /* pending */');await page.click('#primitive-create');assert.equal(await state(),before);assert.equal(await page.locator('#source').inputValue(),owner.source+' /* pending */');await page.click('#discard-source');
    await page.fill('#primitive-size','');await page.click('#primitive-update');assert.equal(await state(),before);await page.fill('#primitive-size','301');await page.click('#primitive-update');assert.equal(await state(),before);await page.fill('#primitive-size',String(size));
    await page.locator('#preview').scrollIntoViewIfNeeded();const box=await page.locator('#preview').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+25,box.y+box.height/2+15,{steps:3});await page.mouse.up();assert.deepEqual(await page.evaluate(()=>window.cadPreview.primitiveState()),owner);
    primitiveControls.push({kind,created:true,updatedTwice:true,pendingPreserved:true,invalidPreserved:true,orbitProvenancePreserved:true});
  }
  const primitiveMixed=await page.evaluate(()=>{const host=window.cadPreview,live=()=>window.previewProbe.resources.filter(({kind,resource,gl})=>gl[`is${kind}`](resource)).length,before=live(),renderer=host.renderer;for(let i=0;i<12;i++){const a=host.createPrimitive({kind:i%2?'sheet':'quarter-wall',size:80+i,height:100},host.snapshot().source);if(!a.ok)throw Error(a.error);const b=host.updateDimensions({size:90+i,height:120},host.snapshot().source);if(!b.ok)throw Error(b.error);}return{count:12,before,after:live(),sameRenderer:renderer===host.renderer};});assert(primitiveMixed.sameRenderer&&primitiveMixed.before===primitiveMixed.after);
  await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(evidence,'primitive-desktop.ui.png'),fullPage:true,animations:'disabled'});await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(evidence,'primitive-mobile.ui.png'),fullPage:true,animations:'disabled'});await page.setViewportSize({width:1280,height:720});
  const primitiveLineage={controls:primitiveControls,mixed:primitiveMixed,explicitToolPlacement:true};
  const projectLineage=await runProjectBrowser({browser,page,server,evidence,allowed,taskCommit,integrationCommit});
  const historyLineage=await runHistoryBrowser({browser,server,evidence,allowed,taskCommit,integrationCommit});
  const boxLineage=await runBoxBrowser({page,evidence,taskCommit,integrationCommit});
  const source2Lineage=await runSource2Browser({page,evidence,taskCommit,integrationCommit});
  assert.ok(cadModuleRequests.has('/box-preview.mjs'), 'Separate box consumer must request exact helper route');


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
    const disposedBefore=JSON.stringify({snapshot:host.snapshot(),objects:host.objects(),inspection:host.inspection(),inspectedId:host.inspectedId});
    const selection=host.showSurface('wall'),inspection=host.inspectObject('arc');
    if(host.applyParameters({},host.snapshot().source).ok)throw Error('Disposed parameter action accepted');
    if(selection.ok || inspection.ok) throw Error('Disposed selection/inspection was accepted');
    const disposedRetained=disposedBefore===JSON.stringify({snapshot:host.snapshot(),objects:host.objects(),inspection:host.inspection(),inspectedId:host.inspectedId});
    return { disposedRetained, selectionRejected:!selection.ok, inspectionRejected:!inspection.ok, ownedCount: owned.length, ownedReleased: owned.every(({ kind, resource }) => !gl[`is${kind}`](resource)),
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
    const before=JSON.stringify({snapshot:host.snapshot(),objects:host.objects(),inspection:host.inspection(),inspectedId:host.inspectedId});
    const selected=host.showSurface(snapshot.packet.surfaceId), inspected=host.inspectObject('arc');
    if(host.applyParameters({},snapshot.source).ok)throw Error('Lost-context parameter action accepted');
    if(selected.ok || inspected.ok) throw Error('Lost-context selection/inspection was accepted');
    const retained=before===JSON.stringify({snapshot:host.snapshot(),objects:host.objects(),inspection:host.inspection(),inspectedId:host.inspectedId});
    const result = { readRejected, selectionRejected:!selected.ok,inspectionRejected:!inspected.ok,retained, updateRejected: !response.ok, status: host.status, violations: window.previewProbe.violations };
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
  objectLineage.lifecycle=[];
  for(const fixture of objectFixtures) {
    await page.reload(); await page.waitForFunction(()=>window.cadPreview?.snapshot()?.packet);
    await page.selectOption('#fixture',fixture.selectorId);
    const disposed=await disposeCheck();
    assert(disposed.ownedReleased && disposed.foreignRetained && disposed.readRejected && disposed.disposedRetained);
    cspViolations.push(...disposed.violations);
    await page.reload(); await page.waitForFunction(()=>window.cadPreview?.snapshot()?.packet);
    await page.selectOption('#fixture',fixture.selectorId);
    const lost=await loseContextCheck();
    assert(lost.readRejected && lost.updateRejected && lost.retained);
    cspViolations.push(...lost.violations);
    objectLineage.lifecycle.push({fixtureId:fixture.selectorId,disposed,lost});
  }
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
    source2Lineage, source2Frames:source2Lineage.frames, boxLineage, boxFrames:boxLineage.frames, historyLineage, historyFrames:historyLineage.frames, projectLineage, projectFrames:projectLineage.frames, orbitEvidence, uiWorkspace, frames, constructionFrames, objectFrames, primitiveFrames, primitiveLineage, parameterFrames, parameterFailures, parameterLineage, objectFailures, objectLineage, constructionFailures, constructionLineage, failures, cameraLineage, repeated, lifecycle, constructionLifecycle, navigation, contextLoss, constructionContextLoss, ui, errors, requests, cspViolations, csp,
    deterministicFields: ['source', 'model', 'packet except host-issued revision', 'report', 'IGES', 'display options'],
    environmentFields: ['taskCommit', 'integrationCommit', 'browser', 'backend', 'evidence path'],
    limitations: ['Finite sampled deviation is not a global bound', 'Surfaces remain open; no solid, topology, STEP, or manufacturing claim', 'Software rendering is not physical GPU performance',
      'This composition does not add IGES exchange certification; the independent OCP gate remains required'] };
  await writeFile(path.join(evidence, 'index.json'), json(result));
  const gallery = '<!doctype html><html lang="en"><meta charset="utf-8"><title>CAD to GPU retained evidence</title><h1>CAD to GPU retained evidence</h1><p>Actual framebuffer readbacks. ANGLE SwiftShader software WebGL2. Finite sampled distance is not a global bound. Surfaces remain open; no solid, topology, STEP, or manufacturing claim.</p>' + [...frames, ...constructionFrames, ...objectFrames, ...parameterFrames, ...primitiveFrames].map(frame => `<section><h2>${frame.name}</h2><img src="${frame.name}.png" alt="${frame.name} actual readback"><p>Inspected ${frame.inspectedId ?? "none"}; displayed ${frame.displayedId}. Revision ${frame.revision}; sampled distance ${frame.sampledDeviationMM} mm. <a href="${frame.name}.source.css">Source</a> <a href="${frame.name}.model.json">Native model</a> ${frame.sourceVersion === 1 ? `<a href="${frame.name}.constructions.json">Construction history</a> <a href="${frame.name}.selected-construction.json">Selected feature</a> <a href="${frame.name}.downloaded.igs">Actual download</a>` : ''} ${frame.fixtureId ? `<a href="${frame.name}.objects.json">Accepted objects</a> <a href="${frame.name}.inspection.json">Native inspection</a> <a href="${frame.name}.downloaded.igs">Selected actual download</a>` : ''} <a href="${frame.name}.display.json">Camera and view</a> <a href="${frame.name}.packet.json">Packet</a> <a href="${frame.name}.report.json">Report</a> <a href="${frame.name}.igs">IGES</a></p></section>`).join('') + '<p><a href="index.json">SHA manifest and controls</a></p></html>';
  await writeFile(path.join(evidence, 'gallery.html'), gallery);
  console.log(`CAD preview browser evidence: ${evidence}; ${frames.length + constructionFrames.length + objectFrames.length + parameterFrames.length + primitiveFrames.length} actual framebuffer states; ${failures.length} legacy and ${constructionFailures.length} construction rejection controls`);
} finally {
  if (browser) await browser.close();
  await server.close();
}

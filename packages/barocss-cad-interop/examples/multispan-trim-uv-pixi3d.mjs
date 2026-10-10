import {Application,VERSION} from 'pixi.js';
import {Camera,CameraOrbitControl,LightingEnvironment,Mesh3D,StandardMaterial,Color} from 'pixi3d/pixi7';
import { PINS, CASE_KEYS, loadCase, proveCase, assertNative, assertBuffer, requireFact, errorReceipt } from './multispan-trim-uv-pixi3d-fixture.mjs';
import { createMultiSpanTrimUVPixi3DHost } from './multispan-trim-uv-pixi3d-checkpoint.mjs';
import { createPixiTrimUVObserver } from './multispan-trim-uv-pixi3d-observer.mjs';

const width = 900, height = 640;
const evidence = { ready: false, busy: false, error: null, sourceMode: document.documentElement.dataset.loader1289Mode ?? 'source', environment: null,
  pins: [], phases: [], sourceRefusals: null, transportRefusals: null, cold: null, cleanup: null, GL: [], runtimeErrors: [] };
const phaseRGBA = new Map(), texts = new Map(), assets = new Map();
const controls = ['negatives', 'transport', 'joins', 'cap', 'cold', 'cleanup'];
let nextAction = 'negatives', host, observer, app, renderer, camera, stage, lighting, orbit, canvas, callerMarker, fixedCamera, priorCamera, priorLighting, markerShader=null;
const callerCounters = {application:0,renderer:0,stage:0,camera:0,orbit:0,lighting:0,marker:0,geometry:0,material:0,canvasRemoval:0};
const getCallerCounters=()=>({...callerCounters});
const getCameraState=()=>({position:Array.from(camera.position.array),quaternion:Array.from(camera.rotationQuaternion.array),projection:Array.from(camera.projection.array),view:Array.from(camera.view.array),world:Array.from(camera.worldTransform.array),viewProjection:Array.from(camera.viewProjection.array),near:camera.near,far:camera.far,aspect:camera.aspect,orthographicSize:camera.orthographicSize});
const hash = values => { let value = 2166136261; for (const byte of values) value = Math.imul(value ^ byte, 16777619) >>> 0; return value; };
function green(values) { let count = 0; for (let i = 0; i < values.length; i += 4) if (values[i] < 40 && values[i + 1] > 200 && values[i + 2] < 40) count++; return count; }
function changed(a, b) { let count = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) count++; return count; }
function draw(label){
 const gl=renderer.gl,mask=gl.getParameter(gl.DEPTH_WRITEMASK);gl.depthMask(true);gl.clear(gl.DEPTH_BUFFER_BIT);gl.depthMask(mask);renderer.render(stage);
 const values=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,values);const code=gl.getError();evidence.GL.push({label,code,depthMaskBefore:mask,depthMaskRestored:gl.getParameter(gl.DEPTH_WRITEMASK)});requireFact(code===0,'Actual WebGL error');assertNative(getCameraState(),fixedCamera,'fixed-caller-camera');requireFact(Camera.main===priorCamera&&LightingEnvironment.main===priorLighting&&renderer.plugins.lighting===lighting&&camera.renderer===renderer,'Caller camera/lighting context changed');return values;
}
async function warm(record){for(let attempt=0;attempt<120;attempt++){draw(record.key+':shader');if(markerShader&&callerMarker.geometry.hasShaderGeometry(markerShader,false)&&record.resources.every(row=>row.shader&&row.geometry.hasShaderGeometry(row.shader,false)))return;await new Promise(requestAnimationFrame)}throw new Error('Actual Pixi material shader readiness timeout');}
function preview(label) {
  const record = host.accepted, visible = draw(label + ':visible');
  record.result.root.visible = false;
  let hidden;
  try { hidden = draw(label + ':caller-only'); } finally { record.result.root.visible = true; }
  const restored = draw(label + ':restored');
  assertBuffer(restored, visible, label + ':full-RGBA-restored');
  const surfacePixels = changed(visible, hidden), callerPixels = green(visible);
  requireFact(surfacePixels > 0 && callerPixels > 0, 'Original Support and caller must have visible pixels');
  return { values: visible, frame: { width, height, hash: hash(visible), callerOnlyHash: hash(hidden), surfacePixels, callerPixels, fullRGBARestored: true } };
}
function recordPhase(label, rendered = null) {
  const output = rendered ?? preview(label);
  phaseRGBA.set(label, output.values);
  evidence.phases.push({ label, frame: output.frame, observation: observer.snapshot() });
  document.getElementById('receipts').textContent = JSON.stringify({ counts: host.counts, sourceRefusals: evidence.sourceRefusals, transportRefusals: evidence.transportRefusals, cold: evidence.cold, cleanup: evidence.cleanup, frames: evidence.phases.map(phase => ({ label: phase.label, ...phase.frame })) }, null, 2);
}
function displayNative() {
  const record = host.accepted; if (!record) return;
  const table = document.getElementById('queries'); table.replaceChildren();
  for (const row of record.proof.queryRows) {
    const tr = document.createElement('tr');
    const bracket = row.originalParameterBracket.map(value => value.numerator + '/' + value.denominator).join(' → ');
    const values = [row.queryId + '\nU=' + row.u + ', V=' + row.v, row.cutRelation + '\n' + row.method,
      row.spanSelection.index + ' / ' + row.spanSelection.position + '\n[' + row.spanSelection.domain.join(', ') + ']\npoles [' + row.spanSelection.poleIndices.join(', ') + ']',
      bracket + '\n' + row.steps.length + ' subdivisions', row.faces.map(face => face.sourceId + '/' + face.surfaceId + '/' + face.faceId + ': ' + face.classification).join('\n')];
    for (const value of values) { const td = document.createElement('td'); td.textContent = value; td.style.whiteSpace = 'pre-wrap'; tr.append(td); } table.append(tr);
  }
  document.getElementById('native').textContent = JSON.stringify(record.readout, (_key,value)=>typeof value==='number'&&Object.is(value,-0)?JSON.rawJSON('-0'):value, 2);
}
function updateControls() { for (const id of controls) document.getElementById(id).disabled = !evidence.ready || evidence.busy || evidence.error !== null || id !== nextAction; }
function fail(error) { evidence.error = errorReceipt('browser-flow', error); console.error(error); document.getElementById('status').textContent = error.message; updateControls(); }
window.addEventListener('error', event => evidence.runtimeErrors.push(event.message));
window.addEventListener('unhandledrejection', event => evidence.runtimeErrors.push(String(event.reason)));
Object.defineProperty(window, 'loader1289Evidence', { configurable: false, writable: false, value: Object.freeze({
  snapshot(includeRGBA = false) {
    const result = structuredClone({ ...evidence, current: observer?.snapshot() ?? null, sourceURLs:performance.getEntriesByType('resource').map(entry=>entry.name).filter(name=>name.includes('/packages/barocss-')), camera: camera ? getCameraState() : null, caller: getCallerCounters() });
    if (includeRGBA) for (const phase of result.phases) phase.frame.rgba = Array.from(phaseRGBA.get(phase.label));
    return result;
  }
}) });
async function readOriginal(file, pin, fresh = false) {
  if (!fresh && texts.has(file)) return texts.get(file);
  const observationIndex = evidence.pins.length; evidence.pins.push(null);
  const response = await fetch(new URL(file, location.href), { cache: 'no-store' }), bytes = new Uint8Array(await response.arrayBuffer());
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  const contentType = response.headers.get('content-type'), expectedType = file.endsWith('.css') ? 'text/plain' : 'application/json';
  requireFact(response.status === 200 && bytes.length === pin.bytes && sha256 === pin.sha256 && response.headers.get('content-length') === String(pin.bytes) && contentType?.startsWith(expectedType), 'Original file status/bytes/SHA/content-length/MIME changed: ' + file);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  evidence.pins[observationIndex] = { ...pin, status: response.status, contentType, contentLength: response.headers.get('content-length'), fresh };
  if (!fresh) texts.set(file, text); return text;
}
async function requestCount() { const response = await fetch('/loader1289-request-log.json', { cache: 'no-store' }); requireFact(response.ok, 'Original request ledger unavailable'); const rows = await response.json(); requireFact(Array.isArray(rows), 'Original request ledger must be an array'); return rows.length; }
function setupCamera(native){
 app=new Application({width,height,resolution:1,antialias:false,preserveDrawingBuffer:true,autoStart:false,background:0x101b2c});app.stop();renderer=app.renderer;stage=app.stage;canvas=app.view;document.getElementById('view').append(canvas);lighting=renderer.plugins.lighting;priorCamera=Camera.main;priorLighting=LightingEnvironment.main;camera=new Camera(renderer);Camera.main=priorCamera;
 const positions=native.surfaces[0].mesh.positions,points=Array.from({length:positions.length/3},(_,i)=>Array.from(positions.slice(i*3,i*3+3))),min=[0,1,2].map(axis=>Math.min(...points.map(p=>p[axis]))),max=[0,1,2].map(axis=>Math.max(...points.map(p=>p[axis]))),center=min.map((x,i)=>(x+max[i])/2),span=Math.max(...min.map((x,i)=>max[i]-x)),offset=[1.2,-1.3,1.7],forward=offset.map(x=>-x),yaw=Math.atan2(forward[0],forward[2])*180/Math.PI,pitch=Math.atan2(-forward[1],Math.hypot(forward[0],forward[2]))*180/Math.PI;
 orbit=new CameraOrbitControl(canvas,camera);orbit.allowControl=false;orbit.autoUpdate=false;orbit.target={x:center[0],y:center[1],z:center[2]};orbit.distance=span*Math.hypot(...offset);orbit.angles.set(pitch,yaw);orbit.updateCamera();camera.orthographic=true;camera.aspect=width/height;camera.orthographicSize=span;camera.near=.0001;camera.far=1;
 const material=new StandardMaterial();material.unlit=true;material.doubleSided=true;material.baseColor=new Color(0,1,0);material.camera=camera;material.lightingEnvironment=lighting;const originalShader=material.createShader;material.createShader=function(...args){const shader=originalShader.apply(this,args);if(shader)markerShader=shader;return shader};
 callerMarker=Mesh3D.createSphere(material,{radius:span*.011,segments:12,rings:8});callerMarker.position.set(center[0]-span*.6,center[1]+span*.35,center[2]+span*.25);stage.addChild(callerMarker);renderer.render(stage);
 for(let i=0;i<callerMarker.geometry.positions.buffer.length;i+=3)points.push([callerMarker.geometry.positions.buffer[i]+callerMarker.position.x,callerMarker.geometry.positions.buffer[i+1]+callerMarker.position.y,callerMarker.geometry.positions.buffer[i+2]+callerMarker.position.z]);const view=camera.view.array,project=point=>[view[0]*point[0]+view[4]*point[1]+view[8]*point[2]+view[12],view[1]*point[0]+view[5]*point[1]+view[9]*point[2]+view[13]];camera.orthographicSize=1.18*Math.max(...points.map(point=>{const p=project(point);return Math.max(Math.abs(p[1]),Math.abs(p[0])*height/width)}));renderer.render(stage);fixedCamera=structuredClone(getCameraState());
 for(const [key,object]of Object.entries({application:app,renderer,stage,camera,orbit,lighting,marker:callerMarker,geometry:callerMarker.geometry,material})){const original=object.destroy;object.destroy=function(...args){callerCounters[key]++;return original.apply(this,args)}}const originalRemove=canvas.remove;canvas.remove=function(...args){callerCounters.canvasRemoval++;return originalRemove.apply(this,args)};
 evidence.cameraProfile={min,max,center,span,offset,pitch,yaw,distance:orbit.distance,projectionSites:points.length,markerPosition:Array.from(callerMarker.position.array),markerRadius:span*.011};
}
async function action(id, operation, next) {
  requireFact(nextAction === id && evidence.ready && !evidence.busy, 'Original flow order changed'); evidence.busy = true; updateControls();
  try { await operation(); nextAction = next; } catch (error) { fail(error); } finally { evidence.busy = false; updateControls(); }
}
try {
  await Promise.all(PINS.map(pin => readOriginal(pin.file, pin)));
  for (const key of CASE_KEYS) assets.set(key, await loadCase(key, (file, pin) => readOriginal(file, pin)));
  setupCamera(proveCase(assets.get('directed_exact')).native);
  requireFact(renderer.gl instanceof WebGL2RenderingContext,'Actual WebGL2 required');
  host=createMultiSpanTrimUVPixi3DHost({stage,camera,lighting,onChange(record){requireFact(host.accepted===record,'Callback accepted reference differs');draw(record?record.key+':change':'cleanup:change')}});
  const initial=host.load(assets.get('directed_exact'));await warm(initial);
  evidence.environment={pixi:VERSION,pixi3d:'2.5.0 pinned',userAgent:navigator.userAgent,webGL:renderer.gl.getParameter(renderer.gl.VERSION),canvas:[width,height]};
  observer=createPixiTrimUVObserver({host,stage,camera,lighting,renderer,canvas,callerMarker,getCameraState,getCallerCounters});
  recordPhase('directed_exact'); displayNative(); evidence.ready = true; document.documentElement.dataset.loader1289Ready = 'true'; document.getElementById('status').textContent = 'Four exact original queries accepted. The complete Support preview remains untrimmed.'; updateControls();
  document.getElementById('negatives').onclick = () => action('negatives', async () => {
    const before = observer.capture(), rgba = draw('source-refusals:before'), retained = [];
    evidence.sourceRefusals = host.runRefusals(assets.get('directed_exact'), receipt => { observer.check(before); const after = draw('source-refusals:' + receipt.name); assertBuffer(after, rgba, 'source-refusal-full-RGBA'); retained.push({ name: receipt.name, fullRGBAExact: true, frameHash: hash(after), cameraExact: true, resourcesExact: true }); });
    evidence.sourceRefusals.observations = retained; requireFact(retained.length === 11, 'Eleven genuine source refusals required'); recordPhase('source-refusals'); document.getElementById('status').textContent = 'Eleven source refusals preserve the accepted native result and the actual frame.';
  }, 'transport');
  const url = new URL('multispan-trim-uv-pixi3d-data/directed.actual-trim-model8.source0.css', location.href).href;
  document.getElementById('transport').onclick = () => action('transport', async () => {
    const before = observer.capture(), rgba = draw('transport-refusals:before'), retained = []; let previousRequests = await requestCount();
    evidence.transportRefusals = await host.runTransportRefusals(url, async receipt => {
      observer.check(before); const after = draw('transport-refusals:' + receipt.name); assertBuffer(after, rgba, 'transport-refusal-full-RGBA');
      const currentRequests = await requestCount(), requestDelta = currentRequests - previousRequests; requireFact(requestDelta === receipt.expectedRequestDelta, 'Actual transport request delta changed'); previousRequests = currentRequests;
      retained.push({ name: receipt.name, requestDelta, fullRGBAExact: true, frameHash: hash(after), cameraExact: true, resourcesExact: true });
    }); evidence.transportRefusals.observations = retained; requireFact(retained.length === 5, 'Five genuine transport refusals required'); recordPhase('transport-refusals'); document.getElementById('status').textContent = 'Five transport refusals preserve the accepted native result and caller resources.';
  }, 'joins');
  document.getElementById('joins').onclick = () => action('joins', async () => { await warm(host.load(assets.get('directed_joins'))); recordPhase('directed_joins'); displayNative(); document.getElementById('status').textContent = 'Four original join queries accepted. Each internal join keeps its original lower span.'; }, 'cap');
  document.getElementById('cap').onclick = () => action('cap', async () => { await warm(host.load(assets.get('directed_cap_zero'))); recordPhase('directed_cap_zero'); displayNative(); document.getElementById('status').textContent = 'Cap0 is successful uncertain for both qualified Faces. The Surface remains untrimmed.'; }, 'cold');
  document.getElementById('cold').onclick = () => action('cold', async () => {
    const previous = host.accepted, rgba = draw('cold:before'), originalCamera = structuredClone(getCameraState()), requestBefore = await requestCount(), pinBefore = evidence.pins.length;
    const fresh = await loadCase('directed_cap_zero', (file, pin) => readOriginal(file, pin, true)); assertNative(fresh, previous.asset, 'fresh-twelve-original-files');
    const progress = [], reopened = await host.loadFromUrl(fresh, url, { onProgress(value) { progress.push({ ...value }); } });
    requireFact(reopened.result !== previous.result && reopened.result.root !== previous.result.root && reopened.resources[0].geometry !== previous.resources[0].geometry && reopened.resources[0].material !== previous.resources[0].material, 'Cold reopen must allocate distinct actual owned resources');
    assertNative(reopened.readout, previous.readout, 'cold-native-readout'); assertNative(reopened.native, previous.native, 'cold-complete-native'); assertNative(getCameraState(), originalCamera, 'cold-fixed-camera');
    await warm(reopened); const rendered = preview('cold-reopen'); assertBuffer(rendered.values, rgba, 'cold-full-RGBA'); const requestDelta = await requestCount() - requestBefore;
    requireFact(evidence.pins.length - pinBefore === 12 && requestDelta === 13 && progress.length > 0, 'Cold reopen requires twelve fresh originals and one public parent URL');
    evidence.cold = { freshPinCount: 12, requestDelta, progress, distinctOwnedResources: true, wholeNativeExact: true, readoutExact: true, fixedCameraExact: true, fullRGBAExact: true };
    recordPhase('cold-reopen', rendered); displayNative(); document.getElementById('status').textContent = 'Twelve fresh original files and the public whole-parent URL preserve native evidence, buffers, camera and full RGBA.';
  }, 'cleanup');
  document.getElementById('cleanup').onclick = () => action('cleanup', async () => {
    const previous = host.accepted, before = structuredClone({ asset: previous.asset, proof: previous.proof, native: previous.native, readout: previous.readout }); host.dispose(); host.dispose();
    assertNative({ asset: previous.asset, proof: previous.proof, native: previous.native, readout: previous.readout }, before, 'native-CPU-after-double-cleanup');
    requireFact(host.counts.callbacks === 5 && host.counts.pairs === 4 && host.counts.roots === 4 && host.counts.peakLivePairs === 2 && host.counts.livePairs === 0 && host.allResources.every(row => row.rootDestroyCalls === 1 && row.meshDestroyCalls === 1 && row.geometryDestroyCalls === 1 && row.materialDestroyCalls === 1) && host.allRoots.every(root => root.parent === null && root.destroyed), 'Exact owned four-set/four-root disposal once required');
    const values = draw('cleanup:final'); requireFact(green(values) > 0 && stage.children.length === 1 && stage.children[0] === callerMarker && Object.values(callerCounters).every(value => value === 0), 'Caller must survive actual double cleanup');
    const requestTotal = await requestCount(); requireFact(evidence.pins.length === 28 && requestTotal === 32, 'Exact original HTTP and byte pin counts required');
    evidence.cleanup = { double: true, nativeCPUReadable: true, callerPixels: green(values), callerRetained: true, requestTotal, pinTotal: evidence.pins.length, counts: host.counts, counters: getCallerCounters() };
    recordPhase('cleanup', { values, frame: { width, height, hash: hash(values), callerPixels: green(values), ownedSurfaceRemoved: true } }); document.getElementById('status').textContent = 'Owned Surface resources were disposed once. The caller and all complete native CPU evidence remain available.'; document.documentElement.dataset.loader1289Complete = 'true';
  }, null);
} catch (error) { fail(error); }

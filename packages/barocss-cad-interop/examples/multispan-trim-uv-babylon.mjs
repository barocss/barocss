import {Engine} from '@babylonjs/core/Engines/engine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {FreeCamera} from '@babylonjs/core/Cameras/freeCamera.js';
import {Camera} from '@babylonjs/core/Cameras/camera.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {Color3,Color4} from '@babylonjs/core/Maths/math.color.js';
import {HemisphericLight} from '@babylonjs/core/Lights/hemisphericLight.js';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder.js';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial.js';
import {parseBaroCadSource} from '@barocss/cad-interop/native';
import { PINS, CASE_KEYS, loadCase, assertNative, assertBuffer, requireFact, errorReceipt, createParentOptions } from './multispan-trim-uv-babylon-fixture.mjs';
import { createMultiSpanTrimUVBabylonHost } from './multispan-trim-uv-babylon-checkpoint.mjs';
import { createBabylonTrimUVObserver } from './multispan-trim-uv-babylon-observer.mjs';

const width = 900, height = 640;
const evidence = { ready: false, busy: false, error: null, sourceMode: document.documentElement.dataset.loader1288Mode ?? 'source', environment: null,
  pins: [], phases: [], sourceRefusals: null, transportRefusals: null, cold: null, cleanup: null, GL: [], runtimeErrors: [] };
const phaseRGBA = new Map(), texts = new Map(), assets = new Map();
const controls = ['negatives', 'transport', 'joins', 'cap', 'cold', 'cleanup'];
let nextAction = 'negatives', host, observer, engine, camera, scene, callerMarker, fixedCamera, canvas, light, callerCollections;
let observationQueue=Promise.resolve();
const callerCounters={meshDisposals:0,geometryDisposals:0,materialDisposals:0,engineDisposals:0,sceneDisposals:0,cameraDisposals:0,lightDisposals:0,canvasRemovals:0};
const getCallerCounters=()=>({...callerCounters});
const getCameraState=()=>({position:camera.position.asArray(),rotation:camera.rotation.asArray(),quaternion:camera.rotationQuaternion?.asArray()??null,view:Array.from(camera.getViewMatrix().asArray()),projection:Array.from(camera.getProjectionMatrix().asArray()),near:camera.minZ,far:camera.maxZ,left:camera.orthoLeft,right:camera.orthoRight,top:camera.orthoTop,bottom:camera.orthoBottom,activeCamera:scene.activeCamera===camera,rightHanded:scene.useRightHandedSystem});
const hash = values => { let value = 2166136261; for (const byte of values) value = Math.imul(value ^ byte, 16777619) >>> 0; return value; };
function green(values) { let count = 0; for (let i = 0; i < values.length; i += 4) if (values[i] < 40 && values[i + 1] > 200 && values[i + 2] < 40) count++; return count; }
function changed(a, b) { let count = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) count++; return count; }
function draw(label){requireFact(scene.isReady(),'Actual Scene/shader readiness required');scene.render();const gl=engine._gl,values=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,values);const code=gl.getError();evidence.GL.push({label,code});requireFact(code===0,'Actual WebGL error');assertNative(getCameraState(),fixedCamera,'fixed-caller-camera');return values;}
function preview(label) {
  const record = host.accepted, visible = draw(label + ':visible');
  record.result.meshes.forEach(mesh=>mesh.setEnabled(false));
  let hidden;
  try { hidden = draw(label + ':caller-only'); } finally { record.result.meshes.forEach(mesh=>mesh.setEnabled(true)); }
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
  document.getElementById('native').textContent = JSON.stringify(record.readout,(_key,value)=>typeof value==='number'&&Object.is(value,-0)?JSON.rawJSON('-0'):value,2);
}
function updateControls() { for (const id of controls) document.getElementById(id).disabled = !evidence.ready || evidence.busy || evidence.error !== null || id !== nextAction; }
function fail(error) { evidence.error = errorReceipt('browser-flow', error); console.error(error); document.getElementById('status').textContent = error.message; updateControls(); }
window.addEventListener('error', event => evidence.runtimeErrors.push(event.message));
window.addEventListener('unhandledrejection', event => evidence.runtimeErrors.push(String(event.reason)));
Object.defineProperty(window, 'loader1288Evidence', { configurable: false, writable: false, value: Object.freeze({
  snapshot(includeRGBA = false) {
    const result = structuredClone({ ...evidence, current: observer?.snapshot() ?? null, camera: camera ? getCameraState() : null, caller: getCallerCounters() });
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
async function requestCount() { const response = await fetch('/loader1288-request-log.json', { cache: 'no-store' }); requireFact(response.ok, 'Original request ledger unavailable'); const rows = await response.json(); requireFact(Array.isArray(rows), 'Original request ledger must be an array'); return rows.length; }
function setupCamera(native){const positions=native.surfaces[0].mesh.positions,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<positions.length;i+=3)for(let axis=0;axis<3;axis++){min[axis]=Math.min(min[axis],positions[i+axis]);max[axis]=Math.max(max[axis],positions[i+axis]);}const center=new Vector3(...min.map((value,axis)=>(value+max[axis])/2)),span=Math.max(...min.map((value,axis)=>max[axis]-value));
 camera=new FreeCamera('caller-camera',center.add(new Vector3(1.2*span,-1.3*span,1.7*span)),scene);camera.upVector=new Vector3(0,1,0);camera.setTarget(center);camera.mode=Camera.ORTHOGRAPHIC_CAMERA;const halfY=.004720650998308256;camera.orthoLeft=-halfY*width/height;camera.orthoRight=-camera.orthoLeft;camera.orthoTop=halfY;camera.orthoBottom=-halfY;camera.minZ=.0001;camera.maxZ=1;scene.activeCamera=camera;
 light=new HemisphericLight('caller-light',new Vector3(0,1,0),scene);light.intensity=.8;callerMarker=MeshBuilder.CreateSphere('caller-marker',{diameter:span*.022,segments:8},scene);callerMarker.position=center.add(new Vector3(-.6*span,.35*span,.25*span));const geometry=callerMarker.geometry,material=new StandardMaterial('caller-green',scene);material.disableLighting=true;material.diffuseColor=Color3.Black();material.specularColor=Color3.Black();material.emissiveColor=new Color3(0,1,0);callerMarker.material=material;
 callerMarker.onDisposeObservable.add(()=>callerCounters.meshDisposals++);material.onDisposeObservable.add(()=>callerCounters.materialDisposals++);const dispose=geometry.dispose;geometry.dispose=function(...args){callerCounters.geometryDisposals++;return dispose.apply(this,args);};for(const[key,object]of Object.entries({engineDisposals:engine,sceneDisposals:scene,cameraDisposals:camera,lightDisposals:light}))object.onDisposeObservable.add(()=>callerCounters[key]++);new MutationObserver(()=>{if(!canvas.isConnected)callerCounters.canvasRemovals++;}).observe(document.body,{childList:true,subtree:true});fixedCamera=structuredClone(getCameraState());evidence.cameraProfile={center:center.asArray(),span,halfY,markerPosition:callerMarker.position.asArray(),markerRadius:span*.011,scope:'Fixed actual Babylon RH FreeCamera profile proved by private headed preparation'};
}
async function action(id, operation, next) {
  requireFact(nextAction === id && evidence.ready && !evidence.busy, 'Original flow order changed'); evidence.busy = true; updateControls();
  try { await operation(); nextAction = next; } catch (error) { fail(error); } finally { evidence.busy = false; updateControls(); }
}
try {
  await Promise.all(PINS.map(pin => readOriginal(pin.file, pin)));
  for (const key of CASE_KEYS) assets.set(key, await loadCase(key, (file, pin) => readOriginal(file, pin)));
  canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;document.getElementById('view').append(canvas);engine=new Engine(canvas,false,{preserveDrawingBuffer:true,stencil:true,adaptToDeviceRatio:false});engine.setHardwareScalingLevel(1);scene=new Scene(engine);scene.useRightHandedSystem=true;scene.clearColor=new Color4(16/255,27/255,44/255,1);
  setupCamera(parseBaroCadSource(assets.get('directed_exact').modelSource,createParentOptions()));await scene.whenReadyAsync();scene.render();callerCollections=Object.fromEntries(['meshes','geometries','materials','cameras','lights'].map(key=>[key,[...scene[key]]]));
  host=createMultiSpanTrimUVBabylonHost({scene,onChange(record){observationQueue=observationQueue.then(async()=>{await scene.whenReadyAsync();draw(record?record.key+':change':'cleanup:change');});}});host.load(assets.get('directed_exact'));await observationQueue;
  const gl=engine._gl;requireFact(gl instanceof WebGL2RenderingContext,'Actual WebGL2 required');evidence.environment={babylon:Engine.Version,userAgent:navigator.userAgent,webGL:gl.getParameter(gl.VERSION),canvas:[width,height],hardwareScaling:engine.getHardwareScalingLevel()};
  observer=createBabylonTrimUVObserver({host,scene,engine,camera,canvas,callerMarker,getCameraState,getCallerCounters});
  recordPhase('directed_exact'); displayNative(); evidence.ready = true; document.documentElement.dataset.loader1288Ready = 'true'; document.getElementById('status').textContent = 'Four exact original queries accepted. The complete Support preview remains untrimmed.'; updateControls();
  document.getElementById('negatives').onclick = () => action('negatives', async () => {
    const before = observer.capture(), rgba = draw('source-refusals:before'), retained = [];
    evidence.sourceRefusals = host.runRefusals(assets.get('directed_exact'), receipt => { observer.check(before); const after = draw('source-refusals:' + receipt.name); assertBuffer(after, rgba, 'source-refusal-full-RGBA'); retained.push({ name: receipt.name, fullRGBAExact: true, frameHash: hash(after), cameraExact: true, resourcesExact: true }); });
    evidence.sourceRefusals.observations = retained; requireFact(retained.length === 11, 'Eleven genuine source refusals required'); recordPhase('source-refusals'); document.getElementById('status').textContent = 'Eleven source refusals preserve the accepted native result and the actual frame.';
  }, 'transport');
  const url = new URL('multispan-trim-uv-babylon-data/directed.actual-trim-model8.source0.css', location.href).href;
  document.getElementById('transport').onclick = () => action('transport', async () => {
    const before = observer.capture(), rgba = draw('transport-refusals:before'), retained = []; let previousRequests = await requestCount();
    evidence.transportRefusals = await host.runTransportRefusals(url, async receipt => {
      observer.check(before); const after = draw('transport-refusals:' + receipt.name); assertBuffer(after, rgba, 'transport-refusal-full-RGBA');
      const currentRequests = await requestCount(), requestDelta = currentRequests - previousRequests; requireFact(requestDelta === receipt.expectedRequestDelta, 'Actual transport request delta changed'); previousRequests = currentRequests;
      retained.push({ name: receipt.name, requestDelta, fullRGBAExact: true, frameHash: hash(after), cameraExact: true, resourcesExact: true });
    }); evidence.transportRefusals.observations = retained; requireFact(retained.length === 5, 'Five genuine transport refusals required'); recordPhase('transport-refusals'); document.getElementById('status').textContent = 'Five transport refusals preserve the accepted native result and caller resources.';
  }, 'joins');
  document.getElementById('joins').onclick = () => action('joins', async () => { host.load(assets.get('directed_joins')); await observationQueue; recordPhase('directed_joins'); displayNative(); document.getElementById('status').textContent = 'Four original join queries accepted. Each internal join keeps its original lower span.'; }, 'cap');
  document.getElementById('cap').onclick = () => action('cap', async () => { host.load(assets.get('directed_cap_zero')); await observationQueue; recordPhase('directed_cap_zero'); displayNative(); document.getElementById('status').textContent = 'Cap0 is successful uncertain for both qualified Faces. The Surface remains untrimmed.'; }, 'cold');
  document.getElementById('cold').onclick = () => action('cold', async () => {
    const previous = host.accepted, rgba = draw('cold:before'), originalCamera = structuredClone(getCameraState()), requestBefore = await requestCount(), pinBefore = evidence.pins.length;
    const fresh = await loadCase('directed_cap_zero', (file, pin) => readOriginal(file, pin, true)); assertNative(fresh, previous.asset, 'fresh-twelve-original-files');
    const progress = [], reopened = await host.loadFromUrl(fresh, url, { onProgress(value) { progress.push({ ...value }); } });
    requireFact(reopened.result !== previous.result && reopened.result.meshes[0] !== previous.result.meshes[0] && reopened.resources[0].geometry !== previous.resources[0].geometry && reopened.resources[0].material !== previous.resources[0].material, 'Cold reopen must allocate distinct actual owned resources');
    await observationQueue; assertNative(reopened.readout, previous.readout, 'cold-native-readout'); assertNative(reopened.native, previous.native, 'cold-complete-native'); assertNative(getCameraState(), originalCamera, 'cold-fixed-camera');
    const rendered = preview('cold-reopen'); assertBuffer(rendered.values, rgba, 'cold-full-RGBA'); const requestDelta = await requestCount() - requestBefore;
    requireFact(evidence.pins.length - pinBefore === 12 && requestDelta === 13 && progress.length > 0, 'Cold reopen requires twelve fresh originals and one public parent URL');
    evidence.cold = { freshPinCount: 12, requestDelta, progress, distinctOwnedResources: true, wholeNativeExact: true, readoutExact: true, fixedCameraExact: true, fullRGBAExact: true };
    recordPhase('cold-reopen', rendered); displayNative(); document.getElementById('status').textContent = 'Twelve fresh original files and the public whole-parent URL preserve native evidence, buffers, camera and full RGBA.';
  }, 'cleanup');
  document.getElementById('cleanup').onclick = () => action('cleanup', async () => {
    const previous = host.accepted, before = structuredClone({ asset: previous.asset, proof: previous.proof, native: previous.native, readout: previous.readout }); host.dispose(); host.dispose(); await observationQueue;
    assertNative({ asset: previous.asset, proof: previous.proof, native: previous.native, readout: previous.readout }, before, 'native-CPU-after-double-cleanup');
    requireFact(host.counts.callbacks===5&&host.counts.meshes===4&&host.counts.geometries===4&&host.counts.materials===4&&host.counts.peakLiveMeshes===2&&host.counts.peakLiveGeometry===2&&host.counts.peakLiveMaterials===2&&host.counts.liveMeshes===0&&host.counts.liveGeometry===0&&host.counts.liveMaterials===0&&host.allResources.every(row=>row.meshDisposals===1&&row.geometryDisposals===1)&&host.allMaterials.every(row=>row.disposals===1),'Exact four Babylon owned triples must release once');
    for(const[key,items]of Object.entries(callerCollections))requireFact(scene[key].length===items.length&&items.every((item,index)=>scene[key][index]===item),'Caller Scene '+key+' references/order must survive');
    const values=draw('cleanup:final');requireFact(green(values)>0&&!callerMarker.isDisposed()&&Object.values(callerCounters).every(value=>value===0),'Caller must survive actual double cleanup');
    const requestTotal = await requestCount(); requireFact(evidence.pins.length === 28 && requestTotal === 32, 'Exact original HTTP and byte pin counts required');
    evidence.cleanup = { double: true, nativeCPUReadable: true, callerPixels: green(values), callerRetained: true, requestTotal, pinTotal: evidence.pins.length, counts: host.counts, counters: getCallerCounters() };
    recordPhase('cleanup', { values, frame: { width, height, hash: hash(values), callerPixels: green(values), ownedSurfaceRemoved: true } }); document.getElementById('status').textContent = 'Owned Babylon Surface resources were disposed once. The caller and all complete native CPU evidence remain available.'; document.documentElement.dataset.loader1288Complete = 'true';
  }, null);
} catch (error) { fail(error); }

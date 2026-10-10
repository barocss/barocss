import {Application,Graphics} from 'pixi.js';
import {Camera,Mesh3D,StandardMaterial,LightingEnvironment} from 'pixi3d/pixi7';
import * as loaderModule from '@barocss/cad-interop/pixi3d-uniform-curve';
import * as nativeModule from '@barocss/cad-interop/native-uniform-curve';
import {runUniformPixi3DRuntimeCheckpoint} from '../test/pixi3d-uniform-curve.test.mjs';
import { PINS, loadSectionAsset, assertNative } from './section-uniform-curve-pixi3d-fixture.mjs';
import { createSectionUniformPixi3DHost } from './section-uniform-curve-pixi3d-checkpoint.mjs';
performance.setResourceTimingBufferSize(2048);
const mode=document.documentElement.dataset.loader1142Mode ?? 'source';
const width=900,height=640,app=new Application({width,height,resolution:1,antialias:false,preserveDrawingBuffer:true,autoStart:false,background:0x101b2c});app.stop();
const stage=app.stage,renderer=app.renderer,canvas=app.view;document.querySelector('#view').append(canvas);
const lighting=renderer.plugins.lighting,priorLightingMain=LightingEnvironment.main;
const priorMain=Camera.main,camera=new Camera(renderer);if(priorMain===undefined)Camera.main=priorMain;
camera.position.set(.005,.040,.025);camera.rotationQuaternion.setEulerAngles(69.00400764811761,180,0);camera.orthographic=true;
camera.orthographicSize=.004622222222222222;camera.aspect=width/height;camera.near=.0001;camera.far=1;
const marker=new Graphics().beginFill(0x00ff00).drawRect(16,16,14,14).endFill();stage.addChild(marker);renderer.render(stage);
function cameraSnapshot(){return{position:Array.from(camera.position.array),quaternion:Array.from(camera.rotationQuaternion.array),projection:Array.from(camera.projection.array),matrix:Array.from(camera.worldTransform.array),view:Array.from(camera.view.array),size:camera.orthographicSize,aspect:camera.aspect,near:camera.near,far:camera.far};}
const cameraState=cameraSnapshot(),callerDisposals={application:0,stage:0,renderer:0,camera:0,marker:0,lighting:0,canvasRemoval:0};
for(const [name,object] of Object.entries({application:app,stage,renderer,camera,marker,lighting})){const original=object.destroy;object.destroy=function(...args){callerDisposals[name]++;return original.apply(this,args);};}
const canvasRemove=canvas.remove;canvas.remove=function(...args){callerDisposals.canvasRemoval++;return canvasRemove.apply(this,args);};
const gl=renderer.gl,worldURL=new URL('./section-uniform-curve-pixi3d-data/polynomial.actual-world.source0.css',location.href).href;
const evidence = { mode, focusedRuntime:null, requestDeltas:[], ready: false, status: 'loading', error: null, HTTPpins: [], history: [], refusals: null, transport: null, cold: null, cleanup: null, glErrors: [], consoleErrors: [], callbacks: 0, camera: cameraState };
let host, busy = true, originalFrame, originalRecord, originalReadout;
function fact(value, message) { if (!value) throw new Error(message); }
function equalArray(a, b) { return a.length === b.length && a.every((value, index) => Object.is(value, b[index])); }
function frame() {
  renderer.render(stage); const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const error = gl.getError(); evidence.glErrors.push(error); fact(error === gl.NO_ERROR, `WebGL error ${error}`); return pixels;
}
function hash(bytes) { let value = 2166136261; for (const byte of bytes) value = Math.imul(value ^ byte, 16777619) >>> 0; return value; }
function caller() {
  assertNative(cameraSnapshot(),cameraState);fact(Camera.main===priorMain && camera.renderer===renderer,'Caller camera/main changed');fact(renderer.plugins.lighting===lighting&&lighting.renderer===renderer&&LightingEnvironment.main===priorLightingMain,'Caller lighting changed');
  return { retained: marker.parent === stage && canvas.isConnected && !gl.isContextLost() && Object.values(callerDisposals).every(value => value === 0), disposals: { ...callerDisposals }, stageChildren: stage.children.length };
}
function resources(){return host.allResources.map((row,index)=>({index,rootDisposals:row.rootDisposals,meshDisposals:row.meshDisposals,geometryDisposals:row.geometryDisposals,materialDisposals:row.materialDisposals,
 positions:[...row.positions],normals:[...row.normals],indices:[...row.indices],currentPositions:Array.from(row.geometry.positions.buffer),currentNormals:Array.from(row.geometry.normals.buffer),currentIndices:Array.from(row.geometry.indices.buffer)}));}
function sourceGraph() {
  const urls = [...new Set(performance.getEntriesByType('resource').map(entry => entry.name).filter(url => /\/packages\/barocss-(cad|cad-interop)\//.test(url)))];
  const source = urls.filter(url => /\/src\//.test(url)), dist = urls.filter(url => /\/dist\//.test(url));
  if(mode==='source')fact(source.length>0&&dist.length===0,'Actual source graph required');else fact(source.length===0&&performance.getEntriesByType('resource').some(entry=>entry.name.endsWith('/loader1142-published.mjs')),'Actual published bundle required');return{mode,source,dist,observedSourceURLs:source.length,publishedBundle:mode==='compiled'?'/loader1142-published.mjs':null};
}
function snapshot() { return structuredClone({ ...evidence, caller: caller(), counts: host?.counts ?? {}, resources: host ? resources() : [],
  accepted: host?.accepted ? { state: host.accepted.state, section: host.accepted.section, native: host.accepted.native, readout: host.accepted.readout } : null,
  events: host?.events ?? [], sourceGraph: evidence.ready ? sourceGraph() : null }); }
Object.defineProperty(window, 'loader1142', { value: Object.freeze({ snapshot }), writable: false, configurable: false });
function status(value) { evidence.status = value; document.querySelector('#status').textContent = value; }
function details() {
  document.querySelector('#full-proof').textContent = document.querySelectorAll('details')[0].open && host?.accepted ? JSON.stringify(host.accepted.readout, null, 2) : '';
  document.querySelector('#lifetime').textContent = document.querySelectorAll('details')[1].open ? JSON.stringify({ counts: host.counts, resources: resources(), refusals: evidence.refusals, transport: evidence.transport, cleanup: evidence.cleanup }, null, 2) : '';
}
function readout(record) {
  const section = record.section, native = record.native;
  document.querySelector('#context').textContent = `World: ${native.model.name} / ${native.curveId} / degree ${native.model.objects[0].degree} / original mm\n` +
    `Native domain: ${JSON.stringify(native.domain)}; uniform parameters ${native.parameters.length}; intervals ${native.intervals.length}\n` +
    `Complete original Surface parent: ${section.surfaceAsset.sourceId} / ${section.originalModels[0].name} / ${section.originalModels[0].objects.map(object => `${object.kind}:${object.id}`).join(', ')}\n` +
    `Complete original Plane parent: ${section.planeAsset.sourceId} / ${section.originalModels[1].name} / ${section.originalModels[1].objects.map(object => `${object.kind}:${object.id}`).join(', ')}\n` +
    `Surface UV: ${section.pcurves.surface.coordinateSystem} / ${section.pcurves.surface.lengthUnit} / ${section.pcurves.surface.curve.id} / degree ${section.pcurves.surface.curve.degree}\n` +
    `Plane UV: ${section.pcurves.plane.coordinateSystem} / ${section.pcurves.plane.lengthUnit} / ${section.pcurves.plane.curve.id} / degree ${section.pcurves.plane.curve.degree}\n` +
    `Only the world Curve is drawn. Parents and UV charts retain their complete native data. Original XYZ and identity poses; .001 scene units/mm once.`;
  const rows = document.querySelector('#observations'); rows.replaceChildren();
  for (const observation of section.observations) { const row = document.createElement('tr');
    for (const value of [observation.parameter, JSON.stringify(observation.world.d0), JSON.stringify(observation.surfacePcurve.d0), JSON.stringify(observation.planePcurve.d0), JSON.stringify(observation.residuals)]) {
      const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
    } rows.append(row);
  }
  document.querySelector('#quality').textContent = JSON.stringify({ nativeDisplay: native.quality, sectionQuality: section.report.quality, nativePolicy: section.report.numericPolicy, exactRepresentationBounds: section.proof.bounds }, null, 2); details();
}
function observe(record) {
  fact(host.accepted === record, 'Observe current accepted record');
  fact(record.result.root.parent === stage && record.result.root.children.length === 1 && record.result.mesh instanceof Mesh3D && record.result.mesh.material instanceof StandardMaterial, 'Actual single world Line required');
  const line = record.result.mesh, buffer = line.geometry.positions.buffer;
  fact(buffer.length === 387 && line.geometry.indices.buffer.length === 129 && line.geometry.indices.buffer.every((value,index)=>value===index) && equalArray(buffer, record.native.positions), 'Original uniform Float32 positions differ');
  fact(equalArray(Array.from(line.position.array), [0, 0, 0]) && equalArray(Array.from(line.rotationQuaternion.array), [0, 0, 0, 1]) && equalArray(Array.from(line.scale.array), [1, 1, 1]), 'Original pose differs');
  const combined = frame(); line.visible = false; let background;
  try { background = frame(); } finally { line.visible = true; }
  fact(equalArray(frame(), combined), 'Complete frame not restored'); let visiblePixels = 0;
  for (let index = 0; index < combined.length; index += 4) if (combined[index] !== background[index] || combined[index + 1] !== background[index + 1] || combined[index + 2] !== background[index + 2]) visiblePixels++;
  fact(visiblePixels > 0 && caller().retained, 'Original world Line or caller invisible');
  if (!originalRecord) { originalRecord = record; originalFrame = combined; originalReadout = structuredClone(record.readout); }
  else { assertNative(record.readout, originalReadout, 'Full cold context/readout'); fact(equalArray(combined, originalFrame), 'Cold full RGBA changed');
    evidence.cold = { fullRGBAExact: true, fullNativeContextExact: true, fullReadoutExact: true, targetBuffersExact: equalArray(buffer, originalRecord.native.positions) && equalArray(line.geometry.normals.buffer,originalRecord.resources[0].normals) && equalArray(line.geometry.indices.buffer,originalRecord.resources[0].indices) };fact(evidence.cold.targetBuffersExact,'Cold positions/normals/indices changed');
  }
  evidence.history.push({ state: record.state, frameHash: hash(combined), visiblePixels, section: structuredClone(record.section), native: structuredClone(record.native), readout: structuredClone(record.readout) }); readout(record);
}
host = createSectionUniformPixi3DHost({ stage, camera, onChange(record) { evidence.callbacks++; if(record){record.result.mesh.material.lightingEnvironment=lighting;observe(record);} else frame(); } });
function retained() { const record = host.accepted; return { record, result: record.result, section: record.section, native: record.native, readout: structuredClone(record.readout),
  geometry: record.result.mesh.geometry, material: record.result.mesh.material, buffer: record.result.mesh.geometry.positions.buffer, data: Array.from(record.result.mesh.geometry.positions.buffer), pixels: frame(), children: [...stage.children], callbacks: evidence.callbacks }; }
function checkRetained(before) {
  const record = host.accepted; fact(record === before.record && record.result === before.result && record.section === before.section && record.native === before.native &&
    record.result.mesh.geometry === before.geometry && record.result.mesh.material === before.material && record.result.mesh.geometry.positions.buffer === before.buffer &&
    equalArray(before.buffer, before.data) && equalArray(frame(), before.pixels) && before.children.length === stage.children.length && before.children.every((child, index) => child === stage.children[index]) &&
    evidence.callbacks === before.callbacks && caller().retained, 'Refusal changed accepted context/Scene/resource/buffer/full RGBA/caller'); assertNative(record.readout, before.readout);
}
async function originalAsset() {
  const texts = new Map(); await Promise.all(PINS.map(async pin => {
    const response = await fetch(new URL(`./section-uniform-curve-pixi3d-data/${pin.file}`, location.href)); fact(response.ok && response.body, 'Original HTTP failed');
    const reader = response.body.getReader(), chunks = []; let count = 0;
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; count += value.byteLength; fact(count <= 2 * 1024 * 1024, 'Original file too large'); chunks.push(value); } } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(count); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
    fact(count === pin.bytes && sha256 === pin.sha256, `Original pin changed ${pin.file}`);
    const contentType = response.headers.get('content-type'), contentLength = response.headers.get('content-length');
    if (pin.file.endsWith('.css')) fact(/^text\/plain\b/.test(contentType ?? '') && Number(contentLength) === pin.bytes, 'Original CSS headers changed');
    evidence.HTTPpins.push({ file: pin.file, status: response.status, bytes: count, sha256, contentType, contentLength, streamed: true }); texts.set(pin.file, new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  })); return loadSectionAsset(file => texts.get(file));
}
function controls() {
  const stop = busy || !!evidence.error || !!evidence.cleanup;
  document.querySelector('#run-refusals').disabled = stop || !!evidence.refusals;
  document.querySelector('#run-transport-refusals').disabled = stop || !evidence.refusals || !!evidence.transport;
  document.querySelector('#cold-reopen').disabled = stop || !evidence.transport || !!evidence.cold;
  document.querySelector('#dispose').disabled = stop || !evidence.cold;
}
async function run(action) { if (busy || evidence.error || evidence.cleanup) return; busy = true; controls();
  try { await action(); } catch (error) { evidence.error = { name: error.name, message: error.message, stack: error.stack }; evidence.consoleErrors.push(evidence.error); status(`Failed: ${error.message}`); console.error(error); }
  finally { busy = false; controls(); }
}
document.querySelector('#run-refusals').addEventListener('click', () => run(() => { const before = retained(); evidence.refusals = host.runRefusals(host.accepted.asset,()=>checkRetained(before));
  fact(evidence.refusals.refusals.length === 16, 'Sixteen actual refusals required'); checkRetained(before); status('16 native/core/example refusals retained the complete accepted context and exact full frame.'); details(); }));
async function requestLedger(){const response=await fetch('/loader1142-request-log.json',{cache:'no-store'});fact(response.ok,'Actual server ledger unavailable');return response.json();}
document.querySelector('#run-transport-refusals').addEventListener('click',()=>run(async()=>{const before=retained();let ledger=await requestLedger(),priorRequests=ledger.filter(row=>row.file==='polynomial.actual-world.source0.css').length;
  evidence.transport=await host.runTransportRefusals(worldURL,async receipt=>{checkRetained(before);ledger=await requestLedger();const now=ledger.filter(row=>row.file==='polynomial.actual-world.source0.css').length,delta=now-priorRequests;priorRequests=now;
    fact(delta===(receipt.name.startsWith('progress-')?1:0),'Actual per-case server HTTP count differs');evidence.requestDeltas.push({name:receipt.name,requests:delta,source:'actual server handled original-file requests'});checkRetained(before);});
  fact(evidence.transport.refusals.length===5,'Five actual transport refusals required');checkRetained(before);status('Five actual bounded loadAsync refusals retained native data, GPU resources and full frame.');details();}));
document.querySelector('#cold-reopen').addEventListener('click', () => run(async () => { await host.coldReopen(await originalAsset(), worldURL); status('Cold original files, complete native context, target buffers and full frame are exact.'); }));
document.querySelector('#dispose').addEventListener('click', () => run(async () => { host.dispose(); host.dispose(); fact(host.accepted === null && host.records.length === 2 && host.allResources.length === 3 && evidence.callbacks === 3, 'Actual collection/resource counts differ');
  for(const key of ['root','mesh','geometry','material'])fact(new Set(host.allResources.map(row=>row[key])).size===3,'Three distinct actual '+key+' objects required');
  fact(host.allResources.every(row => row.rootDisposals === 1 && row.meshDisposals === 1 && row.geometryDisposals === 1 && row.materialDisposals === 1 && equalArray(row.geometry.positions.buffer, row.positions)), 'Owned disposal/CPU data changed');
  fact(stage.children.length === 1 && caller().retained, 'Caller lost after disposal'); const pixels=frame();evidence.serverRequests=await requestLedger();fact(evidence.serverRequests.length===14,'Actual original-file request total differs');let greenPixels=0;
  for (let index = 0; index < pixels.length; index += 4) if (pixels[index] < 40 && pixels[index + 1] > 200 && pixels[index + 2] < 40) greenPixels++;
  fact(greenPixels > 0, 'Caller marker lost'); evidence.cleanup = { pairs: 3, rootDisposals:3,meshDisposals:3,geometryDisposals: 3, materialDisposals: 3, doubleCall: true, greenPixels, fullNativeCPUReadable: true, frameHash: hash(pixels) };
  for(const [index,record] of host.records.entries()){const saved=evidence.history[index];assertNative(record.section,saved.section);assertNative(record.native,saved.native);assertNative(record.readout,saved.readout);assertNative(record.native.positions,record.result.positions);}
  fact(host.counts.peakLivePairs===2&&host.counts.livePairs===0,'Actual peak/live sets differ');
  status('Three owned root/mesh/geometry/material sets released once. Full native context stays readable; caller Stage/camera/renderer/canvas/2D green marker survive.'); details(); }));
for (const detail of document.querySelectorAll('details')) detail.addEventListener('toggle', details);
window.addEventListener('error', event => evidence.consoleErrors.push({ message: event.message }));
window.addEventListener('unhandledrejection', event => evidence.consoleErrors.push({ message: String(event.reason) }));
controls(); try { fact(gl instanceof WebGL2RenderingContext, 'WebGL2 required'); const asset=await originalAsset();evidence.focusedRuntime=await runUniformPixi3DRuntimeCheckpoint(loaderModule,nativeModule,asset.worldSource);host.load(asset); evidence.ready = true; document.documentElement.dataset.loader1142Ready = 'true'; sourceGraph(); status('Original quartic world Curve and complete section context loaded.'); }
catch (error) { evidence.error = { name: error.name, message: error.message, stack: error.stack }; evidence.consoleErrors.push(evidence.error); status(`Failed: ${error.message}`); console.error(error); }
finally { busy = false; controls(); }

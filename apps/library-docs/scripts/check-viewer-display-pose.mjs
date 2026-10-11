// Selected maintainer CPU observation. It never constructs or mocks Viewer.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleViewerDisplayPose } from './build-viewer-display-pose.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidencePath = resolve(app, 'evidence/viewer-display-pose-consumer.json');
const preset = JSON.parse(await readFile(resolve(app, 'scripts/snippets/viewer-display-pose.json'), 'utf8'));
const previous = await readFile(evidencePath, 'utf8').then(JSON.parse).catch(error => {
  if (error.code === 'ENOENT') return null;
  throw error;
});
const failures = previous?.failedCandidates ?? [];
const consumerText = `
import assert from 'node:assert/strict';
import { compileCadModel, evaluateSurface, surfaceDomain, tessellateSurface } from '@barocss/cad';
const recipe = ${preset.source};
const expectedSource = ${JSON.stringify(JSON.parse(preset.source).nativeSource)};
function near(actual,expected){assert.equal(actual.length,expected.length);actual.forEach((value,index)=>assert.ok(Math.abs(value-expected[index])<=1e-12));}
// Independent application TRS arithmetic. This is not a Viewer or GPU oracle.
function appTransform(point,pose){
 const scaled=point.map((value,index)=>value*pose.scale[index]);
 const [x,y,z,w]=pose.rotation,[a,b,c]=scaled;
 const rotated=[(1-2*(y*y+z*z))*a+2*(x*y-z*w)*b+2*(x*z+y*w)*c,
  2*(x*y+z*w)*a+(1-2*(x*x+z*z))*b+2*(y*z-x*w)*c,
  2*(x*z-y*w)*a+2*(y*z+x*w)*b+(1-2*(x*x+y*y))*c];
 return rotated.map((value,index)=>(value+pose.translation[index])*.001);
}
export function run(){
 assert.equal(recipe.nativeSource,expectedSource);assert.equal(recipe.pose,null);assert.deepEqual(recipe.probeUV,[.35,.4]);
 const inputBefore=structuredClone(recipe);
 const compiled=compileCadModel(recipe.nativeSource,{sourceVersion:0});assert.equal(compiled.ok,true);
 assert.equal(compiled.model.name,'pose_panel');assert.equal(compiled.model.version,0);assert.equal(compiled.model.lengthUnit,'mm');
 assert.equal(compiled.model.objects.length,1);const surface=compiled.model.objects[0];assert.equal(surface.kind,'surface');assert.equal(surface.id,'panel');
 assert.deepEqual(surfaceDomain(surface),{u:[0,1],v:[0,1]});
 const nativeBefore=structuredClone(compiled.model);
 const first=evaluateSurface(surface,0,.5),second=evaluateSurface(surface,1,.5);
 const midpoint=evaluateSurface(surface,.5,.5),probe=evaluateSurface(surface,...recipe.probeUV);
 near(first,[0,0,20]);near(second,[100,0,20]);near(midpoint,[50,0,20]);near(probe,[35,0,16]);
 const distanceMM=Math.hypot(...second.map((value,index)=>value-first[index]));assert.equal(distanceMM,100);
 const sampled=tessellateSurface(surface,{countU:3,countV:3,revision:0});
 assert.equal(sampled.packet.positions.length/3,9);assert.equal(sampled.packet.indices.length/3,8);
 const frame={contextId:'pose-panel-session',timeSeconds:0,poses:[{targetId:'panel-pose',translation:[30,10,0],rotation:[0,0,Math.SQRT1_2,Math.SQRT1_2],scale:[1,1,1]}]};
 const bindings=[{contextId:frame.contextId,targetId:'panel-pose',ref:{modelId:'pose_panel',surfaceId:'panel'}}];
 const midpointScene=appTransform(midpoint,frame.poses[0]),probeScene=appTransform(probe,frame.poses[0]);
 near(midpointScene,[.03,.06,.02]);near(probeScene,[.03,.045,.016]);
 assert.deepEqual(compiled.model,nativeBefore);assert.deepEqual(recipe,inputBefore);
 const after=evaluateSurface(surface,.5,.5);near(after,[50,0,20]);
 return {source:recipe.nativeSource,recipe,compiled,domain:surfaceDomain(surface),first,second,midpoint,probe,distanceMM,
  sampled,applicationPose:{frame,bindings,basis:{basis:'part-xyz-matches-rhyup'},midpointScene,probeScene,
   mmToSceneUnit:.001,arithmetic:'scale native mm, rotate quaternion, translate mm, then convert once'},
  inputAndNativeModelRetained:true,actualViewer:false,actualBrowser:false,actualGL:false,actualPixelRetention:false,
  viewerRefusalsExecuted:false,qualification:'Public CAD compile/evaluate/tessellate plus independent app TRS arithmetic only. Viewer projection, picking, selection, pose admission and pixel retention require the separate actual browser flow.'};
}
`;

// Retain finite native numbers, including -0, as JSON numeric literals.
function finiteJSON(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Evidence contains a nonfinite number');
    return Object.is(value, -0) ? '-0' : String(value);
  }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(finiteJSON).join(',') + ']';
  return '{' + Object.entries(value).filter(([, item]) => item !== undefined)
    .map(([key, item]) => JSON.stringify(key) + ':' + finiteJSON(item)).join(',') + '}';
}
let provenance;
try {
  const bundled = await bundleViewerDisplayPose(app, 'node', consumerText, 'viewer-display-pose');
  provenance = bundled.provenance;
  if (provenance.sourcePin !== preset.sourceProfile || provenance.ownDistInputs !== 0) throw Error('Unexpected Viewer pose CPU provider');
  const module = await import('data:text/javascript;base64,' + Buffer.from(bundled.result.outputFiles[0].text).toString('base64'));
  const receipt = module.run();
  const output = { status: 'passed', nodeVersion: process.version, provenance, failedCandidates: failures, ...receipt };
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, finiteJSON(output) + '\n');
  console.log(JSON.stringify({ status: output.status, provenance, nativeMidpointMM: receipt.midpoint,
    applicationMidpointScene: receipt.applicationPose.midpointScene, nativeDistanceMM: receipt.distanceMM,
    vertices: receipt.sampled.packet.positions.length / 3, triangles: receipt.sampled.packet.indices.length / 3,
    actualViewer: false, actualGL: false }));
} catch (error) {
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, finiteJSON({ status: 'failed', nodeVersion: process.version, provenance,
    source: preset.source, failedCandidates: [...failures, { name: error.name, code: error.code,
      message: error.message, stack: error.stack?.replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g, '[bundled consumer]') }] }) + '\n');
  throw error;
}

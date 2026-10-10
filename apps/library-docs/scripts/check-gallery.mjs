import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { app, bundleExample } from './example-runtime.mjs';
import { readGallery } from './gallery-input.mjs';

const gallery = await readGallery();
const directory = resolve(app, 'docs/.vitepress/cache');
await mkdir(directory, { recursive: true });
const entry = resolve(directory, 'gallery-check.mjs');
await writeFile(entry, `
import { compileCadModel, evaluateSurface, tessellateSurface } from '@barocss/cad';
import { compileGpu, compileMeshMaterial, lowerMeshMaterial, prepareMesh } from '@barocss/gpu';
const gallery=${JSON.stringify(gallery)};
const results=[];
for(const [key,preset] of Object.entries(gallery)){
 if(!['surface','scene','material'].includes(preset.kind))continue;
 if(preset.kind==='surface'){
  const result=compileCadModel(preset.source,{sourceVersion:preset.sourceVersion});
  if(!result.ok)throw Error(key+JSON.stringify(result.diagnostics));
  const surface=result.model.objects.find(o=>o.kind==='surface');
  const midpoint=evaluateSurface(surface,.5,.5),expected=key==='cad-extrude'?[10,0,15]:[50,0,50];
  if(midpoint.some((n,i)=>Math.abs(n-expected[i])>1e-10))throw Error('Unexpected native midpoint '+key);
  const mesh=tessellateSurface(surface,{countU:17,countV:17,revision:0});
  const buffers=prepareMesh(mesh.packet,{mmToSceneUnit:.01,translate:[0,0,0],color:[.2,.6,.9],background:[0,0,0]});
  let edited;
  if(key==='cad-parameters'){
   const change=compileCadModel(preset.source.replace('10 cm','12 cm'),{sourceVersion:2});
   if(!change.ok)throw Error(JSON.stringify(change.diagnostics));
   edited=evaluateSurface(change.model.objects.find(o=>o.kind==='surface'),.5,.5);
   if(edited.some((n,i)=>Math.abs(n-[60,0,60][i])>1e-10))throw Error('Unexpected parameter edit');
  }
  results.push({key,sourceVersion:result.ir.sourceVersion,midpointMM:midpoint,editedMidpointMM:edited,vertices:mesh.report.vertexCount,triangles:mesh.report.triangleCount,positionComponents:buffers.positions.length,certified:mesh.report.certified});
 }else if(preset.kind==='scene'){
  const result=compileGpu({kind:'scene',source:preset.source,sourceVersion:1});
  if(!result.ok)throw Error(JSON.stringify(result.diagnostics));
  if(result.ir.draws.length!==6)throw Error('Expected six primitives');
  const bad=compileGpu({kind:'scene',source:preset.source.replace('minor-radius: .15;','minor-radius: .55;'),sourceVersion:1});
  if(bad.ok || bad.diagnostics[0].code!=='VALIDATION')throw Error('Expected equal-radius torus refusal');
  results.push({key,kinds:result.ir.draws.map(d=>d.kind),refused:bad.diagnostics[0].code});
 }else{
  if(!preset.source.includes(preset.targetFunction+'('))throw Error('Missing targeted source function '+key);
  const result=compileMeshMaterial(preset.source);
  if(!result.ok)throw Error(key+JSON.stringify(result.diagnostics));
  const lowered=lowerMeshMaterial(result.material);
  const uniform=lowered.uniformLayout.find(u=>u.name==='amount');
  if(!uniform || !lowered.expression.length)throw Error('Missing lowered material/control '+key);
  const refusal=compileMeshMaterial(preset.expected.refusal.source);
  if(refusal.ok || refusal.diagnostics[0].code!==preset.expected.refusal.code)throw Error('Unexpected function refusal '+key+JSON.stringify(refusal));
  results.push({key,targetFunction:preset.targetFunction,shaderId:result.material.shaderId,uniforms:lowered.uniformLayout.map(u=>u.name),refused:refusal.diagnostics[0].code,loweredExpression:lowered.expression});
 }
}
if(new Set(results.filter(r=>r.targetFunction).map(r=>r.targetFunction)).size!==11)throw Error('Expected eleven function samples');
const unknown=compileMeshMaterial('@shader #bad { @fragment { color: unknown(); } }');
if(unknown.ok || unknown.diagnostics[0].code!=='SYNTAX')throw Error('Expected unsupported-function refusal');
console.log(JSON.stringify({results,refusedUnknown:unknown.diagnostics[0].code,drawing:'not executed in this CPU consumer'},null,2));
`);
const { result, provenance } = await bundleExample(entry, 'node');
await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
console.log(JSON.stringify(provenance));

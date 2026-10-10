/** #1182: original hierarchical scene into shared-resource CPU draw plan. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const at=process.argv.indexOf('--output');assert(at>=0&&process.argv[at+1],'--output <fresh directory> required');
const output=resolve(process.argv[at+1]);await mkdir(output,{recursive:false});
const pkg=resolve(repo,'packages/barocss-gpu'),manifest=JSON.parse(await readFile(resolve(pkg,'package.json'),'utf8')),published=manifest.publishConfig.exports['.'];
const ordinary=resolve(output,'ordinary-source.mjs');
const bundle=await build({entryPoints:[resolve(pkg,manifest.exports['.'].import)],bundle:true,platform:'node',format:'esm',target:'node22',outfile:ordinary,metafile:true});
const graph=Object.keys(bundle.metafile.inputs);assert(graph.some(p=>p.endsWith('/src/engine-scene.ts')));assert(!graph.some(p=>/barocss-(gpu|cad)\/dist\//.test(p)));
const hash=x=>createHash('sha256').update(x).digest('hex');async function receipt(path){const b=await readFile(path);return{path,bytes:b.length,sha256:hash(b)};}
function json(v){if(typeof v==='number'){assert(Number.isFinite(v));return Object.is(v,-0)?'-0':JSON.stringify(v);}if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return'['+v.map(json).join(',')+']';return'{'+Object.entries(v).map(([k,x])=>JSON.stringify(k)+':'+json(x)).join(',')+'}';}
const clone=v=>JSON.parse(json(v)), near=(a,b,tol=1e-10)=>assert(Math.abs(a-b)<=tol,`actual ${a}, expected ${b}`);
const nearArray=(a,b,tol=1e-10)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>near(v,b[i],tol));};
const camera=()=>({eye:[0,0,12],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.01,far:100});
const geometry=()=>({format:'barocss-gpu-triangle-geometry',version:0,id:'inclined',coordinateSystem:'right-handed-y-up',positionUnit:'scene',winding:'ccw',positions:[-0,0,0,1,0,0,0,1,1],normals:[0,-Math.SQRT1_2,Math.SQRT1_2,0,-Math.SQRT1_2,Math.SQRT1_2,0,-Math.SQRT1_2,Math.SQRT1_2],uvs:[-0,0,1,0,0,1],indices:[-0,1,2]});
const group=(id,parentId=null)=>({id,type:'group',parentId,translation:[-0,0,0],rotationXYZW:[0,0,0,1],scale:[1,1,1],visible:true});
const mesh=(id,parentId=null)=>({...group(id,parentId),type:'mesh',geometryId:'inclined',materialId:'green'});
function scene(){const root=group('root');root.translation=[3,1,0];root.rotationXYZW=[0,0,Math.SQRT1_2,Math.SQRT1_2];root.scale=[2,3,1];const child=group('child','root');child.translation=[1,0,0];child.scale=[1,2,1];const a=mesh('a','child');a.translation=[0,1,0];a.scale=[1,1,2];const b=mesh('b','root');b.translation=[-1,0,0];return{format:'barocss-gpu-engine-scene',version:0,id:'nested_scene',coordinateSystem:'right-handed-y-up',positionUnit:'scene',background:[0,.1,.2],camera:camera(),geometries:[geometry()],materials:[{id:'green',type:'unlit',colorSpace:'linear',color:[.1,.8,.2]}],nodes:[a,child,b,root]};}
function depth(n){const s=scene();s.nodes=Array.from({length:n},(_,i)=>group('level_'+i,i?'level_'+(i-1):null));return s;}
function largeGeometry(){const g=geometry(),n=65537;g.positions=Array(n*3).fill(0);g.positions[3]=1;g.positions[7]=1;g.normals=Array(n*3).fill(0);for(let i=0;i<n;i++)g.normals[3*i+2]=1;g.uvs=Array(n*2).fill(0);return g;}
const providers=[['ordinary',await import(pathToFileURL(ordinary))],['emitted',await import(pathToFileURL(resolve(pkg,published.import)))]];
assert.deepEqual(Object.keys(providers[0][1]).sort(),Object.keys(providers[1][1]).sort());
let accepted=0,refused=0,getters=0;const results=[];
for(const[name,gpu]of providers){
 assert.equal(typeof gpu.prepareEngineScene,'function');assert.equal(typeof gpu.EngineSceneError,'function');assert(Object.isFrozen(gpu.EngineSceneDiagnosticCode));let current;
 const file=resolve(output,name+'-accepted.scene.json'),acceptance=[],refusals=[];
 function verify(request,p){
  assert.deepEqual(p.scene,request);assert.notStrictEqual(p.scene,request);assert(Object.isFrozen(p));assert(Object.isFrozen(p.scene));assert(Object.isFrozen(p.scene.nodes));assert(Object.isFrozen(p.scene.geometries));assert.equal(p.nodes.length,request.nodes.length);
  assert.deepEqual(p.nodes.map(n=>n.id),request.nodes.map(n=>n.id));assert.equal(p.geometries.length,request.geometries.length);assert.equal(p.bufferBytes,p.geometries.reduce((n,g)=>n+g.bufferBytes,0));
  assert.equal(p.vertexWork,request.nodes.filter(n=>n.type==='mesh').reduce((sum,n)=>sum+request.geometries.find(g=>g.id===n.geometryId).positions.length/3,0));
  for(let i=0;i<p.geometries.length;i++){const g=p.geometries[i];assert.strictEqual(g.geometry,p.scene.geometries[i]);assert.notStrictEqual(g.geometry.positions,request.geometries[i].positions);assert(Object.isFrozen(g.geometry.positions));}
  for(const n of p.nodes){assert(Object.isFrozen(n));assert(Object.isFrozen(n.worldMatrix));assert(Object.isFrozen(n.normalMatrix));assert(n.worldMatrixF32 instanceof Float32Array);assert(n.normalMatrixF32 instanceof Float32Array);assert.equal(n.worldMatrix.length,16);assert.equal(n.normalMatrix.length,9);assert.deepEqual(Array.from(n.worldMatrixF32),n.worldMatrix.map(Math.fround));assert.deepEqual(Array.from(n.normalMatrixF32),n.normalMatrix.map(Math.fround));if(n.type==='group')assert.equal(n.bounds,null);else{assert(Object.isFrozen(n.bounds));assert(Object.isFrozen(n.bounds.min));}}
  assert.deepEqual(p.draws.map(d=>d.id),p.nodes.filter(n=>n.type==='mesh'&&n.effectiveVisible).map(n=>n.id));
  for(const d of p.draws){assert(Object.isFrozen(d));assert.strictEqual(d.node,p.nodes.find(n=>n.id===d.id));assert.strictEqual(d.geometry,p.geometries.find(g=>g.geometry.id===d.geometryId));assert.strictEqual(d.material,p.scene.materials.find(m=>m.id===d.materialId));}
 }
 const fixtures=[];fixtures.push(['nested_shared',scene()]);const hidden=scene();hidden.nodes.find(n=>n.id==='child').visible=false;fixtures.push(['hidden_ancestor',hidden]);const allHidden=scene();allHidden.nodes.find(n=>n.id==='root').visible=false;fixtures.push(['hidden_root',allHidden]);const empty=scene();empty.nodes=[];empty.geometries=[];empty.materials=[];fixtures.push(['genuine_empty',empty]);const unused=scene();unused.nodes=[];fixtures.push(['unused_catalogs',unused]);fixtures.push(['depth16',depth(16)]);
 for(const[label,request]of fixtures){
  const original=json(request),p=gpu.prepareEngineScene(request);assert.equal(json(request),original);verify(request,p);
  if(label==='nested_shared'){
   assert.deepEqual(p.draws.map(d=>d.id),['a','b']);assert.strictEqual(p.draws[0].geometry,p.draws[1].geometry);assert.strictEqual(p.draws[0].material,p.draws[1].material);
   const a=p.nodes.find(n=>n.id==='a'),b=p.nodes.find(n=>n.id==='b');
   nearArray(a.worldMatrix,[0,2,0,0,-6,0,0,0,0,0,2,0,-3,3,0,1]);nearArray(b.worldMatrix,[0,2,0,0,-3,0,0,0,0,0,1,0,3,-1,0,1]);
   nearArray(a.normalMatrix,[0,.5,0,-1/6,0,0,0,0,.5]);nearArray(b.normalMatrix,[0,.5,0,-1/3,0,0,0,0,1]);
   nearArray(a.bounds.min,[-9,3,0]);nearArray(a.bounds.max,[-3,5,2]);nearArray(b.bounds.min,[0,-1,0]);nearArray(b.bounds.max,[3,1,1]);
   const originalNormal=request.geometries[0].normals.slice(0,3),normal=a.normalMatrix;const transformed=[0,1,2].map(row=>normal[row]*originalNormal[0]+normal[3+row]*originalNormal[1]+normal[6+row]*originalNormal[2]),length=Math.hypot(...transformed);nearArray(transformed.map(v=>v/length),[1/Math.sqrt(10),0,3/Math.sqrt(10)]);
   assert(Object.is(p.scene.geometries[0].positions[0],-0));assert(Object.is(p.scene.geometries[0].uvs[0],-0));assert(Object.is(p.scene.geometries[0].indices[0],-0));
  }
  if(label==='hidden_ancestor')assert.deepEqual(p.draws.map(d=>d.id),['b']);if(label==='hidden_root'||label==='genuine_empty'||label==='unused_catalogs'||label==='depth16')assert.equal(p.draws.length,0);
  await writeFile(file,json(request));const coldInput=JSON.parse(await readFile(file,'utf8')),cold=gpu.prepareEngineScene(coldInput);verify(request,cold);assert.equal(json(cold.scene),original);assert.notStrictEqual(cold.scene,p.scene);
  if(p.geometries.length){assert.notStrictEqual(p.geometries[0].positions.buffer,cold.geometries[0].positions.buffer);p.geometries[0].positions[0]=999;assert.equal(json(cold.scene),original);assert.notEqual(cold.geometries[0].positions[0],999);}
  if(p.nodes.length){assert.notStrictEqual(p.nodes[0].worldMatrixF32.buffer,cold.nodes[0].worldMatrixF32.buffer);p.nodes[0].worldMatrixF32[0]=999;assert.equal(json(cold.scene),original);}
  current=cold;accepted++;acceptance.push({label,nodes:p.nodes.length,draws:p.draws.length,geometries:p.geometries.length,bufferBytes:p.bufferBytes,vertexWork:p.vertexWork,sourceHash:hash(json(request))});
 }
 // Retain a real resource-bearing accepted frame for every rejected replacement.
 const last=scene();current=gpu.prepareEngineScene(last);await writeFile(file,json(last));const previous=current,previousBits=json(current.scene),saved=await readFile(file),priorBuffer=Array.from(current.geometries[0].positions);
 const cases=[];function change(label,edit,code){const s=scene();edit(s);cases.push([label,s,code]);}
 change('root_format',s=>s.format='native-scene','VERSION');change('root_version',s=>s.version=1,'VERSION');change('root_frame',s=>s.coordinateSystem='left-handed-z-up','VERSION');change('root_units',s=>s.positionUnit='mm','VERSION');
 change('bad_id',s=>s.id='bad id','INPUT');change('background_color',s=>s.background[0]=-1,'INPUT');change('material_type',s=>s.materials[0].type='pbr','VERSION');change('material_colorspace',s=>s.materials[0].colorSpace='srgb','VERSION');change('material_color',s=>s.materials[0].color[0]=2,'INPUT');
 change('missing_parent',s=>s.nodes[0].parentId='missing','REFERENCE');change('mesh_parent',s=>s.nodes[1].parentId='a','REFERENCE');change('cycle',s=>s.nodes.find(n=>n.id==='root').parentId='child','REFERENCE');change('duplicate_node',s=>s.nodes[1].id='a','REFERENCE');change('duplicate_geometry',s=>s.geometries.push(clone(s.geometries[0])),'REFERENCE');change('duplicate_material',s=>s.materials.push(clone(s.materials[0])),'REFERENCE');change('missing_geometry',s=>s.nodes[0].geometryId='missing','REFERENCE');change('missing_material',s=>s.nodes[0].materialId='missing','REFERENCE');
 change('uncertain_quaternion',s=>s.nodes[0].rotationXYZW=[0,0,0,.999],'TRANSFORM');change('zero_scale',s=>s.nodes[0].scale[0]=0,'TRANSFORM');change('negative_scale',s=>s.nodes[0].scale[0]=-1,'TRANSFORM');change('large_local_translation',s=>s.nodes[0].translation[0]=1001,'TRANSFORM');change('numeric_visibility',s=>s.nodes[0].visible=1,'INPUT');change('bad_camera',s=>s.camera.target=[0,0,12],'CAMERA');
 cases.push(['depth17',depth(17),'BUDGET']);change('nodes65',s=>s.nodes=Array.from({length:65},(_,i)=>group('node_'+i)),'BUDGET');change('meshes33',s=>s.nodes=Array.from({length:33},(_,i)=>mesh('mesh_'+i)),'BUDGET');change('geometry_catalog17',s=>s.geometries=Array.from({length:17},(_,i)=>({...geometry(),id:'g_'+i})),'BUDGET');
 const large=largeGeometry();change('aggregate_vertices',s=>{s.nodes=[];s.geometries=Array.from({length:4},(_,i)=>({...large,id:'large_'+i}));},'BUDGET');change('instance_work',s=>{s.geometries=[large];s.nodes=Array.from({length:8},(_,i)=>mesh('work_'+i));},'BUDGET');
 change('geometry_wrong_version',s=>s.geometries[0].version=1,'VERSION');change('original_triangle_degenerate',s=>s.geometries[0].indices=[0,1,1],'GEOMETRY');change('world_range',s=>{s.nodes=[mesh('range')];s.nodes[0].translation=[999,0,0];s.nodes[0].scale=[2,1,1];},'GEOMETRY');
 change('hidden_bad_geometry',s=>{s.nodes.find(n=>n.id==='root').visible=false;s.geometries[0].positions[0]=1001;},'GEOMETRY');
 const collapse=scene();collapse.nodes=[mesh('collapse')];collapse.nodes[0].translation=[1,0,0];collapse.geometries[0].positions=[0,0,0,2**-25,0,0,0,1,0];collapse.geometries[0].normals=[0,0,1,0,0,1,0,0,1];cases.push(['world_f32_triangle_collapse',collapse,'REPRESENTATION']);
 change('root_getter',s=>Object.defineProperty(s,'nodes',{enumerable:true,get(){getters++;return[];}}),'INPUT');change('node_getter',s=>Object.defineProperty(s.nodes[0],'translation',{enumerable:true,get(){getters++;return[0,0,0];}}),'INPUT');change('array_getter',s=>Object.defineProperty(s.nodes,'0',{enumerable:true,get(){getters++;return mesh('bad');}}),'INPUT');change('vector_getter',s=>Object.defineProperty(s.nodes[0].scale,'0',{enumerable:true,get(){getters++;return 1;}}),'INPUT');change('sparse_nodes',s=>delete s.nodes[0],'INPUT');change('extra_field',s=>s.foreign=1,'INPUT');change('symbol_field',s=>s[Symbol('foreign')]=1,'INPUT');change('hidden_field',s=>Object.defineProperty(s,'foreign',{value:1}),'INPUT');cases.push(['foreign_prototype',Object.assign(Object.create({}),scene()),'INPUT']);
 for(const[label,value,code]of cases){let error;try{gpu.prepareEngineScene(value);}catch(e){error=e;}assert(error instanceof gpu.EngineSceneError,label+' public error');assert.equal(error.code,code,label);assert.equal(getters,0);assert.strictEqual(current,previous);assert.equal(json(current.scene),previousBits);assert.deepEqual(Array.from(current.geometries[0].positions),priorBuffer);assert.deepEqual(await readFile(file),saved);refused++;refusals.push({label,code,message:error.message,cause:error.cause?.message??null,acceptedResourcesAndFileRetained:true});}
 results.push({provider:name,acceptance,refusals,exports:Object.keys(gpu).sort()});
}
const report={issue:1182,accepted,refused,getters,actualGL:false,sourceGraph:graph,source:await receipt(resolve(pkg,'src/engine-scene.ts')),declarations:await receipt(resolve(pkg,published.types)),ordinary:await receipt(ordinary),emitted:await receipt(resolve(pkg,published.import)),results,support:'Engine scene0 / linear opaque unlit / generic triangle geometry0 / scene units RH-Yup. Original local data vs derived column-major world/normal/F32 matrices, shared resources, effective visibility and CPU admission. No actual GL/pixels/texture/alpha/picking/native CAD/asset/animation/max-memory/performance/parity/editor/publication proof.'};
await writeFile(resolve(output,'actual-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({issue:1182,accepted,refused,getters,exports:results[0].exports.length,actualGL:false}));

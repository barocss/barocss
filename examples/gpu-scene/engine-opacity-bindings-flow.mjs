/** #1237: original opacity companion admission and Number camera order.
 * node examples/gpu-scene/engine-opacity-bindings-flow.mjs --output <fresh-directory>
 * CPU source/API/file only. No blend, shader, pixel, browser or GL claim.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const at=process.argv.indexOf('--output');
assert(at>=0&&process.argv[at+1],'--output <fresh-directory> required');
const output=resolve(process.argv[at+1]);await mkdir(output,{recursive:false});
const pkg=resolve(repo,'packages/barocss-gpu');
const manifest=JSON.parse(await readFile(resolve(pkg,'package.json'),'utf8'));
const published=manifest.publishConfig.exports['.'],ordinary=resolve(output,'ordinary-source.mjs');
const bundled=await build({entryPoints:[resolve(pkg,manifest.exports['.'].import)],bundle:true,platform:'node',format:'esm',target:'node22',outfile:ordinary,metafile:true});
const graph=Object.keys(bundled.metafile.inputs);
assert(graph.some(p=>p.endsWith('/src/engine/engine-opacity-bindings.ts')));
assert(!graph.some(p=>/barocss-(gpu|cad)\/dist\//.test(p)));
const hash=value=>createHash('sha256').update(value).digest('hex');
async function receipt(path){const bytes=await readFile(path);return{path,bytes:bytes.length,sha256:hash(bytes)};}
function json(v){if(typeof v==='number'){assert(Number.isFinite(v));return Object.is(v,-0)?'-0':JSON.stringify(v);}if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(json).join(',')+']';return '{'+Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,n])=>JSON.stringify(k)+':'+json(n)).join(',')+'}';}
const clone=v=>JSON.parse(json(v));
function frozen(v){if(v&&typeof v==='object'){if(ArrayBuffer.isView(v))return;assert(Object.isFrozen(v));for(const c of Object.values(v))frozen(c);}}
const near=(actual,expected)=>assert(Math.abs(actual-expected)<=1e-10,`actual ${actual}; expected ${expected}`);
const vector=(a,b)=>{assert.equal(a.length,b.length);a.forEach((n,i)=>near(n,b[i]));};
const group=(id,parentId=null,translation=[0,0,0])=>({id,type:'group',parentId,translation,rotationXYZW:[0,0,0,1],scale:[1,1,1],visible:true});
const mesh=(id,z=0,materialId='white',parentId=null)=>({...group(id,parentId,[0,0,z]),type:'mesh',geometryId:'quad',materialId});
const material=id=>({id,type:'unlit',colorSpace:'linear',color:[1,1,1]});
function scene(nodes=[mesh('zero')]){return{format:'barocss-gpu-engine-scene',version:0,id:'opacity_scene',coordinateSystem:'right-handed-y-up',positionUnit:'scene',background:[0,.1,.2],camera:{eye:[-0,0,6],target:[0,0,0],up:[0,1,0],fovYDegrees:90,near:1,far:20},geometries:[{format:'barocss-gpu-triangle-geometry',version:0,id:'quad',coordinateSystem:'right-handed-y-up',positionUnit:'scene',winding:'ccw',positions:[-.25,-.25,-0,.25,-.25,0,.25,.25,0,-.25,.25,0],normals:[0,0,1,0,0,1,0,0,1,0,0,1],uvs:[-0,0,1,0,1,1,0,1],indices:[-0,1,2,0,2,3]}],materials:[material('white')],nodes};}
const companion=(bindings=[])=>({format:'barocss-gpu-engine-opacity-bindings',version:0,sceneId:'opacity_scene',bindings});
const binding=(materialId,opacity)=>({materialId,opacity});
const expected=(opaque=[],transparent=[],omitted=[])=>({opaque,transparent,omitted});
const fixtures=[];
const mixed=scene([mesh('near',2,'glass'),mesh('far',-2,'glass'),mesh('default',0),mesh('zero',0,'zero_alpha'),mesh('hidden_child',0,'glass','hidden_parent'),group('hidden_parent')]);
mixed.nodes.at(-1).visible=false;mixed.materials.push(material('glass'),material('zero_alpha'),material('unused'));
fixtures.push({label:'reverse_depth_default_zero_hidden_unused',s:mixed,c:companion([binding('glass',.5),binding('zero_alpha',-0),binding('unused',.25)]),known:expected(['default'],['far','near'],['zero','hidden_child'])});
fixtures.push({label:'exact_depth_ties_source_order',s:scene([mesh('tie_b',0),mesh('tie_a',-0),mesh('tie_c',0)]),c:companion([binding('white',.5)]),known:expected([],['tie_b','tie_a','tie_c'])});
const reversed=clone(mixed);reversed.camera.eye=[0,0,-6];reversed.camera.target=[0,0,0];
fixtures.push({label:'original_camera_reorders',s:reversed,c:clone(fixtures[0].c),known:expected(['default'],['near','far'],['zero','hidden_child'])});
const hierarchy=scene([mesh('child_a',0,'white','parent'),mesh('child_b',0,'white','parent'),mesh('behind',20),mesh('outside',0),group('parent',null,[2,0,1])]);
hierarchy.camera.eye=[6,0,8];hierarchy.camera.target=[0,0,0];hierarchy.nodes[0].translation=[1,0,1];hierarchy.nodes[1].translation=[0,1,-1];hierarchy.nodes[3].translation=[100,0,0];hierarchy.nodes[4].rotationXYZW=[0,0,Math.SQRT1_2,Math.SQRT1_2];hierarchy.nodes[4].scale=[2,3,4];
fixtures.push({label:'nonaxis_hierarchy_nonuniform_no_cull',s:hierarchy,c:companion([binding('white',.5)]),known:expected([],['child_b','child_a','behind','outside']),centres:{child_a:[2,2,5],child_b:[-1,0,-3],behind:[0,0,20],outside:[100,0,0]},depths:{child_a:4.8,child_b:13,behind:-6,outside:-50}});
const limit=scene(Array.from({length:32},(_,i)=>mesh('mesh_'+i,31-i,'material_'+i)));limit.materials=Array.from({length:32},(_,i)=>material('material_'+i));
fixtures.push({label:'32_material_mesh_binding_reverse_limit',s:limit,c:companion(Array.from({length:32},(_,i)=>binding('material_'+i,.5))),known:expected([],Array.from({length:32},(_,i)=>'mesh_'+(31-i)))});
const empty=scene([]);empty.geometries=[];empty.materials=[];
fixtures.push({label:'genuine_empty',s:empty,c:companion(),known:expected()},{label:'groups_not_draw_ids',s:scene([group('group')]),c:companion([binding('white',.5)]),known:expected()},{label:'all_one_original_source_order',s:scene([mesh('first',2),mesh('second',-2)]),c:companion([binding('white',1)]),known:expected(['first','second'])},{label:'zero_keeps_original_queries',s:scene(),c:companion([binding('white',-0)]),known:expected([],[],['zero']),query:true});
const extremes=scene([mesh('almost_one',1,'a'),mesh('smallest_positive',0,'b')]);extremes.materials=[material('a'),material('b')];
fixtures.push({label:'positive_extremes_still_transparent',s:extremes,c:companion([binding('a',1-Number.EPSILON),binding('b',Number.MIN_VALUE)]),known:expected([],['smallest_positive','almost_one'])},{label:'Number_depth_not_Float32_tie',s:scene([mesh('slightly_nearer',1.000000000001),mesh('slightly_farther',1)]),c:companion([binding('white',.5)]),known:expected([],['slightly_farther','slightly_nearer'])});
const providers=[['ordinary-source',await import(pathToFileURL(ordinary).href)],['emitted-public',await import(pathToFileURL(resolve(pkg,published.import)).href)]];
assert.deepEqual(Object.keys(providers[0][1]).sort(),Object.keys(providers[1][1]).sort());
const declarationPath=resolve(pkg,published.types),declaration=await readFile(declarationPath,'utf8');
for(const type of ['EngineOpacityBindingV0','EngineOpacityBindingsV0','PreparedEngineOpacityBindings'])assert(new RegExp('\\b'+type+'\\b').test(declaration),type+' public type');
let accepted=0,refused=0,getters=0,proxyReflections=0,oversizeArrayEnumerations=0;
const results=[];
for(const[name,gpu]of providers){
 for(const fn of ['prepareEngineOpacityBindings','EngineOpacityBindingsError','prepareEngineScene','raycastEngineScene','prepareEngineSceneFrustum'])assert.equal(typeof gpu[fn],'function');
 assert(Object.isFrozen(gpu.EngineOpacityBindingsDiagnosticCode));assert.deepEqual(Object.keys(gpu.EngineOpacityBindingsDiagnosticCode).sort(),['INPUT','VERSION','BUDGET','REFERENCE','RANGE','SCENE','NUMERICAL'].sort());
 const acceptance=[],refusals=[];
 function verify(s,c,p,known){assert.deepEqual(Object.keys(p).sort(),['scene','opacityBindings','opaqueNodeIds','transparentNodeIds','omittedNodeIds'].sort());frozen(p);assert.deepEqual(p.scene.scene,s);assert.deepEqual(p.opacityBindings,c);assert.notStrictEqual(p.scene.scene,s);assert.notStrictEqual(p.opacityBindings,c);assert.deepEqual(p.opaqueNodeIds,known.opaque);assert.deepEqual(p.transparentNodeIds,known.transparent);assert.deepEqual(p.omittedNodeIds,known.omitted);assert.deepEqual(Object.keys(p.opacityBindings).sort(),['format','version','sceneId','bindings'].sort());for(const b of p.opacityBindings.bindings)assert.deepEqual(Object.keys(b).sort(),['materialId','opacity']);}
 function query(p){const ray={format:'barocss-gpu-engine-ray',version:0,coordinateSystem:'right-handed-y-up',positionUnit:'scene',origin:[0,0,6],direction:[0,0,-1],near:1,far:20},hit=gpu.raycastEngineScene(p.scene.scene,ray);assert(hit);assert.equal(hit.nodeId,'zero');near(hit.distance,6);vector(hit.point,[0,0,0]);vector(hit.uv,[.5,.5]);const frustum=gpu.prepareEngineSceneFrustum(p.scene.scene,{format:'barocss-gpu-engine-scene-frustum-request',version:0,viewportWidth:100,viewportHeight:100});assert.deepEqual(frustum.candidateNodeIds,['zero']);assert.equal(p.scene.draws.length,1,'Opacity does not filter original source draws');return{ray,hit,candidateNodeIds:frustum.candidateNodeIds};}
 for(const fixture of fixtures){const{label,s,c,known}=fixture,sb=json(s),cb=json(c),p=gpu.prepareEngineOpacityBindings(s,c);verify(s,c,p,known);assert.equal(json(s),sb);assert.equal(json(c),cb);let observation=null;
  if(fixture.centres){observation=[];for(const[id,centre]of Object.entries(fixture.centres)){const n=p.scene.nodes.find(n=>n.id===id),actual=n.bounds.min.map((v,i)=>(v+n.bounds.max[i])/2);vector(actual,centre);const depth=.6*(6-centre[0])+.8*(8-centre[2]);near(depth,fixture.depths[id]);observation.push({id,centre:actual,independentDepth:depth});}}
  if(fixture.query)observation=query(p);
  const sourceFile=resolve(output,name+'.'+label+'.original.json'),sidecarFile=resolve(output,name+'.'+label+'.signed-zero.json'),resultFile=resolve(output,name+'.'+label+'.order.json');
  // Ordinary JSON loses negative zero. Keep full originals plus explicit authored opacity signs.
  await writeFile(sourceFile,JSON.stringify({scene:s,opacityBindings:c})+'\n');
  const negativeZeroBindings=c.bindings.flatMap((b,i)=>Object.is(b.opacity,-0)?[i]:[]);
  await writeFile(sidecarFile,JSON.stringify({negativeZeroBindings,sceneNegativeZeroPaths:negativeZeroPaths(s)})+'\n');
  const savedResult={scene:p.scene.scene,opacityBindings:p.opacityBindings,opaqueNodeIds:p.opaqueNodeIds,transparentNodeIds:p.transparentNodeIds,omittedNodeIds:p.omittedNodeIds,observation};await writeFile(resultFile,json(savedResult)+'\n');
  const cold=JSON.parse(await readFile(sourceFile,'utf8')),signs=JSON.parse(await readFile(sidecarFile,'utf8'));for(const i of signs.negativeZeroBindings)cold.opacityBindings.bindings[i].opacity=-0;for(const path of signs.sceneNegativeZeroPaths)restoreNegativeZero(cold.scene,path);
  const reopened=gpu.prepareEngineOpacityBindings(cold.scene,cold.opacityBindings);verify(s,c,reopened,known);assert.deepEqual(reopened,p);assert.notStrictEqual(reopened.scene,p.scene);assert.notStrictEqual(reopened.scene.scene,p.scene.scene);assert.notStrictEqual(reopened.opacityBindings.bindings,p.opacityBindings.bindings);assert.notStrictEqual(reopened.transparentNodeIds,p.transparentNodeIds);if(fixture.query)assert.deepEqual(query(reopened),observation);
  assert.deepEqual(JSON.parse(await readFile(resultFile,'utf8')),savedResult);accepted++;acceptance.push({label,known,observation,negativeZeroBindings,sourceSHA256:hash(sb),opacitySHA256:hash(cb),files:await Promise.all([sourceFile,sidecarFile,resultFile].map(receipt))});
 }
 const retainedS=scene(),retainedC=companion([binding('white',.5)]),previous=gpu.prepareEngineOpacityBindings(retainedS,retainedC),bits=json(previous),sb=json(retainedS),cb=json(retainedC),file=resolve(output,name+'.retained.original.json');await writeFile(file,json({scene:retainedS,opacityBindings:retainedC})+'\n');const saved=await readFile(file);
 const callerS=clone(retainedS),callerC=clone(retainedC),owned=gpu.prepareEngineOpacityBindings(callerS,callerC);callerS.nodes[0].translation[0]=99;callerS.geometries[0].uvs[0]=.75;callerC.bindings[0].opacity=0;assert.deepEqual(owned,previous);
 assert.notStrictEqual(owned.scene.geometries[0].positions,previous.scene.geometries[0].positions);assert.notStrictEqual(owned.scene.nodes[0].worldMatrixF32,previous.scene.nodes[0].worldMatrixF32);owned.scene.geometries[0].positions[0]=99;owned.scene.geometries[0].uvs[0]=.75;owned.scene.nodes[0].worldMatrixF32[12]=99;assert.equal(json(previous),bits);assert.deepEqual(owned.scene.scene,retainedS);assert.deepEqual(owned.transparentNodeIds,['zero']);assert.throws(()=>owned.transparentNodeIds.push('changed'),TypeError);assert.throws(()=>owned.opacityBindings.bindings[0].opacity=0,TypeError);
 const failures=[];function change(label,edit,code){const s=scene(),c=companion([binding('white',.5)]);edit(s,c);failures.push({label,s,c,code});}
 change('format',(s,c)=>c.format='rgba','VERSION');change('version',(s,c)=>c.version=1,'VERSION');change('invalid_scene_id',(s,c)=>c.sceneId='bad id','INPUT');change('wrong_scene_id',(s,c)=>c.sceneId='other','REFERENCE');change('missing_material',(s,c)=>c.bindings[0].materialId='absent','REFERENCE');change('duplicate_material',(s,c)=>c.bindings.push(binding('white',.5)),'REFERENCE');change('invalid_material_id',(s,c)=>c.bindings[0].materialId='bad id','INPUT');
 for(const[value,label]of [[-1,'negative'],[1.00001,'above_one'],[NaN,'NaN'],[Infinity,'infinite'],['0.5','string'],[null,'null']])change('opacity_'+label,(s,c)=>c.bindings[0].opacity=value,'RANGE');
 change('root_extra',(s,c)=>c.extra=1,'INPUT');change('root_symbol',(s,c)=>c[Symbol('extra')]=1,'INPUT');change('root_hidden',(s,c)=>Object.defineProperty(c,'extra',{value:1}),'INPUT');change('binding_extra',(s,c)=>c.bindings[0].extra=1,'INPUT');change('binding_hidden',(s,c)=>Object.defineProperty(c.bindings[0],'extra',{value:1}),'INPUT');change('binding_missing',(s,c)=>delete c.bindings[0].opacity,'INPUT');change('binding_symbol',(s,c)=>c.bindings[0][Symbol('extra')]=1,'INPUT');change('array_sparse',(s,c)=>delete c.bindings[0],'INPUT');change('array_extra',(s,c)=>c.bindings.extra=1,'INPUT');change('array_typed',(s,c)=>c.bindings=new Float32Array(1),'INPUT');
 change('root_getter',(s,c)=>Object.defineProperty(c,'bindings',{enumerable:true,get(){getters++;return[];}}),'INPUT');change('binding_getter',(s,c)=>Object.defineProperty(c.bindings[0],'opacity',{enumerable:true,get(){getters++;return .5;}}),'INPUT');change('array_getter',(s,c)=>Object.defineProperty(c.bindings,'0',{enumerable:true,get(){getters++;return binding('white',.5);}}),'INPUT');
 failures.push({label:'foreign_root_prototype',s:scene(),c:Object.assign(Object.create({}),companion()),code:'INPUT'});change('foreign_binding_prototype',(s,c)=>c.bindings[0]=Object.assign(Object.create({}),c.bindings[0]),'INPUT');
 const trap=new Error('actual opacity root ownKeys reflection trap');failures.push({label:'root_proxy_actual_cause',s:scene(),c:new Proxy(companion(),{ownKeys(){proxyReflections++;throw trap;}}),code:'INPUT',exactCause:trap});
 change('33_cardinality_before_array_keys',(s,c)=>c.bindings=new Proxy(Array.from({length:33},(_,i)=>binding('m_'+i,.5)),{ownKeys(){oversizeArrayEnumerations++;throw new Error('Oversize array must not enumerate keys');}}),'BUDGET');
 change('actual_scene_reference_cause',(s,c)=>s.nodes[0].geometryId='absent','SCENE');failures.at(-1).causeCode='REFERENCE';change('actual_scene_camera_cause',(s,c)=>s.camera.target=[0,0,6],'SCENE');failures.at(-1).causeCode='CAMERA';change('actual_scene_getter_cause',(s,c)=>Object.defineProperty(s,'nodes',{enumerable:true,get(){getters++;return[];}}),'SCENE');failures.at(-1).causeCode='INPUT';
 const metadataFirst=companion([binding('white',NaN)]);failures.push({label:'all_binding_ranges_before_provider',s:new Proxy(scene(),{ownKeys(){throw new Error('Provider must not run before invalid range');}}),c:metadataFirst,code:'RANGE'});
 const badScene=scene();badScene.nodes[0].geometryId='absent';failures.push({label:'provider_before_missing_companion_reference',s:badScene,c:companion([binding('absent',.5)]),code:'SCENE',causeCode:'REFERENCE'});
 for(const{label,s,c,code,causeCode,exactCause}of failures){let error;try{gpu.prepareEngineOpacityBindings(s,c);}catch(e){error=e;}assert(error instanceof gpu.EngineOpacityBindingsError,label+' public class');assert.equal(error.code,code,label);assert(error.message.length<=1024);if(causeCode){assert(error.cause instanceof gpu.EngineSceneError);assert.equal(error.cause.code,causeCode,label);}if(exactCause)assert.strictEqual(error.cause,exactCause);assert.equal(getters,0);assert.equal(oversizeArrayEnumerations,0);assert.equal(json(previous),bits);assert.equal(json(retainedS),sb);assert.equal(json(retainedC),cb);assert.deepEqual(await readFile(file),saved);refused++;refusals.push({label,code,message:error.message,cause:error.cause?.message??null,causeCode:error.cause?.code??null,previousOriginalsAndFileRetained:true});}
 results.push({provider:name,exports:Object.keys(gpu).sort(),acceptance,refusals,retainedFile:await receipt(file),finalPreparedSHA256:hash(bits)});
}
function negativeZeroPaths(v,path=[]){if(typeof v==='number')return Object.is(v,-0)?[path]:[];if(!v||typeof v!=='object')return[];return Object.entries(v).flatMap(([k,n])=>negativeZeroPaths(n,[...path,k]));}
function restoreNegativeZero(v,path){let target=v;for(const k of path.slice(0,-1))target=target[k];target[path.at(-1)]=-0;}
assert.equal(results[0].finalPreparedSHA256,results[1].finalPreparedSHA256);
const report={issue:1237,stage:'CPU-original-opacity-companion-camera-order-file',accepted,refused,getters,proxyReflections,oversizeArrayEnumerations,actualGL:false,sourceGraph:graph,source:await receipt(resolve(pkg,'src/engine/engine-opacity-bindings.ts')),declarations:await receipt(declarationPath),ordinary:await receipt(ordinary),emitted:await receipt(resolve(pkg,published.import)),results,support:'Frozen full original scene0 plus opacity companion0; bounded Number world-AABB-centre camera-depth ordering, exact ties retain source order, no frustum cull. Independent hierarchy/camera/32-mesh known order, signed-zero cold sidecar, actual unchanged ray/frustum authority, source/files/caller/execution-buffer ownership and actual refusal causes. No blend/shader/pixel/triangle sorting/browser/GL/resource lifetime/performance/native coefficient/editor/publication claim.'};
const resultFile=resolve(output,'actual-result.json');await writeFile(resultFile,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({issue:1237,accepted,refused,getters,proxyReflections,oversizeArrayEnumerations,exports:results[0].exports.length,resultSHA256:(await receipt(resultFile)).sha256,actualGL:false}));

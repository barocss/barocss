/** #1184: original opaque texture companion CPU admission and cold original files.
 * node examples/gpu-scene/engine-texture-bindings-flow.mjs --output <fresh-directory>
 * No GL, sampled pixels, renderer, browser, mock driver or texture-render acceptance.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),at=process.argv.indexOf('--output');assert(at>=0&&process.argv[at+1],'--output <fresh-directory> required');const output=resolve(process.argv[at+1]);await mkdir(output,{recursive:false});
const pkg=resolve(repo,'packages/barocss-gpu'),manifest=JSON.parse(await readFile(resolve(pkg,'package.json'),'utf8')),published=manifest.publishConfig.exports['.'],ordinary=resolve(output,'ordinary-source.mjs');
const built=await build({entryPoints:[resolve(pkg,manifest.exports['.'].import)],bundle:true,platform:'node',format:'esm',target:'node22',outfile:ordinary,metafile:true});
const graph=Object.keys(built.metafile.inputs);assert(graph.some(p=>p.endsWith('/src/engine-texture-bindings.ts')));assert(!graph.some(p=>/barocss-(gpu|cad)\/dist\//.test(p)));
const hash=value=>createHash('sha256').update(value).digest('hex');async function receipt(path){const bytes=await readFile(path);return{path,bytes:bytes.length,sha256:hash(bytes)};}
function json(v){if(typeof v==='number'){assert(Number.isFinite(v));return Object.is(v,-0)?'-0':JSON.stringify(v);}if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(json).join(',')+']';return '{'+Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,n])=>JSON.stringify(k)+':'+json(n)).join(',')+'}';}
const clone=value=>JSON.parse(json(value));
// Example-only streaming bit hash; avoids embedding maximum fixture arrays in reports.
function numberBitsHash(values){const digest=createHash('sha256'),buffer=Buffer.alloc(65536),view=new DataView(buffer.buffer,buffer.byteOffset,buffer.byteLength);let used=0;for(const value of values){view.setFloat64(used,value,true);used+=8;if(used===buffer.length){digest.update(buffer);used=0;}}if(used)digest.update(buffer.subarray(0,used));return digest.digest('hex');}
function scene(){
 const node=(id,materialId,x)=>({id,type:'mesh',parentId:null,translation:[x,-0,0],rotationXYZW:[0,0,0,1],scale:[1,1,1],visible:true,geometryId:'triangle',materialId});
 return{format:'barocss-gpu-engine-scene',version:0,id:'texture_scene',coordinateSystem:'right-handed-y-up',positionUnit:'scene',background:[0,.1,.2],camera:{eye:[0,0,6],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.01,far:100},
  geometries:[{format:'barocss-gpu-triangle-geometry',version:0,id:'triangle',coordinateSystem:'right-handed-y-up',positionUnit:'scene',winding:'ccw',positions:[-0,0,0,1,0,0,0,1,0],normals:[0,0,1,0,0,1,0,0,1],uvs:[-0,0,1,0,0,1],indices:[-0,1,2]}],
  materials:[{id:'white',type:'unlit',colorSpace:'linear',color:[1,1,1]},{id:'tint',type:'unlit',colorSpace:'linear',color:[.25,.5,.75]}],nodes:[node('left','white',-1),node('right','tint',1)]};
}
const texture=(id='checker',width=2,height=2,pixels=[255,-0,0,255,0,255,0,255,0,0,255,255,255,255,255,255])=>({id,width,height,format:'rgba8',colorSpace:'srgb',rowOrigin:'bottom-left',filter:'nearest',wrapS:'clamp-to-edge',wrapT:'clamp-to-edge',pixels});
const companion=()=>({format:'barocss-gpu-engine-texture-bindings',version:0,sceneId:'texture_scene',textures:[texture()],bindings:[{materialId:'white',textureId:'checker'},{materialId:'tint',textureId:'checker'}]});
function bulk(){const s=scene();s.materials=Array.from({length:32},(_,i)=>({id:'m_'+i,type:'unlit',colorSpace:'linear',color:[1,1,1]}));s.nodes[0].materialId='m_0';s.nodes[1].materialId='m_1';const b=companion();b.textures=Array.from({length:8},(_,i)=>texture('t_'+i,1,1,[i*31,0,0,255]));b.bindings=Array.from({length:32},(_,i)=>({materialId:'m_'+i,textureId:'t_'+(i%8)}));return{s,b};}
const maximum=texture('maximum',1024,1024,Array(4194304).fill(255));maximum.pixels[0]=-0;
const providers=[['ordinary-source',await import(pathToFileURL(ordinary).href)],['emitted-public',await import(pathToFileURL(resolve(pkg,published.import)).href)]];assert.deepEqual(Object.keys(providers[0][1]).sort(),Object.keys(providers[1][1]).sort());
const declarationPath=resolve(pkg,published.types),declaration=await readFile(declarationPath,'utf8');for(const name of ['EngineTextureV0','EngineTextureBindingV0','EngineTextureBindingsV0','PreparedEngineTexture','PreparedEngineTextureBindings'])assert(new RegExp('\\b'+name+'\\b').test(declaration),name+' public type export');
let accepted=0,refused=0,getters=0;const results=[];
for(const[name,gpu]of providers){
 assert.equal(typeof gpu.prepareEngineTextureBindings,'function');assert.equal(typeof gpu.EngineTextureBindingsError,'function');assert(Object.isFrozen(gpu.EngineTextureBindingsDiagnosticCode));
 assert.deepEqual(Object.keys(gpu.EngineTextureBindingsDiagnosticCode).sort(),['INPUT','VERSION','BUDGET','REFERENCE','TEXTURE','SCENE'].sort());
 const acceptance=[],refusals=[];let current;
 function verify(s,b,p){
  assert.deepEqual(Object.keys(p).sort(),['scene','textureBindings','textures','pixelBytes'].sort());assert(Object.isFrozen(p));assert.deepEqual(p.scene.scene,s);assert.notStrictEqual(p.scene.scene,s);assert.deepEqual(p.textureBindings,b);assert.notStrictEqual(p.textureBindings,b);
  assert(Object.isFrozen(p.textureBindings));assert(Object.isFrozen(p.textureBindings.textures));assert(Object.isFrozen(p.textureBindings.bindings));assert(Object.isFrozen(p.textures));assert.equal(p.textures.length,b.textures.length);assert.equal(p.pixelBytes,b.textures.reduce((sum,t)=>sum+t.pixels.length,0));
  for(let i=0;i<b.textures.length;i++){
   const original=b.textures[i],prepared=p.textures[i];assert.deepEqual(Object.keys(prepared).sort(),['texture','pixels']);assert(Object.isFrozen(prepared));assert.strictEqual(prepared.texture,p.textureBindings.textures[i]);assert.notStrictEqual(prepared.texture,original);assert.notStrictEqual(prepared.texture.pixels,original.pixels);assert(Object.isFrozen(prepared.texture));assert(Object.isFrozen(prepared.texture.pixels));assert(prepared.pixels instanceof Uint8Array);assert.equal(prepared.pixels.length,original.width*original.height*4);
   for(let j=0;j<original.pixels.length;j++){assert(Object.is(prepared.texture.pixels[j],original.pixels[j]),'Original Number byte/sign bits retained');assert.equal(prepared.pixels[j],original.pixels[j]===0?0:original.pixels[j],'Independent upload byte order');}
   assert.equal(prepared.texture.rowOrigin,'bottom-left');
  }
  for(const binding of p.textureBindings.bindings)assert(Object.isFrozen(binding));
 }
 async function accept(label,s,b,cold=true){
  const sourceBits=json(s),sourcePixels=b.textures.map(t=>numberBitsHash(t.pixels)),p=gpu.prepareEngineTextureBindings(s,b);verify(s,b,p);assert.equal(json(s),sourceBits);assert.deepEqual(b.textures.map(t=>numberBitsHash(t.pixels)),sourcePixels);
  const files=[];
  if(cold){
   const path=resolve(output,name+'.'+label+'.original.json');await writeFile(path,json({scene:s,textureBindings:b})+'\n');const original=JSON.parse(await readFile(path,'utf8')),reopened=gpu.prepareEngineTextureBindings(original.scene,original.textureBindings);verify(s,b,reopened);assert.deepEqual(reopened.textureBindings,p.textureBindings);assert.notStrictEqual(reopened.textureBindings,p.textureBindings);
   for(let i=0;i<p.textures.length;i++){assert.notStrictEqual(reopened.textures[i].pixels.buffer,p.textures[i].pixels.buffer);const byte=reopened.textures[i].pixels[0];p.textures[i].pixels[0]=(byte+1)%256;assert.equal(reopened.textures[i].pixels[0],byte);assert(Object.is(p.textures[i].texture.pixels[0],b.textures[i].pixels[0]));}
   files.push(await receipt(path));current=reopened;
  }else current=p;
  accepted++;acceptance.push({label,sceneSHA256:hash(sourceBits),catalogTextures:b.textures.length,bindingCount:b.bindings.length,pixelBytes:current.pixelBytes,textures:current.textures.map(t=>({id:t.texture.id,width:t.texture.width,height:t.texture.height,sourceNumberF64LESHA256:numberBitsHash(t.texture.pixels),uploadSHA256:hash(t.pixels)})),coldOriginalFile:cold,files});
  return current;
 }
 const s=scene(),b=companion(),primary=await accept('checker_shared_two_materials',s,b);
 assert.equal(primary.pixelBytes,16);assert.deepEqual(primary.textureBindings.textures[0].pixels.slice(0,8),[255,-0,0,255,0,255,0,255]);assert.deepEqual(Array.from(primary.textures[0].pixels.slice(8)),[0,0,255,255,255,255,255,255]);assert(Object.is(primary.textureBindings.textures[0].pixels[1],-0));assert.equal(primary.scene.draws.length,2);assert.strictEqual(primary.scene.draws[0].geometry,primary.scene.draws[1].geometry);assert.deepEqual(primary.textureBindings.bindings.map(row=>row.textureId),['checker','checker']);
 const primaryBits=json(primary.textureBindings),primaryUpload=Array.from(primary.textures[0].pixels),callerS=clone(s),callerB=clone(b),independent=gpu.prepareEngineTextureBindings(callerS,callerB);callerS.geometries[0].uvs[0]=.75;callerB.textures[0].pixels[0]=99;callerB.bindings[0].textureId='caller_changed';assert.equal(json(independent.textureBindings),primaryBits);assert.deepEqual(Array.from(independent.textures[0].pixels),primaryUpload);assert(Object.is(independent.scene.scene.geometries[0].uvs[0],-0));
 const replacement=companion();replacement.textures[0].pixels.splice(0,4,0,0,255,255);const replaced=await accept('same_id_new_original_pixels',scene(),replacement);assert.equal(replaced.textures[0].texture.id,'checker');assert.equal(replaced.textures[0].pixels[0],0);assert.equal(primary.textures[0].pixels[0],255);assert.equal(json(primary.textureBindings),primaryBits);
 const zero=companion();zero.textures=[];zero.bindings=[];await accept('empty_catalog_original_scene',scene(),zero);
 const empty=scene();empty.nodes=[];empty.geometries=[];empty.materials=[];await accept('genuine_empty_scene_and_catalog',empty,zero);
 const unused=companion();unused.textures.push(texture('unused_valid',1,1,[23,45,67,255]));const unusedResult=await accept('unused_catalog_still_prepared',scene(),unused);assert.equal(unusedResult.pixelBytes,20);
 const minimum=companion();minimum.textures=[texture('checker',1,1,[-0,10,20,255])];await accept('minimum_one_texel',scene(),minimum);
 const all=bulk();await accept('exact_eight_textures_thirtytwo_bindings',all.s,all.b);
 const maxBindings=companion();maxBindings.textures=[maximum];maxBindings.bindings=[{materialId:'white',textureId:'maximum'},{materialId:'tint',textureId:'maximum'}];const maximal=await accept('exact_1024_squared_aggregate_texel_limit',scene(),maxBindings,false);assert.equal(maximal.pixelBytes,4194304);
 // Retain the source-bearing checker result/files for all refused replacements.
 const retainedS=scene(),retainedB=companion();current=gpu.prepareEngineTextureBindings(retainedS,retainedB);const file=resolve(output,name+'.retained.original.json');await writeFile(file,json({scene:retainedS,textureBindings:retainedB})+'\n');
 const previous=current,previousBits=json(current.textureBindings),sceneBits=json(current.scene.scene),saved=await readFile(file),previousUpload=Array.from(current.textures[0].pixels);
 const failures=[];function change(label,edit,code){const request=companion();edit(request);failures.push({label,s:scene(),b:request,code});}
 change('companion_format',b=>b.format='native-textures','VERSION');change('companion_version',b=>b.version=1,'VERSION');change('invalid_scene_identifier',b=>b.sceneId='bad id','INPUT');change('foreign_scene_identity',b=>b.sceneId='different_scene','REFERENCE');
 for(const[field,value]of [['format','rgba16'],['colorSpace','linear'],['rowOrigin','top-left'],['filter','linear'],['wrapS','repeat'],['wrapT','repeat']])change('unsupported_texture_'+field,b=>b.textures[0][field]=value,'VERSION');
 for(const[value,label]of [[0,'zero'],[1025,'oversized'],[1.5,'fractional']])change('width_'+label,b=>b.textures[0].width=value,'TEXTURE');change('height_zero',b=>b.textures[0].height=0,'TEXTURE');
 change('pixel_count_short',b=>b.textures[0].pixels.pop(),'INPUT');change('pixel_count_long',b=>b.textures[0].pixels.push(0),'INPUT');
 for(const[value,label]of [[-1,'negative'],[256,'large'],[.5,'fractional'],[NaN,'nonfinite']])change('byte_'+label,b=>b.textures[0].pixels[0]=value,'TEXTURE');change('nonopaque_alpha',b=>b.textures[0].pixels[3]=254,'TEXTURE');change('unused_invalid_texture',b=>b.textures.push(texture('unused_bad',1,1,[0,0,0,254])),'TEXTURE');
 change('duplicate_texture_identity',b=>b.textures.push(clone(b.textures[0])),'REFERENCE');change('duplicate_material_binding',b=>b.bindings.push(clone(b.bindings[0])),'REFERENCE');change('missing_material',b=>b.bindings[0].materialId='absent','REFERENCE');change('missing_texture',b=>b.bindings[0].textureId='absent','REFERENCE');
 change('nine_textures',b=>b.textures=Array.from({length:9},(_,i)=>texture('t_'+i,1,1,[0,0,0,255])),'BUDGET');const tooMany=bulk();tooMany.b.bindings.push(clone(tooMany.b.bindings[0]));failures.push({label:'thirtythree_bindings',...tooMany,code:'BUDGET'});
 const aggregate=companion();aggregate.textures=[maximum,{...maximum,id:'second_maximum'}];aggregate.bindings=[{materialId:'white',textureId:'maximum'},{materialId:'tint',textureId:'second_maximum'}];failures.push({label:'two_maximum_textures_aggregate',s:scene(),b:aggregate,code:'BUDGET'});
 const early=companion();early.textures[0].pixels.pop();failures.push({label:'pixel_count_precedes_scene_admission',s:{},b:early,code:'INPUT'});failures.push({label:'aggregate_budget_precedes_scene_admission',s:{},b:aggregate,code:'BUDGET'});
 change('root_accessor',b=>Object.defineProperty(b,'textures',{enumerable:true,get(){getters++;return[];}}),'INPUT');change('texture_accessor',b=>Object.defineProperty(b.textures[0],'pixels',{enumerable:true,get(){getters++;return[];}}),'INPUT');change('pixel_accessor',b=>Object.defineProperty(b.textures[0].pixels,'0',{enumerable:true,get(){getters++;return 255;}}),'INPUT');change('binding_accessor',b=>Object.defineProperty(b.bindings[0],'textureId',{enumerable:true,get(){getters++;return'checker';}}),'INPUT');
 change('sparse_texture_catalog',b=>delete b.textures[0],'INPUT');change('sparse_pixels',b=>delete b.textures[0].pixels[0],'INPUT');change('sparse_bindings',b=>delete b.bindings[0],'INPUT');change('extra_root_field',b=>b.extra=1,'INPUT');change('hidden_root_field',b=>Object.defineProperty(b,'extra',{value:1}),'INPUT');change('symbol_texture_field',b=>b.textures[0][Symbol('extra')]=1,'INPUT');change('extra_pixel_field',b=>b.textures[0].pixels.extra=1,'INPUT');change('hidden_binding_field',b=>Object.defineProperty(b.bindings[0],'extra',{value:1}),'INPUT');change('typed_pixels',b=>b.textures[0].pixels=Uint8Array.from(b.textures[0].pixels),'INPUT');
 failures.push({label:'foreign_root_prototype',s:scene(),b:Object.assign(Object.create({}),companion()),code:'INPUT'});change('foreign_texture_prototype',b=>b.textures[0]=Object.assign(Object.create({}),b.textures[0]),'INPUT');change('foreign_pixel_prototype',b=>Object.setPrototypeOf(b.textures[0].pixels,{}),'INPUT');
 const badScene=scene();badScene.nodes[0].geometryId='missing';failures.push({label:'actual_scene_reference_cause',s:badScene,b:companion(),code:'SCENE',sceneCause:'REFERENCE'});
 const budgetScene=scene();budgetScene.nodes=Array.from({length:65},(_,i)=>({...budgetScene.nodes[0],id:'n_'+i}));failures.push({label:'actual_scene_budget_is_scene_cause',s:budgetScene,b:companion(),code:'SCENE',sceneCause:'BUDGET'});
 for(const{label,s,b,code,sceneCause}of failures){let error;try{gpu.prepareEngineTextureBindings(s,b);}catch(e){error=e;}assert(error instanceof gpu.EngineTextureBindingsError,label+' actual public class');assert.equal(error.code,code,label);if(sceneCause){assert(error.cause instanceof gpu.EngineSceneError);assert.equal(error.cause.code,sceneCause);}assert.equal(getters,0);assert.strictEqual(current,previous);assert.equal(json(current.textureBindings),previousBits);assert.equal(json(current.scene.scene),sceneBits);assert.deepEqual(Array.from(current.textures[0].pixels),previousUpload);assert.deepEqual(await readFile(file),saved);refused++;refusals.push({label,code,message:error.message,cause:error.cause?.message??null,causeCode:error.cause?.code??null,previousOriginalsUploadAndFileRetained:true});}
 results.push({provider:name,acceptance,refusals,exports:Object.keys(gpu).sort(),retainedFile:await receipt(file),finalSourceTextureSHA256:hash(previousBits),finalUploadSHA256:hash(current.textures[0].pixels)});
}
assert.equal(results[0].finalSourceTextureSHA256,results[1].finalSourceTextureSHA256);assert.equal(results[0].finalUploadSHA256,results[1].finalUploadSHA256);
const report={issue:1184,stage:'CPU-source-admission-file',accepted,refused,getters,actualGL:false,textureRenderAcceptanceFulfilled:false,nodeVersion:process.versions.node,sourceGraph:graph,source:await receipt(resolve(pkg,'src/engine-texture-bindings.ts')),declarations:await receipt(declarationPath),ordinary:await receipt(ordinary),emitted:await receipt(resolve(pkg,published.import)),results,
 support:'Complete original opaque rgba8/srgb/bottom-left/nearest/clamp-to-edge companion0 and actual generic scene0. Independent frozen Number byte/sign/source authority versus mutable owned Uint8 upload. Original checker/new-same-ID files cold-reconstructed; exact1024² boundary has API byte/count/hash verification without maximum cold storage replay. No decoded/sampled pixels, colour transfer/tint shader, texture GL allocation, renderer/browser/mock/performance/editor/publication proof. Full texture-rendering gate remains pending.'};
await writeFile(resolve(output,'actual-result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({issue:1184,stage:report.stage,accepted,refused,getters,exports:results[0].exports.length,actualGL:false,textureRenderAcceptanceFulfilled:false}));

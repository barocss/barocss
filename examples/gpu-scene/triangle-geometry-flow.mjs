/** #1181: independently authored geometry into owned 16/32-bit engine buffers. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),at=process.argv.indexOf('--output');assert(at>=0&&process.argv[at+1],'--output <fresh directory> required');
const output=resolve(process.argv[at+1]);await mkdir(output,{recursive:false});
const pkg=resolve(repo,'packages/barocss-gpu'),manifest=JSON.parse(await readFile(resolve(pkg,'package.json'),'utf8')),published=manifest.publishConfig.exports['.'];
const ordinary=resolve(output,'ordinary-source.mjs');
const bundle=await build({entryPoints:[resolve(pkg,manifest.exports['.'].import)],bundle:true,platform:'node',format:'esm',target:'node22',outfile:ordinary,metafile:true});
const graph=Object.keys(bundle.metafile.inputs);assert(graph.some(p=>p.endsWith('/src/geometry/triangle-geometry.ts')));assert(!graph.some(p=>/barocss-(gpu|cad)\/dist\//.test(p)));
const hash=x=>createHash('sha256').update(x).digest('hex');async function receipt(path){const b=await readFile(path);return{path,bytes:b.length,sha256:hash(b)};}
function json(v){if(typeof v==='number'){assert(Number.isFinite(v));return Object.is(v,-0)?'-0':JSON.stringify(v);}if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(json).join(',')+']';return '{'+Object.entries(v).map(([k,n])=>JSON.stringify(k)+':'+json(n)).join(',')+'}';}
const clone=v=>JSON.parse(json(v));
const triangle=()=>({format:'barocss-gpu-triangle-geometry',version:0,id:'triangle',coordinateSystem:'right-handed-y-up',positionUnit:'scene',winding:'ccw',positions:[-0,-0,0,1,0,0,0,1,0],normals:[0,0,1,0,0,1,0,0,1],uvs:[-0,0,1,0,0,1],indices:[-0,1,2]});
const quad=()=>({...triangle(),id:'quad',positions:[0,0,0,1,0,0,1,1,0,0,1,0],normals:[0,0,1,0,0,1,0,0,1,0,0,1],uvs:[0,0,1,0,1,1,0,1],indices:[0,1,2,0,2,3]});
function large(index,small=false){const n=65537,positions=Array(n*3).fill(0),normals=Array(n*3).fill(0),uvs=Array(n*2).fill(0);for(let i=0;i<n;i++)normals[3*i+2]=1;positions[3]=1;positions[3*(small?2:index)+1]=1;if(small){positions[3*65536]=2;positions[3*65536+1]=3;}return {...triangle(),id:small?'unused_high_vertices':'index_'+index,positions,normals,uvs,indices:[0,1,small?2:index]};}
const fixtures=[['triangle_signed_zero',triangle(),'uint16'],['indexed_quad',quad(),'uint16'],['last_uint16_index',large(65535),'uint16'],['first_uint32_index',large(65536),'uint32'],['unused_high_vertices',large(2,true),'uint16']];
const providers=[['ordinary',await import(pathToFileURL(ordinary))],['emitted',await import(pathToFileURL(resolve(pkg,published.import)))]];
assert.deepEqual(Object.keys(providers[0][1]).sort(),Object.keys(providers[1][1]).sort());
const results=[];let accepted=0,refused=0,getters=0;
for(const[name,gpu]of providers){
 assert.equal(typeof gpu.prepareTriangleGeometry,'function');assert.equal(typeof gpu.TriangleGeometryError,'function');assert(Object.isFrozen(gpu.TriangleGeometryDiagnosticCode));let current;
 const sourcePath=resolve(output,name+'-accepted.geometry.json');const acceptedRecords=[],refusals=[];
 function verify(request,p,indexType){
  assert.deepEqual(p.geometry,request);assert.notStrictEqual(p.geometry,request);for(const field of ['positions','normals','uvs','indices']){assert.notStrictEqual(p.geometry[field],request[field]);assert(Object.isFrozen(p.geometry[field]));}
  assert(Object.isFrozen(p.geometry));assert.equal(p.indexType,indexType);assert.equal(p.vertexCount,request.positions.length/3);assert.equal(p.triangleCount,request.indices.length/3);
  for(const field of ['positions','normals','uvs']){assert(p[field] instanceof Float32Array);assert.deepEqual(Array.from(p[field]),request[field].map(Math.fround));}
  assert(p.indices instanceof(indexType==='uint16'?Uint16Array:Uint32Array));assert.deepEqual(Array.from(p.indices),request.indices.map(x=>x===0?0:x));
  assert.equal(p.bufferBytes,p.positions.byteLength+p.normals.byteLength+p.uvs.byteLength+p.indices.byteLength);
  const expected={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};for(let i=0;i<request.positions.length;i++){const a=i%3;expected.min[a]=Math.min(expected.min[a],request.positions[i]);expected.max[a]=Math.max(expected.max[a],request.positions[i]);}assert.deepEqual(p.bounds,expected);assert(Object.isFrozen(p.bounds.min));assert(Object.isFrozen(p.bounds.max));
 }
 for(const[label,request,type]of fixtures){
  const bits=json(request),p=gpu.prepareTriangleGeometry(request);assert.equal(json(request),bits);verify(request,p,type);
  const path=resolve(output,name+'-'+label+'.geometry.json');await writeFile(path,json(request));const coldInput=JSON.parse(await readFile(path,'utf8')),cold=gpu.prepareTriangleGeometry(coldInput);verify(request,cold,type);
  assert.deepEqual(cold.positions,p.positions);assert.deepEqual(cold.indices,p.indices);assert.notStrictEqual(cold.positions.buffer,p.positions.buffer);assert.notStrictEqual(cold.indices.buffer,p.indices.buffer);
  const retained=json(p.geometry);coldInput.positions[0]=999;assert.equal(json(p.geometry),retained);p.positions[0]=999;assert.equal(json(p.geometry),retained);assert.notEqual(cold.positions[0],999);
  if(label==='triangle_signed_zero'){assert(Object.is(p.geometry.positions[0],-0));assert(Object.is(p.geometry.uvs[0],-0));assert(Object.is(p.geometry.indices[0],-0));}
  if(label==='unused_high_vertices')assert.deepEqual(p.bounds.max,[2,3,0]);
  await writeFile(sourcePath,json(request));current=cold;accepted++;acceptedRecords.push({label,vertexCount:p.vertexCount,triangleCount:p.triangleCount,indexType:type,bufferBytes:p.bufferBytes,source:await receipt(path)});
 }
 const previous=current,previousBits=json(current.geometry),saved=await readFile(sourcePath),buffer=Array.from(current.positions);
 async function reject(label,value,code){let error;try{gpu.prepareTriangleGeometry(value);}catch(e){error=e;}assert(error instanceof gpu.TriangleGeometryError,label+' actual public error');assert.equal(error.code,code,label);assert.strictEqual(current,previous);assert.equal(json(current.geometry),previousBits);assert.deepEqual(Array.from(current.positions),buffer);assert.deepEqual(await readFile(sourcePath),saved);refused++;refusals.push({label,code,message:error.message,cause:error.cause?.message??null,priorDataAndFileRetained:true});}
 const cases=[];const changed=(label,field,value,code)=>cases.push([label,{...triangle(),[field]:value},code]);
 changed('unsupported_format','format','barocss-native-preview','VERSION');changed('version1','version',1,'VERSION');changed('foreign_frame','coordinateSystem','left-handed-z-up','VERSION');changed('native_mm_not_scene','positionUnit','mm','VERSION');changed('clockwise_source','winding','cw','VERSION');changed('invalid_id','id','bad id','INPUT');
 changed('normal_count','normals',[0,0,1],'GEOMETRY');changed('uv_count','uvs',[0,0],'GEOMETRY');changed('index_count','indices',[0,1],'GEOMETRY');changed('position_bound','positions',[0,0,0,1001,0,0,0,1,0],'GEOMETRY');changed('uv_bound','uvs',[1001,0,1,0,0,1],'GEOMETRY');changed('normal_not_unit','normals',[0,0,2,0,0,1,0,0,1],'GEOMETRY');
 changed('index_outside','indices',[0,1,3],'GEOMETRY');changed('index_negative','indices',[-1,1,2],'GEOMETRY');changed('index_fraction','indices',[0,.5,2],'GEOMETRY');changed('repeated_index','indices',[0,1,1],'GEOMETRY');changed('zero_area','positions',[0,0,0,1,0,0,2,0,0],'GEOMETRY');changed('opposed_winding','indices',[0,2,1],'GEOMETRY');
 changed('nonfinite','positions',[0,0,0,Infinity,0,0,0,1,0],'INPUT');changed('typed_input','positions',Float64Array.from(triangle().positions),'INPUT');changed('oversized_length','positions',Array(393219),'BUDGET');
 const sparse=triangle();delete sparse.positions[0];cases.push(['sparse',sparse,'INPUT']);const extra=triangle();extra.positions.extra=1;cases.push(['array_extra',extra,'INPUT']);const symbol=triangle();symbol[Symbol('foreign')]=0;cases.push(['symbol',symbol,'INPUT']);const hidden=triangle();Object.defineProperty(hidden,'hidden',{value:1});cases.push(['hidden',hidden,'INPUT']);cases.push(['foreign_prototype',Object.assign(Object.create({}),triangle()),'INPUT']);
 const accessor=triangle();Object.defineProperty(accessor,'positions',{enumerable:true,get(){getters++;return triangle().positions;}});cases.push(['field_getter',accessor,'INPUT']);const element=triangle();Object.defineProperty(element.positions,'0',{enumerable:true,get(){getters++;return 0;}});cases.push(['element_getter',element,'INPUT']);
 const cycle=triangle();cycle.positions[0]=cycle;cases.push(['cyclic_object',cycle,'INPUT']);const underflow=triangle();underflow.uvs[0]=Number.MIN_VALUE;cases.push(['nonzero_f32_underflow',underflow,'REPRESENTATION']);
 const collapse=triangle();collapse.positions=[1,0,0,1+2**-25,0,0,1,1,0];cases.push(['original_valid_f32_triangle_collapse',collapse,'REPRESENTATION']);
 for(const[label,value,code]of cases)await reject(label,value,code);assert.equal(getters,0);
 results.push({provider:name,accepted:acceptedRecords,refusals,exports:Object.keys(gpu).sort()});
}
const report={issue:1181,accepted,refused,getters,actualGL:false,sourceGraph:graph,source:await receipt(resolve(pkg,'src/geometry/triangle-geometry.ts')),declarations:await receipt(resolve(pkg,published.types)),ordinary:await receipt(ordinary),emitted:await receipt(resolve(pkg,published.import)),results,support:'Own generic indexed triangle geometry0/scene/RH-Yup; original Number arrays and derived F32/Uint16/Uint32. CPU/API/file proof only. Index threshold witnesses are not maximum memory/performance or rendering/scene/material/texture/native CAD validity/Three.js parity/publication proof.'};
await writeFile(resolve(output,'actual-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({issue:1181,accepted,refused,getters,exports:results[0].exports.length,actualGL:false}));

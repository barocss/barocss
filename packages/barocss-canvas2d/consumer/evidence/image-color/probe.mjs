import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
const bundled = await build({ entryPoints:['packages/barocss-canvas2d/src/index.ts'],bundle:true,write:false,format:'esm',platform:'node',target:'es2022' });
const source = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const compiled = await import(pathToFileURL(`${process.cwd()}/packages/barocss-canvas2d/dist/index.js`));
const RawBytes=Uint8Array, rawOwnKeys=Reflect.ownKeys;
const names=['Uint8Array','Uint8ClampedArray','Uint16Array','Uint32Array','Int8Array','Int16Array','Int32Array','Float32Array','Float64Array','BigInt64Array','BigUint64Array','ArrayBuffer'];
const originals=Object.fromEntries(names.map(name=>[name,globalThis[name]]));
let assertions=0, seed=0; const records=[];
function check(value,label){assertions++;assert.ok(value,label);}
function equal(actual,expected,label){assertions++;assert.deepEqual(actual,expected,label);}
function byte(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>24;}
const asset=(width,height,pixels)=>({width,height,pixels:new RawBytes(pixels)});
function uniform(width,height,rgba){const value=asset(width,height,width*height*4);for(let i=0;i<value.pixels.length;i+=4)value.pixels.set(rgba,i);return value;}
function measured(call,pixelTarget){const allocations=[];let indexedKeyScans=0;for(const [name,Original] of Object.entries(originals))globalThis[name]=new Proxy(Original,{construct(target,args,newTarget){const result=Reflect.construct(target,args,newTarget);allocations.push({name,byteLength:result.byteLength,typedCopy:ArrayBuffer.isView(args[0])});return result;}});
 Reflect.ownKeys=value=>{if(value===pixelTarget)indexedKeyScans++;return rawOwnKeys(value);};let result,error;
 try{result=call();}catch(caught){error=caught;}finally{Reflect.ownKeys=rawOwnKeys;for(const [name,Original]of Object.entries(originals))globalThis[name]=Original;}return{result,error,allocations,indexedKeyScans};}
const tuples=[[1,2,3,0],[11,12,13,127],[21,22,23,255],[31,32,33,1],[41,42,43,128],[51,52,53,254]];
const literal=tuples.flat();
for(const [kind,api] of [['source-bundle',source],['compiled-root',compiled]]){
 seed=0x1335c2d;let getterReads=0;const comparisons=[],refusals=[];
 const fn=api.applyImageRGBMatrix;
 check(typeof fn==='function','public helper export');
 const clean=()=>asset(1,1,tuples[0]);
 function accepted(label,value,parameter,expectedValue){const before=new RawBytes(value.pixels),expected=expectedValue??oracle(value,parameter),snapshot=structuredClone(parameter);
 const test=measured(()=>fn(value,parameter),value.pixels);check(!test.error,label+' admitted');equal([test.result.width,test.result.height],[expected.width,expected.height],label+' dimensions');equal(test.result.pixels,expected.pixels,label+' independent full RGBA');equal(new RawBytes(value.pixels),before,label+' original bytes');equal(Object.entries(parameter),Object.entries(snapshot),label+' parameter retained');check(test.result!==value&&test.result.pixels.buffer!==value.pixels.buffer,label+' copied output');equal(test.allocations.map(a=>[a.name,a.byteLength,a.typedCopy]),[['Uint8Array',before.length,true],['Uint8Array',expected.pixels.length,false]],label+' exact copy plus output/no scratch');check(test.indexedKeyScans===0,label+' no indexed pixel keys');const saved=new RawBytes(test.result.pixels);test.result.pixels.fill(93);equal(new RawBytes(value.pixels),before,label+' result mutation isolation');comparisons.push({label,inputDimensions:[value.width,value.height],outputDimensions:[expected.width,expected.height],comparedBytes:saved.length,allocations:test.allocations,indexedKeyScans:0});return saved;}
 function refused(label,value,parameter,code='INVALID_ASSET'){const target=Object.getOwnPropertyDescriptor(value??{},'pixels')?.value;const test=measured(()=>fn(value,parameter),target);check(test.error?.code===code,label+' '+code);check(test.allocations.length===0,label+' typed allocations zero');check(test.indexedKeyScans===0,label+' indexed keys zero');refusals.push({label,code:test.error.code,typedAllocations:0,indexedKeyScans:0});}
 const valid=()=>[1,0,0,0,0,1,0,0,0,0,1,0];
 refused('null-asset',null,valid());refused('foreign-asset',Object.create({width:1,height:1,pixels:new RawBytes(4)}),valid());refused('extra-asset',{...clean(),extra:1},valid());refused('symbol-asset',{...clean(),[Symbol('extra')]:1},valid());refused('hidden-width',Object.defineProperty(clean(),'width',{value:1,enumerable:false}),valid());
 for(const field of ['width','height'])for(const [label,value]of [['zero',0],['negativeZero',-0],['negative',-1],['fraction',1.5],['NaN',NaN],['Infinity',Infinity],['string','1'],['4097',4097]])refused('asset-'+field+'-'+label,{...clean(),[field]:value},valid());
 for(const field of ['width','height','pixels']){const value=clean();Object.defineProperty(value,field,{enumerable:true,get(){getterReads++;throw Error('asset getter');}});refused('asset-accessor-'+field,value,valid());}
 refused('ordinary-array-pixels',{width:1,height:1,pixels:[1,2,3,4]},valid());refused('clamped-pixels',{width:1,height:1,pixels:new Uint8ClampedArray(4)},valid());class SubBytes extends RawBytes{}refused('subclass-pixels',{width:1,height:1,pixels:new SubBytes(4)},valid());
 const detached=new RawBytes(4);structuredClone(detached.buffer,{transfer:[detached.buffer]});refused('detached-pixels',{width:1,height:1,pixels:detached},valid());if(typeof SharedArrayBuffer==='function')refused('shared-pixels',{width:1,height:1,pixels:new RawBytes(new SharedArrayBuffer(4))},valid());refused('wrong-extent',{width:1,height:1,pixels:new RawBytes(3)},valid());
 for(const field of ['buffer','byteLength','byteOffset','length'])for(const mode of ['data','accessor']){const value=clean();Object.defineProperty(value.pixels,field,mode==='data'?{value:0}:{get(){getterReads++;throw Error('metadata getter');}});refused('metadata-'+field+'-'+mode,value,valid());}
 const extras=asset(3,2,literal);for(const name of ['unused',Symbol('unused'),Symbol.iterator])Object.defineProperty(extras.pixels,name,{get(){getterReads++;throw Error('ignored getter');}});Object.defineProperty(extras.pixels,'hidden',{value:1,enumerable:false});accepted('irrelevant-pixel-extras-ignored',extras,valid());
 const nullAsset=Object.assign(Object.create(null),asset(3,2,literal));accepted('null-prototype-asset',nullAsset,valid());

 // Independent exact rational oracle for selected dyadic coefficients. Random matrices
 // use denominators8; this oracle does not emulate the provider's binary64 expression.
 function dyadic(value){const denominator=2n**54n;return[BigInt(value*Number(denominator)),denominator];}
 function oracle(value,m){const result=[];for(let i=0;i<value.pixels.length;i+=4){for(let row=0;row<3;row++){let numerator=0n;const denominator=2n**54n;const channels=[value.pixels[i],value.pixels[i+1],value.pixels[i+2],255];for(let c=0;c<4;c++)numerator+=BigInt(channels[c])*dyadic(m[row*4+c])[0];numerator=numerator<0n?0n:numerator>255n*denominator?255n*denominator:numerator;result.push(Number((2n*numerator+denominator)/(2n*denominator)));}result.push(value.pixels[i+3]);}return asset(value.width,value.height,result);}
 accepted('literal-white-bake-hidden-alpha0',asset(2,1,[255,255,255,255,255,255,255,0]),[0,0,0,0.25,0,1,0,0,0,0,1,0],asset(2,1,[64,255,255,255,64,255,255,0]));
 const mix=[0,0,1,0,0.5,0.5,0,0,2,0,-1,0];accepted('literal3x2-mix-clamp-partial-hidden',asset(3,2,literal),mix,asset(3,2,[3,2,0,0,13,12,9,127,23,22,19,255,33,32,29,1,43,42,39,128,53,52,49,254]));
 accepted('final-half-tie',asset(1,1,[1,3,5,127]),[0.5,0,0,0,0,0.5,0,0,0,0,0.5,0],asset(1,1,[1,2,3,127]));
 accepted('arbitrary-one-third-binary64',asset(2,1,[255,128,1,0,3,6,9,255]),[1/3,0,0,0,0,1/3,0,0,0,0,1/3,0],asset(2,1,[85,43,0,0,1,2,3,255]));
 accepted('binary64-left-to-right-not-exact-rational',asset(1,1,[1,1,1,1]),[0.5,2**-54,-(2**-54),0,0,1,0,0,0,0,1,0],asset(1,1,[0,1,1,1]));
 const alphaBytes=[0,1,2,127,128,254,255];accepted('all-alpha-boundaries-exact',asset(7,1,alphaBytes.flatMap(a=>[17,129,251,a])),[-4,0,0,1,0,4,0,-1,0,0,1,0]);
 for(const [width,height]of [[1,1],[1,9],[9,1],[3,2],[2,3],[1,4096],[4096,1]])accepted('dimension-'+width+'x'+height,asset(width,height,Array.from({length:width*height*4},byte)),valid());
 for(let i=0;i<24;i++){const width=1+i%7,height=1+i%5;const m=Array.from({length:12},(_,j)=>j%4===3?(byte()%17-8)/8:(byte()%65-32)/8);accepted('seeded-dyadic-'+i,asset(width,height,Array.from({length:width*height*4},byte)),m);}
 const repeated=asset(3,2,literal),matrix=valid(),first=fn(repeated,matrix),second=fn(repeated,matrix),saved=new RawBytes(first.pixels);check(first.pixels.buffer!==second.pixels.buffer,'repeat output ownership');equal(first.pixels,second.pixels,'repeat byte equality');repeated.pixels.fill(7);matrix[0]=0;equal(first.pixels,saved,'later input+matrix mutation isolation');
 for(const [label,m]of [['missing',undefined],['null',null],['record',{}],['short',[1,2,3]],['typed',new Float64Array(valid())],['sparse',Array(12)],['extra',Object.assign(valid(),{extra:1})],['symbol',Object.assign(valid(),{[Symbol('x')]:1})],['foreign',Object.assign(Object.create(Array.prototype),valid())],['hidden',Object.defineProperty(valid(),'0',{value:1,enumerable:false})]])refused('matrix-'+label,clean(),m);
 for(let i=0;i<12;i++){for(const [label,n]of [['negativeZero',-0],['NaN',NaN],['Infinity',Infinity],['string','1'],['below',i%4===3?-1.01:-4.01],['above',i%4===3?1.01:4.01]]){const m=valid();m[i]=n;refused('matrix-'+i+'-'+label,clean(),m);}const m=valid();Object.defineProperty(m,String(i),{enumerable:true,get(){getterReads++;throw Error('matrix getter');}});refused('matrix-getter-'+i,clean(),m);}
 accepted('coefficient-offset-boundaries',asset(3,2,literal),[-4,4,0,-1,4,-4,0,1,0,0,4,-1]);
 const oversize=uniform(1024,257,[1,2,3,4]);refused('valid-over1MiB',oversize,valid(),'ASSET_LIMIT');const malformed=valid();malformed[0]=-0;refused('oversize-malformed-second-before-budget',oversize,malformed);const getterSecond=valid();Object.defineProperty(getterSecond,'0',{enumerable:true,get(){getterReads++;throw Error('second getter');}});refused('oversize-second-getter-before-budget',oversize,getterSecond);
 const cap=uniform(4096,64,[11,23,37,0]);cap.pixels.set([17,129,251,255],cap.pixels.length-4);const expectedCap=oracle(cap,[0,0,1,0,0,1,0,0,1,0,0,0]);const capTest=measured(()=>fn(cap,[0,0,1,0,0,1,0,0,1,0,0,0]),cap.pixels);check(!capTest.error,'exact1MiB each accepted');equal(capTest.result.pixels,expectedCap.pixels,'complete1MiB independent swap preserves hiddenRGB+alpha');equal(capTest.allocations.map(a=>[a.name,a.byteLength,a.typedCopy]),[['Uint8Array',1048576,true],['Uint8Array',1048576,false]],'internaltypedpayload2MiB');check(capTest.indexedKeyScans===0,'cap no indexed keys');

 check(getterReads===0,'all getter reads zero');records.push({kind,status:'PASS',comparisons,wholeByteCases:comparisons.length,refusals,refusalCount:refusals.length,getterReads,exactBudget:{dimensions:[4096,64],inputBytes:1048576,outputBytes:1048576,internalTypedPayloadBytes:capTest.allocations.reduce((n,a)=>n+a.byteLength,0),allocations:capTest.allocations,indexedKeyScans:capTest.indexedKeyScans}});
}
const output={status:'PASS',actualBrowser:false,sourceBundleInMemoryOnly:true,oracle:'Independent BigInt dyadic rational half-up, literal binary64 left-to-right cases and exact alpha',records,assertions,probeAssertionFailures:[],firstRecords:[],types:{status:'PENDING_SOURCE_HOST_FINAL'},limitations:['Measured internal typed payload excludes caller buffers, renderer copies, process peak and GC.','Focused source/emitted checks do not establish browser rendering, file flow, GL lifetime, packaging or current composed acceptance.']};
await writeFile('packages/barocss-canvas2d/consumer/evidence/image-color/focused.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({status:output.status,assertions,entries:records.map(r=>({kind:r.kind,wholeByteCases:r.wholeByteCases,refusals:r.refusalCount,getterReads:r.getterReads,internalTypedPayloadBytes:r.exactBudget.internalTypedPayloadBytes}))}));

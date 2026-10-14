import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
const root=process.cwd(),dir=path.join(root,'packages/barocss-canvas2d/consumer/evidence/image-downsample');
const esbuild=await import(pathToFileURL(path.join(root,'node_modules/esbuild/lib/main.js')).href);
const built=await esbuild.build({entryPoints:[path.join(root,'packages/barocss-canvas2d/src/index.ts')],bundle:true,format:'esm',platform:'node',target:'es2022',write:false});
const source=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const compiled=await import(pathToFileURL(path.join(root,'packages/barocss-canvas2d/dist/index.js')).href);
let assertions=0;const check=(ok,message)=>{assertions++;if(!ok)throw Error(message);};
const equal=(a,b,message)=>{check(a.length===b.length,message+' extent');for(let i=0;i<a.length;i++)check(a[i]===b[i],message+' channel'+i);};
const Native=Uint8Array,round=(n,d)=>(2n*n+d)/(2n*d);
const asset=(w,h,bytes)=>({width:w,height:h,pixels:new Native(bytes)});
// Independent integration on the common integer microcell lattice. Each unit
// microcell votes into one source pixel and one output bin; no destination
// footprint bounds or overlap-product loops from the provider are reused.
function oracle(input,w,h){
 if(w===input.width&&h===input.height)return [...input.pixels];
 const bins=Array.from({length:w*h},()=>[0n,0n,0n,0n,0n]);
 for(let gy=0;gy<input.height*h;gy++)for(let gx=0;gx<input.width*w;gx++){
  const src=(Math.floor(gy/h)*input.width+Math.floor(gx/w))*4;
  const bin=bins[Math.floor(gy/input.height)*w+Math.floor(gx/input.width)],a=BigInt(input.pixels[src+3]);
  for(let c=0;c<3;c++)bin[c]+=BigInt(input.pixels[src+c])*a;bin[3]+=a;bin[4]++;
 }
 return bins.flatMap(bin=>{const a=Number(round(bin[3],bin[4]));return a?[...bin.slice(0,3).map(c=>Number(round(c,bin[3]))),a]:[0,0,0,0];});
}
function measure(call){
 const allocations=[],keys=Reflect.ownKeys;let indexedPixelScans=0;
 globalThis.Uint8Array=new Proxy(Native,{construct(target,args){const value=Reflect.construct(target,args);allocations.push(value.byteLength);return value;}});
 Reflect.ownKeys=value=>{if(value instanceof Native)indexedPixelScans++;return keys(value);};
 try{return {result:call(),allocations,indexedPixelScans};}finally{globalThis.Uint8Array=Native;Reflect.ownKeys=keys;}
}
let seed=20261011;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>24;};
const B=[0,0,255,255],R=[255,0,0,255],G=[0,255,0,255],hidden=[7,8,9,0];
const report={status:'PASS',actualBrowser:false,oracle:'BigInt expanded common-coordinate microcell integration, separate source/output bin assignment',entries:[]};
for(const[name,api]of [['source',source],['compiled',compiled]]){
 const rows=[],refusals=[];const run=(label,input,w,h,literal)=>{
  const before=[...input.pixels],expected=literal??oracle(input,w,h),m=measure(()=>api.downsampleImageAsset(input,w,h));
  check(m.result.width===w&&m.result.height===h,label+' dimensions');equal(m.result.pixels,expected,label+' fullbytes');equal(input.pixels,before,label+' sourceunchanged');
  check(m.indexedPixelScans===0,label+' no indexedkeyscan');check(m.allocations.length===(w===input.width&&h===input.height?1:2),label+' exactallocationcount');
  check(m.result.pixels!==input.pixels&&m.result.pixels.buffer!==input.pixels.buffer,label+' independentcopy');
  const again=api.downsampleImageAsset(input,w,h);check(again.pixels!==m.result.pixels,label+' freshownership');
  if(m.result.pixels.length){m.result.pixels[0]^=255;equal(again.pixels,expected,label+' returnedcopyisolation');equal(input.pixels,before,label+' returnmutationinputisolation');}
  rows.push({label,input:[input.width,input.height],output:[w,h],comparedBytes:expected.length,allocations:m.allocations,indexedPixelScans:m.indexedPixelScans});
 };
 run('literal4x2-allcoverage-versus-centre',asset(4,2,[B,R,R,B,B,R,R,B].flat()),1,1,[128,0,128,255]);
 run('literal3to2-nonintegercoverage',asset(3,1,[R,G,B].flat()),2,1,[170,85,0,255,0,85,170,255]);
 run('identity-hiddenRGBA-onecopy',asset(3,2,[hidden,R,G,B,[9,8,7,1],[1,2,3,128]].flat()),3,2);
 run('alltransparent-shrinking-zeroRGBA',asset(3,2,Array(6).fill(hidden).flat()),2,1,Array(8).fill(0));
 run('alpha-half-tie-one-round',asset(2,1,[[255,0,0,1],hidden].flat()),1,1,[255,0,0,1]);
 run('roundedalpha-zero-normalization',asset(3,1,[[255,0,0,1],hidden,hidden].flat()),1,1,[0,0,0,0]);
 for(const[sw,sh,w,h]of [[5,3,3,2],[7,5,4,3],[1,7,1,3],[7,1,3,1],[6,4,1,4],[6,4,6,1]]){
  const bytes=Array.from({length:sw*sh*4},()=>random());run('fixed-nonsquare-'+[sw,sh,w,h],asset(sw,sh,bytes),w,h);
 }
 for(let n=0;n<32;n++){const sw=1+random()%7,sh=1+random()%6,w=1+random()%sw,h=1+random()%sh,bytes=Array.from({length:sw*sh*4},()=>random());run('seeded-'+n,asset(sw,sh,bytes),w,h);}
 const valid=asset(2,2,[R,G,B,hidden].flat());let getterReads=0;
 const badField=key=>{const a={...valid};Object.defineProperty(a,key,{enumerable:true,get(){getterReads++;throw Error('getter called');}});return a;};
 const refuse=(label,input,w,h,code='INVALID_ASSET')=>{const before=getterReads;let caught,m;try{m=measure(()=>{try{api.downsampleImageAsset(input,w,h);}catch(error){caught=error;}return null;});}catch(error){throw Error(label+' unexpected '+error);}check(caught instanceof api.Canvas2DError&&caught.code===code,label+' actualerrorcode');check(getterReads===before,label+' getter0');check(m.allocations.length===0,label+' typedalloc0');check(m.indexedPixelScans===0,label+' indexedscan0');refusals.push({label,code:caught.code,getterReads:getterReads-before,typedAllocations:m.allocations,indexedPixelScans:m.indexedPixelScans});};
 for(const[key,value]of [['null',null],['array',[]],['function',()=>{}],['missing',{width:1,height:1}],['extra',{...valid,extra:0}],['symbol',{...valid,[Symbol('extra')]:0}],['customPrototype',Object.assign(Object.create({width:2}),{height:2,pixels:valid.pixels})]])refuse('shape-'+key,value,1,1);
 for(const key of ['width','height','pixels'])refuse('accessor-'+key,badField(key),1,1);
 for(const key of ['width','height']){const a={...valid};Object.defineProperty(a,key,{value:2,enumerable:false});refuse('nonenumerable-'+key,a,1,1);}
 for(const v of [0,-0,-1,1.5,4097,NaN,Infinity,'2',null,undefined]){refuse('sourcewidth-'+String(v),{...valid,width:v},1,1);}
 for(const[key,value]of [['notUint8',[]],['clamped',new Uint8ClampedArray(16)],['subclass',new(class extends Native{})(16)],['short',new Native(15)],['long',new Native(17)],['shared',new Native(new SharedArrayBuffer(16))]])refuse('pixels-'+key,{...valid,pixels:value},1,1);
 for(const key of ['buffer','byteLength','byteOffset','length']){const p=new Native(16);Object.defineProperty(p,key,{get(){getterReads++;throw Error('metadata getter');}});refuse('metadata-'+key,{...valid,pixels:p},1,1);}
 const detached=new Native(16);structuredClone(detached.buffer,{transfer:[detached.buffer]});refuse('detachedpixels',{...valid,pixels:detached},1,1);
 for(const value of [undefined,null,'1',true,NaN,Infinity,-0,0,-1,0.5,3]){refuse('outputwidth-'+String(value),valid,value,1);refuse('outputheight-'+String(value),valid,1,value);}
 const over={width:1024,height:257,pixels:new Native(1024*257*4)};refuse('validoversizedsource',over,1,1,'ASSET_LIMIT');refuse('oversizedbutbadwidth-shapeFIRST',over,0,1);refuse('oversizedbutbadheight-shapeFIRST',over,1,0);refuse('oversizedbutenlarged-shapeFIRST',over,1025,257);
 const extra=asset(2,2,[R,G,B,hidden].flat());Object.defineProperty(extra.pixels,Symbol.iterator,{get(){getterReads++;throw Error('unrelated iterator getter');}});const m=measure(()=>api.downsampleImageAsset(extra,1,1));equal(m.result.pixels,[85,85,85,191],'unrelated iterator ignored');check(getterReads===0,'ALL refused/irrelevantgetters0');check(m.indexedPixelScans===0,'unrelated noindexedscan');rows.push({label:'unrelatedSymbol.iterator-ignored',comparedBytes:4,allocations:m.allocations,getterReads:0,indexedPixelScans:0});
 const nullProto=Object.assign(Object.create(null),valid);run('nullprototype',nullProto,1,1);
 const cap={width:4096,height:64,pixels:new Native(1048576)};for(let i=0;i<cap.pixels.length;i+=4)cap.pixels.set([17,31,47,128],i);
 const identity=measure(()=>api.downsampleImageAsset(cap,4096,64));check(identity.allocations.length===1&&identity.allocations[0]===1048576,'capidentityONE1MiBcopy');equal(identity.result.pixels,cap.pixels,'capidentityALL1MiB');
 const reduction=measure(()=>api.downsampleImageAsset(cap,4095,64));check(reduction.allocations.length===2&&reduction.allocations[0]===1048576&&reduction.allocations[1]===1048320,'largestnonidentitypayload2096896');for(let i=0;i<reduction.result.pixels.length;i++)check(reduction.result.pixels[i]===[17,31,47,128][i%4],'largestconstantALLbytes');check(identity.indexedPixelScans===0&&reduction.indexedPixelScans===0,'capnoindexedscan');
 const dimensions={width:1,height:4096,pixels:new Native(4096*4)};const tall=measure(()=>api.downsampleImageAsset(dimensions,1,4095));check(tall.result.pixels.every(v=>v===0),'maximumheightzeroRGBA');
 report.entries.push({entry:name,wholeByteCases:rows,refusals,getterReads,indexedPixelKeyScans:0,cap:{sourceBytes:1048576,identityAllocations:identity.allocations,nonidentityInput:[4096,64],nonidentityOutput:[4095,64],nonidentityAllocations:reduction.allocations,nonidentityTypedPayload:reduction.allocations.reduce((a,b)=>a+b,0),conservativePayloadCeiling:2097152,exact2MiBNotAttainableUnderStrictReduction:true},maximumDimensionTall:[1,4096],oracleScope:'Small arbitrary ratios use independent BigInt microcell integration; maximum-size witness uses independent constant-field full bytes, not an infeasible expanded grid.'});
}
report.assertions=assertions;report.helperSHA256=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'packages/barocss-canvas2d/src/image-downsample.ts'))).digest('hex');report.inertImportProof='NOT_CLAIMED; spies installed after API imports';
fs.writeFileSync(path.join(dir,'focused.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,assertions,entries:report.entries.map(x=>({entry:x.entry,wholeByteCases:x.wholeByteCases.length,refusals:x.refusals.length,getterReads:x.getterReads,cap:x.cap}))},null,2));

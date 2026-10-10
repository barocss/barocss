import assert from 'node:assert/strict';
const {rotateImageAsset:rotate,Canvas2DError}=await import(process.env.BAROCSS_ROTATE_MODULE??'../../../dist/index.js');
const Native=Uint8Array;
// Independent oracle rotates a matrix of pixel tuples by transposing reversed rows.
function oracle(asset,turns){let rows=Array.from({length:asset.height},(_,y)=>Array.from({length:asset.width},(_,x)=>Array.from(asset.pixels.slice((y*asset.width+x)*4,(y*asset.width+x+1)*4))));for(let t=0;t<turns;t++)rows=rows[0].map((_,x)=>rows.map(row=>row[x]).reverse());return {width:rows[0].length,height:rows.length,pixels:new Native(rows.flat(2))};}
let comparisons=0,seed=1275;
const next=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;
function image(w,h){const pixels=new Native(w*h*4);for(let i=0;i<pixels.length;i++)pixels[i]=next()>>>24;for(let i=3;i<pixels.length;i+=12)pixels[i]=0;return {width:w,height:h,pixels};}
function verify(a,t){const before=new Native(a.pixels),expected=oracle(a,t),result=rotate(a,t);assert.deepEqual(result,expected);assert.notEqual(result.pixels,a.pixels);assert.deepEqual(a.pixels,before);comparisons++;return result;}
const shapes=[[1,1],[1,7],[7,1],[3,2],[2,3],[5,9],[4096,1]];
for(const [w,h]of shapes)for(let t=0;t<4;t++)verify(image(w,h),t);
for(let n=0;n<64;n++){const a=image(1+next()%13,1+next()%11);for(let t=0;t<4;t++)verify(a,t);}
const literal={width:3,height:2,pixels:new Native([1,2,3,0,4,5,6,128,7,8,9,255,10,11,12,0,13,14,15,255,16,17,18,1])};
const literals=[...Array(4)].map((_,t)=>({turns:t,...verify(literal,t),pixels:[...rotate(literal,t).pixels]}));
assert.deepEqual(literals[1].pixels,[10,11,12,0,1,2,3,0,13,14,15,255,4,5,6,128,16,17,18,1,7,8,9,255]);
for(let t=0;t<4;t++){const a=image(5,3),one=rotate(a,t),two=rotate(a,t),bytes=new Native(two.pixels);one.pixels.fill(0);assert.deepEqual(two.pixels,bytes);a.pixels.fill(255);assert.deepEqual(two.pixels,bytes);}
function allocations(fn){const made=[];globalThis.Uint8Array=new Proxy(Native,{construct(target,args){const out=Reflect.construct(target,args);made.push(out.byteLength);return out;}});try{return {result:fn(),made,total:made.reduce((a,b)=>a+b,0)};}finally{globalThis.Uint8Array=Native;}}
let getters=0;const refusals=[];const valid=image(1,1);
function reject(label,a,t,code='INVALID_ASSET'){const measured=allocations(()=>assert.throws(()=>rotate(a,t),e=>e instanceof Canvas2DError&&e.code===code,label));assert.equal(measured.total,0);refusals.push({label,code,typedAllocations:0});}
for(const t of [undefined,null,-0,-1,4,1.5,NaN,Infinity,'1',{},[]])reject('turn '+String(t),valid,t);
for(const a of [undefined,null,[],Object.create(valid),{...valid,extra:1},{...valid,[Symbol()]:1}])reject('record',a,1);
for(const key of ['width','height','pixels']){const a={...valid};delete a[key];reject('missing '+key,a,1);const b={...valid};Object.defineProperty(b,key,{enumerable:true,get(){getters++;return valid[key];}});reject('getter '+key,b,1);const c={...valid};Object.defineProperty(c,key,{value:valid[key],enumerable:false});reject('hidden '+key,c,1);}
for(const key of ['width','height'])for(const v of [0,-0,-1,1.5,4097,NaN,Infinity,'1'])reject(key+' '+String(v),{...valid,[key]:v},1);
for(const pixels of [[],new Uint8ClampedArray(4),new Native(3),new Native(5),new(class extends Native{})(4)])reject('pixels',{...valid,pixels},1);
if(typeof SharedArrayBuffer!=='undefined')reject('shared',{...valid,pixels:new Native(new SharedArrayBuffer(4))},1);
for(const key of ['buffer','byteLength','byteOffset','length']){const a=new Native(4);Object.defineProperty(a,key,{get(){getters++;throw Error('getter');}});reject('metadata getter '+key,{...valid,pixels:a},1);const b=new Native(4);Object.defineProperty(b,key,{value:0});reject('metadata override '+key,{...valid,pixels:b},1);}
for(const key of ['extra',Symbol('extra')]){const pixels=new Native(4);Object.defineProperty(pixels,key,{get(){getters++;throw Error('getter');}});reject('pixel extra',{...valid,pixels},1);}
reject('input budget',{width:1024,height:257,pixels:new Native(1024*257*4)},1,'ASSET_LIMIT');
const maximum=image(512,512),expected=oracle(maximum,1),measured=allocations(()=>rotate(maximum,1));assert.deepEqual(measured.result,expected);assert.equal(measured.total,2097152);assert.deepEqual(measured.made,[1048576,1048576]);assert.equal(getters,0);
console.log(JSON.stringify({runtime:process.version,module:process.env.BAROCSS_ROTATE_MODULE?'source-bundle':'compiled-root',oracle:'matrix tuple transpose and reversed rows',comparisons,randomImages:64,shapes,literals,hiddenAlphaZeroRGB:true,independentIdentityRepeatedSourceCopies:true,getters,refusals,exactOneMiBInputOutput:true,maximumTypedAllocations:measured.made,maximumTransientTypedPayload:measured.total},null,2));

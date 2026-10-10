import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const Native = Uint8Array;
const targets = [new URL('../../../dist/index.js', import.meta.url).href];
if (process.argv[2]) targets.push(pathToFileURL(process.argv[2]).href);
const results = [];
for (const target of targets) {
  const { cropImageAsset: crop } = await import(target);
  let cases = 0, bytes = 0, getterReads = 0;
  // Independent scalar selection oracle: filter all source pixels by coordinates.
  function oracle(a, r) {
    const selected = Array.from({ length: a.width * a.height }, (_, i) => i)
      .filter(i => i % a.width >= r.x && i % a.width < r.x + r.width &&
        Math.floor(i / a.width) >= r.y && Math.floor(i / a.width) < r.y + r.height);
    return selected.flatMap(i => Array.from(a.pixels.slice(i * 4, i * 4 + 4)));
  }
  for (let w = 1; w <= 5; w++) for (let h = 1; h <= 4; h++) {
    const a = { width: w, height: h, pixels: Native.from({ length: w * h * 4 }, (_, i) =>
      i % 4 === 3 && Math.floor(i / 4) % 3 === 0 ? 0 : (i * 73 + 19) % 256) };
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++)
      for (let cw = 1; cw <= w - x; cw++) for (let ch = 1; ch <= h - y; ch++) {
        const r = { x, y, width: cw, height: ch }, expected = oracle(a, r), out = crop(a, r);
        assert.equal(out.width, cw); assert.equal(out.height, ch);
        assert.deepEqual([...out.pixels], expected); assert.notEqual(out.pixels.buffer, a.pixels.buffer);
        cases++; bytes += expected.length;
      }
  }
  const atlas = { width: 2, height: 2, pixels: new Native([
    255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 255, 255, 0, 255, 0, 255]) };
  const rect = { x: 1, y: 0, width: 1, height: 2 };
  assert.deepEqual([...crop(atlas, rect).pixels], [0, 0, 0, 0, 0, 255, 0, 255]);
  const backing = new Native(32); backing.set([71, 82, 93, 0, 4, 5, 6, 255, 7, 8, 9, 128, 10, 11, 12, 1], 8);
  const offset = { width: 2, height: 2, pixels: backing.subarray(8, 24) };
  const a = crop(offset, { x: 0, y: 0, width: 2, height: 2 });
  const b = crop(offset, { x: 0, y: 0, width: 2, height: 2 });
  assert.deepEqual([...a.pixels], [71, 82, 93, 0, 4, 5, 6, 255, 7, 8, 9, 128, 10, 11, 12, 1]);
  offset.pixels.fill(100); b.pixels.fill(101);
  assert.deepEqual([...a.pixels], [71, 82, 93, 0, 4, 5, 6, 255, 7, 8, 9, 128, 10, 11, 12, 1]);
  assert.notEqual(a.pixels.buffer, b.pixels.buffer);
  assert.deepEqual([...crop(Object.assign(Object.create(null), atlas), Object.assign(Object.create(null), rect)).pixels], [0, 0, 0, 0, 0, 255, 0, 255]);
  function accessor(object, key) { const o = { ...object }; Object.defineProperty(o, key, {enumerable:true,get(){getterReads++; return object[key];}}); return o; }
  const invalids = [];
  const add = (label, asset, r, code = 'INVALID_ASSET') => invalids.push([label, asset, r, code]);
  add('assetNull', null, rect); add('assetArray', [], rect); add('rectNull', atlas, null);
  for (const key of ['width','height','pixels']) {
    add('assetAccessor:' + key, accessor(atlas,key), rect);
    const hidden = {...atlas}; Object.defineProperty(hidden,key,{enumerable:false,value:atlas[key]}); add('assetHidden:'+key,hidden,rect);
    const missing = {...atlas}; delete missing[key]; add('assetMissing:'+key,missing,rect);
  }
  for (const key of ['x','y','width','height']) {
    add('rectAccessor:'+key,atlas,accessor(rect,key));
    for (const value of [-0,-1,NaN,Infinity,1.5,'1',4097]) add('rectValue:'+key+':'+String(value),atlas,{...rect,[key]:value});
    const hidden={...rect};Object.defineProperty(hidden,key,{enumerable:false,value:rect[key]});add('rectHidden:'+key,atlas,hidden);
  }
  add('rectZeroWidth',atlas,{...rect,width:0}); add('rectZeroHeight',atlas,{...rect,height:0});
  add('rectExtra',atlas,{...rect,extra:1}); add('rectSymbol',atlas,{...rect,[Symbol('x')]:1});
  add('assetExtra',{...atlas,extra:1},rect);add('assetSymbol',{...atlas,[Symbol('x')]:1},rect);
  for(const value of [0,-0,-1,NaN,Infinity,1.5,'2',4097]) add('inputWidth:'+String(value),{...atlas,width:value},rect);
  add('outsideRight',atlas,{...rect,x:2});add('outsideBottom',atlas,{...rect,y:1});
  add('pixelsWrongType',{...atlas,pixels:new Uint8ClampedArray(16)},rect);
  add('pixelsWrongLength',{...atlas,pixels:new Native(15)},rect);
  add('shared',{...atlas,pixels:new Native(new SharedArrayBuffer(16))},rect);
  class Extended extends Native{} add('pixelsSubclass',{...atlas,pixels:new Extended(16)},rect);
  for(const key of ['buffer','byteLength','byteOffset','length']){
    const p=new Native(atlas.pixels);Object.defineProperty(p,key,{get(){getterReads++;throw Error('getter ran');}});add('metadata:'+key,{...atlas,pixels:p},rect);
  }
  const huge={width:513,height:512,pixels:new Native(513*512*4)};
  add('validInputOverflow',huge,{x:0,y:0,width:1,height:1},'ASSET_LIMIT');
  add('fullOutputOverflow',huge,{x:0,y:0,width:513,height:512},'ASSET_LIMIT');
  add('malformedRectBeforeOverflow',huge,{x:0,y:0,width:0,height:1});
  add('outsideBeforeOverflow',huge,{x:513,y:0,width:1,height:1});
  const refused=[];
  function measured(call) {
    const allocations=[]; let copies=0;
    const originalSet=Native.prototype.set;
    globalThis.Uint8Array=new Proxy(Native,{construct(target,args){const out=Reflect.construct(target,args,target);allocations.push(out.byteLength);return out;}});
    Native.prototype.set=function(...args){copies++;return originalSet.apply(this,args);};
    try{return {value:call(),allocations,copies};}catch(error){return {error,allocations,copies};}
    finally{globalThis.Uint8Array=Native;Native.prototype.set=originalSet;}
  }
  for(const [label,input,r,code] of invalids){const m=measured(()=>crop(input,r));assert.equal(m.error?.code,code,label);assert.deepEqual(m.allocations,[],label+' allocations');assert.equal(m.copies,0,label+' copies');refused.push({label,code,allocations:0,copies:0});}
  assert.equal(getterReads,0);
  const limit={width:512,height:512,pixels:Native.from({length:1048576},(_,i)=>(i*17+29)%256)};
  const budget=measured(()=>crop(limit,{x:0,y:0,width:512,height:512}));
  assert.ifError(budget.error);assert.deepEqual(budget.allocations,[1048576,1048576]);
  assert.deepEqual(budget.value.pixels,limit.pixels);assert.notEqual(budget.value.pixels.buffer,limit.pixels.buffer);
  const thin=crop(limit,{x:511,y:0,width:1,height:512});assert.deepEqual([...thin.pixels],oracle(limit,{x:511,y:0,width:1,height:512}));
  results.push({target,cases,comparedBytes:bytes,literalAtlasBytes:16,literalCropBytes:8,offsetHiddenRGB:true,fullCopy:true,repeatedMutationIndependent:true,nullPrototype:true,refusals:refused,getterReads,budget:{inputBytes:1048576,outputBytes:1048576,measuredTypedAllocations:budget.allocations,totalBytes:budget.allocations.reduce((a,b)=>a+b,0),copies:budget.copies},thinLimitBytes:thin.pixels.length});
}
console.log(JSON.stringify({runtime:process.version,results},null,2));

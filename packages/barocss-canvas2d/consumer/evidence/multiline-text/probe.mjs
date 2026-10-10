import assert from 'node:assert/strict';
import {rasterizeBrowserMultilineText as multi, rasterizeBrowserText as single, Canvas2DError} from '../../../dist/index.js';
const base={text:'Balance\n-$20',font:'24px monospace',atlasId:'Label',lineAdvance:40,dpr:2};
let getters=0;const refusals=[];
function reject(name,value,code='INVALID_SCENE'){assert.throws(()=>multi(value),e=>e instanceof Canvas2DError&&e.code===code,name);refusals.push({name,code});}
for(const text of ['', 'A\n','\nA','A\n\nB','A\n \nB','A\nB\nC\nD\nE','A\r\nB','A\tB','A\0B','A\x7f','é','한글','😀','A'.repeat(129),'A'.repeat(127)+'\nB'])reject('text '+JSON.stringify(text),{...base,text});
for(const lineAdvance of [undefined,null,0,-1,NaN,Infinity,1000001,'40'])reject('advance '+String(lineAdvance),{...base,lineAdvance});
reject('displaced baseline limit',{...base,text:'A\nB\nC\nD',lineAdvance:333334});
for(const dpr of [undefined,null,0,4.1,NaN])reject('DPR '+String(dpr),{...base,dpr});
for(const font of ['',null,'a'.repeat(257),'A\nB'])reject('font '+String(font),{...base,font});
for(const value of [null,[],Object.create(base),{...base,extra:true},{...base,textPolicy:'printable-ascii'},{...base,[Symbol('field')]:1}])reject('record',value);
for(const key of Object.keys(base)){
 const accessor={...base};Object.defineProperty(accessor,key,{enumerable:true,get(){getters++;throw Error('getter');}});reject('accessor '+key,accessor);
 const hidden={...base};Object.defineProperty(hidden,key,{enumerable:false,value:base[key]});reject('hidden '+key,hidden);
}
for(const key of ['text','font','atlasId','lineAdvance']){const value={...base};delete value[key];reject('missing '+key,value);}
assert.equal(getters,0);
for(const text of ['A','A\nB','A\nB\nC\nD','A'.repeat(63)+'\n'+'B'.repeat(64)])reject('without browser admission '+text.length,{...base,text},'UNSUPPORTED_FEATURE');
assert.throws(()=>single({text:'A\nB',font:base.font,atlasId:base.atlasId,dpr:base.dpr}),e=>e.code==='INVALID_SCENE');
let canvases=[],measure=0,draw=0,read=0,lastData,mode='ok';
const metrics={width:10.5,actualBoundingBoxLeft:1.25,actualBoundingBoxRight:9.25,actualBoundingBoxAscent:7.5,actualBoundingBoxDescent:2.25};
globalThis.document={fonts:{check:()=>true},createElement(){
 let w=300,h=150;const writes=[];const ctx={font:'',setTransform(){},scale(){},measureText(){measure++;return {...metrics,...(mode==='badMetric'?{width:NaN}:{})};},
 fillText(){draw++;if(mode==='drawThrow')throw Error('draw');},getImageData(){read++;lastData=new Uint8ClampedArray(w*h*4);if(mode!=='noInk')lastData[3]=255;return {data:mode==='short'?new Uint8Array(1):lastData};}};
 const c={get width(){return w},set width(v){w=v;writes.push(['width',v])},get height(){return h},set height(v){h=v;writes.push(['height',v])},getContext(){return ctx},writes};canvases.push(c);return c;
}};
const r=multi({...base,text:' A \nB',dpr:1.5,lineAdvance:12.25});
assert.deepEqual(r.lines,[{textStart:0,textEnd:3,baseline:0,advance:10.5},{textStart:4,textEnd:5,baseline:12.25,advance:10.5}]);

// Union edges -1.25..9.25 and -7.5..14.5, padded integer bounds -4..12,-10..17.
assert.deepEqual(r.bounds,{left:-4,top:-10,width:16,height:27.333333333333332});
assert.equal(r.asset.width,24);assert.equal(r.asset.height,41);
assert.equal(r.layout.text,' A \nB');assert.equal(r.layout.glyphs.length,1);assert.equal(r.layout.glyphs[0].textEnd,5);
assert.equal(measure,2);assert.equal(draw,2);assert.equal(read,1);
assert.equal(canvases.at(-1).width,0);assert.equal(canvases.at(-1).height,0);
lastData[3]=0;assert.equal(r.asset.pixels[3],255);
r.lines[0].baseline=999;assert.equal(r.layout.baseline,0);
for(const bad of ['badMetric','drawThrow','noInk','short']){mode=bad;reject(bad,base,'INVALID_ASSET');assert.equal(canvases.at(-1).width,0);assert.equal(canvases.at(-1).height,0);}
mode='ok';let beforeDraw=draw,beforeRead=read;reject('oversize before draw',{...base,lineAdvance:200},'ASSET_LIMIT');
assert.equal(draw,beforeDraw);assert.equal(read,beforeRead);assert.deepEqual(canvases.at(-1).writes,[['width',0],['height',0]]);
const old=single({text:'HI',font:base.font,atlasId:'Label',dpr:1.5});
assert.deepEqual(Object.keys(old),['asset','font','dpr','advance','bounds','layout']);
assert.equal(old.advance,10.5);assert.equal(old.layout.text,'HI');assert.equal(canvases.at(-1).width,24);
delete globalThis.document;
console.log(JSON.stringify({runtime:process.version,refusals:refusals.length,getters,syntheticMetrics:true,copiedRGBA:true,multilineCleanup:true,oversizeDrawReadDelta0:true,singleLineShapeRetained:true,refusalCases:refusals},null,2));

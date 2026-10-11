import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {build} from 'esbuild';

const root=process.cwd(),pkg=root+'/packages/barocss-canvas2d/';
const host=fs.readFileSync(pkg+'consumer/image-decode.mjs','utf8');
const parent='ebae6a1409467638b3c2aeaac7049991c368180e';
const old=execFileSync('git',['show',parent+':packages/barocss-canvas2d/consumer/image-decode.mjs'],{encoding:'utf8'});
const input=JSON.parse(fs.readFileSync(pkg+'consumer/evidence/decode-cleanup/saved-document.json','utf8'));
const scene=JSON.parse(input.scene),asset={width:2,height:2,pixels:new Uint8Array(Buffer.from(input.assets[0].pixelsBase64,'base64'))};
const pendingAsset={width:200,height:160,pixels:new Uint8Array(128000).fill(127)};
const names=['beginRequest','current','readObservation','observe','loadAt','loadBlob','tryBlob','openAt','openText','dispose','onOpenSelection','onRasterSelection','save','downloadSample'];
function functions(source,wanted){const file=ts.createSourceFile('host.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);return file.statements.filter(n=>ts.isFunctionDeclaration(n)&&wanted.includes(n.name?.text)).map(n=>n.getText(file)).join('\n');}
const actual=functions(host,names),oldLoad=functions(old,['loadBlob']);
let assertions=0;
const eq=(a,b,label)=>{assert.equal(JSON.stringify(a),JSON.stringify(b),label);assertions++;};
const ok=(a,label)=>{assert.ok(a,label);assertions++;};
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function renderer(label){return{label,calls:{set:0,update:0,render:0,dispose:0,get:0},asset,
 setImageAsset(_id,value){this.calls.set++;this.asset=value;},updateScene(value){this.calls.update++;this.scene=value;},render(){this.calls.render++;},dispose(){this.calls.dispose++;},getImageAsset(){this.calls.get++;return this.asset;},hitTest(){return{id:'Sprite'};}};}
function fixture(api){const initial=renderer('initial'),controls=Array.from({length:5},()=>({disabled:false})),context={renderer:initial,canvas:{id:'scene',replaceWith(v){context.replacements++;context.canvas=v;}},accepted:scene,withImage:scene,generation:1,requestEpoch:0,disposed:false,terminal:null,counts:{loadsStarted:0,decoded:0,ignored:0,loadAdmissions:0,stageStarts:0,opens:0,disposals:0},samples:[[30,30],[70,30],[30,70],[70,70]],pixel:()=>[1,2,3,4],removeControls:Array.from({length:5},()=>()=>context.unbinds++),unbinds:0,replacements:0,canvasAllocations:0,decodeCalls:0,stageCalls:0,fileTexts:0,statuses:[],fileInput:{files:[],value:''},openInput:{files:[],value:''},options:{logicalSize:{width:160,height:120},dpr:2},Blob,structuredClone,Uint8Array,Error,document:{createElement(){context.canvasAllocations++;return{id:''};},querySelectorAll(){return controls;}},URL:{createObjectURL(){context.urls++;return'blob:controlled';}},urls:0,serializeCanvasDocument:()=>Promise.resolve('controlled'),makePng:()=>Promise.resolve(new Blob(['controlled'])),setTimeout(){},stringifySceneJSON:api.stringifySceneJSON};
 context.show=message=>context.statuses.push(message);context.decodeImageBlob=()=>{context.decodeCalls++;return Promise.resolve(pendingAsset);};context.stageCanvasDocument=()=>{context.stageCalls++;return Promise.resolve({scene,renderer:renderer('staged')});};
 vm.createContext(context);vm.runInContext(actual,context);return context;}
const entries=[];
for(const entry of ['source','emitted']){
 const code=await build({stdin:{contents:`export { stringifySceneJSON } from '${pkg+(entry==='source'?'src/index.ts':'dist/index.js')}';`,resolveDir:root},bundle:true,write:false,platform:'node',format:'esm'});
 const api=await import('data:text/javascript;base64,'+Buffer.from(code.outputFiles[0].text).toString('base64'));
 const cases=[];
 {
  const d=defer(),a=renderer('old'),b=renderer('new'),ctx={renderer:a,withImage:scene,accepted:scene,decodeImageBlob:()=>d.promise,show(){}};
  vm.createContext(ctx);vm.runInContext(oldLoad,ctx);const p=ctx.loadBlob(new Blob(['controlled']));ctx.renderer=b;d.resolve(pendingAsset);await p;
  eq(b.calls.set,1,'old baseline writes GLOBAL replacement');eq(a.calls.set,0,'old original renderer not target');eq(b.asset.pixels.length,128000,'wrong decoded replacement size');ok(b.asset.pixels.length!==asset.pixels.length,'old actual witness differs from saved16');cases.push({name:'OLD_PARENT_GLOBAL_NEW_RENDERER_OVERWRITE',wrongReplacementWrites:b.calls.set,wrongBytes:b.asset.pixels.length,originalBytes:16,controlledFacilities:true});
 }
 {
  const c=fixture(api);await c.loadBlob(new Blob(['controlled']));eq(c.counts.loadAdmissions,1,'current success preserved');eq(c.renderer.calls.set,1,'current registration');eq(c.statuses,['Decoded 200×160 raster image'],'current status preserved');cases.push({name:'current decoded success',pass:true});
 }
 for(const reject of [false,true]){
  const c=fixture(api),d=defer(),oldRenderer=c.renderer;c.decodeImageBlob=()=>{c.decodeCalls++;return d.promise;};const p=c.loadBlob(new Blob(['controlled']));const newer=renderer('newer');c.beginRequest();c.renderer=newer;const status=[...c.statuses];reject?d.reject(Error('stale decode error')):d.resolve(pendingAsset);await p;
  eq(newer.calls.set,0,'stale decode never registers on current');eq(oldRenderer.calls.set,0,'stale decode never registers on old');eq(c.statuses,status,'stale success/error status retained');eq(c.counts.ignored,1,'stale decode counted');cases.push({name:reject?'superseded decode error':'superseded decode success',pass:true});
 }
 {
  const c=fixture(api),d=defer(),failure=Error('newer Open failed');c.decodeImageBlob=()=>d.promise;const p=c.loadBlob(new Blob(['controlled']));c.stageCanvasDocument=()=>Promise.reject(failure);let error;try{await c.openText('bad');}catch(e){error=e;}ok(error===failure,'active Open failure identity');d.resolve(pendingAsset);await p;eq(c.renderer.calls.set,0,'failed newer Open does not revive old decode');eq(c.counts.ignored,1,'older ignored after newer failure');cases.push({name:'latest failed Open still supersedes old decode',pass:true});
 }
 {
  const c=fixture(api),d=defer();c.openInput.files=[{text(){c.fileTexts++;return d.promise;}}];c.onOpenSelection();eq(c.requestEpoch,1,'DOM begins intent BEFORE File.text await');eq(c.fileTexts,1,'actual body invokes one controlled File.text');c.beginRequest();d.resolve(input.scene);await settle();eq(c.stageCalls,0,'old File.text does not call stage');eq(c.requestEpoch,2,'old File.text does not fresh begin');eq(c.counts.ignored,1,'old File.text ignored');cases.push({name:'old File.text retains original token',pass:true});
 }
 {
  const c=fixture(api),r=c.beginRequest();c.beginRequest();await c.openAt(input.scene,r);eq(c.canvasAllocations,0,'stale before stage canvas0');eq(c.stageCalls,0,'stale before stage0');cases.push({name:'stale before stage no canvas',pass:true});
 }
 for(const dispose of [false,true]){
  const c=fixture(api),d=defer(),candidate=renderer('candidate');c.stageCanvasDocument=()=>d.promise;const p=c.openText(input.scene);dispose?c.dispose():c.beginRequest();const oldAccepted=c.accepted;d.resolve({scene,renderer:candidate});await p;eq(candidate.calls.dispose,1,'late staged candidate closed once');eq(c.replacements,0,'late stage no adoption');eq(c.accepted,oldAccepted,'late stage accepted retained');cases.push({name:dispose?'Dispose during stage closes candidate':'superseded stage closes candidate',pass:true});
 }
 {
  const c=fixture(api),d=defer(),candidate=renderer('stale-throw');candidate.dispose=function(){this.calls.dispose++;throw Error('controlled close throw');};c.stageCanvasDocument=()=>d.promise;const p=c.openText(input.scene);c.beginRequest();d.resolve({scene,renderer:candidate});await p;eq(candidate.calls.dispose,1,'throwing stale close attempted once');eq(c.counts.opens,0,'throwing stale close no adoption');cases.push({name:'stale close throw is not retried',pass:true});
 }
 {
  const c=fixture(api),failure=Error('controlled old disposal after adoption');c.renderer.dispose=function(){this.calls.dispose++;throw failure;};let error;try{await c.openText(input.scene);}catch(e){error=e;}ok(error===failure,'active postadopt error identity propagates');eq(c.renderer.label,'staged','new accepted renderer remains current');eq(c.counts.ignored,0,'active postadopt error not mistaken stale');cases.push({name:'postadopt old disposal active error identity',pass:true});
 }
 {
  const c=fixture(api),candidate=renderer('mismatch');c.stageCanvasDocument=()=>Promise.resolve({scene:{...scene,contextId:'Other'},renderer:candidate});let error;try{await c.openText('controlled');}catch(e){error=e;}eq(error.message,'Document scene does not match consumer','old mismatch message');eq(candidate.calls.dispose,1,'mismatch stage closed');eq(c.counts.opens,0,'no mismatch adoption');cases.push({name:'active mismatch error/disposal preserved',pass:true});
 }
 {
  const c=fixture(api),candidate=renderer('success');c.stageCanvasDocument=()=>Promise.resolve({scene,renderer:candidate});const oldRenderer=c.renderer;await c.openText(input.scene);eq(c.renderer.label,'success','new stage adopted');eq(oldRenderer.calls.dispose,1,'prior renderer closed');eq(c.counts.opens,1,'one accepted Open');eq(c.generation,2,'visible generation increments only adoption');cases.push({name:'active Open default preserved',pass:true});
 }
 {
  const c=fixture(api),d=defer();c.decodeImageBlob=()=>{c.decodeCalls++;return d.promise;};const p=c.loadBlob(new Blob(['controlled']));c.dispose();const status=[...c.statuses],before=c.observe();d.resolve(pendingAsset);await p;eq(c.renderer.calls.set,0,'disposed late decode no registration');eq(c.statuses,status,'terminal late decode status retained');eq(c.observe().scene,before.scene,'terminal CPU scene retained');eq(c.counts.ignored,1,'late decode ignored');cases.push({name:'Dispose during decode retained',pass:true});
 }
 {
  const c=fixture(api);c.dispose();const before=c.observe(),get=c.renderer.calls.get,status=[...c.statuses];await c.loadBlob(new Blob(['controlled']));await c.openText(input.scene);const result=await c.tryBlob(new Blob(['controlled']));await c.save();await c.downloadSample();c.dispose();eq(c.decodeCalls,0,'disposed decode entries0');eq(c.stageCalls,0,'disposed stage entries0');eq(c.urls,0,'disposed owned controls URL0');eq(c.renderer.calls.get,get,'terminal reads never touch disposed renderer');eq(c.unbinds,5,'exact owned control removal count');eq(c.observe(),before,'late entry/repeated Dispose unchanged');eq(c.statuses,status,'late entry status unchanged');eq(result,{code:'DISPOSED',retained:true},'terminal diagnostic only');const snapshot=c.observe();snapshot.assetBytes[0]=99;eq(c.observe().assetBytes[0],255,'terminal caller copy isolated');cases.push({name:'disposed entry/control/observation idempotence',pass:true});
 }
 for(const name of ['save','downloadSample']){
  const c=fixture(api),d=defer();if(name==='save')c.serializeCanvasDocument=()=>d.promise;else c.makePng=()=>d.promise;const p=c[name]();c.dispose();const status=[...c.statuses];d.resolve(name==='save'?'controlled':new Blob(['controlled']));await p;eq(c.urls,0,'late owned '+name+' URL0');eq(c.statuses,status,'late owned '+name+' status retained');cases.push({name:name+' terminal-only suppression',pass:true});
 }
 {
  const c=fixture(api);c.decodeImageBlob=()=>Promise.reject(Object.assign(Error('controlled unsupported'),{code:'UNSUPPORTED_FEATURE'}));const epoch=c.requestEpoch;const result=await c.tryBlob(new Blob(['controlled']));eq(result,{code:'UNSUPPORTED_FEATURE',retained:true},'live diagnostic preserves old refusal');eq(c.requestEpoch,epoch,'live diagnostic does not supersede requests');cases.push({name:'live tryBlob remains non-request diagnostic',pass:true});
 }
 entries.push({entry,cases,actualHostFunctionText:true,controlledVM:true,publicDecoderSuiteReplayed:false});
}
const result={status:'PASS',assertions,entries,parent,actualBrowser:false,oldBaseline:'Exact old parent loadBlob text, controlled deferred real-shaped asset; observed GLOBAL replacement witness, not browser replay',scope:'Actual new host function text extracted with TypeScript AST; source/emitted stringifySceneJSON bindings; controlled native facilities/renderer mocks',firstFailures:[]};
fs.writeFileSync(pkg+'consumer/evidence/blob-open-generation/focused.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',assertions,entries:entries.map(e=>({entry:e.entry,cases:e.cases.length}))}));

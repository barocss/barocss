import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { pathToFileURL } from 'node:url';
const hostPath='packages/barocss-canvas2d/consumer/sprite-atlas.mjs';
const host=await readFile(hostPath,'utf8');
function extract(marker){const start=host.indexOf(marker);assert.ok(start>=0,marker);let depth=0,end=-1;for(let i=host.indexOf('{',start);i<host.length;i++){if(host[i]==='{')depth++;if(host[i]==='}'&&--depth===0){end=i+1;break;}}assert.ok(end>start);return host.slice(start,end);}
const openSource=extract('async function openText('),selectorSource=extract('function selectSavedAtlasFrame('),disposeSource=extract('function dispose(');
const factorySource=`(function(api, f){
 let disposed=f.initiallyDisposed;
 const document={createElement(){f.counts.createCanvas++;return {id:''};},querySelectorAll(){return [];}};
 const instrument=c=>{f.counts.instrument++;return c;};
 const options={logicalSize:{width:100,height:80},dpr:2};
 const stageCanvasDocument=(text,canvas,options)=>{f.counts.stage++;return f.stage(text,canvas,options);};
 const createDisplayTreeFromScene=scene=>{f.counts.reconstruct++;return api.createDisplayTreeFromScene(scene);};
 const createSpriteAtlas=(...args)=>{f.counts.catalog++;const result=api.createSpriteAtlas(...args);return f.selectorError?{sequence(){throw f.selectorError;}}:result;};
 const createSpriteAnimation=(...args)=>{f.counts.newAnimation++;return api.createSpriteAnimation(...args);};
 const createTicker=scheduler=>{f.counts.newTicker++;return api.createTicker(scheduler);};
 const bindTicker=()=>{f.counts.bindTicker++;},subscribe=()=>{f.counts.subscribe++;},bind=()=>{f.counts.bind++;return ()=>{f.counts.newUnbind++;};};
 const scheduler={requestFrame(){throw new Error('controlled probe never starts ticker');},cancelFrame(){}};
 const show=message=>{f.counts.show++;f.messages.push(message);};
 const openInput={disabled:false};
 let tree=f.initialTree,sprite=tree.get('Sprite'),back=tree.get('Back'),sheet=null;
 const atlasImage=f.literalAsset,entries=f.entries;
 let accepted=tree.snapshot(),generation=1,pointerLog=[],clockMS=0,pending=null;
 let canvas={replaceWith(fresh){f.counts.swap++;f.swappedCanvas=fresh;}},renderer=f.oldRenderer;
 let animation={dispose(){f.counts.oldAnimationDispose++;}},ticker={dispose(){f.counts.oldTickerDispose++;}};
 let unbind=()=>{f.counts.oldUnbind++;};
 ${selectorSource}
 ${openSource}
 ${disposeSource}
 return {openText,dispose,state:()=>({disposed,accepted,generation,canvas,renderer,tree,sprite,animation,ticker,openDisabled:openInput.disabled})};
})`;
const factory=new Script(factorySource,{filename:hostPath+':actual-functions'}).runInThisContext();
const sourcePath=process.env.BAROCSS_ATLAS_SOURCE_MODULE??'/tmp/c2d1304-source.mjs';
const variants=[['source-bundle',await import(pathToFileURL(sourcePath))],['compiled-root',await import(pathToFileURL(process.cwd()+'/packages/barocss-canvas2d/dist/index.js'))]];
const literal=[255,0,0,255,0,0,255,255,0,255,0,0],crops=[{x:0,y:0,width:1,height:1},{x:1,y:0,width:1,height:1},{x:2,y:0,width:1,height:1}];
function initialTree(api,crop=crops[0]){const tree=api.createDisplayTree('SpriteAtlasConsumer');tree.stage.addChild(tree.createRect({id:'Back',layer:0,transform:{x:10,y:10,scaleX:1,scaleY:1,rotation:0},width:70,height:60,fill:[1,1,0,1]}));tree.stage.addChild(tree.createSprite({id:'Sprite',layer:1,transform:{x:20,y:20,scaleX:1,scaleY:1,rotation:0},imageId:'Atlas',sourceRect:crop,width:50,height:50,opacity:1,sampling:'nearest',anchorX:0,anchorY:0}));return tree;}
function facilities(api){const counts=Object.fromEntries(['createCanvas','instrument','stage','reconstruct','catalog','assetRead','candidateDispose','newAnimation','swap','newTicker','bindTicker','subscribe','bind','oldTickerDispose','oldAnimationDispose','oldUnbind','newUnbind','oldRendererDispose','show'].map(key=>[key,0]));const f={counts,initiallyDisposed:false,selectorError:null,messages:[],initialTree:initialTree(api),literalAsset:{width:3,height:1,pixels:new Uint8Array(literal)},entries:['Red','Blue','Clear'].map((name,i)=>({name,sourceRect:crops[i],durationMS:[40,60,20][i]})),oldRenderer:{dispose(){counts.oldRendererDispose++;}}};f.candidate={scene:initialTree(api,crops[1]).snapshot(),renderer:{getImageAsset(id){counts.assetRead++;assert.equal(id,'Atlas');return {width:3,height:1,pixels:new Uint8Array(literal)};},dispose(){counts.candidateDispose++;}}};f.stage=async()=>f.candidate;return f;}
const workKeys=['reconstruct','catalog','assetRead','newAnimation','swap','newTicker','bindTicker','subscribe','bind'];
function noReconstruction(f){for(const key of workKeys)assert.equal(f.counts[key],0,key);}
function unchanged(before,after){for(const key of ['accepted','generation','canvas','renderer','tree','sprite','animation','ticker'])assert.equal(after[key],before[key],key);}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const records=[];
for(const [kind,api]of variants){const cases=[];
 {
  const f=facilities(api);f.initiallyDisposed=true;const h=factory(api,f),before=h.state();const e=await h.openText('controlled document').catch(e=>e);assert.ok(e instanceof Error);assert.equal(e.message,'consumer disposed');assert.equal(e.code,undefined);assert.equal(f.counts.createCanvas,0);assert.equal(f.counts.stage,0);assert.equal(f.counts.instrument,0);assert.equal(f.counts.candidateDispose,0);noReconstruction(f);unchanged(before,h.state());cases.push({case:'entryDisposed',errorName:e.name,errorCode:null,message:e.message,counts:f.counts});
 }
 {
  const f=facilities(api),gate=deferred();f.stage=()=>gate.promise;const h=factory(api,f),before=h.state(),promise=h.openText('controlled deferred document').catch(e=>e);assert.equal(f.counts.createCanvas,1);assert.equal(f.counts.stage,1);h.dispose();const afterDispose=h.state();const baseline={...f.counts};gate.resolve(f.candidate);const e=await promise;assert.ok(e instanceof Error);assert.equal(e.message,'consumer disposed');assert.equal(e.code,undefined);assert.equal(f.counts.candidateDispose,1);noReconstruction(f);unchanged(afterDispose,h.state());assert.equal(h.state().accepted,before.accepted);for(const key of ['oldTickerDispose','oldAnimationDispose','oldUnbind','oldRendererDispose','show'])assert.equal(f.counts[key],baseline[key]);h.dispose();assert.equal(f.counts.candidateDispose,1);cases.push({case:'disposedDuringDeferredStage',errorName:e.name,errorCode:null,message:e.message,candidateDisposeCalls:1,noAcceptedWorkAfterStage:true,counts:f.counts,controlledStageNotNativeHash:true});
 }
 for(const lateDispose of [false,true]){
  const f=facilities(api),gate=deferred(),marker=new Error('controlled original stage rejection');f.stage=()=>gate.promise;const h=factory(api,f),before=h.state(),promise=h.openText('controlled invalid document').catch(e=>e);if(lateDispose)h.dispose();const state=h.state();gate.reject(marker);const e=await promise;assert.equal(e,marker);assert.equal(f.counts.candidateDispose,0);noReconstruction(f);unchanged(state,h.state());if(!lateDispose)unchanged(before,h.state());cases.push({case:lateDispose?'disposedDuringStageReject':'liveStageReject',originalErrorIdentity:true,counts:f.counts});
 }
 {
  const f=facilities(api),marker=new Error('controlled original catalog sequence rejection');f.selectorError=marker;const h=factory(api,f),before=h.state(),e=await h.openText('controlled valid staged scene').catch(e=>e);assert.equal(e,marker);assert.equal(f.counts.candidateDispose,1);assert.equal(f.counts.reconstruct,1);assert.equal(f.counts.catalog,1);assert.equal(f.counts.assetRead,1);for(const key of ['newAnimation','swap','newTicker','bindTicker','subscribe','bind'])assert.equal(f.counts[key],0);unchanged(before,h.state());cases.push({case:'liveSelectorOriginalReject',originalErrorIdentity:true,counts:f.counts});
 }
 {
  const f=facilities(api);f.candidate.scene=initialTree(api,{x:0,y:0,width:2,height:1}).snapshot();const h=factory(api,f),before=h.state(),e=await h.openText('controlled unknown crop').catch(e=>e);assert.ok(e instanceof Error);assert.equal(e.message,'Document does not contain the saved animation frame');assert.equal(e.code,undefined);assert.equal(f.counts.candidateDispose,1);assert.equal(f.counts.swap,0);assert.equal(f.counts.bind,0);unchanged(before,h.state());cases.push({case:'liveUnknownCropReject',errorName:e.name,errorCode:null,message:e.message,counts:f.counts});
 }
 {
  const f=facilities(api),h=factory(api,f),before=h.state();await h.openText('controlled valid Blue document');const after=h.state();assert.equal(after.disposed,false);assert.equal(after.generation,2);assert.notEqual(after.tree,before.tree);assert.equal(after.accepted,f.candidate.scene);assert.equal(after.renderer,f.candidate.renderer);assert.equal(after.canvas,f.swappedCanvas);assert.equal(after.animation.frameIndex,1);assert.equal(after.animation.playing,false);assert.equal(after.ticker.running,false);assert.deepEqual(after.sprite.data.sourceRect,crops[1]);assert.deepEqual([...f.literalAsset.pixels],literal);for(const key of ['createCanvas','instrument','stage',...workKeys,'oldTickerDispose','oldAnimationDispose','oldUnbind','oldRendererDispose','show'])assert.equal(f.counts[key],1,key);assert.equal(f.counts.candidateDispose,0);assert.equal(f.messages[0],'Opened saved frame 1');h.dispose();h.dispose();assert.equal(f.counts.candidateDispose,1);assert.equal(f.counts.newUnbind,1);cases.push({case:'normalAcceptedBlue',index:1,paused:true,acceptedSceneIdentity:true,oldDisposedOnce:true,newDisposedOnce:true,counts:f.counts});
 }
 records.push({kind,cases});
}
const sha=value=>createHash('sha256').update(value).digest('hex');const output={status:'PASS',runtime:process.version,actualBrowser:false,controlledFacilities:true,controlledStageNotNativeHash:true,actualHostPath:hostPath,hostSHA256:sha(host),openTextSHA256:sha(openSource),selectorSHA256:sha(selectorSource),disposeSHA256:sha(disposeSource),actualOpenTextSource:openSource,actualDisposeSource:disposeSource,execution:'actual host functions via bounded node:vm same-realm factory; public tree/catalog/animation/ticker with controlled document/stage/canvas/bind facilities',independentManualRGBA:literal,independentManualCrops:crops,records,firstFailures:[]};
await writeFile('packages/barocss-canvas2d/consumer/evidence/atlas-open-dispose/focused.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output));

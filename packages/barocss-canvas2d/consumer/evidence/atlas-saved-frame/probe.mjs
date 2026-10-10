import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { pathToFileURL } from 'node:url';
const hostPath='packages/barocss-canvas2d/consumer/sprite-atlas.mjs';
const host=await readFile(hostPath,'utf8');
const marker='function selectSavedAtlasFrame(';
const start=host.indexOf(marker);
assert.ok(start>=0,'actual host selector must exist');
// This private pure host function has no template/string brace characters.
// Balance its actual source braces instead of reproducing its selection logic.
let depth=0,end=-1;const firstBrace=host.indexOf('{',start);
for(let i=firstBrace;i<host.length;i++){if(host[i]==='{')depth++;if(host[i]==='}'&&--depth===0){end=i+1;break;}}
assert.ok(end>start,'actual selector source boundary');
const selectorSource=host.slice(start,end);
const selectSavedAtlasFrame=new Script('('+selectorSource+')',{filename:hostPath+':selector'}).runInThisContext();
const sha=value=>createHash('sha256').update(value).digest('hex');
// Build this isolated source bundle with the existing esbuild CLI before running.
const sourcePath=process.env.BAROCSS_ATLAS_SOURCE_MODULE??'/tmp/c2d1296-atlas-source.mjs';
const source=await import(pathToFileURL(sourcePath));
const variants=process.env.BAROCSS_ATLAS_SOURCE_ONLY==='1'?[['source-bundle',source]]:[['source-bundle',source],['compiled-root',await import(pathToFileURL(process.cwd()+'/packages/barocss-canvas2d/dist/index.js'))]];
const names=['Red','Blue','Clear'],durations=[40,60,20,80];
const manual=[{x:0,y:0,width:1,height:1},{x:1,y:0,width:1,height:1},{x:2,y:0,width:1,height:1}];
// Fixed host input independently lays out a 5x5 catalog at these literal coordinates.
const packed=[{x:0,y:0,width:3,height:2},{x:3,y:0,width:2,height:3},{x:0,y:3,width:1,height:2},{x:1,y:3,width:4,height:1}];
const solid=(width,height,rgba)=>({width,height,pixels:new Uint8Array(Array.from({length:width*height},()=>rgba).flat())});
const records=[];
for(const [kind,api]of variants){
 const manualCatalog=api.createSpriteAtlas('Atlas',{width:3,height:1},names.map((name,i)=>({name,sourceRect:manual[i],durationMS:durations[i]})));
 const packedCatalog=api.packSpriteAtlas('Atlas',[
  {name:'Red',asset:solid(3,2,[255,0,0,255]),durationMS:40},
  {name:'Blue',asset:solid(2,3,[0,0,255,255]),durationMS:60},
  {name:'Clear',asset:solid(1,2,[0,255,0,0]),durationMS:20},
  {name:'Gold',asset:solid(4,1,[255,0,255,128]),durationMS:80},
 ],5).atlas;
 const admitted=[],refusals=[];
 for(const [label,catalog,crops,hasGold]of [['manual',manualCatalog,manual,false],['packed',packedCatalog,packed,true]]){
  for(let index=0;index<crops.length;index++){
   // Deliberately shuffled property order proves numeric crop matching, not serialized key order.
   const crop={height:crops[index].height,width:crops[index].width,y:crops[index].y,x:crops[index].x};
   const selected=selectSavedAtlasFrame(catalog,crop,hasGold),expectedCount=index===3?4:3;
   assert.equal(selected.initialFrameIndex,index);assert.equal(selected.frames.length,expectedCount);
   assert.deepEqual(selected.frames.map(f=>f.sourceRect),crops.slice(0,expectedCount));
   assert.deepEqual(selected.frames.map(f=>f.durationMS),durations.slice(0,expectedCount));
   assert.ok(selected.frames.every(f=>f.imageId==='Atlas'));
   const tree=api.createDisplayTree('AtlasProbe'),sprite=tree.createSprite({id:'Sprite',layer:0,transform:{x:0,y:0,scaleX:1,scaleY:1,rotation:0},imageId:'Atlas',sourceRect:crop,width:50,height:50,opacity:1,sampling:'nearest',anchorX:0,anchorY:0});tree.stage.addChild(sprite);
   const animation=api.createSpriteAnimation(sprite,selected.frames,{initialFrameIndex:selected.initialFrameIndex});
   assert.equal(animation.frameIndex,index);assert.equal(animation.playing,false);assert.deepEqual(sprite.data.sourceRect,crops[index]);assert.equal(animation.advance(1000),false);assert.equal(animation.frameIndex,index);
   if(index===3){
    let pending=null,token=0;const ticks=[];
    const ticker=api.createTicker({requestFrame(callback){assert.equal(pending,null);pending=callback;return ++token;},cancelFrame(){pending=null;}});
    ticker.onTick(info=>{ticks.push(info.deltaMS);animation.advance(info.deltaMS);});animation.play();ticker.start();
    const first=pending;pending=null;first(1000);assert.deepEqual(ticks,[0]);assert.equal(animation.frameIndex,3);assert.deepEqual(sprite.data.sourceRect,packed[3]);
    const second=pending;pending=null;second(1080);assert.deepEqual(ticks,[0,80]);assert.equal(animation.frameIndex,0);assert.deepEqual(sprite.data.sourceRect,packed[0]);ticker.dispose();assert.equal(pending,null);
    admitted.push({catalog:label,index,sequenceCount:4,pausedInitially:true,firstTimestampDelta:0,firstTimestampFrame:3,nextDelta:80,nextFrame:0});
   }else admitted.push({catalog:label,index,sequenceCount:3,pausedInitially:true,pausedAdvanceRetained:true});
   animation.dispose();animation.dispose();
  }
  const invalid=[['missing',undefined],['null',null],['unknownInImage',label==='manual'?{x:0,y:0,width:2,height:1}:{x:2,y:3,width:1,height:1}],['missingCoordinate',{x:crops[0].x,y:crops[0].y,width:crops[0].width}],['stringCoordinate',{...crops[0],x:String(crops[0].x)}]];
  for(const key of ['x','y','width','height'])invalid.push(['altered '+key,{...crops[0],[key]:crops[0][key]+(label==='manual'&&key==='x'?3:1)}]);
  for(const [labelOfRefusal,crop]of invalid){let error;try{selectSavedAtlasFrame(catalog,crop,hasGold);}catch(e){error=e;}assert.ok(error instanceof Error,labelOfRefusal);assert.equal(error.message,'Document does not contain the saved animation frame');assert.equal(error.code,undefined);refusals.push({catalog:label,case:labelOfRefusal,errorName:error.name,errorCode:null,message:error.message});}
 }
 assert.throws(()=>selectSavedAtlasFrame(packedCatalog,packed[3],false),error=>error.message==='Document does not contain the saved animation frame');
 records.push({kind,admitted,refusals,goldWithoutCatalogAdmissionRefused:true});
}
const output={status:'PASS',runtime:process.version,hostPath,hostSHA256:sha(host),actualSelectorSHA256:sha(selectorSource),actualSelectorSource:selectorSource,execution:'actual bounded pure host function via node:vm Script.runInThisContext; public catalog/controller/ticker',independentExpectedManualCrops:manual,independentExpectedPackedCrops:packed,records,firstFailures:[{phase:'first source-only launch before assertions',errorCode:'ERR_MODULE_NOT_FOUND',message:'Cannot find package esbuild imported from atlas-saved-frame/probe.mjs',cause:'new worktree dependency symlinks were not present',repair:'use existing esbuild CLI to write isolated /tmp source bundle; probe imports that bundle explicitly',productChangeRequired:false}],browserAcceptance:false,dimensionsBytesAndCandidateAdmission:'owned by actual host browser checks; not claimed here'};
if(process.env.BAROCSS_ATLAS_SOURCE_ONLY!=='1')await writeFile('packages/barocss-canvas2d/consumer/evidence/atlas-saved-frame/focused.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output));

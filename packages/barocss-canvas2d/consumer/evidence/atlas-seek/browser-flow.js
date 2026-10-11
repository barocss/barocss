// #1568 deterministic host/public-provider check. This is NOT browser acceptance.
// Run after build:library: node packages/barocss-canvas2d/consumer/evidence/atlas-seek/browser-flow.js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as api from '../../../dist/index.js';

const host = fs.readFileSync(new URL('../../sprite-atlas.mjs', import.meta.url), 'utf8');
const ast = ts.createSourceFile('sprite-atlas.mjs', host, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const names = ['syncFrameSelection', 'seekFrame', 'onFrameChange', 'show', 'tick', 'start', 'pause', 'bindTicker', 'dispose'];
const functions = names.map(name => {
  const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  assert.ok(node, `actual host function ${name}`);
  return node.getText();
}).join('\n');
const setup = Function('api', `
const { Canvas2DError, createSpriteAtlas, createSpriteAnimation, createTicker, createDisplayTree } = api;
const frameNames=['Red','Blue','Clear'];
let sheet=createSpriteAtlas('Atlas',{width:3,height:1},frameNames.map((name,i)=>({name,sourceRect:{x:i,y:0,width:1,height:1},durationMS:[40,60,20][i]})));
const tree=createDisplayTree('SpriteAtlasConsumer');
const transform={x:20,y:20,scaleX:1,scaleY:1,rotation:0};
const back=tree.createRect({id:'Back',layer:0,transform:{...transform,x:10,y:10},width:70,height:60,fill:[1,1,0,1]});
const sprite=tree.createSprite({id:'Sprite',layer:1,transform,imageId:'Atlas',width:50,height:50,opacity:1,sampling:'nearest',anchorX:0,anchorY:0});
tree.stage.addChild(back);tree.stage.addChild(sprite);
const animation=createSpriteAnimation(sprite,sheet.sequence(frameNames));
let accepted=tree.snapshot(),disposed=false,pending=null,clockMS=0,nextToken=0;
const counts={requests:0,cancels:0,updates:0,renders:0,rendererDisposes:0,unbinds:0,removals:0};
const renderer={updateScene(scene){counts.updates++;this.scene=scene;},render(){counts.renders++;},dispose(){counts.rendererDisposes++;}};
const scheduler={requestFrame(callback){if(pending)throw Error('duplicate pending');counts.requests++;pending={token:++nextToken,callback};return nextToken;},cancelFrame(token){if(pending?.token===token){counts.cancels++;pending=null;}}};
const ticker=createTicker(scheduler);
const frameSelect={value:'0',disabled:false,removeEventListener(type,fn){if(type!=='change'||fn!==onFrameChange)throw Error('wrong callback removal');counts.removals++;}};
const status={},output={},openInput={},button={disabled:false};
const document={querySelectorAll(){return [button];}};
function observe(){return {frameIndex:animation.frameIndex,playing:animation.playing,tickerRunning:ticker.running};}
function unbind(){counts.unbinds++;}
${functions}
bindTicker();
return {tree,sprite,animation,ticker,renderer,counts,frameSelect,status,output,openInput,button,
 start,pause,tick,seekFrame,onFrameChange,show,dispose,get accepted(){return accepted;},
 get sheet(){return sheet;},set sheet(value){sheet=value;},get pending(){return pending;}};
`);
const h = setup(api);
const initial = JSON.parse(api.stringifySceneJSON(h.accepted));
const original = {tree:h.tree,sprite:h.sprite,animation:h.animation,ticker:h.ticker,renderer:h.renderer,sheet:h.sheet};
function stable() { for (const [key,value] of Object.entries(original)) assert.equal(h[key],value,key); }
function frame(index) {
  assert.equal(h.animation.frameIndex,index);
  assert.equal(h.frameSelect.value,String(index));
  assert.equal(h.animation.playing,true);
  assert.equal(h.ticker.running,true);
  stable();
  const expected=structuredClone(initial);
  expected.nodes.find(n=>n.id==='Sprite').sourceRect={x:index,y:0,width:1,height:1};
  assert.deepEqual(JSON.parse(api.stringifySceneJSON(h.accepted)),expected);
  assert.equal(api.stringifySceneJSON(h.tree.snapshot()),api.stringifySceneJSON(h.accepted));
}
h.start();h.tick(40);h.tick(20);frame(0);
const pendingBefore=h.pending,requestsBefore=h.counts.requests;
h.frameSelect.value='1';h.onFrameChange();frame(1);
assert.equal(h.pending,pendingBefore);assert.equal(h.counts.requests,requestsBefore);
h.tick(40);frame(1);h.tick(20);frame(2);
assert.equal(h.counts.requests,5);assert.equal(h.counts.cancels,0);
const blueReset='Red elapsed 20 -> seek Blue -> 40 still Blue -> 20 Clear';
// Repeated/same-frame seek resets elapsed, without stopping the existing ticker.
h.seekFrame(1);h.tick(20);h.seekFrame(1);h.tick(40);frame(1);h.tick(20);frame(2);
h.pause();h.seekFrame(0);assert.equal(h.animation.playing,false);assert.equal(h.ticker.running,false);
const before=api.stringifySceneJSON(h.accepted),counts=JSON.stringify(h.counts);
for(const index of [-1,3,4,0.5,NaN,Infinity,'1',null,undefined,-0]) {
  assert.throws(()=>h.seekFrame(index),error=>error.code==='INVALID_SCENE');
  assert.equal(api.stringifySceneJSON(h.accepted),before);
  assert.equal(JSON.stringify(h.counts),counts);
}
// Synchronization reads actual image/crop, never the controller's stale index.
h.sprite.setSourceRect({x:0,y:0,width:2,height:1});h.show('manual');assert.equal(h.frameSelect.value,'manual');
h.sprite.setImageSource('Other',{x:0,y:0,width:1,height:1});h.show('other');assert.equal(h.frameSelect.value,'manual');
h.sprite.setImageSource('Atlas',{x:2,y:0,width:1,height:1});h.show('crop');assert.equal(h.frameSelect.value,'2');
// Current catalog is authoritative even when its coordinates differ; no Pack replay.
h.sheet=api.createSpriteAtlas('Atlas',{width:3,height:1},['Red','Blue','Clear'].map((name,i)=>({name,sourceRect:{x:2-i,y:0,width:1,height:1},durationMS:40})));
h.show('catalog');assert.equal(h.frameSelect.value,'0');
h.dispose();h.dispose();assert.equal(h.frameSelect.disabled,true);assert.equal(h.counts.removals,1);
assert.equal(h.counts.rendererDisposes,1);assert.equal(h.counts.unbinds,1);
assert.equal(h.openInput.disabled,true);assert.equal(h.button.disabled,true);
assert.throws(()=>h.seekFrame(0),error=>error.code==='DISPOSED');
const terminal=setup(api);terminal.start();terminal.tick(40);terminal.tick(20);terminal.seekFrame(1);terminal.tick(40);terminal.tick(20);terminal.dispose();
assert.equal(terminal.counts.requests,5);assert.equal(terminal.counts.cancels,1);
const html=fs.readFileSync(new URL('../../sprite-atlas.html',import.meta.url),'utf8');
assert.match(html,/<option value="manual" disabled>Manual crop<\/option>/);
assert.match(host,/frameSelect\.addEventListener\('change',onFrameChange\)/);
console.log(JSON.stringify({status:'PASS',kind:'real built public tree/atlas/animation/ticker; actual extracted host functions; instrumented DOM/renderer boundary',flow:blueReset,checks:['stable controller/tree/sprite/renderer/catalog identities','whole Scene crop-only delta','seek resets elapsed and preserves playing/paused state','same-frame repeated seek reset','invalid indices and provider negative-zero policy','actual image/crop/current-catalog selector synchronization','idempotent disposal removes only new selector callback','manual scheduler 5 requests / 1 final cancellation'],browser:'UNRUN',pixels:'UNRUN',trustedKeyboardAndPointer:'UNRUN',glAndDOMListenerAccounting:'UNRUN',source:fileURLToPath(new URL('../../sprite-atlas.mjs',import.meta.url))},null,2));

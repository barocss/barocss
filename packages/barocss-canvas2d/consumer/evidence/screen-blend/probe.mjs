import assert from 'node:assert/strict';
import {parseSceneJSON,createDisplayTree,createDisplayTreeFromScene,Canvas2DError} from '../../../dist/index.js';
const validateScene=value=>parseSceneJSON(JSON.stringify(value));
const pose={x:0,y:0,scaleX:1,scaleY:1,rotation:0};
const t=createDisplayTree('Probe');const p=t.createSprite({id:'Sprite',layer:0,transform:pose,imageId:'RGBA',width:24,height:20,opacity:1,sampling:'nearest',anchorX:0,anchorY:0});t.stage.addChild(p);
assert.equal(p.data.blendMode,'normal');p.setBlendMode('screen');assert.equal(t.snapshot().version,28);
let refusals=0;const refuse=fn=>{assert.throws(fn,e=>e instanceof Canvas2DError&&e.code==='INVALID_SCENE');refusals++};
const before=JSON.stringify(t.snapshot());for(const value of ['multiply','SCREEN','',null,undefined,1,{},[]]){refuse(()=>p.setBlendMode(value));assert.equal(JSON.stringify(t.snapshot()),before)}
const snap=t.snapshot();snap.nodes[0].blendMode='add';assert.equal(p.data.blendMode,'screen');
for(let version=0;version<28;version++){
 const n=structuredClone(t.snapshot().nodes[0]);if(version<9)delete n.visible;if(version<10)delete n.alpha;if(version<11)delete n.hitMode;
 refuse(()=>validateScene({version,unit:'logical-px',contextId:'Probe',nodes:[n]}));
 if(version>=8){for(const blendMode of ['normal','add']){n.blendMode=blendMode;assert.equal(validateScene({version,unit:'logical-px',contextId:'Probe',nodes:[n]}).nodes[0].blendMode,blendMode)}}
}
for(const mode of ['normal','add','screen']){p.setBlendMode(mode);const restored=createDisplayTreeFromScene(t.snapshot());assert.equal(restored.get('Sprite').data.blendMode,mode);restored.get('Sprite').setBlendMode('screen')}
let gets=0;const input={...p.data};Object.defineProperty(input,'blendMode',{enumerable:true,get(){gets++;return 'screen'}});refuse(()=>t.createSprite(input));assert.equal(gets,0);
refuse(()=>validateScene({...t.snapshot(),version:29}));
console.log(JSON.stringify({refusals,historicalScreenRejected:28,historicalNormalAdd:40,currentModes:3,accessorReads:gets,atomicRetention:true,copies:true}));

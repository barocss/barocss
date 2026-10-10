import assert from 'node:assert/strict';
import { Canvas2DRenderer, createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON, exportSceneSVG } from '../../../dist/index.js';
import { validateScene } from '../../../dist/schema.js';
import { setPolygonMaskGpu, checkPolygonMaskGpuCapacity } from '../../../dist/polygon-mask-gpu.js';
const pose=(x=0,y=0)=>({x,y,scaleX:1,scaleY:1,rotation:0});
const mask=()=>({commands:[{kind:'M',x:0,y:0},{kind:'L',x:100,y:0},{kind:'L',x:100,y:40},{kind:'L',x:40,y:40},{kind:'L',x:40,y:100},{kind:'L',x:0,y:100},{kind:'Z'}]});
let refusals=0;function reject(fn,code){assert.throws(fn,e=>e?.code===code);refusals++;}
function cpu(){const r=Object.create(Canvas2DRenderer.prototype);Object.assign(r,{disposed:false,lost:false,stencilBits:0,scene:{version:0,unit:'logical-px',contextId:'Empty',nodes:[]},draws:[],view:{panX:0,panY:0,zoom:1},size:{width:400,height:300},dpr:2,tolerance:.25,assets:new Map()});return r;}
const t=createDisplayTree('TwoMasks');const input=mask();
const outer=t.createContainer({id:'Outer',layer:0,transform:pose(10,10),mask:input,hitArea:{x:0,y:0,width:150,height:150}});
const inner=t.createContainer({id:'Inner',layer:0,transform:pose(20,20),mask:mask(),hitArea:{x:0,y:0,width:150,height:150}});
const child=t.createRect({id:'Child',layer:0,transform:pose(),width:150,height:150,fill:[1,0,0,1]});inner.addChild(child);outer.addChild(inner);
t.stage.addChild(t.createRect({id:'Back',layer:-1,transform:pose(),width:400,height:300,fill:[.1,.1,.1,1]}));t.stage.addChild(outer);
t.stage.addChild(t.createRect({id:'Following',layer:1,transform:pose(200,10),width:30,height:30,fill:[0,0,1,1]}));
assert.equal(t.snapshot().version,26);input.commands[0].x=200;const copy=inner.data;copy.mask.commands[1].x=200;assert.equal(outer.data.mask.commands[0].x,0);assert.equal(inner.data.mask.commands[1].x,100);
const r=cpu();r.updateScene(t.snapshot());assert.deepEqual(r.hitTestAll({x:35,y:35},10).map(h=>h.id),['Child','Inner','Outer','Back']);
assert.equal(r.hitTest({x:90,y:90}).id,'Back');assert.equal(r.hitTest({x:90,y:35}).id,'Child');assert.equal(r.hitTest({x:35,y:115}).id,'Back');assert.equal(r.hitTest({x:205,y:15}).id,'Following');
assert.deepEqual(inner.getWorldBounds(),{x:30,y:30,width:80,height:80});
const two=t.snapshot();reject(()=>validateScene({...two,version:25}),'UNSUPPORTED_FEATURE');const one=structuredClone(two);one.version=25;delete one.nodes[1].children[0].mask;assert.equal(validateScene(one).version,25);
for(let v=0;v<25;v++){assert.equal(validateScene({version:v,unit:'logical-px',contextId:'Old',nodes:[]}).version,v);reject(()=>validateScene({...two,version:v}),'INVALID_SCENE');}
const third=t.createContainer({id:'Third',layer:0,transform:pose(),mask:mask(),visible:false,alpha:0,hitMode:'none'});
const before=stringifySceneJSON(t.snapshot());reject(()=>inner.addChild(third),'SCENE_LIMIT');assert.equal(stringifySceneJSON(t.snapshot()),before);assert.equal(third.data.visible,false);
t.stage.addChild(third);const beforeMove=stringifySceneJSON(t.snapshot());reject(()=>t.reparentChild(third,inner,0),'SCENE_LIMIT');assert.equal(stringifySceneJSON(t.snapshot()),beforeMove);assert.equal(t.stage.children.at(-1),third);
const leaf=t.createContainer({id:'Leaf',layer:1,transform:pose()});inner.addChild(leaf);const beforeSet=stringifySceneJSON(t.snapshot());reject(()=>leaf.setMask(mask()),'SCENE_LIMIT');assert.equal(stringifySceneJSON(t.snapshot()),beforeSet);assert.equal(leaf.data.mask,undefined);
const beforePose=stringifySceneJSON(t.snapshot());reject(()=>outer.setScale(1e6,1e6),'INVALID_SCENE');assert.equal(stringifySceneJSON(t.snapshot()),beforePose);
const tiny={commands:[{kind:'M',x:0,y:0},{kind:'L',x:.001,y:0},{kind:'L',x:0,y:.001},{kind:'Z'}]};
const precision=t.createContainer({id:'Precision',layer:4,transform:pose(1e6,1e6)});t.stage.addChild(precision);const beforePrecision=stringifySceneJSON(t.snapshot());reject(()=>precision.setMask(tiny),'SCENE_LIMIT');assert.equal(stringifySceneJSON(t.snapshot()),beforePrecision);
// Two independently valid masks can have empty overlap.
inner.setPosition(200,200);r.updateScene(t.snapshot());assert.equal(r.hitTest({x:220,y:220}).id,'Back');assert.equal(inner.getWorldBounds(),null);inner.setPosition(20,20);
const restored=createDisplayTreeFromScene(t.snapshot());assert.equal(stringifySceneJSON(restored.snapshot()),stringifySceneJSON(t.snapshot()));restored.get('Inner').setMask(null);restored.get('Inner').setMask(mask());assert.equal(stringifySceneJSON(restored.snapshot()),stringifySceneJSON(t.snapshot()));
assert.equal(exportSceneSVG(t.snapshot(),{width:400,height:300}).ok,false);
const capacity=createDisplayTree('Capacity');const regular=()=>({commands:Array.from({length:32},(_,i)=>({kind:i?'L':'M',x:50+30*Math.cos(i*2*Math.PI/32),y:50+30*Math.sin(i*2*Math.PI/32)})).concat({kind:'Z'})});
for(let i=0;i<8;i++)capacity.stage.addChild(capacity.createContainer({id:'M'+i,layer:i,transform:pose(),mask:regular()}));assert.equal(capacity.snapshot().nodes.length,8);const ninth=capacity.createContainer({id:'M8',layer:8,transform:pose(),mask:mask()});const beforeLimit=stringifySceneJSON(capacity.snapshot());reject(()=>capacity.stage.addChild(ninth),'SCENE_LIMIT');assert.equal(stringifySceneJSON(capacity.snapshot()),beforeLimit);
const tooDeep=structuredClone(two);tooDeep.nodes[1].children[0].children.push({kind:'group',id:'ThirdScene',layer:1,transform:pose(),visible:false,alpha:0,hitMode:'none',mask:mask(),children:[]});
r.updateScene(two);const acceptedJSON=stringifySceneJSON(r.scene),hitsBefore=r.hitTestAll({x:35,y:35},10);reject(()=>r.updateScene(tooDeep),'SCENE_LIMIT');assert.equal(stringifySceneJSON(r.scene),acceptedJSON);assert.deepEqual(r.hitTestAll({x:35,y:35},10),hitsBefore);
const large=mask();for(const c of large.commands)if(c.kind!=='Z'){c.x*=1000;c.y*=1000;}outer.setMask(large);outer.setScale(100,100);r.updateScene(t.snapshot());const beforeView={...r.view},beforeScene=stringifySceneJSON(r.scene);reject(()=>r.setView({panX:1e6,panY:1e6,zoom:64}),'SCENE_LIMIT');assert.deepEqual(r.view,beforeView);assert.equal(stringifySceneJSON(r.scene),beforeScene);
// Isolated upload/capability test doubles; no GPU execution claim.
const calls=[];const gl={MAX_FRAGMENT_UNIFORM_VECTORS:100,getParameter:()=>128,uniform1i:(l,v)=>calls.push([l,v]),uniform2fv:(l,v)=>calls.push([l,[...v]])};const gpu={count0:'c0',count1:'c1',points:'p'};const contour=new Float32Array([0,0,10,0,0,10]);checkPolygonMaskGpuCapacity(gl);setPolygonMaskGpu(gl,gpu,[contour,contour]);assert.deepEqual(calls.slice(0,2),[['c0',3],['c1',3]]);calls.length=0;setPolygonMaskGpu(gl,gpu,[]);assert.deepEqual(calls,[['c0',0],['c1',0]]);calls.length=0;setPolygonMaskGpu(gl,gpu,[contour]);assert.deepEqual(calls.slice(0,2),[['c0',3],['c1',0]]);calls.length=0;reject(()=>setPolygonMaskGpu(gl,gpu,[contour,new Float32Array([0,0,NaN,0,0,10])]),'SCENE_LIMIT');assert.equal(calls.length,0);reject(()=>setPolygonMaskGpu(gl,gpu,[contour,contour,contour]),'SCENE_LIMIT');assert.equal(calls.length,0);reject(()=>checkPolygonMaskGpuCapacity({...gl,getParameter:()=>127}),'UNSUPPORTED_FEATURE');
console.log(JSON.stringify({scene26:true,v25ExactNestedRefusal:true,oldProfiles:25,copied:true,CPUConjunction:true,childFirst:true,bounds:true,hiddenThirdRollback:true,reparentRollback:true,setMaskRollback:true,transformRollback:true,disjointLegal:true,restoredEdits:true,mask8points256:true,uploadFullValidation:true,zeroOneTwoReset:true,capability128:true,refusals,browser:false}));

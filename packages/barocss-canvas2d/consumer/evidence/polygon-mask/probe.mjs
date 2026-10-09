import assert from 'node:assert/strict';
import {Canvas2DRenderer,createDisplayTree,createDisplayTreeFromScene,parseSceneJSON,stringifySceneJSON,exportSceneSVG} from '../../../dist/index.js';
import {validateScene} from '../../../dist/schema.js';
const pose=(x=0,y=0,rotation=0,scaleX=1,scaleY=1)=>({x,y,rotation,scaleX,scaleY});
const mask=()=>({commands:[{kind:'M',x:0,y:0},{kind:'L',x:100,y:0},{kind:'L',x:100,y:40},{kind:'L',x:40,y:40},{kind:'L',x:40,y:100},{kind:'L',x:0,y:100},{kind:'Z'}]});
let refused=0;const reject=(f,code)=>{assert.throws(f,e=>e?.code===code);refused++;};
const tree=createDisplayTree('MaskProbe');
tree.stage.addChild(tree.createRect({id:'Back',layer:-1,transform:pose(),width:300,height:200,fill:[.1,.1,.1,1]}));
const input=mask();const group=tree.createContainer({id:'Masked',layer:0,transform:pose(20,20),mask:input,hitArea:{x:0,y:0,width:120,height:120}});
group.addChild(tree.createRect({id:'Child',layer:0,transform:pose(),width:120,height:120,fill:[1,0,0,1]}));
tree.stage.addChild(group);
tree.stage.addChild(tree.createRect({id:'Following',layer:1,transform:pose(170,20),width:40,height:40,fill:[0,0,1,1]}));
input.commands[0].x=500;const copied=group.data;copied.mask.commands[1].x=500;
assert.equal(group.data.mask.commands[0].x,0);assert.equal(group.data.mask.commands[1].x,100);
assert.equal(tree.snapshot().version,25);
assert.deepEqual(group.getWorldBounds(),{x:20,y:20,width:100,height:100});
assert.deepEqual(group.getLocalBounds(),{x:0,y:0,width:100,height:100});
function cpu(){const renderer=Object.create(Canvas2DRenderer.prototype);Object.assign(renderer,{disposed:false,lost:false,stencilBits:0,scene:{version:0,unit:'logical-px',contextId:'Empty',nodes:[]},draws:[],view:{panX:0,panY:0,zoom:1},size:{width:300,height:200},dpr:2,tolerance:.25,assets:new Map()});return renderer;}
const renderer=cpu();renderer.updateScene(tree.snapshot());
assert.equal(renderer.hitTest({x:30,y:110}).id,'Child');
assert.equal(renderer.hitTest({x:100,y:100}).id,'Back');
assert.equal(renderer.hitTest({x:180,y:30}).id,'Following');
assert.deepEqual(renderer.hitTestAll({x:30,y:30},10).map(h=>h.id),['Child','Masked','Back']);
// Group own interaction area is clipped by the same polygon.
group.removeChild(group.children[0]);renderer.updateScene(tree.snapshot());
assert.equal(renderer.hitTest({x:30,y:30}).id,'Masked');assert.equal(renderer.hitTest({x:100,y:100}).id,'Back');
const previous=stringifySceneJSON(tree.snapshot());
reject(()=>group.setMask({commands:[{kind:'M',x:0,y:0},{kind:'L',x:20,y:20},{kind:'L',x:0,y:20},{kind:'L',x:20,y:0},{kind:'Z'}]}),'UNSUPPORTED_FEATURE');
assert.equal(stringifySceneJSON(tree.snapshot()),previous);
reject(()=>group.setPosition(1e6,1e6) || group.setMask({commands:[{kind:'M',x:0,y:0},{kind:'L',x:.001,y:0},{kind:'L',x:0,y:.001},{kind:'Z'}]}),'SCENE_LIMIT');
// setPosition itself was valid; failed setMask leaves the prior mask unchanged.
assert.equal(group.data.mask.commands.length,7);group.setPosition(20,20);
const maskedChild=tree.createContainer({id:'Nested',layer:0,transform:pose(),mask:mask(),visible:false,alpha:0});
const beforeNested=stringifySceneJSON(tree.snapshot());reject(()=>group.addChild(maskedChild),'UNSUPPORTED_FEATURE');assert.equal(stringifySceneJSON(tree.snapshot()),beforeNested);assert.equal(group.children.length,0);
tree.stage.addChild(maskedChild);const beforeMove=stringifySceneJSON(tree.snapshot());reject(()=>tree.reparentChild(maskedChild,group,0),'UNSUPPORTED_FEATURE');assert.equal(stringifySceneJSON(tree.snapshot()),beforeMove);
for(let version=0;version<=24;version++){assert.equal(validateScene({version,unit:'logical-px',contextId:'Old',nodes:[]}).version,version);const old={...tree.snapshot(),version};reject(()=>validateScene(old),'INVALID_SCENE');}
const many=createDisplayTree('MaskCapacity');for(let i=0;i<8;i++)many.stage.addChild(many.createContainer({id:'G'+i,layer:i,transform:pose(),mask:mask()}));const ninth=many.createContainer({id:'G8',layer:8,transform:pose(),mask:mask()});const beforeLimit=stringifySceneJSON(many.snapshot());reject(()=>many.stage.addChild(ninth),'SCENE_LIMIT');assert.equal(stringifySceneJSON(many.snapshot()),beforeLimit);
const encoded=stringifySceneJSON(tree.snapshot());const restored=createDisplayTreeFromScene(parseSceneJSON(encoded));assert.equal(stringifySceneJSON(restored.snapshot()),encoded);restored.get('Masked').setMask(null);assert.equal('mask' in restored.get('Masked').data,false);
const unsupported=exportSceneSVG(tree.snapshot(),{width:300,height:200});assert.equal(unsupported.ok,false);assert.ok(unsupported.diagnostics.some(d=>d.nodeId==='Nested'&&d.feature.includes('mask')));
group.setMask(null);renderer.updateScene(tree.snapshot());assert.equal(renderer.hitTest({x:100,y:100}).id,'Masked');group.setMask(mask());renderer.updateScene(tree.snapshot());
const large=mask();for(const command of large.commands)if(command.kind!=='Z'){command.x*=1000;command.y*=1000;}group.setMask(large);group.setScale(100,100);renderer.updateScene(tree.snapshot());const currentScene=stringifySceneJSON(renderer.scene),beforeView={...renderer.view};reject(()=>renderer.setView({panX:1e6,panY:1e6,zoom:64}),'SCENE_LIMIT');assert.equal(stringifySceneJSON(renderer.scene),currentScene);assert.deepEqual(renderer.view,beforeView);
console.log(JSON.stringify({scene25:true,oldVersions:25,copied:true,cpuHit:true,groupArea:true,bounds:true,nestedHiddenRollback:true,reparentRollback:true,maxMasks:8,polygonOnlyWithoutStencil:true,restoreEdit:true,svgRefused:true,refused,gpu:false,browser:false}));

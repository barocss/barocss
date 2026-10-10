import assert from 'node:assert/strict';
import {createDisplayTree,createDisplayTreeFromScene,stringifySceneJSON,exportSceneSVG,Canvas2DRenderer} from '../../../dist/index.js';
import {renderImage} from '../../../dist/image.js';
import {validateScene} from '../../../dist/schema.js';
const pose=()=>({x:0,y:0,scaleX:1,scaleY:1,rotation:0});
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0];
const swap=()=>[0,0,1,0,0,1,0,0,1,0,0,0];
const spec=()=>({id:'Sprite',layer:1,transform:pose(),imageId:'Pixels',width:20,height:10,anchorX:0,anchorY:0,opacity:1,sampling:'nearest'});
let refusals=0,getters=0;const reject=fn=>{assert.throws(fn,e=>e?.code==='INVALID_SCENE');refusals++;};
const t=createDisplayTree('Matrix'),input=swap(),sprite=t.createSprite({...spec(),rgbMatrix:input});t.stage.addChild(sprite);
input[0]=4;assert.equal(sprite.data.rgbMatrix[0],0);const data=sprite.data;data.rgbMatrix[0]=4;assert.equal(sprite.data.rgbMatrix[0],0);
const shot=t.snapshot();shot.nodes[0].rgbMatrix[0]=4;assert.equal(t.snapshot().nodes[0].rgbMatrix[0],0);assert.equal(t.snapshot().version,27);
const set=identity();sprite.setRGBMatrix(set);set[0]=4;assert.equal(sprite.data.rgbMatrix[0],1);
const restored=createDisplayTreeFromScene(t.snapshot());assert.deepEqual(restored.snapshot(),t.snapshot());restored.get('Sprite').setRGBMatrix(null);assert.equal(Object.hasOwn(restored.get('Sprite').data,'rgbMatrix'),false);restored.get('Sprite').setRGBMatrix(identity());assert.deepEqual(restored.snapshot(),t.snapshot());
const bad=[undefined,{},new Float32Array(12),[],identity().slice(1),[...identity(),0],Array(12),identity().map((v,i)=>i===0?NaN:v),identity().map((v,i)=>i===4?Infinity:v),identity().map((v,i)=>i===3?1.01:v),identity().map((v,i)=>i===7?-1.01:v),identity().map((v,i)=>i===2?4.01:v),identity().map((v,i)=>i===8?-4.01:v),identity().map((v,i)=>i===0?'1':v),Object.assign(identity(),{extra:0})];
const accessor=identity();Object.defineProperty(accessor,'0',{enumerable:true,get(){getters++;return 1;}});bad.push(accessor);
for(const matrix of bad){const before=stringifySceneJSON(t.snapshot());reject(()=>sprite.setRGBMatrix(matrix));assert.equal(stringifySceneJSON(t.snapshot()),before);reject(()=>t.createSprite({...spec(),rgbMatrix:matrix}));}assert.equal(getters,0);
reject(()=>t.createSprite({...spec(),rgbMatrix:null}));
for(let version=0;version<=26;version++){
 const s={version,unit:'logical-px',contextId:'Old',nodes:[]};assert.equal(validateScene(s).version,version);
 if(version<3){reject(()=>validateScene({...s,rgbMatrix:identity()}));continue;}
 const n={kind:'image',...spec()};if(version>=7)n.tint=[1,1,1];if(version>=8)n.blendMode='normal';if(version>=9)n.visible=true;if(version>=10)n.alpha=1;if(version>=11)n.hitMode='auto';if(version<6){delete n.anchorX;delete n.anchorY;}
 assert.equal(validateScene({...s,nodes:[n]}).version,version);reject(()=>validateScene({...s,nodes:[{...n,rgbMatrix:identity()}]}));
}
const group={kind:'group',id:'Group',layer:0,transform:pose(),visible:true,alpha:1,hitMode:'auto',children:[]};reject(()=>validateScene({version:27,unit:'logical-px',contextId:'Invalid',nodes:[{...group,rgbMatrix:identity()}]}));
const r=Object.create(Canvas2DRenderer.prototype);Object.assign(r,{disposed:false,lost:false,stencilBits:0,scene:{version:0,unit:'logical-px',contextId:'Empty',nodes:[]},draws:[],view:{panX:0,panY:0,zoom:1},size:{width:100,height:100},dpr:2,tolerance:.25,assets:new Map([['Pixels',{width:2,height:1,pixels:new Uint8Array([255,0,0,255,0,255,0,0]),texture:null}]])});
r.updateScene(t.snapshot());assert.equal(r.hitTest({x:5,y:5}).id,'Sprite');assert.equal(r.hitTest({x:15,y:5}),null);
sprite.setRGBMatrix([0,0,0,1,0,0,0,1,0,0,0,1]);r.updateScene(t.snapshot());assert.equal(r.hitTest({x:15,y:5}),null);const accepted=stringifySceneJSON(r.scene),hits=r.hitTestAll({x:5,y:5},8);const invalid=t.snapshot();invalid.nodes[0].rgbMatrix[3]=2;reject(()=>r.updateScene(invalid));assert.equal(stringifySceneJSON(r.scene),accepted);assert.deepEqual(r.hitTestAll({x:5,y:5},8),hits);
assert.equal(exportSceneSVG(t.snapshot(),{width:100,height:100}).ok,false);
const full=createDisplayTree('Full');for(let i=0;i<256;i++)full.stage.addChild(full.createSprite({...spec(),id:'S'+i,rgbMatrix:identity()}));assert.equal(full.snapshot().nodes.length,256);
// Image upload guard through an isolated counting double, no GPU claim.
let uniforms=0;const gl=new Proxy({}, {get:()=>()=>{uniforms++;}});
for(const matrix of bad){reject(()=>renderImage(gl,{},new Float32Array(12),{kind:'image',...spec(),rgbMatrix:matrix},{texture:{},width:2,height:1,pixels:new Uint8Array(8)},1,{width:100,height:100},{panX:0,panY:0,zoom:1}));}
assert.equal(uniforms,0);assert.equal(getters,0);
console.log(JSON.stringify({scene27:true,oldProfiles:27,copiedFactorySetterDataSnapshot:true,reconstructClear:true,transparentAlphaHitUnchanged:true,admissionRollback:true,svgRefusal:true,nodes256Numbers3072:true,accessorReads:getters,refusals,uploadGuardZeroWrites:uniforms===0,browser:false}));

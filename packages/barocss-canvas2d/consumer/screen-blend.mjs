// @ts-check
import {createCanvas2D,createDisplayTree,createDisplayTreeFromScene} from '@barocss/canvas2d';
import {serializeCanvasDocument,parseCanvasDocument} from '@barocss/canvas2d/document';
/** @typedef {import('@barocss/canvas2d').DisplayTree} Tree */
/** @typedef {{canvas:HTMLCanvasElement,tree:Tree,renderer:import('@barocss/canvas2d').Canvas2DRenderer,unbind:()=>void}} Session */
const options={logicalSize:{width:320,height:200},dpr:2,backgroundColor:/** @type {[number,number,number,number]} */([0.25,0.5,0.75,0.4])};
const pose=(/** @type {number} */x=0,/** @type {number} */y=0)=>({x,y,scaleX:1,scaleY:1,rotation:0});
const asset={width:3,height:1,pixels:new Uint8Array([180,70,140,128,60,200,90,255,220,80,10,0])};
const initial=createDisplayTree('ScreenBlend');
let layer=0;
/** @param {string} id @param {number} x @param {number} y @param {'normal'|'add'|'screen'} mode */
function sprite(id,x,y,mode){return initial.createSprite({id,layer:layer++,transform:pose(x,y),imageId:'RGBA',width:72,height:28,opacity:1,anchorX:0,anchorY:0,sampling:'nearest',blendMode:mode});}
for(const [i,mode] of /** @type {const} */(['normal','add','screen']).entries()){
 const x=8+i*100;
 initial.stage.addChild(initial.createRect({id:`Back${i}`,layer:layer++,transform:pose(x,8),width:72,height:28,fill:[0.3,0.2,0.6,1]}));
 initial.stage.addChild(sprite(`Opaque${i}`,x,8,mode));
 initial.stage.addChild(sprite(`Translucent${i}`,x,48,mode));
}
const frame=initial.createFrame({id:'Frame',layer:layer++,transform:pose(8,88),width:68,height:28,fill:[0,0,0,0],clip:true});
const group=initial.createContainer({id:'Mask',layer:0,transform:pose(),mask:{commands:[{kind:'M',x:0,y:0},{kind:'L',x:40,y:0},{kind:'L',x:40,y:28},{kind:'L',x:0,y:28},{kind:'Z'}]}});
const effect=sprite('Effect',0,0,'screen');effect.setRGBMatrix([0,0,1,0.1,0,1,0,0,1,0,0,0]);effect.setTint([0.5,1,0.75]);effect.setOpacity(0.6);effect.setAlpha(0.8);group.addChild(effect);frame.addChild(group);initial.stage.addChild(frame);
initial.stage.addChild(sprite('Following',108,88,'normal'));
initial.stage.addChild(initial.createPath({id:'FollowingPath',layer:layer++,transform:pose(208,88),commands:[{kind:'M',x:0,y:0},{kind:'L',x:72,y:0},{kind:'L',x:72,y:28},{kind:'L',x:0,y:28},{kind:'Z'}],fill:{rule:'evenodd',color:[0.8,0.1,0.3,0.5]}}));
// A rect under a fully transparent texel makes pointer fall-through observable.
initial.stage.addChild(initial.createRect({id:'HitBack',layer:layer++,transform:pose(8,132),width:72,height:28,fill:[0.1,0.6,0.2,1]}));
initial.stage.addChild(sprite('Editable',8,132,'screen'));
const counts={created:0,disposed:0,bindings:0,unbindings:0,pointers:0,edits:0};
/** @type {Session|null} */let session=null;
/** @type {unknown} */let terminal=null;
/** @type {unknown} */let failure=null;
/** @type {unknown} */let opened=null;
let savedBytes=0;
const pointerTargets=/** @type {(string|null)[]} */([]);
const output=/** @type {HTMLElement} */(document.querySelector('#observation'));
const status=/** @type {HTMLElement} */(document.querySelector('#status'));
/** @param {Tree} tree @param {Map<string,import('@barocss/canvas2d').ImageAssetInput>} assets */
function install(tree,assets){
 const canvas=document.createElement('canvas');canvas.id='scene';
 const renderer=createCanvas2D(canvas,options);counts.created++;
 try{for(const [id,value]of assets)renderer.setImageAsset(id,value);renderer.updateScene(tree.snapshot());renderer.render();}
 catch(error){renderer.dispose();counts.disposed++;throw error;}
 const pointer=(/** @type {PointerEvent} */event)=>{const box=canvas.getBoundingClientRect();const point={x:(event.clientX-box.left)*320/box.width,y:(event.clientY-box.top)*200/box.height};const hit=renderer.hitTest(point);tree.dispatchPointer({type:'pointerdown',pointerId:event.pointerId,point,hit});counts.pointers++;pointerTargets.push(hit?.id??null);show('Pointer');};
 canvas.addEventListener('pointerdown',pointer);counts.bindings++;
 const next={canvas,renderer,tree,unbind:()=>{canvas.removeEventListener('pointerdown',pointer);counts.unbindings++;}};
 const previous=session;(previous?.canvas??/** @type {HTMLElement} */(document.querySelector('#scene'))).replaceWith(canvas);session=next;
 if(previous){previous.unbind();previous.renderer.dispose();counts.disposed++;}
 return next;
}
/** @param {string} id */function handle(id){const value=session?.tree.get(id);if(value?.kind!=='sprite')throw new Error('Sprite missing');return value;}
/** @param {number} x @param {number} y */function sample(x,y){if(!session)return null;const gl=session.canvas.getContext('webgl2');if(!gl)throw new Error('GL unavailable');const rgba=new Uint8Array(4);gl.readPixels(x*2,session.canvas.height-y*2-1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);return{rgba:[...rgba],hit:session.renderer.hitTest({x,y})?.id??null};}
function observation(){return{counts:{...counts},pointerTargets:[...pointerTargets],version:session?.tree.snapshot().version??null,mode:session?handle('Editable').data.blendMode:null,failure,opened,savedBytes,samples:session?Object.fromEntries(points.map(([name,x,y])=>[name,sample(x,y)])):null};}
/** @type {[string,number,number][]} */const points=[];
for(let i=0;i<3;i++)for(const[yName,y]of /** @type {const} */([['opaque',20],['translucent',60]]))for(let texel=0;texel<3;texel++)points.push([`${yName}${i}_${texel}`,20+i*100+24*texel,y]);
points.push(['effect',20,100],['maskOutside',60,100],['frameOutside',80,100],['following',120,100],['path',220,100],['editInk',20,144],['editTransparent',68,144]);
/** @param {string} message */function show(message){status.textContent=message;output.textContent=JSON.stringify(observation(),null,2);}
/** @param {unknown} mode */function edit(mode){if(!session)return;const before=JSON.stringify(session.tree.snapshot());try{handle('Editable').setBlendMode(/** @type {'normal'|'add'|'screen'} */(mode));session.renderer.updateScene(session.tree.snapshot());session.renderer.render();counts.edits++;failure=null;show(`Blend ${mode}`);}catch(error){failure={code:error&&typeof error==='object'&&'code'in error?error.code:'Error',retained:JSON.stringify(session.tree.snapshot())===before};show('Mode refused');}}
/** @param {Blob} blob @param {string} filename */function download(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),0);}
async function save(){if(!session)return;const text=await serializeCanvasDocument(session.tree.snapshot(),id=>session?.renderer.getImageAsset(id)??null);savedBytes=new TextEncoder().encode(text).length;download(new Blob([text],{type:'application/json'}),'screen-blend.json');show('Saved');}
const input=/** @type {HTMLInputElement} */(document.querySelector('#open'));
input.addEventListener('change',async()=>{const file=input.files?.[0];input.value='';if(!file||!session)return;try{const parsed=await parseCanvasDocument(await file.text());const tree=createDisplayTreeFromScene(parsed.scene);const old=session;const source=old.renderer.getImageAsset('RGBA');install(tree,parsed.assets);opened={savedVersion:parsed.scene.version,freshCanvas:old.canvas!==session?.canvas,bytesEqual:JSON.stringify([...source?.pixels??[]])===JSON.stringify([...session?.renderer.getImageAsset('RGBA')?.pixels??[]])};show('Opened');}catch(error){failure=String(error);show('Open failed');}});
for(const mode of /** @type {const} */(['normal','add','screen']))document.querySelector(`#${mode}`)?.addEventListener('click',()=>edit(mode));
document.querySelector('#invalid')?.addEventListener('click',()=>edit('multiply'));
document.querySelector('#save')?.addEventListener('click',()=>void save());
document.querySelector('#choose')?.addEventListener('click',()=>input.click());
function dispose(){if(!session)return;terminal=observation();session.unbind();session.renderer.dispose();counts.disposed++;session=null;show('Disposed');}
document.querySelector('#dispose')?.addEventListener('click',dispose);
install(initial,new Map([['RGBA',asset]]));show('Ready');
Object.assign(globalThis,{screenBlend:{observe:observation,sample,edit,dispose,terminal:()=>terminal,scene:()=>session?.tree.snapshot(),bytes:()=>[...session?.renderer.getImageAsset('RGBA')?.pixels??[]],session:()=>session}});

// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON, outlineImageAsset } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument, exportCanvasDocumentPNG } from '@barocss/canvas2d/document';

/** @typedef {{created:number,deleted:number,objects:object[],live:()=>number}} Resource */
/** @type {{gl:WebGL2RenderingContext,lost:boolean,calls:{draw:number,read:number},resources:Record<string,Resource>}[]} */
const contexts = [];
/** @param {HTMLCanvasElement} target */
function instrument(target) {
  const get = target.getContext.bind(target);
  target.getContext = /** @type {HTMLCanvasElement['getContext']} */ ((/** @type {string} */ kind, /** @type {any} */ attrs) => {
    const gl = /** @type {WebGL2RenderingContext|null} */ (get(/** @type {'webgl2'} */ (kind), attrs));
    if (kind === 'webgl2' && gl && !contexts.some(item => item.gl === gl)) {
      const item = { gl, lost: false, calls: { draw: 0, read: 0 }, resources: /** @type {Record<string,Resource>} */ ({}) };
      contexts.push(item); target.addEventListener('webglcontextlost', () => { item.lost = true; });
      for (const [name, create, remove, test] of [
        ['shader','createShader','deleteShader','isShader'], ['program','createProgram','deleteProgram','isProgram'],
        ['buffer','createBuffer','deleteBuffer','isBuffer'], ['vao','createVertexArray','deleteVertexArray','isVertexArray'],
        ['texture','createTexture','deleteTexture','isTexture'], ['fbo','createFramebuffer','deleteFramebuffer','isFramebuffer'],
      ]) {
        const raw = /** @type {any} */ (gl), allocate = raw[create].bind(gl), release = raw[remove].bind(gl), isLive = raw[test].bind(gl);
        const resource = { created: 0, deleted: 0, objects: /** @type {object[]} */ ([]), live: () => resource.objects.filter(value => isLive(value)).length };
        item.resources[name] = resource;
        raw[create] = /** @param {...any} args */ (...args) => { const value = allocate(...args); if (value) { resource.created++; resource.objects.push(value); } return value; };
        raw[remove] = (/** @type {object|null} */ value) => { if (value) resource.deleted++; return release(value); };
      }
      for (const [name, key] of [['drawArrays','draw'], ['readPixels','read']]) {
        const raw = /** @type {any} */ (gl), call = raw[name].bind(gl);
        raw[name] = /** @param {...any} args */ (...args) => { item.calls[/** @type {'draw'|'read'} */ (key)]++; return call(...args); };
      }
    }
    return gl;
  });
  return target;
}
/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 32, height: 24 }, dpr: 2 };
const pose = (/** @type {number} */ x, /** @type {number} */ y) => ({ x,y,scaleX:1,scaleY:1,rotation:0 });
/** @type {import('@barocss/canvas2d').ImageAssetInput} */
const image = { width:3,height:3,pixels:new Uint8Array([255,0,0,255,255,128,0,255,255,255,0,255,0,0,0,0,0,255,0,255,0,255,255,255,0,0,255,255,128,0,255,255,255,255,255,255]) };
/** @type {import('@barocss/canvas2d').ImageAssetInput} */
const source = { width:3,height:3,pixels:new Uint8Array([7,8,9,0,7,8,9,0,7,8,9,0,7,8,9,0,255,0,0,255,7,8,9,0,7,8,9,0,7,8,9,0,7,8,9,0]) };
/** @type {import('@barocss/canvas2d').Color} */ const color = [1,1,1,0.5];
/** @param {import('@barocss/canvas2d').ImageAssetInput} value @returns {import('@barocss/canvas2d').ImageAssetInput} */
function copyAsset(value) { return { width:value.width,height:value.height,pixels:new Uint8Array(value.pixels) }; }
/** @param {import('@barocss/canvas2d').Canvas2DRenderer} r @param {Iterable<string>} ids @returns {Map<string,import('@barocss/canvas2d').ImageAssetInput>} */
function snapshotAssets(r,ids) { const result=new Map();for(const id of ids){const asset=r.getImageAsset(id);if(asset)result.set(id,asset);}return result; }
let tree=createDisplayTree('NineSliceConsumer');
let back=tree.createRect({id:'Back',layer:0,transform:pose(0,0),width:32,height:24,fill:[0.25,0.25,0.25,1]});
let panel=tree.createSprite({id:'Panel',layer:1,transform:pose(4,4),imageId:'Nine',width:7,height:5,opacity:1,sampling:'nearest',anchorX:0,anchorY:0,sourceRect:{x:0,y:0,width:3,height:3},slice:{left:1,right:1,top:1,bottom:1}});
tree.stage.addChild(back);tree.stage.addChild(panel);
/** @type {HTMLCanvasElement} */ let canvas=/** @type {HTMLCanvasElement} */(document.querySelector('#scene'));
let renderer=createCanvas2D(instrument(canvas),options);renderer.setImageAsset('Nine',image);let hostAssets=snapshotAssets(renderer,['Nine']);
/** @type {import('@barocss/canvas2d').Scene} */ let accepted=tree.snapshot();renderer.updateScene(accepted);renderer.render();
let generation=1,disposed=false,outlinePreparations=0,opens=0,edits=0,saves=0,pngs=0,binds=0,unbinds=0,pointerEvents=0,candidateAttempts=0,candidateAccepted=0,candidateRefused=0;
/** @type {string[]} */ let pointerLog=[];
/** @type {string[]} */ const oldLog=[];
/** @type {()=>void} */ let unbind=()=>{};
const output=/** @type {HTMLElement} */(document.querySelector('#observation')),status=/** @type {HTMLElement} */(document.querySelector('#status')),openInput=/** @type {HTMLInputElement} */(document.querySelector('#open'));
function active(){if(disposed)throw new Error('consumer disposed');}
/** @returns {Map<string,import('@barocss/canvas2d').ImageAssetInput>} */
function assets(){return new Map([...hostAssets].map(([id,asset])=>[id,copyAsset(asset)]));}
/** @param {number} x @param {number} y */
function pixel(x,y){const gl=canvas.getContext('webgl2');if(!gl)throw new Error('WebGL2 missing');const bytes=new Uint8Array(4);gl.readPixels(x*2,canvas.height-y*2-1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return[...bytes];}
function observe(){const registered=Object.fromEntries([...hostAssets].map(([id,asset])=>[id,{width:asset.width,height:asset.height,pixels:[...asset.pixels]}])),x=panel.data.transform.x,y=panel.data.transform.y,right=x+panel.data.width-1,bottom=y+panel.data.height-1;
 return{generation,disposed,outlinePreparations,opens,edits,saves,pngs,binds,unbinds,pointerEvents,candidates:{attempted:candidateAttempts,accepted:candidateAccepted,refused:candidateRefused},sceneVersion:accepted.version,contextId:accepted.contextId,width:panel.data.width,height:panel.data.height,slice:panel.data.slice,imageId:panel.data.imageId,sourceRect:panel.data.sourceRect,panelData:panel.data,
 pixel:disposed?null:{topLeft:pixel(x,y),top:pixel(x+2,y),topRight:pixel(right,y),leftTransparent:pixel(x,y+2),center:pixel(x+2,y+2),right:pixel(right,y+2),bottomLeft:pixel(x,bottom),bottom:pixel(x+2,bottom),bottomRight:pixel(right,bottom)},hit:disposed?null:renderer.hitTest({x:x+2,y:y+2}),stack:disposed?[]:renderer.hitTestAll({x:x+2,y:y+2}),transparentStack:disposed?[]:renderer.hitTestAll({x,y:y+2}),
 scene:stringifySceneJSON(accepted),treeScene:stringifySceneJSON(tree.snapshot()),assets:registered,assetBytes:registered.Nine?.pixels??null,outlineBytes:registered.Outline?.pixels??null,pointerLog:[...pointerLog],oldLog:[...oldLog],contexts:contexts.map(c=>({lost:c.lost,calls:{...c.calls},error:c.gl.getError(),resources:Object.fromEntries(Object.entries(c.resources).map(([k,r])=>[k,{created:r.created,deleted:r.deleted,live:r.live()}]))}))};}
/** @param {ReturnType<typeof observe>} value @param {string} text */
function retentionKey(value,text){const{contexts:diagnostics,...state}=value;void diagnostics;return JSON.stringify({...state,document:text});}
/** @param {string} [message] */ function show(message='Ready'){status.textContent=message;output.textContent=JSON.stringify(observe(),null,2);}
function subscribe(){panel.onPointer('pointerdown',()=>pointerLog.push('Panel'));back.onPointer('pointerdown',()=>pointerLog.push('Back'));tree.stage.onPointer('pointerdown',()=>pointerLog.push('stage'));}
function bind(){const current=canvas;let removed=false;binds++;
 /** @param {PointerEvent} event */ const on=event=>{const rect=current.getBoundingClientRect();pointerEvents++;const point={x:(event.clientX-rect.left)*32/rect.width,y:(event.clientY-rect.top)*24/rect.height};tree.dispatchPointer({type:'pointerdown',pointerId:event.pointerId,point,hit:renderer.hitTest(point)});show('Dispatched pointerdown');};current.addEventListener('pointerdown',on);return()=>{if(!removed){removed=true;current.removeEventListener('pointerdown',on);unbinds++;}};}
/** @param {string} message */ function submit(message){active();const next=tree.snapshot();renderer.updateScene(next);accepted=next;renderer.render();show(message);}
function resize(){active();panel.setSize(9,7);submit('Resized panel');}
function edit(){active();panel.setSlice({left:1,right:0,top:1,bottom:1});panel.setSize(11,9);submit('Edited restored slice');}
/** @param {import('@barocss/canvas2d').DisplayTree} t */
function handles(t){const b=t.get('Back'),p=t.get('Panel');if(b?.kind!=='rect'||p?.kind!=='sprite')throw new Error('Document handles differ');return{back:b,panel:p};}
/** @param {import('@barocss/canvas2d').DisplayTree} t @param {ReturnType<typeof handles>} h @param {HTMLCanvasElement} fresh @param {import('@barocss/canvas2d').Canvas2DRenderer} nextRenderer @param {Map<string,import('@barocss/canvas2d').ImageAssetInput>} nextAssets @param {import('@barocss/canvas2d').Scene} nextScene */
function adopt(t,h,fresh,nextRenderer,nextAssets,nextScene){unbind();const old=renderer;canvas.replaceWith(fresh);canvas=fresh;renderer=nextRenderer;oldLog.push(...pointerLog);pointerLog=[];tree=t;back=h.back;panel=h.panel;hostAssets=nextAssets;accepted=nextScene;generation++;candidateAccepted++;subscribe();unbind=bind();old.dispose();}
/** @param {import('@barocss/canvas2d').ImageAssetInput} [input] @param {number} [radius] @param {import('@barocss/canvas2d').Color} [tint] */
function outline(input=source,radius=1,tint=color){active();const prepared=outlineImageAsset(input,radius,tint),t=createDisplayTreeFromScene(accepted),h=handles(t);h.panel.setPosition(4,4);h.panel.setSize(7,5);h.panel.setAnchor(0,0);h.panel.setSlice({left:1,right:1,top:1,bottom:1});h.panel.setImageSource('Outline',{x:0,y:0,width:prepared.width,height:prepared.height});const inputs=assets();if(!inputs.has('Nine'))inputs.set('Nine',image);inputs.set('Outline',prepared);const fresh=instrument(document.createElement('canvas'));fresh.id='scene';candidateAttempts++;
 /** @type {import('@barocss/canvas2d').Canvas2DRenderer|undefined} */ let candidate;const nextScene=t.snapshot();try{candidate=createCanvas2D(fresh,options);for(const[id,asset]of inputs)candidate.setImageAsset(id,asset);candidate.updateScene(nextScene);candidate.render();adopt(t,h,fresh,candidate,snapshotAssets(candidate,inputs.keys()),nextScene);}catch(error){candidate?.dispose();candidateRefused++;throw error;}outlinePreparations++;show('Prepared outline');return prepared;}
async function documentText(){return serializeCanvasDocument(accepted,id=>hostAssets.get(id)??null);}
/** @param {Blob} blob @param {string} name */ function download(blob,name){const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function save(){active();const text=await documentText();active();saves++;download(new Blob([text],{type:'application/json'}),'nine-slice-document.json');show(`Saved ${new TextEncoder().encode(text).length} bytes`);return text;}
/** @param {string} text */ async function openText(text){active();const fresh=instrument(document.createElement('canvas'));fresh.id='scene';candidateAttempts++;
 /** @type {import('@barocss/canvas2d/document').StagedCanvasDocument|undefined} */ let staged;try{staged=await stageCanvasDocument(text,fresh,options);if(disposed)throw new Error('consumer disposed');const t=createDisplayTreeFromScene(staged.scene),h=handles(t);if(!staged.renderer.getImageAsset('Nine'))staged.renderer.setImageAsset('Nine',image);adopt(t,h,fresh,staged.renderer,snapshotAssets(staged.renderer,new Set([...staged.assets.keys(),'Nine'])),/** @type {import('@barocss/canvas2d').Scene} */(staged.scene));}catch(error){staged?.renderer.dispose();candidateRefused++;throw error;}opens++;show('Opened current nine-slice Scene');}
function move(){active();panel.setPosition(8,0);edits++;submit('Moved restored Panel');}
async function png(){active();const text=await documentText();active();const result=await exportCanvasDocumentPNG(text,options,()=>instrument(document.createElement('canvas')));active();pngs++;download(result.blob,'nine-slice-outline.png');show('Exported PNG');return result;}
function dispose(){if(disposed)return;disposed=true;unbind();renderer.dispose();document.querySelectorAll('button').forEach(button=>{button.disabled=true;});openInput.disabled=true;show('Disposed');}
subscribe();unbind=bind();const actions={resize,edit,outline:()=>outline(),move,save,png,dispose};for(const[id,action]of Object.entries(actions))document.querySelector('#'+id)?.addEventListener('click',()=>{void Promise.resolve().then(async()=>{await action();}).catch(error=>show(`Action failed: ${error.code??'ERROR'}`));});
openInput.addEventListener('change',()=>{const file=openInput.files?.[0];if(!file)return;void file.text().then(openText).catch(error=>show(`Open failed: ${error.code??'ERROR'}`));openInput.value='';});
Object.assign(window,{__nineSliceConsumer:{observe,retentionKey,resize,edit,outline,move,save,openText,documentText,png,dispose,assets,source:()=>copyAsset(source),original:()=>copyAsset(image),contexts,get canvas(){return canvas;},get renderer(){return renderer;},get tree(){return tree;},get panel(){return panel;}}});show();

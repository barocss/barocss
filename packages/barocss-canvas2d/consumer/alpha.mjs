// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON, applyImageAlphaMatte } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument, exportCanvasDocumentPNG } from '@barocss/canvas2d/document';
import { verifyAlphaComposites } from './alpha-composites.mjs';

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
const options = { logicalSize: { width: 100, height: 80 }, dpr: 2 };
const pose = (/** @type {number} */ x, /** @type {number} */ y) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
/** @type {import('@barocss/canvas2d').ImageAssetInput} */
const image = { width: 1, height: 1, pixels: new Uint8Array([255, 0, 0, 255]) };
/** @type {import('@barocss/canvas2d').ImageAssetInput} */
const source = { width: 2, height: 2, pixels: new Uint8Array([255,0,0,255,0,255,0,128,7,8,9,0,255,255,0,64]) };
/** @type {import('@barocss/canvas2d').ImageAssetInput} */
const matteImage = { width: 2, height: 2, pixels: new Uint8Array([11,22,33,128,200,100,50,0,1,2,3,255,77,88,99,128]) };
/** @param {import('@barocss/canvas2d').ImageAssetInput} value @returns {import('@barocss/canvas2d').ImageAssetInput} */
function copyAsset(value) { return { width: value.width, height: value.height, pixels: new Uint8Array(value.pixels) }; }
/** @param {import('@barocss/canvas2d').Canvas2DRenderer} r @param {Iterable<string>} ids @returns {Map<string,import('@barocss/canvas2d').ImageAssetInput>} */
function snapshotAssets(r, ids) { const result = new Map(); for (const id of ids) { const asset = r.getImageAsset(id); if (asset) result.set(id, asset); } return result; }
let tree = createDisplayTree('AlphaConsumer');
let back = tree.createRect({ id: 'Back', layer: 0, transform: pose(10, 10), width: 80, height: 60, fill: [0.25,0.25,0.25,1] });
let parent = tree.createContainer({ id: 'Parent', layer: 1, transform: pose(0, 0) });
let frame = tree.createFrame({ id: 'Frame', layer: 0, transform: pose(20, 20), width: 50, height: 40, fill: [0,0,1,1], clip: true });
let sprite = tree.createSprite({ id: 'Sprite', layer: 1, transform: pose(0, 0), imageId: 'Atlas', width: 20, height: 20, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 });
let vector = tree.createRect({ id: 'Vector', layer: 2, transform: pose(25, 0), width: 15, height: 20, fill: [0,1,0,1] });
tree.stage.addChild(back); tree.stage.addChild(parent); parent.addChild(frame); frame.addChild(sprite); frame.addChild(vector);
/** @type {HTMLCanvasElement} */ let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(instrument(canvas), options); renderer.setImageAsset('Atlas', image);
let hostAssets = snapshotAssets(renderer, ['Atlas']);
/** @type {import('@barocss/canvas2d').Scene} */ let accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render();
let generation = 1, disposed = false, mattePreparations = 0, opens = 0, edits = 0, saves = 0, pngs = 0;
let binds = 0, unbinds = 0, pointerEvents = 0, candidateAttempts = 0, candidateAccepted = 0, candidateRefused = 0;
/** @type {string[]} */ let pointerLog = [];
/** @type {() => void} */ let unbind = () => {};
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
function active() { if (disposed) throw new Error('consumer disposed'); }
/** @returns {Map<string,import('@barocss/canvas2d').ImageAssetInput>} */
function assets() { return new Map([...hostAssets].map(([id, asset]) => [id, copyAsset(asset)])); }
/** @param {number} x @param {number} y */
function pixel(x, y) { const gl = canvas.getContext('webgl2'); if (!gl) throw new Error('WebGL2 context missing'); const bytes = new Uint8Array(4); gl.readPixels(x*2, canvas.height-y*2-1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes); return [...bytes]; }
/** @param {number} x @param {number} y */
function sample(x, y) { return { rgba: pixel(x,y), hit: renderer.hitTest({x,y})?.id ?? null }; }
function observe() { const registered = Object.fromEntries([...hostAssets].map(([id, asset]) => [id, { width: asset.width, height: asset.height, pixels: [...asset.pixels] }])); return { generation, disposed, mattePreparations, opens, edits, saves, pngs, binds, unbinds, pointerEvents,
 candidates: { attempted: candidateAttempts, accepted: candidateAccepted, refused: candidateRefused }, sceneVersion: accepted.version, contextId: accepted.contextId,
 parentAlpha: parent.data.alpha, frameAlpha: frame.data.alpha, spriteAlpha: sprite.data.alpha, spriteOpacity: sprite.data.opacity,
 imageId: sprite.data.imageId, sourceRect: sprite.data.sourceRect ?? null, spriteData: sprite.data, frameData: frame.data, vectorData: vector.data,
 scene: stringifySceneJSON(accepted), treeScene: stringifySceneJSON(tree.snapshot()), assets: registered, assetBytes: registered.Atlas?.pixels ?? null, mattedBytes: registered.Matted?.pixels ?? null,
 spritePoint: disposed ? null : sample(30,30), vectorPoint: disposed ? null : sample(50,30), framePoint: disposed ? null : sample(65,55), backPoint: disposed ? null : sample(15,15), pointerLog: [...pointerLog],
 contexts: contexts.map(c => ({ lost:c.lost, calls:{...c.calls}, error:c.gl.getError(), resources:Object.fromEntries(Object.entries(c.resources).map(([k,r])=>[k,{created:r.created,deleted:r.deleted,live:r.live()}])) })) }; }
/** @param {ReturnType<typeof observe>} value @param {string} text */
function retentionKey(value,text) { const { contexts: diagnostics, ...state } = value; void diagnostics; return JSON.stringify({...state,document:text}); }
/** @param {string} message */ function show(message) { status.textContent=message; output.textContent=JSON.stringify(observe(),null,2); }
function subscribe() { sprite.onPointer('pointerdown',()=>pointerLog.push('Sprite')); vector.onPointer('pointerdown',()=>pointerLog.push('Vector')); back.onPointer('pointerdown',()=>pointerLog.push('Back')); frame.onPointer('pointerdown',()=>pointerLog.push('Frame')); parent.onPointer('pointerdown',()=>pointerLog.push('Parent')); tree.stage.onPointer('pointerdown',()=>pointerLog.push('stage')); }
function bind() { const current=canvas; let removed=false; binds++;
 /** @param {PointerEvent} event */ const on=event=>{const bounds=current.getBoundingClientRect();pointerEvents++;const point={x:(event.clientX-bounds.left)*100/bounds.width,y:(event.clientY-bounds.top)*80/bounds.height};tree.dispatchPointer({type:'pointerdown',pointerId:event.pointerId,point,hit:renderer.hitTest(point)});show('Dispatched pointerdown');};current.addEventListener('pointerdown',on);return()=>{if(!removed){removed=true;current.removeEventListener('pointerdown',on);unbinds++;}}; }
/** @param {string} message */ function submit(message) { active();const next=tree.snapshot();renderer.updateScene(next);accepted=next;renderer.render();show(message); }
/** @param {number} alpha */ function setParentAlpha(alpha) { active();parent.setAlpha(alpha);submit(`Parent alpha ${alpha}`); }
/** @param {number} alpha */ function setSpriteAlpha(alpha) { active();sprite.setAlpha(alpha);submit(`Sprite alpha ${alpha}`); }
async function invalid() { active();const before=retentionKey(observe(),await documentText());let code='ACCEPTED';try{parent.setAlpha(-0);}catch(error){code=/** @type {import('@barocss/canvas2d').Canvas2DError} */(error).code;}const retained=retentionKey(observe(),await documentText())===before;show(`Rejected ${code}; retained ${retained}`);return code; }
async function invalidZeroAsset() { active();const before=retentionKey(observe(),await documentText()),next=structuredClone(tree.snapshot()),container=next.nodes.find(node=>node.id==='Parent');if(container?.kind!=='group')throw new Error('Parent is missing');const frameNode=container.children.find(node=>node.id==='Frame');if(frameNode?.kind!=='frame')throw new Error('Frame is missing');const imageNode=frameNode.children.find(node=>node.id==='Sprite');if(imageNode?.kind!=='image')throw new Error('Sprite is missing');container.alpha=0;imageNode.imageId='Missing';let missingCode='ACCEPTED';try{renderer.updateScene(next);}catch(error){missingCode=/** @type {import('@barocss/canvas2d').Canvas2DError} */(error).code;}imageNode.imageId='Atlas';imageNode.sourceRect={x:1,y:0,width:1,height:1};let cropCode='ACCEPTED';try{renderer.updateScene(next);}catch(error){cropCode=/** @type {import('@barocss/canvas2d').Canvas2DError} */(error).code;}const retained=retentionKey(observe(),await documentText())===before;show(`Zero-alpha asset ${missingCode}; crop ${cropCode}; retained ${retained}`);return{missingCode,cropCode,retained}; }
/** @param {import('@barocss/canvas2d').DisplayTree} t */
function handles(t) { const b=t.get('Back'),p=t.get('Parent'),f=t.get('Frame'),s=t.get('Sprite'),v=t.get('Vector');if(b?.kind!=='rect'||p?.kind!=='container'||f?.kind!=='frame'||s?.kind!=='sprite'||v?.kind!=='rect')throw new Error('Document display objects differ');return{back:b,parent:p,frame:f,sprite:s,vector:v}; }
/** @param {import('@barocss/canvas2d').DisplayTree} t @param {ReturnType<typeof handles>} h @param {HTMLCanvasElement} fresh @param {import('@barocss/canvas2d').Canvas2DRenderer} nextRenderer @param {Map<string,import('@barocss/canvas2d').ImageAssetInput>} nextAssets @param {import('@barocss/canvas2d').Scene} nextScene */
function adopt(t,h,fresh,nextRenderer,nextAssets,nextScene) { unbind();const old=renderer;canvas.replaceWith(fresh);canvas=fresh;renderer=nextRenderer;tree=t;back=h.back;parent=h.parent;frame=h.frame;sprite=h.sprite;vector=h.vector;hostAssets=nextAssets;accepted=nextScene;generation++;candidateAccepted++;pointerLog=[];subscribe();unbind=bind();old.dispose(); }
/** @param {import('@barocss/canvas2d').ImageAssetInput} [input] @param {import('@barocss/canvas2d').ImageAssetInput} [matte] */
function applyMatte(input=source,matte=matteImage) { active();const prepared=applyImageAlphaMatte(input,matte),t=createDisplayTreeFromScene(accepted),h=handles(t);h.parent.setAlpha(1);h.frame.setAlpha(1);h.sprite.setAlpha(1);h.sprite.setOpacity(1);h.sprite.setTint([1,1,1]);h.sprite.setBlendMode('normal');h.sprite.setRGBMatrix(null);h.sprite.setAlphaMask(null);h.sprite.setImageSource('Matted',{x:0,y:0,width:prepared.width,height:prepared.height});const inputs=assets();if(!inputs.has('Atlas'))inputs.set('Atlas',image);inputs.set('Matted',prepared);const fresh=instrument(document.createElement('canvas'));fresh.id='scene';candidateAttempts++;
 /** @type {import('@barocss/canvas2d').Canvas2DRenderer|undefined} */ let candidate;const nextScene=t.snapshot();try{candidate=createCanvas2D(fresh,options);for(const[id,asset]of inputs)candidate.setImageAsset(id,asset);candidate.updateScene(nextScene);candidate.render();const nextAssets=snapshotAssets(candidate,inputs.keys());adopt(t,h,fresh,candidate,nextAssets,nextScene);}catch(error){candidate?.dispose();candidateRefused++;throw error;}mattePreparations++;show('Prepared alpha matte');return prepared; }
async function documentText() { return serializeCanvasDocument(accepted,id=>hostAssets.get(id)??null); }
/** @param {Blob} blob @param {string} name */ function download(blob,name) { const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
async function save() { active();const text=await documentText();active();saves++;download(new Blob([text],{type:'application/json'}),'alpha-document.json');show(`Saved ${new TextEncoder().encode(text).length} bytes`);return text; }
/** @param {string} text */ async function openText(text) { active();const fresh=instrument(document.createElement('canvas'));fresh.id='scene';candidateAttempts++;
 /** @type {import('@barocss/canvas2d/document').StagedCanvasDocument|undefined} */ let staged;try{staged=await stageCanvasDocument(text,fresh,options);if(disposed)throw new Error('consumer disposed');const t=createDisplayTreeFromScene(staged.scene),h=handles(t);if(!staged.renderer.getImageAsset('Atlas'))staged.renderer.setImageAsset('Atlas',image);adopt(t,h,fresh,staged.renderer,snapshotAssets(staged.renderer,new Set([...staged.assets.keys(),'Atlas'])),/** @type {import('@barocss/canvas2d').Scene} */(staged.scene));}catch(error){staged?.renderer.dispose();candidateRefused++;throw error;}opens++;show('Opened current alpha Scene'); }
function edit() { active();sprite.setPosition(8,0);edits++;submit('Moved restored Sprite within Frame'); }
async function png() { active();const text=await documentText();active();const result=await exportCanvasDocumentPNG(text,options,()=>instrument(document.createElement('canvas')));active();pngs++;download(result.blob,'alpha-matte.png');show('Exported PNG');return result; }
function dispose() { if(disposed)return;disposed=true;unbind();renderer.dispose();document.querySelectorAll('button').forEach(button=>{button.disabled=true;});openInput.disabled=true;show('Disposed'); }
subscribe();unbind=bind();
const actions={half:()=>setParentAlpha(0.5),zero:()=>setParentAlpha(0),full:()=>setParentAlpha(1),'sprite-half':()=>setSpriteAlpha(0.5),invalid,'invalid-asset':invalidZeroAsset,matte:()=>applyMatte(),edit,save,png,dispose};
for(const[id,action]of Object.entries(actions))document.querySelector('#'+id)?.addEventListener('click',()=>{void Promise.resolve().then(async()=>{await action();}).catch(error=>show(`Action failed: ${error.code??'ERROR'}`));});
openInput.addEventListener('change',()=>{const file=openInput.files?.[0];if(!file)return;void file.text().then(openText).catch(error=>show(`Open failed: ${error.code??'ERROR'}`));openInput.value='';});
Object.assign(window,{__alphaConsumer:{observe,retentionKey,setParentAlpha,setSpriteAlpha,verifyAlphaComposites,invalid,invalidZeroAsset,applyMatte,save,openText,documentText,edit,png,dispose,assets,source:()=>copyAsset(source),matte:()=>copyAsset(matteImage),original:()=>copyAsset(image),contexts,get canvas(){return canvas;},get tree(){return tree;},get sprite(){return sprite;},get renderer(){return renderer;}}});
show('Ready with full alpha');

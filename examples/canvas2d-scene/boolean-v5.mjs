// @ts-check
export const left = { contours: [
  { id: 'LeftOuter', points: [
    { x: 20, y: 20 }, { x: 180, y: 20 }, { x: 180, y: 80 },
    { x: 120, y: 80 }, { x: 120, y: 180 }, { x: 20, y: 180 },
  ] },
  { id: 'LeftHole', points: [
    { x: 40, y: 100 }, { x: 40, y: 140 }, { x: 80, y: 140 }, { x: 80, y: 100 },
  ] },
] };

export const right = { contours: [
  { id: 'RightOuter', points: [
    { x: 90, y: 50 }, { x: 220, y: 50 }, { x: 220, y: 150 },
    { x: 170, y: 150 }, { x: 170, y: 200 }, { x: 90, y: 200 },
  ] },
] };

/** @param {import('../../packages/barocss-canvas2d/src/index.js').PolygonBooleanResult} result */
export function sceneFromResult(result) {
  return { version: 5, unit: 'logical-px', contextId: 'BooleanBoard', nodes: [
    { kind: 'rect', id: 'Background', layer: 0,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      width: 260, height: 240, fill: [1, 1, 1, 1] },
    ...(result.contours.length ? [{ kind: 'path', id: 'BooleanFill', layer: 1,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      commands: result.contours.flatMap(contour => [
        { kind: 'M', ...contour.points[0] },
        ...contour.points.slice(1).map(point => ({ kind: 'L', ...point })),
        { kind: 'Z' },
      ]), fill: { color: [0.12, 0.46, 0.84, 1], rule: 'nonzero' } }] : []),
  ] };
}

/** Separate example profile; the original orthogonal result file remains unchanged. */
export async function startConvexConsumer() {
  const api = await import('../../packages/barocss-canvas2d/dist/index.js');
  const { serializeCanvasDocument, stageCanvasDocument } = await import('../../packages/barocss-canvas2d/dist/document.js');
  /** @typedef {import('../../packages/barocss-canvas2d/dist/index.js').DisplayTree} Tree */
  /** @typedef {import('../../packages/barocss-canvas2d/dist/index.js').PolygonContour} Contour */
  /** @typedef {{canvas:HTMLCanvasElement,tree:Tree,renderer:import('../../packages/barocss-canvas2d/dist/index.js').Canvas2DRenderer,gl:WebGL2RenderingContext,disposed:boolean,unbind:()=>void,frame:number[]|null}} Session */
  /** @template {Element} T @param {string} selector @returns {T} */
  function el(selector) { const element = document.querySelector(selector); if (!element) throw Error('Missing '+selector); return /** @type {T} */(element); }
  const size = { width:260,height:240 }, options = {logicalSize:size,dpr:2};
  const transform = {x:0,y:0,scaleX:1,scaleY:1,rotation:0};
  const LEFT = {id:'LeftOperand',points:[{x:40,y:80},{x:80,y:40},{x:120,y:80},{x:80,y:120}]};
  const RIGHT = {id:'RightOperand',points:[{x:65,y:51},{x:155,y:57},{x:65,y:141}]};
  /** @param {Contour} contour */
  const commands = contour => api.createPathBuilder().polygon(contour.points).build();
  /** @param {Tree} tree @param {string} id @returns {Contour} */
  function operand(tree,id) { const found=tree.get(id);if(found?.kind!=='path')throw Error('Missing operand');
    const data=found.data.commands; if(data[0]?.kind!=='M'||data.at(-1)?.kind!=='Z'||data.slice(1,-1).some(c=>c.kind!=='L'))throw Error('Operand must retain polygon commands');
    return {id,points:data.slice(0,-1).map(c=>{if(c.kind!=='M'&&c.kind!=='L')throw Error('Polygon command');return{x:c.x,y:c.y};})}; }
  const initial=api.createDisplayTree('ConvexBoard');
  initial.stage.addChild(initial.createRect({id:'Background',layer:0,transform,width:260,height:240,fill:[1,1,1,1]}));
  for(const [contour,layer,color] of /** @type {[Contour,number,import('../../packages/barocss-canvas2d/dist/index.js').Color][]} */([[LEFT,1,[1,0,0,1]],[RIGHT,2,[1,165/255,0,1]]])) {
    initial.stage.addChild(initial.createPath({id:contour.id,layer,transform,commands:commands(contour),stroke:{width:1,color}}));
  }
  initial.stage.addChild(initial.createRect({id:'Marker',layer:4,transform:{...transform,x:180,y:80},width:20,height:20,fill:[0,1,0,1]}));
  let disposed=false,computes=0,recomputes=0,saves=0,opens=0,helperCalls=0;
  /** @type {string|null} */ let failure=null;
  /** @type {Session} */ let current;
  /** @type {Session[]} */ const sessions=[];
  /** @type {{name:string,point:{x:number,y:number},hit:string|null,trusted:boolean}[]} */ const pointers=[];
  /** @type {(()=>void)[]} */ const subscriptions=[];
  const urls=new Set();
  let binds=0,unbinds=0;
  /** @type {import('../../packages/barocss-canvas2d/dist/index.js').PolygonBooleanResult|null} */ let result=null;
  /** @type {string|null} */ let savedText=null;
  /** @type {any} */ let refusal=null;
  /** @type {Contour|null} */ let draft=null;
  const active=()=>{if(disposed)throw Error('Consumer disposed');};
  /** @param {Session} session */
  function frame(session) {if(session.disposed)return [...(session.frame??[])];const p=new Uint8Array(520*480*4);session.gl.readPixels(0,0,520,480,session.gl.RGBA,session.gl.UNSIGNED_BYTE,p);return [...p];}
  /** @param {Session} session */
  function close(session) {if(session.disposed)return;session.frame=frame(session);session.unbind();session.renderer.dispose();session.disposed=true;}
  /** @param {HTMLCanvasElement} canvas @param {Tree} tree @param {string} name @param {import('../../packages/barocss-canvas2d/dist/index.js').Canvas2DRenderer|null} [prepared] */
  function admit(canvas,tree,name,prepared=null) {let renderer=prepared;
    try {renderer??=api.createCanvas2D(canvas,options);renderer.updateScene(tree.snapshot());renderer.render();}
    catch(error){renderer?.dispose();throw error;}
    canvas.id='convex-'+(sessions.length+1);const gl=canvas.getContext('webgl2');if(!gl){renderer.dispose();throw Error('WebGL2 unavailable');}
    /** @type {Session} */ const session={canvas,tree,renderer,gl,disposed:false,unbind:()=>{},frame:null};
    /** @param {PointerEvent} event */
    const pointer=event=>{if(disposed||session.disposed)return;const rect=canvas.getBoundingClientRect(),point={x:(event.clientX-rect.left)*260/rect.width,y:(event.clientY-rect.top)*240/rect.height},hit=renderer.hitTest(point);tree.dispatchPointer({type:'pointerdown',pointerId:event.pointerId,point,hit});pointers.push({name,point,hit:hit?.id??null,trusted:event.isTrusted});show('Pointer dispatched');};
    canvas.addEventListener('pointerdown',pointer);binds++;let removed=false;session.unbind=()=>{if(removed)return;removed=true;canvas.removeEventListener('pointerdown',pointer);unbinds++;};sessions.push(session);return session; }
  /** @param {Session} next */
  function swap(next) {const prior=current;el('#surface').replaceChildren(next.canvas);current=next;if(prior)close(prior);}
  /** @param {Tree} tree @param {import('../../packages/barocss-canvas2d/dist/index.js').PolygonBooleanResult} record */
  function installResult(tree,record) {const prior=tree.get('ResultContour1');if(prior?.kind==='path'&&record.contours.length){prior.setPath({commands:commands(record.contours[0]),fill:{rule:'nonzero',color:[0,128/255,1,1]}});return;}if(prior)tree.stage.removeChild(prior);
    if(record.contours.length)tree.stage.addChild(tree.createPath({id:'ResultContour1',layer:3,transform,commands:commands(record.contours[0]),fill:{rule:'nonzero',color:[0,128/255,1,1]}})); }
  function compute() {active();const tree=api.createDisplayTreeFromScene(current.tree.snapshot());helperCalls++;
    const next=api.intersectConvexPolygons(operand(tree,'LeftOperand'),operand(tree,'RightOperand'));installResult(tree,next);
    const session=admit(document.createElement('canvas'),tree,'calculated');swap(session);result=next;computes++;show('Convex intersection calculated'); }
  function editRestored() {active();if(opens!==1)throw Error('Open the document first');const tree=api.createDisplayTreeFromScene(current.tree.snapshot()),right=operand(tree,'RightOperand');right.points[0].x=72;right.points[2].x=72;
    const path=tree.get('RightOperand');if(path?.kind!=='path')throw Error('Missing right path');path.setPath({commands:commands(right),stroke:path.data.stroke});helperCalls++;
    const next=api.intersectConvexPolygons(operand(tree,'LeftOperand'),right);installResult(tree,next);const session=admit(document.createElement('canvas'),tree,'recomputed');swap(session);result=next;recomputes++;show('Restored operand edited and recalculated'); }
  function refuse() {active();const before={tree:current.tree,renderer:current.renderer,canvas:current.canvas,scene:api.stringifySceneJSON(current.tree.snapshot()),frame:frame(current)};
    draft={id:'RightOperand',points:[{x:80,y:40},{x:155,y:57},{x:65,y:141}]};helperCalls++;let error;
    try{api.intersectConvexPolygons(operand(current.tree,'LeftOperand'),draft);}catch(e){error=e;}
    if(!(error instanceof api.Canvas2DError)||error.code!=='UNSUPPORTED_FEATURE')throw Error('Contact not refused');
    const frameAfter=frame(current);
    refusal={code:error.code,message:error.message,canonicalRetained:before.scene===api.stringifySceneJSON(current.tree.snapshot()),identitiesRetained:before.tree===current.tree&&before.renderer===current.renderer&&before.canvas===current.canvas,fullFrameBytes:before.frame.length,fullFrameEqual:before.frame.every((v,i)=>v===frameAfter[i]),draftRetained:true};
    show('Touching input refused; accepted result retained');return refusal;
  }
  function observe(){return{ready:!disposed,disposed,computes,recomputes,saves,opens,helperCalls,result,savedText,refusal,draft,failure,scene:current.tree.snapshot(),canonical:api.stringifySceneJSON(current.tree.snapshot()),pointers:[...pointers],binds,unbinds,activeRenderers:sessions.filter(s=>!s.disposed).length,contexts:sessions.map(s=>({disposed:s.disposed,canvasId:s.canvas.id})),activeURLs:urls.size};}
  /** @param {string} message */
  function show(message){el('#status').textContent=message;const o=observe();el('#lineage').textContent=JSON.stringify({...o,savedText:savedText?.length,scene:'Retained Scene29'},null,2);}
  async function save(){active();const text=await serializeCanvasDocument(current.tree.snapshot(),()=>null);active();savedText=text;saves++;
    const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));urls.add(url);const anchor=document.createElement('a');anchor.href=url;anchor.download='convex-document.json';anchor.click();URL.revokeObjectURL(url);urls.delete(url);show('Scene29 document saved');return text;}
  /** @param {string} text */
  async function openText(text){active();const canvas=document.createElement('canvas'),staged=await stageCanvasDocument(text,canvas,options);
    if(disposed){staged.renderer.dispose();throw Error('Consumer disposed');}
    try{const tree=api.createDisplayTreeFromScene(staged.scene);operand(tree,'LeftOperand');operand(tree,'RightOperand');const next=admit(canvas,tree,'opened',staged.renderer);swap(next);}
    catch(error){staged.renderer.dispose();throw error;}
    opens++;result=null;show('Fresh original Scene29 document opened; no intersection helper');}
  function dispose(){if(disposed)return;close(current);disposed=true;for(const remove of subscriptions)remove();for(const url of urls)URL.revokeObjectURL(url);urls.clear();for(const button of document.querySelectorAll('button,input'))/** @type {HTMLButtonElement} */(button).disabled=true;document.documentElement.dataset.convexReady='disposed';show('Disposed');}
  /** @param {EventTarget} target @param {string} type @param {EventListener} handler */
  function listen(target,type,handler){target.addEventListener(type,handler);subscriptions.push(()=>target.removeEventListener(type,handler));}
  /** @param {()=>unknown} action */
  const wrap=action=>()=>{void Promise.resolve().then(async()=>{await action();}).catch(error=>{failure=String(error);show('Operation refused');});};
  current=admit(/** @type {HTMLCanvasElement} */(el('#surface canvas')),initial,'initial');
  el('#union').setAttribute('hidden','');el('#difference').setAttribute('hidden','');el('h1').textContent='Convex polygon intersection';el('body > p').textContent='Original diagonal polygons and their copied intersection. Open Scene29 JSON for further editing.';
  el('#intersection').textContent='Compute intersection';el('#save').textContent='Save Scene29 JSON';el('#touching').textContent='Refuse touching input';
  for(const id of ['#open-button','#edit-restored','#dispose'])el(id).removeAttribute('hidden');
  const input=/** @type {HTMLInputElement} */(el('#open'));input.parentElement?.setAttribute('hidden','');
  listen(el('#intersection'),'click',wrap(compute));listen(el('#touching'),'click',wrap(refuse));listen(el('#save'),'click',wrap(save));listen(el('#edit-restored'),'click',wrap(editRestored));listen(el('#dispose'),'click',dispose);listen(el('#open-button'),'click',()=>input.click());
  listen(input,'change',wrap(async()=>{const file=input.files?.[0];input.value='';if(file)await openText(await file.text());}));listen(window,'pagehide',dispose);
  Object.assign(window,{__convexConsumer:{observe,compute,refuse,save,openText,editRestored,dispose,frame,get current(){return current;}}});document.documentElement.dataset.convexReady='ready';show('Original operands ready');
}

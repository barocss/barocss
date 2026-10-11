// @ts-check
import { Canvas2DError, createCanvas2D, createDisplayTree, createDisplayTreeFromScene,
  importSVGArcElement, stringifySceneJSON } from '../dist/index.js';
import { serializeCanvasDocument, stageCanvasDocument } from '../dist/document.js';

/** @typedef {import('../src/index.js').DisplayTree} Tree */
/** @typedef {import('../src/index.js').SceneV5} SourceScene */
/** @typedef {import('../src/index.js').SceneV29} CurrentScene */
/** @typedef {Pick<import('../src/index.js').Canvas2DRenderer,'updateScene'|'render'|'dispose'|'hitTest'|'getImageAsset'>} Renderer */
/** @typedef {{canvas:HTMLCanvasElement,renderer:Renderer,tree:Tree,source:SourceScene|null,diagnostics:unknown,sourceText:string|null,closed:boolean,bound:boolean,subscribed:boolean,unbind:()=>void,unsubscribe:()=>void}} Session */
const options={logicalSize:{width:600,height:300},dpr:2};
const pose={x:0,y:0,scaleX:1,scaleY:1,rotation:0};
const clone=/** @template T @param {T} value @returns {T} */value=>JSON.parse(JSON.stringify(value));
/** @param {string} message @returns {never} */const invalid=message=>{throw new Canvas2DError('INVALID_SCENE',message);};

/** Explicit consumer construction, not a Scene version rewrite. @param {SourceScene} source @returns {Tree} */
export function createArcDisplayTree(source){
 if(source.version!==5)invalid('Arc bridge requires imported Scene5');
 const tree=createDisplayTree(source.contextId);
 /** @param {import('../src/index.js').StageHandle|import('../src/index.js').ContainerHandle|import('../src/index.js').FrameHandle} parent @param {SourceScene['nodes']} nodes */
 function attach(parent,nodes){for(const node of nodes){
  if(node.kind==='group'){const h=tree.createContainer({id:node.id,layer:node.layer,transform:clone(node.transform)});parent.addChild(h);attach(h,node.children);}
  else if(node.kind==='frame'){const h=tree.createFrame({id:node.id,layer:node.layer,transform:clone(node.transform),width:node.width,height:node.height,fill:clone(node.fill),clip:node.clip});parent.addChild(h);attach(h,node.children);}
  else if(node.kind==='path'){parent.addChild(tree.createPath({id:node.id,layer:node.layer,transform:clone(node.transform),commands:clone(node.commands),...(node.fill?{fill:clone(node.fill)}:{}),...(node.stroke?{stroke:clone(node.stroke)}:{})}));}
  else invalid('Arc bridge refuses other node kinds');
 }}
 attach(tree.stage,source.nodes);return tree;
}

/** @param {string} selector */const element=selector=>{const value=document.querySelector(selector);if(!value)throw Error('Missing '+selector);return value;};
document.title='Editable SVG endpoint arcs';element('h1').textContent='Import and edit SVG elliptical edges';element('p').textContent='Import a bounded SVG, edit its approximate cubic controls, and save an editable document.';
element('section').innerHTML='<label>Import SVG <input id="open-svg" type="file" accept="image/svg+xml,.svg"></label><button id="arc-edit">Edit curve</button><button id="arc-refuse">Check refused drafts</button><button id="arc-save">Save document</button><button id="arc-open-button">Open document</button><input id="arc-open" type="file" accept="application/json,.json" hidden><button id="arc-dispose">Dispose</button>';
const controlPanel=document.createElement('section');controlPanel.setAttribute('aria-label','Cubic control editor');
controlPanel.innerHTML='<label>Cubic command <select id="arc-command"></select></label><label>Control <select id="arc-control"><option value="C1">C1</option><option value="C2">C2</option></select></label><label>X <input id="arc-control-x" type="number" step="any" min="-1000000" max="1000000"></label><label>Y <input id="arc-control-y" type="number" step="any" min="-1000000" max="1000000"></label><button id="arc-control-apply">Apply control</button>';
element('section').after(controlPanel);
const commandInput=/** @type {HTMLSelectElement} */(element('#arc-command')),controlInput=/** @type {HTMLSelectElement} */(element('#arc-control'));
const controlX=/** @type {HTMLInputElement} */(element('#arc-control-x')),controlY=/** @type {HTMLInputElement} */(element('#arc-control-y')),controlApply=/** @type {HTMLButtonElement} */(element('#arc-control-apply'));
const input=/** @type {HTMLInputElement} */(element('#open-svg')),openInput=/** @type {HTMLInputElement} */(element('#arc-open')),status=/** @type {HTMLElement} */(element('#status'));
const output=document.createElement('pre');output.id='arc-observation';document.body.append(output);
let disposed=false,busy=false,generation=0,request=0;
const counts={imports:0,svgUploads:0,jsonUploads:0,edits:0,saves:0,opens:0,candidates:0,accepted:0,disposes:0,binds:0,unbinds:0,subscriptions:0,subscriptionsRemoved:0};
/** @type {Session[]} */const sessions=[];
/** @type {{point:{x:number,y:number},hit:string|null,trusted:boolean}[]} */const pointers=[];
/** @type {string[]} */const routes=[];
/** @type {unknown[]} */const refusals=[];
/** @type {{code:string,message:string}|null} */let failure=null;
/** @type {ReturnType<typeof readObservation>|null} */let terminal=null;
/** @type {Array<()=>void>} */const controls=[];
/** @type {Session} */let accepted;
/** @param {Tree} tree @param {SourceScene|null} source @param {unknown} diagnostics @param {string|null} sourceText @returns {Session} */
function candidate(tree,source=null,diagnostics=null,sourceText=null){
 const canvas=document.createElement('canvas');canvas.id='live';canvas.setAttribute('aria-label','Editable normalized SVG arc Scene');counts.candidates++;
 const renderer=createCanvas2D(canvas,options);
 try{renderer.updateScene(tree.snapshot());renderer.render();return{canvas,renderer,tree,source:source?clone(source):null,diagnostics:clone(diagnostics),sourceText,closed:false,bound:false,subscribed:false,unbind:()=>{},unsubscribe:()=>{}};}
 catch(error){renderer.dispose();counts.disposes++;throw error;}
}
/** @param {Session} session */function bind(session){
 const callback=(/** @type {PointerEvent} */event)=>{if(disposed||session!==accepted)return;const r=session.canvas.getBoundingClientRect(),point={x:(event.clientX-r.left)*600/r.width,y:(event.clientY-r.top)*300/r.height},hit=session.renderer.hitTest(point);session.tree.dispatchPointer({type:'pointerdown',pointerId:event.pointerId,point,hit});pointers.push({point,hit:hit?.id??null,trusted:event.isTrusted});show('Pointer routed');};
 session.canvas.addEventListener('pointerdown',callback);session.bound=true;counts.binds++;session.unbind=()=>{if(!session.bound)return;session.bound=false;session.canvas.removeEventListener('pointerdown',callback);counts.unbinds++;};
 const off=session.tree.stage.onPointer('pointerdown',event=>routes.push('stage:'+event.target?.id));session.subscribed=true;counts.subscriptions++;session.unsubscribe=()=>{if(!session.subscribed)return;session.subscribed=false;off();counts.subscriptionsRemoved++;};
}
/** @param {Session} session */function release(session){if(session.closed)return;session.closed=true;try{session.unbind();}finally{try{session.unsubscribe();}finally{session.renderer.dispose();counts.disposes++;}}}
/** @param {Session} session */function adopt(session){const old=accepted;let transferred=false;
 try{active();bind(session);if(old)old.canvas.replaceWith(session.canvas);else element('#live').replaceWith(session.canvas);
  accepted=session;sessions.push(session);generation++;counts.accepted++;transferred=true;syncControlFields(true);
 }catch(error){if(!transferred)release(session);throw error;}
 if(old)release(old);
}
function active(){if(disposed)throw new Canvas2DError('INVALID_SCENE','consumer disposed');}
function disableControlInputs(){const disabled=disposed||busy||counts.edits>=2||!commandInput.options.length;for(const input of [commandInput,controlInput,controlX,controlY,controlApply])input.disabled=disabled;}
/** @param {boolean} [repopulate] */function syncControlFields(repopulate=false){
 const path=accepted.tree.get('ArcPath'),commands=path?.kind==='path'?path.data.commands:[];
 if(repopulate){const prior=commandInput.value;commandInput.replaceChildren();commands.forEach((command,index)=>{if(command.kind==='C'){const option=document.createElement('option');option.value=String(index);option.textContent='C at index '+index;commandInput.add(option);}});if([...commandInput.options].some(option=>option.value===prior))commandInput.value=prior;}
 const command=commands[Number(commandInput.value)];
 if(command?.kind==='C'&&commandInput.value!==''&&(controlInput.value==='C1'||controlInput.value==='C2')){const first=controlInput.value==='C1';controlX.value=String(first?command.c1x:command.c2x);controlY.value=String(first?command.c1y:command.c2y);}else{controlX.value='';controlY.value='';}
 disableControlInputs();
}
/** @param {CurrentScene} scene @param {number} commandIndex @param {'C1'|'C2'} control @param {import('../src/index.js').Point} point @returns {Tree} */
export function createArcControlCandidate(scene,commandIndex,control,point){
 if(!Number.isInteger(commandIndex)||commandIndex<0||(control!=='C1'&&control!=='C2')||![point.x,point.y].every(value=>Number.isFinite(value)&&Math.abs(value)<=1000000))invalid('Invalid cubic control target or coordinates');
 const tree=createDisplayTreeFromScene(scene),path=tree.get('ArcPath');if(path?.kind!=='path')invalid('ArcPath missing');
 const data=path.data,commands=clone(data.commands),command=commands[commandIndex];if(command?.kind!=='C')invalid('Selected command is not cubic');
 if(control==='C1'){command.c1x=point.x;command.c1y=point.y;}else{command.c2x=point.x;command.c2y=point.y;}
 path.setPath({commands,fill:data.fill,stroke:data.stroke});return tree;
}
function editSelectedControl(){
 active();if(counts.edits>=2)invalid('Only two fixed control edits');
 const commandIndex=Number(commandInput.value),control=controlInput.value;
 if(commandInput.value.trim()===''||controlX.value.trim()===''||controlY.value.trim()===''||(control!=='C1'&&control!=='C2'))invalid('Choose a cubic control and enter both coordinates');
 const point={x:Number(controlX.value),y:Number(controlY.value)},scene=accepted.tree.snapshot(),path=accepted.tree.get('ArcPath');
 const current=path?.kind==='path'?path.data.commands[commandIndex]:null;
 if(current?.kind==='C'&&(control==='C1'?current.c1x===point.x&&current.c1y===point.y:current.c2x===point.x&&current.c2y===point.y))return;
 const tree=createArcControlCandidate(scene,commandIndex,control,point),next=candidate(tree,accepted.source,accepted.diagnostics,accepted.sourceText);adopt(next);counts.edits++;syncControlFields();show('Selected control edited');
}
/** @returns {Uint8Array} */function fullFrame(){const gl=accepted.canvas.getContext('webgl2');if(!gl)throw Error('GL missing');const pixels=new Uint8Array(2880000);gl.readPixels(0,0,1200,600,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;}
function readObservation(){return{generation,scene:accepted.tree.snapshot(),canonical:stringifySceneJSON(accepted.tree.snapshot()),source5:accepted.source?clone(accepted.source):null,diagnostics:clone(accepted.diagnostics),sourceText:accepted.sourceText,ids:flatten(accepted.tree.snapshot().nodes).map(n=>n.id),pointers:clone(pointers),routes:[...routes]};}
/** @param {CurrentScene['nodes']} nodes @returns {CurrentScene['nodes']} */function flatten(nodes){return nodes.flatMap(n=>[n,...('children'in n?flatten(n.children):[])]);}
function observe(){return{...(disposed?clone(terminal):readObservation()),disposed,busy,counts:{...counts},failure:clone(failure),refusals:clone(refusals),PNG:0};}
/** @param {string} message */function show(message){status.textContent=message;output.textContent=JSON.stringify(observe(),null,2);}
/** @param {string} text */async function importText(text){active();if(new TextEncoder().encode(text).length>1048576)throw new Canvas2DError('SCENE_LIMIT','SVG file exceeds 1 MiB');const xml=new DOMParser().parseFromString(text,'image/svg+xml');if(xml.querySelector('parsererror'))invalid('Malformed SVG XML');counts.imports++;const imported=importSVGArcElement(xml.documentElement);if(imported.diagnostics.viewport.width!==600||imported.diagnostics.viewport.height!==300)invalid('Arc host requires600x300 viewport');const tree=createArcDisplayTree(imported.scene),next=candidate(tree,imported.scene,imported.diagnostics,text);adopt(next);}
function edit(){active();if(counts.edits>=2)invalid('Only two fixed control edits');const tree=createDisplayTreeFromScene(accepted.tree.snapshot()),path=tree.get('ArcPath');if(path?.kind!=='path')invalid('ArcPath missing');const commands=clone(path.data.commands),curves=commands.filter(c=>c.kind==='C');if(curves.length!==2)invalid('Expected two quarter cubics');if(!counts.edits&&accepted.source)curves[0].c1y-=12;else curves[1].c2x+=10;path.setPath({commands,fill:path.data.fill,stroke:path.data.stroke});const next=candidate(tree,accepted.source,accepted.diagnostics,accepted.sourceText);commands[0]=/** @type {import('../src/index.js').PathCommand} */({kind:'M',x:9,y:9});adopt(next);counts.edits++;syncControlFields();show('Curve edited');}
function refuse(){active();if(!accepted.sourceText)invalid('Source provenance is unavailable after Open');const before=stringifySceneJSON(accepted.tree.snapshot()),frame=fullFrame(),identities={tree:accepted.tree,renderer:accepted.renderer,canvas:accepted.canvas},candidateCount=counts.candidates;
 const drafts=[{kind:'flag',text:accepted.sourceText.replace('90 0 1 100','90 2 1 100')},{kind:'smallRadius',text:accepted.sourceText.replace('A 20 40','A .0001 40')},{kind:'normalizedBudget',text:accepted.sourceText.replace('M 60 120 L 140 120 A 20 40 90 0 1 100 100 L 60 100 Z','M 140 120 '+Array.from({length:130},(_,i)=>i%2?'A 20 40 90 0 0 140 120':'A 20 40 90 0 1 100 100').join(' '))}];
 for(const draft of drafts){let code='ACCEPTED',message='';try{counts.imports++;importSVGArcElement(new DOMParser().parseFromString(draft.text,'image/svg+xml').documentElement);}catch(error){code=error instanceof Canvas2DError?error.code:'ERROR';message=String(error);}const after=fullFrame();refusals.push({...draft,code,message,canonicalRetained:before===stringifySceneJSON(accepted.tree.snapshot()),frameBytes:frame.length,frameExact:frame.every((v,i)=>v===after[i]),identitiesRetained:accepted.tree===identities.tree&&accepted.renderer===identities.renderer&&accepted.canvas===identities.canvas,candidateCountUnchanged:counts.candidates===candidateCount});}
 show('Drafts refused; current document retained');
}
async function save(){active();const token=request,session=accepted,text=await serializeCanvasDocument(session.tree.snapshot(),()=>null);if(disposed||token!==request||accepted!==session)return;const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));try{const a=document.createElement('a');a.href=url;a.download='svg-arcs-document.json';a.click();counts.saves++;}finally{URL.revokeObjectURL(url);}show('Document saved');return text;}
/** @param {string} text */async function openText(text){active();const token=++request,canvas=document.createElement('canvas');canvas.id='live';counts.candidates++;const staged=await stageCanvasDocument(text,canvas,options);if(disposed||token!==request){staged.renderer.dispose();counts.disposes++;throw new Canvas2DError('INVALID_SCENE','Open superseded');}let next;try{if(staged.scene.version!==29||staged.assets.size)invalid('Expected current zero-asset document');const tree=createDisplayTreeFromScene(staged.scene);if(tree.get('ArcPath')?.kind!=='path')invalid('Document ArcPath missing');next={canvas,renderer:staged.renderer,tree,source:null,diagnostics:null,sourceText:null,closed:false,bound:false,subscribed:false,unbind:()=>{},unsubscribe:()=>{}};}catch(error){staged.renderer.dispose();counts.disposes++;throw error;}adopt(next);counts.opens++;show('Editable normalized document opened');}
function dispose(){if(disposed)return;terminal=readObservation();disposed=true;request++;release(accepted);for(const remove of controls.splice(0))remove();document.querySelectorAll('button,input,select').forEach(e=>{/** @type {HTMLButtonElement|HTMLInputElement|HTMLSelectElement} */(e).disabled=true;});show('Disposed');}
/** @param {()=>unknown|Promise<unknown>} action */async function run(action){if(disposed||busy)return;busy=true;disableControlInputs();failure=null;try{await action();}catch(error){if(!disposed){failure={code:error instanceof Canvas2DError?error.code:'ERROR',message:String(error)};show('Operation refused');}}finally{busy=false;disableControlInputs();if(!disposed)show(failure?'Operation refused':'Ready');}}
/** @param {EventTarget} target @param {string} type @param {EventListener} callback */function listen(target,type,callback){target.addEventListener(type,callback);controls.push(()=>target.removeEventListener(type,callback));}
listen(input,'change',()=>{const file=input.files?.[0];input.value='';if(!file||disposed)return;const token=++request;void run(async()=>{if(file.size>1048576)throw new Canvas2DError('SCENE_LIMIT','SVG file exceeds1MiB');const text=await file.text();if(disposed||token!==request)return;counts.svgUploads++;await importText(text);});});
listen(commandInput,'change',()=>{if(!disposed&&!busy)syncControlFields();});listen(controlInput,'change',()=>{if(!disposed&&!busy)syncControlFields();});listen(controlApply,'click',()=>{void run(editSelectedControl);});
listen(element('#arc-edit'),'click',()=>{void run(edit);});listen(element('#arc-refuse'),'click',()=>{void run(refuse);});listen(element('#arc-save'),'click',()=>{void run(save);});listen(element('#arc-open-button'),'click',()=>openInput.click());listen(openInput,'change',()=>{const file=openInput.files?.[0];openInput.value='';if(!file||disposed)return;const token=++request;void run(async()=>{const text=await file.text();if(disposed||token!==request)return;counts.jsonUploads++;await openText(text);});});listen(element('#arc-dispose'),'click',dispose);listen(window,'pagehide',dispose);
const initial=createDisplayTree('SVGArcBefore');initial.stage.addChild(initial.createPath({id:'Before',layer:0,transform:pose,commands:[{kind:'M',x:0,y:0},{kind:'L',x:600,y:0},{kind:'L',x:600,y:300},{kind:'L',x:0,y:300},{kind:'Z'}],fill:{color:[.92,.96,1,1],rule:'nonzero'}}));adopt(candidate(initial));
Object.assign(window,{__svgArcConsumer:{observe,importText,edit,editSelectedControl,refuse,save,openText,dispose,fullFrame,get tree(){return accepted.tree;},get renderer(){return accepted.renderer;},get canvas(){return accepted.canvas;},get sessions(){return sessions.map(s=>({canvas:s.canvas}));}}});document.documentElement.dataset.svgArcReady='ready';show('Ready to import SVG');

import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

// Actual React component events with a substituted workspace transport, never native or GPU acceptance.
const root = resolve(import.meta.dirname, '../../..');
const out = resolve(root, '.tmp/solid-split-cut-handle'); mkdirSync(out, { recursive: true });
const scope = 'CPU actual React editor/handle and real public camera matrices; workspace transport, DOM layout and pointer capture are controlled. Native calls 0. Physical browser, capture, pixels and file persistence UNRUN.';
const workspace = `
const camera = { eye:[40,30,40], target:[0,0,0], up:[0,1,0], fovYDegrees:50, near:.1, far:200 };
const display = { scene:{camera}, bodies:[{componentId:'original',bodyId:'body',bounds:{min:[-10,-5,-8],max:[10,5,0]},faces:[]}],qualifications:[] };
export function createSolidSplitWorkspace() {
 const listeners=new Set(); const calls=[];
 let state={session:{cutY:3,presentation:{kind:'original'},generation:0,displayGeneration:0,pending:{},history:{index:0,count:1,canUndo:false,canRedo:false},dirty:false,downloadStatus:'Not downloaded'},display,selection:null,filename:'original.json',busy:false,available:false,error:null,disposed:false,cancelling:false,canCancel:false,authorityAvailable:true};
 const emit=()=>{for(const fn of listeners)fn();};
 const api={getSnapshot:()=>({...state}),subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
 async mount(canvas,w,h){canvas.width=w;canvas.height=h;state={...state,available:true,error:null};emit();},
 unmount(){state={...state,available:false};emit();},dispose(){state={...state,disposed:true,available:false};emit();},
 resize(w,h){calls.push(['resize',w,h]);},markUnavailable(error){state={...state,available:false,error};emit();},
 async stageCutYField(raw){calls.push(['stage',raw]);state={...state,session:{...state.session,pending:raw===''?{}:{cutY:raw}}};emit();},
 async apply(){calls.push(['apply']);if(globalThis.__rejectCut){state={...state,error:new Error('Native refusal simulated')};emit();return;}
 state={...state,session:{...state.session,cutY:Number(state.session.pending.cutY??3),generation:state.session.generation+1,displayGeneration:state.session.displayGeneration+1,pending:{},presentation:{kind:'split'}}};emit();},
 async discardPending(){calls.push(['discard']);state={...state,error:null,session:{...state.session,pending:{}}};emit();},
 fit(){calls.push(['fit']);state={...state,display:{...state.display,scene:{camera:{...camera,eye:[30,40,45]}}}};emit();},
 select(){calls.push(['select']);},pick(){calls.push(['pick']);},download(){calls.push(['download']);},open(){calls.push(['open']);},undo(){calls.push(['undo']);},redo(){calls.push(['redo']);},cancelOperation(){calls.push(['cancel']);},
 testPatch(patch){state={...state,...patch};emit();},calls};globalThis.__cutWorkspace=api;return api;
}`;
const bundle=await build({metafile:true,absWorkingDir:root,stdin:{contents:`export { CadEditorSolidSplit } from './packages/barocss-cad-editor/src/react/solid-split-editor.tsx'; export * from './packages/barocss-cad-editor/src/react/solid-split-cut-projection.ts';`,resolveDir:root,sourcefile:'cut-consumer.tsx'},
 bundle:true,platform:'node',format:'esm',target:'es2022',jsx:'automatic',external:['react','react-dom','react-dom/client'],outfile:resolve(out,'consumer.mjs'),
 plugins:[{name:'controlled-workspace',setup(b){b.onResolve({filter:/split-workspace\.js$/},args=>args.importer.endsWith('/solid-split-editor.tsx')?{path:'workspace',namespace:'cut-test'}:undefined);b.onLoad({filter:/.*/,namespace:'cut-test'},()=>({contents:workspace,loader:'js'}));}}]});
const emittedInputs=Object.values(bundle.metafile.outputs).flatMap(output=>Object.entries(output.inputs)).filter(([,value])=>value.bytesInOutput>0).map(([path])=>path);
assert.ok(!emittedInputs.some(path=>/split-(session|workspace|worker[^/]*)\.ts$/.test(path)),'CPU flow must not retain the native-owning session/worker/coordinator');
const consumer=await import(pathToFileURL(resolve(out,'consumer.mjs')).href);
const camera={eye:[40,30,40],target:[0,0,0],up:[0,1,0],fovYDegrees:50,near:.1,far:200};
const bounds={min:[-10,-5,-8],max:[10,5,0]};
const cases=[];
for(const eye of [[40,30,40],[-40,20,30],[2,35,-40]])for(const dimensions of [[800,600,800,600],[800,600,1600,1200],[450,900,900,1800],[1000,400,500,200]]) {
 const [cssWidth,cssHeight,pixelWidth,pixelHeight]=dimensions;
 const input={camera:{...camera,eye},bounds,cutY:3,cssWidth,cssHeight,pixelWidth,pixelHeight};
 const p=consumer.projectSolidSplitCut(input);assert.ok(p);
 for(const target of [-2,0,4,8]) {const q=consumer.projectSolidSplitCut({...input,cutY:target});assert.ok(q);const y=consumer.moveSolidSplitCut(p,q.xCss-p.xCss,q.yCss-p.yCss);assert.ok(Math.abs(y-target)<1e-9,`${eye}: ${target} != ${y}`);}
 cases.push('perspective '+eye+' '+dimensions);
}
const input={camera,bounds,cutY:-0,cssWidth:800,cssHeight:600,pixelWidth:1600,pixelHeight:1200};
const zero=consumer.projectSolidSplitCut(input);assert.ok(zero);assert.ok(Object.is(consumer.moveSolidSplitCut(zero,0,0),-0));
assert.equal(consumer.projectSolidSplitCut({...input,camera:{...camera,eye:[0,0,40]}}),null,'view-aligned native Y must refuse');
assert.equal(consumer.projectSolidSplitCut({...input,cutY:-10000}),null);
assert.equal(consumer.projectSolidSplitCut({...input,camera:{...camera,near:80,far:200}}),null,'near plane clips guide');
assert.equal(consumer.projectSolidSplitCut({...input,camera:{...camera,far:10}}),null,'far plane clips guide');
assert.equal(consumer.projectSolidSplitCut({...input,bounds:{min:[10000,0,-8],max:[10001,1,0]}}),null,'offscreen guide refuses');
assert.equal(consumer.projectSolidSplitCut({...input,cssWidth:0}),null);
assert.equal(consumer.projectSolidSplitCut({...input,cutY:Infinity}),null);
assert.equal(consumer.moveSolidSplitCut(zero,NaN,0),null);
assert.equal(consumer.moveSolidSplitCut(zero,1e12,1e12),null);
const horizon=zero.axisLength/zero.clipDerivative[3];
assert.equal(consumer.moveSolidSplitCut(zero,horizon*zero.dirX,horizon*zero.dirY),null,'exact perspective horizon refuses');
assert.ok(Object.is(consumer.moveSolidSplitCut(zero,zero.dirY,-zero.dirX),-0),'perpendicular motion preserves signed zero');
cases.push('no-op signed zero, alignment, clipping, invalid and unbounded movement refusal');

const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost/#solid-split',pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','HTMLCanvasElement','HTMLButtonElement','MutationObserver','Event','MouseEvent','KeyboardEvent','getComputedStyle'])globalThis[key]=key==='getComputedStyle'?dom.window.getComputedStyle.bind(dom.window):dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let rect={left:20,top:30,width:800,height:600,right:820,bottom:630,x:20,y:30,toJSON(){return {};}};
dom.window.HTMLElement.prototype.getBoundingClientRect=function(){return rect;};
dom.window.HTMLElement.prototype.getClientRects=function(){return [rect];};
const observers=new Set();globalThis.ResizeObserver=class{constructor(fn){this.fn=fn;observers.add(this);}observe(){}disconnect(){observers.delete(this);}};
const captures=new WeakMap();
dom.window.HTMLElement.prototype.setPointerCapture=function(id){captures.set(this,id);};
dom.window.HTMLElement.prototype.hasPointerCapture=function(id){return captures.get(this)===id;};
dom.window.HTMLElement.prototype.releasePointerCapture=function(id){if(captures.get(this)===id)captures.delete(this);};
const {createElement,act}=await import('react');const {createRoot}=await import('react-dom/client');
const host=document.getElementById('root');const reactRoot=createRoot(host);
await act(async()=>{reactRoot.render(createElement(consumer.CadEditorSolidSplit,{initialAuthoredText:'controlled transport only'}));});
const api=globalThis.__cutWorkspace;
const field=()=>document.querySelector('.cad-solid-split-inspector input');
const grip=()=>document.querySelector('.cad-solid-split-cut-grip');
const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
const inputValue=async value=>act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(field(),value);field().dispatchEvent(new Event('input',{bubbles:true}));});
const pointer=async(element,type,x=100,y=100,id=1,extra={})=>act(async()=>{const e=new MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0,...extra});Object.defineProperties(e,{pointerId:{value:id},isPrimary:{value:extra.isPrimary??true}});element.dispatchEvent(e);});
const down=()=>pointer(grip(),'pointerdown');
const move=()=>pointer(grip(),'pointermove',140,125);
const end=()=>pointer(grip(),'pointerup',140,125);
assert.ok(grip());assert.equal(field().value,'3');
await down();await move();await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
assert.equal(field().value,'3');assert.match(document.querySelector('.cad-solid-split-status').textContent,/No pending field/);
await down();await move();await pointer(grip(),'pointerup',100,100);assert.equal(field().value,'3');assert.match(document.querySelector('.cad-solid-split-status').textContent,/No pending field/);
cases.push('cancel and out-and-back restore absent local draft, not a new equal numeric draft');
await inputValue('3.0000');assert.equal(field().value,'3.0000');
await down();assert.equal(button('Split').disabled,true);assert.equal(field().disabled,true);
await pointer(grip(),'pointerup',101,101);assert.equal(field().value,'3.0000');assert.equal(api.calls.length,0);
await down();await move();await pointer(grip(),'pointerup',100,100);assert.equal(field().value,'3.0000');
cases.push('no-movement and out-and-back preserve lexical raw and lock conflicting controls');
await down();await move();assert.notEqual(field().value,'3.0000');assert.equal(api.calls.length,0);
await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(field().value,'3.0000');assert.equal(button('Split').disabled,false);
cases.push('move is draft only; Escape restores exact lexical raw');
for(const type of ['pointercancel','lostpointercapture']) {await down();await move();await pointer(grip(),type,140,125);assert.equal(field().value,'3.0000');}
cases.push('pointercancel and lost capture restore lexical raw');
await down();await move();await pointer(document.body,'pointerdown',200,200,2,{isPrimary:false});assert.equal(field().value,'3.0000');
await down();await move();await act(async()=>{rect={...rect,width:801,right:821};for(const o of observers)o.fn();});assert.equal(field().value,'3.0000');
await down();await move();await act(async()=>window.dispatchEvent(new Event('hashchange')));assert.equal(field().value,'3.0000');
cases.push('secondary pointer, resize and route event cancel capture');
await down();await move();await act(async()=>{host.hidden=true;await Promise.resolve();});assert.equal(field().value,'3.0000');
await act(async()=>{host.hidden=false;await Promise.resolve();});assert.ok(grip());
cases.push('route hide retains raw and remount shows guide');
await down();await move();await act(async()=>api.testPatch({selection:{componentId:'original',bodyId:'body'}}));assert.equal(field().value,'3.0000');
await down();await move();await act(async()=>api.fit());assert.equal(field().value,'3.0000');api.calls.length=0;
cases.push('stale selection or camera cancels without applying');
const racedCamera={...camera,eye:[45,-20,25]};
await act(async()=>{const state=api.getSnapshot();api.testPatch({display:{...state.display,scene:{camera:racedCamera}}});
 const e=new MouseEvent('pointerdown',{bubbles:true,clientX:100,clientY:100,button:0});Object.defineProperties(e,{pointerId:{value:1},isPrimary:{value:true}});grip().dispatchEvent(e);});
const canvasNow=document.querySelector('canvas');
const racedInput={camera:racedCamera,bounds,cutY:3,cssWidth:rect.width,cssHeight:rect.height,pixelWidth:canvasNow.width,pixelHeight:canvasNow.height};
const raceStart=consumer.projectSolidSplitCut(racedInput),raceEnd=consumer.projectSolidSplitCut({...racedInput,cutY:8});assert.ok(raceStart&&raceEnd);
await pointer(grip(),'pointermove',100+raceEnd.xCss-raceStart.xCss,100+raceEnd.yCss-raceStart.yCss);
await pointer(grip(),'pointerup',100+raceEnd.xCss-raceStart.xCss,100+raceEnd.yCss-raceStart.yCss);
assert.ok(Math.abs(Number(field().value)-8)<1e-9,'pointerdown must use fresh camera even before React commits');
await inputValue('3.0000');
cases.push('same-turn camera publication uses fresh captured projection');
await down();await move();await act(async()=>api.testPatch({busy:true}));assert.equal(field().value,'3.0000');assert.equal(grip(),null);
await act(async()=>api.testPatch({busy:false}));assert.ok(grip());
cases.push('worker busy invalidates active draft gesture');

await down();await move();await inputValue('4.2500');assert.equal(field().value,'4.2500');assert.equal(button('Split').disabled,false);
await inputValue('3.0000');await down();await move();await act(async()=>{const state=api.getSnapshot();api.testPatch({session:{...state.session,generation:state.session.generation+1,cutY:2}});});
assert.equal(field().value,'2','new generation reset must not resurrect old gesture raw');
await inputValue('3.0000');await down();await move();await act(async()=>window.dispatchEvent(new Event('blur')));assert.equal(field().value,'3.0000');
await down();await move();await act(async()=>window.dispatchEvent(new Event('compositionstart')));assert.equal(field().value,'3.0000');
await down();assert.equal(field().disabled,false,'composition prevents a new gesture');await act(async()=>window.dispatchEvent(new Event('compositionend')));
await down();await move();await act(async()=>document.querySelector('canvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true})));assert.equal(field().value,'3.0000');
await act(async()=>button('Remount canvas').click());assert.ok(grip());
cases.push('newer draft and accepted generation win; blur, composition and context loss cancel');
await inputValue('-');assert.equal(grip(),null);assert.equal(field().value,'-');await inputValue('3.0000');assert.ok(grip());
await down();await move();await end();const drafted=field().value;assert.notEqual(drafted,'3.0000');assert.equal(api.calls.length,0);
await act(async()=>button('Split').click());assert.deepEqual(api.calls,[['stage',drafted],['apply']]);assert.equal(field().value,String(Number(drafted)));
cases.push('invalid numeric retained; pointerup only drafts; explicit Split stages then applies once');
api.calls.length=0;await inputValue('3.5000');globalThis.__rejectCut=true;await act(async()=>button('Split').click());assert.equal(field().value,'3.5000');assert.deepEqual(api.calls,[['stage','3.5000'],['apply']]);globalThis.__rejectCut=false;
cases.push('refused explicit Split retains raw draft');
await act(async()=>button('Discard field').click());await down();await move();await act(async()=>reactRoot.unmount());assert.equal(api.getSnapshot().disposed,true);
cases.push('unmount interrupts capture and disposes owned workspace');
const report={scope,outcome:'passed',cases,nativeCalls:0,physicalAcceptance:false};writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));dom.window.close();

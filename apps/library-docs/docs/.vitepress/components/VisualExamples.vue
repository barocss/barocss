<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as runtime from '../generated/visual.js'
import * as advanced from '../generated/advanced-shader.js'
import * as unicode from '../generated/unicode-label.js'
import * as diagram from '../generated/diagram-label.js'
import * as pathEdit from '../generated/path-edit.js'
const presets={...runtime.presets,...advanced.presets,...unicode.presets,...diagram.presets,...pathEdit.presets}
const selected=ref('scene'), source=ref(''), output=ref(''), error=ref(''), canvas=ref(), ready=ref(false), epoch=ref(0), amount=ref(0)
let controller, animationFrame
const actionBusy=ref(false), ownedSlot=ref(), documentFile=ref()
const isDiagram=()=>presets[selected.value].kind==='diagram'
const isPath=()=>presets[selected.value].kind==='path'
const isOwnedCanvas=()=>isDiagram()||isPath()
const pathHistory=ref({canUndo:false,canRedo:false})
function syncPath(data){pathHistory.value={canUndo:!!data.history?.canUndo,canRedo:!!data.history?.canRedo}}
function pathCallbacks(token,resolve){return {onChange(data,acceptedSource){const candidate=resolve();if(candidate&&controller===candidate&&token===epoch.value){source.value=acceptedSource;syncPath(data);output.value=JSON.stringify(data,null,2);error.value=''}},onError(e){const candidate=resolve();if(candidate&&controller===candidate&&token===epoch.value)error.value=describeError(e)}}}
function newOwnedElement(){if(isPath()){const panel=document.createElement('div');panel.style.cssText='position:relative;width:100%;aspect-ratio:8/5';return panel}const next=document.createElement('canvas');next.setAttribute('aria-label','Actual example output');next.style.cssText='display:block;width:100%;height:auto;background:#101820;border-radius:8px';return next}
function downloadCanvasDocument(text,filename){const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);try{link.click()}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}}
async function openCanvasDocument(event){
 const file=event.target.files?.[0];event.target.value='';if(!file||actionBusy.value||!isOwnedCanvas())return;
 const openEpoch=epoch.value,prior=controller,openingPath=isPath();actionBusy.value=true;error.value='';let candidate;
 try{
  if(file.size>48*1024*1024)throw new Error('Canvas document exceeds 48 MiB');
  const text=await file.text();if(openEpoch!==epoch.value)return;
  const next=newOwnedElement();let pathCandidate;candidate=openingPath?await pathEdit.openPathEditExample(next,text,pathCallbacks(openEpoch,()=>pathCandidate)):await diagram.openDiagramLabelExample(next,text);pathCandidate=candidate;
  if(openEpoch!==epoch.value){candidate.dispose();candidate=undefined;return}
  ownedSlot.value.replaceChildren(next);controller=candidate;candidate=undefined;prior?.dispose();const data=controller.report();if(isPath()){syncPath(data);source.value=JSON.stringify({quadratic:data.paths.find(item=>item.id==='QuadraticPath').commands,cubic:data.paths.find(item=>item.id==='CubicPath').commands},null,2)}output.value=JSON.stringify(data,null,2);
 }catch(e){candidate?.dispose();if(openEpoch===epoch.value)error.value=describeError(e)}
 finally{if(openEpoch===epoch.value)actionBusy.value=false}
}
const isUnicode=()=>presets[selected.value].kind==='unicode'
const advancedControls=ref([]), advancedValues=ref({}), playing=ref(false)
const isAdvanced=()=>presets[selected.value].kind==='advanced'
function stopAnimation(){playing.value=false;if(animationFrame!==undefined)cancelAnimationFrame(animationFrame);animationFrame=undefined}
function syncAdvanced(data){advancedControls.value=data.controls||[];advancedValues.value={...(data.uniforms||{})}}
function adjustAdvanced(name,value){error.value='';try{const data=controller.setUniform(name,Number(value));syncAdvanced(data);output.value=JSON.stringify(data,null,2)}catch(e){error.value=describeError(e);const retained=controller.report();syncAdvanced(retained);if(!retained.available)output.value=JSON.stringify(retained,null,2);stopAnimation()}}
function play(){
 if(playing.value||!isAdvanced())return;
 const phase=advancedControls.value.find(c=>c.name==='phase');if(!phase)return;
 playing.value=true;let previous=performance.now(),lastDraw=previous;
 function tick(now){
  if(!playing.value)return;
  if(now-lastDraw>=50){
   const span=phase.max-phase.min,elapsed=(now-previous)/1000;previous=now;lastDraw=now;
   const next=phase.min+((Number(advancedValues.value.phase)-phase.min+elapsed*.8)%span);
   adjustAdvanced('phase',next);
  }
  if(playing.value)animationFrame=requestAnimationFrame(tick);
 }
 animationFrame=requestAnimationFrame(tick);
}
const anchors=Object.fromEntries(Object.entries(presets).map(([key,preset])=>[key,preset.anchor]))
const titles=Object.fromEntries(Object.entries(presets).map(([key,preset])=>[key,preset.label]))
const isMaterial=()=>presets[selected.value].kind==='material'
const control=()=>presets[selected.value].control || {name:'amount',min:0,max:1,step:.05,default:0}
let acceptedAmount=0
const describeError=e=>(typeof e?.code==='string' ? e.code+': ' : '')+(e?.message || String(e))+(isAdvanced() && typeof e?.cause?.code==='string' ? ' ('+e.cause.code+': '+e.cause.message+')' : '')
async function select(kind){
  stopAnimation();advancedControls.value=[];advancedValues.value={};pathHistory.value={canUndo:false,canRedo:false};
  controller?.dispose(); controller=undefined; actionBusy.value=false; selected.value=kind; epoch.value++; error.value=''; output.value=''; amount.value=presets[kind].control?.default || 0; acceptedAmount=amount.value;
  const selectionEpoch=epoch.value;
  source.value=presets[kind].source; await nextTick();
  if(selectionEpoch!==epoch.value)return;
  try{
    if(isUnicode()||isDiagram())await document.fonts?.ready;
    if(selectionEpoch!==epoch.value)return;
    if(isOwnedCanvas()){const next=newOwnedElement();let pathCandidate;controller=isPath()?(pathCandidate=pathEdit.createPathEditExample(next,source.value,pathCallbacks(selectionEpoch,()=>pathCandidate))):diagram.createDiagramLabelExample(next,source.value);ownedSlot.value.replaceChildren(next)}
    else controller=isAdvanced()?advanced.createAdvancedShaderExample(canvas.value,source.value):isUnicode()?unicode.createUnicodeTextExample(canvas.value,source.value):runtime.createExample(canvas.value,kind,source.value);
    const data=controller.report();if(isAdvanced())syncAdvanced(data);if(isPath())syncPath(data);output.value=JSON.stringify(data,null,2)
  }catch(e){if(selectionEpoch===epoch.value)error.value=describeError(e)}
}
function apply(){stopAnimation();error.value='';try{const data=controller.update(source.value);if(isAdvanced())syncAdvanced(data);if(isPath())syncPath(data);output.value=JSON.stringify(data,null,2)}catch(e){error.value=describeError(e);if(isAdvanced()||isUnicode()||isOwnedCanvas()){const retained=controller.report();if(!retained.available)output.value=JSON.stringify(retained,null,2)}}}
function adjust(){error.value='';try{output.value=JSON.stringify(controller.setAmount(Number(amount.value)),null,2);acceptedAmount=Number(amount.value)}catch(e){amount.value=acceptedAmount;error.value=describeError(e)}}
async function act(id){
 if(actionBusy.value||!controller)return;
 const actionEpoch=epoch.value,current=controller;actionBusy.value=true;error.value='';
 try{const result=await current.action(id);if(actionEpoch!==epoch.value)return;if(isOwnedCanvas()&&id==='save-document'){downloadCanvasDocument(result.documentText,result.filename);output.value=JSON.stringify(result.report,null,2);return}if(isPath())syncPath(result.report||result);if(id==='resize-100'&&typeof result.acceptedSource==='string')source.value=result.acceptedSource;if(id==='reload'&&typeof result.native?.source==='string')source.value=result.native.source;output.value=JSON.stringify(result,null,2)}
 catch(e){if(actionEpoch===epoch.value)error.value=describeError(e)}
 finally{if(actionEpoch===epoch.value)actionBusy.value=false}
}
onMounted(async()=>{try{ready.value=true;await select(Object.keys(anchors).find(kind=>anchors[kind]===window.location.hash.slice(1)) || 'scene')}catch(e){error.value=describeError(e)}})
onBeforeUnmount(()=>{epoch.value++;stopAnimation();controller?.dispose()})
</script>
<template>
<section class="visual-examples" aria-label="Runnable visual examples" :data-ready="ready && !!controller" :data-selected="selected">
  <div class="example-tabs"><button v-for="(title,kind) in titles" :key="kind" :id="anchors[kind]" :disabled="!ready" :aria-pressed="selected===kind" @click="select(kind)">{{title}}</button></div>
  <h2>{{presets[selected].title || 'Loading examples'}}</h2>
  <p class="explain">{{presets[selected].description || (selected==='curve' ? 'The cyan line is evaluated geometry. Orange points define the control polygon. Coordinates are millimetres.' : selected==='scene' ? 'Each accepted source edit compiles and draws one SDF frame. Change a size, angle or color, then select Run input.' : selected==='surface' ? 'CAD evaluates the rational patch. A 17 × 17 grid becomes a GPU triangle mesh. Pale lines show its sampled U/V grid. This display does not certify a Solid.' : 'The same sampled CAD patch uses an opaque fragment material. The host supplies amount; compilation creates no timer.')}}</p>
  <div class="example-grid"><div><label for="visual-source">Editable input · {{presets[selected].language}}</label><textarea id="visual-source" v-model="source" spellcheck="false" aria-label="Example source"/><div class="example-actions"><button :disabled="!controller || actionBusy" @click="apply">Run input</button><button :disabled="!ready" @click="select(selected)">Reset example</button></div></div><figure><div v-if="isOwnedCanvas()" :key="epoch" ref="ownedSlot"/><canvas v-else :key="epoch" ref="canvas" width="640" height="420" aria-label="Actual example output"/><figcaption>{{isAdvanced() ? 'Actual WebGL2 output from this example host and public material lowering.' : isPath() ? 'Drag a control point to edit its curve.' : isDiagram() ? 'Ellipsized label and separate bitmap outline from public Canvas2D APIs.' : isUnicode() ? 'Browser-prepared RGBA label displayed by the public Canvas2D GlyphRun renderer.' : 'Actual output from the selected public API.'}}</figcaption></figure></div>
  <label v-if="isMaterial()" class="uniform-control">{{control().name}} = {{amount}}<input v-model="amount" aria-label="Material amount" type="range" :min="control().min" :max="control().max" :step="control().step" @input="adjust"/></label>
  <div v-if="isAdvanced()" class="advanced-controls">
    <label v-for="item in advancedControls" :key="item.name" class="uniform-control">{{item.name}} = {{Number(advancedValues[item.name]).toFixed(2)}}<input :value="advancedValues[item.name]" :aria-label="'Shader '+item.name" type="range" :min="item.min" :max="item.max" :step="presets[selected].controls.find(c=>c.name===item.name)?.step || .05" @input="stopAnimation();adjustAdvanced(item.name,$event.target.value)"/></label>
    <div class="example-actions"><button :disabled="!controller || playing" @click="play">Play shader</button><button :disabled="!playing" @click="stopAnimation">Pause shader</button><span>{{playing ? 'Host animation running' : 'Paused · phase is explicit'}}</span></div>
    <p class="explain">UV coordinates drive the pattern. Play advances phase in this example's host. Source compilation creates no clock. <a :href="selected==='caustics-shader' ? '/packages/gpu/caustics-shader' : '/packages/gpu/advanced-shader'">Read the shader layers and controls</a>.</p>
  </div>
  <div v-if="presets[selected].actions" class="example-actions"><button v-for="action in presets[selected].actions" :key="action.id" :disabled="!controller || actionBusy || (isPath() && action.id==='undo' && !pathHistory.canUndo) || (isPath() && action.id==='redo' && !pathHistory.canRedo)" @click="act(action.id)">{{action.label}}</button></div>
  <div v-if="isOwnedCanvas()" class="example-actions"><button :disabled="!controller || actionBusy" @click="documentFile.click()">{{isPath() ? 'Open path JSON' : 'Open diagram JSON'}}</button><input ref="documentFile" type="file" accept=".json,application/json" :aria-label="isPath() ? 'Path JSON file' : 'Diagram JSON file'" hidden @change="openCanvasDocument"/></div>
  <p v-if="error" role="alert" class="example-error">Input refused: {{error}}. The last accepted output stays visible while the sample remains live.</p>
  <details open><summary>Actual result data</summary><pre class="example-report">{{output}}</pre></details>
</section>
</template>
<style>
.VPDoc:has(.visual-examples) .aside { display: none !important; }
.VPDoc:has(.visual-examples) .container { max-width: 1200px !important; }
.VPDoc:has(.visual-examples) .content { width: 100%; max-width: none !important; min-width: 0; padding: 0 !important; }
.VPDoc:has(.visual-examples) .content-container { max-width: none !important; }
.VPDoc:has(.visual-examples) .VPDocFooter { display: none !important; }
</style>
<style scoped>
.visual-examples h2{font-size:24px;font-weight:650;line-height:1.35;margin:18px 0 8px}.visual-examples details{margin-top:18px}.visual-examples summary{font-weight:600;cursor:pointer}.visual-examples{border:1px solid var(--vp-c-divider);border-radius:12px;padding:20px;margin:20px 0}.example-tabs,.example-actions{display:flex;gap:8px;flex-wrap:wrap}.example-tabs button,.example-actions button{padding:7px 12px;border:1px solid var(--vp-c-divider);border-radius:7px;background:var(--vp-c-bg-soft);font-weight:600}.example-tabs button[aria-pressed=true],.example-actions button:first-child{background:var(--vp-c-brand-3);color:white}.example-grid{display:grid;grid-template-columns:1fr 1.1fr;gap:20px;margin-top:18px}.example-grid label{display:block;font-size:13px;font-weight:600}.example-grid textarea{width:100%;height:420px;resize:vertical;border:1px solid var(--vp-c-divider);border-radius:8px;padding:12px;font:13px/1.6 monospace;background:var(--vp-c-bg-soft);white-space:pre}.example-grid figure{margin:0}.example-grid canvas{display:block;width:100%;height:auto;background:#101820;border-radius:8px}.example-grid figcaption{font-size:12px;color:var(--vp-c-text-2)}.example-actions{margin-top:8px}.example-report{max-height:280px;overflow:auto;padding:12px;background:var(--vp-c-bg-soft);font-size:13px;line-height:1.6;border-radius:8px}.example-error{padding:12px;background:var(--vp-c-danger-soft);overflow-wrap:anywhere}.uniform-control{display:flex;gap:16px;align-items:center;margin:16px 0}.uniform-control input{width:240px}.explain{font-size:15px}@media(max-width:850px){.example-grid{grid-template-columns:1fr}.example-grid textarea{height:300px}.visual-examples h2{font-size:24px;font-weight:650;line-height:1.35;margin:18px 0 8px}.visual-examples details{margin-top:18px}.visual-examples summary{font-weight:600;cursor:pointer}.visual-examples{padding:12px}}
</style>

<script setup>
import { withBase } from 'vitepress'
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { exampleCatalog, exampleHref } from '../example-catalog.mjs'
import * as runtime from '../generated/visual.js'
import * as advanced from '../generated/advanced-shader.js'
import * as reusableShader from '../generated/reusable-shader.js'
import * as cadQuantityFunctions from '../generated/cad-quantity-functions.js'
import * as discreteMaterial from '../generated/discrete-material.js'
import * as viewerDisplayPose from '../generated/viewer-display-pose.js'
import * as cadAdaptiveSampling from '../generated/cad-adaptive-sampling.js'
import * as generatedScene from '../generated/generated-scene.js'
const presets={...runtime.presets,...advanced.presets,...reusableShader.presets,...cadQuantityFunctions.presets,...discreteMaterial.presets,...viewerDisplayPose.presets,...cadAdaptiveSampling.presets,...generatedScene.presets}
const props=defineProps({category:{type:String,default:'all'}})
const categoryNames={library:'Library examples',language:'Language examples',integration:'Integrated workflows'}
const purposeNames={api:'Library API',language:'Language',integration:'Integrated workflow'}
const libraryNames={cad:'CAD',gpu:'GPU',viewer:'Viewer',physics:'Physics'}
const category=ref(props.category==='all'?'library':props.category),library=ref(props.category==='integration'?'all':'cad'),outsideGroup=ref('')
const scopeAllows=kind=>props.category==='all'||props.category==='library'||exampleCatalog[kind].category===props.category
const categoryAllows=kind=>category.value==='library'||exampleCatalog[kind].category===category.value
const categoryKeys=computed(()=>Object.keys(presets).filter(categoryAllows))
const libraryOptions=computed(()=>Object.keys(libraryNames).filter(name=>categoryKeys.value.some(key=>exampleCatalog[key].library===name)))
const visibleKeys=computed(()=>categoryKeys.value.filter(key=>library.value==='all'||exampleCatalog[key].library===library.value))
const optionGroups=computed(()=>Object.entries(purposeNames).map(([purpose,label])=>({label,keys:visibleKeys.value.filter(key=>exampleCatalog[key].category===purpose)})).filter(group=>group.keys.length))
function locationKind(){try{const anchor=decodeURIComponent(window.location.hash.slice(1));return Object.keys(presets).find(kind=>presets[kind].anchor===anchor)}catch{return undefined}}
function writeLocation(kind){const hash='#'+presets[kind].anchor;if(window.location.hash!==hash)window.history.pushState(window.history.state,'',hash)}
async function chooseExample(kind){if(!visibleKeys.value.includes(kind))return;outsideGroup.value='';const token=epoch.value+1;await select(kind);if(epoch.value===token)writeLocation(kind)}
async function changeLibrary(value){library.value=value;if(!visibleKeys.value.includes(selected.value))await chooseExample(visibleKeys.value[0])}
async function changeCategory(value){category.value=value;outsideGroup.value='';if(library.value!=='all'&&!libraryOptions.value.includes(library.value))library.value='all';if(!visibleKeys.value.includes(selected.value))await chooseExample(visibleKeys.value[0])}
async function selectLocation(force=false){
 const requested=locationKind();
 if(requested&&scopeAllows(requested)){
  outsideGroup.value='';if(props.category==='all')category.value=exampleCatalog[requested].category==='api'?'library':exampleCatalog[requested].category;
  library.value=exampleCatalog[requested].library;if(force||requested!==selected.value||!controller)await select(requested);return
 }
 outsideGroup.value=requested||'';
 if(force||!controller||!window.location.hash){if(!window.location.hash){category.value=props.category==='all'?'library':props.category;library.value=props.category==='integration'?'all':'cad'}if(!libraryOptions.value.includes(library.value))library.value='all';const fallback=visibleKeys.value[0];if(fallback&&(force||fallback!==selected.value||!controller))await select(fallback)}
}
function onLocation(){selectLocation().catch(e=>{error.value=describeError(e)})}
watch(()=>props.category,async value=>{category.value=value==='all'?'library':value;library.value=value==='integration'?'all':'cad';try{await selectLocation(true)}catch(e){error.value=describeError(e)}})
const selected=ref('scene'), source=ref(''), output=ref(''), error=ref(''), canvas=ref(), ready=ref(false), epoch=ref(0), amount=ref(0)
let controller, animationFrame
const actionBusy=ref(false), ownedSlot=ref()
const isViewerPose=()=>presets[selected.value].kind==='viewer-display-pose'
const isCadAdaptive=()=>presets[selected.value].kind==='cad-adaptive-sampling'
const isGenerated=()=>presets[selected.value].kind==='generated-scene'
const isOwnedCanvas=()=>isViewerPose()
function newOwnedElement(){const panel=document.createElement('div');panel.style.cssText='display:block;width:100%';return panel}
const advancedControls=ref([]), advancedValues=ref({}), playing=ref(false)
const isAdvanced=()=>presets[selected.value].kind==='advanced'||presets[selected.value].kind==='advanced-functions'
const advancedModule=()=>presets[selected.value].kind==='advanced-functions'?reusableShader:advanced
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
const isMaterial=()=>presets[selected.value].kind==='material'||presets[selected.value].kind==='discrete-material'
const control=()=>presets[selected.value].control || {name:'amount',min:0,max:1,step:.05,default:0}
let acceptedAmount=0
const describeError=e=>(typeof e?.code==='string' ? e.code+': ' : isViewerPose() ? e?.name+': ' : '')+(e?.message || String(e))+(isAdvanced() && typeof e?.cause?.code==='string' ? ' ('+e.cause.code+': '+e.cause.message+')' : '')+(['cad-quantity-functions','discrete-material','generated-scene'].includes(presets[selected.value].kind)&&Array.isArray(e?.diagnostics) ? ' '+JSON.stringify(e.diagnostics) : '')+(isViewerPose()&&e?.retention ? ' '+JSON.stringify(e.retention) : '')
async function select(kind){
  stopAnimation();advancedControls.value=[];advancedValues.value={};
  controller?.dispose(); controller=undefined; actionBusy.value=false; selected.value=kind; epoch.value++; error.value=''; output.value=''; amount.value=presets[kind].control?.default || 0; acceptedAmount=amount.value;
  const selectionEpoch=epoch.value;
  source.value=presets[kind].source; await nextTick();
  if(selectionEpoch!==epoch.value)return;
  try{
    if(isOwnedCanvas()){const next=newOwnedElement();const candidate=await viewerDisplayPose.createViewerDisplayPoseExample(next,source.value);if(selectionEpoch!==epoch.value){candidate.dispose();return}controller=candidate;ownedSlot.value.replaceChildren(next)}
    else {const candidate=isCadAdaptive()?await cadAdaptiveSampling.createExample(canvas.value,kind,source.value):isGenerated()?generatedScene.createExample(canvas.value,kind,source.value):isAdvanced()?advancedModule().createAdvancedShaderExample(canvas.value,source.value):presets[kind].kind==='cad-quantity-functions'?await cadQuantityFunctions.createExample(canvas.value,kind,source.value):presets[kind].kind==='discrete-material'?discreteMaterial.createExample(canvas.value,kind,source.value):await runtime.createExample(canvas.value,kind,source.value);if(selectionEpoch!==epoch.value){candidate.dispose();return}controller=candidate}
    const data=controller.report();if(isAdvanced())syncAdvanced(data);output.value=JSON.stringify(data,null,2)
  }catch(e){if(selectionEpoch===epoch.value)error.value=describeError(e)}
}
async function apply(){if(actionBusy.value||!controller)return;stopAnimation();error.value='';const applyEpoch=epoch.value,current=controller;actionBusy.value=true;try{const data=await current.update(source.value);if(applyEpoch!==epoch.value||controller!==current)return;if(isAdvanced())syncAdvanced(data);output.value=JSON.stringify(data,null,2)}catch(e){if(applyEpoch===epoch.value&&controller===current){error.value=describeError(e);if(isAdvanced()||isOwnedCanvas()){const retained=current.report();if(!retained.available)output.value=JSON.stringify(retained,null,2)}}}finally{if(applyEpoch===epoch.value&&controller===current)actionBusy.value=false}}
function adjust(){error.value='';try{output.value=JSON.stringify(controller.setAmount(Number(amount.value)),null,2);acceptedAmount=Number(amount.value)}catch(e){amount.value=acceptedAmount;error.value=describeError(e)}}
async function act(id){
 if(actionBusy.value||!controller)return;
 const actionEpoch=epoch.value,current=controller;actionBusy.value=true;error.value='';
 try{const result=await current.action(id);if(actionEpoch!==epoch.value)return;if((isViewerPose()||isCadAdaptive()||isGenerated())&&typeof result.acceptedSource==='string')source.value=result.acceptedSource;if(id==='reload'&&typeof result.native?.source==='string')source.value=result.native.source;output.value=JSON.stringify(isViewerPose()||isCadAdaptive()||isGenerated() ? result.report||result : result,null,2)}
 catch(e){if(actionEpoch===epoch.value)error.value=describeError(e)}
 finally{if(actionEpoch===epoch.value)actionBusy.value=false}
}
onMounted(async()=>{try{ready.value=true;window.addEventListener('hashchange',onLocation);window.addEventListener('popstate',onLocation);await selectLocation(true)}catch(e){error.value=describeError(e)}})
onBeforeUnmount(()=>{epoch.value++;window.removeEventListener('hashchange',onLocation);window.removeEventListener('popstate',onLocation);stopAnimation();controller?.dispose()})
</script>
<template>
<section class="visual-examples" aria-label="Runnable visual examples" :data-ready="ready && !!controller" :data-selected="selected">
  <div class="example-anchor-index" aria-hidden="true"><span v-for="(anchor,kind) in anchors" :key="kind" :id="anchor"/></div>
  <nav class="example-categories" aria-label="Example categories">
    <template v-for="(label,value) in categoryNames" :key="value"><button v-if="props.category==='all'" :aria-pressed="category===value" @click="changeCategory(value)">{{label}}</button><a v-else :href="withBase('/examples/'+value)" :aria-current="category===value ? 'page' : undefined">{{label}}</a></template>
  </nav>
  <div class="example-selection">
    <label>Library<select aria-label="Example library" :value="library" :disabled="!ready" @change="changeLibrary($event.target.value)"><option value="all">All libraries</option><option v-for="name in libraryOptions" :key="name" :value="name">{{libraryNames[name]}}</option></select></label>
    <label>Example<select aria-label="Example" :value="selected" :disabled="!ready" @change="chooseExample($event.target.value)"><optgroup v-for="group in optionGroups" :key="group.label" :label="group.label"><option v-for="kind in group.keys" :key="kind" :value="kind">{{titles[kind]}}</option></optgroup></select></label>
    <p>{{visibleKeys.length}} examples · <a :href="withBase('/examples/')">Browse the catalog</a></p>
  </div>
  <p v-if="outsideGroup" class="explain">The requested example belongs to another category. <a :href="withBase(exampleHref(outsideGroup))">Open {{titles[outsideGroup]}}</a>.</p>
  <p class="example-purpose">{{libraryNames[exampleCatalog[selected].library]}} · {{purposeNames[exampleCatalog[selected].category]}} · <a :href="withBase(exampleCatalog[selected].guide)">Read this example's guide</a></p>
  <h2>{{presets[selected].title || 'Loading examples'}}</h2>
  <p class="explain">{{presets[selected].description || (selected==='curve' ? 'The cyan line is evaluated geometry. Orange points define the control polygon. Coordinates are millimetres.' : selected==='scene' ? 'Each accepted source edit compiles and shows its objects as meshes on the WebGPU viewer. Change a size, angle or color, then select Run input. Drag to orbit.' : selected==='surface' ? 'CAD evaluates the rational patch. A 17 × 17 grid becomes a triangle mesh on the WebGPU viewer. Pale lines show its sampled U/V grid. This display does not certify a Solid.' : 'The same sampled CAD patch uses an opaque fragment material. The host supplies amount; compilation creates no timer.')}}</p>
  <div class="example-grid"><div><label for="visual-source">Editable input · {{presets[selected].language}}</label><textarea id="visual-source" v-model="source" spellcheck="false" aria-label="Example source"/><div class="example-actions"><button :disabled="!controller || actionBusy" @click="apply">Run input</button><button :disabled="!ready" @click="select(selected)">Reset example</button></div></div><figure><div v-if="isOwnedCanvas()" :key="epoch" ref="ownedSlot"/><canvas v-else :key="epoch" ref="canvas" width="640" height="420" aria-label="Actual example output"/><figcaption>{{isViewerPose() ? 'Actual Viewer 3D output. Display pose changes presentation; native CAD points stay separate.' : isGenerated() ? 'Application diagnostic boxes for actual generated objects. Sphere boxes are bounds guides, not rendered spheres.' : isCadAdaptive() ? 'An application 2D canvas projects actual CAD sample points and all original poles from fixed XYZ coordinates.' : presets[selected].kind==='discrete-material' ? 'Public CPU Material colours displayed by this application on a 2D canvas. The lowered shader text is not executed.' : isAdvanced() ? 'Actual WebGL2 output from this example host and public material lowering.' : 'Actual output from the selected public API.'}}</figcaption></figure></div>
  <label v-if="isMaterial()" class="uniform-control">{{control().name}} = {{amount}}<input v-model="amount" :aria-label="presets[selected].kind==='discrete-material' ? 'Material level' : 'Material amount'" type="range" :min="control().min" :max="control().max" :step="control().step" @input="adjust"/></label>
  <div v-if="isAdvanced()" class="advanced-controls">
    <label v-for="item in advancedControls" :key="item.name" class="uniform-control">{{item.name}} = {{Number(advancedValues[item.name]).toFixed(2)}}<input :value="advancedValues[item.name]" :aria-label="'Shader '+item.name" type="range" :min="item.min" :max="item.max" :step="presets[selected].controls.find(c=>c.name===item.name)?.step || .05" @input="stopAnimation();adjustAdvanced(item.name,$event.target.value)"/></label>
    <div class="example-actions"><button :disabled="!controller || playing" @click="play">Play shader</button><button :disabled="!playing" @click="stopAnimation">Pause shader</button><span>{{playing ? 'Host animation running' : 'Paused · phase is explicit'}}</span></div>
    <p class="explain">UV coordinates drive the pattern. Play advances phase in this example's host. Source compilation creates no clock. <a :href="withBase(exampleCatalog[selected].guide)">Read the shader layers and controls</a>.</p>
  </div>
  <div v-if="presets[selected].actions" class="example-actions"><button v-for="action in presets[selected].actions" :key="action.id" :disabled="!controller || actionBusy" @click="act(action.id)">{{action.label}}</button></div>
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
.example-anchor-index{height:0;overflow:hidden}.example-categories{display:flex;flex-wrap:wrap;gap:8px}.example-categories button,.example-categories a{padding:6px 10px;border-bottom:2px solid transparent;font-weight:600}.example-categories [aria-pressed=true],.example-categories [aria-current=page]{border-color:var(--vp-c-brand-1);color:var(--vp-c-brand-1)}.example-selection{display:grid;grid-template-columns:180px minmax(0,1fr);gap:16px;margin:18px 0}.example-selection label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600}.example-selection select{width:100%;padding:8px;border:1px solid var(--vp-c-divider);border-radius:6px;background:var(--vp-c-bg-soft)}.example-selection p{grid-column:1/-1;margin:0;font-size:13px}.example-purpose{font-size:13px;color:var(--vp-c-text-2)}@media(max-width:600px){.example-selection{grid-template-columns:1fr}}.visual-examples h2{font-size:24px;font-weight:650;line-height:1.35;margin:18px 0 8px}.visual-examples details{margin-top:18px}.visual-examples summary{font-weight:600;cursor:pointer}.visual-examples{border:1px solid var(--vp-c-divider);border-radius:12px;padding:20px;margin:20px 0}.example-tabs,.example-actions{display:flex;gap:8px;flex-wrap:wrap}.example-tabs button,.example-actions button{padding:7px 12px;border:1px solid var(--vp-c-divider);border-radius:7px;background:var(--vp-c-bg-soft);font-weight:600}.example-tabs button[aria-pressed=true],.example-actions button:first-child{background:var(--vp-c-brand-3);color:white}.example-grid{display:grid;grid-template-columns:1fr 1.1fr;gap:20px;margin-top:18px}.example-grid label{display:block;font-size:13px;font-weight:600}.example-grid textarea{width:100%;height:420px;resize:vertical;border:1px solid var(--vp-c-divider);border-radius:8px;padding:12px;font:13px/1.6 monospace;background:var(--vp-c-bg-soft);white-space:pre}.example-grid figure{margin:0}.example-grid canvas{display:block;width:100%;height:auto;background:#101820;border-radius:8px}.example-grid figcaption{font-size:12px;color:var(--vp-c-text-2)}.example-actions{margin-top:8px}.example-report{max-height:280px;overflow:auto;padding:12px;background:var(--vp-c-bg-soft);font-size:13px;line-height:1.6;border-radius:8px}.example-error{padding:12px;background:var(--vp-c-danger-soft);overflow-wrap:anywhere}.uniform-control{display:flex;gap:16px;align-items:center;margin:16px 0}.uniform-control input{width:240px}.explain{font-size:15px}@media(max-width:850px){.example-grid{grid-template-columns:1fr}.example-grid textarea{height:300px}.visual-examples h2{font-size:24px;font-weight:650;line-height:1.35;margin:18px 0 8px}.visual-examples details{margin-top:18px}.visual-examples summary{font-weight:600;cursor:pointer}.visual-examples{padding:12px}}
</style>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as runtime from '../generated/visual.js'
const selected=ref('scene'), source=ref(''), output=ref(''), error=ref(''), canvas=ref(), ready=ref(false), epoch=ref(0), amount=ref(0)
let controller
const anchors=Object.fromEntries(Object.entries(runtime.presets).map(([key,preset])=>[key,preset.anchor]))
const titles=Object.fromEntries(Object.entries(runtime.presets).map(([key,preset])=>[key,preset.label]))
const isMaterial=()=>runtime.presets[selected.value].kind==='material'
const control=()=>runtime.presets[selected.value].control || {name:'amount',min:0,max:1,step:.05,default:0}
let acceptedAmount=0
const describeError=e=>(typeof e?.code==='string' ? e.code+': ' : '')+(e?.message || String(e))
async function select(kind){
  controller?.dispose(); controller=undefined; selected.value=kind; epoch.value++; error.value=''; output.value=''; amount.value=runtime.presets[kind].control?.default || 0; acceptedAmount=amount.value;
  const selectionEpoch=epoch.value;
  source.value=runtime.presets[kind].source; await nextTick();
  if(selectionEpoch!==epoch.value)return;
  try{controller=runtime.createExample(canvas.value,kind,source.value);output.value=JSON.stringify(controller.report(),null,2)}catch(e){error.value=describeError(e)}
}
function apply(){error.value='';try{output.value=JSON.stringify(controller.update(source.value),null,2)}catch(e){error.value=describeError(e)}}
function adjust(){error.value='';try{output.value=JSON.stringify(controller.setAmount(Number(amount.value)),null,2);acceptedAmount=Number(amount.value)}catch(e){amount.value=acceptedAmount;error.value=describeError(e)}}
function act(id){error.value='';try{const result=controller.action(id);if(id==='resize-100'&&typeof result.acceptedSource==='string')source.value=result.acceptedSource;if(id==='reload'&&typeof result.native?.source==='string')source.value=result.native.source;output.value=JSON.stringify(result,null,2)}catch(e){error.value=describeError(e)}}
onMounted(async()=>{try{ready.value=true;await select(Object.keys(anchors).find(kind=>anchors[kind]===window.location.hash.slice(1)) || 'scene')}catch(e){error.value=describeError(e)}})
onBeforeUnmount(()=>controller?.dispose())
</script>
<template>
<section class="visual-examples" aria-label="Runnable visual examples" :data-ready="ready && !!controller" :data-selected="selected">
  <div class="example-tabs"><button v-for="(title,kind) in titles" :key="kind" :id="anchors[kind]" :disabled="!ready" :aria-pressed="selected===kind" @click="select(kind)">{{title}}</button></div>
  <h2>{{runtime?.presets[selected].title || 'Loading examples'}}</h2>
  <p class="explain">{{runtime.presets[selected].description || (selected==='curve' ? 'The cyan line is evaluated geometry. Orange points define the control polygon. Coordinates are millimetres.' : selected==='scene' ? 'Each accepted source edit compiles and draws one SDF frame. Change a size, angle or color, then select Run input.' : selected==='surface' ? 'CAD evaluates the rational patch. A 17 × 17 grid becomes a GPU triangle mesh. Pale lines show its sampled U/V grid. This display does not certify a Solid.' : 'The same sampled CAD patch uses an opaque fragment material. The host supplies amount; compilation creates no timer.')}}</p>
  <div class="example-grid"><div><label for="visual-source">Editable input · {{runtime?.presets[selected].language}}</label><textarea id="visual-source" v-model="source" spellcheck="false" aria-label="Example source"/><div class="example-actions"><button :disabled="!controller" @click="apply">Run input</button><button :disabled="!ready" @click="select(selected)">Reset example</button></div></div><figure><canvas :key="epoch" ref="canvas" width="640" height="420" aria-label="Actual example output"/><figcaption>Actual output from the selected public API.</figcaption></figure></div>
  <label v-if="isMaterial()" class="uniform-control">{{control().name}} = {{amount}}<input v-model="amount" aria-label="Material amount" type="range" :min="control().min" :max="control().max" :step="control().step" @input="adjust"/></label>
  <div v-if="runtime.presets[selected].actions" class="example-actions"><button v-for="action in runtime.presets[selected].actions" :key="action.id" :disabled="!controller" @click="act(action.id)">{{action.label}}</button></div>
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

<script setup>
import { computed, onMounted, ref } from 'vue'
const labels = ['Source', 'IR', 'Validated IR', 'GLSL']
const report = ref(null), loadError = ref(''), tabs = ref([])
let model, examples
onMounted(async () => {
  try {
    examples = await import('../generated/material-bench.js')
    model = examples.createMaterialBench()
    report.value = model.compile()
  } catch (error) { loadError.value = error.message }
})
function edit(event) { report.value = model.setDraft(event.target.value) }
function compile() { report.value = model.compile() }
function choose(index, focus = false) {
  report.value = model.selectStage(index)
  if (focus) tabs.value[index]?.focus()
}
function navigate(event, index) {
  const next = { ArrowRight: (index + 1) % 4, ArrowLeft: (index + 3) % 4, Home: 0, End: 3 }[event.key]
  if (next !== undefined) { event.preventDefault(); choose(next, true) }
}
function example(name) { report.value = model.setDraft(examples[name]); compile() }
const accepted = computed(() => report.value?.accepted)
const fullText = computed(() => {
  if (!report.value) return ''
  if (report.value.selectedStage === 0) return report.value.draft
  if (!accepted.value) return 'No accepted material yet'
  if (report.value.selectedStage === 1) return JSON.stringify(accepted.value.compiled, null, 2)
  if (report.value.selectedStage === 2) return JSON.stringify(accepted.value.validated, null, 2)
  return accepted.value.lowered.uniformDeclarations + '\n\n' + accepted.value.lowered.expression
})
const captions = computed(() => !accepted.value ? [] : [
  `${report.value.draft.length} UTF-16 code units in the current draft`,
  `${accepted.value.compiled.uniforms.length} uniforms in accepted IR`,
  `${accepted.value.statistics.nodes} final expression-tree nodes; depth ${accepted.value.statistics.depth}`,
  `${accepted.value.lowered.uniformLayout.length} emitted uniform declarations`
])
</script>

<template>
  <section class="material-bench" aria-label="Material compilation bench">
    <p>CPU source → IR → explicit validation → GLSL text. No renderer or GPU execution.</p>
    <p v-if="loadError" role="alert">Could not load the CPU bench: {{ loadError }}</p>
    <p v-else-if="!report" role="status">The interactive CPU model loads on the client.</p>
    <template v-else>
      <label for="material-bench-source">Complete draft source</label>
      <textarea id="material-bench-source" :value="report.draft" rows="9" spellcheck="false" @input="edit" />
      <div class="actions">
        <button type="button" @click="compile">Compile and adopt</button>
        <button type="button" @click="example('invalidSource')">Try unknown()</button>
        <button type="button" @click="example('correctedSource')">Correct blend, default .5</button>
        <button type="button" @click="example('blendSource')">Reset blend</button>
      </div>
      <p role="status">{{ report.diagnostics.length ? 'Last compile refused. The complete accepted IR and GLSL are retained.' : 'Accepted material ready.' }}</p>
      <ul v-if="report.diagnostics.length" aria-label="Last compile diagnostics">
        <li v-for="(diagnostic, index) in report.diagnostics" :key="index">{{ diagnostic.code }}: {{ diagnostic.message }} [{{ diagnostic.start }}, {{ diagnostic.end }})</li>
      </ul>
      <svg viewBox="0 0 640 64" role="img" aria-label="Static material compilation topology; highlight indicates the selected view">
        <path d="M80 32H560" stroke="currentColor" fill="none" />
        <g v-for="(label, index) in labels" :key="label" :class="{ selected: report.selectedStage === index }">
          <rect :x="index * 160 + 4" y="10" width="152" height="44" rx="6" />
          <text :x="index * 160 + 80" y="37" text-anchor="middle">{{ index + 1 }} · {{ label }}</text>
        </g>
      </svg>
      <div role="tablist" aria-label="Material artifact stage">
        <button v-for="(label, index) in labels" :id="`material-stage-${index}`" :key="label" :ref="element => tabs[index] = element" type="button" role="tab" :aria-selected="report.selectedStage === index" aria-controls="material-stage-panel" :tabindex="report.selectedStage === index ? 0 : -1" @click="choose(index)" @keydown="navigate($event, index)">{{ label }}</button>
      </div>
      <div id="material-stage-panel" role="tabpanel" :aria-labelledby="`material-stage-${report.selectedStage}`" tabindex="0">
        <p>{{ captions[report.selectedStage] }}</p>
        <pre>{{ fullText }}</pre>
      </div>
      <template v-if="accepted">
        <p>Accepted {{ accepted.validated.format }} / version {{ accepted.validated.version }} / {{ accepted.validated.profile }}</p>
        <ul><li v-for="uniform in accepted.lowered.uniformLayout" :key="uniform.name">{{ uniform.name }} → {{ uniform.glslName }} · {{ uniform.type }} · range {{ uniform.min }}–{{ uniform.max }} · default {{ uniform.default }}</li></ul>
      </template>
      <p>Direct APP calls: compile {{ report.calls.compile }} · validate {{ report.calls.validate }} · lower {{ report.calls.lower }}</p>
      <p>Stage selection makes no API calls. These counts exclude internal reconstruction and validation; they are not latency, cache or compiler-work measurements.</p>
    </template>
  </section>
</template>

<style scoped>
.material-bench { padding: 1rem; border: 1px solid var(--vp-c-divider); border-radius: 10px; }
textarea { display: block; box-sizing: border-box; width: 100%; padding: .6rem; border: 1px solid var(--vp-c-divider); font-family: monospace; background: var(--vp-c-bg-soft); }
.actions, [role=tablist] { display: flex; flex-wrap: wrap; gap: .4rem; margin: .8rem 0; }
button { border: 1px solid var(--vp-c-divider); border-radius: 5px; padding: .35rem .65rem; }
button[aria-selected=true] { border-color: var(--vp-c-brand-1); background: var(--vp-c-brand-soft); }
button:focus-visible, textarea:focus-visible, [role=tabpanel]:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; }
svg { width: 100%; height: auto; margin: .7rem 0; }
rect { fill: var(--vp-c-bg-soft); stroke: var(--vp-c-divider); transition: fill .15s; }
.selected rect { fill: var(--vp-c-brand-soft); stroke: var(--vp-c-brand-1); }
text { fill: var(--vp-c-text-1); font-size: 13px; }
pre { max-height: 28rem; overflow: auto; padding: .75rem; background: var(--vp-c-bg-soft); font-size: .8rem; }
@media (prefers-reduced-motion: reduce) { rect { transition: none; } }
</style>

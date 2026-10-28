<script setup>
// The frame every algorithm figure shares: the picture, a numbered row of its steps (any one a click away), the
// current step's text and formula, and the player's controls.
defineProps({ title: String, steps: Array, s: Object });
</script>

<template>
  <section class="algo-figure" :aria-label="title">
    <header>
      <strong>{{ title }}</strong>
      <div class="controls">
        <button type="button" aria-label="Previous step" :disabled="s.step.value === 0" @click="s.prev()">‹</button>
        <button type="button" class="play" :aria-label="s.playing.value ? 'Pause' : 'Play'" @click="s.toggle()">{{ s.playing.value ? 'Pause' : 'Play' }}</button>
        <button type="button" aria-label="Next step" :disabled="s.step.value === steps.length - 1" @click="s.next()">›</button>
      </div>
    </header>
    <div class="picture"><slot /></div>
    <div class="progress" aria-hidden="true"><span :style="{ width: `${100 * (s.step.value + s.t.value) / steps.length}%` }" /></div>
    <ol class="steps">
      <li v-for="(st, i) in steps" :key="i" :class="{ now: i === s.step.value, done: i < s.step.value }">
        <button type="button" :aria-current="i === s.step.value ? 'step' : undefined" :title="st.label" @click="s.go(i)">{{ i + 1 }}</button>
      </li>
    </ol>
    <div class="text" aria-live="polite">
      <strong>{{ s.step.value + 1 }}. {{ steps[s.step.value].label }}</strong>
      <p v-html="steps[s.step.value].text" />
      <div v-if="steps[s.step.value].formula" class="formula" v-html="steps[s.step.value].formula" />
    </div>
    <footer v-if="$slots.note"><slot name="note" /></footer>
  </section>
</template>

<style scoped>
.algo-figure { margin: 24px 0 32px; border: 1px solid var(--vp-c-divider); border-radius: 10px; overflow: hidden; color: var(--vp-c-text-1); background: var(--vp-c-bg); }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--vp-c-divider); }
header strong { font-size: 14px; }
.controls { display: flex; gap: 4px; }
.controls button { border: 1px solid var(--vp-c-divider); border-radius: 5px; min-width: 30px; padding: 3px 9px; font-size: 13px; font-weight: 600; background: var(--vp-c-bg); }
.controls .play { min-width: 64px; }
.controls button:disabled { opacity: 0.4; }
button:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
.picture { background: var(--vp-c-bg-soft); }
.picture :deep(svg) { width: 100%; max-width: 560px; height: auto; display: block; margin: 0 auto; }
.steps { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 12px 16px 0; }
.steps li { margin: 0; }
.steps button { width: 26px; height: 26px; border-radius: 50%; font-size: 12px; font-weight: 700; border: 1px solid var(--vp-c-divider); color: var(--vp-c-text-2); background: var(--vp-c-bg); }
.steps .done button { background: var(--vp-c-default-soft); }
.steps .now button { background: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); color: var(--vp-c-white); }
.text { padding: 10px 16px 14px; min-height: 150px; }
.text strong { font-size: 14px; }
.text p { margin: 6px 0 10px; font-size: 14px; line-height: 1.7; }
.formula { font-family: var(--vp-font-family-mono); font-size: 13px; line-height: 1.9; background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-divider); border-radius: 6px; padding: 8px 12px; overflow-x: auto; white-space: normal; overflow-wrap: break-word; }
.progress { height: 3px; background: var(--vp-c-divider); }
.progress span { display: block; height: 100%; background: var(--vp-c-brand-1); }
footer { padding: 10px 16px; font-size: 12px; line-height: 1.65; color: var(--vp-c-text-2); border-top: 1px solid var(--vp-c-divider); }
</style>

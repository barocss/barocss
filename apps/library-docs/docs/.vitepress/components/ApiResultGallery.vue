<script setup>
import { computed, ref } from 'vue';
import BooleanMeshView from './BooleanMeshView.vue';
import data from './api-result-scenes.json';

const cases = Array.isArray(data.cases) ? data.cases : [];
const caseId = ref(cases[0]?.id ?? '');
const result = computed(() => cases.find(item => item.id === caseId.value));
const available = computed(() => {
  const item = result.value;
  return Boolean(data.format && data.provenance && item?.mesh?.positions?.length
    && item.mesh.normals?.length && item.mesh.indices?.length && Array.isArray(item.mesh.lines)
    && Number.isFinite(item.mass?.volume) && Number.isFinite(item.mass?.mass)
    && Array.isArray(item.mass?.centroid) && Array.isArray(item.mass?.inertia));
});
const scene = computed(() => available.value
  ? { inputs: [result.value.mesh], results: { output: { mesh: result.value.mesh } } }
  : null);
const yaw = ref(-0.65), pitch = ref(-1.05);
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
// Remove a rounded minus sign only in labels; preserve the saved API values.
const n = value => Number.isFinite(value) ? number.format(Math.abs(value) < 0.0005 ? 0 : value) : 'unavailable';
const vector = value => `[${value.map(n).join(', ')}]`;
const provenance = JSON.stringify({ format: data.format, provenance: data.provenance }, null, 2);
function resetView() { yaw.value = -0.65; pitch.value = -1.05; }
function rotate([a, b]) { yaw.value = a; pitch.value = b; }
</script>

<template>
  <section class="api-result-gallery" aria-label="Saved public API results">
    <p v-if="!cases.length" class="result-unavailable" role="status">
      API run: NOT_RUN. No saved API result data is available.
    </p>
    <template v-else>
      <label class="result-picker">API result example
        <select v-model="caseId" aria-label="API result example" @change="resetView">
          <option v-for="item in cases" :key="item.id" :value="item.id">{{ item.title }}</option>
        </select>
      </label>
      <template v-if="available">
        <p class="result-input">{{ result.inputDescription }}</p>
        <div class="result-mesh">
          <BooleanMeshView :scene="scene" :stage="4" operation="output" :yaw="yaw" :pitch="pitch" interactive
            :label="`${result.title}: saved public API mesh, Z up, dimensions in millimetres`" @rotate="rotate" />
        </div>
        <p class="view-note">Drag to rotate · focus the view and use arrow keys.</p>
        <table class="result-mass">
          <thead><tr><th>Returned value</th><th>Result</th></tr></thead>
          <tbody>
            <tr><th>Volume (mm³)</th><td>{{ n(result.mass.volume) }}</td></tr>
            <tr><th>Mass (g)</th><td>{{ n(result.mass.mass) }}</td></tr>
            <tr><th>Centroid [X, Y, Z] (mm)</th><td>{{ vector(result.mass.centroid) }}</td></tr>
          </tbody>
        </table>
        <details>
          <summary>Inertia about the centre of mass (g·mm²)</summary>
          <pre><code>{{ result.mass.inertia.map(vector).join('\n') }}</code></pre>
        </details>
        <p class="result-note">Density: 2.7 g/cm³. Labels round the saved values to three decimal places.</p>
        <p class="code-label">Executed public API code</p>
        <pre class="result-code"><code>{{ result.code }}</code></pre>
      </template>
      <p v-else class="result-unavailable" role="status">
        Saved API result unavailable. No mesh or successful result is shown for this case.
      </p>
      <details v-if="data.format && data.provenance" class="result-provenance">
        <summary>Source bundle provenance</summary>
        <pre><code>{{ provenance }}</code></pre>
      </details>
    </template>
  </section>
</template>

<style scoped>
.api-result-gallery { margin: 24px 0; padding: 18px; border: 1px solid var(--vp-c-divider); border-radius: 8px; }
.result-picker { display: grid; gap: 7px; font-size: 13px; font-weight: 600; }
select { width: 100%; padding: 8px; border: 1px solid var(--vp-c-divider); border-radius: 5px; background: var(--vp-c-bg); color: var(--vp-c-text-1); font: inherit; }
select:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; }
.result-input { font-size: 14px; }
.result-mesh { aspect-ratio: 1.65; overflow: hidden; border-radius: 5px; }
.view-note, .result-note { font-size: 12px; color: var(--vp-c-text-2); }
.result-mass { width: 100%; display: table; font-size: 13px; }
.result-mass th { text-align: left; }
.result-mass td { font-variant-numeric: tabular-nums; }
.code-label { margin-bottom: 6px; font-size: 13px; font-weight: 600; }
pre { padding: 12px; overflow-x: auto; background: var(--vp-code-block-bg); font-size: 12px; line-height: 1.6; }
pre code { padding: 0; background: transparent; white-space: pre; }
details { margin-top: 14px; font-size: 12px; }
summary { cursor: pointer; }
.result-unavailable { font-size: 13px; }
@media (max-width: 640px) {
  .api-result-gallery { padding: 12px; }
  .result-mesh { aspect-ratio: 1.15; }
  .result-mass { display: block; overflow-x: auto; }
}
</style>

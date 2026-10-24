<script setup>
import { computed, ref } from 'vue';
import BooleanMeshView from './BooleanMeshView.vue';
import data from './boolean-scenes.json';
const caseId = ref('boxes'), operation = ref('difference'), stage = ref(4), yaw = ref(-0.65), pitch = ref(-1.05);
const scene = computed(() => data.cases.find(c => c.id === caseId.value));
const result = computed(() => scene.value.results[operation.value]);
const operations = { union: 'Union · A ∪ B', difference: 'Subtract · A − B', intersect: 'Intersect · A ∩ B' };
const stages = ['Input solids', 'Find intersections', 'Split the faces', 'Select face pieces', 'Stitch the result'];
const descriptions = computed(() => [
  'Blue is A. Amber is B. Each shape has surfaces, boundary curves and closed loops. Compare the dimensions below.',
  'Red curves lie on both input boundaries. Red dots mark curve sample endpoints. Curves are shown through the solids so the rear cuts remain visible.',
  'Separated surface patches show the cuts. Blue patches are outside the other solid; amber patches are inside. The gaps are only an exploded view.',
  operation.value === 'difference' ? 'Keep A’s faces outside B, plus B’s faces inside A. Reverse the retained B faces so their normals point into the empty cavity. Green shows the selected boundary; faint outlines show candidates.'
    : operation.value === 'union' ? 'Keep the outside face pieces from A and B. Remove the interior boundary. Green shows the selected boundary; faint outlines show candidates.'
      : 'Keep the face pieces inside the other solid. Green shows their common boundary; faint outlines show candidates.',
  'Join matching boundary edges into loops, shells and bodies. Remove duplicated boundaries and check the B-rep. The green solid is the native kernel result.',
]);
const rotate = ([a, b]) => { yaw.value = a; pitch.value = b; };
function reset() { yaw.value = -0.65; pitch.value = -1.05; }
function changeCase() { reset(); }
const n = value => value.toFixed(3).replace(/\.?0+$/, '');
</script>
<template>
  <section class="boolean-stages" aria-label="3D Boolean stages">
    <div class="stage-controls">
      <label>3D example
        <select v-model="caseId" @change="changeCase" aria-label="3D Boolean example">
          <option v-for="item in data.cases" :key="item.id" :value="item.id">{{ item.title }}</option>
        </select>
      </label>
      <label>Operation
        <select v-model="operation" aria-label="3D Boolean operation">
          <option v-for="(title, key) in operations" :key="key" :value="key">{{ title }}</option>
        </select>
      </label>
    </div>
    <div class="case-definitions"><code>{{ scene.a }}</code><code>{{ scene.b }}</code></div>
    <div class="stage-main">
      <div class="main-canvas">
        <BooleanMeshView :scene="scene" :stage="stage" :operation="operation" :yaw="yaw" :pitch="pitch" interactive
          :label="`${scene.title}: ${stages[stage]}, ${operations[operation]}`" @rotate="rotate" />
        <span class="stage-badge">0{{ stage + 1 }} / 05 · {{ stages[stage] }}</span>
      </div>
      <div class="view-tools"><span>Drag to rotate · focus the view and use arrow keys</span><button type="button" @click="reset">Reset 3D view</button></div>
      <div class="stage-description" aria-live="polite"><strong>{{ stages[stage] }}</strong><p>{{ descriptions[stage] }}</p></div>
    </div>
    <div class="stage-strip" role="group" aria-label="Choose a Boolean stage">
      <button v-for="(title, i) in stages" :key="title" type="button" :aria-pressed="stage === i" :aria-label="`Stage ${i + 1}: ${title}`" @click="stage = i">
        <div class="thumbnail" aria-hidden="true"><BooleanMeshView :scene="scene" :stage="i" :operation="operation" :yaw="yaw" :pitch="pitch" :label="title" /></div>
        <span><small>0{{ i + 1 }}</small>{{ title }}</span>
      </button>
    </div>
    <div class="stage-navigation"><button type="button" :disabled="stage === 0" @click="stage--">← Previous stage</button><button type="button" :disabled="stage === 4" @click="stage++">Next stage →</button></div>
    <div class="native-result" aria-live="polite">
      <div><span>Final {{ operation === 'difference' ? 'A − B' : operation === 'union' ? 'A ∪ B' : 'A ∩ B' }}</span><strong data-native-boolean-volume>{{ n(result.volume) }} <small>mm³</small></strong></div>
      <p>{{ result.bodies }} {{ result.bodies === 1 ? 'body' : 'bodies' }} · {{ result.faces }} B-rep faces · strict validity check passed for this fixed example</p>
    </div>
    <div class="case-explanation"><strong>{{ scene.path }}</strong><p><code>{{ scene.equation }}</code></p><p>{{ scene.detail }}</p></div>
    <details class="stage-boundary"><summary>What the stage pictures show</summary>
      <p>These five fixed examples have their own dimensions. The 3D result is a tessellation of the kernel’s evaluated B-rep.
        Display triangles approximate curved surfaces; they are not the surfaces used to compute the Boolean.</p>
      <p>The split view reconstructs the boundary partition from evaluated union and intersection faces. It illustrates the algorithm;
        it is not an execution trace of intermediate kernel calls. Exploding faces adds display gaps only.
        Red curve dots are samples, not a count of topological vertices.</p>
      <p>Selection concerns surface pieces. It differs from the material-region table above. Coincident faces need orientation checks and one retained copy.
        These successful examples do not establish support for every tangent, mesh or NURBS input.</p>
    </details>
  </section>
</template>
<style scoped>
.boolean-stages { margin: 28px 0 36px; border: 1px solid var(--vp-c-divider); border-radius: 12px; padding: 20px; }
.stage-controls { display: flex; gap: 18px; flex-wrap: wrap; }
.stage-controls label { flex: 1; min-width: 180px; display: grid; gap: 7px; font-size: 13px; font-weight: 600; }
select { border: 1px solid var(--vp-c-divider); border-radius: 6px; padding: 8px; background: var(--vp-c-bg); color: var(--vp-c-text-1); width: 100%; font: inherit; }
.case-definitions { display: grid; gap: 6px; margin: 16px 0; }
.case-definitions code { white-space: normal; font-size: 12px; }
.main-canvas { aspect-ratio: 1.65; position: relative; overflow: hidden; border-radius: 8px; }
.stage-badge { position: absolute; top: 13px; left: 14px; color: #e6f0ff; font-size: 12px; pointer-events: none; background: #0e1421bd; padding: 3px 7px; border-radius: 4px; }
.view-tools { display: flex; justify-content: space-between; gap: 10px; align-items: center; margin: 9px 0 16px; font-size: 11px; color: var(--vp-c-text-2); }
button { border: 1px solid var(--vp-c-divider); border-radius: 5px; font: inherit; color: var(--vp-c-text-1); padding: 5px 9px; cursor: pointer; }
button:focus-visible, select:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; }
.stage-description { min-height: 126px; border-left: 3px solid #2fb584; padding-left: 14px; }
.stage-description p, .case-explanation p, .stage-boundary p { font-size: 13px; line-height: 1.7; margin: 7px 0 13px; }
.stage-strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-top: 20px; }
.stage-strip button { overflow: hidden; padding: 0; text-align: left; background: var(--vp-c-bg); }
.stage-strip button[aria-pressed=true] { border-color: var(--vp-c-brand-1); box-shadow: 0 0 0 1px var(--vp-c-brand-1); }
.thumbnail { height: 86px; pointer-events: none; }
.stage-strip span { display: flex; flex-direction: column; gap: 3px; padding: 7px; font-size: 10px; line-height: 1.4; min-height: 53px; }
.stage-strip small { color: var(--vp-c-text-2); font-size: 10px; }
.stage-navigation { display: flex; justify-content: space-between; margin: 14px 0; font-size: 12px; }
button:disabled { opacity: 0.35; cursor: default; }
.native-result { padding: 16px 0; border-block: 1px solid var(--vp-c-divider); margin: 20px 0; }
.native-result div { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.native-result span { font-size: 13px; }.native-result strong { color: #208c67; font-size: 25px; white-space: nowrap; }
.native-result small { font-size: 13px; }.native-result p { font-size: 11px; margin: 6px 0 0; color: var(--vp-c-text-2); }
.case-explanation strong { font-size: 13px; }.case-explanation code { white-space: normal; }.stage-boundary summary { cursor: pointer; font-size: 12px; color: var(--vp-c-text-2); }
@media (max-width: 640px) {
  .boolean-stages { padding: 12px; }.stage-controls { gap: 10px; }.stage-controls label { min-width: 100%; }
  .main-canvas { aspect-ratio: 1.15; }.view-tools { align-items: flex-start; }.view-tools span { max-width: 60%; }.view-tools button { white-space: nowrap; }
  .stage-strip { grid-template-columns: repeat(2,minmax(0,1fr)); }.stage-strip button:last-child { grid-column: 1 / -1; }.thumbnail { height: 110px; }
  .stage-strip span { min-height: 0; font-size: 12px; }.stage-description { min-height: 0; }.native-result div { flex-wrap: wrap; }
}
</style>

<script setup>
import { computed, ref, useId } from 'vue';
import { HEIGHT, RADIUS, exampleGeometry, keepRegion, numberLabel as n, planX, planY, project, polygon, cubeFaces, cylinderSide } from './booleanGeometry.mjs';

const id = 'boolean-' + useId().replace(/[^a-z0-9-]/gi, '');
const shape = ref('box'), x = ref(5), operation = ref('difference');
const geometry = computed(() => exampleGeometry(shape.value, x.value));
const volume = computed(() => geometry.value.areas[operation.value] * HEIGHT);
const names = { union: 'Union · A ∪ B', difference: 'Subtract · A − B', intersect: 'Intersect · A ∩ B' };
const expression = computed(() => operation.value === 'union'
  ? `1000 + ${n(geometry.value.bArea * HEIGHT)} − ${n(geometry.value.common * HEIGHT)}`
  : operation.value === 'difference' ? `1000 − ${n(geometry.value.common * HEIGHT)}` : `${n(geometry.value.common)} × 10`);
const toolCode = computed(() => shape.value === 'box'
  ? `p.box({ w: 10, d: 10, h: 10, x: ${x.value} })`
  : `p.cylinder({ r: 3, h: 10, x: ${x.value}, y: 5 })`);
const top = computed(() => project(x.value, 5, HEIGHT));
const bottom = computed(() => project(x.value, 5, 0));
const cuts = computed(() => [...new Set([0, 10, x.value, x.value + 10])].sort((a, b) => a - b));
const reach = computed(() => ({
  min: Math.min(0, shape.value === 'box' ? x.value : x.value - RADIUS),
  max: Math.max(10, shape.value === 'box' ? x.value + 10 : x.value + RADIUS),
}));
const ticks = computed(() => {
  const out = [];
  for (let t = Math.floor(reach.value.min / 5) * 5; t <= Math.ceil(reach.value.max / 5) * 5; t += 5) out.push(t);
  return out;
});
const planBox = computed(() => `${planX(ticks.value[0]) - 24} 66 ${planX(ticks.value.at(-1)) - planX(ticks.value[0]) + 48} 147`);
const solidBox = computed(() => {
  const left = project(reach.value.min, 0, 0)[0] - 24;
  const right = Math.max(project(reach.value.max, 10, 0)[0], project(16, 0, 0)[0]) + 24;
  const width = Math.max(220, right - left);
  return `${(left + right - width) / 2} 40 ${width} 200`;
});
function changeShape(event) { shape.value = event.target.value; x.value = shape.value === 'box' ? 5 : 8; }
</script>

<template>
  <section class="boolean-walkthrough" aria-label="Boolean numerical walkthrough">
    <div class="controls">
      <label>Tool shape
        <select :value="shape" aria-label="Boolean tool shape" @change="changeShape">
          <option value="box">Box + box</option><option value="cylinder">Box + cylinder</option>
        </select>
      </label>
      <div class="operations" role="group" aria-label="Boolean operation">
        <button v-for="(label, key) in names" :key="key" type="button" :aria-pressed="operation === key"
          @click="operation = key">{{ label }}</button>
      </div>
    </div>
    <label class="position">{{ shape === 'box' ? 'B left edge' : 'B centre' }} · X = {{ x }} mm
      <input v-model.number="x" type="range" :min="shape === 'box' ? -12 : -6" :max="shape === 'box' ? 20 : 16"
        step="1" aria-label="Boolean tool X position" />
      <span>Move left or right to overlap, touch, or separate the bodies.</span>
    </label>

    <div class="figures">
      <figure>
        <figcaption><span>01</span> Numbers define two solids</figcaption>
        <svg :viewBox="solidBox" role="img" aria-label="Isometric input solids A and B, each 10 mm high">
          <g class="axes">
            <polyline :points="polygon([project(15, 0, 0), project(0, 0, 0), project(0, 13, 0)])" />
            <line :x1="project(0, 0, 0)[0]" :y1="project(0, 0, 0)[1]" :x2="project(0, 0, 14)[0]" :y2="project(0, 0, 14)[1]" />
            <text :x="project(16, 0, 0)[0]" :y="project(16, 0, 0)[1] + 5">X</text>
            <text :x="project(0, 14, 0)[0]" :y="project(0, 14, 0)[1]">Y</text>
            <text :x="project(0, 0, 15)[0]" :y="project(0, 0, 15)[1]">Z</text>
          </g>
          <polygon v-for="(face, i) in cubeFaces(0)" :key="'a' + i" :points="face" class="solid-a" :fill-opacity="0.26 + i * 0.1" />
          <template v-if="shape === 'box'">
            <polygon v-for="(face, i) in cubeFaces(x)" :key="'b' + i" :points="face" class="solid-b" :fill-opacity="0.18 + i * 0.12" />
          </template>
          <template v-else>
            <ellipse :rx="RADIUS" :ry="RADIUS" :transform="`matrix(6 1.7 3.4 -2.8 ${bottom[0]} ${bottom[1]})`" class="cylinder-base" />
            <polygon :points="cylinderSide(x)" class="solid-b" fill-opacity="0.3" />
            <ellipse :rx="RADIUS" :ry="RADIUS" :transform="`matrix(6 1.7 3.4 -2.8 ${top[0]} ${top[1]})`" class="solid-b" fill-opacity="0.45" />
          </template>
          <text :x="project(2, 4, 10)[0]" :y="project(2, 4, 10)[1] - 8" class="label-a">A</text>
          <text :x="project(shape === 'box' ? x + 8 : x, 5, 10)[0] + 6" :y="project(shape === 'box' ? x + 8 : x, 5, 10)[1] - 8" class="label-b">B</text>
        </svg>
        <p class="figure-note">Both extend from Z = 0 to Z = 10 mm.</p>
      </figure>
      <figure>
        <figcaption><span>02</span> Select the XY region to keep</figcaption>
        <svg :viewBox="planBox" role="img" :aria-label="`${names[operation]} cross-section; area ${n(geometry.areas[operation])} square mm`">
          <defs>
            <rect :id="id + '-a'" :x="planX(0)" :y="planY(10)" width="80" height="80" />
            <rect v-if="shape === 'box'" :id="id + '-b'" :x="planX(x)" :y="planY(10)" width="80" height="80" />
            <circle v-else :id="id + '-b'" :cx="planX(x)" :cy="planY(5)" :r="RADIUS * 8" />
            <mask :id="id + '-inside-a'" maskUnits="userSpaceOnUse" x="0" y="0" width="420" height="240">
              <use :href="'#' + id + '-a'" fill="white" />
            </mask>
            <mask :id="id + '-subtract'" maskUnits="userSpaceOnUse" x="0" y="0" width="420" height="240">
              <use :href="'#' + id + '-a'" fill="white" /><use :href="'#' + id + '-b'" fill="black" />
            </mask>
          </defs>
          <g class="grid">
            <line v-for="tick in ticks" :key="tick" :x1="planX(tick)" y1="64" :x2="planX(tick)" y2="183" />
            <line v-for="tick in [0, 5, 10]" :key="tick" x1="36" :y1="planY(tick)" x2="388" :y2="planY(tick)" />
          </g>
          <g class="kept">
            <template v-if="operation === 'union'"><use :href="'#' + id + '-a'" /><use :href="'#' + id + '-b'" /></template>
            <rect v-else-if="operation === 'difference'" width="420" height="240" :mask="`url(#${id}-subtract)`" />
            <use v-else :href="'#' + id + '-b'" :mask="`url(#${id}-inside-a)`" />
          </g>
          <use :href="'#' + id + '-a'" class="outline-a" /><use :href="'#' + id + '-b'" class="outline-b" />
          <g v-if="shape === 'box'" class="split-lines">
            <line v-for="cut in cuts" :key="cut" :x1="planX(cut)" y1="87" :x2="planX(cut)" y2="184" />
          </g>
          <g v-for="(point, i) in geometry.points" :key="i" class="crossing">
            <circle :cx="planX(point[0])" :cy="planY(point[1])" r="3.5" />
            <text :x="planX(point[0]) + 7" :y="planY(point[1]) - 7">P{{ i + 1 }}</text>
          </g>
          <g class="axis-labels">
            <text v-for="tick in ticks" :key="tick" :x="planX(tick)" y="201" text-anchor="middle">{{ tick }}</text>
            <text :x="planX(ticks.at(-1)) + 14" y="201">X</text><text :x="planX(0) - 15" :y="planY(10) + 4">10</text>
            <text :x="planX(0) - 10" :y="planY(0) - 4">0</text>
          </g>
        </svg>
        <p class="figure-note">Green = kept material · dashed amber = B</p>
      </figure>
    </div>

    <div class="definitions">
      <div><strong>A · box</strong><code>X [0, 10] · Y [0, 10] · Z [0, 10]</code><span>Volume = 1000 mm³</span></div>
      <div><strong>B · {{ shape }}</strong>
        <code v-if="shape === 'box'">X [{{ x }}, {{ x + 10 }}] · Y [0, 10] · Z [0, 10]</code>
        <code v-else>Centre ({{ x }}, 5) · radius 3 · Z [0, 10]</code>
        <span>Volume = {{ n(geometry.bArea * HEIGHT) }} mm³</span>
      </div>
    </div>
    <div class="boundary">
      <strong>03 · Split at the boundary crossings</strong>
      <template v-if="shape === 'box'"><p>Section boundaries: X = {{ cuts.join(', ') }} mm; Y = 0 and 10 mm.</p></template>
      <template v-else>
        <p>The circular wall is <code>(x − {{ x }})² + (y − 5)² = 9</code>. Intersect it with X = 0 or X = 10.</p>
        <p v-if="geometry.points.length">{{ geometry.points.map((p, i) => `P${i + 1} = (${n(p[0])}, ${n(p[1])})`).join(' · ') }} mm</p>
        <p v-else>No boundary crossing: the circle is contained or disjoint. Classify it to decide which.</p>
      </template>
      <p v-if="geometry.common === 0">Common area = 0. A shared boundary alone adds no solid intersection volume.</p>
    </div>
    <div class="region-table">
      <table>
        <thead><tr><th>Region</th><th>Inside A</th><th>Inside B</th><th>Area (mm²)</th><th>Keep?</th></tr></thead>
        <tbody><tr v-for="region in geometry.regions" :key="region.id" :class="{ selected: region.area > 0 && keepRegion(operation, region) }">
          <th>{{ region.label }}</th><td>{{ region.inA ? 'yes' : 'no' }}</td><td>{{ region.inB ? 'yes' : 'no' }}</td>
          <td>{{ n(region.area) }}</td><td>{{ region.area === 0 ? 'empty' : keepRegion(operation, region) ? 'keep' : 'discard' }}</td>
        </tr></tbody>
      </table>
    </div>
    <div class="answer" aria-live="polite" aria-atomic="true">
      <span>04 · Extrude the kept section through 10 mm</span>
      <strong data-boolean-volume>{{ n(volume) }} <small>mm³</small></strong>
      <code>{{ expression }} {{ shape === 'cylinder' ? '≈' : '=' }} {{ n(volume) }} mm³</code>
      <span>Kept area {{ n(geometry.areas[operation]) }} mm² × height 10 mm.</span>
    </div>
    <details class="numeric-input">
      <summary>The same numbers in the object API</summary>
      <pre><code>const a = part('A').box({ w: 10, d: 10, h: 10 });
const result = a.{{ operation === 'difference' ? 'subtract' : operation }}(p =&gt; {{ toolCode }});</code></pre>
      <p>A box lowers to a rectangular sketch plus an extrusion. A cylinder lowers to a circular sketch plus an extrusion.
        The shared height levels are 0 and 10, so these cases use one height interval in the prismatic path.</p>
    </details>
    <p class="scope">The figures use closed-form geometry for these two examples. Calculations use unrounded values;
      labels display up to three decimal places, so cylinder equations use ≈.
      The documentation tests compare these displayed volumes with the CAD kernel. This is an explanation of the prismatic path;
      general curved-surface and mesh paths are described below.</p>
  </section>
</template>

<style scoped>
.boolean-walkthrough { margin: 24px 0 32px; border: 1px solid var(--vp-c-divider); border-radius: 10px; overflow: hidden; color: var(--vp-c-text-1); --a: #167e9a; --b: #b87412; --keep: #24956d; }
.controls { display: flex; flex-wrap: wrap; gap: 14px; align-items: end; padding: 18px 18px 0; }
.controls label { font-size: 12px; display: grid; gap: 5px; }
select { border: 1px solid var(--vp-c-divider); border-radius: 5px; background: var(--vp-c-bg); padding: 6px 24px 6px 9px; font: inherit; font-size: 13px; }
.operations { display: flex; flex-wrap: wrap; gap: 4px; }
.operations button { border: 1px solid var(--vp-c-divider); border-radius: 5px; padding: 6px 9px; font-size: 12px; font-weight: 600; }
.operations button[aria-pressed="true"] { color: var(--vp-c-bg); background: var(--vp-c-text-1); border-color: var(--vp-c-text-1); }
button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; }
.position { margin: 18px; display: grid; gap: 7px; font-size: 13px; font-weight: 600; }
.position input { width: 100%; accent-color: var(--keep); }
.position span, .caption, .scope { font-size: 12px; color: var(--vp-c-text-2); font-weight: 400; }
.figures { display: grid; grid-template-columns: 1fr 1fr; border-block: 1px solid var(--vp-c-divider); background: var(--vp-c-bg-soft); }
figure { margin: 0; min-width: 0; }
figure + figure { border-left: 1px solid var(--vp-c-divider); }
figcaption { font-size: 12px; font-weight: 600; padding: 12px 14px 0; }
figcaption span { color: var(--vp-c-text-3); margin-right: 5px; font-variant-numeric: tabular-nums; }
svg { width: 100%; height: 240px; display: block; overflow: hidden; }
.figure-note { padding: 0 14px 12px; margin: 0; font-size: 11px; line-height: 1.6; color: var(--vp-c-text-2); }
svg text { font-family: var(--vp-font-family-base); font-size: 12px; fill: var(--vp-c-text-2); }
.axes polyline, .axes line { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1; }
.solid-a { fill: var(--a); stroke: var(--a); stroke-width: 1.5; }
.solid-b { fill: var(--b); stroke: var(--b); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
.cylinder-base { fill: none; stroke: var(--b); stroke-width: 1; stroke-dasharray: 3 3; vector-effect: non-scaling-stroke; }
.label-a, .label-b { font-size: 16px; font-weight: 700; fill: var(--a); }
.label-b { fill: var(--b); }
.grid line { stroke: var(--vp-c-divider); stroke-width: 0.75; }
.kept { fill: var(--keep); }
.outline-a, .outline-b { fill: none; stroke: var(--a); stroke-width: 1.5; }
.outline-b { stroke: var(--b); stroke-dasharray: 5 3; }
.split-lines line { stroke: var(--vp-c-text-3); stroke-width: 0.8; stroke-dasharray: 2 3; }
.crossing circle { fill: #c75351; stroke: var(--vp-c-bg); stroke-width: 1; }
.crossing text { fill: #c75351; font-size: 11px; font-weight: 700; }
.axis-labels text { font-size: 11px; }
.definitions { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding: 16px 18px; border-bottom: 1px solid var(--vp-c-divider); }
.definitions > div { display: grid; gap: 5px; font-size: 12px; min-width: 0; }
.definitions strong { color: var(--a); }.definitions > div + div strong { color: var(--b); }
.definitions code { font-size: 11px; white-space: normal; line-height: 1.6; }
.definitions span { color: var(--vp-c-text-2); font-variant-numeric: tabular-nums; }
.boundary { padding: 15px 18px 0; font-size: 13px; }
.boundary p { margin: 7px 0; font-size: 12px; line-height: 1.7; }
.region-table { overflow-x: auto; padding: 0 18px; }
.region-table table { width: 100%; display: table; margin: 14px 0 18px; font-size: 12px; }
.region-table th, .region-table td { padding: 5px 8px; white-space: nowrap; font-size: inherit; }
.region-table tbody th { text-align: left; }.selected { color: var(--keep); font-weight: 600; }
.answer { padding: 18px; background: var(--vp-c-bg-soft); display: grid; gap: 7px; border-block: 1px solid var(--vp-c-divider); }
.answer > span { font-size: 12px; color: var(--vp-c-text-2); }.answer strong { font-size: 30px; line-height: 1.3; font-variant-numeric: tabular-nums; color: var(--keep); }
.answer small { font-size: 16px; font-weight: 400; }.answer code { font-size: 12px; width: fit-content; max-width: 100%; white-space: normal; }
.numeric-input { padding: 14px 18px; font-size: 13px; }.numeric-input summary { cursor: pointer; font-weight: 600; }
.numeric-input pre { font-size: 11px; overflow-x: auto; line-height: 1.7; padding: 10px 0; }.numeric-input pre code { background: none; padding: 0; }
.numeric-input p { font-size: 12px; line-height: 1.7; }.scope { padding: 0 18px 16px; margin: 0; line-height: 1.7; }
:global(.dark) .boolean-walkthrough { --a: #66bad3; --b: #e4b866; --keep: #6dcb9e; }
@media (max-width: 600px) { .figures, .definitions { grid-template-columns: 1fr; } figure + figure { border-left: 0; border-top: 1px solid var(--vp-c-divider); } .operations { width: 100%; } .operations button { flex: 1; } .region-table table { font-size: 11px; } .region-table th, .region-table td { padding: 5px 4px; } }
</style>

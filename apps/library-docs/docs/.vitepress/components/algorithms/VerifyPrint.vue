<script setup>
// Fingerprints and shape records (packages/barocss-cad/scripts/perf-bench.mjs, r5-fingerprint.mjs; the performance
// report §3.2–3.4). The case is the conformance case r2-cylinder-block-union, evaluated by the built kernel in a scratch
// script: its B-rep's JSON (typed arrays as arrays, as perf-bench writes it) hashed with sha256, twice; then the same
// JSON with vertex u_v0's x moved by one ulp (5 → 5.000000000000001) hashed; and both shape records (perf-bench's
// shapeOf). The boss-chain counts are D282's; the corpus digests D276's table.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const DIGEST = 'd0126fb656f39bf3e37009e364bdec8bc21b2d10011c645497832baf0051673e';
const DIGEST_ULP = '613ba38c80edee37051b960161805a5ce7a8cef07c473c6b68d6f824392a941d';
const SHOW = 16; // perf-bench keeps the first 16 hex digits
const JSON_LINES = ['{"format":"barocss-brep",', ' "version":0, …', ' "bodies":[{"id":"u_b0",…}],', ' "faces":[ … 9 faces … ],', ' "edges":[ … 18 edges … ],', ' "vertices":[{"id":"u_v0",', '   "point":[5,0,0], …}, …]}'];
const ULP_LINE = '  "point":[5.000000000000001,…';
const SHAPE = [
  ['valid', 'true', 'true', 'equal'], ['bodies', '1', '1', 'equal'], ['faces', '9', '9', 'equal'], ['edges', '18', '18', 'equal'],
  ['vertices', '12', '12', 'equal'], ['volume', '849.398163397448', '849.398163397448', 'Δ ≤ 10⁻⁷ V'], ['centroid z', '5.527432268287556', '5.527432268287556', '|Δc| ≤ 10⁻⁵'],
];
const steps = [
  { label: 'Hash the whole result', text: 'The result is the B-rep itself: every vertex, curve, surface, loop and name, written as JSON (23,713 bytes for this small case: a Ø10 cylinder with a 4 × 4 block through its top, 9 faces, 18 edges, 12 vertices). sha256 turns it into one digest. The bench prints its first 16 hex digits per workload.', formula: 'fp = sha256(JSON(result))' },
  { label: 'A pure refactor: the same digest', text: 'A change that should alter nothing — moved code, fewer allocations, a cache — runs every workload on the old build and the new one. Each digest must match. The bench also runs each workload three times and stops if two of its runs differ: a result must not depend on what ran before.', formula: 'SAME ⇔ fp(old build) = fp(new build)' },
  { label: 'One ulp is a different result', text: 'Move one coordinate by one unit in the last place, 5 → 5.000000000000001: the digest has nothing in common with the first. A hash answers only <i>same</i> or <i>not</i>; it says nothing about how far apart.', formula: 'fp = 613ba38c80edee37…  ≠  d0126fb656f39bf3…' },
  { label: 'Within tolerance: the shape record', text: 'A change judged within tolerance (another order of operations, a different tolerance rule) cannot keep every bit. It is compared by its shape instead: validity, bodies, faces, edges and vertices exactly; volume and centroid to a bound. The one-ulp result has the same shape.', formula: 'counts equal · |ΔV| ≤ 10⁻⁷ |V| · |Δc| ≤ 10⁻⁵ mm' },
  { label: 'What the shape record caught', text: 'A faster stitch was compared with the full rebuild on a rounded plate with 12 bosses: one edge and one vertex fewer. Tracing it found a fault in the rebuild, not the stitch: a half circle read back after the sixth Boolean had sweep −3.141592653589794, one ulp past π, and was split at its top. Arcs are now split only past π + 10⁻¹²; both give 87 edges and 58 vertices (D282).', formula: 'DIFF rounded-plate-bosses-12: edges 88 → 87; vertices 59 → 58' },
  { label: 'One digest for the whole corpus', text: '<code>r5-fingerprint.mjs</code> runs every conformance and robustness corpus case and 200 fuzz trees of each of two seeds. Per output it writes the validity, face/edge/vertex counts, area and mass as float64 hex and a sha256 of the tessellation; a refusal by name, code and message. One sha256 over all of it: 869 cases gave <code>4e3603b7…</code> before and after the R7.3a error-class refactor (D272).', formula: 'sha256(869 lines) = 4e3603b7…  before = after' },
];
const s = useSteps(steps.length, [3400, 2800, 2800, 3000, 3600, 3600], root);
const typed = (d, u) => d.slice(0, Math.max(0, Math.min(SHOW, Math.floor(u * (SHOW + 0.99)))));
const rowA = computed(() => s.step.value === 0 ? Math.min(JSON_LINES.length, Math.floor(ease(Math.min(1, s.t.value * 1.4)) * (JSON_LINES.length + 0.99))) : JSON_LINES.length);
const digestA = computed(() => s.step.value === 0 ? typed(DIGEST, Math.max(0, s.t.value * 1.6 - 0.6)) : DIGEST.slice(0, SHOW));
const digestB = computed(() => {
  const u = Math.max(0, ease(s.t.value) * 1.4 - 0.4);
  if (s.step.value === 1) return typed(DIGEST, u);
  if (s.step.value === 2) return typed(DIGEST_ULP, u);
  return '';
});
const bDone = computed(() => digestB.value.length === SHOW);
const ulp = computed(() => s.step.value === 2);
const shapeRows = computed(() => s.step.value === 3 ? Math.floor(ease(s.t.value) * (SHAPE.length + 0.99)) : SHAPE.length);
// The corpus: 869 cells in rows of 29.
const CELLS = Array.from({ length: 869 }, (_, k) => `M${16 + 4 * (k % 29)},${40 + 4 * Math.floor(k / 29)}h3v3h-3Z`);
const ALL = CELLS.join('');
const done = computed(() => s.step.value === 5 ? Math.floor(ease(Math.min(1, s.t.value * 1.3)) * 869) : 0);
const donePath = computed(() => CELLS.slice(0, done.value).join(''));
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Fingerprints and shape records" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="A B-rep's JSON hashed to a digest, compared with the digest after a change; a shape record compared field by field; a corpus of 869 cases hashed to one digest">
        <!-- Steps 1–3: two results and their digests. -->
        <g v-if="s.step.value <= 2">
          <text x="12" y="18" class="label">r2-cylinder-block-union · current build</text>
          <rect x="10" y="24" width="186" height="84" rx="5" class="doc" />
          <text v-for="(l, i) in JSON_LINES" :key="'a' + i" v-show="i < rowA" x="16" :y="38 + 11 * i" class="code">{{ l }}</text>
          <line x1="198" y1="66" x2="210" y2="66" class="arrow" />
          <rect x="212" y="54" width="44" height="24" rx="4" class="hash" /><text x="234" y="70" text-anchor="middle" class="hashl">sha256</text>
          <line x1="258" y1="66" x2="264" y2="66" class="arrow" />
          <text x="266" y="70" class="digest">{{ digestA }}</text>
          <g v-if="s.step.value >= 1">
            <text x="12" y="128" class="label">{{ ulp ? 'the same, one coordinate moved one ulp' : 'run again (or the refactored build)' }}</text>
            <rect x="10" y="134" width="186" height="84" rx="5" class="doc" />
            <text v-for="(l, i) in JSON_LINES" :key="'b' + i" x="16" :y="148 + 11 * i" class="code" :class="{ changed: ulp && i === 6 }">{{ ulp && i === 6 ? ULP_LINE : l }}</text>
            <line x1="198" y1="176" x2="210" y2="176" class="arrow" />
            <rect x="212" y="164" width="44" height="24" rx="4" class="hash" /><text x="234" y="180" text-anchor="middle" class="hashl">sha256</text>
            <line x1="258" y1="176" x2="264" y2="176" class="arrow" />
            <text x="266" y="180" class="digest"><tspan v-for="(ch, i) in digestB" :key="i" :class="{ off: ulp && ch !== DIGEST[i] }">{{ ch }}</tspan></text>
            <g v-if="bDone">
              <rect x="290" y="110" width="44" height="20" rx="10" class="badge" :class="ulp ? 'diff' : 'same'" />
              <text x="312" y="124" text-anchor="middle" class="badgel">{{ ulp ? 'DIFF' : 'SAME' }}</text>
            </g>
          </g>
        </g>
        <!-- Step 4: the shape record. -->
        <g v-if="s.step.value === 3">
          <text x="12" y="20" class="label">shape record: before and one ulp after</text>
          <text x="12" y="42" class="th">field</text><text x="86" y="42" class="th">before</text><text x="200" y="42" class="th">after</text><text x="312" y="42" class="th">rule</text>
          <line x1="10" y1="48" x2="370" y2="48" class="rule" />
          <g v-for="(r, i) in SHAPE" :key="r[0]" v-show="i < shapeRows">
            <text x="12" :y="66 + 20 * i" class="small">{{ r[0] }}</text>
            <text x="86" :y="66 + 20 * i" class="code">{{ r[1] }}</text>
            <text x="200" :y="66 + 20 * i" class="code">{{ r[2] }}</text>
            <text x="312" :y="66 + 20 * i" class="small keep">✓ {{ r[3] }}</text>
          </g>
          <g v-if="shapeRows >= SHAPE.length"><rect x="300" y="200" width="44" height="20" rx="10" class="badge same" /><text x="322" y="214" text-anchor="middle" class="badgel">SAME</text></g>
        </g>
        <!-- Step 5: the boss chain. -->
        <g v-if="s.step.value === 4">
          <text x="12" y="20" class="label">rounded plate + 12 bosses</text>
          <text x="12" y="44" class="th">build</text><text x="200" y="44" class="th">faces</text><text x="250" y="44" class="th">edges</text><text x="306" y="44" class="th">vertices</text>
          <line x1="10" y1="50" x2="370" y2="50" class="rule" />
          <text x="12" y="70" class="small">full rebuild (before D282)</text><text x="200" y="70" class="code">43</text><text x="250" y="70" class="code hot">88</text><text x="306" y="70" class="code hot">59</text>
          <text x="12" y="92" class="small">incremental stitch</text><text x="200" y="92" class="code">43</text><text x="250" y="92" class="code">87</text><text x="306" y="92" class="code">58</text>
          <g :opacity="Math.min(1, Math.max(0, s.t.value * 3 - 0.6))"><rect x="300" y="100" width="44" height="20" rx="10" class="badge diff" /><text x="322" y="114" text-anchor="middle" class="badgel">DIFF</text></g>
          <g :opacity="Math.min(1, Math.max(0, s.t.value * 3 - 1.2))">
            <text x="12" y="146" class="small">traced: a half circle's sweep after the sixth boss</text>
            <text x="12" y="162" class="code hot">−3.141592653589794  (π + 1 ulp) → split at its top</text>
          </g>
          <g :opacity="Math.min(1, Math.max(0, s.t.value * 3 - 1.9))">
            <text x="12" y="190" class="small">rebuild, split past π + 10⁻¹²</text><text x="200" y="190" class="code">43</text><text x="250" y="190" class="code keep">87</text><text x="306" y="190" class="code keep">58</text>
            <rect x="300" y="200" width="44" height="20" rx="10" class="badge same" /><text x="322" y="214" text-anchor="middle" class="badgel">SAME</text>
          </g>
        </g>
        <!-- Step 6: the corpus. -->
        <g v-if="s.step.value === 5">
          <text x="12" y="20" class="label">r5-fingerprint: 869 cases, one line each</text>
          <path :d="ALL" class="cell" />
          <path :d="donePath" class="cell done" />
          <text x="16" y="174" class="small">{{ done }} / 869</text>
          <line x1="136" y1="100" x2="160" y2="100" class="arrow" />
          <rect x="162" y="88" width="46" height="24" rx="4" class="hash" /><text x="185" y="104" text-anchor="middle" class="hashl">sha256</text>
          <g v-if="done === 869">
            <text x="218" y="84" class="small">checkpoint 2 (D268–D270)</text>
            <text x="218" y="98" class="digest">4e3603b7…</text>
            <text x="218" y="124" class="small">after R7.3a batch 1 (D272)</text>
            <text x="218" y="138" class="digest">4e3603b7…</text>
            <rect x="300" y="150" width="44" height="20" rx="10" class="badge same" /><text x="322" y="164" text-anchor="middle" class="badgel">SAME</text>
          </g>
        </g>
      </svg>
      <template #note>The JSON is shown abridged; the digests are of the whole 23,713-byte record, computed from the built
        kernel. The one-ulp result is made by editing that record, not by a kernel change. The boss-chain counts are those
        recorded in D282; the corpus digests are D276's (only their first eight digits are recorded).</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --keep: #24956d; --hot: #c75351; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --keep: #6dcb9e; --hot: #ef8a87; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.label { font-size: 11px; font-weight: 700; fill: var(--vp-c-text-1); }
.small { font-size: 10px; }
.th { font-size: 10px; font-weight: 700; fill: var(--vp-c-text-1); }
.code { font-family: var(--vp-font-family-mono); font-size: 10px; fill: var(--vp-c-text-1); }
.code.changed { fill: var(--hot); font-weight: 700; }
.doc { fill: var(--vp-c-bg); stroke: var(--vp-c-divider); }
.arrow { stroke: var(--vp-c-text-3); stroke-width: 1.4; }
.hash { fill: color-mix(in srgb, var(--a) 16%, transparent); stroke: var(--a); }
.hashl { font-size: 10px; font-weight: 700; fill: var(--a); }
.digest { font-family: var(--vp-font-family-mono); font-size: 11px; font-weight: 700; fill: var(--vp-c-text-1); }
.digest .off { fill: var(--hot); }
.badge.same { fill: var(--keep); } .badge.diff { fill: var(--hot); }
.badgel { font-size: 10px; font-weight: 700; fill: var(--vp-c-bg); }
.rule { stroke: var(--vp-c-divider); }
.keep { fill: var(--keep); } .hot { fill: var(--hot); }
.code.keep { fill: var(--keep); } .code.hot { fill: var(--hot); }
.cell { fill: var(--vp-c-divider); }
.cell.done { fill: var(--a); }
</style>

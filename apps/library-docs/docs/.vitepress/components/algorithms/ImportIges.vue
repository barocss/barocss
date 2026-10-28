<script setup>
// An IGES file read by importIGES (packages/barocss-cad/src/io/iges-import.ts). The 14 records are exactly what the
// built kernel's exportIGES (packages/barocss-cad/dist/index.js) writes for a model 'demo' of two objects: the rational
// quarter circle of radius 10 mm (degree 2, knots 0 0 0 1 1 1, weights 1 √½ 1) and a bilinear patch with corners
// (0,0,0), (10,0,5), (0,10,0), (10,10,5). importIGES of the same text (idPrefix 'demo') gives curve demo_d1 (30
// parameter tokens) and surface demo_d3 (38); with 2HMM changed to 2HIN it throws IGESImportError code UNSUPPORTED.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const RECORDS = [
  'barocss-cad v0: open rational B-spline geometry in MM                   S      1',
  '1H,,1H;,11Hbarocss-cad,8Hdemo.igs,7Hbarocss,6Hcad-v0,32,38,6,308,17,    G      1',
  '24Hindependent CAD consumer,1.0,2,2HMM,1,0.0,15H20000101.000000,1E-9,   G      2',
  '10.0,7Hbarocss,7Hbarocss,11,0,15H20000101.000000,0H;                    G      3',
  '     126       1       0       0       0       0       0       000000000D      1',
  '     126       0       0       2       0                arc            0D      2',
  '     128       3       0       0       0       0       0       000000000D      3',
  '     128       0       0       3       0                patch          0D      4',
  '126,2,2,0,0,0,0,0.0,0.0,0.0,1.0,1.0,1.0,1.0,0.7071067811865476,        1P      1',
  '1.0,10.0,0.0,0.0,10.0,10.0,0.0,0.0,10.0,0.0,0.0,1.0,0.0,0.0,0.0;       1P      2',
  '128,1,1,1,1,0,0,1,0,0,0.0,0.0,1.0,1.0,0.0,0.0,1.0,1.0,1.0,1.0,         3P      3',
  '1.0,1.0,0.0,0.0,0.0,10.0,0.0,5.0,0.0,10.0,0.0,10.0,10.0,5.0,0.0,       3P      4',
  '1.0,0.0,1.0;                                                           3P      5',
  'S      1G      3D      4P      5                                        T      1',
];
// Column c (1-based) starts at colX(c); 4 units a column, so 8-column fields are 32 units wide.
const colX = c => 10 + (c - 1) * 4;
const rowY = i => 33 + 13.2 * i;
const section = r => r[72], seq = r => r.slice(73).trim();
// Each record split into what is drawn: D records as their nine 8-column fields, T as four, the rest as text
// (S and G over columns 1–72, P over 1–64 with its back-pointer field 65–72).
const ROWS = RECORDS.map((r, i) => {
  const sec = section(r), body = r.slice(0, 72);
  if (sec === 'D' || sec === 'T') {
    const fields = Array.from({ length: 9 }, (_, f) => body.slice(8 * f, 8 * f + 8)).map((t, f) => ({ f, text: t.trim(), x: colX(8 * f + 1) }));
    return { i, sec, seq: seq(r), first: Number(seq(r)) % 2 === 1, fields: sec === 'T' ? fields.slice(0, 4) : fields };
  }
  const text = sec === 'P' ? body.slice(0, 64).trimEnd() : body.trimEnd();
  return { i, sec, seq: seq(r), text, owner: sec === 'P' ? body.slice(64).trim() : null };
});
const D_ROW = { 1: 4, 3: 6 };   // D sequence → row index
const P_RUN = [{ d: 1, rows: [8, 9], cls: 'ea' }, { d: 3, rows: [10, 11, 12], cls: 'eb' }];
const SECTION_ROWS = { S: [0], G: [1, 2, 3], D: [4, 5, 6, 7], P: [8, 9, 10, 11, 12] };

const steps = [
  { label: 'Fixed 80-column records', text: 'An IGES file is a stack of 80-column lines. Column 73 holds the section letter and columns 74–80 a sequence number counting from 1 in each section. The sections come in order: Start, Global, Directory, Parameter, Terminate. The reader requires exactly 80 printable ASCII characters and a line feed per record.', formula: 'record = columns 1–72 data · 73 section (S G D P T) · 74–80 sequence' },
  { label: 'Terminate counts the sections', text: 'The single T record holds the number of S, G, D and P records, 8 columns each. Each count must equal the records actually there; a file cut short or padded is refused.', formula: 'T: S 1 · G 3 · D 4 · P 5' },
  { label: 'Global parameters', text: 'The G records hold 26 fields separated by the delimiters they define themselves. A string is written <i>n</i>H then <i>n</i> characters (a Hollerith field), so <code>1H,</code> is a comma. Field 13 is the model scale (1.0), field 14 the unit flag (2) and field 15 the unit name, <code>2HMM</code>. The reader admits only the writer\'s own values: a file in inches, <code>2HIN</code>, is refused as UNSUPPORTED.', formula: '13 strings + 13 numbers = 26 fields &nbsp; · &nbsp; 1H, → \',\' &nbsp; 2HMM → \'MM\'' },
  { label: 'A directory entry: two records', text: 'Each entity has two D records of nine 8-column fields. The first gives its type (126) and where its parameters start (P1); the second repeats the type and gives how many P records they take (2) and an 8-character label. Every other field must be 0 (or blank where reserved): structure, line font, level, view, transform, label display, status, line weight, colour, form and subscript. A transformed or styled entity is refused.', formula: 'D1: type · P start · 0 0 0 0 0 0 · status &nbsp; D2: type · 0 0 · P count · form · label' },
  { label: 'Directory → parameter data', text: 'The two numbers locate each entity\'s parameters. The curve at D1 starts at P1 and takes 2 records; the surface at D3 starts at P3 and takes 3. The runs must follow one another with no gap or overlap and cover every P record.', formula: 'D1 → P1 … P2 &nbsp; · &nbsp; D3 → P3 … P5' },
  { label: 'Parameter → directory', text: 'Columns 65–72 of each P record point back at the odd D number that owns it. Each must match the entry whose run it lies in, so the reader finds every record owned exactly once.', formula: 'P1, P2 → D1 &nbsp; · &nbsp; P3, P4, P5 → D3' },
  { label: 'Tokens to a curve (126)', text: 'A run\'s columns 1–64 are joined and split at the commas up to the final semicolon. Entity 126 is a rational B-spline curve: K = 2 gives n = K + 1 = 3 poles, degree M = 2, then four flags that must be 0 (planar, closed, periodic) or match the weights (polynomial 0: they differ). Then the knots, weights, poles, the parameter range and a normal that must be (0, 0, 0).', formula: '7 + (n + M + 1) + n + 3n + 2 + 3 = 5n + M + 13 = 30 tokens' },
  { label: 'A surface (128): u varies fastest', text: 'Entity 128 lists two counts, two degrees and five flags, then knots in u and in v, then the weights and the poles with u varying fastest: P<sub>00</sub>, P<sub>10</sub>, P<sub>01</sub>, P<sub>11</sub>. The reader turns them into the kernel\'s [u][v] grid, validates the curve and the surface, and checks the stated ranges against the knots bit for bit. The objects are named by their D numbers: demo_d1, demo_d3.', formula: '10 + (2 + 1 + 1) · 2 + 4 + 3 · 4 + 4 = 38 tokens' },
];
const s = useSteps(steps.length, [3000, 3200, 3600, 3800, 3400, 3200, 4400, 4400], root);
const k = computed(() => ease(s.t.value));
const step = computed(() => s.step.value);

const rowOpacity = i => (step.value === 0 ? Math.max(0, Math.min(1, s.t.value * 1.5 * RECORDS.length - i)) : 1);
function rowClass(i) {
  const st = step.value;
  if (st === 1) { const order = ['S', 'G', 'D', 'P'], n = Math.min(3, Math.floor(k.value * 4)); return order.slice(0, n + 1).some(x => SECTION_ROWS[x].includes(i)) || i === 13 ? 'lit' : ''; }
  if (st === 2) return SECTION_ROWS.G.includes(i) ? 'lit' : '';
  if (st === 3) return i === 4 || i === 5 ? 'lit' : '';
  if (st >= 4 && st <= 5) { const run = P_RUN.find(r => r.rows.includes(i) || D_ROW[r.d] === i || D_ROW[r.d] + 1 === i); return run ? run.cls : ''; }
  if (st === 6) return [4, 5, 8, 9].includes(i) ? 'ea' : '';
  if (st === 7) return [6, 7, 10, 11, 12].includes(i) ? 'eb' : '';
  return '';
}
// Fields lit in step 4: D1 fields 1–2 then D2 fields 4 and 8 (type, start, count, label).
const fieldLit = (row, f) => {
  const st = step.value;
  if (st === 3 && (row === 4 || row === 5)) { const order = [[4, 0], [4, 1], [5, 0], [5, 3], [5, 7]], n = Math.floor(k.value * 4.999); return order.slice(0, n + 1).some(([r, q]) => r === row && q === f); }
  if ((st === 4) && (row === 4 || row === 6)) return f === 1;
  if ((st === 4) && (row === 5 || row === 7)) return f === 3;
  if (st === 1 && row === 13) return f <= Math.min(3, Math.floor(k.value * 4));
  return false;
};
// Arrows D (field 2) → first P record, drawn on the left margin.
const forward = computed(() => {
  if (step.value !== 4) return [];
  return P_RUN.map((r, n) => {
    const y1 = rowY(D_ROW[r.d]) + 3, y2 = rowY(r.rows[0]) - 3.5, x1 = colX(9) + 4, f = Math.max(0, Math.min(1, k.value * 2 - n * 0.6));
    return { d: `M ${x1} ${y1} C ${x1 - 34} ${y1 + 6}, 2 ${y2 - 6}, 9 ${y2}`, end: [9, y2], f, cls: r.cls };
  });
});
// Arrows P back-pointer → D sequence, drawn on the right margin.
const backward = computed(() => {
  if (step.value !== 5) return [];
  const out = [];
  P_RUN.forEach((r, n) => r.rows.forEach((row, m) => {
    const y1 = rowY(row) - 3.5, y2 = rowY(D_ROW[r.d]) - 3.5, bend = 352 + 6 * n + 4 * m;
    out.push({ d: `M 335 ${y1} C ${bend} ${y1}, ${bend} ${y2}, 335 ${y2}`, end: [335, y2], f: Math.max(0, Math.min(1, k.value * 1.6 - 0.12 * (n * 2 + m))), cls: r.cls });
  }));
  return out;
});
const READOUT = [
  ['80 columns a record: 1–72 data · 73 section · 74–80 number', 'S 1 record · G 3 · D 4 (two an entity) · P 5 · T 1', ''],
  ['T: S 1 · G 3 · D 4 · P 5, each equal to the records found', '', ''],
  ['1H, → \',\'  1H; → \';\'  8Hdemo.igs → \'demo.igs\' … 26 fields', 'scale 1.0 · unit flag 2 · 2HMM → \'MM\' · resolution 1E-9', 'largest coordinate 10.0 = the largest pole coordinate read'],
  ['D1: type 126 · parameters at P1 · six 0s · status 00000000', 'D2: 126 · weight 0 · colour 0 · 2 P records · form 0 · \'arc\'', ''],
  ['126 at D1: from P1, 2 records → P1–P2', '128 at D3: from P3, 3 records → P3–P5', 'no gap, no overlap: every P record in one run'],
  ["columns 65–72: the owner's D number, its first record", 'P1, P2 → 1 · P3, P4, P5 → 3', ''],
];
const TOKENS_126 = [
  [['header', '126,2,2,0,0,0,0'], ['knots', '0,0,0,1,1,1']],
  [['weights', '1, 0.70711, 1'], ['poles', '(10,0,0) (10,10,0) (0,10,0)']],
  [['range', '0, 1'], ['normal', '0,0,0']],
];
const TOKENS_128 = [
  [['header', '128,1,1,1,1,0,0,1,0,0'], ['knots u', '0,0,1,1']],
  [['knots v', '0,0,1,1'], ['weights', '1,1,1,1']],
  [['poles', '(0,0,0) (10,0,5) (0,10,0) (10,10,5)'], ['ranges', '0,1,0,1']],
];
const tokens = computed(() => (step.value === 6 ? TOKENS_126 : step.value === 7 ? TOKENS_128 : null));
const tokenShown = computed(() => Math.floor(k.value * 5.999));
// Token groups laid out left to right on two lines; the widths are estimated from the character count.
const layout = computed(() => {
  if (!tokens.value) return [];
  let n = 0;
  return tokens.value.map((line, li) => {
    let x = 12;
    return line.map(([tag, text]) => { const g = { tag, text, x, y: 224 + 14 * li, n: n++ }; x += 5.2 * tag.length + 4 + 6 * text.length + 14; return g; });
  }).flat();
});
const tokenNote = computed(() => (step.value === 6 ? { x: 176, y: 252, text: '→ curve demo_d1: 30 tokens' } : { x: 214, y: 238, text: '→ surface demo_d3: 38 tokens' }));
</script>

<template>
  <div ref="root">
    <AlgoFigure title="IGES: directory entries pointing at parameter lines" :steps="steps" :s="s">
      <svg viewBox="0 0 380 260" role="img" aria-label="The fourteen 80-column records of a small IGES file; directory entries point at their parameter records and back">
        <g class="ruler">
          <line :x1="colX(1)" y1="20" :x2="colX(81)" y2="20" />
          <g v-for="c in [1, 9, 17, 25, 33, 41, 49, 57, 65, 73, 81]" :key="'c' + c">
            <line :x1="colX(c)" y1="17" :x2="colX(c)" y2="23" />
            <text v-if="c < 81" :x="colX(c) + 1" y="13" class="tick">{{ c === 73 ? '73' : c }}</text>
          </g>
          <text :x="colX(81)" y="13" text-anchor="end" class="tick">80</text>
        </g>
        <g v-if="step === 0">
          <rect :x="colX(73)" y="24" width="4" :height="rowY(13) - 18" class="band" />
          <rect :x="colX(74)" y="24" width="28" :height="rowY(13) - 18" class="band b2" />
        </g>
        <g v-for="r in ROWS" :key="r.i" :opacity="rowOpacity(r.i)">
          <rect x="8" :y="rowY(r.i) - 9.6" width="326" height="12.4" rx="2" class="row" :class="rowClass(r.i)" />
          <template v-if="r.fields">
            <g v-for="fd in r.fields" :key="fd.f">
              <rect v-if="fieldLit(r.i, fd.f)" :x="fd.x + 0.5" :y="rowY(r.i) - 9.1" width="31" height="11.4" rx="2" class="cell" />
              <text v-if="r.sec === 'T'" :x="fd.x + 1" :y="rowY(r.i)" class="code">{{ fd.text[0] }}</text>
              <text v-if="r.sec === 'T'" :x="fd.x + 31" :y="rowY(r.i)" text-anchor="end" class="code">{{ fd.text.slice(1).trim() }}</text>
              <text v-else-if="r.first && fd.f === 8" :x="fd.x + 31" :y="rowY(r.i)" text-anchor="end" class="code" textLength="29" lengthAdjust="spacingAndGlyphs">{{ fd.text }}</text>
              <text v-else-if="!r.first && fd.f === 7" :x="fd.x + 1" :y="rowY(r.i)" class="code">{{ fd.text }}</text>
              <text v-else-if="fd.text !== ''" :x="fd.x + 31" :y="rowY(r.i)" text-anchor="end" class="code">{{ fd.text }}</text>
            </g>
          </template>
          <template v-else>
            <text :x="colX(1)" :y="rowY(r.i)" class="code" :textLength="4 * r.text.length - 1" lengthAdjust="spacingAndGlyphs">{{ r.text }}</text>
            <text v-if="r.owner" :x="colX(73) - 1" :y="rowY(r.i)" text-anchor="end" class="code owner" :class="{ on: step === 5 }">{{ r.owner }}</text>
          </template>
          <text :x="colX(73) + 0.5" :y="rowY(r.i)" class="code sec">{{ r.sec }}</text>
          <text :x="colX(81)" :y="rowY(r.i)" text-anchor="end" class="code">{{ r.seq }}</text>
        </g>
        <path v-for="(a, n) in forward" :key="'f' + n" :d="a.d" pathLength="1" :stroke-dasharray="`${a.f} 1`" class="arrow" :class="a.cls" />
        <path v-for="(a, n) in backward" :key="'b' + n" :d="a.d" pathLength="1" :stroke-dasharray="`${a.f} 1`" class="arrow" :class="a.cls" />
        <circle v-for="(a, n) in [...forward, ...backward].filter(x => x.f >= 1)" :key="'e' + n" :cx="a.end[0]" :cy="a.end[1]" r="2.2" class="end" :class="a.cls" />

        <g v-if="step <= 5">
          <text v-for="(line, i) in READOUT[step]" :key="'r' + i" x="12" :y="226 + 14 * i" class="readout">{{ line }}</text>
        </g>
        <g v-else>
          <g v-for="g in layout" :key="'t' + g.n" v-show="g.n <= tokenShown">
            <text :x="g.x" :y="g.y" class="tag">{{ g.tag }}</text>
            <text :x="g.x + 5.2 * g.tag.length + 4" :y="g.y" class="code tok" :class="'g' + g.n">{{ g.text }}</text>
          </g>
          <text v-if="tokenShown >= 5" :x="tokenNote.x" :y="tokenNote.y" class="readout">{{ tokenNote.text }}</text>
        </g>
      </svg>
      <template #note>The records are the exact output of the kernel's <code>exportIGES</code> for a quarter circle and a
        flat patch, drawn at their true columns (the text squeezed to 4 units a column). The reader takes back only what
        this writer writes.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
svg text.code { font-family: var(--vp-font-family-mono); font-size: 10px; fill: var(--vp-c-text-1); }
.ruler line { stroke: var(--vp-c-text-3); stroke-width: 0.8; }
.tick { font-size: 10px; fill: var(--vp-c-text-3); }
.band { fill: color-mix(in srgb, var(--b) 22%, transparent); }
.band.b2 { fill: color-mix(in srgb, var(--a) 16%, transparent); }
.row { fill: transparent; transition: fill .25s; }
.row.lit { fill: color-mix(in srgb, var(--keep) 18%, transparent); }
.row.ea { fill: color-mix(in srgb, var(--a) 18%, transparent); }
.row.eb { fill: color-mix(in srgb, var(--b) 20%, transparent); }
.cell { fill: none; stroke: var(--hot); stroke-width: 1.3; }
svg text.sec { font-weight: 700; fill: var(--vp-c-text-2); }
svg text.owner.on { font-weight: 700; fill: var(--hot); }
.arrow { fill: none; stroke-width: 1.5; }
.arrow.ea { stroke: var(--a); } .arrow.eb { stroke: var(--b); }
.readout { font-size: 10.5px; fill: var(--vp-c-text-1); }
.tag { font-size: 10px; fill: var(--vp-c-text-3); }
.end { stroke: none; } .end.ea { fill: var(--a); } .end.eb { fill: var(--b); }
svg text.tok { font-weight: 600; }
svg text.tok.g0, svg text.tok.g3 { fill: var(--vp-c-text-1); }
svg text.tok.g1 { fill: var(--a); } svg text.tok.g2 { fill: var(--b); }
svg text.tok.g4 { fill: var(--keep); } svg text.tok.g5 { fill: var(--hot); }
</style>

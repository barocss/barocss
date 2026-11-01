// Randomized geometry audit of bandLoops vs an independent support-function oracle (+ kernel volume on a subset).
import { bandLoops } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/band';
import { withIds } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/entityIds';
import { partSnapshot } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/part';
import { massPropertiesOf } from '@barocss/cad';
import type { SketchShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/types';
import { bandOver, checkLoop, hSet, measure, piecesOf, randomShape, rng, TAU, type P, type Piece } from './geo';

const CASES = Number(process.env.CASES ?? 3000), KERNEL_EVERY = Number(process.env.KEVERY ?? 25);
const R = rng(Number(process.env.SEED ?? 1));
const stats: Record<string, number> = {}, bump = (k: string) => { stats[k] = (stats[k] ?? 0) + 1; };
const fails: string[] = [];
const sep = (A: Piece[], B: Piece[], N = 20000) => { let m = -Infinity; for (let k = 0; k < N; k++) { const t = k * TAU / N; m = Math.max(m, -hSet(A, t) - hSet(B, t + Math.PI)); } return m; };
const exc = (X: Piece[], Y: Piece[], N = 20000) => { let m = -Infinity; for (let k = 0; k < N; k++) { const t = k * TAU / N; m = Math.max(m, hSet(X, t) - hSet(Y, t)); } return m; };

for (let it = 0; it < CASES; it++) {
  const n = 2 + Math.floor(R() * 7), far = R() < 0.25 ? [(R() - 0.5) * 16000, (R() - 0.5) * 16000] : [0, 0];
  const mode = R();
  const shapes: SketchShape[] = [];
  for (let i = 0; i < n; i++) {
    const size = mode < 0.2 ? Math.exp((R() - 0.5) * 7) * 5 : 2 + R() * 20;
    let c: P;
    if (mode > 0.85) c = [far[0] + i * 60, far[1] + (R() - 0.5) * 1e-3]; // near-collinear centres
    else if (mode > 0.4) { const a = (i + 0.3 * R()) * TAU / n, rad = 40 + n * 25; c = [far[0] + rad * Math.cos(a), far[1] + rad * Math.sin(a)]; }
    else c = [far[0] + (R() - 0.5) * 300, far[1] + (R() - 0.5) * 300];
    shapes.push(randomShape(R, c, size));
  }
  const all = withIds(shapes), offset = R() < 0.5 ? 0 : R() < 0.5 ? R() * 5 : Math.floor(R() * 4);
  const width = R() < 0.3 ? 0.5 + R() * 4 : undefined;
  const band = bandOver(all, all.map((_, i) => i), { ...(offset ? { offset } : {}), ...(width ? { width } : {}) });
  let r;
  try { r = bandLoops(all, band); } catch (e) { fails.push(`#${it} THROW ${(e as Error).message}`); continue; }
  const P = all.map(piecesOf), scale = Math.max(1, ...P.flat().map(g => Math.max(Math.abs(g.c[0]), Math.abs(g.c[1])) + g.r));
  if ('error' in r) {
    const m = r.error.replace(/^Sketch band b1: /, '');
    const key = m.replace(/e\d+/g, 'eK').replace(/[\d.]+ mm/g, 'N mm').slice(0, 60); bump('refused: ' + key);
    // verify refusals with my oracle
    const ref = (id: string) => all.findIndex(s => s.ids![0] === id);
    let mm;
    if ((mm = /^sources (e\d+) and (e\d+) overlap/.exec(m))) { const d = sep(P[ref(mm[1])], P[ref(mm[2])]); if (d > 1e-6) fails.push(`#${it} false overlap d=${d}`); }
    else if ((mm = /^sources (e\d+) and (e\d+) touch/.exec(m))) { const d = sep(P[ref(mm[1])], P[ref(mm[2])]); if (d > 1.0001e-4 || d < -1e-6) fails.push(`#${it} false touch d=${d}`); }
    else if ((mm = /^source (e\d+) lies inside (e\d+)/.exec(m))) { const e = exc(P[ref(mm[1])], P[ref(mm[2])]); if (e > 1e-6 * scale) fails.push(`#${it} false inside e=${e}`); }
    else if ((mm = /^source (e\d+) does not reach/.exec(m))) { const k = ref(mm[1]), others = P.filter((_, i) => i !== k).flat(); const e = exc(P[k], others); if (e > 1e-6 * scale) fails.push(`#${it} false no-reach e=${e} (${m})`); }
    else if (/share part/.test(m)) fails.push(`#${it} share-part refusal (check): ${m} scale ${scale}`);
    else if (/not convex/.test(m)) { const s = all[ref(/source (e\d+)/.exec(m)![1])]; fails.push(`#${it} not-convex refusal on generated convex ${s.kind} ${JSON.stringify(s).slice(0, 300)}`); }
    else if (/not a closed/.test(m)) { const s = all[ref(/source (e\d+)/.exec(m)![1])]; if (!(s.kind === "rectangle" && (Math.abs(s.a[0] - s.b[0]) < 1 || Math.abs(s.a[1] - s.b[1]) < 1))) fails.push(`#${it} closed? ${JSON.stringify(s).slice(0, 400)}`); }
    else if (/beyond|smaller than|edge shorter|coincident|longer than/.test(m)) { /* limits */ }
    else fails.push(`#${it} other refusal: ${m}`);
    continue;
  }
  bump('ok');
  const outerD = offset + (width ?? 0);
  const bad = checkLoop(r.outer, P, outerD, scale);
  if (r.hole) bad.push(...checkLoop(r.hole, P, offset, scale).map(x => 'hole: ' + x));
  if (r.tags.outer.length !== r.outer.length || new Set([...r.tags.outer, ...(r.tags.holes?.[0] ?? [])]).size !== r.tags.outer.length + (r.tags.holes?.[0]?.length ?? 0)) bad.push('tags count/unique');
  if (bad.length) fails.push(`#${it} n=${n} off=${offset} w=${width} ${bad.slice(0, 4).join('; ')}`);
  if (it % KERNEL_EVERY === 0) {
    try {
      const doc = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [{ kind: 'sketch', profile: 'band', band, construction: all, id: 'n0' }, { kind: 'extrude', sketch: 0, height: 5, id: 'n1' }], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 } as never;
      const snap = partSnapshot(doc), v = massPropertiesOf(snap.outputs[0], 1).volume, a = measure(r.outer).area - (r.hole ? measure(r.hole).area : 0);
      if (Math.abs(v - a * 5) > 1e-6 * Math.max(1, a * 5)) fails.push(`#${it} kernel volume ${v} vs ${a * 5}`);
      bump('kernel ok');
    } catch (e) { fails.push(`#${it} kernel refused: ${(e as Error).message.slice(0, 200)}`); }
  }
}
console.log(JSON.stringify(stats));
console.log('FAILS', fails.length); for (const f of fails.slice(0, 40)) console.log(f);

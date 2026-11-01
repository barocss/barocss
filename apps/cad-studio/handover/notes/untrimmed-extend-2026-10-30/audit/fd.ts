// For each accepted (b)-failure from para.ts: rebuild extendSurface's grid exactly as direct.ts does and split the error into
// (1) the grid's own error (finite-difference tangent vs the exact edge axis) and (2) the stored fit's error against that grid.
import { geometryOf, importSource, emptyDirect, directOps } from '/Users/user/github/barocss/barocss/.claude/worktrees/compassionate-turing-e88276/packages/barocss-cad-model/src/engine/direct';
import { evaluateSurface, surfaceDomain, type Surface } from '@barocss/cad';
import { readFileSync } from 'node:fs';
const fails = JSON.parse(readFileSync('/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-compassionate-turing-e88276/0fddd342-b409-4074-aa06-d8dff804f568/scratchpad/audit/para-fails.json', 'utf8'));
for (const { trial, edge, D, src, dev } of fails) {
  const d = importSource(emptyDirect(), src, 'P'), s = geometryOf(d, d.objects[0]) as Surface, dom = surfaceDomain(s);
  const n = 11, across = 15, extra = 4, alongU = edge.startsWith('u'), atMax = edge.endsWith('max');
  const [a0, a1] = alongU ? dom.u : dom.v, [b0, b1] = alongU ? dom.v : dom.u;
  const S = (a: number, b: number) => alongU ? evaluateSurface(s, a, b) : evaluateSurface(s, b, a);
  const eA = atMax ? a1 : a0, h = (a1 - a0) * 1e-3;
  // exact axis: the original's edge-to-edge direction along the extended parameter (a parallelogram: constant)
  const o = S(a0, b0), far = S(a1, b0), ax = [0, 1, 2].map(k => (atMax ? 1 : -1) * (far[k] - o[k])), al = Math.hypot(...ax), axis = ax.map(x => x / al);
  let worstAngle = 0, worstNode = 0, chordSmall = Infinity;
  for (let j = 0; j <= across; j++) {
    const b = Math.min(b0 + (b1 - b0) * j / across, b1), p = S(eA, b), q = S(atMax ? eA - h : eA + h, b), t = [0, 1, 2].map(k => p[k] - q[k]), l = Math.hypot(...t);
    chordSmall = Math.min(chordSmall, l);
    const tu = t.map(x => x / l), err = Math.hypot(...tu.map((x, k) => x - axis[k]));
    worstAngle = Math.max(worstAngle, err); worstNode = Math.max(worstNode, err * D);
  }
  // the stored result against its own grid is what the check measured; recompute via the op for its error
  console.log(`trial ${trial} ${edge} D=${D.toPrecision(3)} denseDev=${dev.toExponential(2)} |p-q|min=${chordSmall.toExponential(2)} |coord|~${Math.max(...o.map(Math.abs)).toExponential(1)} tangentDirErr=${worstAngle.toExponential(2)} => far-row node error=${worstNode.toExponential(2)} mm`);
}

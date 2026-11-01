// The SPLINE section applies every keystroke (onChange) and a refused value leaves the controlled input at the old value.
// For a spline running leftwards, which prefixes of a wanted handle are refused?
import { splineEditError, splineAutoHandles } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';
type P2 = [number, number];
const fit: P2[] = [[40, 0], [20, 3], [0, 0]];
console.log('auto handles', splineAutoHandles(fit, false).map(a => a.toFixed(2)).join(', '));
for (const want of ['170', '-170', '175', '190']) {
  const steps = Array.from({ length: want.length }, (_, k) => want.slice(0, k + 1)).map(t => { const v = t === '-' ? null : Number(t); const h = [null, v, null]; return `${t}:${splineEditError({ fit, closed: false, handles: h }) ? 'REFUSED' : 'ok'}`; });
  console.log('typing', want, '->', steps.join('  '));
}
// Handle = the automatic value shown as the placeholder (rounded to 0.1) on a closed star: refused?
const star: P2[] = [[23.975, 25.288], [-14.246, 29.821], [12.826, -30.181], [21.378, -16.186]];
const auto = splineAutoHandles(star, true);
star.forEach((_, i) => { const h = star.map((__, j) => j === i ? Math.round(auto[i] * 10) / 10 : null); console.log(`closed star: handle ${i} := placeholder ${h[i]} ->`, splineEditError({ fit: star, closed: true, handles: h }) ?? 'ok'); });
console.log('closed star, no handles ->', splineEditError({ fit: star, closed: true }) ?? 'ok');

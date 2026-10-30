const T = '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src';
export { profileOf, loopOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { profileOf, loopOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { sketchShapes } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/reopen';
import { joinOpen } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/trim';
import { startPicking } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/select';
import { xyPlane } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/plane';
// The real finishSketch's node (Bezier stripped of construction).
export const finish = (shape: any, done: any[], editNode: boolean): any => {
  const shapes = joinOpen((editNode && shape ? [shape, ...done] : [...done, ...(shape ? [shape] : [])]).map((x: any) => x.kind === 'polygon' && !x.closed ? { ...x, pending: false } : x));
  const profile: any = profileOf(shapes); if ('error' in profile) return profile;
  const refs = shapes.filter((x: any) => x.construction || x.kind === 'bezier').map((x: any) => x.kind === 'bezier' && x.construction ? (({ construction: _c, ...rest }: any) => rest)(x) : x);
  return refs.length ? { ...profile.node, construction: refs } : profile.node;
};
export const reopen = (node: any, tool: 'select' | 'dimension' = 'select') => { const { shape, done, positional } = sketchShapes(JSON.parse(JSON.stringify(node))); const s: any = startPicking({ plane: xyPlane(), tool, shape, done, editNode: 0 } as any, tool); return { s, positional }; };
export const reopenFinish = (node: any) => { const { s } = reopen(node); return finish(s.shape, s.done, true); };
// tag -> its segment as a geometric key (unordered endpoints / arc), per loop kind
const k = (p: any) => `${(+p[0]).toFixed(4)},${(+p[1]).toFixed(4)}`;
const segKeys = (loop: any[]) => loop.map((s, i) => { const a = k(s.start), b = k(loop[(i + 1) % loop.length].start); return [a, b].sort().join('~') + (s.kind === 'arc' ? '@' + k(s.center) : ''); });
export function tagGeom(node: any): Record<string, string> {
  const out: Record<string, string> = {}; const t = node.sideTags; if (!t) return out;
  segKeys(loopOf(node)).forEach((g, i) => { out[t.outer[i]] = 'outer:' + g; });
  (node.regions ?? []).forEach((l: any, r: number) => segKeys(l).forEach((g, i) => { out[t.regions?.[r]?.[i]] = 'region:' + g; }));
  (node.holes ?? []).forEach((l: any, h: number) => segKeys(l).forEach((g, i) => { out[t.holes?.[h]?.[i]] = 'hole:' + g; }));
  return out;
}
export const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
export function compare(label: string, n1: any, n2: any) {
  if (n1.error || n2.error) { console.log('ERR', label, n1.error ?? '', n2.error ?? ''); return; }
  const g1 = tagGeom(n1), g2 = tagGeom(n2), ok = same(Object.entries(g1).sort(), Object.entries(g2).sort());
  console.log(ok ? 'KEEP  ' : 'RENAME', label, '| profile', n1.profile, '->', n2.profile, '| tags', JSON.stringify(n1.sideTags), ok ? '' : '-> ' + JSON.stringify(n2.sideTags), '| node identical', same(n1, n2), same(n1.construction, n2.construction) ? '' : '| construction ' + JSON.stringify(n1.construction) + ' -> ' + JSON.stringify(n2.construction));
}

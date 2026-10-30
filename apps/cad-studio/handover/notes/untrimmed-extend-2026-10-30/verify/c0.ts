import { directOps, emptyDirect, importSource } from '../../../../../../../../../../Users/user/github/barocss/barocss/.claude/worktrees/compassionate-turing-e88276/packages/barocss-cad-model/src/engine/direct';
// A folded panel: degree 1 across v with a C0 crease at v=1 (an across sample lands exactly on it: 3*5/15 = 1).
const d = importSource(emptyDirect(), `@model c { version:0; length-unit:mm;
 @surface #fold { type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,10,10]; knots-v:[0,0,1,3,3];
  control-points:[[[0,0,0],[0,5,0],[0,10,4]],[[10,0,0],[10,5,0],[10,10,4]]]; weights:[[1,1,1],[1,1,1]]; } }`, 'c');
for (const edge of ['u-max', 'u-min', 'v-max', 'v-min'] as const) {
  try { const r = directOps.extendSurface(d, d.objects[0].id, edge, 2.5); console.log(edge, 'OK', r.objects.at(-1)!.name); }
  catch (e: any) { console.log(edge, 'THROW', e.code, e.message); }
}

import { directOps, emptyDirect, geometryOf, importSource } from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/direct';
import { surfaceDomain } from '@barocss/cad';
const src = `@model d347 { version:0; length-unit:mm;
 @surface #panel { type:nurbs; degree-u:1; degree-v:1;
  knots-u:[2,2,5,5]; knots-v:[-1,-1,3,3];
  control-points:[[[7,-11,13],[7,-11,21]],[[16,1,13],[16,1,21]]];
  weights:[[1,1],[1,1]]; }
}`;
const d = importSource(emptyDirect(), src, 'd347');
console.log(JSON.stringify(d.objects), surfaceDomain(geometryOf(d, d.objects[0]) as any));
for (const edge of ['u-max','u-min','v-max','v-min'] as const) {
  const r = directOps.extendSurface(d, d.objects[0].id, edge, 2.5);
  const o = r.objects.at(-1)!, g: any = geometryOf(r, o);
  console.log(edge, JSON.stringify(r.objects.map(x=>[x.id,x.name,x.source,x.geometry,x.hidden])), g.degreeU, g.degreeV, g.controlPoints.length, g.controlPoints[0].length, JSON.stringify(g.knotsU), JSON.stringify(g.knotsV));
  console.log(' corners', JSON.stringify([g.controlPoints[0][0], g.controlPoints.at(-1)[0], g.controlPoints[0].at(-1), g.controlPoints.at(-1).at(-1)]));
  console.log(' srclen', r.sources[o.source].length);
}
for (const [edge, dist] of [['x', 2.5], ['u-max', Infinity], ['u-max', NaN], ['u-max', -1], ['u-max', 1e-9], ['u-max', 1e-12], ['u-max', 1e300], ['U-MAX', 2.5]] as any) {
  try { const r = directOps.extendSurface(d, d.objects[0].id, edge, dist); const g: any = geometryOf(r, r.objects.at(-1)!); console.log('RISK', edge, dist, 'SUCCESS', JSON.stringify(g.controlPoints[0][0]), JSON.stringify(g.controlPoints.at(-1).at(-1)), JSON.stringify(g.knotsU.slice(0,6))); }
  catch (e: any) { console.log('RISK', edge, dist, 'THROW', e.code, e.message); }
}

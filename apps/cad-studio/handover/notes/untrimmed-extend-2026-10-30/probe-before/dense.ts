import { directOps, emptyDirect, geometryOf, importSource } from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/direct';
import { evaluateSurface, chordParameters, interpolateSurfacePlain } from '@barocss/cad';
const src = `@model d347 { version:0; length-unit:mm;
 @surface #panel { type:nurbs; degree-u:1; degree-v:1; knots-u:[2,2,5,5]; knots-v:[-1,-1,3,3];
  control-points:[[[7,-11,13],[7,-11,21]],[[16,1,13],[16,1,21]]]; weights:[[1,1],[1,1]]; } }`;
const d = importSource(emptyDirect(), src, 'd347'), id = d.objects[0].id;
const A=[7,-11,13],U=[3,4,0],V=[0,0,2];
for (const edge of ['u-max','v-max','u-min']) for (const r of [1e-3,1e-4,1e-5,1e-6,1000,1e5]) {
  try {
  const out = directOps.extendSurface(d, id, edge as any, r), g: any = geometryOf(out, out.objects.at(-1)!);
  const su = 3 + r/5, tv = 4 + r/2, uE = edge.startsWith('u');
  const T = (s: number, t: number) => { const a = uE ? (edge==='u-min'? -r/5:0) + s*su : 3*s, b = uE ? 4*t : (edge==='v-min'? -r/2:0) + t*tv; return [0,1,2].map(k => A[k] + a*U[k] + b*V[k]); };
  // fit residual at the fit parameters of the unrounded fit
  let worst = 0, worstAt = '';
  const N = 400;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= 40; j++) { const s = i/N, t = j/40; const p = evaluateSurface(g, s, t), e = T(s, t), dd = Math.hypot(p[0]-e[0],p[1]-e[1],p[2]-e[2]); if (dd > worst) { worst = dd; worstAt = s.toFixed(4)+','+t.toFixed(3); } }
  // dense near the extended end
  for (let i = 0; i <= 2000; i++) { const s = uE ? (edge==='u-min' ? i/2000*0.01 : 1 - i/2000*0.01) : 0.5, t = uE ? 0.5 : 1 - i/2000*0.01; const p = evaluateSurface(g, s, t), e = T(s, t), dd = Math.hypot(p[0]-e[0],p[1]-e[1],p[2]-e[2]); if (dd > worst) { worst = dd; worstAt = 'end '+s+','+t; } }
  console.log(edge, r, 'dense worst', worst.toExponential(3), worstAt);
  } catch (e: any) { console.log(edge, r, 'THROW', e.message.slice(0,60)); }
}

import { directOps, emptyDirect, geometryOf, importSource } from '../../../../../../../../../../Users/user/github/barocss/barocss/.claude/worktrees/compassionate-turing-e88276/packages/barocss-cad-model/src/engine/direct';
import { evaluateSurface, surfaceDomain } from '@barocss/cad';
const d = importSource(emptyDirect(), `@model d347 { version:0; length-unit:mm;
 @surface #panel { type:nurbs; degree-u:1; degree-v:1; knots-u:[2,2,5,5]; knots-v:[-1,-1,3,3];
  control-points:[[[7,-11,13],[7,-11,21]],[[16,1,13],[16,1,21]]]; weights:[[1,1],[1,1]]; } }`, 'd347'), id = d.objects[0].id;
const A=[7,-11,13],U=[3,4,0],V=[0,0,2];
for (const edge of ['u-max', 'v-max']) for (const r of [1e-3, 2e-3, 3e-3, 5e-3, 1e-2, 0.1, 2.5, 100, 300, 500, 700, 1000]) {
  const t0 = performance.now();
  try { const out = directOps.extendSurface(d, id, edge as any, r), ms = performance.now() - t0, g: any = geometryOf(out, out.objects.at(-1)!), dm = surfaceDomain(g);
    const su = edge === 'u-max' ? 3 + r/5 : 3, tv = edge === 'u-max' ? 4 : 4 + r/2; let worst = 0;
    for (let i = 0; i <= 400; i++) for (let j = 0; j <= 20; j++) { const s = i/400, t = j/20, p = evaluateSurface(g, dm.u[0] + s*(dm.u[1]-dm.u[0]), dm.v[0] + t*(dm.v[1]-dm.v[0])); const e = [0,1,2].map(k => A[k] + s*su*U[k] + t*tv*V[k]); worst = Math.max(worst, Math.hypot(p[0]-e[0],p[1]-e[1],p[2]-e[2])); }
    console.log(edge, r, 'ACCEPT', 'dense', worst.toExponential(2), 'domain', JSON.stringify(dm), ms.toFixed(1) + 'ms'); }
  catch (e: any) { console.log(edge, r, 'REFUSE', e.code, e.message.slice(0, 110)); }
}

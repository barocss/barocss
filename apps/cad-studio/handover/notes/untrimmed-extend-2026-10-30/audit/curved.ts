// (a) vs FD-tangent truncation on an exact rational quarter cylinder (R=10, axis z, angle 0..90 deg along u, z 0..10 along v).
// u-max edge is the line x=0,y=10; its true tangent extension is the plane y=10, x in [-D,0].
import { directOps, emptyDirect, geometryOf, importSource } from '/Users/user/github/barocss/barocss/.claude/worktrees/compassionate-turing-e88276/packages/barocss-cad-model/src/engine/direct';
import { evaluateSurface, surfaceDomain, type Surface } from '@barocss/cad';
const w = Math.SQRT1_2.toFixed(15);
for (const R of [10, 1000]) {
  const src = `@model c { version:0; length-unit:mm; @surface #s { type:nurbs; degree-u:2; degree-v:1; knots-u:[0,0,0,1,1,1]; knots-v:[0,0,1,1];
 control-points:[[[${R},0,0],[${R},0,10]],[[${R},${R},0],[${R},${R},10]],[[0,${R},0],[0,${R},10]]]; weights:[[1,1],[${w},${w}],[1,1]]; } }`;
  const d = importSource(emptyDirect(), src, 'C'), id = d.objects[0].id;
  for (const D of [1, 10, 100]) {
    let out; try { out = directOps.extendSurface(d, id, 'u-max', D); } catch (e: any) { console.log(`R=${R} D=${D} REFUSE ${e.code} ${e.message.slice(0, 90)}`); continue; }
    const g = geometryOf(out, out.objects.at(-1)!) as Surface, dm = surfaceDomain(g);
    let arc = 0, ext = 0, far = 0;
    for (let i = 0; i <= 400; i++) for (let j = 0; j <= 4; j++) {
      const u = i === 400 ? dm.u[1] : dm.u[0] + (dm.u[1] - dm.u[0]) * i / 400, p = evaluateSurface(g, u, dm.v[0] + (dm.v[1] - dm.v[0]) * j / 4);
      if (p[0] >= 0) arc = Math.max(arc, Math.abs(Math.hypot(p[0], p[1]) - R)); else ext = Math.max(ext, Math.abs(p[1] - R));
      if (i === 400) far = Math.max(far, Math.abs(p[1] - R), Math.abs(p[0] + D));
    }
    console.log(`R=${R} D=${D} ACCEPT arc-part dev=${arc.toExponential(2)} extension-part dev from tangent plane=${ext.toExponential(2)} far-edge dev=${far.toExponential(2)}`);
  }
}

import { directOps, emptyDirect, geometryOf, importSource } from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/direct';
import { q, dec, affineBound, toNum, type V3, type Q } from './oracle';
const src = `@model d347 { version:0; length-unit:mm;
 @surface #panel { type:nurbs; degree-u:1; degree-v:1;
  knots-u:[2,2,5,5]; knots-v:[-1,-1,3,3];
  control-points:[[[7,-11,13],[7,-11,21]],[[16,1,13],[16,1,21]]];
  weights:[[1,1],[1,1]]; }
}`;
const d = importSource(emptyDirect(), src, 'd347'), id = d.objects[0].id;
const v = (...x: (number|Q)[]) => x.map(k => typeof k === 'number' ? q(BigInt(k)) : k) as V3;
const A = v(7, -11, 13), U = v(3, 4, 0), V = v(0, 0, 2);
const sc = (a: V3, k: Q): V3 => a.map(x => q(x.n * k.n, x.d * k.d)) as V3;
const ad = (a: V3, b: V3): V3 => a.map((x, i) => q(x.n * b[i].d + b[i].n * x.d, x.d * b[i].d)) as V3;
// Reach r mm: u parameter increment r/5, v increment r/2.
function expected(edge: string, r: Q) {
  const du = q(r.n, r.d * 5n), dv = q(r.n, r.d * 2n), su = q(3n * du.d + du.n, du.d), tv = q(4n * dv.d + dv.n, dv.d);
  if (edge === 'u-max') return { origin: A, ds: sc(U, su), dt: sc(V, q(4n)) };
  if (edge === 'u-min') return { origin: ad(A, sc(U, q(-du.n, du.d))), ds: sc(U, su), dt: sc(V, q(4n)) };
  if (edge === 'v-max') return { origin: A, ds: sc(U, q(3n)), dt: sc(V, tv) };
  return { origin: ad(A, sc(V, q(-dv.n, dv.d))), ds: sc(U, q(3n)), dt: sc(V, tv) };
}
const reaches = (process.argv[2] ?? '2.5').split(',');
for (const edge of ['u-max','u-min','v-max','v-min']) for (const rs of reaches) {
  try {
    const r = directOps.extendSurface(d, id, edge as any, Number(rs)), g: any = geometryOf(r, r.objects.at(-1)!);
    const b = affineBound(g, expected(edge, dec(rs.includes('e') ? Number(rs).toFixed(20) : rs)));
    console.log(edge, rs, 'knotsOk', b.knotsOk, 'pos', toNum(b.position), 'dS', toNum(b.derivS), 'dT', toNum(b.derivT), 'ok', toNum(b.position) <= 1e-7);
  } catch (e: any) { console.log(edge, rs, 'THROW', e.code, e.message.slice(0, 90)); }
}

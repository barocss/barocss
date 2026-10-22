// Independent raw area moments: signed triangles and unsigned circular sectors.
// No production loop, Green integration, section report or mass routine is used.
const zero = () => [0, 0, 0, 0, 0, 0]; // A, Ux, Uy, Qxx, Qxy, Qyy
const add = (a, b, s = 1) => a.map((v, i) => v + s * b[i]);
function triangle(v, signed = false) {
  const [a, b, c] = v, det = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const A = (signed ? det : Math.abs(det)) / 2, sx = a[0] + b[0] + c[0], sy = a[1] + b[1] + c[1];
  return [A, A * sx / 3, A * sy / 3, A * (v.reduce((s, p) => s + p[0] ** 2, 0) + sx ** 2) / 12,
    A * (v.reduce((s, p) => s + p[0] * p[1], 0) + sx * sy) / 12, A * (v.reduce((s, p) => s + p[1] ** 2, 0) + sy ** 2) / 12];
}
function sector(C, T1, T2, r) {
  let a = Math.atan2(T1[1] - C[1], T1[0] - C[0]), b = Math.atan2(T2[1] - C[1], T2[0] - C[0]);
  while (b < a) b += 2 * Math.PI;
  if (b - a > Math.PI) [a, b] = [b, a + 2 * Math.PI];
  const d = b - a, A = r * r * d / 2, ux = r ** 3 * (Math.sin(b) - Math.sin(a)) / 3, uy = r ** 3 * (Math.cos(a) - Math.cos(b)) / 3;
  const xx = r ** 4 / 4 * (d / 2 + (Math.sin(2 * b) - Math.sin(2 * a)) / 4), yy = r ** 4 / 4 * (d / 2 - (Math.sin(2 * b) - Math.sin(2 * a)) / 4), xy = r ** 4 * (Math.sin(b) ** 2 - Math.sin(a) ** 2) / 8;
  return [A, ux + A * C[0], uy + A * C[1], xx + 2 * C[0] * ux + A * C[0] ** 2,
    xy + C[0] * uy + C[1] * ux + A * C[0] * C[1], yy + 2 * C[1] * uy + A * C[1] ** 2];
}
export function sectionOracle(s) {
  const { height: h, width: b, web: w, flange: f, rootRadius: root } = s, k = s.flangeSlope ?? 0, toe = s.toeRadius ?? 0;
  const a = s.kind === 'i-beam' ? (b - w) / 2 : b - w, tWeb = f + k * a / 2, tTip = f - k * a / 2;
  const poly = s.kind === 'i-beam' ? [[-b/2,-h/2],[b/2,-h/2],[b/2,-h/2+tTip],[w/2,-h/2+tWeb],[w/2,h/2-tWeb],[b/2,h/2-tTip],[b/2,h/2],[-b/2,h/2],[-b/2,h/2-tTip],[-w/2,h/2-tWeb],[-w/2,-h/2+tWeb],[-b/2,-h/2+tTip]] : [[0,0],[b,0],[b,tTip],[w,tWeb],[w,h-tWeb],[b,h-tTip],[b,h],[0,h]];
  const roots = s.kind === 'i-beam' ? [3,4,9,10] : [3,4], toes = s.kind === 'i-beam' ? [2,5,8,11] : [2,5];
  let m = poly.reduce((sum, p, i) => add(sum, triangle([[0,0], p, poly[(i+1)%poly.length]], true)), zero());
  for (let i = 0; i < poly.length; i++) {
    const r = roots.includes(i) ? root : toes.includes(i) ? toe : 0;
    if (!r) continue;
    const V = poly[i], P = poly[(i+poly.length-1)%poly.length], N = poly[(i+1)%poly.length];
    const unit = p => { const l = Math.hypot(...p); return p.map(v => v/l); }, u = unit(P.map((v,j)=>v-V[j])), v = unit(N.map((x,j)=>x-V[j]));
    const alpha = Math.acos(u[0]*v[0]+u[1]*v[1]), d = r/Math.tan(alpha/2), bis = unit(u.map((x,j)=>x+v[j]));
    const T1 = V.map((x,j)=>x+d*u[j]), T2 = V.map((x,j)=>x+d*v[j]), C = V.map((x,j)=>x+bis[j]*r/Math.sin(alpha/2));
    const spandrel = add(add(triangle([V,T1,T2]), triangle([C,T1,T2])), sector(C,T1,T2,r), -1);
    m = add(m, spandrel, roots.includes(i) ? 1 : -1);
  }
  const [A, ux, uy, xx, xy, yy] = m, cx = ux/A, cy = uy/A;
  return { A, c:[cx,cy], Jxx:yy-A*cy*cy, Jyy:xx-A*cx*cx, Jxy:xy-A*cx*cy };
}
export function prismOracle(s, L, rho = 7850) {
  const o = sectionOracle(s), q = rho * 1e-15 * L, { A,Jxx,Jyy,Jxy } = o;
  return { ...o, volume: A*L, mass:rho*A*L*1e-9, inertia:[[q*(Jxx+A*L*L/12),-q*Jxy,0],[-q*Jxy,q*(Jyy+A*L*L/12),0],[0,0,q*(Jxx+Jyy)]] };
}

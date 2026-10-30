import { evaluateSurface, interpolateSurfacePlain } from '@barocss/cad';
const A=[7,-11,13],U=[3,4,0],V=[0,0,2];
const S = (u: number, v: number) => [0,1,2].map(k => A[k] + (u-2)*U[k] + (v+1)*V[k]) as [number,number,number];
const round9 = (x: number) => Math.round(x * 1e9) / 1e9;
for (const r of [1e-3, 1e-4, 1e-5, 1e-6, 1000, 1e5]) {
  const rows: [number,number,number][][] = [];
  for (let i = 0; i <= 11; i++) rows.push(Array.from({ length: 16 }, (_, j) => S(2 + 3 * i / 11, -1 + 4 * j / 15)));
  const t = [0.6, 0.8, 0]; const edge = rows[11];
  for (let k = 1; k <= 4; k++) rows.push(edge.map(p => p.map((x, c) => x + t[c] * r * k / 4) as [number,number,number]));
  const f = interpolateSurfacePlain(rows);
  const T = (s: number, tt: number) => [0,1,2].map(k => A[k] + s*(3 + r/5)*U[k] + 4*tt*V[k]);
  const mk = (rnd: boolean): any => ({ kind: 'surface', id: 's', degreeU: 3, degreeV: 3, knotsU: f.knotsU.map(x => rnd ? round9(x) : x), knotsV: f.knotsV.map(x => rnd ? round9(x) : x), controlPoints: f.points.map(row => row.map(p => p.map(x => rnd ? round9(x) : x))), weights: f.weights });
  for (const rnd of [false, true]) {
    const g = mk(rnd); let worst = 0;
    for (let i = 0; i <= 400; i++) for (let j = 0; j <= 20; j++) { const s = i / 400, tt = j / 20, p = evaluateSurface(g, s, tt), e = T(s, tt); worst = Math.max(worst, Math.hypot(p[0]-e[0], p[1]-e[1], p[2]-e[2])); }
    console.log(r, rnd ? 'rounded9' : 'raw', worst.toExponential(3));
  }
}

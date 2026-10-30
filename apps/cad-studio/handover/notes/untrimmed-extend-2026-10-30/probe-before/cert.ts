import { evaluateSurface, buildInterpolatingSurface, chordParameters } from '@barocss/cad';
const A=[7,-11,13],U=[3,4,0],V=[0,0,2];
const S = (u: number, v: number) => [0,1,2].map(k => A[k] + (u-2)*U[k] + (v+1)*V[k]) as [number,number,number];
const avg = (ls: number[][]) => ls[0].map((_, k) => ls.reduce((s, l) => s + l[k], 0) / ls.length);
for (const r of [2.5, 1e-3, 1e-4, 1e-5, 1e-6, 1000, 1e5]) {
  const rows: [number,number,number][][] = [];
  for (let i = 0; i <= 11; i++) rows.push(Array.from({ length: 16 }, (_, j) => S(2 + 3 * i / 11, -1 + 4 * j / 15)));
  const t = [0.6, 0.8, 0]; const edge = rows[11];
  for (let k = 1; k <= 4; k++) rows.push(edge.map(p => p.map((x, c) => x + t[c] * r * k / 4) as [number,number,number]));
  const ub = avg(Array.from({ length: 16 }, (_, j) => chordParameters(rows.map(rw => rw[j])))), vb = avg(rows.map(rw => chordParameters(rw)));
  try {
    const res: any = buildInterpolatingSurface(ub, vb, rows, { surfaceId: 'x', degreeU: 3, degreeV: 3, maximumBasisEvaluations: 8192, maximumEliminationSteps: 3840, maximumSurfaceEvaluations: 256 });
    const g = res.surface ?? res.geometry ?? res; const T = (s: number, tt: number) => [0,1,2].map(k => A[k] + s*(3 + r/5)*U[k] + 4*tt*V[k]);
    let worst = 0; for (let i = 0; i <= 400; i++) for (let j = 0; j <= 20; j++) { const p = evaluateSurface(g, i/400, j/20), e = T(i/400, j/20); worst = Math.max(worst, Math.hypot(p[0]-e[0],p[1]-e[1],p[2]-e[2])); }
    console.log(r, 'CERT SUCCESS', 'dense', worst.toExponential(3), 'gridmax', res.report?.maximumPointDifferenceMM, Object.keys(res).join(','));
  } catch (e: any) { console.log(r, 'CERT REFUSED', e.code, String(e.message).slice(0, 160)); }
}

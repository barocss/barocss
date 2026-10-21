// K7b (D147): the fitting cases the old studio engine/fit.ts was run on; its outputs are fixtures/k7b-fit-plain.json.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = s + 1831565813 >>> 0;
    let t = s;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function inserted(c, u) {
  const p = c.degree, U = c.knots, k = U.findIndex((x, i) => x <= u && u < U[i + 1]), Q = [];
  for (let i = 0; i <= c.points.length; i++) {
    if (i <= k - p) Q.push(c.points[i]);
    else if (i > k) Q.push(c.points[i - 1]);
    else {
      const a = (u - U[i]) / (U[i + p] - U[i]);
      Q.push([0, 1, 2].map((d) => (1 - a) * c.points[i - 1][d] + a * c.points[i][d]));
    }
  }
  return { degree: p, knots: [...U.slice(0, k + 1), u, ...U.slice(k + 1)], points: Q, weights: Q.map(() => 1) };
}
function cases() {
  const r = rng(77), curves = [];
  curves.push({ name: "64 samples of a wave", points: Array.from({ length: 64 }, (_, k) => [k, Math.sin(k / 5) * 10, Math.cos(k / 7) * 3]), degree: 3 });
  curves.push({ name: "40 points at 25 m", points: Array.from({ length: 40 }, (_, k) => [k * 600, Math.sin(k) * 2e3, k * k]), degree: 3 });
  curves.push({ name: "two points", points: [[0, 0, 0], [3, 4, 0]], degree: 3 });
  curves.push({ name: "three points", points: [[0, 0, 0], [3, 4, 0], [5, 0, 1]], degree: 3 });
  for (let k = 0; k < 8; k++) {
    const n2 = 5 + Math.floor(r() * 60);
    let x = 0;
    curves.push({ name: `random ${n2} p${1 + k % 3}`, points: Array.from({ length: n2 }, () => {
      x += 0.3 + r() * 4;
      return [x, r() * 30 - 15, r() * 30 - 15];
    }), degree: 1 + k % 3 });
  }
  const approx = [{ name: "wave 64 \u2192 5", from: 0, count: 5 }, { name: "wave 64 \u2192 12", from: 0, count: 12 }, { name: "wave 64 \u2192 64", from: 0, count: 64 }, { name: "random \u2192 7", from: 4, count: 7 }, { name: "25 m 40 \u2192 9", from: 1, count: 9 }];
  const wave = { degree: 3, knots: [0, 0, 0, 0, 0.5, 1, 1, 1, 1], points: [[0, 0, 0], [5, 10, 0], [10, -10, 0], [15, 10, 0], [20, 0, 0]], weights: [1, 1, 1, 1, 1] };
  const removals = [
    { name: "an inserted knot", c: inserted(wave, 0.25), u: 0.25, tol: 1e-6 },
    { name: "an inserted knot, a second time", c: inserted(inserted(wave, 0.75), 0.75), u: 0.75, tol: 1e-6 },
    { name: "a shaping knot", c: { degree: 3, knots: [0, 0, 0, 0, 0.5, 1, 1, 1, 1], points: [[0, 0, 0], [5, 10, 0], [10, -10, 0], [15, 10, 0], [20, 0, 0]], weights: [1, 1, 1, 1, 1] }, u: 0.5, tol: 1e-3 },
    { name: "a rational curve, loose", c: { degree: 2, knots: [0, 0, 0, 0.3, 0.6, 1, 1, 1], points: [[0, 0, 0], [1, 2, 0], [3, 2, 1], [4, 0, 1], [6, 1, 0]], weights: [1, 0.8, 1.2, 0.9, 1] }, u: 0.32, tol: 10 }
  ];
  const n = 15, C0 = (u) => [20 * u, 0, 3 * Math.sin(Math.PI * u)], C2 = (u) => [20 * u, 15, -2 * Math.sin(Math.PI * u)], D0 = (v) => [0, 15 * v, 0], D1 = (v) => [20, 15 * v, 0];
  const P00 = C0(0), P10 = C0(1), P01 = C2(0), P11 = C2(1);
  const fill = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: n + 1 }, (_2, j) => {
    const u = i / n, v = j / n, a = C0(u), b = C2(u), c = D0(v), e = D1(v);
    return [0, 1, 2].map((k) => (1 - v) * a[k] + v * b[k] + (1 - u) * c[k] + u * e[k] - ((1 - u) * (1 - v) * P00[k] + u * (1 - v) * P10[k] + (1 - u) * v * P01[k] + u * v * P11[k]));
  }));
  const wide = Array.from({ length: 24 }, (_, i) => Array.from({ length: 9 }, (_2, j) => [i * 3, j * 4, Math.sin(i / 4) * Math.cos(j / 3) * 5]));
  const surfaces = [{ name: "fill 16 \xD7 16", grid: fill, p: 3, q: 3 }, { name: "a 24 \xD7 9 grid, 3 \xD7 2", grid: wide, p: 3, q: 2 }, { name: "a 3 \xD7 2 grid", grid: [[[0, 0, 0], [0, 1, 0]], [[1, 0, 1], [1, 1, 0]], [[2, 0, 0], [2, 1, 1]]], p: 3, q: 3 }];
  return { curves, approx, removals, surfaces };
}
export {
  cases
};

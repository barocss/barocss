// FR2 (D124): writes conformance/fr/'s frame cases, every expected value by closed form here (not by the kernel).
// node scripts/fr2-conformance.mjs [dir]   (default: conformance/fr)
import { writeFileSync } from 'node:fs';
const dir = process.argv[2] ?? new URL('../conformance/fr', import.meta.url).pathname;
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const SP = 1 - Math.PI / 4, dist = (a, b) => Math.hypot(...a.map((x, i) => b[i] - x)), mid = (a, b) => a.map((x, i) => (x + b[i]) / 2);
const write = (name, c) => writeFileSync(`${dir}/${name}.json`, JSON.stringify({ id: `fr-${name}`, step: 'FR', decisions: ['D124'], ...c }, null, 2) + '\n');
const RHS = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 6 }, A_RHS = 1600 - (4 - Math.PI) * 36 - (34 * 34 - (4 - Math.PI) * 9);
{ // a box frame: 4 legs, 4 top rails, 4 bottom rails, each its own body
  const W = 600, Dp = 400, H = 700, points = [[0, 0, 0], [W, 0, 0], [W, Dp, 0], [0, Dp, 0], [0, 0, H], [W, 0, H], [W, Dp, H], [0, Dp, H]];
  const segments = [[0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [7, 4], [0, 1], [1, 2], [2, 3], [3, 0]];
  // Legs along up (+Z): y takes +X, x = y × u = −Y. Rails: y +Z, x = y × u.
  const axes = ([i, j]) => { const u = points[j].map((c, k) => (c - points[i][k]) / dist(points[i], points[j])); if (u[2]) return { xAxis: [0, -u[2], 0].map(c => c + 0), yAxis: [1, 0, 0], upFallback: [1, 0, 0] }; return { xAxis: [-u[1], u[0], 0].map(c => c + 0), yAxis: [0, 0, 1] }; };
  write('frame-box-12', { about: 'FR2: a 600 × 400 × 700 box frame of 40 × 40 × 3 round-cornered tubes, one member per edge, each its own body f/0 … f/11: A·L each, centroids on the edges\' midpoints, the legs\' y from the fallback, the rails\' along +Z.',
    input: { partDocument: D([{ id: 'f', kind: 'frame', points, segments, section: RHS }]) },
    expect: { outputs: segments.map(s => ({ volume: { value: A_RHS * dist(points[s[0]], points[s[1]]), relTol: 1e-9 }, centroid: { value: mid(points[s[0]], points[s[1]]), absTol: 1e-9 }, bodies: 1, topology: [{ shells: 1, genus: 1 }],
      member: { area: A_RHS, length: dist(points[s[0]], points[s[1]]), centroid: [0, 0], ...axes(s), derived: { innerRadius: 'concentric: ro − t' }, absTol: 1e-9 } })), stepRoundTrip: { relTol: 1e-9 } },
    oracle: 'Closed forms: A = bh − (4 − π)ro² − [(b − 2t)(h − 2t) − (4 − π)ri²]; each member A·L on its edge, its centroid at the edge\'s midpoint; the section frame by the up rule (y = up made square to the line, x = y × u; along up, y = +X).' });
}
{ // two angle stiles, the second mirrored by override, anchored at their heels
  const a = 50, b = 30, t = 5, r1 = 6, r2 = 3, L = 1000, s1 = SP * r1 * r1, s2 = SP * r2 * r2, c1 = r1 * (10 - 3 * Math.PI) / (3 * (4 - Math.PI)), c2 = r2 * (10 - 3 * Math.PI) / (3 * (4 - Math.PI));
  const A = t * (a + b - t) + SP * (r1 * r1 - 2 * r2 * r2);
  const cx = (a * t * a / 2 + t * (b - t) * t / 2 + s1 * (t + c1) - s2 * (a - c2) - s2 * (t - c2)) / A, cy = (a * t * t / 2 + t * (b - t) * (t + b) / 2 + s1 * (t + c1) - s2 * (t - c2) - s2 * (b - c2)) / A;
  // Along +Y, up +Z: x = −X, y = +Z. The first: centroid at (−x̄, ·, ȳ); the mirrored one's section centroid (−x̄, ȳ), so at 400 + x̄.
  write('frame-mirrored-angles', { about: 'FR2: two 50 × 30 × 5 angle stiles along +Y anchored at their heels, the second mirrored by an override (turned over across its own y axis): the same A·L, centroids by moments, x̄ negated in the mirrored frame.',
    input: { partDocument: D([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [0, L, 0], [400, 0, 0], [400, L, 0]], segments: [[0, 1], [2, 3]], section: { kind: 'angle', legX: a, legY: b, thickness: t, rootRadius: r1, toeRadius: r2 }, anchor: 'origin', overrides: [{ member: 1, mirror: true }] }]) },
    expect: { outputs: [
      { volume: { value: A * L, relTol: 1e-9 }, centroid: { value: [-cx, L / 2, cy], absTol: 1e-9 }, bodies: 1, topology: [{ shells: 1, genus: 0 }], member: { area: A, length: L, centroid: [cx, cy], xAxis: [-1, 0, 0], yAxis: [0, 0, 1], derived: null, absTol: 1e-9 } },
      { volume: { value: A * L, relTol: 1e-9 }, centroid: { value: [400 + cx, L / 2, cy], absTol: 1e-9 }, bodies: 1, topology: [{ shells: 1, genus: 0 }], member: { area: A, length: L, centroid: [-cx, cy], xAxis: [-1, 0, 0], yAxis: [0, 0, 1], derived: null, absTol: 1e-9 } },
    ], stepRoundTrip: { relTol: 1e-9 } },
    oracle: 'Closed forms: A = t(a + b − t) + (1 − π/4)(r1² − 2r2²); the centroid by moments (legs, the root\'s spandrel added, the toes\' taken off); mirrored, x ↦ −x.' });
}
const P = [[0, 0, 0], [100, 0, 0], [300, 0, 0], [0, 100, 0]];
write('refuse-skeleton-overlap', { about: 'FR2: two segments on one line sharing 200 mm are refused by name (a member would run through another).', input: { partDocument: D([{ id: 'f', kind: 'frame', points: P, segments: [[0, 2], [1, 2]], section: RHS }]) },
  expect: { error: { code: 'PARAMETER', messageIncludes: '[SKELETON_OVERLAP] segments 0 and 1 lie on one line and share 200 mm' } }, oracle: 'By construction: both on y = z = 0, [0, 300] and [100, 300] share [100, 300].' });
write('refuse-member-duplicate', { about: 'FR2: two segments on the same two points (either way round) are refused by name.', input: { partDocument: D([{ id: 'f', kind: 'frame', points: P, segments: [[0, 3], [3, 0]], section: RHS }]) },
  expect: { error: { code: 'PARAMETER', messageIncludes: '[MEMBER_DUPLICATE] segments 0 and 1 join the same two points' } }, oracle: 'By construction.' });

// The section view at once, while its plane is dragged: each display mesh clipped by the plane on the
// CPU (its triangles cut, the far side left out) and capped with the section (the cut loops, nested
// outer and hole, triangulated). The kernel's exact section (a Split) replaces it when it arrives.
import { triangulatePolygonWithHoles } from '@barocss/cad';
import type { DisplayFace, DisplayMesh, Vec3 } from './mesh';
import { signedArea as area, insideRing as inside } from './geom2';

type XY = [number, number];

/**
 * The mesh on the `keep` side of the plane across axis `k` at `at`, its cut capped by one face named
 * `capName`; the mesh itself when it lies on that side, null when it lies wholly beyond.
 */
export function clipMesh(m: DisplayMesh, k: 0 | 1 | 2, at: number, keep: 'negative' | 'positive', capName: string): DisplayMesh | null {
  const P = m.positions, sg = keep === 'negative' ? -1 : 1, nv = P.length / 3;
  const size = Math.max(1, ...m.bounds.max.map(Math.abs), ...m.bounds.min.map(Math.abs)), eps = 1e-9 * size;
  const d = new Float64Array(nv);
  let lo = Infinity, hi = -Infinity;
  for (let v = 0; v < nv; v++) { const x = sg * (P[v * 3 + k] - at); d[v] = Math.abs(x) <= eps ? 0 : x; lo = Math.min(lo, d[v]); hi = Math.max(hi, d[v]); }
  if (lo >= 0) return m;
  if (hi <= 0) return null;
  const pos = Array.from(P), nor = Array.from(m.normals), fov = Array.from(m.faceOfVertex), idx: number[] = [];
  // A crossing on edge (a, b), the same point from either triangle (and either face) that shares it.
  const crossing = new Map<string, number>();
  const cut = (a: number, b: number) => {
    const pa = [P[a * 3], P[a * 3 + 1], P[a * 3 + 2]], pb = [P[b * 3], P[b * 3 + 1], P[b * 3 + 2]];
    const swap = pa[0] > pb[0] || (pa[0] === pb[0] && (pa[1] > pb[1] || (pa[1] === pb[1] && pa[2] > pb[2])));
    const [i, j] = swap ? [b, a] : [a, b], t = d[i] / (d[i] - d[j]);
    const x = [0, 1, 2].map(c => P[i * 3 + c] + (P[j * 3 + c] - P[i * 3 + c]) * t); x[k] = at;
    const key = a + ',' + b, had = crossing.get(key); if (had !== undefined) return had;
    const n = pos.length / 3;
    pos.push(x[0], x[1], x[2]);
    const N = [0, 1, 2].map(c => m.normals[i * 3 + c] + (m.normals[j * 3 + c] - m.normals[i * 3 + c]) * t), l = Math.hypot(N[0], N[1], N[2]) || 1;
    nor.push(N[0] / l, N[1] / l, N[2] / l); fov.push(m.faceOfVertex[a]);
    crossing.set(key, n); crossing.set(b + ',' + a, n);
    return n;
  };
  // Segments of the cut (pairs of points in the plane's two other coordinates).
  const [u, w] = [0, 1, 2].filter(c => c !== k), segs: [XY, XY][] = [];
  const I = m.indices;
  for (let t = 0; t < I.length; t += 3) {
    const tri = [I[t], I[t + 1], I[t + 2]];
    if (tri.every(v => d[v] >= 0)) { idx.push(...tri); continue; }
    if (tri.every(v => d[v] <= 0)) {
      // An edge lying in the plane, its triangle beyond: that edge bounds the cut (its kept neighbour gives none).
      const zero = tri.filter(v => d[v] === 0);
      if (zero.length === 2) segs.push(zero.map(v => [P[v * 3 + u], P[v * 3 + w]] as XY) as [XY, XY]);
      continue;
    }
    // Sutherland–Hodgman against d ≥ 0, then a fan; the polygon's points on the plane bound the cut.
    const poly: number[] = [], on: number[] = [];
    for (let e = 0; e < 3; e++) {
      const a = tri[e], b = tri[(e + 1) % 3];
      if (d[a] >= 0) { poly.push(a); if (d[a] === 0) on.push(a); }
      if ((d[a] > 0 && d[b] < 0) || (d[a] < 0 && d[b] > 0)) { const c = cut(a, b); poly.push(c); on.push(c); }
    }
    for (let q = 1; q + 1 < poly.length; q++) idx.push(poly[0], poly[q], poly[q + 1]);
    if (on.length === 2) segs.push(on.map(v => [pos[v * 3 + u], pos[v * 3 + w]] as XY) as [XY, XY]);
  }
  // The cut's loops: segments chained end to end (by rounded point).
  const key = (p: XY) => Math.round(p[0] * 1e5) + ',' + Math.round(p[1] * 1e5);
  const next = new Map<string, { p: XY; to: string[] }>();
  for (const [a, b] of segs) {
    const ka = key(a), kb = key(b); if (ka === kb) continue;
    (next.get(ka) ?? next.set(ka, { p: a, to: [] }).get(ka)!).to.push(kb);
    (next.get(kb) ?? next.set(kb, { p: b, to: [] }).get(kb)!).to.push(ka);
  }
  const loops: XY[][] = [], seen = new Set<string>();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const ring: XY[] = []; let cur = start, prev = '';
    while (!seen.has(cur)) {
      seen.add(cur); const node = next.get(cur)!; ring.push(node.p);
      const go = node.to.find(x => x !== prev && !seen.has(x)) ?? node.to.find(x => x !== prev); if (go === undefined) break;
      prev = cur; cur = go;
    }
    if (ring.length >= 3) loops.push(ring);
  }
  const depth = loops.map((r, i) => loops.filter((o, j) => j !== i && Math.abs(area(o)) > Math.abs(area(r)) && inside(r[0], o)).length);
  // The cap faces out of the kept side: its normal along −keep.
  const nCap: Vec3 = [0, 0, 0]; nCap[k] = -sg;
  const capStart = pos.length / 3, capFace = m.faces.length, capPos: number[] = [], capIdx: number[] = [];
  let capArea = 0;
  loops.forEach((outer, i) => {
    if (depth[i] % 2) return;
    const holes = loops.filter((h, j) => depth[j] === depth[i] + 1 && Math.abs(area(h)) < Math.abs(area(outer)) && inside(h[0], outer));
    const o = area(outer) > 0 ? outer : [...outer].reverse(), hs = holes.map(h => area(h) < 0 ? h : [...h].reverse());
    let tris: [number, number, number][];
    try { tris = triangulatePolygonWithHoles(o, hs); } catch { return; }
    const pts = [...o, ...hs.flat()], base = capStart + capPos.length / 3;
    for (const p of pts) { const x: Vec3 = [0, 0, 0]; x[k] = at; x[u] = p[0]; x[w] = p[1]; capPos.push(...x); }
    // (Wound to face along nCap: in (u, w) a counter-clockwise loop faces +x, −y or +z, as u × w does.)
    const asIs = (k === 1 ? -1 : 1) === -sg;
    for (const [a, b, c] of tris) capIdx.push(...(asIs ? [base + a, base + b, base + c] : [base + a, base + c, base + b]));
    capArea += Math.abs(area(o)) - hs.reduce((s, h) => s + Math.abs(area(h)), 0);
  });
  const capCount = capPos.length / 3;
  for (let v = 0; v < capCount; v++) { nor.push(...nCap); fov.push(capFace); }
  pos.push(...capPos); idx.push(...capIdx);
  // Centre of the cap (its points' mean) for whatever reads face centroids.
  const centroid: Vec3 = [0, 0, 0];
  for (let v = 0; v < capCount; v++) for (let c = 0; c < 3; c++) centroid[c] += capPos[v * 3 + c] / Math.max(1, capCount);
  const cap: DisplayFace = { index: capFace, id: 'section-cap', name: capName, kind: 'plane', normal: nCap, centroid, area: capArea };
  // Edge lines: the kept parts of each segment.
  const L = m.edgeLines, lines: number[] = [], of: number[] = [];
  for (let s = 0; s < L.length; s += 6) {
    const a = [L[s], L[s + 1], L[s + 2]], b = [L[s + 3], L[s + 4], L[s + 5]], da = sg * (a[k] - at), db = sg * (b[k] - at);
    if (da < 0 && db < 0) continue;
    const e = m.edgeOfSegment[s / 3];
    if (da >= 0 && db >= 0) { lines.push(...a, ...b); of.push(e, e); continue; }
    const t = da / (da - db), x = a.map((c, i) => c + (b[i] - c) * t);
    lines.push(...(da >= 0 ? [...a, ...x] : [...x, ...b])); of.push(e, e);
  }
  const min: Vec3 = [...m.bounds.min], max: Vec3 = [...m.bounds.max];
  if (sg < 0) max[k] = Math.min(max[k], at); else min[k] = Math.max(min[k], at);
  return {
    positions: new Float32Array(pos), normals: new Float32Array(nor), faceOfVertex: new Float32Array(fov), indices: new Uint32Array(idx),
    faces: [...m.faces, cap], edgeLines: new Float32Array(lines), edgeOfSegment: new Float32Array(of), edges: m.edges, bounds: { min, max },
  };
}

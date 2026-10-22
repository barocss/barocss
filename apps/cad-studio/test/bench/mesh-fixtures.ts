// Deterministic test meshes for the mesh-body benchmark (no downloads): closed organic shapes (a torus with
// lumps and thin fins) at three sizes, a scan-like sphere sampled unevenly, and broken variants of the small
// organic one. Positions xyz per vertex, indices three per triangle (counter-clockwise from outside).
export interface MeshFixture { name: string; note: string; positions: Float64Array; indices: Uint32Array }

/** A small seeded generator (mulberry32). */
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** A torus of n × m quads (2nm triangles), its tube radius lumpy and with thin fins round it: closed and manifold. */
export function organicTorus(n: number, m: number, seed = 1): MeshFixture {
  const R = 40, r = 14, rnd = random(seed), phases = Array.from({ length: 6 }, () => rnd() * 2 * Math.PI);
  const positions = new Float64Array(n * m * 3), indices = new Uint32Array(n * m * 6);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const u = 2 * Math.PI * i / n, v = 2 * Math.PI * j / m;
    // Lumps, and fins: thin ridges eight times round the ring.
    const lump = 0.18 * Math.sin(3 * u + phases[0]) * Math.cos(2 * v + phases[1]) + 0.08 * Math.sin(7 * u + 5 * v + phases[2]);
    const fin = 0.45 * Math.pow(Math.max(0, Math.cos(8 * u + phases[3])), 60), rr = r * (1 + lump + fin);
    const k = 3 * (i * m + j);
    positions[k] = (R + rr * Math.cos(v)) * Math.cos(u); positions[k + 1] = (R + rr * Math.cos(v)) * Math.sin(u); positions[k + 2] = rr * Math.sin(v);
  }
  let t = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const a = i * m + j, b = ((i + 1) % n) * m + j, c = ((i + 1) % n) * m + (j + 1) % m, d = i * m + (j + 1) % m;
    indices[t++] = a; indices[t++] = b; indices[t++] = c; indices[t++] = a; indices[t++] = c; indices[t++] = d;
  }
  return { name: `organic-${Math.round(2 * n * m / 1000)}k`, note: `torus ${n}×${m}, lumps and fins`, positions, indices };
}

/** A sphere sampled like a scan: rows bunched towards one pole, each row's points jittered round, a fan at each pole. */
export function scanSphere(rows: number, cols: number, seed = 2): MeshFixture {
  const rnd = random(seed), Rs = 30, pos: number[] = [0, 0, Rs], idx: number[] = [];
  for (let i = 1; i < rows; i++) {
    const v = Math.PI * Math.pow(i / rows, 1.6), shift = rnd() * 2 * Math.PI / cols;
    for (let j = 0; j < cols; j++) {
      const u = shift + 2 * Math.PI * (j + 0.35 * (rnd() - 0.5)) / cols, rr = Rs * (1 + 0.01 * (rnd() - 0.5));
      pos.push(rr * Math.sin(v) * Math.cos(u), rr * Math.sin(v) * Math.sin(u), rr * Math.cos(v));
    }
  }
  const south = pos.length / 3; pos.push(0, 0, -Rs);
  const at = (i: number, j: number) => 1 + (i - 1) * cols + ((j % cols) + cols) % cols;
  for (let j = 0; j < cols; j++) idx.push(0, at(1, j), at(1, j + 1));
  for (let i = 1; i < rows - 1; i++) for (let j = 0; j < cols; j++) { const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1); idx.push(a, b, c, a, c, d); }
  for (let j = 0; j < cols; j++) idx.push(south, at(rows - 1, j + 1), at(rows - 1, j));
  return { name: `scan-${Math.round(idx.length / 3000)}k`, note: `sphere ${rows} rows bunched, ${cols} jittered columns`, positions: Float64Array.from(pos), indices: Uint32Array.from(idx) };
}

/** Broken copies of a closed mesh, one defect each (what generated and scanned meshes come with). */
export function brokenVariants(base: MeshFixture): MeshFixture[] {
  const P = base.positions, I = base.indices, out: MeshFixture[] = [];
  const make = (name: string, note: string, positions: ArrayLike<number>, indices: ArrayLike<number>): MeshFixture => ({ name: `broken-${name}`, note, positions: Float64Array.from(positions), indices: Uint32Array.from(indices) });
  // A hole: twenty triangles taken out.
  out.push(make('hole', '20 triangles removed (an open boundary)', P, [...I.slice(0, 300), ...I.slice(360)]));
  // A flipped patch: 50 triangles wound the other way.
  const flip = Uint32Array.from(I); for (let t = 1000; t < 1050; t++) { const x = flip[3 * t + 1]; flip[3 * t + 1] = flip[3 * t + 2]; flip[3 * t + 2] = x; }
  out.push(make('flipped', '50 triangles wound the wrong way', P, flip));
  // A non-manifold edge: a fin triangle on an existing edge (three triangles at it).
  const pos2 = [...P, P[0] + 5, P[1] + 5, P[2] + 5], apex = P.length / 3;
  out.push(make('nonmanifold', 'one extra triangle on an existing edge', pos2, [...I, I[0], I[1], apex, I[1], I[0], apex]));
  // Degenerate triangles: ten of zero area (a repeated corner) added.
  const deg: number[] = []; for (let t = 0; t < 10; t++) deg.push(I[3 * t], I[3 * t], I[3 * t + 1]);
  out.push(make('degenerate', '10 zero-area triangles added', P, [...I, ...deg]));
  // Floating shells: three small closed boxes beside the body.
  const shellPos = [...P], shellIdx = [...I];
  for (let s = 0; s < 3; s++) addBox(shellPos, shellIdx, [80 + 4 * s, 0, 0], 1);
  out.push(make('shells', '3 small closed boxes floating beside it', shellPos, shellIdx));
  // A self-intersection: a closed box pushed through the body's wall (two shells crossing).
  const crossPos = [...P], crossIdx = [...I]; addBox(crossPos, crossIdx, [40, 0, 14], 6);
  out.push(make('selfintersect', 'a closed box through the wall (shells crossing)', crossPos, crossIdx));
  return out;
}
/** An axis box of half-size h at c, outward. */
export function addBox(pos: number[], idx: number[], c: readonly number[], h: number): void {
  const b = pos.length / 3;
  for (let k = 0; k < 8; k++) pos.push(c[0] + (k & 1 ? h : -h), c[1] + (k & 2 ? h : -h), c[2] + (k & 4 ? h : -h));
  const quads = [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]];
  for (const [a, e, c2, d] of quads) idx.push(b + a, b + e, b + c2, b + a, b + c2, b + d);
}

/** Every fixture the benchmark runs, by name. */
export function fixtures(): Map<string, () => MeshFixture> {
  const small = () => organicTorus(100, 100);
  const out = new Map<string, () => MeshFixture>([
    ['organic-2k', () => organicTorus(32, 32)], ['organic-5k', () => organicTorus(50, 50)], ['organic-20k', small], ['organic-200k', () => organicTorus(316, 316)], ['organic-1000k', () => organicTorus(707, 707)], ['scan-200k', () => scanSphere(318, 316)],
  ]);
  for (const b of ['hole', 'flipped', 'nonmanifold', 'degenerate', 'shells', 'selfintersect']) out.set(`broken-${b}`, () => brokenVariants(small()).find(f => f.name === `broken-${b}`)!);
  return out;
}

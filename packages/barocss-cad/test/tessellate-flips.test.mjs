import test from 'node:test';
import assert from 'node:assert/strict';
import { subdBrep, tessellateBrep } from '../dist/index.js';

// D104: the tessellation's Lawson flips of a flat triangle (points on one line) ran round a cycle — flat triangles
// flipping into flat triangles — on every pass up to the cap D91 raised to 50 + the triangle count, so a SubD box of
// 18 × 18 quads a side (the studio's bench) took 7 s instead of under 1.
/** A box's cage, w × d × h, n quads along each side, wound outward (the studio's `boxCage`). */
function boxCage(w, d, h, n) {
  const at = new Map(), positions = [], faces = [];
  const vertex = p => { const key = p.join(','); let i = at.get(key); if (i === undefined) { i = positions.length / 3; at.set(key, i); positions.push(-w / 2 + p[0] * w / n, -d / 2 + p[1] * d / n, p[2] * h / n); } return i; };
  for (const a of [0, 1, 2]) for (const s of [0, n]) {
    const [b, c] = s ? [(a + 1) % 3, (a + 2) % 3] : [(a + 2) % 3, (a + 1) % 3];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const p = (u, v) => { const q = [0, 0, 0]; q[a] = s; q[b] = u; q[c] = v; return vertex(q); };
      faces.push([p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)]);
    }
  }
  return { positions, faces };
}

test('D104 a SubD box of 18 × 18 quads a side tessellates in under 3.5 s (7 s with the flat-flip cycle, 0.7–0.8 s without), closed: every mesh edge used twice', () => {
  const b = subdBrep(boxCage(30, 20, 16, 18));
  tessellateBrep(b, { segmentsPerQuarter: 8 });
  const t0 = performance.now(), m = tessellateBrep(b, { segmentsPerQuarter: 8 }), ms = performance.now() - t0;
  assert.ok(ms < 3500, `${ms.toFixed(0)} ms`);
  // (Welded by position: faces meet bit for bit at their shared edges.)
  const P = m.positions, key = i => `${P[3 * i]},${P[3 * i + 1]},${P[3 * i + 2]}`, uses = new Map();
  for (let t = 0; t < m.indices.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = key(m.indices[t + k]), c = key(m.indices[t + (k + 1) % 3]); if (a === c) continue;
    const e = a < c ? `${a}|${c}` : `${c}|${a}`; uses.set(e, (uses.get(e) ?? 0) + 1);
  }
  assert.ok([...uses.values()].every(n => n === 2), 'every edge used twice');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { nearestGridPoints } from '../dist/brep/brep-mass-quadrature.js';

// R5.2 (D216): the inverter's pick of the four grid points nearest p replaced a stable sort of all 625 by squared
// distance. The oracle here is that sort, written as it was; equal distances must come out the same four, in the same
// order.
const reference = (grid, p) => grid.map((g, i) => ({ i, d: (g.p[0] - p[0]) * (g.p[0] - p[0]) + (g.p[1] - p[1]) * (g.p[1] - p[1]) + (g.p[2] - p[2]) * (g.p[2] - p[2]) })).sort((x, y) => x.d - y.d).slice(0, 4).map(x => x.i);
const pick = (grid, p) => { const out = [0, 0, 0, 0], n = nearestGridPoints(grid, p, out); return out.slice(0, n); };
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test('R5.2: the four nearest grid points, ties in grid order, as the stable sort had them (D216)', () => {
  // A 25 × 25 integer lattice with p at a lattice point, at a cell's centre and on an edge's midpoint: every distance
  // shared by 4 or 8 points, the fourth place inside a tie.
  const lattice = []; for (let i = 0; i <= 24; i++) for (let j = 0; j <= 24; j++) lattice.push({ p: [i, j, 0] });
  for (const p of [[12, 12, 0], [12.5, 12.5, 0], [12.5, 12, 0], [0, 0, 0], [24, 24, 0], [0.5, 24, 0], [-3, 7, 0], [12, 12, 5]]) assert.deepEqual(pick(lattice, p), reference(lattice, p), `${p}`);
  // Many points at one place and at one distance (a pole's row of the grid: one point 25 times).
  const pole = Array.from({ length: 625 }, (_, k) => ({ p: k % 25 === 0 ? [0, 0, 1] : [k % 7, (k * 3) % 5, (k * 11) % 4] }));
  for (const p of [[0, 0, 1], [0, 0, 0], [3, 2, 1], [6, 4, 3]]) assert.deepEqual(pick(pole, p), reference(pole, p), `pole ${p}`);
  // Random grids with values on a coarse step (many exact ties), and fewer than four points.
  const r = rng(7);
  for (let c = 0; c < 300; c++) {
    const n = c < 20 ? c % 5 : 625, grid = Array.from({ length: n }, () => ({ p: [Math.floor(r() * 4), Math.floor(r() * 4), Math.floor(r() * 2)] })), p = [Math.floor(r() * 8) / 2, Math.floor(r() * 8) / 2, Math.floor(r() * 4) / 2];
    assert.deepEqual(pick(grid, p), reference(grid, p), `case ${c}`);
  }
  // A distance that is not a number: the sort's own order.
  const odd = [...lattice.slice(0, 30), { p: [NaN, 0, 0] }, ...lattice.slice(30, 60)];
  assert.deepEqual(pick(odd, [3, 3, 0]), reference(odd, [3, 3, 0]));
});

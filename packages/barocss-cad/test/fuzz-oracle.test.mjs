import test from 'node:test';
import assert from 'node:assert/strict';
import { oracle } from '../scripts/rb/fuzz-oracle.mjs';

// RB5's L4 fuzz oracle (K10, D188) against closed forms: no kernel code on either side. A few leaves and one Boolean,
// at a coarse grid (the run uses a finer one), each within a few of its own error estimates.
const leaf = (L, rot = [], move = [0, 0, 0]) => ({ leaf: { ...L, rot, move } });
const near = (o, want, what) => assert.ok(Math.abs(o.volumeMM3 - want) <= Math.max(6 * o.e, 2e-3 * want), `${what}: ${o.volumeMM3} vs ${want} (e ${o.e})`);

test('fuzz oracle: a ball, a frustum, a rounded box (wdh − 4(1 − π/4)r²h) and a shelled box, closed and open, against their closed forms', () => {
  near(oracle(leaf({ kind: 'sphere', r: 2 }, [{ axis: 'x', deg: 33 }], [1, 1, 1]), 48), 4 / 3 * Math.PI * 8, 'ball');
  near(oracle(leaf({ kind: 'cone', r1: 3, r2: 1, h: 4 }, [{ axis: 'y', deg: 90 }]), 48), Math.PI * 4 / 3 * (9 + 3 + 1), 'frustum');
  near(oracle(leaf({ kind: 'rbox', w: 4, d: 3, h: 2, r: 0.5 }), 48), 24 - 4 * (1 - Math.PI / 4) * 0.25 * 2, 'rounded box');
  near(oracle(leaf({ kind: 'hbox', w: 4, d: 3, h: 2, t: 0.3, open: false }), 48), 24 - 3.4 * 2.4 * 1.4, 'shelled box');
  near(oracle(leaf({ kind: 'hbox', w: 4, d: 3, h: 2, t: 0.3, open: true }), 48), 24 - 3.4 * 2.4 * 1.7, 'open shelled box');
});

test('fuzz oracle: a box less a cylinder through it, and a linear pattern of two overlapping boxes, with their centroids', () => {
  const o = oracle({ op: 'difference', a: leaf({ kind: 'box', w: 6, d: 4, h: 2 }), b: leaf({ kind: 'cyl', r: 1, h: 4 }, [], [3, 2, -1]) }, 48);
  near(o, 48 - Math.PI * 2, 'box less a cylinder');
  assert.ok(o.centroidMM.every((x, k) => Math.abs(x - [3, 2, 1][k]) <= 6 * o.eCentroid + 1e-3), String(o.centroidMM));
  const p = oracle({ pattern: { kind: 'linear', axis: 'x', spacing: 1, count: 2 }, child: leaf({ kind: 'box', w: 2, d: 1, h: 1 }) }, 48);
  near(p, 3, 'two boxes overlapping by half');
  assert.ok(Math.abs(p.centroidMM[0] - 1.5) <= 6 * p.eCentroid + 1e-3, String(p.centroidMM));
});

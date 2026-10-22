import test from 'node:test';
import assert from 'node:assert/strict';
import { faceRuns, paintFaces, type ColorTarget, type Painted } from '../src/viewport/facePaint';
import { fillVertexColors, vertexColors } from '../../../packages/barocss-gpu/src/viewer/geometry';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';

// PERF3 B7: a hover repaints only the faces whose state changed; the colours on the GPU are the same bytes a whole
// repaint makes. The target is the viewer geometry's own conversion (vertexColors, fillVertexColors) on a byte buffer.
class Target implements ColorTarget {
  bytes: Uint8Array; whole = 0; ranges = 0;
  constructor(n: number) { this.bytes = vertexColors(undefined, n); }
  setColors(c: ArrayLike<number>) { this.bytes = vertexColors(c, this.bytes.length / 4); this.whole++; }
  fillColors(first: number, count: number, c: ArrayLike<number>) { fillVertexColors(this.bytes, first, count, c); this.ranges++; }
}
const BASE: Vec3 = [0.74, 0.75, 0.78], ACC: Vec3 = [0.91, 0.76, 0.35];
const mix = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const shadeOf = (c: Vec3) => [c, mix(c, ACC, 0.2), mix(c, ACC, 0.42)];

test('B7 face runs: a face\'s vertices as runs in vertex order, a face that comes back a run of its own', () => {
  const r = faceRuns(new Float32Array([0, 0, 0, 1, 1, 2, 0, 0]));
  assert.deepEqual([...r.byFace.entries()], [[0, [0, 3, 6, 2]], [1, [3, 2]], [2, [5, 1]]]);
  assert.equal(r.vertexCount, 8);
});

test('B7 hover and selection: only the changed faces are written, and the bytes equal a whole repaint at every step; new colours paint the whole body', () => {
  // 40 faces of 25 vertices, face 7 also later on (two runs).
  const fv: number[] = [];
  for (let f = 0; f < 40; f++) for (let k = 0; k < 25; k++) fv.push(f);
  for (let k = 0; k < 5; k++) fv.push(7);
  const runs = faceRuns(fv), n = fv.length, t = new Target(n), whole = new Target(n), count = { vertices: 0 };
  const shades = new Map([[3, shadeOf([0.2, 0.5, 0.9])]]);
  let p: Painted | null = null;
  const step = (state: [number, number][], key = 'k', expectVertices?: number) => {
    const fs = new Map(state), before = count.vertices;
    p = paintFaces(t, runs, p, key, fs, shadeOf(BASE), shades, count);
    paintFaces(whole, runs, null, key, fs, shadeOf(BASE), shades);
    assert.deepEqual(t.bytes, whole.bytes, JSON.stringify(state));
    if (expectVertices !== undefined) assert.equal(count.vertices - before, expectVertices, JSON.stringify(state));
  };
  step([], 'k', n); assert.equal(t.whole, 1);
  step([[5, 1]], 'k', 25); step([[6, 1]], 'k', 50); step([[7, 1]], 'k', 55);
  step([[7, 1], [3, 2]], 'k', 25); step([[3, 1]], 'k', 55); step([[3, 1]], 'k', 0);
  assert.equal(t.whole, 1);
  // The colours changed (a theme, a body colour): the whole body once.
  step([[3, 1]], 'other', n); assert.equal(t.whole, 2);
  // Most of the body selected at once: one whole write rather than many ranges.
  const most = Array.from({ length: 30 }, (_, f) => [f, 2] as [number, number]), ranges = t.ranges;
  step(most, 'other', n); assert.equal(t.whole, 3); assert.equal(t.ranges, ranges);
});

test('B7 vertexColors converts a run of one colour once: the same bytes as per vertex', () => {
  const c: number[] = [];
  for (let v = 0; v < 300; v++) { const k = Math.floor(v / 7) % 5; c.push(0.1 * k, 0.5, 1 - 0.13 * k); }
  const bytes = vertexColors(c, 300), lin = (x: number) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
  for (let v = 0; v < 300; v++) for (let j = 0; j < 3; j++) assert.equal(bytes[4 * v + j], Math.round(lin(Math.min(1, Math.max(0, c[3 * v + j]))) * 255));
  assert.throws(() => fillVertexColors(bytes, 299, 2, [1, 1, 1]), /not within/);
  assert.throws(() => fillVertexColors(bytes, 0, 1, [1, 1]), /three or four/);
});

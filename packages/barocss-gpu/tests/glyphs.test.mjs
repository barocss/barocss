// G15: the labels' glyphs — our own distance transform, exact against a brute-force search; a glyph's field signed and
// spread as the shader reads it; the atlas and the layout (lines, advances, align, the box's two instances).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ATLAS_CELLS, GLYPH_CELL, GLYPH_EM, GLYPH_SPREAD, GlyphAtlas, LABEL_FLOATS, distanceField, layoutLabels, squaredDistances } from '../dist/viewer/glyphs.js';

test('the squared distance transform equals a brute-force search on random seeds, of several sizes', () => {
  let seed = 7; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const [w, h, p] of [[17, 11, 0.05], [64, 64, 0.01], [9, 40, 0.2], [32, 32, 0.002]]) {
    const s = Array.from({ length: w * h }, () => rand() < p), d = squaredDistances(s, w, h);
    const seeds = []; s.forEach((v, i) => { if (v) seeds.push([i % w, Math.floor(i / w)]); });
    for (let i = 0; i < w * h; i++) {
      const x = i % w, y = Math.floor(i / w);
      let best = 1e20; for (const [a, b] of seeds) best = Math.min(best, (x - a) ** 2 + (y - b) ** 2);
      assert.equal(d[i], best, `${w}×${h} at ${x},${y}`);
    }
  }
});

test('a glyph field: above the middle inside, below outside, to the spread either way', () => {
  // A disc of radius 12 in the cell's middle.
  const c = GLYPH_CELL / 2, cov = new Uint8Array(GLYPH_CELL * GLYPH_CELL);
  for (let i = 0; i < cov.length; i++) { const x = i % GLYPH_CELL + 0.5, y = Math.floor(i / GLYPH_CELL) + 0.5; cov[i] = Math.hypot(x - c, y - c) < 12 ? 255 : 0; }
  const f = distanceField(cov), at = (x, y) => f[y * GLYPH_CELL + x];
  assert.ok(at(c, c) === 255, 'the middle: far inside, saturated');
  assert.ok(at(c + 11, c) > 128 && at(c + 13, c) < 128, `the edge between 11 and 13 px out: ${at(c + 11, c)}, ${at(c + 13, c)}`);
  // (Pixel c + 16's centre is 4.5 px past the edge at 12.)
  assert.ok(Math.abs(at(c + 16, c) - (128 - 127 * 4.5 / GLYPH_SPREAD)) <= 2, `4.5 px out: ${at(c + 16, c)}`);
  assert.equal(at(0, 0), 0, 'far outside: saturated');
});

test('the layout: lines a line apart, glyphs at their advances, the box centred by align; a box takes two instances', () => {
  // A stand-in rasteriser: every glyph a 20 em-pixel square, advance 24.
  const raster = () => { const cov = new Uint8Array(GLYPH_CELL * GLYPH_CELL); for (let y = 12; y < 32; y++) for (let x = GLYPH_SPREAD; x < GLYPH_SPREAD + 20; x++) cov[y * GLYPH_CELL + x] = 255; return { coverage: cov, advance: 24 }; };
  const atlas = new GlyphAtlas('test', raster), pack = () => 0xffffffff;
  const { data, count } = layoutLabels([{ text: 'ab\nc', at: [1, 2, 3], size: GLYPH_EM, background: { color: [0, 0, 0] } }], atlas, pack);
  assert.equal(count, 2 + 3);
  assert.equal(atlas.fields.length, 3, 'a, b, c drawn once each');
  const inst = k => Array.from(data.subarray(k * LABEL_FLOATS, (k + 1) * LABEL_FLOATS));
  // The box: the text's width (48 at size = em) by two lines (2 × 1.25 em), centred, padded 4.
  const box = inst(0);
  assert.deepEqual(box.slice(0, 3), [1, 2, 3]);
  assert.deepEqual(box.slice(4, 8).map(v => Math.round(v * 100) / 100), [-28, -59, 28, 59]);
  assert.equal(inst(1)[8], -1, 'the border instance');
  // 'a' and 'b' one advance apart; 'c' a line below, centred on its own width.
  const [a, b, c] = [inst(2), inst(3), inst(4)];
  assert.equal(b[4] - a[4], 24);
  assert.equal(c[5] - a[5], 1.25 * GLYPH_EM);
  assert.equal(c[4] - a[4], 12, 'the shorter line centred');
  // Their uvs: cells 0, 1, 2 of the atlas.
  assert.deepEqual([a[8], b[8], c[8]].map(v => Math.round(v * ATLAS_CELLS)), [0, 1, 2]);
});

const rgba2 = new Uint8Array([
  255, 0, 0, 255,      0, 255, 0, 255,
  0, 0, 255, 255,      255, 255, 0, 128,
]);
const checker8 = new Uint8Array(8 * 8 * 4);
for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
  const index = (y * 8 + x) * 4;
  checker8[index] = x * 28;
  checker8[index + 1] = y * 28;
  checker8[index + 2] = (x + y) * 14;
  checker8[index + 3] = (x + y) % 2 ? 255 : 120;
}
const glyphAtlas = new Uint8Array(10 * 7 * 4);
const letters = [
  ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
];
for (let letter = 0; letter < 2; letter++) for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) {
  if (letters[letter][y][x] !== '1') continue;
  const offset = (y * 10 + letter * 5 + x) * 4;
  glyphAtlas.set([20, 32, 56, 255], offset);
}

export const imageAssets = [
  ['RGBA2', { width: 2, height: 2, pixels: rgba2 }],
  ['Checker8', { width: 8, height: 8, pixels: checker8 }],
  ['GlyphHI', { width: 10, height: 7, pixels: glyphAtlas }],
];

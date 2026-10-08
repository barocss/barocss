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

export const imageAssets = [
  ['RGBA2', { width: 2, height: 2, pixels: rgba2 }],
  ['Checker8', { width: 8, height: 8, pixels: checker8 }],
];

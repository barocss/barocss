import { Canvas2DError } from '../../packages/barocss-canvas2d/dist/index.js';

const patterns = {
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
};
const ink = [20, 32, 56, 255];

export function makeTextCandidate(text, atlasId) {
  if (typeof text !== 'string' || !/^[HI ]{1,6}$/.test(text) || !/[HI]/.test(text)) {
    throw new Canvas2DError('UNSUPPORTED_FEATURE', 'text supports 1–6 H, I or spaces with one visible letter');
  }
  if (typeof atlasId !== 'string' || !/^Atlas(?:[1-9][0-9]*)$/.test(atlasId)) {
    throw new Canvas2DError('INVALID_ASSET', 'atlas ID must be AtlasN');
  }
  const width = text.length * 5, height = 7, pixels = new Uint8Array(width * height * 4);
  const glyphs = [];
  for (let index = 0; index < text.length; index++) {
    const letter = text[index];
    if (letter === ' ') continue;
    for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) {
      if (patterns[letter][y][x] !== '1') continue;
      pixels.set(ink, (y * width + index * 5 + x) * 4);
    }
    glyphs.push({ sourceRect: { x: index * 5, y: 0, width: 5, height: 7 },
      x: index * 48, y: -56, width: 40, height: 56, textStart: index, textEnd: index + 1 });
  }
  return { asset: { width, height, pixels }, run: {
    kind: 'glyphRun', id: 'EditableText', layer: 1,
    transform: { x: 30, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    atlasId, text, baseline: 120, opacity: 1, sampling: 'nearest', glyphs,
  } };
}

export function initialTextScene(run) {
  return { version: 4, unit: 'logical-px', contextId: 'TextBoard', nodes: [
    { kind: 'rect', id: 'Paper', layer: 0,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      width: 400, height: 200, fill: [1, 1, 1, 1] },
    run,
  ] };
}

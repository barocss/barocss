import { imageAssets } from './image-assets.mjs';

const transform = (x = 0, y = 0) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });

function frame(index) {
  const column = index % 4, row = Math.floor(index / 4);
  const children = [
    { kind: 'rect', id: `Card${index}`, layer: 0, transform: transform(10, 10),
      width: 120, height: 52, fill: [0.85, 0.92, 1, 1] },
    { kind: 'rect', id: `Inset${index}`, layer: 1, transform: transform(18, 18),
      width: 32, height: 22, fill: [0.15, 0.55, 0.8, 1] },
    { kind: 'rect', id: `Stripe${index}`, layer: 2, transform: transform(10, 68),
      width: 135, height: 4, fill: [0.8, 0.2, 0.15, 1] },
    { kind: 'line', id: `Rule${index}`, layer: 3, transform: transform(),
      x1: 14, y1: 80, x2: 130, y2: 80, width: 2, stroke: [0.1, 0.15, 0.3, 1] },
    { kind: 'path', id: `Fill${index}`, layer: 4, transform: transform(),
      commands: [
        { kind: 'M', x: 12, y: 88 }, { kind: 'L', x: 67, y: 88 },
        { kind: 'L', x: 67, y: 125 }, { kind: 'L', x: 12, y: 125 }, { kind: 'Z' },
      ], fill: { color: [0.88, 0.3, 0.25, 1], rule: 'evenodd' },
      stroke: { color: [0.3, 0.12, 0.1, 1], width: 2 } },
    { kind: 'path', id: `Curve${index}`, layer: 5, transform: transform(),
      commands: [
        { kind: 'M', x: 72, y: 90 }, { kind: 'Q', cx: 100, cy: 72, x: 128, y: 92 },
        { kind: 'C', c1x: 140, c1y: 102, c2x: 130, c2y: 120, x: 104, y: 126 },
      ], stroke: { color: [0.16, 0.25, 0.45, 1], width: 3 } },
    { kind: 'path', id: `Hole${index}`, layer: 6, transform: transform(),
      commands: [
        { kind: 'M', x: 18, y: 130 }, { kind: 'L', x: 67, y: 130 },
        { kind: 'L', x: 67, y: 151 }, { kind: 'L', x: 18, y: 151 }, { kind: 'Z' },
        { kind: 'M', x: 32, y: 135 }, { kind: 'L', x: 53, y: 135 },
        { kind: 'L', x: 53, y: 146 }, { kind: 'L', x: 32, y: 146 }, { kind: 'Z' },
      ], fill: { color: [0.2, 0.7, 0.4, 1], rule: 'evenodd' } },
    { kind: 'image', id: `Image${index}`, layer: 7, transform: transform(132, 14),
      imageId: 'RGBA2', width: 24, height: 24, opacity: 1, sampling: 'nearest' },
    { kind: 'glyphRun', id: `Glyph${index}`, layer: 8, transform: transform(84, 0),
      atlasId: 'GlyphHI', text: 'HI', baseline: 68, opacity: 1, sampling: 'nearest', glyphs: [
        { sourceRect: { x: 0, y: 0, width: 5, height: 7 }, x: 0, y: -28,
          width: 20, height: 28, textStart: 0, textEnd: 1 },
        { sourceRect: { x: 5, y: 0, width: 5, height: 7 }, x: 24, y: -28,
          width: 20, height: 28, textStart: 1, textEnd: 2 },
      ] },
  ];
  return { kind: 'frame', id: `Frame${index}`, layer: index,
    transform: transform(20 + column * 190, 20 + row * 190),
    width: 170, height: 160, fill: [1, 1, 1, 1], clip: true, children };
}

export const corpusScene = {
  version: 4, unit: 'logical-px', contextId: 'PerfBoard',
  nodes: Array.from({ length: 8 }, (_, index) => frame(index)),
};
export const corpusAssets = imageAssets.filter(([id]) => id === 'RGBA2' || id === 'GlyphHI');
export const corpusSize = { width: 800, height: 480 };
export const missPoint = { x: 790, y: 450 };
export const visiblePoint = { x: 36, y: 36 };

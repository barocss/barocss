export const vectorScene = {
  version: 5, unit: 'logical-px', contextId: 'VectorBoard', nodes: [
    { kind: 'group', id: 'Artwork', layer: 0,
      transform: { x: 10, y: 5, scaleX: 1, scaleY: 1, rotation: 0 }, children: [
        { kind: 'path', id: 'Shape', layer: 0,
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
          commands: [
            { kind: 'M', x: 20, y: 20 }, { kind: 'L', x: 140, y: 20 },
            { kind: 'L', x: 140, y: 140 }, { kind: 'L', x: 20, y: 140 }, { kind: 'Z' },
            { kind: 'M', x: 60, y: 60 }, { kind: 'L', x: 60, y: 100 },
            { kind: 'L', x: 100, y: 100 }, { kind: 'L', x: 100, y: 60 }, { kind: 'Z' },
          ], fill: { color: [0.2, 0.4, 0.8, 1], rule: 'nonzero' },
        },
        { kind: 'path', id: 'Curve', layer: 1,
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
          commands: [
            { kind: 'M', x: 155, y: 45 },
            { kind: 'Q', cx: 185, cy: 20, x: 215, y: 45 },
            { kind: 'C', c1x: 225, c1y: 55, c2x: 225, c2y: 85, x: 215, y: 95 },
          ], stroke: { color: [34 / 255, 51 / 255, 68 / 255, 1], width: 8 },
        },
      ] },
  ],
};

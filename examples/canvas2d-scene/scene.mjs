export const initialSceneV0 = {
  version: 0,
  unit: 'logical-px',
  contextId: 'DesignBoard',
  nodes: [
    {
      kind: 'frame', id: 'FrameA', layer: 0,
      transform: { x: 70, y: 60, scaleX: 1, scaleY: 1, rotation: 0 },
      width: 300, height: 250, fill: [0.94, 0.96, 1, 1], clip: true,
      children: [
        { kind: 'rect', id: 'BlueCard', layer: 0,
          transform: { x: 35, y: 45, scaleX: 1, scaleY: 1, rotation: 0 },
          width: 170, height: 130, fill: [0.1, 0.38, 0.95, 1] },
        { kind: 'rect', id: 'OrangeCard', layer: 1,
          transform: { x: 110, y: 95, scaleX: 1, scaleY: 1, rotation: 0 },
          width: 240, height: 110, fill: [1, 0.38, 0.12, 0.8] },
        { kind: 'line', id: 'AccentA', layer: 2,
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
          x1: 30, y1: 220, x2: 265, y2: 220, width: 8, stroke: [0.05, 0.12, 0.25, 1] },
      ],
    },
    {
      kind: 'frame', id: 'FrameB', layer: 1,
      transform: { x: 430, y: 95, scaleX: 1, scaleY: 1, rotation: 0 },
      width: 300, height: 250, fill: [1, 0.96, 0.9, 1], clip: true,
      children: [
        { kind: 'group', id: 'GroupB', layer: 0,
          transform: { x: 20, y: 20, scaleX: 1, scaleY: 1, rotation: 0 },
          children: [
            { kind: 'rect', id: 'VioletCard', layer: 0,
              transform: { x: 20, y: 25, scaleX: 1, scaleY: 1, rotation: 0.16 },
              width: 135, height: 145, fill: [0.46, 0.25, 0.88, 0.9] },
            { kind: 'rect', id: 'MintCard', layer: 1,
              transform: { x: 100, y: 95, scaleX: 1, scaleY: 1, rotation: 0 },
              width: 170, height: 125, fill: [0.05, 0.7, 0.55, 0.85] },
          ],
        },
        { kind: 'line', id: 'AccentB', layer: 2,
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
          x1: 15, y1: 235, x2: 280, y2: 15, width: 5, stroke: [0.15, 0.15, 0.18, 1] },
      ],
    },
  ],
};

export const initialScene = structuredClone(initialSceneV0);
initialScene.version = 1;
initialScene.nodes[1].children.push({
  kind: 'path', id: 'PathRibbon', layer: 3,
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  width: 7, stroke: [0.94, 0.08, 0.35, 1],
  commands: [
    { kind: 'M', x: 25, y: 205 },
    { kind: 'Q', cx: 105, cy: 12, x: 180, y: 85 },
    { kind: 'C', c1x: 285, c1y: 38, c2x: 345, c2y: 210, x: 112, y: 215 },
    { kind: 'Z' },
  ],
});

export const initialSceneV2 = structuredClone(initialScene);
initialSceneV2.version = 2;
const ribbon = initialSceneV2.nodes[1].children.at(-1);
ribbon.stroke = { color: ribbon.stroke, width: ribbon.width };
delete ribbon.width;
initialSceneV2.nodes[0].children.push({
  kind: 'path', id: 'FilledBadge', layer: 3,
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  fill: { color: [0.04, 0.72, 0.78, 0.92], rule: 'evenodd' },
  stroke: { color: [0.02, 0.25, 0.38, 1], width: 3 },
  commands: [
    { kind: 'M', x: 18, y: 18 }, { kind: 'L', x: 280, y: 18 },
    { kind: 'L', x: 280, y: 225 }, { kind: 'L', x: 190, y: 225 },
    { kind: 'Q', cx: 145, cy: 153, x: 105, y: 225 },
    { kind: 'L', x: 18, y: 225 }, { kind: 'Z' },
    { kind: 'M', x: 75, y: 60 }, { kind: 'L', x: 225, y: 60 },
    { kind: 'L', x: 225, y: 165 }, { kind: 'L', x: 75, y: 165 }, { kind: 'Z' },
    { kind: 'M', x: 120, y: 90 }, { kind: 'L', x: 180, y: 90 },
    { kind: 'L', x: 180, y: 135 }, { kind: 'L', x: 120, y: 135 }, { kind: 'Z' },
  ],
});
initialSceneV2.nodes[1].children.push({
  kind: 'path', id: 'CrossingFill', layer: 4,
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  fill: { color: [1, 0.62, 0.08, 0.9], rule: 'evenodd' },
  commands: [
    { kind: 'M', x: 175, y: 25 }, { kind: 'L', x: 275, y: 125 },
    { kind: 'L', x: 175, y: 125 }, { kind: 'L', x: 275, y: 25 }, { kind: 'Z' },
  ],
});

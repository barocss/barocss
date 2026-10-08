const outer = [
  { kind: 'M', x: -10, y: -10 }, { kind: 'L', x: 170, y: -10 },
  { kind: 'L', x: 170, y: 170 }, { kind: 'L', x: -10, y: 170 }, { kind: 'Z' },
];
const inner = [
  { kind: 'M', x: 45, y: 45 }, { kind: 'L', x: 115, y: 45 },
  { kind: 'L', x: 115, y: 115 }, { kind: 'L', x: 45, y: 115 }, { kind: 'Z' },
];
const innerReversed = [
  { kind: 'M', x: 45, y: 45 }, { kind: 'L', x: 45, y: 115 },
  { kind: 'L', x: 115, y: 115 }, { kind: 'L', x: 115, y: 45 }, { kind: 'Z' },
];

export function sceneFor(rule, opposite = false) {
  return {
    version: rule === 'nonzero' ? 5 : 2, unit: 'logical-px', contextId: 'NonzeroBoard',
    nodes: [{
      kind: 'frame', id: 'ClipFrame', layer: 0,
      transform: { x: 10, y: 10, scaleX: 1, scaleY: 1, rotation: 0 },
      width: 160, height: 160, fill: [1, 1, 1, 1], clip: true,
      children: [{
        kind: 'path', id: 'NestedFill', layer: 0,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        commands: [...outer, ...(opposite ? innerReversed : inner)],
        fill: { color: [1, 0, 0, 1], rule },
      }],
    }],
  };
}

export function crossingScene() {
  const scene = sceneFor('nonzero');
  scene.nodes[0].children[0].commands = [
    { kind: 'M', x: 15, y: 15 }, { kind: 'L', x: 145, y: 145 },
    { kind: 'L', x: 15, y: 145 }, { kind: 'L', x: 145, y: 15 }, { kind: 'Z' },
  ];
  return scene;
}

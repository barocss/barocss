export const left = { contours: [
  { id: 'LeftOuter', points: [
    { x: 20, y: 20 }, { x: 180, y: 20 }, { x: 180, y: 80 },
    { x: 120, y: 80 }, { x: 120, y: 180 }, { x: 20, y: 180 },
  ] },
  { id: 'LeftHole', points: [
    { x: 40, y: 100 }, { x: 40, y: 140 }, { x: 80, y: 140 }, { x: 80, y: 100 },
  ] },
] };

export const right = { contours: [
  { id: 'RightOuter', points: [
    { x: 90, y: 50 }, { x: 220, y: 50 }, { x: 220, y: 150 },
    { x: 170, y: 150 }, { x: 170, y: 200 }, { x: 90, y: 200 },
  ] },
] };

export function sceneFromResult(result) {
  return { version: 5, unit: 'logical-px', contextId: 'BooleanBoard', nodes: [
    { kind: 'rect', id: 'Background', layer: 0,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      width: 260, height: 240, fill: [1, 1, 1, 1] },
    ...(result.contours.length ? [{ kind: 'path', id: 'BooleanFill', layer: 1,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      commands: result.contours.flatMap(contour => [
        { kind: 'M', ...contour.points[0] },
        ...contour.points.slice(1).map(point => ({ kind: 'L', ...point })),
        { kind: 'Z' },
      ]), fill: { color: [0.12, 0.46, 0.84, 1], rule: 'nonzero' } }] : []),
  ] };
}

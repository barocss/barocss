export const anchorAsset = { width: 2, height: 2, pixels: new Uint8Array([
  255, 0, 0, 255, 0, 0, 0, 0,
  0, 0, 255, 255, 0, 255, 0, 255,
]) };
export const anchorOptions = { logicalSize: { width: 240, height: 200 }, dpr: 2 };

export function anchorScene(version = 6, anchorX = 0.5, anchorY = 0.5) {
  const image = { kind: 'image', id: 'Sprite', layer: 1,
    transform: { x: 100, y: 80, scaleX: 1, scaleY: 1, rotation: Math.PI / 2 },
    imageId: 'Anchor2', width: 80, height: 40, opacity: 1, sampling: 'nearest',
    ...(version === 6 ? { anchorX, anchorY } : {}) };
  return { version, unit: 'logical-px', contextId: 'AnchorBoard', nodes: [
    { kind: 'frame', id: 'Paper', layer: 0,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      width: 240, height: 200, fill: [1, 1, 1, 1], clip: true, children: [image] },
  ] };
}

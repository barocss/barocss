import { createDisplayTree, createDisplayTreeFromScene } from '../dist/index.js';
import type { SpriteAlphaMask, SpriteSpec, SpriteData, ImageNodeV28, ImageNodeV29,
  NodeV29, GroupNodeV29, FrameNodeV29, SceneV29 } from '../dist/index.js';
import type { SpriteAlphaMask as SourceMask } from '../src/index.js';
export function alphaMaskPublicTypes(spec: SpriteSpec) {
  const mask: SpriteAlphaMask = [1, 0, 0, 0];
  const sourceMask: SourceMask = mask;
  const tree = createDisplayTree('AlphaMaskTypes');
  const sprite = tree.createSprite({ ...spec, alphaMask: sourceMask });
  sprite.setAlphaMask(mask); sprite.setAlphaMask(null);
  const data: SpriteData = sprite.data;
  const scene: SceneV29 = tree.snapshot();
  const restored = createDisplayTreeFromScene(scene);
  const image: ImageNodeV29 = { kind: 'image', ...data, alphaMask: mask };
  const node: NodeV29 = image;
  const group: GroupNodeV29 = { kind: 'group', id: 'Group', layer: 0, transform: spec.transform,
    visible: true, alpha: 1, hitMode: 'auto', children: [node] };
  const frame: FrameNodeV29 = { kind: 'frame', id: 'Frame', layer: 0, transform: spec.transform,
    visible: true, alpha: 1, hitMode: 'auto', width: 10, height: 10, fill: [0, 0, 0, 0], clip: true, children: [node] };
  // @ts-expect-error The row requires four values.
  const short: SpriteAlphaMask = [1, 0, 0];
  // @ts-expect-error Historical images have no alphaMask property.
  const historicalMask: ImageNodeV28['alphaMask'] = mask;
  void [short, historicalMask];
  return { data, scene, restored, group, frame };
}

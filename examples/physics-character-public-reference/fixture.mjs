function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
const identity = () => [0, 0, 0, 1];
const box = (id, centerM, halfExtentsM, orientationXYZW = identity()) => ({ id, centerM, halfExtentsM, orientationXYZW });
const floor = () => box('floor', [0, -0.05, 0], [3, 0.05, 1]);
const step = () => box('step10', [0.5, 0.05, 0], [0.25, 0.05, 0.75]);
const angle = 15 * Math.PI / 180;
const slope = () => box('slope15', [0.05 * Math.sin(angle), -0.05 * Math.cos(angle), 0],
  [3, 0.05, 1], [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)]);
const scene = boxes => ({ version: 1, profile: 'upright-capsule-box-v1', revision: 'movementRef1', boxes });
const make = (name, boxes, positionM, requestMps, expectedError = null) => ({ name,
  scene: scene(boxes), positionM, requestMps, expectedError });

export const CASES = freeze([
  make('REST', [floor()], [0, 0.505, 0], [0, 0, 0]),
  make('FLAT', [floor()], [-1, 0.505, 0], [1, 0, 0]),
  make('STEP10', [floor(), step()], [-1, 0.505, 0], [1, 0, 0]),
  make('SLOPE15', [slope()], [-0.75, Math.tan(angle) * -0.75 + 0.35 + (0.15 + 0.005) / Math.cos(angle), 0], [1, 0, 0]),
  make('HEADROOM', [floor(), step(), box('headroom', [0, 1.105, 0], [3, 0.05, 1])], [-1, 0.505, 0], [1, 0, 0]),
  make('TOO_HIGH15', [floor(), box('step15', [0.5, 0.075, 0], [0.25, 0.075, 0.75])], [-1, 0.505, 0], [1, 0, 0]),
  make('WALL_SLIDE', [floor(), box('wall', [0.5, 0.6, 0], [0.05, 1, 1])], [-1, 0.505, 0], [Math.sqrt(0.75), 0, 0.5]),
  make('SPAWN_OVERLAP', [floor()], [0, 0.495, 0], [0, 0, 0], 'INITIAL_OVERLAP'),
]);

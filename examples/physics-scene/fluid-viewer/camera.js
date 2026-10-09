export function cameraForScene(selection) {
  const highDrop = selection.startsWith('splash');
  return {
    eye: highDrop ? [1.45, 1.35, 1.9] : [1.25, 1.1, 1.45],
    target: highDrop ? [0.35, 0.65, 0.25] : [0.35, 0.42, 0.25],
    up: [0, 1, 0], fovYDegrees: 45, near: 0.01, far: 10,
  };
}
